import { MAP_TERRAIN, hexKey as mapHexKey, type HexCoord } from '../data/map';
import { directionForDie, hexAdd } from './hex';
import {
  applyLandCombatResult,
  canElephantEnterHex,
  describeLandAttack,
  unitAt,
  type LandAttackDetail,
  type LandCombatOutcome,
} from './combat';
import { type GameState, type Unit, unitType } from './state';

/**
 * WHY a drift step was fatal — off the map, into the sea, or into the marsh —
 * for the player-facing combat log line, which the presentation words in the
 * player's language (`ui/i18n/format.ts`'s `formatDriftEvent`).
 *
 * Split out as its own function (rather than one fixed string) with Stage 2c,
 * plan.md §6.7. `canElephantEnterHex` used to reject only off-map, coastal
 * and sea-like hexes, so a single "drifts off the map or into the sea"
 * message covered every way the elimination branch below could fire. Widening
 * that predicate to reject MARSH as well — terrain the rulebook forbids
 * elephants unconditionally ("chars, cavaleries et éléphants ne peuvent
 * accéder aux marais", `docs/research/05-rules-french-original.md:186-188`) —
 * made the fixed string narrate something that had not happened, which is the
 * kind of quietly-wrong UI text no test would ever fail on. The event kind was
 * renamed from `eliminatedOffMapOrSea` to `eliminatedLeavingLandZone` in the
 * same pass, for the same reason: it now covers a third case its old name
 * excluded, and the rulebook's own wording for the elimination is leaving
 * "la zone terrestre" (`:288-289`), not specifically the sea.
 */
export type DriftExitKind = 'offMap' | 'marsh' | 'sea';

export function driftExitKind(hex: HexCoord): DriftExitKind {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return 'offMap';
  if (terrain === 'marsh') return 'marsh';
  return 'sea';
}

interface DriftFrame {
  kind: 'drift';
  elephantId: string;
  remainingSteps: number;
  direction?: HexCoord;
  forbiddenDirection?: HexCoord;
  announceStart: boolean;
}

interface ContinueFrame {
  kind: 'continueAfterVacated';
  elephantId: string;
  direction: HexCoord;
  hex: HexCoord;
  remainingSteps: number;
}

type DriftFrameState = DriftFrame | ContinueFrame;

type DriftAwaiting =
  | {
      kind: 'directionRoll';
      elephantId: string;
      remainingSteps: number;
      forbiddenDirection?: HexCoord;
      announceStart: boolean;
    }
  | {
      kind: 'combatRoll';
      elephantId: string;
      occupantId: string;
      hex: HexCoord;
      direction: HexCoord;
      remainingSteps: number;
    }
  | {
      kind: 'retreatResolution';
      unitId: string;
    };

export interface ElephantDriftState {
  frames: DriftFrameState[];
  awaiting?: DriftAwaiting;
}

export type DriftInput =
  | { kind: 'directionRoll'; dieRoll: number }
  | { kind: 'combatRoll'; dieRoll: number }
  | { kind: 'retreatResolved' };

export type DriftEvent =
  | { kind: 'driftStarted'; elephant: Unit; remainingSteps: number }
  | { kind: 'directionRollNeeded'; elephant: Unit; remainingSteps: number; forbiddenDirection?: HexCoord }
  | { kind: 'directionForbidden'; elephant: Unit; dieRoll: number; direction: HexCoord }
  | { kind: 'directionRolled'; elephant: Unit; dieRoll: number; direction: HexCoord; remainingSteps: number }
  | { kind: 'directionResumed'; elephant: Unit; direction: HexCoord }
  | { kind: 'moved'; elephant: Unit; hex: HexCoord }
  | { kind: 'enteredVacatedHex'; elephant: Unit; hex: HexCoord }
  | { kind: 'stopped'; elephant: Unit }
  | { kind: 'eliminatedLeavingLandZone'; elephant: Unit; hex: HexCoord }
  | { kind: 'combatRollNeeded'; elephant: Unit; occupant: Unit; hex: HexCoord }
  | {
      kind: 'combatResolved';
      detail: LandAttackDetail;
      outcome: LandCombatOutcome;
      elephant: Unit;
      occupant: Unit;
      hex: HexCoord;
    }
  | { kind: 'driftElephantDestroyed'; elephant: Unit }
  | { kind: 'repelled'; elephant: Unit }
  | { kind: 'retreatResolutionNeeded'; unit: Unit };

