import { describe, it, expect, vi } from 'vitest';
import * as actions from './actions';
import { applyAction, legalActions } from './actions';
import { createInitialState } from './turnManager';
import { unitType, type GameState, type Player, type Unit } from './state';
import { DIRECTIONS } from './hex';
import { unitStatuses } from './unitStatus';

const SEA = { q: 28, r: 6 };

function unit(over: Partial<Unit> & { id: string; typeId: string; position: { q: number; r: number } }): Unit {
  const u: Unit = { owner: 0, movementLeft: 0, facing: 0, defendedThisPhase: false, charged: false, destroyed: false, ...over };
  if (over.movementLeft === undefined) u.movementLeft = unitType(u).movement;
  return u;
}

function stateOf(units: Unit[], phase: GameState['phase'] = 'movement'): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = phase;
  return state;
}

const mk =
  (typeId: string) =>
  (id: string, q: number, r: number, over: Partial<Unit> = {}): Unit =>
    unit({ id, typeId, position: { q, r }, ...over });
const inf = mk('fantassins');
const cav = mk('cavalerie-legere');
const phalanx = mk('phalanges');
const archer = mk('archers');
const activity = (s: GameState, id: string, ctx: actions.ActionContext = {}) => unitStatuses(s, ctx).get(id)?.activity;

describe('unitStatuses, movement phase (B2)', () => {
  it('reads notMoved, partlyMoved and done on movementLeft, for the active player only', () => {
    const s = stateOf([
      inf('a', 10, 3),
      inf('b', 12, 3, { movementLeft: 1 }),
      inf('c', 14, 3, { movementLeft: 0 }),
      inf('x', 20, 3, { owner: 1 }),
    ]);
    expect(activity(s, 'a')).toBe('notMoved');
    expect(activity(s, 'b')).toBe('partlyMoved');
    expect(activity(s, 'c')).toBe('done');
    expect(unitStatuses(s, {}).has('x')).toBe(false);
  });

  it('a charged cavalry unit is done with the charge flag; others carry none', () => {
    const s = stateOf([
      cav('k', 10, 3, { charged: true, movementLeft: 0 }),
      cav('l', 12, 3),
      inf('i', 14, 3, { charged: true, movementLeft: 0 }),
    ]);
    expect(unitStatuses(s, {}).get('k')).toEqual({ activity: 'done', charged: true });
    expect(unitStatuses(s, {}).get('l')).toEqual({ activity: 'notMoved' });
    expect(unitStatuses(s, {}).get('i')).toEqual({ activity: 'done' });
  });

  it('a ship that only rotated is partlyMoved', () => {
    const s = stateOf([unit({ id: 's', typeId: 'biremes', position: SEA })]);
    applyAction(s, legalActions(s, {}).find((a) => a.kind === 'navalRotate')!);
    expect(activity(s, 's')).toBe('partlyMoved');
  });

  it('a ZOC-boxed unit with its full allowance is still notMoved (I2)', () => {
    const ring = DIRECTIONS.map((d, i) => inf(`f${i}`, 10 + d.q, 3 + d.r, { owner: 1 }));
    const s = stateOf([inf('a', 10, 3), ...ring]);
    expect(activity(s, 'a')).toBe('notMoved');
  });

  it('a destroyed unit has none; an undone move reads notMoved again', () => {
    const s = stateOf([inf('a', 10, 3), inf('d', 12, 3, { destroyed: true })]);
    expect(unitStatuses(s, {}).has('d')).toBe(false);
    const before = structuredClone(s);
    applyAction(s, legalActions(s, {}).find((a) => a.kind === 'landMove')!);
    expect(activity(s, 'a')).toBe('partlyMoved');
    expect(activity(before, 'a')).toBe('notMoved');
  });

  it('shows no beenAttacked in movement and does not enumerate actions (AC14)', () => {
    const spy = vi.spyOn(actions, 'legalActions');
    const s = stateOf([inf('a', 10, 3, { owner: 1, defendedThisPhase: true }), inf('b', 12, 3)]);
    expect(unitStatuses(s, {}).has('a')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('unitStatuses, combat phase (B3, B4)', () => {
  it('canAttack with a legal target, nothing without one', () => {
    const s = stateOf([inf('a', 10, 3), inf('lone', 3, 3), inf('x', 11, 3, { owner: 1 })], 'combat');
    expect(activity(s, 'a')).toBe('canAttack');
    expect(unitStatuses(s, {}).has('lone')).toBe(false);
    expect(unitStatuses(s, {}).has('x')).toBe(false);
  });

  it('a unit in attackedThisPhase is hasAttacked, not canAttack', () => {
    const s = stateOf([inf('a', 10, 3), inf('x', 11, 3, { owner: 1 })], 'combat');
    expect(activity(s, 'a')).toBe('canAttack');
    expect(activity(s, 'a', { attackedThisPhase: new Set(['a']) })).toBe('hasAttacked');
  });

  it('cavalry beside a phalanx has no status; an archer in range can attack', () => {
    const s = stateOf(
      [cav('k', 10, 3), archer('r', 10, 6), phalanx('p', 11, 3, { owner: 1 }), inf('t', 10, 8, { owner: 1 })],
      'combat',
    );
    expect(unitStatuses(s, {}).has('k')).toBe(false);
    expect(activity(s, 'r')).toBe('canAttack');
  });

  it('an attacked enemy is beenAttacked, and stops making a unit canAttack', () => {
    const s = stateOf([inf('a', 10, 3), inf('x', 11, 3, { owner: 1, defendedThisPhase: true })], 'combat');
    expect(activity(s, 'x')).toBe('beenAttacked');
    expect(unitStatuses(s, {}).has('a')).toBe(false);
  });

  it('shows the charge flag in combat too, beside its activity', () => {
    const s = stateOf([cav('k', 10, 3, { charged: true, movementLeft: 0 }), inf('x', 11, 3, { owner: 1 })], 'combat');
    expect(unitStatuses(s, {}).get('k')).toEqual({ activity: 'canAttack', charged: true });
  });

  it('a ship in rammedThisTurn is hasAttacked; without it the same ship can board', () => {
    const s = stateOf(
      [
        unit({ id: 's', typeId: 'biremes', position: SEA }),
        unit({ id: 'e', typeId: 'biremes', position: { q: SEA.q + 1, r: SEA.r }, owner: 1 }),
      ],
      'combat',
    );
    expect(activity(s, 's')).toBe('canAttack');
    expect(activity(s, 's', { rammedThisTurn: new Set(['s']) })).toBe('hasAttacked');
  });
});

describe('unitStatuses, purity and gates (AC3, AC4)', () => {
  it('is empty outside movement and combat', () => {
    const s = stateOf([inf('a', 10, 3, { charged: true })]);
    s.phase = 'over' as GameState['phase'];
    expect(unitStatuses(s, {}).size).toBe(0);
  });

  it('mutates nothing and gives the same result twice', () => {
    const s = stateOf([inf('a', 10, 3), inf('x', 11, 3, { owner: 1 })], 'combat');
    const ctx = { attackedThisPhase: new Set(['q']), rammedThisTurn: new Set<string>() };
    const before = structuredClone({ s, ctx });
    const one = unitStatuses(s, ctx);
    expect(unitStatuses(s, ctx)).toEqual(one);
    expect({ s, ctx }).toEqual(before);
  });
});
