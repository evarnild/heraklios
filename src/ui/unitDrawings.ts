import type { ActionContext } from '../engine/actions';
import { unitType, type GameState, type Unit } from '../engine/state';
import { unitStatuses } from '../engine/unitStatus';
import type { FacingShip, UnitDrawing } from './boardView';

/** A ship carries a facing (its counter's arrow, its figure's heading); a land unit doesn't. */
export function isShip(u: Unit): boolean {
  return unitType(u).domain === 'naval';
}

/** One unit as any scene draws it, before the scene's own flags (dimmed, phase marker). */
export function drawingOf(u: Unit): UnitDrawing {
  return { id: u.id, typeId: u.typeId, owner: u.owner, position: u.position, facing: isShip(u) ? u.facing : undefined };
}

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
    const mark = statuses.get(u.id);
    const drawing = drawingOf(u);
    if (mark?.activity) drawing.status = mark.activity;
    if (mark?.charged) drawing.charged = true;
    drawings.push(drawing);
    if (isShip(u)) ships.push({ hex: u.position, facing: u.facing, playerIndex: u.owner });
  }
  return { drawings, ships };
}
