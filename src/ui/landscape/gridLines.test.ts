import { describe, expect, it } from 'vitest';
import { gridSegments } from './gridLines';

describe('gridSegments', () => {
  it('draws one hex as 6 edges', () => {
    expect(gridSegments([{ q: 0, r: 0 }])).toHaveLength(6);
  });

  it('draws two adjacent hexes as 11 edges, not 12', () => {
    expect(
      gridSegments([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ]),
    ).toHaveLength(11);
  });

  it('keeps the edges of two distant hexes apart', () => {
    expect(
      gridSegments([
        { q: 0, r: 0 },
        { q: 5, r: 0 },
      ]),
    ).toHaveLength(12);
  });
});
