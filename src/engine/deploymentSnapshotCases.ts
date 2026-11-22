import type { HexCoord } from '../data/map';
import { defaultArmySelection, type ArmySelection } from './army';
import { createSeededRng } from './rng';
import { createInitialState } from './turnManager';
import type { GameState, Player, PlayerId, Unit } from './state';

/**
 * The cases behind the §72 deployment snapshots (`fixtures/72-deployment-zones.json`
 * and `fixtures/72-auto-deploy.json`). They are written once, from the code as
 * it stood before the deployment rules moved into the engine, and compared
 * afterwards against both the engine functions and the `ui` wrappers - one
 * list of cases, so the two comparisons cannot drift apart.
 *
 * Test data only: nothing in the game imports this file.
 */

export type Edge = 'N' | 'S' | 'E' | 'W';
export const EDGES: readonly Edge[] = ['N', 'S', 'E', 'W'];

export interface ZoneFunctions {
  allHexes(): HexCoord[];
  deploymentBand(edge: Edge): HexCoord[];
  navalDeploymentBand(edge: Edge): HexCoord[];
  legalDeploymentHexes(edge: Edge, enemies: readonly HexCoord[], minGap?: number): HexCoord[];
  legalNavalDeploymentHexes(edge: Edge, enemies: readonly HexCoord[], minGap?: number): HexCoord[];
}

/** Everything the zone functions return for the pinned cases, as plain JSON. */
/** `sha256` is passed in so this module needs no Node built-in and stays bundle-safe. */
export function zoneSnapshot(fns: ZoneFunctions, sha256: (text: string) => string): unknown {
  const all = fns.allHexes();
  const byEdge: Record<string, unknown> = {};
  for (const edge of EDGES) {
    const band = fns.deploymentBand(edge);
    const bay = fns.navalDeploymentBand(edge);
    const twoEnemies = [band[0]!, band[Math.floor(band.length / 2)]!];
    byEdge[edge] = {
      band,
      bay,
      land: {
        noEnemies: fns.legalDeploymentHexes(edge, []),
        twoEnemies: fns.legalDeploymentHexes(edge, twoEnemies),
        everyHexAnEnemy: fns.legalDeploymentHexes(edge, band),
        twoEnemiesGap2: fns.legalDeploymentHexes(edge, twoEnemies, 2),
      },
      naval: {
        noEnemies: fns.legalNavalDeploymentHexes(edge, []),
        firstBayHexAnEnemy: fns.legalNavalDeploymentHexes(edge, [bay[0]!]),
      },
    };
  }
  return { allHexes: { length: all.length, sha256: sha256(JSON.stringify(all)) }, byEdge };
}

export type PlaceSeat = (state: GameState, seat: number, selection: ArmySelection, rng: () => number) => void;

const SHIP_HEAVY: ArmySelection = {
  triremes: 2,
  quintiremes: 2,
  'cavalerie-legere': 2,
  'cavalerie-lourde': 2,
  elephants: 2,
};

function newState(edges: Edge[]): GameState {
  const players: Player[] = edges.map((edge, i) => ({
    id: i as PlayerId,
    name: `P${i}`,
    edge,
    purchasePoints: 400,
    eliminated: false,
  }));
  return createInitialState(players, 'multi-defender');
}

function unitLists(units: Unit[]): unknown[] {
  return units.map((u) => ({
    id: u.id,
    typeId: u.typeId,
    position: u.position,
    facing: u.facing,
    equipmentPoints: u.equipmentPoints ?? null,
    movementLeft: u.movementLeft,
  }));
}

/** Every seat placed in order, sharing one seeded rng, for each pinned case. */
export function autoDeploySnapshot(place: PlaceSeat): Record<string, unknown> {
  const cases: Array<{ name: string; edges: Edge[]; selection: ArmySelection; seeds: number[] }> = [
    { name: 'two-players-default', edges: ['W', 'E'], selection: defaultArmySelection(), seeds: [1, 2, 3, 4, 5] },
    { name: 'four-players-default', edges: ['N', 'E', 'S', 'W'], selection: defaultArmySelection(), seeds: [1, 2, 3] },
    { name: 'ship-heavy', edges: ['W', 'E'], selection: SHIP_HEAVY, seeds: [1, 2, 3] },
  ];
  const out: Record<string, unknown> = {};
  for (const c of cases) {
    for (const seed of c.seeds) {
      const state = newState(c.edges);
      const rng = createSeededRng(seed);
      for (let seat = 0; seat < c.edges.length; seat++) place(state, seat, c.selection, rng);
      out[`${c.name}/seed${seed}`] = unitLists(state.units);
    }
  }
  return out;
}
