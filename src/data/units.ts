export type UnitDomain = 'land' | 'naval';

export interface UnitType {
  id: string;
  name: string;
  domain: UnitDomain;
  cost: number;
  maxCount: number;
  attack: number;
  rangedAttack: number;
  range: number;
  defense: number;
  movement: number;
  /** Can this unit fight in melee even though it also has a ranged attack? */
  meleeCapable: boolean;
}

// Stats transcribed directly from the Heraklios counters (Jeux & Stratégie #6, 1980).
// Format on each physical counter: attack (rangedAttack) range / defense movement.
export const UNIT_TYPES: readonly UnitType[] = [
  {
    id: 'archers',
    name: 'Archers',
    domain: 'land',
    cost: 5,
    maxCount: 10,
    attack: 0,
    rangedAttack: 2,
    range: 2,
    defense: 1,
    movement: 3,
    meleeCapable: false,
  },
  {
    id: 'fantassins',
    name: 'Fantassins',
    domain: 'land',
    cost: 5,
    maxCount: 10,
    attack: 2,
    rangedAttack: 0,
    range: 0,
    defense: 1,
    movement: 3,
    meleeCapable: true,
  },
  {
    id: 'fantassins-archers',
    name: 'Fantassins-Archers',
    domain: 'land',
    cost: 10,
    maxCount: 8,
    attack: 2,
    rangedAttack: 2,
    range: 2,
    defense: 2,
    movement: 3,
    meleeCapable: true,
  },
  {
    id: 'fantassins-lourds',
    name: 'Fantassins Lourds',
    domain: 'land',
    cost: 10,
    maxCount: 8,
    attack: 4,
    rangedAttack: 0,
    range: 0,
    defense: 3,
    movement: 2,
    meleeCapable: true,
  },
  {
    id: 'phalanges',
    name: 'Phalanges',
    domain: 'land',
    cost: 15,
    maxCount: 5,
    attack: 8,
    rangedAttack: 0,
    range: 0,
    defense: 5,
    movement: 3,
    meleeCapable: true,
  },
  {
    id: 'cavalerie-legere',
    name: 'Cavalerie Légère',
    domain: 'land',
    cost: 5,
    maxCount: 10,
    attack: 3,
    rangedAttack: 0,
    range: 0,
    defense: 2,
    movement: 6,
    meleeCapable: true,
  },
  {
    id: 'cavalerie-lourde',
    name: 'Cavalerie Lourde',
    domain: 'land',
    cost: 10,
    maxCount: 8,
    attack: 6,
    rangedAttack: 0,
    range: 0,
    defense: 4,
    movement: 4,
    meleeCapable: true,
  },
  {
    id: 'elephants',
    name: 'Éléphants',
    domain: 'land',
    cost: 10,
    maxCount: 10,
    attack: 8,
    rangedAttack: 0,
    range: 0,
    defense: 5,
    movement: 4,
    meleeCapable: true,
  },
  {
    id: 'chars-legers',
    name: 'Chars Légers',
    domain: 'land',
    cost: 5,
    maxCount: 8,
    attack: 4,
    rangedAttack: 0,
    range: 0,
    defense: 3,
    movement: 6,
    meleeCapable: true,
  },
  {
    id: 'chars-lourds',
    name: 'Chars Lourds',
    domain: 'land',
    cost: 10,
    maxCount: 8,
    attack: 8,
    rangedAttack: 0,
    range: 0,
    defense: 5,
    movement: 4,
    meleeCapable: true,
  },
  {
    id: 'galeres',
    name: 'Galères',
    domain: 'naval',
    cost: 10,
    maxCount: 6,
    attack: 10,
    rangedAttack: 0,
    range: 0,
    defense: 10,
    movement: 8,
    meleeCapable: true,
  },
  {
    id: 'biremes',
    name: 'Birèmes',
    domain: 'naval',
    cost: 20,
    maxCount: 5,
    attack: 15,
    rangedAttack: 0,
    range: 0,
    defense: 15,
    movement: 6,
    meleeCapable: true,
  },
  {
    id: 'triremes',
    name: 'Trirèmes',
    domain: 'naval',
    cost: 30,
    maxCount: 3,
    attack: 20,
    rangedAttack: 2,
    range: 2,
    defense: 20,
    movement: 6,
    meleeCapable: true,
  },
  {
    id: 'quintiremes',
    name: 'Quintirèmes',
    domain: 'naval',
    cost: 50,
    maxCount: 1,
    attack: 25,
    rangedAttack: 2,
    range: 2,
    defense: 25,
    movement: 4,
    meleeCapable: true,
  },
];

export const UNIT_BY_ID: ReadonlyMap<string, UnitType> = new Map(
  UNIT_TYPES.map((u) => [u.id, u]),
);

export function getUnitType(id: string): UnitType {
  const unit = UNIT_BY_ID.get(id);
  if (!unit) throw new Error(`Unknown unit type: ${id}`);
  return unit;
}
