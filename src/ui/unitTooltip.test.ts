import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, Unit } from '../engine/state';
import { resetLanguageForTests, setLanguage } from './i18n';
import { formatUnitTooltip, unitTooltipFor } from './unitTooltip';

function unit(typeId: string, extra: Partial<Unit> = {}): Unit {
  return {
    id: 'u1', owner: 1, typeId, position: { q: 3, r: 4 }, movementLeft: 2, facing: 0,
    defendedThisPhase: false, charged: false, destroyed: false, ...extra,
  };
}
const owner = { name: 'Persia', index: 1 };
const on = { state: true };

describe('formatUnitTooltip', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    setLanguage('en');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLanguageForTests();
  });

  it('shows a plain land unit', () => {
    expect(formatUnitTooltip(unit('fantassins'), owner, on)).toBe(
      'Infantry — Persia (red)\nattack 2, defense 1, movement 3\nmovement left 2',
    );
  });

  it('includes ranged attack and range only for a unit with a range', () => {
    const archers = formatUnitTooltip(unit('archers'), owner, on).split('\n')[1];
    expect(archers).toBe('attack 0, ranged 2, range 2, defense 1, movement 3');
    expect(formatUnitTooltip(unit('fantassins'), owner, on)).not.toContain('ranged');
  });

  it('shows a charge: doubled attack with the printed value, and charged', () => {
    const text = formatUnitTooltip(unit('cavalerie-legere', { charged: true }), owner, on);
    expect(text.split('\n').slice(1)).toEqual([
      'attack 6 (3), defense 2, movement 6',
      'movement left 2, charged',
    ]);
    expect(formatUnitTooltip(unit('cavalerie-legere'), owner, on)).not.toContain('charged');
  });

  it('shows a damaged ship with printed values in brackets, and its equipment', () => {
    const damaged = formatUnitTooltip(unit('biremes', { equipmentPoints: 1 }), owner, on);
    expect(damaged.split('\n').slice(1)).toEqual([
      'attack 5 (15), defense 5 (15), movement 6',
      'movement left 2, equipment 1/3',
    ]);
    const full = formatUnitTooltip(unit('biremes', { equipmentPoints: 3 }), owner, on);
    expect(full.split('\n').slice(1)).toEqual([
      'attack 15, defense 15, movement 6',
      'movement left 2, equipment 3/3',
    ]);
  });

  it('has no state line in Placement, and no equipment for land units', () => {
    expect(formatUnitTooltip(unit('biremes', { equipmentPoints: 3 }), owner, { state: false }).split('\n')).toHaveLength(2);
    expect(formatUnitTooltip(unit('fantassins'), owner, on)).not.toContain('equipment');
  });

  it('speaks French in French', () => {
    setLanguage('fr');
    const text = formatUnitTooltip(unit('cavalerie-legere', { charged: true }), { name: 'Perse', index: 1 }, on);
    expect(text.split('\n').slice(1)).toEqual([
      'attaque 6 (3), défense 2, mouvement 6',
      'mouvement restant 2, a chargé',
    ]);
    expect(text.split('\n')[0]).toMatch(/ — Perse \(rouge\)$/);
  });
});

describe('unitTooltipFor', () => {
  beforeEach(() => setLanguage('en'));
  afterEach(() => resetLanguageForTests());
  const state = {
    players: [{ name: 'A' }, { name: 'Persia' }],
    units: [unit('fantassins', { destroyed: true }), unit('archers', { id: 'u2', position: { q: 5, r: 5 } })],
  } as unknown as GameState;

  it('is null for an empty hex and for a destroyed unit', () => {
    expect(unitTooltipFor(state, { q: 0, r: 0 }, on)).toBeNull();
    expect(unitTooltipFor(state, { q: 3, r: 4 }, on)).toBeNull();
  });

  it('gives the lines for a living unit', () => {
    expect(unitTooltipFor(state, { q: 5, r: 5 }, { state: false })).toBe(
      'Archers — Persia (red)\nattack 0, ranged 2, range 2, defense 1, movement 3',
    );
  });
});
