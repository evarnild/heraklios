import { MAP_TERRAIN, RIVER_HEXSIDES } from '../../data/map';
import { ZONE_TERRAINS, isSeaLike } from '../../data/terrain';
import { DIRECTIONS } from '../../engine/hex';
import { TERRAIN_COLORS } from '../hexRender';
import type { PaintContext } from './paintContext';
import { hexesWhere, smoothedLoops, terrainOf } from './paintTerrain';
import { meander, riverPolylines } from './rivers';
import { smoothPolyline } from './smoothing';

const SHALLOW = 0x6fbfdc;
const DEEP = 0x1e6eaa;
const FOAM = 0xffffff;
const WIDE_RIVER = 0x3b8bd0;
const RIVER_EDGE = 0x1f5fa8;
const RIVER_MID = 0x3f8fe0;
const RIVER_LIGHT = 0x9fd0f5;

/** `river-wide` hexes as broad water with a lighter current line. */
export function paintWideRivers(ctx: PaintContext): void {
  for (const loop of smoothedLoops(hexesWhere((t) => t === 'river-wide'))) {
    ctx.fillLoop(loop, WIDE_RIVER);
    ctx.softEdge(loop, WIDE_RIVER, 0.2);
    ctx.strokeLoop(loop, 2, RIVER_LIGHT, 0.5);
  }
}

/** The sea: shallow water everywhere, deeper water away from land, a tint
 * per named bay, and a foam line along the coast. */
export function paintSea(ctx: PaintContext): void {
  const sea = hexesWhere(isSeaLike);
  const water = smoothedLoops(sea);
  for (const loop of water) ctx.fillLoop(loop, SHALLOW);
  // Open water: sea-like hexes whose every neighbour on the map is sea-like too.
  const open = sea.filter((h) =>
    DIRECTIONS.every((d) => {
      const n = MAP_TERRAIN.get(`${h.q + d.q},${h.r + d.r}`);
      return n === undefined || isSeaLike(n);
    }),
  );
  for (const loop of smoothedLoops(open)) {
    for (const width of [18, 12, 6]) ctx.strokeLoop(loop, width, DEEP, 0.16);
    ctx.fillLoop(loop, DEEP, 0.85);
  }
  for (const zone of ZONE_TERRAINS) {
    const tint = TERRAIN_COLORS[zone] ?? DEEP;
    for (const loop of smoothedLoops(sea.filter((h) => terrainOf(h) === zone))) {
      ctx.fillLoop(loop, tint, 0.42);
      ctx.softEdge(loop, tint, 0.16);
      ctx.strokeLoop(loop, 1.2, tint, 0.6);
    }
  }
  for (const loop of water) {
    ctx.strokeLoop(loop, 3, FOAM, 0.28);
    ctx.strokeLoop(loop, 1.2, FOAM, 0.7);
  }
}

/** `RIVER_HEXSIDES` as flowing lines: chained, meandered, smoothed, then
 * stroked as a dark bank, the water, and a light current. */
export function paintRivers(ctx: PaintContext): void {
  for (const line of riverPolylines(RIVER_HEXSIDES)) {
    const flow = smoothPolyline(meander(line.points), 2);
    ctx.strokeLine(flow, 7, RIVER_EDGE, 0.85);
    ctx.strokeLine(flow, 4.5, RIVER_MID, 1);
    ctx.strokeLine(flow, 1.5, RIVER_LIGHT, 0.7);
  }
}
