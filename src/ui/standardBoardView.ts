import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { MAP_TERRAIN, RIVER_HEXSIDES } from '../data/map';
import { HEX_SIZE, TERRAIN_COLORS, RIVER_COLOR, markerTextureKey, PLAYER_COLORS_HEX } from './hexRender';
import { allHexes } from './mapBounds';
import { drawFacingArrowhead, hexPolygonPointsAt, toVec } from './hexDraw';
import { reconcileUnits } from './boardView';
import type { BoardView, UnitDrawing, ViewHost } from './boardView';

type Marker = Phaser.GameObjects.Image | Phaser.GameObjects.Text;

/** The Standard view: the hex map as terrain-coloured polygons with the
 * physical-counter images on top. The terrain polygons are not interactive;
 * hit-testing belongs to the surface (`MapView`, via `hexAtPoint`). */
export class StandardBoardView implements BoardView {
  private host: ViewHost;
  private terrainPolys: Phaser.GameObjects.Polygon[] = [];
  private overlayGraphics: Phaser.GameObjects.Graphics;
  /** Hex outlines drawn ABOVE the unit markers (depth 11), which hide the fill overlay beneath them. */
  private ringGraphics: Phaser.GameObjects.Graphics;
  private riverGraphics: Phaser.GameObjects.Graphics;
  private facingGraphics: Phaser.GameObjects.Graphics;
  /** The elephant drift-direction arrow (plan.md §21) — see its assignment
   * in the constructor for why this isn't just reused from `facingGraphics`. */
  private driftArrowGraphics: Phaser.GameObjects.Graphics;
  /** One marker per unit id, with the drawing it was last made from. */
  private markers = new Map<string, { drawing: UnitDrawing; marker: Marker }>();
  private movementLabel: Phaser.GameObjects.Text | null = null;
  /** Per-hex "A"/"B"/"C" badges drawn during a choice prompt — see
   * `setChoiceLabels`. Its own list, deliberately separate from the unit
   * markers (which `setUnits` reconciles on every `renderAllUnits`, mid-prompt). */
  private choiceLabels: Phaser.GameObjects.Text[] = [];
  /** Per-hex remaining-movement-points badges over a selected ship's full
   * reachable range — see `setRangeLabels` (plan.md §22.3.1). Its own list,
   * same "batch, redrawn together, own destroyable array" pattern as
   * `choiceLabels`, since text can't be batched into one `Graphics` object
   * the way `highlightHexGroups`'s fills can. */
  private rangeLabels: Phaser.GameObjects.Text[] = [];

  constructor(host: ViewHost) {
    this.host = host;
    const scene = host.scene;
    this.overlayGraphics = scene.add.graphics().setDepth(5);
    this.facingGraphics = scene.add.graphics().setDepth(11);
    this.ringGraphics = scene.add.graphics().setDepth(11);
    // Depth 12 — one above the ship facing indicators, so an elephant's
    // drift arrow (plan.md §21) is never hidden behind them on the rare hex
    // where both happen to be drawn at once. A separate `Graphics` object
    // rather than sharing `facingGraphics`: `renderAllUnits` calls
    // `setFacingIndicators` on every render, which `.clear()`s and redraws
    // ship arrows from scratch — sharing one object would wipe the drift
    // arrow out on every unrelated re-render unless every such call also
    // remembered to re-supply it.
    this.driftArrowGraphics = scene.add.graphics().setDepth(12);

    for (const hex of allHexes()) {
      const terrain = MAP_TERRAIN.get(`${hex.q},${hex.r}`) ?? 'plain';
      const points = hexPolygonPointsAt(host.toScreen(hex));
      const poly = scene.add.polygon(0, 0, points, TERRAIN_COLORS[terrain] ?? 0xdec08c, 1).setOrigin(0, 0);
      poly.setStrokeStyle(1, 0x2a2016, 0.4);
      this.terrainPolys.push(poly);
    }
    this.riverGraphics = this.drawRivers();
  }

