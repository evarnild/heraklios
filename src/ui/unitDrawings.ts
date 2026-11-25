import type { ActionContext } from '../engine/actions';
import { unitType, type GameState } from '../engine/state';
import { unitStatuses } from '../engine/unitStatus';
import type { FacingShip, UnitDrawing } from './boardView';

/**
 * What the board draws for a game state (§82): one drawing per living unit,
 * each carrying the engine's phase marker (`unitStatuses`, asked once per
 * call), plus the ships' facing list. The scene never works a status out
 * itself (B12); `context` is the attacked/rammed bookkeeping it already holds.
 */
export function buildUnitDrawings(
  state: GameState,
  context: ActionContext,
): { drawings: UnitDrawing[]; ships: FacingShip[] } {
  const statuses = unitStatuses(state, context);
  const ships: FacingShip[] = [];
  const drawings: UnitDrawing[] = [];
  for (const u of state.units) {
    if (u.destroyed) continue;
    const naval = unitType(u).domain === 'naval';
    const mark = statuses.get(u.id);
    const drawing: UnitDrawing = { id: u.id, typeId: u.typeId, owner: u.owner, position: u.position, facing: naval ? u.facing : undefined };
    if (mark?.activity) drawing.status = mark.activity;
    if (mark?.charged) drawing.charged = true;
    drawings.push(drawing);
    if (naval) ships.push({ hex: u.position, facing: u.facing, playerIndex: u.owner });
  }
  return { drawings, ships };
}
