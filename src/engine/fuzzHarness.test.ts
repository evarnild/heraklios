import { describe, it, expect } from 'vitest';
import {
  playRandomGame,
  buildFuzzGameState,
  buildPushScenarioGameState,
  buildElephantScenarioGameState,
  resolveUnitRetreat,
  processRetreats,
  processDrifts,
  capturePendingResolutionItems,
  type HarnessStats,
} from './fuzzHarness';
import type { Action } from './actions';
import type { CombatResult } from '../data/combatTable';
import type { HexCoord } from '../data/map';
import { describeLandAttack, legalRetreatHexes, pushCandidates, resolveLandAttack } from './combat';
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

  // The default soak still keeps elephants out so its historical action mix
  // stays stable. Stage 2b gives pendingDrifts an engine driver; Stage 2c
  // can broaden buildFuzzGameState() itself and require non-zero drift stats
  // from ordinary seeded self-play.
  it.skip('elephants: default self-play army still excludes elephants until Stage 2c broadens coverage', () => {
    // Kept as an explicit queue marker rather than a failing requirement:
    // processDrifts and engine/drift.test.ts cover the extracted cascade now,
    // while default self-play army composition remains a separate Stage 2c task.
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

function dieForResult(attacker: Unit, defender: Unit, result: CombatResult): number {
  for (let die = 1; die <= 6; die++) {
    if (describeLandAttack([attacker], [defender], die).result === result) return die;
  }
  throw new Error(`No die produces ${result} for ${attacker.typeId} vs ${defender.typeId}`);
}

function rngFromDice(dice: number[]): () => number {
  return () => {
    const die = dice.shift();
    if (die === undefined) throw new Error('rngFromDice: no scripted die left');
    return (die - 1) / 6;
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
    // ONLY the single friendly neighbor this geometry provides.
    //
    // NOTE this does NOT prove `visited` is threaded correctly, though an
    // earlier version of this comment claimed it did (caught by independent
    // review of §12; see plan.md's queue item #0). In a straight line, `a` is
    // not adjacent to `c`, so when the cascade reaches `b`, `a` fails
    // `pushCandidates`'s `canMakeRoom` fixpoint on its own merits — it would
    // be excluded even if the guard were removed. The test below uses a
    // BRANCHING geometry, which is what actually kills that mutant.
    expect(agent.pushOffers).toEqual([[b.id], [c.id], [d.id]]);
    for (const u of chain) expect(u.destroyed).toBe(false);
  });

  it('never offers a unit already in the chain, even when it would otherwise qualify', async () => {
    // The real cycle-guard test. `d` is the branch: it hangs off `a` (and is
    // NOT adjacent to `b`), and it has room of its own. That makes `a` itself
    // a `canMakeRoom` unit — so when the cascade recurses into `b`, `a` is a
    // friendly neighbour that passes the fixpoint on merit and is excluded
    // ONLY because the grown `chainVisited` carries it down.
    //
    //          enemies all around a and b except along the chain
    //     d(9,5) — a(10,5) — b(11,5) — c(12,5) → open ground
    //
    // Mutate `resolveUnitRetreat` to pass the caller's `visited` instead of
    // `chainVisited` and b's offer becomes [a, c]: the cascade would be free
    // to push a unit that is still mid-resolution higher up the stack.
    const a = makeChainUnit('a', { q: 10, r: 5 });
    const b = makeChainUnit('b', { q: 11, r: 5 });
    const c = makeChainUnit('c', { q: 12, r: 5 });
    const d = makeChainUnit('d', { q: 9, r: 5 });
    const enemyHexes = [
      { q: 11, r: 4 }, { q: 10, r: 4 }, { q: 9, r: 6 }, { q: 10, r: 6 }, // box in `a`
      { q: 12, r: 4 }, { q: 11, r: 6 }, // box in `b`
    ];
    const enemies = enemyHexes.map((hex, i) => makeChainUnit(`enemy${i}`, hex, 1));
    const state = createInitialState(
      [
        { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
        { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
      ],
      'multi-defender',
    );
    state.units = [a, b, c, d, ...enemies];

    // Preconditions, asserted rather than assumed — if a map edit ever gives
    // `a` or `b` an escape, or takes `d`'s away, this test would quietly stop
    // testing the thing it is named for.
    expect(legalRetreatHexes(state, a)).toHaveLength(0);
    expect(legalRetreatHexes(state, b)).toHaveLength(0);
    expect(legalRetreatHexes(state, c).length).toBeGreaterThan(0);
    expect(legalRetreatHexes(state, d).length).toBeGreaterThan(0);
    // The branch is what makes this discriminating: `a` qualifies as a push
    // target in its own right (via `d`), so only the visited set can exclude it.
    expect(pushCandidates(state, b).map((u) => u.id).sort()).toEqual(['a', 'c']);

    const agent = new ScriptedFirstChoiceAgent();
    await resolveUnitRetreat(state, a, agent);

    // a is offered both its friendlies; b is offered ONLY c — never `a`.
    expect(agent.pushOffers).toEqual([['b', 'd'], ['c']]);
    for (const u of [a, b, c, d]) expect(u.destroyed).toBe(false);
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

  it('shares resolved ids with the drift queue when a retreat pushes a pending elephant drift', async () => {
    const { chain, state } = buildRetreatChain(2);
    const [retreater, elephant] = chain as [Unit, Unit];
    elephant.typeId = 'elephants';
    const elephantOriginalPosition = { ...elephant.position };
    const agent = new ScriptedFirstChoiceAgent();
    const stats: HarnessStats = {
      seed: 0,
      gameOver: false,
      winnerId: null,
      endedByTimeLimit: false,
      turnsReached: 1,
      totalActions: 0,
      actionsByKind: {},
      landAttacksResolved: 0,
      combatResultCounts: {},
      ramsResolved: 0,
      ramHits: 0,
      boardingsResolved: 0,
      driftsResolved: 0,
      driftCombatsResolved: 0,
      pushesResolved: 0,
      multiAttackerAttacks: 0,
      finalArmyValues: {},
    };
    const resolvedIds = new Set<string>();

    await processRetreats(state, [retreater], 'attacker', [], agent, stats, resolvedIds);
    await processDrifts(state, [elephant], 'attacker', [], agent, () => 0, stats, resolvedIds);

    expect(stats.pushesResolved).toBe(1);
    expect(stats.driftsResolved).toBe(0);
    expect(elephant.position).not.toEqual(elephantOriginalPosition);
  });

  it('still offers defender advance when skipping a retreat item already resolved by a sibling cascade', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const attacker = makeChainUnit('attacker', { q: 9, r: 5 }, 0);
    const defender = makeChainUnit('defender', { q: 10, r: 5 }, 1);
    const originalHex = { ...defender.position };
    const [pendingDefender] = capturePendingResolutionItems([defender]);
    defender.position = { q: 10, r: 4 };
    state.units = [attacker, defender];
    const advanceOffers: HexCoord[] = [];
    const agent: PlayerAgent = {
      async chooseRetreat() {
        throw new Error('skip-path test should not ask for a retreat');
      },
      async choosePushTarget() {
        throw new Error('skip-path test should not ask for a push target');
      },
      async chooseAdvance(_state, candidates, vacated) {
        advanceOffers.push({ ...vacated });
        return candidates[0]!;
      },
      async chooseExchangeSacrifice(_state, attackers) {
        return [attackers[0]!];
      },
    };
    const resolvedIds = new Set([defender.id]);

    await processRetreats(state, [pendingDefender!], 'defender', [attacker], agent, undefined, resolvedIds);

    expect(advanceOffers).toEqual([originalHex]);
    expect(attacker.position).toEqual(originalHex);
  });
});

describe('processDrifts', () => {
  it('pumps pending elephant drifts and records drift coverage stats', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const elephant = makeChainUnit('elephant', { q: 10, r: 5 });
    elephant.typeId = 'elephants';
    state.units = [elephant];
    const stats: HarnessStats = {
      seed: 0,
      gameOver: false,
      winnerId: null,
      endedByTimeLimit: false,
      turnsReached: 1,
      totalActions: 0,
      actionsByKind: {},
      landAttacksResolved: 0,
      combatResultCounts: {},
      ramsResolved: 0,
      ramHits: 0,
      boardingsResolved: 0,
      driftsResolved: 0,
      driftCombatsResolved: 0,
      pushesResolved: 0,
      multiAttackerAttacks: 0,
      finalArmyValues: {},
    };

    await processDrifts(state, [elephant], 'attacker', [], new ScriptedFirstChoiceAgent(), () => 0, stats);

    expect(stats.driftsResolved).toBe(1);
    expect(stats.driftCombatsResolved).toBe(0);
    expect(elephant.position).toEqual({ q: 14, r: 5 });
  });

  it('does not process an elephant twice when an earlier queued drift tramples it into a nested drift', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const original = makeChainUnit('original', { q: 10, r: 5 });
    original.typeId = 'elephants';
    const nested = makeChainUnit('nested', { q: 11, r: 5 }, 1);
    nested.typeId = 'elephants';
    state.units = [original, nested];
    const stats: HarnessStats = {
      seed: 0,
      gameOver: false,
      winnerId: null,
      endedByTimeLimit: false,
      turnsReached: 1,
      totalActions: 0,
      actionsByKind: {},
      landAttacksResolved: 0,
      combatResultCounts: {},
      ramsResolved: 0,
      ramHits: 0,
      boardingsResolved: 0,
      driftsResolved: 0,
      driftCombatsResolved: 0,
      pushesResolved: 0,
      multiAttackerAttacks: 0,
      finalArmyValues: {},
    };
    const dice = [1, dieForResult(original, nested, 'DR'), 4, 2];

    await processDrifts(state, [original, nested], 'attacker', [], new ScriptedFirstChoiceAgent(), rngFromDice(dice), stats);

    expect(stats.driftsResolved).toBe(2);
    expect(stats.driftCombatsResolved).toBe(1);
    expect(original.position).toEqual({ q: 14, r: 5 });
    expect(nested.position).toEqual({ q: 15, r: 1 });
    expect(dice).toEqual([]);
  });

  it('counts push cascades triggered by a trampled non-elephant during drift', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const elephant = makeChainUnit('elephant', { q: 9, r: 5 }, 1);
    elephant.typeId = 'elephants';
    const trampled = makeChainUnit('trampled', { q: 10, r: 5 }, 0);
    trampled.typeId = 'phalanges';
    const pushed = makeChainUnit('pushed', { q: 10, r: 4 }, 0);
    const blocker = makeChainUnit('blocker', { q: 11, r: 5 }, 1);
    state.units = [
      elephant,
      trampled,
      pushed,
      blocker,
      makeChainUnit('enemy-ne', { q: 11, r: 4 }, 1),
      makeChainUnit('enemy-sw', { q: 9, r: 6 }, 1),
      makeChainUnit('enemy-s', { q: 10, r: 6 }, 1),
    ];
    const stats: HarnessStats = {
      seed: 0,
      gameOver: false,
      winnerId: null,
      endedByTimeLimit: false,
      turnsReached: 1,
      totalActions: 0,
      actionsByKind: {},
      landAttacksResolved: 0,
      combatResultCounts: {},
      ramsResolved: 0,
      ramHits: 0,
      boardingsResolved: 0,
      driftsResolved: 0,
      driftCombatsResolved: 0,
      pushesResolved: 0,
      multiAttackerAttacks: 0,
      finalArmyValues: {},
    };
    const agent: PlayerAgent = {
      async chooseRetreat(_state, unit, options) {
        return options.find((hex) => hex.r !== unit.position.r) ?? options[0]!;
      },
      async choosePushTarget(_state, _unit, candidates) {
        return candidates[0]!;
      },
      async chooseAdvance() {
        return null;
      },
      async chooseExchangeSacrifice(_state, attackers) {
        return [attackers[0]!];
      },
    };
    const dice = [1, dieForResult(elephant, trampled, 'DR'), dieForResult(elephant, blocker, 'DE')];

    await processDrifts(state, [elephant], 'attacker', [], agent, rngFromDice(dice), stats);

    expect(stats.pushesResolved).toBe(1);
    expect(pushed.position).not.toEqual({ q: 10, r: 4 });
  });

  it('does not double-process a pending elephant pushed by a drift-triggered retreat', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const elephant = makeChainUnit('elephant', { q: 9, r: 5 }, 1);
    elephant.typeId = 'elephants';
    const trampled = makeChainUnit('trampled', { q: 10, r: 5 }, 0);
    trampled.typeId = 'phalanges';
    const queuedElephant = makeChainUnit('queued-elephant', { q: 10, r: 4 }, 0);
    queuedElephant.typeId = 'elephants';
    const blocker = makeChainUnit('blocker', { q: 11, r: 5 }, 1);
    state.units = [
      elephant,
      trampled,
      queuedElephant,
      blocker,
      makeChainUnit('enemy-ne', { q: 11, r: 4 }, 1),
      makeChainUnit('enemy-sw', { q: 9, r: 6 }, 1),
      makeChainUnit('enemy-s', { q: 10, r: 6 }, 1),
    ];
    const stats: HarnessStats = {
      seed: 0,
      gameOver: false,
      winnerId: null,
      endedByTimeLimit: false,
      turnsReached: 1,
      totalActions: 0,
      actionsByKind: {},
      landAttacksResolved: 0,
      combatResultCounts: {},
      ramsResolved: 0,
      ramHits: 0,
      boardingsResolved: 0,
      driftsResolved: 0,
      driftCombatsResolved: 0,
      pushesResolved: 0,
      multiAttackerAttacks: 0,
      finalArmyValues: {},
    };
    const agent: PlayerAgent = {
      async chooseRetreat(_state, unit, options) {
        return options.find((hex) => hex.r !== unit.position.r) ?? options[0]!;
      },
      async choosePushTarget(_state, _unit, candidates) {
        return candidates[0]!;
      },
      async chooseAdvance() {
        return null;
      },
      async chooseExchangeSacrifice(_state, attackers) {
        return [attackers[0]!];
      },
    };
    const dice = [1, dieForResult(elephant, trampled, 'DR'), dieForResult(elephant, blocker, 'DE')];

    await processDrifts(state, [elephant, queuedElephant], 'attacker', [], agent, rngFromDice(dice), stats);

    expect(stats.driftsResolved).toBe(1);
    expect(stats.pushesResolved).toBe(1);
    expect(queuedElephant.position).not.toEqual({ q: 10, r: 4 });
    expect(dice).toEqual([]);
  });

  it('still offers defender advance when skipping a drift item already resolved by a sibling cascade', async () => {
    const players = [
      { id: 0 as const, name: 'P0', edge: 'W' as const, purchasePoints: 0, eliminated: false },
      { id: 1 as const, name: 'P1', edge: 'E' as const, purchasePoints: 0, eliminated: false },
    ];
    const state = createInitialState(players, 'multi-defender');
    const attacker = makeChainUnit('attacker', { q: 9, r: 5 }, 0);
    const elephant = makeChainUnit('elephant', { q: 10, r: 5 }, 1);
    elephant.typeId = 'elephants';
    const originalHex = { ...elephant.position };
    const [pendingElephant] = capturePendingResolutionItems([elephant]);
    elephant.position = { q: 10, r: 4 };
    state.units = [attacker, elephant];
    const advanceOffers: HexCoord[] = [];
    const agent: PlayerAgent = {
      async chooseRetreat() {
        throw new Error('skip-path test should not ask for a retreat');
      },
      async choosePushTarget() {
        throw new Error('skip-path test should not ask for a push target');
      },
      async chooseAdvance(_state, candidates, vacated) {
        advanceOffers.push({ ...vacated });
        return candidates[0]!;
      },
      async chooseExchangeSacrifice(_state, attackers) {
        return [attackers[0]!];
      },
    };
    const resolvedIds = new Set([elephant.id]);

    await processDrifts(
      state,
      [pendingElephant!],
      'defender',
      [attacker],
      agent,
      () => {
        throw new Error('skip-path test should not roll drift dice');
      },
      undefined,
      resolvedIds,
    );

    expect(advanceOffers).toEqual([originalHex]);
    expect(attacker.position).toEqual(originalHex);
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
    const totalDrifts = allStats.reduce((sum, g) => sum + g.driftsResolved, 0);
    const totalDriftCombats = allStats.reduce((sum, g) => sum + g.driftCombatsResolved, 0);
    // HIGH-4 finding from adversarial review: `pushesResolved` was collected
    // (plan.md §12) but never printed here, so the soak's own report line
    // couldn't show whether the cascading-push path was ever actually
    // exercised by this army/turnCap combination — it wasn't (see the
    // dedicated `buildPushScenarioGameState` soak below, which exists
    // specifically because this default army essentially never produces one).
    const totalPushes = allStats.reduce((sum, g) => sum + g.pushesResolved, 0);
    // Always 0 for THIS soak, and printed anyway — see the report line below.
    const totalMultiAttacker = allStats.reduce((sum, g) => sum + g.multiAttackerAttacks, 0);
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
        `[fuzz] landAttacksResolved=${totalLandAttacks} ramsResolved=${totalRams} (hits=${totalRamHits}) boardingsResolved=${totalBoardings} pushesResolved=${totalPushes} driftsResolved=${totalDrifts} driftCombatsResolved=${totalDriftCombats}`,
        `[fuzz] turnsReached: min=${Math.min(...turns)} max=${Math.max(...turns)} avg=${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)}`,
        `[fuzz] outcomes: ${wins} decisive win(s), ${draws} draw(s) (mutual elimination or tied army value)`,
        `[fuzz] endings: ${endedByElimination} by mutual elimination, ${endedByTimeLimit} by the rulebook's turn-limit/army-value ending`,
        // MEDIUM finding from adversarial review: the `it.skip(...)` above
        // prints only as an anonymous "1 skipped" in vitest's summary — a
        // full-text search of a `vitest run` should still show the Stage 2c
        // default-army elephant coverage gap explicitly.
        // run; this line, inside the unconditional report block, is what
        // actually satisfies that (searchable, unconditional, not dependent
        // on vitest's own skip-reporting format).
        `[fuzz] GAP: elephants excluded from default self-play until Stage 2c broadens army coverage; dedicated drift tests now exercise the extracted cascade`,
        // The other coverage gap plan.md §6.8 names, reported the same way
        // and for the same reason: a number that reads 0 forever is only
        // honest if it is visible. It is 0 here BY CONSTRUCTION —
        // `legalActions` enumerates one-attacker attacks only — so this line
        // is not a defect report, it is a pointer to where the coverage
        // actually comes from now that Stage 3 exists.
        `[fuzz] multiAttackerAttacks=${totalMultiAttacker} (structurally 0: legalActions is singleton-only — combined attacks are covered by heuristicSoak.test.ts)`,
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

  // The DETERMINISTIC half of the push-scenario guarantee, and the one to
  // read first when the soak below goes to zero.
  //
  // plan.md §12's third open finding was that the soak is a thin canary: it
  // reached 4 pushes in 30 seeded games against a `> 0` assertion, so any
  // change to RNG consumption could drop it to 0 and read as a regression in
  // the push code when nothing about the push code had changed. This test
  // removes the RNG from the question entirely by asserting the PROPERTY the
  // scenario exists to create, straight off the freshly-built state: a unit
  // with no legal retreat whose only way out is pushing a friendly.
  //
  // So the two tests fail for different reasons, which is the point. This one
  // failing means the scenario builder stopped boxing the defender in. The
  // soak failing while this passes means self-play stopped *reaching* the
  // situation — re-tune the seeds, don't go looking for a bug in
  // `pushCandidates`.
  it('builds a state where a unit is already push-or-die, with no dice involved', () => {
    const state = buildPushScenarioGameState();
    const boxedIn = state.units.find((u) => u.id === 'defender')!;
    expect(legalRetreatHexes(state, boxedIn)).toHaveLength(0);
    expect(pushCandidates(state, boxedIn).length).toBeGreaterThan(0);
  });

  // HIGH-4 finding from adversarial review: `pushesResolved` was collected
  // (plan.md §12) but the DEFAULT soak above never actually reaches one —
  // `buildFuzzGameState()`'s small, spread-out army essentially never boxes
  // a unit in tightly enough. This purpose-built scenario (see
  // `buildPushScenarioGameState`'s doc comment for exactly why it reliably
  // does) proves the cascading-push path is genuinely exercised end to end,
  // not just unit-tested in isolation.
  //
  // 100 seeds rather than the original 30: measured 8 pushes across 8 distinct
  // seeds versus 4 across 4, for ~330ms more runtime — twice the margin above
  // zero for a cost that doesn't register against this file's soak. The count
  // is low because a push needs a forced retreat to land on the one boxed-in
  // unit, which a uniform-random agent reaches rarely even here.
  const PUSH_GAME_COUNT = 100;
  it(`reaches at least one push across ${PUSH_GAME_COUNT} seeded games of the push scenario`, async () => {
    const allStats: HarnessStats[] = [];
    for (let seed = 0; seed < PUSH_GAME_COUNT; seed++) {
      allStats.push(await playRandomGame(seed, { buildInitialState: buildPushScenarioGameState }));
    }
    const totalPushes = allStats.reduce((sum, g) => sum + g.pushesResolved, 0);
    const seedsWithPush = allStats.filter((g) => g.pushesResolved > 0).length;
    // Both numbers, not just the total, and both ASSERTED below rather than
    // only printed — the first version of this logged the seed spread under a
    // comment describing it as a guard, which independent review pointed out
    // was a print pretending to be a guarantee. The collapse it warns about
    // (total holding up while the pushes bunch onto one lucky seed) really
    // would have passed silently.
    // eslint-disable-next-line no-console
    console.log(
      `[fuzz:push-scenario] ${PUSH_GAME_COUNT} games, pushesResolved=${totalPushes} across ${seedsWithPush} seed(s)`,
    );

    expect(allStats.every((g) => g.gameOver)).toBe(true);
    expect(
      totalPushes,
      'no push reached in self-play — if the push-or-die test above still passes, the scenario is fine and the RNG flow changed; re-tune PUSH_GAME_COUNT rather than hunting pushCandidates',
    ).toBeGreaterThan(0);
    // Costs no extra brittleness at the current margin (8 seeds against a
    // floor of 1) and closes the gap between what the comment above claims
    // and what actually fails the run.
    expect(
      seedsWithPush,
      'every push in this soak came from a single seed — coverage has narrowed, even though the total still looks healthy',
    ).toBeGreaterThan(1);
  });
});
