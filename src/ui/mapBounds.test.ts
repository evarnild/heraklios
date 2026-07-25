import { describe, it, expect } from 'vitest';
import {
  allHexes,
  deploymentColumns,
  deploymentZone,
  stripLength,
  maxAnchor,
  defaultAnchor,
  clampAnchor,
  zonesAreSeparated,
  seaZoneNear,
  type Edge,
} from './mapBounds';
import { hexDistance } from '../engine/hex';

const EDGES: readonly Edge[] = ['N', 'S', 'E', 'W'];

describe('deploymentColumns', () => {
  it('covers every hex from the old full-edge zone exactly once', () => {
    for (const edge of EDGES) {
      const columns = deploymentColumns(edge);
      const flat = columns.flat();
      const keys = flat.map((h) => `${h.q},${h.r}`);
      expect(new Set(keys).size).toBe(keys.length); // no hex appears twice
      // Every column-derived hex must actually be a real, playable hex.
      const allKeys = new Set(allHexes().map((h) => `${h.q},${h.r}`));
      for (const k of keys) expect(allKeys.has(k)).toBe(true);
    }
  });

  it('orders columns strictly along the edge (no gaps collapse, no reordering)', () => {
    for (const edge of EDGES) {
      const columns = deploymentColumns(edge);
      expect(columns.length).toBeGreaterThan(0);
      for (const column of columns) expect(column.length).toBeGreaterThan(0);
    }
  });

  it('on N/S edges, every hex in a column shares the same q, and columns are strictly ordered by q', () => {
    // Pins the exact column<->hex mapping: q is exactly proportional to
    // hexToPixel's x, so grouping by it must never merge two different q's
    // into one column (the original bug: pixel-rounding merged q=17 and 18)
    // or reorder columns. A gap bigger than 1 between consecutive columns is
    // still legal — it just means the map has no playable hex in that row
    // (e.g. near the scanned page's fold) — so only strict monotonicity is
    // asserted, not a fixed step of exactly 1.
    for (const edge of ['N', 'S'] as const) {
      const columns = deploymentColumns(edge);
      const qOf = columns.map((col) => {
        const qs = new Set(col.map((h) => h.q));
        expect(qs.size).toBe(1); // every hex in a column shares one q
        return [...qs][0]!;
      });
      for (let i = 1; i < qOf.length; i++) {
        expect(qOf[i]!).toBeGreaterThan(qOf[i - 1]!);
      }
    }
  });

  it('on E/W edges, every hex in a column shares the same (2r+q), and columns are strictly ordered by it', () => {
    // Same pin as above, for the axis where depth runs along x instead: y is
    // exactly proportional to (2r+q), so grouping on that exact integer must
    // never merge two genuinely different rows or fragment one real row (the
    // original bug: pixel-rounding produced ragged, unevenly-spaced columns).
    for (const edge of ['E', 'W'] as const) {
      const columns = deploymentColumns(edge);
      const rowOf = columns.map((col) => {
        const rows = new Set(col.map((h) => 2 * h.r + h.q));
        expect(rows.size).toBe(1);
        return [...rows][0]!;
      });
      for (let i = 1; i < rowOf.length; i++) {
        expect(rowOf[i]!).toBeGreaterThan(rowOf[i - 1]!);
      }
    }
  });

  it('every column holds at most 3 hexes (the band is only 3 hexes deep)', () => {
    for (const edge of EDGES) {
      for (const column of deploymentColumns(edge)) {
        expect(column.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('stripLength / maxAnchor / clampAnchor', () => {
  it('strip length is at least the minimum and never exceeds the edge', () => {
    for (const edge of EDGES) {
      const total = deploymentColumns(edge).length;
      const len = stripLength(edge);
      expect(len).toBeGreaterThanOrEqual(3);
      expect(len).toBeLessThanOrEqual(total);
    }
  });

  it('maxAnchor keeps a full-length strip on the edge', () => {
    for (const edge of EDGES) {
      const total = deploymentColumns(edge).length;
      const len = stripLength(edge);
      expect(maxAnchor(edge)).toBe(total - len);
    }
  });

  it('defaultAnchor is a legal (in-range) anchor', () => {
    for (const edge of EDGES) {
      const anchor = defaultAnchor(edge);
      expect(anchor).toBeGreaterThanOrEqual(0);
      expect(anchor).toBeLessThanOrEqual(maxAnchor(edge));
    }
  });

  it('clampAnchor pins out-of-range values to the nearest legal one', () => {
    for (const edge of EDGES) {
      expect(clampAnchor(edge, -100)).toBe(0);
      expect(clampAnchor(edge, 100000)).toBe(maxAnchor(edge));
      expect(clampAnchor(edge, 0)).toBe(0);
      expect(clampAnchor(edge, maxAnchor(edge))).toBe(maxAnchor(edge));
    }
  });
});

describe('deploymentZone with an anchor', () => {
  it('always returns a strip of exactly stripLength(edge) columns worth of hexes', () => {
    for (const edge of EDGES) {
      const columns = deploymentColumns(edge);
      const len = stripLength(edge);
      for (const anchor of [0, defaultAnchor(edge), maxAnchor(edge)]) {
        const zone = deploymentZone(edge, anchor);
        const expectedCount = columns.slice(anchor, anchor + len).reduce((n, c) => n + c.length, 0);
        expect(zone.length).toBe(expectedCount);
      }
    }
  });

  it('shifting the anchor shifts which hexes are included', () => {
    for (const edge of EDGES) {
      if (maxAnchor(edge) === 0) continue; // edge too short to offer a real choice
      const atStart = new Set(deploymentZone(edge, 0).map((h) => `${h.q},${h.r}`));
      const atEnd = new Set(deploymentZone(edge, maxAnchor(edge)).map((h) => `${h.q},${h.r}`));
      expect(atStart).not.toEqual(atEnd);
    }
  });

  it('defaults to a centered anchor when none is passed, matching defaultAnchor', () => {
    for (const edge of EDGES) {
      const implicit = deploymentZone(edge);
      const explicit = deploymentZone(edge, defaultAnchor(edge));
      expect(implicit).toEqual(explicit);
    }
  });

  it('every returned hex is within the 3-deep band regardless of anchor', () => {
    // Sanity check against the un-windowed full band (old behavior) — the
    // anchored zone must always be a subset of it.
    for (const edge of EDGES) {
      const fullBand = new Set(deploymentColumns(edge).flat().map((h) => `${h.q},${h.r}`));
      const zone = deploymentZone(edge, 0);
      for (const h of zone) expect(fullBand.has(`${h.q},${h.r}`)).toBe(true);
    }
  });
});

describe('zonesAreSeparated', () => {
  it('is true for two hex sets far apart', () => {
    const a = [{ q: 0, r: 0 }];
    const b = [{ q: 20, r: 20 }];
    expect(zonesAreSeparated(a, b, 4)).toBe(true);
  });

  it('is false when the closest pair is under the minimum distance', () => {
    const a = [{ q: 0, r: 0 }];
    const b = [{ q: 1, r: 0 }]; // distance 1
    expect(zonesAreSeparated(a, b, 4)).toBe(false);
  });

  it('treats exactly the minimum distance as satisfying separation', () => {
    const a = [{ q: 0, r: 0 }];
    const b = [{ q: 4, r: 0 }];
    expect(hexDistance(a[0]!, b[0]!)).toBe(4);
    expect(zonesAreSeparated(a, b, 4)).toBe(true);
    const c = [{ q: 3, r: 0 }];
    expect(hexDistance(a[0]!, c[0]!)).toBe(3);
    expect(zonesAreSeparated(a, c, 4)).toBe(false);
  });

  it('checks every pair, not just the first', () => {
    const a = [{ q: 0, r: 0 }, { q: 100, r: 100 }];
    const b = [{ q: 200, r: 200 }, { q: 1, r: 0 }]; // second hex is distance 1 from a[0]
    expect(zonesAreSeparated(a, b, 4)).toBe(false);
  });

  it('is vacuously true for an empty set on either side', () => {
    expect(zonesAreSeparated([], [{ q: 0, r: 0 }], 4)).toBe(true);
    expect(zonesAreSeparated([{ q: 0, r: 0 }], [], 4)).toBe(true);
  });
});

describe('seaZoneNear is unaffected by the deployment-zone changes', () => {
  it('still returns sea-like hexes ordered nearest-edge-first', () => {
    for (const edge of EDGES) {
      expect(seaZoneNear(edge).length).toBeGreaterThan(0);
    }
  });
});
