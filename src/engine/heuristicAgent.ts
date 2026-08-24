import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS } from '../data/terrain';
import { applyAction, legalActions, type Action } from './actions';
import type { ActionChooser, PlayerAgent } from './agent';
import {
  attackerCanJoin,
  exchangeSacrificeMeetsThreshold,
  hexesUnderZoc,
  legalRetreatHexes,
  unitAt,
  validTargets,
} from './combat';
import { cheapestSacrifice, evaluateAttack, evaluateBoarding, evaluateRam, unitValue } from './combatOdds';
import { hexDistance, neighbors } from './hex';
import { evaluateCharge } from './movement';
import { findRammingContacts, type RammingContact } from './navalMovement';
import { RandomAgent } from './randomAgent';
import { currentDefense, livingUnits, unitType, type GameState, type PlayerId, type Unit } from './state';

/**
 * Stage 3 of plan-history.md §6 — an agent that actually tries to win, built on the
 * exact CRT arithmetic in `engine/combatOdds.ts` and the same
 * `legalActions`/`applyAction` action layer `RandomAgent` and `BoardScene`
 * already use. No Phaser, no scene, no new rules: every legality question is
 * still answered by the engine's existing predicates, and this file only
 * decides which of the legal options it prefers.
 *
 * DIFFICULTY TIERS (plan-history.md §6.4: "random -> greedy -> EV-weighted ->
 * shallow lookahead"):
 *
 * | Tier | Combat | Movement |
 * | --- | --- | --- |
 * | `'random'` | delegates to `RandomAgent` | delegates to `RandomAgent` |
 * | `'greedy'` | maximizes expected ENEMY loss, blind to its own risk | closes distance; walks toward whatever it could hurt |
 * | `'ev'` | maximizes expected material SWING, and combines attackers | as above, plus terrain, ZOC and charge value |
 * | `'lookahead'` | same exact-EV combat model | EV movement plus a bounded enemy-reply threat check |
 *
 * `'random'` is a genuine delegation, not a reimplementation — the tier
 * exists so a caller can select difficulty uniformly without special-casing
 * which class to construct, and reusing `RandomAgent` keeps "easiest AI" and
 * "the fuzz harness's driver" provably the same behaviour.
 *
 * The distinction between `'greedy'` and `'ev'` is not a fudge factor: greedy
 * scores an attack by `expectedDefenderLoss` alone and EV scores it by
 * `expectedValue` (gain minus its own expected loss). A greedy agent will
 * therefore happily trade a phalanx for an archer, which is exactly the
 * mistake that makes it the easier opponent.
 *
 * THE FOURTH TIER IS BOUNDED, NOT A ROLLOUT. plan-history.md §6.4 called
 * shallow lookahead "nearly free"; §6.9 records why that was wrong. This tier keeps
 * the tractable slice: deterministic movement candidates are applied to a
 * structured-cloned `GameState`, then an EV opponent model asks what the
 * strongest immediate combat reply would be SPECIFICALLY AGAINST THE UNIT
 * THAT JUST MOVED, not the board's worst threat anywhere (see
 * `applyMovementLookahead`'s header for why that distinction matters). The
 * search is deliberately capped to the best few baseline moves, because
 * `legalActions` recomputes a full `reachableHexes` BFS per unit per call
 * (see `fuzzHarness.ts`'s note on why its armies are kept small). Stochastic
 * combat remains valued by `combatOdds.ts`'s exact six-face EV model rather
 * than by sampling one imagined die roll and pretending it was the future.
 *
 * DETERMINISM. In the three SCORED tiers every choice is a pure function of
 * `state` and the options offered, with ties broken by the order
 * `legalActions` produced them in, so the same position always yields the
 * same move and a seeded self-play game replays identically (see
 * `heuristicSoak.test.ts`'s replay test). An optional `rng` breaks ties
 * randomly instead, for callers that want variety; threaded from the same
 * seeded source as everything else, so that stays reproducible too. The
 * `'random'` tier is only as reproducible as the `rng` it is given — see
 * `HeuristicAgentOptions.rng`.
 */

/** Which of the four tiers described above an agent plays at. */
export type Difficulty = 'random' | 'greedy' | 'ev' | 'lookahead';

/**
 * The tunable half of the agent. Every field is in PURCHASE POINTS — the
 * same unit `combatOdds.ts` values material in — so a weight can be read as
 * "this is worth as much as N points of army," and the scoring terms below
 * are directly comparable to each other and to a real expected loss.
 *
 * These are policy, not rules; they are named constants rather than inline
 * numbers so that tuning is a diff to one object and a test can override a
 * single term to isolate the behaviour it is checking.
 */
export interface HeuristicWeights {
  /** Per hex of distance closed toward the nearest enemy. The engine that
   * makes an army advance at all: without it, a unit with no attack
   * available scores every destination identically and never leaves home. */
  approach: number;
  /** Per point of the destination hex's defensive combat modifier (see
   * `TERRAIN_EFFECTS`) — standing on a plateau adds +2 to every attacker's
   * die roll against you, which is worth real material over a game. */
  terrainDefense: number;
  /** Flat penalty for ending a move on a hex under enemy zone of control,
   * which costs the unit its freedom to move out next turn (see
   * `reachableHexes`'s ZOC stop rule). Always applied — a move that buys a
   * worthwhile attack is not exempted, it simply outweighs this through the
   * separately-scored `strike` term. */
  zocPenalty: number;
  /** Multiplier on the best attack this move would make available. At 1.0 an
   * attack's expected value is taken at face value, which is the honest
   * reading: a unit that can strike next phase is worth exactly what that
   * strike is worth. */
  strike: number;
  /** Expected value below which an attack is not worth declaring; the agent
   * would rather end its phase. Zero means "take any attack that doesn't
   * lose material in expectation." */
  minAttackValue: number;
  /** Score below which a move is not worth making. Small and positive, so
   * the agent stops shuffling once nothing improves rather than burning
   * movement points on lateral wandering. */
  minMoveScore: number;
}

