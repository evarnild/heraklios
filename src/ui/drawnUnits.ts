import Phaser from 'phaser';
import { baseShape, figureFor } from './figures/figureShapes';
import type { Primitive, Tone } from './figures/figureShapes';
import { HEX_SIZE, PLAYER_COLORS_HEX, facingAngleRad } from './hexRender';
import { reconcileUnits } from './boardView';
import type { UnitDrawing, UnitMotion, ViewHost } from './boardView';
import { planAnimation } from './animationPlan';
import { animationSpeed } from './animationSpeed';
import { DrawnAnimator } from './drawnAnimator';
import { figureOf } from './drawnMotions';

const INK = 0x20180e;
const PALE = 0xf3ead2;
/** The base radius, and the figure's scale on it. */
const BASE_R = HEX_SIZE * 0.78;
const FIGURE_R = BASE_R * 0.9;
/** A staged (not yet placed) ship is drawn this see-through. */
const GHOST_ALPHA = 0.5;

function ownerColor(owner: number): number {
  return Phaser.Display.Color.HexStringToColor(PLAYER_COLORS_HEX[owner] ?? '#ffffff').color;
}

/** The owner's colour darkened towards ink, so a figure reads on its own base. */
function darker(color: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const mix = (v: number) => Math.round(v * 0.55);
  return Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue));
}

function toneColor(tone: Tone, owner: number): number {
  if (tone === 'body') return darker(ownerColor(owner));
  return tone === 'dark' ? INK : PALE;
}

function drawPrimitive(g: Phaser.GameObjects.Graphics, p: Primitive, s: number, color: number, outline = 1): void {
  if (p.kind === 'circle') {
    g.fillStyle(color, 1);
    g.fillCircle(p.x * s, p.y * s, p.r * s);
    g.lineStyle(outline, INK, 0.9);
    g.strokeCircle(p.x * s, p.y * s, p.r * s);
  } else if (p.kind === 'line') {
    g.lineStyle(p.width, color, 1);
    g.lineBetween(p.x1 * s, p.y1 * s, p.x2 * s, p.y2 * s);
  } else {
    const pts = p.points.map(([x, y]) => new Phaser.Geom.Point(x * s, y * s));
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
    g.lineStyle(outline, INK, 0.9);
    g.strokePoints(pts, true);
  }
}

/** Draws a base (owner colour, dark outline) and a figure into two `Graphics`. */
function drawUnit(base: Phaser.GameObjects.Graphics, fig: Phaser.GameObjects.Graphics, unit: UnitDrawing): void {
  drawPrimitive(base, baseShape(unit.owner), BASE_R, ownerColor(unit.owner), 2);
  for (const p of figureFor(unit.typeId).primitives) {
    drawPrimitive(fig, p, FIGURE_R, toneColor(p.tone, unit.owner));
  }
  // A galley's bow points along +x; rotate it to its facing. The base stays upright.
  fig.setRotation(unit.facing === undefined ? 0 : facingAngleRad(unit.facing));
}

/** The Drawn view's unit layer: one container per unit id (base and figure) at depth 10, reconciled by id like the Standard markers. */
export class DrawnUnits {
  private units = new Map<string, { drawing: UnitDrawing; container: Phaser.GameObjects.Container }>();
  /** Containers of units that are fading out: gone from `units`, still drawn until the fade ends. */
  private departing = new Map<string, Phaser.GameObjects.Container>();
  private animator: DrawnAnimator;

