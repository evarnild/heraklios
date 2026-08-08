import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, hexKey as mapHexKey } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { DIRECTIONS, hexAdd } from './hex';
import { getUnitType } from '../data/units';
import type { CombatResult } from '../data/combatTable';
import { legalActions, applyAction, type Action } from './actions';
import type { DrivingAgent, PlayerAgent } from './agent';
import { RandomAgent } from './randomAgent';
import { createSeededRng } from './rng';
import {
  eligibleAdvanceCandidates,
  legalRetreatHexes,
  pushCandidates,
  retreatUnitTo,
  completePush,
  applyExchangeSacrifice,
  unitAt,
} from './combat';
import { resetMovementForActivePlayer, createInitialState, endGameByTimeLimit } from './turnManager';
import {
  unitCategory,
  unitType,
  maxEquipmentPointsForType,
  type GameState,
  type Player,
  type PlayerId,
  type Unit,
} from './state';

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
    equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/**
 * A small, deliberately non-elephant 2-player army: cavalry, a phalanx (to
 * exercise `cavalryMayAttack` both ways — P0's cavalry can eventually reach
 * P1's phalanx, and vice versa), a ranged unit, and one ship per side
 * (started already adjacent with matching/parallel facing, so boarding is
 * immediately legal in the first combat phase).
 *
 * Kept DELIBERATELY small (3 land + 1 naval per side, 8 units total) for
 * performance, not realism — `legalActions` recomputes a full
 * `reachableHexes` BFS for every living unit of the active player on EVERY
 * single action choice (not just once per phase), so a game's total cost is
 * roughly (units) x (actions per game), and a full soak run needs many
 * seeds to be worth anything (see `fuzzHarness.test.ts`'s `GAME_COUNT`).
 * More units and a longer `turnCap` were tried first and worked fine
 * correctness-wise, just far too slowly for a test suite that has to stay
 * runnable on every `npm test` — see `playRandomGame`'s doc comment for the
 * separate (and more interesting) discovery that also shaped `turnCap`'s
 * default: near-even 1v1 match-ups never eliminate a unit at all under this
 * CRT, only ever retreat it.
 */
export function buildFuzzGameState(): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');

  state.units = [
    // Player 0 — advancing from the low end of the land row. `p0-cav-l` is
    // placed immediately ADJACENT to `p1-phalanx` (distance 1, not just
    // "close") deliberately: `cavalryMayAttack` is this repo's one
    // known-real bug class worth mutation-testing (plan.md §5/§6), and an
    // invariant that only MIGHT get exercised depending on how random
    // movement happens to unfold is a weak regression guard. Starting the
    // matchup already adjacent means the very first combat phase offers the
    // (illegally, if the restriction were ever broken) forbidden attack —
    // confirmed by deliberately breaking `cavalryMayAttack` and re-running
    // this file's own soak test, which failed immediately with this
    // layout after going UNCAUGHT with an earlier, more spread-out one.
    makeUnit('p0-cav-l', 0, 'cavalerie-legere', landHex(0)),
    makeUnit('p0-phalanx', 0, 'phalanges', landHex(2)),
    makeUnit('p0-archers', 0, 'fantassins-archers', landHex(4)),

    // Player 1 — mirrored so BOTH directions of the cavalry/phalanx check
    // (P0's cavalry vs. P1's phalanx, and vice versa) are exercised from
    // turn one: `p1-phalanx` sits right next to `p0-cav-l` (landHex(1) is
    // adjacent to landHex(0)), and `p1-cav-h` sits right next to
    // `p0-phalanx` (landHex(3) is adjacent to landHex(2)).
    makeUnit('p1-phalanx', 1, 'phalanges', landHex(1)),
    makeUnit('p1-cav-h', 1, 'cavalerie-lourde', landHex(3)),
    makeUnit('p1-archers', 1, 'archers', landHex(5)),

    // Naval: one ship per side, already adjacent with matching facing so
    // boarding is immediately legal in the first combat phase.
    makeUnit('p0-galley', 0, 'galeres', seaHex(0), 0),
    makeUnit('p1-galley', 1, 'galeres', seaHex(1), 0),
  ];

  return state;
}

/** (10,5) and every hex within radius 2 of it are all confirmed 'plain' on
 * the shipped map (see combat.test.ts's `CENTER`/`NEIGHBORS` and its
 * "cascading push" perf test, which probes the same neighborhood) — reused
 * here for the same reason: a big open patch with no terrain surprises to
 * build a tight formation on. */
const PUSH_CENTER = { q: 10, r: 5 };

