import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES } from '../data/map';
import { HEX_SIZE, hexToPixel, hexPolygonPoints, TERRAIN_COLORS, RIVER_COLOR } from './hexRender';
import { allHexes } from './mapBounds';

/** Renders the hex map into a scene and handles hex click callbacks. Owns
 * camera scrolling (drag) since the full board is larger than the viewport. */
export class MapView {
  private scene: Phaser.Scene;
  private originX: number;
  private originY: number;
  private hexPolys = new Map<string, Phaser.GameObjects.Polygon>();
  private overlayGraphics: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<string, Phaser.GameObjects.Text>();
  onHexClick: ((hex: HexCoord) => void) | null = null;

  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.originX = viewportWidth / 2;
    this.originY = 90;
    this.overlayGraphics = scene.add.graphics().setDepth(5);

    for (const hex of allHexes()) {
      const terrain = MAP_TERRAIN.get(`${hex.q},${hex.r}`) ?? 'plain';
      const center = this.toScreen(hex);
      const points = hexPolygonPointsAt(center);
      const poly = scene.add.polygon(0, 0, points, TERRAIN_COLORS[terrain] ?? 0xdec08c, 1).setOrigin(0, 0);
      poly.setStrokeStyle(1, 0x2a2016, 0.4);
      poly.setInteractive(new Phaser.Geom.Polygon(points), Phaser.Geom.Polygon.Contains);
      poly.on('pointerdown', () => this.onHexClick?.(hex));
      this.hexPolys.set(`${hex.q},${hex.r}`, poly);
    }

    this.drawRivers();
    this.enableDrag(viewportWidth, viewportHeight);
  }

  /** Draws each river as a thick blue line along the shared hexside. */
  private drawRivers(): void {
    const g = this.scene.add.graphics().setDepth(3);
    g.lineStyle(4, RIVER_COLOR, 1);
    for (const key of RIVER_HEXSIDES) {
      const [ka, kb] = key.split('|');
      const [aq, ar] = ka!.split(',').map(Number);
      const [bq, br] = kb!.split(',').map(Number);
      const A = this.toScreen({ q: aq!, r: ar! });
      const B = this.toScreen({ q: bq!, r: br! });
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      // shared edge is perpendicular to the center-center line, length ~HEX_SIZE
      let px = -(B.y - A.y);
      let py = B.x - A.x;
      const len = Math.hypot(px, py) || 1;
      px = (px / len) * (HEX_SIZE / 2);
      py = (py / len) * (HEX_SIZE / 2);
      g.lineBetween(mx - px, my - py, mx + px, my + py);
    }
  }

  private enableDrag(viewportWidth: number, viewportHeight: number): void {
    const cam = this.scene.cameras.main;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      lastX = p.x;
      lastY = p.y;
    });
    this.scene.input.on('pointerup', () => {
      dragging = false;
    });
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      cam.scrollX -= p.x - lastX;
      cam.scrollY -= p.y - lastY;
      lastX = p.x;
      lastY = p.y;
    });
    cam.setBounds(-400, -50, viewportWidth + 1600, viewportHeight + 1200);
  }

  toScreen(hex: HexCoord): { x: number; y: number } {
    const p = hexToPixel(hex);
    return { x: p.x + this.originX, y: p.y + this.originY };
  }

  highlightHexes(hexes: HexCoord[], color: number, alpha = 0.45): void {
    this.overlayGraphics.clear();
    this.overlayGraphics.fillStyle(color, alpha);
    for (const hex of hexes) {
      const center = this.toScreen(hex);
      const points = hexPolygonPointsAt(center);
      this.overlayGraphics.fillPoints(toVec(points), true);
    }
  }

  clearHighlights(): void {
    this.overlayGraphics.clear();
  }

  setUnitLabel(hex: HexCoord, text: string, color: string): void {
    const key = `${hex.q},${hex.r}`;
    const center = this.toScreen(hex);
    const existing = this.unitLabels.get(key);
    if (existing) existing.destroy();
    const label = this.scene.add
      .text(center.x, center.y, text, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#1a1408',
        backgroundColor: color,
        padding: { x: 4, y: 2 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.unitLabels.set(key, label);
  }

  clearUnitLabel(hex: HexCoord): void {
    const key = `${hex.q},${hex.r}`;
    this.unitLabels.get(key)?.destroy();
    this.unitLabels.delete(key);
  }

  clearAllUnitLabels(): void {
    for (const label of this.unitLabels.values()) label.destroy();
    this.unitLabels.clear();
  }

  centerOn(hex: HexCoord): void {
    const p = this.toScreen(hex);
    this.scene.cameras.main.centerOn(p.x, p.y);
  }
}

function hexPolygonPointsAt(center: { x: number; y: number }): number[] {
  return hexPolygonPoints(center);
}

function toVec(points: number[]): Phaser.Geom.Point[] {
  const vecs: Phaser.Geom.Point[] = [];
  for (let i = 0; i < points.length; i += 2) {
    vecs.push(new Phaser.Geom.Point(points[i]!, points[i + 1]!));
  }
  return vecs;
}

export { HEX_SIZE };
