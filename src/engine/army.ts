import { UNIT_TYPES, getUnitType } from '../data/units';

export const ARMY_BUDGET = 400;

export interface ArmySelection {
  [unitTypeId: string]: number;
}

/** Why an army can't be confirmed, as data — the presentation writes the
 * sentence in the player's language (`ui/i18n/format.ts`'s `formatArmyError`). */
export type ArmyError =
  | { kind: 'overMax'; typeId: string; count: number; max: number }
  | { kind: 'overBudget'; total: number; budget: number }
  | { kind: 'underBudget'; total: number; budget: number };

export interface ArmyValidation {
  valid: boolean;
  totalCost: number;
  remaining: number;
  errors: ArmyError[];
}

export function validateArmy(selection: ArmySelection): ArmyValidation {
  const errors: ArmyError[] = [];
  let totalCost = 0;

  for (const [typeId, count] of Object.entries(selection)) {
    if (count <= 0) continue;
    const type = getUnitType(typeId);
    if (count > type.maxCount) {
      errors.push({ kind: 'overMax', typeId, count, max: type.maxCount });
    }
    totalCost += type.cost * count;
  }

  if (totalCost > ARMY_BUDGET) {
    errors.push({ kind: 'overBudget', total: totalCost, budget: ARMY_BUDGET });
  } else if (totalCost < ARMY_BUDGET) {
    // "Once a player's army... totals exactly 400 purchase points, it's time
    // to place it on the map" (docs/research/02-rules-transcription.md) — an
    // army isn't ready to confirm until every point is spent, not just under
    // budget.
    errors.push({ kind: 'underBudget', total: totalCost, budget: ARMY_BUDGET });
  }

  return {
    valid: errors.length === 0,
    totalCost,
    remaining: ARMY_BUDGET - totalCost,
    errors,
  };
}

export function emptySelection(): ArmySelection {
  const selection: ArmySelection = {};
  for (const t of UNIT_TYPES) selection[t.id] = 0;
  return selection;
}

/**
 * A ready-made 400-point army spanning every unit category, offered as a
 * one-click starting point on the army-builder screen so a player doesn't
 * have to hand-tally the budget themselves. Nothing about it is special
 * once selected — it's just a starting `ArmySelection` the player can then
 * adjust with the usual +/- controls.
 */
export function defaultArmySelection(): ArmySelection {
  const selection = emptySelection();
  selection['archers'] = 10;
  selection['fantassins-archers'] = 5;
  selection['fantassins-lourds'] = 4;
  selection['phalanges'] = 3;
  selection['cavalerie-legere'] = 5;
  selection['cavalerie-lourde'] = 5;
  selection['elephants'] = 3;
  selection['chars-lourds'] = 8;
  selection['galeres'] = 1;
  selection['biremes'] = 1;
  return selection;
}
