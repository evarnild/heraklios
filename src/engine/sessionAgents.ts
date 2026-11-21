import type { HexCoord } from '../data/map';
import type { PlayerAgent } from './agent';
import {
  questionAnswers,
  unitById,
  type AnswerAction,
  type Pending,
  type Question,
  type ResolutionHooks,
  type SessionEvent,
} from './combatResolution';
import { sessionApply, sessionBeginResolution, type GameSession, type SessionAction, type SessionStep } from './gameSession';
import type { GameState, Unit } from './state';

/**
 * The only bridge between a `GameSession` and a `PlayerAgent` (§72): it
 * answers the session's questions with an agent, calling the same agent
 * method with the same arguments, in the same order and number, as the code
 * the session replaced - the agents and the dice share one seeded rng in the
 * fuzz harness, so any change in that order changes the game.
 */

/** Maps an agent's choice of units to the first listed sacrifice it contains
 * (§72 I3): the listed answers are the minimal subsets, and an agent that
 * chose a larger set meant at least one of them. */
function sacrificeAnswer(listed: readonly AnswerAction[], chosen: readonly Unit[]): AnswerAction {
  const chosenIds = new Set(chosen.map((u) => u.id));
  const answer = listed.find((a) => a.kind === 'answerSacrifice' && a.unitIds.every((id) => chosenIds.has(id)));
  if (!answer) throw new Error('sessionAgents: the chosen sacrifice contains none of the listed minimal sacrifices');
  return answer;
}

/**
 * Asks `agent` the open `question`, calling its method synchronously (so an
 * rng it draws is drawn now) and mapping the reply to an answer.
 */
export function askAgent(agent: PlayerAgent, state: GameState, question: Question): Promise<AnswerAction> {
  switch (question.kind) {
    case 'retreat':
      return agent
        .chooseRetreat(state, unitById(state, question.unitId), question.options)
        .then((hex: HexCoord): AnswerAction => ({ kind: 'answerRetreat', hex: { ...hex } }));
    case 'pushTarget':
      return agent
        .choosePushTarget(state, unitById(state, question.unitId), question.candidateIds.map((id) => unitById(state, id)))
        .then((unit): AnswerAction => ({ kind: 'answerPushTarget', unitId: unit.id }));
    case 'advance':
      return agent
        .chooseAdvance(state, question.candidateIds.map((id) => unitById(state, id)), question.vacatedHex)
        .then((unit): AnswerAction => ({ kind: 'answerAdvance', unitId: unit ? unit.id : null }));
    case 'exchangeSacrifice': {
      // Listed now, not when the reply arrives: a forced sacrifice's reply is
      // awaited later, after the step has already destroyed the units.
      const listed = questionAnswers(state, question);
      return agent
        .chooseExchangeSacrifice(state, question.attackerIds.map((id) => unitById(state, id)), question.requiredForce)
        .then((chosen) => sacrificeAnswer(listed, chosen));
    }
  }
}

/** A2's hook: on a step the session applies without asking, still call the
 * agent (its rng draw is part of the game) and keep the promise in `kept`, so
 * `settleWithAgent` can surface an agent's error at the end. The agent's
 * reply is ignored: with one option there is nothing else it could be. */
export function forcedHooks(agent: PlayerAgent, session: GameSession, kept: Promise<unknown>[]): ResolutionHooks {
  return { onForced: (question) => kept.push(askAgent(agent, session.state, question)) };
}

async function settle(
  session: GameSession,
  first: SessionStep,
  agent: PlayerAgent,
  rng: () => number,
  hooks: ResolutionHooks,
  kept: Promise<unknown>[],
): Promise<SessionStep> {
  const events: SessionEvent[] = [...first.events];
  while (session.pending?.question) {
    const answer = await askAgent(agent, session.state, session.pending.question);
    events.push(...sessionApply(session, answer, rng, hooks).events);
  }
  await Promise.all(kept);
  return { result: first.result, events, pending: null };
}

/** Applies `action`, then answers every question it provokes with `agent`
 * until the combat is settled. */
export async function settleWithAgent(
  session: GameSession,
  action: SessionAction,
  agent: PlayerAgent,
  rng: () => number,
): Promise<SessionStep> {
  const kept: Promise<unknown>[] = [];
  const hooks = forcedHooks(agent, session, kept);
  return settle(session, sessionApply(session, action, rng, hooks), agent, rng, hooks, kept);
}

/** The same for a resolution that no attack produced (see
 * `sessionBeginResolution`). */
export async function settleResolutionWithAgent(
  session: GameSession,
  pending: Pending,
  agent: PlayerAgent,
  rng: () => number,
): Promise<SessionStep> {
  const kept: Promise<unknown>[] = [];
  const hooks = forcedHooks(agent, session, kept);
  return settle(session, sessionBeginResolution(session, pending, rng, hooks), agent, rng, hooks, kept);
}
