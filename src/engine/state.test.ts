import { describe, it, expect } from 'vitest';
import { currentAttack, currentDefense, type Unit } from './state';
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
