import { MAP_TERRAIN, hexKey as mapHexKey, type HexCoord } from '../data/map';
import { directionForDie, hexAdd } from './hex';
import type { PlayerAgent } from './agent';
import {
  applyLandCombatResult,
  canElephantEnterHex,
  describeLandAttack,
  unitAt,
  type LandAttackDetail,
  type LandCombatOutcome,
} from './combat';
import { resolveUnitRetreat, type RetreatHooks } from './retreat';
import { type GameState, type Unit, unitType } from './state';

/**
 * The phrase naming WHY a drift step was fatal, for the player-facing combat
 * log line — "off the map", "into the sea", or "into the marsh".
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
function describeDriftExit(hex: HexCoord): string {
  const terrain = MAP_TERRAIN.get(mapHexKey(hex.q, hex.r));
  if (terrain === undefined) return 'off the map';
  if (terrain === 'marsh') return 'into the marsh';
  return 'into the sea';
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

export interface DriftHooks extends RetreatHooks {
  onDriftStart?(elephant: Unit): void;
  onLine?(line: string): void;
  onRender?(): void;
  onCombat?(detail: LandAttackDetail, outcome: LandCombatOutcome, elephant: Unit, occupant: Unit, hex: HexCoord): void;
}

export interface DriftStats {
  driftsResolved: number;
  driftCombatsResolved: number;
}

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

function needsInput(events: readonly DriftEvent[]): DriftEvent | undefined {
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
          break;
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
          break;
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
      if (!elephant.destroyed) {
        elephant.position = frame.hex;
        events.push({ kind: 'enteredVacatedHex', elephant, hex: frame.hex });
        next.frames.push({
          kind: 'drift',
          elephantId: frame.elephantId,
          remainingSteps: frame.remainingSteps,
          direction: frame.direction,
          announceStart: false,
        });
      }
      continue;
    }

    const elephant = requireDriftUnit(game, frame.elephantId);
    if (elephant.destroyed) continue;

    if (frame.remainingSteps <= 0) {
      events.push({ kind: 'stopped', elephant });
      continue;
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

    let remaining = frame.remainingSteps;
    while (!elephant.destroyed && remaining > 0) {
      const nextHex = hexAdd(elephant.position, frame.direction);

      if (!canElephantEnterHex(nextHex)) {
        elephant.destroyed = true;
        events.push({ kind: 'eliminatedLeavingLandZone', elephant, hex: nextHex });
        break;
      }

      const occupant = unitAt(game, nextHex);
      if (!occupant) {
        elephant.position = nextHex;
        remaining -= 1;
        events.push({ kind: 'moved', elephant, hex: nextHex });
        continue;
      }

      next.awaiting = {
        kind: 'combatRoll',
        elephantId: frame.elephantId,
        occupantId: occupant.id,
        hex: nextHex,
        direction: frame.direction,
        remainingSteps: remaining,
      };
      events.push({ kind: 'combatRollNeeded', elephant, occupant, hex: nextHex });
      return { state: next, events, done: false };
    }
  }

  return { state: next, events, done: false };
}

function defaultLine(unit: Unit): string {
  return `${unitType(unit).name} is forced to retreat - instead it drifts!`;
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
          stats && (stats.driftsResolved += 1);
          hooks.onDriftStart?.(event.elephant);
          hooks.onLine?.(defaultLine(event.elephant));
          break;
        case 'directionRolled':
          hooks.onLine?.(`Direction die: ${event.dieRoll} - ${event.remainingSteps} hex(es) of movement to go.`);
          break;
        case 'moved':
          hooks.onLine?.(`${unitType(event.elephant).name} moves to (${event.hex.q}, ${event.hex.r}).`);
          hooks.onRender?.();
          break;
        case 'enteredVacatedHex':
          hooks.onRender?.();
          break;
        case 'stopped':
          hooks.onLine?.(`${unitType(event.elephant).name} has used up its movement and stops drifting.`);
          break;
        case 'eliminatedLeavingLandZone':
          hooks.onLine?.(`${unitType(event.elephant).name} drifts ${describeDriftExit(event.hex)} and is eliminated!`);
          hooks.onRender?.();
          break;
        case 'combatResolved':
          stats && (stats.driftCombatsResolved += 1);
          hooks.onCombat?.(event.detail, event.outcome, event.elephant, event.occupant, event.hex);
          break;
        case 'driftElephantDestroyed':
          hooks.onLine?.(`${unitType(event.elephant).name} is destroyed.`);
          break;
        case 'repelled':
          hooks.onLine?.(`${unitType(event.elephant).name} is repelled and must drift again!`);
          break;
      }
    }

    if (result.done) return;

    const request = needsInput(result.events);
    if (!request) throw new Error('driftStep paused without requesting input');

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
