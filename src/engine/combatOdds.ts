import type { CombatResult } from '../data/combatTable';
import { isRammingHitWithBonus, type ShipTypeId } from '../data/navalRamming';
import {
  describeLandAttack,
  legalRetreatHexes,
  pushCandidates,
  resolveNavalBoarding,
  type LandAttackDetail,
} from './combat';
import {
  currentAttack,
  currentDefense,
  maxEquipmentPoints,
  unitType,
  type GameState,
  type Unit,
} from './state';

/**
 * Exact outcome distributions and expected-value scoring for a candidate
 * combat — the arithmetic half of plan.md §6.4's Stage 3 `HeuristicAgent`,
 * kept in its own pure module so it can be unit-tested (and reused by the
 * combat log, a future difficulty tuner, or an evaluation harness) without
 * dragging in any agent policy.
 *
 * THE KEY PROPERTY, and why this file is small (plan.md §6.1): the CRT is
 * *exactly solvable, not merely simulatable*. `describeLandAttack` is pure
 * and the only random input to a land combat is one 1-6 die, so evaluating
 * all six faces yields the true outcome distribution — no rollouts, no
 * sampling, no variance. Every "probability" below is an exact rational with
 * denominator 6.
 *
 * The distribution half (`attackOutcomeDistribution`) is therefore *fact*:
 * it re-derives nothing and can't disagree with the rules, because it calls
 * the same `describeLandAttack` the real resolution calls. The valuation
 * half (`evaluateAttack` and friends) is *policy*: turning "37% chance of
 * DR" into a single comparable number requires judgement calls, and every
 * one of them is named as a constant below rather than buried in an
 * expression.
 */

/** The six faces of the die, in order — `DIE_FACES[i]` is face `i + 1`. */
export const DIE_FACES: readonly number[] = [1, 2, 3, 4, 5, 6];

const ALL_RESULTS: readonly CombatResult[] = ['AE', 'AR', 'DE', 'DR', 'EX'];

function zeroCounts(): Record<CombatResult, number> {
  return { AE: 0, AR: 0, DE: 0, DR: 0, EX: 0 };
}

/**
 * Material worth of a unit, in purchase points — the currency the game's own
 * turn-limit ending is decided in ("le joueur dont l'armée a la plus grande
 * valeur", `docs/research/05-rules-french-original.md:39-40`, implemented by
 * `turnManager.ts`'s `endGameByTimeLimit`), so an agent maximizing this is
 * maximizing close to the thing that actually wins a timed game rather than
 * a proxy for it.
 *
 * "Close to", not "exactly": `armyValue` — what that ending really counts —
 * sums each surviving unit's FULL printed cost, while this pro-rates a
 * damaged ship (see below). The divergence is deliberate and is confined to
 * ships; for a land army the two agree unit for unit.
 *
 * Ships are pro-rated by remaining equipment: a trirème (30 points) at 2 of
 * its 4 equipment points has already lost half its attack and defense (see
 * `currentAttack`/`currentDefense`), so counting it at full price would make
 * a crippled ship look as valuable as a fresh one, and — worse for the
 * scoring below — would make the second boarding hit that finally sinks it
 * look far more valuable than the first three that did the same damage.
 * Land units have no equivalent partial-damage state (they are alive or
 * destroyed), so their value is just their printed cost.
 */
export function unitValue(unit: Unit): number {
  const cost = unitType(unit).cost;
  const max = maxEquipmentPoints(unit);
  if (max <= 0) return cost; // land unit: no partial damage state
  const remaining = Math.max(0, Math.min(max, unit.equipmentPoints ?? max));
  return (cost * remaining) / max;
}

function totalValue(units: readonly Unit[]): number {
  return units.reduce((sum, u) => sum + unitValue(u), 0);
}

