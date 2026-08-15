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
  // in some N/S columns and 3 in others; on E/W, using the raw un-merged
  // 2r+q bucket, which skipped every other depth layer and made the band
  // twice as deep as intended; and a live defect where a bucket whose
  // nearest hexes were coast/sea let the walk tunnel past them at no cost
  // and reach land far past the true 3-hex-deep strip — see depthBand's
  // doc comment).
  function bucketOf(edge: Edge, h: HexCoord): number {
    return edge === 'N' || edge === 'S' ? h.q : Math.floor((2 * h.r + h.q) / 2);
  }

  function allBuckets(edge: Edge): Map<number, HexCoord[]> {
    const buckets = new Map<number, HexCoord[]>();
    for (const h of allHexes()) {
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
  // count below examines up to 3 hexes outward from the edge — land, coast,
  // or sea alike — stopping at the first coordinate gap, and counts only the
  // land ones among those examined: it must NOT keep examining past 3 just
  // because the near hexes are non-land, or it degenerates back into the bug
  // this test guards (walking clear across a bay to reach unrelated land).
  function depthOf(edge: Edge, h: HexCoord): number {
    if (edge === 'N') return h.r;
    if (edge === 'S') return -h.r;
    return edge === 'W' ? h.q : -h.q;
  }

  function expectedLandCount(edge: Edge, bucketHexes: HexCoord[]): number {
    const sorted = [...bucketHexes].sort((a, b) => depthOf(edge, a) - depthOf(edge, b));
    let examined = 0;
    let landCount = 0;
    let previous: number | null = null;
    for (const h of sorted) {
      if (examined >= 3) break;
      const d = depthOf(edge, h);
      if (previous !== null && d - previous > 1) break;
      const t = MAP_TERRAIN.get(`${h.q},${h.r}`);
      if (t !== undefined && !isSeaLike(t) && t !== 'coast') landCount++;
      previous = d;
      examined++;
    }
    return landCount;
  }

  it('every bucket has the nearest contiguous hexes (capped at 3), never leaping a water gap', () => {
    for (const edge of EDGES) {
      const buckets = allBuckets(edge);
      const band = deploymentBand(edge);
      const bandByBucket = new Map<number, HexCoord[]>();
      for (const h of band) {
        const bucket = bucketOf(edge, h);
        const list = bandByBucket.get(bucket);
        if (list) list.push(h);
        else bandByBucket.set(bucket, [h]);
      }

      for (const [bucket, list] of buckets) {
        const expected = expectedLandCount(edge, list);
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

describe('deploymentBand does not tunnel across a bay to reach unrelated land', () => {
  // Live defect: a player deploying on the east edge could be offered hexes
  // as far away as column 22, because rows whose nearest 1-3 hexes were
  // coast/sea (the fringe of the Cap Zénon and Pointe d'Eole bays) let the
  // walk pass through them for free and keep going until it found land. The
  // map's actual east edge is columns 40-42.
  it('the east band only ever uses columns 40-42', () => {
    const band = deploymentBand('E');
    for (const h of band) expect(h.q).toBeGreaterThanOrEqual(40);
  });

  it('none of the specific far-inland hexes from the bug report are offered', () => {
    const band = deploymentBand('E');
    const keys = new Set(band.map((h) => `${h.q},${h.r}`));
    const reportedBad: HexCoord[] = [
      { q: 39, r: 1 },
      { q: 38, r: 1 },
      { q: 38, r: 2 },
      { q: 39, r: 2 },
      { q: 38, r: 3 },
      { q: 37, r: 3 },
      { q: 36, r: 4 },
      { q: 37, r: 4 },
      { q: 36, r: 5 },
      { q: 22, r: 13 },
    ];
    for (const h of reportedBad) expect(keys.has(`${h.q},${h.r}`)).toBe(false);
    expect(keys.has('40,0')).toBe(true);
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
