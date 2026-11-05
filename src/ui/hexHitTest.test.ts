import { describe, it, expect } from 'vitest';
import { hexAtPoint } from './hexHitTest';
import { HEX_SIZE, hexPolygonPoints, hexToPixel } from './hexRender';
import { allHexes } from './mapBounds';
import { createSeededRng } from '../engine/rng';

/** Ray-casting containment: the algorithm of `Phaser.Geom.Polygon.Contains`
 * (reimplemented because importing Phaser needs a browser `window`). */
function contains(points: number[], x: number, y: number): boolean {
  let inside = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2]!;
    const yi = points[i * 2 + 1]!;
    const xj = points[j * 2]!;
    const yj = points[j * 2 + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const hexes = allHexes();
const APOTHEM = (HEX_SIZE * Math.sqrt(3)) / 2;

describe('hexAtPoint', () => {
  it('returns the hex for its centre and for points 0.9 of the way to each vertex and edge midpoint', () => {
    for (const hex of hexes) {
      const c = hexToPixel(hex);
      expect(hexAtPoint(c.x, c.y)).toEqual(hex);
      for (let i = 0; i < 6; i++) {
        for (const [angle, dist] of [
          [60 * i, HEX_SIZE],
          [30 + 60 * i, APOTHEM],
        ] as const) {
          const a = (Math.PI / 180) * angle;
          const x = c.x + 0.9 * dist * Math.cos(a);
          const y = c.y + 0.9 * dist * Math.sin(a);
          expect(hexAtPoint(x, y)).toEqual(hex);
        }
      }
    }
  });

  it('returns null just outside the map edge', () => {
    let checked = 0;
    for (const hex of hexes) {
      const c = hexToPixel(hex);
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (30 + 60 * i);
        // the point 1.1 apothems out lies inside the neighbouring hex
        const x = c.x + 1.1 * APOTHEM * Math.cos(a);
        const y = c.y + 1.1 * APOTHEM * Math.sin(a);
        const found = hexAtPoint(x, y);
        const inMap = hexes.some((h) => contains(hexPolygonPoints(hexToPixel(h)), x, y));
        expect(found !== null).toBe(inMap);
        if (found === null) checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('agrees with polygon containment for seeded random points', () => {
    const pixels = hexes.map((h) => hexToPixel(h));
    const minX = Math.min(...pixels.map((p) => p.x)) - HEX_SIZE * 2;
    const maxX = Math.max(...pixels.map((p) => p.x)) + HEX_SIZE * 2;
    const minY = Math.min(...pixels.map((p) => p.y)) - HEX_SIZE * 2;
    const maxY = Math.max(...pixels.map((p) => p.y)) + HEX_SIZE * 2;
    const rng = createSeededRng(65);
    let hits = 0;
    let misses = 0;
    for (let n = 0; n < 1000; n++) {
      const x = minX + rng() * (maxX - minX);
      const y = minY + rng() * (maxY - minY);
      const found = hexAtPoint(x, y);
      if (found) {
        hits++;
        expect(contains(hexPolygonPoints(hexToPixel(found)), x, y)).toBe(true);
      } else {
        misses++;
        for (const hex of hexes) {
          expect(contains(hexPolygonPoints(hexToPixel(hex)), x, y)).toBe(false);
        }
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0);
  });
});
