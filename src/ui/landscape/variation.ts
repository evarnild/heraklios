/** A deterministic value in [0, 1) from integer coordinates and a salt: an
 * integer hash, so the landscape looks the same in every game and on every
 * load (it does not depend on the game seed). */
export function hexNoise(q: number, r: number, salt = 0): number {
  let h = Math.imul(q | 0, 0x27d4eb2d) ^ Math.imul(r | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
