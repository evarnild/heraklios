import type { Rect } from './rulesPanelLayout';

/**
 * The Board's centred prompt boxes that stay up while the Tables panel can be
 * open (§55), sized in one place so `BoardScene` draws them from these and
 * `rulesPanelLayout.test.ts` checks the real ones. Both are centred on the
 * middle of the game (550, 375 at 1100 x 750). The larger decision choosers
 * (retreat, push, advance, exchange sacrifice) set `decisionPending`, which
 * hides the panel, so they are not listed here.
 */
export const RAM_PROMPT = { width: 280, height: 130 } as const;
export const BOARD_PROMPT = { width: 260, height: 120 } as const;

/** Where a prompt of `size` is drawn: centred on the canvas. */
export function centredPromptRect(size: { width: number; height: number }, canvasWidth: number, canvasHeight: number): Rect {
  return { left: canvasWidth / 2 - size.width / 2, top: canvasHeight / 2 - size.height / 2, ...size };
}
