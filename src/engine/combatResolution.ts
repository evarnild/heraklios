import type { HexCoord } from '../data/map';
import type { LandAttackResult } from './actions';
import {
  applyExchangeSacrifice,
  completePush,
  eligibleAdvanceCandidates,
  exchangeSacrificeForce,
  legalRetreatHexes,
  pushCandidates,
  retreatUnitTo,
  unitAt,
} from './combat';
import { rollDie } from './dice';
import { driftStep, needsInput, startElephantDrift, type DriftInput, type ElephantDriftState } from './drift';
import { unitType, type GameState, type PlayerId, type Unit } from './state';

/**
 * The resumable machine that settles one land combat after its die is rolled
 * (§72). Everything it holds is plain JSON - ids, hexes, the elephant drift's
 * own `ElephantDriftState` - so a `GameSession` round-trips through
 * `JSON.stringify` at any moment, including while a question is open.
 *
 * The order is today's fuzz harness's, kept exactly (§72 I1; the harness's
 * traces are pinned): after an exchange sacrifice, or after the forced
 * retreats one at a time and then the drifts, an advance offer follows each
 * DEFENDER's item - including an item skipped because the unit was already
 * moved or destroyed - and a DE or EX offers the advance per defender hex.
 * `BoardScene` differs a little (it offers no advance after a skipped item);
 * reconciling it is the follow-up intent's job.
 *
 * It asks only when there is a choice (I2): a retreat or push with a single
 * option and a sacrifice with a single minimal subset are applied at once and
 * reported through `ResolutionHooks.onForced`, which an agent adapter uses to
 * keep drawing its rng exactly where it always did.
 */

// ---------------------------------------------------------------------------
// The data a host sees
// ---------------------------------------------------------------------------

/** What a seat is being asked, as ids and hexes only (B5). `player` is who
 * answers: a unit's owner for a retreat or push, the attackers' owner for an
 * advance or a sacrifice - as `SeatAgentRouter` routes them. */
export type Question =
  | { kind: 'retreat'; player: PlayerId; unitId: string; options: HexCoord[] }
  | { kind: 'pushTarget'; player: PlayerId; unitId: string; candidateIds: string[] }
  | { kind: 'advance'; player: PlayerId; vacatedHex: HexCoord; candidateIds: string[] }
  | { kind: 'exchangeSacrifice'; player: PlayerId; attackerIds: string[]; requiredForce: number };

/** The answers (A1): a union of their own, not part of `Action`. */
export type AnswerAction =
  | { kind: 'answerRetreat'; hex: HexCoord }
  | { kind: 'answerPushTarget'; unitId: string }
  | { kind: 'answerAdvance'; unitId: string | null }
  | { kind: 'answerSacrifice'; unitIds: string[] };

export type SessionEvent =
  /** `unitId` took over the hex `pushedId` vacated (one link of a push). */
  | { kind: 'push'; unitId: string; pushedId: string }
  | { kind: 'driftStarted'; elephantId: string }
  | { kind: 'driftCombat'; elephantId: string; occupantId: string };

export interface ResolutionHooks {
  /** A step applied without asking, reported at the moment it is applied (A2):
   * a retreat or push with one option, a sacrifice with one minimal subset. */
  onForced?(question: Question): void;
}

type Step =
  | { kind: 'retreat'; unitId: string }
  | { kind: 'drift'; unitId: string }
  | { kind: 'advance'; hex: HexCoord }
  | { kind: 'sacrifice'; requiredForce: number };

interface PushFrame {
  unitId: string;
  /** The chain's ancestors, so `pushCandidates` cannot offer a unit still
   * mid-resolution higher up as if it were a bystander. */
  visited: string[];
  /** Set once this unit chose whom to push: it takes `vacatedHex` when that
   * unit's own resolution (the frame above) is done. */
  pushedId?: string;
  vacatedHex?: HexCoord;
}

/** An open resolution. `question` is set whenever a session holds one. */
export interface Pending {
  attackerIds: string[];
  steps: Step[];
  /** Units already moved by a chain, so a queued sibling is not asked twice. */
  resolvedIds: string[];
  frames: PushFrame[];
  drift: ElephantDriftState | null;
  /** What the drift gets on its next `driftStep`. */
  driftInput: DriftInput | null;
  question: Question | null;
}

export interface ResolutionItem {
  kind: 'retreat' | 'drift';
  unitId: string;
  originalHex: HexCoord;
}

