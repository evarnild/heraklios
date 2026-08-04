import type { HexCoord } from '../data/map';
import type { BoardingResult } from '../data/navalBoarding';
import { isRammingHitWithBonus, type ShipTypeId } from '../data/navalRamming';
import { rollDie } from './dice';
import { hexKey } from './hex';
import {
  reachableHexes,
  reachableNavalHexes,
  findRammingContacts,
  evaluateCharge,
} from './movement';
import {
  describeLandAttack,
  applyLandCombatResult,
  applyRammingResult,
  applyBoardingResult,
  resolveNavalBoarding,
  validTargets,
  type LandAttackDetail,
  type LandCombatOutcome,
} from './combat';
import { advancePhase, resetMovementForActivePlayer } from './turnManager';
import { unitType, currentAttack, currentDefense, type GameState, type Unit } from './state';

/**
 * A headless description of one legal thing the active player could do,
 * covering everything `BoardScene` previously decided and mutated for inline
 * in click handlers. `applyAction` is the only thing that mutates a
 * `GameState` on behalf of one of these — see its doc comment for what each
 * variant does.
 *
 * Naval movement's facing/rotation is folded into `navalMove`/`navalRotate`
 * rather than a single "ends at this (hex, facing) state" action: this
 * mirrors the granularity of the two separate UI gestures `BoardScene`
 * already offers (click a highlighted hex to move; click a turn button to
 * rotate 60° in place) rather than `reachableNavalStates`' full state graph,
 * so undo/redo keeps recording exactly one entry per player gesture, exactly
 * as it does today.
 *
 * A ram is deliberately its OWN atomic action, only legal once a ship is
 * *already* bow-on to an enemy at zero further cost (see `legalActions`) —
 * moving into a non-immediate contact is just an ordinary `navalMove` to
 * that hex (which, per `findRammingContacts`, always lands facing the
 * target), after which a further `ram` action is legal at cost 0. This
 * mirrors `BoardScene`'s original two-step "move into contact, then a
 * separate yes/no prompt to actually declare the ram" — the prompt's "no"
 * branch is simply not choosing to play the `ram` action next.
 */
export type Action =
  | { kind: 'endPhase' }
  | { kind: 'landMove'; unitId: string; to: HexCoord }
  | { kind: 'navalMove'; unitId: string; to: HexCoord }
  | { kind: 'navalRotate'; unitId: string; direction: 1 | -1 }
  | { kind: 'ram'; unitId: string }
  | { kind: 'landAttack'; attackerIds: string[]; defenderIds: string[] }
  | { kind: 'board'; attackerId: string; defenderId: string };

export interface LandMoveResult {
  kind: 'landMove';
  unit: Unit;
  charged: boolean;
}

export interface NavalMoveResult {
  kind: 'navalMove';
  unit: Unit;
}

export interface NavalRotateResult {
  kind: 'navalRotate';
  unit: Unit;
}

export interface RamResult {
  kind: 'ram';
  attacker: Unit;
  defender: Unit;
  dieRoll: number;
  hit: boolean;
  bonus: 0 | 1 | 2;
}

export interface LandAttackResult {
  kind: 'landAttack';
  detail: LandAttackDetail;
  /** Same shape `combat.ts`'s `applyLandCombatResult` already returns — this
   * IS the "pending decision" surface: `requiresExchangeChoice`,
   * `pendingDrifts` and `pendingRetreats` tell the caller which of its own
   * further prompts (exchange sacrifice, retreat/push, drift) still need
   * resolving before the combat is fully settled, exactly as `BoardScene`
   * already branches on this same object today.
   *
   * NOTE for a headless caller (Stage 2's fuzz harness): `pendingRetreats`
   * has an engine-side resolution path (`legalRetreatHexes`/`pushCandidates`
   * plus `retreatUnitTo`/`completePush`), but `pendingDrifts` does not yet —
   * an elephant's drift/trample cascade is still resolved entirely inside
   * `BoardScene` (`resolveDriftHit`, calling `describeLandAttack`/
   * `applyLandCombatResult` directly, not through `applyAction`), which is
   * out of this stage's scope. A `pendingDrifts` entry here is a dead end
   * for a purely `applyAction`-driven caller today — elephants can't be
   * fuzzed until that cascade gets its own extraction pass. */
  outcome: LandCombatOutcome;
  /** The units that actually fought (post-mutation references), for the
   * caller's advance-into-vacated-hex offer. */
  attackers: Unit[];
  /** Defenders' hexes as they stood before resolution — captured here since
   * a destroyed defender's `.position` is left untouched by
   * `applyLandCombatResult`, so the caller doesn't have to re-derive it. */
  defenderOriginalHexes: HexCoord[];
}

