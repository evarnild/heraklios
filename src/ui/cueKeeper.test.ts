import { describe, expect, it, vi } from 'vitest';
import { applyAction } from '../engine/actions';
import { CueKeeper } from './cueKeeper';
import { createInitialState } from '../engine/turnManager';
import type { GameState, Unit } from '../engine/state';

const SEA = { q: 28, r: 6 };

function unit(over: Partial<Unit> & { id: string; typeId: string; position: { q: number; r: number } }): Unit {
  return { owner: 0, facing: 0, movementLeft: 0, defendedThisPhase: false, charged: false, destroyed: false, ...over };
}

function stateOf(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('CueKeeper', () => {
  it('apply derives the cue from the state before the action, so a move keeps its path', () => {
    const state = stateOf([unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 }, movementLeft: 3 })]);
    const keeper = new CueKeeper(() => {});
    keeper.apply(state, { kind: 'landMove', unitId: 'a', to: { q: 12, r: 3 } });
    expect(state.units[0]!.position).toEqual({ q: 12, r: 3 });
    const cue = keeper.take()!;
    expect(cue.moves[0]!.steps.map((s) => s.hex)).toEqual([
      { q: 11, r: 3 },
      { q: 12, r: 3 },
    ]);
  });

  it('apply completes the cue with the result: a missed ram shakes the target', () => {
    const ram = unit({ id: 'r', typeId: 'galeres', position: SEA, movementLeft: 3 });
    const target = unit({ id: 't', typeId: 'biremes', owner: 1, position: { q: SEA.q + 1, r: SEA.r } });
    const shakes = new Set<string>();
    for (const die of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const keeper = new CueKeeper(() => {});
      const state = stateOf([structuredClone(ram), structuredClone(target)]);
      const result = keeper.apply(state, { kind: 'ram', unitId: 'r' }, () => die);
      const cue = keeper.take()!;
      expect(cue.clashes).toHaveLength(1);
      expect(cue.shakes).toEqual(result.hit ? [] : ['t']);
      cue.shakes.forEach((s) => shakes.add(s));
    }
    expect(shakes.has('t')).toBe(true);
  });

  // §73: the session applies the attack; the cue must come from the board BEFORE it, completed with the result.
  it('begin derives the cue before the action and completes it once the result is known', () => {
    const state = stateOf([unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 }, movementLeft: 3 })]);
    const keeper = new CueKeeper(() => {});
    const done = keeper.begin(state, { kind: 'landMove', unitId: 'a', to: { q: 12, r: 3 } });
    expect(keeper.take(), 'nothing is remembered until the result is known').toBeNull();
    const result = applyAction(state, { kind: 'landMove', unitId: 'a', to: { q: 12, r: 3 } });
    done(result);
    expect(keeper.take()!.moves[0]!.steps.map((s) => s.hex)).toEqual([{ q: 11, r: 3 }, { q: 12, r: 3 }]);
  });

  it('take returns the cue once and then nothing', () => {
    const state = stateOf([unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 }, movementLeft: 3 })]);
    const keeper = new CueKeeper(() => {});
    expect(keeper.take()).toBeNull();
    keeper.apply(state, { kind: 'landMove', unitId: 'a', to: { q: 11, r: 3 } });
    expect(keeper.take()).not.toBeNull();
    expect(keeper.take()).toBeNull();
  });

  it('driftMove sets a one-hex slide and does not render', () => {
    const render = vi.fn();
    const keeper = new CueKeeper(render);
    keeper.driftMove('e', { q: 3, r: 4 });
    expect(render).not.toHaveBeenCalled();
    expect(keeper.take()!.moves).toEqual([{ unitId: 'e', steps: [{ hex: { q: 3, r: 4 } }] }]);
  });

  it('driftClash renders while its clash cue is still pending, before the next beat can overwrite it', () => {
    const seen: unknown[] = [];
    const keeper: CueKeeper = new CueKeeper(() => seen.push(keeper.take()));
    keeper.driftClash('e', { q: 3, r: 4 });
    expect(seen).toHaveLength(1);
    expect((seen[0] as { clashes: unknown[] }).clashes).toEqual([{ unitId: 'e', toward: { q: 3, r: 4 }, kind: 'clash' }]);
    keeper.driftMove('e', { q: 3, r: 4 });
    expect(keeper.take()!.clashes).toEqual([]);
  });
});
