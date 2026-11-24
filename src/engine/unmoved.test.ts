import { describe, it, expect } from 'vitest';
import { applyAction, legalActions, type Action } from './actions';
import { createInitialState } from './turnManager';
import { unitType, type GameState, type Player, type Unit } from './state';
import { hasNotMoved, unmovedUnits } from './unmoved';
import { DIRECTIONS } from './hex';

// Same plain row and open sea as actions.test.ts.
const SEA_CENTER = { q: 28, r: 6 };

function unit(over: Partial<Unit> & { id: string; typeId: string; position: { q: number; r: number } }): Unit {
  const u: Unit = {
    owner: 0,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...over,
  };
  if (over.movementLeft === undefined) u.movementLeft = unitType(u).movement;
  return u;
}

function stateOf(units: Unit[], phase: 'movement' | 'combat' = 'movement'): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = phase;
  return state;
}

const inf = (id: string, q: number, r: number, over: Partial<Unit> = {}): Unit =>
  unit({ id, typeId: 'fantassins', position: { q, r }, ...over });

const ship = (id: string): Unit => unit({ id, typeId: 'biremes', position: SEA_CENTER });

function actionsNaming(state: GameState, id: string): Action[] {
  return legalActions(state, {}).filter(
    (a) => ('unitId' in a && a.unitId === id) || ('otherId' in a && a.otherId === id),
  );
}

/** Enemy infantry on every neighbour of (q, r) except the listed hexes. */
function ring(q: number, r: number, except: Array<{ q: number; r: number }> = []): Unit[] {
  return DIRECTIONS.map((d, i) => ({ q: q + d.q, r: r + d.r, i }))
    .filter((p) => !except.some((e) => e.q === p.q && e.r === p.r))
    .map((p) => inf(`foe${q}-${r}-${p.i}`, p.q, p.r, { owner: 1 }));
}

describe('hasNotMoved (B1)', () => {
  it('is true for a fresh unit and false for a destroyed one', () => {
    expect(hasNotMoved(inf('a', 10, 3))).toBe(true);
    expect(hasNotMoved(inf('a', 10, 3, { destroyed: true }))).toBe(false);
  });

  it('is false once any point is spent, and ignores charged', () => {
    const a = inf('a', 10, 3);
    a.movementLeft = unitType(a).movement - 1;
    expect(hasNotMoved(a)).toBe(false);
    expect(hasNotMoved(inf('b', 10, 3, { charged: true }))).toBe(true);
    expect(hasNotMoved(inf('c', 10, 3, { charged: true, movementLeft: 0 }))).toBe(false);
  });

  it('is false after a land move, and true on a copy taken before it (undo)', () => {
    const state = stateOf([inf('a', 10, 3)]);
    const before = structuredClone(state);
    const move = legalActions(state, {}).find((x) => x.kind === 'landMove')!;
    applyAction(state, move);
    expect(hasNotMoved(state.units[0]!)).toBe(false);
    expect(hasNotMoved(before.units[0]!)).toBe(true);
  });

  it('is false for both units after a swap', () => {
    const state = stateOf([inf('a', 10, 3), inf('b', 11, 3)]);
    applyAction(state, { kind: 'landSwap', unitId: 'a', otherId: 'b' });
    expect(state.units.map(hasNotMoved)).toEqual([false, false]);
  });

  it('is false after one ship rotation and after a naval move', () => {
    const rotated = stateOf([ship('s')]);
    applyAction(rotated, { kind: 'navalRotate', unitId: 's', direction: 1 });
    expect(hasNotMoved(rotated.units[0]!)).toBe(false);

    const sailed = stateOf([ship('s')]);
    const sail = legalActions(sailed, {}).find((x) => x.kind === 'navalMove')!;
    applyAction(sailed, sail);
    expect(hasNotMoved(sailed.units[0]!)).toBe(false);
  });
});

describe('unmovedUnits (B2)', () => {
  it('flags the active player\'s unmoved units, in state order', () => {
    const state = stateOf([inf('b', 10, 3), inf('a', 12, 3), inf('foe', 15, 3, { owner: 1 })]);
    expect(unmovedUnits(state, {}).map((u) => u.id)).toEqual(['b', 'a']);
  });

  it('leaves out a moved unit', () => {
    const state = stateOf([inf('a', 10, 3), inf('b', 12, 3)]);
    state.units[0]!.movementLeft = 1;
    expect(unmovedUnits(state, {}).map((u) => u.id)).toEqual(['b']);
  });

  it('leaves out a boxed-in unit, after proving it is boxed in', () => {
    const state = stateOf([inf('a', 10, 3), inf('free', 20, 3), ...ring(10, 3)]);
    expect(actionsNaming(state, 'a')).toEqual([]);
    expect(unmovedUnits(state, {}).map((u) => u.id)).toEqual(['free']);
  });

  it('flags a unit that is only the otherId of a swap', () => {
    // 'b' is ringed by friendly units with lower ids: it has no move of its
    // own, and every swap is listed under the lower id, so 'b' appears only
    // as an otherId.
    // A second ring of enemies stops it walking through its friends.
    const around = DIRECTIONS.map((d, i) => inf(`a${i}`, 11 + d.q, 3 + d.r));
    const outer: Unit[] = [];
    for (let dq = -2; dq <= 2; dq++) {
      for (let dr = -2; dr <= 2; dr++) {
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 2) {
          outer.push(inf(`foe${dq}_${dr}`, 11 + dq, 3 + dr, { owner: 1 }));
        }
      }
    }
    const state = stateOf([...around, inf('b', 11, 3), ...outer]);
    const naming = actionsNaming(state, 'b');
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.every((x) => x.kind === 'landSwap' && x.otherId === 'b')).toBe(true);
    expect(unmovedUnits(state, {}).map((u) => u.id)).toContain('b');
    state.allowSwaps = false;
    expect(unmovedUnits(state, {}).map((u) => u.id)).not.toContain('b');
  });

  it('flags an unmoved ship', () => {
    expect(unmovedUnits(stateOf([ship('s')]), {}).map((u) => u.id)).toEqual(['s']);
  });

  it('leaves out the other player\'s units, and is empty outside movement', () => {
    const state = stateOf([inf('a', 10, 3), inf('foe', 15, 3, { owner: 1 })]);
    expect(unmovedUnits(state, {}).map((u) => u.id)).toEqual(['a']);
    state.phase = 'combat';
    expect(unmovedUnits(state, {})).toEqual([]);
  });
});
