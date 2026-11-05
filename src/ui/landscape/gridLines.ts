import type { HexCoord } from '../../data/map';
import { DIRECTIONS } from '../../engine/hex';
import { sideEdge, vertexKey } from './geometry';
import type { Segment } from './geometry';

/** Every edge of the given hexes exactly once (a shared edge is not drawn twice). */
export function gridSegments(hexes: readonly HexCoord[]): Segment[] {
  const seen = new Set<string>();
  const out: Segment[] = [];
  for (const hex of hexes) {
    DIRECTIONS.forEach((_d, f) => {
      const seg = sideEdge(hex, f);
      const ka = vertexKey(seg.a);
      const kb = vertexKey(seg.b);
      const key = ka < kb ? `${ka}~${kb}` : `${kb}~${ka}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(seg);
    });
  }
  return out;
}
