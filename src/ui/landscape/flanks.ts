import { DIRECTIONS } from '../../engine/hex';
import type { TerrainType } from '../../data/terrain';

/**
 * For each `steep-flank` hex, the sides (0-5, in `DIRECTIONS` order) whose
 * neighbour is neither `plateau` nor `steep-flank`: the sides the slope faces
 * outward, where the Drawn view hatches it. A neighbour off the map counts
 * as lower ground. Keyed by `"q,r"`.
 */
export function flankSides(terrain: ReadonlyMap<string, TerrainType>): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const [key, type] of terrain) {
    if (type !== 'steep-flank') continue;
    const [q, r] = key.split(',').map(Number);
    const sides: number[] = [];
    DIRECTIONS.forEach((d, f) => {
      const n = terrain.get(`${q! + d.q},${r! + d.r}`);
      if (n !== 'plateau' && n !== 'steep-flank') sides.push(f);
    });
    result.set(key, sides);
  }
  return result;
}
