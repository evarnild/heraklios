import { describe, it, expect } from 'vitest';
import { GHOST_SHIP_ID, ghostDrawing, reconcileUnits, type UnitDrawing } from './boardView';

const u = (id: string, q: number, r: number, typeId = 'hoplite', owner = 0, facing?: number): UnitDrawing => ({
  id,
  typeId,
  owner,
  position: { q, r },
  facing,
});
const byId = (list: UnitDrawing[]) => new Map(list.map((x) => [x.id, x]));

describe('reconcileUnits', () => {
  it('gives no work for an unchanged list', () => {
    const list = [u('a', 1, 1), u('b', 2, 2)];
    expect(reconcileUnits(byId(list), structuredClone(list))).toEqual({ add: [], update: [], remove: [] });
  });

  it('treats a moved unit as an update, not a remove and add', () => {
    const diff = reconcileUnits(byId([u('a', 1, 1)]), [u('a', 3, 1)]);
    expect(diff.add).toEqual([]);
    expect(diff.remove).toEqual([]);
    expect(diff.update).toEqual([{ unit: u('a', 3, 1), recreate: false }]);
  });

  it('treats a move along r only as an update', () => {
    const diff = reconcileUnits(byId([u('a', 1, 1)]), [u('a', 1, 2)]);
    expect(diff.update).toEqual([{ unit: u('a', 1, 2), recreate: false }]);
    expect(diff.add).toEqual([]);
    expect(diff.remove).toEqual([]);
  });

  it('flags a changed type or owner for recreate', () => {
    expect(reconcileUnits(byId([u('a', 1, 1)]), [u('a', 1, 1, 'archer')]).update).toEqual([
      { unit: u('a', 1, 1, 'archer'), recreate: true },
    ]);
    expect(reconcileUnits(byId([u('a', 1, 1)]), [u('a', 1, 1, 'hoplite', 2)]).update).toEqual([
      { unit: u('a', 1, 1, 'hoplite', 2), recreate: true },
    ]);
  });

  it('updates a unit whose facing changed, without recreate', () => {
    expect(reconcileUnits(byId([u('s', 1, 1, 'trireme', 0, 0)]), [u('s', 1, 1, 'trireme', 0, 2)]).update).toEqual([
      { unit: u('s', 1, 1, 'trireme', 0, 2), recreate: false },
    ]);
  });

  it('removes a missing id and adds a new id', () => {
    const diff = reconcileUnits(byId([u('a', 1, 1), u('b', 2, 2)]), [u('b', 2, 2), u('c', 5, 5)]);
    expect(diff.remove).toEqual(['a']);
    expect(diff.add).toEqual([u('c', 5, 5)]);
    expect(diff.update).toEqual([]);
  });

  it('is independent of the order of the wanted list', () => {
    const prev = byId([u('a', 1, 1), u('b', 2, 2), u('c', 3, 3)]);
    const list = [u('a', 9, 9), u('b', 2, 2, 'archer'), u('d', 4, 4)];
    const x = reconcileUnits(prev, list);
    const y = reconcileUnits(prev, [...list].reverse());
    const sortId = (a: { unit: UnitDrawing }, b: { unit: UnitDrawing }) => a.unit.id.localeCompare(b.unit.id);
    expect([...x.update].sort(sortId)).toEqual([...y.update].sort(sortId));
    expect([...x.add].sort((p, q) => p.id.localeCompare(q.id))).toEqual([...y.add].sort((p, q) => p.id.localeCompare(q.id)));
    expect([...x.remove].sort()).toEqual([...y.remove].sort());
  });
});

describe('ghostDrawing', () => {
  const ship = { hex: { q: 1, r: 2 }, facing: 3, playerIndex: 1 };
  it('is null when no ship is staged', () => {
    expect(ghostDrawing([ship])).toBeNull();
    expect(ghostDrawing([])).toBeNull();
  });
  it('draws the staged ship with a provisional id at its pending facing', () => {
    expect(ghostDrawing([ship, { ...ship, hex: { q: 4, r: 4 }, facing: 5, ghostTypeId: 'galeres' }])).toEqual({
      id: GHOST_SHIP_ID,
      typeId: 'galeres',
      owner: 1,
      position: { q: 4, r: 4 },
      facing: 5,
    });
  });
});
