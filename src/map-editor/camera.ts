import type { HexCoord } from '../data/map';
import { hexToPixel, HEX_SIZE } from '../ui/hexRender';
import { neighbors } from '../engine/hex';

/** Pans/zooms a fixed-size viewport over the (much larger) hex-grid world. */
export class Camera {
  x: number; // world coordinate centered on screen
  y: number;
  zoom: number;

  constructor(x = 0, y = 0, zoom = 1) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  worldToScreen(wx: number, wy: number, viewportW: number, viewportH: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + viewportW / 2,
      y: (wy - this.y) * this.zoom + viewportH / 2,
    };
  }

  screenToWorld(sx: number, sy: number, viewportW: number, viewportH: number): { x: number; y: number } {
    return {
      x: (sx - viewportW / 2) / this.zoom + this.x,
      y: (sy - viewportH / 2) / this.zoom + this.y,
    };
  }

  hexToScreen(hex: HexCoord, viewportW: number, viewportH: number): { x: number; y: number } {
    const p = hexToPixel(hex);
    return this.worldToScreen(p.x, p.y, viewportW, viewportH);
  }
}

/**
 * Given a hex and a world-space point (typically the mouse position, already
 * converted from screen to world via the camera), finds which of the hex's 6
 * real neighbors is closest in direction to that point. Used in river-edit
 * mode to pick "the nearest hexside" — computed from the neighbors' actual
 * pixel positions rather than a hardcoded angle-to-direction table, so it
 * can't drift out of sync with the axial neighbor math in engine/hex.ts.
 */
export function nearestNeighbor(hex: HexCoord, pointWorld: { x: number; y: number }): HexCoord {
  const center = hexToPixel(hex);
  const pointAngle = Math.atan2(pointWorld.y - center.y, pointWorld.x - center.x);

  let best = neighbors(hex)[0]!;
  let bestDiff = Infinity;
  for (const n of neighbors(hex)) {
    const np = hexToPixel(n);
    const nAngle = Math.atan2(np.y - center.y, np.x - center.x);
    let diff = Math.abs(nAngle - pointAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = n;
    }
  }
  return best;
}

export { HEX_SIZE };
