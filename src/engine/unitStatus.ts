/**
 * §82: what each unit's phase marker says. A view-only reading of the state:
 * no rule, no `GameState` field, nothing mutated.
 */
import { legalActions, type ActionContext } from './actions';
import { unitCategory, unitType, type GameState, type Unit } from './state';
import { hasNotMoved } from './unmoved';

export type UnitActivity = 'notMoved' | 'partlyMoved' | 'done' | 'canAttack' | 'hasAttacked' | 'beenAttacked';

/** One unit's marker: at most one activity, plus the cavalry charge flag. At least one is set. */
export interface UnitStatus {
  activity?: UnitActivity;
  charged?: true;
}

function movementActivity(unit: Unit): UnitActivity {
  // I1: read on `movementLeft` against the printed movement. `done` is
  // checked first, so a unit with a printed 0 reads `done`.
  if (unit.movementLeft === 0) return 'done';
  return hasNotMoved(unit) ? 'notMoved' : 'partlyMoved';
}

/** The units that are the single attacker of a legal land attack or boarding. */
function attackers(state: GameState, context: ActionContext): Set<string> {
  const ids = new Set<string>();
  for (const action of legalActions(state, context)) {
    if (action.kind === 'landAttack') ids.add(action.attackerIds[0]!);
    else if (action.kind === 'board') ids.add(action.attackerId);
  }
  return ids;
}

/**
 * Each living unit's status for the current phase, by unit id; a unit with
 * none is absent. Empty outside the movement and combat phases.
 *
 * Interpretations (spec §82):
 * - I1: "partly moved" / "done" are `movementLeft` against the printed
 *   movement; a ship that only turned has spent points. `hasNotMoved` is §83's.
 * - I2: `notMoved` is the plain fact, NOT filtered by "has a legal move": a
 *   unit boxed in by ZOC keeps it (§83's warning filters; this marker doesn't).
 * - I3: a ship in `rammedThisTurn` reads `hasAttacked` in combat: the engine
 *   refuses its boarding that turn.
 * - I4: `beenAttacked` (`defendedThisPhase`) shows only in the combat phase;
 *   the flag is reset only when a combat phase starts, so in movement it is a
 *   previous phase's fact.
 * - I5: the charge flag shows in movement and in combat (it doubles the
 *   attack until the owner's next movement phase).
 * - I6: `canAttack` means the unit has at least one legal single attack in
 *   `legalActions`; a unit that can only join a combined attack still has one.
 * `legalActions` is called only in the combat phase.
 */
export function unitStatuses(state: GameState, context: ActionContext): Map<string, UnitStatus> {
  const out = new Map<string, UnitStatus>();
  if (state.phase !== 'movement' && state.phase !== 'combat') return out;
  const active = state.seatOrder[state.activePlayerIndex];
  const combat = state.phase === 'combat';
  const canAttack = combat ? attackers(state, context) : new Set<string>();
  for (const u of state.units) {
    if (u.destroyed) continue;
    const status: UnitStatus = {};
    if (u.charged && unitCategory(u.typeId) === 'cavalry') status.charged = true;
    if (u.owner === active) {
      if (!combat) status.activity = movementActivity(u);
      else if (
        context.attackedThisPhase?.has(u.id) ||
        (unitType(u).domain === 'naval' && context.rammedThisTurn?.has(u.id))
      ) {
        status.activity = 'hasAttacked';
      } else if (canAttack.has(u.id)) status.activity = 'canAttack';
    }
    if (combat && u.defendedThisPhase) status.activity = 'beenAttacked';
    if (status.activity !== undefined || status.charged) out.set(u.id, status);
  }
  return out;
}
