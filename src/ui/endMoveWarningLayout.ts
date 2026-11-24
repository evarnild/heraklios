/**
 * §83: the pure parts of the End-phase warning's presentation: when it is
 * due, where its prompt sits in the side panel, and the mark's look.
 */
import type { LogBounds } from './logHistory';
import type { Rect } from './rulesPanelLayout';

/** Prompt height in screen pixels (tuned at the live check). */
export const PROMPT_HEIGHT = 150;

/** B7: the mark drawn on each unmoved unit, in screen pixels at the framed zoom. */
export const MARK = { width: 14, height: 10, outline: 2, fill: 0xe040fb, line: 0x111111, depth: 14 } as const;

/**
 * B8: the prompt is anchored to the top of the log rectangle, so the newest
 * log lines stay visible beneath it. `unmovedUnits` is already empty outside
 * the movement phase.
 */
export function endMoveWarningRect(log: LogBounds): Rect {
  return {
    left: log.left,
    top: log.top,
    width: log.width,
    height: Math.min(PROMPT_HEIGHT, log.bottom - log.top),
  };
}

/** B3/B12: the warning opens only for a human seat that has not switched it off. */
export function warningDue(args: { human: boolean; switchedOff: boolean; flaggedCount: number }): boolean {
  return args.human && !args.switchedOff && args.flaggedCount > 0;
}
