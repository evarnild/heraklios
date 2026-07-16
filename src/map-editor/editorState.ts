import type { HexCoord } from '../data/map';
import { hexKey, riverEdgeKey } from '../data/map';
import { neighbors } from '../engine/hex';
import type { TerrainType } from '../data/terrain';

/** Converts a rectangular (col, row) grid position to the game's axial (q, r)
 * coordinates, using the same odd-q offset convention as the shipped map. */
export function offsetToAxial(col: number, row: number): HexCoord {
  const parity = col & 1;
  return { q: col, r: row - (col - parity) / 2 };
}

export function axialToOffset(hex: HexCoord): { col: number; row: number } {
  const parity = hex.q & 1;
  return { col: hex.q, row: hex.r + (hex.q - parity) / 2 };
}

const DEFAULT_TERRAIN: TerrainType = 'plain';

/**
 * In-memory editable map: a rectangular cols x rows grid of hexes (stored by
 * axial key, matching the shipped `src/data/map.ts` format exactly) plus a
 * set of river hexsides. No DOM dependency — fully unit-testable.
 */
export class EditorState {
  readonly cols: number;
  readonly rows: number;
  private terrain = new Map<string, TerrainType>();
  private hexByKey = new Map<string, HexCoord>();
  private riverEdges = new Set<string>();

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const hex = offsetToAxial(col, row);
        const key = hexKey(hex.q, hex.r);
        this.terrain.set(key, DEFAULT_TERRAIN);
        this.hexByKey.set(key, hex);
      }
    }
  }

  allHexes(): HexCoord[] {
    return Array.from(this.hexByKey.values());
  }

  hasHex(hex: HexCoord): boolean {
    return this.terrain.has(hexKey(hex.q, hex.r));
  }

  getTerrain(hex: HexCoord): TerrainType | undefined {
    return this.terrain.get(hexKey(hex.q, hex.r));
  }

  setTerrain(hex: HexCoord, terrain: TerrainType): void {
    const key = hexKey(hex.q, hex.r);
    if (!this.terrain.has(key)) return; // outside the grid
    this.terrain.set(key, terrain);
  }

  /** All neighbors of `hex` that are also part of the grid (for finding the
   * nearest editable hexside in river-edit mode). */
  neighborsInGrid(hex: HexCoord): HexCoord[] {
    return neighbors(hex).filter((n) => this.hasHex(n));
  }

  hasRiver(a: HexCoord, b: HexCoord): boolean {
    return this.riverEdges.has(riverEdgeKey(a, b));
  }

  setRiver(a: HexCoord, b: HexCoord, present: boolean): void {
    const key = riverEdgeKey(a, b);
    if (present) this.riverEdges.add(key);
    else this.riverEdges.delete(key);
  }

  toggleRiver(a: HexCoord, b: HexCoord): void {
    this.setRiver(a, b, !this.hasRiver(a, b));
  }

  /** All river edges as [a, b] hex pairs. */
  riverEdgeList(): Array<[HexCoord, HexCoord]> {
    const out: Array<[HexCoord, HexCoord]> = [];
    for (const key of this.riverEdges) {
      const [ka, kb] = key.split('|');
      const [aq, ar] = ka!.split(',').map(Number);
      const [bq, br] = kb!.split(',').map(Number);
      out.push([{ q: aq!, r: ar! }, { q: bq!, r: br! }]);
    }
    return out;
  }

  terrainEntries(): Array<[HexCoord, TerrainType]> {
    return Array.from(this.hexByKey.values()).map((hex) => [hex, this.terrain.get(hexKey(hex.q, hex.r))!]);
  }
}
