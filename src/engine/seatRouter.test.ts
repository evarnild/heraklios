import { describe, expect, it } from 'vitest';
import { routeBySeat } from './seatRouter';
import type { PlayerAgent } from './agent';
import type { GameState, PlayerId, Unit } from './state';
import type { HexCoord } from '../data/map';

/** Records which agent was asked what, so a routing mistake shows up as the
 * wrong NAME rather than as a plausible-looking answer. */
function spyAgent(name: string, calls: string[]): PlayerAgent {
  return {
    chooseRetreat: async (_s, unit) => {
      calls.push(`${name}:chooseRetreat:${unit.id}`);
      return { q: 0, r: 0 };
    },
    choosePushTarget: async (_s, unit, candidates) => {
      calls.push(`${name}:choosePushTarget:${unit.id}`);
      return candidates[0]!;
    },
    chooseAdvance: async (_s, candidates) => {
      calls.push(`${name}:chooseAdvance:${candidates[0]!.id}`);
      return null;
    },
    chooseExchangeSacrifice: async (_s, attackers) => {
      calls.push(`${name}:chooseExchangeSacrifice:${attackers[0]!.id}`);
      return [];
    },
  };
}

function unitOwnedBy(owner: PlayerId, id: string): Unit {
  return { id, owner } as unknown as Unit;
}

const state = {} as GameState;
const hex: HexCoord = { q: 1, r: 1 };

describe('routeBySeat', () => {
  it('asks the RETREATING unit\'s owner, not the active player', async () => {
    // The case the whole file exists for: seat 0 is attacking (so it is the
    // active player), but the unit forced to retreat belongs to seat 1.
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>([
      [0 as PlayerId, spyAgent('seat0', calls)],
      [1 as PlayerId, spyAgent('seat1', calls)],
    ]);
    const router = routeBySeat(agents, spyAgent('fallback', calls));

    await router.chooseRetreat(state, unitOwnedBy(1 as PlayerId, 'defender'), [hex]);
    expect(calls).toEqual(['seat1:chooseRetreat:defender']);
  });

  it('asks the pushed-aside unit\'s owner', async () => {
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>([[2 as PlayerId, spyAgent('seat2', calls)]]);
    const router = routeBySeat(agents, spyAgent('fallback', calls));

    await router.choosePushTarget(state, unitOwnedBy(2 as PlayerId, 'boxed'), [
      unitOwnedBy(2 as PlayerId, 'neighbour'),
    ]);
    expect(calls).toEqual(['seat2:choosePushTarget:boxed']);
  });

  it('asks the advancing side\'s owner', async () => {
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>([[3 as PlayerId, spyAgent('seat3', calls)]]);
    const router = routeBySeat(agents, spyAgent('fallback', calls));

    await router.chooseAdvance(state, [unitOwnedBy(3 as PlayerId, 'attacker')], hex);
    expect(calls).toEqual(['seat3:chooseAdvance:attacker']);
  });

  it('asks the sacrificing side\'s owner', async () => {
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>([[1 as PlayerId, spyAgent('seat1', calls)]]);
    const router = routeBySeat(agents, spyAgent('fallback', calls));

    await router.chooseExchangeSacrifice(state, [unitOwnedBy(1 as PlayerId, 'a1')], 4);
    expect(calls).toEqual(['seat1:chooseExchangeSacrifice:a1']);
  });

  it('falls back for a seat with no agent of its own — the human seats', async () => {
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>([[1 as PlayerId, spyAgent('ai', calls)]]);
    const router = routeBySeat(agents, spyAgent('scene', calls));

    await router.chooseRetreat(state, unitOwnedBy(0 as PlayerId, 'human-unit'), [hex]);
    await router.chooseRetreat(state, unitOwnedBy(1 as PlayerId, 'ai-unit'), [hex]);
    expect(calls).toEqual(['scene:chooseRetreat:human-unit', 'ai:chooseRetreat:ai-unit']);
  });

  it('reads the map live, so rebuilding the seat agents takes effect', async () => {
    // `BoardScene` builds its router once but refills the map whenever a
    // loaded save changes which seats are AI. If the router captured a copy,
    // loading a save would keep routing to the previous game's agents.
    const calls: string[] = [];
    const agents = new Map<PlayerId, PlayerAgent>();
    const router = routeBySeat(agents, spyAgent('scene', calls));

    await router.chooseRetreat(state, unitOwnedBy(0 as PlayerId, 'u'), [hex]);
    agents.set(0 as PlayerId, spyAgent('ai', calls));
    await router.chooseRetreat(state, unitOwnedBy(0 as PlayerId, 'u'), [hex]);

    expect(calls).toEqual(['scene:chooseRetreat:u', 'ai:chooseRetreat:u']);
  });
});
