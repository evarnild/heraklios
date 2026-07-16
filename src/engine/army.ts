import { UNIT_TYPES, getUnitType } from '../data/units';

export const ARMY_BUDGET = 400;

export interface ArmySelection {
  [unitTypeId: string]: number;
}

export interface ArmyValidation {
  valid: boolean;
  totalCost: number;
  remaining: number;
  errors: string[];
}

export function validateArmy(selection: ArmySelection): ArmyValidation {
  const errors: string[] = [];
  let totalCost = 0;

  for (const [typeId, count] of Object.entries(selection)) {
    if (count <= 0) continue;
    const type = getUnitType(typeId);
    if (count > type.maxCount) {
      errors.push(`${type.name}: ${count} exceeds the maximum of ${type.maxCount}`);
    }
    totalCost += type.cost * count;
  }

  if (totalCost > ARMY_BUDGET) {
    errors.push(`Total cost ${totalCost} exceeds the ${ARMY_BUDGET}-point budget`);
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
