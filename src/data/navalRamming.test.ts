import { describe, it, expect } from 'vitest';
import { isRammingSuccessful } from './navalRamming';

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
