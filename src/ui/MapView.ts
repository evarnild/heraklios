import Phaser from 'phaser';
import { cameraStrays, type CameraObject, type CameraStray } from './cameraStrays';
import type { HexCoord } from '../data/map';
import { HEX_SIZE, hexToPixel } from './hexRender';
import { allHexes } from './mapBounds';
import { formatHexTooltip } from './hexTooltip';
import { hexAtPoint } from './hexHitTest';
import { StandardBoardView } from './standardBoardView';
import { DrawnBoardView } from './drawnBoardView';
import type { BoardView, FacingShip, UnitDrawing, ViewHost } from './boardView';
import { boardViewKind } from './boardViewPreference';
import type { BoardViewKind } from './boardViewPreference';
import { ViewDrawingState } from './viewDrawingState';

export { drawFacingArrowhead } from './hexDraw';

/** The shared board surface, plus a facade over the current `BoardView`.
 * The surface owns the origin and coordinates, the main and fixed UI cameras,
 * drag, zoom, hit-testing (one `Zone` over the board, mapped to a hex by
 * `hexAtPoint`), hover and the tooltip. All drawing is forwarded to the
 * `BoardView` (today only `StandardBoardView`), so a second view needs none
 * of this. Owns camera scrolling (drag) since the full board is larger than
 * the viewport. */
export class MapView {
  private scene: Phaser.Scene;
  private originX: number;
  private originY: number;
  private viewportWidth: number;
  private viewportHeight: number;
  private boardView: BoardView;
  private kind: BoardViewKind;
  /** The last call of each drawing setter, replayed into a new view on a toggle (B2). */
  private drawing = new ViewDrawingState();
  private hitZone: Phaser.GameObjects.Zone;
  /** The hex the pointer is over, so hover fires only when it changes. */
  private hoveredKey: string | null = null;
  /** Set once `pinUIObjects` has added the fixed HUD camera — used so newly
   * created world objects (unit markers) get excluded from it too. */
  private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  onHexClick: ((hex: HexCoord) => void) | null = null;
  /** True for a screen point where the wheel must not zoom and a press must not start a map drag
   * (the Board's log panel scrolls and its thumb drags there; §49). */
  pointerBlocked: ((x: number, y: number) => boolean) | null = null;
  /** Fired when the hex under the pointer changes (null once it leaves the
   * map, the board, or moves onto a UI object above it), mirroring
   * `onHexClick` - a hook for callers that want to react to hover
   * themselves. `MapView` does NOT rely on this to drive its own tooltip:
   * `showHexTooltip`/`hideHexTooltip` are called directly from the same
   * pointer handlers, so the tooltip's display logic (formatting,
   * camera-pinning, depth, viewport clamping) lives in one place that a
   * future trigger swap (e.g. "the selected hex" instead of "the hovered
   * hex", see plan.md section 13's flagged assumption) can call directly
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

    this.kind = boardViewKind();
    this.boardView = this.createView(this.kind);

    // One interactive Zone over the board (depth 0, under every HUD object,
    // exactly where the per-hex polygons used to sit) replaces the per-hex
    // interactive polygons; `hexAtPoint` maps a point on it to a hex.
    this.hitZone = scene.add
      .zone(
        this.originX + minX - HEX_SIZE,
        this.originY + minY - HEX_SIZE,
        boardWidth + HEX_SIZE * 2,
        boardHeight + HEX_SIZE * 2,
      )
      .setOrigin(0, 0)
      .setInteractive();
    this.hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hex = this.hexUnder(pointer);
      if (hex) this.onHexClick?.(hex);
    });
    this.hitZone.on('pointermove', (pointer: Phaser.Input.Pointer) => this.updateHover(pointer));
    this.hitZone.on('pointerout', () => this.updateHover(null));
    scene.input.on('gameout', () => this.updateHover(null));

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

  private viewHost(): ViewHost {
    return {
      scene: this.scene,
      toScreen: (hex) => this.toScreen(hex),
      ignoreOnUiCamera: (objects) => this.uiCamera?.ignore(objects),
    };
  }

  private createView(kind: BoardViewKind): BoardView {
    return kind === 'drawn' ? new DrawnBoardView(this.viewHost()) : new StandardBoardView(this.viewHost());
  }

  /** The current view kind. */
  get viewKind(): BoardViewKind {
    return this.kind;
  }

  /** Swaps the drawing view in place: the camera, hit zone and tooltip stay,
   * and the new view is brought to what the old one showed (B2). */
  setViewKind(kind: BoardViewKind): void {
    if (kind === this.kind) return;
    const next = this.createView(kind);
    this.drawing.replay(next);
    this.boardView.destroy();
    this.boardView = next;
    this.kind = kind;
    // A view made after pinUIObjects must be kept off the fixed HUD camera.
    this.uiCamera?.ignore(next.mapObjects());
  }

