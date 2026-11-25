import { describe, expect, it } from 'vitest';
import type { UnitActivity } from '../engine/unitStatus';
import { MARK, markSpec } from './unitMarkSpec';

const ALL: UnitActivity[] = ['notMoved', 'partlyMoved', 'done', 'canAttack', 'hasAttacked', 'beenAttacked'];

describe('markSpec (§82 B7)', () => {
  it('draws nothing with no status and no charge', () => {
    expect(markSpec(undefined, false)).toEqual({ dot: null, charge: false });
  });

  it('gives every status a distinct look, and not by colour alone among the dots of one colour', () => {
    const looks = ALL.map((a) => {
      const dot = markSpec(a, false).dot!;
      return `${dot.shape}/${dot.fill}/${dot.glyph ?? '-'}`;
    });
    expect(new Set(looks).size).toBe(ALL.length);
    // The three movement dots differ in shape; same-colour combat dots differ by glyph.
    const shapes = (['notMoved', 'partlyMoved', 'done'] as const).map((a) => markSpec(a, false).dot!.shape);
    expect(new Set(shapes).size).toBe(3);
    expect(markSpec('notMoved', false).dot!.fill).toBe(markSpec('canAttack', false).dot!.fill);
    expect(markSpec('canAttack', false).dot!.glyph).toBeDefined();
  });

  it('the charge chevron is independent of the activity and in the opposite corner', () => {
    expect(markSpec(undefined, true)).toEqual({ dot: null, charge: true });
    expect(markSpec('done', true).dot).toEqual(markSpec('done', false).dot);
    expect(Math.sign(MARK.charge.x)).toBe(-Math.sign(MARK.activity.x));
  });
});
