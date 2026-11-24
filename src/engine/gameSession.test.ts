import { describe, expect, it, vi } from 'vitest';
import type { CombatResult } from '../data/combatTable';
import type { HexCoord } from '../data/map';
import { applyAction, legalActions, type Action } from './actions';
import { describeLandAttack, eligibleAdvanceCandidates, legalRetreatHexes, unitAt } from './combat';
import { newPending, stepsForItems, type AnswerAction, type Question } from './combatResolution';
import { rollDie } from './dice';
import { resolveElephantDrift } from './drift';
import {
  buildElephantScenarioGameState,
} from './fuzzHarness';
import {
  newSession,
  sessionApply,
  sessionBeginResolution,
  sessionLegalActions,
  sessionQuestion,
  type GameSession,
  type SessionAction,
  type SessionEvent,
} from './gameSession';
import { RandomAgent } from './randomAgent';
import { resolveUnitRetreat } from './retreat';
import { createSeededRng } from './rng';
import { settleWithAgent } from './sessionAgents';
import { unitType, type GameState, type Unit } from './state';
import { createInitialState } from './turnManager';

// ---------------------------------------------------------------------------
// Helpers: small hand-built positions on known plain hexes, a die chosen from
// the combat table (`dieFor`), and a scripted rng - as `fuzzHarness.test.ts`.
// ---------------------------------------------------------------------------

