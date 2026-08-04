/**
 * Every die in the game is a d6. Centralized here so every roll — land
 * combat, ramming, boarding, an elephant's drift direction — shares one
 * implementation, and so the RNG can be injected for deterministic tests and
 * (eventually) a seeded self-play harness, following the same
 * `rng: () => number = Math.random` convention `turnManager.ts`'s
 * `shuffleSeatOrder` already establishes: callers own any side effects (e.g.
 * `BoardScene` clearing the undo history on a real roll — see its
 * `rollDie`), this function is just the pure die-face math.
 */
export function rollDie(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 6);
}
