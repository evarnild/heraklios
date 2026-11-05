import { describe, expect, it } from 'vitest';
import type { BoardView, UnitDrawing } from './boardView';
import { ViewDrawingState } from './viewDrawingState';

/** A BoardView that only logs its calls (method name and arguments). */
function fakeView(): { view: BoardView; calls: [string, ...unknown[]][] } {
  const calls: [string, ...unknown[]][] = [];
  const view = new Proxy(
    {},
    {
      get:
        (_t, name: string) =>
        (...args: unknown[]) => {
          calls.push([name, ...args]);
          return name === 'mapObjects' ? [] : undefined;
        },
    },
  ) as BoardView;
  return { view, calls };
}

const U: UnitDrawing = { id: 'a', typeId: 'archers', owner: 1, position: { q: 2, r: 3 } };
const H = { q: 1, r: 1 };

function replayed(state: ViewDrawingState): [string, ...unknown[]][] {
  const { view, calls } = fakeView();
  state.replay(view);
  return calls;
}

describe('ViewDrawingState', () => {
  it('replays only setUnits([]) and the clears when nothing was recorded', () => {
    expect(replayed(new ViewDrawingState()).map((c) => c[0])).toEqual([
      'setUnits',
      'clearHighlights',
      'hideMovementPoints',
      'clearFacingIndicators',
      'clearDriftArrow',
      'clearChoiceLabels',
      'clearRangeLabels',
    ]);
    expect(replayed(new ViewDrawingState())[0]).toEqual(['setUnits', []]);
  });

  it('re-issues the last call of each kind, in order', () => {
    const s = new ViewDrawingState();
    s.setUnits([{ ...U, id: 'old' }]);
    s.setUnits([U]);
    s.highlightHexes([H], 0xff0000, 0.3);
    s.highlightRings([H], 0x00ff00);
    s.showMovementPoints(H, 2);
    s.showMovementPoints(H, 1.5);
    s.setFacingIndicators([{ hex: H, facing: 2, playerIndex: 1 }]);
    s.setDriftArrow(H, 4, '#fff');
    s.setChoiceLabels([{ hex: H, text: 'A' }]);
    s.setRangeLabels([{ hex: H, value: 3 }]);
    expect(replayed(s)).toEqual([
      ['setUnits', [U]],
      ['highlightHexGroups', [{ hexes: [H], color: 0xff0000, alpha: 0.3 }]],
      ['highlightRings', [H], 0x00ff00],
      ['showMovementPoints', H, 1.5],
      ['setFacingIndicators', [{ hex: H, facing: 2, playerIndex: 1 }]],
      ['setDriftArrow', H, 4, '#fff'],
      ['setChoiceLabels', [{ hex: H, text: 'A' }]],
      ['setRangeLabels', [{ hex: H, value: 3 }]],
    ]);
  });

  it('drops earlier rings when a group is drawn', () => {
    const s = new ViewDrawingState();
    s.highlightRings([H], 1);
    s.highlightHexGroups([{ hexes: [H], color: 2 }]);
    expect(replayed(s).some((c) => c[0] === 'highlightRings')).toBe(false);
  });

  it('keeps rings drawn after a group, in order', () => {
    const s = new ViewDrawingState();
    s.highlightHexGroups([{ hexes: [H], color: 2 }]);
    s.highlightRings([H], 1);
    s.highlightRings([{ q: 5, r: 5 }], 3);
    const rings = replayed(s).filter((c) => c[0] === 'highlightRings');
    expect(rings).toEqual([
      ['highlightRings', [H], 1],
      ['highlightRings', [{ q: 5, r: 5 }], 3],
    ]);
  });

  it('clearHighlights drops groups and rings', () => {
    const s = new ViewDrawingState();
    s.highlightHexes([H], 1);
    s.highlightRings([H], 1);
    s.clearHighlights();
    const names = replayed(s).map((c) => c[0]);
    expect(names).toContain('clearHighlights');
    expect(names).not.toContain('highlightHexGroups');
    expect(names).not.toContain('highlightRings');
  });

  it('replays hidden movement points after a hide', () => {
    const s = new ViewDrawingState();
    s.showMovementPoints(H, 3);
    s.hideMovementPoints();
    const names = replayed(s).map((c) => c[0]);
    expect(names).toContain('hideMovementPoints');
    expect(names).not.toContain('showMovementPoints');
  });

  it('forgets cleared labels, facings and the drift arrow', () => {
    const s = new ViewDrawingState();
    s.setChoiceLabels([{ hex: H, text: 'A' }]);
    s.clearChoiceLabels();
    s.setRangeLabels([{ hex: H, value: 1 }]);
    s.clearRangeLabels();
    s.setFacingIndicators([{ hex: H, facing: 0, playerIndex: 0 }]);
    s.clearFacingIndicators();
    s.setDriftArrow(H, 0, '#000');
    s.clearDriftArrow();
    const names = replayed(s).map((c) => c[0]);
    for (const n of ['setChoiceLabels', 'setRangeLabels', 'setFacingIndicators', 'setDriftArrow']) expect(names).not.toContain(n);
  });

  it('copies the arrays it is given', () => {
    const s = new ViewDrawingState();
    const units = [U];
    s.setUnits(units);
    units.length = 0;
    expect(replayed(s)[0]).toEqual(['setUnits', [U]]);
  });
});
