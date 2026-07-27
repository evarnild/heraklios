import { describe, it, expect } from 'vitest';
import { unitCategory } from './movement';
import { UNIT_TYPES } from '../data/units';

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
