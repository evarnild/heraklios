import type { HexCoord } from '../data/map';
import type { PlayerAgent } from './agent';
import { completePush, legalRetreatHexes, pushCandidates, retreatUnitTo, type LandAttackDetail, type LandCombatOutcome } from './combat';
import {
  driftStep,
  needsInput,
  SILENT_PAUSE_KINDS,
  startElephantDrift,
  type DriftEvent,
  type DriftInput,
} from './drift';
import type { GameState, Unit } from './state';

/**
 * The reference pump for an elephant drift and a retreat cascade (§73): the
 * `async` drivers `BoardScene` used before it settled combats through the
 * engine session. Nothing in production calls them any more. They are kept, with
 * their tests, as the oracle the session is compared against
 * (`drift.test.ts`'s rule and hook cases, `gameSession.test.ts`'s parity check,
 * `fuzzHarness.test.ts`'s `resolveUnitRetreat` cases), so no case is lost.
 * Porting those tests onto the session and deleting this file is a follow-up.
 */

export interface RetreatHooks {
  onRetreat?(unit: Unit, hex: HexCoord, isPushedLink: boolean): void;
  onPush?(unit: Unit, pushed: Unit, vacatedHex: HexCoord): void;
  onEliminated?(unit: Unit): void;
}

/**
 * Resolves the whole retreat-or-push cascade for `unit` using the same
 * PlayerAgent decisions as the scene. This is the sequencing glue around
 * `legalRetreatHexes` / `pushCandidates` / `completePush`: if a unit has no
 * direct retreat, it can push a friendly that may itself need to retreat or
 * push first. `visited` prevents cycles in that push chain.
 */
export async function resolveUnitRetreat(
  state: GameState,
  unit: Unit,
  agent: PlayerAgent,
  hooks: RetreatHooks = {},
  visited: ReadonlySet<string> = new Set(),
  resolvedIds?: Set<string>,
): Promise<void> {
  resolvedIds?.add(unit.id);
  const legalHexes = legalRetreatHexes(state, unit);
  if (legalHexes.length > 0) {
    const hex = await agent.chooseRetreat(state, unit, legalHexes);
    retreatUnitTo(unit, hex);
    hooks.onRetreat?.(unit, hex, visited.size > 0);
    return;
  }

  const pushTargets = pushCandidates(state, unit, visited);
  if (pushTargets.length > 0) {
    const pushed = await agent.choosePushTarget(state, unit, pushTargets);
    const vacatedHex = { ...pushed.position };
    const chainVisited = new Set(visited);
    chainVisited.add(unit.id);
    await resolveUnitRetreat(state, pushed, agent, hooks, chainVisited, resolvedIds);
    completePush(unit, vacatedHex);
    hooks.onPush?.(unit, pushed, vacatedHex);
    return;
  }

  unit.destroyed = true;
  hooks.onEliminated?.(unit);
}

export interface DriftHooks extends RetreatHooks {
  onDriftStart?(elephant: Unit): void;
  /** Fired at each beat worth a line in the combat log - `driftStarted`,
   * `directionRolled`, `moved`, `stopped`, `eliminatedLeavingLandZone`,
   * `driftElephantDestroyed` and `repelled` - with the event itself; the
   * presentation words it (the engine produces no display text). */
  onNarrate?(event: DriftEvent): void;
  onRender?(): void;
  onCombat?(detail: LandAttackDetail, outcome: LandCombatOutcome, elephant: Unit, occupant: Unit, hex: HexCoord): void;
  /** Fired once a direction die has resolved into an actual `direction`
   * (plan.md §21), so a presentation layer can draw a direction arrow. */
  onDirectionRolled?(elephant: Unit, direction: HexCoord): void;
  /** Fired whenever the drifting elephant's `position` actually changes -
   * `moved` and `enteredVacatedHex` both qualify. */
  onDriftMoved?(elephant: Unit, hex: HexCoord): void;
  /**
   * Optional per-step pause point (plan.md §21). Awaited, if present, once
   * after every event that shows something (§57: not after the input requests
   * `directionRollNeeded`/`combatRollNeeded`/`retreatResolutionNeeded` or a
   * refused `directionForbidden`) - never inside `driftStep` itself, which
   * stays a pure, uninterrupted state machine. The `if (hooks.onStep)` guard
   * (rather than an unconditional `await hooks.onStep?.()`) skips the
   * microtask tick an `await` of `undefined` would cost, so a caller that
   * supplies no hook sees identical timing to before the hook existed.
   * Since §73 the Board shows these pauses through the session's own pause
   * (`pauseAfterDriftStep`, `ui/driftBeats.ts`) instead.
   */
  onStep?(): void | Promise<void>;
}

