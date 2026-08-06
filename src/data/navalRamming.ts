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
 * The rulebook's worked example gives the success range as a function of
 * bonus alone — 0 bonus succeeds only on a 1, 1 bonus on 1-2, 2 bonus on
 * 1-2-3 — layered on top of the printed per-matchup table. Read literally
 * these two would conflict for the wider rows (e.g. quintirème vs. galère
 * lists 5 entries, unreachable if bonus tops out at 2): the interpretation
 * used here treats the printed table as the success range at *maximum*
 * bonus, and a lower bonus simply exposes fewer of its entries, counting up
 * from the die value of 1.
 *
 * This reproduces the worked example's exact numbers ("1, then 1-2, then
 * 1-2-3") ONLY for the matchups whose printed row has EXACTLY 3 entries
 * (galère vs. galère, birème vs. galère, birème vs. birème, trirème vs.
 * birème, trirème vs. trirème, quintirème vs. trirème, quintirème vs.
 * quintirème — see `navalRamming.test.ts`'s full 16-matchup sweep). It does
 * NOT for the other two shapes:
 * - Rows narrower than 3 entries cap out below "1, 2, or 3" even at max
 *   bonus — including galère vs. quintirème, the EXACT matchup the
 *   rulebook's own worked example uses (`docs/research/05-rules-french-original.md`),
 *   whose printed row is just `[1]`: this edition succeeds only on a 1 at
 *   every bonus level for that pairing, not the book's "1, 2, or 3".
 * - Wider rows (4+ entries) cap the benefit of movement alone AT "1, 2, or
 *   3" instead of their full printed width.
 *
 * See README's "Naval movement and combat" section for this discrepancy in
 * the source material, and `wholeRowReachableAtMaxBonus` below for the
 * tested predicate the UI uses to pick which case applies.
 */
export function rammingSuccessRange(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
  bonus: 0 | 1 | 2,
): readonly number[] {
  const fullRange = RAMMING_SUCCESS_DICE[attackerType][defenderType];
  return fullRange.slice(0, Math.min(fullRange.length, 1 + bonus));
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
 * The complete printed table row for this matchup — every entry in
 * `RAMMING_SUCCESS_DICE`, regardless of what any actual bonus level (capped
 * at 2) can expose. For rows with 4+ entries this is WIDER than
 * `rammingSuccessRange(attackerType, defenderType, 2)` ever returns (see
 * that function's doc comment on the bonus-vs-table conflict this
 * codebase's interpretation papers over). Exposed so the UI can show the
 * effective range a player actually rolls against right next to the full
 * table, making that gap visible in play rather than only in this comment.
 */
export function fullRammingSuccessRange(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
): readonly number[] {
  // Copy, not a reference into `RAMMING_SUCCESS_DICE` itself: `readonly` on
  // the table's type is compile-time only, and `rammingSuccessRange` below
  // already returns a fresh array via `.slice` — this should behave the
  // same for a caller that might (say) sort or mutate what it gets back.
  return [...RAMMING_SUCCESS_DICE[attackerType][defenderType]];
}

/**
 * How many of `fullRammingSuccessRange`'s entries are actually reachable by
 * ANY bonus (i.e. at `MAX_RAMMING_BONUS`) — `rammingSuccessRange(...,
 * MAX_RAMMING_BONUS).length`, exposed directly so a caller doesn't need to
 * compute a whole array just to compare lengths. For matchups whose row has
 * `MAX_RAMMING_BONUS + 1` or fewer entries this equals the row's full
 * length (every entry is reachable at max bonus); for wider rows (see
 * `rammingSuccessRange`'s doc comment) it's smaller — the gap is
 * `fullRammingSuccessRange(...).length - maxReachableRammingEntries(...)`.
 */
export function maxReachableRammingEntries(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
): number {
  return rammingSuccessRange(attackerType, defenderType, MAX_RAMMING_BONUS).length;
}

/**
 * Whether this matchup's ENTIRE printed row (`fullRammingSuccessRange`) is
 * reachable by SOME bonus level — equivalently, whether the row has
 * `MAX_RAMMING_BONUS + 1` (i.e. 3) or fewer entries. This is the exact
 * comparison (`fullRange.length <= maxReachableRammingEntries(...)`) that
 * used to live inline in `BoardScene`'s ramming log, choosing between "the
 * whole table is reachable at max bonus" and "some entries never are" —
 * the one piece of sentence-selection logic that shipped with a false
 * "full table... at max bonus" claim for every wider row before this
 * predicate existed as its own tested function (see
 * `navalRamming.test.ts`'s full 16-matchup sweep). `BoardScene` should only
 * ever pick a log sentence off THIS function's result, never re-derive the
 * comparison itself.
 */
export function wholeRowReachableAtMaxBonus(
  attackerType: ShipTypeId,
  defenderType: ShipTypeId,
): boolean {
  return (
    fullRammingSuccessRange(attackerType, defenderType).length <=
    maxReachableRammingEntries(attackerType, defenderType)
  );
}

export { SHIP_ORDER };
