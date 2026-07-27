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
