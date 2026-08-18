export type ShipTypeId = 'galeres' | 'biremes' | 'triremes' | 'quintiremes';

const SHIP_ORDER: readonly ShipTypeId[] = ['galeres', 'biremes', 'triremes', 'quintiremes'];

/** The ramming bonus's hard cap — "quelque soit le nombre de points de
 * déplacement non utilisé supérieur à 2, on n'accordera jamais plus de 2
 * points de bonification" (p.34). Applied in
 * `rammingBonusFromUnusedMovement`, which is the only place a bonus is
 * derived; everything downstream takes an already-capped `0 | 1 | 2`.
 *
 * NOT the same thing as `HIGHEST_DIE_FACE` below, though a previous
 * (incorrect) reading of the rules conflated them: this caps how much bonus
 * a ship can earn, while that caps how far the earned bonus can push the
 * success range. See `rammingSuccessRange`. */
export const MAX_RAMMING_BONUS = 2;

/** Every die in this game is a d6 (`engine/dice.ts`), so 6 is the highest
 * roll a ramming attempt can produce — and therefore the ceiling on the
 * success range's upper bound, past which extra bonus buys nothing. Named
 * because it carries real meaning at both use sites (`rammingSuccessRange`'s
 * cap, and `BoardScene`'s "this ram cannot miss" log line) rather than being
 * an incidental 6. */
export const HIGHEST_DIE_FACE = 6;

// Die values (1-6) on which a ramming attempt SUCCEEDS, keyed by
// [attacker ship type][defender ship type]. Transcribed from the
// "Table des résultats pour l'éperonnage" (regles2.jpg, p.34).
const RAMMING_SUCCESS_DICE: Readonly<Record<ShipTypeId, Readonly<Record<ShipTypeId, readonly number[]>>>> = {
  galeres: {
    galeres: [1, 2, 3],
    biremes: [1, 2],
    triremes: [1, 2],
    quintiremes: [1],
  },
  biremes: {
    galeres: [1, 2, 3],
    biremes: [1, 2, 3],
    triremes: [1, 2],
    quintiremes: [1],
  },
  triremes: {
    galeres: [1, 2, 3, 4],
    biremes: [1, 2, 3],
    triremes: [1, 2, 3],
    quintiremes: [1, 2],
  },
  quintiremes: {
    galeres: [1, 2, 3, 4, 5],
    biremes: [1, 2, 3, 4, 5],
    triremes: [1, 2, 3],
    quintiremes: [1, 2, 3],
  },
};

/**
 * "Unused movement points at the moment of contact" bonus (see the rulebook's
 * worked example, p.34-35): a galley that reaches an enemy ship with movement
 * still unspent gets 1 bonus point per unused point, capped at 2; reaching
 * contact on its very last point of movement gets none.
 */
export function rammingBonusFromUnusedMovement(unusedPoints: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(MAX_RAMMING_BONUS, Math.floor(unusedPoints))) as 0 | 1 | 2;
}

