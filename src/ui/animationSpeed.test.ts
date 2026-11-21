import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANIMATION_SPEED_STORAGE_KEY,
  animationSpeed,
  durationsFor,
  nextAnimationSpeed,
  resetAnimationSpeedForTests,
  resolveAnimationSpeed,
  setAnimationSpeed,
} from './animationSpeed';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('resolveAnimationSpeed (AC5)', () => {
  it('takes exactly slow and off', () => {
    expect(resolveAnimationSpeed('slow')).toBe('slow');
    expect(resolveAnimationSpeed('off')).toBe('off');
    expect(resolveAnimationSpeed('normal')).toBe('normal');
  });
  it('maps everything else to normal', () => {
    for (const v of [null, undefined, '', 'Slow', 'OFF', 'fast', '1']) expect(resolveAnimationSpeed(v)).toBe('normal');
  });
});

describe('nextAnimationSpeed', () => {
  it('cycles Normal, Slow, Off, Normal', () => {
    expect(nextAnimationSpeed('normal')).toBe('slow');
    expect(nextAnimationSpeed('slow')).toBe('off');
    expect(nextAnimationSpeed('off')).toBe('normal');
  });
});

describe('durationsFor (B15)', () => {
  it('Normal is the spec table', () => {
    expect(durationsFor('normal')).toEqual({ hex: 180, turn: 120, clash: 350, ram: 400, fade: 300, shake: 200 });
  });
  it('Slow is exactly twice Normal and Off is none', () => {
    const n = durationsFor('normal')!;
    const s = durationsFor('slow')!;
    for (const k of Object.keys(n) as Array<keyof typeof n>) expect(s[k]).toBe(n[k] * 2);
    expect(durationsFor('off')).toBeNull();
  });
});

describe('the animation speed store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAnimationSpeedForTests();
  });

  it('reads the stored choice, normal by default', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [ANIMATION_SPEED_STORAGE_KEY]: 'slow' }));
    expect(animationSpeed()).toBe('slow');
    resetAnimationSpeedForTests();
    vi.stubGlobal('localStorage', fakeStorage());
    expect(animationSpeed()).toBe('normal');
  });

  it('persists a choice under heraklios.animationSpeed and round-trips', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    setAnimationSpeed('off');
    expect(ANIMATION_SPEED_STORAGE_KEY).toBe('heraklios.animationSpeed');
    expect(storage.data['heraklios.animationSpeed']).toBe('off');
    resetAnimationSpeedForTests();
    expect(animationSpeed()).toBe('off');
  });

  it('keeps a write in memory when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(animationSpeed()).toBe('normal');
    setAnimationSpeed('slow');
    expect(animationSpeed()).toBe('slow');
  });
});