function unit(id: string, typeId: string, q: number, r: number, owner: 0 | 1 = 0): Unit {
  return {
    id,
    owner,
    typeId,
    position: { q, r },
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

function gameWith(units: Unit[], phase: 'movement' | 'combat' = 'combat'): GameState {
  const state = createInitialState(
    [
      { id: 0, name: 'P0', edge: 'W', purchasePoints: 0, eliminated: false },
      { id: 1, name: 'P1', edge: 'E', purchasePoints: 0, eliminated: false },
    ],
    'multi-defender',
  );
  state.units = units;
  state.phase = phase;
  return state;
}

/** The die (1-6) that gives `result` for this fight, terrain included. */
function dieFor(attackers: Unit[], defenders: Unit[], result: CombatResult): number {
  for (let die = 1; die <= 6; die++) {
    if (describeLandAttack(attackers, defenders, die).result === result) return die;
  }
  throw new Error(`No die gives ${result} for ${attackers.map((a) => a.typeId)} vs ${defenders.map((d) => d.typeId)}`);
}

/** A rng that yields `dice` in order (die d is (d-1)/6) and throws when empty. */
function scripted(dice: number[]): () => number {
  const queue = [...dice];
  return () => {
    const die = queue.shift();
    if (die === undefined) throw new Error('scripted rng: no die left');
    return (die - 1) / 6;
  };
}

const attackAction = (attackers: Unit[], defenders: Unit[]): Action => ({
  kind: 'landAttack',
  attackerIds: attackers.map((u) => u.id),
  defenderIds: defenders.map((u) => u.id),
});

type Chooser = (question: Question, answers: AnswerAction[]) => AnswerAction;
const first: Chooser = (_q, answers) => answers[0]!;
const last: Chooser = (_q, answers) => answers[answers.length - 1]!;

interface Played {
  questions: Question[];
  forced: Question[];
  events: SessionEvent[];
}

/** Attacks, then answers every question with `choose` until settled. */
function playAttack(
  session: GameSession,
  attack: Action,
  rng: () => number,
  choose: Chooser = first,
): Played {
  const played: Played = { questions: [], forced: [], events: [] };
  const hooks = { onForced: (q: Question) => played.forced.push(structuredClone(q)) };
  let step = sessionApply(session, attack, rng, hooks);
  played.events.push(...step.events);
  while (session.pending) {
    const question = sessionQuestion(session)!;
    played.questions.push(structuredClone(question));
    const answers = sessionLegalActions(session) as AnswerAction[];
    step = sessionApply(session, choose(question, answers), rng, hooks);
    played.events.push(...step.events);
  }
  return played;
}

const kinds = (qs: Question[]) => qs.map((q) => `${q.kind}:${q.player}`);

/** The answer naming `unitId` for a push or advance question. */
const byUnit = (unitId: string): Chooser => (_q, answers) =>
  answers.find((a) => (a.kind === 'answerPushTarget' || a.kind === 'answerAdvance') && a.unitId === unitId) ?? answers[0]!;

// ---------------------------------------------------------------------------
// B4, B5: the questions each outcome leaves, in today's order
// ---------------------------------------------------------------------------

describe('question sequences (B4, B5)', () => {
  it('AR with two attackers asks each attacker, in order, with no advance', () => {
    const a1 = unit('a1', 'fantassins', 10, 5);
    const a2 = unit('a2', 'fantassins', 10, 6);
    const d = unit('d', 'phalanges', 11, 5, 1);
    const state = gameWith([a1, a2, d]);
    const session = newSession(state);
    const options1 = legalRetreatHexes(state, a1);

    const played = playAttack(session, attackAction([a1, a2], [d]), scripted([dieFor([a1, a2], [d], 'AR')]));

    expect(kinds(played.questions)).toEqual(['retreat:0', 'retreat:0']);
    expect(played.questions.map((q) => (q as { unitId: string }).unitId)).toEqual(['a1', 'a2']);
    expect((played.questions[0] as { options: HexCoord[] }).options).toEqual(options1);
    expect(played.forced).toEqual([]);
    expect(session.pending).toBeNull();
  });

  it('DR with two or more hexes asks the defender, then offers the attacker the vacated hex', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    const state = gameWith([a, d]);
    const options = legalRetreatHexes(state, d);
    expect(options.length).toBeGreaterThan(1);

    const played = playAttack(newSession(state), attackAction([a], [d]), scripted([dieFor([a], [d], 'DR')]));

    expect(kinds(played.questions)).toEqual(['retreat:1', 'advance:0']);
    expect(played.questions[0]).toEqual({ kind: 'retreat', player: 1, unitId: 'd', options });
    expect(played.questions[1]).toEqual({ kind: 'advance', player: 0, vacatedHex: { q: 11, r: 5 }, candidateIds: ['a'] });
    expect(d.position).toEqual(options[0]);
    expect(a.position).toEqual({ q: 11, r: 5 }); // the first listed answer is the unit itself
  });

  // I2 and A2: nothing to choose is not a question, but is reported.
  it('DR with a single retreat hex asks nothing, moves the unit and reports it through onForced', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    // Own units fill all but one of the hexes the attacker's zone leaves open.
    const blockers = [unit('b1', 'fantassins', 12, 4, 1), unit('b2', 'fantassins', 11, 6, 1)];
    const state = gameWith([a, d, ...blockers]);
    expect(legalRetreatHexes(state, d)).toEqual([{ q: 12, r: 5 }]);

    const played = playAttack(newSession(state), attackAction([a], [d]), scripted([dieFor([a], [d], 'DR')]), last);

    expect(played.forced).toEqual([{ kind: 'retreat', player: 1, unitId: 'd', options: [{ q: 12, r: 5 }] }]);
    expect(kinds(played.questions)).toEqual(['advance:0']);
    expect(d.position).toEqual({ q: 12, r: 5 });
  });

  it('DE asks an advance for each defender hex, and skips a hex no attacker can reach', () => {
    const make = () => {
      const a = unit('a', 'phalanges', 11, 5);
      const d1 = unit('d1', 'archers', 10, 5, 1);
      const d2 = unit('d2', 'archers', 12, 5, 1);
      return { a, d1, d2, state: gameWith([a, d1, d2]) };
    };
    const declining = make();
    const die = dieFor([declining.a], [declining.d1, declining.d2], 'DE');
    const declined = playAttack(newSession(declining.state), attackAction([declining.a], [declining.d1, declining.d2]), scripted([die]), last);
    expect(declined.questions).toEqual([
      { kind: 'advance', player: 0, vacatedHex: { q: 10, r: 5 }, candidateIds: ['a'] },
      { kind: 'advance', player: 0, vacatedHex: { q: 12, r: 5 }, candidateIds: ['a'] },
    ]);
    expect(declining.a.position).toEqual({ q: 11, r: 5 });

    // Advancing into the first hex leaves the second out of reach: no question.
    const advancing = make();
    const taken = playAttack(newSession(advancing.state), attackAction([advancing.a], [advancing.d1, advancing.d2]), scripted([die]), first);
    expect(taken.questions).toHaveLength(1);
    expect(advancing.a.position).toEqual({ q: 10, r: 5 });
  });

  it('EX with one attacker asks nothing: the attacker is destroyed', () => {
    const a = unit('a', 'phalanges', 11, 5);
    const d = unit('d', 'archers', 10, 5, 1);
    const played = playAttack(newSession(gameWith([a, d])), attackAction([a], [d]), scripted([dieFor([a], [d], 'EX')]));
    expect(played.questions).toEqual([]);
    expect(played.forced).toEqual([]);
    expect(a.destroyed).toBe(true);
    expect(d.destroyed).toBe(true);
  });

  it('EX with several attackers asks a sacrifice, then the advance', () => {
    const a1 = unit('a1', 'phalanges', 11, 5);
    const a2 = unit('a2', 'phalanges', 11, 4);
    const d = unit('d', 'archers', 10, 5, 1);
    const state = gameWith([a1, a2, d]);
    const played = playAttack(newSession(state), attackAction([a1, a2], [d]), scripted([dieFor([a1, a2], [d], 'EX')]));

    expect(played.questions).toEqual([
      { kind: 'exchangeSacrifice', player: 0, attackerIds: ['a1', 'a2'], requiredForce: 1 },
      { kind: 'advance', player: 0, vacatedHex: { q: 10, r: 5 }, candidateIds: ['a2'] },
    ]);
    expect(a1.destroyed).toBe(true); // the first listed answer
    expect(a2.position).toEqual({ q: 10, r: 5 });
  });

  it('a unit with no hex and nobody to push is eliminated with no question', () => {
    const d = unit('d', 'fantassins', 14, 5, 1);
    const ring = [
      { q: 15, r: 5 }, { q: 15, r: 4 }, { q: 14, r: 4 }, { q: 13, r: 5 }, { q: 13, r: 6 }, { q: 14, r: 6 },
    ].map((h, i) => unit(`r${i}`, 'fantassins', h.q, h.r, 0));
    const state = gameWith([d, ...ring]);
    const played = playAttack(newSession(state), attackAction([ring[0]!], [d]), scripted([dieFor([ring[0]!], [d], 'DR')]));
    expect(played.questions).toEqual([]);
    expect(d.destroyed).toBe(true);
  });

  it('a retreat that is blocked once its turn comes eliminates the unit with no question', () => {
    const boxed = unit('boxed', 'fantassins', 14, 5, 1);
    const ring = [
      { q: 15, r: 5 }, { q: 15, r: 4 }, { q: 14, r: 4 }, { q: 13, r: 5 }, { q: 13, r: 6 }, { q: 14, r: 6 },
    ].map((h, i) => unit(`r${i}`, 'fantassins', h.q, h.r, 0));
    const session = newSession(gameWith([boxed, ...ring]));
    const pending = newPending(['r0'], [{ kind: 'retreat', unitId: 'boxed' }]);
    const step = sessionBeginResolution(session, pending, scripted([]));
    expect(step.pending).toBeNull();
    expect(boxed.destroyed).toBe(true);
  });

  /**
   * a (2,18) is boxed in, with two friends that could be pushed: b (3,18) and
   * d (1,18). b is boxed too, with c (4,18) behind it, which can retreat. The
   * same shape `fuzzHarness.test.ts` uses for the visited-set test, moved to
   * where a river runs between e0 (3,17) and b, and another between a (2,18)
   * and b (3,18), which the push crosses (rivers don't affect a push).
   *
   * §90: a push may never take a hex under enemy ZOC. The attacker e0 touches
   * a and b, so it would ZOC b's hex - except that the river along (3,17)-(3,18)
   * blocks ZOC (`hexesUnderZoc`), and an advance ignores rivers. The other
   * five boxes are naval placeholders (`galeres`): they block a retreat but
   * project no ZOC. The map's ground here is all plain.
   */
  function pushPosition() {
    const a = unit('a', 'fantassins', 2, 18);
    const b = unit('b', 'fantassins', 3, 18);
    const c = unit('c', 'fantassins', 4, 18);
    const d = unit('d', 'fantassins', 1, 18);
    const enemyHexes = [
      { q: 3, r: 17 }, { q: 2, r: 17 }, { q: 1, r: 19 }, { q: 2, r: 19 }, { q: 4, r: 17 }, { q: 3, r: 19 },
    ];
    const enemies = enemyHexes.map((h, i) => unit(`e${i}`, i === 0 ? 'fantassins' : 'galeres', h.q, h.r, 1));
    const state = gameWith([a, b, c, d, ...enemies]);
    state.activePlayerIndex = 1;
    return { a, b, c, d, attacker: enemies[0]!, state };
  }

  // a and b are both defenders, queued in that order. a is boxed in and pushes
  // b, so a takes b's original hex before b's own advance offer comes; that
  // hex is occupied again, so no advance is offered into it. Kills removing
  // the occupancy guard (an attacker next to it would be offered a hex a unit
  // already stands on).
  it('offers no advance into a defender hex that is occupied again', () => {
    const { a, b, state } = pushPosition();
    const e0 = state.units.find((u) => u.id === 'e0')!; // (3,17), next to both a and b (a river lies between e0 and b)
    const session = newSession(state);
    const pending = newPending(
      [e0.id],
      stepsForItems(
        [
          { kind: 'retreat', unitId: 'a', originalHex: { q: 2, r: 18 } },
          { kind: 'retreat', unitId: 'b', originalHex: { q: 3, r: 18 } },
        ],
        'defender',
      ),
    );
    sessionBeginResolution(session, pending, scripted([]));
    const advances: Question[] = [];
    while (session.pending) {
      const question = sessionQuestion(session)!;
      const answers = sessionLegalActions(session) as AnswerAction[];
      if (question.kind === 'advance') advances.push(question);
      const choice = question.kind === 'pushTarget' ? answers.find((x) => x.kind === 'answerPushTarget' && x.unitId === 'b')! : answers.at(-1)!;
      sessionApply(session, choice, scripted([]));
    }
    expect(a.position).toEqual({ q: 3, r: 18 }); // a took b's hex
    expect(b.position).not.toEqual({ q: 3, r: 18 });
    expect(advances.map((q) => (q as { vacatedHex: HexCoord }).vacatedHex)).toEqual([{ q: 2, r: 18 }]);
  });

  it('a push asks which friend to push, resolves the chain, then offers the advance', () => {
    const { a, b, c, attacker, state } = pushPosition();
    const cOptions = legalRetreatHexes(state, c);
    const session = newSession(state);

    const played = playAttack(session, attackAction([attacker], [a]), scripted([dieFor([attacker], [a], 'DR')]), byUnit('b'));

    expect(played.questions[0]).toEqual({ kind: 'pushTarget', player: 0, unitId: 'a', candidateIds: ['b', 'd'] });
    // b has only c to push (forced); c's own retreat is a question only when it has a choice.
    expect(played.forced.some((q) => q.kind === 'pushTarget' && q.unitId === 'b')).toBe(true);
    expect(cOptions.length > 1 ? played.questions.some((q) => q.kind === 'retreat' && q.unitId === 'c') : played.forced.some((q) => q.kind === 'retreat' && q.unitId === 'c')).toBe(true);
    expect(played.questions.at(-1)).toEqual({ kind: 'advance', player: 1, vacatedHex: { q: 2, r: 18 }, candidateIds: [attacker.id] });
    expect(played.events).toEqual([
      { kind: 'push', unitId: 'b', pushedId: 'c' },
      { kind: 'push', unitId: 'a', pushedId: 'b' },
    ]);
    expect(b.position).toEqual({ q: 4, r: 18 });
    expect(a.position).toEqual({ q: 3, r: 18 });
  });

  /**
   * An elephant (owner 1) is driven off by a chariot, and its drift tramples a
   * phalanx (owner 0), which is thrown back and has to retreat: that retreat is
   * asked of the phalanx's owner, not the elephant's.
   */
  function trampleScript() {
    const elephant = unit('e', 'elephants', 14, 5, 1);
    const attacker = unit('c', 'chars-lourds', 13, 5, 0);
    const trampled = unit('p', 'phalanges', 15, 5, 0); // direction die 1 is {q: 1, r: 0}
    const state = gameWith([elephant, attacker, trampled]);
    const dice = [
      dieFor([attacker], [elephant], 'DR'),
      1,
      dieFor([elephant], [trampled], 'DR'),
    ];
    return { elephant, attacker, trampled, state, dice };
  }

  it('a drift that tramples a unit asks that unit\'s owner, then the drift goes on', () => {
    const { elephant, attacker, trampled, state, dice } = trampleScript();
    const options = legalRetreatHexes(state, trampled);
    // The last option is off the drift's path (east along r=5), so the elephant
    // walks on without meeting the phalanx again.
    const played = playAttack(newSession(state), attackAction([attacker], [elephant]), scripted(dice), last);

    expect(played.questions[0]).toEqual({ kind: 'retreat', player: 0, unitId: 'p', options });
    expect(played.questions[1]).toEqual({ kind: 'advance', player: 0, vacatedHex: { q: 14, r: 5 }, candidateIds: ['c'] });
    expect(played.events.map((e) => e.kind)).toEqual(['driftStarted', 'driftCombat']);
    expect(trampled.position).toEqual(options.at(-1)); // moved by its owner's answer
    expect(elephant.position).toEqual({ q: 14 + unitType(elephant).movement, r: 5 }); // its whole move, east: it carried on
  });

  // The queue is the retreats first, then the drifts, each followed by the
  // advance at its own hex (the harness's order, I1). Kills swapping them: the
  // drift would roll its dice before the retreat is even asked.
  it('asks a forced retreat before an elephant drifts', () => {
    const elephant = unit('e', 'elephants', 14, 5, 1);
    const foot = unit('f', 'fantassins', 14, 4, 1);
    const chariot = unit('c', 'chars-lourds', 13, 5, 0);
    const state = gameWith([elephant, foot, chariot]);
    const session = newSession(state);
    const rng = scripted([dieFor([chariot], [elephant, foot], 'DR'), 1]);

    const step = sessionApply(session, attackAction([chariot], [elephant, foot]), rng);
    expect(step.events).toEqual([]); // no drift has started
    const asked = [sessionQuestion(session)!];
    expect(asked[0]).toMatchObject({ kind: 'retreat', player: 1, unitId: 'f' });

    const events: SessionEvent[] = [];
    while (session.pending) {
      const answers = sessionLegalActions(session) as AnswerAction[];
      events.push(...sessionApply(session, answers.at(-1)!, rng).events);
      if (session.pending) asked.push(sessionQuestion(session)!);
    }
    expect(asked.map((q) => q.kind)).toEqual(['retreat', 'advance', 'advance']);
    expect(events.map((e) => e.kind)).toEqual(['driftStarted']);
  });

  // I1: an item skipped because its unit is already gone still gets its
  // advance offer, when it is a defender's. Kills dropping that offer.
  it('still offers the advance after a defender item that is skipped', () => {
    const gone = unit('gone', 'fantassins', 11, 5, 1);
    gone.destroyed = true;
    const a = unit('a', 'fantassins', 10, 5);
    const session = newSession(gameWith([gone, a]));
    const pending = newPending(['a'], stepsForItems([{ kind: 'retreat', unitId: 'gone', originalHex: { q: 11, r: 5 } }], 'defender'));
    sessionBeginResolution(session, pending, scripted([]));
    expect(sessionQuestion(session)).toEqual({ kind: 'advance', player: 0, vacatedHex: { q: 11, r: 5 }, candidateIds: ['a'] });

    // An attacker's own skipped item offers nothing.
    const other = newSession(gameWith([structuredClone(gone), structuredClone(a)]));
    sessionBeginResolution(other, newPending(['a'], stepsForItems([{ kind: 'retreat', unitId: 'gone', originalHex: { q: 11, r: 5 } }], 'attacker')), scripted([]));
    expect(other.pending).toBeNull();
  });

  it('keeps the same questions when played through a JSON copy mid-question', () => {
    const run = (copyMidway: boolean) => {
      const { elephant, attacker, state, dice } = trampleScript();
      let session = newSession(state);
      const rng = scripted(dice);
      sessionApply(session, attackAction([attacker], [elephant]), rng);
      expect(sessionQuestion(session)).not.toBeNull();
      if (copyMidway) {
        const copy = JSON.parse(JSON.stringify(session)) as GameSession;
        expect(copy).toEqual(session); // plain JSON: nothing lost in the copy (B1)
        session = copy;
      }
      while (session.pending) sessionApply(session, sessionLegalActions(session).at(-1) as AnswerAction, rng);
      return session;
    };
    expect(run(true).state).toEqual(run(false).state);
    expect(run(true).context).toEqual(run(false).context);
  });
});

