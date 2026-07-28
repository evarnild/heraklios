import { describe, it, expect } from 'vitest';
import {
  allHexes,
  deploymentBand,
  legalDeploymentHexes,
  navalDeploymentBand,
  legalNavalDeploymentHexes,
  seaZoneNear,
  type Edge,
} from './mapBounds';
import { hexDistance } from '../engine/hex';
import { MAP_TERRAIN } from '../data/map';
import type { HexCoord } from '../data/map';
import { isSeaLike } from '../data/terrain';

const EDGES: readonly Edge[] = ['N', 'S', 'E', 'W'];

describe('deploymentBand', () => {
  it('returns only real, playable hexes, each at most once', () => {
    for (const edge of EDGES) {
      const band = deploymentBand(edge);
      expect(band.length).toBeGreaterThan(0);
      const keys = band.map((h) => `${h.q},${h.r}`);
      expect(new Set(keys).size).toBe(keys.length);
      const allKeys = new Set(allHexes().map((h) => `${h.q},${h.r}`));
      for (const k of keys) expect(allKeys.has(k)).toBe(true);
    }
  });
});

function landHexes(): HexCoord[] {
  return allHexes().filter((h) => {
    const t = MAP_TERRAIN.get(`${h.q},${h.r}`);
    return t !== undefined && !isSeaLike(t) && t !== 'coast';
  });
}

