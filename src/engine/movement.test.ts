import { describe, it, expect } from 'vitest';
import { unitCategory, evaluateCharge } from './movement';
import { createInitialState } from './turnManager';
import { UNIT_TYPES } from '../data/units';
import type { GameState, Unit } from './state';

describe('unitCategory', () => {
  it('identifies chariots', () => {
    expect(unitCategory('chars-legers')).toBe('chariot');
    expect(unitCategory('chars-lourds')).toBe('chariot');
  });

  it('identifies cavalry', () => {
    expect(unitCategory('cavalerie-legere')).toBe('cavalry');
    expect(unitCategory('cavalerie-lourde')).toBe('cavalry');
  });

  it('identifies elephants', () => {
    expect(unitCategory('elephants')).toBe('elephant');
  });

  it('falls back to plain "land" for other land unit types', () => {
    expect(unitCategory('archers')).toBe('land');
    expect(unitCategory('fantassins')).toBe('land');
    expect(unitCategory('fantassins-archers')).toBe('land');
    expect(unitCategory('fantassins-lourds')).toBe('land');
    expect(unitCategory('phalanges')).toBe('land');
  });

  it('categorizes every naval unit type as "naval"', () => {
    for (const t of UNIT_TYPES.filter((u) => u.domain === 'naval')) {
      expect(unitCategory(t.id)).toBe('naval');
    }
  });

  it('covers every unit type in the game with no fallthrough gaps', () => {
    for (const t of UNIT_TYPES) {
      expect(unitCategory(t.id)).toBeTruthy();
    }
  });
});

// (10,3) through (19,3) — a straight run in DIRECTIONS[0] ({q:1,r:0}) — are
// all confirmed 'plain' hexes on the shipped map (see `ui/testMode.ts`'s
// `startCloseCombatTestGame` comment, which lines up land test units along
// this exact row).
function makeCavalry(overrides: Partial<Unit> & { typeId: string }): Unit {
  return {
    id: overrides.id ?? `cav-${Math.random()}`,
    owner: 0,
    position: { q: 10, r: 3 },
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    movementLeft: 0,
    ...overrides,
  };
}

function makeState(units: Unit[]): GameState {
  const state = createInitialState([], 'multi-defender');
  state.units = units;
  return state;
}

describe('evaluateCharge', () => {
  it('is a charge: cavalry spends its full allowance in a straight line and ends adjacent to an enemy', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 }); // full allowance
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 17, r: 3 } });
    const state = makeState([cav, enemy]);
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBe(true); // distance 6, adjacent to enemy at (17,3)
  });

  it('is not a charge when the move stops short of the full allowance ("ordinary attack")', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 12, r: 3 } });
    const state = makeState([cav, enemy]);
    // Distance 1 (cost 1) leaves 5 of the 6 points unspent.
    expect(evaluateCharge(state, cav, { q: 11, r: 3 })).toBe(false);
  });

  it('is not a charge when the destination is not reachable via a single straight line', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]);
    // (12,1) is not collinear with (10,3) along any of the 6 hex directions.
    expect(evaluateCharge(state, cav, { q: 12, r: 1 })).toBe(false);
  });

  it('is not a charge when the destination is not adjacent to any enemy unit', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]); // no enemy anywhere
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBe(false);
  });

  it('is not a charge for a unit that already spent some movement earlier this phase', () => {
    // Only 5 of the type's 6 points remain — the straight walk below spends
    // all of what's LEFT, but not the unit's full printed allowance.
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 5 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 16, r: 3 } });
    const state = makeState([cav, enemy]);
    expect(evaluateCharge(state, cav, { q: 15, r: 3 })).toBe(false);
  });

  it('is never a charge for non-cavalry units, even under otherwise-identical conditions', () => {
    const infantry = makeCavalry({ typeId: 'fantassins', movementLeft: 3 }); // full allowance for fantassins
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 14, r: 3 } });
    const state = makeState([infantry, enemy]);
    // Distance 3, cost 3 — exactly the full allowance, straight line, adjacent to the enemy — but not cavalry.
    expect(evaluateCharge(state, infantry, { q: 13, r: 3 })).toBe(false);
  });
});
