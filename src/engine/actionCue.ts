import type { HexCoord } from '../data/map';
import type { Action, ActionResult } from './actions';
import { DIRECTIONS, hexAdd, hexDistance } from './hex';
import { landMovePath, navalMovePath } from './movePath';
import { findRammingContacts } from './navalMovement';
import type { GameState, Unit } from './state';

/**
 * What a view needs to know about an action beyond the two drawings it moves
 * between (§66): the path a unit took (a drawing only has the end hex), who
 * clashes toward which hex, and which surviving ship shakes (a drawing does not
 * carry a ram or boarding result). Pure data derived from the rules and the
 * result; no scene re-derives any of it (spec I1). The view animates the
 * difference between successive committed drawings in commit order; a cue only
 * adds this missing detail.
 */

/** One step of a move: the hex entered and, for a ship, the facing after it. */
export interface CueStep {
  hex: HexCoord;
  facing?: number;
}

export interface MoveCue {
  unitId: string;
  /** In order, after the starting position. A rotation in place repeats the hex. */
  steps: CueStep[];
}

export interface ClashCue {
  unitId: string;
  /** The hex the unit lunges toward and back from. */
  toward: HexCoord;
  kind: 'clash' | 'ram';
}

export interface ActionCue {
  moves: MoveCue[];
  clashes: ClashCue[];
  /** Surviving ships that shake once the result shows (`completeCue`). */
  shakes: string[];
}

function emptyCue(): ActionCue {
  return { moves: [], clashes: [], shakes: [] };
}

function unitById(state: GameState, id: string): Unit | undefined {
  return state.units.find((u) => u.id === id && !u.destroyed);
}

/** The defender hex nearest `from`; ties go to the earlier defender. */
function nearestHex(from: HexCoord, defenders: readonly Unit[]): HexCoord {
  let best = defenders[0]!.position;
  for (const d of defenders) {
    if (hexDistance(from, d.position) < hexDistance(from, best)) best = d.position;
  }
  return best;
}

function moveCue(state: GameState, action: Extract<Action, { kind: 'landMove' | 'navalMove' }>): ActionCue | null {
  const unit = unitById(state, action.unitId);
  if (!unit) return null;
  if (action.kind === 'landMove') {
    const path = landMovePath(state, unit, action.to);
    return path ? { ...emptyCue(), moves: [{ unitId: unit.id, steps: path.map((hex) => ({ hex })) }] } : null;
  }
  const path = navalMovePath(state, unit, action.to, action.facing);
  return path ? { ...emptyCue(), moves: [{ unitId: unit.id, steps: path }] } : null;
}

/**
 * The cue for `action`, from the state BEFORE it is applied (paths and the
 * ram target are read from the pre-move position). Null for `endPhase` and for
 * an action the state would reject. Interpretation (spec B2): the engine has no
 * per-attacker pairing in a combined attack, so each attacker lunges toward the
 * nearest defender hex, ties by defender order.
 */
export function cueBeforeAction(state: GameState, action: Action): ActionCue | null {
  switch (action.kind) {
    case 'endPhase':
      return null;
    case 'landMove':
    case 'navalMove':
      return moveCue(state, action);
    case 'landSwap': {
      const a = unitById(state, action.unitId);
      const b = unitById(state, action.otherId);
      if (!a || !b) return null;
      return {
        ...emptyCue(),
        moves: [
          { unitId: a.id, steps: [{ hex: b.position }] },
          { unitId: b.id, steps: [{ hex: a.position }] },
        ],
      };
    }
    case 'navalRotate': {
      const ship = unitById(state, action.unitId);
      if (!ship) return null;
      const facing = (ship.facing + action.direction + 6) % 6;
      return { ...emptyCue(), moves: [{ unitId: ship.id, steps: [{ hex: ship.position, facing }] }] };
    }
    case 'ram': {
      const ship = unitById(state, action.unitId);
      if (!ship) return null;
      const contact = findRammingContacts(state, ship).find((c) => c.cost === 0);
      const toward = contact ? contact.target.position : hexAdd(ship.position, DIRECTIONS[ship.facing]!);
      return { ...emptyCue(), clashes: [{ unitId: ship.id, toward, kind: 'ram' }] };
    }
    case 'landAttack': {
      const attackers = action.attackerIds.map((id) => unitById(state, id)).filter((u): u is Unit => !!u);
      const defenders = action.defenderIds.map((id) => unitById(state, id)).filter((u): u is Unit => !!u);
      if (attackers.length === 0 || defenders.length === 0) return null;
      const clashes = attackers.map((u): ClashCue => ({ unitId: u.id, toward: nearestHex(u.position, defenders), kind: 'clash' }));
      return { ...emptyCue(), clashes };
    }
    case 'board': {
      const attacker = unitById(state, action.attackerId);
      const defender = unitById(state, action.defenderId);
      if (!attacker || !defender) return null;
      return {
        ...emptyCue(),
        clashes: [
          { unitId: attacker.id, toward: defender.position, kind: 'clash' },
          { unitId: defender.id, toward: attacker.position, kind: 'clash' },
        ],
      };
    }
  }
}

/**
 * Adds the result-dependent part: a ram that misses shakes the target; a
 * boarding shakes the ship that lost equipment and survived (a ship at zero
 * fades instead, and an undecided boarding shakes nobody). Other results
 * leave the cue as it was.
 */
export function completeCue(cue: ActionCue, result: ActionResult): ActionCue {
  if (result.kind === 'ram') {
    return result.hit ? cue : { ...cue, shakes: [result.defender.id] };
  }
  if (result.kind === 'board') {
    const { side, equipmentLoss } = result.result;
    if (side === null || equipmentLoss <= 0) return cue;
    const victim = side === 'attacker' ? result.attacker : result.defender;
    return victim.destroyed ? cue : { ...cue, shakes: [victim.id] };
  }
  return cue;
}

/** A drift beat that enters a hex: the elephant slides one hex (`DriftHooks.onDriftMoved`). */
export function driftMoveCue(elephantId: string, hex: HexCoord): ActionCue {
  return { ...emptyCue(), moves: [{ unitId: elephantId, steps: [{ hex }] }] };
}

/** A trample: the elephant lunges at the occupant's hex (`DriftHooks.onCombat`). */
export function driftClashCue(elephantId: string, hex: HexCoord): ActionCue {
  return { ...emptyCue(), clashes: [{ unitId: elephantId, toward: hex, kind: 'clash' }] };
}