// ---------------------------------------------------------------------------
// B2, B6: the answer lists
// ---------------------------------------------------------------------------

describe('answer lists (B2, B6)', () => {
  it('lists exactly legalActions, in order, when no question is open - with the context kept', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const b = unit('b', 'fantassins', 10, 6);
    const d = unit('d', 'phalanges', 11, 5, 1);
    const session = newSession(gameWith([a, b, d]));
    expect(sessionLegalActions(session)).toEqual(legalActions(session.state, {}));

    session.context.attackedThisPhase.push('a');
    session.context.rammedThisTurn.push('zz');
    expect(sessionLegalActions(session)).toEqual(
      legalActions(session.state, { attackedThisPhase: new Set(['a']), rammedThisTurn: new Set(['zz']) }),
    );
    expect(sessionLegalActions(session)).not.toContainEqual({ kind: 'landAttack', attackerIds: ['a'], defenderIds: ['d'] });
    expect(sessionLegalActions(session)).toContainEqual({ kind: 'landAttack', attackerIds: ['b'], defenderIds: ['d'] });
  });

  it('lists exactly the answers of the open question', () => {
    const { a, attacker, state } = (() => {
      const a = unit('a', 'fantassins', 10, 5);
      const d = unit('d', 'fantassins', 11, 5, 1);
      return { a, attacker: a, state: gameWith([a, d]) };
    })();
    const session = newSession(state);
    const d = state.units[1]!;
    sessionApply(session, attackAction([attacker], [d]), scripted([dieFor([a], [d], 'DR')]));
    const question = sessionQuestion(session)!;
    expect(question.kind).toBe('retreat');
    const listed = sessionLegalActions(session);
    expect(listed).toEqual(legalRetreatHexes(state, d).map((hex) => ({ kind: 'answerRetreat', hex })));
    for (const action of listed) expect(action.kind).toBe('answerRetreat'); // and no turn action
  });

  // Forces [4, 4, 2] against a threshold of 5. The set {4a, 4b, 2} is not
  // minimal (either 4 can be dropped), so it is not listed. Kills dropping the
  // minimality filter and changing the order.
  it('lists the minimal sacrifices in bitmask order', () => {
    const a = unit('a', 'fantassins-lourds', 10, 5); // attack 4
    const b = unit('b', 'fantassins-lourds', 10, 6);
    const c = unit('c', 'fantassins', 10, 7); // attack 2
    const session = newSession(gameWith([a, b, c]));
    sessionBeginResolution(session, newPending(['a', 'b', 'c'], [{ kind: 'sacrifice', requiredForce: 5 }]), scripted([]));
    expect(sessionLegalActions(session)).toEqual([
      { kind: 'answerSacrifice', unitIds: ['a', 'b'] },
      { kind: 'answerSacrifice', unitIds: ['a', 'c'] },
      { kind: 'answerSacrifice', unitIds: ['b', 'c'] },
    ]);
  });

  it('applies a lone minimal sacrifice at once, through onForced', () => {
    const a = unit('a', 'fantassins-lourds', 10, 5);
    const b = unit('b', 'fantassins', 10, 6);
    const session = newSession(gameWith([a, b]));
    const forced: Question[] = [];
    sessionBeginResolution(session, newPending(['a', 'b'], [{ kind: 'sacrifice', requiredForce: 4 }]), scripted([]), {
      onForced: (q) => forced.push(q),
    });
    expect(forced).toHaveLength(1);
    expect(a.destroyed).toBe(true);
    expect(b.destroyed).toBe(false);
    expect(session.pending).toBeNull();
  });

  it('ends the advance list with a decline', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const session = newSession(gameWith([a]));
    sessionBeginResolution(session, newPending(['a'], [{ kind: 'advance', hex: { q: 11, r: 5 } }]), scripted([]));
    expect(sessionLegalActions(session)).toEqual([
      { kind: 'answerAdvance', unitId: 'a' },
      { kind: 'answerAdvance', unitId: null },
    ]);
  });
});