export const DEFAULT_WEIGHTS: HeuristicWeights = {
  approach: 0.6,
  terrainDefense: 0.5,
  zocPenalty: 1,
  strike: 1,
  minAttackValue: 0,
  minMoveScore: 0.05,
};

export interface HeuristicAgentOptions {
  difficulty?: Difficulty;
  /**
   * Used for the `'random'` tier and, if supplied, to break scoring ties
   * randomly instead of by `legalActions` order. Same injection convention
   * as `RandomAgent`/`shuffleSeatOrder`.
   *
   * Omitting it does NOT make every tier deterministic: the scored tiers are
   * deterministic either way (they fall back to `legalActions` order for
   * ties), but the `'random'` tier delegates to a `RandomAgent` built on
   * `Math.random` when nothing is supplied, exactly as constructing that
   * agent directly would. A caller that needs a reproducible `'random'`
   * agent must pass a seeded `rng`.
   */
  rng?: () => number;
  weights?: Partial<HeuristicWeights>;
}

/** Two scores within this many points count as tied. Guards against float
 * noise making an arbitrary winner out of two genuinely equal options. */
const TIE_EPSILON = 1e-9;

interface Scored {
  action: Action;
  score: number;
  /** Index in the `legal` array — the stable tie-break (see this file's
   * header on determinism). */
  order: number;
}

type CombatScoringMode = 'greedy' | 'ev';

/** How many movement candidates the lookahead tier is allowed to clone and
 * probe on one action choice. This is the tier's performance budget: large
 * enough to compare the plausible moves, small enough that a ship's huge
 * destination list does not multiply the already-expensive `legalActions`
 * BFS across the whole board.
 *
 * Only pinned in the direction that matters for correctness: lowering it
 * to 1 fails four tests, three targeted plus the ev-comparison soak (an
 * uncapped search is strictly more accurate, so
 * raising it — tried up to 40 during Stage 3b tuning, plan-history.md
 * §6.14 — is not a behavior change a test could object to, just a
 * performance/accuracy tradeoff with no test asserting the CHOSEN value
 * specifically). */
const LOOKAHEAD_CANDIDATE_LIMIT = 8;

/** How much of the opponent's best immediate combat reply is charged against
 * a candidate move. Kept below 1 so the tier still takes tactically valuable
 * ground instead of freezing whenever any counterattack exists.
 *
 * Like `LOOKAHEAD_CANDIDATE_LIMIT`, only pinned downward: zeroing it fails
 * the tests that depend on the threat penalty existing at all, but nothing
 * asserts 0.75 specifically over some other positive value (tried up to 2,
 * nearly 3x, during the same tuning pass, with no material change to
 * aggregate strength — plan-history.md §6.14). */
const LOOKAHEAD_REPLY_WEIGHT = 0.75;

export class HeuristicAgent implements PlayerAgent, ActionChooser {
  private readonly difficulty: Difficulty;
  private readonly weights: HeuristicWeights;
  private readonly rng: (() => number) | undefined;
  private readonly random: RandomAgent;

  constructor(options: HeuristicAgentOptions = {}) {
    this.difficulty = options.difficulty ?? 'ev';
    this.weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    this.rng = options.rng;
    this.random = new RandomAgent(options.rng ?? Math.random);
  }

  // -------------------------------------------------------------------------
  // Top-level action selection
  // -------------------------------------------------------------------------

  chooseNextAction(state: GameState, legal: Action[]): Action {
    if (legal.length === 0) throw new Error('HeuristicAgent: asked to choose from an empty action list');
    if (this.difficulty === 'random') return this.random.chooseNextAction(state, legal);
    return state.phase === 'combat' ? this.chooseCombatAction(state, legal) : this.chooseMovementAction(state, legal);
  }

  /**
   * Combat phase: score every attack the position offers and take the best
   * one worth taking, otherwise end the phase.
   *
   * The `'ev'` tier does something `legalActions` structurally cannot — it
   * COMBINES ATTACKERS. `legalActions` enumerates singleton attacks only, by
   * design (see its doc comment: enumerating every legal combination is
   * combinatorial), and plan.md §6.8 records the consequence — `multiAttacker`
   * measured 0 across a 100-game soak, so combined attacks had zero coverage
   * and the §5 multi-defender phalanx bypass could never have been found by
   * fuzzing. This is the sanctioned way out, named in that same doc comment:
   * a scored agent assembles a bigger group itself and hands it to
   * `applyAction`, exactly as `BoardScene` does when a player clicks several
   * attackers before pressing Resolve.
   *
   * It matters for play strength as much as for coverage: the CRT is a ratio
   * table, so units attacking together are worth far more than the same
   * units attacking one at a time. Two light infantry (2 attack each)
   * against one heavy infantry (3 defense) is the worked example in
   * `heuristicAgent.test.ts` — alone each is the 1-2 column, four of whose
   * six faces repel the attacker; together they reach 1-1, and a third joins
   * them at 2-1, where four faces push the defender back instead.
   */
  private chooseCombatAction(state: GameState, legal: Action[]): Action {
    const endPhase = legal.find((a) => a.kind === 'endPhase');
    const candidates = this.combatCandidates(state, legal, this.combatScoringMode());

    const best = this.pickBest(candidates);
    if (!best || best.score <= this.weights.minAttackValue) {
      if (!endPhase) throw new Error('HeuristicAgent: no attack worth making and no endPhase action offered');
      return endPhase;
    }
    return best.action;
  }

