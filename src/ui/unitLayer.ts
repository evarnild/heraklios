import type Phaser from 'phaser';
import { reconcileUnits, unitAlpha } from './boardView';
import type { UnitDrawing, UnitFigure, UnitMotion, ViewHost } from './boardView';
import { planAnimation } from './animationPlan';
import { animationSpeed } from './animationSpeed';
import { facingAngleRad } from './hexRender';
import { UnitAnimator } from './unitAnimator';

/** A figure the layer owns: what the motions need, plus the display objects it is made of. */
export interface LayerFigure extends UnitFigure {
  /** Every display object of the figure; the first is the one restacked to keep `units`' order. */
  objects(): Phaser.GameObjects.GameObject[];
  destroy(): void;
}

/**
 * A figure made of a lead object (the Standard counter) and a follower kept
 * on it (its facing mark). Position and alpha reach both, so the mark slides,
 * lunges, shakes and fades with its counter (§77 B6, I1). Only the follower
 * turns (`facingPart`), so the counter image stays upright (B7, I2). With no
 * follower (a land unit) there is no facing part.
 */
export function jointFigure(
  lead: Phaser.GameObjects.Image | Phaser.GameObjects.Text,
  follower: Phaser.GameObjects.Graphics | null,
): LayerFigure {
  return {
    get active() {
      return lead.active;
    },
    get x() {
      return lead.x;
    },
    get y() {
      return lead.y;
    },
    get alpha() {
      return lead.alpha;
    },
    setPosition(x, y) {
      lead.setPosition(x, y);
      follower?.setPosition(x, y);
    },
    setAlpha(alpha) {
      lead.setAlpha(alpha);
      follower?.setAlpha(alpha);
    },
    facingPart: follower,
    objects: () => (follower ? [lead, follower] : [lead]),
    destroy() {
      lead.destroy();
      follower?.destroy();
    },
  };
}

/**
 * One board view's unit layer, minus the drawing (§77): the per-id figures,
 * the ones fading out, and the one animator. It reconciles by id, plans,
 * plays, settles and disposes for whichever view supplies `make`. The Drawn
 * view's containers and the Standard view's counters both run through it, so
 * the planner, the queue and the curves stay single copies (I4).
 */
export class UnitLayer<F extends LayerFigure> {
  private units = new Map<string, { drawing: UnitDrawing; figure: F }>();
  /** Figures of units that are fading out: gone from `units`, still drawn until the fade ends. */
  private departing = new Map<string, F>();
  private animator: UnitAnimator;

  constructor(
    private host: ViewHost,
    private make: (unit: UnitDrawing) => F,
    onDrained: () => void,
  ) {
    this.animator = new UnitAnimator({
      scene: host.scene,
      toScreen: (hex) => host.toScreen(hex),
      unit: (id) => this.units.get(id)?.figure ?? this.departing.get(id),
      dispose: (id) => this.dispose(id),
      settleAll: () => this.settleAll(),
      onDrained,
    });
  }

  /** An animation is playing or queued. */
  get animating(): boolean {
    return this.animator.active;
  }

  finishAnimations(): void {
    this.animator.finishAll();
  }

  animationsSettled(): Promise<void> {
    return this.animator.settled();
  }

  /** The figures of the units now drawn, by id (not the fading ones). */
  figures(): ReadonlyMap<string, F> {
    return new Map([...this.units].map(([id, u]) => [id, u.figure]));
  }

  objects(): Phaser.GameObjects.GameObject[] {
    const all = [...this.units.values()].map((u) => u.figure).concat([...this.departing.values()]);
    return all.flatMap((f) => f.objects());
  }

  /** A new figure at its resting alpha (never a hard 1: §76 dims earlier seats). */
  private build(unit: UnitDrawing): F {
    const figure = this.make(unit);
    figure.setAlpha(unitAlpha(unit));
    return figure;
  }

  /**
   * Draws exactly `units`. A unit that only moved or turned keeps its figure
   * and the animator slides it (§66); a type or owner change rebuilds it; a
   * unit that disappears fades first when the plan says so. `'snap'` finishes
   * any animation and draws at once (B7), and so does Off (the plan is empty).
   * Equal drawings change and play nothing (B8).
   */
  setUnits(units: readonly UnitDrawing[], motion: UnitMotion = null): void {
    if (motion === 'snap') this.animator.finishAll();
    const prev = new Map([...this.units].map(([id, u]) => [id, u.drawing]));
    const steps = motion === 'snap' ? [] : planAnimation(prev, units, motion, animationSpeed());
    const fading = new Set(steps.flatMap((s) => s.motions.filter((m) => m.kind === 'fade').map((m) => m.unitId)));
    const diff = reconcileUnits(prev, units);
    for (const id of diff.remove) {
      if (fading.has(id)) this.depart(id);
      else this.remove(id);
    }
    for (const unit of diff.add) this.units.set(unit.id, { drawing: unit, figure: this.build(unit) });
    for (const { unit, recreate } of diff.update) {
      const entry = this.units.get(unit.id)!;
      if (recreate) {
        entry.figure.destroy();
        this.units.set(unit.id, { drawing: unit, figure: this.build(unit) });
      } else {
        entry.drawing = unit;
        // Off, a snap, or a unit the plan leaves alone: straight to the drawing.
        if (steps.length === 0) this.settle(unit.id);
      }
    }
    this.animator.play(steps);
    if (diff.add.length === 0 && diff.update.length === 0) return;
    // Figures share one depth, so display-list order decides which of two
    // stacked units is on top: keep the order of `units`. `bringToTop` never
    // queues a depth sort (Phaser 3.90 List.js); without it the depth-10
    // figures draw over the rings, facings and labels (depths 11-13).
    for (const unit of units) this.host.scene.children.bringToTop(this.units.get(unit.id)!.figure.objects()[0]!);
    this.host.scene.children.queueDepthSort();
  }

  /** Puts one unit's figure on its drawing: position, facing, resting alpha (the unit's own, never a hard 1). */
  private settle(id: string): void {
    const entry = this.units.get(id);
    if (!entry?.figure.active) return;
    const at = this.host.toScreen(entry.drawing.position);
    entry.figure.setPosition(at.x, at.y);
    entry.figure.setAlpha(unitAlpha(entry.drawing));
    entry.figure.facingPart?.setRotation(entry.drawing.facing === undefined ? 0 : facingAngleRad(entry.drawing.facing));
  }

  /** Every unit on its final drawing; fading units are gone. Runs when a queue drains or is cut short. */
  private settleAll(): void {
    for (const id of this.units.keys()) this.settle(id);
    for (const id of [...this.departing.keys()]) this.dispose(id);
  }

  /** A removed unit's figure stays on the display list while it fades. */
  private depart(id: string): void {
    const entry = this.units.get(id);
    if (!entry) return;
    this.departing.set(id, entry.figure);
    this.units.delete(id);
  }

  /** Removes a faded unit's figure for good. */
  private dispose(id: string): void {
    this.departing.get(id)?.destroy();
    this.departing.delete(id);
  }

  private remove(id: string): void {
    this.units.get(id)?.figure.destroy();
    this.units.delete(id);
  }

  destroy(): void {
    this.animator.destroy();
    for (const id of [...this.units.keys()]) this.remove(id);
    for (const id of [...this.departing.keys()]) this.dispose(id);
  }
}
