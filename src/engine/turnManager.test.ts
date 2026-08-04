import { describe, it, expect, vi } from 'vitest';
import { advancePhase, createInitialState, shuffleSeatOrder } from './turnManager';
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
