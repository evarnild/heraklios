export type CombatResult =
  | 'AE' // Attaquant Éliminé — attacking units removed from the game
  | 'AR' // Attaquant Recule — attacking units retreat one hex
  | 'DE' // Défense Éliminée — defending units removed from the game
  | 'DR' // Défense Recule — defending units retreat one hex
  | 'EX'; // Échange — attacked units removed; attacking units removed too if
  //          their total force is not at least equal to the defenders'.

// Force-ratio columns, attacker:defender, in table order.
export const RATIO_COLUMNS: readonly string[] = [
  '1-5',
  '1-4',
  '1-3',
  '1-2',
  '1-1',
  '2-1',
  '3-1',
  '4-1',
  '5-1',
  '6-1',
];

// Rows indexed by die roll 1-6 (row 0 = die 1). Verified against two
// independent crops of the printed "Table des résultats" (regles1.jpg / p.33).
const LAND_CRT: readonly CombatResult[][] = [
  ['AR', 'AR', 'DR', 'DR', 'DR', 'DR', 'DR', 'DE', 'DE', 'DE'], // die 1
  ['AE', 'AR', 'AR', 'DR', 'DR', 'DR', 'DR', 'DR', 'DE', 'DE'], // die 2
  ['AE', 'AE', 'AR', 'AR', 'DR', 'DR', 'DR', 'DR', 'DE', 'DE'], // die 3
  ['AE', 'AE', 'AR', 'AR', 'AR', 'DR', 'DR', 'DR', 'DR', 'DE'], // die 4
  ['AE', 'AE', 'AE', 'AR', 'AR', 'AR', 'DR', 'DR', 'DR', 'EX'], // die 5
  ['AE', 'AE', 'AE', 'AR', 'AR', 'AR', 'AR', 'EX', 'EX', 'EX'], // die 6
];

/**
 * Converts an attacker:defender force ratio to a CRT column index, rounding
 * in the DEFENDER's favor when the exact ratio isn't a listed column, and
 * clamping to the table's [1:5, 6:1] range.
 */
export function ratioToColumnIndex(attackForce: number, defenseForce: number): number {
  if (defenseForce <= 0) return RATIO_COLUMNS.length - 1; // no defenders' worth of force: treat as max
  if (attackForce <= 0) return 0;

  const ratio = attackForce / defenseForce;
  const columnRatios = [1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6];

  // Find the largest column ratio that does not exceed the actual ratio.
  // That rounds in favor of the defender (a worse column for the attacker).
  let index = 0;
  for (let i = 0; i < columnRatios.length; i++) {
    if (columnRatios[i]! <= ratio) index = i;
    else break;
  }
  return index;
}

/**
 * Looks up the combat result. `dieRoll` should already include any terrain
 * modifier added, clamped by the caller to [1, 6].
 */
export function resolveLandCombat(
  attackForce: number,
  defenseForce: number,
  dieRoll: number,
): CombatResult {
  const clampedDie = Math.min(6, Math.max(1, dieRoll));
  const columnIndex = ratioToColumnIndex(attackForce, defenseForce);
  const row = LAND_CRT[clampedDie - 1]!;
  return row[columnIndex]!;
}
