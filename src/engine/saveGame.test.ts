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
import { maxEquipmentPointsForType, type Player, type PlayerId, type Unit } from './state';
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
    equipmentPoints: t.domain === 'naval' ? maxEquipmentPointsForType(t) : undefined,
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
    seatControls: ['human', 'ai-ev'],
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

  it('preserves a charging unit\'s `charged: true` flag through both structuredClone and JSON round-trips', () => {
    // Regression coverage for the design-decision comment above
    // `SAVE_VERSION`: a mid-turn save made AFTER a charge (and before that
    // unit has attacked) must NOT lose the charge on reload — `charged` is
    // a plain boolean on a plain-data `Unit`, so it round-trips exactly like
    // every other field.
    const save = sampleSave();
    const infantry = save.gameState.units.find((u) => u.id === 'p0u0')!;
    infantry.charged = true;

    const clonedThenParsed = parseSavedGame(JSON.stringify(structuredClone(save)));
    if (!('save' in clonedThenParsed)) throw new Error('expected a valid save');
    expect(clonedThenParsed.save.gameState.units.find((u) => u.id === 'p0u0')!.charged).toBe(true);

    const jsonRoundTripped = parseSavedGame(JSON.stringify(save));
    if (!('save' in jsonRoundTripped)) throw new Error('expected a valid save');
    expect(jsonRoundTripped.save.gameState.units.find((u) => u.id === 'p0u0')!.charged).toBe(true);
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

  it('rejects missing seatControls at the current version', () => {
    // NOT the same case as a version-1 file, which legitimately has no such
    // field and is filled in by `migrateSavedGame`: a file already claiming
    // version 2 without it is corrupt.
    const save = sampleSave() as Partial<SavedGame>;
    delete save.seatControls;
    expect(isValidSavedGame(save)).toBe(false);
  });

  it('rejects an unknown seat control', () => {
    const save = sampleSave();
    (save.seatControls as string[])[1] = 'ai-lookahead';
    expect(isValidSavedGame(save)).toBe(false);
  });
});

describe('seatControls round-trip', () => {
  it('preserves which seats are AI, and at which difficulty', () => {
    const result = parseSavedGame(JSON.stringify(sampleSave()));
    if (!('save' in result)) throw new Error('expected a valid save');
    expect(result.save.seatControls).toEqual(['human', 'ai-ev']);
  });

  it('keeps every difficulty tier distinguishable, not just "is AI"', () => {
    const save = sampleSave();
    save.playerNames = ['A', 'B', 'C', 'D'];
    save.seatControls = ['human', 'ai-random', 'ai-greedy', 'ai-ev'];
    const result = parseSavedGame(JSON.stringify(save));
    if (!('save' in result)) throw new Error('expected a valid save');
    expect(result.save.seatControls).toEqual(['human', 'ai-random', 'ai-greedy', 'ai-ev']);
  });
});

describe('migrateSavedGame', () => {
  /** A version-1 file: exactly today's shape minus the field version 2 added. */
  function version1Save(): Record<string, unknown> {
    const save = sampleSave() as unknown as Record<string, unknown>;
    delete save.seatControls;
    save.version = 1;
    return save;
  }

  it('loads a version-1 save as an all-human game', () => {
    const result = parseSavedGame(JSON.stringify(version1Save()));
    if (!('save' in result)) throw new Error(`expected a valid save, got ${JSON.stringify(result)}`);
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.seatControls).toEqual(['human', 'human']);
  });

  it('leaves the rest of a version-1 save untouched', () => {
    const result = parseSavedGame(JSON.stringify(version1Save()));
    if (!('save' in result)) throw new Error('expected a valid save');
    expect(result.save.gameState.turnNumber).toBe(3);
    expect(result.save.attackedThisPhase).toEqual(['p0u0']);
    expect(describeSave(result.save)).toBe('Turn 3 — Athènes (combat)');
  });

  it('still rejects a version-1 file that is structurally broken', () => {
    // The version check no longer gates these — `isValidSavedGame` does, and
    // it must still run after the migration rather than being skipped by it.
    const save = version1Save();
    delete save.gameState;
    const result = parseSavedGame(JSON.stringify(save));
    expect('error' in result && result.error).toMatch(/isn't a Héraklios save/);
  });

  it('rejects a version from the future', () => {
    const result = parseSavedGame(JSON.stringify({ ...sampleSave(), version: SAVE_VERSION + 1 }));
    expect('error' in result && result.error).toContain(`${SAVE_VERSION + 1}`);
  });

  it('rejects a version older than anything it can migrate', () => {
    const result = parseSavedGame(JSON.stringify({ ...version1Save(), version: 0 }));
    expect('error' in result && result.error).toMatch(/isn't supported/);
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
