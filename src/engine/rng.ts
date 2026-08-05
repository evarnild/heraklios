/**
 * A tiny, dependency-free seeded PRNG for deterministic replay — the seed
 * that gets handed to `engine/agent.ts`'s `RandomAgent` and to
 * `applyAction`'s own `rng` parameter for a fuzz-harness game (see
 * `engine/fuzzHarness.ts`). Sharing ONE `createSeededRng(seed)` stream
 * between both consumers (rather than, say, a fixed `Math.random` for
 * decisions and a separately-seeded stream for dice) is what makes a whole
 * game's outcome a pure function of `seed`: replaying the same seed replays
 * the exact same sequence of "which action did the agent pick" and "what did
 * the die say" calls, in the exact same order, so a failing seed is a
 * complete, portable repro.
 *
 * Linear congruential generator using the classic Numerical Recipes
 * constants (`a = 1664525`, `c = 1013904223`, `m = 2^32`) — suffices here:
 * this is a test/fuzz harness, not a cryptographic or scientific use, so a
 * simple, fast, easy-to-audit generator with a long-enough period for a few
 * thousand rolls per game is preferable to pulling in a dependency.
 */
export function createSeededRng(seed: number): () => number {
  const MULTIPLIER = 1664525;
  const INCREMENT = 1013904223;
  const MODULUS = 2 ** 32;
  // Seed the LCG from a HASHED state, not the raw seed — see
  // `scrambleSeed`'s doc comment for why a bare LCG needs this.
  let state = scrambleSeed(seed);
  return () => {
    state = (Math.imul(state, MULTIPLIER) + INCREMENT) >>> 0;
    return state / MODULUS;
  };
}

/**
 * A small integer avalanche hash (the public-domain "lowbias32", by Chris
 * Wellons) used to fold an arbitrary seed into a well-mixed 32-bit starting
 * state before the LCG above takes over.
 *
 * Needed because feeding a small seed directly into the LCG as its initial
 * state produces a near-EXACT LINEAR relationship between the seed and the
 * generator's first output whenever `seed * MULTIPLIER` doesn't overflow 32
 * bits — true for every seed size this harness actually uses (0..a few
 * thousand, see `engine/fuzzHarness.test.ts`'s `GAME_COUNT`). Concretely:
 * with an unhashed seed, `createSeededRng(0)` and `createSeededRng(1)`'s
 * FIRST draw differ by exactly `MULTIPLIER / MODULUS` (~0.00039) — nearby
 * seeds would produce nearly identical early games, which is close to the
 * opposite of what a seeded fuzz harness needs (a range of small integer
 * seeds that explore genuinely DIFFERENT games). Hashing first destroys that
 * linearity: this was caught by `randomAgent.test.ts`'s
 * "varies WHICH units it picks across seeds" test failing before this fix
 * was added (seeds 0..29 all produced the same exchange-sacrifice
 * selection), and fixed here rather than by, say, warming up the LCG with a
 * few discarded iterations (which only pushes the same correlation a few
 * calls later without eliminating its root cause: the seed itself never
 * gets mixed into more than a linear multiple of its input).
 */
function scrambleSeed(seed: number): number {
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return x >>> 0;
}
