import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES } from '../data/map';
import {
  HEX_SIZE,
  hexToPixel,
  hexPolygonPoints,
  TERRAIN_COLORS,
  RIVER_COLOR,
  markerTextureKey,
  PLAYER_COLORS_HEX,
} from './hexRender';
import { allHexes } from './mapBounds';

/** Renders the hex map into a scene and handles hex click callbacks. Owns
 * camera scrolling (drag) since the full board is larger than the viewport. */
export class MapView {
  private scene: Phaser.Scene;
  private originX: number;
  private originY: number;
  private viewportWidth: number;
  private viewportHeight: number;
  private hexPolys = new Map<string, Phaser.GameObjects.Polygon>();
  private overlayGraphics: Phaser.GameObjects.Graphics;
  private riverGraphics!: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<string, Phaser.GameObjects.GameObject>();
  /** Set once `pinUIObjects` has added the fixed HUD camera — used so newly
   * created world objects (unit markers) get excluded from it too. */
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  onHexClick: ((hex: HexCoord) => void) | null = null;

  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.originX = viewportWidth / 2;
    this.originY = 90;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
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
    this.enableZoom();
  }

  /** Draws each river as a thick blue line along the shared hexside. */
  private drawRivers(): void {
    const g = this.scene.add.graphics().setDepth(3);
    this.riverGraphics = g;
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

  /** Wheel/trackpad zoom, centered on the cursor position (pinch-to-zoom on
   * a trackpad is reported by the browser as wheel events). */
  private enableZoom(): void {
    const cam = this.scene.cameras.main;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 2.5;

    this.scene.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, deltaY: number) => {
        const factor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (newZoom === cam.zoom) return;

        const before = cam.getWorldPoint(pointer.x, pointer.y);
        cam.zoom = newZoom;
        const after = cam.getWorldPoint(pointer.x, pointer.y);
        cam.scrollX += before.x - after.x;
        cam.scrollY += before.y - after.y;
      },
    );
  }

  /**
   * Pins the given HUD objects (status text, buttons, ...) to a fixed size
   * and position regardless of the map's pan/zoom. `setScrollFactor(0)`
   * alone only cancels *panning* — Phaser's camera zoom still scales
   * everything the camera renders, HUD included. The fix is a second,
   * never-zoomed camera that renders only these objects, while the main
   * (zoomable) camera is told to ignore them.
   */
  pinUIObjects(uiObjects: Phaser.GameObjects.GameObject[]): void {
    const mainCam = this.scene.cameras.main;
    const uiCam = this.scene.cameras.add(0, 0, this.viewportWidth, this.viewportHeight);
    uiCam.setScroll(0, 0);
    uiCam.setZoom(1);

    uiCam.ignore([
      ...this.hexPolys.values(),
      this.overlayGraphics,
      this.riverGraphics,
      ...this.unitLabels.values(),
    ]);
    this.uiCamera = uiCam;
    this.excludeFromMainCamera(uiObjects);
  }

  /** Registers additional HUD objects created *after* the initial
   * `pinUIObjects` call (e.g. a dialog shown mid-game) so they render via
   * the fixed HUD camera instead of the zoomable main one. */
  excludeFromMainCamera(objects: Phaser.GameObjects.GameObject[]): void {
    this.scene.cameras.main.ignore(objects);
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

  /** Renders a unit as its physical-counter marker image (see
   * public/markers/), falling back to a colored text chip if the texture
   * somehow isn't loaded. */
  setUnitMarker(hex: HexCoord, typeId: string, playerIndex: number): void {
    const key = `${hex.q},${hex.r}`;
    const center = this.toScreen(hex);
    const existing = this.unitLabels.get(key);
    if (existing) existing.destroy();

    const textureKey = markerTextureKey(playerIndex, typeId);
    let marker: Phaser.GameObjects.GameObject;
    if (this.scene.textures.exists(textureKey)) {
      const img = this.scene.add.image(center.x, center.y, textureKey).setDepth(10);
      const targetWidth = HEX_SIZE * 1.6;
      const scale = targetWidth / img.width;
      img.setDisplaySize(img.width * scale, img.height * scale);
      marker = img;
    } else {
      marker = this.scene.add
        .text(center.x, center.y, typeId.slice(0, 3).toUpperCase(), {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#1a1408',
          backgroundColor: PLAYER_COLORS_HEX[playerIndex] ?? '#ffffff',
          padding: { x: 4, y: 2 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }
    this.unitLabels.set(key, marker);
    // Newly-created markers appear after pinUIObjects ran once at scene
    // setup — keep them out of the fixed HUD camera too.
    if (this.uiCamera) this.uiCamera.ignore(marker);
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
