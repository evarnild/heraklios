import { describe, it, expect, vi } from 'vitest';
import {
  advanceGameClock,
  advancePhase,
  carryLiveGameClock,
  createInitialState,
  endGameByTimeLimit,
  remainingClockMs,
  requestGameEnd,
  resetMovementForActivePlayer,
  setClockPaused,
  shuffleSeatOrder,
} from './turnManager';
import type { GameState, Player, PlayerId, Unit } from './state';

/** Deterministic stand-in for `Math.random`: cycles through a fixed sequence
 * of values in [0, 1) so `shuffleSeatOrder`'s Fisher-Yates loop is
 * reproducible instead of flaky. */
function fakeRng(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length]!;
}

describe('shuffleSeatOrder', () => {
  const seatOrder = [0, 1, 2, 3] as PlayerId[];

  it('returns a permutation of the input — every id present exactly once', () => {
    const shuffled = shuffleSeatOrder(seatOrder, fakeRng([0.9, 0.1, 0.5]));
    expect(shuffled).toHaveLength(seatOrder.length);
    expect([...shuffled].sort()).toEqual([...seatOrder].sort());
  });

  it('is deterministic for a given rng sequence', () => {
    const a = shuffleSeatOrder(seatOrder, fakeRng([0.9, 0.1, 0.5]));
    const b = shuffleSeatOrder(seatOrder, fakeRng([0.9, 0.1, 0.5]));
    expect(a).toEqual(b);
  });

  it('does not mutate the input array', () => {
    const copy = [...seatOrder];
    shuffleSeatOrder(seatOrder, fakeRng([0.9, 0.1, 0.5]));
    expect(seatOrder).toEqual(copy);
  });

  it('still returns every id exactly once when one of them is "eliminated"', () => {
    // shuffleSeatOrder itself doesn't know about elimination — it reorders the
    // FULL seat order (see its doc comment) — but this pins that a caller who
    // hands in an order containing an eliminated player's id gets that same
    // id back exactly once, never dropped or duplicated.
    const shuffled = shuffleSeatOrder(seatOrder, fakeRng([0.2, 0.8, 0.4]));
    for (const id of seatOrder) {
      expect(shuffled.filter((x) => x === id)).toHaveLength(1);
    }
  });
});

describe('resetMovementForActivePlayer', () => {
  function buildState(): GameState {
    const players: Player[] = [0, 1].map((id) => ({
      id: id as PlayerId,
      name: `P${id}`,
      edge: id === 0 ? 'W' : 'E',
      purchasePoints: 400,
      eliminated: false,
    }));
    const state = createInitialState(players, 'multi-defender');
    const active: Unit = {
      id: 'active-cav',
      owner: 0,
      typeId: 'cavalerie-legere',
      position: { q: 0, r: 0 },
      movementLeft: 2, // partially spent
      facing: 0,
      defendedThisPhase: false,
      charged: true,
      destroyed: false,
    };
    const destroyedOwn: Unit = {
      id: 'destroyed-own',
      owner: 0,
      typeId: 'fantassins',
      position: { q: 1, r: 0 },
      movementLeft: 0,
      facing: 0,
      defendedThisPhase: false,
      charged: false,
      destroyed: true,
    };
    const other: Unit = {
      id: 'other-player',
      owner: 1,
      typeId: 'fantassins',
      position: { q: 2, r: 0 },
      movementLeft: 1,
      facing: 0,
      defendedThisPhase: false,
      charged: false,
      destroyed: false,
    };
    state.units = [active, destroyedOwn, other];
    return state;
  }

  it('refills the active player\'s living units to their full movement allowance and clears charged', () => {
    const state = buildState();
    resetMovementForActivePlayer(state);
    const active = state.units.find((u) => u.id === 'active-cav')!;
    expect(active.movementLeft).toBe(6); // cavalerie-legere's full printed movement
    expect(active.charged).toBe(false);
  });

  it('leaves the other player\'s units and destroyed units untouched', () => {
    const state = buildState();
    resetMovementForActivePlayer(state);
    expect(state.units.find((u) => u.id === 'other-player')!.movementLeft).toBe(1);
    expect(state.units.find((u) => u.id === 'destroyed-own')!.movementLeft).toBe(0);
  });
});

