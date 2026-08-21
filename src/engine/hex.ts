import type { HexCoord } from '../data/map';

// Flat-top hex, axial coordinates (q, r). The six directions are numbered
// 1-6 to match the d6 used for elephant stampede / ramming-direction rolls
// in the original rules (the exact compass mapping is arbitrary, only
// internal consistency matters).
const DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function directionForDie(dieRoll: number): HexCoord {
  const index = ((dieRoll - 1) % 6 + 6) % 6;
  return DIRECTIONS[index]!;
}

/** Minimum number of 60° steps between two facings (0-5) — the rulebook
 * charges 1 movement point per 60° turn regardless of direction, so a
 * 180° reversal costs 3 (the maximum possible distance around the hex). */
export function facingRotationCost(from: number, to: number): number {
  const diff = Math.abs(from - to) % 6;
  return Math.min(diff, 6 - diff);
}

/** The facing directly opposite `facing` (180°, i.e. 3 steps around). */
export function oppositeFacing(facing: number): number {
  return (facing + 3) % 6;
}

/** True if two ships' facings run along the same line of travel — either
 * identical or exactly opposite — which is the rulebook's "parallèlement"
 * requirement for boarding (as opposed to one ship's bow pointing at the
 * other, which is a ramming angle, not a boarding one). */
export function areFacingsParallel(a: number, b: number): boolean {
  return a === b || a === oppositeFacing(b);
}

/** The facing (0-5) a ship at `from` would need to have its bow pointed
 * directly at the adjacent hex `to`, or `undefined` if they aren't adjacent. */
export function facingToward(from: HexCoord, to: HexCoord): number | undefined {
  const index = DIRECTIONS.findIndex((d) => hexEquals(hexAdd(from, d), to));
  return index === -1 ? undefined : index;
}

/**
 * The facing index (0-5, same numbering as `directionForDie`/`DIRECTIONS`)
 * for one of the six unit direction vectors itself, rather than for a pair of
 * hexes — used to draw an elephant's drift-direction arrow (plan.md §21) from
 * the `direction: HexCoord` a `DriftEvent` already carries, with
 * `drawFacingArrowhead` (`ui/MapView.ts`), the same primitive naval facing
 * indicators use. Throws on a non-direction vector rather than returning
 * `undefined` like `facingToward` does for "not adjacent" — every direction
 * this is ever called with comes from `directionForDie`, so a mismatch here
 * would be a programming error, not a legitimate "no answer" case.
 */
export function facingForDirection(direction: HexCoord): number {
  const index = DIRECTIONS.findIndex((d) => hexEquals(d, direction));
  if (index === -1) throw new Error(`facingForDirection: ${JSON.stringify(direction)} is not one of DIRECTIONS`);
  return index;
}

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function neighbors(hex: HexCoord): HexCoord[] {
  return DIRECTIONS.map((d) => hexAdd(hex, d));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Traces a straight line of hexes from `start` in the given direction, for `steps` hexes (not including start). */
export function traceLine(start: HexCoord, direction: HexCoord, steps: number): HexCoord[] {
  const path: HexCoord[] = [];
  let current = start;
  for (let i = 0; i < steps; i++) {
    current = hexAdd(current, direction);
    path.push(current);
  }
  return path;
}

export { DIRECTIONS };
