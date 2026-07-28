import { describe, it, expect } from 'vitest';
import { validateArmy, emptySelection, defaultArmySelection, ARMY_BUDGET } from './army';

describe('validateArmy', () => {
  it('accepts an army that spends exactly the budget and stays within quantity caps', () => {
    const selection = emptySelection();
    selection['quintiremes'] = 1; // 50, cap is 1
    selection['triremes'] = 3; // 90, cap is 3
    selection['biremes'] = 5; // 100, cap is 5
    selection['galeres'] = 6; // 60, cap is 6
    selection['elephants'] = 10; // 100, cap is 10
    // total = 400, exactly the budget
    const result = validateArmy(selection);
    expect(result.valid).toBe(true);
    expect(result.totalCost).toBe(400);
    expect(result.remaining).toBe(0);
  });

  it('rejects exceeding a unit quantity cap', () => {
    const selection = emptySelection();
    selection['phalanges'] = 6; // cap is 5
    const result = validateArmy(selection);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/exceeds the maximum/);
  });

  it('rejects exceeding the total point budget', () => {
    const selection = emptySelection();
    selection['quintiremes'] = 1; // 50
    selection['triremes'] = 3; // 90
    selection['biremes'] = 5; // 100
    selection['galeres'] = 6; // 60
    selection['phalanges'] = 5; // 75
    selection['elephants'] = 3; // 30
    // total so far = 405, over budget
    const result = validateArmy(selection);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('budget'))).toBe(true);
  });

  it('rejects spending less than the full budget', () => {
    const selection = emptySelection();
    selection['phalanges'] = 5; // 75, well within caps but far short of 400
    const result = validateArmy(selection);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('budget'))).toBe(true);
  });

  it('rejects an empty selection, since 0 points is under budget', () => {
    const result = validateArmy(emptySelection());
    expect(result.valid).toBe(false);
    expect(result.totalCost).toBe(0);
  });
});

describe('defaultArmySelection', () => {
  it('spends exactly the full budget and stays within every quantity cap', () => {
    const result = validateArmy(defaultArmySelection());
    expect(result.valid).toBe(true);
    expect(result.totalCost).toBe(ARMY_BUDGET);
    expect(result.remaining).toBe(0);
  });
});
