import type { CombatResult } from '../data/combatTable';
import type { Action } from './actions';
import { describeLandAttack } from './combat';
import type { GameState, Unit } from './state';
import { createInitialState } from './turnManager';

// Small hand-built positions on known plain hexes, a die chosen from the combat
// table (`dieFor`) and a scripted rng, shared by the session's seam and pause tests.

export function unit(id: string, typeId: string, q: number, r: number, owner: 0 | 1 = 0): Unit {
  return { id, owner, typeId, position: { q, r }, movementLeft: 0, facing: 0, defendedThisPhase: false, charged: false, destroyed: false };
}

export function gameWith(units: Unit[]): GameState {
  const state = createInitialState(
    [
      { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
      { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
    ],
    'multi-defender',
  );
  state.units = units;
  state.phase = 'combat';
  return state;
}

export function dieFor(attackers: Unit[], defenders: Unit[], result: CombatResult): number {
  for (let die = 1; die <= 6; die++) {
    if (describeLandAttack(attackers, defenders, die).result === result) return die;
  }
  throw new Error(`No die gives ${result}`);
}

export function scripted(dice: number[]): () => number {
  const queue = [...dice];
  return () => {
    const die = queue.shift();
    if (die === undefined) throw new Error('scripted rng: no die left');
    return (die - 1) / 6;
  };
}

export const attack = (attackers: Unit[], defenders: Unit[]): Action => ({
  kind: 'landAttack',
  attackerIds: attackers.map((u) => u.id),
  defenderIds: defenders.map((u) => u.id),
});

