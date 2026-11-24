import { describe, expect, it, vi } from 'vitest';
import { legalRetreatHexes } from './combat';
import type { AnswerAction, ResolutionHooks, SessionEvent } from './combatResolution';
import type { Action } from './actions';
import { buildElephantScenarioGameState } from './fuzzHarness';
import {
  newSession,
  sessionApply,
  sessionBeginResolution,
  sessionLegalActions,
  sessionQuestion,
  sessionResume,
  type GameSession,
  type SessionStep,
} from './gameSession';
import { load } from './host';
import { newPending } from './combatResolution';
import { RandomAgent } from './randomAgent';
import { createSeededRng } from './rng';
import { buildSavedGame } from './saveGame';
import { askAgent, forcedHooks, settleWithAgent } from './sessionAgents';
import { attack, dieFor, gameWith, scripted, unit } from './sessionTestKit';

// §73 O4: the opt-in pause after each drift step - the drift footgun
// (REVIEW-POLICY pass 9). Every test names the mutant it kills.

/** Each `driftStep` result's events, as JSON at the moment the step returned. */
const recorded = vi.hoisted(() => [] as unknown[][]);
vi.mock('./drift', async (importOriginal) => {
  const real = await importOriginal<typeof import('./drift')>();
  return {
    ...real,
    driftStep: (...args: Parameters<typeof real.driftStep>) => {
      const result = real.driftStep(...args);
      recorded.push(JSON.parse(JSON.stringify(result.events)) as unknown[]);
      return result;
    },
  };
});

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function counting(seed: number): { rng: () => number; draws: () => number } {
  const inner = createSeededRng(seed);
  let n = 0;
  return { rng: () => (n++, inner()), draws: () => n };
}

interface Settled {
  events: SessionEvent[];
  /** One entry per pause: that step's DriftEvents as JSON. */
  pauses: unknown[][];
}

/** Settles `action` with `agent`, resuming at every pause. */
async function settlePausing(
  session: GameSession,
  action: Action,
  agent: RandomAgent,
  rng: () => number,
  atPause?: (step: SessionStep) => void,
): Promise<Settled> {
  const kept: Promise<unknown>[] = [];
  const hooks: ResolutionHooks = { ...forcedHooks(agent, session, kept), pauseAfterDriftStep: true };
  const settled: Settled = { events: [], pauses: [] };
  let step = sessionApply(session, action, rng, hooks);
  for (;;) {
    settled.events.push(...step.events);
    if (step.paused) {
      settled.pauses.push(json(step.driftEvents));
      atPause?.(step);
      step = sessionResume(session, rng, hooks);
    } else if (session.pending?.question) {
      step = sessionApply(session, await askAgent(agent, session.state, session.pending.question), rng, hooks);
    } else {
      break;
    }
  }
  await Promise.all(kept);
  return settled;
}

const ATTACK: Action = { kind: 'landAttack', attackerIds: ['attacker'], defenderIds: ['defender'] };

