import { MAP_TERRAIN, hexKey, type HexCoord } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import { defaultArmySelection, type ArmySelection } from '../engine/army';
import { unitCategory } from '../engine/movement';
import { isAiSeat } from '../engine/seatControl';
import { maxEquipmentPointsForType, type GameState, type Unit } from '../engine/state';
import { legalDeploymentHexes, legalNavalDeploymentHexes } from './mapBounds';
import { seatControlFor, session } from './session';

/**
 * Setup for the seats a human never touches (plan.md §6.4's Stage 4).
 *
 * `ArmyBuilderScene` and `PlacementScene` are both per-seat scenes reached by
 * `scene.start(..., { playerIndex })`, so "skip the AI seats" is a question
 * about which index to start NEXT, not something either scene can answer from
 * inside itself. Both helpers below therefore do the AI seats' work and hand
 * back the next seat that actually needs a human — deliberately resolved at
 * the transition rather than by having a scene restart itself from its own
 * `create()`.
 */

/** Every unit an army selection contains, one entry per individual unit, in
 * the selection's own order (land units first only insofar as the selection
 * lists them first — nothing here depends on the order). */
function unitsOf(selection: ArmySelection): string[] {
  const list: string[] = [];
  for (const [typeId, count] of Object.entries(selection)) {
    for (let i = 0; i < (count ?? 0); i++) list.push(typeId);
  }
  return list;
}

/**
 * Fills in every AI seat's army from `fromIndex` onward with the same
 * ready-made 400-point selection the Army Builder's own "default army" button
 * offers, and returns the first seat from `fromIndex` on that still needs a
 * human — or `null` when every remaining seat is an AI.
 *
 * The default army rather than something bespoke: it's already a legal,
 * balanced 400-point purchase (`engine/army.ts`), it's what the AI was
 * measured against in the fuzz soaks, and giving the computer a *different*
 * army from the one a hurried human picks would quietly make difficulty
 * comparisons mean something else.
 */
export function skipAiArmySeats(fromIndex: number): number | null {
  for (let i = fromIndex; i < session.playerCount; i++) {
    if (!isAiSeat(seatControlFor(i))) return i;
    session.armySelections[i] = defaultArmySelection();
  }
  return null;
}

/**
 * Deploys one seat's whole army onto legal hexes in its own deployment zone,
 * exactly as `PlacementScene.tryPlace`/`confirmPendingShip` would if a human
 * had clicked each hex — same `p<seat>u<n>` id scheme, same `Unit` fields,
 * same terrain rule (`canEnterTerrain`, so no cavalry parked on a marsh),
 * same "one unit per hex" and "keep clear of other armies" constraints
 * (`legalDeploymentHexes`' `minGap`).
 *
 * Placement is random within the legal set rather than positional: a fixed
 * pattern would make every AI game open identically, and the zone's shape
 * already does the useful work of keeping the army together. Ship facing is
 * random too — a ship's facing only matters for ramming geometry, which
 * nothing at deployment time can predict.
 *
 * Throws if the zone runs out of room before the army is placed, rather than
 * silently deploying a short army: that would hand the human a free win and
 * look like a rules bug from the board.
 */
export function autoPlaceSeat(state: GameState, playerIndex: number, rng: () => number = Math.random): void {
  const player = state.players[playerIndex]!;
  const enemyHexes = state.units.filter((u) => u.owner !== playerIndex).map((u) => u.position);
  const landHexes = legalDeploymentHexes(player.edge, enemyHexes);
  const seaHexes = legalNavalDeploymentHexes(player.edge, enemyHexes);
  const taken = new Set(state.units.filter((u) => !u.destroyed).map((u) => hexKey(u.position.q, u.position.r)));

  const pick = (candidates: HexCoord[]): HexCoord => {
    const free = candidates.filter((h) => !taken.has(hexKey(h.q, h.r)));
    if (free.length === 0) {
      throw new Error(`autoPlaceSeat: seat ${playerIndex} has no legal hex left to deploy on`);
    }
    return free[Math.floor(rng() * free.length)]!;
  };

  let counter = 0;
  for (const typeId of unitsOf(session.armySelections[playerIndex] ?? {})) {
    const type = getUnitType(typeId);
    const naval = type.domain === 'naval';
    const candidates = naval
      ? seaHexes
      : landHexes.filter((h) => {
          const terrain = MAP_TERRAIN.get(hexKey(h.q, h.r));
          return terrain !== undefined && canEnterTerrain(terrain, unitCategory(typeId));
        });
    const hex = pick(candidates);
    taken.add(hexKey(hex.q, hex.r));
    const unit: Unit = {
      id: `p${playerIndex}u${counter++}`,
      owner: playerIndex as 0 | 1 | 2 | 3,
      typeId,
      position: hex,
      movementLeft: type.movement,
      facing: naval ? Math.floor(rng() * 6) : 0,
      equipmentPoints: naval ? maxEquipmentPointsForType(type) : undefined,
      defendedThisPhase: false,
      charged: false,
      destroyed: false,
    };
    state.units.push(unit);
  }
}

/**
 * Deploys every AI seat from `fromIndex` onward and returns the first seat
 * that still needs a human to place its army — or `null` when none do (in
 * which case the caller goes straight to the Board).
 *
 * `state` must already exist: `PlacementScene.create` is what builds it, on
 * seat 0's pass, so a caller reaching here before that has to create it
 * first (see `MenuScene`/`ArmyBuilderScene`'s hand-off).
 */
export function skipAiPlacementSeats(
  state: GameState,
  fromIndex: number,
  rng: () => number = Math.random,
): number | null {
  for (let i = fromIndex; i < session.playerCount; i++) {
    if (!isAiSeat(seatControlFor(i))) return i;
    autoPlaceSeat(state, i, rng);
  }
  return null;
}
