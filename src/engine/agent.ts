import type { HexCoord } from '../data/map';
import type { Action } from './actions';
import type { GameState, Unit } from './state';

/**
 * The one interface both a human (via `BoardScene`'s prompts) and a future
 * bot (Stage 2+) satisfy — "the agent answers every decision the engine asks
 * for." Sketched in plan.md §6.3 as four methods; this is that sketch
 * adjusted where the actual decision surface turned out to need more or
 * different shapes than the sketch anticipated:
 *
 * - `chooseAdvance` takes the full set of eligible units and returns which
 *   one advances (or `null` to decline), rather than asking about one unit
 *   at a time with a yes/no. `BoardScene`'s existing prompt already offers
 *   every eligible attacker plus a decline button in a single panel (only
 *   one unit can occupy the vacated hex, so it's fundamentally a
 *   pick-one-of-N choice, not N independent booleans) — matching that
 *   shape here means the prompt itself needed no redesign, only rehoming.
 * - `choosePushTarget` is a genuinely extra decision point the plan's sketch
 *   didn't list: "a unit forced to retreat but boxed in entirely by
 *   friendlies pushes one of them aside" (see `pushCandidates` in
 *   engine/combat.ts) is its own player choice, distinct from — but
 *   resolved the same way as — an ordinary retreat-hex choice. It's
 *   followed by an ordinary `chooseRetreat` call for the *pushed* unit's own
 *   destination, so the interface doesn't need a third, push-specific
 *   "where does the pushed unit go" method.
 *
 * Nothing here answers "declare a ram?" or "declare a boarding attempt?" —
 * those aren't pending decisions the engine asks about mid-resolution, they
 * ARE `Action`s (`{kind: 'ram'}` / `{kind: 'board', ...}`) an agent picks (or
 * doesn't) via `chooseAction` like any other move, so no separate method is
 * needed for them (see `engine/actions.ts`'s doc comment on `Action`).
 *
 * Nor does anything here answer an elephant's drift *direction* — that's an
 * unavoidable die roll (see `directionForDie` in engine/hex.ts), not a
 * choice, so it stays entirely inside the drift orchestration (currently
 * still `BoardScene`'s, per plan.md §6.3's scope: the drift/retreat/advance
 * prompt machinery is a follow-on decomposition candidate, extracted here
 * only as far as this interface actually requires).
 */
export interface PlayerAgent {
  /** The next action to take from the current game state. `legal` is
   * whatever `legalActions(state, ...)` returned, handed over so an agent
   * doesn't need to recompute it. */
  chooseAction(state: GameState, legal: Action[]): Promise<Action>;

  /** Where `unit` retreats to, from `options` (see `legalRetreatHexes`).
   * Also used, unmodified, for a *pushed* unit's own retreat destination
   * once `choosePushTarget` has picked who gets pushed — see this
   * interface's doc comment. */
  chooseRetreat(state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord>;

  /** `unit` is retreating but every neighboring hex holds a friendly unit
   * (see `pushCandidates`) — which of `candidates` gets pushed aside to make
   * room. Every candidate is guaranteed to have somewhere legal of its own
   * to retreat to (that's what makes it a candidate at all). */
  choosePushTarget(state: GameState, unit: Unit, candidates: Unit[]): Promise<Unit>;

  /** Whether — and which — of `candidates` (every still-living unit from the
   * attack that just vacated `vacated`) advances into the vacated hex.
   * `null` declines the offer entirely. */
  chooseAdvance(state: GameState, candidates: Unit[], vacated: HexCoord): Promise<Unit | null>;

  /** On an 'EX' (exchange) result with more than one attacker, which of
   * `attackers` the attacking player sacrifices — must total at least
   * `requiredForce` attack value (see `exchangeSacrificeMeetsThreshold`). */
  chooseExchangeSacrifice(state: GameState, attackers: Unit[], requiredForce: number): Promise<Unit[]>;
}
