import type { HexCoord } from '../data/map';
import type { Action } from './actions';
import type { GameState, Unit } from './state';

/**
 * The interface both a human (via `BoardScene`'s prompts) and a future bot
 * (Stage 2+) satisfy for the *mid-resolution* decisions the engine asks
 * about once a combat's outcome forces a choice — "the agent answers every
 * decision the engine asks for." Sketched in plan.md §6.3 as part of a
 * larger four-method interface that also included `chooseAction`; this is
 * that sketch adjusted where the actual decision surface turned out to need
 * more, different, or (see below) less than the sketch anticipated:
 *
 * - `chooseAdvance` takes the full set of eligible units and returns which
 *   one advances (or `null` to decline), rather than asking about one unit
 *   at a time with a yes/no. `BoardScene`'s existing prompt already offers
 *   every eligible attacker plus a decline button in a single panel (only
 *   one unit can occupy the vacated hex, so it's fundamentally a
 *   pick-one-of-N choice, not N independent booleans) — matching that
 *   shape here means the prompt itself needed no redesign, only rehoming.
 * - `choosePushTarget` is a genuinely extra decision point the plan's sketch
 *   didn't list: "a unit forced to retreat with at least one adjacent
 *   friendly able to make room pushes one of them aside" (see
 *   `pushCandidates` in engine/combat.ts — plan.md §12 widened this from an
 *   earlier, stricter "boxed in on all six sides" reading) is its own player
 *   choice, distinct from — but resolved the same way as — an ordinary
 *   retreat-hex choice. It's followed by EITHER an ordinary `chooseRetreat`
 *   call for the *pushed* unit's own destination (if it has one directly),
 *   OR — per plan.md §12.3's cascade — another `choosePushTarget` call for
 *   THAT unit if it doesn't, recursing until some unit in the chain finds a
 *   real hex. The interface still doesn't need a third, push-specific
 *   "where does the pushed unit go" method: the cascade is just repeated
 *   calls to these same two methods.
 * - `chooseAction` — "the next top-level action to take" — is DELIBERATELY
 *   NOT part of this interface, unlike the plan's original sketch. See
 *   `ActionObserver` below for why, and for what `BoardScene` actually
 *   implements instead.
 *
 * Nothing here answers "declare a ram?" or "declare a boarding attempt?" —
 * those aren't pending decisions the engine asks about mid-resolution, they
 * ARE `Action`s (`{kind: 'ram'}` / `{kind: 'board', ...}`) a top-level action
 * chooser picks (or doesn't) like any other move (see `engine/actions.ts`'s
 * doc comment on `Action`) — not this interface's concern.
 *
 * Nor does anything here answer an elephant's drift *direction* - that's an
 * unavoidable die roll (see directionForDie in engine/hex.ts), not a
 * choice, so it stays inside engine/drift.ts's drift orchestration rather
 * than becoming a player decision.
 */
export interface PlayerAgent {
  /** Where `unit` retreats to, from `options` (see `legalRetreatHexes`).
   * Also used, unmodified, for a *pushed* unit's own retreat destination
   * once `choosePushTarget` has picked who gets pushed — but ONLY if that
   * pushed unit has a direct legal retreat; if it doesn't, `choosePushTarget`
   * is called again for IT instead (see this interface's doc comment on the
   * cascade). */
  chooseRetreat(state: GameState, unit: Unit, options: HexCoord[]): Promise<HexCoord>;