// ---------------------------------------------------------------------------
// B3, A3: checks and the context
// ---------------------------------------------------------------------------

describe('checks (B3, A3)', () => {
  function withOpenQuestion() {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'fantassins', 11, 5, 1);
    const session = newSession(gameWith([a, d]));
    sessionApply(session, attackAction([a], [d]), scripted([dieFor([a], [d], 'DR')]));
    expect(sessionQuestion(session)).not.toBeNull();
    return session;
  }

  // Each rejected call must leave the state and the session exactly as they
  // were: kills checking after mutating.
  const rejects = (session: GameSession, action: SessionAction, message: RegExp) => {
    const before = structuredClone(session);
    expect(() => sessionApply(session, action, scripted([1, 1, 1]))).toThrow(message);
    expect(session).toEqual(before);
  };

  it('rejects a turn action while a question is open', () => {
    rejects(withOpenQuestion(), { kind: 'endPhase' }, /question is open/);
  });

  it('rejects an answer with no question open', () => {
    const session = newSession(gameWith([unit('a', 'fantassins', 10, 5)]));
    rejects(session, { kind: 'answerAdvance', unitId: null }, /no question is open/);
  });

  it('rejects an answer that is not one of the open question\'s', () => {
    const session = withOpenQuestion();
    rejects(session, { kind: 'answerRetreat', hex: { q: 500, r: 500 } }, /not one of/);
    rejects(session, { kind: 'answerAdvance', unitId: null }, /not one of/);
  });

  it('applies a combined attack that legalActions never lists (A3)', () => {
    const a1 = unit('a1', 'phalanges', 11, 5);
    const a2 = unit('a2', 'phalanges', 11, 4);
    const d = unit('d', 'archers', 10, 5, 1);
    const session = newSession(gameWith([a1, a2, d]));
    const action = attackAction([a1, a2], [d]);
    expect(sessionLegalActions(session)).not.toContainEqual(action);
    const step = sessionApply(session, action, scripted([dieFor([a1, a2], [d], 'DE')]));
    expect(step.result.kind).toBe('landAttack');
    expect(d.destroyed).toBe(true);
  });

  it('needs an rng', () => {
    const session = newSession(gameWith([unit('a', 'fantassins', 10, 5)]));
    expect(() => sessionApply(session, { kind: 'endPhase' }, undefined as unknown as () => number)).toThrow(/rng/);
  });
});

