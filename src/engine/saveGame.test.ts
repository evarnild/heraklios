import { describe, it, expect } from 'vitest';
import {
  SAVE_VERSION,
  buildSavedGame,
  describeSave,
  formatSavedAt,
  isValidSavedGame,
  parseSavedGame,
  type SavedGame,
} from './saveGame';
import { createInitialState } from './turnManager';
import { emptySelection } from './army';
import type { Player, PlayerId, Unit } from './state';
import { getUnitType } from '../data/units';

function makeUnit(id: string, owner: PlayerId, typeId: string, q: number, r: number): Unit {
  const t = getUnitType(typeId);
  return {
    id,
    owner,
    typeId,
    position: { q, r },
    movementLeft: t.movement,
    facing: 1,
    equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

function sampleSave(): SavedGame {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'Athènes', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'Perse', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const gameState = createInitialState(players, 'multi-defender');
  gameState.units.push(makeUnit('p0u0', 0 as PlayerId, 'fantassins', 3, 4));
  gameState.units.push(makeUnit('p1u0', 1 as PlayerId, 'galeres', 20, 10));
  gameState.turnNumber = 3;
  gameState.phase = 'combat';

  return buildSavedGame({
    savedAt: '2026-07-25T12:34:56.000Z',
    playerCount: 2,
    playerNames: ['Athènes', 'Perse'],
    edges: ['W', 'E'],
    armySelections: [emptySelection(), emptySelection()],
    combatMode: 'multi-defender',
    testMode: false,
    gameState,
    attackedThisPhase: ['p0u0'],
    rammedThisTurn: [],
  });
}

describe('buildSavedGame', () => {
  it('stamps the current version', () => {
    expect(sampleSave().version).toBe(SAVE_VERSION);
  });
});

describe('save round-trip', () => {
  it('survives JSON serialization with every field intact', () => {
    const save = sampleSave();
    const restored = JSON.parse(JSON.stringify(save));
    expect(restored).toEqual(save);
  });

  it('is accepted by its own validator after a round-trip', () => {
    const text = JSON.stringify(sampleSave());
    const result = parseSavedGame(text);
    expect('save' in result).toBe(true);
  });

  it('preserves the per-phase bookkeeping that lives outside GameState', () => {
    const save = sampleSave();
    save.rammedThisTurn = ['p1u0'];
    const result = parseSavedGame(JSON.stringify(save));
    expect('save' in result && result.save.attackedThisPhase).toEqual(['p0u0']);
    expect('save' in result && result.save.rammedThisTurn).toEqual(['p1u0']);
  });

  it('preserves unit position, facing and movement', () => {
    const result = parseSavedGame(JSON.stringify(sampleSave()));
    if (!('save' in result)) throw new Error('expected a valid save');
    const ship = result.save.gameState.units.find((u) => u.id === 'p1u0')!;
    expect(ship.position).toEqual({ q: 20, r: 10 });
    expect(ship.facing).toBe(1);
    expect(ship.equipmentPoints).toBeGreaterThan(0);
  });
});

describe('isValidSavedGame', () => {
  it('accepts a well-formed save', () => {
    expect(isValidSavedGame(sampleSave())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['a number', 42],
    ['an array', []],
    ['an empty object', {}],
  ])('rejects %s', (_label, value) => {
    expect(isValidSavedGame(value)).toBe(false);
  });

  it('rejects a mismatched version', () => {
    const save = { ...sampleSave(), version: SAVE_VERSION + 1 };
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects a missing gameState', () => {
    const save = sampleSave() as Partial<SavedGame>;
    delete save.gameState;
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects an unknown phase', () => {
    const save = sampleSave();
    (save.gameState as { phase: string }).phase = 'diplomacy';
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects an unknown combat mode', () => {
    const save = sampleSave();
    (save as { combatMode: string }).combatMode = 'free-for-all';
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects an activePlayerIndex outside seatOrder', () => {
    const save = sampleSave();
    save.gameState.activePlayerIndex = 5;
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects a unit with a malformed position', () => {
    const save = sampleSave();
    (save.gameState.units[0] as { position: unknown }).position = { q: 'three', r: 4 };
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects a unit missing its id', () => {
    const save = sampleSave();
    delete (save.gameState.units[0] as Partial<Unit>).id;
    expect(isValidSavedGame(save)).toBe(false);
  });
});

describe('parseSavedGame', () => {
  it('reports invalid JSON', () => {
    const result = parseSavedGame('{ not json');
    expect('error' in result && result.error).toMatch(/valid JSON/);
  });

  it('reports a version mismatch specifically, naming both versions', () => {
    const result = parseSavedGame(JSON.stringify({ ...sampleSave(), version: 99 }));
    expect('error' in result && result.error).toContain('99');
    expect('error' in result && result.error).toContain(`${SAVE_VERSION}`);
  });

  it('reports a structurally wrong file', () => {
    const result = parseSavedGame(JSON.stringify({ hello: 'world' }));
    expect('error' in result && result.error).toMatch(/isn't a Héraklios save/);
  });
});

describe('describeSave', () => {
  it('names the turn, active player and phase', () => {
    expect(describeSave(sampleSave())).toBe('Turn 3 — Athènes (combat)');
  });

  it('follows seat order rather than assuming player 0 is active', () => {
    const save = sampleSave();
    save.gameState.activePlayerIndex = 1;
    expect(describeSave(save)).toBe('Turn 3 — Perse (combat)');
  });
});

describe('formatSavedAt', () => {
  it('renders a parseable timestamp as a short local date-time', () => {
    // Built from local-time parts so the assertion is timezone-independent.
    const local = new Date(2026, 6, 25, 14, 5).toISOString();
    expect(formatSavedAt(local)).toBe('2026-07-25 14:05');
  });

  it('passes through an unparseable value rather than showing NaN', () => {
    expect(formatSavedAt('whenever')).toBe('whenever');
  });
});
