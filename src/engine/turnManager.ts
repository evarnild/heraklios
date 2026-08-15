import type { CombatMode, GameState, Player, PlayerId } from './state';
import { armyValue, livingUnits, unitType } from './state';

export function createInitialState(
  players: Player[],
  combatMode: CombatMode = 'multi-defender',
  randomizedTurnOrder = false,
  /** Mode A (plan.md §9.2.1): `null` (the default) means no clock limit. */
  clockLimitMs: number | null = null,
  /** Mode B: `null` (the default) means no round limit. */
  roundLimit: number | null = null,
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
    winnerIds: [],
    clockLimitMs,
    elapsedMs: 0,
    roundLimit,
    pendingGameEnd: false,
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
    state.winnerIds = remainingPlayers.length === 1 ? [remainingPlayers[0]!.id] : [];
    return;
  }

  // Mode B (round limit): once the round currently in progress has reached
  // the configured cap, mark the pending flag rather than ending here — the
  // wrap check below is where every trigger actually ends the game, so this
  // round still finishes for every seat exactly like the clock and the
  // button do (see `GameState.pendingGameEnd`'s doc comment). Idempotent:
  // this re-fires every combat phase for the rest of the round, which is
  // harmless since it only ever sets the flag, never clears it early.
  if (state.roundLimit !== null && state.turnNumber >= state.roundLimit) {
    state.pendingGameEnd = true;
  }

  // Advance to the next living player's movement phase.
  let nextIndex = state.activePlayerIndex;
  for (let i = 0; i < state.seatOrder.length; i++) {
    nextIndex = (nextIndex + 1) % state.seatOrder.length;
    const candidate = state.players.find((p) => p.id === state.seatOrder[nextIndex]);
    if (candidate && !candidate.eliminated) break;
  }
  const wrapped = nextIndex <= state.activePlayerIndex;

  // Every player has now acted this round (that's what `wrapped` means), so
  // this is the one fair moment for ANY of the three triggers (clock, round
  // limit, or the button) to actually end the game — see
  // `GameState.pendingGameEnd`'s doc comment.
  if (wrapped && state.pendingGameEnd) {
    endGameByTimeLimit(state);
    return;
  }

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

/**
 * Refills the active player's units to their full printed movement allowance
 * and clears any cavalry charge from last turn (see `Unit.charged`'s doc
 * comment: a charge only doubles attack through the charging player's own
 * following Combat phase, so it's cleared here, at the start of that
 * player's NEXT Movement phase). Extracted out of `BoardScene`'s
 * once-scene-only `resetMovementForActivePlayer` so a headless caller (a
 * future self-play harness) gets the same turn-start bookkeeping a human
 * player does — `BoardScene` now delegates to this and only keeps its own
 * scene-only `rammedThisTurn` bookkeeping (which lives outside `GameState`
 * entirely, see engine/actions.ts's `ActionContext` doc comment) locally.
 *
 * Deliberately NOT folded into `advancePhase` itself: `advancePhase` is
 * exercised directly by existing tests that don't expect a movement-reset
 * side effect, and the two concerns (whose turn/phase it is vs. what that
 * turn's units start with) are easier to reason about — and to skip
 * independently, e.g. for a fresh game's very first movement phase, which
 * never went through `advancePhase` at all — kept separate.
 */
export function resetMovementForActivePlayer(state: GameState): void {
  const activeOwner = state.seatOrder[state.activePlayerIndex]!;
  for (const u of state.units) {
    if (!u.destroyed && u.owner === activeOwner) {
      u.movementLeft = unitType(u).movement;
      u.charged = false;
    }
  }
}

/**
 * Ends the game by whichever of the three triggers set `pendingGameEnd`
 * (`advancePhase` calls this itself at the next round wrap — see its doc
 * comment) or, in the fuzz harness, by a bare turn cap reached between
 * rounds. Winner: highest surviving army value in purchase points among
 * players not already eliminated; two or more tied at that value are a draw
 * (`winnerIds` holds all of them — see its doc comment on `GameState` for why
 * this replaced a silent lower-seat tiebreak).
 */
export function endGameByTimeLimit(state: GameState): void {
  state.gameOver = true;
  state.pendingGameEnd = false;
  let bestValue = -1;
  for (const p of state.players) {
    if (p.eliminated) continue;
    const value = armyValue(state, p.id);
    if (value > bestValue) bestValue = value;
  }
  state.winnerIds =
    bestValue < 0
      ? []
      : state.players.filter((p) => !p.eliminated && armyValue(state, p.id) === bestValue).map((p) => p.id);
}

/**
 * Mode C: the Board's "End game" button. Sets the same pending flag the
 * clock and the round limit use, so the button doesn't end the game on the
 * spot either — every player still finishes their current round (see
 * `GameState.pendingGameEnd`'s doc comment). A no-op once the game is
 * already over.
 */
export function requestGameEnd(state: GameState): void {
  if (state.gameOver) return;
  state.pendingGameEnd = true;
}

/**
 * Mode A: advances the whole-game elapsed-time counter by `deltaMs` and, once
 * it reaches `clockLimitMs`, sets `pendingGameEnd` — see that field's doc
 * comment on `GameState`, and `elapsedMs`'s for why this accumulates rather
 * than comparing against a start timestamp. Deliberately keeps running
 * through AI turns and any open prompt (no pause/resume state — see
 * `elapsedMs`'s doc comment). A no-op once the game is over, so a caller
 * driving this from a per-frame scene `update` doesn't need its own guard.
 */
export function advanceGameClock(state: GameState, deltaMs: number): void {
  if (state.gameOver) return;
  state.elapsedMs += deltaMs;
  if (state.clockLimitMs !== null && state.elapsedMs >= state.clockLimitMs) {
    state.pendingGameEnd = true;
  }
}

/** Milliseconds left on the clock, or `null` if Mode A isn't in use — never
 * negative, so a caller can format this directly without clamping first. */
export function remainingClockMs(state: GameState): number | null {
  if (state.clockLimitMs === null) return null;
  return Math.max(0, state.clockLimitMs - state.elapsedMs);
}
