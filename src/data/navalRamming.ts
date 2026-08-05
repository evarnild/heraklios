export type ShipTypeId = 'galeres' | 'biremes' | 'triremes' | 'quintiremes';

const SHIP_ORDER: readonly ShipTypeId[] = ['galeres', 'biremes', 'triremes', 'quintiremes'];

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
  return Math.max(0, Math.min(2, Math.floor(unusedPoints))) as 0 | 1 | 2;
}

/**
 * The rulebook's worked example gives the success range as a function of
 * bonus alone — 0 bonus succeeds only on a 1, 1 bonus on 1-2, 2 bonus on
 * 1-2-3 — layered on top of the printed per-matchup table. Read literally
 * these two would conflict for the wider rows (e.g. quintirème vs. galère
 * lists 5 entries, unreachable if bonus tops out at 2): the interpretation
 * used here treats the printed table as the success range at *maximum*
 * bonus, and a lower bonus simply exposes fewer of its entries, counting up
 * from the die value of 1 — reproducing the worked example exactly for
 * every matchup whose table has 3 or fewer entries, and for wider rows
 * capping the benefit of movement alone at "1, 2, or 3" (see README's
 * "Known simplifications" for this discrepancy in the source material).
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
  return RAMMING_SUCCESS_DICE[attackerType][defenderType];
}

export { SHIP_ORDER };