export interface BoardResult {
  kind: 'board';
  attacker: Unit;
  defender: Unit;
  dieRoll: number;
  result: BoardingResult;
}

export interface EndPhaseResult {
  kind: 'endPhase';
}

export type ActionResult =
  | LandMoveResult
  | NavalMoveResult
  | NavalRotateResult
  | RamResult
  | LandAttackResult
  | BoardResult
  | EndPhaseResult;

function requireLivingUnit(state: GameState, id: string): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`applyAction: no unit with id "${id}"`);
  if (unit.destroyed) throw new Error(`applyAction: unit "${id}" is already destroyed`);
  return unit;
}

function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q!, r: r! };
}

/**
 * Applies one `Action` to `state` in place, exactly reproducing the mutation
 * sequences `BoardScene` used to perform inline (see `BoardScene.ts`'s
 * `onHexClick`, `rotateSelectedShip`, `handleNavalMoveClick`, `promptRam`'s
 * "Ram!" handler, and `resolveGroupAttack`, pre-refactor). Every die roll
 * goes through `rng` (default `Math.random`, matching `shuffleSeatOrder`'s
 * injection convention in `turnManager.ts`) rather than reaching for
 * `Math.random()` directly, so a seeded harness can replay a game exactly.
 *
 * Does not itself enforce "already attacked/rammed this phase" — that
 * bookkeeping lives outside `GameState` (see `legalActions`'s doc comment)
 * and is the caller's responsibility, exactly as it was `BoardScene`'s
 * before this refactor (its click handlers gated group membership; the
 * mutation itself never re-checked it). Throws if `action` isn't legal
 * against `state` at all (unknown/destroyed unit, unreachable hex, etc.) —
 * callers are expected to only ever pass something out of `legalActions`,
 * or something a UI has already validated the same way `BoardScene` did.
 *
 * Overloaded on `action.kind` purely for caller ergonomics: `BoardScene`
 * calls this with a literal `{kind: '...'}` at nearly every call site, and
 * without these overloads every one of them would need a manual
 * `if (result.kind !== '...') throw` narrowing check before touching a
 * kind-specific field. The last (general `Action`) overload covers a caller
 * — like `legalActions`' own tests — holding a non-literal `Action` value.
 */
