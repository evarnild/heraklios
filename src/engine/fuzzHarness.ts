import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import type { CombatResult } from '../data/combatTable';
import { legalActions, applyAction, type Action } from './actions';
import type { PlayerAgent } from './agent';
import { RandomAgent } from './randomAgent';
import { createSeededRng } from './rng';
import {
  cavalryMayAttack,
  legalRetreatHexes,
  pushCandidates,
  retreatUnitTo,
  completePush,
  applyExchangeSacrifice,
  unitAt,
} from './combat';
import { resetMovementForActivePlayer, createInitialState } from './turnManager';
import { unitCategory, unitType, type GameState, type Player, type PlayerId, type Unit } from './state';

// ---------------------------------------------------------------------------
// Army construction — deliberately explicit, NOT `defaultArmySelection()`
// (engine/army.ts), which includes 3 elephants (`army.ts:68`). Elephants
// cannot be fuzzed yet: their drift/trample cascade still mutates GameState
// from inside BoardScene closures a headless caller can't drive (see
// plan.md §6.7). Building the harness's armies unit-by-unit here — rather
// than filtering an ArmySelection after the fact — means there is no
// elephant-shaped value anywhere in this file to accidentally forget to
// filter.
// ---------------------------------------------------------------------------

/** (10,3) through (19,3) are all confirmed 'plain' hexes on the shipped map
 * (see engine/movement.test.ts's and engine/actions.test.ts's comments on
 * the same row) — a clean strip to place a small land army on without
 * terrain restrictions complicating where units may start. */
const LAND_ROW = { q: 10, r: 3 };
function landHex(offset: number): HexCoord {
  return { q: LAND_ROW.q + offset, r: LAND_ROW.r };
}

/** (28,6) has every hex within 3 hexes as open sea on the shipped map (see
 * engine/navalMovement.test.ts's comment) — DIRECTIONS[0] (`{q:1,r:0}`, see
 * engine/hex.ts) walks a straight line of guaranteed-open-sea hexes out from
 * it, used here to place a small fleet on each side. */
const SEA_CENTER = { q: 28, r: 6 };
function seaHex(offset: number): HexCoord {
  return { q: SEA_CENTER.q + offset, r: SEA_CENTER.r };
}

