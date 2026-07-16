import type { GameState, Player, PlayerId } from './state';
import { armyValue, livingUnits } from './state';

export function createInitialState(players: Player[]): GameState {
  return {
    players,
    units: [],
    turnNumber: 1,
    activePlayerIndex: 0,
    seatOrder: players.map((p) => p.id),
    phase: 'movement',
    gameOver: false,
    winnerId: null,
  };
}

/** Advances to the next phase/player, checking end conditions after each combat phase. */
export function advancePhase(state: GameState): void {
  if (state.gameOver) return;

  if (state.phase === 'movement') {
    state.phase = 'combat';
    return;
  }

  // Finished a combat phase: check end conditions before moving on.
  const remainingPlayers = state.players.filter((p) => !p.eliminated && livingUnits(state, p.id).length > 0);
  for (const p of state.players) {
    if (!p.eliminated && livingUnits(state, p.id).length === 0) p.eliminated = true;
  }
  if (remainingPlayers.length <= 1) {
    state.gameOver = true;
    state.winnerId = remainingPlayers[0]?.id ?? null;
    return;
  }

  // Advance to the next living player's movement phase.
  let nextIndex = state.activePlayerIndex;
  for (let i = 0; i < state.seatOrder.length; i++) {
    nextIndex = (nextIndex + 1) % state.seatOrder.length;
    const candidate = state.players.find((p) => p.id === state.seatOrder[nextIndex]);
    if (candidate && !candidate.eliminated) break;
  }
  const wrapped = nextIndex <= state.activePlayerIndex;
  state.activePlayerIndex = nextIndex;
  state.phase = 'movement';
  if (wrapped) state.turnNumber += 1;
}

export function endGameByTimeLimit(state: GameState): void {
  state.gameOver = true;
  let best: PlayerId | null = null;
  let bestValue = -1;
  for (const p of state.players) {
    if (p.eliminated) continue;
    const value = armyValue(state, p.id);
    if (value > bestValue) {
      bestValue = value;
      best = p.id;
    }
  }
  state.winnerId = best;
}
