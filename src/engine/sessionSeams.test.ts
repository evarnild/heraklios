import { describe, expect, it } from 'vitest';
import type { ActionResult } from './actions';
import { legalRetreatHexes } from './combat';
import { newPending, type AnswerAction, type Question, type ResolutionHooks, type SessionEvent } from './combatResolution';
import { newSession, sessionApply, sessionBeginResolution, sessionLegalActions, sessionQuestion } from './gameSession';
import { attack, dieFor, gameWith, scripted, unit } from './sessionTestKit';

// The §73 seams of the session: the new events, `onEvent`, `onActionApplied` and
// `askForced`. Small hand-built positions on plain hexes, as `gameSession.test.ts`.

/** d (11,5) can only go to (12,5): its friends hold the other hexes the attacker's zone leaves open. */
function singleRetreat() {
  const a = unit('a', 'fantassins', 10, 5);
  const d = unit('d', 'fantassins', 11, 5, 1);
  const blockers = [unit('b1', 'fantassins', 12, 4, 1), unit('b2', 'fantassins', 11, 6, 1)];
  const state = gameWith([a, d, ...blockers]);
  expect(legalRetreatHexes(state, d)).toEqual([{ q: 12, r: 5 }]);
  return { a, d, state, rng: scripted([dieFor([a], [d], 'DR')]) };
}

/**
 * a (2,18) is boxed in and has one friend, b (3,18), which is boxed in too, with c (4,18) behind it,
 * and c has one hex to go to. §90: a push may not take a hex under enemy ZOC, so this is the shape of
 * `gameSession.test.ts`'s `pushPosition` (the §73 geometry shifted by (-8,+13)): a river between e0 (3,17)
 * and b blocks e0's ZOC there. The other boxes are naval placeholders, which block a hex but project no
 * ZOC, so (1,18) (where `pushPosition` has a friend, here none) and two of c's hexes are blocked by them
 * rather than left to ZOC, which is what boxed the old position in.
 */
function singlePush() {
  const a = unit('a', 'fantassins', 2, 18);
  const b = unit('b', 'fantassins', 3, 18);
  const c = unit('c', 'fantassins', 4, 18);
  const enemyHexes = [{ q: 3, r: 17 }, { q: 2, r: 17 }, { q: 1, r: 19 }, { q: 2, r: 19 }, { q: 4, r: 17 }, { q: 3, r: 19 }, { q: 1, r: 18 }, { q: 5, r: 17 }, { q: 5, r: 18 }];
  const enemies = enemyHexes.map((h, i) => unit(`e${i}`, i === 0 ? 'fantassins' : 'galeres', h.q, h.r, 1));
  const state = gameWith([a, b, c, ...enemies]);
  state.activePlayerIndex = 1;
  return { a, b, c, attacker: enemies[0]!, state, rng: scripted([dieFor([enemies[0]!], [a], 'DR')]) };
}

/** Three attackers, one defender: EX, with the sacrifice a question. */
function exchange() {
  const a1 = unit('a1', 'phalanges', 11, 5);
  const a2 = unit('a2', 'phalanges', 11, 4);
  const d = unit('d', 'archers', 10, 5, 1);
  const state = gameWith([a1, a2, d]);
  return { a1, a2, d, state, rng: scripted([dieFor([a1, a2], [d], 'EX')]) };
}

