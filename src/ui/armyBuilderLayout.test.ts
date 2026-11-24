import { describe, expect, it } from 'vitest';
import { UNIT_TYPES } from '../data/units';
import {
  armyBottomY,
  armyLayoutOffset,
  armyRowSlot,
  armyRowsBottom,
  counterDisplaySize,
  counterTextureKey,
} from './armyBuilderLayout';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { markerTextureKey } from './hexRender';

describe('armyRowSlot', () => {
  it('places 14 indices row-major in two columns', () => {
    for (let i = 0; i < 14; i++) {
      const s = armyRowSlot(i);
      expect(s.column, `column ${i}`).toBe(i % 2);
      expect(s.row, `row ${i}`).toBe(Math.floor(i / 2));
      expect(s.centreY, `y ${i}`).toBe([90, 158, 226, 294, 362, 430, 498][Math.floor(i / 2)]);
      expect(s.x.counter, `x ${i}`).toBe(i % 2 === 0 ? 20 : 565);
    }
    expect(armyRowSlot(1)).toMatchObject({ column: 1, row: 0 });
    expect(armyRowSlot(13)).toMatchObject({ column: 1, row: 6 });
  });

  it('keeps every offset at its literal value', () => {
    for (const cx of [20, 565]) {
      const s = armyRowSlot(cx === 20 ? 0 : 1);
      expect(s.x).toEqual({
        counter: cx,
        name: cx + 66,
        cost: cx + 234,
        clear: cx + 364,
        minus: cx + 394,
        count: cx + 424,
        plus: cx + 454,
        fill: cx + 484,
      });
    }
  });

  it('keeps the columns apart and on the canvas', () => {
    expect(armyRowSlot(0).x.fill + 31).toBeLessThan(armyRowSlot(1).x.counter);
    expect(armyRowSlot(1).x.fill + 31).toBeLessThanOrEqual(1080);
  });

  it('fits the longest name and cost line in their slots', () => {
    const names = [...Object.values(en.units), ...Object.values(fr.units)] as string[];
    const longestName = Math.max(...names.map((n) => n.length));
    const costs: string[] = [];
    for (const u of UNIT_TYPES) {
      costs.push(en.builder.costAndMax(u.cost, u.maxCount), fr.builder.costAndMax(u.cost, u.maxCount));
    }
    const longestCost = Math.max(...costs.map((c) => c.length));
    const s = armyRowSlot(0);
    expect(s.x.cost - s.x.name).toBeGreaterThanOrEqual(0.6 * 15 * longestName);
    expect(s.x.clear - s.x.cost).toBeGreaterThanOrEqual(0.6 * 13 * longestCost);
  });
});

describe('bottom controls', () => {
  it('sit below the rows and inside the canvas', () => {
    const b = armyBottomY(14);
    expect(armyRowsBottom(14)).toBe(532);
    expect(armyRowsBottom(14)).toBeLessThan(b.total);
    expect(b).toEqual({ total: 552, error: 588, confirm: 552 });
    expect(b.error + 1.25 * 13).toBeLessThanOrEqual(750);
    expect(b.confirm + 1.25 * 18 + 2 * 8).toBeLessThanOrEqual(750);
  });
});

describe('counter', () => {
  it('uses the marker key of the building player for every unit type', () => {
    for (let p = 0; p < 4; p++) {
      for (const u of UNIT_TYPES) expect(counterTextureKey(p, u.id)).toBe(markerTextureKey(p, u.id));
    }
    expect(counterTextureKey(1, 'archers')).toContain('-red-');
  });

  it('scales to 60 px tall keeping the aspect', () => {
    for (const [w, h] of [
      [73, 78],
      [74, 76],
    ] as const) {
      const s = counterDisplaySize(w, h);
      expect(s.height).toBe(60);
      expect(s.width).toBeLessThanOrEqual(60);
      expect(s.width).toBeCloseTo((w * 60) / h, 10);
    }
  });
});

describe('armyLayoutOffset and the offset slot (§88)', () => {
  it('centres the 1100-wide block, never negative, rounding down', () => {
    expect(armyLayoutOffset(1100)).toBe(0);
    expect(armyLayoutOffset(1101)).toBe(0);
    expect(armyLayoutOffset(1500)).toBe(200);
    expect(armyLayoutOffset(800)).toBe(0);
  });

  it('adds the offset to every x and leaves y alone', () => {
    for (let i = 0; i < UNIT_TYPES.length; i++) {
      const base = armyRowSlot(i);
      const moved = armyRowSlot(i, 200);
      expect(moved.centreY).toBe(base.centreY);
      for (const key of Object.keys(base.x) as (keyof typeof base.x)[]) expect(moved.x[key]).toBe(base.x[key] + 200);
    }
  });
});
