import { describe, it, expect } from 'vitest';
import {
  isRammingSuccessful,
  rammingBonusFromUnusedMovement,
  rammingSuccessRange,
  isRammingHitWithBonus,
  fullRammingSuccessRange,
  MAX_RAMMING_BONUS,
  SHIP_ORDER,
  type ShipTypeId,
} from './navalRamming';

/** Every (attacker, defender) ship-type pairing — all 16 rows of the
 * printed ramming table, used below to sweep a claim across the whole
 * table rather than spot-checking a few matchups (see the adversarial
 * review finding that a manual, non-exhaustive check of this exact claim
 * shipped a false statement once already). */
const ALL_MATCHUPS: readonly [ShipTypeId, ShipTypeId][] = SHIP_ORDER.flatMap((attacker) =>
  SHIP_ORDER.map((defender): [ShipTypeId, ShipTypeId] => [attacker, defender]),
);

/** `1..n` as a plain array, for building expected ranges without repeating
 * the table's own numbers by hand at every call site below. */
function upTo(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

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
  it('reproduces the rulebook worked example exactly (galère vs. quintirème, printed row [1])', () => {
    // 0 bonus -> printed row unchanged. +1 -> upper bound 1+1=2. +2 -> upper bound 3.
    // This is the book's own example: "1", then "1 ou 2", then "1, 2 ou 3".
    expect(rammingSuccessRange('galeres', 'quintiremes', 0)).toEqual([1]);
    expect(rammingSuccessRange('galeres', 'quintiremes', 1)).toEqual([1, 2]);
    expect(rammingSuccessRange('galeres', 'quintiremes', 2)).toEqual([1, 2, 3]);
  });

  it('widens from 1, to 1-2, to 1-2-3 as bonus increases (galère vs. galère, printed row already [1,2,3])', () => {
    // Printed row's own upper bound is already 3 (N=3), so bonus extends it further:
    // 0 -> 1-2-3 (the printed row itself). +1 -> upper bound 4. +2 -> upper bound 5.
    expect(rammingSuccessRange('galeres', 'galeres', 0)).toEqual([1, 2, 3]);
    expect(rammingSuccessRange('galeres', 'galeres', 1)).toEqual([1, 2, 3, 4]);
    expect(rammingSuccessRange('galeres', 'galeres', 2)).toEqual([1, 2, 3, 4, 5]);
  });

  it('extends birème vs. galère (the user-reported matchup, printed row [1,2,3]) exactly as reported', () => {
    expect(rammingSuccessRange('biremes', 'galeres', 0)).toEqual([1, 2, 3]);
    expect(rammingSuccessRange('biremes', 'galeres', 1)).toEqual([1, 2, 3, 4]);
    expect(rammingSuccessRange('biremes', 'galeres', 2)).toEqual([1, 2, 3, 4, 5]);
  });

  it('extends beyond the printed row length, not just up to it, for a matchup with a 4-entry row', () => {
    // Printed row [1,2,3,4] (N=4); bonus extends the upper bound past 4.
    expect(rammingSuccessRange('triremes', 'galeres', 0)).toEqual([1, 2, 3, 4]);
    expect(rammingSuccessRange('triremes', 'galeres', 1)).toEqual([1, 2, 3, 4, 5]);
    expect(rammingSuccessRange('triremes', 'galeres', 2)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('caps the upper bound at 6 (a d6 has no higher face) once bonus would push past it', () => {
    // Printed row [1,2,3,4,5] (N=5) for quintirème vs. galère: even +1 bonus would
    // need upper bound 6 (every face succeeds - an automatic hit), and +2 has
    // nowhere further to go since a die only has 6 faces.
    expect(rammingSuccessRange('quintiremes', 'galeres', 0)).toEqual([1, 2, 3, 4, 5]);
    expect(rammingSuccessRange('quintiremes', 'galeres', 1)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rammingSuccessRange('quintiremes', 'galeres', 2)).toEqual([1, 2, 3, 4, 5, 6]);
    // Same shape for the other 5-entry row, quintirème vs. birème.
    expect(rammingSuccessRange('quintiremes', 'biremes', 0)).toEqual([1, 2, 3, 4, 5]);
    expect(rammingSuccessRange('quintiremes', 'biremes', 1)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rammingSuccessRange('quintiremes', 'biremes', 2)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never exceeds 6 entries (a d6\'s full face count) for any matchup at any bonus', () => {
    for (const [attacker, defender] of ALL_MATCHUPS) {
      for (const bonus of [0, 1, 2] as const) {
        expect(rammingSuccessRange(attacker, defender, bonus).length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('isRammingHitWithBonus matches rammingSuccessRange membership', () => {
    expect(isRammingHitWithBonus('galeres', 'galeres', 0, 1)).toBe(true);
    expect(isRammingHitWithBonus('galeres', 'galeres', 0, 4)).toBe(false);
    expect(isRammingHitWithBonus('galeres', 'galeres', 2, 5)).toBe(true);
    expect(isRammingHitWithBonus('galeres', 'galeres', 2, 6)).toBe(false);
  });
});

describe('fullRammingSuccessRange', () => {
  it('equals rammingSuccessRange at zero bonus for every matchup (the printed 0-bonus row, nothing more)', () => {
    for (const [attacker, defender] of ALL_MATCHUPS) {
      expect(fullRammingSuccessRange(attacker, defender)).toEqual(rammingSuccessRange(attacker, defender, 0));
    }
  });

  it('spot-checks a few printed rows directly', () => {
    expect(fullRammingSuccessRange('galeres', 'galeres')).toEqual([1, 2, 3]);
    expect(fullRammingSuccessRange('galeres', 'quintiremes')).toEqual([1]);
    expect(fullRammingSuccessRange('triremes', 'galeres')).toEqual([1, 2, 3, 4]);
    expect(fullRammingSuccessRange('quintiremes', 'galeres')).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns a fresh array each time, not a reference into the shared table', () => {
    const a = fullRammingSuccessRange('galeres', 'galeres') as number[];
    a.push(99);
    expect(fullRammingSuccessRange('galeres', 'galeres')).toEqual([1, 2, 3]);
  });
});

describe('rammingSuccessRange — exhaustive 16-matchup sweep', () => {
  it('has exactly 16 matchups to sweep (sanity check on the fixture itself)', () => {
    expect(ALL_MATCHUPS).toHaveLength(16);
  });

  it('always equals 1..min(6, printedRowUpperBound + bonus), for every matchup at every bonus level', () => {
    for (const [attacker, defender] of ALL_MATCHUPS) {
      const printedRow = fullRammingSuccessRange(attacker, defender);
      const printedUpperBound = printedRow[printedRow.length - 1]!;
      for (const bonus of [0, 1, 2] as const) {
        const expectedUpperBound = Math.min(6, printedUpperBound + bonus);
        expect(rammingSuccessRange(attacker, defender, bonus)).toEqual(upTo(expectedUpperBound));
      }
    }
  });

  it('every entry of the printed row is always still a subset of the range at any bonus (bonus only extends, never narrows)', () => {
    for (const [attacker, defender] of ALL_MATCHUPS) {
      const printedRow = fullRammingSuccessRange(attacker, defender);
      for (const bonus of [0, 1, 2] as const) {
        const range = rammingSuccessRange(attacker, defender, bonus);
        for (const face of printedRow) {
          expect(range).toContain(face);
        }
      }
    }
  });

  it('strictly widens (or stays the same, once the d6 ceiling is hit) as bonus increases, for every matchup', () => {
    for (const [attacker, defender] of ALL_MATCHUPS) {
      const at0 = rammingSuccessRange(attacker, defender, 0).length;
      const at1 = rammingSuccessRange(attacker, defender, 1).length;
      const at2 = rammingSuccessRange(attacker, defender, 2).length;
      expect(at1).toBeGreaterThanOrEqual(at0);
      expect(at2).toBeGreaterThanOrEqual(at1);
    }
  });

  it(`hits the d6 ceiling (6 entries, an automatic hit) at MAX_RAMMING_BONUS for every matchup whose printed row's upper bound is within ${MAX_RAMMING_BONUS} of 6`, () => {
    const ceilingMatchups = ALL_MATCHUPS.filter(([a, d]) => {
      const row = fullRammingSuccessRange(a, d);
      return row[row.length - 1]! + MAX_RAMMING_BONUS >= 6;
    });
    expect(ceilingMatchups.length).toBeGreaterThan(0); // fixture sanity: this bucket isn't empty
    expect(ceilingMatchups).toContainEqual(['quintiremes', 'galeres']);
    expect(ceilingMatchups).toContainEqual(['quintiremes', 'biremes']);
    for (const [attacker, defender] of ceilingMatchups) {
      expect(rammingSuccessRange(attacker, defender, MAX_RAMMING_BONUS)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});
