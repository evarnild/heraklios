import type { HexCoord } from '../data/map';
import type { ActionCue } from '../engine/actionCue';
import { facingRotationCost, hexEquals } from '../engine/hex';
import { reconcileUnits } from './boardView';
import type { UnitDrawing } from './boardView';
import { durationsFor } from './animationSpeed';
import type { AnimationSpeed } from './animationSpeed';

/**
 * The animation planner for both views (§66, §77): pure, no Phaser. From what is
 * drawn now, what is wanted, an optional cue and the speed, it lists what to
 * play, in order. It animates the difference between successive committed
 * drawings (spec I1) and nothing re-derives a rule: the cue only adds the path
 * a unit took, who clashed and who shakes.
 */
export type Motion =
  | { kind: 'slide'; unitId: string; to: HexCoord; ms: number }
  | { kind: 'turn'; unitId: string; toFacing: number; ms: number }
  /** Out part-way toward `toward` and back; a ram and a clash differ only in length. */
  | { kind: 'lunge'; unitId: string; toward: HexCoord; ms: number }
  | { kind: 'fade'; unitId: string; ms: number }
  | { kind: 'shake'; unitId: string; ms: number };

/** The motions of one step play together; steps play one after another. */
export interface AnimationStep {
  motions: Motion[];
}

/** The slides and turns of one unit's cued path, ending where it is drawn next, or null when the cue does not fit. */
function cuedMotions(
  cue: ActionCue,
  old: UnitDrawing,
  target: UnitDrawing,
  hexMs: number,
  turnMs: number,
): Motion[] | null {
  const move = cue.moves.find((m) => m.unitId === target.id);
  const last = move?.steps[move.steps.length - 1];
  if (!move || !last || !hexEquals(last.hex, target.position)) return null;
  const out: Motion[] = [];
  let hex = old.position;
  let facing = old.facing;
  for (const step of move.steps) {
    if (step.facing !== undefined && facing !== undefined && step.facing !== facing) {
      out.push({ kind: 'turn', unitId: target.id, toFacing: step.facing, ms: turnMs * facingRotationCost(facing, step.facing) });
    }
    if (!hexEquals(step.hex, hex)) out.push({ kind: 'slide', unitId: target.id, to: step.hex, ms: hexMs });
    hex = step.hex;
    facing = step.facing ?? facing;
  }
  return out;
}

/** The default for a unit that changed with no cue (a retreat, push or advance): straight to the new hex, then a turn. */
function defaultMotions(old: UnitDrawing, target: UnitDrawing, hexMs: number, turnMs: number): Motion[] {
  const out: Motion[] = [];
  if (!hexEquals(old.position, target.position)) out.push({ kind: 'slide', unitId: target.id, to: target.position, ms: hexMs });
  if (old.facing !== undefined && target.facing !== undefined && old.facing !== target.facing) {
    out.push({ kind: 'turn', unitId: target.id, toFacing: target.facing, ms: turnMs * facingRotationCost(old.facing, target.facing) });
  }
  return out;
}

/** Merges per-unit motion lists into steps: step i holds each unit's i-th motion, so a swap's two slides run together. */
function interleave(perUnit: Motion[][]): AnimationStep[] {
  const steps: AnimationStep[] = [];
  const longest = Math.max(0, ...perUnit.map((m) => m.length));
  for (let i = 0; i < longest; i++) {
    steps.push({ motions: perUnit.flatMap((m) => (m[i] ? [m[i]!] : [])) });
  }
  return steps;
}

/**
 * The steps to play for a change from `prev` (by id, as drawn) to `next`.
 * Order: the clash, then the moves, then fades and shakes together. A unit
 * whose type or owner changed, and a unit that appears, show at once (B5);
 * Off plays nothing; drawings that are equal, with no cue, play nothing (B8).
 * Pure: the same inputs give the same steps.
 */
export function planAnimation(
  prev: ReadonlyMap<string, UnitDrawing>,
  next: readonly UnitDrawing[],
  cue: ActionCue | null,
  speed: AnimationSpeed,
): AnimationStep[] {
  const d = durationsFor(speed);
  if (!d) return [];
  const diff = reconcileUnits(prev, next);
  const steps: AnimationStep[] = [];

  if (cue && cue.clashes.length > 0) {
    steps.push({
      motions: cue.clashes
        .filter((c) => prev.has(c.unitId))
        .map((c): Motion => ({ kind: 'lunge', unitId: c.unitId, toward: c.toward, ms: c.kind === 'ram' ? d.ram : d.clash })),
    });
  }

  const perUnit: Motion[][] = [];
  for (const { unit, recreate } of diff.update) {
    if (recreate) continue;
    const old = prev.get(unit.id)!;
    perUnit.push((cue && cuedMotions(cue, old, unit, d.hex, d.turn)) || defaultMotions(old, unit, d.hex, d.turn));
  }
  steps.push(...interleave(perUnit));

  const results: Motion[] = [
    ...diff.remove.map((id): Motion => ({ kind: 'fade', unitId: id, ms: d.fade })),
    ...(cue?.shakes ?? []).filter((id) => next.some((u) => u.id === id)).map((id): Motion => ({ kind: 'shake', unitId: id, ms: d.shake })),
  ];
  if (results.length > 0) steps.push({ motions: results });
  return steps.filter((s) => s.motions.length > 0);
}

/** Total length of a plan in ms: the sum over steps of the longest motion in each. */
export function planDuration(steps: readonly AnimationStep[]): number {
  return steps.reduce((sum, s) => sum + Math.max(0, ...s.motions.map((m) => m.ms)), 0);
}