  constructor(
    private host: ViewHost,
    onDrained: () => void,
  ) {
    this.animator = new DrawnAnimator({
      scene: host.scene,
      toScreen: (hex) => host.toScreen(hex),
      container: (id) => this.units.get(id)?.container ?? this.departing.get(id),
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

  /** The staged ship's translucent figure (Placement), outside `units`: it is not a unit. */
  private ghost: Phaser.GameObjects.Container | null = null;

  objects(): Phaser.GameObjects.GameObject[] {
    const all = [...this.units.values()].map((u) => u.container).concat([...this.departing.values()]);
    return this.ghost ? [...all, this.ghost] : all;
  }

  /** Shows (or, with null, removes) the staged ship; rebuilt each call so it follows every Turn. */
  setGhost(drawing: UnitDrawing | null): void {
    this.ghost?.destroy();
    this.ghost = drawing ? this.make(drawing).setAlpha(GHOST_ALPHA) : null;
  }

  inspect(): { unitDrawings: number; ghostRotation: number | null; unitRotations: Record<string, number> } {
    const fig = this.ghost ? figureOf(this.ghost) : undefined;
    const unitRotations: Record<string, number> = {};
    for (const [id, u] of this.units) unitRotations[id] = figureOf(u.container).rotation;
    return { unitDrawings: this.units.size, ghostRotation: fig ? fig.rotation : null, unitRotations };
  }

  /**
   * Draws exactly `units`. A unit that only moved or turned keeps its container
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
    for (const unit of diff.add) this.units.set(unit.id, { drawing: unit, container: this.make(unit) });
    for (const { unit, recreate } of diff.update) {
      const entry = this.units.get(unit.id)!;
      if (recreate) {
        entry.container.destroy();
        this.units.set(unit.id, { drawing: unit, container: this.make(unit) });
      } else {
        entry.drawing = unit;
        // Off, a snap, or a unit the plan leaves alone: straight to the drawing.
        if (steps.length === 0) this.settle(unit.id);
      }
    }
    this.animator.play(steps);
    if (diff.add.length === 0 && diff.update.length === 0) return;
    // Containers share one depth, so display-list order decides which of two
    // stacked units is on top: keep the order of `units`. `bringToTop` never
    // queues a depth sort (Phaser 3.90 List.js); without it the depth-10
    // figures draw over the rings, facings and labels (depths 11-13).
    for (const unit of units) this.host.scene.children.bringToTop(this.units.get(unit.id)!.container);
    this.host.scene.children.queueDepthSort();
  }

  /** Puts one unit's container on its drawing: position, facing, opaque. */
  private settle(id: string): void {
    const entry = this.units.get(id);
    if (!entry?.container.active) return;
    const at = this.host.toScreen(entry.drawing.position);
    entry.container.setPosition(at.x, at.y).setAlpha(1);
    figureOf(entry.container).setRotation(entry.drawing.facing === undefined ? 0 : facingAngleRad(entry.drawing.facing));
  }

  /** Every unit on its final drawing; fading units are gone. Runs when a queue drains or is cut short. */
  private settleAll(): void {
    for (const id of this.units.keys()) this.settle(id);
    for (const id of [...this.departing.keys()]) this.dispose(id);
  }

  /** A removed unit's container stays on the display list while it fades. */
  private depart(id: string): void {
    const entry = this.units.get(id);
    if (!entry) return;
    this.departing.set(id, entry.container);
    this.units.delete(id);
  }

  /** Removes a faded unit's container for good. */
  private dispose(id: string): void {
    this.departing.get(id)?.destroy();
    this.departing.delete(id);
  }

  private remove(id: string): void {
    this.units.get(id)?.container.destroy();
    this.units.delete(id);
  }

  private make(unit: UnitDrawing): Phaser.GameObjects.Container {
    const scene = this.host.scene;
    const at = this.host.toScreen(unit.position);
    const base = scene.make.graphics({}, false);
    const fig = scene.make.graphics({}, false);
    drawUnit(base, fig, unit);
    // I2 (spec §74): the unit's numbers are shown by the hover tooltip, not on the figure, so the
    // container holds no text object.
    // Named by id, so the dev hook can count a unit's (or the ghost's) containers on the display list.
    const container = scene.add.container(at.x, at.y, [base, fig]).setDepth(10).setName(unit.id);
    this.host.ignoreOnUiCamera(container);
    return container;
  }

  destroy(): void {
    this.animator.destroy();
    this.setGhost(null);
    for (const id of [...this.units.keys()]) this.remove(id);
    for (const id of [...this.departing.keys()]) this.dispose(id);
  }
}