export interface AttackOutcomeDistribution {
  /** How many of the six die faces produce each result. Sums to 6. */
  faceCounts: Record<CombatResult, number>;
  /** `resultByFace[i]` is the result of rolling face `i + 1`. */
  resultByFace: CombatResult[];
  /** The full breakdown per face, in case a caller wants the modified die or
   * the clamp (see `LandAttackDetail`). Cheap — six objects. */
  detailByFace: LandAttackDetail[];
  /** Roll-independent inputs, lifted out of the per-face details so a caller
   * doesn't have to know they're identical across all six. They are: the
   * force totals, the ratio column and the terrain/river modifier depend
   * only on the units and the board, never on the die. */
  attackForce: number;
  defenseForce: number;
  ratioLabel: string;
  crtColumnIndex: number;
  terrainModifier: number;
}

/**
 * The exact distribution of results for this attack, computed by evaluating
 * the real resolution path (`describeLandAttack`) once per die face.
 *
 * Note this is NOT a uniform spread over the CRT column: the terrain/river
 * modifier is added to the die *before* the [1,6] clamp, so a +2 modifier
 * makes faces 4, 5 and 6 all resolve as row 6 — three faces landing on one
 * row is precisely how a defensive position shows up in the odds, and
 * counting faces (rather than rows) is what captures it.
 */
export function attackOutcomeDistribution(
  attackers: readonly Unit[],
  defenders: readonly Unit[],
): AttackOutcomeDistribution {
  const detailByFace = DIE_FACES.map((face) => describeLandAttack([...attackers], [...defenders], face));
  const faceCounts = zeroCounts();
  const resultByFace: CombatResult[] = [];
  for (const detail of detailByFace) {
    faceCounts[detail.result]++;
    resultByFace.push(detail.result);
  }
  const first = detailByFace[0]!;
  return {
    faceCounts,
    resultByFace,
    detailByFace,
    attackForce: first.attackForce,
    defenseForce: first.defenseForce,
    ratioLabel: first.ratioLabel,
    crtColumnIndex: first.crtColumnIndex,
    terrainModifier: first.terrainModifier,
  };
}

/** Exact probability of `result`, in [0, 1] — always a multiple of 1/6. */
export function probabilityOf(distribution: AttackOutcomeDistribution, result: CombatResult): number {
  return distribution.faceCounts[result] / DIE_FACES.length;
}

/**
 * Non-material worth of driving the enemy back a hex (and, negated, the cost
 * of being driven back yourself) when the retreat does NOT eliminate
 * anything.
 *
 * A POLICY CONSTANT, not a rule: the rulebook attaches no value to a retreat
 * at all. It exists because a pure "material only" valuation scores every
 * AR and DR as exactly 0, which makes the overwhelming majority of this
 * game's combats look worthless — plan.md §6.8's soak measured 306 DR and
 * 178 AR against just 28 AE / 21 EX / 18 DE, i.e. the CRT's near-even
 * columns produce nothing BUT retreats. An agent indifferent to those would
 * decline almost every attack it could make. Deliberately small (a fifth of
 * the cheapest unit on the roster) so it can tip a coin-flip but can never
 * outweigh a real loss.
 *
 * Charged ONCE PER SIDE, not once per unit — see `retreatCost`. Getting this
 * wrong is not a matter of taste: a per-unit tempo cost makes an attack
 * scale WORSE with the number of attackers (five units repelled would cost
 * five times as much tempo as one, while the single defender they pushed
 * back still only pays once), so an agent using it declines every combined
 * attack and, at ratios of 2:1 and up where attackers necessarily outnumber
 * defenders, declines almost every attack at all. That is the opposite of
 * the rule the CRT actually encodes, which rewards concentration; it was
 * caught by working the numbers on a three-unit group before the tier was
 * ever soaked.
 */
export const RETREAT_TEMPO_VALUE = 1;

