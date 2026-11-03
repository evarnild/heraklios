import { BOARD_PROMPT, RAM_PROMPT, centredPromptRect } from './boardPrompts';

/**
 * Where the Tables panel sits (§55). Pure geometry, so a test can pin that it
 * stays clear of the prompts that are shown while it is open (the ram and
 * boarding prompts, from `boardPrompts.ts`, which `BoardScene` draws from) and
 * of the left side panel. The decision choosers (retreat, push, advance,
 * exchange sacrifice) are larger and set `decisionPending`; the panel is hidden
 * while it is set (`rulesPanelState.ts`), so they are not modelled here.
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

/** The prompts that can be on screen beside an open panel, at a canvas size. */
export function visiblePromptRects(canvasWidth: number, canvasHeight: number): Rect[] {
  return [RAM_PROMPT, BOARD_PROMPT].map((p) => centredPromptRect(p, canvasWidth, canvasHeight));
}

/** The panel's rectangle: the top right of the game area, above the prompts. */
export function rulesPanelRect(canvasWidth: number): Rect {
  return { left: canvasWidth - RULES_PANEL_W - MARGIN, top: TOP, width: RULES_PANEL_W, height: RULES_PANEL_H };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}
