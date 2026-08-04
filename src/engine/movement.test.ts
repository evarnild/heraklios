import { describe, it, expect } from 'vitest';
import { unitCategory, evaluateCharge, reachableHexes } from './movement';
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
  it('is a charge: cavalry spends its full allowance in a straight line and ends adjacent to an enemy — returns the cost to deduct', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 }); // full allowance
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 17, r: 3 } });
    const state = makeState([cav, enemy]);
    // distance 6, adjacent to enemy at (17,3), all-plain so straight cost === distance.
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBe(6);
  });

  it('is not a charge when the move stops short of the full allowance ("ordinary attack")', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 12, r: 3 } });
    const state = makeState([cav, enemy]);
    // Distance 1 (cost 1) leaves 5 of the 6 points unspent.
    expect(evaluateCharge(state, cav, { q: 11, r: 3 })).toBeNull();
  });

  it('is not a charge when the destination is not reachable via a single straight line', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]);
    // (12,1) is not collinear with (10,3) along any of the 6 hex directions.
    expect(evaluateCharge(state, cav, { q: 12, r: 1 })).toBeNull();
  });

  it('is not a charge when the destination is not adjacent to any enemy unit', () => {
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 6 });
    const state = makeState([cav]); // no enemy anywhere
    expect(evaluateCharge(state, cav, { q: 16, r: 3 })).toBeNull();
  });

  it('is not a charge for a unit that already spent some movement earlier this phase', () => {
    // Only 5 of the type's 6 points remain — the straight walk below spends
    // all of what's LEFT, but not the unit's full printed allowance.
    const cav = makeCavalry({ typeId: 'cavalerie-legere', movementLeft: 5 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 16, r: 3 } });
    const state = makeState([cav, enemy]);
    expect(evaluateCharge(state, cav, { q: 15, r: 3 })).toBeNull();
  });

  it('is never a charge for non-cavalry units, even under otherwise-identical conditions', () => {
    const infantry = makeCavalry({ typeId: 'fantassins', movementLeft: 3 }); // full allowance for fantassins
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 14, r: 3 } });
    const state = makeState([infantry, enemy]);
    // Distance 3, cost 3 — exactly the full allowance, straight line, adjacent to the enemy — but not cavalry.
    expect(evaluateCharge(state, infantry, { q: 13, r: 3 })).toBeNull();
  });

  // Regression for a bug an adversarial review caught: BoardScene was
  // deducting `reachableHexes`'s CHEAPEST-path cost even when charging,
  // rather than the straight-line cost this function computes — on hexes
  // where a detour around a river is cheaper than the direct line, that
  // granted a doubled attack while leaving movement unspent. These two
  // (start, destination) pairs are confirmed against the shipped
  // `src/data/map.ts`: both have a straight line strictly costlier than
  // `reachableHexes`'s cheapest path to the same hex, so this test would
  // have caught a caller that used the wrong number.
  it('returns the (costlier) straight-line cost even when a cheaper detour to the same hex exists — light cavalry crossing two river hexsides', () => {
    // (10,1)-(14,1) are all 'plain'; the straight line crosses river
    // hexsides at (11,1)|(12,1) and (12,1)|(13,1) (+1 move cost each),
    // for a straight-line total of 6 — exactly light cavalry's full
    // allowance. `reachableHexes` finds a cheaper 5-cost detour to the same
    // hex (confirmed via `reachableHexes` below), which must NOT be what
    // gets deducted for a charge.
    const cav = makeCavalry({ typeId: 'cavalerie-legere', position: { q: 10, r: 1 }, movementLeft: 6 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 15, r: 1 } });
    const state = makeState([cav, enemy]);
    expect(reachableHexes(state, cav).get('14,1')).toBe(5); // the cheaper detour a naive caller might wrongly deduct
    expect(evaluateCharge(state, cav, { q: 14, r: 1 })).toBe(6);
  });

  it('returns the (costlier) straight-line cost even when a cheaper detour to the same hex exists — heavy cavalry through wide-river hexes', () => {
    // (20,4) and (20,3) are 'river-wide' terrain (move cost 3 each hex, no
    // forbidden-category restriction), (20,2) is 'plain': a straight-line
    // total of 3 + 1 = 4, exactly heavy cavalry's full allowance, while
    // `reachableHexes` finds a cheaper 3-cost detour around the wide river.
    const cav = makeCavalry({ typeId: 'cavalerie-lourde', position: { q: 20, r: 4 }, movementLeft: 4 });
    const enemy = makeCavalry({ typeId: 'fantassins', owner: 1, position: { q: 20, r: 1 } });
    const state = makeState([cav, enemy]);
    expect(reachableHexes(state, cav).get('20,2')).toBe(3); // the cheaper detour a naive caller might wrongly deduct
    expect(evaluateCharge(state, cav, { q: 20, r: 2 })).toBe(4);
  });
});
