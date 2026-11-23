import type { Motion } from './animationPlan';
import { facingAngleRad } from './hexRender';
import type { HexCoord } from '../data/map';
import type { UnitFigure } from './boardView';

/** One motion playing inside a step: `update` gets the step's elapsed ms, `end` leaves the unit exactly where the motion ends. */
export interface Runner {
  update(elapsedMs: number): void;
  end(): void;
}

/** What a runner needs of a view: where a hex is, a unit's figure (either view's), and removing a faded one for good. */
export interface MotionHost {
  toScreen(hex: HexCoord): { x: number; y: number };
  unit(id: string): UnitFigure | undefined;
  dispose(id: string): void;
}

/** How far a lunge goes toward the target hex, as a fraction of the distance. */
const LUNGE_REACH = 0.35;
const SHAKE_PX = 3;
const SHAKE_CYCLES = 3;

function smooth(p: number): number {
  return p * p * (3 - 2 * p);
}

function progress(elapsed: number, ms: number): number {
  return ms <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / ms));
}

/** Phaser's `Angle.Wrap` formula (to [-pi, pi)), local so this module needs no runtime Phaser (unit tests run in node). */
export function wrapAngle(angle: number): number {
  const range = Math.PI * 2;
  return angle - range * Math.floor((angle + Math.PI) / range);
}

/** The runner for `motion`, or null when its unit is no longer on the display list (or a turn has no facing part). */
export function makeRunner(host: MotionHost, motion: Motion): Runner | null {
  const c = host.unit(motion.unitId);
  if (!c || !c.active) return null;
  const sx = c.x;
  const sy = c.y;
  switch (motion.kind) {
    case 'slide': {
      const to = host.toScreen(motion.to);
      return {
        update: (t) => c.setPosition(sx + (to.x - sx) * smooth(progress(t, motion.ms)), sy + (to.y - sy) * smooth(progress(t, motion.ms))),
        end: () => c.setPosition(to.x, to.y),
      };
    }
    case 'lunge': {
      const to = host.toScreen(motion.toward);
      return {
        // Out and back: sin(pi p) is 0 at both ends and 1 half way.
        update: (t) => {
          const k = Math.sin(Math.PI * progress(t, motion.ms)) * LUNGE_REACH;
          c.setPosition(sx + (to.x - sx) * k, sy + (to.y - sy) * k);
        },
        end: () => c.setPosition(sx, sy),
      };
    }
    case 'turn': {
      // Only the facing part turns: the galley figure (Drawn), the facing mark (Standard, I2: the counter stays upright).
      const fig = c.facingPart;
      if (!fig) return null;
      const start = fig.rotation;
      const target = facingAngleRad(motion.toFacing);
      const delta = wrapAngle(target - start);
      return {
        update: (t) => fig.setRotation(start + delta * smooth(progress(t, motion.ms))),
        end: () => fig.setRotation(target),
      };
    }
    case 'fade': {
      // From the figure's current alpha, so a dimmed unit (§76) does not flash to full first.
      const a0 = c.alpha;
      return {
        update: (t) => c.setAlpha(a0 * (1 - progress(t, motion.ms))),
        end: () => host.dispose(motion.unitId),
      };
    }
    case 'shake':
      return {
        update: (t) => {
          const p = progress(t, motion.ms);
          c.setPosition(sx + Math.sin(p * Math.PI * 2 * SHAKE_CYCLES) * SHAKE_PX * (1 - p), sy);
        },
        end: () => c.setPosition(sx, sy),
      };
  }
}
