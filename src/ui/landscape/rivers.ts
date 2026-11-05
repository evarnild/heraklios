import { HEX_SIZE } from '../hexRender';
import { sideEdge, sideFacing, vertexKey } from './geometry';
import type { Point, Segment } from './geometry';
import { hexNoise } from './variation';

export interface RiverPolyline {
  points: Point[];
  /** `keys[i]` is the hexside (`"q,r|q,r"`) of the segment `points[i] -> points[i + 1]`. */
  keys: string[];
}

/** The shared edge of a `RIVER_HEXSIDES` key: the two vertices common to both hexes. */
export function hexsideSegment(key: string): Segment {
  const [ka, kb] = key.split('|');
  const [aq, ar] = ka!.split(',').map(Number);
  const [bq, br] = kb!.split(',').map(Number);
  const a = { q: aq!, r: ar! };
  const f = sideFacing(a, { q: bq!, r: br! });
  if (f < 0) throw new Error(`hexsideSegment: ${key} is not a pair of adjacent hexes`);
  return sideEdge(a, f);
}

/**
 * Chains hexside edges that meet at a vertex of degree 2 into polylines. A
 * polyline ends at a vertex of degree 1 or of 3 or more (a fork); what is
 * left, all of degree 2, is a closed ring (first point repeated at the end).
 */
export function riverPolylines(hexsides: Iterable<string>): RiverPolyline[] {
  const edges: { key: string; seg: Segment; used: boolean }[] = [...hexsides].map((key) => ({
    key,
    seg: hexsideSegment(key),
    used: false,
  }));
  const at = new Map<string, number[]>();
  edges.forEach((e, i) => {
    for (const p of [e.seg.a, e.seg.b]) {
      const k = vertexKey(p);
      at.set(k, [...(at.get(k) ?? []), i]);
    }
  });
  const degree = (p: Point): number => at.get(vertexKey(p))?.length ?? 0;

  const walk = (first: number, from: Point): RiverPolyline => {
    const line: RiverPolyline = { points: [from], keys: [] };
    let idx: number | undefined = first;
    let here = from;
    while (idx !== undefined) {
      const e: { key: string; seg: Segment; used: boolean } = edges[idx]!;
      e.used = true;
      const forward: boolean = vertexKey(e.seg.a) === vertexKey(here);
      const to: Point = forward ? e.seg.b : e.seg.a;
      line.points.push(to);
      line.keys.push(e.key);
      here = to;
      idx = degree(to) === 2 ? at.get(vertexKey(to))!.find((j) => !edges[j]!.used) : undefined;
    }
    return line;
  };

  const lines: RiverPolyline[] = [];
  const begin = (pass: 'ends' | 'rings'): void => {
    edges.forEach((e, i) => {
      if (e.used) return;
      for (const p of [e.seg.a, e.seg.b]) {
        if (pass === 'ends' && degree(p) === 2) continue;
        lines.push(walk(i, p));
        return;
      }
    });
  };
  begin('ends');
  begin('rings');
  return lines;
}

/** Largest sideways wobble `meander` may add: a fraction of a hex. */
export const MEANDER_MAX = 0.12 * HEX_SIZE;

/**
 * Adds one sideways-offset midpoint per segment so a river bends instead of
 * running ruler-straight. The offset is at most `min(amplitude, MEANDER_MAX)`
 * and is seeded by the segment's own coordinates, so it is the same on every
 * load. The original points, end points included, are untouched.
 */
export function meander(points: readonly Point[], amplitude = MEANDER_MAX): Point[] {
  const amp = Math.min(amplitude, MEANDER_MAX);
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    out.push(a);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const offset = (hexNoise(Math.round(mx * 10), Math.round(my * 10), 7) * 2 - 1) * amp;
    out.push({ x: mx - ((b.y - a.y) / len) * offset, y: my + ((b.x - a.x) / len) * offset });
  }
  if (points.length > 0) out.push(points[points.length - 1]!);
  return out;
}
