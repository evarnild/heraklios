import type { HexCoord } from '../data/map';
import { findRammingContacts, navalStateKey, reachableNavalHexes, searchNaval } from './navalMovement';
import { evaluateCharge, searchLand, straightLineDirection } from './movement';
import { hexAdd, hexDistance, hexKey } from './hex';
import type { GameState, Unit } from './state';

/**
 * The path a move takes, read from the position BEFORE the move is applied
 * (§66). The view draws a unit sliding along it; the rules do not use it. No
 * movement rule lives here: the land path is the one `searchLand` already
 * found the move's cost on (or `evaluateCharge`'s straight line for a
 * charge), the naval path the one `searchNaval` found.
 */

function parseKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q!, r: r! };
}

/**
 * The hexes a land unit walks to reach `to`: first step next to the unit's
 * position, last step `to`. A cavalry charge (`evaluateCharge` non-null) walks
 * the straight line, because that line, not the cheaper detour, is what the
 * move is charged for (`applyAction`'s `landMove`). Null when `to` is not a
 * legal destination.
 */
export function landMovePath(state: GameState, unit: Unit, to: HexCoord): HexCoord[] | null {
  if (evaluateCharge(state, unit, to) !== null) {
    const direction = straightLineDirection(unit.position, to)!;
    const steps: HexCoord[] = [];
    let current = unit.position;
    for (let i = hexDistance(unit.position, to); i > 0; i--) {
      current = hexAdd(current, direction);
      steps.push(current);
    }
    return steps;
  }
  const { reachable, parents } = searchLand(state, unit);
  const targetKey = hexKey(to);
  if (!reachable.has(targetKey)) return null;
  const startKey = hexKey(unit.position);
  const steps: HexCoord[] = [];
  for (let key: string | undefined = targetKey; key !== undefined && key !== startKey; key = parents.get(key)) {
    steps.push(parseKey(key));
  }
  return steps.reverse();
}

/** One state a ship passes through: a rotation in place or a bow-forward step. */
export interface NavalPathStep {
  hex: HexCoord;
  facing: number;
}

/**
 * The (hex, facing) states a ship passes through, after its starting one, to
 * end where `applyAction`'s `navalMove` ends for the same `to` and `facing`:
 * a ramming contact at `to` first (filtered by a pinned `facing`, cheapest
 * wins), else the cheapest state at `to`. Null when `to` is unreachable.
 */
export function navalMovePath(
  state: GameState,
  unit: Unit,
  to: HexCoord,
  facing?: number,
): NavalPathStep[] | null {
  const key = hexKey(to);
  const contact = findRammingContacts(state, unit)
    .filter((c) => hexKey(c.hex) === key)
    .filter((c) => facing === undefined || facing === c.facing)
    .sort((a, b) => a.cost - b.cost)[0];
  const final = contact
    ? { hex: contact.hex, facing: contact.facing }
    : (() => {
        const dest = reachableNavalHexes(state, unit).get(key);
        return dest ? { hex: to, facing: dest.facing } : null;
      })();
  if (!final) return null;
  return navalStatePath(state, unit, final);
}

/** The states leading to one reachable (hex, facing), after the starting one. */
export function navalStatePath(state: GameState, unit: Unit, final: NavalPathStep): NavalPathStep[] {
  const { parents } = searchNaval(state, unit);
  const startKey = navalStateKey(unit.position, unit.facing);
  const steps: NavalPathStep[] = [];
  for (
    let k: string | undefined = navalStateKey(final.hex, final.facing);
    k !== undefined && k !== startKey;
    k = parents.get(k)
  ) {
    const [hexPart, f] = k.split('|');
    steps.push({ hex: parseKey(hexPart!), facing: Number(f) });
  }
  return steps.reverse();
}
