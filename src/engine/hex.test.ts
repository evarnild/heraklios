import { describe, it, expect } from 'vitest';
import { hexDistance, neighbors, traceLine, directionForDie } from './hex';

describe('hex math', () => {
  it('computes distance 1 for adjacent hexes', () => {
    const origin = { q: 0, r: 0 };
    for (const n of neighbors(origin)) {
      expect(hexDistance(origin, n)).toBe(1);
    }
  });

  it('traces a straight line for N steps', () => {
    const origin = { q: 0, r: 0 };
    const dir = directionForDie(1);
    const path = traceLine(origin, dir, 4);
    expect(path).toHaveLength(4);
    expect(hexDistance(origin, path[3]!)).toBe(4);
  });

  it('wraps die rolls to one of the 6 directions', () => {
    const d1 = directionForDie(1);
    const d7 = directionForDie(7);
    expect(d7).toEqual(d1);
  });
});