  /** Every land-attack and boarding candidate the position offers, scored
   * under `mode` (`'greedy'`: `expectedDefenderLoss`; `'ev'`: `expectedValue`)
   * — one candidate per defender, its attacker group built by
   * `buildAttackGroup` (`'ev'`) or reduced to `bestSoloAttacker` (`'greedy'`,
   * and the `'ev'` opponent-reply probe when scoring under that same mode).
   * `chooseCombatAction` picks the best of these for a real turn;
   * `enemyThreatAgainstUnit` calls this same function against a cloned
   * board to price a hypothetical enemy reply — the one place this file
   * scores combat outside the active player's own turn. */
  private combatCandidates(state: GameState, legal: Action[], mode: CombatScoringMode): Scored[] {
    const candidates: Scored[] = [];

    // Attackers available against each defender, taken from the legal set so
    // "has this unit already attacked this phase?" needs no separate
    // bookkeeping — `legalActions` has already applied it.
    const attackersByDefender = new Map<string, string[]>();
    const orderByDefender = new Map<string, number>();
    legal.forEach((action, index) => {
      if (action.kind !== 'landAttack') return;
      const defenderId = action.defenderIds[0]!;
      const attackers = attackersByDefender.get(defenderId) ?? [];
      attackers.push(action.attackerIds[0]!);
      attackersByDefender.set(defenderId, attackers);
      if (!orderByDefender.has(defenderId)) orderByDefender.set(defenderId, index);
    });

    for (const [defenderId, attackerIds] of attackersByDefender) {
      const defender = this.requireUnit(state, defenderId);
      // ONE eligibility gate, covering the seed as well as every later
      // addition. It was originally applied only inside `buildAttackGroup`'s
      // growth loop, which left the seed ungated and — worse — put the check
      // somewhere `chooseNextAction` can never reach it, since every id here
      // came from a legal singleton attack and is therefore always eligible.
      // Adversarial review caught both: deleting the gate left the whole
      // suite green.
      //
      // Kept despite being redundant against a well-formed `legal`, because
      // what it enforces beyond reachability is the cavalry/phalanx group
      // rule (plan.md §5's HIGH: a cavalry unit joining a group that targets
      // a phalanx) — this repo's one known-real bug class, which should not
      // rest on an argument about what `legalActions` happens to filter. See
      // `heuristicAgent.test.ts`'s "refuses to build a group the engine
      // would reject", which reaches it by handing the agent a deliberately
      // malformed `legal` list.
      const eligible = attackerIds
        .map((id) => this.requireUnit(state, id))
        .filter((attacker) => attackerCanJoin(state, attacker, [defender], state.combatMode));
      if (eligible.length === 0) continue;

      const group = mode === 'ev' ? this.buildAttackGroup(state, defender, eligible) : [this.bestSoloAttacker(state, defender, eligible, mode)];
      const evaluation = evaluateAttack(state, group, [defender]);
      candidates.push({
        action: { kind: 'landAttack', attackerIds: group.map((u) => u.id), defenderIds: [defender.id] },
        score: mode === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue,
        order: orderByDefender.get(defenderId)!,
      });
    }

    legal.forEach((action, index) => {
      if (action.kind !== 'board') return;
      const attacker = this.requireUnit(state, action.attackerId);
      const defender = this.requireUnit(state, action.defenderId);
      const evaluation = evaluateBoarding(attacker, defender);
      const score = mode === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue;
      candidates.push({ action, score, order: index });
    });

    return candidates;
  }

  /** The single attacker with the best solo score against `defender` under
   * `mode` — the whole answer for `'greedy'` (and for scoring an enemy's
   * hypothetical reply, which always uses `'ev'` regardless of this agent's
   * own difficulty — see `enemyThreatAgainstUnit`), and the seed
   * `buildAttackGroup` grows an `'ev'` group from. `attackers` must already
   * be filtered by `attackerCanJoin` (see `combatCandidates`'s eligibility
   * gate). */
  private bestSoloAttacker(state: GameState, defender: Unit, attackers: Unit[], mode: CombatScoringMode): Unit {
    let best: Unit | undefined;
    let bestScore = -Infinity;
    for (const attacker of attackers) {
      const evaluation = evaluateAttack(state, [attacker], [defender]);
      const score = mode === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue;
      if (score > bestScore) {
        bestScore = score;
        best = attacker;
      }
    }
    return best!;
  }

  /**
   * Greedy hill-climb over attack groups: start from the best solo attacker,
   * then repeatedly add whichever remaining eligible attacker most improves
   * the group's expected value, stopping as soon as nothing does.
   *
   * Greedy rather than exhaustive because group EV is not monotone —
   * `ratioToColumnIndex` rounds in the DEFENDER's favour, so an extra unit
   * that doesn't push the ratio to the next column adds nothing while adding
   * its own body to the AE/EX losses — and because the ratio columns mean
   * improvements come in steps, which a hill-climb walks up cleanly. An
   * exhaustive search over 2^n groups would be affordable at these sizes but
   * would buy little and cost the clarity of "each unit added is a decision
   * that had to justify itself."
   *
   * `attackers` is already filtered by `attackerCanJoin` — see the gate in
   * `chooseCombatAction`, which covers the seed picked here as well as every
   * unit added below.
   */
  private buildAttackGroup(state: GameState, defender: Unit, attackers: Unit[]): Unit[] {
    const seed = this.bestSoloAttacker(state, defender, attackers, 'ev');
    const group = [seed];
    let bestValue = evaluateAttack(state, group, [defender]).expectedValue;
    const remaining = attackers.filter((attacker) => attacker.id !== seed.id);

    for (;;) {
      let bestAddition: Unit | undefined;
      let bestAdditionValue = bestValue;
      for (const candidate of remaining) {
        if (group.includes(candidate)) continue;
        const value = evaluateAttack(state, [...group, candidate], [defender]).expectedValue;
        if (value > bestAdditionValue + TIE_EPSILON) {
          bestAdditionValue = value;
          bestAddition = candidate;
        }
      }
      if (!bestAddition) return group;
      group.push(bestAddition);
      bestValue = bestAdditionValue;
    }
  }

