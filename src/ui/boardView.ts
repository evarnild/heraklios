import type Phaser from 'phaser';
import type { HexCoord } from '../data/map';

/**
 * One unit as a view draws it. Units are keyed by `id`, not by hex, so a view
 * (and a later animation) knows a unit that moved is the same unit.
 * `facing` is carried for views that draw a ship's bow on the unit itself;
 * the Standard view draws facings through `setFacingIndicators` instead and
 * ignores it.
 */
export interface UnitDrawing {
  id: string;
  typeId: string;
  owner: number;
  position: HexCoord;
  facing?: number;
}

/**
 * What a scene asks a board view to draw: the drawing half of the old
 * `MapView`. The shared surface (`MapView`: origin, cameras, drag, zoom,
 * hit-testing, hover, tooltip) is not part of it; a second view implements
 * this interface and gets those for free.
 */
export interface BoardView {
  /** Draws exactly these units, reconciled by id (see `reconcileUnits`). */
  setUnits(units: readonly UnitDrawing[]): void;

  highlightHexes(hexes: HexCoord[], color: number, alpha?: number): void;
  highlightHexGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void;
  highlightRings(hexes: HexCoord[], color: number): void;
  clearHighlights(): void;

  showMovementPoints(hex: HexCoord, value: number): void;
  hideMovementPoints(): void;

  setFacingIndicators(ships: readonly { hex: HexCoord; facing: number; playerIndex: number }[]): void;
  clearFacingIndicators(): void;

  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void;
  clearDriftArrow(): void;

  setChoiceLabels(labels: readonly { hex: HexCoord; text: string }[]): void;
  clearChoiceLabels(): void;

  setRangeLabels(labels: readonly { hex: HexCoord; value: number }[]): void;
  clearRangeLabels(): void;

  /** Every world object the view owns right now, so the surface can keep
   * them off the fixed HUD camera. */
  mapObjects(): Phaser.GameObjects.GameObject[];

  destroy(): void;
}

/** What the surface gives a view: the scene, coordinates, and the hook that
 * keeps a world object off the fixed HUD camera (including objects created
 * after `pinUIObjects` ran). */
export interface ViewHost {
  scene: Phaser.Scene;
  toScreen(hex: HexCoord): { x: number; y: number };
  ignoreOnUiCamera(objects: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): void;
}

export interface UnitUpdate {
  unit: UnitDrawing;
  /** True when the type or owner changed, so the counter must be rebuilt
   * rather than just moved. */
  recreate: boolean;
}

export interface UnitDiff {
  add: UnitDrawing[];
  update: UnitUpdate[];
  /** Ids drawn before and absent now. */
  remove: string[];
}

/**
 * Compares what is drawn (`prev`, by id) with the wanted list. An unchanged
 * unit produces no work; a moved or re-faced unit is an `update`, never a
 * remove plus add; a changed type or owner is an `update` with `recreate`.
 * `add` and `update` follow `next`'s order, `remove` follows `prev`'s.
 */
export function reconcileUnits(prev: ReadonlyMap<string, UnitDrawing>, next: readonly UnitDrawing[]): UnitDiff {
  const diff: UnitDiff = { add: [], update: [], remove: [] };
  const seen = new Set<string>();
  for (const unit of next) {
    seen.add(unit.id);
    const old = prev.get(unit.id);
    if (!old) {
      diff.add.push(unit);
      continue;
    }
    const recreate = old.typeId !== unit.typeId || old.owner !== unit.owner;
    const moved = old.position.q !== unit.position.q || old.position.r !== unit.position.r;
    if (recreate || moved || old.facing !== unit.facing) diff.update.push({ unit, recreate });
  }
  for (const id of prev.keys()) if (!seen.has(id)) diff.remove.push(id);
  return diff;
}