  /**
   * Dev-hook reader (read-only): the Drawn view's unit figures, the staged
   * ship's ghost rotation, and how many of the view's world objects the HUD
   * camera would render (must be 0). Null in the Standard view.
   */
  drawnInspect(): { unitDrawings: number; ghostRotation: number | null; unitRotations: Record<string, number>; hudLeaks: number } | null {
    if (!(this.boardView instanceof DrawnBoardView)) return null;
    const ui = this.uiCamera;
    const hudLeaks = ui ? this.boardView.mapObjects().filter((o) => (o.cameraFilter & ui.id) === 0).length : 0;
    return { ...this.boardView.inspect(), hudLeaks };
  }

  /** Dev-hook reader (read-only; §67): the display-list objects both cameras would render. */
  cameraStrays(): CameraStray[] {
    const ui = this.uiCamera;
    if (!ui) return [];
    return cameraStrays(this.scene.children.list as unknown as CameraObject[], this.scene.cameras.main.id, ui.id);
  }

  /** The map hex under a pointer, through the main camera's current scroll and zoom. */
  private hexUnder(pointer: Phaser.Input.Pointer): HexCoord | null {
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return hexAtPoint(world.x - this.originX, world.y - this.originY);
  }

  /** Fires hover (and the tooltip) only when the hex under the pointer
   * changes; `null` means the pointer left the board or went under a UI object. */
  private updateHover(pointer: Phaser.Input.Pointer | null): void {
    const hex = pointer ? this.hexUnder(pointer) : null;
    const key = hex ? `${hex.q},${hex.r}` : null;
    if (key === this.hoveredKey) return;
    this.hoveredKey = key;
    this.onHexHover?.(hex);
    if (hex && pointer) this.showHexTooltip(hex, pointer.x, pointer.y);
    else this.hideHexTooltip();
  }

  private enableDrag(bounds: { x: number; y: number; width: number; height: number }): void {
    const cam = this.scene.cameras.main;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerBlocked?.(p.x, p.y)) return;
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
        if (this.pointerBlocked?.(pointer.x, pointer.y)) return;
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
   * alone only cancels *panning* - Phaser's camera zoom still scales
   * everything the camera renders, HUD included. The fix is a second,
   * never-zoomed camera that renders only these objects, while the main
   * (zoomable) camera is told to ignore them.
   */
  pinUIObjects(uiObjects: Phaser.GameObjects.GameObject[]): void {
    const uiCam = this.scene.cameras.add(0, 0, this.viewportWidth, this.viewportHeight);
    uiCam.setScroll(0, 0);
    uiCam.setZoom(1);

    uiCam.ignore([...this.boardView.mapObjects(), this.hitZone]);
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

  /** The current drawing view (for a view toggle; the scenes use the forwarders below). */
  get view(): BoardView {
    return this.boardView;
  }

  setUnits(units: readonly UnitDrawing[]): void {
    this.drawing.setUnits(units);
    this.boardView.setUnits(units);
  }

  highlightHexes(hexes: HexCoord[], color: number, alpha = 0.45): void {
    this.drawing.highlightHexes(hexes, color, alpha);
    this.boardView.highlightHexes(hexes, color, alpha);
  }

  highlightHexGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void {
    this.drawing.highlightHexGroups(groups);
    this.boardView.highlightHexGroups(groups);
  }

  highlightRings(hexes: HexCoord[], color: number): void {
    this.drawing.highlightRings(hexes, color);
    this.boardView.highlightRings(hexes, color);
  }

  clearHighlights(): void {
    this.drawing.clearHighlights();
    this.boardView.clearHighlights();
  }

  showMovementPoints(hex: HexCoord, value: number): void {
    this.drawing.showMovementPoints(hex, value);
    this.boardView.showMovementPoints(hex, value);
  }

  hideMovementPoints(): void {
    this.drawing.hideMovementPoints();
    this.boardView.hideMovementPoints();
  }

  setFacingIndicators(ships: readonly FacingShip[]): void {
    this.drawing.setFacingIndicators(ships);
    this.boardView.setFacingIndicators(ships);
  }

  clearFacingIndicators(): void {
    this.drawing.clearFacingIndicators();
    this.boardView.clearFacingIndicators();
  }

  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void {
    this.drawing.setDriftArrow(hex, facing, colorHex);
    this.boardView.setDriftArrow(hex, facing, colorHex);
  }

  clearDriftArrow(): void {
    this.drawing.clearDriftArrow();
    this.boardView.clearDriftArrow();
  }

  setChoiceLabels(labels: readonly { hex: HexCoord; text: string }[]): void {
    this.drawing.setChoiceLabels(labels);
    this.boardView.setChoiceLabels(labels);
  }

  clearChoiceLabels(): void {
    this.drawing.clearChoiceLabels();
    this.boardView.clearChoiceLabels();
  }

  setRangeLabels(labels: readonly { hex: HexCoord; value: number }[]): void {
    this.drawing.setRangeLabels(labels);
    this.boardView.setRangeLabels(labels);
  }

  clearRangeLabels(): void {
    this.drawing.clearRangeLabels();
    this.boardView.clearRangeLabels();
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

  /** Like `centerOn`, for a point in `hexToPixel` space (the camera's bounds clamp it). */
  centerOnPoint(point: { x: number; y: number }): void {
    this.scene.cameras.main.centerOn(point.x + this.originX, point.y + this.originY);
  }
}

export { HEX_SIZE };