  /**
   * Movement phase: score every destination on offer and take the best, or
   * end the phase once nothing is worth doing.
   *
   * Termination does not depend on the score gate: every move costs at least
   * one movement point and `legalActions` only offers moves a unit can still
   * afford, so the action space empties on its own. The gate is about play
   * quality — a unit that wanders sideways for no gain is worse than a unit
   * that stands still — and about not burning a cavalry unit's allowance,
   * which would forfeit the charge (`evaluateCharge` requires a FULL,
   * unspent allowance).
   */
  private chooseMovementAction(state: GameState, legal: Action[]): Action {
    const endPhase = legal.find((a) => a.kind === 'endPhase');
    const activeOwner = this.activeOwner(state);
    const enemies = livingUnits(state).filter((u) => u.owner !== activeOwner);
    const candidates: Scored[] = [];

    // Two per-call caches, both for query functions that are far too
    // expensive to run once per candidate destination: `hexesUnderZoc` walks
    // every unit's six neighbours, and `findRammingContacts` runs a full
    // `reachableNavalStates` BFS over the naval state graph. `legalActions`
    // routinely offers a ship a hundred destinations, so recomputing that
    // BFS per destination made a single seeded game take seconds.
    //
    // Safe to cache for the duration of one call: nothing here mutates the
    // board. The one thing that does move a unit — `bestAttackValueFrom`'s
    // temporary reposition — restores it before returning, and neither
    // cached value is read while it is displaced.
    const enemyZoc = hexesUnderZoc(state, activeOwner);
    const rammingContacts = new Map<string, ReturnType<typeof findRammingContacts>>();
    const contactsFor = (unit: Unit) => {
      let contacts = rammingContacts.get(unit.id);
      if (!contacts) {
        contacts = findRammingContacts(state, unit);
        rammingContacts.set(unit.id, contacts);
      }
      return contacts;
    };

    legal.forEach((action, index) => {
      switch (action.kind) {
        case 'landMove': {
          const unit = this.requireUnit(state, action.unitId);
          candidates.push({ action, score: this.scoreLandMove(state, unit, action.to, enemies, enemyZoc), order: index });
          return;
        }
        case 'navalMove': {
          const unit = this.requireUnit(state, action.unitId);
          candidates.push({
            action,
            score: this.scoreNavalMove(unit, action.to, enemies, contactsFor(unit)),
            order: index,
          });
          return;
        }
        case 'ram': {
          const unit = this.requireUnit(state, action.unitId);
          // `applyAction` resolves a 'ram' against the zero-cost contact, so
          // that is the one to price (see its `ram` case).
          const contact = contactsFor(unit).find((c) => c.cost === 0);
          if (!contact) return;
          candidates.push({
            action,
            score: evaluateRam(unit, contact.target, contact.bonus).expectedValue,
            order: index,
          });
          return;
        }
        case 'navalRotate':
          // Never worth its own action: `reachableNavalStates` already turns
          // a ship as it travels, so a bare rotation only ever spends a
          // movement point to arrive at a facing an ordinary `navalMove`
          // could have reached for free. Scored 0 so the gate below rejects
          // it rather than special-casing it out of the candidate list.
          candidates.push({ action, score: 0, order: index });
          return;
        default:
          return;
      }
    });

    const scored = this.difficulty === 'lookahead' ? this.applyMovementLookahead(state, candidates) : candidates;
    const best = this.pickBest(scored);
    if (!best || best.score < this.weights.minMoveScore) {
      if (!endPhase) throw new Error('HeuristicAgent: no move worth making and no endPhase action offered');
      return endPhase;
    }
    return best.action;
  }

  /**
   * What a land destination is worth, in points:
   *
   * - **approach** — distance closed toward the nearest enemy. Both tiers.
   * - **strike** — the best attack that becomes available from there,
   *   priced by the same exact-EV machinery the combat phase uses, with the
   *   unit temporarily standing on the destination so the answer accounts
   *   for its real range, the defender's terrain and the river hexsides
   *   between them. A cavalry charge is priced here too rather than as a
   *   flat bonus: if the move qualifies (`evaluateCharge`), the unit is
   *   scored with `charged = true`, so the charge is worth exactly the
   *   doubled attack value it actually produces against the target it
   *   actually threatens — which is the difference between a charge into a
   *   phalanx (worth nothing; cavalry may not attack one at all) and a
   *   charge into an archer.
   * - **terrain / ZOC** — `'ev'` and `'lookahead'` only: the positional terms
   *   a risk-blind greedy agent skips.
   *
   * There is deliberately NO "don't move somewhere a forced retreat would
   * kill you" term, though an earlier version of this file had one and
   * `combatOdds.ts` still prices exactly that hazard when valuing an attack
   * (`wouldBeEliminatedByRetreat`, which is live and tested there). The
   * difference is reachability: a destination is only a death-trap if its
   * neighbours are all occupied, ZOC-covered or impassable — and those are
   * the same neighbours a unit would have to move THROUGH to arrive, so the
   * ZOC stop rule prevents ever entering one. Adversarial review found the
   * term survived deletion with the suite green; probing the shipped map for
   * a reachable counter-example (peninsula tips, the (4,9) steep-flank box)
   * found none, so it was removed rather than kept as an untestable knob.
   *
   * The strike term is only computed when the destination is within two
   * hexes of an enemy (the longest range on the roster), because it is the
   * expensive part — a full `validTargets` sweep plus an EV per target —
   * and every other destination scores zero for it by definition.
   */
  private scoreLandMove(
    state: GameState,
    unit: Unit,
    to: HexCoord,
    enemies: Unit[],
    enemyZoc: ReadonlySet<string>,
  ): number {
    const riskAware = this.difficulty === 'ev' || this.difficulty === 'lookahead';
    let score = this.weights.approach * (nearestDistance(unit.position, enemies) - nearestDistance(to, enemies));

    if (withinStrikeRange(to, enemies)) {
      const charge = evaluateCharge(state, unit, to) !== null;
      score += this.weights.strike * this.bestAttackValueFrom(state, unit, to, charge);
    }

    if (riskAware) {
      score += this.weights.terrainDefense * defensiveModifier(to);
      if (enemyZoc.has(mapHexKey(to.q, to.r))) score -= this.weights.zocPenalty;
    }
    return score;
  }

