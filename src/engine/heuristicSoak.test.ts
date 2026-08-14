import { describe, it, expect } from 'vitest';
import type { DrivingAgent } from './agent';
import { playRandomGame, type HarnessStats } from './fuzzHarness';
import { HeuristicAgent, type Difficulty } from './heuristicAgent';
import { RandomAgent } from './randomAgent';
import type { PlayerId } from './state';

/**
 * Self-play soaks for plan.md §6.4's Stage 3 agent, run through the exact
 * same seeded driver and continuously-checked invariants as the Stage 2a
 * `RandomAgent` soak (`fuzzHarness.test.ts`) — `playRandomGame` throws on the
 * first violation, so every series here is a fuzz run as well as a
 * measurement.
 *
 * It is a genuinely DIFFERENT fuzz surface, not a re-run of the same one: a
 * scored agent walks into contact on purpose, fights at ratios a uniform
 * random walk almost never assembles, and — uniquely — resolves COMBINED
 * attacks, which plan.md §6.8 records as structurally unreachable for the
 * random soak (`multiAttacker: 0` across 100 games).
 *
 * Seed counts are kept low on purpose. These games are more expensive than
 * random ones (every candidate destination is scored, not sampled) and the
 * whole suite has to stay runnable on every `npm test`; the measurements
 * below are all deterministic, so a dozen seeds is a fixed result rather
 * than a small sample of a noisy one.
 */
const SEEDS = 12;

type Tier = Difficulty | 'pure-random';

function agentFor(tier: Tier, rng: () => number): DrivingAgent {
  return tier === 'pure-random' ? new RandomAgent(rng) : new HeuristicAgent({ difficulty: tier, rng });
}

interface SeriesResult {
  games: HarnessStats[];
  /** Total surviving army value across the series, per seat. */
  material: Record<PlayerId, number>;
  multiAttackerAttacks: number;
}

async function playSeries(seat0: Tier, seat1: Tier, seeds = SEEDS): Promise<SeriesResult> {
  const games: HarnessStats[] = [];
  const material = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<PlayerId, number>;
  let multiAttackerAttacks = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const stats = await playRandomGame(seed, {
      createAgent: (rng, seat) => agentFor(seat === 0 ? seat0 : seat1, rng),
    });
    games.push(stats);
    material[0] += stats.finalArmyValues[0] ?? 0;
    material[1] += stats.finalArmyValues[1] ?? 0;
    multiAttackerAttacks += stats.multiAttackerAttacks;
  }
  return { games, material, multiAttackerAttacks };
}

describe('HeuristicAgent: headless self-play', () => {
  it('plays complete, invariant-clean games with both seats scoring their moves', async () => {
    const series = await playSeries('ev', 'ev');
    expect(series.games).toHaveLength(SEEDS);
    for (const game of series.games) {
      expect(game.gameOver).toBe(true);
      // Every game reaching the turn cap is the harness's normal ending (see
      // `playRandomGame`'s TERMINATION note); what matters here is that none
      // of them stalled or threw.
      expect(game.totalActions).toBeGreaterThan(0);
    }
  });

  it('resolves combined attacks, which a RandomAgent soak structurally cannot', async () => {
    // The control and the measurement in one test, because the claim is
    // comparative: `legalActions` only ever enumerates one-attacker attacks,
    // so a random agent has no way to produce a combined one, while the EV
    // tier assembles groups itself (see `HeuristicAgent.buildAttackGroup`).
    const random = await playSeries('pure-random', 'pure-random');
    expect(random.multiAttackerAttacks).toBe(0);

    const heuristic = await playSeries('ev', 'ev');
    expect(heuristic.multiAttackerAttacks).toBeGreaterThan(0);

    // Printed unconditionally, following `fuzzHarness.test.ts`'s report
    // convention (plan.md §6.6: a harness that runs green while exercising
    // nothing is the failure mode that matters most) — so a reader can see
    // how much combat this soak actually reached, not just that it passed.
    const attacks = heuristic.games.reduce((sum, g) => sum + g.landAttacksResolved, 0);
    // eslint-disable-next-line no-console
    console.log(
      `[heuristic] ${SEEDS} EV-vs-EV games: ${attacks} land attacks, ${heuristic.multiAttackerAttacks} of them combined ` +
        `(RandomAgent control over the same seeds: ${random.multiAttackerAttacks})`,
    );
  });

  it('replays identically from the same seed', async () => {
    const first: string[] = [];
    const second: string[] = [];
    const options = { createAgent: (rng: () => number) => new HeuristicAgent({ difficulty: 'ev' as const, rng }) };
    await playRandomGame(4242, { ...options, trace: first });
    await playRandomGame(4242, { ...options, trace: second });

    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
  });
});

