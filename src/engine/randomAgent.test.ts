import { describe, it, expect } from 'vitest';
import { RandomAgent } from './randomAgent';
import { createSeededRng } from './rng';
import { createInitialState } from './turnManager';
import type { Action } from './actions';
import type { GameState, Player, Unit } from './state';

function makeUnit(overrides: Partial<Unit> & { typeId: string; position: { q: number; r: number } }): Unit {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    owner: 0,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...overrides,
  };
}

function makeState(): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  return createInitialState(players, 'multi-defender');
}

describe('RandomAgent', () => {
  it('chooseNextAction is deterministic given a seed, and always returns one of the legal options', () => {
    const state = makeState();
    const legal: Action[] = [
      { kind: 'endPhase' },
      { kind: 'landMove', unitId: 'a', to: { q: 1, r: 0 } },
      { kind: 'landMove', unitId: 'a', to: { q: 2, r: 0 } },
    ];
    const a = new RandomAgent(createSeededRng(42));
    const b = new RandomAgent(createSeededRng(42));
    for (let i = 0; i < 10; i++) {
      const choiceA = a.chooseNextAction(state, legal);
      const choiceB = b.chooseNextAction(state, legal);
      expect(legal).toContainEqual(choiceA);
      expect(choiceA).toEqual(choiceB);
    }
  });

  it('chooseNextAction throws rather than silently misbehaving on an empty legal list', () => {
    const agent = new RandomAgent(createSeededRng(1));
    expect(() => agent.chooseNextAction(makeState(), [])).toThrow();
  });

  it('exercises every option over enough draws (no option is unreachable)', () => {
    const state = makeState();
    const legal: Action[] = [
      { kind: 'endPhase' },
      { kind: 'landMove', unitId: 'a', to: { q: 1, r: 0 } },
      { kind: 'landMove', unitId: 'a', to: { q: 2, r: 0 } },
    ];
    const agent = new RandomAgent(createSeededRng(7));
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(JSON.stringify(agent.chooseNextAction(state, legal)));
    }
    expect(seen.size).toBe(legal.length);
  });

  it('chooseRetreat picks one of the offered hexes', async () => {
    const agent = new RandomAgent(createSeededRng(5));
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const options = [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 0 }];
    for (let i = 0; i < 10; i++) {
      const chosen = await agent.chooseRetreat(makeState(), unit, options);
      expect(options).toContainEqual(chosen);
    }
  });

  it('choosePushTarget picks one of the candidate units', async () => {
    const agent = new RandomAgent(createSeededRng(9));
    const unit = makeUnit({ typeId: 'fantassins', position: { q: 0, r: 0 } });
    const candidates = [
      makeUnit({ id: 'c1', typeId: 'fantassins', position: { q: 1, r: 0 } }),
      makeUnit({ id: 'c2', typeId: 'fantassins', position: { q: 0, r: 1 } }),
    ];
    for (let i = 0; i < 10; i++) {
      const chosen = await agent.choosePushTarget(makeState(), unit, candidates);
      expect(candidates.some((c) => c.id === chosen.id)).toBe(true);
    }
  });

  it('chooseAdvance can pick a candidate or decline (null), covering both over enough draws', async () => {
    const agent = new RandomAgent(createSeededRng(3));
    const candidates = [makeUnit({ id: 'c1', typeId: 'fantassins', position: { q: 1, r: 0 } })];
    const results = new Set<string | null>();
    for (let i = 0; i < 50; i++) {
      const chosen = await agent.chooseAdvance(makeState(), candidates, { q: 0, r: 0 });
      results.add(chosen ? chosen.id : null);
    }
    expect(results.has('c1')).toBe(true);
    expect(results.has(null)).toBe(true);
  });

  it('chooseExchangeSacrifice always meets the required force threshold', async () => {
    const agent = new RandomAgent(createSeededRng(11));
    // fantassins attack 2 each; three of them (total 6) comfortably exceeds a
    // requiredForce of 5, so at least 3 must be selected regardless of order.
    const attackers = [
      makeUnit({ id: 'a1', typeId: 'fantassins', position: { q: 0, r: 0 } }),
      makeUnit({ id: 'a2', typeId: 'fantassins', position: { q: 1, r: 0 } }),
      makeUnit({ id: 'a3', typeId: 'fantassins', position: { q: 2, r: 0 } }),
    ];
    for (let i = 0; i < 20; i++) {
      const chosen = await agent.chooseExchangeSacrifice(makeState(), attackers, 5);
      const total = chosen.reduce((sum) => sum + 2, 0);
      expect(total).toBeGreaterThanOrEqual(5);
      expect(chosen.length).toBe(3); // only reaching 5 requires all three (2+2+2=6 >= 5, 2+2=4 < 5)
    }
  });

  it('chooseExchangeSacrifice varies WHICH units it picks across seeds when a smaller subset suffices', async () => {
    const attackers = [
      makeUnit({ id: 'a1', typeId: 'phalanges', position: { q: 0, r: 0 } }), // attack 8
      makeUnit({ id: 'a2', typeId: 'fantassins', position: { q: 1, r: 0 } }), // attack 2
      makeUnit({ id: 'a3', typeId: 'fantassins', position: { q: 2, r: 0 } }), // attack 2
    ];
    const seenSelections = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const agent = new RandomAgent(createSeededRng(seed));
      const chosen = await agent.chooseExchangeSacrifice(makeState(), attackers, 8);
      seenSelections.add(chosen.map((u) => u.id).sort().join(','));
    }
    expect(seenSelections.size).toBeGreaterThan(1);
  });
});
