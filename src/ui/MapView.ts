import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES } from '../data/map';
import {
  HEX_SIZE,
  hexToPixel,
  hexPolygonPoints,
  facingAngleRad,
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
  private facingGraphics: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<string, Phaser.GameObjects.GameObject>();
  /** Set once `pinUIObjects` has added the fixed HUD camera — used so newly
   * created world objects (unit markers) get excluded from it too. */
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  onHexClick: ((hex: HexCoord) => void) | null = null;

  /**
   * @param leftPanelWidth Reserves a strip of screen space on the left (the
   * HUD panel — buttons, phase status, combat log) that the map board never
   * renders into or accepts clicks from: hexes are laid out flush against
   * the remaining space's edge (or centered, if the board is smaller than
   * that space), and the main camera's viewport is shrunk to match so
   * clicks over the panel can never hit-test a hex underneath it.
   */
  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number, leftPanelWidth = 0) {
    this.scene = scene;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // The board's own hex coordinates aren't centered around (0,0) — e.g.
    // this map's q runs 0..42, so every hex has local x >= 0. Naively
    // centering the viewport on hex (0,0) leaves half the play area empty.
    // Instead, measure the actual pixel bounding box of every hex and place
    // THAT flush against the panel (or centered, if it's smaller than the
    // available space), so the board always starts right at the panel edge.
    const hexes = allHexes();
    const pixels = hexes.map((h) => hexToPixel(h));
    const minX = Math.min(...pixels.map((p) => p.x));
    const maxX = Math.max(...pixels.map((p) => p.x));
    const minY = Math.min(...pixels.map((p) => p.y));
    const maxY = Math.max(...pixels.map((p) => p.y));
    const boardWidth = maxX - minX;
    const boardHeight = maxY - minY;
    const availableWidth = viewportWidth - leftPanelWidth;
    const margin = 16;

    this.originX = leftPanelWidth - minX + Math.max(margin, (availableWidth - boardWidth) / 2);
    this.originY = -minY + Math.max(margin, (viewportHeight - boardHeight) / 2);

    this.overlayGraphics = scene.add.graphics().setDepth(5);
    this.facingGraphics = scene.add.graphics().setDepth(11);

    for (const hex of hexes) {
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

    // Bound panning/zooming to roughly the board's own extent (plus a little
    // slack) rather than a fixed margin sized for the old centering — so the
    // board can't be scrolled away into empty space next to the panel.
    const boundsPadding = 200;
    this.enableDrag({
      x: this.originX + minX - boundsPadding,
      y: this.originY + minY - boundsPadding,
      width: boardWidth + boundsPadding * 2,
      height: boardHeight + boundsPadding * 2,
    });
    this.enableZoom();
    const mainCam = scene.cameras.main;
    mainCam.setViewport(leftPanelWidth, 0, availableWidth, viewportHeight);
    // Bounds-clamping alone would settle on an arbitrary in-bounds scroll
    // (e.g. snapping to the padding edge) rather than flush against the
    // panel, so start the camera explicitly at the board's own top-left.
    mainCam.setScroll(leftPanelWidth, 0);
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

  private enableDrag(bounds: { x: number; y: number; width: number; height: number }): void {
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
    cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
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
      this.facingGraphics,
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
    this.highlightHexGroups([{ hexes, color, alpha }]);
  }

  /** Like `highlightHexes`, but draws several differently-colored hex sets
   * in one pass (e.g. "units in your attack group" vs. "eligible targets"
   * vs. "units already chosen as defenders") without one call clobbering
   * another's highlight. */
  highlightHexGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void {
    this.overlayGraphics.clear();
    for (const { hexes, color, alpha = 0.45 } of groups) {
      this.overlayGraphics.fillStyle(color, alpha);
      for (const hex of hexes) {
        const center = this.toScreen(hex);
        const points = hexPolygonPointsAt(center);
        this.overlayGraphics.fillPoints(toVec(points), true);
      }
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

  /**
   * Draws a small arrowhead on every ship, pointing in its facing direction
   * (see `facingAngleRad`) — the visual cue for a ship's bow, since the
   * marker image itself is a physical-counter icon that must stay upright
   * for its printed stats to stay readable, so it can't just be rotated in
   * place. Redraws the whole set each call (paired with `renderAllUnits`),
   * same pattern as `highlightHexGroups`.
   */
  setFacingIndicators(ships: readonly { hex: HexCoord; facing: number; playerIndex: number }[]): void {
    this.facingGraphics.clear();
    for (const { hex, facing, playerIndex } of ships) {
      const center = this.toScreen(hex);
      const angle = facingAngleRad(facing);
      const tipRadius = HEX_SIZE * 0.95;
      const backRadius = HEX_SIZE * 0.5;
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

      const colorHex = PLAYER_COLORS_HEX[playerIndex] ?? '#ffffff';
      const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
      this.facingGraphics.fillStyle(color, 1);
      this.facingGraphics.lineStyle(1.5, 0x1a1408, 0.9);
      this.facingGraphics.beginPath();
      this.facingGraphics.moveTo(tip.x, tip.y);
      this.facingGraphics.lineTo(backLeft.x, backLeft.y);
      this.facingGraphics.lineTo(backRight.x, backRight.y);
      this.facingGraphics.closePath();
      this.facingGraphics.fillPath();
      this.facingGraphics.strokePath();
    }
  }

  clearFacingIndicators(): void {
    this.facingGraphics.clear();
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
