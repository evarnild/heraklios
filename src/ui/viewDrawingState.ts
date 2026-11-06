import type { HexCoord } from '../data/map';
import type { BoardView, FacingShip, UnitDrawing } from './boardView';

type Group = { hexes: HexCoord[]; color: number; alpha?: number };
type Ring = { hexes: HexCoord[]; color: number };
type Ship = FacingShip;
type ChoiceLabel = { hex: HexCoord; text: string };
type RangeLabel = { hex: HexCoord; value: number };

/**
 * Remembers the last call of each `BoardView` setter, so a second view can be
 * brought to exactly what the first one showed when the player toggles the
 * view (§64 B2). Pure: type imports only.
 *
 * Highlights follow `StandardBoardView`'s clearing rule: `highlightHexGroups`
 * (and so `highlightHexes`) clears the rings as well, `highlightRings` adds,
 * `clearHighlights` clears both. Copying that rule is what stops a toggle
 * from bringing back rings the old view had already dropped.
 */
export class ViewDrawingState {
  private units: UnitDrawing[] = [];
  private groups: Group[] | null = null;
  private rings: Ring[] = [];
  private movement: { hex: HexCoord; value: number } | null = null;
  private facings: Ship[] | null = null;
  private drift: { hex: HexCoord; facing: number; colorHex: string } | null = null;
  private choice: ChoiceLabel[] | null = null;
  private range: RangeLabel[] | null = null;

  setUnits(units: readonly UnitDrawing[]): void {
    this.units = [...units];
  }

  highlightHexes(hexes: HexCoord[], color: number, alpha = 0.45): void {
    this.highlightHexGroups([{ hexes, color, alpha }]);
  }

  highlightHexGroups(groups: Group[]): void {
    this.groups = [...groups];
    this.rings = [];
  }

  highlightRings(hexes: HexCoord[], color: number): void {
    this.rings.push({ hexes: [...hexes], color });
  }

  clearHighlights(): void {
    this.groups = null;
    this.rings = [];
  }

  showMovementPoints(hex: HexCoord, value: number): void {
    this.movement = { hex, value };
  }

  hideMovementPoints(): void {
    this.movement = null;
  }

  setFacingIndicators(ships: readonly Ship[]): void {
    this.facings = [...ships];
  }

  clearFacingIndicators(): void {
    this.facings = null;
  }

  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void {
    this.drift = { hex, facing, colorHex };
  }

  clearDriftArrow(): void {
    this.drift = null;
  }

  setChoiceLabels(labels: readonly ChoiceLabel[]): void {
    this.choice = [...labels];
  }

  clearChoiceLabels(): void {
    this.choice = null;
  }

  setRangeLabels(labels: readonly RangeLabel[]): void {
    this.range = [...labels];
  }

  clearRangeLabels(): void {
    this.range = null;
  }

  /** Re-issues what was recorded, in a fixed order: units, groups, rings,
   * movement, facings, drift, choice, range. Whatever was never set (or was
   * cleared) is issued as its clear, so the target starts from nothing. */
  replay(view: BoardView): void {
    view.setUnits(this.units);
    if (this.groups) view.highlightHexGroups(this.groups);
    else view.clearHighlights();
    for (const ring of this.rings) view.highlightRings(ring.hexes, ring.color);
    if (this.movement) view.showMovementPoints(this.movement.hex, this.movement.value);
    else view.hideMovementPoints();
    if (this.facings) view.setFacingIndicators(this.facings);
    else view.clearFacingIndicators();
    if (this.drift) view.setDriftArrow(this.drift.hex, this.drift.facing, this.drift.colorHex);
    else view.clearDriftArrow();
    if (this.choice) view.setChoiceLabels(this.choice);
    else view.clearChoiceLabels();
    if (this.range) view.setRangeLabels(this.range);
    else view.clearRangeLabels();
  }
}
