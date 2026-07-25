import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { hexToPixel } from './hexRender';
import { isSeaLike } from '../data/terrain';
import { hexDistance } from '../engine/hex';

export type Edge = 'N' | 'S' | 'E' | 'W';

/** All playable hexes, parsed once from the terrain map's string keys. */
export function allHexes(): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (const key of MAP_TERRAIN.keys()) {
    const [q, r] = key.split(',').map(Number);
    hexes.push({ q: q!, r: r! });
  }
  return hexes;
}

const DEPTH_LIMIT = 90; // ~3 hex-widths deep, per the rulebook (unchanged from before)

/** The full-length, 3-hex-deep land band along a compass edge, with each
 * hex's pixel position attached — the shared first step for both the old
 * whole-edge zone and the new columnized one below. */
function depthBand(edge: Edge): { hex: HexCoord; x: number; y: number }[] {
  const hexes = allHexes().filter((h) => {
    const terrain = MAP_TERRAIN.get(`${h.q},${h.r}`);
    return terrain !== undefined && !isSeaLike(terrain) && terrain !== 'coast';
  });
  const pixels = hexes.map((h) => ({ hex: h, ...hexToPixel(h) }));

  let sorted: typeof pixels;
  if (edge === 'W') sorted = [...pixels].sort((a, b) => a.x - b.x);
  else if (edge === 'E') sorted = [...pixels].sort((a, b) => b.x - a.x);
  else if (edge === 'N') sorted = [...pixels].sort((a, b) => a.y - b.y);
  else sorted = [...pixels].sort((a, b) => b.y - a.y);

  const extreme = sorted[0]!;
  const isVertical = edge === 'N' || edge === 'S';
  return sorted.filter((p) =>
    isVertical ? Math.abs(p.y - extreme.y) < DEPTH_LIMIT : Math.abs(p.x - extreme.x) < DEPTH_LIMIT,
  );
}

/**
 * The 3-hex-deep land band along `edge`, split into discrete "columns"
 * running along the edge (nearest one end of the edge first — which end is
 * arbitrary, only internal consistency matters, same convention as
 * `engine/hex.ts`'s `DIRECTIONS`), each column holding every hex at exactly
 * that position along the edge (usually up to 3, one per depth step, fewer
 * near an irregular map boundary).
 *
 * Columns are bucketed on the hexes' own axial coordinates, not on rounded
 * pixel positions — `hexToPixel`'s x is *exactly* `1.5*HEX_SIZE*q`, and its y
 * is *exactly* `(sqrt(3)/2)*HEX_SIZE*(2r+q)`, so `q` (for the N/S edges,
 * where depth runs along y) and `2r+q` (for E/W, where depth runs along x)
 * are exact integer stand-ins for "along-edge position" with no rounding
 * error possible — unlike bucketing the pixel coordinates themselves, which
 * drifted enough to merge or fragment columns near the edges of the map.
 */
// The map is static for the process lifetime, so an edge's columns never
// change once computed — memoized because the zone-picking UI recomputes
// this (indirectly, via stripLength/maxAnchor/clampAnchor) on every Shift
// click and every render, and a full MAP_TERRAIN scan per call was
// measurably slow enough to be visible as UI lag.
const columnsCache = new Map<Edge, HexCoord[][]>();

export function deploymentColumns(edge: Edge): HexCoord[][] {
  const cached = columnsCache.get(edge);
  if (cached) return cached;

  const band = depthBand(edge);
  const isVertical = edge === 'N' || edge === 'S';
  const buckets = new Map<number, HexCoord[]>();
  for (const p of band) {
    const bucket = isVertical ? p.hex.q : 2 * p.hex.r + p.hex.q;
    const list = buckets.get(bucket);
    if (list) list.push(p.hex);
    else buckets.set(bucket, [p.hex]);
  }
  const columns = [...buckets.keys()].sort((a, b) => a - b).map((k) => buckets.get(k)!);
  columnsCache.set(edge, columns);
  return columns;
}

/** Fraction of an edge's available columns given to a single player's
 * deployment strip by default — the rulebook only bounds a strip's DEPTH (3
 * hexes) and says nothing about its length along the edge, so this picks a
 * length long enough to be practically useful while still leaving room for
 * the anchor to actually move (half the edge, so it can slide all the way
 * from one end to the other). See `stripLength`. */
