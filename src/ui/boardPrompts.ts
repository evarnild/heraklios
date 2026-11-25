import type { Rect } from './rulesPanelLayout';

/**
 * The Board's centred prompt boxes that stay up while the Tables panel can be
 * open (§55), sized in one place so `BoardScene` draws them from these and
 * `rulesPanelLayout.test.ts` checks the real ones. Both are centred on the
 * middle of the game (550, 375 at 1100 x 750). The advance and exchange
 * choosers are placed below the panel by `chooserRect` in
 * `rulesPanelLayout.ts` (§84).
 */
export const RAM_PROMPT = { width: 280, height: 130 } as const;
export const BOARD_PROMPT = { width: 260, height: 120 } as const;

/** The advance offer and the exchange chooser (§84): `baseHeight` plus one `rowHeight` per listed unit. */
export const ADVANCE_CHOOSER = { width: 320, baseHeight: 76, rowHeight: 26 } as const;
export const EXCHANGE_CHOOSER = { width: 340, baseHeight: 110, rowHeight: 24 } as const;

/** Where a prompt of `size` is drawn: centred on the canvas. */
export function centredPromptRect(size: { width: number; height: number }, canvasWidth: number, canvasHeight: number): Rect {
  return { left: canvasWidth / 2 - size.width / 2, top: canvasHeight / 2 - size.height / 2, ...size };
}
