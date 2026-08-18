export type ShipTypeId = 'galeres' | 'biremes' | 'triremes' | 'quintiremes';

const SHIP_ORDER: readonly ShipTypeId[] = ['galeres', 'biremes', 'triremes', 'quintiremes'];

/** The ramming bonus's hard cap (see `rammingBonusFromUnusedMovement`) —
 * pulled out as a named constant so every place that needs "the widest
 * range any bonus can ever expose" (`rammingSuccessRange`'s own cap, and
 * `BoardScene`'s log formatting) computes it the same way instead of each
 * re-hardcoding the literal `2`. */
export const MAX_RAMMING_BONUS = 2;

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

export function isRammingSuccessful(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
  dieRoll: number,
): boolean {
  return RAMMING_SUCCESS_DICE[attackerType][defenderType].includes(dieRoll);
}

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
 * faces, so the extended upper bound is capped at 6. That ceiling is a case
 * the rulebook's text never has to confront (its own example starts from
 * N=1), but this table's widest rows do: quintirème vs. birème/galère are
 * `[1,2,3,4,5]` (N=5), so ANY bonus there hits the ceiling — +1 is already
 * an automatic hit (upper bound 6 = every face succeeds), and +2 has
 * nowhere further to go. See `commitRam` in `BoardScene.ts` for where the
 * UI calls this out to the player.
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
  const upperBound = Math.min(6, baseUpperBound + bonus);
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