export interface AttackEvaluation {
  distribution: AttackOutcomeDistribution;
  /** Expected material swing in purchase points, from the ATTACKER's point
   * of view: positive means the attack is expected to gain more than it
   * costs. This is the number an EV-tier agent maximizes. */
  expectedValue: number;
  /** The swing each individual result would produce, again attacker-side —
   * `expectedValue` is exactly `sum(faceCounts[r] * valueByResult[r]) / 6`. */
  valueByResult: Record<CombatResult, number>;
  /** Expected material the attacker loses (a non-negative number), ignoring
   * anything it gains — what the 'greedy' difficulty tier deliberately
   * throws away. */
  expectedAttackerLoss: number;
  /** Expected material the defender loses (non-negative). */
  expectedDefenderLoss: number;
}

/**
 * Would `unit` be destroyed outright if a combat result forced it to retreat
 * right now? `applyLandCombatResult`'s `forceRetreat` eliminates a unit with
 * no legal retreat hex AND no friendly to push aside, so this is not a
 * guess — it asks the same two engine predicates, against the same state,
 * that the real resolution will ask a moment later.
 *
 * Elephants are the one exception: they never retreat, they drift (see
 * `LandCombatOutcome.pendingDrifts`), which can end anywhere from unharmed
 * to dead depending on a second die and whatever it tramples. Treated as
 * "not an outright loss" here — the drift cascade is unresolvable headlessly
 * until plan.md §6.7's Stage 2b lands, so modelling its odds would be
 * inventing numbers no caller can currently even play out.
 */
export function wouldBeEliminatedByRetreat(state: GameState, unit: Unit): boolean {
  if (unitType(unit).id === 'elephants') return false;
  return legalRetreatHexes(state, unit).length === 0 && pushCandidates(state, unit).length === 0;
}

/**
 * Value lost by a side forced to retreat: the full worth of every unit that
 * has nowhere to go — those are real, per-unit kills — plus, once for the
 * whole side, `RETREAT_TEMPO_VALUE` if anyone actually gave ground.
 *
 * The material half is per unit and the positional half is per side. See
 * `RETREAT_TEMPO_VALUE` for why that asymmetry is deliberate rather than an
 * oversight: "our attack was repulsed" is one setback however many units
 * took part in it, whereas "three of our units died" is three losses.
 */
function retreatCost(state: GameState, units: readonly Unit[]): number {
  let cost = 0;
  let anyoneGaveGround = false;
  for (const unit of units) {
    if (wouldBeEliminatedByRetreat(state, unit)) cost += unitValue(unit);
    else anyoneGaveGround = true;
  }
  return cost + (anyoneGaveGround ? RETREAT_TEMPO_VALUE : 0);
}

/**
 * The cheapest subset of `attackers` whose combined attack value meets
 * `requiredForce` — the exchange sacrifice an attacker who cares about
 * material would actually pick (compare `RandomAgent.chooseExchangeSacrifice`,
 * which shuffles and takes a prefix).
 *
 * EXACT, not greedy, for groups of 12 or fewer: this is a small
 * cover problem (minimize total `unitValue` subject to total `currentAttack`
 * >= threshold) and an attack group is tiny, so enumerating all 2^n subsets
 * is both affordable and free of the classic greedy failure — "two cheap
 * units beat one mid-priced one" is exactly the case a value-per-force
 * ordering gets wrong. The greedy fallback above 12 attackers exists only so
 * this can never blow up; the shipped rosters cap an army at ~40 units total
 * and a single attack group at the handful adjacent to one hex, so it is not
 * expected to be reachable in play.
 *
 * Returns `[]` if no subset reaches the threshold, which per
 * `RandomAgent.chooseExchangeSacrifice`'s doc comment cannot happen for a
 * real 'EX' (the CRT only produces one at 4:1 or better, where the whole
 * group always suffices) — callers should treat `[]` as "sacrifice
 * everything" rather than as a valid answer.
 */