describe('the context (B3)', () => {
  const SEA = { q: 28, r: 6 };
  const ahead = { q: SEA.q + 1, r: SEA.r };

  it('records land attackers and a boarding attacker as having attacked', () => {
    const a1 = unit('a1', 'phalanges', 11, 5);
    const a2 = unit('a2', 'phalanges', 11, 4);
    const d = unit('d', 'archers', 10, 5, 1);
    const session = newSession(gameWith([a1, a2, d]));
    sessionApply(session, attackAction([a1, a2], [d]), scripted([dieFor([a1, a2], [d], 'DE')]));
    expect(session.context.attackedThisPhase).toEqual(['a1', 'a2']);

    const ship = unit('s', 'galeres', 0, 0);
    const foe = unit('f', 'galeres', 1, 0, 1);
    const boarding = newSession(gameWith([ship, foe]));
    sessionApply(boarding, { kind: 'board', attackerId: 's', defenderId: 'f' }, scripted([1]));
    expect(boarding.context.attackedThisPhase).toEqual(['s']);
  });

  it('records a ram, and clears it only on entering a movement phase', () => {
    const rammer = unit('a', 'galeres', SEA.q, SEA.r);
    rammer.movementLeft = 8;
    const target = unit('d', 'quintiremes', ahead.q, ahead.r, 1); // a miss, so both sides stay in the game
    const state = gameWith([rammer, target], 'movement');
    const session = newSession(state);

    sessionApply(session, { kind: 'ram', unitId: 'a' }, scripted([6]));
    expect(session.context.rammedThisTurn).toEqual(['a']);

    sessionApply(session, { kind: 'endPhase' }, scripted([])); // movement -> combat: kept
    expect(state.phase).toBe('combat');
    expect(session.context.rammedThisTurn).toEqual(['a']);

    sessionApply(session, { kind: 'endPhase' }, scripted([])); // combat -> next movement: cleared
    expect(state.phase).toBe('movement');
    expect(session.context.rammedThisTurn).toEqual([]);
  });

  it('clears the attackers on endPhase', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const d = unit('d', 'phalanges', 11, 5, 1);
    const session = newSession(gameWith([a, d]));
    session.context.attackedThisPhase.push('a');
    sessionApply(session, { kind: 'endPhase' }, scripted([]));
    expect(session.context.attackedThisPhase).toEqual([]);
  });

  it('keeps the rammed ships when the game ends on endPhase', () => {
    const a = unit('a', 'fantassins', 10, 5);
    const session = newSession(gameWith([a])); // one side only: the game ends
    session.context.rammedThisTurn.push('x');
    sessionApply(session, { kind: 'endPhase' }, scripted([]));
    expect(session.state.gameOver).toBe(true);
    expect(session.context.rammedThisTurn).toEqual(['x']);
  });
});

