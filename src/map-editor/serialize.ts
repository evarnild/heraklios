import type { HexCoord } from '../data/map';
import type { TerrainType } from '../data/terrain';
import { EditorState, offsetToAxial } from './editorState';

/** Sorts hexes the same way the shipped map.ts does, for stable/diffable output. */
function sortHexes(hexes: HexCoord[]): HexCoord[] {
  return [...hexes].sort((a, b) => a.q - b.q || a.r - b.r);
}

/**
 * Generates the exact `src/data/map.ts` module source for the current
 * editor state — a drop-in replacement for the auto-extracted file.
 */
export function toMapTsSource(state: EditorState): string {
  const lines: string[] = [];
  lines.push('// Hand-authored with the Héraklios map editor (map-editor.html).');
  lines.push('// Coordinates are axial (q, r) for flat-top hexes.');
  lines.push("import type { TerrainType } from './terrain';");
  lines.push('');
  lines.push('export interface HexCoord {');
  lines.push('  q: number;');
  lines.push('  r: number;');
  lines.push('}');
  lines.push('');
  lines.push('export function hexKey(q: number, r: number): string {');
  lines.push('  return `${q},${r}`;');
  lines.push('}');
  lines.push('');
  lines.push('/** Canonical undirected key for the hexside between two adjacent hexes. */');
  lines.push('export function riverEdgeKey(a: HexCoord, b: HexCoord): string {');
  lines.push('  const lo = a.q < b.q || (a.q === b.q && a.r <= b.r) ? a : b;');
  lines.push('  const hi = lo === a ? b : a;');
  lines.push('  return `${lo.q},${lo.r}|${hi.q},${hi.r}`;');
  lines.push('}');
  lines.push('');
  lines.push('export const MAP_TERRAIN: ReadonlyMap<string, TerrainType> = new Map([');
  for (const hex of sortHexes(state.allHexes())) {
    const terrain = state.getTerrain(hex);
    lines.push(`  [hexKey(${hex.q}, ${hex.r}), '${terrain}'],`);
  }
  lines.push(']);');
  lines.push('');
  lines.push('/** Hexsides that carry a (normal) river. Membership is symmetric. */');
  lines.push('export const RIVER_HEXSIDES: ReadonlySet<string> = new Set([');
  const edgeKeys = new Set<string>();
  for (const [a, b] of state.riverEdgeList()) {
    const lo = a.q < b.q || (a.q === b.q && a.r <= b.r) ? a : b;
    const hi = lo === a ? b : a;
    edgeKeys.add(`${lo.q},${lo.r}|${hi.q},${hi.r}`);
  }
  for (const key of Array.from(edgeKeys).sort()) {
    lines.push(`  '${key}',`);
  }
  lines.push(']);');
  lines.push('');
  return lines.join('\n');
}

export interface EditorSaveFile {
  cols: number;
  rows: number;
  terrain: Array<[string, TerrainType]>; // [hexKey, terrain]
  rivers: string[]; // riverEdgeKey list
}

export function toSaveFile(state: EditorState): EditorSaveFile {
  return {
    cols: state.cols,
    rows: state.rows,
    terrain: sortHexes(state.allHexes()).map((hex) => [`${hex.q},${hex.r}`, state.getTerrain(hex)!]),
    rivers: state.riverEdgeList().map(([a, b]) => {
      const lo = a.q < b.q || (a.q === b.q && a.r <= b.r) ? a : b;
      const hi = lo === a ? b : a;
      return `${lo.q},${lo.r}|${hi.q},${hi.r}`;
    }),
  };
}

export function fromSaveFile(data: EditorSaveFile): EditorState {
  const state = new EditorState(data.cols, data.rows);
  for (const [key, terrain] of data.terrain) {
    const [q, r] = key.split(',').map(Number);
    state.setTerrain({ q: q!, r: r! }, terrain);
  }
  for (const edgeKey of data.rivers) {
    const [ka, kb] = edgeKey.split('|');
    const [aq, ar] = ka!.split(',').map(Number);
    const [bq, br] = kb!.split(',').map(Number);
    state.setRiver({ q: aq!, r: ar! }, { q: bq!, r: br! }, true);
  }
  return state;
}

// Re-exported for convenience so consumers only need one import.
export { offsetToAxial };