describe('advancePhase — randomized turn order reshuffle', () => {
  /**
   * 4 players; player 3 starts pre-eliminated with no units. Players 0-2
   * each hold one living unit, so the game doesn't end when the wrap check
   * runs. `activePlayerIndex` is parked on the last surviving seat (2) so
   * that finishing its combat phase forces a wrap to turn 2 — the only seam
   * where a reshuffle is allowed to happen.
   */
  function buildWrappingState(): GameState {
    const players: Player[] = [0, 1, 2, 3].map((id) => ({
      id: id as PlayerId,
      name: `P${id}`,
      edge: (['W', 'E', 'N', 'S'] as const)[id]!,
      purchasePoints: 400,
      eliminated: id === 3,
    }));
    const state = createInitialState(players, 'multi-defender', true);
    for (const id of [0, 1, 2]) {
      const unit: Unit = {
        id: `u${id}`,
        owner: id as PlayerId,
        typeId: 'fantassins',
        position: { q: id, r: 0 },
        movementLeft: 0,
        facing: 0,
        defendedThisPhase: false,
        charged: false,
        destroyed: false,
      };
      state.units.push(unit);
    }
    state.phase = 'combat';
    state.activePlayerIndex = 2;
    return state;
  }

  /** Runs `advancePhase` once under a deterministic, mocked `Math.random`
   * (the reshuffle in `advancePhase` isn't itself RNG-injectable — it relies
   * on `shuffleSeatOrder`'s default — so mocking the global is how this test
   * stays deterministic instead of flaky). */
  function advanceWithMockedRandom(state: GameState, sequence: number[]): void {
    let i = 0;
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => sequence[i++ % sequence.length]!);
    try {
      advancePhase(state);
    } finally {
      spy.mockRestore();
    }
  }

  it('keeps activePlayerIndex a valid index into the reshuffled seatOrder', () => {
    const state = buildWrappingState();
    advanceWithMockedRandom(state, [0.9, 0.1, 0.6]);

    expect(state.turnNumber).toBe(2); // confirms the wrap (and thus reshuffle) actually happened
    expect(state.activePlayerIndex).toBeGreaterThanOrEqual(0);
    expect(state.activePlayerIndex).toBeLessThan(state.seatOrder.length);
  });

  it('preserves every player id exactly once in the reshuffled seatOrder', () => {
    const state = buildWrappingState();
    const before = [...state.seatOrder].sort();
    advanceWithMockedRandom(state, [0.42, 0.42, 0.42]);

    expect([...state.seatOrder].sort()).toEqual(before);
  });

  it('never activates the eliminated player after a reshuffle, across several rng sequences', () => {
    const trials = [
      [0.99, 0.01, 0.5],
      [0.1, 0.9, 0.2],
      [0.5, 0.5, 0.5],
      [0.0, 0.99, 0.33],
      // Fisher-Yates on [0,1,2,3] with this sequence lands the eliminated
      // player (id 3) at seat 0: without this trial every other sequence
      // above happens to put a non-eliminated id at seat 0, so `findIndex`
      // returns 0 immediately and the skip-eliminated branch in
      // `advancePhase` is never actually exercised — this one forces it.
      [0.1, 0.9, 0.9],
    ];
    for (const sequence of trials) {
      const state = buildWrappingState();
      advanceWithMockedRandom(state, sequence);

      const activeId = state.seatOrder[state.activePlayerIndex];
      const activePlayer = state.players.find((p) => p.id === activeId)!;
      expect(activePlayer.eliminated).toBe(false);
    }
  });

  it('skips the eliminated seat when the reshuffle puts it first', () => {
    const state = buildWrappingState();
    advanceWithMockedRandom(state, [0.1, 0.9, 0.9]);

    // This rng sequence reshuffles [0,1,2,3] to [3,1,2,0] (eliminated id 3
    // first), so the first surviving seat is index 1 (id 1), not index 0.
    expect(state.seatOrder).toEqual([3, 1, 2, 0]);
    expect(state.activePlayerIndex).toBe(1);
  });

  it('preserves the once-per-round invariant across many reshuffled rounds', () => {
    const players: Player[] = [0, 1, 2, 3].map((id) => ({
      id: id as PlayerId,
      name: `P${id}`,
      edge: (['W', 'E', 'N', 'S'] as const)[id]!,
      purchasePoints: 400,
      eliminated: false,
    }));
    const state = createInitialState(players, 'multi-defender', true);
    for (const id of [0, 1, 2, 3]) {
      const unit: Unit = {
        id: `u${id}`,
        owner: id as PlayerId,
        typeId: 'fantassins',
        position: { q: id, r: 0 },
        movementLeft: 0,
        facing: 0,
        defendedThisPhase: false,
        charged: false,
        destroyed: false,
      };
      state.units.push(unit);
    }

    // A tiny LCG rather than a short repeating sequence, so consecutive
    // reshuffles actually differ from each other instead of every round
    // landing on the same permutation.
    let seed = 42;
    const lcg = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const spy = vi.spyOn(Math, 'random').mockImplementation(lcg);

    try {
      const ROUNDS = 20;
      let currentRound: PlayerId[] = [];
      let lastTurnNumber = state.turnNumber;

      for (let step = 0; step < ROUNDS * players.length; step++) {
        currentRound.push(state.seatOrder[state.activePlayerIndex]!);

        advancePhase(state); // movement -> combat
        advancePhase(state); // combat -> next player's movement (reshuffles on wrap)

        if (state.turnNumber !== lastTurnNumber) {
          expect([...currentRound].sort()).toEqual([0, 1, 2, 3]);
          currentRound = [];
          lastTurnNumber = state.turnNumber;
        }
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('never reshuffles when a combat phase ends without wrapping to a new round', () => {
    const state = buildWrappingState();
    state.activePlayerIndex = 0; // not the last seat, so finishing combat won't wrap
    const before = [...state.seatOrder];
    advanceWithMockedRandom(state, [0.9, 0.1, 0.6]);

    expect(state.turnNumber).toBe(1); // no wrap this time
    expect(state.seatOrder).toEqual(before);
  });

  it('leaves seatOrder untouched when randomizedTurnOrder is off, even across a wrap', () => {
    const state = buildWrappingState();
    state.randomizedTurnOrder = false;
    const before = [...state.seatOrder];
    advanceWithMockedRandom(state, [0.9, 0.1, 0.6]);

    expect(state.turnNumber).toBe(2); // still wrapped
    expect(state.seatOrder).toEqual(before); // but order is untouched
  });
});

// -----------------------------------------------------------------------
// plan.md §9.2: the endgame triggers (clock, round limit, the "End game"
// button) and the fairness rule that ties them together.
// -----------------------------------------------------------------------

function buildUnit(id: string, owner: PlayerId, typeId: string, q: number): Unit {
  return {
    id,
    owner,
    typeId,
    position: { q, r: 0 },
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/** 3 players, each with one living `fantassins` (5 points), so nobody is
 * eliminated and every seat has equal army value unless a test overrides it —
 * exactly the shape needed to exercise the round-wrap fairness rule without
 * the mutual-elimination path short-circuiting it. */
function buildThreePlayerState(): GameState {
  const players: Player[] = [0, 1, 2].map((id) => ({
    id: id as PlayerId,
    name: `P${id}`,
    edge: (['W', 'E', 'N'] as const)[id]!,
    purchasePoints: 400,
    eliminated: false,
  }));
  const state = createInitialState(players, 'multi-defender');
  for (const id of [0, 1, 2]) {
    state.units.push(buildUnit(`u${id}`, id as PlayerId, 'fantassins', id));
  }
  state.phase = 'combat';
  return state;
}

describe('createInitialState — clock/round limit parameters (plan.md §9.2.2 #4)', () => {
  // The Menu's cycling buttons pass a chosen clockLimitMs/roundLimit through
  // to createInitialState; nothing else in the engine sets these two fields
  // on a fresh game. Without this test a transposed argument order, or the
  // parameters being silently ignored, would ship with every other test in
  // the suite still green — those all set clockLimitMs/roundLimit by
  // mutating the state *after* creation, never through the constructor.
  function twoPlayers(): Player[] {
    return [0, 1].map((id) => ({
      id: id as PlayerId,
      name: `P${id}`,
      edge: id === 0 ? 'W' : 'E',
      purchasePoints: 400,
      eliminated: false,
    }));
  }

  it('threads a chosen clock limit and round limit into GameState', () => {
    const state = createInitialState(twoPlayers(), 'multi-defender', false, 30 * 60_000, 8);
    expect(state.clockLimitMs).toBe(30 * 60_000);
    expect(state.roundLimit).toBe(8);
  });

  it('defaults both limits off, with a fresh clock and no pending end', () => {
    const state = createInitialState(twoPlayers());
    expect(state.clockLimitMs).toBeNull();
    expect(state.roundLimit).toBeNull();
    expect(state.elapsedMs).toBe(0);
    expect(state.pendingGameEnd).toBe(false);
  });
});

describe('advancePhase — round limit and pendingGameEnd (plan.md §9.2.2 #1)', () => {
  it('does not end the game mid-round when the round limit is reached', () => {
    const state = buildThreePlayerState();
    state.roundLimit = 3;
    state.turnNumber = 3;
    state.activePlayerIndex = 0; // seat 0 finishing combat — not the last seat this round

    advancePhase(state);

    expect(state.pendingGameEnd).toBe(true); // trigger fired...
    expect(state.gameOver).toBe(false); // ...but the round isn't over yet
    expect(state.activePlayerIndex).toBe(1); // seat 1 still gets its turn
  });

  it('ends the game at the wrap once every seat has played the round the limit was reached in', () => {
    const state = buildThreePlayerState();
    state.roundLimit = 3;
    state.turnNumber = 3;
    state.activePlayerIndex = 0;

    advancePhase(state); // seat 0 -> seat 1 (movement); pendingGameEnd set
    advancePhase(state); // seat 1 movement -> combat
    advancePhase(state); // seat 1 -> seat 2 (movement)
    advancePhase(state); // seat 2 movement -> combat
    advancePhase(state); // seat 2's combat ends the round -> wrap -> game ends

    expect(state.gameOver).toBe(true);
    expect(state.winnerIds).toEqual([0, 1, 2]); // every seat holds equal army value
    // turnNumber must NOT have advanced past the round that was actually
    // finished — every seat played round 3, and only round 3.
    expect(state.turnNumber).toBe(3);
  });

  it('is unaffected by round limits that have not been reached yet', () => {
    const state = buildThreePlayerState();
    state.roundLimit = 8;
    state.turnNumber = 3;
    state.activePlayerIndex = 2; // last seat — finishing combat wraps

    advancePhase(state);

    expect(state.pendingGameEnd).toBe(false);
    expect(state.gameOver).toBe(false);
    expect(state.turnNumber).toBe(4);
  });

  it('leaves round-limit games alone when roundLimit is off (null)', () => {
    const state = buildThreePlayerState();
    state.roundLimit = null;
    state.turnNumber = 500;
    state.activePlayerIndex = 2;

    advancePhase(state);

    expect(state.pendingGameEnd).toBe(false);
    expect(state.gameOver).toBe(false);
  });
});

describe('requestGameEnd (Mode C: the Board\'s "End game" button)', () => {
  it('sets pendingGameEnd without ending the game on the spot', () => {
    const state = buildThreePlayerState();
    requestGameEnd(state);
    expect(state.pendingGameEnd).toBe(true);
    expect(state.gameOver).toBe(false);
  });

  it('every remaining seat still finishes the round it was pressed in, exactly like the round limit', () => {
    const state = buildThreePlayerState();
    state.activePlayerIndex = 0;
    requestGameEnd(state); // pressed mid-round, during seat 0's combat phase

    advancePhase(state); // seat 0 -> seat 1 movement
    expect(state.gameOver).toBe(false);
    advancePhase(state); // seat 1 movement -> combat
    advancePhase(state); // seat 1 -> seat 2 movement
    expect(state.gameOver).toBe(false);
    advancePhase(state); // seat 2 movement -> combat
    advancePhase(state); // seat 2's combat ends the round -> game ends

    expect(state.gameOver).toBe(true);
  });

  it('is a no-op once the game is already over', () => {
    const state = buildThreePlayerState();
    state.gameOver = true;
    state.winnerIds = [1];
    requestGameEnd(state);
    expect(state.pendingGameEnd).toBe(false);
    expect(state.winnerIds).toEqual([1]);
  });
});

describe('advanceGameClock and remainingClockMs (Mode A: the clock)', () => {
  it('accumulates elapsed time rather than tracking a start timestamp', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = 10_000;
    advanceGameClock(state, 3_000);
    advanceGameClock(state, 4_000);
    expect(state.elapsedMs).toBe(7_000);
    expect(state.pendingGameEnd).toBe(false);
  });

  it('sets pendingGameEnd once elapsed time reaches the limit', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = 10_000;
    advanceGameClock(state, 10_000);
    expect(state.pendingGameEnd).toBe(true);
  });

  it('is a no-op once the game is over, so a resumed-but-finished game cannot re-trigger anything', () => {
    const state = buildThreePlayerState();
    state.gameOver = true;
    state.clockLimitMs = 1;
    advanceGameClock(state, 1_000);
    expect(state.elapsedMs).toBe(0);
    expect(state.pendingGameEnd).toBe(false);
  });

  it('remainingClockMs is null when the clock is off', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = null;
    expect(remainingClockMs(state)).toBeNull();
  });

  it('remainingClockMs counts down and never goes negative', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = 10_000;
    state.elapsedMs = 4_000;
    expect(remainingClockMs(state)).toBe(6_000);
    state.elapsedMs = 15_000;
    expect(remainingClockMs(state)).toBe(0);
  });
});

describe('carryLiveGameClock (undo must not rewind the wall clock)', () => {
  it('overwrites the restored elapsedMs with the live value', () => {
    const restored = buildThreePlayerState();
    restored.elapsedMs = 3_000; // the snapshot's older, smaller elapsed time
    carryLiveGameClock(restored, { elapsedMs: 9_000, pendingGameEnd: false, paused: false });
    expect(restored.elapsedMs).toBe(9_000);
  });

  it('keeps pendingGameEnd true if the restored snapshot already had it set', () => {
    const restored = buildThreePlayerState();
    restored.pendingGameEnd = true;
    carryLiveGameClock(restored, { elapsedMs: 0, pendingGameEnd: false, paused: false });
    expect(restored.pendingGameEnd).toBe(true);
  });

  it('sets pendingGameEnd true if the live game had it set even though the older snapshot did not', () => {
    const restored = buildThreePlayerState();
    restored.pendingGameEnd = false;
    carryLiveGameClock(restored, { elapsedMs: 0, pendingGameEnd: true, paused: false });
    expect(restored.pendingGameEnd).toBe(true);
  });

  it('leaves pendingGameEnd false when neither side had it set', () => {
    const restored = buildThreePlayerState();
    restored.pendingGameEnd = false;
    carryLiveGameClock(restored, { elapsedMs: 0, pendingGameEnd: false, paused: false });
    expect(restored.pendingGameEnd).toBe(false);
  });

  it('overwrites the restored paused flag with the live value in both directions', () => {
    const pausedInSnapshot = buildThreePlayerState();
    pausedInSnapshot.paused = true;
    carryLiveGameClock(pausedInSnapshot, { elapsedMs: 0, pendingGameEnd: false, paused: false });
    expect(pausedInSnapshot.paused).toBe(false); // live game had resumed since the snapshot

    const runningInSnapshot = buildThreePlayerState();
    runningInSnapshot.paused = false;
    carryLiveGameClock(runningInSnapshot, { elapsedMs: 0, pendingGameEnd: false, paused: true });
    expect(runningInSnapshot.paused).toBe(true); // live game had paused since the snapshot
  });
});

describe('setClockPaused', () => {
  it('sets and clears paused', () => {
    const state = buildThreePlayerState();
    setClockPaused(state, true);
    expect(state.paused).toBe(true);
    setClockPaused(state, false);
    expect(state.paused).toBe(false);
  });

  it('is a no-op once the game is already over', () => {
    const state = buildThreePlayerState();
    state.gameOver = true;
    setClockPaused(state, true);
    expect(state.paused).toBe(false);
  });
});

describe('advanceGameClock respects paused', () => {
  it('does not accumulate elapsed time while paused', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = 10_000;
    state.paused = true;
    advanceGameClock(state, 5_000);
    expect(state.elapsedMs).toBe(0);
  });

  it('resumes accumulating once unpaused', () => {
    const state = buildThreePlayerState();
    state.clockLimitMs = 10_000;
    state.paused = true;
    advanceGameClock(state, 5_000);
    state.paused = false;
    advanceGameClock(state, 3_000);
    expect(state.elapsedMs).toBe(3_000);
  });
});

