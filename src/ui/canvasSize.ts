// §88: the game canvas is as wide as the page offers at startup, never under
// today's 1100, and always 750 tall (width only). Pure so it is unit-tested;
// main.ts reads the page once and passes the number in.

export const BASE_WIDTH = 1100;
export const BASE_HEIGHT = 750;

/** The canvas size for a page `availableWidth` CSS pixels wide (0 or NaN: unknown, so the base size). */
export function canvasSize(availableWidth: number): { width: number; height: number } {
  return { width: Math.max(BASE_WIDTH, Math.floor(availableWidth) || 0), height: BASE_HEIGHT };
}
