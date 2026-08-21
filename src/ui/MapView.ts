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
import { formatHexTooltip } from './hexTooltip';

/**
 * Draws one arrowhead triangle at `center`, pointing in `facing`'s bow
 * direction (see `facingAngleRad`). The shared drawing primitive behind
 * `setFacingIndicators` (one arrow per ship, hex-positioned via `toScreen`)
 * AND the Movement/Placement Turn buttons' post-turn facing glyph
 * (`BoardScene.ts`/`PlacementScene.ts`, screen-positioned, unrelated to any
 * hex — plan.md §17.2) — a free function rather than a `MapView` method
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
  /** The elephant drift-direction arrow (plan.md §21) — see its assignment
   * in the constructor for why this isn't just reused from `facingGraphics`. */
  private driftArrowGraphics: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<string, Phaser.GameObjects.GameObject>();
  private movementLabel: Phaser.GameObjects.Text | null = null;
  /** Per-hex "A"/"B"/"C" badges drawn during a choice prompt — see
   * `setChoiceLabels`. Its own list, deliberately separate from `unitLabels`
   * (which `clearAllUnitLabels` wipes on every `renderAllUnits`, mid-prompt). */
  private choiceLabels: Phaser.GameObjects.Text[] = [];
  /** Per-hex remaining-movement-points badges over a selected ship's full
   * reachable range — see `setRangeLabels` (plan.md §22.3.1). Its own list,
   * same "batch, redrawn together, own destroyable array" pattern as
   * `choiceLabels`, since text can't be batched into one `Graphics` object
   * the way `highlightHexGroups`'s fills can. */
  private rangeLabels: Phaser.GameObjects.Text[] = [];
  /** Set once `pinUIObjects` has added the fixed HUD camera — used so newly
   * created world objects (unit markers) get excluded from it too. */
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  onHexClick: ((hex: HexCoord) => void) | null = null;
  /** Fired on `pointerover`/`pointerout`, mirroring `onHexClick` exactly (see
   * `:71-80`'s per-hex wiring below) — a hook for callers that want to react
   * to hover themselves. `MapView` does NOT rely on this to drive its own
   * tooltip: `showHexTooltip`/`hideHexTooltip` are called directly from the
   * same pointerover/pointerout listeners, so the tooltip's display logic
   * (formatting, camera-pinning, depth, viewport clamping) lives in one place
   * that a future trigger swap (e.g. "the selected hex" instead of "the
   * hovered hex", see plan.md §13's flagged assumption) can call directly
   * without going back through this callback. */
  onHexHover: ((hex: HexCoord | null) => void) | null = null;
  /** The hover tooltip's backing text object, created lazily on first hover
   * (same lazy-creation pattern as `movementLabel`) since it may never be
   * needed in a given scene visit. */
  private hoverTooltip: Phaser.GameObjects.Text | null = null;
  /** Depth 35: the natural free slot above the HUD (buttons/status at 30,
   * SaveLoadPanel at 40/41) and below any modal (confirm dialog at 50-52) —
   * see plan.md §13.2's re-derived depth map. A tooltip above a modal could
   * float over the abandon-confirmation dialog; below the HUD it could be
   * hidden by it. */
  private static readonly TOOLTIP_DEPTH = 35;

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
    // Depth 12 — one above the ship facing indicators, so an elephant's
    // drift arrow (plan.md §21) is never hidden behind them on the rare hex
    // where both happen to be drawn at once. A separate `Graphics` object
    // rather than sharing `facingGraphics`: `renderAllUnits` calls
    // `setFacingIndicators` on every render, which `.clear()`s and redraws
    // ship arrows from scratch — sharing one object would wipe the drift
    // arrow out on every unrelated re-render unless every such call also
    // remembered to re-supply it.
    this.driftArrowGraphics = scene.add.graphics().setDepth(12);

    for (const hex of hexes) {
      const terrain = MAP_TERRAIN.get(`${hex.q},${hex.r}`) ?? 'plain';
      const center = this.toScreen(hex);
      const points = hexPolygonPointsAt(center);
      const poly = scene.add.polygon(0, 0, points, TERRAIN_COLORS[terrain] ?? 0xdec08c, 1).setOrigin(0, 0);
      poly.setStrokeStyle(1, 0x2a2016, 0.4);
      poly.setInteractive(new Phaser.Geom.Polygon(points), Phaser.Geom.Polygon.Contains);
      poly.on('pointerdown', () => this.onHexClick?.(hex));
      poly.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        this.onHexHover?.(hex);
        this.showHexTooltip(hex, pointer.x, pointer.y);
      });
      poly.on('pointerout', () => {
        this.onHexHover?.(null);
        this.hideHexTooltip();
      });
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

  /** Shows the selected unit's remaining movement points centered on its
   * marker — created once and repositioned/retexted on every call rather
   * than recreated, since it tracks a single unit across a whole selection
   * (following it across moves/rotations). */
  showMovementPoints(hex: HexCoord, value: number): void {
    const center = this.toScreen(hex);
    const text = Number.isInteger(value) ? `${value}` : value.toFixed(1);
    if (this.movementLabel) {
      this.movementLabel.setPosition(center.x, center.y);
      this.movementLabel.setText(text);
      this.movementLabel.setVisible(true);
      return;
    }
    this.movementLabel = this.scene.add
      .text(center.x, center.y, text, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(12);
    if (this.uiCamera) this.uiCamera.ignore(this.movementLabel);
  }

  hideMovementPoints(): void {
    this.movementLabel?.setVisible(false);
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
      const colorHex = PLAYER_COLORS_HEX[playerIndex] ?? '#ffffff';
      drawFacingArrowhead(this.facingGraphics, center, facing, colorHex);
    }
  }

  clearFacingIndicators(): void {
    this.facingGraphics.clear();
  }

  /**
   * Draws a single arrowhead on `hex` pointing in `facing`'s direction — the
   * currently-drifting elephant's just-rolled/in-progress direction (plan.md
   * §21). Reuses `drawFacingArrowhead`, the same primitive `setFacingIndicators`
   * draws ship bows with, rather than inventing a second arrow shape. Redraws
   * from scratch each call (there is ever only one drifting elephant's arrow
   * shown at a time — a nested trampled-elephant re-drift replaces it, it
   * doesn't add a second one), same "clear, then redraw the current set"
   * pattern as `setFacingIndicators`.
   */
  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void {
    this.driftArrowGraphics.clear();
    const center = this.toScreen(hex);
    drawFacingArrowhead(this.driftArrowGraphics, center, facing, colorHex, 1.15);
  }

  clearDriftArrow(): void {
    this.driftArrowGraphics.clear();
  }

  /**
   * Draws a short per-hex badge (e.g. "A", "B", "C") over each candidate
   * unit's hex during a choice prompt (`chooseAdvance`/`chooseExchangeSacrifice`
   * — plan.md §16) — the dialog's rows show the same letters, so a combined
   * attack of several identical-type units no longer reads as indistinguishable
   * rows with nothing tying any of them to a hex. Redraws the whole set each
   * call, same "batch, redrawn together" pattern as `setFacingIndicators` —
   * but text can't be batched into one `Graphics` object the way vector
   * shapes can, so this keeps its own destroyable list instead.
   *
   * Offset up-left from the hex center (not centered, unlike `movementLabel`)
   * so the badge doesn't sit directly on top of the unit marker it's
   * labeling — both would otherwise occupy the same point.
   */
  setChoiceLabels(labels: readonly { hex: HexCoord; text: string }[]): void {
    this.clearChoiceLabels();
    for (const { hex, text } of labels) {
      const center = this.toScreen(hex);
      const badge = this.scene.add
        .text(center.x - HEX_SIZE * 0.5, center.y - HEX_SIZE * 0.5, text, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#1a1408',
          backgroundColor: '#ffcc44',
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      if (this.uiCamera) this.uiCamera.ignore(badge);
      this.choiceLabels.push(badge);
    }
  }

  /** Clears whatever `setChoiceLabels` last drew. Must be called on every
   * exit path of a choice prompt (decline, confirm, or otherwise) — a
   * leftover badge would point at a hex whose unit has since moved, advanced,
   * or died. */
  clearChoiceLabels(): void {
    for (const badge of this.choiceLabels) badge.destroy();
    this.choiceLabels = [];
  }

  /**
   * Shows a small numeric badge on every hex in a selected ship's full
   * reachable naval-movement range (`reachableNavalHexes`), reading
   * `ship.movementLeft - cost` for that hex — the "how much movement would
   * be left if I ended my move here" indicator (plan.md §22.3.1). Redrawn
   * wholesale on every `refreshNavalMovementControls` call, same lifecycle
   * as `highlightHexGroups`; call `clearRangeLabels` on every exit path
   * (deselecting the ship, switching to a land unit, ending the phase) so a
   * stale badge never survives past the selection it describes.
   *
   * Offset down-right from the hex center — the opposite corner from
   * `setChoiceLabels`' up-left badges — since a ramming-contact hex can be
   * both a choice-prompt candidate's hex AND (this being the ship's own
   * reachable range) show a range label at the same time; keeping the two
   * label kinds' corners apart avoids them ever overlapping each other.
   */
  setRangeLabels(labels: readonly { hex: HexCoord; value: number }[]): void {
    this.clearRangeLabels();
    for (const { hex, value } of labels) {
      const center = this.toScreen(hex);
      const badge = this.scene.add
        .text(center.x + HEX_SIZE * 0.5, center.y + HEX_SIZE * 0.5, `${value}`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#1a1408b0',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      if (this.uiCamera) this.uiCamera.ignore(badge);
      this.rangeLabels.push(badge);
    }
  }

  /** Clears whatever `setRangeLabels` last drew. */
  clearRangeLabels(): void {
    for (const badge of this.rangeLabels) badge.destroy();
    this.rangeLabels = [];
  }

  /**
   * Shows (creating on first use) the hex coordinate/terrain tooltip near
   * the given SCREEN position (`pointer.x`/`pointer.y` — viewport pixels,
   * not world/hex pixels: the tooltip is HUD, pinned to the fixed UI camera
   * exactly like a button, not to the pannable/zoomable map underneath it —
   * see `pinUIObjects`'s doc comment for the same trap this avoids).
   *
   * Not interactive (never `setInteractive`'d), so it can never steal
   * `pointerover` from the hex polygons beneath it and cause flicker.
   * Offset from the cursor so it doesn't sit directly under it, and that
   * offset flips near the right/bottom viewport edge so the label never
   * runs off-screen.
   */
  private showHexTooltip(hex: HexCoord, pointerX: number, pointerY: number): void {
    const text = formatHexTooltip(hex);
    if (!this.hoverTooltip) {
      this.hoverTooltip = this.scene.add
        .text(0, 0, text, {
          fontSize: '13px',
          color: '#f4e9d0',
          backgroundColor: '#1a1408e0',
          padding: { x: 6, y: 4 },
        })
        .setScrollFactor(0)
        .setDepth(MapView.TOOLTIP_DEPTH);
      // HUD element: render it only via the fixed UI camera (once
      // `pinUIObjects` adds one), never the zoomable main camera — see this
      // method's own doc comment. Works regardless of call order since
      // `excludeFromMainCamera` only touches the main camera's ignore list.
      this.excludeFromMainCamera([this.hoverTooltip]);
    } else {
      this.hoverTooltip.setText(text);
    }

    const OFFSET = 16;
    let x = pointerX + OFFSET;
    let y = pointerY + OFFSET;
    if (x + this.hoverTooltip.width > this.viewportWidth) x = pointerX - OFFSET - this.hoverTooltip.width;
    if (y + this.hoverTooltip.height > this.viewportHeight) y = pointerY - OFFSET - this.hoverTooltip.height;
    this.hoverTooltip.setPosition(x, y);
    this.hoverTooltip.setVisible(true);
  }

  private hideHexTooltip(): void {
    this.hoverTooltip?.setVisible(false);
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