/**
 * HIGH-4 finding from adversarial review: `buildFuzzGameState()`'s small,
 * spread-out army essentially never boxes a unit in tightly enough for a
 * push to trigger — instrumented across all 100 default-soak seeds,
 * `pushesResolved` reads 0, meaning the cascading-push path (plan.md §12)
 * still had ZERO fuzz coverage even after the engine-level fix and unit
 * tests landed. This is a SEPARATE, purpose-built scenario (not a change to
 * `buildFuzzGameState()`, which stays as-is for its own existing
 * cavalry/phalanx and boarding coverage) that reliably reaches at least one
 * push within a handful of seeds:
 *
 * - `defender` (P1) sits at `PUSH_CENTER`, boxed on 5 of its 6 sides by its
 *   OWN friendlies (`ring0`..`ring4`) — each of which has open space of its
 *   own beyond the ring, so each genuinely CAN make room (a real push
 *   target, not a dead end).
 * - `attacker` (P0) occupies `defender`'s 6th neighbor, and is ITSELF fully
 *   boxed by P1 units (the ring plus `defender` plus three more P1 filler
 *   units) — enemy-occupied hexes are impassable to `reachableHexes` (see
 *   `engine/movement.ts`'s doc comment), so `attacker` has no legal move at
 *   all and can only ever `endPhase` during its own movement phase,
 *   guaranteeing it's still adjacent to `defender` whenever its combat phase
 *   comes around.
 * - `attacker` (fantassins, attack 2) vs. `defender` (fantassins, defense 1)
 *   is a 2:1 force ratio, and EVERY die face at that column in
 *   `data/combatTable.ts`'s CRT is AR or DR (see `playRandomGame`'s own
 *   "TERMINATION" doc comment on this same fact) — a die of 1-4 forces
 *   `defender` to retreat (a 4-in-6 chance whenever the attack is actually
 *   chosen), and `defender`'s only legal retreat hexes are all occupied
 *   (5 friendlies + `attacker`), so it's forced into exactly the push this
 *   scenario exists to reach.
 *
 * Not folded into `buildFuzzGameState()` itself: that army's existing
 * coverage (cavalry/phalanx, boarding) is unrelated to this, and keeping
 * this scenario separate means neither soak's odds/timing depend on the
 * other's army composition.
 */
