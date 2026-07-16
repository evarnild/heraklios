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
