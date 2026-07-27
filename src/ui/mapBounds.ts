import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { hexToPixel } from './hexRender';
import { isSeaLike } from '../data/terrain';
import type { TerrainType } from '../data/terrain';
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
 * hex's pixel position attached (used to find the edge-nearest extreme to
 * measure depth from; `deploymentBand` strips the pixel data back off). */
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

/** The full-length, 3-hex-deep land band along `edge` — the rulebook only
 * bounds a deployment strip's DEPTH (3 hexes, `docs/research/02-rules-transcription.md`),
 * not how far along the edge a player may spread out, so a player's
 * available deployment area is simply this whole band. Memoized: the map is
 * static for the process lifetime, and the placement UI recomputes this
 * (indirectly, via `legalDeploymentHexes`) on every render. */
const bandCache = new Map<Edge, HexCoord[]>();

export function deploymentBand(edge: Edge): HexCoord[] {
  const cached = bandCache.get(edge);
  if (cached) return cached;
  const band = depthBand(edge).map((p) => p.hex);
  bandCache.set(edge, band);
  return band;
}

/** Each compass edge's assigned named bay for fleet deployment — "each player
 * deploys their fleet (if any) in the corresponding named sea zone"
 * (`docs/research/02-rules-transcription.md`): west → Anse d'Hypnos, south →
 * Pointe d'Eole, north → Baie d'Argos, east → Cap Zénon. Unlike the land
 * band, this is NOT "nearest sea hexes to the edge" — it's one specific
 * named zone per edge, painted into the map data (`data/map.ts`) — so it has
 * to be looked up rather than derived from geometry. */
const EDGE_NAVAL_ZONE: Record<Edge, TerrainType> = {
  W: 'zone-anse-hypnos',
  S: 'zone-pointe-eole',
  N: 'zone-baie-argos',
  E: 'zone-cap-zenon',
};

const navalBandCache = new Map<Edge, HexCoord[]>();

/**
 * The hexes of `edge`'s assigned named bay — the only hexes a fleet may
 * start in: "no ship may be placed in the coastal fringe... or in
 * open/high seas... only in its assigned medium-blue deployment zone"
 * (`docs/research/02-rules-transcription.md`). Memoized like `deploymentBand`.
 */
export function navalDeploymentBand(edge: Edge): HexCoord[] {
  const cached = navalBandCache.get(edge);
  if (cached) return cached;
  const zoneTerrain = EDGE_NAVAL_ZONE[edge];
  const band = allHexes().filter((h) => MAP_TERRAIN.get(`${h.q},${h.r}`) === zoneTerrain);
  navalBandCache.set(edge, band);
  return band;
}

/**
 * Filters `band` down to hexes at least `minGap` hexes (axial distance, see
 * `engine/hex.ts`'s `hexDistance`) from every hex in `enemyHexes` — the
 * rulebook's "a minimum gap of 4 hexes must separate two different armies at
 * the start" (`docs/research/02-rules-transcription.md`), read literally:
 * exactly 4 is the tightest still-legal placement, 1-3 is a violation.
 * `enemyHexes` should be other players' already-placed units, not this
 * player's own (the gap rule is between different armies, not within one).
 *
 * If `band` is entirely boxed in (every hex within `minGap` of some enemy
 * unit — only plausible on a very cramped edge, or a bay small enough that
 * one ship blocks the rest of it), the gap constraint is dropped rather than
 * returning an empty, unplaceable set: the rulebook doesn't say what should
 * happen if a player's deployment area is boxed in, and a placement screen
 * with nowhere to click would soft-lock the game.
 */
function excludeTooClose(band: readonly HexCoord[], enemyHexes: readonly HexCoord[], minGap: number): HexCoord[] {
  if (enemyHexes.length === 0) return [...band];
  const clear = band.filter((h) => enemyHexes.every((e) => hexDistance(h, e) >= minGap));
  return clear.length > 0 ? clear : [...band];
}

/** Land hexes along `edge` where a land unit may be placed right now — see
 * `excludeTooClose` for the gap rule this applies. */
export function legalDeploymentHexes(edge: Edge, enemyHexes: readonly HexCoord[], minGap = 4): HexCoord[] {
  return excludeTooClose(deploymentBand(edge), enemyHexes, minGap);
}

/** Bay hexes along `edge` where a ship may be placed right now — see
 * `excludeTooClose` for the gap rule this applies. */
export function legalNavalDeploymentHexes(edge: Edge, enemyHexes: readonly HexCoord[], minGap = 4): HexCoord[] {
  return excludeTooClose(navalDeploymentBand(edge), enemyHexes, minGap);
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