  /**
   * Naval destinations are scored on the same "close the distance, price
   * what it buys" basis, with ramming standing in for the land strike term:
   * `applyAction`'s `navalMove` silently redirects a move whose destination
   * is a ramming-contact hex to that contact's exact hex and facing (see its
   * `navalMove` case), after which a zero-cost `ram` is legal — so a move
   * onto a contact hex is really "get into position to ram," and is priced
   * as the ram it enables, discounted by nothing but the chance of missing.
   */
  private scoreNavalMove(
    unit: Unit,
    to: HexCoord,
    enemies: Unit[],
    contacts: readonly RammingContact[],
  ): number {
    const ships = enemies.filter((u) => unitType(u).domain === 'naval');
    let score = this.weights.approach * (nearestDistance(unit.position, ships) - nearestDistance(to, ships));
    // The CHEAPEST contact on that hex, not the first one found: `applyAction`
    // resolves a redirected `navalMove` against `.sort((a, b) => a.cost -
    // b.cost)[0]` (see its `navalMove` case), so taking any other one would
    // price a different target or bonus than the move will actually produce.
    const contact = contacts
      .filter((c) => c.hex.q === to.q && c.hex.r === to.r)
      .sort((a, b) => a.cost - b.cost)[0];
    if (contact) score += this.weights.strike * evaluateRam(unit, contact.target, contact.bonus).expectedValue;
    return score;
  }

  /** Best attack expected value available to `unit` if it stood on `to`
   * (optionally having charged to get there). Restores the unit's real
   * position and charge flag before returning, including on a throw. */
  private bestAttackValueFrom(state: GameState, unit: Unit, to: HexCoord, charged: boolean): number {
    const originalPosition = unit.position;
    const originalCharged = unit.charged;
    unit.position = to;
    unit.charged = charged;
    try {
      let best = 0;
      for (const target of validTargets(state, unit)) {
        const value = evaluateAttack(state, [unit], [target]);
        const score = this.combatScoringMode() === 'greedy' ? value.expectedDefenderLoss : value.expectedValue;
        if (score > best) best = score;
      }
      return best;
    } finally {
      unit.position = originalPosition;
      unit.charged = originalCharged;
    }
  }

  // -------------------------------------------------------------------------
  // Mid-resolution decisions (`PlayerAgent`)
  //
  // The difficulty tiers deliberately do NOT differ here beyond `'random'`:
  // a tier is meant to be a weaker OPPONENT, not one that throws away units
  // it has already committed. Choosing a retreat badly is not "easier to
  // play against" in any interesting sense, it just adds noise.
  // -------------------------------------------------------------------------

  /**
   * Retreat toward safety: away from enemies, onto defensible ground, and
   * never into a hex the unit could not retreat out of again.
   */
  async chooseRetreat(state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    if (options.length === 0) throw new Error('HeuristicAgent: asked to retreat with no options');
    if (this.difficulty === 'random') return this.random.chooseRetreat(state, unit, options);

    let best = options[0]!;
    let bestScore = -Infinity;
    for (const hex of options) {
      let score = -RETREAT_ADJACENT_ENEMY_PENALTY * countAdjacentEnemies(state, hex, unit.owner);
      score += this.weights.terrainDefense * defensiveModifier(hex);
      // Deterministic tie-break: strictly-greater keeps the earliest option
      // in `legalRetreatHexes` order, matching how action ties are broken.
      if (score > bestScore + TIE_EPSILON) {
        bestScore = score;
        best = hex;
      }
    }
    return best;
  }

