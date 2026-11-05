import { describe, expect, it } from 'vitest';
import { smoothLoop, smoothPolyline } from './smoothing';

const square = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

describe('smoothLoop', () => {
  it('cuts a square once into the 8 known Chaikin points', () => {
    expect(smoothLoop(square, 1)).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 1, y: 4 },
      { x: 0, y: 3 },
      { x: 0, y: 1 },
    ]);
  });

  it('doubles the point count per iteration', () => {
    expect(smoothLoop(square, 0)).toHaveLength(4);
    expect(smoothLoop(square, 2)).toHaveLength(16);
    expect(smoothLoop(square, 3)).toHaveLength(32);
  });
});

describe('smoothPolyline', () => {
  it('keeps the end points and cuts the corner', () => {
    const out = smoothPolyline(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ],
      1,
    );
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
    ]);
  });
});