  /** Draws each river as a thick blue line along the shared hexside. */
  private drawRivers(): Phaser.GameObjects.Graphics {
    const g = this.host.scene.add.graphics().setDepth(3);
    g.lineStyle(4, RIVER_COLOR, 1);
    for (const key of RIVER_HEXSIDES) {
      const [ka, kb] = key.split('|');
      const [aq, ar] = ka!.split(',').map(Number);
      const [bq, br] = kb!.split(',').map(Number);
      const A = this.host.toScreen({ q: aq!, r: ar! });
      const B = this.host.toScreen({ q: bq!, r: br! });
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
    return g;
  }

  /** The objects the surface keeps off the fixed HUD camera when it is
   * pinned: exactly what the pre-split `pinUIObjects` listed (the drift
   * arrow and the lazily made labels were never in it; the labels are
   * ignored by the HUD camera only when made after the pin). */
  mapObjects(): Phaser.GameObjects.GameObject[] {
    return [
      ...this.terrainPolys,
      this.overlayGraphics,
      this.ringGraphics,
      this.riverGraphics,
      this.facingGraphics,
      ...[...this.markers.values()].map((m) => m.marker),
    ];
  }

  setUnits(units: readonly UnitDrawing[]): void {
    const prev = new Map([...this.markers].map(([id, entry]) => [id, entry.drawing]));
    const diff = reconcileUnits(prev, units);
    for (const id of diff.remove) this.removeMarker(id);
    for (const unit of diff.add) this.markers.set(unit.id, { drawing: unit, marker: this.makeMarker(unit) });
    for (const { unit, recreate } of diff.update) {
      const entry = this.markers.get(unit.id)!;
      if (recreate) {
        entry.marker.destroy();
        entry.marker = this.makeMarker(unit);
      } else {
        const center = this.host.toScreen(unit.position);
        entry.marker.setPosition(center.x, center.y);
      }
      entry.drawing = unit;
    }
    if (diff.add.length === 0 && diff.update.length === 0) return;
    // Markers share one depth, so their display-list order decides which of
    // two stacked counters is on top. Keep it the order of `units`, as when
    // every render rebuilt them all in that order.
    for (const unit of units) this.host.scene.children.bringToTop(this.markers.get(unit.id)!.marker);
  }

  private removeMarker(id: string): void {
    this.markers.get(id)?.marker.destroy();
    this.markers.delete(id);
  }

  /** Renders a unit as its physical-counter marker image (see
   * public/markers/), falling back to a colored text chip if the texture
   * somehow isn't loaded. */
  private makeMarker(unit: UnitDrawing): Marker {
    const scene = this.host.scene;
    const center = this.host.toScreen(unit.position);
    const textureKey = markerTextureKey(unit.owner, unit.typeId);
    let marker: Marker;
    if (scene.textures.exists(textureKey)) {
      const img = scene.add.image(center.x, center.y, textureKey).setDepth(10);
      const targetWidth = HEX_SIZE * 1.6;
      const scale = targetWidth / img.width;
      img.setDisplaySize(img.width * scale, img.height * scale);
      marker = img;
    } else {
      marker = scene.add
        .text(center.x, center.y, unit.typeId.slice(0, 3).toUpperCase(), {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#1a1408',
          backgroundColor: PLAYER_COLORS_HEX[unit.owner] ?? '#ffffff',
          padding: { x: 4, y: 2 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }
    // Newly-created markers appear after pinUIObjects ran once at scene
    // setup — keep them out of the fixed HUD camera too.
    this.host.ignoreOnUiCamera(marker);
    return marker;
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
    this.ringGraphics.clear();
    for (const { hexes, color, alpha = 0.45 } of groups) {
      this.overlayGraphics.fillStyle(color, alpha);
      for (const hex of hexes) {
        const points = hexPolygonPointsAt(this.host.toScreen(hex));
        this.overlayGraphics.fillPoints(toVec(points), true);
      }
    }
  }

  /** Outlines `hexes` in `color`, above the unit markers (so a highlighted
   * occupied hex still shows). Cleared with the fill highlights. */
  highlightRings(hexes: HexCoord[], color: number): void {
    this.ringGraphics.lineStyle(4, color, 1);
    for (const hex of hexes) {
      const points = hexPolygonPointsAt(this.host.toScreen(hex));
      this.ringGraphics.strokePoints(toVec(points), true);
    }
  }

  clearHighlights(): void {
    this.overlayGraphics.clear();
    this.ringGraphics.clear();
  }

  /** Shows the selected unit's remaining movement points centered on its
   * marker — created once and repositioned/retexted on every call rather
   * than recreated, since it tracks a single unit across a whole selection
   * (following it across moves/rotations). */
  showMovementPoints(hex: HexCoord, value: number): void {
    const center = this.host.toScreen(hex);
    const text = Number.isInteger(value) ? `${value}` : value.toFixed(1);
    if (this.movementLabel) {
      this.movementLabel.setPosition(center.x, center.y);
      this.movementLabel.setText(text);
      this.movementLabel.setVisible(true);
      return;
    }
    this.movementLabel = this.host.scene.add
      .text(center.x, center.y, text, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.host.ignoreOnUiCamera(this.movementLabel);
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
      const center = this.host.toScreen(hex);
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
    const center = this.host.toScreen(hex);
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
      const center = this.host.toScreen(hex);
      const badge = this.host.scene.add
        .text(center.x - HEX_SIZE * 0.5, center.y - HEX_SIZE * 0.5, text, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#1a1408',
          backgroundColor: '#ffcc44',
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      this.host.ignoreOnUiCamera(badge);
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
      const center = this.host.toScreen(hex);
      const badge = this.host.scene.add
        .text(center.x + HEX_SIZE * 0.5, center.y + HEX_SIZE * 0.5, `${value}`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#1a1408b0',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      this.host.ignoreOnUiCamera(badge);
      this.rangeLabels.push(badge);
    }
  }

  /** Clears whatever `setRangeLabels` last drew. */
  clearRangeLabels(): void {
    for (const badge of this.rangeLabels) badge.destroy();
    this.rangeLabels = [];
  }

  destroy(): void {
    for (const id of [...this.markers.keys()]) this.removeMarker(id);
    this.clearChoiceLabels();
    this.clearRangeLabels();
    this.movementLabel?.destroy();
    this.movementLabel = null;
    for (const poly of this.terrainPolys) poly.destroy();
    this.terrainPolys = [];
    const graphics = [this.overlayGraphics, this.ringGraphics, this.riverGraphics, this.facingGraphics, this.driftArrowGraphics];
    for (const g of graphics) g.destroy();
  }
}