/**
 * CORRECTED interpretation — see plan.md §18 for the full history of how
 * this was found, including two earlier (wrong) responses in the same
 * session that pushed back on the bug report. The rulebook's text (p.34,
 * `docs/research/05-rules-french-original.md:375-386`,
 * `docs/research/03-tables-reference.md:60-69`) is explicit and general, not
 * scoped to its own galère-vs-quintirème worked example:
 *
 * > Cette valeur augmente d'une unité pour la borne supérieure du jet de dé
 * > à réaliser pour que l'éperonnage soit réussi.
 *
 * i.e. each bonus point raises the upper bound of a successful die roll by
 * ONE, ON TOP OF whatever the printed table already gives at zero bonus —
 * the bonus EXTENDS the printed row; it does not select a narrower prefix
 * of it. It's the bonus itself that's capped, at +2 ("jamais plus de 2
 * points de bonification" — see `MAX_RAMMING_BONUS`), and nothing in the
 * text caps the resulting die-range at the printed row's own width.
 *
 * A PREVIOUS (buggy) version of this function had that backwards: it sliced
 * the printed row down to its first `1 + bonus` entries, treating the
 * table as the success range at *maximum* bonus rather than at zero. That
 * silently disagreed with the book's own worked example for every matchup
 * whose row wasn't exactly 3 entries wide (galère vs. quintirème, the exact
 * pairing the worked example uses, has a 1-entry row — the old code
 * "matched" the example there purely because a 1-entry row can't be sliced
 * any narrower, not because the formula was right).
 *
 * Every printed row happens to be the consecutive run `1..N` for some N
 * (confirmed for all 16 matchups in `navalRamming.test.ts`), so "extend the
 * upper bound by `bonus`" reduces to `N + bonus` — EXCEPT a d6 only has 6
 * faces, so the extended upper bound is capped at `HIGHEST_DIE_FACE`. That
 * ceiling is a case the rulebook's text never has to confront (its own
 * example starts from N=1), but this table's widest rows do: quintirème vs.
 * birème/galère are `[1,2,3,4,5]` (N=5), so ANY bonus there hits the
 * ceiling — +1 is already an automatic hit (upper bound 6 = every face
 * succeeds), and +2 has nowhere further to go. See `commitRam` in
 * `BoardScene.ts` for where the UI calls this out to the player.
 *
 * THIS IS THE ONLY WAY TO ASK WHETHER A RAM HITS. A bonus-free
 * `isRammingSuccessful(attacker, defender, dieRoll)` used to sit above this
 * function as a bare `RAMMING_SUCCESS_DICE[...].includes(dieRoll)` lookup,
 * with a matching `isRammingHit` wrapper in `engine/combat.ts`. Both were
 * removed: they answered "did this ram hit" while ignoring the bonus, which
 * is exactly the mistake this whole function exists to get right, and
 * neither had a single production caller left (the real resolution path is
 * `actions.ts`'s `'ram'` case → `isRammingHitWithBonus`, and the AI's odds
 * are `combatOdds.ts`'s `rammingHitChance` → the same). `bonus: 0` is the
 * printed row, so nothing was lost.
 */
export function rammingSuccessRange(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
  bonus: 0 | 1 | 2,
): readonly number[] {
  const fullRange = RAMMING_SUCCESS_DICE[attackerType][defenderType];
  // Every printed row is non-empty and ascending (verified for all 16
  // matchups in navalRamming.test.ts), so its last entry is always defined.
  const baseUpperBound = fullRange[fullRange.length - 1]!;
  const upperBound = Math.min(HIGHEST_DIE_FACE, baseUpperBound + bonus);
  const range: number[] = [];
  for (let face = 1; face <= upperBound; face++) {
    range.push(face);
  }
  return range;
}

export function isRammingHitWithBonus(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
  bonus: 0 | 1 | 2,
  dieRoll: number,
): boolean {
  return rammingSuccessRange(attackerType, defenderType, bonus).includes(dieRoll);
}

/**
 * The complete printed 0-bonus table row for this matchup — every entry in
 * `RAMMING_SUCCESS_DICE`, i.e. `rammingSuccessRange(attackerType,
 * defenderType, 0)`. Under the corrected rule (see `rammingSuccessRange`'s
 * doc comment) this is no longer "a distinct, wider-than-reachable concept"
 * — every entry beyond it just needs enough bonus (up to the d6 ceiling) to
 * reach, so this function is purely "the baseline before any bonus is
 * applied," exposed so the UI can show that baseline next to the effective
 * range a player actually rolls against.
 *
 * (`maxReachableRammingEntries`/`wholeRowReachableAtMaxBonus`, two helpers
 * that used to live here, were built entirely on the OLD, incorrect
 * premise that some printed entries were permanently unreachable by any
 * bonus. Under the corrected rule every entry is reachable given enough
 * bonus — the only real ceiling is a d6's 6 faces, which
 * `rammingSuccessRange` itself already accounts for — so both helpers were
 * dead weight and were removed rather than reworked.)
 */
export function fullRammingSuccessRange(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
): readonly number[] {
  // Copy, not a reference into `RAMMING_SUCCESS_DICE` itself: `readonly` on
  // the table's type is compile-time only, and `rammingSuccessRange` above
  // already returns a fresh array — this should behave the same for a
  // caller that might (say) sort or mutate what it gets back.
  return [...RAMMING_SUCCESS_DICE[attackerType][defenderType]];
}

export { SHIP_ORDER };
