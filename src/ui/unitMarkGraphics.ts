import type Phaser from 'phaser';
import type { UnitActivity } from '../engine/unitStatus';
import { MARK, markSpec } from './unitMarkSpec';
import type { DotGlyph, DotSpec } from './unitMarkSpec';

/** Strokes of each glyph as line segments in units of the dot radius, centred on the dot. */
const GLYPHS: Record<DotGlyph, readonly (readonly [number, number, number, number])[]> = {
  sword: [
    [-0.6, 0.6, 0.6, -0.6],
    [-0.6, -0.1, 0.1, 0.6],
  ],
  tick: [
    [-0.55, 0.05, -0.15, 0.5],
    [-0.15, 0.5, 0.6, -0.5],
  ],
  cross: [
    [-0.5, -0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5, -0.5],
  ],
};

function drawDot(g: Phaser.GameObjects.Graphics, dot: DotSpec): void {
  const { x, y } = MARK.activity;
  const r = MARK.radius;
  if (dot.shape === 'ring') {
    g.lineStyle(2, dot.fill, 1);
    g.strokeCircle(x, y, r - 1);
    g.lineStyle(1, MARK.outline, 1);
    g.strokeCircle(x, y, r);
    return;
  }
  g.fillStyle(dot.fill, 1);
  if (dot.shape === 'solid') {
    g.fillCircle(x, y, r);
  } else {
    g.fillStyle(MARK.outline, 0.55);
    g.fillCircle(x, y, r);
    g.fillStyle(dot.fill, 1);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI, false);
    g.closePath();
    g.fillPath();
  }
  g.lineStyle(1, MARK.outline, 1);
  g.strokeCircle(x, y, r);
  if (dot.glyph) {
    g.lineStyle(1.5, dot.glyph === 'cross' ? MARK.glyphColor : MARK.glyphColor, 1);
    for (const [x1, y1, x2, y2] of GLYPHS[dot.glyph]) {
      g.lineBetween(x + x1 * r, y + y1 * r, x + x2 * r, y + y2 * r);
    }
  }
}

function drawChevron(g: Phaser.GameObjects.Graphics): void {
  const { x, y } = MARK.charge;
  const r = MARK.radius;
  const points = [
    { x: x - r, y: y + r * 0.6 },
    { x, y: y - r * 0.7 },
    { x: x + r, y: y + r * 0.6 },
  ];
  g.lineStyle(4, MARK.outline, 1);
  g.strokePoints(points, false);
  g.lineStyle(2, MARK.chargeColor, 1);
  g.strokePoints(points, false);
}

/** Redraws one unit's mark onto its (counter-centred, unrotated) `Graphics`. Not unit-tested: the live check. */
export function drawStatusMark(g: Phaser.GameObjects.Graphics, status: UnitActivity | undefined, charged: boolean): void {
  g.clear();
  const spec = markSpec(status, charged);
  if (spec.dot) drawDot(g, spec.dot);
  if (spec.charge) drawChevron(g);
}
