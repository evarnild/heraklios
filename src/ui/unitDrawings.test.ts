import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine/turnManager';
import { unitType, type GameState, type Player, type Unit } from '../engine/state';
import { buildUnitDrawings } from './unitDrawings';

function unit(over: Partial<Unit> & { id: string; typeId: string; position: { q: number; r: number } }): Unit {
  const u: Unit = { owner: 0, movementLeft: 0, facing: 2, defendedThisPhase: false, charged: false, destroyed: false, ...over };
  if (over.movementLeft === undefined) u.movementLeft = unitType(u).movement;
  return u;
}

function stateOf(units: Unit[]): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  state.phase = 'movement';
  return state;
}

describe('buildUnitDrawings (§82 B8, B12)', () => {
  it('draws living units with the engine status, charge, and a ship facing only for ships', () => {
    const state = stateOf([
      unit({ id: 'a', typeId: 'fantassins', position: { q: 10, r: 3 } }),
      unit({ id: 'k', typeId: 'cavalerie-legere', position: { q: 12, r: 3 }, charged: true, movementLeft: 0 }),
      unit({ id: 's', typeId: 'biremes', position: { q: 28, r: 6 }, movementLeft: 1 }),
      unit({ id: 'x', typeId: 'fantassins', position: { q: 20, r: 3 }, owner: 1 }),
      unit({ id: 'dead', typeId: 'fantassins', position: { q: 22, r: 3 }, destroyed: true }),
    ]);
    const { drawings, ships } = buildUnitDrawings(state, {});
    expect(drawings.map((d) => d.id)).toEqual(['a', 'k', 's', 'x']);
    const by = Object.fromEntries(drawings.map((d) => [d.id, d]));
    expect(by.a).toMatchObject({ status: 'notMoved', facing: undefined });
    expect(by.a!.charged).toBeUndefined();
    expect(by.k).toMatchObject({ status: 'done', charged: true });
    expect(by.s).toMatchObject({ status: 'partlyMoved', facing: 2 });
    expect(by.x!.status).toBeUndefined();
    expect(ships).toEqual([{ hex: { q: 28, r: 6 }, facing: 2, playerIndex: 0 }]);
  });
});
