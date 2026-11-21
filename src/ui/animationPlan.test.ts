import { describe, expect, it } from 'vitest';
import type { ActionCue } from '../engine/actionCue';
import { planAnimation, planDuration } from './animationPlan';
import type { Motion } from './animationPlan';
import type { UnitDrawing } from './boardView';

function u(id: string, q: number, r: number, facing?: number, typeId = 'fantassins', owner = 0): UnitDrawing {
  return { id, typeId, owner, position: { q, r }, facing };
}

function drawn(...units: UnitDrawing[]): Map<string, UnitDrawing> {
  return new Map(units.map((x) => [x.id, x]));
}

const NO_CUE = null;
const empty = (over: Partial<ActionCue>): ActionCue => ({ moves: [], clashes: [], shakes: [], ...over });
const kinds = (steps: { motions: Motion[] }[]) => steps.map((s) => s.motions.map((m) => m.kind));

describe('planAnimation (AC4)', () => {
  it('equal drawings and no cue play nothing (B8)', () => {
    const a = [u('a', 1, 1), u('b', 2, 2)];
    expect(planAnimation(drawn(...a), a, NO_CUE, 'normal')).toEqual([]);
  });

  it('a cued path is one slide per hex, in order, at the hex duration', () => {
    const cue = empty({ moves: [{ unitId: 'a', steps: [{ hex: { q: 2, r: 1 } }, { hex: { q: 3, r: 1 } }, { hex: { q: 4, r: 1 } }] }] });
    const steps = planAnimation(drawn(u('a', 1, 1)), [u('a', 4, 1)], cue, 'normal');
    expect(steps.map((s) => s.motions)).toEqual([
      [{ kind: 'slide', unitId: 'a', to: { q: 2, r: 1 }, ms: 180 }],
      [{ kind: 'slide', unitId: 'a', to: { q: 3, r: 1 }, ms: 180 }],
      [{ kind: 'slide', unitId: 'a', to: { q: 4, r: 1 }, ms: 180 }],
    ]);
  });

  it('a move with no cue is one straight slide, however far', () => {
    const steps = planAnimation(drawn(u('a', 1, 1)), [u('a', 5, 1)], NO_CUE, 'normal');
    expect(steps).toHaveLength(1);
    expect(steps[0]!.motions).toEqual([{ kind: 'slide', unitId: 'a', to: { q: 5, r: 1 }, ms: 180 }]);
  });

  it('a cue that does not end at the drawn hex is ignored for the default slide', () => {
    const cue = empty({ moves: [{ unitId: 'a', steps: [{ hex: { q: 2, r: 1 } }] }] });
    const steps = planAnimation(drawn(u('a', 1, 1)), [u('a', 5, 1)], cue, 'normal');
    expect(steps.map((s) => s.motions)).toEqual([[{ kind: 'slide', unitId: 'a', to: { q: 5, r: 1 }, ms: 180 }]]);
  });

  it('a swap slides both units in the same step', () => {
    const cue = empty({
      moves: [
        { unitId: 'a', steps: [{ hex: { q: 2, r: 1 } }] },
        { unitId: 'b', steps: [{ hex: { q: 1, r: 1 } }] },
      ],
    });
    const steps = planAnimation(drawn(u('a', 1, 1), u('b', 2, 1)), [u('a', 2, 1), u('b', 1, 1)], cue, 'normal');
    expect(steps).toHaveLength(1);
    expect(steps[0]!.motions.map((m) => m.unitId).sort()).toEqual(['a', 'b']);
  });

  it('a facing change is a turn, 120 ms per 60 degrees', () => {
    const steps = planAnimation(drawn(u('s', 1, 1, 0, 'biremes')), [u('s', 1, 1, 5, 'biremes')], NO_CUE, 'normal');
    expect(steps.map((s) => s.motions)).toEqual([[{ kind: 'turn', unitId: 's', toFacing: 5, ms: 120 }]]);
    const half = planAnimation(drawn(u('s', 1, 1, 0, 'biremes')), [u('s', 1, 1, 3, 'biremes')], NO_CUE, 'normal');
    expect(half[0]!.motions[0]).toMatchObject({ kind: 'turn', ms: 360 });
  });

  it('a ship path turns in place and slides ahead, in order', () => {
    const cue = empty({
      moves: [{ unitId: 's', steps: [{ hex: { q: 1, r: 1 }, facing: 1 }, { hex: { q: 1, r: 2 }, facing: 1 }] }],
    });
    const steps = planAnimation(drawn(u('s', 1, 1, 0, 'biremes')), [u('s', 1, 2, 1, 'biremes')], cue, 'normal');
    expect(kinds(steps)).toEqual([['turn'], ['slide']]);
  });

  it('a removed unit fades after the clash', () => {
    const cue = empty({ clashes: [{ unitId: 'a', toward: { q: 2, r: 1 }, kind: 'clash' }] });
    const steps = planAnimation(drawn(u('a', 1, 1), u('d', 2, 1, undefined, 'fantassins', 1)), [u('a', 1, 1)], cue, 'normal');
    expect(kinds(steps)).toEqual([['lunge'], ['fade']]);
    expect(steps[0]!.motions[0]).toMatchObject({ ms: 350 });
    expect(steps[1]!.motions[0]).toMatchObject({ unitId: 'd', ms: 300 });
  });

  it('a ram lunges for 400 ms; a miss shakes the survivor; drawings equal but the cue plays', () => {
    const cue = empty({ clashes: [{ unitId: 'r', toward: { q: 2, r: 1 }, kind: 'ram' }], shakes: ['t'] });
    const both = [u('r', 1, 1, 0, 'galeres'), u('t', 2, 1, 3, 'biremes', 1)];
    const steps = planAnimation(drawn(...both), both, cue, 'normal');
    expect(kinds(steps)).toEqual([['lunge'], ['shake']]);
    expect(steps[0]!.motions[0]!.ms).toBe(400);
    expect(steps[1]!.motions[0]).toMatchObject({ unitId: 't', ms: 200 });
  });

  it('an added unit and a recreated unit show at once', () => {
    expect(planAnimation(drawn(u('a', 1, 1)), [u('a', 1, 1), u('n', 3, 3)], NO_CUE, 'normal')).toEqual([]);
    expect(planAnimation(drawn(u('a', 1, 1)), [u('a', 2, 1, undefined, 'archers')], NO_CUE, 'normal')).toEqual([]);
  });

  it('Off plays nothing, even with a cue', () => {
    const cue = empty({ clashes: [{ unitId: 'a', toward: { q: 2, r: 1 }, kind: 'clash' }] });
    expect(planAnimation(drawn(u('a', 1, 1)), [u('a', 3, 1)], cue, 'off')).toEqual([]);
  });

  it('the clash plays before the moves (step 0 lunge, step 1 slide)', () => {
    const cue = empty({ clashes: [{ unitId: 'a', toward: { q: 2, r: 1 }, kind: 'clash' }] });
    const steps = planAnimation(drawn(u('a', 1, 1), u('m', 5, 5)), [u('a', 1, 1), u('m', 6, 5)], cue, 'normal');
    expect(kinds(steps)).toEqual([['lunge'], ['slide']]);
  });

  it('a plan of several steps lasts the sum of its step maxima (clash 350 + slide 180 + fade 300)', () => {
    const cue = empty({ clashes: [{ unitId: 'a', toward: { q: 2, r: 1 }, kind: 'clash' }] });
    const steps = planAnimation(drawn(u('a', 1, 1), u('m', 5, 5), u('d', 9, 9)), [u('a', 1, 1), u('m', 6, 5)], cue, 'normal');
    expect(kinds(steps)).toEqual([['lunge'], ['slide'], ['fade']]);
    expect(planDuration(steps)).toBe(830);
  });

  it('a clash by a unit that is not drawn plays no lunge', () => {
    const cue = empty({ clashes: [{ unitId: 'ghost', toward: { q: 2, r: 1 }, kind: 'clash' }] });
    const both = [u('a', 1, 1)];
    expect(planAnimation(drawn(...both), both, cue, 'normal')).toEqual([]);
  });

  it('a shake for a unit that is gone plays the fade only', () => {
    const cue = empty({ shakes: ['g'] });
    const steps = planAnimation(drawn(u('a', 1, 1), u('g', 2, 2)), [u('a', 1, 1)], cue, 'normal');
    expect(steps.map((s) => s.motions.map((m) => m.kind))).toEqual([['fade']]);
  });

  it('every Slow duration is twice Normal', () => {
    const cue = empty({
      clashes: [{ unitId: 'a', toward: { q: 2, r: 1 }, kind: 'clash' }],
      moves: [{ unitId: 'a', steps: [{ hex: { q: 2, r: 1 } }] }],
      shakes: ['a'],
    });
    const prev = drawn(u('a', 1, 1), u('d', 9, 9));
    const next = [u('a', 2, 1)];
    const normal = planAnimation(prev, next, cue, 'normal');
    const slow = planAnimation(prev, next, cue, 'slow');
    expect(kinds(slow)).toEqual(kinds(normal));
    expect(planDuration(slow)).toBe(planDuration(normal) * 2);
    slow.forEach((s, i) => s.motions.forEach((m, j) => expect(m.ms).toBe(normal[i]!.motions[j]!.ms * 2)));
  });
});
