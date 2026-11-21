import { describe, it, expect } from 'vitest';
import { applyAction } from './actions';
import { completeCue, cueBeforeAction, driftClashCue, driftMoveCue } from './actionCue';
import { createInitialState } from './turnManager';
import type { GameState, Unit } from './state';

const SEA = { q: 28, r: 6 };

function unit(over: Partial<Unit> & { id: string; typeId: string; position: { q: number; r: number } }): Unit {
  return {
    owner: 0,
    facing: 0,
    movementLeft: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...over,
  };
}

function stateOf(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('cueBeforeAction (AC3)', () => {
  it('endPhase has no cue; an unknown unit has none', () => {
    const state = stateOf([]);
    expect(cueBeforeAction(state, { kind: 'endPhase' })).toBeNull();
    expect(cueBeforeAction(state, { kind: 'landMove', unitId: 'x', to: { q: 1, r: 1 } })).toBeNull();
  });

  it('a land move moves its unit along the path, one step per hex', () => {
    const inf = unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 }, movementLeft: 3 });
    const cue = cueBeforeAction(stateOf([inf]), { kind: 'landMove', unitId: 'a', to: { q: 12, r: 3 } })!;
    expect(cue.moves).toHaveLength(1);
    expect(cue.moves[0]!.unitId).toBe('a');
    expect(cue.moves[0]!.steps.map((s) => s.hex)).toEqual([
      { q: 11, r: 3 },
      { q: 12, r: 3 },
    ]);
    expect(cue.clashes).toEqual([]);
  });

  it('a swap slides both units across each other', () => {
    const a = unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 }, movementLeft: 3 });
    const b = unit({ id: 'b', typeId: 'fantassins', position: { q: 11, r: 3 }, movementLeft: 3 });
    const state = stateOf([a, b]);
    state.allowSwaps = true;
    const cue = cueBeforeAction(state, { kind: 'landSwap', unitId: 'a', otherId: 'b' })!;
    expect(cue.moves).toEqual([
      { unitId: 'a', steps: [{ hex: { q: 11, r: 3 } }] },
      { unitId: 'b', steps: [{ hex: { q: 10, r: 3 } }] },
    ]);
  });

  it('a ship move carries facings; a Turn is one in-place step', () => {
    const ship = unit({ id: 's', typeId: 'biremes', position: SEA, facing: 0, movementLeft: 3 });
    const state = stateOf([ship]);
    const forward = cueBeforeAction(state, { kind: 'navalMove', unitId: 's', to: { q: SEA.q + 2, r: SEA.r } })!;
    expect(forward.moves[0]!.steps).toEqual([
      { hex: { q: SEA.q + 1, r: SEA.r }, facing: 0 },
      { hex: { q: SEA.q + 2, r: SEA.r }, facing: 0 },
    ]);
    const turn = cueBeforeAction(state, { kind: 'navalRotate', unitId: 's', direction: -1 })!;
    expect(turn.moves[0]!.steps).toEqual([{ hex: SEA, facing: 5 }]);
  });

  it('each attacker lunges toward its nearest defender hex, ties by defender order', () => {
    const a1 = unit({ id: 'a1', typeId: 'fantassins', position: { q: 10, r: 3 } });
    const a2 = unit({ id: 'a2', typeId: 'fantassins', position: { q: 14, r: 3 } });
    const d1 = unit({ id: 'd1', typeId: 'fantassins', owner: 1, position: { q: 11, r: 3 } });
    const d2 = unit({ id: 'd2', typeId: 'fantassins', owner: 1, position: { q: 13, r: 3 } });
    const cue = cueBeforeAction(stateOf([a1, a2, d1, d2]), {
      kind: 'landAttack',
      attackerIds: ['a1', 'a2'],
      defenderIds: ['d1', 'd2'],
    })!;
    expect(cue.clashes).toEqual([
      { unitId: 'a1', toward: { q: 11, r: 3 }, kind: 'clash' },
      { unitId: 'a2', toward: { q: 13, r: 3 }, kind: 'clash' },
    ]);
    const tie = cueBeforeAction(stateOf([a1, d1, unit({ id: 'd3', typeId: 'fantassins', owner: 1, position: { q: 10, r: 4 } })]), {
      kind: 'landAttack',
      attackerIds: ['a1'],
      defenderIds: ['d1', 'd3'],
    })!;
    expect(tie.clashes[0]!.toward).toEqual({ q: 11, r: 3 });
  });

  function ramScene(): GameState {
    const ram = unit({ id: 'r', typeId: 'galeres', position: SEA, facing: 0, movementLeft: 3 });
    const target = unit({ id: 't', typeId: 'biremes', owner: 1, position: { q: SEA.q + 1, r: SEA.r } });
    return stateOf([ram, target]);
  }

  it('a ram lunges at the target hex; a miss shakes the target, a hit does not', () => {
    const state = ramScene();
    const cue = cueBeforeAction(state, { kind: 'ram', unitId: 'r' })!;
    expect(cue.clashes).toEqual([{ unitId: 'r', toward: { q: SEA.q + 1, r: SEA.r }, kind: 'ram' }]);
    const outcomes = new Set<boolean>();
    for (const die of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const clone = structuredClone(state);
      const result = applyAction(clone, { kind: 'ram', unitId: 'r' }, () => die);
      expect(completeCue(cue, result).shakes).toEqual(result.hit ? [] : ['t']);
      outcomes.add(result.hit);
    }
    expect(outcomes.size).toBe(2); // both a hit and a miss were exercised
  });

  it('a boarding clashes both ships; the surviving loser shakes, an undecided one shakes nobody', () => {
    const a = unit({ id: 'a', typeId: 'biremes', position: SEA, equipmentPoints: 4 });
    const d = unit({ id: 'd', typeId: 'biremes', owner: 1, position: { q: SEA.q + 1, r: SEA.r }, equipmentPoints: 4 });
    const state = stateOf([a, d]);
    const cue = cueBeforeAction(state, { kind: 'board', attackerId: 'a', defenderId: 'd' })!;
    expect(cue.clashes.map((c) => c.unitId)).toEqual(['a', 'd']);
    const shaken = new Set<string>();
    let sawNone = false;
    for (let i = 0; i < 6; i++) {
      const clone = structuredClone(state);
      const result = applyAction(clone, { kind: 'board', attackerId: 'a', defenderId: 'd' }, () => i / 6 + 0.01);
      const done = completeCue(cue, result);
      if (result.result.side === null) {
        expect(done.shakes).toEqual([]);
        sawNone = true;
      } else {
        const loser = result.result.side === 'attacker' ? 'a' : 'd';
        expect(done.shakes).toEqual(result.attacker.destroyed || result.defender.destroyed ? [] : [loser]);
        done.shakes.forEach((id) => shaken.add(id));
      }
    }
    expect(sawNone || shaken.size > 0).toBe(true);
    expect(shaken.size).toBeGreaterThan(0);
  });

  it('a boarding that sinks the loser shakes nobody (the sunk ship fades instead)', () => {
    const a = unit({ id: 'a', typeId: 'biremes', position: SEA, equipmentPoints: 1 });
    const d = unit({ id: 'd', typeId: 'biremes', owner: 1, position: { q: SEA.q + 1, r: SEA.r }, equipmentPoints: 1 });
    const state = stateOf([a, d]);
    const cue = cueBeforeAction(state, { kind: 'board', attackerId: 'a', defenderId: 'd' })!;
    let sunk = 0;
    for (let i = 0; i < 6; i++) {
      const result = applyAction(structuredClone(state), { kind: 'board', attackerId: 'a', defenderId: 'd' }, () => i / 6 + 0.01);
      if (!result.attacker.destroyed && !result.defender.destroyed) continue;
      sunk++;
      expect(completeCue(cue, result).shakes).toEqual([]);
    }
    expect(sunk).toBeGreaterThan(0);
  });

  it('a drift beat slides one hex; a trample is a clash at the occupant hex', () => {
    expect(driftMoveCue('e', { q: 3, r: 4 }).moves).toEqual([{ unitId: 'e', steps: [{ hex: { q: 3, r: 4 } }] }]);
    expect(driftClashCue('e', { q: 3, r: 4 }).clashes).toEqual([{ unitId: 'e', toward: { q: 3, r: 4 }, kind: 'clash' }]);
  });
});
