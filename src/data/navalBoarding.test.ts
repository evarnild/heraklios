import { describe, it, expect } from 'vitest';
import { resolveBoarding } from './navalBoarding';

describe('resolveBoarding', () => {
  it('matches the transcribed boarding table', () => {
    expect(resolveBoarding(1, 3, 1)).toEqual({ side: 'defender', equipmentLoss: 1 }); // 1:3, die 1
    expect(resolveBoarding(1, 3, 4)).toEqual({ side: 'attacker', equipmentLoss: 1 }); // 1:3, die 4
    expect(resolveBoarding(1, 3, 2)).toEqual({ side: null, equipmentLoss: 0 }); // 1:3, die 2 (not decisive)
    expect(resolveBoarding(5, 1, 6)).toEqual({ side: 'defender', equipmentLoss: 1 }); // 5:1, die 6
    expect(resolveBoarding(5, 1, 1)).toEqual({ side: 'defender', equipmentLoss: 4 }); // 5:1, die 1
  });
});
