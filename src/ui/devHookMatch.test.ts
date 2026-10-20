import { describe, expect, it } from 'vitest';
import { matchingButtons, pickButton, type ButtonCandidate } from './devHookMatch';

const panel: ButtonCandidate[] = [
  { label: 'Load', x: 300, y: 140 },
  { label: 'Save', x: 200, y: 140 },
  { label: 'Save', x: 200, y: 100 },
  { label: 'Load', x: 300, y: 100 },
  { label: 'Resolve attack', x: 100, y: 64 },
];

describe('matchingButtons', () => {
  it('keeps exact label matches only, in reading order', () => {
    expect(matchingButtons(panel, 'Save')).toEqual([
      { label: 'Save', x: 200, y: 100 },
      { label: 'Save', x: 200, y: 140 },
    ]);
    expect(matchingButtons(panel, 'Sav')).toEqual([]);
  });

  it('orders left-to-right within a row', () => {
    const row = [
      { label: 'Turn', x: 160, y: 96 },
      { label: 'Turn', x: 76, y: 96 },
    ];
    expect(matchingButtons(row, 'Turn').map((b) => b.x)).toEqual([76, 160]);
  });
});

describe('pickButton', () => {
  it('returns the single match without an index', () => {
    expect(pickButton(panel, 'Resolve attack')).toEqual({ x: 100, y: 64 });
  });

  it('refuses a duplicate label without an index instead of taking the first', () => {
    expect(() => pickButton(panel, 'Save')).toThrow(/exactly one button "Save", found 2/);
  });

  it('refuses a label that is not on screen', () => {
    expect(() => pickButton(panel, 'Delete')).toThrow(/found 0/);
  });

  it('picks the n-th match in reading order', () => {
    expect(pickButton(panel, 'Save', 0)).toEqual({ x: 200, y: 100 });
    expect(pickButton(panel, 'Save', 1)).toEqual({ x: 200, y: 140 });
  });

  it('refuses an index out of range, negative or fractional', () => {
    expect(() => pickButton(panel, 'Save', 2)).toThrow(/index 2; 2 match/);
    expect(() => pickButton(panel, 'Save', -1)).toThrow(/index -1/);
    expect(() => pickButton(panel, 'Save', 0.5)).toThrow(/index 0.5/);
  });
});
