/**
 * Where the Tables panel sits (§55). Pure geometry, so a test can pin that it
 * never covers the centre of the game area, where the Board's decision prompts
 * (ram, boarding, retreat, advance) are drawn, nor the left side panel.
 */
export const SIDE_PANEL_WIDTH = 300;
export const RULES_PANEL_W = 776;
export const RULES_PANEL_H = 266;
const MARGIN = 12;
const TOP = 8;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The area the centred prompts can occupy: centred on the middle of the game
 * (550, 375 at 1100 x 750), up to 340 wide and 200 tall (the retreat and
 * advance choosers are the largest).
 */
export function promptBox(canvasWidth: number, canvasHeight: number): Rect {
  const width = 340;
  const height = 200;
  return { left: canvasWidth / 2 - width / 2, top: canvasHeight / 2 - height / 2, width, height };
}

/** The panel's rectangle: the top right of the game area, above the prompts. */
export function rulesPanelRect(canvasWidth: number): Rect {
  return { left: canvasWidth - RULES_PANEL_W - MARGIN, top: TOP, width: RULES_PANEL_W, height: RULES_PANEL_H };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}
