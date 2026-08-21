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
  type DriftStats,
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

  // Stage 2c (plan.md §6.7). `canElephantEnterHex` was widened to reject
  // MARSH — terrain the rulebook forbids elephants unconditionally ("chars,
  // cavaleries et éléphants ne peuvent accéder aux marais",
  // docs/research/05-rules-french-original.md:186-188) — which widened this
  // same elimination branch. Two things are pinned here, because the rule
  // half would pass on its own while the player-facing half quietly lied:
  //
  // 1. the elephant really is eliminated by drifting into marsh, and
  // 2. the combat-log line SAYS marsh. Before this, the branch emitted a
  //    fixed "drifts off the map or into the sea" string (and an event named
  //    `eliminatedOffMapOrSea`), so a marsh elimination narrated something
  //    that had not happened. No existing test could fail on that, which is
  //    exactly why it is asserted rather than left to review.
  //
  // (6,15) is 'plain' and (7,15) is 'marsh' on the shipped map, and a
  // direction die of 1 is DIRECTIONS[0] = {q:1,r:0} — so this walks one hex
  // east, straight off the land zone, with no other terrain in the way.
  it('eliminates an elephant that drifts into marsh, and says so', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', { q: 6, r: 15 });
    const state = makeState([elephant]);
    const lines: string[] = [];

    await resolveElephantDrift(state, elephant, 1, new ScriptedAgent(), () => 1, {
      onLine: (line) => lines.push(line),
    });

    expect(elephant.destroyed).toBe(true);
    expect(lines.some((l) => l.includes('into the marsh') && l.includes('eliminated'))).toBe(true);
    // ...and does NOT reach for the old sea/off-map wording, which is the
    // half a looser `includes('eliminated')` assertion would have missed.
    expect(lines.some((l) => l.includes('into the sea') || l.includes('off the map'))).toBe(false);
  });

  it('re-rolls a forbidden reverse direction without consuming movement', () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const state = makeState([elephant]);
    currentDrift = startElephantDrift(elephant, 1, DIRECTIONS[0]);
    const events: DriftEvent[] = [];

    pumpStep(state, undefined, events);
    pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events);
    // Since the review-2 CRITICAL fix, `driftStep` returns after moving into
    // this single hex — it does not also resolve "movement exhausted" in the
    // same call — so completing this one-step drift takes one more `pumpStep`
    // with no input than it used to.
    const movedResult = pumpStep(state, { kind: 'directionRoll', dieRoll: 2 }, events);
    expect(movedResult.done).toBe(false);
    expect(elephant.position).toEqual({ q: 11, r: 4 });

    const result = pumpStep(state, undefined, events);

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

  // plan.md §21 — "pause between steps and show the drift direction on the
  // map". These four pin the contract the design brief cares about most:
  // a presentation layer's OPTIONAL `onStep`/`onDirectionRolled`/
  // `onDriftMoved` hooks must (1) leave every headless caller — the fuzz
  // harness, `heuristicSoak.test.ts`, AI-vs-AI `BoardScene` turns, none of
  // which supply them — completely unaffected, and (2) actually pause the
  // cascade, one beat at a time, for the one caller that DOES supply them.
  describe('presentation hooks (plan.md §21)', () => {
    it('resolves within the same task when no onStep hook is supplied — no macrotask delay added', async () => {
      const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
      const state = makeState([elephant]);
      let macrotaskFired = false;
      setTimeout(() => {
        macrotaskFired = true;
      }, 0);

      await resolveElephantDrift(state, elephant, 2, new ScriptedAgent(), () => 1);

      // If `resolveElephantDrift` ever grew a hidden macrotask-based delay
      // (a `setTimeout`, a `requestAnimationFrame`, etc.) rather than only
      // ever awaiting a caller-supplied Promise, this `setTimeout(0)` queued
      // BEFORE the call would have had time to fire by the time the awaited
      // drift settles. It hasn't: the whole cascade above completed on pure
      // microtasks, same as before this hook existed.
      expect(macrotaskFired).toBe(false);
      expect(elephant.position).toEqual({ q: 12, r: 5 });
    });

    it('produces an identical event trace and stats whether onStep is a no-op or simply absent', async () => {
      const withoutHook = makeUnit('e1', 0, 'elephants', CENTER);
      const stateWithoutHook = makeState([withoutHook]);
      const statsWithoutHook: DriftStats = { driftsResolved: 0, driftCombatsResolved: 0 };
      await resolveElephantDrift(
        stateWithoutHook,
        withoutHook,
        4,
        new ScriptedAgent(),
        () => 1,
        {},
        undefined,
        statsWithoutHook,
      );

      const withNoOpHook = makeUnit('e2', 0, 'elephants', CENTER);
      const stateWithNoOpHook = makeState([withNoOpHook]);
      const statsWithNoOpHook: DriftStats = { driftsResolved: 0, driftCombatsResolved: 0 };
      let stepCalls = 0;
      await resolveElephantDrift(
        stateWithNoOpHook,
        withNoOpHook,
        4,
        new ScriptedAgent(),
        () => 1,
        {
          onStep: () => {
            stepCalls++;
          },
        },
        undefined,
        statsWithNoOpHook,
      );

      expect(withNoOpHook.position).toEqual(withoutHook.position);
      expect(statsWithNoOpHook).toEqual(statsWithoutHook);
      // ...but onStep itself was genuinely invoked — proving the identical
      // outcome above is because the hook is inert when synchronous, not
      // because it silently never ran.
      expect(stepCalls).toBeGreaterThan(0);
    });

    it('pauses the cascade at each step until the onStep hook\'s returned promise resolves', async () => {
      const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
      const state = makeState([elephant]);
      const pendingResolvers: Array<() => void> = [];
      let settled = false;

      const donePromise = resolveElephantDrift(state, elephant, 2, new ScriptedAgent(), () => 1, {
        onStep: () => new Promise<void>((resolve) => pendingResolvers.push(resolve)),
      });
      void donePromise.then(() => {
        settled = true;
      });

      // Flush pending microtasks without resolving anything: the drift
      // should be stuck at its first pause (right after `driftStarted`),
      // having not moved the elephant at all yet.
      await Promise.resolve();
      await Promise.resolve();
      expect(pendingResolvers.length).toBeGreaterThan(0);
      expect(elephant.position).toEqual(CENTER);
      expect(settled).toBe(false);

      // Resolve each pause as it appears, one at a time, until the whole
      // drift finishes — if `onStep` weren't genuinely awaited (rather than
      // just called and ignored), the cascade would already have run to
      // completion above, before any of these resolves.
      let guard = 0;
      while (!settled) {
        if (++guard > 100) throw new Error('drift never settled — onStep is not actually pausing it');
        const resolve = pendingResolvers.shift();
        if (resolve) resolve();
        await Promise.resolve();
      }

      expect(elephant.position).toEqual({ q: 12, r: 5 });
    });

    it('fires onDirectionRolled/onDriftMoved with the drifting elephant and its real direction/position', async () => {
      const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
      const state = makeState([elephant]);
      const directionCalls: { id: string; direction: HexCoord }[] = [];
      const moveCalls: { id: string; hex: HexCoord }[] = [];

      await resolveElephantDrift(state, elephant, 2, new ScriptedAgent(), () => 1, {
        onDirectionRolled: (u, direction) => directionCalls.push({ id: u.id, direction }),
        onDriftMoved: (u, hex) => moveCalls.push({ id: u.id, hex }),
      });

      expect(directionCalls).toEqual([{ id: 'elephant', direction: DIRECTIONS[0] }]);
      expect(moveCalls).toEqual([
        { id: 'elephant', hex: { q: 11, r: 5 } },
        { id: 'elephant', hex: { q: 12, r: 5 } },
      ]);
    });
  });
});
