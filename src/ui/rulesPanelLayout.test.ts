import { describe, expect, it } from 'vitest';
import { BOARD_PROMPT, RAM_PROMPT } from './boardPrompts';
import { SIDE_PANEL_WIDTH, chooserRect, rectsIntersect, rulesPanelRect, visiblePromptRects } from './rulesPanelLayout';

describe('the Tables panel layout (§55)', () => {
  it('detects an overlap, and a touching edge is not one', () => {
    const a = { left: 0, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, { left: 9, top: 9, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect(a, { left: 10, top: 0, width: 5, height: 5 })).toBe(false);
  });

  it('never covers a prompt shown while it is open (ram, boarding), at the game size or wider', () => {
    for (const [w, h] of [[1100, 750], [1280, 750], [1100, 800]] as const) {
      for (const prompt of visiblePromptRects(w, h)) {
        expect(rectsIntersect(rulesPanelRect(w), prompt), `${w}x${h}`).toBe(false);
      }
    }
  });

  it('keeps clear of the left side panel and inside the canvas at the game size', () => {
    const r = rulesPanelRect(1100);
    expect(r.left).toBeGreaterThanOrEqual(SIDE_PANEL_WIDTH);
    expect(r.left + r.width).toBeLessThanOrEqual(1100);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });

  it('sits at 312..1088 x 8..274 at the game size (the top margin and the bottom edge are pinned)', () => {
    expect(rulesPanelRect(1100)).toEqual({ left: 312, top: 8, width: 776, height: 266 });
  });

  it('puts the ram and boarding prompts where BoardScene draws them: centred on (550, 375)', () => {
    expect(RAM_PROMPT).toEqual({ width: 280, height: 130 });
    expect(BOARD_PROMPT).toEqual({ width: 260, height: 120 });
    expect(visiblePromptRects(1100, 750)).toEqual([
      { left: 410, top: 310, width: 280, height: 130 },
      { left: 420, top: 315, width: 260, height: 120 },
    ]);
  });

  it('places the advance and exchange choosers below the panel, centred, at 1100 and 1600 wide (§84)', () => {
    for (const w of [1100, 1600]) {
      const panel = rulesPanelRect(w);
      const sizes = [
        ...[1, 2, 3, 4, 5, 6].map((n) => ({ width: 320, height: 76 + n * 26 })),
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ width: 340, height: 110 + n * 24 })),
      ];
      for (const size of sizes) {
        const r = chooserRect(size, w, 750);
        expect(rectsIntersect(r, panel), `${w} ${size.height}`).toBe(false);
        expect(r.top).toBe(286);
        expect(r.left + r.width / 2).toBe(w / 2);
      }
    }
  });

  it('clamps a chooser too tall for the room below inside the canvas', () => {
    const r = chooserRect({ width: 340, height: 600 }, 1100, 750);
    expect(r.top).toBe(150);
    expect(r.top + r.height).toBeLessThanOrEqual(750);
    expect(chooserRect({ width: 340, height: 900 }, 1100, 750).top).toBe(0);
  });
});
