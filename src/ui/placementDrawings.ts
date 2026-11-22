import type { HexCoord } from '../data/map';
import { getUnitType } from '../data/units';
import type { GameState } from '../engine/state';
import type { FacingShip, UnitDrawing } from './boardView';

/**
 * What Placement draws: every living unit in state (other seats' dimmed) and
 * every placed ship's facing arrow plus the staged ghost.
 *
 * The rules hide nothing (`docs/research/05-rules-french-original.md:91-96`:
 * the 4-hex gap is measured from the other armies, so each army is placed in
 * relation to them); that Placement used to draw only the placing seat's own
 * units was the scene's choice, not a rule.
 *
 * I3 (spec 76): "not owned by the placing seat" means "an earlier seat".
 * Placement and `skipAiPlacementSeats` both run in seat-index order, and the
 * scene's `enemyHexes` uses the same test.
 *
 * I2 (spec 76): an earlier unit's hex is kept out of the green band by the
 * 4-hex gap. In the boxed-in fallback (`deployment.ts`) the band may include
 * it; `tryPlace` and `deployUnit` still refuse an occupied hex. Occupied hexes
 * are not taken out of the highlight, which would un-green the seat's own
 * placed units.
 */

/** One drawing per living unit, in state order; another seat's is `dimmed`. */
export function placementUnitDrawings(state: GameState, playerIndex: number): UnitDrawing[] {
  return state.units
    .filter((u) => !u.destroyed)
    .map((u) => {
      const drawing: UnitDrawing = {
        id: u.id,
        typeId: u.typeId,
        owner: u.owner,
        position: u.position,
        facing: getUnitType(u.typeId).domain === 'naval' ? u.facing : undefined,
      };
      if (u.owner !== playerIndex) drawing.dimmed = true;
      return drawing;
    });
}

/** What `PlacementScene.pendingShip` holds: a staged, not yet placed ship. */
export interface PendingShip {
  hex: HexCoord;
  facing: number;
  typeId: string;
}

/**
 * The Standard view's facing arrows: every living ship of every seat (another
 * seat's dimmed), then the staged ship, if any, as the ghost (never dimmed).
 */
export function placementFacingShips(
  state: GameState,
  playerIndex: number,
  pending: PendingShip | null,
): FacingShip[] {
  const ships: FacingShip[] = [];
  for (const u of state.units) {
    if (u.destroyed || getUnitType(u.typeId).domain !== 'naval') continue;
    const ship: FacingShip = { hex: u.position, facing: u.facing, playerIndex: u.owner };
    if (u.owner !== playerIndex) ship.dimmed = true;
    ships.push(ship);
  }
  if (pending) ships.push({ hex: pending.hex, facing: pending.facing, playerIndex, ghostTypeId: pending.typeId });
  return ships;
}
