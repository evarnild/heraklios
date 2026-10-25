import { describe, expect, it } from 'vitest';
import { RATIO_COLUMNS, ratioToColumnIndex, resolveLandCombat } from '../data/combatTable';
import { BOARDING_RATIO_COLUMNS, boardingRatioToColumnIndex, resolveBoarding } from '../data/navalBoarding';
import { rammingSuccessRange } from '../data/navalRamming';
import { RIVER_CROSSING, TERRAIN_EFFECTS, isSeaLike, type TerrainType } from '../data/terrain';
import {
  boardingTable,
  columnForces,
  landCombatTable,
  rammingTable,
  terrainTable,
} from './ruleTables';

describe('terrainTable (§55)', () => {
  const table = terrainTable();
  it('has one row per land terrain, no sea-like terrain, in data order', () => {
    const expected = (Object.keys(TERRAIN_EFFECTS) as TerrainType[]).filter((t) => !isSeaLike(t));
    expect(table.rows.map((r) => r.terrain)).toEqual(expected);
    expect(table.rows.length).toBe(6);
  });
  it('carries the data for every row', () => {
    for (const row of table.rows) {
      const e = TERRAIN_EFFECTS[row.terrain];
      expect(row.moveCost).toBe(e.moveCost);
      expect(row.combatModifier).toBe(e.combatModifier);
      expect(row.fromBelowOnly).toBe(e.conditionalOnAttackingFromBelow);
      expect(row.forbiddenFor).toEqual(e.forbiddenFor);
    }
  });
  it('matches the print: steep flank is +2 from below only, closed to chariots and cavalry', () => {
    const steep = table.rows.find((r) => r.terrain === 'steep-flank')!;
    expect(steep).toMatchObject({ moveCost: 3, combatModifier: 2, fromBelowOnly: true });
    expect(steep.forbiddenFor).toEqual(['chariot', 'cavalry']);
    const plain = table.rows.find((r) => r.terrain === 'plain')!;
    expect(plain).toMatchObject({ moveCost: 1, combatModifier: 0, fromBelowOnly: false });
  });
  it('has the river crossing as a hexside row', () => {
    expect(table.riverCrossing).toEqual({
      extraMoveCost: RIVER_CROSSING.extraMoveCost,
      combatModifier: RIVER_CROSSING.combatModifier,
    });
    expect(table.riverCrossing).toEqual({ extraMoveCost: 1, combatModifier: 1 });
  });
});

describe('landCombatTable (§55)', () => {
  const table = landCombatTable();
  it('maps each column label to its own column index', () => {
    RATIO_COLUMNS.forEach((label, i) => {
      const f = columnForces(label);
      expect(ratioToColumnIndex(f.attack, f.defense)).toBe(i);
    });
  });
  it('equals resolveLandCombat at every column and die', () => {
    expect(table.rows.length).toBe(6);
    table.rows.forEach((row, d) => {
      expect(row.length).toBe(RATIO_COLUMNS.length);
      row.forEach((cell, c) => {
        const f = columnForces(RATIO_COLUMNS[c]!);
        expect(cell).toBe(resolveLandCombat(f.attack, f.defense, d + 1));
      });
    });
  });
  it('matches the print', () => {
    expect(table.columns).toEqual(RATIO_COLUMNS);
    expect(table.rows[0]![0]).toBe('AR');
    expect(table.rows[0]![9]).toBe('DE');
    expect(table.rows[5]![0]).toBe('AE');
    expect(table.rows[4]![9]).toBe('EX');
    expect(table.rows[3]).toEqual(['AE', 'AE', 'AR', 'AR', 'AR', 'DR', 'DR', 'DR', 'DR', 'DE']);
  });
});

describe('rammingTable (§55)', () => {
  const table = rammingTable();
  it('equals rammingSuccessRange (no bonus) for every pair', () => {
    table.ships.forEach((a, i) =>
      table.ships.forEach((d, j) => expect(table.cells[i]![j]).toEqual([...rammingSuccessRange(a, d, 0)])),
    );
  });
  it('matches the print: attacker rows, defender columns (asymmetric)', () => {
    const idx = (s: string) => table.ships.indexOf(s as never);
    expect(table.cells[idx('galeres')]![idx('quintiremes')]).toEqual([1]);
    expect(table.cells[idx('quintiremes')]![idx('galeres')]).toEqual([1, 2, 3, 4, 5]);
    expect(table.ships.length).toBe(4);
  });
});

describe('boardingTable (§55)', () => {
  const table = boardingTable();
  it('maps each column label to its own column index', () => {
    BOARDING_RATIO_COLUMNS.forEach((label, i) => {
      const f = columnForces(label);
      expect(boardingRatioToColumnIndex(f.attack, f.defense)).toBe(i);
    });
  });
  it('equals resolveBoarding at every column and die', () => {
    table.rows.forEach((row, d) =>
      row.forEach((cell, c) => {
        const f = columnForces(BOARDING_RATIO_COLUMNS[c]!);
        expect(cell).toEqual(resolveBoarding(f.attack, f.defense, d + 1));
      }),
    );
  });
  it('matches the print', () => {
    expect(table.rows[1]![0]).toEqual({ side: null, equipmentLoss: 0 });
    expect(table.rows[0]![0]).toEqual({ side: 'defender', equipmentLoss: 1 });
    expect(table.rows[5]![0]).toEqual({ side: 'attacker', equipmentLoss: 2 });
    expect(table.rows[0]![6]).toEqual({ side: 'defender', equipmentLoss: 4 });
  });
});