export function cheapestSacrifice(attackers: readonly Unit[], requiredForce: number): Unit[] {
  if (requiredForce <= 0) return [];
  if (attackers.length > 12) {
    // Greedy fallback: most attack force per point of value first.
    const ordered = [...attackers].sort(
      (a, b) => currentAttack(b) / Math.max(1, unitValue(b)) - currentAttack(a) / Math.max(1, unitValue(a)),
    );
    const selected: Unit[] = [];
    let force = 0;
    for (const unit of ordered) {
      selected.push(unit);
      force += currentAttack(unit);
      if (force >= requiredForce) return selected;
    }
    return [];
  }

  let best: Unit[] | null = null;
  let bestValue = Infinity;
  for (let mask = 1; mask < 1 << attackers.length; mask++) {
    let force = 0;
    let value = 0;
    for (let i = 0; i < attackers.length; i++) {
      if ((mask & (1 << i)) === 0) continue;
      const unit = attackers[i]!;
      force += currentAttack(unit);
      value += unitValue(unit);
    }
    if (force < requiredForce || value >= bestValue) continue;
    bestValue = value;
    best = attackers.filter((_, i) => (mask & (1 << i)) !== 0);
  }
  return best ?? [];
}

/**
 * Scores a candidate land attack as an expected material swing, exactly (see
 * this file's header) over the CRT's six faces.
 *
 * Per-result valuation, all from the attacker's side:
 * - `DE` — every defender dies: + their full value.
 * - `AE` — every attacker dies: - their full value.
 * - `EX` — defenders die and the attacker must sacrifice enough of its own
 *   to match their defense force. Valued with `cheapestSacrifice`, i.e. what
 *   `HeuristicAgent` will itself choose when the moment comes, so the score
 *   and the subsequent decision can't disagree. With a single attacker there
 *   is no choice at all — `applyLandCombatResult` destroys it outright.
 * - `AR`/`DR` — see `retreatCost`: a real loss for anyone with nowhere to
 *   retreat, a small tempo swing (`RETREAT_TEMPO_VALUE`) otherwise.
 *
 * NOT modelled, deliberately: the post-combat advance a `DR`/`DE` may open
 * (positional, and the agent's `chooseAdvance` handles it on its own terms),
 * and the enemy's reply next turn (that is lookahead — see
 * `heuristicAgent.ts`'s note on the deferred fourth difficulty tier).
 */
export function evaluateAttack(
  state: GameState,
  attackers: readonly Unit[],
  defenders: readonly Unit[],
): AttackEvaluation {
  const distribution = attackOutcomeDistribution(attackers, defenders);
  const attackersValue = totalValue(attackers);
  const defendersValue = totalValue(defenders);

  // Mirrors `applyLandCombatResult`'s own threshold: the defenders' total
  // defense force is what an exchange must be paid for with.
  const requiredSacrificeForce = defenders.reduce((sum, u) => sum + currentDefense(u), 0);
  let exchangeCost: number;
  if (attackers.length <= 1) {
    exchangeCost = attackersValue; // no choice offered; the lone attacker dies
  } else {
    const sacrifice = cheapestSacrifice(attackers, requiredSacrificeForce);
    exchangeCost = sacrifice.length > 0 ? totalValue(sacrifice) : attackersValue;
  }

  const attackerRetreatCost = retreatCost(state, attackers);
  const defenderRetreatCost = retreatCost(state, defenders);

  const valueByResult: Record<CombatResult, number> = {
    AE: -attackersValue,
    AR: -attackerRetreatCost,
    DE: defendersValue,
    DR: defenderRetreatCost,
    EX: defendersValue - exchangeCost,
  };

  const lossByResult: Record<CombatResult, { attacker: number; defender: number }> = {
    AE: { attacker: attackersValue, defender: 0 },
    AR: { attacker: attackerRetreatCost, defender: 0 },
    DE: { attacker: 0, defender: defendersValue },
    DR: { attacker: 0, defender: defenderRetreatCost },
    EX: { attacker: exchangeCost, defender: defendersValue },
  };

  let expectedValue = 0;
  let expectedAttackerLoss = 0;
  let expectedDefenderLoss = 0;
  for (const result of ALL_RESULTS) {
    const p = probabilityOf(distribution, result);
    if (p === 0) continue;
    expectedValue += p * valueByResult[result];
    expectedAttackerLoss += p * lossByResult[result].attacker;
    expectedDefenderLoss += p * lossByResult[result].defender;
  }

  return { distribution, expectedValue, valueByResult, expectedAttackerLoss, expectedDefenderLoss };
}