  /** `unit` cannot retreat and at least one neighboring hex holds a friendly
   * unit that can make room (see `pushCandidates`) — which of `candidates`
   * gets pushed aside. Every candidate is guaranteed to have somewhere to
   * go, but NOT necessarily directly: per plan.md §12's cascading push, a
   * candidate may itself have no direct retreat and have to push one of ITS
   * OWN friendly neighbors in turn — resolved by calling right back into
   * this same choice (and, if needed, `chooseRetreat`) for the pushed unit,
   * recursively, until someone finds a direct retreat hex. */
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

/**
 * DESIGN NOTE — top-level action selection is NOT unified between hotseat
 * and AI yet; this is the interface `BoardScene` actually implements for it,
 * and it is intentionally NOT "the next action to take" in the pull sense
 * plan.md §6.3 sketched (`chooseAction(state, legal): Promise<Action>`,
 * called by a driver as `const a = await agent.chooseAction(...);
 * applyAction(state, a)`).
 *
 * `BoardScene` is fundamentally push-driven: a click commits an `Action` via
 * `applyAction` directly (see e.g. `onHexClick`'s move branch,
 * `resolveGroupAttack`), and a combat attacker/defender GROUP in particular
 * is assembled through a sequence of individual add/remove clicks — there is
 * no single moment "the next action" exists as a value BEFORE the player
 * presses "Resolve attack." A method that type-checked as `chooseAction`
 * (i.e. resolves with an action the CALLER must still `applyAction` itself)
 * would therefore be a lie: `BoardScene` always applies the action itself,
 * synchronously, at the moment it's chosen, so a caller following the
 * documented `PlayerAgent.chooseAction` contract literally (await the
 * choice, then apply it) would double-apply every single action.
 *
 * `ActionObserver` is the honest alternative: `observeCommittedAction`
 * resolves AFTER the action has already been applied, purely to let a
 * caller watch what a human did as it happens — a spectator/replay
 * interface, not a decision interface. Nothing in Stage 1 calls it (hotseat
 * play needs no driver loop), but it's real, wired via `reportAction` at
 * every commit site in `BoardScene`, not a stub. Unifying *choosing* a
 * top-level action between human and AI play remains open — deferred to
 * Stage 4 alongside per-seat Human/AI configuration, once there's an actual
 * AI driver loop to design the contract against.
 */
export interface ActionObserver {
  /** Resolves with the next `Action` this agent commits, AFTER it has
   * already been applied to `state` — never before. `legal` is whatever
   * `legalActions(state, ...)` reported immediately before the action was
   * chosen, handed over for context. */
  observeCommittedAction(state: GameState, legal: Action[]): Promise<Action>;
}

/**
 * The pull-shaped counterpart to `ActionObserver`: "hand me the legal
 * actions, I'll tell you which one to apply." This IS the `chooseAction`
 * shape cut from `PlayerAgent` above — kept as its own interface, and
 * pointedly NOT merged back into `PlayerAgent`, because the reason it was
 * cut has not changed: `BoardScene` cannot honestly implement it (a click
 * handler has already applied the action by the time anything could return
 * it, so a caller following the contract would double-apply). What HAS
 * changed since Stage 1 is that there are now callers that can: a headless
 * driver like `engine/fuzzHarness.ts` owns its whole loop and calls
 * `chooseNextAction` then `applyAction` itself, in that order, with no
 * click handler racing it.
 *
 * So the two interfaces split cleanly by who is driving:
 * - `PlayerAgent` — mid-resolution decisions. Everyone implements this,
 *   `BoardScene` and bots alike; it is the shared half.
 * - `ActionChooser` — top-level action selection, bots only.
 * - `ActionObserver` — top-level action *reporting*, `BoardScene` only.
 *
 * Unifying the last two behind one interface both a human seat and a bot
 * seat satisfy is still open and still deferred to Stage 4 (plan.md §6.4),
 * where per-seat Human/AI configuration finally forces the question. Naming
 * the bot side explicitly here is what lets Stage 3 exist without
 * pre-judging that: `RandomAgent` already had this method structurally, and
 * `HeuristicAgent` needs the same one, so the alternative was two classes
 * agreeing on an unwritten convention.
 *
 * Synchronous, unlike `PlayerAgent`'s methods: a bot's action choice is pure
 * computation over `state` and `legal`, with nothing to await. The
 * mid-resolution methods are async because a HUMAN implementation of them
 * has to wait on a click; nothing analogous applies to an interface only
 * bots implement.
 */
export interface ActionChooser {
  chooseNextAction(state: GameState, legal: Action[]): Action;
}

/** An agent a headless driver can play a whole game with: it both picks
 * top-level actions and answers the mid-resolution questions those actions
 * provoke. `RandomAgent` and `HeuristicAgent` both satisfy it. */
export type DrivingAgent = PlayerAgent & ActionChooser;
