/** How fast the Drawn view animates, remembered like the board view
 * (`boardViewPreference.ts`): in `localStorage`, with the in-memory value kept
 * when storage is unavailable. Not part of a save (§66 B14). */
export type AnimationSpeed = 'normal' | 'slow' | 'off';

export const ANIMATION_SPEED_STORAGE_KEY = 'heraklios.animationSpeed';

/** Button order, one click each: Normal, then Slow, then Off, then Normal again. */
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['normal', 'slow', 'off'];

/** The speed after `speed` in the cycle. */
export function nextAnimationSpeed(speed: AnimationSpeed): AnimationSpeed {
  return ANIMATION_SPEEDS[(ANIMATION_SPEEDS.indexOf(speed) + 1) % ANIMATION_SPEEDS.length]!;
}

/** Only exactly `slow` or `off` is taken; anything else, even a bad value, is Normal. */
export function resolveAnimationSpeed(stored: string | null | undefined): AnimationSpeed {
  return stored === 'slow' || stored === 'off' ? stored : 'normal';
}

/** Step lengths in milliseconds (spec B15). */
export interface StepDurations {
  /** One hex of a slide. */
  hex: number;
  /** One 60 degree turn. */
  turn: number;
  /** A clash: lunge out and back. */
  clash: number;
  /** A ram: lunge out and back. */
  ram: number;
  fade: number;
  shake: number;
}

const NORMAL: StepDurations = { hex: 180, turn: 120, clash: 350, ram: 400, fade: 300, shake: 200 };

/** The durations at `speed`: Slow is exactly twice Normal; Off is null, no animation at all. */
export function durationsFor(speed: AnimationSpeed): StepDurations | null {
  if (speed === 'off') return null;
  const k = speed === 'slow' ? 2 : 1;
  return {
    hex: NORMAL.hex * k,
    turn: NORMAL.turn * k,
    clash: NORMAL.clash * k,
    ram: NORMAL.ram * k,
    fade: NORMAL.fade * k,
    shake: NORMAL.shake * k,
  };
}

function readStored(): string | null {
  try {
    return localStorage.getItem(ANIMATION_SPEED_STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: AnimationSpeed | null = null;

export function animationSpeed(): AnimationSpeed {
  if (current === null) current = resolveAnimationSpeed(readStored());
  return current;
}

/** Sets and remembers the speed. If storage is unavailable the choice still holds for the session. */
export function setAnimationSpeed(speed: AnimationSpeed): void {
  current = speed;
  try {
    localStorage.setItem(ANIMATION_SPEED_STORAGE_KEY, speed);
  } catch {
    // Private mode / blocked storage: the in-memory choice is enough.
  }
}

/** Forgets the in-memory choice so the next read goes to storage again (tests). */
export function resetAnimationSpeedForTests(): void {
  current = null;
}