describe('the new events (§73)', () => {
  it('a forced retreat is a retreat event with its hex', () => {
    const { a, d, state, rng } = singleRetreat();
    const session = newSession(state);
    const step = sessionApply(session, attack([a], [d]), rng);
    expect(step.events).toEqual([{ kind: 'retreat', unitId: 'd', hex: { q: 12, r: 5 } }]);
  });

  it('an answered retreat is a retreat event with the chosen hex', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    const state = gameWith([a, d]);
    const options = legalRetreatHexes(state, d);
    const session = newSession(state);
    sessionApply(session, attack([a], [d]), scripted([dieFor([a], [d], 'DR')]));
    const step = sessionApply(session, { kind: 'answerRetreat', hex: options[1]! }, scripted([]));
    expect(step.events).toEqual([{ kind: 'retreat', unitId: 'd', hex: options[1] }]);
  });

  it('a pushed unit\'s retreat is a retreat event, before the pusher\'s push event', () => {
    const { attacker, a, state, rng } = singlePush();
    const session = newSession(state);
    const events = sessionApply(session, attack([attacker], [a]), rng).events;
    expect(events.map((e) => e.kind)).toEqual(['retreat', 'push', 'push']);
    expect(events[0]).toMatchObject({ unitId: 'c' });
  });

  it('a unit with neither a hex nor a friend to push is an eliminated event', () => {
    const boxed = unit('boxed', 'fantassins', 14, 5, 1);
    const ring = [{ q: 15, r: 5 }, { q: 15, r: 4 }, { q: 14, r: 4 }, { q: 13, r: 5 }, { q: 13, r: 6 }, { q: 14, r: 6 }].map((h, i) =>
      unit(`r${i}`, 'fantassins', h.q, h.r, 0),
    );
    const session = newSession(gameWith([boxed, ...ring]));
    const step = sessionBeginResolution(session, newPending(['r0'], [{ kind: 'retreat', unitId: 'boxed' }]), scripted([]));
    expect(step.events).toEqual([{ kind: 'eliminated', unitId: 'boxed' }]);
    expect(boxed.destroyed).toBe(true);
  });

  it('an advance is an event with the vacated hex; a declined one is none', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const session = newSession(gameWith([a]));
    sessionBeginResolution(session, newPending(['a'], [{ kind: 'advance', hex: { q: 11, r: 5 } }, { kind: 'advance', hex: { q: 9, r: 5 } }]), scripted([]));
    const taken = sessionApply(session, { kind: 'answerAdvance', unitId: 'a' }, scripted([]));
    expect(taken.events).toEqual([{ kind: 'advance', unitId: 'a', hex: { q: 11, r: 5 } }]);
    // a stands on (11,5) now, so the second hex is out of its reach: nothing is asked.
    expect(session.pending).toBeNull();

    const b = unit('b', 'fantassins', 10, 5);
    const other = newSession(gameWith([b]));
    sessionBeginResolution(other, newPending(['b'], [{ kind: 'advance', hex: { q: 11, r: 5 } }]), scripted([]));
    expect(sessionApply(other, { kind: 'answerAdvance', unitId: null }, scripted([])).events).toEqual([]);
  });

  it('an answered sacrifice and a forced one are both sacrifice events', () => {
    const { a1, a2, d, state, rng } = exchange();
    const session = newSession(state);
    sessionApply(session, attack([a1, a2], [d]), rng);
    const step = sessionApply(session, { kind: 'answerSacrifice', unitIds: ['a2'] }, scripted([]));
    expect(step.events[0]).toEqual({ kind: 'sacrifice', unitIds: ['a2'] });

    const lone = unit('lone', 'fantassins-lourds', 10, 5);
    const other = unit('other', 'fantassins', 10, 6);
    const forcedSession = newSession(gameWith([lone, other]));
    const forced = sessionBeginResolution(forcedSession, newPending(['lone', 'other'], [{ kind: 'sacrifice', requiredForce: 4 }]), scripted([]));
    expect(forced.events).toEqual([{ kind: 'sacrifice', unitIds: ['lone'] }]);
  });

  it('onEvent receives exactly the events of each step, in order', () => {
    const { attacker, a, state, rng } = singlePush();
    const session = newSession(state);
    const seen: SessionEvent[] = [];
    const hooks: ResolutionHooks = { onEvent: (e) => seen.push(e) };
    const all: SessionEvent[] = [];
    let step = sessionApply(session, attack([attacker], [a]), rng, hooks);
    all.push(...step.events);
    while (session.pending) {
      const answers = sessionLegalActions(session) as AnswerAction[];
      step = sessionApply(session, answers[0]!, rng, hooks);
      all.push(...step.events);
    }
    expect(all.length).toBeGreaterThan(2);
    expect(seen).toEqual(all);
  });

  // Kills a `driftStarted` or `driftCombat` event emitted by `events.push` instead of `emit`: only
  // `emit` reaches `onEvent`, so the list `onEvent` saw would lack it.
  it('onEvent receives exactly the events of each step on a drift with a trample', () => {
    const elephant = unit('e', 'elephants', 14, 5, 1);
    const attacker = unit('c', 'chars-lourds', 13, 5, 0);
    const trampled = unit('p', 'phalanges', 15, 5, 0);
    const state = gameWith([elephant, attacker, trampled]);
    const rng = scripted([dieFor([attacker], [elephant], 'DR'), 1, dieFor([elephant], [trampled], 'DR'), 1, 1, 1, 1, 1, 1, 1, 1]);
    const session = newSession(state);
    const seen: SessionEvent[] = [];
    const hooks: ResolutionHooks = { onEvent: (e) => seen.push(e) };
    const all: SessionEvent[] = [];
    let step = sessionApply(session, attack([attacker], [elephant]), rng, hooks);
    all.push(...step.events);
    while (session.pending) {
      step = sessionApply(session, (sessionLegalActions(session) as AnswerAction[])[0]!, rng, hooks);
      all.push(...step.events);
    }
    const kinds = all.map((e) => e.kind);
    expect(kinds).toContain('driftStarted');
    expect(kinds).toContain('driftCombat');
    expect(seen).toEqual(all);
  });
});

