import type Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import type { ActionCue } from '../engine/actionCue';

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
  /** Drawn at `DIMMED_UNIT_ALPHA`: a unit the viewer can't move here (Placement's earlier seats). */
  dimmed?: true;
}

/**
 * One ship's facing indicator. `ghostTypeId` marks a ship that is staged but
 * not yet placed (Placement's `pendingShip`, which is not a unit): the
 * Standard view draws it as an arrow like any other, the Drawn view draws it
 * as a translucent figure of that type turned to `facing`.
 */
export interface FacingShip {
  hex: HexCoord;
  facing: number;
  playerIndex: number;
  ghostTypeId?: string;
  /** The arrow is drawn at `DIMMED_UNIT_ALPHA`, like its dimmed counter. */
  dimmed?: true;
}

/**
 * The alpha of a dimmed unit (Spec 76 I1, A1). Dimmed, owner colour kept: the
 * colour says whose army, the alpha says not yours to move here; an outline
 * would differ between counter and figure, a desaturated colour could collide
 * with another hue. More solid than the staged ghost's 0.5.
 */
export const DIMMED_UNIT_ALPHA = 0.6;

/** The alpha a drawing (or facing arrow) is shown at: 1, or `DIMMED_UNIT_ALPHA` when dimmed. */
export function unitAlpha(d: { readonly dimmed?: true }): number {
  return d.dimmed ? DIMMED_UNIT_ALPHA : 1;
}

/** The id the Drawn view gives the staged ship's provisional figure. */
export const GHOST_SHIP_ID = 'ghost-ship';

/** The staged ship in `ships` as a unit drawing (provisional id), or null if none is staged. */
export function ghostDrawing(ships: readonly FacingShip[]): UnitDrawing | null {
  const g = ships.find((s) => s.ghostTypeId !== undefined);
  if (!g) return null;
  return { id: GHOST_SHIP_ID, typeId: g.ghostTypeId!, owner: g.playerIndex, position: g.hex, facing: g.facing };
}

/**
 * How a `setUnits` reaches the new drawing (§66): `null` is the default (the
 * Drawn view animates the difference between what it shows and what is wanted,
 * unit by unit); an `ActionCue` adds what a drawing cannot carry (a path, a
 * clash, a shake); `'snap'` draws at once after finishing any animation (undo,
 * redo, load, start). The Standard view ignores it.
 */
export type UnitMotion = ActionCue | 'snap' | null;

/**
 * What a scene asks a board view to draw: the drawing half of the old
 * `MapView`. The shared surface (`MapView`: origin, cameras, drag, zoom,
 * hit-testing, hover, tooltip) is not part of it; a second view implements
 * this interface and gets those for free.
 */
export interface BoardView {
  /** Draws exactly these units, reconciled by id (see `reconcileUnits`). */
  setUnits(units: readonly UnitDrawing[], motion?: UnitMotion): void;

  /** Brings every unit to its final drawing at once, the whole animation queue
   * (B9). Optional: a view that does not animate has nothing to finish. */
  finishAnimations?(): void;
  /** Resolves when no animation is playing or queued; at once if none (B11). */
  animationsSettled?(): Promise<void>;

  highlightHexes(hexes: HexCoord[], color: number, alpha?: number): void;
  highlightHexGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void;
  highlightRings(hexes: HexCoord[], color: number): void;
  clearHighlights(): void;

  showMovementPoints(hex: HexCoord, value: number): void;
  hideMovementPoints(): void;

  setFacingIndicators(ships: readonly FacingShip[]): void;
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
  /** True when the type, owner or dimmed flag changed, so the counter must be
   * rebuilt rather than just moved. */
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
 * remove plus add; a changed type, owner or dimmed flag is an `update` with `recreate`.
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
    const recreate = old.typeId !== unit.typeId || old.owner !== unit.owner || old.dimmed !== unit.dimmed;
    const moved = old.position.q !== unit.position.q || old.position.r !== unit.position.r;
    if (recreate || moved || old.facing !== unit.facing) diff.update.push({ unit, recreate });
  }
  for (const id of prev.keys()) if (!seen.has(id)) diff.remove.push(id);
  return diff;
}
