import type { HexCoord } from '../data/map';
import { MAP_TERRAIN } from '../data/map';
import { TERRAIN_LABELS } from './hexRender';

/**
 * Formats the axial coordinate and terrain label shown by the hex hover
 * tooltip (`MapView`'s `showHexTooltip`). Pulled out as a pure function per
 * this repo's convention of keeping the one genuinely testable piece of a
 * scene/UI feature separate from the Phaser object it feeds — see plan.md
 * §13.3.
 *
 * `allHexes()` (`mapBounds.ts`) is derived directly from `MAP_TERRAIN`'s own
 * keys, so every hex `MapView` actually builds a hoverable polygon for is
 * guaranteed to have a terrain entry — this function can never see the
 * "missing" branch from a real hover. It's handled anyway (falling back to
 * 'plain', the same default `MapView.ts`'s own hex-coloring loop already
 * uses for the same lookup) so the behavior is deliberate rather than an
 * accidental `undefined` reaching `TERRAIN_LABELS`, and so the tooltip can't
 * disagree with the hex's rendered color if this function is ever reused
 * for a hex reached some other way (e.g. a future selected-hex trigger, per
 * §13's flagged assumption).
 */
export function formatHexTooltip(hex: HexCoord): string {
  const terrain = MAP_TERRAIN.get(`${hex.q},${hex.r}`) ?? 'plain';
  const label = TERRAIN_LABELS[terrain] ?? terrain;
  return `(${hex.q}, ${hex.r}) — ${label}`;
}
