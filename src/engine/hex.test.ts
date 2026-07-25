import { describe, it, expect } from 'vitest';
import {
  hexDistance,
  neighbors,
  traceLine,
  directionForDie,
  facingRotationCost,
  oppositeFacing,
  areFacingsParallel,
  facingToward,
  DIRECTIONS,
} from './hex';

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

describe('facing math', () => {
  it('costs 1 point per 60° step, capping a full reversal at 3', () => {
    expect(facingRotationCost(0, 0)).toBe(0);
    expect(facingRotationCost(0, 1)).toBe(1);
    expect(facingRotationCost(0, 5)).toBe(1);
    expect(facingRotationCost(0, 2)).toBe(2);
    expect(facingRotationCost(0, 3)).toBe(3);
    expect(facingRotationCost(1, 4)).toBe(3);
  });

  it('opposite facing is 3 steps around either way', () => {
    for (let f = 0; f < 6; f++) {
      expect(oppositeFacing(f)).toBe((f + 3) % 6);
      expect(facingRotationCost(f, oppositeFacing(f))).toBe(3);
    }
  });

  it('facings are parallel when identical or opposite, not otherwise', () => {
    expect(areFacingsParallel(0, 0)).toBe(true);
    expect(areFacingsParallel(0, 3)).toBe(true);
    expect(areFacingsParallel(0, 1)).toBe(false);
    expect(areFacingsParallel(0, 2)).toBe(false);
  });

  it('finds the facing that points from one hex directly at an adjacent one', () => {
    const origin = { q: 0, r: 0 };
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const neighbor = neighbors(origin)[i]!;
      expect(facingToward(origin, neighbor)).toBe(i);
    }
    expect(facingToward(origin, { q: 5, r: 5 })).toBeUndefined();
  });
});
