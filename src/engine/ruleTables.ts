/**
 * The four printed rule tables as plain rows and cells (§55), for the board's
 * Tables panel. Pure and Phaser-free: codes and numbers only, no display text.
 *
 * Every value is read from `src/data/`. The land CRT and the boarding table
 * are module-private there, so they are read through their resolve functions
 * with forces chosen per column (a column labelled "a-d" is resolved with an
 * attack force `a` against a defence force `d`); the tests assert that those
 * forces land on the intended column, so a rounding change cannot shift one
 * silently.
 */
import {
  RATIO_COLUMNS,
  ratioToColumnIndex,
  resolveLandCombat,
  type CombatResult,
} from '../data/combatTable';
import {
  BOARDING_RATIO_COLUMNS,
  resolveBoarding,
  type BoardingResult,
} from '../data/navalBoarding';
import { SHIP_ORDER, rammingSuccessRange, type ShipTypeId } from '../data/navalRamming';
import { RIVER_CROSSING, TERRAIN_EFFECTS, isSeaLike, type TerrainType } from '../data/terrain';

const DIE_FACES: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Forces for a column label "a-d": attack `a` against defence `d`. */
export function columnForces(label: string): { attack: number; defense: number } {
  const [a, d] = label.split('-').map(Number);
  return { attack: a!, defense: d! };
}

export interface TerrainRow {
  terrain: TerrainType;
  moveCost: number;
  combatModifier: number;
  /** The modifier applies only when the attackers come from below. */
  fromBelowOnly: boolean;
  forbiddenFor: readonly string[];
}

export interface TerrainTable {
  rows: TerrainRow[];
  /** The river hexside (not a terrain). */
  riverCrossing: { extraMoveCost: number; combatModifier: number };
}

export function terrainTable(): TerrainTable {
  const rows: TerrainRow[] = (Object.keys(TERRAIN_EFFECTS) as TerrainType[])
    .filter((t) => !isSeaLike(t))
    .map((terrain) => {
      const e = TERRAIN_EFFECTS[terrain];
      return {
        terrain,
        moveCost: e.moveCost,
        combatModifier: e.combatModifier,
        fromBelowOnly: e.conditionalOnAttackingFromBelow,
        forbiddenFor: [...e.forbiddenFor],
      };
    });
  return {
    rows,
    riverCrossing: {
      extraMoveCost: RIVER_CROSSING.extraMoveCost,
      combatModifier: RIVER_CROSSING.combatModifier,
    },
  };
}

export interface LandCombatTable {
  columns: readonly string[];
  /** rows[face - 1][column] */
  rows: CombatResult[][];
}

export function landCombatTable(): LandCombatTable {
  const forces = RATIO_COLUMNS.map(columnForces);
  return {
    columns: RATIO_COLUMNS,
    rows: DIE_FACES.map((face) => forces.map((f) => resolveLandCombat(f.attack, f.defense, face))),
  };
}

export interface RammingTable {
  ships: readonly ShipTypeId[];
  /** cells[attackerIndex][defenderIndex]: the die faces that sink the defender (no bonus). */
  cells: number[][][];
}

export function rammingTable(): RammingTable {
  return {
    ships: SHIP_ORDER,
    cells: SHIP_ORDER.map((a) => SHIP_ORDER.map((d) => [...rammingSuccessRange(a, d, 0)])),
  };
}

export interface BoardingTable {
  columns: readonly string[];
  /** rows[face - 1][column]; side null = the print's pink (no result) cell. */
  rows: BoardingResult[][];
}

export function boardingTable(): BoardingTable {
  const forces = BOARDING_RATIO_COLUMNS.map(columnForces);
  return {
    columns: BOARDING_RATIO_COLUMNS,
    rows: DIE_FACES.map((face) => forces.map((f) => resolveBoarding(f.attack, f.defense, face))),
  };
}


export interface LandCombatHighlight {
  attackForce: number;
  defenseForce: number;
  modifier: number;
  /** The CRT column for the current force ratio. */
  column: number;
  /** For each die face 1-6, the CRT row (1-6) it lands on after the modifier. */
  cells: { face: number; row: number }[];
}

/**
 * Where an attack being built lands on the land CRT: the ratio column and,
 * per die face, the row after the terrain/river modifier, clamped to 1-6 the
 * way `resolveLandCombat` clamps the roll. `null` with no attack.
 */
export function landCombatHighlight(
  preview: { attackForce: number; defenseForce: number; terrainModifier: number } | null,
): LandCombatHighlight | null {
  if (!preview) return null;
  const { attackForce, defenseForce, terrainModifier } = preview;
  return {
    attackForce,
    defenseForce,
    modifier: terrainModifier,
    column: ratioToColumnIndex(attackForce, defenseForce),
    cells: DIE_FACES.map((face) => ({ face, row: Math.min(6, Math.max(1, face + terrainModifier)) })),
  };
}