export interface DriftStepResult {
  state: ElephantDriftState;
  events: DriftEvent[];
  done: boolean;
}

/** Events that only ask for an input (or refuse a direction): they show nothing, so nothing waits on them (§57). */
export const SILENT_PAUSE_KINDS: ReadonlySet<DriftEvent['kind']> = new Set<DriftEvent['kind']>([
  'directionRollNeeded',
  'combatRollNeeded',
  'retreatResolutionNeeded',
  'directionForbidden',
]);

export function startElephantDrift(
  elephant: Unit,
  remainingSteps: number,
  forbiddenDirection?: HexCoord,
): ElephantDriftState {
  return {
    frames: [{ kind: 'drift', elephantId: elephant.id, remainingSteps, forbiddenDirection, announceStart: true }],
  };
}

function requireDriftUnit(state: GameState, id: string): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`driftStep: unit "${id}" no longer exists`);
  return unit;
}

function directionsEqual(a: HexCoord | undefined, b: HexCoord): boolean {
  return !!a && a.q === b.q && a.r === b.r;
}

export function needsInput(events: readonly DriftEvent[]): DriftEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (
      event.kind === 'directionRollNeeded' ||
      event.kind === 'combatRollNeeded' ||
      event.kind === 'retreatResolutionNeeded'
    ) {
      return event;
    }
  }
  return undefined;
}

function cloneDriftState(state: ElephantDriftState): ElephantDriftState {
  return { frames: [...state.frames], awaiting: state.awaiting };
}

/**
 * Advances the elephant-drift state machine until it either completes or
 * needs one external input: a direction die, a combat die, or a resolved
 * retreat/push cascade for a trampled non-elephant unit.
 */
