import { describe, it, expect } from 'vitest';
import { playRandomGame, buildFuzzGameState, type HarnessStats } from './fuzzHarness';
import type { Action } from './actions';
import type { CombatResult } from '../data/combatTable';

/**
 * Crank this up locally for a longer soak — just edit this constant (e.g. to
 * 5000) and rerun `npx vitest run src/engine/fuzzHarness.test.ts`. Kept as a
 * plain constant rather than an env var so it works with no Node type
 * definitions in this project's `tsconfig.json` (`types: ["vitest/globals"]`
 * only).
 *
 * 100 keeps the default suite around 8-10 seconds — `legalActions`
 * recomputes a full `reachableHexes` BFS for every living unit on EVERY
 * single action choice (see `buildFuzzGameState`'s doc comment in
 * fuzzHarness.ts for why the harness's own army is kept deliberately small
 * to help with exactly this), so "low hundreds of games, a few seconds" and
 * "enough seeds to reliably hit every action kind and combat result at
 * least once" turned out to be in tension — 100 was chosen as the point
 * where every result kind still reliably shows up (see the assertions
 * below) without the default `npm test` run stalling on this one file.
 */
const GAME_COUNT = 100;

describe('buildFuzzGameState', () => {
  it('never includes an elephant — the exclusion this whole harness depends on (plan.md §6.7)', () => {
    const state = buildFuzzGameState();
    expect(state.units.some((u) => u.typeId === 'elephants')).toBe(false);
  });

  it('places every unit on legal, non-overlapping starting hexes', () => {
    const state = buildFuzzGameState();
    const seen = new Set<string>();
    for (const unit of state.units) {
      const key = `${unit.position.q},${unit.position.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(state.units.length).toBeGreaterThan(0);
  });
});

describe('playRandomGame', () => {
  it('is fully deterministic: the same seed replays identically', async () => {
    const a = await playRandomGame(12345);
    const b = await playRandomGame(12345);
    expect(a).toEqual(b);
  });

  it('different seeds produce different games', async () => {
    const a = await playRandomGame(1);
    const b = await playRandomGame(2);
    expect(a).not.toEqual(b);
  });

  it('always terminates, whether by mutual elimination or the rulebook time-limit ending, never the action-cap infinite-loop guard', async () => {
    const stats = await playRandomGame(777);
    expect(stats.gameOver).toBe(true);
  });

  // Elephants are excluded from buildFuzzGameState() specifically so
  // `outcome.pendingDrifts` can never legitimately be non-empty (see
  // plan.md §6.7) — playRandomGame() throws loudly if that guard is ever
  // tripped, which this suite exercises implicitly on every seed below
  // simply by never seeing that throw.
  it.skip('elephants: drift cascade not yet fuzzable (Stage 2b, see plan.md §6.7)', () => {
    // Intentionally left unimplemented. This test exists purely so the gap
    // prints in every `vitest run` until Stage 2b extracts the drift/
    // trample cascade into a pure, resumable step function that a headless
    // caller can drive (plan.md §6.7's `driftStep`/`DriftEvent` sketch).
    // Once that lands: enable elephants in `buildFuzzGameState()`, answer
    // `needsRetreatChoice` drift events through the harness's `RandomAgent`,
    // delete this test and the `pendingDrifts` guard in `fuzzHarness.ts`.
  });
});

describe('fuzz harness: seeded self-play soak', () => {
  it(`plays ${GAME_COUNT} seeded games headlessly end to end with no invariant violations`, async () => {
    const allStats: HarnessStats[] = [];
    for (let seed = 0; seed < GAME_COUNT; seed++) {
      allStats.push(await playRandomGame(seed));
    }

    const totalActions = allStats.reduce((sum, g) => sum + g.totalActions, 0);
    const actionsByKind: Partial<Record<Action['kind'], number>> = {};
    const combatResultCounts: Partial<Record<CombatResult, number>> = {};
    for (const g of allStats) {
      for (const [kind, count] of Object.entries(g.actionsByKind) as [Action['kind'], number][]) {
        actionsByKind[kind] = (actionsByKind[kind] ?? 0) + count;
      }
      for (const [result, count] of Object.entries(g.combatResultCounts) as [CombatResult, number][]) {
        combatResultCounts[result] = (combatResultCounts[result] ?? 0) + count;
      }
    }
    const totalLandAttacks = allStats.reduce((sum, g) => sum + g.landAttacksResolved, 0);
    const totalRams = allStats.reduce((sum, g) => sum + g.ramsResolved, 0);
    const totalRamHits = allStats.reduce((sum, g) => sum + g.ramHits, 0);
    const totalBoardings = allStats.reduce((sum, g) => sum + g.boardingsResolved, 0);
    const turns = allStats.map((g) => g.turnsReached);
    const wins = allStats.filter((g) => g.winnerId !== null).length;
    const draws = allStats.length - wins;
    const endedByTimeLimit = allStats.filter((g) => g.endedByTimeLimit).length;
    const endedByElimination = allStats.length - endedByTimeLimit;

    // Instrumentation report — this IS the deliverable Stage 1's postmortem
    // (plan.md §6.6) says matters most: a harness that ran green while
    // exercising nothing was the exact failure mode caught there. Printed
    // unconditionally (not gated behind a failure) so `npm test`'s output
    // always shows what a run actually did.
    // eslint-disable-next-line no-console
    console.log(
      [
        `[fuzz] ${GAME_COUNT} games, ${totalActions} total actions (avg ${(totalActions / GAME_COUNT).toFixed(1)}/game)`,
        `[fuzz] actionsByKind: ${JSON.stringify(actionsByKind)}`,
        `[fuzz] combatResultCounts: ${JSON.stringify(combatResultCounts)}`,
        `[fuzz] landAttacksResolved=${totalLandAttacks} ramsResolved=${totalRams} (hits=${totalRamHits}) boardingsResolved=${totalBoardings}`,
        `[fuzz] turnsReached: min=${Math.min(...turns)} max=${Math.max(...turns)} avg=${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)}`,
        `[fuzz] outcomes: ${wins} decisive win(s), ${draws} draw(s) (mutual elimination or tied army value)`,
        `[fuzz] endings: ${endedByElimination} by mutual elimination, ${endedByTimeLimit} by the rulebook's turn-limit/army-value ending`,
      ].join('\n'),
    );

    // Every game reached a real conclusion (not a turn/action-cap timeout —
    // playRandomGame() would have thrown instead).
    expect(allStats.every((g) => g.gameOver)).toBe(true);

    // Regression guards mirroring Stage 1's exact postmortem (plan.md
    // §6.6): assert the harness actually DID something, not merely that it
    // ran without throwing. If any of these ever go to zero (or land moves
    // die off after the first turn or two), the harness is broken
    // regardless of what the invariant checks report.
    expect(totalLandAttacks).toBeGreaterThan(0);
    expect(totalBoardings).toBeGreaterThan(0);
    expect((actionsByKind.landMove ?? 0) + (actionsByKind.navalMove ?? 0)).toBeGreaterThan(GAME_COUNT * 10);
    expect(Math.max(...turns)).toBeGreaterThan(1);
    // At least one AR/DR/EX/DE outcome of every kind should show up across
    // this many seeds — if any result never appears, either the CRT or the
    // die injection has a bias/bug worth investigating.
    for (const result of ['AE', 'AR', 'DE', 'DR', 'EX'] as CombatResult[]) {
      expect(combatResultCounts[result] ?? 0, `expected at least one '${result}' result across ${GAME_COUNT} games`).toBeGreaterThan(0);
    }
  });
});