const STRIP_LENGTH_FRACTION = 0.5;
const MIN_STRIP_COLUMNS = 3;

/** How many along-edge columns a player's deployment strip spans on `edge` —
 * see `STRIP_LENGTH_FRACTION`'s comment for why this isn't a fixed count. */
export function stripLength(edge: Edge): number {
  const total = deploymentColumns(edge).length;
  return Math.max(MIN_STRIP_COLUMNS, Math.min(total, Math.round(total * STRIP_LENGTH_FRACTION)));
}

/** Highest legal anchor (0-based column index where a strip may START) on
 * `edge`, so the strip never runs past the far end of the edge. */
export function maxAnchor(edge: Edge): number {
  return Math.max(0, deploymentColumns(edge).length - stripLength(edge));
}

/** A reasonable starting anchor before the player has chosen one — centers
 * the strip along the edge. */
export function defaultAnchor(edge: Edge): number {
  return Math.floor(maxAnchor(edge) / 2);
}

export function clampAnchor(edge: Edge, anchor: number): number {
  return Math.max(0, Math.min(Math.round(anchor), maxAnchor(edge)));
}

/**
 * Deployment zone: the player's chosen 3-hex-deep strip of `stripLength(edge)`
 * columns starting at `anchor` (0-based column index, clamped to stay on the
 * edge) along the given compass edge. This is the free-position version of
 * the rule ("units must be placed along their assigned edge... within a
 * strip no more than 3 hexes wide", `docs/research/02-rules-transcription.md`)
 * — `anchor` is the piece of freedom the print rules give the placing player
 * and a fixed-band implementation didn't expose. `anchor` defaults to
 * `defaultAnchor(edge)` for callers (like the test-mode shortcuts) that don't
 * need an interactive choice.
 */
export function deploymentZone(edge: Edge, anchor: number = defaultAnchor(edge)): HexCoord[] {
  const columns = deploymentColumns(edge);
  const length = stripLength(edge);
  const start = clampAnchor(edge, anchor);
  return columns.slice(start, start + length).flat();
}

/**
 * True if every hex of `a` is at least `minDistance` hexes (axial distance,
 * see `engine/hex.ts`'s `hexDistance`) from every hex of `b` — the rulebook's
 * "a minimum gap of 4 hexes must separate two different armies at the start"
 * (`docs/research/02-rules-transcription.md`), read literally: the two
 * zones' CLOSEST hexes must be at least 4 apart (so exactly 4 is the
 * tightest still-legal placement; 1-3 is a violation). Only ever matters
 * between two players on corner-adjacent edges (opposite edges, e.g. N/S,
 * are always far more than 4 hexes apart on any map this shape) — but the
 * check itself doesn't need to know which edges are adjacent, it just
 * measures. O(|a|*|b|) is fine for the hex counts involved here (a few dozen
 * per zone).
 */
export function zonesAreSeparated(a: readonly HexCoord[], b: readonly HexCoord[], minDistance = 4): boolean {
  for (const ha of a) {
    for (const hb of b) {
      if (hexDistance(ha, hb) < minDistance) return false;
    }
  }
  return true;
}

/**
 * Sea-like hexes (any of the 4 named bays or open sea) closest to the given
 * compass edge, nearest-first — used to find reasonable naval starting
 * positions (e.g. for the developer test mode) without hardcoding
 * map-specific coordinates.
 */
export function seaZoneNear(edge: 'N' | 'S' | 'E' | 'W'): HexCoord[] {
  const hexes = allHexes().filter((h) => {
    const terrain = MAP_TERRAIN.get(`${h.q},${h.r}`);
    return terrain !== undefined && isSeaLike(terrain);
  });
  const pixels = hexes.map((h) => ({ hex: h, ...hexToPixel(h) }));

  let sorted: typeof pixels;
  if (edge === 'W') sorted = [...pixels].sort((a, b) => a.x - b.x);
  else if (edge === 'E') sorted = [...pixels].sort((a, b) => b.x - a.x);
  else if (edge === 'N') sorted = [...pixels].sort((a, b) => a.y - b.y);
  else sorted = [...pixels].sort((a, b) => b.y - a.y);

  return sorted.map((p) => p.hex);
}
