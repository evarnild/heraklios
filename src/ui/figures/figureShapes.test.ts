import { describe, expect, it } from 'vitest';
import { UNIT_TYPES, getUnitType } from '../../data/units';
import { baseShape, counterBadge, figureFor } from './figureShapes';
import type { Primitive } from './figureShapes';

/** The largest distance from the origin any part of a primitive reaches. */
function reach(p: Primitive): number {
  if (p.kind === 'circle') return Math.hypot(p.x, p.y) + p.r;
  if (p.kind === 'line') return Math.max(Math.hypot(p.x1, p.y1), Math.hypot(p.x2, p.y2));
  return Math.max(...p.points.map(([x, y]) => Math.hypot(x, y)));
}

describe('figureFor', () => {
  it('has a figure for all 14 unit types, each within radius 1', () => {
    expect(UNIT_TYPES).toHaveLength(14);
    for (const t of UNIT_TYPES) {
      const fig = figureFor(t.id);
      expect(fig.primitives.length, t.id).toBeGreaterThan(2);
      for (const p of fig.primitives) expect(reach(p), t.id).toBeLessThanOrEqual(1.0001);
    }
  });

  it('draws the galleys with 1, 2, 3 and 5 oar banks, and land units with none', () => {
    expect(['galeres', 'biremes', 'triremes', 'quintiremes'].map((id) => figureFor(id).oarBanks)).toEqual([1, 2, 3, 5]);
    for (const t of UNIT_TYPES.filter((u) => u.domain === 'land')) expect(figureFor(t.id).oarBanks).toBeUndefined();
  });

  it('gives a galley more oar lines for more banks, bow on +x', () => {
    const lines = (id: string) => figureFor(id).primitives.filter((p) => p.kind === 'line').length;
    expect(lines('biremes')).toBeGreaterThan(lines('galeres'));
    expect(lines('triremes')).toBeGreaterThan(lines('biremes'));
    expect(lines('quintiremes')).toBeGreaterThan(lines('triremes'));
    const hull = figureFor('galeres').primitives[0]!;
    if (hull.kind !== 'polygon') throw new Error('hull is a polygon');
    const tip = hull.points.reduce((a, b) => (b[0] > a[0] ? b : a));
    expect(tip).toEqual([0.95, 0]);
  });

  it('gives no two types the same primitives', () => {
    const seen = new Set<string>();
    for (const t of UNIT_TYPES) seen.add(JSON.stringify(figureFor(t.id).primitives));
    expect(seen.size).toBe(14);
  });

  it('gives an unknown id a plain marker rather than nothing', () => {
    expect(figureFor('nope').primitives).toHaveLength(1);
  });
});

describe('baseShape', () => {
  it('is round, square, diamond and shield for owners 0-3, pairwise different', () => {
    const shapes = [0, 1, 2, 3].map((o) => baseShape(o));
    expect(shapes[0]!.kind).toBe('circle');
    expect(shapes.slice(1).map((s) => (s.kind === 'polygon' ? s.points.length : -1))).toEqual([4, 4, 5]);
    expect(new Set(shapes.map((s) => JSON.stringify(s))).size).toBe(4);
    for (const s of shapes) expect(reach(s)).toBeLessThanOrEqual(1.0001);
  });

  it('wraps owners beyond 3', () => {
    expect(baseShape(4)).toEqual(baseShape(0));
  });
});

describe('counterBadge', () => {
  it('writes the archers as 0 (2) 2 / 1 3', () => {
    expect(counterBadge(getUnitType('archers'))).toBe('0 (2) 2 / 1 3');
  });

  it('writes a unit without range with no parentheses', () => {
    const text = counterBadge(getUnitType('fantassins'));
    expect(text).toBe('2 / 1 3');
    expect(text).not.toContain('(');
  });

  it('follows the stats of all 14 types', () => {
    for (const t of UNIT_TYPES) {
      const expected =
        t.range > 0
          ? `${t.attack} (${t.rangedAttack}) ${t.range} / ${t.defense} ${t.movement}`
          : `${t.attack} / ${t.defense} ${t.movement}`;
      expect(counterBadge(t), t.id).toBe(expected);
    }
  });
});
