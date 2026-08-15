import { describe, it, expect, beforeEach } from 'vitest';
import { session, resetSession, resetToMenu } from './session';
import { startTestGame } from './testMode';
import { captureCurrentGame } from './saveStorage';
import { emptySelection } from '../engine/army';
import type { GameState } from '../engine/state';

/** A minimal stand-in — `resetToMenu` never reads into it, only replaces the
 * reference, so its shape doesn't matter for these tests. */
function fakeGameState(): GameState {
  return { turnNumber: 3 } as unknown as GameState;
}

describe('resetToMenu', () => {
  beforeEach(() => {
    // Simulate a game in progress, launched via a test-mode shortcut, with
    // player-specific setup that a *leftover* would leak into the next game.
    session.playerCount = 2;
    session.playerNames = ['Alice', 'Bob'];
    session.edges = ['W', 'E'];
    session.armySelections = [emptySelection(), emptySelection()];
    session.combatMode = 'single-defender';
    session.randomizedTurnOrder = true;
    session.clockLimitMs = 30 * 60_000;
    session.roundLimit = 8;
    session.testMode = true;
    session.gameState = fakeGameState();
  });

  it('clears the in-progress game state', () => {
    resetToMenu();
    expect(session.gameState).toBeNull();
  });

  it('clears testMode as a defense-in-depth invariant, even though every current entry point also sets it itself', () => {
    resetToMenu();
    expect(session.testMode).toBe(false);
  });

  it('clears army selections left by the abandoned game — otherwise a stale, mismatched-length array would ' +
      'survive into a test-mode game (which never repopulates it) and get baked into that game\'s save file', () => {
    resetToMenu();
    expect(session.armySelections).toEqual([]);
  });

  it('does not touch playerNames, combatMode, randomizedTurnOrder, clockLimitMs, or roundLimit — ' +
      'Menu-chosen preferences meant to persist', () => {
    resetToMenu();
    expect(session.playerNames).toEqual(['Alice', 'Bob']);
    expect(session.combatMode).toBe('single-defender');
    expect(session.randomizedTurnOrder).toBe(true);
    expect(session.clockLimitMs).toBe(30 * 60_000);
    expect(session.roundLimit).toBe(8);
  });

  it('leaves playerCount and edges alone — resetSession re-derives both the moment a player count is picked', () => {
    resetToMenu();
    expect(session.playerCount).toBe(2);
    expect(session.edges).toEqual(['W', 'E']);
  });
});

describe("startTestGame sizes armySelections to its own playerCount", () => {
  it('leaves a subsequent test-mode game\'s save consistent with its own playerCount', () => {
    // A real 4-player game reaches ArmyBuilder/Placement/Board — `resetSession`
    // sizes `armySelections` to match, same as `MenuScene`'s player-count
    // buttons do.
    resetSession(4);
    session.armySelections = session.armySelections.map(() => emptySelection());
    expect(session.armySelections).toHaveLength(4);

    // Abandon it, then launch a 2-player test-mode game instead of a real
    // one, via the shortcut `testMode.ts` provides.
    resetToMenu();
    startTestGame();
    expect(session.playerCount).toBe(2);

    // This specifically exercises `startTestGame`'s own `armySelections`
    // sizing (see `testMode.ts`'s comment at the equivalent line) — it does
    // NOT exercise `resetToMenu`'s `armySelections` clearing, even though
    // the scenario above sounds like it should: `startTestGame`
    // unconditionally overwrites `armySelections` to match its own
    // `playerCount`, which masks whatever `resetToMenu` left behind at the
    // point this test asserts. Deleting `resetToMenu`'s
    // `session.armySelections = []` line does NOT fail this test — only the
    // direct, narrower test above ("clears army selections left by the
    // abandoned game") catches that regression. Both together give full
    // coverage; neither alone would.
    const save = captureCurrentGame({ attackedThisPhase: [], rammedThisTurn: [] });
    expect(save.armySelections).toHaveLength(save.playerCount);
  });
});

describe('resetSession', () => {
  it('fully overwrites whatever resetToMenu left behind once a player count is picked', () => {
    session.armySelections = [];
    session.testMode = true;
    session.gameState = fakeGameState();

    resetSession(4);

    expect(session.playerCount).toBe(4);
    expect(session.testMode).toBe(false);
    expect(session.gameState).toBeNull();
    expect(session.armySelections).toHaveLength(4);
    expect(session.edges).toHaveLength(4);
  });
});
