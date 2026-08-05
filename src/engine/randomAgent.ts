import type { HexCoord } from '../data/map';
import { exchangeSacrificeMeetsThreshold } from './combat';
import type { Action } from './actions';
import type { PlayerAgent } from './agent';
import type { GameState, Unit } from './state';

/**
 * The trivial agent Stage 2 needs: picks uniformly at random among whatever
 * the caller hands it, for both the top-level action choice and every
 * mid-resolution `PlayerAgent` decision. Deliberately has no strategy
 * whatsoever — a `HeuristicAgent` weighted toward good moves is Stage 3
 * (plan.md §6.4), out of scope here. The entire point of *this* agent is to
 * explore the game tree unpredictably enough that a self-play harness built
 * on it exercises corners a hand-written happy-path test wouldn't.
 *
 * All randomness is drawn from one injected `rng: () => number` (see
 * `engine/rng.ts`'s `createSeededRng`), never `Math.random()` directly, so a
 * whole game — including every `chooseNextAction` pick and every mid-combat
 * decision below — is reproducible from a single seed shared with
 * `applyAction`'s own die rolls (see `engine/fuzzHarness.ts`).
 */
export class RandomAgent implements PlayerAgent {
  constructor(private readonly rng: () => number = Math.random) {}

  private pick<T>(options: readonly T[]): T {
    if (options.length === 0) {
      throw new Error('RandomAgent: asked to pick from an empty option list');
    }
    // Math.min guards the (astronomically unlikely, but not impossible if
    // rng() ever returned exactly 1) case of index landing one past the end.
    const index = Math.min(options.length - 1, Math.floor(this.rng() * options.length));
    return options[index]!;
  }

  /**
   * Top-level action selection — deliberately NOT part of `PlayerAgent` (see
   * that interface's doc comment on why `chooseAction` was cut from the
   * plan's original sketch: a method resolving with an `Action` the CALLER
   * must still `applyAction` is the exact shape `BoardScene` can't honestly
   * implement). This IS that shape, but it's fine here because nothing about
   * `RandomAgent` is a push-driven UI — a harness calling
   * `agent.chooseNextAction(state, legal)` then `applyAction(state, action)`
   * itself, synchronously and in that order, has no double-apply hazard: it
   * owns the whole loop, not a click handler that already committed the
   * action before this method was ever called.
   */
  chooseNextAction(_state: GameState, legal: Action[]): Action {
    return this.pick(legal);
  }

  async chooseRetreat(_state: GameState, _unit: Unit, options: HexCoord[]): Promise<HexCoord> {
    return this.pick(options);
  }

  async choosePushTarget(_state: GameState, _unit: Unit, candidates: Unit[]): Promise<Unit> {
    return this.pick(candidates);
  }

  /** `null` (decline) is offered as an option alongside every candidate,
   * with equal weight — "uniformly at random from the legal options"
   * includes declining, which is always legal. */
  async chooseAdvance(_state: GameState, candidates: Unit[], _vacated: HexCoord): Promise<Unit | null> {
    const options: Array<Unit | null> = [...candidates, null];
    return this.pick(options);
  }

  /**
   * Randomly shuffles `attackers` (Fisher-Yates over this agent's own `rng`,
   * matching `turnManager.ts`'s `shuffleSeatOrder` convention) then takes a
   * random-order PREFIX just long enough to meet `requiredForce` — this is
   * "pick randomly from the legal options" applied to a threshold choice
   * rather than a flat list: any subset meeting the threshold is legal, and
   * shuffling first means both which units and how many are picked vary
   * seed to seed, not just a fixed "smallest first" or "largest first"
   * greedy order.
   *
   * Always terminates with a valid answer: per `combatTable.ts`'s CRT, 'EX'
   * only appears in columns where attack force is at least 4x defense force
   * (columns 4-1 and up), and `requiredForce` here is exactly the
   * defenders' total defense force — so the attackers' full combined attack
   * (the sum if this loop consumes the whole shuffled array) is always
   * enough, and the loop below can never fall through unsatisfied.
   */
  async chooseExchangeSacrifice(_state: GameState, attackers: Unit[], requiredForce: number): Promise<Unit[]> {
    const shuffled = [...attackers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const selected: Unit[] = [];
    for (const unit of shuffled) {
      selected.push(unit);
      if (exchangeSacrificeMeetsThreshold(selected, requiredForce)) return selected;
    }
    // Unreachable per the doc comment above, but fail loudly rather than
    // silently returning an invalid (under-threshold) sacrifice if a future
    // CRT change ever breaks that invariant.
    throw new Error(
      `RandomAgent.chooseExchangeSacrifice: no combination of ${attackers.length} attacker(s) reaches the required force ${requiredForce} — CRT invariant violated`,
    );
  }
}
