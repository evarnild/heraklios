import { describe, it, expect } from 'vitest';
import { rollDie } from './dice';

describe('rollDie', () => {
  it('maps the bottom of the [0,1) range to a 1', () => {
    expect(rollDie(() => 0)).toBe(1);
  });

  it('maps just under the top of the [0,1) range to a 6', () => {
    expect(rollDie(() => 0.9999999)).toBe(6);
  });

  it('is deterministic for a given rng', () => {
    const sequence = [0.1, 0.5, 0.83];
    let i = 0;
    const rng = () => sequence[i++]!;
    let j = 0;
    const rng2 = () => sequence[j++]!;
    expect([rollDie(rng), rollDie(rng), rollDie(rng)]).toEqual([rollDie(rng2), rollDie(rng2), rollDie(rng2)]);
  });

  it('defaults to Math.random when no rng is supplied, always landing in [1,6]', () => {
    for (let i = 0; i < 50; i++) {
      const roll = rollDie();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });
});
