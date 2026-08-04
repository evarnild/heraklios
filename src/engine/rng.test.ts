import { describe, it, expect } from 'vitest';
import { createSeededRng } from './rng';

describe('createSeededRng', () => {
  it('is deterministic: the same seed produces the exact same sequence', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('always returns a value in [0, 1)', () => {
    const rng = createSeededRng(999);
    for (let i = 0; i < 5000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('folds negative/out-of-range seeds into a valid uint32 without throwing', () => {
    expect(() => createSeededRng(-1)()).not.toThrow();
    expect(() => createSeededRng(3.7)()).not.toThrow();
    expect(() => createSeededRng(Number.MAX_SAFE_INTEGER)()).not.toThrow();
  });

  // Regression for a real defect this harness's own tests caught: seeding
  // the LCG directly from a small raw seed makes its FIRST output an
  // almost-exact linear function of the seed (see `scrambleSeed`'s doc
  // comment in rng.ts), so nearby small seeds — exactly what a fuzz harness
  // iterates over (0, 1, 2, ...) — produced near-identical early draws.
  it('nearby small seeds do not produce near-identical first draws', () => {
    const firstDraws = Array.from({ length: 50 }, (_, seed) => createSeededRng(seed)());
    for (let i = 1; i < firstDraws.length; i++) {
      // An unscrambled LCG's consecutive-seed gap here is ~0.0000388 x i,
      // e.g. seed 49 vs 48 differ by ~0.0000388. Anything at least two
      // orders of magnitude looser than that confirms the hash is doing its
      // job rather than merely being a fluke of one seed pair.
      expect(Math.abs(firstDraws[i]! - firstDraws[i - 1]!)).toBeGreaterThan(0.001);
    }
  });
});
