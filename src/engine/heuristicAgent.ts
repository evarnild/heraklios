import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { TERRAIN_EFFECTS } from '../data/terrain';
import type { Action } from './actions';
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
import { findRammingContacts } from './navalMovement';
import { RandomAgent } from './randomAgent';
import { currentDefense, livingUnits, unitType, type GameState, type Unit } from './state';

/**
 * Stage 3 of plan.md §6 — an agent that actually tries to win, built on the
 * exact CRT arithmetic in `engine/combatOdds.ts` and the same
 * `legalActions`/`applyAction` action layer `RandomAgent` and `BoardScene`
 * already use. No Phaser, no scene, no new rules: every legality question is
 * still answered by the engine's existing predicates, and this file only
 * decides which of the legal options it prefers.
 *
 * DIFFICULTY TIERS (plan.md §6.4: "random -> greedy -> EV-weighted ->
 * shallow lookahead"). Three of the four ship here:
 *
 * | Tier | Combat | Movement |
 * | --- | --- | --- |
 * | `'random'` | delegates to `RandomAgent` | delegates to `RandomAgent` |
 * | `'greedy'` | maximizes expected ENEMY loss, blind to its own risk | closes distance; walks toward whatever it could hurt |
 * | `'ev'` | maximizes expected material SWING, and combines attackers | as above, plus terrain, ZOC, retreat-trap and charge value |
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
 * THE FOURTH TIER IS DELIBERATELY NOT HERE. plan.md §6.4 calls shallow
 * lookahead "nearly free"; it is not, and recording why is more useful than
 * a stub. A ply of lookahead needs (a) a cloned `GameState` to apply a
 * candidate action against, (b) an answer for every mid-resolution decision
 * that clone provokes, and (c) an opponent model to reply with — and
 * `legalActions` recomputes a full `reachableHexes` BFS per unit per call
 * (see `fuzzHarness.ts`'s note on why its armies are kept small), so a naive
 * 1-ply search multiplies an already-dominant cost by the branching factor.
 * It is a separate piece of work with its own performance budget, not a
 * variant of this file. The three tiers here are what "difficulty tiers fall
 * out nearly free" actually bought.
 *
 * DETERMINISM. Every choice is a pure function of `state` and the options
 * offered, with ties broken by the order `legalActions` produced them in, so
 * the same position always yields the same move and a seeded self-play game
 * replays identically (see `fuzzHarness.test.ts`'s determinism tests). An
 * optional `rng` breaks ties randomly instead, for callers that want
 * variety; it is threaded from the same seeded source as everything else, so
 * that stays reproducible too.
 */

/** Which of the three tiers described above an agent plays at. */
export type Difficulty = 'random' | 'greedy' | 'ev';

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
   * `reachableHexes`'s ZOC stop rule). Not applied when the move buys an
   * attack worth more, since the `strike` term is scored separately and
   * simply outweighs it. */
  zocPenalty: number;
  /** Multiplier on the best attack this move would make available. At 1.0 an
   * attack's expected value is taken at face value, which is the honest
   * reading: a unit that can strike next phase is worth exactly what that
   * strike is worth. */
  strike: number;
  /** Penalty for ending a move somewhere a forced retreat would eliminate
   * the unit outright (`wouldBeEliminatedByRetreat`) — the trap that
   * plan.md §6.8 pinned on hex (4,9), a plateau ringed by six steep-flank
   * hexes cavalry may not enter. */
  retreatTrapPenalty: number;
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
  retreatTrapPenalty: 4,
  minAttackValue: 0,
  minMoveScore: 0.05,
};

export interface HeuristicAgentOptions {
  difficulty?: Difficulty;
  /** Used for the `'random'` tier and, if supplied, to break scoring ties
   * randomly instead of by `legalActions` order. Same injection convention
   * as `RandomAgent`/`shuffleSeatOrder`: never `Math.random()` internally. */
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
   * table, so two units attacking together are worth far more than two units
   * attacking separately — 4 attack against 5 defense is the 1-2 column
   * (three faces of AE), while the same two units combined at 8 against 5 is
   * 1-1 and then 2-1 territory.
   */
  private chooseCombatAction(state: GameState, legal: Action[]): Action {
    const endPhase = legal.find((a) => a.kind === 'endPhase');
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
      const group =
        this.difficulty === 'ev'
          ? this.buildAttackGroup(state, defender, attackerIds)
          : [this.bestSoloAttacker(state, defender, attackerIds)];
      const evaluation = evaluateAttack(state, group, [defender]);
      const score = this.difficulty === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue;
      candidates.push({
        action: { kind: 'landAttack', attackerIds: group.map((u) => u.id), defenderIds: [defender.id] },
        score,
        order: orderByDefender.get(defenderId)!,
      });
    }

    legal.forEach((action, index) => {
      if (action.kind !== 'board') return;
      const attacker = this.requireUnit(state, action.attackerId);
      const defender = this.requireUnit(state, action.defenderId);
      const evaluation = evaluateBoarding(attacker, defender);
      const score = this.difficulty === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue;
      candidates.push({ action, score, order: index });
    });

