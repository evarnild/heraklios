import { applyAction, legalActions, type Action, type ActionContext, type ActionResult } from './actions';
import {
  applyAnswer,
  pendingFromAttack,
  questionAnswers,
  runResolution,
  sameAnswer,
  type AnswerAction,
  type Pending,
  type Question,
  type ResolutionHooks,
  type SessionEvent,
} from './combatResolution';
import type { GameState } from './state';

export type { AnswerAction, Pending, Question, ResolutionHooks, SessionEvent } from './combatResolution';

/**
 * A whole game for a host other than the Phaser scenes (§72): the state, the
 * per-phase bookkeeping `legalActions` needs, and the open resolution of a
 * land combat. It is plain JSON, so `JSON.parse(JSON.stringify(session))` is a
 * usable session at any moment - mid-question included (B1).
 *
 * A land attack whose outcome needs a choice leaves `pending` set with a
 * `question`; while one is open, `sessionLegalActions` lists exactly its
 * answers and `sessionApply` takes one (B2, B3). `BoardScene` and its computer
 * seats do not use this yet (B16); the fuzz harness does.
 */
export interface SessionContext {
  /** Units that attacked or boarded this phase. */
  attackedThisPhase: string[];
  /** Ships that rammed this turn. */
  rammedThisTurn: string[];
}

export interface GameSession {
  state: GameState;
  context: SessionContext;
  pending: Pending | null;
}

/** A turn action, or an answer to the open question (A1: the answers are a
 * union of their own, so `Action`, `applyAction` and `legalActions` are
 * untouched). */
export type SessionAction = Action | AnswerAction;

export interface SessionStep {
  /** What `applyAction` returned; `{kind: 'answer'}` for an answer. */
  result: ActionResult | { kind: 'answer' };
  events: SessionEvent[];
  /** The open resolution after this step, or null when the combat is settled. */
  pending: Pending | null;
}

/** Wraps `state` (not a copy: the engine mutates a `GameState` in place). */
export function newSession(state: GameState, context: Partial<SessionContext> = {}): GameSession {
  return {
    state,
    context: {
      attackedThisPhase: [...(context.attackedThisPhase ?? [])],
      rammedThisTurn: [...(context.rammedThisTurn ?? [])],
    },
    pending: null,
  };
}

export function sessionQuestion(session: GameSession): Question | null {
  return session.pending?.question ?? null;
}

function actionContext(context: SessionContext): ActionContext {
  return { attackedThisPhase: new Set(context.attackedThisPhase), rammedThisTurn: new Set(context.rammedThisTurn) };
}

export function isAnswerAction(action: SessionAction): action is AnswerAction {
  return action.kind.startsWith('answer');
}

/** B2: with no question open, exactly `legalActions` (same order); with one
 * open, exactly its answers. */
export function sessionLegalActions(session: GameSession): SessionAction[] {
  const question = sessionQuestion(session);
  if (question) return questionAnswers(session.state, question);
  return legalActions(session.state, actionContext(session.context));
}

function add(list: string[], ...ids: string[]): void {
  for (const id of ids) if (!list.includes(id)) list.push(id);
}

/** The bookkeeping outside `GameState` that a turn action implies - what the
 * fuzz harness and `BoardScene` each did by hand. Runs after `applyAction`
 * returns, so an action that throws leaves the context alone. */
function updateContext(session: GameSession, action: Action): void {
  const { context, state } = session;
  switch (action.kind) {
    case 'endPhase':
      context.attackedThisPhase = [];
      // A ram's "rammed this turn" outlives the combat phase and ends only
      // when a new movement phase begins.
      if (!state.gameOver && state.phase === 'movement') context.rammedThisTurn = [];
      break;
    case 'ram':
      add(context.rammedThisTurn, action.unitId);
      break;
    case 'board':
      add(context.attackedThisPhase, action.attackerId);
      break;
    case 'landAttack':
      add(context.attackedThisPhase, ...action.attackerIds);
      break;
  }
}

/** Runs the open resolution on, storing its question (or clearing it). */
function advanceResolution(
  session: GameSession,
  pending: Pending,
  rng: () => number,
  hooks: ResolutionHooks,
  events: SessionEvent[],
): void {
  const question = runResolution(session.state, pending, rng, hooks, events);
  session.pending = question ? pending : null;
}

/**
 * Applies one action or one answer, in place (B3). Three checks come first, and
 * a failure changes nothing: a turn action while a question is open, an answer
 * with no question open, an answer that is not one of the question's.
 *
 * A turn action is otherwise checked only by `applyAction`'s own errors (A3),
 * not against `sessionLegalActions`: `legalActions` offers single attackers
 * only, and a caller may build a combined attack, as `HeuristicAgent` does.
 *
 * `rng` is required (no `Math.random` default): it rolls the combat die, a
 * ram's, a boarding's, the drift's direction and combat dice, and the turn
 * order's reshuffle. `hooks.onForced` reports each step applied without asking
 * (A2).
 */
export function sessionApply(
  session: GameSession,
  action: SessionAction,
  rng: () => number,
  hooks: ResolutionHooks = {},
): SessionStep {
  if (typeof rng !== 'function') throw new Error('sessionApply: an rng is required');
  const events: SessionEvent[] = [];

  if (isAnswerAction(action)) {
    const pending = session.pending;
    const question = pending?.question;
    if (!pending || !question) throw new Error(`sessionApply: ${action.kind} but no question is open`);
    if (!questionAnswers(session.state, question).some((answer) => sameAnswer(answer, action))) {
      throw new Error(`sessionApply: ${action.kind} is not one of the open ${question.kind} question's answers`);
    }
    applyAnswer(session.state, pending, action, hooks, events);
    advanceResolution(session, pending, rng, hooks, events);
    return { result: { kind: 'answer' }, events, pending: session.pending };
  }

  if (session.pending) throw new Error(`sessionApply: ${action.kind} while a ${session.pending.question?.kind} question is open`);
  const result = applyAction(session.state, action, rng);
  updateContext(session, action);
  hooks.onActionApplied?.(result);
  if (result.kind === 'landAttack') {
    const pending = pendingFromAttack(result);
    if (pending) advanceResolution(session, pending, rng, hooks, events);
  }
  return { result, events, pending: session.pending };
}

/** Starts `pending` - a resolution not produced by an attack, such as the
 * fuzz harness's `processRetreats` - on `session`, and runs it to its first
 * question. */
export function sessionBeginResolution(
  session: GameSession,
  pending: Pending,
  rng: () => number,
  hooks: ResolutionHooks = {},
): SessionStep {
  if (session.pending) throw new Error('sessionBeginResolution: a question is already open');
  const events: SessionEvent[] = [];
  advanceResolution(session, pending, rng, hooks, events);
  return { result: { kind: 'answer' }, events, pending: session.pending };
}