describe('endGameByTimeLimit — draws (plan.md §9.2.2 #2)', () => {
  it('declares a single winner when one player strictly leads on army value', () => {
    const state = buildThreePlayerState();
    // Give seat 1 a second unit so it strictly leads.
    state.units.push(buildUnit('u1b', 1 as PlayerId, 'fantassins', 10));

    endGameByTimeLimit(state);

    expect(state.gameOver).toBe(true);
    expect(state.winnerIds).toEqual([1]);
  });

  it('declares a draw between every player tied at the highest value — no lower-seat tiebreak', () => {
    const state = buildThreePlayerState(); // all three seats hold equal army value

    endGameByTimeLimit(state);

    expect(state.winnerIds).toEqual([0, 1, 2]);
  });

  it('declares a two-way draw, excluding a strictly lower third player', () => {
    const state = buildThreePlayerState();
    state.units.push(buildUnit('u1b', 1 as PlayerId, 'fantassins', 10)); // seat 1 now leads...
    state.units.push(buildUnit('u2b', 2 as PlayerId, 'fantassins', 11)); // ...tied with seat 2

    endGameByTimeLimit(state);

    expect(state.winnerIds).toEqual([1, 2]);
  });

  it('excludes eliminated players from winning or drawing', () => {
    const state = buildThreePlayerState();
    state.players[0]!.eliminated = true;

    endGameByTimeLimit(state);

    expect(state.winnerIds).toEqual([1, 2]);
  });

  it('produces no winner when every player is eliminated', () => {
    const state = buildThreePlayerState();
    for (const p of state.players) p.eliminated = true;

    endGameByTimeLimit(state);

    expect(state.winnerIds).toEqual([]);
  });

  it('clears pendingGameEnd as part of actually ending the game', () => {
    const state = buildThreePlayerState();
    state.pendingGameEnd = true;

    endGameByTimeLimit(state);

    expect(state.pendingGameEnd).toBe(false);
  });
});
