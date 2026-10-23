import { describe, it, expect } from 'vitest';
import { validateArmy, emptySelection, defaultArmySelection, filledCount, ARMY_BUDGET } from './army';

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
    expect(result.errors[0]).toEqual({ kind: 'overMax', typeId: 'phalanges', count: 6, max: 5 });
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
    expect(result.errors).toEqual([{ kind: 'overBudget', total: 405, budget: ARMY_BUDGET }]);
  });

  it('rejects spending less than the full budget', () => {
    const selection = emptySelection();
    selection['phalanges'] = 5; // 75, well within caps but far short of 400
    const result = validateArmy(selection);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([{ kind: 'underBudget', total: 75, budget: ARMY_BUDGET }]);
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

describe('filledCount', () => {
  it('fills archers from an empty selection up to their cap of 10', () => {
    expect(filledCount(emptySelection(), 'archers')).toBe(10);
  });

  it('adds what the remaining points allow: 390 spent gives archers +2, quintiremes +0', () => {
    const selection = emptySelection();
    selection['elephants'] = 10; // 100
    selection['triremes'] = 3; // 90
    selection['biremes'] = 5; // 100
    selection['phalanges'] = 5; // 75
    selection['galeres'] = 2; // 20
    selection['fantassins'] = 1; // 5
    expect(validateArmy(selection).totalCost).toBe(390);
    expect(filledCount(selection, 'archers')).toBe(2);
    expect(filledCount(selection, 'quintiremes')).toBe(0);
  });

  it('keeps the count when exactly 400 is spent', () => {
    const selection = defaultArmySelection();
    expect(validateArmy(selection).remaining).toBe(0);
    expect(filledCount(selection, 'archers')).toBe(10);
    expect(filledCount(selection, 'phalanges')).toBe(3);
  });

  it('never lowers a count when over 400', () => {
    const selection = emptySelection();
    selection['elephants'] = 10; // 100
    selection['triremes'] = 3; // 90
    selection['biremes'] = 5; // 100
    selection['phalanges'] = 5; // 75
    selection['galeres'] = 6; // 60
    selection['quintiremes'] = 1; // 50 -> 475
    expect(filledCount(selection, 'galeres')).toBe(6);
    expect(filledCount(selection, 'archers')).toBe(0);
  });

  it('keeps a type at its maximum', () => {
    const selection = emptySelection();
    selection['quintiremes'] = 1;
    expect(filledCount(selection, 'quintiremes')).toBe(1);
  });

  it('does not mutate the selection', () => {
    const selection = emptySelection();
    selection['elephants'] = 4;
    const copy = { ...selection };
    filledCount(selection, 'archers');
    expect(selection).toEqual(copy);
  });
});
