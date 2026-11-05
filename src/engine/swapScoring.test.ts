import { describe, it, expect } from 'vitest';
import { hexKey as mapHexKey } from '../data/map';
import type { HexCoord } from '../data/map';
import { getUnitType } from '../data/units';
import { legalActions } from './actions';
import {
  SWAP_PROBE_LIMIT,
  contactGain,
  isFrontLinePair,
  scoreSwaps,
  shelterGain,
  swappedClone,
  type LandSwapAction,
} from './swapScoring';
import { maxEquipmentPointsForType, type GameState, type Player, type Unit } from './state';
import { createInitialState } from './turnManager';

/** (10,3)-(19,3) are all plain: a straight row of uniform-cost hexes. */
function landRow(offset: number): HexCoord {
  return { q: 10 + offset, r: 3 };
}

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: HexCoord }): Unit {
  const t = getUnitType(overrides.typeId);
  return {
    id: overrides.id ?? `u-${overrides.position.q},${overrides.position.r}`,
    owner: 0,
    movementLeft: 3,
    facing: 0,
    equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...overrides,
  };
}

function makeGame(units: Unit[]): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = 'movement';
  return state;
}

function pairGame(): { state: GameState; swap: LandSwapAction } {
  const a = makeUnit({ id: 'a', typeId: 'fantassins-lourds', position: landRow(0), charged: true });
  const b = makeUnit({ id: 'b', typeId: 'archers', position: landRow(1) });
  return { state: makeGame([a, b]), swap: { kind: 'landSwap', unitId: 'a', otherId: 'b' } };
}

/** A made-up attack measure that depends on where a unit stands: unit `a`
 * likes high columns, `b` likes low ones. Enough to give a swap a non-zero,
 * exactly known gain. */
const positional = (_board: GameState, unit: Unit): number =>
  unit.id === 'a' ? unit.position.q : -2 * unit.position.q;

describe('swappedClone', () => {
  it('swaps the pair on a probe clone and leaves the input state unchanged', () => {
    const { state, swap } = pairGame();
    const snapshot = structuredClone(state);

    const after = swappedClone(state, swap);

    expect(state).toEqual(snapshot);
    expect(after.units.find((u) => u.id === 'a')!.position).toEqual(landRow(1));
    expect(after.units.find((u) => u.id === 'b')!.position).toEqual(landRow(0));
    // charged cleared on every unit, as the unswapped side is priced.
    expect(after.units.every((u) => !u.charged && !u.defendedThisPhase)).toBe(true);
  });
});

describe('contactGain', () => {
  it('is the sum over both units of the after value minus the before value', () => {
    const { state, swap } = pairGame();
    const after = swappedClone(state, swap);
    // a: q 11 - q 10 = +1; b: -2*10 - (-2*11) = +2.
    expect(contactGain(state, after, ['a', 'b'], positional)).toBe(3);
  });

  it('prices the reverse swap as the exact negative', () => {
    const { state, swap } = pairGame();
    const after = swappedClone(state, swap);
    const back = swappedClone(after, swap);

    expect(contactGain(after, back, ['a', 'b'], positional)).toBe(-contactGain(state, after, ['a', 'b'], positional));
  });
});

describe('shelterGain', () => {
  const zocOf = (...hexes: HexCoord[]) => new Set(hexes.map((h) => mapHexKey(h.q, h.r)));
  // Exposure of `a` is 5 on hex column 10 and 1 on column 11; `b` is flat 2.
  const exposure = (board: GameState, id: string): number =>
    id === 'a' ? (board.units.find((u) => u.id === 'a')!.position.q === 10 ? 5 : 1) : 2;

  it('does not call exposure when neither hex of the pair is under enemy ZOC', () => {
    const { state, swap } = pairGame();
    const after = swappedClone(state, swap);
    let calls = 0;

    const gain = shelterGain(state, after, ['a', 'b'], (b, id) => (calls++, exposure(b, id)), zocOf(landRow(5)));

    expect(gain).toBe(0);
    expect(calls).toBe(0);
    expect(isFrontLinePair(state, ['a', 'b'], zocOf(landRow(5)))).toBe(false);
  });

  it('is the fall in exposure when either hex is under enemy ZOC, and negates on the reverse swap', () => {
    const { state, swap } = pairGame();
    const after = swappedClone(state, swap);
    const back = swappedClone(after, swap);
    const zoc = zocOf(landRow(1));

    expect(shelterGain(state, after, ['a', 'b'], exposure, zoc)).toBe(4);
    expect(shelterGain(after, back, ['a', 'b'], exposure, zoc)).toBe(-4);
  });
});

