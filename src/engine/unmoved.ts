/**
 * §83: which units have not moved this phase, and which of them the
 * End-phase warning flags. §82 reuses `hasNotMoved`.
 */
import { legalActions, type ActionContext } from './actions';
import { unitType, type GameState, type Unit } from './state';

/**
 * B1/I1: a unit "has not moved" when it is alive and still has its type's
 * full printed allowance. Every movement-phase action lowers `movementLeft`
 * by at least 1 (a ship's rotation included, so a rotate-only ship HAS
 * moved), a charge spends the whole allowance (so `charged` adds nothing),
 * and an undo restores `movementLeft`. This is the same test
 * `evaluateCharge` uses (`movement.ts`: `unit.movementLeft !== fullAllowance`).
 */
export function hasNotMoved(unit: Unit): boolean {
  return !unit.destroyed && unit.movementLeft === unitType(unit).movement;
}

/**
 * B2/I2: the active player's units the End-phase warning flags, in
 * `state.units` order. A unit is flagged when it has not moved AND the
 * engine's own `legalActions` offers it something to do: as the `unitId` of
 * a move, swap, rotation or ram, or as the `otherId` of a swap (`legalActions`
 * lists a swap once, under the lower id, but it is a move for both units).
 * A unit with no legal action is not flagged: nothing was forgotten.
 * Empty outside the movement phase.
 */
export function unmovedUnits(state: GameState, context: ActionContext): Unit[] {
  if (state.phase !== 'movement') return [];
  const owner = state.seatOrder[state.activePlayerIndex]!;
  const canAct = new Set<string>();
  for (const action of legalActions(state, context)) {
    switch (action.kind) {
      case 'landMove':
      case 'navalMove':
      case 'navalRotate':
      case 'ram':
        canAct.add(action.unitId);
        break;
      case 'landSwap':
        canAct.add(action.unitId);
        canAct.add(action.otherId);
        break;
      default:
        break;
    }
  }
  return state.units.filter((u) => u.owner === owner && hasNotMoved(u) && canAct.has(u.id));
}
