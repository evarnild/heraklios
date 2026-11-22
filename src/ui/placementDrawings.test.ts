import { describe, expect, it } from 'vitest';
import { defaultArmySelection } from '../engine/army';
import { autoDeploy } from '../engine/deployment';
import { createSeededRng } from '../engine/rng';
import type { GameState, Player, PlayerId, Unit } from '../engine/state';
import { createInitialState } from '../engine/turnManager';
import { placementFacingShips, placementUnitDrawings } from './placementDrawings';

function stateFor(...edges: Array<'N' | 'S' | 'E' | 'W'>): GameState {
  const players: Player[] = edges.map((edge, i) => ({
    id: i as PlayerId,
    name: `P${i}`,
    edge,
    purchasePoints: 400,
    eliminated: false,
  }));
  return createInitialState(players, 'multi-defender');
}

function unit(id: string, owner: number, typeId: string, q: number, r: number, facing = 0): Unit {
  return {
    id,
    owner: owner as PlayerId,
    typeId,
    position: { q, r },
    movementLeft: 0,
    facing,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

function mixed(players = 2): GameState {
  const s = stateFor(...(['W', 'E', 'N', 'S'] as const).slice(0, players));
  s.units.push(
    unit('a', 0, 'fantassins', 1, 1),
    unit('s0', 0, 'triremes', 0, 5, 2),
    unit('b', 1, 'fantassins', 9, 9),
    unit('s1', 1, 'triremes', 9, 5, 4),
    unit('dead', 0, 'fantassins', 2, 2),
    unit('c', 2, 'fantassins', 5, 5),
  );
  s.units.find((u) => u.id === 'dead')!.destroyed = true;
  return s;
}

describe('placementUnitDrawings', () => {
  it('gives one drawing per living unit, in state order', () => {
    const s = mixed();
    expect(placementUnitDrawings(s, 1).map((d) => d.id)).toEqual(['a', 's0', 'b', 's1', 'c']);
  });

  it('dims every unit of another seat and none of the placing seat', () => {
    const s = mixed(3);
    for (const seat of [1, 2]) {
      for (const d of placementUnitDrawings(s, seat)) {
        if (d.owner === seat) expect(d.dimmed).toBeUndefined();
        else expect(d.dimmed).toBe(true);
        if (d.owner === seat) expect('dimmed' in d).toBe(false);
      }
    }
    const seat2 = placementUnitDrawings(s, 2);
    expect(seat2.filter((d) => d.dimmed).map((d) => d.owner)).toEqual([0, 0, 1, 1]);
  });

  it('keeps a ship facing and leaves a land unit without one', () => {
    const d = placementUnitDrawings(mixed(), 1);
    expect(d.find((x) => x.id === 's0')!.facing).toBe(2);
    expect(d.find((x) => x.id === 'a')!.facing).toBeUndefined();
  });

  it('shows a computer seat 0 deployed by autoDeploy, all dimmed, to seat 1', () => {
    const s = stateFor('W', 'E');
    autoDeploy(s, 0, defaultArmySelection(), createSeededRng(1));
    const d = placementUnitDrawings(s, 1);
    expect(d.length).toBeGreaterThan(0);
    expect(d).toHaveLength(s.units.length);
    expect(d.every((x) => x.owner === 0 && x.dimmed === true)).toBe(true);
  });
});

describe('placementFacingShips', () => {
  it('lists every living ship of every seat and no land unit', () => {
    const ships = placementFacingShips(mixed(), 1, null);
    expect(ships).toEqual([
      { hex: { q: 0, r: 5 }, facing: 2, playerIndex: 0, dimmed: true },
      { hex: { q: 9, r: 5 }, facing: 4, playerIndex: 1 },
    ]);
  });

  it('adds the staged ship last, as an undimmed ghost of the placing seat', () => {
    const ships = placementFacingShips(mixed(), 1, { hex: { q: 8, r: 6 }, facing: 3, typeId: 'galeres' });
    expect(ships).toHaveLength(3);
    expect(ships[2]).toEqual({ hex: { q: 8, r: 6 }, facing: 3, playerIndex: 1, ghostTypeId: 'galeres' });
    expect('dimmed' in ships[2]!).toBe(false);
  });
});