  /**
   * Push the friendly that suffers least for it. A candidate with a direct
   * legal retreat ends the cascade immediately; one without has to push
   * someone else in turn (plan.md §12.3), moving more of the army around
   * than the situation called for — so direct-retreat candidates are
   * strongly preferred, then the one with the most room, then the cheapest.
   */
  async choosePushTarget(state: GameState, unit: Unit, candidates: Unit[]): Promise<Unit> {
    if (candidates.length === 0) throw new Error('HeuristicAgent: asked to push with no candidates');
    if (this.difficulty === 'random') return this.random.choosePushTarget(state, unit, candidates);

    let best = candidates[0]!;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const room = legalRetreatHexes(state, candidate).length;
      const score = (room > 0 ? PUSH_DIRECT_RETREAT_BONUS : 0) + room - unitValue(candidate) * PUSH_VALUE_WEIGHT;
      if (score > bestScore + TIE_EPSILON) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  /**
   * Take the vacated ground when it is worth holding. Advancing is free
   * material-wise but not free positionally: the hex a defender just fled
   * may sit next to three more of its friends, and the advancing unit
   * arrives there with its combat phase already spent.
   *
   * Scored as "ground plus terrain, minus what can hit me there," with the
   * exposure term divided by the candidate's own defense so a phalanx (5)
   * shrugs off a neighbour a light cavalry unit (2) should not. Declines
   * when nothing scores positive.
   */
  async chooseAdvance(state: GameState, candidates: Unit[], vacated: HexCoord): Promise<Unit | null> {
    if (this.difficulty === 'random') return this.random.chooseAdvance(state, candidates, vacated);
    if (candidates.length === 0) return null;

    const exposure = countAdjacentEnemies(state, vacated, candidates[0]!.owner);
    let best: Unit | null = null;
    let bestScore = 0; // anything at or below zero means "decline"
    for (const candidate of candidates) {
      const score =
        ADVANCE_GROUND_VALUE +
        this.weights.terrainDefense * defensiveModifier(vacated) -
        (exposure * ADVANCE_EXPOSURE_WEIGHT) / Math.max(1, currentDefense(candidate));
      if (score > bestScore + TIE_EPSILON) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  /**
   * Pay an exchange with the cheapest units that can legally cover it (see
   * `cheapestSacrifice`, which searches subsets exactly at these sizes).
   * This is the same valuation `evaluateAttack` used when it decided the
   * attack was worth making, so the price the agent quoted itself is the
   * price it actually pays.
   */
  async chooseExchangeSacrifice(state: GameState, attackers: Unit[], requiredForce: number): Promise<Unit[]> {
    if (this.difficulty === 'random') return this.random.chooseExchangeSacrifice(state, attackers, requiredForce);

    const selected = cheapestSacrifice(attackers, requiredForce);
    if (selected.length > 0 && exchangeSacrificeMeetsThreshold(selected, requiredForce)) return selected;
    // Mirrors `RandomAgent`'s loud failure rather than silently under-paying:
    // per the CRT an 'EX' only occurs at 4:1 or better, so the whole group
    // always suffices and reaching here means that invariant has broken.
    if (exchangeSacrificeMeetsThreshold(attackers, requiredForce)) return [...attackers];
    throw new Error(
      `HeuristicAgent.chooseExchangeSacrifice: no combination of ${attackers.length} attacker(s) reaches the required force ${requiredForce} — CRT invariant violated`,
    );
  }

  // -------------------------------------------------------------------------
  // Shared plumbing
  // -------------------------------------------------------------------------

  /** Highest score wins; ties go to the earliest `legalActions` entry, or to
   * a uniform pick among the tied options when an `rng` was supplied. */
  private pickBest(candidates: Scored[]): Scored | undefined {
    if (candidates.length === 0) return undefined;
    const tied = this.bestTied(candidates);
    if (!this.rng || tied.length === 1) {
      return tied.reduce((a, b) => (a.order <= b.order ? a : b));
    }
    const index = Math.min(tied.length - 1, Math.floor(this.rng() * tied.length));
    return tied[index]!;
  }

  private pickBestDeterministic(candidates: Scored[]): Scored | undefined {
    const tied = this.bestTied(candidates);
    return tied.length === 0 ? undefined : tied.reduce((a, b) => (a.order <= b.order ? a : b));
  }

  private bestTied(candidates: Scored[]): Scored[] {
    if (candidates.length === 0) return [];
    let bestScore = -Infinity;
    for (const candidate of candidates) bestScore = Math.max(bestScore, candidate.score);
    return candidates.filter((c) => c.score >= bestScore - TIE_EPSILON);
  }

  private combatScoringMode(): CombatScoringMode {
    return this.difficulty === 'greedy' ? 'greedy' : 'ev';
  }

  /**
   * Penalizes each candidate by the MARGINAL enemy threat it creates AGAINST
   * THE UNIT BEING MOVED — not the board's overall worst threat.
   *
   * The first version of this tier (plan-history.md §6.13) computed a board-WIDE
   * max threat as both "before" and "after," and subtracted one from the
   * other. That doesn't discriminate: a board-wide worst-case threat is
   * almost never the specific unit that just moved (with any army bigger
   * than two units, something else is usually already more exposed), so
   * `baselineThreat` and `afterThreat` came out equal in nearly every
   * position regardless of what the candidate did — measured at the time as
   * "lookahead" being statistically indistinguishable from `'ev'` over 160
   * games (plan-history.md §6.14). Pricing the threat specifically against the
   * mover fixes the discrimination problem: `baselineThreat` is what the
   * strongest enemy attack against THIS unit, specifically, is worth before
   * it moves; `afterThreat` is the same question after; only the increase
   * (clamped at 0, since making the unit SAFER shouldn't earn a bonus it
   * didn't ask for) is charged against the candidate.
   */
  private applyMovementLookahead(state: GameState, candidates: Scored[]): Scored[] {
    const baselineCache = new Map<string, number>();
    const baselineFor = (unitId: string): number => {
      let value = baselineCache.get(unitId);
      if (value === undefined) {
        value = this.enemyThreatAgainstUnit(this.normalizedThreatProbeClone(state), unitId);
        baselineCache.set(unitId, value);
      }
      return value;
    };

    return [...candidates]
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, LOOKAHEAD_CANDIDATE_LIMIT)
      .map((candidate) => {
        const unitId = movingUnitId(candidate.action);
        const afterThreat = this.enemyThreatAgainstUnitAfter(state, unitId, candidate.action);
        const marginalThreat = Math.max(0, afterThreat - baselineFor(unitId));
        return { ...candidate, score: candidate.score - LOOKAHEAD_REPLY_WEIGHT * marginalThreat };
      });
  }

  /** The strongest immediate combat reply any living enemy could make
   * specifically against `unitId` if `action` were taken — 0 if `action`
   * isn't one this tier clone-probes at all (see
   * `cloneAfterDeterministicMovementAction`, notably `'ram'`). */
  private enemyThreatAgainstUnitAfter(state: GameState, unitId: string, action: Action): number {
    const clone = this.cloneAfterDeterministicMovementAction(state, action);
    return clone ? this.enemyThreatAgainstUnit(clone, unitId) : 0;
  }

  /**
   * The strongest immediate combat reply any living enemy of `board`'s
   * active player could make SPECIFICALLY AGAINST `unitId` — the max over
   * enemies (only one of them actually gets the next combat phase), filtered
   * down to attacks that actually target this one unit rather than every
   * attack the position offers (see `applyMovementLookahead`'s header on why
   * that distinction is the whole fix). Reaches its hypothetical combat
   * phase by hand-setting `phase`/`activePlayerIndex` rather than by walking
   * `turnManager.advancePhase`'s real sequence, so this is a threat PROBE,
   * not a real transition: `board` must already have `defendedThisPhase`/
   * `charged` normalized the way a real transition into combat would leave
   * them (see `normalizedThreatProbeClone`, which every caller routes
   * through — directly, or via `cloneAfterDeterministicMovementAction`).
   *
   * Also maxes in a ramming reply (plan.md §19), priced by
   * `enemyRamThreatAgainstUnit` — NOT by walking a hypothetical combat
   * phase, because ramming is never a combat-phase action (`legalActions`
   * only offers `'ram'` during MOVEMENT — see its `movement` case), so
   * `combatCandidates`/`legalActions(board, {})` above structurally never
   * produces a ram candidate no matter what phase this probe fakes. §19's
   * gap was exactly this: a real enemy ship reachable to `unitId`'s new hex
   * threatens a ram next turn, and that threat went unpriced.
   */
  private enemyThreatAgainstUnit(board: GameState, unitId: string): number {
    const movingOwner = this.activeOwner(board);
    let worstReply = 0;
    for (const owner of enemyOwners(board, movingOwner)) {
      const index = board.seatOrder.indexOf(owner);
      // Defensive only, and genuinely unreachable rather than merely
      // untested: `seatOrder` always holds every player id for the life of
      // the game (`turnManager.ts`'s `shuffleSeatOrder` only ever
      // permutes it, never adds or drops one — see its doc comment), so
      // `indexOf` on an `owner` drawn from `enemyOwners` (which reads
      // living units, themselves always owned by one of those ids) cannot
      // fail. Left unpinned,
      // unlike `movingUnitId`'s structurally similar throw guard, which
      // WAS pinned once exported for direct testing — that one is reachable
      // by calling the function directly with a bogus action; this one has
      // no equivalent seam without exporting `enemyThreatAgainstUnit` and
      // handing it a `board` whose `seatOrder` disagrees with its own
      // units, which would be testing a state this file never produces.
      if (index < 0) continue;
      board.activePlayerIndex = index;
      board.phase = 'combat';
      const candidatesAgainstUnit = this.combatCandidates(board, legalActions(board, {}), 'ev').filter((c) =>
        targetsUnit(c.action, unitId),
      );
      const reply = this.pickBestDeterministic(candidatesAgainstUnit);
      if (reply && reply.score > this.weights.minAttackValue) {
        worstReply = Math.max(worstReply, reply.score);
      }
      worstReply = Math.max(worstReply, this.enemyRamThreatAgainstUnit(board, owner, unitId));
    }
    return worstReply;
  }

  /**
   * The best ramming EV any of `owner`'s living naval units could achieve
   * against `unitId`, priced WITHOUT cloning past the roll (plan.md §19.3
   * option 1) — `evaluateRam` already reduces a ram to a single expected-value
   * number over its six-face distribution, so there is no board to commit to,
   * unlike `cloneAfterDeterministicMovementAction`'s deliberate `null` for a
   * `'ram'` candidate of the MOVER's own (that gap is separate and untouched:
   * it concerns the mover's own hypothetical ram, not an enemy's reply to a
   * mover's move, which is what this probes).
   *
   * 0 immediately if `unitId` isn't a living naval unit — `findRammingContacts`
   * only ever reports naval targets, so a land unit can never be rammed and
   * the loop below would find nothing anyway; the early return just skips the
   * BFS `findRammingContacts` runs per candidate naval unit.
   */
  private enemyRamThreatAgainstUnit(board: GameState, owner: PlayerId, unitId: string): number {
    const target = board.units.find((u) => u.id === unitId);
    if (!target || target.destroyed || unitType(target).domain !== 'naval') return 0;
    let best = 0;
    for (const unit of board.units) {
      if (unit.destroyed || unit.owner !== owner || unitType(unit).domain !== 'naval') continue;
      for (const contact of findRammingContacts(board, unit)) {
        if (contact.target.id !== unitId) continue;
        best = Math.max(best, evaluateRam(unit, contact.target, contact.bonus).expectedValue);
      }
    }
    return best;
  }

  /** Clones `state`, normalized for the threat probe, and applies `action` —
   * `null` for actions this tier doesn't clone-probe. Notably `'ram'`: its
   * outcome is a die roll `combatOdds.ts` prices as a distribution rather
   * than a single resulting board, so cloning "after" it would mean picking
   * a hit or a miss to commit to; it's left unpenalized here rather than
   * arbitrarily choosing one. This is a genuine design choice, not an
   * oversight — but nothing pins it: no test asserts that adding `'ram'`
   * to the cases below (i.e. clone-probing it anyway, against some
   * arbitrarily chosen outcome) changes anything. Disclosed rather than
   * silently left as a gap.
   *
   * This `null` only covers the MOVER's own hypothetical ram (the candidate
   * `action` here) — it does NOT mean ramming is unpriced everywhere. An
   * ENEMY's ramming reply against the unit the mover just moved is a
   * different question, answered without cloning at all by
   * `enemyRamThreatAgainstUnit` (plan.md §19), which `enemyThreatAgainstUnit`
   * always calls regardless of what `action` produced the board being
   * probed. */
  private cloneAfterDeterministicMovementAction(state: GameState, action: Action): GameState | null {
    switch (action.kind) {
      case 'landMove':
      case 'navalMove':
      case 'navalRotate': {
        const clone = this.normalizedThreatProbeClone(state);
        applyAction(clone, action);
        return clone;
      }
      default:
        return null;
    }
  }

  /**
   * A `structuredClone` with `defendedThisPhase` and `charged` reset on every
   * unit — what a real transition into a combat phase would leave behind
   * (`turnManager.advancePhase`'s movement->combat case resets the former;
   * `resetMovementForActivePlayer`, run at a unit's own next movement phase,
   * clears the latter). The threat probe above reaches its hypothetical
   * combat phase WITHOUT calling either, so without this reset a unit
   * attacked or charged earlier in the SAME round (by an earlier seat in
   * `seatOrder`, reachable whenever 3+ seats are still alive) would carry a
   * stale flag into a hypothetical phase that, in every real game, has at
   * least one intervening reset before it's actually reached — silently
   * hiding a real counter-attack behind `defendedThisPhase`, or overpricing
   * a charge bonus that would already have expired.
   */
  private normalizedThreatProbeClone(state: GameState): GameState {
    const clone = structuredClone(state) as GameState;
    for (const u of clone.units) {
      u.defendedThisPhase = false;
      u.charged = false;
    }
    return clone;
  }

  private activeOwner(state: GameState): PlayerId {
    return state.seatOrder[state.activePlayerIndex]!;
  }

  private requireUnit(state: GameState, id: string): Unit {
    const unit = state.units.find((u) => u.id === id);
    if (!unit) throw new Error(`HeuristicAgent: no unit with id "${id}"`);
    return unit;
  }
}

// ---------------------------------------------------------------------------
// Scoring constants for the mid-resolution decisions. Same currency as
// `HeuristicWeights` (purchase points), kept as module constants rather than
// weights because nothing so far has wanted to tune them per difficulty.
// ---------------------------------------------------------------------------

/** Per enemy unit adjacent to a hex being retreated into. */
const RETREAT_ADJACENT_ENEMY_PENALTY = 1.5;
/** Flat preference for a push target that can retreat directly, ending the
 * cascade instead of extending it. */
const PUSH_DIRECT_RETREAT_BONUS = 10;
/** How much a push target's own value counts against pushing it. */
const PUSH_VALUE_WEIGHT = 0.1;
/** Worth of occupying a hex the enemy just left — the whole point of a
 * post-combat advance. */
const ADVANCE_GROUND_VALUE = 1;
/** Per enemy adjacent to the vacated hex, before dividing by the advancing
 * unit's defense. */
const ADVANCE_EXPOSURE_WEIGHT = 2;

/** The longest range on the roster (`data/units.ts`: archers and the ranged
 * ships fire at 2), i.e. the furthest a unit can be from an enemy and still
 * have an attack to price. */
const MAX_STRIKE_RANGE = 2;

function nearestDistance(from: HexCoord, targets: readonly Unit[]): number {
  let best = Infinity;
  for (const target of targets) {
    const distance = hexDistance(from, target.position);
    if (distance < best) best = distance;
  }
  return best === Infinity ? 0 : best;
}

function withinStrikeRange(hex: HexCoord, enemies: readonly Unit[]): boolean {
  return enemies.some((enemy) => hexDistance(hex, enemy.position) <= MAX_STRIKE_RANGE);
}

/** The defensive combat modifier a unit standing on `hex` benefits from —
 * points added to every attacker's die roll. Conditional bonuses (plateau,
 * steep flank: "+2 if the attackers come from below") are counted at face
 * value here rather than resolved: which hex an attacker will come from
 * isn't known while choosing a destination, and treating high ground as
 * defensible is the right prior even when a particular attacker negates it. */
function defensiveModifier(hex: HexCoord): number {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return 0;
  return TERRAIN_EFFECTS[terrain].combatModifier;
}

function countAdjacentEnemies(state: GameState, hex: HexCoord, owner: number): number {
  let count = 0;
  for (const neighbor of neighbors(hex)) {
    const occupant = unitAt(state, neighbor);
    if (occupant && occupant.owner !== owner) count++;
  }
  return count;
}

/** Every distinct owner with at least one living unit, other than `owner`
 * itself — exported for direct testing, since it's the one thing standing
 * between the lookahead tier's threat probe (`enemyThreatAgainstUnit`) and
 * treating the moving player's own best attack as a threat against itself. */
export function enemyOwners(state: GameState, owner: PlayerId): PlayerId[] {
  return [...new Set(livingUnits(state).filter((unit) => unit.owner !== owner).map((unit) => unit.owner))];
}

/** The unit a movement-phase candidate action belongs to. Every action kind
 * `chooseMovementAction` ever builds a `Scored` candidate from carries a
 * `unitId` — `landMove`/`navalMove`/`navalRotate`/`ram` — so this throws
 * rather than returning a fallback if that invariant is ever violated,
 * matching this file's usual "loud failure over silent misbehaviour"
 * convention (see `requireUnit`). Exported for direct testing, same reason
 * as `enemyOwners`: the throw branch is unreachable through the public
 * `chooseNextAction` API as this file currently calls it, so a test can
 * only pin it by calling the function directly. */
export function movingUnitId(action: Action): string {
  switch (action.kind) {
    case 'landMove':
    case 'navalMove':
    case 'ram':
    case 'navalRotate':
      return action.unitId;
    default:
      throw new Error(`HeuristicAgent: "${action.kind}" is not a movement-phase candidate action`);
  }
}

/** Whether `action` (a combat candidate — `landAttack` or `board`) targets
 * `unitId` as a defender. Used by `enemyThreatAgainstUnit` to isolate the
 * threat against ONE specific unit out of every attack a hypothetical
 * combat phase offers. The `'board'` branch — a hypothetical boarding
 * attack, reachable only when `cloneAfterDeterministicMovementAction`
 * clone-probes a `navalMove`/`navalRotate` — is untested: no lookahead
 * test involves a ship (plan-history.md §6.15). */
function targetsUnit(action: Action, unitId: string): boolean {
  if (action.kind === 'landAttack') return action.defenderIds.includes(unitId);
  if (action.kind === 'board') return action.defenderId === unitId;
  return false;
}