export function applyAction(state: GameState, action: { kind: 'endPhase' }, rng?: () => number): EndPhaseResult;
export function applyAction(
  state: GameState,
  action: { kind: 'landMove'; unitId: string; to: HexCoord },
  rng?: () => number,
): LandMoveResult;
export function applyAction(
  state: GameState,
  action: { kind: 'navalMove'; unitId: string; to: HexCoord },
  rng?: () => number,
): NavalMoveResult;
export function applyAction(
  state: GameState,
  action: { kind: 'navalRotate'; unitId: string; direction: 1 | -1 },
  rng?: () => number,
): NavalRotateResult;
export function applyAction(state: GameState, action: { kind: 'ram'; unitId: string }, rng?: () => number): RamResult;
export function applyAction(
  state: GameState,
  action: { kind: 'landAttack'; attackerIds: string[]; defenderIds: string[] },
  rng?: () => number,
): LandAttackResult;
export function applyAction(
  state: GameState,
  action: { kind: 'board'; attackerId: string; defenderId: string },
  rng?: () => number,
): BoardResult;
export function applyAction(state: GameState, action: Action, rng?: () => number): ActionResult;
export function applyAction(
  state: GameState,
  action: Action,
  rng: () => number = Math.random,
): ActionResult {
  switch (action.kind) {
    case 'endPhase': {
      advancePhase(state);
      // Refill the new active player's movement/charge state, same as a
      // human's Movement phase beginning (see turnManager.ts's doc comment
      // on why this is a separate call rather than folded into
      // advancePhase itself). `state.gameOver` skips straight past this —
      // there's no "new active player" to refill for.
      if (!state.gameOver && state.phase === 'movement') {
        resetMovementForActivePlayer(state);
      }
      return { kind: 'endPhase' };
    }

    case 'landMove': {
      const unit = requireLivingUnit(state, action.unitId);
      if (unitType(unit).domain === 'naval') {
        throw new Error(`applyAction: unit "${unit.id}" is naval — use 'navalMove', not 'landMove'`);
      }
      const reachable = reachableHexes(state, unit);
      const key = hexKey(action.to);
      const reachableCost = reachable.get(key);
      if (reachableCost === undefined) {
        throw new Error(`applyAction: (${action.to.q},${action.to.r}) isn't reachable by unit "${unit.id}"`);
      }
      // Must be evaluated BEFORE mutating position/movementLeft — charge
      // eligibility depends on the unit's pre-move state, and a charge's
      // straight-line cost can differ from `reachable`'s cheapest-path cost
      // to the same hex (see `evaluateCharge`'s doc comment in
      // engine/movement.ts). Deduct the charge cost whenever this move
      // qualifies, not the (possibly cheaper) `reachable` cost.
      const chargeCost = evaluateCharge(state, unit, action.to);
      const cost = chargeCost ?? reachableCost;
      unit.movementLeft -= cost;
      unit.position = action.to;
      unit.charged = chargeCost !== null;
      return { kind: 'landMove', unit, charged: unit.charged };
    }

    case 'navalMove': {
      const unit = requireLivingUnit(state, action.unitId);
      const key = hexKey(action.to);
      // A contact hex always takes priority over a plain move to the same
      // hex — it's the more specific (facing-exact) option, so ending the
      // move there always uses the contact's bow-on facing rather than
      // whatever `reachableNavalHexes` would otherwise pick.
      const contact = findRammingContacts(state, unit)
        .filter((c) => hexKey(c.hex) === key)
        .sort((a, b) => a.cost - b.cost)[0];
      if (contact) {
        unit.movementLeft -= contact.cost;
        unit.position = contact.hex;
        unit.facing = contact.facing;
        return { kind: 'navalMove', unit };
      }
      const dest = reachableNavalHexes(state, unit).get(key);
      if (!dest) {
        throw new Error(`applyAction: (${action.to.q},${action.to.r}) isn't reachable by unit "${unit.id}"`);
      }
      unit.movementLeft -= dest.cost;
      unit.position = action.to;
      unit.facing = dest.facing;
      return { kind: 'navalMove', unit };
    }

    case 'navalRotate': {
      const unit = requireLivingUnit(state, action.unitId);
      if (unit.movementLeft < 1) {
        throw new Error(`applyAction: unit "${unit.id}" has no movement left to rotate`);
      }
      unit.facing = (unit.facing + action.direction + 6) % 6;
      unit.movementLeft -= 1;
      return { kind: 'navalRotate', unit };
    }

    case 'ram': {
      const unit = requireLivingUnit(state, action.unitId);
      const contact = findRammingContacts(state, unit).find((c) => c.cost === 0);
      if (!contact) {
        throw new Error(`applyAction: unit "${unit.id}" has no immediate ramming contact`);
      }
      const dieRoll = rollDie(rng);
      const hit = isRammingHitWithBonus(
        unit.typeId as ShipTypeId,
        contact.target.typeId as ShipTypeId,
        contact.bonus,
        dieRoll,
      );
      applyRammingResult(contact.target, hit);
      unit.movementLeft = 0;
      return { kind: 'ram', attacker: unit, defender: contact.target, dieRoll, hit, bonus: contact.bonus };
    }

    case 'landAttack': {
      if (action.attackerIds.length === 0 || action.defenderIds.length === 0) {
        throw new Error('applyAction: landAttack needs at least one attacker and one defender');
      }
      const attackers = action.attackerIds.map((id) => requireLivingUnit(state, id));
      const defenders = action.defenderIds.map((id) => requireLivingUnit(state, id));
      const defenderOriginalHexes = defenders.map((d) => ({ ...d.position }));
      const dieRoll = rollDie(rng);
      const detail = describeLandAttack(attackers, defenders, dieRoll);
      const outcome = applyLandCombatResult(state, attackers, defenders, detail.result);
      return { kind: 'landAttack', detail, outcome, attackers, defenderOriginalHexes };
    }

    case 'board': {
      const attacker = requireLivingUnit(state, action.attackerId);
      const defender = requireLivingUnit(state, action.defenderId);
      const dieRoll = rollDie(rng);
      const result = resolveNavalBoarding(currentAttack(attacker), currentDefense(defender), dieRoll);
      applyBoardingResult(attacker, defender, result);
      return { kind: 'board', attacker, defender, dieRoll, result };
    }
  }
}

