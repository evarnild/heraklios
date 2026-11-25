import { describe, it, expect } from 'vitest';
import { MARK, PROMPT_HEIGHT, endMoveWarningRect, warningDue } from './endMoveWarningLayout';
import { logPanelBounds } from './logHistory';
import { SIDE_PANEL_WIDTH } from './rulesPanelLayout';

describe('endMoveWarningRect', () => {
  it('lies inside the log rectangle and the side panel', () => {
    const log = logPanelBounds(750, SIDE_PANEL_WIDTH);
    const r = endMoveWarningRect(log);
    expect(r.left).toBeGreaterThanOrEqual(log.left);
    expect(r.top).toBe(log.top);
    expect(r.top + r.height).toBeLessThanOrEqual(log.bottom);
    expect(r.left + r.width).toBeLessThanOrEqual(SIDE_PANEL_WIDTH);
    expect(r.height).toBe(PROMPT_HEIGHT);
  });

  it('is capped at the log height', () => {
    const r = endMoveWarningRect({ left: 16, top: 100, width: 268, bottom: 120 });
    expect(r.height).toBe(20);
  });
});

describe('warningDue', () => {
  const all = { human: true, switchedOff: false, flaggedCount: 2 };
  it('is true when all hold', () => expect(warningDue(all)).toBe(true));
  it('is false when each condition fails alone', () => {
    expect(warningDue({ ...all, human: false })).toBe(false);
    expect(warningDue({ ...all, switchedOff: true })).toBe(false);
    expect(warningDue({ ...all, flaggedCount: 0 })).toBe(false);
  });
});

describe('MARK', () => {
  it('is pinned', () => {
    expect(MARK).toEqual({ width: 14, height: 10, outline: 2, fill: 0xe040fb, line: 0x111111, depth: 14 });
  });
});
