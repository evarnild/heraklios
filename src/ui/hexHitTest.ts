import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { pixelToHexRound } from './hexRender';

/**
 * The map hex under a point given in `hexToPixel` space (the board's own
 * pixel space, before the screen origin is added), or `null` off the map.
 *
 * Hexes tessellate the plane, so the axial-rounded hex is the one whose
 * polygon contains the point; it only needs a membership check against the
 * real map. This replaces the per-hex interactive polygons `MapView` used as
 * hit targets (Board view seam, §65), so every `BoardView` shares one
 * hit-test. A point exactly on a shared edge belongs to one hex only (the
 * old polygons could report both); that is not observable by a pointer.
 */
export function hexAtPoint(x: number, y: number): HexCoord | null {
  const rounded = pixelToHexRound(x, y);
  // `+ 0` turns the -0 that axial rounding can produce into 0.
  const hex = { q: rounded.q + 0, r: rounded.r + 0 };
  return MAP_TERRAIN.has(`${hex.q},${hex.r}`) ? hex : null;
}
