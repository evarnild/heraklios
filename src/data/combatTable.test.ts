import { describe, it, expect } from 'vitest';
import { ratioToColumnIndex, resolveLandCombat, RATIO_COLUMNS } from './combatTable';

describe('ratioToColumnIndex', () => {
  it('rounds the rulebook worked example (5 attack vs 3 defense) to 1:1', () => {
    // The rulebook's own example: attacker force 5, defender force 3 -> ratio
    // 5/3, rounds in the defender's favor down to the 1:1 column.
    const index = ratioToColumnIndex(5, 3);
    expect(RATIO_COLUMNS[index]).toBe('1-1');
  });

  it('matches an exact column ratio precisely', () => {
    expect(RATIO_COLUMNS[ratioToColumnIndex(6, 1)]).toBe('6-1');
    expect(RATIO_COLUMNS[ratioToColumnIndex(1, 5)]).toBe('1-5');
    expect(RATIO_COLUMNS[ratioToColumnIndex(3, 1)]).toBe('3-1');
  });

  it('clamps ratios beyond the table range to the nearest end column', () => {
    expect(RATIO_COLUMNS[ratioToColumnIndex(20, 1)]).toBe('6-1');
    expect(RATIO_COLUMNS[ratioToColumnIndex(1, 20)]).toBe('1-5');
  });
});

describe('resolveLandCombat', () => {
  it('matches known cells of the transcribed CRT', () => {
    expect(resolveLandCombat(1, 1, 1)).toBe('DR'); // 1:1, die 1
    expect(resolveLandCombat(6, 1, 6)).toBe('EX'); // 6:1, die 6
    expect(resolveLandCombat(1, 5, 1)).toBe('AR'); // 1:5, die 1
    expect(resolveLandCombat(1, 5, 2)).toBe('AE'); // 1:5, die 2
  });

  it('clamps a die roll pushed above 6 by terrain modifiers', () => {
    // die 4 + terrain modifier of 3 = 7, should clamp to row 6.
    expect(resolveLandCombat(1, 1, 7)).toBe(resolveLandCombat(1, 1, 6));
  });
});
