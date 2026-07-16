import { describe, it, expect } from 'vitest';
import { Camera, nearestNeighbor } from './camera';
import { hexToPixel } from '../ui/hexRender';
import { neighbors } from '../engine/hex';

describe('Camera world/screen transform', () => {
  it('round-trips screenToWorld(worldToScreen(p))', () => {
    const cam = new Camera(120, -40, 1.7);
    const w = { x: 300, y: -55 };
    const s = cam.worldToScreen(w.x, w.y, 800, 600);
    const back = cam.screenToWorld(s.x, s.y, 800, 600);
    expect(back.x).toBeCloseTo(w.x, 6);
    expect(back.y).toBeCloseTo(w.y, 6);
  });
});

describe('nearestNeighbor', () => {
  it('picks the exact neighbor when the point sits on that neighbor', () => {
    const hex = { q: 3, r: -2 };
    for (const n of neighbors(hex)) {
      const p = hexToPixel(n); // point exactly at the neighbor's center
      expect(nearestNeighbor(hex, p)).toEqual(n);
    }
  });

  it('picks the closer neighbor for a point near a shared corner', () => {
    const hex = { q: 0, r: 0 };
    const ns = neighbors(hex);
    const a = hexToPixel(ns[0]!);
    const b = hexToPixel(ns[1]!);
    // a point 90% of the way toward neighbor 0 should still resolve to neighbor 0
    const nearA = { x: a.x * 0.9 + b.x * 0.1, y: a.y * 0.9 + b.y * 0.1 };
    expect(nearestNeighbor(hex, nearA)).toEqual(ns[0]);
  });
});
