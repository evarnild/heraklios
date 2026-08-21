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

    // Since the review-3 round-3 self-audit fix, the `stopped` branch also
    // returns immediately rather than resolving "no more frames" in the same
    // call — so this now takes one more `pumpStep` with no input than it did
    // even after the review-2 CRITICAL fix above.
    const stoppedResult = pumpStep(state, undefined, events);
    expect(stoppedResult.done).toBe(false);
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
    const positionsAtPause: HexCoord[] = [];

    await resolveElephantDrift(state, elephant, 4, agent, () => dice.shift()!, {
      onStep: () => {
        positionsAtPause.push({ ...elephant.position });
      },
    });

    expect(agent.retreatCalls.map((u) => u.id)).toEqual(['defender']);
    expect(defender.destroyed).toBe(false);
    expect(defender.position).not.toEqual({ q: 11, r: 5 });
    expect(elephant.position).toEqual({ q: 14, r: 5 });

    // Regression (review-3): `continueAfterVacated` — the resumption point
    // after the trampled defender's retreat clears {11,5} — used to `continue`
    // the outer loop instead of returning, so its freshly-pushed continuation
    // frame (already carrying a resolved `direction`) would advance a FURTHER
    // hex in the very same `driftStep` call, before any pause ever showed the
    // elephant sitting at {11,5}. Collapse consecutive duplicate pause
    // positions and assert {11,5} shows up as its own distinct step, ahead of
    // {12,5} — not skipped over.
    const distinctInOrder: HexCoord[] = [];
    for (const pos of positionsAtPause) {
      const last = distinctInOrder[distinctInOrder.length - 1];
      if (!last || last.q !== pos.q || last.r !== pos.r) distinctInOrder.push(pos);
    }
    expect(distinctInOrder).toEqual([
      { q: 10, r: 5 },
      { q: 11, r: 5 },
      { q: 12, r: 5 },
      { q: 13, r: 5 },
      { q: 14, r: 5 },
    ]);
  });

  // Regression (review-3): the `DE` combat result (defender eliminated, the
  // elephant enters the now-empty hex) mutated `elephant.position` and pushed
  // its continuation frame, then `break`-ed into the SAME `driftStep` call's
  // free-run loop — which, since that continuation frame already carries a
  // resolved `direction`, immediately advanced a FURTHER hex before ever
  // returning. Same bug class as the CRITICAL free-run fix and the DR case
  // above; mirrors the CRITICAL regression test's shape but for a `DE` result,
  // which nothing in this file exercised before.
  it('does not advance past the hex it just entered on a DE combat result before the next pause', async () => {
    const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
    const defender = makeUnit('defender', 1, 'fantassins', { q: 11, r: 5 });
    const state = makeState([elephant, defender]);
    const combatDie = dieForResult(elephant, defender, 'DE');
    const dice = [1, combatDie];
    const positionsAtPause: HexCoord[] = [];

    await resolveElephantDrift(state, elephant, 3, new ScriptedAgent(), () => dice.shift()!, {
      onStep: () => {
        positionsAtPause.push({ ...elephant.position });
      },
    });

    expect(elephant.destroyed).toBe(false);
    expect(defender.destroyed).toBe(true);
    expect(elephant.position).toEqual({ q: 13, r: 5 });

    const distinctInOrder: HexCoord[] = [];
    for (const pos of positionsAtPause) {
      const last = distinctInOrder[distinctInOrder.length - 1];
      if (!last || last.q !== pos.q || last.r !== pos.r) distinctInOrder.push(pos);
    }
    // Before the fix, this list would jump straight from {10,5} to {12,5} (or
    // further) — skipping over {11,5}, the hex the elephant just entered by
    // eliminating the defender, entirely.
    expect(distinctInOrder).toEqual([
      { q: 10, r: 5 },
      { q: 11, r: 5 },
      { q: 12, r: 5 },
      { q: 13, r: 5 },
    ]);
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

  // Review-2 LOW note 1. On resuming `original`'s frame after `nested`'s own
  // re-drift finishes, `original` used to just silently reuse its
  // already-rolled direction with no hook call at all — so a presentation
  // layer's direction arrow, having followed `nested`'s roll(s) mid-cascade,
  // would never switch back to `original` once play returned to it. Fixed by
  // pushing a `directionResumed` event (see `driftStep`'s `continueAfterVacated`
  // branch) that re-fires `onDirectionRolled` with no new die involved.
  it('re-emits onDirectionRolled for the outer elephant when it resumes after a nested trampled elephant finishes its own drift', async () => {
    const original = makeUnit('original', 0, 'elephants', CENTER);
    const nested = makeUnit('nested', 1, 'elephants', { q: 11, r: 5 });
    const state = makeState([original, nested]);
    const combatDie = dieForResult(original, nested, 'DR');
    const dice = [1, combatDie, 4, 2];
    const directionCalls: { id: string; direction: HexCoord }[] = [];

    await resolveElephantDrift(state, original, 4, new ScriptedAgent(), () => dice.shift()!, {
      onDirectionRolled: (u, direction) => directionCalls.push({ id: u.id, direction }),
    });

    const originalCalls = directionCalls.filter((c) => c.id === 'original');
    // `original` rolled its direction once, up front, then again re-derived
    // it (same direction, no new roll) on resuming after `nested` finishes.
    expect(originalCalls.length).toBeGreaterThanOrEqual(2);
    expect(originalCalls[originalCalls.length - 1]).toEqual(originalCalls[0]);
    // The very last direction-related hook call of the whole cascade belongs
    // to `original`, not `nested` — proving the arrow hands back correctly
    // rather than being stuck on whichever elephant rolled most recently.
    expect(directionCalls[directionCalls.length - 1]!.id).toBe('original');
  });

  // Review-3 round 2. Same bug class as the DE/continueAfterVacated fixes
  // above, but in the two places a NESTED trampled elephant's own re-drift
  // can end (its combat or its own elimination) while an OUTER
  // `continueAfterVacated` frame is still sitting on the stack beneath it.
  // Both used to fall through (`break`/`continue`) into the same
  // `driftStep` call's frame-processing loop, which would immediately pop
  // and process that outer frame too — moving the outer elephant into its
  // vacated hex, and pushing ITS OWN `enteredVacatedHex`/`directionResumed`
  // events, before the call describing the NESTED elephant's fate ever
  // returned. So the outer elephant would already be sitting at its new hex
  // by the time its own narration/pause fired — one full `driftStep` call
  // ahead of itself. The existing "resolves a nested trampled elephant"
  // test above never drives the nested elephant to its own destruction (it
  // survives and drifts to a stop), which is exactly why it couldn't catch
  // this: these two tests reproduce it precisely, asserting call-by-call
  // (via direct `driftStep`/`pumpStep`, not the higher-level driver) that
  // the outer elephant is untouched by the call that resolves the nested
  // elephant's fate, and only moves on the NEXT call.
  describe('nested trampled elephant reaching its own destruction (review-3 round 2)', () => {
    it('does not resume the outer elephant in the same call where its nested trampled elephant is destroyed in combat (EX)', () => {
      const original = makeUnit('original', 0, 'elephants', CENTER);
      const nested = makeUnit('nested', 1, 'elephants', { q: 11, r: 5 });
      const third = makeUnit('third', 1, 'archers', { q: 12, r: 4 });
      const state = makeState([original, nested, third]);
      const trampleDie = dieForResult(original, nested, 'DR');
      const exDie = dieForResult(nested, third, 'EX');
      currentDrift = startElephantDrift(original, 4);
      const events: DriftEvent[] = [];

      pumpStep(state, undefined, events); // driftStarted(original) + directionRollNeeded(original)
      pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events); // directionRolled(original) + combatRollNeeded(original vs nested)
      pumpStep(state, { kind: 'combatRoll', dieRoll: trampleDie }, events); // combatResolved(DR) + driftStarted(nested) + directionRollNeeded(nested)
      // Die 2 -> DIRECTIONS[1] = {1,-1}, which is not `nested`'s forbidden
      // reverse direction ({-1,0}, `original`'s own direction reversed), so
      // this is accepted on the first roll.
      pumpStep(state, { kind: 'directionRoll', dieRoll: 2 }, events); // directionRolled(nested) + combatRollNeeded(nested vs third)

      expect(original.position).toEqual(CENTER); // sanity: untouched so far

      const destroyResult = pumpStep(state, { kind: 'combatRoll', dieRoll: exDie }, events);

      expect(destroyResult.done).toBe(false);
      expect(destroyResult.events.map((e) => e.kind)).toEqual(['combatResolved', 'driftElephantDestroyed']);
      expect(nested.destroyed).toBe(true);
      expect(third.destroyed).toBe(true);
      // The fix: `original` is completely untouched by this call — before
      // it, this assertion would fail because `original.position` would
      // already be {11,5}.
      expect(original.position).toEqual(CENTER);

      const resumeResult = pumpStep(state, undefined, events);
      expect(resumeResult.events.map((e) => e.kind)).toEqual(['enteredVacatedHex', 'directionResumed']);
      expect(original.position).toEqual({ q: 11, r: 5 });
    });

    it('does not resume the outer elephant in the same call where its nested trampled elephant drifts off the map', () => {
      // (23,3) and the invalid hex one further east it drifts into on a die
      // of 1 are the exact coordinates the existing "eliminates an elephant
      // that drifts off-map or into sea" test above already relies on.
      const original = makeUnit('original', 0, 'elephants', { q: 22, r: 3 });
      const nested = makeUnit('nested', 1, 'elephants', { q: 23, r: 3 });
      const state = makeState([original, nested]);
      const trampleDie = dieForResult(original, nested, 'DR');
      currentDrift = startElephantDrift(original, 4);
      const events: DriftEvent[] = [];

      pumpStep(state, undefined, events); // driftStarted(original) + directionRollNeeded(original)
      pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events); // directionRolled(original) + combatRollNeeded(original vs nested)
      pumpStep(state, { kind: 'combatRoll', dieRoll: trampleDie }, events); // combatResolved(DR) + driftStarted(nested) + directionRollNeeded(nested)

      expect(original.position).toEqual({ q: 22, r: 3 }); // sanity: untouched so far

      // Die 1 -> DIRECTIONS[0] = {1,0}, same direction `original` rolled —
      // not `nested`'s forbidden reverse ({-1,0}) — so accepted immediately,
      // walking `nested` straight off the map on its first step.
      const eliminatedResult = pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events);

      expect(eliminatedResult.done).toBe(false);
      expect(eliminatedResult.events.map((e) => e.kind)).toEqual(['directionRolled', 'eliminatedLeavingLandZone']);
      expect(nested.destroyed).toBe(true);
      // The fix: `original` is completely untouched by this call — before
      // it, this assertion would fail because `original.position` would
      // already be {23,3}.
      expect(original.position).toEqual({ q: 22, r: 3 });

      const resumeResult = pumpStep(state, undefined, events);
      expect(resumeResult.events.map((e) => e.kind)).toEqual(['enteredVacatedHex', 'directionResumed']);
      expect(original.position).toEqual({ q: 23, r: 3 });
    });

    // Review-3 round-3 self-audit finding (not in the reviewer's original
    // two — found by exhaustively enumerating every fall-through in this
    // function, as asked). Same bug class again, but in the ONE remaining
    // way a nested trampled elephant's own re-drift can end: neither combat
    // nor elimination, just normally exhausting its movement and stopping.
    // Uses the exact scenario the "resolves a nested trampled elephant"
    // test above already exercises (`nested` survives and drifts to
    // {15,1}) — that test only checks FINAL positions, which is exactly why
    // it couldn't catch this: the call that pushes `nested`'s own `stopped`
    // event used to ALSO resume `original` in the same call.
    it('does not resume the outer elephant in the same call where its nested trampled elephant stops normally', () => {
      const original = makeUnit('original', 0, 'elephants', CENTER);
      const nested = makeUnit('nested', 1, 'elephants', { q: 11, r: 5 });
      const state = makeState([original, nested]);
      const trampleDie = dieForResult(original, nested, 'DR');
      currentDrift = startElephantDrift(original, 4);
      const events: DriftEvent[] = [];

      pumpStep(state, undefined, events); // driftStarted(original) + directionRollNeeded(original)
      pumpStep(state, { kind: 'directionRoll', dieRoll: 1 }, events); // directionRolled(original) + combatRollNeeded(original vs nested)
      pumpStep(state, { kind: 'combatRoll', dieRoll: trampleDie }, events); // combatResolved(DR) + driftStarted(nested) + directionRollNeeded(nested)
      // Die 4 -> DIRECTIONS[3] = {-1,0}, `nested`'s forbidden reverse
      // direction (the reverse of `original`'s own {1,0}) — rejected, so
      // this reproduces the same reroll the "re-rolls a forbidden reverse
      // direction" test above exercises, before die 2 is accepted.
      pumpStep(state, { kind: 'directionRoll', dieRoll: 4 }, events); // directionForbidden(nested) + directionRollNeeded(nested)
      pumpStep(state, { kind: 'directionRoll', dieRoll: 2 }, events); // directionRolled(nested) + moved(nested to {12,4})
      pumpStep(state, undefined, events); // moved(nested to {13,3})
      pumpStep(state, undefined, events); // moved(nested to {14,2})
      pumpStep(state, undefined, events); // moved(nested to {15,1}) — nested's movement exhausted after this

      expect(original.position).toEqual(CENTER); // sanity: untouched so far
      expect(nested.position).toEqual({ q: 15, r: 1 });

      const stoppedResult = pumpStep(state, undefined, events);

      expect(stoppedResult.done).toBe(false);
      expect(stoppedResult.events.map((e) => e.kind)).toEqual(['stopped']);
      expect(nested.destroyed).toBe(false);
      // The fix: `original` is completely untouched by this call — before
      // it, this assertion would fail because `original.position` would
      // already be {11,5}, bundled into the SAME call as `nested`'s own
      // `stopped` event.
      expect(original.position).toEqual(CENTER);

      const resumeResult = pumpStep(state, undefined, events);
      expect(resumeResult.events.map((e) => e.kind)).toEqual(['enteredVacatedHex', 'directionResumed']);
      expect(original.position).toEqual({ q: 11, r: 5 });
    });
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

    // Review-2 MEDIUM finding: reverting `hooks.onDriftMoved?.(event.elephant,
    // event.hex);` in the `enteredVacatedHex` branch of `driftStep` — the one
    // that fires when a trampled non-elephant defender's retreat vacates the
    // hex the elephant then enters — passed the whole suite unmodified. No
    // existing test asserted `onDriftMoved` for THIS branch specifically: the
    // `moved` event never reports this hex, only `enteredVacatedHex` does, so
    // this fails if that hook call is missing.
    it('fires onDriftMoved when the elephant enters a hex vacated by a trampled defender that retreats (DR)', async () => {
      const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
      const defender = makeUnit('defender', 1, 'phalanges', { q: 11, r: 5 });
      const state = makeState([elephant, defender]);
      const agent = new ScriptedAgent();
      const combatDie = dieForResult(elephant, defender, 'DR');
      const dice = [1, combatDie];
      const moveCalls: { id: string; hex: HexCoord }[] = [];

      await resolveElephantDrift(state, elephant, 4, agent, () => dice.shift()!, {
        onDriftMoved: (u, hex) => moveCalls.push({ id: u.id, hex }),
      });

      expect(moveCalls).toContainEqual({ id: 'elephant', hex: { q: 11, r: 5 } });
    });

    // Review-2's test-gap finding: none of the four hooks tests above assert
    // `elephant.position` at an INTERMEDIATE pause between the first and last
    // `moved` event of a single uncontested free run — they only check
    // position before any pause resolves (still the start hex) and after ALL
    // pauses resolve (the final hex). That gap is exactly what let the
    // CRITICAL bug ship: before the fix, an uncontested multi-hex drift
    // resolved its ENTIRE free run — every hex — inside one `driftStep` call,
    // so the elephant was already sitting at its final hex by the time the
    // very first pause after the direction roll fired.
    it('advances the elephant by exactly one hex per onStep pause, never jumping straight to the final hex (regression: review-2 CRITICAL)', async () => {
      const elephant = makeUnit('elephant', 0, 'elephants', CENTER);
      const state = makeState([elephant]);
      const positionsAtPause: HexCoord[] = [];

      await resolveElephantDrift(state, elephant, 3, new ScriptedAgent(), () => 1, {
        onStep: () => {
          positionsAtPause.push({ ...elephant.position });
        },
      });

      expect(elephant.position).toEqual({ q: 13, r: 5 });

      // Collapse consecutive duplicate pause-positions (several pauses can
      // legitimately share one position within the same `driftStep` call —
      // e.g. the direction-roll pause and the pause for that same call's
      // first hex of movement) down to the distinct positions the elephant
      // was actually AT, in the order it was at them.
      const distinctInOrder: HexCoord[] = [];
      for (const pos of positionsAtPause) {
        const last = distinctInOrder[distinctInOrder.length - 1];
        if (!last || last.q !== pos.q || last.r !== pos.r) distinctInOrder.push(pos);
      }

      // Before the CRITICAL fix, this list would be just [{10,5}, {13,5}] —
      // the elephant already at its destination by the very first pause
      // after the direction roll, three hexes early. Fixed, every hex of the
      // uncontested run shows up as its own step:
      expect(distinctInOrder).toEqual([
        { q: 10, r: 5 },
        { q: 11, r: 5 },
        { q: 12, r: 5 },
        { q: 13, r: 5 },
      ]);
    });
  });
});
