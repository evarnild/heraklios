import Phaser from 'phaser';
import { allHexes } from '../mapBounds';
import { HEX_SIZE, hexToPixel } from '../hexRender';
import { gridSegments } from './gridLines';
import { PaintContext } from './paintContext';
import { paintGrass, paintHighGround, paintMarsh, paintShore } from './paintTerrain';
import { paintRivers, paintSea, paintWideRivers } from './paintWater';

const PAD = 6;
const GRID_COLOR = 0x2a2016;
const GRID_ALPHA = 0.18;

let builds = 0;

/** How many times a landscape has been baked in this page (dev hook: a
 * toggle bakes once per Drawn view made, and pan and zoom never bake). */
export function landscapeBuilds(): number {
  return builds;
}

/** The pixel box the landscape covers, in `hexToPixel` space. */
export function landscapeBounds(): { minX: number; minY: number; width: number; height: number } {
  const pts = allHexes().map(hexToPixel);
  const minX = Math.min(...pts.map((p) => p.x)) - HEX_SIZE - PAD;
  const minY = Math.min(...pts.map((p) => p.y)) - HEX_SIZE - PAD;
  const maxX = Math.max(...pts.map((p) => p.x)) + HEX_SIZE + PAD;
  const maxY = Math.max(...pts.map((p) => p.y)) + HEX_SIZE + PAD;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The GPU's largest texture side, or 4096 when it can't be asked. The game
 * runs `Phaser.CANVAS` (main.ts), which has no GL context, so today this is
 * always 4096 and the bake is 2x; the GL branch only matters if the renderer
 * ever changes.
 */
function maxTextureSide(scene: Phaser.Scene): number {
  const gl = (scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
  const size = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096;
  return Number.isFinite(size) && size > 0 ? size : 4096;
}

/**
 * Bakes the whole landscape once into a `RenderTexture` and returns it, shown
 * at `1 / scale` so it covers the board's own pixels. `scale` is 2 (a sharper
 * image when zoomed in), dropping to 1 when the board at 2x would not fit the
 * GPU's texture limit. `origin` is where `hexToPixel` (0, 0) sits on screen.
 * The caller owns the object and keeps it off the HUD camera.
 */
export function bakeLandscape(scene: Phaser.Scene, origin: { x: number; y: number }): Phaser.GameObjects.RenderTexture {
  const b = landscapeBounds();
  const limit = maxTextureSide(scene);
  const scale = Math.max(b.width, b.height) * 2 <= limit ? 2 : 1;
  const g = scene.make.graphics({}, false);
  const ctx = new PaintContext(g, scale, b.minX, b.minY);

  paintGrass(ctx);
  paintHighGround(ctx);
  paintMarsh(ctx);
  paintShore(ctx);
  paintWideRivers(ctx);
  paintSea(ctx);
  paintRivers(ctx);
  for (const { a, b: end } of gridSegments(allHexes())) ctx.segment(a, end, 1, GRID_COLOR, GRID_ALPHA);

  const texture = scene.add.renderTexture(origin.x + b.minX, origin.y + b.minY, Math.ceil(b.width * scale), Math.ceil(b.height * scale));
  texture.setOrigin(0, 0).setScale(1 / scale).setDepth(1);
  texture.draw(g, 0, 0);
  g.destroy();
  builds++;
  return texture;
}