// ---------------------------------------------------------------------------
// B7, B8: the drift against the driver it replaces
// ---------------------------------------------------------------------------

describe('the drift runs inside the session (B7, B8)', () => {
  /** A rng that counts its draws. */
  function counting(seed: number): { rng: () => number; draws: () => number } {
    const inner = createSeededRng(seed);
    let n = 0;
    return { rng: () => (n++, inner()), draws: () => n };
  }

  /**
   * The BoardScene-path reference: `applyAction`, then `resolveElephantDrift` and
   * `engine/retreat.ts` with the same agent, as `processDrifts` and
   * `processRetreats` drove them before §72. It is kept here so the parity
   * check survives the harness moving onto the session.
   */
  async function reference(state: GameState, attack: Action, agent: RandomAgent, rng: () => number): Promise<void> {
    const result = applyAction(state, attack, rng);
    if (result.kind !== 'landAttack') throw new Error('not an attack');
    const { outcome } = result;
    const side = result.detail.result === 'DR' ? 'defender' : 'attacker';
    const resolvedIds = new Set<string>();
    const advance = async (hex: HexCoord) => {
      if (unitAt(state, hex)) return;
      const alive = eligibleAdvanceCandidates(result.attackers, hex);
      if (alive.length === 0) return;
      const chosen = await agent.chooseAdvance(state, alive, hex);
      if (chosen) chosen.position = hex;
    };
    if (outcome.requiresExchangeChoice) {
      const sacrificed = await agent.chooseExchangeSacrifice(state, result.attackers, outcome.requiredSacrificeForce);
      for (const u of sacrificed) u.destroyed = true;
      for (const hex of result.defenderOriginalHexes) await advance(hex);
      return;
    }
    const items = [
      ...outcome.pendingRetreats.map((u) => ({ unit: u, hex: { ...u.position }, drift: false })),
      ...outcome.pendingDrifts.map((u) => ({ unit: u, hex: { ...u.position }, drift: true })),
    ];
    for (const item of items) {
      if (!item.unit.destroyed && !resolvedIds.has(item.unit.id)) {
        if (item.drift) {
          await resolveElephantDrift(
            state,
            item.unit,
            unitType(item.unit).movement,
            agent,
            () => rollDie(rng),
            { onDriftStart: (e) => void resolvedIds.add(e.id) },
            undefined,
            undefined,
            resolvedIds,
          );
        } else {
          await resolveUnitRetreat(state, item.unit, agent, {}, undefined, resolvedIds);
        }
      }
      if (side === 'defender') await advance(item.hex);
    }
    if (items.length === 0 && (result.detail.result === 'DE' || result.detail.result === 'EX')) {
      for (const hex of result.defenderOriginalHexes) await advance(hex);
    }
  }

  // Kills a die rolled out of order, an extra `driftStep` before the first
  // request is answered, and resuming the drift before a trampled unit's
  // retreat is resolved: any of them changes the final state or the draws.
  it('ends in the same state, with the same draws, as resolveElephantDrift and retreat.ts', async () => {
    let drifts = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const attack: Action = { kind: 'landAttack', attackerIds: ['attacker'], defenderIds: ['defender'] };

      const viaSession = buildElephantScenarioGameState();
      const a = counting(seed);
      const session = newSession(viaSession);
      const step = await settleWithAgent(session, attack, new RandomAgent(a.rng), a.rng);
      drifts += step.events.filter((e) => e.kind === 'driftStarted').length;

      const viaDriver = buildElephantScenarioGameState();
      const b = counting(seed);
      await reference(viaDriver, attack, new RandomAgent(b.rng), b.rng);

      expect(viaSession, `seed ${seed}`).toEqual(viaDriver);
      expect(a.draws(), `seed ${seed}`).toBe(b.draws());
      expect(session.pending).toBeNull();
    }
    expect(drifts).toBeGreaterThan(0); // the comparison really passed through drifts
  });

  it('leaves the session settled, with the context as it was right after the attack (B8)', async () => {
    const state = buildElephantScenarioGameState();
    state.phase = 'combat';
    const session = newSession(state);
    const rng = createSeededRng(3);
    await settleWithAgent(session, { kind: 'landAttack', attackerIds: ['attacker'], defenderIds: ['defender'] }, new RandomAgent(rng), rng);
    expect(session.pending).toBeNull();
    expect(session.context).toEqual({ attackedThisPhase: ['attacker'], rammedThisTurn: [] });
  });
});

// A last guard on the spy helper used by the checks above: nothing here may
// reach Math.random (every roll is injected).
describe('determinism', () => {
  it('never calls Math.random', async () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      const state = buildElephantScenarioGameState();
      const session = newSession(state);
      const rng = createSeededRng(5);
      await settleWithAgent(session, { kind: 'landAttack', attackerIds: ['attacker'], defenderIds: ['defender'] }, new RandomAgent(rng), rng);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