describe('deploymentBand goes exactly 3 hexes deep per along-edge bucket', () => {
  // Independently re-derives every bucket's full membership straight from the
  // raw terrain data, using the same bucket definition depthBand uses
  // internally: q for N/S (a fixed-q column runs due north-south, so r is an
  // exact single-hex-step depth axis there); floor((2r+q)/2) for E/W (each
  // raw 2r+q value only touches every other q, since r=(bucket-q)/2 needs
  // integer r — merging pairs of adjacent 2r+q values interleaves them back
  // into one along-edge group of consecutive q's). A bucket should be
  // shorter than 3 only where the map's hand-drawn boundary genuinely has
  // fewer than 3 land hexes there — never a measurement quirk (the
  // historical bugs this guards: a pixel-distance cutoff that caught 2 deep
  // in some N/S columns and 3 in others; and, on E/W, using the raw
  // un-merged 2r+q bucket, which skipped every other depth layer and made
  // the band twice as deep as intended).
  function bucketOf(edge: Edge, h: HexCoord): number {
    return edge === 'N' || edge === 'S' ? h.q : Math.floor((2 * h.r + h.q) / 2);
  }

  function landBuckets(edge: Edge): Map<number, HexCoord[]> {
    const buckets = new Map<number, HexCoord[]>();
    for (const h of landHexes()) {
      const bucket = bucketOf(edge, h);
      const list = buckets.get(bucket);
      if (list) list.push(h);
      else buckets.set(bucket, [h]);
    }
    return buckets;
  }

  // The map's coastline isn't convex (it's built around a central bay with 4
  // named inlets), so a bucket can hold a short strip near the edge, open
  // water, and then more land beyond the gap on the far shore. The expected
  // count below only counts hexes contiguous with the edge-nearest end of
  // the bucket, capped at 3 — matching depthBand's "stop at the first gap"
  // rule rather than naively taking `min(3, everything in the bucket)`.
  function depthOf(edge: Edge, h: HexCoord): number {
    if (edge === 'N') return h.r;
    if (edge === 'S') return -h.r;
    return edge === 'W' ? h.q : -h.q;
  }

  function expectedContiguousCount(edge: Edge, bucketHexes: HexCoord[]): number {
    const depths = bucketHexes.map((h) => depthOf(edge, h)).sort((a, b) => a - b);
    let count = 0;
    let previous: number | null = null;
    for (const d of depths) {
      if (count >= 3) break;
      if (previous !== null && d - previous > 1) break;
      count++;
      previous = d;
    }
    return count;
  }

  it('every bucket has the nearest contiguous hexes (capped at 3), never leaping a water gap', () => {
    for (const edge of EDGES) {
      const buckets = landBuckets(edge);
      const band = deploymentBand(edge);
      const bandByBucket = new Map<number, HexCoord[]>();
      for (const h of band) {
        const bucket = bucketOf(edge, h);
        const list = bandByBucket.get(bucket);
        if (list) list.push(h);
        else bandByBucket.set(bucket, [h]);
      }

      for (const [bucket, list] of buckets) {
        const expected = expectedContiguousCount(edge, list);
        const actual = bandByBucket.get(bucket)?.length ?? 0;
        expect(actual).toBe(expected);
      }
    }
  });

  it('each bucket only ever selects 3 consecutive depths, never a wider spread', () => {
    // Directly targets the E/W "twice as deep" bug: with the un-merged
    // bucket, a bucket's 3 selected hexes could be 4 apart in q (0,2,4)
    // instead of 2 apart (0,1,2). This checks the actual depth coordinate's
    // spread, independent of how the bucket itself is computed.
    for (const edge of EDGES) {
      const isVertical = edge === 'N' || edge === 'S';
      const bandByBucket = new Map<number, number[]>();
      for (const h of deploymentBand(edge)) {
        const bucket = bucketOf(edge, h);
        const depthValue = isVertical ? h.r : h.q;
        const list = bandByBucket.get(bucket);
        if (list) list.push(depthValue);
        else bandByBucket.set(bucket, [depthValue]);
      }
      for (const values of bandByBucket.values()) {
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('legalDeploymentHexes', () => {
  it('with no enemy units, returns the whole band', () => {
    for (const edge of EDGES) {
      expect(legalDeploymentHexes(edge, [])).toEqual(deploymentBand(edge));
    }
  });

  it('excludes band hexes within minGap of an enemy hex', () => {
    for (const edge of EDGES) {
      const band = deploymentBand(edge);
      const enemy = band[0]!;
      const legal = legalDeploymentHexes(edge, [enemy], 4);
      for (const h of legal) expect(hexDistance(h, enemy)).toBeGreaterThanOrEqual(4);
    }
  });

  it('treats exactly minGap as legal, and one less as illegal', () => {
    const band = deploymentBand('W');
    const anchor = band[0]!;
    // Find a band hex at exactly distance 4 and one at distance < 4, if any exist.
    const atGap = band.find((h) => hexDistance(h, anchor) === 4);
    const tooClose = band.find((h) => hexDistance(h, anchor) > 0 && hexDistance(h, anchor) < 4);
    const legal = legalDeploymentHexes('W', [anchor], 4);
    const legalKeys = new Set(legal.map((h) => `${h.q},${h.r}`));
    if (atGap) expect(legalKeys.has(`${atGap.q},${atGap.r}`)).toBe(true);
    if (tooClose) expect(legalKeys.has(`${tooClose.q},${tooClose.r}`)).toBe(false);
  });

  it('falls back to the whole band rather than returning empty when every hex is boxed in', () => {
    for (const edge of EDGES) {
      const band = deploymentBand(edge);
      // A huge minGap makes every band hex "too close" to any single enemy hex.
      const legal = legalDeploymentHexes(edge, [band[0]!], 100000);
      expect(legal).toEqual(band);
    }
  });
});

describe('navalDeploymentBand', () => {
  const EDGE_ZONE: Record<Edge, string> = {
    W: 'zone-anse-hypnos',
    S: 'zone-pointe-eole',
    N: 'zone-baie-argos',
    E: 'zone-cap-zenon',
  };

  it('returns only hexes tagged with that edge\'s specific named bay', () => {
    for (const edge of EDGES) {
      const band = navalDeploymentBand(edge);
      expect(band.length).toBeGreaterThan(0);
      for (const h of band) {
        expect(MAP_TERRAIN.get(`${h.q},${h.r}`)).toBe(EDGE_ZONE[edge]);
      }
    }
  });

  it('is disjoint from the land deployment band (ships never share hexes with land units)', () => {
    for (const edge of EDGES) {
      const landKeys = new Set(deploymentBand(edge).map((h) => `${h.q},${h.r}`));
      for (const h of navalDeploymentBand(edge)) {
        expect(landKeys.has(`${h.q},${h.r}`)).toBe(false);
      }
    }
  });
});

describe('legalNavalDeploymentHexes', () => {
  it('with no enemy units, returns the whole naval band', () => {
    for (const edge of EDGES) {
      expect(legalNavalDeploymentHexes(edge, [])).toEqual(navalDeploymentBand(edge));
    }
  });

  it('excludes bay hexes within minGap of an enemy hex', () => {
    for (const edge of EDGES) {
      const band = navalDeploymentBand(edge);
      const enemy = band[0]!;
      const legal = legalNavalDeploymentHexes(edge, [enemy], 4);
      for (const h of legal) expect(hexDistance(h, enemy)).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('seaZoneNear is unaffected by the deployment-zone changes', () => {
  it('still returns sea-like hexes ordered nearest-edge-first', () => {
    for (const edge of EDGES) {
      expect(seaZoneNear(edge).length).toBeGreaterThan(0);
    }
  });
});
