import { describe, expect, it } from 'vitest';
import { canvasSize } from './canvasSize';

describe('canvasSize (§88)', () => {
  it.each([
    [0, 1100],
    [800, 1100],
    [1100, 1100],
    [1100.9, 1100],
    [NaN, 1100],
    [1101, 1101],
    [1600.7, 1600],
    [3440, 3440],
  ])('width %s gives %s', (available, width) => {
    expect(canvasSize(available).width).toBe(width);
  });

  it('is always 750 tall', () => {
    for (const w of [0, 800, 1100, 1600, 3440]) expect(canvasSize(w).height).toBe(750);
  });
});
