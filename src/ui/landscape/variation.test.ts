import { describe, expect, it } from 'vitest';
import { hexNoise } from './variation';

describe('hexNoise', () => {
  it('gives the same value for the same inputs', () => {
    expect(hexNoise(3, 4, 5)).toBe(hexNoise(3, 4, 5));
  });

  it('stays in [0, 1)', () => {
    for (let q = -20; q < 40; q++) {
      for (let r = -20; r < 40; r++) {
        const v = hexNoise(q, r, 1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('differs between neighbours, axes and salts', () => {
    expect(hexNoise(3, 4)).not.toBe(hexNoise(4, 4));
    expect(hexNoise(3, 4)).not.toBe(hexNoise(3, 5));
    expect(hexNoise(3, 4)).not.toBe(hexNoise(4, 3));
    expect(hexNoise(3, 4, 1)).not.toBe(hexNoise(3, 4, 2));
    const distinct = new Set<number>();
    for (let q = 0; q < 10; q++) distinct.add(hexNoise(q, 0));
    expect(distinct.size).toBe(10);
  });
});
