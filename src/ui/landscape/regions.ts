import type { HexCoord } from '../../data/map';
import { DIRECTIONS } from '../../engine/hex';
import { sideEdge, vertexKey } from './geometry';
import type { Point } from './geometry';

/**
 * Closed loops that outline a set of hexes: the hex edges between a member
 * and a non-member (a hex outside `members`, or off the map), chained by
 * vertex. Every edge is walked in the hexagon vertex order, so the region is
 * always on the same side: outer boundaries and holes wind in opposite
 * directions, and an even-odd point-in-polygon test over all the loops
 * answers "is this point inside the region".
 *
 * A flat-top hex vertex is shared by exactly three hexes, so at most one
 * boundary edge leaves and one enters it: the chaining is never ambiguous.
 */
export function regionLoops(members: readonly HexCoord[]): Point[][] {
  const inSet = new Set(members.map((h) => `${h.q},${h.r}`));
  const next = new Map<string, { to: string; from: Point }>();
  for (const hex of members) {
    DIRECTIONS.forEach((d, f) => {
      if (inSet.has(`${hex.q + d.q},${hex.r + d.r}`)) return;
      const { a, b } = sideEdge(hex, f);
      next.set(vertexKey(a), { to: vertexKey(b), from: a });
    });
  }
  const loops: Point[][] = [];
  const done = new Set<string>();
  for (const start of next.keys()) {
    if (done.has(start)) continue;
    const loop: Point[] = [];
    let key = start;
    while (!done.has(key)) {
      done.add(key);
      const edge = next.get(key);
      if (!edge) break;
      loop.push(edge.from);
      key = edge.to;
    }
    loops.push(loop);
  }
  return loops;
}

/** Even-odd test of `p` against every loop together. */
export function insideLoops(p: Point, loops: readonly (readonly Point[])[]): boolean {
  let inside = false;
  for (const loop of loops) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!;
      const b = loop[j]!;
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
  }
  return inside;
}
