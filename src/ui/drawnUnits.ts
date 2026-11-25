import Phaser from 'phaser';
import { baseShape, figureFor } from './figures/figureShapes';
import type { Primitive, Tone } from './figures/figureShapes';
import { HEX_SIZE, PLAYER_COLORS_HEX, facingAngleRad } from './hexRender';
import type { UnitDrawing, UnitMark, UnitMotion, ViewHost } from './boardView';
import { UnitLayer } from './unitLayer';
import { drawStatusMark } from './unitMarkGraphics';
import type { LayerFigure } from './unitLayer';

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

/** The container's figure layer (base 0, figure 1, badge 2; see `DrawnUnits.make`). */
export function figureOf(container: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
  return container.list[1] as Phaser.GameObjects.Graphics;
}

/** A Drawn unit's container as the shared layer's figure: a turn rotates the galley figure, never the base. */
function containerFigure(container: Phaser.GameObjects.Container): LayerFigure & { container: Phaser.GameObjects.Container } {
  return {
    container,
    get active() {
      return container.active;
    },
    get x() {
      return container.x;
    },
    get y() {
      return container.y;
    },
    get alpha() {
      return container.alpha;
    },
    setPosition: (x, y) => void container.setPosition(x, y),
    setAlpha: (alpha) => void container.setAlpha(alpha),
    markAt: () => ({ x: container.x, y: container.y }),
    facingPart: figureOf(container),
    // §82: the mark is the container's third child, so it moves, fades and shakes with it and never turns.
    setStatus: (status, charged) => drawStatusMark(container.list[2] as Phaser.GameObjects.Graphics, status, charged),
    objects: () => [container],
    destroy: () => container.destroy(),
  };
}

/**
 * The Drawn view's unit layer: one container per unit id (base and figure) at
 * depth 10. The reconcile, animate and settle bookkeeping is the shared
 * `UnitLayer` (§77); this class only says how to draw a figure, and keeps the
 * staged ship's ghost.
 */
export class DrawnUnits {
  private layer: UnitLayer<ReturnType<typeof containerFigure>>;
  /** The staged ship's translucent figure (Placement), outside the layer: it is not a unit. */
  private ghost: Phaser.GameObjects.Container | null = null;

  constructor(
    private host: ViewHost,
    onDrained: () => void,
  ) {
    this.layer = new UnitLayer(host, (unit) => containerFigure(this.make(unit)), onDrained);
  }

  /** An animation is playing or queued. */
  get animating(): boolean {
    return this.layer.animating;
  }

  marks(): Record<string, UnitMark> {
    return this.layer.marks();
  }

  finishAnimations(): void {
    this.layer.finishAnimations();
  }

  animationsSettled(): Promise<void> {
    return this.layer.animationsSettled();
  }

  objects(): Phaser.GameObjects.GameObject[] {
    const all = this.layer.objects();
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
    const figures = this.layer.figures();
    for (const [id, f] of figures) unitRotations[id] = figureOf(f.container).rotation;
    return { unitDrawings: figures.size, ghostRotation: fig ? fig.rotation : null, unitRotations };
  }

  /** See `UnitLayer.setUnits`. */
  setUnits(units: readonly UnitDrawing[], motion: UnitMotion = null): void {
    this.layer.setUnits(units, motion);
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
    const badge = scene.make.graphics({}, false);
    const container = scene.add.container(at.x, at.y, [base, fig, badge]).setDepth(10).setName(unit.id);
    this.host.ignoreOnUiCamera(container);
    return container;
  }

  destroy(): void {
    this.layer.destroy();
    this.setGhost(null);
  }
}
