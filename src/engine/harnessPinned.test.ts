import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Action } from './actions';
import type { DrivingAgent } from './agent';
import type { HexCoord } from '../data/map';
import { exchangeSacrificeForce, exchangeSacrificeMeetsThreshold } from './combat';
import pinned from './fixtures/72-harness-traces.json';
import {
  buildElephantScenarioGameState,
  buildPushScenarioGameState,
  playRandomGame,
  type HarnessStats,
  type PlayRandomGameOptions,
} from './fuzzHarness';
import { HeuristicAgent } from './heuristicAgent';
import { RandomAgent } from './randomAgent';
import type { GameState, PlayerId, Unit } from './state';

/**
 * §72 (B15): the fuzz harness's traces and stats are pinned. The fixture was
 * written once, from `main` before any §72 code, by the gated writer at the
 * foot of this file; the comparisons import it statically, so a missing file
 * is a compile error rather than a test that writes its own expectation.
 *
 * Each game's trace is stored as a sha256 plus its length (as
 * `heuristicSoak.test.ts` does), with the full `HarnessStats` and the number
 * of exchange sacrifices an agent was asked to choose.
 */

interface PinnedGame {
  length: number;
  sha256: string;
  stats: HarnessStats;
  exchangeChoices: number;
}

interface GameSpec {
  name: string;
  seed: number;
  options: () => PlayRandomGameOptions;
}

/** Forwards every call and draws no rng. It counts the exchange sacrifices an
 * agent chooses and records any that is not minimal (spec I3). */
class WatchingAgent implements DrivingAgent {
  constructor(private readonly inner: DrivingAgent, private readonly tally: { choices: number; nonMinimal: number }) {}

  chooseNextAction(state: GameState, legal: Action[]): Action {
    return this.inner.chooseNextAction(state, legal);
  }
  chooseRetreat(state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    return this.inner.chooseRetreat(state, unit, options);
  }
  choosePushTarget(state: GameState, unit: Unit, candidates: Unit[]): Promise<Unit> {
    return this.inner.choosePushTarget(state, unit, candidates);
  }
  chooseAdvance(state: GameState, candidates: Unit[], vacated: HexCoord): Promise<Unit | null> {
    return this.inner.chooseAdvance(state, candidates, vacated);
  }
  async chooseExchangeSacrifice(state: GameState, attackers: Unit[], requiredForce: number): Promise<Unit[]> {
    const chosen = await this.inner.chooseExchangeSacrifice(state, attackers, requiredForce);
    this.tally.choices++;
    const total = chosen.reduce((sum, u) => sum + exchangeSacrificeForce(u), 0);
    const minimal =
      exchangeSacrificeMeetsThreshold(chosen, requiredForce) &&
      chosen.every((u) => total - exchangeSacrificeForce(u) < requiredForce);
    if (!minimal) this.tally.nonMinimal++;
    return chosen;
  }
}

// §81: `endGameByTimeLimit` now decides on the score (army value plus the 30
// point naval bonus for the only player with a ship afloat). Three games ended
// by the turn cap changed `winnerIds` from [1] to [0], edited by hand in the
// fixture: ev-vs-ev/seed1 and seed6 (final army values 10 vs 35, only seat 0
// has ships: 40 > 35) and ev-vs-ev-found/seed12 (25 vs 35: 55 > 35).
// Nothing else in any game moved.
const SPECS: GameSpec[] = [];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

type MakeAgent = (rng: () => number, seat: PlayerId) => DrivingAgent;
const random: MakeAgent = (rng) => new RandomAgent(rng);
const ev: MakeAgent = (rng) => new HeuristicAgent({ difficulty: 'ev', rng });
const evVersusRandom: MakeAgent = (rng, seat) => (seat === 0 ? ev(rng, seat) : random(rng, seat));

function addSpecs(prefix: string, seeds: number[], make: MakeAgent, build?: () => GameState): void {
  for (const seed of seeds) {
    SPECS.push({
      name: `${prefix}/seed${seed}`,
      seed,
      options: () => ({ createAgent: make, ...(build ? { buildInitialState: build } : {}) }),
    });
  }
}