export function driftStep(game: GameState, drift: ElephantDriftState, input?: DriftInput): DriftStepResult {
  const next = cloneDriftState(drift);
  const events: DriftEvent[] = [];

  if (input) {
    if (!next.awaiting) throw new Error(`driftStep received ${input.kind} but no input was pending`);

    const awaiting = next.awaiting;
    next.awaiting = undefined;

    if (awaiting.kind === 'directionRoll') {
      if (input.kind !== 'directionRoll') {
        throw new Error(`driftStep expected directionRoll input, received ${input.kind}`);
      }
      const elephant = requireDriftUnit(game, awaiting.elephantId);
      const direction = directionForDie(input.dieRoll);
      if (directionsEqual(awaiting.forbiddenDirection, direction)) {
        next.awaiting = awaiting;
        events.push({ kind: 'directionForbidden', elephant, dieRoll: input.dieRoll, direction });
        events.push({
          kind: 'directionRollNeeded',
          elephant,
          remainingSteps: awaiting.remainingSteps,
          forbiddenDirection: awaiting.forbiddenDirection,
        });
        return { state: next, events, done: false };
      }
      events.push({
        kind: 'directionRolled',
        elephant,
        dieRoll: input.dieRoll,
        direction,
        remainingSteps: awaiting.remainingSteps,
      });
      next.frames.push({
        kind: 'drift',
        elephantId: awaiting.elephantId,
        remainingSteps: awaiting.remainingSteps,
        direction,
        announceStart: false,
      });
    } else if (awaiting.kind === 'combatRoll') {
      if (input.kind !== 'combatRoll') {
        throw new Error(`driftStep expected combatRoll input, received ${input.kind}`);
      }
      const elephant = requireDriftUnit(game, awaiting.elephantId);
      const occupant = requireDriftUnit(game, awaiting.occupantId);
      const detail = describeLandAttack([elephant], [occupant], input.dieRoll);
      const outcome = applyLandCombatResult(game, [elephant], [occupant], detail.result);
      events.push({
        kind: 'combatResolved',
        detail,
        outcome,
        elephant,
        occupant,
        hex: awaiting.hex,
      });

      switch (detail.result) {
        case 'AE':
        case 'EX':
          events.push({ kind: 'driftElephantDestroyed', elephant });
          // Review-3 round-2 finding: this used to `break` out of the switch
          // and fall through into the `while (!next.awaiting)` loop below
          // WITHIN THE SAME CALL. When this elephant is itself a nested
          // trampled unit doing its own re-drift beneath an outer
          // `continueAfterVacated` frame, that fallthrough would pop and
          // process the OUTER frame too — mutating the outer elephant's
          // position and pushing its `enteredVacatedHex`/`directionResumed`
          // events — all before this call ever returned. So the outer
          // elephant would already be sitting at its new hex by the time its
          // own narration/pause fired, one full call ahead of itself. Same
          // bug class, same fix, as the DE/continueAfterVacated cases:
          // return immediately so nothing past this destruction is
          // resolved until the NEXT `driftStep` call.
          return { state: next, events, done: false };
        case 'AR':
          events.push({ kind: 'repelled', elephant });
          next.frames.push({
            kind: 'drift',
            elephantId: awaiting.elephantId,
            remainingSteps: awaiting.remainingSteps,
            announceStart: false,
          });
          break;
        case 'DE':
          elephant.position = awaiting.hex;
          next.frames.push({
            kind: 'drift',
            elephantId: awaiting.elephantId,
            remainingSteps: awaiting.remainingSteps - 1,
            direction: awaiting.direction,
            announceStart: false,
          });
          events.push({ kind: 'enteredVacatedHex', elephant, hex: awaiting.hex });
          // Review-3 finding: this used to `break` out of the switch and
          // fall through into the `while (!next.awaiting)` loop below
          // WITHIN THE SAME CALL — which, since the continuation frame just
          // pushed above already has `direction` populated, would skip
          // straight past the direction-roll pause point and immediately
          // advance a further hex before this call ever returned. Same bug
          // class, same fix, as the CRITICAL free-run loop: return here so
          // the elephant is only ever reported as far as the hex it just
          // entered until the NEXT `driftStep` call.
          return { state: next, events, done: false };
        case 'DR': {
          const remainingAfterEnter = awaiting.remainingSteps - 1;
          const trampledElephant = outcome.pendingDrifts.find((u) => u.id === occupant.id);
          const trampledOther = outcome.pendingRetreats.find((u) => u.id === occupant.id);
          next.frames.push({
            kind: 'continueAfterVacated',
            elephantId: awaiting.elephantId,
            direction: awaiting.direction,
            hex: awaiting.hex,
            remainingSteps: remainingAfterEnter,
          });
          if (trampledElephant) {
            next.frames.push({
              kind: 'drift',
              elephantId: occupant.id,
              remainingSteps: unitType(occupant).movement,
              forbiddenDirection: { q: -awaiting.direction.q, r: -awaiting.direction.r },
              announceStart: true,
            });
          } else if (trampledOther) {
            next.awaiting = { kind: 'retreatResolution', unitId: occupant.id };
            events.push({ kind: 'retreatResolutionNeeded', unit: occupant });
            return { state: next, events, done: false };
          }
          // Review-3 round-3 self-audit: neither `trampledElephant` nor
          // `trampledOther` is possible when the trampled occupant had no
          // legal retreat hex AND no push candidate — `applyLandCombatResult`
          // (combat.ts's `forceRetreat`) destroys such a unit directly and it
          // appears in neither `pendingDrifts` nor `pendingRetreats` (see
          // combat.ts:957 and combat.test.ts's "(4,9) on the shipped map"
          // terrain-boxed tests for a real, reachable example). This `break`
          // falls through into the shared `while` loop below and immediately
          // pops the `continueAfterVacated` frame just pushed above, in the
          // SAME call — but that is NOT an instance of the bug fixed
          // elsewhere in this file: `continueAfterVacated`'s own branch
          // returns immediately after its mutation (see its comment below),
          // so this call ends up producing exactly
          // `[combatResolved(DR), enteredVacatedHex, directionResumed]` and
          // stopping there — the same shape, for the same single elephant,
          // as the `DE` case above (`[combatResolved(DE), enteredVacatedHex]`
          // then an explicit return). There is no OTHER unit's narration
          // interleaved (unlike the AE/EX/eliminatedLeavingLandZone nested-
          // nested-elephant bugs fixed this round) and no second, further
          // hex is silently entered. Verified directly: a
          // `cavalerie-legere` trampled at (4,9) — the shipped map's
          // documented terrain-boxed hex — produces exactly that one-call
          // event trace, with the elephant's position update paired 1:1 with
          // its own already-resolved combat, not hidden behind a DIFFERENT
          // unit's pause.
          break;
        }
      }
    } else {
      if (input.kind !== 'retreatResolved') {
        throw new Error(`driftStep expected retreatResolved input, received ${input.kind}`);
      }
    }
  }

  while (!next.awaiting) {
    const frame = next.frames.pop();
    if (!frame) return { state: next, events, done: true };

    if (frame.kind === 'continueAfterVacated') {
      const elephant = requireDriftUnit(game, frame.elephantId);
      if (elephant.destroyed) continue;

      elephant.position = frame.hex;
      events.push({ kind: 'enteredVacatedHex', elephant, hex: frame.hex });
      // Review-2 LOW note 1: this is the resumption point for an elephant
      // whose drift was paused mid-hex by trampling a defender (DR) — and,
      // when that defender was ITSELF an elephant, the intervening frame is
      // that trampled elephant's own full nested `startElephantDrift` run,
      // which may have fired its own `onDirectionRolled` calls (possibly
      // several, on an AR repel) for a different unit and direction. Without
      // re-affirming this elephant's direction here, a presentation layer's
      // arrow would still be pointing wherever the nested elephant's drift
      // last left it, even though play has returned to resuming THIS
      // elephant in ITS original direction. `directionResumed` carries no
      // die roll (nothing was rolled — this is a resumption, not a new
      // direction) but still reports the (elephant, direction) pair so
      // `onDirectionRolled` can re-derive the arrow.
      events.push({ kind: 'directionResumed', elephant, direction: frame.direction });
      next.frames.push({
        kind: 'drift',
        elephantId: frame.elephantId,
        remainingSteps: frame.remainingSteps,
        direction: frame.direction,
        announceStart: false,
      });
      // Review-3 finding: this used to `continue` the outer `while
      // (!next.awaiting)` loop, which would immediately pop the
      // continuation frame just pushed above (already carrying a resolved
      // `direction`) and advance it a further hex WITHIN THE SAME CALL —
      // same bug class as the CRITICAL free-run loop and the `DE` combat
      // result above. Return here so the elephant is only ever reported as
      // far as the vacated hex it just entered until the NEXT `driftStep`
      // call.
      return { state: next, events, done: false };
    }

    const elephant = requireDriftUnit(game, frame.elephantId);
    if (elephant.destroyed) continue;

    if (frame.remainingSteps <= 0) {
      events.push({ kind: 'stopped', elephant });
      // Review-3 round-3 self-audit finding: this used to `continue` the
      // outer `while (!next.awaiting)` loop, which — same bug class as the
      // AE/EX and eliminatedLeavingLandZone fixes above — would immediately
      // pop and process the NEXT frame on the stack within the SAME call.
      // When this elephant is a nested trampled unit whose own re-drift
      // finishes NORMALLY (exhausts its movement and stops, rather than
      // being destroyed) beneath an outer `continueAfterVacated` frame,
      // that next frame is the outer frame, and processing it here would
      // move the outer elephant into its vacated hex (and push its own
      // events) before this call ever returned — one full call ahead of
      // its own narration. Verified directly (via the exact scenario the
      // "resolves a nested trampled elephant" test below uses) that,
      // before this fix, one call produced
      // `[stopped(nested), enteredVacatedHex(original), directionResumed(original)]`
      // with `original.position` already at the vacated hex. Return
      // immediately instead, matching every other mutation-adjacent branch
      // in this function.
      return { state: next, events, done: false };
    }

    if (frame.announceStart) {
      events.push({ kind: 'driftStarted', elephant, remainingSteps: frame.remainingSteps });
    }

    if (!frame.direction) {
      next.awaiting = {
        kind: 'directionRoll',
        elephantId: frame.elephantId,
        remainingSteps: frame.remainingSteps,
        forbiddenDirection: frame.forbiddenDirection,
        announceStart: false,
      };
      events.push({
        kind: 'directionRollNeeded',
        elephant,
        remainingSteps: frame.remainingSteps,
        forbiddenDirection: frame.forbiddenDirection,
      });
      return { state: next, events, done: false };
    }

    // Plan.md §21 (review-2 CRITICAL fix): advance exactly ONE hex per
    // `driftStep` call here, not the whole uncontested free run. This used
    // to be a `while (!elephant.destroyed && remaining > 0)` loop that
    // mutated `elephant.position` and pushed a `moved` event for every empty
    // hex in the run before ever returning — so a multi-hex uncontested
    // drift was already sitting at its FINAL hex by the time the very first
    // pause/hook fired for it, making per-step pausing and the direction
    // arrow lie about where the elephant actually was. Now every single hex
    // step (whether reached fresh off a direction roll or resumed here after
    // a prior single-hex step) pushes its own one-step continuation frame
    // (`remainingSteps - 1`, same `direction`, `announceStart: false`) and
    // returns immediately — the same frame-stack-resumption pattern already
    // used for `continueAfterVacated` and post-combat continuation above.
    // `frame.remainingSteps > 0` and `!elephant.destroyed` are already
    // guaranteed true here by the checks earlier in this loop body, so
    // there's no need for a loop condition at all: this always runs once.
    const nextHex = hexAdd(elephant.position, frame.direction);

    if (!canElephantEnterHex(nextHex)) {
      elephant.destroyed = true;
      events.push({ kind: 'eliminatedLeavingLandZone', elephant, hex: nextHex });
      // Review-3 round-2 finding: this used to `continue` the outer `while
      // (!next.awaiting)` loop, which — same as the AE/EX case above — would
      // immediately pop and process the NEXT frame on the stack within the
      // SAME call. When this elephant is a nested trampled unit whose own
      // re-drift walks it off the map/into the sea/marsh beneath an outer
      // `continueAfterVacated` frame, that next frame is the outer frame,
      // and processing it here would move the outer elephant into its
      // vacated hex (and push its own events) before this call ever
      // returned — one full call ahead of its own narration. Return
      // immediately instead, matching every other mutation site in this
      // function.
      return { state: next, events, done: false };
    }

    const occupant = unitAt(game, nextHex);
    if (!occupant) {
      elephant.position = nextHex;
      events.push({ kind: 'moved', elephant, hex: nextHex });
      next.frames.push({
        kind: 'drift',
        elephantId: frame.elephantId,
        remainingSteps: frame.remainingSteps - 1,
        direction: frame.direction,
        announceStart: false,
      });
      return { state: next, events, done: false };
    }

    next.awaiting = {
      kind: 'combatRoll',
      elephantId: frame.elephantId,
      occupantId: occupant.id,
      hex: nextHex,
      direction: frame.direction,
      remainingSteps: frame.remainingSteps,
    };
    events.push({ kind: 'combatRollNeeded', elephant, occupant, hex: nextHex });
    return { state: next, events, done: false };
  }

  return { state: next, events, done: false };
}