    const best = this.pickBest(candidates);
    if (!best || best.score <= this.weights.minAttackValue) {
      if (!endPhase) throw new Error('HeuristicAgent: no attack worth making and no endPhase action offered');
      return endPhase;
    }
    return best.action;
  }

  /** The single attacker with the best solo expected value against
   * `defender` — the whole answer for the `'greedy'` tier, and the seed the
   * `'ev'` tier grows a group from. */
  private bestSoloAttacker(state: GameState, defender: Unit, attackerIds: string[]): Unit {
    let best: Unit | undefined;
    let bestScore = -Infinity;
    for (const id of attackerIds) {
      const attacker = this.requireUnit(state, id);
      const evaluation = evaluateAttack(state, [attacker], [defender]);
      const score = this.difficulty === 'greedy' ? evaluation.expectedDefenderLoss : evaluation.expectedValue;
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
   * `attackerCanJoin` gates every addition even though every id in
   * `attackerIds` already came from a legal singleton attack against this
   * same defender — that makes the joins redundant by construction TODAY,
   * and the check is kept anyway because the one thing it enforces beyond
   * reachability is the cavalry/phalanx group rule (plan.md §5's HIGH: a
   * cavalry unit joining a group that targets a phalanx), which is this
   * repo's known-real bug class and not something to leave resting on an
   * argument about what `legalActions` happens to filter.
   */
  private buildAttackGroup(state: GameState, defender: Unit, attackerIds: string[]): Unit[] {
    const seed = this.bestSoloAttacker(state, defender, attackerIds);
    const group = [seed];
    let bestValue = evaluateAttack(state, group, [defender]).expectedValue;
    const remaining = attackerIds.filter((id) => id !== seed.id).map((id) => this.requireUnit(state, id));

    for (;;) {
      let bestAddition: Unit | undefined;
      let bestAdditionValue = bestValue;
      for (const candidate of remaining) {
        if (group.includes(candidate)) continue;
        if (!attackerCanJoin(state, candidate, [defender], state.combatMode)) continue;
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

    const best = this.pickBest(candidates);
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
   * - **terrain / ZOC / retreat trap** — `'ev'` only: the positional terms a
   *   risk-blind greedy agent skips.
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
    const riskAware = this.difficulty === 'ev';
    let score = this.weights.approach * (nearestDistance(unit.position, enemies) - nearestDistance(to, enemies));

    const nearEnemies = withinStrikeRange(to, enemies);
    if (nearEnemies) {
      const charge = evaluateCharge(state, unit, to) !== null;
      score += this.weights.strike * this.bestAttackValueFrom(state, unit, to, charge);
    }

    if (riskAware) {
      score += this.weights.terrainDefense * defensiveModifier(to);
      if (enemyZoc.has(mapHexKey(to.q, to.r))) score -= this.weights.zocPenalty;
      // Only worth asking near the enemy: a retreat trap can only cost
      // anything where a combat could actually force a retreat, and the
      // check itself is a `legalRetreatHexes` call (another ZOC sweep).
      if (nearEnemies && this.wouldBeTrappedAt(state, unit, to)) score -= this.weights.retreatTrapPenalty;
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
    contacts: readonly { hex: HexCoord; bonus: 0 | 1 | 2; target: Unit }[],
  ): number {
    const ships = enemies.filter((u) => unitType(u).domain === 'naval');
    let score = this.weights.approach * (nearestDistance(unit.position, ships) - nearestDistance(to, ships));
    for (const contact of contacts) {
      if (contact.hex.q !== to.q || contact.hex.r !== to.r) continue;
      score += this.weights.strike * evaluateRam(unit, contact.target, contact.bonus).expectedValue;
      break;
    }
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
        const score = this.difficulty === 'greedy' ? value.expectedDefenderLoss : value.expectedValue;
        if (score > best) best = score;
      }
      return best;
    } finally {
      unit.position = originalPosition;
      unit.charged = originalCharged;
    }
  }

  /** Whether a forced retreat would eliminate `unit` outright if it were
   * standing on `to` — the same question `wouldBeEliminatedByRetreat` asks,
   * evaluated at a hypothetical position. */
  private wouldBeTrappedAt(state: GameState, unit: Unit, to: HexCoord): boolean {
    const originalPosition = unit.position;
    unit.position = to;
    try {
      return legalRetreatHexes(state, unit).length === 0;
    } finally {
      unit.position = originalPosition;
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
      if (this.wouldBeTrappedAt(state, unit, hex)) score -= this.weights.retreatTrapPenalty;
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
    let bestScore = -Infinity;
    for (const candidate of candidates) bestScore = Math.max(bestScore, candidate.score);
    const tied = candidates.filter((c) => c.score >= bestScore - TIE_EPSILON);
    if (!this.rng || tied.length === 1) {
      return tied.reduce((a, b) => (a.order <= b.order ? a : b));
    }
    const index = Math.min(tied.length - 1, Math.floor(this.rng() * tied.length));
    return tied[index]!;
  }

  private activeOwner(state: GameState): number {
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
