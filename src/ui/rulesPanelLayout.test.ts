import { describe, expect, it } from 'vitest';
import { SIDE_PANEL_WIDTH, promptBox, rectsIntersect, rulesPanelRect } from './rulesPanelLayout';

describe('the Tables panel layout (§55)', () => {
  it('detects an overlap, and a touching edge is not one', () => {
    const a = { left: 0, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, { left: 9, top: 9, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect(a, { left: 10, top: 0, width: 5, height: 5 })).toBe(false);
  });

  it('never covers the centred prompts, at the game size or wider', () => {
    for (const [w, h] of [[1100, 750], [1280, 750], [1100, 800]] as const) {
      expect(rectsIntersect(rulesPanelRect(w), promptBox(w, h)), `${w}x${h}`).toBe(false);
    }
  });

  it('keeps clear of the left side panel and inside the canvas at the game size', () => {
    const r = rulesPanelRect(1100);
    expect(r.left).toBeGreaterThanOrEqual(SIDE_PANEL_WIDTH);
    expect(r.left + r.width).toBeLessThanOrEqual(1100);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });

  it('puts the prompt box where the prompts are: centred on (550, 375)', () => {
    expect(promptBox(1100, 750)).toEqual({ left: 380, top: 275, width: 340, height: 200 });
  });
});