describe('scoreSwaps', () => {
  /** Six friendly units in a row: five adjacent pairs, all on the front line. */
  function rowGame(): GameState {
    return makeGame([0, 1, 2, 3, 4, 5].map((i) => makeUnit({ id: `r${i}`, typeId: 'fantassins-lourds', position: landRow(i) })));
  }
  const weights = { swapContact: 1, swapShelter: 1 };

  it('probes exposure on at most SWAP_PROBE_LIMIT swapped boards, and not at all without shelter', () => {
    const state = rowGame();
    const legal = legalActions(state, {});
    expect(legal.filter((a) => a.kind === 'landSwap')).toHaveLength(5);
    const zoc = new Set([0, 1, 2, 3, 4, 5].map((i) => mapHexKey(landRow(i).q, landRow(i).r)));

    const boards = new Set<GameState>();
    const scored = scoreSwaps({
      state,
      legal,
      zoc,
      withShelter: true,
      weights,
      attackFrom: () => 0,
      exposure: (board) => (boards.add(board), 0),
    });
    expect(scored).toHaveLength(5);
    // One shared unswapped board plus one swapped board per probed pair.
    expect(boards.size).toBe(1 + SWAP_PROBE_LIMIT);

    boards.clear();
    scoreSwaps({
      state,
      legal,
      zoc,
      withShelter: false,
      weights,
      attackFrom: () => 0,
      exposure: (board) => (boards.add(board), 0),
    });
    expect(boards.size).toBe(0);
  });

  it('probes the best SWAP_PROBE_LIMIT front-line pairs by contact (ties by legal order), never an off-line pair', () => {
    // Eight units in a row: seven adjacent pairs. Pairs 0-5 touch enemy ZOC
    // (units r0-r5 stand in it); pair 6 (r6, r7) does not, and has the highest
    // contact of all. The made-up attack measure gives pair i a contact gain of
    // gains[i] (the weights telescope: swapping i with i+1 is w_i - w_(i+1)).
    const state = makeGame([0, 1, 2, 3, 4, 5, 6, 7].map((i) => makeUnit({ id: `r${i}`, typeId: 'fantassins-lourds', position: landRow(i) })));
    const legal = legalActions(state, {});
    const zoc = new Set([0, 1, 2, 3, 4, 5].map((i) => mapHexKey(landRow(i).q, landRow(i).r)));
    const gains = [3, 1, 5, 2, 6, 4, 9];
    const w = new Map<string, number>([['r7', 0]]);
    for (let i = 6; i >= 0; i--) w.set(`r${i}`, w.get(`r${i + 1}`)! + gains[i]!);
    const weighted = (_b: GameState, unit: Unit): number => w.get(unit.id)! * unit.position.q;

    /** Which pairs got an exposure probe: a swapped board is told apart by the
     * one pair of units standing out of their original hexes. */
    const probedPairs = (attackFrom: (b: GameState, u: Unit) => number): number[] => {
      const probed = new Set<number>();
      scoreSwaps({
        state,
        legal,
        zoc,
        withShelter: true,
        weights: { swapContact: 1, swapShelter: 1 },
        attackFrom,
        exposure: (board) => {
          const moved = board.units.findIndex((u, i) => u.position.q !== landRow(i).q);
          if (moved >= 0) probed.add(moved);
          return 0;
        },
      });
      return [...probed].sort((a, b) => a - b);
    };

    // Best four front-line pairs by contact: pairs 4 (6), 2 (5), 5 (4), 0 (3).
    expect(probedPairs(weighted)).toEqual([0, 2, 4, 5]);
    // All contacts equal: the first four in legal order.
    expect(probedPairs(() => 0)).toEqual([0, 1, 2, 3]);
  });

  it('weights the two terms and keeps the legal-list order of each candidate', () => {
    const { state } = pairGame();
    const legal = legalActions(state, {});
    const zoc = new Set([mapHexKey(landRow(0).q, landRow(0).r)]);
    const run = (w: { swapContact: number; swapShelter: number }) =>
      scoreSwaps({
        state,
        legal,
        zoc,
        withShelter: true,
        weights: w,
        attackFrom: positional,
        exposure: (board, id) => (id === 'a' && board.units.find((u) => u.id === 'a')!.position.q === 10 ? 5 : 1),
      });

    const swapIndex = legal.findIndex((a) => a.kind === 'landSwap');
    // contact 3; shelter: a 5 -> 1 = 4, b 1 -> 1 = 0.
    expect(run({ swapContact: 1, swapShelter: 1 })).toEqual([
      { action: { kind: 'landSwap', unitId: 'a', otherId: 'b' }, order: swapIndex, score: 7 },
    ]);
    expect(run({ swapContact: 2, swapShelter: 0 })[0]!.score).toBe(6);
    expect(run({ swapContact: 0, swapShelter: 0.5 })[0]!.score).toBe(2);
  });
});