function makeUnit(id: string, owner: PlayerId, typeId: string, position: HexCoord, facing = 0): Unit {
  const t = getUnitType(typeId);
  return {
    id,
    owner,
    typeId,
    position,
    movementLeft: 0, // refilled by resetMovementForActivePlayer before that player's first movement phase
    facing,
    equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/**
 * A small, deliberately non-elephant 2-player army: a mix of infantry,
 * ranged, cavalry, a phalanx (to exercise `cavalryMayAttack` both ways —
 * P0's cavalry can eventually reach P1's phalanx, and vice versa), a
 * chariot, and a couple of ships per side (close enough to immediately
 * exercise boarding, and within a few moves of a bow-on ramming contact).
 * Kept small (6 land + 2 naval per side) so a random-play game reaches
 * elimination in a bounded number of turns — see `playRandomGame`'s
 * `turnCap`.
 */
export function buildFuzzGameState(): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');

  state.units = [
    // Player 0 — advancing from the low end of the land row.
    makeUnit('p0-cav-l', 0, 'cavalerie-legere', landHex(0)),
    makeUnit('p0-phalanx', 0, 'phalanges', landHex(1)),
    makeUnit('p0-archers', 0, 'fantassins-archers', landHex(2)),
    makeUnit('p0-chariot', 0, 'chars-lourds', landHex(3)),
    makeUnit('p0-cav-h', 0, 'cavalerie-lourde', landHex(4)),
    makeUnit('p0-inf', 0, 'fantassins', landHex(5)),

    // Player 1 — advancing from the high end, starting adjacent to P0's line
    // so combat is reachable within the first couple of turns rather than
    // requiring many pure-movement turns to close distance.
    makeUnit('p1-inf-lourds', 1, 'fantassins-lourds', landHex(6)),
    makeUnit('p1-cav-h', 1, 'cavalerie-lourde', landHex(7)),
    makeUnit('p1-phalanx', 1, 'phalanges', landHex(8)),
    makeUnit('p1-archers', 1, 'archers', landHex(9)),
    makeUnit('p1-chariot', 1, 'chars-legers', landHex(10)),
    makeUnit('p1-inf', 1, 'fantassins', landHex(11)),

    // Naval: two ships per side. The birèmes start already adjacent with
    // matching (parallel) facing, so boarding is immediately legal in the
    // first combat phase; the galères start 3 hexes apart, close enough for
    // a ramming contact within a turn or two of naval movement.
    makeUnit('p0-galley', 0, 'galeres', seaHex(0), 0),
    makeUnit('p0-bireme', 0, 'biremes', seaHex(1), 0),
    makeUnit('p1-bireme', 1, 'biremes', seaHex(2), 0),
    makeUnit('p1-galley', 1, 'galeres', seaHex(3), 3),
  ];

  return state;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

/**
 * Throws with a descriptive message (including `context`, so a failure
 * points at exactly which action triggered it) the first time any invariant
 * is violated. Called after every single mutation `playRandomGame` applies —
 * "checked continuously during play," not just at the end of a game.
 */
export function assertInvariants(state: GameState, context: string): void {
  const occupied = new Map<string, Unit>();
  for (const unit of state.units) {
    if (unit.destroyed) continue;

    const terrain = MAP_TERRAIN.get(mapHexKey(unit.position.q, unit.position.r));
    if (terrain === undefined) {
      throw new Error(
        `Invariant violated (${context}): unit ${unit.id} (${unit.typeId}) sits off-map at (${unit.position.q},${unit.position.r})`,
      );
    }
    const category = unitCategory(unit.typeId);
    const isGalley = unit.typeId === 'galeres';
    if (!canEnterTerrain(terrain, category, isGalley)) {
      throw new Error(
        `Invariant violated (${context}): unit ${unit.id} (${category}) sits on terrain "${terrain}" it cannot enter`,
      );
    }
    if (unit.movementLeft < 0) {
      throw new Error(`Invariant violated (${context}): unit ${unit.id} has negative movementLeft (${unit.movementLeft})`);
    }
    const key = mapHexKey(unit.position.q, unit.position.r);
    const existing = occupied.get(key);
    if (existing) {
      throw new Error(
        `Invariant violated (${context}): units ${existing.id} and ${unit.id} both occupy hex ${key}`,
      );
    }
    occupied.set(key, unit);
  }

  if (state.activePlayerIndex < 0 || state.activePlayerIndex >= state.seatOrder.length) {
    throw new Error(`Invariant violated (${context}): activePlayerIndex ${state.activePlayerIndex} is out of range`);
  }
  if (!state.players.some((p) => p.id === state.seatOrder[state.activePlayerIndex])) {
    throw new Error(`Invariant violated (${context}): active seat ${state.seatOrder[state.activePlayerIndex]} matches no player`);
  }
}

/**
 * Direct regression guard for the exact HIGH defect plan.md §6.6 records:
 * `applyAction`'s `endPhase` case once transitioned into a fresh movement
 * phase WITHOUT refilling movement, so a headless caller got
 * `movementLeft === 0` forever after turn 1 and `legalActions` silently
 * degenerated to "just endPhase" — a harness that would have reported clean
 * while exercising nothing. Called right after any `endPhase` action lands
 * the state in a fresh movement phase: every living unit belonging to the
 * new active player must show its FULL printed movement allowance and no
 * leftover charge, exactly what `resetMovementForActivePlayer` guarantees.
 */
function assertMovementWasRefilled(state: GameState, context: string): void {
  const activeOwner = state.seatOrder[state.activePlayerIndex]!;
  for (const unit of state.units) {
    if (unit.destroyed || unit.owner !== activeOwner) continue;
    const fullAllowance = unitType(unit).movement;
    if (unit.movementLeft !== fullAllowance) {
      throw new Error(
        `Invariant violated (${context}): unit ${unit.id} began a fresh movement phase with movementLeft=${unit.movementLeft}, expected the full allowance ${fullAllowance} — movement refill is broken`,
      );
    }
    if (unit.charged) {
      throw new Error(`Invariant violated (${context}): unit ${unit.id} still shows charged=true at the start of a fresh movement phase`);
    }
  }
}

/** The known-real bug class from plan.md §5: cavalry may never resolve an
 * attack against a phalanx, whether alone or as part of a combined group.
 * `legalActions`/`attackerCanJoin`/`defenderCanJoin` already enforce this
 * when building the action space (see engine/combat.ts), so this check
 * should never fire in a correctly-behaving engine — it exists to CATCH a
 * regression, not to enforce the rule itself (mutation-tested, see this
 * repo's PR description / plan.md §6). */
function assertNoCavalryVsPhalanx(state: GameState, attackerIds: string[], defenderIds: string[]): void {
  const attackers = attackerIds.map((id) => requireUnit(state, id));
  const defenders = defenderIds.map((id) => requireUnit(state, id));
  for (const attacker of attackers) {
    for (const defender of defenders) {
      if (!cavalryMayAttack(attacker, defender)) {
        throw new Error(
          `Invariant violated: cavalry unit ${attacker.id} (${attacker.typeId}) resolved an attack against phalanx ${defender.id} — the cavalry/phalanx restriction was bypassed`,
        );
      }
    }
  }
}

function requireUnit(state: GameState, id: string): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`fuzzHarness: no unit with id "${id}"`);
  return unit;
}