// ---------------------------------------------------------------------------
// Building a resolution
// ---------------------------------------------------------------------------

export function newPending(attackerIds: string[], steps: Step[], resolvedIds: string[] = []): Pending {
  return { attackerIds, steps, resolvedIds, frames: [], drift: null, driftInput: null, question: null };
}

const advanceSteps = (hexes: readonly HexCoord[]): Step[] => hexes.map((hex) => ({ kind: 'advance', hex: { ...hex } }));

/** The queue for forced retreats then drifts: each item, then (on a defender's
 * side only - per the rulebook only a defender's retreat frees a hex the
 * attacker may take) an advance offer at the hex the item started on. */
export function stepsForItems(items: readonly ResolutionItem[], side: 'attacker' | 'defender'): Step[] {
  const steps: Step[] = [];
  for (const item of items) {
    steps.push({ kind: item.kind, unitId: item.unitId });
    if (side === 'defender') steps.push(...advanceSteps([item.originalHex]));
  }
  return steps;
}

/** The resolution a just-rolled land attack leaves, or null when it is done. */
export function pendingFromAttack(result: LandAttackResult): Pending | null {
  const { outcome, detail } = result;
  const attackerIds = result.attackers.map((u) => u.id);
  const hasItems = outcome.pendingDrifts.length > 0 || outcome.pendingRetreats.length > 0;
  let steps: Step[] = [];

  if (outcome.requiresExchangeChoice) {
    // Structurally impossible today (`applyLandCombatResult` only fills the
    // pending lists from 'AR'/'DR'); a regression guard, as the harness's was.
    if (hasItems) {
      throw new Error(
        'Invariant violated: applyLandCombatResult returned requiresExchangeChoice=true together with a non-empty pendingDrifts/pendingRetreats - the exchange-choice branch never processes either, so this would silently drop a forced retreat or elephant drift.',
      );
    }
    steps = [{ kind: 'sacrifice', requiredForce: outcome.requiredSacrificeForce }, ...advanceSteps(result.defenderOriginalHexes)];
  } else if (hasItems) {
    const items: ResolutionItem[] = [
      ...outcome.pendingRetreats.map((u) => ({ kind: 'retreat' as const, unitId: u.id, originalHex: { ...u.position } })),
      ...outcome.pendingDrifts.map((u) => ({ kind: 'drift' as const, unitId: u.id, originalHex: { ...u.position } })),
    ];
    steps = stepsForItems(items, detail.result === 'DR' ? 'defender' : 'attacker');
  } else if (detail.result === 'DE' || detail.result === 'EX') {
    steps = advanceSteps(result.defenderOriginalHexes);
  }
  return steps.length > 0 ? newPending(attackerIds, steps) : null;
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

function unitById(game: GameState, id: string): Unit {
  const unit = game.units.find((u) => u.id === id);
  if (!unit) throw new Error(`session: unit "${id}" no longer exists`);
  return unit;
}

/**
 * Every subset of the attackers that meets the threshold and from which no
 * unit can be removed while still meeting it (§72 I3), in bitmask order. A
 * non-minimal sacrifice is never a better play (it loses units for nothing),
 * and every legal answer has to be listable, so these are the answers. Every
 * unit's value is positive on the shipped roster (`exchangeSacrificeForce`),
 * so a subset that meets the threshold always contains a minimal one.
 */
function minimalSacrifices(attackers: readonly Unit[], requiredForce: number): string[][] {
  const n = attackers.length;
  if (n > 20) throw new Error(`session: cannot list the sacrifices of ${n} attackers`);
  const forces = attackers.map(exchangeSacrificeForce);
  const answers: string[][] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const picked = attackers.map((_, i) => i).filter((i) => mask & (1 << i));
    const total = picked.reduce((sum, i) => sum + forces[i]!, 0);
    if (total >= requiredForce && picked.every((i) => total - forces[i]! < requiredForce)) {
      answers.push(picked.map((i) => attackers[i]!.id));
    }
  }
  return answers;
}

/** B6: exactly the answers `question` accepts. */
export function questionAnswers(game: GameState, question: Question): AnswerAction[] {
  switch (question.kind) {
    case 'retreat':
      return question.options.map((hex) => ({ kind: 'answerRetreat', hex: { ...hex } }));
    case 'pushTarget':
      return question.candidateIds.map((unitId) => ({ kind: 'answerPushTarget', unitId }));
    case 'advance':
      return [...question.candidateIds.map((unitId) => ({ kind: 'answerAdvance' as const, unitId })), { kind: 'answerAdvance', unitId: null }];
    case 'exchangeSacrifice':
      return minimalSacrifices(question.attackerIds.map((id) => unitById(game, id)), question.requiredForce).map((unitIds) => ({
        kind: 'answerSacrifice',
        unitIds,
      }));
  }
}

