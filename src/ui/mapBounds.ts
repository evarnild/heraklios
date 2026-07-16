import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { hexToPixel } from './hexRender';
import { isSeaLike } from '../data/terrain';

/** All playable hexes, parsed once from the terrain map's string keys. */
export function allHexes(): HexCoord[] {
  const hexes: HexCoord[] = [];
  for (const key of MAP_TERRAIN.keys()) {
    const [q, r] = key.split(',').map(Number);
    hexes.push({ q: q!, r: r! });
  }
  return hexes;
}

/**
 * Deployment zones: a 3-hex-deep strip running the FULL length of the given
 * compass edge of the map's bounding box (land hexes only). The original
 * rules let each player pick their own 3-hex-wide strip anywhere along their
 * assigned edge with a 4-hex minimum separation from other players — this
 * picks the entire edge-band per player rather than exposing that freeform
 * placement choice in the UI (each player is on a different edge, so the
 * bands don't collide except possibly near corners, which is an accepted
 * simplification).
 */
export function deploymentZone(edge: 'N' | 'S' | 'E' | 'W'): HexCoord[] {
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

  // 3 hexes deep from the edge, spanning the full length of that edge.
  const extreme = sorted[0]!;
  const isVertical = edge === 'N' || edge === 'S';
  const depthLimit = 90; // ~3 hex-widths (hex column/row spacing is ~33-38px)
  return sorted
    .filter((p) => (isVertical ? Math.abs(p.y - extreme.y) < depthLimit : Math.abs(p.x - extreme.x) < depthLimit))
    .map((p) => p.hex);
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
