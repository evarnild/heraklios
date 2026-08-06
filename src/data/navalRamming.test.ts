import { describe, it, expect } from 'vitest';
import {
  isRammingSuccessful,
  rammingBonusFromUnusedMovement,
  rammingSuccessRange,
  isRammingHitWithBonus,
  fullRammingSuccessRange,
  maxReachableRammingEntries,
  MAX_RAMMING_BONUS,
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

describe('fullRammingSuccessRange', () => {
  it('matches rammingSuccessRange at max bonus for a matchup with 3 or fewer entries', () => {
    expect(fullRammingSuccessRange('galeres', 'galeres')).toEqual([1, 2, 3]);
    expect(fullRammingSuccessRange('galeres', 'galeres')).toEqual(rammingSuccessRange('galeres', 'galeres', 2));
  });

  it('is WIDER than rammingSuccessRange at max bonus for a matchup with 4+ entries', () => {
    // Table row is [1,2,3,4] for trirème vs galère; max bonus only unlocks 1-2-3.
    expect(fullRammingSuccessRange('triremes', 'galeres')).toEqual([1, 2, 3, 4]);
    expect(rammingSuccessRange('triremes', 'galeres', 2)).toEqual([1, 2, 3]);
  });

  it('is WIDER than rammingSuccessRange at max bonus for the widest row (quintirème vs galère)', () => {
    expect(fullRammingSuccessRange('quintiremes', 'galeres')).toEqual([1, 2, 3, 4, 5]);
    expect(rammingSuccessRange('quintiremes', 'galeres', 2)).toEqual([1, 2, 3]);
  });

  it('returns a fresh array each time, not a reference into the shared table', () => {
    const a = fullRammingSuccessRange('galeres', 'galeres') as number[];
    a.push(99);
    expect(fullRammingSuccessRange('galeres', 'galeres')).toEqual([1, 2, 3]);
  });
});

describe('maxReachableRammingEntries', () => {
  it('equals the full row length when the row fits within MAX_RAMMING_BONUS + 1 entries', () => {
    expect(maxReachableRammingEntries('galeres', 'galeres')).toBe(3);
    expect(fullRammingSuccessRange('galeres', 'galeres').length).toBe(3);
    expect(maxReachableRammingEntries('galeres', 'quintiremes')).toBe(1);
    expect(fullRammingSuccessRange('galeres', 'quintiremes').length).toBe(1);
  });

  it('is smaller than the full row length for rows wider than MAX_RAMMING_BONUS + 1', () => {
    expect(maxReachableRammingEntries('triremes', 'galeres')).toBe(1 + MAX_RAMMING_BONUS);
    expect(fullRammingSuccessRange('triremes', 'galeres').length).toBe(4);
    expect(maxReachableRammingEntries('quintiremes', 'galeres')).toBe(1 + MAX_RAMMING_BONUS);
    expect(fullRammingSuccessRange('quintiremes', 'galeres').length).toBe(5);
  });
});
