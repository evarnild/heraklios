import { describe, expect, it } from 'vitest';
import { MAP_TERRAIN } from '../data/map';
import { createInitialState } from './turnManager';
import { armyValue, type GameState, type Player, type PlayerId, type Unit } from './state';
import { navalBonusPlayer, playerScores } from './score';

function unit(id: string, owner: PlayerId, typeId: string, q = 0): Unit {
  return {
    id,
    owner,
    typeId,
    position: { q, r: 0 },
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

function build(count: number, units: Unit[]): GameState {
  const players: Player[] = Array.from({ length: count }, (_, id) => ({
    id: id as PlayerId,
    name: `P${id}`,
    edge: (['W', 'E', 'N', 'S'] as const)[id]!,
    purchasePoints: 400,
    eliminated: false,
  }));
  const state = createInitialState(players, 'multi-defender');
  state.units.push(...units);
  return state;
}

describe('playerScores — army value and units left', () => {
  it('matches armyValue and a hand-summed total, with ships counted', () => {
    // 0: 5+5+10+20 = 40 ; 1: 5+10+20 = 35 (both have ships: no bonus)
    const state = build(2, [
      unit('a', 0, 'fantassins'),
      unit('b', 0, 'fantassins'),
      unit('c', 0, 'galeres'),
      unit('d', 0, 'biremes'),
      unit('e', 1, 'fantassins'),
      unit('f', 1, 'galeres'),
      unit('g', 1, 'biremes'),
    ]);
    const s = playerScores(state);
    expect(s[0]).toEqual({ playerId: 0, armyValue: 40, navalBonus: 0, score: 40, unitsLeft: 4 });
    expect(s[1]).toEqual({ playerId: 1, armyValue: 35, navalBonus: 0, score: 35, unitsLeft: 3 });
    expect(s[0]!.armyValue).toBe(armyValue(state, 0));
  });

  it('counts a damaged ship at full cost and in units left (B7)', () => {
    const ship = unit('b', 0, 'biremes');
    ship.equipmentPoints = 1;
    const state = build(2, [ship, unit('f', 1, 'galeres')]);
    expect(playerScores(state)[0]).toMatchObject({ armyValue: 20, unitsLeft: 1 });
  });

  it('counts destroyed units in neither figure', () => {
    const dead = unit('x', 0, 'fantassins');
    dead.destroyed = true;
    const state = build(2, [unit('a', 0, 'fantassins'), dead, unit('f', 1, 'fantassins')]);
    expect(playerScores(state)[0]).toMatchObject({ armyValue: 5, unitsLeft: 1 });
  });

  it('keeps an eliminated player at 0 and 0', () => {
    const state = build(2, [unit('a', 0, 'fantassins')]);
    expect(playerScores(state)[1]).toEqual({ playerId: 1, armyValue: 0, navalBonus: 0, score: 0, unitsLeft: 0 });
  });

  it('returns one entry per player in id order for 2 and 4 players', () => {
    expect(playerScores(build(2, [])).map((s) => s.playerId)).toEqual([0, 1]);
    expect(playerScores(build(4, [])).map((s) => s.playerId)).toEqual([0, 1, 2, 3]);
  });
});

describe('playerScores — the naval bonus', () => {
  it('gives +30 to the only player with a living ship', () => {
    const state = build(2, [unit('a', 0, 'fantassins'), unit('c', 0, 'galeres'), unit('e', 1, 'fantassins')]);
    const s = playerScores(state);
    expect(s[0]).toMatchObject({ navalBonus: 30, score: 15 + 30 });
    expect(s[1]).toMatchObject({ navalBonus: 0, score: 5 });
    expect(navalBonusPlayer(state)).toBe(0);
  });

  it('gives nothing when two players have a ship', () => {
    const state = build(2, [unit('c', 0, 'galeres'), unit('d', 1, 'galeres')]);
    expect(playerScores(state).map((s) => s.navalBonus)).toEqual([0, 0]);
  });

  it('gives nothing with no ships at all', () => {
    const state = build(3, [unit('a', 0, 'fantassins'), unit('b', 1, 'fantassins')]);
    expect(playerScores(state).map((s) => s.navalBonus)).toEqual([0, 0, 0]);
    expect(navalBonusPlayer(state)).toBeNull();
  });

  it('counts opponents who never bought ships as absent (I2)', () => {
    const state = build(3, [unit('c', 0, 'galeres'), unit('b', 1, 'fantassins'), unit('d', 2, 'fantassins')]);
    expect(playerScores(state).map((s) => s.navalBonus)).toEqual([30, 0, 0]);
  });

  it('follows the last enemy ship being destroyed and restored (undo)', () => {
    const enemy = unit('d', 1, 'galeres');
    const state = build(2, [unit('c', 0, 'galeres'), enemy]);
    expect(playerScores(state)[0]!.navalBonus).toBe(0);
    enemy.destroyed = true;
    expect(playerScores(state)[0]!.navalBonus).toBe(30);
    enemy.destroyed = false;
    expect(playerScores(state)[0]!.navalBonus).toBe(0);
  });

  it('still counts a galley on a river-wide hex (I1)', () => {
    const entry = [...MAP_TERRAIN.entries()].find(([, t]) => t === 'river-wide');
    expect(entry).toBeDefined();
    const [q, r] = entry![0].split(',').map(Number) as [number, number];
    const galley = unit('c', 0, 'galeres');
    galley.position = { q, r };
    const state = build(2, [galley, unit('e', 1, 'fantassins')]);
    expect(playerScores(state)[0]!.navalBonus).toBe(30);
  });

  it('adds the bonus to a player with only ships (I4)', () => {
    const state = build(2, [unit('c', 0, 'galeres'), unit('d', 0, 'biremes'), unit('e', 1, 'fantassins')]);
    expect(playerScores(state)[0]).toMatchObject({ armyValue: 30, score: 60, unitsLeft: 2 });
  });
});
