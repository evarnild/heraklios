import type { CombatMode, GameState, Player, PlayerId } from './state';
import { armyValue, livingUnits } from './state';

export function createInitialState(
  players: Player[],
  combatMode: CombatMode = 'multi-defender',
  randomizedTurnOrder = false,
): GameState {
  return {
    players,
    units: [],
    turnNumber: 1,
    activePlayerIndex: 0,
    seatOrder: players.map((p) => p.id),
    phase: 'movement',
    combatMode,
    randomizedTurnOrder,
    gameOver: false,
    winnerId: null,
  };
}

/**
 * Fisher-Yates shuffle of a seat order. Pure and RNG-injectable (rather than
 * reaching for `Math.random()` internally) so callers can unit-test the
 * shuffle deterministically; production code relies on the default.
 *
 * Deliberately reorders the FULL array, eliminated players included, rather
 * than filtering them out first: `seatOrder` always holds every player id for
 * the life of the game (see `GameState.seatOrder`'s doc comment and how
 * `advancePhase` already skips eliminated seats when walking it), so a
 * reshuffle just needs to preserve that invariant, not re-derive it.
 */
export function shuffleSeatOrder(seatOrder: readonly PlayerId[], rng: () => number = Math.random): PlayerId[] {
  const shuffled = [...seatOrder];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/** Advances to the next phase/player, checking end conditions after each combat phase. */
export function advancePhase(state: GameState): void {
  if (state.gameOver) return;

  if (state.phase === 'movement') {
    state.phase = 'combat';
    // Fresh slate for "a unit may only be attacked once per combat phase" —
    // this is the active player's OWN combat phase, so units that were
    // attacked during another player's combat phase are fair game again.
    for (const u of state.units) u.defendedThisPhase = false;
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

  if (wrapped) {
    state.turnNumber += 1;
    // Re-shuffle only here, at the seam between full turns, never mid-round.
    // Reordering mid-round (i.e. changing seatOrder while some players in the
    // current pass haven't acted yet) could let a player who's about to
    // become the new "next" seat move twice in the same round, or skip a
    // player who was about to go — this house rule is meant to vary who
    // starts each turn, not to break "everyone acts once per round."
    if (state.randomizedTurnOrder) {
      state.seatOrder = shuffleSeatOrder(state.seatOrder);
      // Recompute the seat to activate: the loop above found an index into
      // the OLD seatOrder, which is meaningless after reshuffling. Walk the
      // new order from its start for the first surviving (non-eliminated)
      // player — mirrors the skip-eliminated logic above, just starting from
      // seat 0 instead of resuming after the previous active seat.
      nextIndex = state.seatOrder.findIndex((id) => {
        const candidate = state.players.find((p) => p.id === id);
        return candidate && !candidate.eliminated;
      });
    }
  }

  state.activePlayerIndex = nextIndex;
  state.phase = 'movement';
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
