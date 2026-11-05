import { describe, expect, it } from 'vitest';
import { MAP_TERRAIN } from '../../data/map';
import { ZONE_TERRAINS, isSeaLike } from '../../data/terrain';
import type { HexCoord } from '../../data/map';
import { allHexes } from '../mapBounds';
import { hexToPixel } from '../hexRender';
import { insideLoops, regionLoops } from './regions';
import { smoothLoop } from './smoothing';

const terrainOf = (h: HexCoord) => MAP_TERRAIN.get(`${h.q},${h.r}`)!;

describe('regionLoops', () => {
  it('outlines a three-hex triangle with exactly 12 vertices', () => {
    const loops = regionLoops([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
    ]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(12);
  });

  it('outlines a single hex with its six vertices', () => {
    const loops = regionLoops([{ q: 3, r: 3 }]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(6);
  });

  it('puts the hex centre inside and a neighbour centre outside', () => {
    const loops = regionLoops([{ q: 3, r: 3 }]);
    expect(insideLoops(hexToPixel({ q: 3, r: 3 }), loops)).toBe(true);
    expect(insideLoops(hexToPixel({ q: 4, r: 3 }), loops)).toBe(false);
  });

  it('closes a region that touches the map edge', () => {
    const edge = allHexes().filter((h) => h.q === 0);
    const loops = regionLoops(edge);
    expect(loops).toHaveLength(1);
    for (const h of allHexes()) expect(insideLoops(hexToPixel(h), loops)).toBe(h.q === 0);
  });

  it('separates every sea-like hex centre from every land centre, raw and smoothed', () => {
    const sea = allHexes().filter((h) => isSeaLike(terrainOf(h)));
    expect(sea.length).toBeGreaterThan(50);
    const raw = regionLoops(sea);
    const smooth = raw.map((l) => smoothLoop(l, 2));
    for (const loops of [raw, smooth]) {
      for (const h of allHexes()) expect(insideLoops(hexToPixel(h), loops), `${h.q},${h.r}`).toBe(isSeaLike(terrainOf(h)));
    }
  });

  it('contains exactly the centres of each zone', () => {
    for (const zone of ZONE_TERRAINS) {
      const members = allHexes().filter((h) => terrainOf(h) === zone);
      expect(members.length).toBeGreaterThan(0);
      const loops = regionLoops(members);
      for (const h of allHexes()) expect(insideLoops(hexToPixel(h), loops)).toBe(terrainOf(h) === zone);
    }
  });
});
