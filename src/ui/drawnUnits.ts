import Phaser from 'phaser';
import { getUnitType } from '../data/units';
import { baseShape, counterBadge, figureFor } from './figures/figureShapes';
import type { Primitive, Tone } from './figures/figureShapes';
import { HEX_SIZE, PLAYER_COLORS_HEX, facingAngleRad } from './hexRender';
import { reconcileUnits } from './boardView';
import type { UnitDrawing, ViewHost } from './boardView';

const INK = 0x20180e;
const PALE = 0xf3ead2;
/** The base radius, and the figure's scale on it. */
const BASE_R = HEX_SIZE * 0.78;
const FIGURE_R = BASE_R * 0.9;

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
  // A galley's bow points along +x; rotate it to its facing. The base and badge stay upright.
  fig.setRotation(unit.facing === undefined ? 0 : facingAngleRad(unit.facing));
}

/** The Drawn view's unit layer: one container per unit id (base, figure and
 * counter badge) at depth 10, reconciled by id like the Standard markers. */
export class DrawnUnits {
  private units = new Map<string, { drawing: UnitDrawing; container: Phaser.GameObjects.Container }>();

  constructor(private host: ViewHost) {}

  objects(): Phaser.GameObjects.GameObject[] {
    return [...this.units.values()].map((u) => u.container);
  }

  setUnits(units: readonly UnitDrawing[]): void {
    const prev = new Map([...this.units].map(([id, u]) => [id, u.drawing]));
    const diff = reconcileUnits(prev, units);
    for (const id of diff.remove) this.remove(id);
    for (const unit of diff.add) this.units.set(unit.id, { drawing: unit, container: this.make(unit) });
    for (const { unit } of diff.update) {
      this.units.get(unit.id)!.container.destroy();
      this.units.set(unit.id, { drawing: unit, container: this.make(unit) });
    }
    if (diff.add.length === 0 && diff.update.length === 0) return;
    // Containers share one depth, so display-list order decides which of two
    // stacked units is on top: keep the order of `units`. `bringToTop` never
    // queues a depth sort (Phaser 3.90 List.js); without it the depth-10
    // figures draw over the rings, facings and labels (depths 11-13).
    for (const unit of units) this.host.scene.children.bringToTop(this.units.get(unit.id)!.container);
    this.host.scene.children.queueDepthSort();
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
    const badge = scene.add
      .text(0, BASE_R * 0.92, counterBadge(getUnitType(unit.typeId)), {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#20180e',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const container = scene.add.container(at.x, at.y, [base, fig, badge]).setDepth(10);
    this.host.ignoreOnUiCamera(container);
    return container;
  }

  destroy(): void {
    for (const id of [...this.units.keys()]) this.remove(id);
  }
}