/**
 * Per-phase bookkeeping `legalActions` needs but that deliberately lives
 * outside `GameState` (see `SavedGame.attackedThisPhase`/`rammedThisTurn` in
 * engine/saveGame.ts and `BoardScene`'s matching fields) — "a unit may only
 * attack/ram once per phase" isn't otherwise derivable from `GameState`
 * alone. Both default to "nothing has acted yet" when omitted, which is
 * correct for a freshly-entered phase and is also all a Stage 2+ headless
 * harness gets for free unless it tracks the same sets itself alongside the
 * `GameState` it drives.
 */
export interface ActionContext {
  attackedThisPhase?: ReadonlySet<string>;
  rammedThisTurn?: ReadonlySet<string>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Every legal `Action` for the active player in the current phase, built
 * entirely on the engine's existing pure query functions rather than
 * reimplementing any rule.
 *
 * DESIGN NOTE — combat-phase enumeration is one attacker vs. one defender
 * only, even in 'multi-defender' mode where `applyAction`'s `landAttack`
 * happily accepts larger groups on both sides. Enumerating every legal
 * *combination* of attackers and defenders is combinatorial (and `BoardScene`
 * itself only ever builds a group through a sequence of individual add/remove
 * clicks, never as one atomic choice), and Stage 2's uniform-random fuzz
 * harness — the only committed consumer of this function so far — doesn't
 * need anything richer than "some legal attack exists" to explore the game
 * tree and check invariants. A future scored/heuristic agent that wants to
 * combine attacks can still do so by calling `applyAction` directly with a
 * larger `attackerIds`/`defenderIds` it assembles itself, exactly as
 * `BoardScene` does; only the *enumeration* stays singleton-only here.
 *
 * `context` is REQUIRED, not defaulted: an omitted default of "nothing has
 * acted yet" would silently re-offer `landAttack`/`board` for a unit that
 * already attacked this phase, or naval actions for a ship that already
 * rammed — wrong answers, not degraded ones, and exactly the kind of trap a
 * caller wouldn't notice until a fuzz run found a unit attacking twice.
 * Callers with no such bookkeeping (e.g. a test that doesn't care) pass `{}`
 * deliberately, so the omission is visible at the call site instead of
 * silently defaulted away.
 */
export function legalActions(state: GameState, context: ActionContext): Action[] {
  const actions: Action[] = [{ kind: 'endPhase' }];
  const activeOwner = state.seatOrder[state.activePlayerIndex]!;
  const attackedThisPhase = context.attackedThisPhase ?? EMPTY_SET;
  const rammedThisTurn = context.rammedThisTurn ?? EMPTY_SET;
  const ownUnits = state.units.filter((u) => !u.destroyed && u.owner === activeOwner);

  if (state.phase === 'movement') {
    for (const unit of ownUnits) {
      if (unitType(unit).domain === 'naval') {
        if (rammedThisTurn.has(unit.id)) continue; // committed the rest of its movement to a ram already
        for (const key of reachableNavalHexes(state, unit).keys()) {
          actions.push({ kind: 'navalMove', unitId: unit.id, to: parseHexKey(key) });
        }
        if (unit.movementLeft >= 1) {
          actions.push({ kind: 'navalRotate', unitId: unit.id, direction: 1 });
          actions.push({ kind: 'navalRotate', unitId: unit.id, direction: -1 });
        }
        if (findRammingContacts(state, unit).some((c) => c.cost === 0)) {
          actions.push({ kind: 'ram', unitId: unit.id });
        }
      } else {
        for (const key of reachableHexes(state, unit).keys()) {
          actions.push({ kind: 'landMove', unitId: unit.id, to: parseHexKey(key) });
        }
      }
    }
  } else {
    for (const unit of ownUnits) {
      if (attackedThisPhase.has(unit.id)) continue;
      if (unitType(unit).domain === 'naval') {
        if (rammedThisTurn.has(unit.id)) continue; // rammed this turn, can't also board
        for (const target of validTargets(state, unit)) {
          actions.push({ kind: 'board', attackerId: unit.id, defenderId: target.id });
        }
      } else {
        for (const target of validTargets(state, unit)) {
          actions.push({ kind: 'landAttack', attackerIds: [unit.id], defenderIds: [target.id] });
        }
      }
    }
  }

  return actions;
}
