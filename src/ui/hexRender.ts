import type { HexCoord } from '../data/map';
import type { TerrainType } from '../data/terrain';

export const HEX_SIZE = 22;

/** Pixel center for a flat-top hex at axial (q, r). */
export function hexToPixel(hex: HexCoord): { x: number; y: number } {
  const x = HEX_SIZE * (1.5 * hex.q);
  const y = HEX_SIZE * (Math.sqrt(3) * (hex.r + hex.q / 2));
  return { x, y };
}

export function pixelToHexRound(x: number, y: number): HexCoord {
  const q = (2 / 3) * (x / HEX_SIZE);
  const r = (-1 / 3) * (x / HEX_SIZE) + (Math.sqrt(3) / 3) * (y / HEX_SIZE);
  return axialRound(q, r);
}

function axialRound(q: number, r: number): HexCoord {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

export function hexPolygonPoints(center: { x: number; y: number }): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(center.x + HEX_SIZE * Math.cos(angle), center.y + HEX_SIZE * Math.sin(angle));
  }
  return points;
}

export const TERRAIN_COLORS: Record<string, number> = {
  plain: 0xdec08c,
  'river-wide': 0x3a86c8,
  'steep-flank': 0x963d25,
  plateau: 0x968237,
  marsh: 0x5f7846,
  coast: 0xaad2e1,
  'zone-anse-hypnos': 0x2f8f6e,
  'zone-pointe-eole': 0x8f6e2f,
  'zone-baie-argos': 0x6e2f8f,
  'zone-cap-zenon': 0x2f6e8f,
  sea: 0x1e6eaa,
};

export const RIVER_COLOR = 0x2a78dc;

/** French labels for each terrain type, as used in the map editor palette. */
export const TERRAIN_LABELS: Record<string, string> = {
  plain: 'Plaine',
  'river-wide': 'Rivière large',
  'steep-flank': 'Flancs abrupts',
  plateau: 'Plateaux',
  marsh: 'Marais',
  coast: 'Frange côtière',
  'zone-anse-hypnos': "Anse d'Hypnos",
  'zone-pointe-eole': "Pointe d'Eole",
  'zone-baie-argos': "Baie d'Argos",
  'zone-cap-zenon': 'Cap Zénon',
  sea: 'Pleine mer',
};

/** Display order for the map editor's terrain palette. */
export const TERRAIN_ORDER: readonly TerrainType[] = [
  'plain',
  'river-wide',
  'steep-flank',
  'plateau',
  'marsh',
  'coast',
  'zone-anse-hypnos',
  'zone-pointe-eole',
  'zone-baie-argos',
  'zone-cap-zenon',
  'sea',
];

/** Player index -> counter color, matching the 4 physical counter sets
 * (public/markers/{color}/) and the fallback text/UI colors. */
export const PLAYER_COLOR_NAMES: readonly string[] = ['yellow', 'red', 'blue', 'green'];
export const PLAYER_COLORS_HEX: readonly string[] = ['#ffd54a', '#ff5a5a', '#5ab4ff', '#5aff7a'];

/** Texture key + asset path for a unit marker image (see public/markers/). */
export function markerTextureKey(playerIndex: number, typeId: string): string {
  const color = PLAYER_COLOR_NAMES[playerIndex] ?? 'yellow';
  return `marker-${color}-${typeId}`;
}

export function markerAssetPath(color: string, typeId: string): string {
  return `/markers/${color}/${typeId}.png`;
}
