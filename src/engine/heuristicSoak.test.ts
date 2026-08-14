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
   * ev-vs-ev          [22.50, 22.08]   wins [ 7, 5]
   * random-vs-random  [40.00, 36.25]   wins [ 7, 5]
   * ```
   *
   * A one-sided comparison would credit the seat rather than the agent, so
   * the tests below hold the seat constant on each side.
   *
   * HISTORY, because these numbers have now moved twice and the REASONS are
   * the durable part — the figures themselves are roster-dependent and will
   * move again:
   *
   * - plan.md §15 (volleys resolving at the archer's projectile value rather
   *   than at 0). Before it, seat 0 finished [35.83, 6.67] and won all 12:
   *   the roster's whole ranged half was dead weight, so whoever landed the
   *   first real melee kept the initiative unanswered. Once both sides could
   *   shoot back, ev-vs-ev came in at [23.33, 16.25], wins 7-5.
   * - plan.md §6.7's Stage 2c (one elephant per side in
   *   `buildFuzzGameState`). That is what produced the numbers above, and it
   *   compressed every margin on this page — see the next paragraph, which
   *   is the interesting half.
   *
   * **An elephant is a material floor, and that is why the margins shrank.**
   * Every other unit type with no legal retreat hex is simply eliminated
   * (`applyLandCombatResult`'s `forceRetreat`); an elephant is routed to
   * `pendingDrifts` FIRST and drifts instead, so the one outcome that
   * permanently removes material from a badly-played army does not apply to
   * it. Adding 10 points of un-loseable army value per side therefore lifts
   * the loser's floor much more than the winner's ceiling, which compresses
   * ratios without changing the ORDERING any test here asserts. It shows up
   * clearest in the two mirror matches above: random-vs-random rose from
   * totals [375, 405] to [480, 435], while ev-vs-ev barely moved.
   *
   * The consequence worth knowing before re-tuning weights is recorded at
   * the 2x assertion below, whose headroom this change genuinely did eat.
   */
  it('the EV tier ends with far more material than a RandomAgent, from either seat', async () => {
    const asSeat0 = await playSeries('ev', 'pure-random');
    const asSeat1 = await playSeries('pure-random', 'ev');

    expect(asSeat0.material[0]).toBeGreaterThan(asSeat0.material[1]);
    expect(asSeat1.material[1]).toBeGreaterThan(asSeat1.material[0]);

    const heuristicTotal = asSeat0.material[0] + asSeat1.material[1];
    const randomTotal = asSeat0.material[1] + asSeat1.material[0];
    // Measured at 2.33x: totals 875 vs 375 over the 12 seeds (per-game
    // averages 36.5 vs 15.6 — both stated, because quoting only the averages
    // next to an assertion on the TOTALS reads as if they were the same
    // number).
    //
    // READ THIS BEFORE RE-TUNING THE WEIGHTS. The 2x floor was originally
    // chosen with the comment "so ordinary tuning doesn't turn a
    // still-comfortable win into a red suite", and at the time it measured
    // 3.5x (810 vs 230), i.e. 76% headroom over the floor. Stage 2c
    // (plan.md §6.7) cut that to **16.7%** — 875 against a floor of 750 — for
    // the reason this file's header explains: an elephant cannot be
    // eliminated by a failed retreat, so it is 10 points of army value the
    // RandomAgent gets to keep no matter how badly it plays, and the floor it
    // lifts is the LOSER's. The assertion is deliberately left at 2x rather
    // than quietly relaxed to keep the strength claim honest, but it is no
    // longer the comfortable guard the old comment described: a weight change
    // that costs the EV agent ~15% of its edge will now redden this test, and
    // that is a real result to investigate rather than a threshold to nudge.
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