describe('a paused run against an unpaused one', () => {
  // Kills a lost drift step (the state differs), a repeated driftStep (state and
  // draws differ), and a die rolled again on resume (the draw count is +1).
  it('ends in the same state, context, events and draws', async () => {
    let drifts = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const plain = counting(seed);
      const plainState = buildElephantScenarioGameState();
      const plainSession = newSession(plainState);
      const plainStep = await settleWithAgent(plainSession, ATTACK, new RandomAgent(plain.rng), plain.rng);

      const paused = counting(seed);
      const pausedState = buildElephantScenarioGameState();
      const pausedSession = newSession(pausedState);
      const settled = await settlePausing(pausedSession, ATTACK, new RandomAgent(paused.rng), paused.rng);

      expect(pausedState, `seed ${seed}: state`).toEqual(plainState);
      expect(pausedSession.context, `seed ${seed}: context`).toEqual(plainSession.context);
      expect(settled.events, `seed ${seed}: events`).toEqual(plainStep.events);
      expect(paused.draws(), `seed ${seed}: draws`).toBe(plain.draws());
      expect(pausedSession.pending).toBeNull();
      drifts += plainStep.events.filter((e) => e.kind === 'driftStarted').length;
    }
    expect(drifts).toBeGreaterThan(0);
  });

  // Kills a step lost or shown twice: the pauses carry exactly the events of
  // the driftStep calls, one pause per call, in order.
  it('pauses once per driftStep and hands over each step\'s events exactly once', async () => {
    for (let seed = 1; seed <= 24; seed++) {
      recorded.length = 0;
      const plain = counting(seed);
      await settleWithAgent(newSession(buildElephantScenarioGameState()), ATTACK, new RandomAgent(plain.rng), plain.rng);
      const unpausedSteps = recorded.splice(0);

      const paused = counting(seed);
      const settled = await settlePausing(newSession(buildElephantScenarioGameState()), ATTACK, new RandomAgent(paused.rng), paused.rng);
      const pausedSteps = recorded.splice(0);

      expect(pausedSteps, `seed ${seed}: the same driftStep calls`).toEqual(unpausedSteps);
      expect(settled.pauses, `seed ${seed}: one pause per call, with its events`).toEqual(pausedSteps);
    }
  });
});

/** An elephant driven off by a chariot tramples a phalanx two hexes east, which must retreat (as in gameSession.test.ts). */
function trampleScript() {
  const elephant = unit('e', 'elephants', 14, 5, 1);
  const attacker = unit('c', 'chars-lourds', 13, 5, 0);
  const trampled = unit('p', 'phalanges', 15, 5, 0);
  const state = gameWith([elephant, attacker, trampled]);
  const dice = [dieFor([attacker], [elephant], 'DR'), 1, dieFor([elephant], [trampled], 'DR')];
  return { elephant, attacker, trampled, state, dice };
}

const hooks: ResolutionHooks = { pauseAfterDriftStep: true };

/** Runs `session` from the attack to the first pause. */
function firstPause() {
  const script = trampleScript();
  const session = newSession(script.state);
  const rng = scripted([...script.dice, 1, 1, 1, 1, 1, 1, 1, 1]);
  const step = sessionApply(session, attack([script.attacker], [script.elephant]), rng, hooks);
  return { ...script, session, rng, step };
}