addSpecs('random-default', range(1, 30), random);
addSpecs('random-push', range(1, 5), random, buildPushScenarioGameState);
addSpecs('random-elephant', range(1, 5), random, buildElephantScenarioGameState);
addSpecs('ev-vs-ev', range(1, 6), ev);
addSpecs('ev-vs-random', range(1, 2), evVersusRandom);
// Beyond the plan's list: pushes and multi-attacker exchanges are rare, so the
// seeds below were found by scanning (1-60 push scenario, 31-120 default, 7-40
// 'ev') for games that reach them. They give the I3 check and the push path
// real coverage rather than a single instance each.
addSpecs('random-push-found', [17, 19, 22, 29, 50], random, buildPushScenarioGameState);
addSpecs('random-default-found', [76], random);
addSpecs('ev-vs-ev-found', [8, 9, 10, 12, 14, 15, 17, 20, 22, 24, 25, 26], ev);

/** Wraps every seat's agent so the exchange sacrifices can be counted. */
async function play(spec: GameSpec): Promise<{ game: PinnedGame; nonMinimal: number }> {
  const tally = { choices: 0, nonMinimal: 0 };
  const options = spec.options();
  const make = options.createAgent!;
  const trace: string[] = [];
  const stats = await playRandomGame(spec.seed, {
    ...options,
    trace,
    createAgent: (rng, seat) => new WatchingAgent(make(rng, seat), tally),
  });
  const game: PinnedGame = {
    length: trace.length,
    sha256: createHash('sha256').update(trace.join('\n')).digest('hex'),
    stats: JSON.parse(JSON.stringify(stats)) as HarnessStats,
    exchangeChoices: tally.choices,
  };
  return { game, nonMinimal: tally.nonMinimal };
}

const games = (pinned as { games: Record<string, PinnedGame> }).games;

describe('pinned harness games (B15)', () => {
  const totals = { pushes: 0, drifts: 0, driftCombats: 0, exchanges: 0 };
  const results: Record<string, number> = {};
  let nonMinimal = 0;

  for (const spec of SPECS) {
    it(`${spec.name} plays the game it played before §72`, async () => {
      const { game, nonMinimal: bad } = await play(spec);
      nonMinimal += bad;
      totals.pushes += game.stats.pushesResolved;
      totals.drifts += game.stats.driftsResolved;
      totals.driftCombats += game.stats.driftCombatsResolved;
      totals.exchanges += game.exchangeChoices;
      for (const [result, n] of Object.entries(game.stats.combatResultCounts)) results[result] = (results[result] ?? 0) + (n ?? 0);
      expect(games[spec.name]).toBeDefined();
      expect(game).toEqual(games[spec.name]);
    });
  }

  it('pins every game it plays, and nothing else', () => {
    expect(Object.keys(games).sort()).toEqual(SPECS.map((s) => s.name).sort());
  });

  // Coverage is asserted, not assumed: identical traces over games that never
  // reach the moved code would prove nothing.
  it('reaches pushes, drifts, drift combats, exchange choices and every combat result', () => {
    expect(totals.pushes).toBeGreaterThan(0);
    expect(totals.drifts).toBeGreaterThan(0);
    expect(totals.driftCombats).toBeGreaterThan(0);
    expect(totals.exchanges).toBeGreaterThan(0);
    for (const result of ['AR', 'DR', 'DE', 'EX', 'AE']) expect(results[result] ?? 0).toBeGreaterThan(0);
  });

  // Spec I3: the session lists only minimal sacrifices, so every choice made
  // in the pinned games must already be one.
  it('makes only minimal exchange sacrifices', () => {
    expect(nonMinimal).toBe(0);
  });

  // Run once, on the code as it stood before §72, to (re)create the fixture.
  it.runIf(process.env.HERAKLIOS_WRITE_FIXTURES === '72')('writes the fixture', async () => {
    const out: Record<string, PinnedGame> = {};
    for (const spec of SPECS) out[spec.name] = (await play(spec)).game;
    writeFileSync(new URL('fixtures/72-harness-traces.json', import.meta.url), JSON.stringify({ games: out }, null, 1));
  }, 600_000);
});
