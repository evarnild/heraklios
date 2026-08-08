import { describe, expect, it } from 'vitest';
import type { HexCoord } from '../data/map';
import { getUnitType } from '../data/units';
import type { PlayerAgent } from './agent';
import { describeLandAttack } from './combat';
import {
  driftStep,
  resolveElephantDrift,
  startElephantDrift,
  type DriftEvent,
  type DriftInput,
} from './drift';
import { DIRECTIONS } from './hex';
import type { GameState, Player, PlayerId, Unit } from './state';
import { createInitialState } from './turnManager';

const CENTER = { q: 10, r: 5 };

function makeUnit(id: string, owner: PlayerId, typeId: string, position: HexCoord): Unit {
  const t = getUnitType(typeId);
  return {
    id,
    owner,
    typeId,
    position,
    movementLeft: 0,
    facing: 0,
    equipmentPoints: t.domain === 'naval' ? 0 : undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

function makeState(units: Unit[]): GameState {
  const players: Player[] = [
    { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
    { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
  ];
  const state = createInitialState(players, 'multi-defender');
  state.units = units;
  return state;
}

class ScriptedAgent implements PlayerAgent {
  retreatCalls: Unit[] = [];
  pushCalls: Unit[] = [];

  async chooseRetreat(_state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    this.retreatCalls.push(unit);
    return options.find((hex) => hex.r !== unit.position.r) ?? options[0]!;
  }

  async choosePushTarget(_state: GameState, unit: Unit, candidates: Unit[]): Promise<Unit> {
    this.pushCalls.push(unit);
    return candidates[0]!;
  }

  async chooseAdvance(): Promise<Unit | null> {
    return null;
  }

  async chooseExchangeSacrifice(_state: GameState, attackers: Unit[]): Promise<Unit[]> {
    return [attackers[0]!];
  }
}

function dieForResult(attacker: Unit, defender: Unit, result: string): number {
  for (let die = 1; die <= 6; die++) {
    if (describeLandAttack([attacker], [defender], die).result === result) return die;
  }
  throw new Error(`No die produces ${result} for ${attacker.typeId} vs ${defender.typeId}`);
}

function pumpStep(state: GameState, input?: DriftInput, events: DriftEvent[] = []) {
  const result = driftStep(state, currentDrift!, input);
  currentDrift = result.state;
  events.push(...result.events);
  return result;
}

let currentDrift: ReturnType<typeof startElephantDrift> | null = null;

describe('elephant drift engine', () => {
  it('stores unit ids, not live Unit objects, in the resumable drift state', () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const drift = startElephantDrift(elephant, 4);

    expect(drift.frames[0]).toMatchObject({ kind: 'drift', elephantId: 'elephant' });
    expect('elephant' in drift.frames[0]!).toBe(false);
  });

  it('moves through empty hexes until movement is exhausted', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const state = makeState([elephant]);

    await resolveElephantDrift(state, elephant, 2, new ScriptedAgent(), () => 1);

    expect(elephant.destroyed).toBe(false);
    expect(elephant.position).toEqual({ q: 12, r: 5 });
  });

  it('eliminates an elephant that drifts off-map or into sea', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', { q: 23, r: 3 });
    const state = makeState([elephant]);

    await resolveElephantDrift(state, elephant, 1, new ScriptedAgent(), () => 1);

    expect(elephant.destroyed).toBe(true);
  });

  it('re-rolls a forbidden reverse direction without consuming movement', () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const state = makeState([elephant]);
    currentDrift = startElephantDrift(elephant, 1, DIRECTIONS[0]);
    const events: DriftEvent[] = [];

    pumpStep(state, undefined, events);
    pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events);
    const result = pumpStep(state, { kind: 'directionRoll', dieRoll: 2 }, events);

    expect(result.done).toBe(true);
    expect(events.some((event) => event.kind === 'directionForbidden')).toBe(true);
    expect(elephant.position).toEqual({ q: 11, r: 4 });
  });

  it('destroys both units on EX and ends the drift', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const defender = makeUnit('defender', 1, 'fantassins', { q: 11, r: 5 });
    const state = makeState([elephant, defender]);
    const combatDie = dieForResult(elephant, defender, 'EX');
    const dice = [1, combatDie];

    await resolveElephantDrift(state, elephant, 4, new ScriptedAgent(), () => dice.shift()!);

    expect(elephant.destroyed).toBe(true);
    expect(defender.destroyed).toBe(true);
  });

  it('tramples a non-elephant defender, resolves its retreat, and continues in the same direction', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const defender = makeUnit('defender', 1, 'phalanges', { q: 11, r: 5 });
    const state = makeState([elephant, defender]);
    const agent = new ScriptedAgent();
    const combatDie = dieForResult(elephant, defender, 'DR');
    const dice = [1, combatDie];

    await resolveElephantDrift(state, elephant, 4, agent, () => dice.shift()!);

    expect(agent.retreatCalls.map((u) => u.id)).toEqual(['defender']);
    expect(defender.destroyed).toBe(false);
    expect(defender.position).not.toEqual({ q: 11, r: 5 });
    expect(elephant.position).toEqual({ q: 14, r: 5 });
  });

  it('resolves a nested trampled elephant before the original elephant continues', async () => {
    const original = makeUnit('original', 0, 'elephants', CENTER);
    const nested = makeUnit('nested', 1, 'elephants', { q: 11, r: 5 });
    const state = makeState([original, nested]);
    const combatDie = dieForResult(original, nested, 'DR');
    const dice = [1, combatDie, 4, 2];

    await resolveElephantDrift(state, original, 4, new ScriptedAgent(), () => dice.shift()!);

    expect(nested.destroyed).toBe(false);
    expect(nested.position).toEqual({ q: 15, r: 1 });
    expect(original.position).toEqual({ q: 14, r: 5 });
  });
});
