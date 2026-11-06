import { describe, expect, it } from 'vitest';
import { MAP_TERRAIN } from '../../data/map';
import type { TerrainType } from '../../data/terrain';
import { flankSides } from './flanks';

describe('flankSides', () => {
  it('lists exactly the sides facing lower ground', () => {
    const map = new Map<string, TerrainType>([
      ['0,0', 'plateau'],
      ['1,0', 'steep-flank'],
      ['2,0', 'steep-flank'],
      ['1,1', 'plain'],
    ]);
    // (1,0): side 3 faces (0,0) plateau and side 0 faces (2,0) flank; the rest are lower or off the map.
    expect(flankSides(map).get('1,0')).toEqual([1, 2, 4, 5]);
    // (2,0): side 3 faces (1,0), a flank, so it is not an outward side.
    expect(flankSides(map).get('2,0')).toEqual([0, 1, 2, 4, 5]);
    expect([...flankSides(map).keys()].sort()).toEqual(['1,0', '2,0']);
  });

  it('gives most flanks on the real map at least one side', () => {
    // A flank walled in by plateau and flank (30,-2 is one) has nothing to hatch,
    // so "at least one side" holds for most flanks, not for all.
    const flanks = flankSides(MAP_TERRAIN);
    const withSides = [...flanks.values()].filter((s) => s.length > 0).length;
    expect(flanks.size).toBeGreaterThan(0);
    expect(withSides).toBeGreaterThan(flanks.size / 2);
    expect(flanks.get('30,-2')).toEqual([]);
  });
});
