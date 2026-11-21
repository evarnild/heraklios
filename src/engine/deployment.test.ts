import { describe, expect, it } from 'vitest';
import { MAP_TERRAIN, hexKey } from '../data/map';
import { canEnterTerrain } from '../data/terrain';
import { getUnitType } from '../data/units';
import { defaultArmySelection } from './army';
import {
  allHexes,
  autoDeploy,
  deployUnit,
  deploymentBand,
  legalDeploymentHexes,
  legalNavalDeploymentHexes,
  navalDeploymentBand,
} from './deployment';
import { autoDeploySnapshot, zoneSnapshot } from './deploymentSnapshotCases';
import autoFixture from './fixtures/72-auto-deploy.json';
import zoneFixture from './fixtures/72-deployment-zones.json';
import { createSeededRng } from './rng';
import { createInitialState } from './turnManager';
import { maxEquipmentPointsForType, unitCategory, type GameState, type Player, type PlayerId } from './state';

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

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

describe('the deployment zones (B9)', () => {
  // Kills any edit to `depthBand`, `DEPTH`, the gap or its fallback: the
  // fixture was written from `ui/mapBounds.ts` before the rules moved.
  it('return what ui/mapBounds returned before the move, for every edge and case', () => {
    expect(
      json(zoneSnapshot({ allHexes, deploymentBand, navalDeploymentBand, legalDeploymentHexes, legalNavalDeploymentHexes })),
    ).toEqual(zoneFixture);
  });
});

describe('deployUnit (B10)', () => {
  const west = deploymentBand('W');
  const bay = navalDeploymentBand('W');

  const firstEnterable = (typeId: string) =>
    west.find((h) => canEnterTerrain(MAP_TERRAIN.get(hexKey(h.q, h.r))!, unitCategory(typeId)))!;

  it("places a land unit with Placement's fields", () => {
    const state = stateFor('W', 'E');
    const hex = firstEnterable('archers');
    const result = deployUnit(state, 0, { typeId: 'archers', hex });
    expect(result.ok).toBe(true);
    expect(state.units).toHaveLength(1);
    expect(state.units[0]).toEqual({
      id: 'p0u0',
      owner: 0,
      typeId: 'archers',
      position: hex,
      movementLeft: getUnitType('archers').movement,
      facing: 0,
      equipmentPoints: undefined,
      defendedThisPhase: false,
      charged: false,
      destroyed: false,
    });
  });

  it('places a ship with its facing and its equipment points', () => {
    const state = stateFor('W', 'E');
    const result = deployUnit(state, 0, { typeId: 'triremes', hex: bay[0]!, facing: 4 });
    expect(result.ok).toBe(true);
    const ship = state.units[0]!;
    expect(ship.facing).toBe(4);
    expect(ship.equipmentPoints).toBe(maxEquipmentPointsForType(getUnitType('triremes')));
    expect(ship.movementLeft).toBe(getUnitType('triremes').movement);
  });

  it('gives a land unit facing 0 whatever is passed', () => {
    const state = stateFor('W', 'E');
    deployUnit(state, 0, { typeId: 'archers', hex: firstEnterable('archers'), facing: 3 });
    expect(state.units[0]!.facing).toBe(0);
  });

  // A4: n is the number of units THIS seat has, not a counter shared by seats.
  it('numbers the id by the units the seat already has, whatever the other seat has', () => {
    const state = stateFor('W', 'E');
    const east = deploymentBand('E');
    for (let i = 0; i < 5; i++) deployUnit(state, 1, { typeId: 'archers', hex: east[i]! });
    for (let i = 0; i < 3; i++) deployUnit(state, 0, { typeId: 'archers', hex: west[i]! });
    const next = deployUnit(state, 0, { typeId: 'archers', hex: west[3]! });
    expect(next.ok && next.unit.id).toBe('p0u3');
    expect(state.units.filter((u) => u.owner === 1).map((u) => u.id)).toEqual(['p1u0', 'p1u1', 'p1u2', 'p1u3', 'p1u4']);
  });

  const expectError = (state: GameState, request: Parameters<typeof deployUnit>[2], kind: string) => {
    const before = structuredClone(state);
    const result = deployUnit(state, 0, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe(kind);
    expect(state).toEqual(before); // nothing is pushed on any error
  };

  it('refuses a band hex of another edge', () => {
    expectError(stateFor('W', 'E'), { typeId: 'archers', hex: deploymentBand('E')[0]! }, 'illegalHex');
  });

  it('refuses a ship on a land band hex and a land unit on a bay hex', () => {
    expectError(stateFor('W', 'E'), { typeId: 'triremes', hex: west[0]!, facing: 0 }, 'illegalHex');
    expectError(stateFor('W', 'E'), { typeId: 'archers', hex: bay[0]! }, 'illegalHex');
  });

  it('refuses a hex within 4 of an enemy when another hex is clear', () => {
    const state = stateFor('W', 'E');
    const target = west[Math.floor(west.length / 2)]!;
    // An enemy unit placed by hand next to the target: this is a rule check on
    // the gap, not a placement by the other seat.
    state.units.push({
      id: 'p1u0',
      owner: 1,
      typeId: 'archers',
      position: { q: target.q + 1, r: target.r },
      movementLeft: 0,
      facing: 0,
      equipmentPoints: undefined,
      defendedThisPhase: false,
      charged: false,
      destroyed: false,
    });
    expect(legalDeploymentHexes('W', [state.units[0]!.position]).some((h) => h.q === target.q && h.r === target.r)).toBe(false);
    expect(legalDeploymentHexes('W', [state.units[0]!.position]).length).toBeGreaterThan(0);
    expectError(state, { typeId: 'archers', hex: target }, 'illegalHex');
  });

  it('refuses terrain the unit cannot enter', () => {
    const south = deploymentBand('S');
    const blocked = south.find((h) => !canEnterTerrain(MAP_TERRAIN.get(hexKey(h.q, h.r))!, 'cavalry'));
    expect(blocked, 'the southern band holds terrain cavalry cannot enter').toBeDefined();
    expectError(stateFor('S', 'N'), { typeId: 'cavalerie-legere', hex: blocked! }, 'terrain');
  });

  it('refuses an occupied hex', () => {
    const state = stateFor('W', 'E');
    const hex = firstEnterable('archers');
    deployUnit(state, 0, { typeId: 'archers', hex });
    expectError(state, { typeId: 'archers', hex }, 'occupied');
  });

  it('refuses a ship with no facing, or a facing outside 0-5 or not whole', () => {
    for (const facing of [undefined, 6, -1, 1.5]) {
      expectError(stateFor('W', 'E'), { typeId: 'triremes', hex: bay[0]!, facing }, 'facing');
    }
  });
});

describe('autoDeploy (B11)', () => {
  // Kills any change to the algorithm: the fixture is `autoPlaceSeat`'s output
  // from before the move, for the same states, armies and seeds.
  it('deploys the units autoPlaceSeat deployed before the move', () => {
    const place = (state: GameState, seat: number, selection: Record<string, number>, rng: () => number) =>
      autoDeploy(state, seat, selection, rng);
    expect(json(autoDeploySnapshot(place))).toEqual(autoFixture);
  });

  it('throws when the zone runs out of room', () => {
    const state = stateFor('W', 'E');
    expect(() => autoDeploy(state, 0, { archers: 500 }, createSeededRng(1))).toThrow(/no legal hex left/);
  });

  it('needs an rng', () => {
    const state = stateFor('W', 'E');
    expect(() => autoDeploy(state, 0, defaultArmySelection(), undefined as unknown as () => number)).toThrow(/rng/);
  });
});