export interface BoardingEvaluation {
  /** Expected material swing in purchase points, attacker-side. */
  expectedValue: number;
  expectedAttackerLoss: number;
  expectedDefenderLoss: number;
  /** Chance the defending ship is sunk outright (its last equipment point
   * taken) — exact, over the six faces. */
  sinkChance: number;
}

/** Value a ship loses when it takes `equipmentLoss` points of damage —
 * capped at what it has left, so "sunk" and "damaged to zero" price
 * identically (they are the same event; see `applyBoardingResult`). */
function equipmentDamageValue(ship: Unit, equipmentLoss: number): number {
  const max = maxEquipmentPoints(ship);
  if (max <= 0 || equipmentLoss <= 0) return 0;
  const remaining = Math.max(0, Math.min(max, ship.equipmentPoints ?? max));
  const actual = Math.min(remaining, equipmentLoss);
  return (unitType(ship).cost * actual) / max;
}

/**
 * The boarding-table equivalent of `evaluateAttack`, and exact for the same
 * reason (`resolveNavalBoarding` is pure, one die). Simpler than the land
 * case because a boarding result is already stated as material — equipment
 * points, each worth a fixed slice of the ship (see `unitValue`) — with no
 * retreats, pushes or advances to value positionally.
 */
export function evaluateBoarding(attacker: Unit, defender: Unit): BoardingEvaluation {
  const attackForce = currentAttack(attacker);
  const defenseForce = currentDefense(defender);
  let attackerLoss = 0;
  let defenderLoss = 0;
  let sinkFaces = 0;
  for (const face of DIE_FACES) {
    const result = resolveNavalBoarding(attackForce, defenseForce, face);
    if (result.side === null || result.equipmentLoss <= 0) continue;
    if (result.side === 'attacker') {
      attackerLoss += equipmentDamageValue(attacker, result.equipmentLoss);
    } else {
      defenderLoss += equipmentDamageValue(defender, result.equipmentLoss);
      const remaining = Math.max(0, Math.min(maxEquipmentPoints(defender), defender.equipmentPoints ?? 0));
      if (result.equipmentLoss >= remaining) sinkFaces++;
    }
  }
  const n = DIE_FACES.length;
  return {
    expectedValue: (defenderLoss - attackerLoss) / n,
    expectedAttackerLoss: attackerLoss / n,
    expectedDefenderLoss: defenderLoss / n,
    sinkChance: sinkFaces / n,
  };
}

/**
 * Exact chance a ram connects, over the six faces — thin, but it goes
 * through `isRammingHitWithBonus` rather than measuring
 * `rammingSuccessRange(...).length / 6` so that this codebase's documented
 * interpretation of the bonus/table conflict (see `navalRamming.ts`) is the
 * single source of the answer, and a change to it can't leave the odds
 * quietly disagreeing with the resolution.
 */
export function rammingHitChance(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
  bonus: 0 | 1 | 2,
): number {
  const hits = DIE_FACES.filter((face) => isRammingHitWithBonus(attackerType, defenderType, bonus, face)).length;
  return hits / DIE_FACES.length;
}

/**
 * Expected value of declaring a ram: a hit sinks the target outright and a
 * miss leaves both ships untouched (`applyRammingResult`), so this is never
 * negative in material terms — the only real cost is the rest of the ship's
 * movement (`applyAction` zeroes `movementLeft`), which is positional and
 * not priced here.
 */
export function evaluateRam(
  attacker: Unit,
  defender: Unit,
  bonus: 0 | 1 | 2,
): { hitChance: number; expectedValue: number } {
  const hitChance = rammingHitChance(attacker.typeId as ShipTypeId, defender.typeId as ShipTypeId, bonus);
  return { hitChance, expectedValue: hitChance * unitValue(defender) };
}