/** Every action `legalActions` reports must reference only living units —
 * "destroyed units never act." Checked against the FULL legal set on every
 * turn, not just the one action ultimately chosen. */
function assertNoActionTargetsADeadUnit(state: GameState, legal: Action[]): void {
  for (const action of legal) {
    const ids: string[] = [];
    switch (action.kind) {
      case 'endPhase':
        break;
      case 'landMove':
      case 'navalMove':
      case 'navalRotate':
      case 'ram':
        ids.push(action.unitId);
        break;
      case 'landAttack':
        ids.push(...action.attackerIds, ...action.defenderIds);
        break;
      case 'board':
        ids.push(action.attackerId, action.defenderId);
        break;
    }
    for (const id of ids) {
      const unit = state.units.find((u) => u.id === id);
      if (!unit || unit.destroyed) {
        throw new Error(`Invariant violated: legalActions offered ${action.kind} referencing dead/unknown unit "${id}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Mid-resolution decision plumbing — mirrors BoardScene's
// beginRetreatChoices/beginUnitRetreatChoice/promptAdvanceChoice sequencing
// (see BoardScene.ts:1034-1150, :1364-1402) exactly, just driven by a
// `PlayerAgent` synchronously awaited instead of Phaser click callbacks.
// ---------------------------------------------------------------------------

async function resolveUnitRetreat(state: GameState, unit: Unit, agent: PlayerAgent): Promise<void> {
  const legalHexes = legalRetreatHexes(state, unit);
  if (legalHexes.length > 0) {
    const hex = await agent.chooseRetreat(state, unit, legalHexes);
    retreatUnitTo(unit, hex);
    return;
  }
  const pushTargets = pushCandidates(state, unit);
  if (pushTargets.length > 0) {
    const pushed = await agent.choosePushTarget(state, unit, pushTargets);
    const legalHexesForPushed = legalRetreatHexes(state, pushed);
    const pushedHex = await agent.chooseRetreat(state, pushed, legalHexesForPushed);
    completePush(unit, pushed, pushedHex);
    return;
  }
  // Mirrors BoardScene's own defensive fallback: applyLandCombatResult
  // already eliminates units with no options before queuing them, but an
  // earlier choice in the same batch can change the board out from under a
  // later one.
  unit.destroyed = true;
}

async function processAdvanceOffer(state: GameState, vacatedHex: HexCoord, candidates: Unit[], agent: PlayerAgent): Promise<void> {
  if (unitAt(state, vacatedHex)) return; // already re-occupied by an earlier choice in this batch
  const alive = candidates.filter((u) => !u.destroyed);
  if (alive.length === 0) return;
  const chosen = await agent.chooseAdvance(state, alive, vacatedHex);
  if (chosen) chosen.position = vacatedHex;
}

async function processRetreats(
  state: GameState,
  pendingRetreats: Unit[],
  side: 'attacker' | 'defender',
  attackersForAdvance: Unit[],
  agent: PlayerAgent,
): Promise<void> {
  for (const unit of pendingRetreats) {
    if (unit.destroyed) continue;
    const originalHex = { ...unit.position };
    await resolveUnitRetreat(state, unit, agent);
    // Per the rulebook (see BoardScene's finishQueueItem doc comment), only
    // a DEFENDER's retreat frees a hex the attacker may advance into.
    if (side === 'defender') {
      await processAdvanceOffer(state, originalHex, attackersForAdvance, agent);
    }
  }
}

// ---------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------

export interface HarnessStats {
  seed: number;
  gameOver: boolean;
  winnerId: PlayerId | null;
  turnsReached: number;
  totalActions: number;
  actionsByKind: Partial<Record<Action['kind'], number>>;
  landAttacksResolved: number;
  combatResultCounts: Partial<Record<CombatResult, number>>;
  ramsResolved: number;
  ramHits: number;
  boardingsResolved: number;
}

export interface PlayRandomGameOptions {
  /** Hard cap on `state.turnNumber` (a full round, all players) — exceeding
   * it throws rather than looping forever, per plan.md §6.3's "games
   * terminate rather than looping forever" invariant. */
  turnCap?: number;
  /** Hard cap on the total number of actions applied, as a second safety
   * valve independent of `turnCap` (a pathological phase that never
   * exhausts movement/attacks would otherwise spin within a single turn). */
  actionCap?: number;
}

function emptyContext(): { attackedThisPhase: Set<string>; rammedThisTurn: Set<string> } {
  return { attackedThisPhase: new Set<string>(), rammedThisTurn: new Set<string>() };
}

/**
 * Plays one complete, seeded, fully headless game from `buildFuzzGameState()`
 * to `state.gameOver`, driven ENTIRELY through `legalActions`/`applyAction`
 * plus a `RandomAgent` answering every mid-resolution decision — no Phaser,
 * no `BoardScene`, no scene of any kind. Deterministic: the same `seed`
 * always produces the exact same sequence of actions, dice, and outcomes
 * (see `engine/rng.ts`'s doc comment), so a failing seed is a complete,
 * reproducible repro on its own.
 *
 * Asserts invariants continuously (see `assertInvariants` et al. above),
 * throwing immediately and loudly the first time one is violated, including
 * — per plan.md §6.7 — a hard throw if `pendingDrifts` is ever non-empty:
 * elephants are excluded from `buildFuzzGameState()` specifically so this
 * can never legitimately happen; a violation means the exclusion itself has
 * broken, not that a drift needs handling.
 */
export async function playRandomGame(seed: number, options: PlayRandomGameOptions = {}): Promise<HarnessStats> {
  const turnCap = options.turnCap ?? 500;
  const actionCap = options.actionCap ?? 50_000;

  const rng = createSeededRng(seed);
  const agent = new RandomAgent(rng);
  const state = buildFuzzGameState();
  // The very first movement phase never goes through `applyAction`'s
  // `endPhase` case (nothing has ended yet to trigger a refill) — mirrors
  // how a fresh game reaches BoardScene with units already carrying their
  // full movement from placement (see PlacementScene.ts, which sets
  // `movementLeft: t.movement` directly). Do the same here rather than
  // leaning on `endPhase`'s refill for a turn that hasn't happened yet.
  resetMovementForActivePlayer(state);

  const context = emptyContext();
  const stats: HarnessStats = {
    seed,
    gameOver: false,
    winnerId: null,
    turnsReached: state.turnNumber,
    totalActions: 0,
    actionsByKind: {},
    landAttacksResolved: 0,
    combatResultCounts: {},
    ramsResolved: 0,
    ramHits: 0,
    boardingsResolved: 0,
  };

  assertInvariants(state, 'initial state');

  while (!state.gameOver) {
    if (state.turnNumber > turnCap) {
      throw new Error(
        `playRandomGame(seed=${seed}): exceeded turnCap=${turnCap} without the game ending — looks like an infinite loop (${stats.totalActions} actions applied so far)`,
      );
    }
    if (stats.totalActions > actionCap) {
      throw new Error(
        `playRandomGame(seed=${seed}): exceeded actionCap=${actionCap} without the game ending — looks like an infinite loop within a single turn`,
      );
    }

    const legal = legalActions(state, context);
    assertNoActionTargetsADeadUnit(state, legal);
    const action = agent.chooseNextAction(state, legal);
    await applyOneAction(state, action, agent, rng, context, stats);

    stats.totalActions++;
    stats.actionsByKind[action.kind] = (stats.actionsByKind[action.kind] ?? 0) + 1;
    stats.turnsReached = Math.max(stats.turnsReached, state.turnNumber);
    assertInvariants(state, `after action #${stats.totalActions} (${action.kind})`);
  }

  stats.gameOver = true;
  stats.winnerId = state.winnerId;
  return stats;
}

async function applyOneAction(
  state: GameState,
  action: Action,
  agent: PlayerAgent,
  rng: () => number,
  context: { attackedThisPhase: Set<string>; rammedThisTurn: Set<string> },
  stats: HarnessStats,
): Promise<void> {
  switch (action.kind) {
    case 'endPhase': {
      applyAction(state, action, rng);
      // Mirrors BoardScene.endPhase exactly (BoardScene.ts:1736-1765): the
      // scene-local attack/ram bookkeeping lives outside GameState (see
      // engine/actions.ts's `ActionContext` doc comment) and isn't
      // `applyAction`'s responsibility to reset.
      context.attackedThisPhase.clear();
      if (!state.gameOver && state.phase === 'movement') {
        context.rammedThisTurn.clear();
        assertMovementWasRefilled(state, 'after endPhase into a fresh movement phase');
      }
      return;
    }

    case 'landMove':
    case 'navalMove':
    case 'navalRotate': {
      applyAction(state, action, rng);
      return;
    }

    case 'ram': {
      const result = applyAction(state, action, rng);
      context.rammedThisTurn.add(action.unitId);
      stats.ramsResolved++;
      if (result.hit) stats.ramHits++;
      return;
    }

    case 'board': {
      applyAction(state, action, rng);
      context.attackedThisPhase.add(action.attackerId);
      stats.boardingsResolved++;
      return;
    }

    case 'landAttack': {
      assertNoCavalryVsPhalanx(state, action.attackerIds, action.defenderIds);
      for (const id of action.attackerIds) context.attackedThisPhase.add(id);
      const result = applyAction(state, action, rng);
      stats.landAttacksResolved++;
      stats.combatResultCounts[result.detail.result] = (stats.combatResultCounts[result.detail.result] ?? 0) + 1;

      // THE loud guard plan.md §6.7 requires: elephants are excluded from
      // `buildFuzzGameState()` specifically so this can never fire — a
      // failure here means that exclusion itself has been broken (e.g. by
      // someone adding an elephant to the harness's army without reading
      // this comment), not that a drift needs resolving.
      if (result.outcome.pendingDrifts.length > 0) {
        throw new Error(
          `playRandomGame: outcome.pendingDrifts was non-empty (${result.outcome.pendingDrifts.map((u) => u.id).join(', ')}) — elephants must stay excluded from the fuzz harness's armies until Stage 2b extracts the drift cascade (plan.md §6.7). This is not a real drift to resolve; it's the exclusion itself having broken.`,
        );
      }

      if (result.outcome.requiresExchangeChoice) {
        const chosen = await agent.chooseExchangeSacrifice(state, result.attackers, result.outcome.requiredSacrificeForce);
        applyExchangeSacrifice(chosen);
        for (const hex of result.defenderOriginalHexes) {
          await processAdvanceOffer(state, hex, result.attackers, agent);
        }
      } else if (result.outcome.pendingRetreats.length > 0) {
        const side = result.detail.result === 'DR' ? 'defender' : 'attacker';
        await processRetreats(state, result.outcome.pendingRetreats, side, result.attackers, agent);
      } else if (result.detail.result === 'DE' || result.detail.result === 'EX') {
        for (const hex of result.defenderOriginalHexes) {
          await processAdvanceOffer(state, hex, result.attackers, agent);
        }
      }
      return;
    }
  }
}
