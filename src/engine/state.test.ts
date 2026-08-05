import { describe, it, expect } from 'vitest';
import { currentAttack, currentDefense, maxEquipmentPoints, type Unit } from './state';
import { getUnitType } from '../data/units';

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

  it('rounds a ship\'s printed defense up to the nearest 5-point equipment point, for every hull', () => {
    // galères: defense 10 -> 2; birèmes: 15 -> 3; trirèmes: 20 -> 4; quintirèmes: 25 -> 5.
    expect(maxEquipmentPoints(makeUnit({ typeId: 'galeres' }))).toBe(2);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'biremes' }))).toBe(3);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'triremes' }))).toBe(4);
    expect(maxEquipmentPoints(makeUnit({ typeId: 'quintiremes' }))).toBe(5);
  });

  it('matches the equipment loss the same ship actually takes in currentAttack/currentDefense', () => {
    const ship = makeUnit({ typeId: 'triremes', equipmentPoints: 1 }); // 3 of 4 points lost
    const t = getUnitType('triremes');
    expect(currentAttack(ship)).toBe(Math.max(0, t.attack - 3 * 5));
    expect(currentDefense(ship)).toBe(Math.max(0, t.defense - 3 * 5));
  });
});
