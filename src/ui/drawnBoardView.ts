import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { ghostDrawing } from './boardView';
import type { BoardView, FacingShip, UnitDrawing, ViewHost } from './boardView';
import { DrawnOverlays } from './drawnOverlays';
import { DrawnUnits } from './drawnUnits';
import { bakeLandscape } from './landscape/paintLandscape';

/**
 * The Drawn view (§64): the map as one baked landscape (grass, plateaus,
 * marsh, rivers, a smoothed coast, a thin hex grid), unit figures on
 * owner-shaped bases, and restyled overlays. It implements the same
 * `BoardView` as the Standard view and shares its surface (`MapView`):
 * camera, drag, zoom, hit-testing, hover and tooltip. Nothing here is
 * interactive, so every click and hover reaches the shared hit zone.
 *
 * The landscape is baked once in the constructor and never redrawn; pan and
 * zoom only move the camera over the texture.
 */
export class DrawnBoardView implements BoardView {
  private landscape: Phaser.GameObjects.RenderTexture;
  private units: DrawnUnits;
  private overlays: DrawnOverlays;

  constructor(host: ViewHost) {
    this.landscape = bakeLandscape(host.scene, host.toScreen({ q: 0, r: 0 }));
    this.units = new DrawnUnits(host);
    this.overlays = new DrawnOverlays(host);
  }

  /** Every world object owned right now, so the surface keeps them off the
   * fixed HUD camera (the lazily made ones go through `host.ignoreOnUiCamera`). */
  mapObjects(): Phaser.GameObjects.GameObject[] {
    return [this.landscape, ...this.units.objects(), ...this.overlays.objects()];
  }

  setUnits(units: readonly UnitDrawing[]): void {
    this.units.setUnits(units);
  }

  highlightHexes(hexes: HexCoord[], color: number, alpha = 0.45): void {
    this.overlays.highlightGroups([{ hexes, color, alpha }]);
  }

  highlightHexGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void {
    this.overlays.highlightGroups(groups);
  }

  highlightRings(hexes: HexCoord[], color: number): void {
    this.overlays.addRings(hexes, color);
  }

  clearHighlights(): void {
    this.overlays.clearHighlights();
  }

  showMovementPoints(hex: HexCoord, value: number): void {
    this.overlays.showMovementPoints(hex, value);
  }

  hideMovementPoints(): void {
    this.overlays.hideMovementPoints();
  }

  /** Draws no arrows: a galley's bow is its own rotation (see `DrawnUnits`).
   * The one exception is a staged ship (Placement), which is not a unit yet
   * and so is drawn here as a translucent ghost figure at its pending facing. */
  setFacingIndicators(ships: readonly FacingShip[]): void {
    this.units.setGhost(ghostDrawing(ships));
  }

  clearFacingIndicators(): void {
    this.units.setGhost(null);
  }

  /** Dev-hook reading: the unit figures drawn, and the ghost's real rotation (null if none). */
  inspect(): { unitDrawings: number; ghostRotation: number | null; unitRotations: Record<string, number> } {
    return this.units.inspect();
  }

  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void {
    this.overlays.setDriftArrow(hex, facing, colorHex);
  }

  clearDriftArrow(): void {
    this.overlays.clearDriftArrow();
  }

  setChoiceLabels(labels: readonly { hex: HexCoord; text: string }[]): void {
    this.overlays.setChoiceLabels(labels);
  }

  clearChoiceLabels(): void {
    this.overlays.clearChoiceLabels();
  }

  setRangeLabels(labels: readonly { hex: HexCoord; value: number }[]): void {
    this.overlays.setRangeLabels(labels);
  }

  clearRangeLabels(): void {
    this.overlays.clearRangeLabels();
  }

  destroy(): void {
    this.units.destroy();
    this.overlays.destroy();
    this.landscape.destroy();
  }
}