describe('onActionApplied (§73)', () => {
  it('is called once with the result, before any forced step, event or question', () => {
    const { a, d, state, rng } = singleRetreat();
    const log: string[] = [];
    const results: ActionResult[] = [];
    const hooks: ResolutionHooks = {
      onActionApplied: (result) => {
        results.push(result);
        log.push('applied');
      },
      onForced: () => log.push('forced'),
      onEvent: (e) => log.push(e.kind),
    };
    const step = sessionApply(newSession(state), attack([a], [d]), rng, hooks);
    expect(log).toEqual(['applied', 'forced', 'retreat']);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(step.result);
  });

  it('is not called for an answer, nor when the action throws', () => {
    const { a, d, state, rng } = singleRetreat();
    const calls: string[] = [];
    const hooks: ResolutionHooks = { onActionApplied: () => calls.push('applied') };
    const session = newSession(state);
    expect(() => sessionApply(session, { kind: 'landAttack', attackerIds: ['nobody'], defenderIds: ['d'] }, rng, hooks)).toThrow();
    expect(calls).toEqual([]);
    sessionApply(session, attack([a], [d]), rng, hooks);
    expect(calls).toEqual(['applied']);
    // An answer to a later question does not report an action.
    const pushed = singlePush();
    const other = newSession(pushed.state);
    sessionApply(other, attack([pushed.attacker], [pushed.a]), pushed.rng, hooks);
    expect(calls).toEqual(['applied', 'applied']);
  });
});

describe('askForced (§73 O2)', () => {
  const asking = (asked: Question[], forced: Question[] = []): ResolutionHooks => ({
    askForced: (q) => {
      asked.push(structuredClone(q));
      return true;
    },
    onForced: (q) => forced.push(q),
  });

  it('turns a one-option retreat into a question with one answer, and leaves the unit where it is', () => {
    const { a, d, state, rng } = singleRetreat();
    const asked: Question[] = [];
    const forced: Question[] = [];
    const session = newSession(state);
    const step = sessionApply(session, attack([a], [d]), rng, asking(asked, forced));
    expect(step.events).toEqual([]);
    expect(sessionQuestion(session)).toEqual({ kind: 'retreat', player: 1, unitId: 'd', options: [{ q: 12, r: 5 }] });
    expect(sessionLegalActions(session)).toEqual([{ kind: 'answerRetreat', hex: { q: 12, r: 5 } }]);
    expect(d.position).toEqual({ q: 11, r: 5 });
    expect(forced).toEqual([]);
    expect(asked).toHaveLength(1);
    const answered = sessionApply(session, { kind: 'answerRetreat', hex: { q: 12, r: 5 } }, scripted([]), asking(asked, forced));
    expect(answered.events).toEqual([{ kind: 'retreat', unitId: 'd', hex: { q: 12, r: 5 } }]);
    expect(d.position).toEqual({ q: 12, r: 5 });
  });

  it('turns a one-candidate push into a question with one answer', () => {
    const { attacker, a, state, rng } = singlePush();
    const asked: Question[] = [];
    const forced: Question[] = [];
    const session = newSession(state);
    sessionApply(session, attack([attacker], [a]), rng, asking(asked, forced));
    expect(sessionQuestion(session)).toEqual({ kind: 'pushTarget', player: 0, unitId: 'a', candidateIds: ['b'] });
    expect(sessionLegalActions(session)).toEqual([{ kind: 'answerPushTarget', unitId: 'b' }]);
    expect(forced).toEqual([]);
  });

  it('turns a lone minimal sacrifice into a question with one answer', () => {
    const lone = unit('lone', 'fantassins-lourds', 10, 5);
    const other = unit('other', 'fantassins', 10, 6);
    const asked: Question[] = [];
    const forced: Question[] = [];
    const session = newSession(gameWith([lone, other]));
    sessionBeginResolution(session, newPending(['lone', 'other'], [{ kind: 'sacrifice', requiredForce: 4 }]), scripted([]), asking(asked, forced));
    expect(sessionLegalActions(session)).toEqual([{ kind: 'answerSacrifice', unitIds: ['lone'] }]);
    expect(lone.destroyed).toBe(false);
    expect(forced).toEqual([]);
  });

  it('says false: the step is applied and reported through onForced, as without the hook', () => {
    const { a, d, state, rng } = singleRetreat();
    const forced: Question[] = [];
    const session = newSession(state);
    sessionApply(session, attack([a], [d]), rng, { askForced: () => false, onForced: (q) => forced.push(q) });
    expect(forced).toHaveLength(1);
    expect(d.position).toEqual({ q: 12, r: 5 });
  });

  it('is not asked about a step that has a real choice', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    const asked: Question[] = [];
    const session = newSession(gameWith([a, d]));
    sessionApply(session, attack([a], [d]), scripted([dieFor([a], [d], 'DR')]), asking(asked));
    expect(asked).toEqual([]);
    expect(sessionQuestion(session)?.kind).toBe('retreat');
  });
});
