import Phaser from 'phaser';
import { HEX_SIZE, hexPolygonPoints, facingAngleRad } from './hexRender';

/**
 * Draws one arrowhead triangle at `center`, pointing in `facing`'s bow
 * direction (see `facingAngleRad`). The shared drawing primitive behind
 * `setFacingIndicators` (one arrow per ship, hex-positioned via `toScreen`)
 * AND the Movement/Placement Turn buttons' post-turn facing glyph
 * (`BoardScene.ts`/`PlacementScene.ts`, screen-positioned, unrelated to any
 * hex — plan.md §17.2) — a free function rather than a view method
 * since the button glyph has no hex or camera to go through, only a fixed
 * screen point. `scale` shrinks the whole triangle proportionally: a
 * button-sized icon doesn't want a full ship-sized arrowhead.
 */
export function drawFacingArrowhead(
  graphics: Phaser.GameObjects.Graphics,
  center: { x: number; y: number },
  facing: number,
  colorHex: string,
  scale = 1,
): void {
  const angle = facingAngleRad(facing);
  const tipRadius = HEX_SIZE * 0.95 * scale;
  const backRadius = HEX_SIZE * 0.5 * scale;
  const spread = 0.4; // radians half-width of the arrowhead's back edge

  const tip = { x: center.x + tipRadius * Math.cos(angle), y: center.y + tipRadius * Math.sin(angle) };
  const backLeft = {
    x: center.x + backRadius * Math.cos(angle + spread),
    y: center.y + backRadius * Math.sin(angle + spread),
  };
  const backRight = {
    x: center.x + backRadius * Math.cos(angle - spread),
    y: center.y + backRadius * Math.sin(angle - spread),
  };

  const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
  graphics.fillStyle(color, 1);
  graphics.lineStyle(1.5, 0x1a1408, 0.9);
  graphics.beginPath();
  graphics.moveTo(tip.x, tip.y);
  graphics.lineTo(backLeft.x, backLeft.y);
  graphics.lineTo(backRight.x, backRight.y);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

export function hexPolygonPointsAt(center: { x: number; y: number }): number[] {
  return hexPolygonPoints(center);
}

export function toVec(points: number[]): Phaser.Geom.Point[] {
  const vecs: Phaser.Geom.Point[] = [];
  for (let i = 0; i < points.length; i += 2) {
    vecs.push(new Phaser.Geom.Point(points[i]!, points[i + 1]!));
  }
  return vecs;
}
