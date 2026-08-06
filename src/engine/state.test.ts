import { describe, it, expect } from 'vitest';
import { currentAttack, currentDefense, maxEquipmentPoints, maxEquipmentPointsForType, type Unit } from './state';
import { getUnitType, type UnitType } from '../data/units';

/** A synthetic naval `UnitType` with a defense NOT divisible by 5, so
 * `Math.ceil` actually differs from `Math.floor`/plain division — every
 * real shipped hull's defense (10/15/20/25) is a multiple of 5, so testing
 * against them alone can't tell a ceiling from a floor. */
function makeShipType(defense: number): UnitType {
  return {
    id: 'test-ship',
    name: 'Test Ship',
    domain: 'naval',
    cost: 0,
    maxCount: 1,
    attack: 0,
    rangedAttack: 0,
    range: 0,
    defense,
    movement: 0,
    meleeCapable: true,
  };
}

function makeUnit(overrides: Partial<Unit> & { typeId: string }): Unit {
  return {
    id: overrides.id ?? `test-${Math.random()}`,
    owner: 0,
    position: { q: 0, r: 0 },
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...overrides,
  };
}

describe('currentAttack — cavalry charge doubling', () => {
  it('doubles a charging light cavalry unit\'s attack from 3 to 6', () => {
    const t = getUnitType('cavalerie-legere');
    const cav = makeUnit({ typeId: 'cavalerie-legere', charged: true });
    expect(t.attack).toBe(3);
    expect(currentAttack(cav)).toBe(6);
  });

  it('doubles a charging heavy cavalry unit\'s attack from 6 to 12', () => {
    const t = getUnitType('cavalerie-lourde');
    const cav = makeUnit({ typeId: 'cavalerie-lourde', charged: true });
    expect(t.attack).toBe(6);
    expect(currentAttack(cav)).toBe(12);
  });

  it('leaves attack at its printed value when not charged', () => {
    const cav = makeUnit({ typeId: 'cavalerie-legere', charged: false });
    expect(currentAttack(cav)).toBe(3);
  });

  it('never doubles a non-cavalry unit even if `charged` is somehow set', () => {
    // `charged` should only ever be set by evaluateCharge for cavalry, but
    // currentAttack defends in depth against a stray flag on the wrong type.
    const infantry = makeUnit({ typeId: 'fantassins', charged: true });
    expect(currentAttack(infantry)).toBe(getUnitType('fantassins').attack);
  });

  it('does not affect defense', () => {
    const t = getUnitType('cavalerie-legere');
    const cav = makeUnit({ typeId: 'cavalerie-legere', charged: true });
    expect(currentDefense(cav)).toBe(t.defense);
  });
});

describe('maxEquipmentPoints', () => {
  it('is 0 for land units', () => {
    const infantry = makeUnit({ typeId: 'fantassins' });
    expect(maxEquipmentPoints(infantry)).toBe(0);
  });

  it('matches every shipped hull\'s printed defense / 5, for every hull', () => {
    // galères: defense 10 -> 2; birèmes: 15 -> 3; trirèmes: 20 -> 4; quintirèmes: 25 -> 5.
    // (All four are exact multiples of 5 — see the dedicated rounding test
    // below for a defense value where ceiling vs. floor actually differs.)
    expect(maxEquipmentPoints(makeUnit({ typeId: 'galeres' }))).toBe(2);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'biremes' }))).toBe(3);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'triremes' }))).toBe(4);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'quintiremes' }))).toBe(5);
  });

  it('rounds UP (not down or to nearest) for a defense not divisible by 5', () => {
    expect(maxEquipmentPointsForType(makeShipType(11))).toBe(3); // ceil(11/5) = 3, not floor's 2
    expect(maxEquipmentPointsForType(makeShipType(6))).toBe(2); // ceil(6/5) = 2, not floor's 1
    expect(maxEquipmentPointsForType(makeShipType(10))).toBe(2); // exact multiple: no rounding needed
  });

  it('maxEquipmentPointsForType is 0 for a land UnitType, matching maxEquipmentPoints', () => {
    expect(maxEquipmentPointsForType(getUnitType('fantassins'))).toBe(0);
  });

  it('matches the equipment loss the same ship actually takes in currentAttack/currentDefense', () => {
    const ship = makeUnit({ typeId: 'triremes', equipmentPoints: 1 }); // 3 of 4 points lost
    const t = getUnitType('triremes');
    expect(currentAttack(ship)).toBe(Math.max(0, t.attack - 3 * 5));
    expect(currentDefense(ship)).toBe(Math.max(0, t.defense - 3 * 5));
  });
});
