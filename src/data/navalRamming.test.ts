import { describe, it, expect } from 'vitest';
import {
  isRammingSuccessful,
  rammingBonusFromUnusedMovement,
  rammingSuccessRange,
  isRammingHitWithBonus,
} from './navalRamming';

describe('isRammingSuccessful', () => {
  it('matches the transcribed ramming table', () => {
    expect(isRammingSuccessful('galeres', 'galeres', 3)).toBe(true);
    expect(isRammingSuccessful('galeres', 'galeres', 4)).toBe(false);
    expect(isRammingSuccessful('galeres', 'quintiremes', 1)).toBe(true);
    expect(isRammingSuccessful('galeres', 'quintiremes', 2)).toBe(false);
    expect(isRammingSuccessful('quintiremes', 'galeres', 5)).toBe(true);
    expect(isRammingSuccessful('quintiremes', 'galeres', 6)).toBe(false);
    expect(isRammingSuccessful('triremes', 'biremes', 3)).toBe(true);
    expect(isRammingSuccessful('triremes', 'biremes', 4)).toBe(false);
  });
});

describe('rammingBonusFromUnusedMovement', () => {
  it('caps at 2 and floors negative/fractional input at 0', () => {
    expect(rammingBonusFromUnusedMovement(0)).toBe(0);
    expect(rammingBonusFromUnusedMovement(1)).toBe(1);
    expect(rammingBonusFromUnusedMovement(2)).toBe(2);
    expect(rammingBonusFromUnusedMovement(5)).toBe(2);
    expect(rammingBonusFromUnusedMovement(-1)).toBe(0);
  });
});

describe('rammingSuccessRange / isRammingHitWithBonus', () => {
  it('reproduces the rulebook worked example (galère vs. quintirème)', () => {
    // Table row is [1] for this matchup, so all bonus levels agree here.
    expect(rammingSuccessRange('galeres', 'quintiremes', 0)).toEqual([1]);
    expect(rammingSuccessRange('galeres', 'quintiremes', 1)).toEqual([1]);
    expect(rammingSuccessRange('galeres', 'quintiremes', 2)).toEqual([1]);
  });

  it('widens from 1, to 1-2, to 1-2-3 as bonus increases (galère vs. galère)', () => {
    expect(rammingSuccessRange('galeres', 'galeres', 0)).toEqual([1]);
    expect(rammingSuccessRange('galeres', 'galeres', 1)).toEqual([1, 2]);
    expect(rammingSuccessRange('galeres', 'galeres', 2)).toEqual([1, 2, 3]);
  });

  it('never exposes more entries than the printed table has, even at max bonus', () => {
    // Table row is [1,2,3,4,5] for this matchup; max bonus only unlocks 3 entries.
    expect(rammingSuccessRange('quintiremes', 'galeres', 2)).toEqual([1, 2, 3]);
  });

  it('isRammingHitWithBonus matches rammingSuccessRange membership', () => {
    expect(isRammingHitWithBonus('galeres', 'galeres', 0, 1)).toBe(true);
    expect(isRammingHitWithBonus('galeres', 'galeres', 0, 2)).toBe(false);
    expect(isRammingHitWithBonus('galeres', 'galeres', 2, 3)).toBe(true);
    expect(isRammingHitWithBonus('galeres', 'galeres', 2, 4)).toBe(false);
  });
});
