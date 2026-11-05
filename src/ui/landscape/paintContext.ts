import type Phaser from 'phaser';
import type { Point } from './geometry';

/**
 * A thin drawing helper over one `Graphics` object, in `hexToPixel` space.
 * Every coordinate and line width is multiplied by `scale` and shifted by the
 * bake's top-left corner, so the landscape can be drawn into a texture at
 * twice the board's pixel size (the texture is shown at half scale). Phaser
 * is only a type here.
 */
export class PaintContext {
  constructor(
    readonly g: Phaser.GameObjects.Graphics,
    readonly scale: number,
    readonly minX: number,
    readonly minY: number,
  ) {}

  pt(p: Point): Point {
    return { x: (p.x - this.minX) * this.scale, y: (p.y - this.minY) * this.scale };
  }

  private pts(points: readonly Point[], dx = 0, dy = 0): Point[] {
    return points.map((p) => this.pt({ x: p.x + dx, y: p.y + dy }));
  }

  fillLoop(loop: readonly Point[], color: number, alpha = 1, dx = 0, dy = 0): void {
    if (loop.length < 3) return;
    this.g.fillStyle(color, alpha);
    this.g.fillPoints(this.pts(loop, dx, dy), true);
  }

  strokeLoop(loop: readonly Point[], width: number, color: number, alpha = 1): void {
    if (loop.length < 3) return;
    this.g.lineStyle(width * this.scale, color, alpha);
    this.g.strokePoints(this.pts(loop), true);
  }

  strokeLine(points: readonly Point[], width: number, color: number, alpha = 1): void {
    if (points.length < 2) return;
    this.g.lineStyle(width * this.scale, color, alpha);
    this.g.strokePoints(this.pts(points), false);
  }

  segment(a: Point, b: Point, width: number, color: number, alpha = 1): void {
    const pa = this.pt(a);
    const pb = this.pt(b);
    this.g.lineStyle(width * this.scale, color, alpha);
    this.g.lineBetween(pa.x, pa.y, pb.x, pb.y);
  }

  circle(x: number, y: number, r: number, color: number, alpha = 1): void {
    const c = this.pt({ x, y });
    this.g.fillStyle(color, alpha);
    this.g.fillCircle(c.x, c.y, r * this.scale);
  }

  ellipse(x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
    const c = this.pt({ x, y });
    this.g.fillStyle(color, alpha);
    this.g.fillEllipse(c.x, c.y, w * this.scale, h * this.scale);
  }

  /** A soft edge: the loop's colour stroked three times, wide and faint to
   * narrow, so the region melts into what is under it instead of cutting. */
  softEdge(loop: readonly Point[], color: number, alpha = 0.14): void {
    for (const width of [12, 7, 3]) this.strokeLoop(loop, width, color, alpha);
  }
}
