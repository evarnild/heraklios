import type { HexCoord } from '../../data/map';
import { DIRECTIONS } from '../../engine/hex';
import { HEX_SIZE, hexToPixel } from '../hexRender';

/** A point in `hexToPixel` space (the board's own pixel space, before the screen origin). */
export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

/** Vertex `i` (0-5) of a flat-top hex, at `60 * i` degrees (as `hexPolygonPoints`). */
export function hexVertex(hex: HexCoord, i: number): Point {
  const c = hexToPixel(hex);
  const angle = (Math.PI / 180) * (60 * i);
  return { x: c.x + HEX_SIZE * Math.cos(angle), y: c.y + HEX_SIZE * Math.sin(angle) };
}

/** The two vertex indices of the edge on side `f` (the side facing `DIRECTIONS[f]`).
 * Neighbour `f` lies at screen angle `30 - 60 f` degrees (`facingAngleRad`), the
 * midpoint of the edge between the vertices at `-60 f` and `-60 f + 60` degrees. */
export function sideVertexIndices(f: number): [number, number] {
  return [(6 - (f % 6)) % 6, (7 - (f % 6)) % 6];
}

/** The edge on side `f` of `hex`. */
export function sideEdge(hex: HexCoord, f: number): Segment {
  const [i, j] = sideVertexIndices(f);
  return { a: hexVertex(hex, i), b: hexVertex(hex, j) };
}

/** Vertex identity: coordinates rounded to 0.01 px, so the same corner reached
 * from three hexes is one key despite floating-point noise. */
export function vertexKey(p: Point): string {
  return `${Math.round(p.x * 100)}|${Math.round(p.y * 100)}`;
}

/** The side of `a` that faces `b`, or -1 when they are not adjacent. */
export function sideFacing(a: HexCoord, b: HexCoord): number {
  return DIRECTIONS.findIndex((d) => a.q + d.q === b.q && a.r + d.r === b.r);
}