export function sameAnswer(a: AnswerAction, b: AnswerAction): boolean {
  switch (a.kind) {
    case 'answerRetreat':
      return b.kind === 'answerRetreat' && a.hex.q === b.hex.q && a.hex.r === b.hex.r;
    case 'answerPushTarget':
      return b.kind === 'answerPushTarget' && a.unitId === b.unitId;
    case 'answerAdvance':
      return b.kind === 'answerAdvance' && a.unitId === b.unitId;
    case 'answerSacrifice':
      return b.kind === 'answerSacrifice' && [...a.unitIds].sort().join() === [...b.unitIds].sort().join();
  }
}

/** Applies a listed answer to the open question (the caller has checked it). */
export function applyAnswer(game: GameState, pending: Pending, answer: AnswerAction): void {
  const question = pending.question;
  if (!question) throw new Error('session: no question is open');
  switch (answer.kind) {
    case 'answerRetreat': {
      const frame = topFrame(pending);
      const hex = (question as Extract<Question, { kind: 'retreat' }>).options.find((h) => h.q === answer.hex.q && h.r === answer.hex.r)!;
      retreatUnitTo(unitById(game, frame.unitId), { ...hex });
      pending.frames.pop();
      break;
    }
    case 'answerPushTarget':
      beginPush(pending, topFrame(pending), unitById(game, answer.unitId));
      break;
    case 'answerAdvance':
      if (answer.unitId !== null) {
        unitById(game, answer.unitId).position = { ...(question as Extract<Question, { kind: 'advance' }>).vacatedHex };
      }
      break;
    case 'answerSacrifice':
      applyExchangeSacrifice(answer.unitIds.map((id) => unitById(game, id)));
      break;
  }
  pending.question = null;
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function topFrame(pending: Pending): PushFrame {
  const frame = pending.frames[pending.frames.length - 1];
  if (!frame) throw new Error('session: no retreat is in progress');
  return frame;
}

function newFrame(pending: Pending, unitId: string, visited: string[]): PushFrame {
  if (!pending.resolvedIds.includes(unitId)) pending.resolvedIds.push(unitId);
  return { unitId, visited };
}

/** `frame`'s unit chose to push `pushed`: the pushed unit's own retreat
 * resolves first (it may cascade further), and only then does `frame`'s unit
 * take the hex `pushed` vacated - captured now, before `pushed` moves. */
function beginPush(pending: Pending, frame: PushFrame, pushed: Unit): void {
  frame.pushedId = pushed.id;
  frame.vacatedHex = { ...pushed.position };
  pending.frames.push(newFrame(pending, pushed.id, [...frame.visited, frame.unitId]));
}

/** One step of the retreat-or-push cascade (`engine/retreat.ts`'s
 * `resolveUnitRetreat`, unrolled onto `pending.frames`). A question, or null
 * when it made progress and the caller should go on. */
function stepRetreat(game: GameState, pending: Pending, hooks: ResolutionHooks, events: SessionEvent[]): Question | null {
  const frame = topFrame(pending);
  const unit = unitById(game, frame.unitId);

  if (frame.pushedId !== undefined) {
    completePush(unit, frame.vacatedHex!);
    events.push({ kind: 'push', unitId: unit.id, pushedId: frame.pushedId });
    pending.frames.pop();
    return null;
  }

  const legalHexes = legalRetreatHexes(game, unit);
  if (legalHexes.length > 0) {
    const question: Question = { kind: 'retreat', player: unit.owner, unitId: unit.id, options: legalHexes };
    if (legalHexes.length > 1) return question;
    hooks.onForced?.(question);
    retreatUnitTo(unit, legalHexes[0]!);
    pending.frames.pop();
    return null;
  }

  const targets = pushCandidates(game, unit, new Set(frame.visited));
  if (targets.length === 0) {
    unit.destroyed = true; // neither a hex to go to nor a friend to push
    pending.frames.pop();
    return null;
  }
  const question: Question = { kind: 'pushTarget', player: unit.owner, unitId: unit.id, candidateIds: targets.map((u) => u.id) };
  if (targets.length > 1) return question;
  hooks.onForced?.(question);
  beginPush(pending, frame, targets[0]!);
  return null;
}

/** One `driftStep` and what follows it, exactly `resolveElephantDrift`'s loop:
 * its events, then at most one input - a die from `rng`, or a trampled unit's
 * retreat cascade, after which the drift resumes. Never a second `driftStep`
 * before that input is supplied. */
function stepDrift(game: GameState, pending: Pending, rng: () => number, events: SessionEvent[]): null {
  const result = driftStep(game, pending.drift!, pending.driftInput ?? undefined);
  pending.drift = result.state;
  pending.driftInput = null;

  for (const event of result.events) {
    if (event.kind === 'driftStarted') {
      if (!pending.resolvedIds.includes(event.elephant.id)) pending.resolvedIds.push(event.elephant.id);
      events.push({ kind: 'driftStarted', elephantId: event.elephant.id });
    } else if (event.kind === 'combatResolved') {
      events.push({ kind: 'driftCombat', elephantId: event.elephant.id, occupantId: event.occupant.id });
    }
  }
  if (result.done) {
    pending.drift = null;
    return null;
  }

  const request = needsInput(result.events);
  if (!request) return null; // a single-hex step that needs nothing: resume
  switch (request.kind) {
    case 'directionRollNeeded':
      pending.driftInput = { kind: 'directionRoll', dieRoll: rollDie(rng) };
      break;
    case 'combatRollNeeded':
      pending.driftInput = { kind: 'combatRoll', dieRoll: rollDie(rng) };
      break;
    case 'retreatResolutionNeeded':
      // The trampled unit's cascade runs first; the drift resumes after it.
      pending.frames.push(newFrame(pending, request.unit.id, []));
      pending.driftInput = { kind: 'retreatResolved' };
      break;
  }
  return null;
}

/** Starts the next queued step. A question, or null to go on. */
function beginStep(game: GameState, pending: Pending, step: Step, hooks: ResolutionHooks): Question | null {
  switch (step.kind) {
    case 'retreat':
    case 'drift': {
      const unit = unitById(game, step.unitId);
      // A unit a chain already moved, or that is gone, is skipped - but its
      // advance offer, queued after it, still comes (I1).
      if (unit.destroyed || pending.resolvedIds.includes(unit.id)) return null;
      if (step.kind === 'retreat') pending.frames.push(newFrame(pending, unit.id, []));
      else pending.drift = startElephantDrift(unit, unitType(unit).movement);
      return null;
    }
    case 'advance': {
      if (unitAt(game, step.hex)) return null; // re-occupied by an earlier choice in this batch
      const alive = eligibleAdvanceCandidates(
        pending.attackerIds.map((id) => unitById(game, id)),
        step.hex,
      );
      if (alive.length === 0) return null;
      return { kind: 'advance', player: alive[0]!.owner, vacatedHex: { ...step.hex }, candidateIds: alive.map((u) => u.id) };
    }
    case 'sacrifice': {
      const attackers = pending.attackerIds.map((id) => unitById(game, id));
      const question: Question = {
        kind: 'exchangeSacrifice',
        player: attackers[0]!.owner,
        attackerIds: [...pending.attackerIds],
        requiredForce: step.requiredForce,
      };
      const answers = minimalSacrifices(attackers, step.requiredForce);
      if (answers.length === 0) {
        throw new Error(`session: no combination of ${attackers.length} attacker(s) reaches the required force ${step.requiredForce} - CRT invariant violated`);
      }
      if (answers.length > 1) return question;
      hooks.onForced?.(question);
      applyExchangeSacrifice(answers[0]!.map((id) => unitById(game, id)));
      return null;
    }
  }
}

/** Runs `pending` until it needs an answer (returned, and stored in
 * `pending.question`) or is settled (null). */
export function runResolution(
  game: GameState,
  pending: Pending,
  rng: () => number,
  hooks: ResolutionHooks,
  events: SessionEvent[],
): Question | null {
  for (;;) {
    let question: Question | null = null;
    if (pending.frames.length > 0) {
      question = stepRetreat(game, pending, hooks, events);
    } else if (pending.drift) {
      stepDrift(game, pending, rng, events);
    } else {
      const step = pending.steps.shift();
      if (!step) {
        pending.question = null;
        return null;
      }
      question = beginStep(game, pending, step, hooks);
    }
    if (question) {
      pending.question = question;
      return question;
    }
  }
}
