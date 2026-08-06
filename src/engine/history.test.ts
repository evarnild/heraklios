import { describe, it, expect } from 'vitest';
import { History } from './history';
import { createInitialState } from './turnManager';
import { maxEquipmentPointsForType, type Player, type PlayerId, type Unit } from './state';
import { getUnitType } from '../data/units';

describe('History', () => {
  it('starts empty', () => {
    const h = new History<number>();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undoLabel).toBeNull();
    expect(h.redoLabel).toBeNull();
    expect(h.undo(0)).toBeNull();
    expect(h.redo(0)).toBeNull();
  });

  it('undoes back to the pushed payload and reports its label', () => {
    const h = new History<number>();
    h.push(1, 'first move');
    expect(h.canUndo).toBe(true);
    expect(h.undoLabel).toBe('first move');

    const entry = h.undo(2);
    expect(entry?.payload).toBe(1);
    expect(entry?.label).toBe('first move');
    expect(h.canUndo).toBe(false);
  });

  it('walks back through several actions in reverse order', () => {
    const h = new History<string>();
    h.push('a', 'action A');
    h.push('b', 'action B');
    h.push('c', 'action C');

    expect(h.undo('d')?.payload).toBe('c');
    expect(h.undo('c')?.payload).toBe('b');
    expect(h.undo('b')?.payload).toBe('a');
    expect(h.canUndo).toBe(false);
  });

  it('redoes what was undone, restoring the state left behind', () => {
    const h = new History<number>();
    h.push(1, 'move');

    const undone = h.undo(2);
    expect(undone?.payload).toBe(1);
    expect(h.canRedo).toBe(true);
    expect(h.redoLabel).toBe('move');

    const redone = h.redo(1);
    expect(redone?.payload).toBe(2); // the state we had left behind
    expect(h.canRedo).toBe(false);
    expect(h.canUndo).toBe(true);
  });

  it('round-trips repeatedly between undo and redo', () => {
    const h = new History<string>();
    h.push('start', 'act');
    expect(h.undo('end')?.payload).toBe('start');
    expect(h.redo('start')?.payload).toBe('end');
    expect(h.undo('end')?.payload).toBe('start');
    expect(h.redo('start')?.payload).toBe('end');
  });

  it('invalidates the redo stack once a new action is pushed', () => {
    const h = new History<number>();
    h.push(1, 'first');
    h.undo(2);
    expect(h.canRedo).toBe(true);

    h.push(1, 'a different second move');
    expect(h.canRedo).toBe(false);
    expect(h.redoLabel).toBeNull();
  });

  it('clear() drops history in both directions', () => {
    const h = new History<number>();
    h.push(1, 'first');
    h.push(2, 'second');
    h.undo(3);

    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.depth).toBe(0);
  });

  it('drops the oldest entries past its capacity', () => {
    const h = new History<number>(3);
    h.push(1, 'one');
    h.push(2, 'two');
    h.push(3, 'three');
    h.push(4, 'four');

    expect(h.depth).toBe(3);
    // 'one' fell off the bottom, so the deepest reachable payload is 2.
    expect(h.undo(5)?.payload).toBe(4);
    expect(h.undo(4)?.payload).toBe(3);
    expect(h.undo(3)?.payload).toBe(2);
    expect(h.canUndo).toBe(false);
  });

  it('stores payloads by reference — cloning is the caller\'s job', () => {
    const h = new History<{ n: number }>();
    const live = { n: 1 };
    h.push(live, 'mutate');
    live.n = 99;
    // Documents WHY the scenes structuredClone before pushing.
    expect(h.undo({ n: 99 })?.payload.n).toBe(99);
  });
});

describe('GameState snapshots', () => {
  function stateWithUnits() {
    const players: Player[] = [
      { id: 0 as PlayerId, name: 'A', edge: 'W', purchasePoints: 400, eliminated: false },
      { id: 1 as PlayerId, name: 'B', edge: 'E', purchasePoints: 400, eliminated: false },
    ];
    const state = createInitialState(players);
    const makeUnit = (id: string, owner: PlayerId, typeId: string, q: number, r: number): Unit => {
      const t = getUnitType(typeId);
      return {
        id,
        owner,
        typeId,
        position: { q, r },
        movementLeft: t.movement,
        facing: 2,
        equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
        defendedThisPhase: false,
        charged: false,
        destroyed: false,
      };
    };
    state.units.push(makeUnit('u0', 0 as PlayerId, 'fantassins', 3, 4));
    state.units.push(makeUnit('u1', 1 as PlayerId, 'galeres', 10, 12));
    return state;
  }

  /**
   * The whole memento approach rests on GameState being plain serializable
   * data (no Maps, Sets, class instances or functions), so structuredClone is
   * a complete deep copy. If someone later adds a non-cloneable field, this
   * test is what should fail.
   */
  it('survives structuredClone with every field intact', () => {
    const state = stateWithUnits();
    const copy = structuredClone(state);
    expect(copy).toEqual(state);
  });

  it('clones deeply, so mutating the copy leaves the original untouched', () => {
    const state = stateWithUnits();
    const copy = structuredClone(state);

    copy.units[0]!.position.q = 999;
    copy.units[0]!.movementLeft = 0;
    copy.units[1]!.destroyed = true;
    copy.phase = 'combat';
    copy.turnNumber = 7;
    copy.players[0]!.eliminated = true;

    expect(state.units[0]!.position.q).toBe(3);
    expect(state.units[0]!.movementLeft).toBeGreaterThan(0);
    expect(state.units[1]!.destroyed).toBe(false);
    expect(state.phase).toBe('movement');
    expect(state.turnNumber).toBe(1);
    expect(state.players[0]!.eliminated).toBe(false);
  });

  it('preserves undefined equipmentPoints for land units', () => {
    const copy = structuredClone(stateWithUnits());
    expect(copy.units[0]!.equipmentPoints).toBeUndefined();
    expect(copy.units[1]!.equipmentPoints).toBeGreaterThan(0);
  });
});
