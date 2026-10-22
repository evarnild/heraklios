import type { HexCoord } from '../data/map';
import type { PlayerId, Unit } from '../engine/state';
import { unitType } from '../engine/state';
import { hexToPixel, pixelToHexRound } from './hexRender';

export interface Point {
  x: number;
  y: number;
}

/**
 * Where the view goes when `owner`'s turn starts (intents/43 B1, B2): the
 * average of the `hexToPixel` positions of that player's land units still in
 * play, or `null` when there are none (the view then stays where it is).
 * Ships don't count. The average, not the centre of the bounding box, so one
 * far-off unit doesn't drag the view away from the main body.
 */
export function landUnitsCentre(units: readonly Unit[], owner: PlayerId): Point | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const u of units) {
    if (u.owner !== owner || u.destroyed || unitType(u).domain !== 'land') continue;
    const p = hexToPixel(u.position);
    sx += p.x;
    sy += p.y;
    n++;
  }
  return n === 0 ? null : { x: sx / n, y: sy / n };
}

/** The hex nearest a point in `hexToPixel` space (for the e2e scenario). */
export function nearestHex(point: Point): HexCoord {
  return pixelToHexRound(point.x, point.y);
}