describe('the pause', () => {
  it('stops right after the first drift step, with its events and no question', () => {
    const { session, step } = firstPause();
    expect(step.paused).toBe(true);
    expect(step.driftEvents.map((e) => e.kind)).toEqual(['driftStarted', 'directionRollNeeded']);
    expect(session.pending).toMatchObject({ paused: true, question: null });
    expect(sessionQuestion(session)).toBeNull();
  });

  // Kills resuming the drift before the trampled unit's retreat is asked: the
  // question must come only after the pause of the step that caused it, and the
  // pause must hold the trample's state (the phalanx is still where it was).
  it('puts a trampled unit\'s retreat question after the pause of the step that caused it', () => {
    const { session, rng, trampled, state } = firstPause();
    let step = sessionResume(session, rng, hooks);
    const seen: string[] = [];
    while (step.paused) {
      const kinds = step.driftEvents.map((e) => e.kind);
      seen.push(kinds.join('+'));
      if (kinds.includes('retreatResolutionNeeded')) {
        expect(sessionQuestion(session), 'no question yet: the trample is only shown').toBeNull();
        expect(trampled.position).toEqual({ q: 15, r: 5 });
        const options = legalRetreatHexes(state, trampled);
        step = sessionResume(session, rng, hooks);
        expect(step.paused).toBe(false);
        expect(sessionQuestion(session)).toEqual({ kind: 'retreat', player: 0, unitId: 'p', options });
        return;
      }
      step = sessionResume(session, rng, hooks);
    }
    throw new Error(`the drift never reached a trample: ${seen.join(' | ')}`);
  });

  describe('while paused', () => {
    it('lists no action and refuses every call, changing nothing', () => {
      const { session, rng } = firstPause();
      const before = json(session);
      expect(sessionLegalActions(session)).toEqual([]);
      expect(() => sessionApply(session, { kind: 'endPhase' }, rng)).toThrow(/paused/);
      expect(() => sessionApply(session, { kind: 'answerAdvance', unitId: null } as AnswerAction, rng)).toThrow(/paused/);
      expect(() => sessionBeginResolution(session, newPending([], []), rng)).toThrow();
      expect(json(session)).toEqual(before);
    });
  });

  describe('sessionResume', () => {
    it('throws, changing nothing, when no combat is open', () => {
      const session = newSession(gameWith([unit('a', 'fantassins', 10, 5)]));
      const before = json(session);
      expect(() => sessionResume(session, scripted([]))).toThrow(/not paused/);
      expect(json(session)).toEqual(before);
    });

    it('throws, changing nothing, while a question is open', () => {
      const a = unit('a', 'fantassins', 10, 5);
      const d = unit('d', 'fantassins', 11, 5, 1);
      const session = newSession(gameWith([a, d]));
      sessionApply(session, attack([a], [d]), scripted([dieFor([a], [d], 'DR')]));
      expect(sessionQuestion(session)?.kind).toBe('retreat');
      const before = json(session);
      expect(() => sessionResume(session, scripted([]))).toThrow(/not paused/);
      expect(json(session)).toEqual(before);
    });

    it('needs an rng', () => {
      const { session } = firstPause();
      expect(() => sessionResume(session, undefined as unknown as () => number)).toThrow(/rng/);
      expect((session.pending as { paused: boolean }).paused).toBe(true);
    });
  });

  // B1 with the pause: `paused` is a JSON boolean, and the step's DriftEvents
  // (live Units) are never stored, so a copy of a paused session goes on exactly
  // as the original does. Kills a pause state that lives outside `pending`.
  it('survives a JSON round trip: the copy goes on to the same result', () => {
    const { session, dice, step } = firstPause();
    expect(step.paused).toBe(true);
    const copy = json(session);
    const rest = () => scripted([...dice.slice(2), 1, 1, 1, 1, 1, 1, 1, 1]);

    /** Resumes and answers the first option until the combat is settled. */
    const drive = (s: GameSession): SessionEvent[] => {
      const rng = rest();
      const events: SessionEvent[] = [];
      while (s.pending) {
        const next = s.pending.paused
          ? sessionResume(s, rng, hooks)
          : sessionApply(s, sessionLegalActions(s)[0] as AnswerAction, rng, hooks);
        events.push(...next.events);
      }
      return events;
    };
    const original = drive(session);
    const resumed = drive(copy);
    expect(original.length).toBeGreaterThan(0);
    expect(resumed).toEqual(original);
    expect(json(copy.state)).toEqual(json(session.state));
  });
});

describe('a host never pauses', () => {
  it('settles an elephant combat with questions only, and lists turn actions after', () => {
    const state = buildElephantScenarioGameState();
    state.phase = 'combat';
    const save = buildSavedGame({
      savedAt: new Date(0).toISOString(),
      playerCount: 2,
      playerNames: ['P0', 'P1'],
      edges: ['W', 'E'],
      armySelections: [{}, {}],
      combatMode: state.combatMode,
      seatControls: ['human', 'human'],
      testMode: false,
      gameState: state,
      attackedThisPhase: [],
      rammedThisTurn: [],
    });
    const host = load(save, 7);
    let events: SessionEvent[] = host.apply(ATTACK).events;
    for (let guard = 0; host.question() && guard < 50; guard++) {
      const answers = host.legalActions();
      expect(answers.length, 'a question lists its answers').toBeGreaterThan(0);
      events = [...events, ...host.apply(answers[0]!).events];
    }
    expect(events.some((e) => e.kind === 'driftStarted')).toBe(true);
    expect(host.question()).toBeNull();
    expect(host.legalActions().some((a) => a.kind === 'endPhase')).toBe(true);
  });
});
