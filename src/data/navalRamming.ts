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

export { SHIP_ORDER };
