// The seeds in `combatScenarios.ts` do what the browser scenarios say they do:
// each position is played headlessly through the engine session with the same
// seeded dice the page would use, answering the first option. If the map or a
// rule changes, this fails before the browser spec is run against a position
// that no longer produces the prompt it waits for.
import { describe, expect, it } from 'vitest';
import type { PlayerAgent } from '../src/engine/agent';
import { newSession } from '../src/engine/gameSession';
import { createSeededRng } from '../src/engine/rng';
import { settleWithAgent } from '../src/engine/sessionAgents';
import type { GameState, Player, PlayerId } from '../src/engine/state';
import { createInitialState } from '../src/engine/turnManager';
import { craftedState } from './combatFixtures';
import { ADVANCE, DRIFT, EXCHANGE, ONE_OPTION, PUSH, type Scenario } from './combatScenarios';

const players: Player[] = [
  { id: 0 as PlayerId, name: 'A', edge: 'W', purchasePoints: 0, eliminated: false },
  { id: 1 as PlayerId, name: 'B', edge: 'E', purchasePoints: 0, eliminated: false },
];

/** Answers the first option everywhere and records what it was asked. */
function recorder(asked: string[]): PlayerAgent {
  return {
    chooseRetreat: async (_s, unit, options) => {
      asked.push(`retreat ${unit.id} ${options.length}`);
      return options[0]!;
    },
    choosePushTarget: async (_s, unit, candidates) => {
      asked.push(`push ${unit.id} ${candidates.length}`);
      return candidates[0]!;
    },
    chooseAdvance: async (_s, candidates) => {
      asked.push(`advance ${candidates.map((u) => u.id).join('+')}`);
      return null;
    },
    chooseExchangeSacrifice: async (_s, attackers, force) => {
      asked.push(`sacrifice ${attackers.length} ${force}`);
      return [attackers[attackers.length - 1]!];
    },
  };
}

async function play(scenario: Scenario): Promise<{ asked: string[]; state: GameState; die: number }> {
  const state = craftedState(createInitialState(players, 'single-defender'), scenario.fixture);
  const asked: string[] = [];
  const step = await settleWithAgent(
    newSession(state),
    { kind: 'landAttack', attackerIds: scenario.attackerIds, defenderIds: scenario.defenderIds },
    recorder(asked),
    createSeededRng(scenario.seed),
  );
  const result = step.result;
  if (result.kind !== 'landAttack') throw new Error('not a land attack');
  return { asked, state, die: result.detail.rawDieRoll };
}

describe('the combat-resolution scenario positions', () => {
  it('(a) a 4-1 DR: three retreat hexes, then an advance offer', async () => {
    const { asked, die } = await play(ADVANCE);
    expect(die).toBe(2);
    expect(asked).toEqual(['retreat fx-def 3', 'advance fx-att']);
  });

  it('(f) friends on two hexes leave one retreat hex', async () => {
    expect((await play(ONE_OPTION)).asked).toEqual(['retreat fx-def 1', 'advance fx-att']);
  });

  it('(b) 20:2 is an exchange: three listed losses, then two advance candidates', async () => {
    const { asked, die } = await play(EXCHANGE);
    expect(die).toBe(5);
    expect(asked).toEqual(['sacrifice 3 2', 'advance fx-a1+fx-a2']);
  });

  it('(c) a boxed-in defender pushes its friend, who has one hex', async () => {
    const { asked, state } = await play(PUSH);
    expect(asked).toEqual(['push fx-def 1', 'retreat fx-friend 1', 'advance fx-att']);
    const at = (id: string) => state.units.find((u) => u.id === id)!.position;
    expect([at('fx-def'), at('fx-friend')]).toEqual([{ q: 10, r: 3 }, { q: 10, r: 2 }]);
  });

  it('(d) the elephant drifts north, tramples the infantry two hexes on, who retreats', async () => {
    const { asked, state } = await play(DRIFT);
    expect(asked).toEqual(['retreat fx-vic 5', 'advance fx-a1+fx-a2']);
    const ele = state.units.find((u) => u.id === 'fx-ele')!;
    expect(ele.position).toEqual({ q: 10, r: 0 });
  });
});
