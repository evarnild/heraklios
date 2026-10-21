// Formatters for the structured results the engine returns instead of display
// text (spec B9): each one writes the sentence from the current language's
// table. The optional `m` is for tests, which format in a chosen language.
import type { ArmyError } from '../../engine/army';
import { driftExitKind, type DriftEvent } from '../../engine/drift';
import type { SavedGame, SaveError } from '../../engine/saveGame';
import { messages, type Messages } from './index';

export function formatArmyError(error: ArmyError, m: Messages = messages()): string {
  switch (error.kind) {
    case 'overMax':
      return m.builder.overMax(unitNameIn(m, error.typeId), error.count, error.max);
    case 'overBudget':
      return m.builder.overBudget(error.total, error.budget);
    case 'underBudget':
      return m.builder.underBudget(error.total, error.budget);
  }
}

/** The log line for a drift event worth narrating, or null for the rest. */
export function formatDriftEvent(event: DriftEvent, m: Messages = messages()): string | null {
  switch (event.kind) {
    case 'driftStarted':
      return m.drift.started(unitNameIn(m, event.elephant.typeId));
    case 'directionRolled':
      return m.drift.directionRolled(event.dieRoll, event.remainingSteps);
    case 'moved':
      return m.drift.moved(unitNameIn(m, event.elephant.typeId), event.hex.q, event.hex.r);
    case 'stopped':
      return m.drift.stopped(unitNameIn(m, event.elephant.typeId));
    case 'eliminatedLeavingLandZone': {
      const unit = unitNameIn(m, event.elephant.typeId);
      const exit = driftExitKind(event.hex);
      return exit === 'offMap' ? m.drift.exitOffMap(unit) : exit === 'marsh' ? m.drift.exitMarsh(unit) : m.drift.exitSea(unit);
    }
    case 'driftElephantDestroyed':
      return m.drift.destroyed(unitNameIn(m, event.elephant.typeId));
    case 'repelled':
      return m.drift.repelled(unitNameIn(m, event.elephant.typeId));
    default:
      return null;
  }
}

/** One-line summary for a save slot, e.g. "Turn 3 — Athens (movement)". The
 * name is the one the game was saved with, whatever the current language. */
export function describeSlot(save: SavedGame, m: Messages = messages()): string {
  const state = save.gameState;
  const activeId = state.seatOrder[state.activePlayerIndex];
  const active = state.players.find((p) => p.id === activeId);
  return m.saves.summary(state.turnNumber, active?.name ?? m.saves.summaryUnknown, m.phases[state.phase]);
}

export function formatSaveError(error: SaveError | { kind: 'unreadable' }, m: Messages = messages()): string {
  switch (error.kind) {
    case 'unreadable':
      return m.saves.unreadable;
    case 'invalidJson':
      return m.saves.invalidJson;
    case 'notASave':
      return m.saves.notASave;
    case 'unsupportedVersion':
      return m.saves.unsupportedVersion(error.version, error.expected);
  }
}

/** "Off" / "30 min" / "1 h" / "2 h" — the Menu button's label for the clock limit. */
export function clockLimitText(ms: number | null, m: Messages = messages()): string {
  if (ms === null) return m.menu.off;
  const minutes = ms / 60_000;
  return minutes < 60 ? m.menu.minutes(minutes) : m.menu.hours(minutes / 60);
}

/** "Off" / "6 rounds" / … — the Menu button's label for the round limit. */
export function roundLimitText(rounds: number | null, m: Messages = messages()): string {
  return rounds === null ? m.menu.off : m.menu.roundCount(rounds);
}

function unitNameIn(m: Messages, typeId: string): string {
  return (m.units as Record<string, string>)[typeId] ?? typeId;
}
