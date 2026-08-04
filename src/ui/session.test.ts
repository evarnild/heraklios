import { describe, it, expect, beforeEach } from 'vitest';
import { session, resetSession, resetToMenu } from './session';
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

  it('does not touch playerNames, combatMode, or randomizedTurnOrder — Menu-chosen preferences meant to persist', () => {
    resetToMenu();
    expect(session.playerNames).toEqual(['Alice', 'Bob']);
    expect(session.combatMode).toBe('single-defender');
    expect(session.randomizedTurnOrder).toBe(true);
  });

  it('leaves playerCount and edges alone — resetSession re-derives both the moment a player count is picked', () => {
    resetToMenu();
    expect(session.playerCount).toBe(2);
    expect(session.edges).toEqual(['W', 'E']);
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