export interface DriftStats {
  driftsResolved: number;
  driftCombatsResolved: number;
}

/**
 * Convenience driver for current callers. It pumps the exported
 * `driftStep` state machine, supplying dice and PlayerAgent retreat/push
 * answers, but keeps the resumable state/events available for tests and
 * future callers.
 */
export async function resolveElephantDrift(
  state: GameState,
  elephant: Unit,
  remainingSteps: number,
  agent: PlayerAgent,
  rollDie: () => number,
  hooks: DriftHooks = {},
  forbiddenDirection?: HexCoord,
  stats?: DriftStats,
  resolvedIds?: Set<string>,
): Promise<void> {
  let drift = startElephantDrift(elephant, remainingSteps, forbiddenDirection);
  let input: DriftInput | undefined;

  while (true) {
    const result = driftStep(state, drift, input);
    drift = result.state;
    input = undefined;

    for (const event of result.events) {
      switch (event.kind) {
        case 'driftStarted':
          if (stats) stats.driftsResolved += 1;
          hooks.onDriftStart?.(event.elephant);
          hooks.onNarrate?.(event);
          break;
        case 'directionRolled':
          hooks.onNarrate?.(event);
          hooks.onDirectionRolled?.(event.elephant, event.direction);
          break;
        case 'directionResumed':
          // No die was rolled - this elephant's frame is just resuming its
          // already-known direction after a nested trampled elephant's own
          // drift finished. No `onNarrate` either: only the arrow needs to catch up.
          hooks.onDirectionRolled?.(event.elephant, event.direction);
          break;
        case 'moved':
          hooks.onNarrate?.(event);
          hooks.onDriftMoved?.(event.elephant, event.hex);
          hooks.onRender?.();
          break;
        case 'enteredVacatedHex':
          hooks.onDriftMoved?.(event.elephant, event.hex);
          hooks.onRender?.();
          break;
        case 'stopped':
          hooks.onNarrate?.(event);
          break;
        case 'eliminatedLeavingLandZone':
          hooks.onNarrate?.(event);
          hooks.onRender?.();
          break;
        case 'combatResolved':
          if (stats) stats.driftCombatsResolved += 1;
          hooks.onCombat?.(event.detail, event.outcome, event.elephant, event.occupant, event.hex);
          break;
        case 'driftElephantDestroyed':
          hooks.onNarrate?.(event);
          // Rendered too: a paused presentation would otherwise show a marker
          // for a unit that combat has already flagged `destroyed`.
          hooks.onRender?.();
          break;
        case 'repelled':
          hooks.onNarrate?.(event);
          break;
      }

      // See `DriftHooks.onStep`: only paces a presentation layer that opts in,
      // never `driftStep` itself. §57: events that only ask this driver for
      // input (or refuse a rolled direction) show nothing, so pausing on them
      // gave a "continue" that did nothing.
      if (hooks.onStep && !SILENT_PAUSE_KINDS.has(event.kind)) {
        await hooks.onStep();
      }
    }

    if (result.done) return;

    const request = needsInput(result.events);
    if (!request) {
      // `driftStep` can legitimately pause with `done: false` and no
      // direction/combat/retreat request at all - a single-hex "moved" (or an
      // elimination) step returning on its own, needing nothing from this
      // driver but to be resumed. The `onStep` await above already gave a
      // presentation layer its pacing pause for every event in `result.events`.
      input = undefined;
      continue;
    }

    switch (request.kind) {
      case 'directionRollNeeded':
        input = { kind: 'directionRoll', dieRoll: rollDie() };
        break;
      case 'combatRollNeeded':
        input = { kind: 'combatRoll', dieRoll: rollDie() };
        break;
      case 'retreatResolutionNeeded':
        await resolveUnitRetreat(state, request.unit, agent, hooks, undefined, resolvedIds);
        input = { kind: 'retreatResolved' };
        break;
    }
  }
}
