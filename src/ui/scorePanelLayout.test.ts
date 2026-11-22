import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine/turnManager';
import type { GameState, Player, PlayerId, Unit } from '../engine/state';
import { PLAYER_COLORS_HEX } from './hexRender';
import { messagesFor } from './i18n';
import { SIDE_PANEL_WIDTH, rectsIntersect, rulesPanelRect, visiblePromptRects } from './rulesPanelLayout';
import { SCORE_PANEL_W, scorePanelRect, scorePanelRows } from './scorePanelLayout';

function unit(id: string, owner: PlayerId, typeId: string): Unit {
  return {
    id,
    owner,
    typeId,
    position: { q: 0, r: 0 },
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

describe('the score panel rectangle (§81 B2)', () => {
  it.each([2, 3, 4])('sits bottom right, inside the canvas and clear of everything, for %i players', (n) => {
    const r = scorePanelRect(1100, 750, n);
    expect(r.left + r.width).toBe(1088);
    expect(r.top + r.height).toBe(742);
    expect(r.left).toBeGreaterThanOrEqual(SIDE_PANEL_WIDTH);
    expect(r.width).toBeLessThanOrEqual(300);
    expect(r.width).toBe(SCORE_PANEL_W);
    expect(r.height).toBe(32 + 18 * n);
    expect(rectsIntersect(r, rulesPanelRect(1100))).toBe(false);
    for (const p of visiblePromptRects(1100, 750)) expect(rectsIntersect(r, p)).toBe(false);
    expect(rectsIntersect(r, { left: 380, top: 0, width: 340, height: 750 })).toBe(false);
  });

  it('grows upward by 18 per player with the bottom fixed', () => {
    const a = scorePanelRect(1100, 750, 2);
    const b = scorePanelRect(1100, 750, 3);
    expect(b.top + b.height).toBe(a.top + a.height);
    expect(a.top - b.top).toBe(18);
  });
});

function threePlayers(): GameState {
  const players: Player[] = [0, 1, 2].map((id) => ({
    id: id as PlayerId,
    name: `P${id}`,
    edge: (['W', 'E', 'N'] as const)[id]!,
    purchasePoints: 400,
    eliminated: false,
  }));
  const state = createInitialState(players, 'multi-defender');
  state.seatOrder = [2, 0, 1];
  state.units.push(unit('a', 0, 'fantassins'), unit('b', 0, 'galeres'), unit('c', 1, 'fantassins'));
  state.units.push(unit('d', 1, 'fantassins'));
  return state;
}

describe('the score panel rows (§81 B4, B5, B8, B9, B12)', () => {
  const en = messagesFor('en');

  it('lists players in id order with their colours and names', () => {
    const rows = scorePanelRows(threePlayers(), en);
    expect(rows.map((r) => r.playerId)).toEqual([0, 1, 2]);
    expect(rows.map((r) => r.color)).toEqual([0, 1, 2].map((i) => PLAYER_COLORS_HEX[i]));
    expect(rows.map((r) => r.name)).toEqual(['P0', 'P1', 'P2']);
  });

  it('marks exactly the current player, by id and not by seat position', () => {
    const state = threePlayers();
    expect(scorePanelRows(state, en).map((r) => r.active)).toEqual([false, false, true]);
    state.activePlayerIndex = 1;
    expect(scorePanelRows(state, en).map((r) => r.active)).toEqual([true, false, false]);
  });

  it('reads an eliminated player as 0 pts and 0 units, and the note only on the bonus row', () => {
    const rows = scorePanelRows(threePlayers(), en);
    expect(rows[2]).toMatchObject({ points: '0 pts', units: '0 units', atSea: null });
    expect(rows[0]).toMatchObject({ points: '45 pts', atSea: '(+30 at sea)', units: '2 units' });
    expect(rows[1]).toMatchObject({ points: '10 pts', atSea: null });
  });

  it('writes the singular and the French texts', () => {
    const state = threePlayers();
    state.units.splice(3, 1);
    expect(scorePanelRows(state, en)[1]!.units).toBe('1 unit');
    const fr = scorePanelRows(state, messagesFor('fr'));
    expect(fr[1]!.units).toBe('1 unité');
    expect(fr[2]!.units).toBe('0 unité');
    expect(fr[0]).toMatchObject({ units: '2 unités', atSea: '(+30 en mer)' });
  });
});