export function buildPushScenarioGameState(): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');

  const attackerPos = hexAdd(PUSH_CENTER, DIRECTIONS[5]!); // (10,6)
  const ring = DIRECTIONS.slice(0, 5).map((d) => hexAdd(PUSH_CENTER, d)); // the other 5 neighbors
  // Fully box the attacker: its 6 neighbors are `defender` (dir2 from it),
  // ring[0] (dir1), ring[4] (dir3), and 3 more hexes no other unit already
  // occupies — DIRECTIONS[0], [4], [5] from the attacker's own position.
  const attackerFillers = [DIRECTIONS[0]!, DIRECTIONS[4]!, DIRECTIONS[5]!].map((d) => hexAdd(attackerPos, d));

  state.units = [
    makeUnit('attacker', 0, 'fantassins', attackerPos),
    makeUnit('defender', 1, 'fantassins', PUSH_CENTER),
    ...ring.map((pos, i) => makeUnit(`ring${i}`, 1, 'fantassins', pos)),
    ...attackerFillers.map((pos, i) => makeUnit(`filler${i}`, 1, 'fantassins', pos)),
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

/** Every sea-like/coastal `TerrainType` value, hardcoded (see
 * `assertHardcodedTerrainRestrictions`'s doc comment for why this doesn't
 * import `isSeaLike`/`ZONE_TERRAINS` from `data/terrain.ts`). */
const HARDCODED_SEA_OR_COAST_TERRAIN = new Set([
  'sea',
  'coast',
  'zone-anse-hypnos',
  'zone-pointe-eole',
  'zone-baie-argos',
  'zone-cap-zenon',
]);

/**
 * MEDIUM finding from adversarial review: `assertInvariants`' terrain check
 * above calls `canEnterTerrain`/reads `TERRAIN_EFFECTS` — independent of the
 * ENGINE logic around it (mutation-tested, see this task's PR description),
 * but NOT of the underlying DATA. Setting
 * `TERRAIN_EFFECTS['steep-flank'].forbiddenFor = []` would gut the
 * restriction everywhere it's consulted, including inside that check's own
 * oracle, and the invariant would go completely silent.
 *
 * This restates the rulebook's own terrain-restriction sentence — "Chars et
 * cavaleries sont interdits sur les flancs abrupts ; chars, cavaleries et
 * éléphants ne peuvent accéder aux marais. La mer n'est pas accessible aux
 * armées de terre." (`docs/research/05-rules-french-original.md:186-188`) —
 * as literal, hardcoded terrain-name string comparisons, deliberately
 * calling neither `canEnterTerrain` nor `TERRAIN_EFFECTS` nor
 * `isSeaLike`/`ZONE_TERRAINS`, so it stays independent of every one of those
 * being tampered with.
 */
function assertHardcodedTerrainRestrictions(state: GameState, context: string): void {
  for (const unit of state.units) {
    if (unit.destroyed) continue;
    const terrain = MAP_TERRAIN.get(mapHexKey(unit.position.q, unit.position.r));
    if (terrain === undefined) continue; // off-map is assertInvariants' concern, not this check's

    const category = unitCategory(unit.typeId);
    const isChariotOrCavalry = category === 'chariot' || category === 'cavalry';

    if (isChariotOrCavalry && terrain === 'steep-flank') {
      throw new Error(
        `Invariant violated (${context}): unit ${unit.id} (${category}) stands on steep-flank terrain — "Chars et cavaleries sont interdits sur les flancs abrupts" (docs/research/05-rules-french-original.md:186-188)`,
      );
    }
    if ((isChariotOrCavalry || category === 'elephant') && terrain === 'marsh') {
      throw new Error(
        `Invariant violated (${context}): unit ${unit.id} (${category}) stands on marsh terrain — "chars, cavaleries et éléphants ne peuvent accéder aux marais" (docs/research/05-rules-french-original.md:186-188)`,
      );
    }
    if (category !== 'naval' && HARDCODED_SEA_OR_COAST_TERRAIN.has(terrain)) {
      throw new Error(
        `Invariant violated (${context}): land unit ${unit.id} (${category}) stands on sea/coast terrain "${terrain}" — "La mer n'est pas accessible aux armées de terre" (docs/research/05-rules-french-original.md:186-188)`,
      );
    }
  }
}

/**
 * "Turn order preserved" as its own explicit check, separate from
 * `assertInvariants`' more general `activePlayerIndex`-is-valid check above:
 * `buildFuzzGameState()` never opts into `randomizedTurnOrder` (see
 * `createInitialState`'s default in turnManager.ts), so `state.seatOrder`
 * should be BYTE-IDENTICAL to `initialSeatOrder` for the entire game —
 * `advancePhase` only ever reshuffles it when that flag is set. Takes the
 * game's actual starting order as a parameter rather than re-deriving an
 * expectation, so this stays correct even if `buildFuzzGameState()`'s
 * player list or seat count ever changes.
 */
function assertTurnOrderPreserved(state: GameState, initialSeatOrder: readonly PlayerId[], context: string): void {
  const unchanged =
    state.seatOrder.length === initialSeatOrder.length &&
    state.seatOrder.every((id, i) => id === initialSeatOrder[i]);
  if (!unchanged) {
    throw new Error(
      `Invariant violated (${context}): seatOrder changed from [${initialSeatOrder.join(',')}] to [${state.seatOrder.join(',')}] despite randomizedTurnOrder being off`,
    );
  }
}

/**
 * The seat the turn should hand off to after a combat->movement `endPhase`,
 * from `fromIndex` (the OLD `activePlayerIndex`): the next seat around
 * `seatOrder`, skipping any eliminated player — mirroring `advancePhase`'s
 * own skip-eliminated-seats loop in turnManager.ts, but re-derived here from
 * raw `eliminated` flags rather than by calling `advancePhase` again, so
 * this stays an independent oracle rather than the code re-checking itself.
 */
function nextLivingSeatIndex(
  seatOrder: readonly PlayerId[],
  eliminated: ReadonlyMap<PlayerId, boolean>,
  fromIndex: number,
): number {
  let idx = fromIndex;
  for (let i = 0; i < seatOrder.length; i++) {
    idx = (idx + 1) % seatOrder.length;
    if (!eliminated.get(seatOrder[idx]!)) return idx;
  }
  return fromIndex; // no living seat at all — gameOver should already be true by this point
}

/**
 * MEDIUM finding from adversarial review: `assertTurnOrderPreserved` above
 * only proves `seatOrder` itself wasn't mutated — a bug that stuck
 * `activePlayerIndex` on one seat, or skipped a seat it shouldn't have,
 * would pass it silently. This checks the actual ADVANCEMENT: called around
 * every `endPhase` action that ends a COMBAT phase (the only kind that
 * changes whose turn it is — a movement->combat `endPhase` keeps the same
 * player), the new `activePlayerIndex` must be exactly the next living seat
 * after the old one, per `nextLivingSeatIndex` above. Not a blind "+1 mod
 * length": `buildFuzzGameState()`'s 2 players are never both eliminated
 * before `turnCap` in the games this harness has actually run, but a much
 * longer local soak (see fuzzHarness.test.ts's `GAME_COUNT`) could reach
 * one, and this stays correct (rather than throwing a false positive) if a
 * seat is ever legitimately skipped.
 */
function assertSeatAdvancedCorrectly(
  seatOrder: readonly PlayerId[],
  eliminatedNow: ReadonlyMap<PlayerId, boolean>,
  previousIndex: number,
  newIndex: number,
  context: string,
): void {
  const expected = nextLivingSeatIndex(seatOrder, eliminatedNow, previousIndex);
  if (newIndex !== expected) {
    throw new Error(
      `Invariant violated (${context}): activePlayerIndex went from ${previousIndex} to ${newIndex} after a combat phase ended, expected ${expected} (the next non-eliminated seat) — turn order advanced incorrectly`,
    );
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

/** The two cavalry type ids on the shipped roster (`data/units.ts`),
 * hardcoded rather than derived via `unitCategory` — see
 * `assertNoCavalryVsPhalanx`'s doc comment for why. */
const CAVALRY_TYPE_IDS = new Set(['cavalerie-legere', 'cavalerie-lourde']);

/**
 * The known-real bug class from plan.md §5: cavalry may never resolve an
 * attack against a phalanx, whether alone or as part of a combined group.
 * `legalActions`/`attackerCanJoin`/`defenderCanJoin` already enforce this
 * when building the action space (see engine/combat.ts), so this check
 * should never fire in a correctly-behaving engine — it exists to CATCH a
 * regression, not to enforce the rule itself.
 *
 * DELIBERATELY does NOT call `cavalryMayAttack`, and DELIBERATELY does NOT
 * even call the shared `unitCategory` helper for the attacker side — both
 * are things a single mutation could break out from under this check.
 * Mutation-testing this exact function (see this task's PR description /
 * plan.md §6) found that an earlier version DID call `cavalryMayAttack`,
 * so mutating that function to always return `true` broke the one thing
 * this check exists to guard AND the guard's own oracle together, and the
 * "invariant" caught nothing. `unitCategory` itself is one step removed
 * from that same trap (a `unitCategory` mutation that stopped recognizing
 * `cavalerie-*` as `'cavalry'` would fool BOTH the real rule in combat.ts
 * AND this check, for the same reason) — closed here by hardcoding the two
 * cavalry type ids directly instead. `unitType(defender).id === 'phalanges'`
 * for the defender side was already independent (a raw type id string
 * comparison, not a `unitCategory` call) and is unchanged.
 */
function assertNoCavalryVsPhalanx(state: GameState, attackerIds: string[], defenderIds: string[]): void {
  const attackers = attackerIds.map((id) => requireUnit(state, id));
  const defenders = defenderIds.map((id) => requireUnit(state, id));
  for (const attacker of attackers) {
    if (!CAVALRY_TYPE_IDS.has(attacker.typeId)) continue;
    for (const defender of defenders) {
      if (unitType(defender).id === 'phalanges') {
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

/**
 * Resolves one unit's forced retreat, cascading through pushes exactly like
 * `BoardScene.beginUnitRetreatChoice` (see that function's doc comment for
 * the shared design, and `combat.ts`'s `pushCandidates`/`completePush` for
 * why the recursion needs `visited` threaded through it): a direct legal
 * retreat if one exists; otherwise a friendly is chosen to push, ITS OWN
 * retreat is resolved by recursing into this same function (which may
 * itself cascade further), and only once that's fully settled does `unit`
 * take over the hex the pushed unit vacated. `visited` accumulates the
 * chain's ancestors (not including `unit`) so `pushCandidates` can't offer
 * a unit still mid-resolution higher up the call stack as if it were an
 * ordinary bystander — see `pushCandidates`'s own doc comment on
 * termination.
 *
 * Exported (not merely file-local) specifically so this exact glue — not
 * just the `pushCandidates`/`completePush` primitives it calls — can be
 * driven directly by a test with a scripted `PlayerAgent`. HIGH-3 finding
 * from adversarial review: `combat.test.ts`'s own cascade tests exercised
 * the primitives by hand-writing the `retreatUnitTo`/`completePush`
 * sequence in the test body, never this function, so a bug in the
 * SEQUENCING itself (e.g. capturing `pushed.position` too late, or passing
 * `visited` instead of the grown `chainVisited` into the recursive call —
 * both would silently corrupt a cascade) had no test that could catch it.
 * See `fuzzHarness.test.ts`'s `resolveUnitRetreat` describe block.
 */
export async function resolveUnitRetreat(
  state: GameState,
  unit: Unit,
  agent: PlayerAgent,
  stats?: HarnessStats,
  visited: ReadonlySet<string> = new Set(),
  resolvedIds?: Set<string>,
): Promise<void> {
  resolvedIds?.add(unit.id);
  const legalHexes = legalRetreatHexes(state, unit);
  if (legalHexes.length > 0) {
    const hex = await agent.chooseRetreat(state, unit, legalHexes);
    retreatUnitTo(unit, hex);
    return;
  }
  const pushTargets = pushCandidates(state, unit, visited);
  if (pushTargets.length > 0) {
    if (stats) stats.pushesResolved++;
    const pushed = await agent.choosePushTarget(state, unit, pushTargets);
    // Capture BEFORE recursing — `pushed.position` changes during its own
    // resolution below, but `unit` is only entitled to the hex `pushed`
    // started this step from (see `completePush`'s doc comment).
    const vacatedHex = { ...pushed.position };
    const chainVisited = new Set(visited);
    chainVisited.add(unit.id);
    await resolveUnitRetreat(state, pushed, agent, stats, chainVisited, resolvedIds);
    completePush(unit, vacatedHex);
    return;
  }
  // Mirrors BoardScene's own defensive fallback: applyLandCombatResult
  // already eliminates units with no options before queuing them, but an
  // earlier choice in the same batch can change the board out from under a
  // later one. `pushCandidates` already guarantees a CHOSEN push target is
  // viable, so this should be unreachable for a `pushed` unit reached via
  // the recursive call above too — kept as the same defensive net, not a
  // normally-expected path.
  unit.destroyed = true;
}

/**
 * Shared with `BoardScene.promptAdvanceChoice` after plan.md §9.1. The bug
 * this protects against: filtering advance candidates only by `!u.destroyed`
 * offers a vacated hex illegal for the advancing unit's category (e.g. a
 * defeated defender's marsh/steep-flank hex, legal for THAT unit but not for
 * a cavalry/chariot attacker in the same combat group).
 *
 * `eligibleAdvanceCandidates` (engine/combat.ts) is the extracted, tested,
 * shared fix for this — used here rather than reimplementing the filter
 * inline specifically so it ISN'T only the harness's own private correction
 * (a prior version filtered inline here, which meant this harness's own
 * terrain invariant could never see the identical bug in `BoardScene.ts`:
 * the harness silently corrected the exact defect it would otherwise have
 * caught). The scene now calls the same exported function.
 */
async function processAdvanceOffer(state: GameState, vacatedHex: HexCoord, candidates: Unit[], agent: PlayerAgent): Promise<void> {
  if (unitAt(state, vacatedHex)) return; // already re-occupied by an earlier choice in this batch
  const alive = eligibleAdvanceCandidates(candidates, vacatedHex);
  if (alive.length === 0) return;
  const chosen = await agent.chooseAdvance(state, alive, vacatedHex);
  if (chosen) chosen.position = vacatedHex;
}

/**
 * MEDIUM finding from adversarial review (M11): on a result that forces the
 * whole attacking (or defending) SIDE to retreat, every one of those units
 * lands in `pendingRetreats` independently — but a push cascade resolving
 * one of them can move ANOTHER unit that's also separately queued (e.g.
 * unit A, boxed in, pushes its sibling attacker B aside; B is ALSO in
 * `pendingRetreats` for the same combat result). Without tracking that, the
 * loop below would later reach B's own queue entry and ask the player to
 * retreat it A SECOND time for the same single result. `resolvedIds`
 * (populated by every `resolveUnitRetreat` call, including nested pushed
 * units — see that function) is checked before each queue entry so a
 * chain-moved sibling is skipped rather than double-processed.
 *
 * Exported for the same reason as `resolveUnitRetreat` — so this exact
 * batch-level skip logic can be driven directly by a test, not just
 * inferred from `playRandomGame`'s aggregate stats.
 */
export async function processRetreats(
  state: GameState,
  pendingRetreats: Unit[],
  side: 'attacker' | 'defender',
  attackersForAdvance: Unit[],
  agent: PlayerAgent,
  stats?: HarnessStats,
): Promise<void> {
  const resolvedIds = new Set<string>();
  for (const unit of pendingRetreats) {
    if (unit.destroyed || resolvedIds.has(unit.id)) continue;
    const originalHex = { ...unit.position };
    await resolveUnitRetreat(state, unit, agent, stats, undefined, resolvedIds);
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
  /** True when the game reached `turnCap` and was ended by
   * `endGameByTimeLimit` (highest army value wins) rather than by mutual
   * elimination — see `playRandomGame`'s doc comment for why this is a
   * legitimate rulebook ending, not a harness failure. */
  endedByTimeLimit: boolean;
  turnsReached: number;
  totalActions: number;
  actionsByKind: Partial<Record<Action['kind'], number>>;
  landAttacksResolved: number;
  combatResultCounts: Partial<Record<CombatResult, number>>;
  ramsResolved: number;
  ramHits: number;
  boardingsResolved: number;
  /** Number of times a retreating unit, unable to retreat directly, pushed
   * a friendly neighbor aside instead (see `combat.ts`'s `pushCandidates`) —
   * counted once per push LINK, so a 3-link cascade increments this 3 times.
   * Added alongside plan.md §12's cascading-push fix specifically because
   * this path had zero fuzz coverage before it: with the old, strict
   * "entourée" reading this always read 0 across a 100-game soak (plan.md
   * §12.2) — a rule that never fires is itself evidence something's wrong,
   * which is exactly what motivated the fix. */
  pushesResolved: number;
  /** Land attacks resolved with more than one attacking unit. Structurally
   * always 0 for a `RandomAgent` game — `legalActions` enumerates singleton
   * attacks only (see its doc comment), which plan.md §6.8 records as the
   * reason the harness could never have caught §5's multi-defender phalanx
   * bypass. A `HeuristicAgent` at the `'ev'` tier assembles groups itself
   * (see `buildAttackGroup`), so this counter is how a soak reports whether
   * combined-attack coverage actually happened rather than being assumed. */
  multiAttackerAttacks: number;
}

export interface PlayRandomGameOptions {
  /** Turn number (a full round, all players) at which the game is ended via
   * `endGameByTimeLimit` — the rulebook's own "on se fixera des temps
   * limites pour la partie entière" ending (docs/research/05-rules-french-original.md:41),
   * not a harness failure. See `playRandomGame`'s doc comment for why this,
   * rather than playing to full mutual elimination, is this harness's
   * primary termination path. */
  turnCap?: number;
  /** A hard, much-higher safety valve independent of `turnCap`: if this many
   * actions are applied without EITHER a natural elimination ending or
   * `turnCap` being reached, something is genuinely looping (e.g. within a
   * single stuck phase) and this throws loudly rather than hanging, per
   * plan.md §6.3's "games terminate rather than looping forever" invariant. */
  actionCap?: number;
  /**
   * When provided, every action chosen is pushed onto this array as a
   * compact string (see `formatAction`) — a full, ordered, action-by-action
   * trace of the game, not just its aggregate `HarnessStats`.
   *
   * Exists specifically so "the same seed replays identically" can be
   * proven ON THE TRACE, not just on summary counters: `HarnessStats` alone
   * can't distinguish two structurally DIFFERENT games that happen to reach
   * equal totals (adversarial review's HIGH finding — see
   * `fuzzHarness.test.ts`'s determinism/different-seeds tests, which pass
   * an array here and compare it directly). A trace is also this task's
   * whole point in miniature: it's exactly the artifact that turns "seed 42
   * found a bug" into a reproducible, step-by-step repro someone else can
   * replay without re-running the fuzzer.
   */
  trace?: string[];
  /**
   * Overrides the starting position — defaults to `buildFuzzGameState()`.
   * Exists so a different, purpose-built scenario (e.g.
   * `buildPushScenarioGameState()`, HIGH-4) can be soaked through the exact
   * same seeded driver/invariant machinery as the default army, without
   * duplicating `playRandomGame`'s ~150 lines of turn-loop/invariant-check
   * plumbing just to swap the initial `GameState`.
   */
  buildInitialState?: () => GameState;
  /**
   * Which agent plays each seat. Defaults to one `RandomAgent` shared by
   * every seat, which is exactly what this harness did before plan.md §6.4's
   * Stage 3 needed anything else.
   *
   * Called once per seat, all with the SAME seeded `rng` the dice draw from,
   * so a whole multi-agent game still replays identically from its seed. Two
   * consequences worth knowing before writing a `createAgent`:
   *
   * - Returning the same instance for every seat (the default) is fine and
   *   is not the same thing as the agents sharing knowledge — these agents
   *   are stateless between calls; everything they know comes from the
   *   `GameState` handed to them.
   * - Returning DIFFERENT agents per seat is how a strength comparison is
   *   run (see `heuristicAgent.test.ts`'s head-to-head). Mid-resolution
   *   decisions are routed to the agent of the seat that OWNS the unit being
   *   asked about, not to whoever's turn it is — a defender choosing where
   *   to retreat is the defender's decision even though the attacker is the
   *   active player.
   */
  createAgent?: (rng: () => number, seat: PlayerId) => DrivingAgent;
}

/** A compact, stable, one-line string for `action` — used only for
 * `PlayRandomGameOptions.trace`, so it only needs to be distinct enough to
 * tell two actions apart, not pretty. */
function formatAction(action: Action): string {
  switch (action.kind) {
    case 'endPhase':
      return 'endPhase';
    case 'landMove':
      return `landMove:${action.unitId}->(${action.to.q},${action.to.r})`;
    case 'navalMove':
      return `navalMove:${action.unitId}->(${action.to.q},${action.to.r})`;
    case 'navalRotate':
      return `navalRotate:${action.unitId}:${action.direction}`;
    case 'ram':
      return `ram:${action.unitId}`;
    case 'landAttack':
      return `landAttack:[${action.attackerIds.join(',')}]->[${action.defenderIds.join(',')}]`;
    case 'board':
      return `board:${action.attackerId}->${action.defenderId}`;
  }
}

/**
 * An agent may only play something the engine actually offered — checked on
 * the action it CHOSE, not just on the set it was offered
 * (`assertNoActionTargetsADeadUnit` covers that side).
 *
 * The one sanctioned exception is a COMBINED land attack. `legalActions`
 * enumerates singleton attacks only, deliberately (see its doc comment), and
 * explicitly invites a scored agent to assemble a bigger group and hand it
 * to `applyAction` itself — which `HeuristicAgent` does. Such a group is
 * accepted here exactly when every one of its attackers had a legal
 * singleton attack against that same single defender, which is precisely the
 * condition `attackerCanJoin` enforces for a group (reachability per
 * attacker, plus the cavalry/phalanx rule, which `validTargets` already
 * applied to each singleton). Anything else — an unlisted move, a
 * multi-DEFENDER group, an attacker that never had a legal attack — is a bug
 * in the agent and throws.
 *
 * Worth having rather than relying on `applyAction`'s own throws: those
 * catch a dead or unknown unit, but would happily resolve a combat between
 * two units on opposite ends of the map.
 */
function assertChosenActionIsLegal(action: Action, legal: Action[]): void {
  const key = formatAction(action);
  if (legal.some((candidate) => formatAction(candidate) === key)) return;

  if (action.kind === 'landAttack' && action.attackerIds.length > 1 && action.defenderIds.length === 1) {
    const defenderId = action.defenderIds[0]!;
    const everyAttackerCouldAttackAlone = action.attackerIds.every((attackerId) =>
      legal.some(
        (candidate) =>
          candidate.kind === 'landAttack' &&
          candidate.attackerIds.length === 1 &&
          candidate.attackerIds[0] === attackerId &&
          candidate.defenderIds.length === 1 &&
          candidate.defenderIds[0] === defenderId,
      ),
    );
    if (everyAttackerCouldAttackAlone) return;
  }

  throw new Error(
    `Invariant violated: the agent chose "${key}", which legalActions did not offer and which is not a valid combination of offered singleton attacks`,
  );
}

function emptyContext(): { attackedThisPhase: Set<string>; rammedThisTurn: Set<string> } {
  return { attackedThisPhase: new Set<string>(), rammedThisTurn: new Set<string>() };
}

/**
 * Dispatches each decision to the agent of the seat it actually belongs to.
 *
 * Necessary the moment two seats play differently (`PlayRandomGameOptions.createAgent`):
 * every mid-resolution question the engine asks is directed at a specific
 * player, and it is NOT always the active one — `applyLandCombatResult`
 * hands the DEFENDER a retreat to choose while the attacker is the player
 * whose turn it is. Answering that with the attacker's agent would be a
 * strength comparison measuring the wrong thing (each agent playing half of
 * both sides), which is subtle enough to be worth its own class rather than
 * an inline lambda.
 *
 * Exported so a test can drive `resolveUnitRetreat`/`processRetreats`
 * directly with per-seat agents, the same way those functions are already
 * exported for scripted single agents.
 */
export class SeatAgentRouter implements DrivingAgent {
  constructor(private readonly agents: ReadonlyMap<PlayerId, DrivingAgent>) {}

  private forSeat(owner: PlayerId): DrivingAgent {
    const agent = this.agents.get(owner);
    if (!agent) throw new Error(`SeatAgentRouter: no agent configured for seat ${owner}`);
    return agent;
  }

  chooseNextAction(state: GameState, legal: Action[]): Action {
    return this.forSeat(state.seatOrder[state.activePlayerIndex]!).chooseNextAction(state, legal);
  }

  chooseRetreat(state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    return this.forSeat(unit.owner).chooseRetreat(state, unit, options);
  }

  choosePushTarget(state: GameState, unit: Unit, candidates: Unit[]): Promise<Unit> {
    return this.forSeat(unit.owner).choosePushTarget(state, unit, candidates);
  }

  chooseAdvance(state: GameState, candidates: Unit[], vacated: HexCoord): Promise<Unit | null> {
    // Every candidate comes from one attack group, so they share an owner;
    // `processAdvanceOffer` never calls this with an empty list.
    return this.forSeat(candidates[0]!.owner).chooseAdvance(state, candidates, vacated);
  }

  chooseExchangeSacrifice(state: GameState, attackers: Unit[], requiredForce: number): Promise<Unit[]> {
    return this.forSeat(attackers[0]!.owner).chooseExchangeSacrifice(state, attackers, requiredForce);
  }
}

/**
 * Plays one complete, seeded, fully headless game from `buildFuzzGameState()`
 * (or `options.buildInitialState()`, if given — see `buildPushScenarioGameState`
 * for why a caller would want a different starting position) to
 * `state.gameOver`, driven ENTIRELY through `legalActions`/`applyAction` plus
 * a `RandomAgent` answering every mid-resolution decision — no Phaser, no
 * `BoardScene`, no scene of any kind. Deterministic: the same `seed` always
 * produces the exact same sequence of actions, dice, and outcomes (see
 * `engine/rng.ts`'s doc comment), so a failing seed is a complete,
 * reproducible repro on its own.
 *
 * Asserts invariants continuously (see `assertInvariants` et al. above),
 * throwing immediately and loudly the first time one is violated, including
 * — per plan.md §6.7 — a hard throw if `pendingDrifts` is ever non-empty:
 * elephants are excluded from `buildFuzzGameState()` specifically so this
 * can never legitimately happen; a violation means the exclusion itself has
 * broken, not that a drift needs handling.
 *
 * TERMINATION — read this before changing `turnCap`: with `legalActions`'
 * combat enumeration deliberately singleton-only (one attacker vs. one
 * defender — see its own doc comment in engine/actions.ts), most 1v1
 * match-ups land on a force ratio between roughly 1:2 and 3:1, and
 * `data/combatTable.ts`'s CRT gives EVERY die face on those columns an
 * AR/DR (retreat) result — no die roll at any of those ratios ever
 * eliminates a unit. Discovered empirically while building this harness: an
 * early version played purely to mutual elimination and reliably blew past
 * a turnCap of 500 (7,000+ actions) without ONE side ever running out of
 * units, because random 1v1 pairing overwhelmingly produces exactly those
 * ratios. Only a lopsided match-up (a phalanx against an archer, say) ever
 * reaches the CRT's eliminating columns.
 *
 * So this harness does NOT rely on mutual elimination as its main
 * termination path — it uses the rulebook's OWN other ending instead:
 * "on se fixera des temps limites pour la partie entière ... [et désigne
 * vainqueur] le joueur dont l'armée a la plus grande valeur"
 * (docs/research/05-rules-french-original.md:41) — a time/turn limit ends
 * the game, greatest army value wins. `turnManager.ts`'s
 * `endGameByTimeLimit` already implements exactly this (interestingly, it's
 * currently uncalled from `BoardScene` — nothing enforces a turn limit in
 * actual hotseat play today; worth flagging separately, out of scope here).
 * Reaching `turnCap` here calls it and reports `endedByTimeLimit: true`; it
 * is treated as a normal game ending, not a failure. `actionCap` remains a
 * SEPARATE, much higher hard stop purely against a genuine infinite loop
 * within a phase — it should never legitimately fire.
 */
export async function playRandomGame(seed: number, options: PlayRandomGameOptions = {}): Promise<HarnessStats> {
  const turnCap = options.turnCap ?? 7;
  const actionCap = options.actionCap ?? 20_000;

  const rng = createSeededRng(seed);
  const state = (options.buildInitialState ?? buildFuzzGameState)();
  const agent = buildSeatAgents(state, rng, options.createAgent);
  // The very first movement phase never goes through `applyAction`'s
  // `endPhase` case (nothing has ended yet to trigger a refill) — mirrors
  // how a fresh game reaches BoardScene with units already carrying their
  // full movement from placement (see PlacementScene.ts, which sets
  // `movementLeft: t.movement` directly). Do the same here rather than
  // leaning on `endPhase`'s refill for a turn that hasn't happened yet.
  resetMovementForActivePlayer(state);

  const initialSeatOrder = [...state.seatOrder];
  const context = emptyContext();
  const stats: HarnessStats = {
    seed,
    gameOver: false,
    winnerId: null,
    endedByTimeLimit: false,
    turnsReached: state.turnNumber,
    totalActions: 0,
    actionsByKind: {},
    landAttacksResolved: 0,
    combatResultCounts: {},
    ramsResolved: 0,
    ramHits: 0,
    boardingsResolved: 0,
    pushesResolved: 0,
    multiAttackerAttacks: 0,
  };

  assertInvariants(state, 'initial state');
  assertHardcodedTerrainRestrictions(state, 'initial state');

  while (!state.gameOver) {
    if (state.turnNumber > turnCap) {
      // A normal ending, not a failure — see this function's doc comment.
      endGameByTimeLimit(state);
      stats.endedByTimeLimit = true;
      break;
    }
    if (stats.totalActions > actionCap) {
      throw new Error(
        `playRandomGame(seed=${seed}): exceeded actionCap=${actionCap} without the game ending — looks like an infinite loop within a single turn`,
      );
    }

    const legal = legalActions(state, context);
    assertNoActionTargetsADeadUnit(state, legal);
    const action = agent.chooseNextAction(state, legal);
    assertChosenActionIsLegal(action, legal);
    options.trace?.push(formatAction(action));
    await applyOneAction(state, action, agent, rng, context, stats);

    stats.totalActions++;
    stats.actionsByKind[action.kind] = (stats.actionsByKind[action.kind] ?? 0) + 1;
    stats.turnsReached = Math.max(stats.turnsReached, state.turnNumber);
    assertInvariants(state, `after action #${stats.totalActions} (${action.kind})`);
    assertHardcodedTerrainRestrictions(state, `after action #${stats.totalActions} (${action.kind})`);
    assertTurnOrderPreserved(state, initialSeatOrder, `after action #${stats.totalActions} (${action.kind})`);
  }

  stats.gameOver = true;
  stats.winnerId = state.winnerId;
  return stats;
}

/**
 * One agent per seat, all sharing the game's single seeded `rng` (see
 * `PlayRandomGameOptions.createAgent`). With no factory this is the historical
 * behaviour exactly: one `RandomAgent`, used for every seat and every
 * mid-resolution question. Wrapped in a `SeatAgentRouter` either way so
 * there is one code path, not two.
 */
function buildSeatAgents(
  state: GameState,
  rng: () => number,
  createAgent?: (rng: () => number, seat: PlayerId) => DrivingAgent,
): DrivingAgent {
  const agents = new Map<PlayerId, DrivingAgent>();
  if (createAgent) {
    for (const seat of state.seatOrder) agents.set(seat, createAgent(rng, seat));
  } else {
    const shared = new RandomAgent(rng);
    for (const seat of state.seatOrder) agents.set(seat, shared);
  }
  return new SeatAgentRouter(agents);
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
      const wasCombatPhase = state.phase === 'combat';
      const previousIndex = state.activePlayerIndex;
      applyAction(state, action, rng);
      // Captured AFTER `applyAction`, deliberately. `advancePhase` marks any
      // player who just lost their last unit as eliminated and *then* runs its
      // skip loop against those updated flags — so a seat eliminated by this
      // very `endPhase` is skipped by `advancePhase` but would still be
      // *expected* by a pre-call snapshot, throwing a false positive. Since
      // `advancePhase` only ever adds eliminations, the post-call map is
      // exactly the input its own skip loop used. Latent at 2 seats (any
      // elimination ends the game, and the assert is gameOver-guarded), but
      // reachable as soon as the harness grows a third seat.
      const eliminatedAfter = new Map(state.players.map((p) => [p.id, p.eliminated] as const));
      // Mirrors BoardScene.endPhase exactly (BoardScene.ts:1736-1765): the
      // scene-local attack/ram bookkeeping lives outside GameState (see
      // engine/actions.ts's `ActionContext` doc comment) and isn't
      // `applyAction`'s responsibility to reset.
      context.attackedThisPhase.clear();
      if (!state.gameOver && state.phase === 'movement') {
        context.rammedThisTurn.clear();
        assertMovementWasRefilled(state, 'after endPhase into a fresh movement phase');
      }
      if (wasCombatPhase && !state.gameOver) {
        assertSeatAdvancedCorrectly(
          state.seatOrder,
          eliminatedAfter,
          previousIndex,
          state.activePlayerIndex,
          'after endPhase ended a combat phase',
        );
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
      if (action.attackerIds.length > 1) stats.multiAttackerAttacks++;
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
        await processRetreats(state, result.outcome.pendingRetreats, side, result.attackers, agent, stats);
      } else if (result.detail.result === 'DE' || result.detail.result === 'EX') {
        for (const hex of result.defenderOriginalHexes) {
          await processAdvanceOffer(state, hex, result.attackers, agent);
        }
      }
      return;
    }
  }
}
