import { MAP_TERRAIN } from '../../data/map';
import type { HexCoord } from '../../data/map';
import type { TerrainType } from '../../data/terrain';
import { allHexes } from '../mapBounds';
import { HEX_SIZE, hexToPixel } from '../hexRender';
import { flankSides } from './flanks';
import { sideEdge } from './geometry';
import type { Point } from './geometry';
import type { PaintContext } from './paintContext';
import { regionLoops } from './regions';
import { smoothLoop } from './smoothing';
import { hexNoise } from './variation';

export const GRASS = 0x9db36a;
const GRASS_LIGHT = 0xb7cb82;
const GRASS_DARK = 0x82994f;
const PLATEAU = 0xb8a25c;
const PLATEAU_HI = 0xd3c079;
const FLANK = 0x8f6b3b;
const INK = 0x2a2016;
const MARSH = 0x70895a;
const POOL = 0x4f7f8c;
const REED = 0x3e5a2a;
const BEACH = 0xe6d7a6;

export function terrainOf(hex: HexCoord): TerrainType {
  return MAP_TERRAIN.get(`${hex.q},${hex.r}`) ?? 'plain';
}

export function hexesWhere(pred: (t: TerrainType) => boolean): HexCoord[] {
  return allHexes().filter((h) => pred(terrainOf(h)));
}

/** The smoothed outline loops of a set of hexes (two Chaikin cuts). */
export function smoothedLoops(members: readonly HexCoord[]): Point[][] {
  return regionLoops(members).map((l) => smoothLoop(l, 2));
}

/** The land base: grass over every hex of the map, with deterministic light and dark patches. */
export function paintGrass(ctx: PaintContext): void {
  for (const loop of regionLoops(allHexes())) ctx.fillLoop(loop, GRASS);
  for (const hex of hexesWhere((t) => t === 'plain')) {
    const c = hexToPixel(hex);
    for (let k = 0; k < 3; k++) {
      const angle = hexNoise(hex.q, hex.r, k * 3) * Math.PI * 2;
      const dist = hexNoise(hex.q, hex.r, k * 3 + 1) * HEX_SIZE * 0.7;
      const size = hexNoise(hex.q, hex.r, k * 3 + 2);
      ctx.circle(c.x + Math.cos(angle) * dist, c.y + Math.sin(angle) * dist, 5 + size * 6, size < 0.5 ? GRASS_LIGHT : GRASS_DARK, 0.22);
    }
    const tx = c.x + (hexNoise(hex.q, hex.r, 20) - 0.5) * HEX_SIZE;
    const ty = c.y + (hexNoise(hex.q, hex.r, 21) - 0.5) * HEX_SIZE;
    ctx.segment({ x: tx, y: ty }, { x: tx - 1.5, y: ty - 4 }, 1, GRASS_DARK, 0.6);
    ctx.segment({ x: tx, y: ty }, { x: tx + 2, y: ty - 3.5 }, 1, GRASS_DARK, 0.6);
  }
}

/** Plateau relief (a cast shadow, a lit dome per hex) and the hatched steep flanks. */
export function paintHighGround(ctx: PaintContext): void {
  const high = hexesWhere((t) => t === 'plateau' || t === 'steep-flank');
  const loops = smoothedLoops(high);
  for (const loop of loops) ctx.fillLoop(loop, INK, 0.3, 3, 4);
  for (const loop of loops) {
    ctx.fillLoop(loop, PLATEAU);
    ctx.softEdge(loop, PLATEAU);
  }
  for (const hex of hexesWhere((t) => t === 'plateau')) {
    const c = hexToPixel(hex);
    ctx.circle(c.x - 2, c.y - 2, HEX_SIZE * 0.62, PLATEAU_HI, 0.3);
    ctx.circle(c.x - 3, c.y - 3, HEX_SIZE * 0.33, PLATEAU_HI, 0.3);
  }
  const flanks = smoothedLoops(hexesWhere((t) => t === 'steep-flank'));
  for (const loop of flanks) {
    ctx.fillLoop(loop, FLANK);
    ctx.softEdge(loop, FLANK, 0.18);
  }
  paintHatching(ctx);
  for (const loop of loops) ctx.strokeLoop(loop, 1.5, 0x5d4a22, 0.6);
}

/** Short strokes inward from each flank side that faces lower ground. */
function paintHatching(ctx: PaintContext): void {
  for (const [key, sides] of flankSides(MAP_TERRAIN)) {
    const [q, r] = key.split(',').map(Number);
    const hex = { q: q!, r: r! };
    const c = hexToPixel(hex);
    for (const f of sides) {
      const { a, b } = sideEdge(hex, f);
      for (const t of [0.12, 0.3, 0.5, 0.7, 0.88]) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const len = Math.hypot(c.x - x, c.y - y) || 1;
        const to = { x: x + ((c.x - x) / len) * 9, y: y + ((c.y - y) / len) * 9 };
        ctx.segment({ x, y }, to, 1.2, 0x4b2e14, 0.55);
      }
    }
  }
}

/** Marsh: a muted green region with dark pools and reed tufts. */
export function paintMarsh(ctx: PaintContext): void {
  for (const loop of smoothedLoops(hexesWhere((t) => t === 'marsh'))) {
    ctx.fillLoop(loop, MARSH);
    ctx.softEdge(loop, MARSH);
  }
  for (const hex of hexesWhere((t) => t === 'marsh')) {
    const c = hexToPixel(hex);
    for (let k = 0; k < 2; k++) {
      const x = c.x + (hexNoise(hex.q, hex.r, 30 + k) - 0.5) * HEX_SIZE * 1.1;
      const y = c.y + (hexNoise(hex.q, hex.r, 40 + k) - 0.5) * HEX_SIZE * 1.1;
      ctx.ellipse(x, y, 10 + hexNoise(hex.q, hex.r, 50 + k) * 6, 5, POOL, 0.7);
    }
    for (let k = 0; k < 4; k++) {
      const x = c.x + (hexNoise(hex.q, hex.r, 60 + k) - 0.5) * HEX_SIZE * 1.3;
      const y = c.y + (hexNoise(hex.q, hex.r, 70 + k) - 0.5) * HEX_SIZE * 1.1;
      ctx.segment({ x, y }, { x: x - 1, y: y - 6 }, 1.2, REED, 0.9);
      ctx.segment({ x, y }, { x: x + 2, y: y - 5 }, 1.2, REED, 0.9);
    }
  }
}

/** The `coast` hexes: a pale beach that melts into the grass. */
export function paintShore(ctx: PaintContext): void {
  for (const loop of smoothedLoops(hexesWhere((t) => t === 'coast'))) {
    ctx.fillLoop(loop, BEACH);
    ctx.softEdge(loop, BEACH, 0.2);
  }
}