describe('HeuristicAgent: difficulty tiers are ordered by strength', () => {
  /**
   * Strength is measured as SURVIVING ARMY VALUE, not as wins, and always
   * from both seats.
   *
   * Both parts of that matter. `winnerId` alone would be measuring the wrong
   * thing twice over: `endGameByTimeLimit` breaks a tie in favour of the
   * lower seat (see `HarnessStats.finalArmyValues`), and — measured on this
   * scenario — moving first is worth real material once a side plays well at
   * all.
   *
   * Measured over these exact 12 seeds, as average surviving army value:
   *
   * ```
   * ev-vs-ev          [23.33, 16.25]   wins [ 7, 5]
   * random-vs-random  [31.25, 33.75]   wins [ 6, 6]
   * ```
   *
   * Two `RandomAgent`s finish level — if anything a shade in seat 1's favour
   * — while two `HeuristicAgent`s finish about 3:2 apart. The first-move
   * advantage is therefore created by good play, not baked into the starting
   * position. A one-sided comparison would credit the seat rather than the
   * agent, so the tests below hold the seat constant on each side.
   *
   * These numbers moved when plan.md §15 made a volley resolve at the
   * archer's projectile value instead of at 0. Before that, seat 0 finished
   * [35.83, 6.67] and won all 12: the whole roster's ranged half was dead
   * weight, so whoever landed the first real melee kept the initiative
   * unanswered. Both sides now shoot, and the second seat can trade back —
   * the ordering the tests below assert is unchanged, the margin is simply
   * smaller and the game less decided by who moves first. §15.5's
   * advance-adjacency fix then moved them again, but only in the third
   * significant figure: an EV agent rarely wanted to walk a defense-1 archer
   * into the contact it had just shot at anyway.
   */
  it('the EV tier ends with far more material than a RandomAgent, from either seat', async () => {
    const asSeat0 = await playSeries('ev', 'pure-random');
    const asSeat1 = await playSeries('pure-random', 'ev');

    expect(asSeat0.material[0]).toBeGreaterThan(asSeat0.material[1]);
    expect(asSeat1.material[1]).toBeGreaterThan(asSeat1.material[0]);

    const heuristicTotal = asSeat0.material[0] + asSeat1.material[1];
    const randomTotal = asSeat0.material[1] + asSeat1.material[0];
    // Measured at roughly 3.5x. The per-game averages are 67.5 vs 19.2; the
    // totals asserted below are those times the 12 seeds, i.e. 810 vs 230 —
    // stated because quoting only the averages next to an assertion on the
    // totals reads as if they were the same number. Asserted at 2x so
    // ordinary tuning of the weights doesn't turn a still-comfortable win
    // into a red suite.
    expect(heuristicTotal).toBeGreaterThan(randomTotal * 2);
  });

  it('the EV tier ends with more material than the greedy tier, seat for seat', async () => {
    const evFirst = await playSeries('ev', 'greedy');
    const greedyFirst = await playSeries('greedy', 'ev');

    // Seat held constant on each side of the comparison, so the first-move
    // advantage cancels instead of deciding the result.
    const evInSeat0 = evFirst.material[0];
    const greedyInSeat0 = greedyFirst.material[0];
    const evInSeat1 = greedyFirst.material[1];
    const greedyInSeat1 = evFirst.material[1];

    expect(evInSeat0).toBeGreaterThan(greedyInSeat0);
    expect(evInSeat1).toBeGreaterThan(greedyInSeat1);
  });
});
