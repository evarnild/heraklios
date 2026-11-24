import { markerTextureKey } from './hexRender';

// ยง79: the army builder's row geometry, in canvas pixels, an 1100-wide block (offset into the middle of a wider canvas, ง88). Pure, so
// the numbers are unit-tested; ArmyBuilderScene only draws from it.

/** The width the builder is designed for. */
export const ARMY_LAYOUT_WIDTH = 1100;

/** ง88: the x offset that centres the 1100-wide block on a canvas `canvasWidth` wide (0 at 1100 or less). */
export function armyLayoutOffset(canvasWidth: number): number {
  return Math.max(0, Math.floor((canvasWidth - ARMY_LAYOUT_WIDTH) / 2));
}

export const ARMY_COLUMN_X = [20, 565] as const;
export const ARMY_ROW_TOP = 56;
export const ARMY_ROW_HEIGHT = 68;
export const ARMY_COUNTER_HEIGHT = 60;

/** Each item's x offset from its column's left edge. */
export const ARMY_ROW_OFFSETS = {
  counter: 0,
  name: 66,
  cost: 234,
  clear: 364,
  minus: 394,
  count: 424,
  plus: 454,
  fill: 484,
} as const;

export type ArmyRowX = Record<keyof typeof ARMY_ROW_OFFSETS, number>;

export interface ArmyRowSlot {
  column: number;
  row: number;
  centreY: number;
  x: ArmyRowX;
}

/**
 * Where unit index `index` (its `UNIT_TYPES` index) is drawn.
 *
 * Interpretation: row-major, two columns. Row r holds UNIT_TYPES[2r] on the
 * left and UNIT_TYPES[2r+1] on the right, so a button's reading-order index
 * (devHookMatch.ts sorts by y, then x) stays its UNIT_TYPES index, and the
 * four ships land in the bottom two rows.
 */
export function armyRowSlot(index: number, offsetX = 0): ArmyRowSlot {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const centreY = ARMY_ROW_TOP + ARMY_ROW_HEIGHT * row + ARMY_ROW_HEIGHT / 2;
  const left = offsetX + ARMY_COLUMN_X[column]!;
  const x = {} as ArmyRowX;
  for (const key of Object.keys(ARMY_ROW_OFFSETS) as (keyof ArmyRowX)[]) x[key] = left + ARMY_ROW_OFFSETS[key];
  return { column, row, centreY, x };
}

/** The y just below the last row, for `count` units in two columns. */
export function armyRowsBottom(count: number): number {
  return ARMY_ROW_TOP + ARMY_ROW_HEIGHT * Math.ceil(count / 2);
}

/** Top y of the total line, the error line and the Confirm button. */
export function armyBottomY(count: number): { total: number; error: number; confirm: number } {
  const bottom = armyRowsBottom(count);
  return { total: bottom + 20, error: bottom + 56, confirm: bottom + 20 };
}

/** The counter scaled to a fixed height, aspect kept. */
export function counterDisplaySize(srcWidth: number, srcHeight: number): { width: number; height: number } {
  return { width: (srcWidth * ARMY_COUNTER_HEIGHT) / srcHeight, height: ARMY_COUNTER_HEIGHT };
}

/** The builder shows the print counter the Standard board view draws, in the building player's colour. */
export function counterTextureKey(playerIndex: number, typeId: string): string {
  return markerTextureKey(playerIndex, typeId);
}
