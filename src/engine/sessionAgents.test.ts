import { describe, expect, it } from 'vitest';
import type { HexCoord } from '../data/map';
import type { PlayerAgent } from './agent';
import { newPending } from './combatResolution';
import { newSession } from './gameSession';
import { settleResolutionWithAgent } from './sessionAgents';
import { isListedSacrifice } from './sessionAgents';
import type { GameState, Unit } from './state';
import { createInitialState } from './turnManager';

function unit(id: string, typeId: string, q: number, r: number, owner: 0 | 1 = 0): Unit {
  return { id, owner, typeId, position: { q, r }, movementLeft: 0, facing: 0, defendedThisPhase: false, charged: false, destroyed: false };
}

function gameWith(units: Unit[]): GameState {
  const state = createInitialState(
    [
      { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
      { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
    ],
    'multi-defender',
  );
  state.units = units;
  state.phase = 'combat';
  return state;
}

/** An agent that answers only what a test scripts; everything else throws. */
function stub(overrides: Partial<PlayerAgent>): PlayerAgent {
  const no = () => Promise.reject(new Error('stub: not scripted'));
  return { chooseRetreat: no, choosePushTarget: no, chooseAdvance: no, chooseExchangeSacrifice: no, ...overrides };
}

describe('the I3 sacrifice mapping', () => {
  // Forces 4, 4, 2 against a threshold of 5: the listed minimal sacrifices are
  // {a,b}, {a,c}, {b,c}. {a,b,c} is not minimal.
  function position() {
    const a = unit('a', 'fantassins-lourds', 10, 5);
    const b = unit('b', 'fantassins-lourds', 10, 6);
    const c = unit('c', 'fantassins', 10, 7);
    return { a, b, c, state: gameWith([a, b, c]) };
  }
  const sacrifice = (chosen: (units: Unit[]) => Unit[]) => async (state: GameState, attackers: Unit[]) => {
    void state;
    return chosen(attackers);
  };

  // Kills `.every` -> `.some` in the mapping: `some` would take {a,b} for a
  // choice of {b,c}, destroying the wrong units.
  it('maps the second listed subset to that subset', async () => {
    const { a, b, c, state } = position();
    // Choose {a, c}: the second listed subset.
    // Choose {a, c}: the second listed subset.
    const agent = stub({ chooseExchangeSacrifice: sacrifice((units) => [units[0]!, units[2]!]) });
    await settleResolutionWithAgent(newSession(state), newPending(['a', 'b', 'c'], [{ kind: 'sacrifice', requiredForce: 5 }]), agent, () => 0);
    expect([a.destroyed, b.destroyed, c.destroyed]).toEqual([true, false, true]);
  });

  it('maps a non-minimal superset to the first listed subset it contains', async () => {
    const { a, b, c, state } = position();
    const agent = stub({ chooseExchangeSacrifice: sacrifice((units) => units) });
    await settleResolutionWithAgent(newSession(state), newPending(['a', 'b', 'c'], [{ kind: 'sacrifice', requiredForce: 5 }]), agent, () => 0);
    expect([a.destroyed, b.destroyed, c.destroyed]).toEqual([true, true, false]); // {a, b}, not all three
  });
});

describe('an agent that fails on a forced step', () => {
  // One legal retreat hex: the session applies it without asking, and the
  // agent's call is only kept. Kills dropping `await Promise.all(kept)`.
  it('makes settleWithAgent reject', async () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    const blockers = [unit('b1', 'fantassins', 12, 4, 1), unit('b2', 'fantassins', 11, 6, 1)];
    const state = gameWith([a, d, ...blockers]);
    const agent = stub({
      chooseRetreat: (_s: GameState, _u: Unit, options: HexCoord[]) => {
        expect(options).toHaveLength(1);
        return Promise.reject(new Error('agent failed'));
      },
    });
    const pending = newPending(['a'], [{ kind: 'retreat', unitId: 'd' }]);
    await expect(settleResolutionWithAgent(newSession(state), pending, agent, () => 0)).rejects.toThrow('agent failed');
  });
});

describe('isListedSacrifice (§73 O3)', () => {
  // Forces 4, 4, 2 against 5: the listed sacrifices are {a,b}, {a,c}, {b,c}.
  const a = unit('a', 'fantassins-lourds', 10, 5);
  const b = unit('b', 'fantassins-lourds', 10, 6);
  const c = unit('c', 'fantassins', 10, 7);

  it('accepts exactly a listed minimal sacrifice, in any order', () => {
    expect(isListedSacrifice([a, b, c], 5, [a, b])).toBe(true);
    expect(isListedSacrifice([a, b, c], 5, [c, b])).toBe(true);
  });

  // Kills accepting any selection that merely meets the force: the player would
  // lose a unit the exchange never asked for.
  it('refuses one with a unit to spare', () => {
    expect(isListedSacrifice([a, b, c], 5, [a, b, c])).toBe(false);
  });

  it('refuses one below the force, and an empty one', () => {
    expect(isListedSacrifice([a, b, c], 5, [a, c].slice(0, 1))).toBe(false);
    expect(isListedSacrifice([a, b, c], 5, [])).toBe(false);
  });
});
