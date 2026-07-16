/**
 * Boarding result: null means "not decisive" (both ships stay intact, the
 * pink cells in the printed table). Otherwise the side named loses the
 * given number of equipment points (each point = -5 attack / -5 defense;
 * a ship is destroyed and removed when its equipment points reach 0).
 */
export interface BoardingResult {
  side: 'attacker' | 'defender' | null;
  equipmentLoss: number;
}

// Force-ratio columns, attacker:defender, in table order. Note this is a
// distinct (narrower) column set from the land CRT.
export const BOARDING_RATIO_COLUMNS: readonly string[] = ['1-3', '1-2', '1-1', '2-1', '3-1', '4-1', '5-1'];

function r(side: 'attacker' | 'defender' | null, equipmentLoss = 0): BoardingResult {
  return { side, equipmentLoss };
}

// Rows indexed by die roll 1-6 (row 0 = die 1). Transcribed from the
// "Table des résultats pour l'abordage" (regles2.jpg, p.35).
const BOARDING_TABLE: readonly BoardingResult[][] = [
  [r('defender', 1), r('defender', 1), r('defender', 2), r('defender', 2), r('defender', 3), r('defender', 3), r('defender', 4)], // die 1
  [r(null), r('defender', 1), r('defender', 1), r('defender', 2), r('defender', 2), r('defender', 2), r('defender', 3)], // die 2
  [r(null), r(null), r('defender', 1), r('defender', 1), r('defender', 1), r('defender', 2), r('defender', 3)], // die 3
  [r('attacker', 1), r(null), r(null), r(null), r('defender', 1), r('defender', 1), r('defender', 2)], // die 4
  [r('attacker', 2), r('attacker', 1), r('attacker', 1), r('attacker', 1), r('attacker', 1), r('defender', 1), r('defender', 2)], // die 5
  [r('attacker', 2), r('attacker', 2), r('attacker', 2), r('attacker', 2), r('attacker', 1), r('attacker', 1), r('defender', 1)], // die 6
];

/** Same rounding rule as the land CRT: ratio rounds in the defender's favor. */
export function boardingRatioToColumnIndex(attackForce: number, defenseForce: number): number {
  if (defenseForce <= 0) return BOARDING_RATIO_COLUMNS.length - 1;
  if (attackForce <= 0) return 0;

  const ratio = attackForce / defenseForce;
  const columnRatios = [1 / 3, 1 / 2, 1, 2, 3, 4, 5];

  let index = 0;
  for (let i = 0; i < columnRatios.length; i++) {
    if (columnRatios[i]! <= ratio) index = i;
    else break;
  }
  return index;
}

export function resolveBoarding(attackForce: number, defenseForce: number, dieRoll: number): BoardingResult {
  const clampedDie = Math.min(6, Math.max(1, dieRoll));
  const columnIndex = boardingRatioToColumnIndex(attackForce, defenseForce);
  const row = BOARDING_TABLE[clampedDie - 1]!;
  return row[columnIndex]!;
}
