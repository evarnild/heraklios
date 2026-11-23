import type Phaser from 'phaser';
import { planDuration } from './animationPlan';
import type { AnimationStep } from './animationPlan';
import { makeRunner } from './unitMotions';
import type { MotionHost, Runner } from './unitMotions';

/** What the animator needs besides the motions' own host: the scene's tweens, and the two ends of a queue. */
export interface AnimatorHost extends MotionHost {
  scene: Phaser.Scene;
  /** Puts every unit figure on its final drawing and drops the ones that were fading out. */
  settleAll(): void;
  /** The queue has drained (played out or cut short). */
  onDrained(): void;
}

/** A queue that never drains (a hidden tab pauses Phaser's clock) still ends: this many times its length, plus a second. */
const WATCHDOG_FACTOR = 2;
const WATCHDOG_EXTRA_MS = 1000;

/**
 * Plays the planner's steps on either view's unit figures (§66, §77), one
 * step at a time. Each step is one counter tween, so `devHook.idle()` (which
 * counts tweens) waits for it and a step ends exactly once. `finishAll` brings
 * every unit to its final drawing at once, and any pointer press or key press
 * anywhere on the page does it first, before Phaser's own handlers see the
 * event (window, capture phase), so a click acts on the finished board (B9).
 * Every waiter is resolved on every exit: drained, cut short, destroyed, or
 * the watchdog, so the computer's driver cannot strand.
 */
export class UnitAnimator {
  private queue: AnimationStep[] = [];
  private current: { tween: Phaser.Tweens.Tween; runners: Runner[] } | null = null;
  private waiters: Array<() => void> = [];
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private readonly onInput = (): void => {
    if (this.active) this.finishAll();
  };

  constructor(private host: AnimatorHost) {
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.onInput, true);
      window.addEventListener('keydown', this.onInput, true);
    }
    // Leaving the Board mid-animation: the scene's tweens die with it, so nothing may wait on them.
    host.scene.events.once('shutdown', () => this.destroy());
  }

  /** An animation is playing or queued. */
  get active(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Queues `steps` after whatever is playing. */
  play(steps: readonly AnimationStep[]): void {
    if (steps.length === 0) return;
    this.queue.push(...steps);
    this.armWatchdog();
    if (!this.current) this.next();
  }

  /** Resolves when the queue has drained; at once if nothing plays. */
  settled(): Promise<void> {
    return this.active ? new Promise((resolve) => this.waiters.push(resolve)) : Promise.resolve();
  }

  /** Every unit to its final drawing, the whole queue (B9, I2). */
  finishAll(): void {
    if (!this.active) return;
    const cur = this.current;
    this.current = null;
    this.queue = [];
    if (cur) {
      cur.tween.stop();
      cur.runners.forEach((r) => r.end());
    }
    this.drain();
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.onInput, true);
      window.removeEventListener('keydown', this.onInput, true);
    }
    this.current?.tween.stop();
    this.current = null;
    this.queue = [];
    this.clearWatchdog();
    this.release();
  }

  private next(): void {
    const step = this.queue.shift();
    if (!step) {
      this.drain();
      return;
    }
    const runners = step.motions.map((m) => makeRunner(this.host, m)).filter((r): r is Runner => r !== null);
    const ms = Math.max(1, ...step.motions.map((m) => m.ms));
    const tween = this.host.scene.tweens.addCounter({
      from: 0,
      to: ms,
      duration: ms,
      onUpdate: (t: Phaser.Tweens.Tween) => runners.forEach((r) => r.update(t.getValue() ?? 0)),
      onComplete: () => {
        this.current = null;
        runners.forEach((r) => r.end());
        this.next();
      },
    });
    this.current = { tween, runners };
  }

  private drain(): void {
    this.clearWatchdog();
    this.host.settleAll();
    this.host.onDrained();
    this.release();
  }

  private release(): void {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve());
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => this.finishAll(), planDuration(this.queue) * WATCHDOG_FACTOR + WATCHDOG_EXTRA_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}
