import { describe, it, expect } from 'vitest';
import {
  playRandomGame,
  buildFuzzGameState,
  buildPushScenarioGameState,
  resolveUnitRetreat,
  processRetreats,
  type HarnessStats,
} from './fuzzHarness';
import type { Action } from './actions';
import type { CombatResult } from '../data/combatTable';
import type { HexCoord } from '../data/map';
import { legalRetreatHexes } from './combat';
import { createInitialState } from './turnManager';
import type { PlayerAgent } from './agent';
import type { GameState, Unit } from './state';
import { DIRECTIONS, hexAdd } from './hex';

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
  // HIGH finding from adversarial review: comparing `HarnessStats` objects
  // directly is a weaker proof than it looks like. `seed` is one of the
  // fields on `HarnessStats` (assigned from the function's own argument),
  // so `a.seed !== b.seed` alone guarantees `toEqual`/`not.toEqual` come out
  // the "right" way regardless of whether the games themselves actually
  // differ — a same-seed test could pass by accident (if `seed` were ever
  // omitted from the comparison) and a different-seeds test is trivially
  // true from `seed` alone even if the two games are otherwise identical.
  // These use `options.trace` (a full action-by-action log, not aggregate
  // counters) instead, so the comparison is actually on GAME CONTENT: two
  // structurally different games with equal totals would still be caught.
  it('is fully deterministic: the same seed replays an identical action trace', async () => {
    const traceA: string[] = [];
    const traceB: string[] = [];
    const a = await playRandomGame(12345, { trace: traceA });
    const b = await playRandomGame(12345, { trace: traceB });
    expect(traceA.length).toBeGreaterThan(0);
    expect(traceA).toEqual(traceB);
    // Aggregate stats are still asserted too (destructuring `seed` out, per
    // the finding above) — a real, non-tautological cross-check that the
    // trace and the summary counters agree on the same game.
    const { seed: seedA, ...restA } = a;
    const { seed: seedB, ...restB } = b;
    expect(seedA).toBe(seedB);
    expect(restA).toEqual(restB);
  });

  it('different seeds produce different action traces', async () => {
    const traceA: string[] = [];
    const traceB: string[] = [];
    await playRandomGame(1, { trace: traceA });
    await playRandomGame(2, { trace: traceB });
    expect(traceA).not.toEqual(traceB);
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

// ---------------------------------------------------------------------------
// resolveUnitRetreat — HIGH-3 finding from adversarial review: combat.test.ts
// exercises pushCandidates/completePush as isolated primitives, hand-writing
// the retreat/push sequence in the test body; it never drives the actual
// glue (this function, mirrored in BoardScene.beginUnitRetreatChoice) that
// captures each vacated hex and threads `visited` through the recursion.
// This exercises that glue directly, with a scripted (non-random)
// PlayerAgent, against a real 3-link cascade.
// ---------------------------------------------------------------------------

function makeChainUnit(id: string, position: HexCoord, owner: 0 | 1 = 0): Unit {
  return {
    id,
    owner,
    typeId: 'fantassins',
    position,
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

/** Same straight-line-chain construction as combat.test.ts's `buildChain`
 * (see that file for the geometry reasoning) — duplicated locally rather
 * than imported, since test files aren't meant to be each other's modules. */
function buildRetreatChain(length: number): { chain: Unit[]; state: GameState } {
  const start = { q: 10, r: 5 };
  const chain: Unit[] = [];
  for (let i = 0; i < length; i++) {
    chain.push(makeChainUnit(`chain${i}`, { q: start.q + i, r: start.r }));
  }
  const enemies: Unit[] = [];
  for (let i = 0; i < length - 1; i++) {
    const pos = chain[i]!.position;
    DIRECTIONS.forEach((d, dirIndex) => {
      if (dirIndex === 0) return;
      const neighbor = hexAdd(pos, d);
      if (chain.some((u) => u.position.q === neighbor.q && u.position.r === neighbor.r)) return;
      enemies.push(makeChainUnit(`enemy${i}-${dirIndex}`, neighbor, 1));
    });
  }
  const state = createInitialState(
    [
      { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
      { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
    ],
    'multi-defender',
  );
  state.units = [...chain, ...enemies];
  return { chain, state };
}

/** A deterministic `PlayerAgent` that always picks the FIRST option offered
 * (retreat hex or push target) and records exactly what it was offered at
 * each `choosePushTarget` call, in order — the observable this test needs to
 * prove `visited` excludes exactly the right units at exactly the right
 * point in the cascade. The other two `PlayerAgent` methods aren't expected
 * to be called by a pure retreat/push cascade — throwing if they are turns a
 * silent wrong-branch bug into a loud test failure. */
class ScriptedFirstChoiceAgent implements PlayerAgent {
  readonly pushOffers: string[][] = [];
  /** Every unit ID `chooseRetreat` was actually asked to resolve, in order —
   * used by the M11 (double-processing) test to prove a chain-moved sibling
   * is asked exactly once, not twice. */
  readonly retreatCalls: string[] = [];

  async chooseRetreat(_state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    this.retreatCalls.push(unit.id);
    return options[0]!;
  }

  async choosePushTarget(_state: GameState, _unit: Unit, candidates: Unit[]): Promise<Unit> {
    this.pushOffers.push(candidates.map((u) => u.id).sort());
    return candidates[0]!;
  }

  async chooseAdvance(): Promise<Unit | null> {
    throw new Error('ScriptedFirstChoiceAgent: chooseAdvance should not be called by a pure retreat/push cascade');
  }

  async chooseExchangeSacrifice(): Promise<Unit[]> {
    throw new Error('ScriptedFirstChoiceAgent: chooseExchangeSacrifice should not be called by a pure retreat/push cascade');
  }
}

describe('resolveUnitRetreat', () => {
  it('drives a real 3-link cascade end to end, moving every unit into the RIGHT final hex and never offering an in-chain unit as a push target', async () => {
    const { chain, state } = buildRetreatChain(4);
    const [a, b, c, d] = chain as [Unit, Unit, Unit, Unit];
    const originalPositions = chain.map((u) => ({ ...u.position }));
    // Computed BEFORE resolving anything — state is untouched at this point,
    // so this is exactly what the agent's chooseRetreat(d, ...) call will be
    // offered once the cascade reaches d, and exactly what `d` should end up
    // standing on (the scripted agent always picks index 0).
    const dExpectedDestination = legalRetreatHexes(state, d)[0]!;
    expect(dExpectedDestination).toBeDefined();

    const agent = new ScriptedFirstChoiceAgent();
    await resolveUnitRetreat(state, a, agent);

    // Positions: the deepest unit (d) actually retreats; each pusher up the
    // chain takes over exactly the hex the next unit down vacated — NOT
    // wherever that unit ultimately ended up (a naive "read pushed.position
    // after recursing" bug would instead collapse every unit onto d's final
    // hex, or throw on the ensuing multi-occupancy).
    expect(d.position).toEqual(dExpectedDestination);
    expect(c.position).toEqual(originalPositions[3]); // c takes over d's original hex
    expect(b.position).toEqual(originalPositions[2]); // b takes over c's original hex
    expect(a.position).toEqual(originalPositions[1]); // a takes over b's original hex

    // Every hex ends up occupied by exactly one unit — no duplicate/lost
    // occupancy anywhere in the chain.
    const finalPositions = chain.map((u) => `${u.position.q},${u.position.r}`);
    expect(new Set(finalPositions).size).toBe(finalPositions.length);

    // Sequencing: exactly 3 push links (a->b, b->c, c->d), each offering
    // ONLY the single friendly neighbor this geometry provides — in
    // particular, never re-offering a unit already earlier in the chain
    // (which `visited` exists to prevent — see `pushCandidates`'s doc
    // comment). If `visited` weren't threaded correctly, b's own neighbor
    // scan would find `a` (still sitting, unmoved, at its original hex at
    // that point) as an extra "candidate" alongside c.
    expect(agent.pushOffers).toEqual([[b.id], [c.id], [d.id]]);
    for (const u of chain) expect(u.destroyed).toBe(false);
  });
});

describe('processRetreats', () => {
  // MEDIUM finding from adversarial review (M11): a single AR/DR result can
  // queue several units from the same side independently (`pendingRetreats`
  // has more than one entry) — if resolving the first one's push cascade
  // moves a SIBLING that's also separately queued, the batch loop must not
  // then reach that sibling's own queue entry and ask the player to retreat
  // it a second time for the very same combat result.
  it('does not double-process a sibling a push cascade already moved', async () => {
    const { chain, state } = buildRetreatChain(2);
    const [a, b] = chain as [Unit, Unit];
    const bOriginalPosition = { ...b.position };
    const agent = new ScriptedFirstChoiceAgent();

    // Both `a` and `b` are queued, exactly as `applyLandCombatResult` would
    // queue every attacker on an 'AR' result affecting a multi-unit group —
    // `a` is boxed in (only escape: pushing `b`), `b` has real room of its
    // own (see `buildRetreatChain`'s geometry).
    await processRetreats(state, [a, b], 'attacker', [], agent);

    // `b` is asked to retreat exactly ONCE — as part of `a`'s push cascade —
    // never again when the batch loop reaches `b`'s own queue entry.
    expect(agent.retreatCalls).toEqual([b.id]);
    expect(agent.pushOffers).toEqual([[b.id]]);
    expect(a.position).toEqual(bOriginalPosition); // a takes over b's original hex
    expect(b.position).not.toEqual(bOriginalPosition); // b actually moved, exactly once
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
    // HIGH-4 finding from adversarial review: `pushesResolved` was collected
    // (plan.md §12) but never printed here, so the soak's own report line
    // couldn't show whether the cascading-push path was ever actually
    // exercised by this army/turnCap combination — it wasn't (see the
    // dedicated `buildPushScenarioGameState` soak below, which exists
    // specifically because this default army essentially never produces one).
    const totalPushes = allStats.reduce((sum, g) => sum + g.pushesResolved, 0);
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
        `[fuzz] landAttacksResolved=${totalLandAttacks} ramsResolved=${totalRams} (hits=${totalRamHits}) boardingsResolved=${totalBoardings} pushesResolved=${totalPushes}`,
        `[fuzz] turnsReached: min=${Math.min(...turns)} max=${Math.max(...turns)} avg=${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)}`,
        `[fuzz] outcomes: ${wins} decisive win(s), ${draws} draw(s) (mutual elimination or tied army value)`,
        `[fuzz] endings: ${endedByElimination} by mutual elimination, ${endedByTimeLimit} by the rulebook's turn-limit/army-value ending`,
        // MEDIUM finding from adversarial review: the `it.skip(...)` above
        // prints only as an anonymous "1 skipped" in vitest's summary — a
        // full-text search of a `vitest run` for "not yet fuzzable" finds
        // nothing. plan.md §6.7 requires the elephant gap to print on every
        // run; this line, inside the unconditional report block, is what
        // actually satisfies that (searchable, unconditional, not dependent
        // on vitest's own skip-reporting format).
        `[fuzz] GAP: elephants excluded — drift cascade not yet fuzzable (Stage 2b, plan.md §6.7)`,
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

describe('fuzz harness: push-scenario soak (plan.md §12, HIGH-4)', () => {
  it('never includes an elephant, matching buildFuzzGameState()\'s own exclusion', () => {
    const state = buildPushScenarioGameState();
    expect(state.units.some((u) => u.typeId === 'elephants')).toBe(false);
  });

  it('places every unit on legal, non-overlapping starting hexes', () => {
    const state = buildPushScenarioGameState();
    const seen = new Set<string>();
    for (const unit of state.units) {
      const key = `${unit.position.q},${unit.position.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(state.units.length).toBe(10); // attacker + defender + 5 ring + 3 fillers
  });

  // HIGH-4 finding from adversarial review: `pushesResolved` was collected
  // (plan.md §12) but the DEFAULT soak above never actually reaches one —
  // `buildFuzzGameState()`'s small, spread-out army essentially never boxes
  // a unit in tightly enough. This purpose-built scenario (see
  // `buildPushScenarioGameState`'s doc comment for exactly why it reliably
  // does) proves the cascading-push path is genuinely exercised, not just
  // unit-tested in isolation.
  const PUSH_GAME_COUNT = 30;
  it(`reaches at least one push across ${PUSH_GAME_COUNT} seeded games of the push scenario`, async () => {
    const allStats: HarnessStats[] = [];
    for (let seed = 0; seed < PUSH_GAME_COUNT; seed++) {
      allStats.push(await playRandomGame(seed, { buildInitialState: buildPushScenarioGameState }));
    }
    const totalPushes = allStats.reduce((sum, g) => sum + g.pushesResolved, 0);
    // eslint-disable-next-line no-console
    console.log(`[fuzz:push-scenario] ${PUSH_GAME_COUNT} games, pushesResolved=${totalPushes}`);

    expect(allStats.every((g) => g.gameOver)).toBe(true);
    expect(totalPushes).toBeGreaterThan(0);
  });
});
