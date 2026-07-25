import type { ArmySelection } from './army';
import type { CombatMode, GameState, Phase, PlayerId } from './state';

/**
 * Save-file format version. Bump whenever the shape changes incompatibly;
 * `isValidSavedGame` rejects anything it doesn't recognise, so an old file
 * fails with a clear message instead of loading into a half-broken game.
 */
export const SAVE_VERSION = 1;

/**
 * `GameState.randomizedTurnOrder` (added for the re-randomised-turn-order
 * house rule) deliberately did NOT bump `SAVE_VERSION`: it's read only via
 * `if (state.randomizedTurnOrder)` in `advancePhase`, so a save file from
 * before this field existed simply deserializes with it `undefined`, which is
 * falsy and reproduces exactly the fixed-order behaviour that file was saved
 * with. No migration and no stricter validation is needed for a field whose
 * absence is indistinguishable, in behaviour, from its default.
 */

export type EdgeCode = 'N' | 'S' | 'E' | 'W';

/**
 * A complete, JSON-serializable game.
 *
 * Beyond `GameState` this carries the session-level setup (who's playing,
 * which edge each player drew, the chosen combat variant) plus the two
 * per-phase bookkeeping sets that live in the board scene rather than in
 * state — without those, loading mid-combat-phase would forget that a unit
 * had already attacked or already rammed, exactly as undo would have.
 *
 * Deliberately excludes anything transient: a pending retreat/drift holds
 * `onComplete` closures that cannot be serialized, so saving is refused while
 * one is in progress (see BoardScene's save handler).
 */
export interface SavedGame {
  version: number;
  /** ISO timestamp, for display in the slot list. */
  savedAt: string;
  playerCount: number;
  playerNames: string[];
  edges: EdgeCode[];
  armySelections: ArmySelection[];
  combatMode: CombatMode;
  testMode: boolean;
  gameState: GameState;
  attackedThisPhase: string[];
  rammedThisTurn: string[];
}

/** One-line summary for a save slot, e.g. "Turn 3 — Athènes (movement)". */
export function describeSave(save: SavedGame): string {
  const state = save.gameState;
  const activeId = state.seatOrder[state.activePlayerIndex];
  const active = state.players.find((p) => p.id === activeId);
  const who = active?.name ?? 'unknown';
  return `Turn ${state.turnNumber} — ${who} (${state.phase})`;
}

/** Localised-ish short timestamp for the slot list; falls back to the raw
 * string if the stored value isn't a parseable date. */
export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return savedAt;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isPhase(value: unknown): value is Phase {
  return value === 'movement' || value === 'combat';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Structural validation of parsed JSON, so a corrupt or hand-edited file (or
 * an unrelated .json the player picked by mistake) is rejected up front
 * rather than blowing up somewhere deep in rendering. Checks the shape and
 * the fields the game actually reads — not every leaf value.
 */
export function isValidSavedGame(data: unknown): data is SavedGame {
  if (typeof data !== 'object' || data === null) return false;
  const save = data as Partial<SavedGame>;

  if (save.version !== SAVE_VERSION) return false;
  if (typeof save.savedAt !== 'string') return false;
  if (typeof save.playerCount !== 'number') return false;
  if (!isStringArray(save.playerNames)) return false;
  if (!isStringArray(save.edges)) return false;
  if (!Array.isArray(save.armySelections)) return false;
  if (save.combatMode !== 'single-defender' && save.combatMode !== 'multi-defender') return false;
  if (typeof save.testMode !== 'boolean') return false;
  if (!isStringArray(save.attackedThisPhase)) return false;
  if (!isStringArray(save.rammedThisTurn)) return false;

  const state = save.gameState;
  if (typeof state !== 'object' || state === null) return false;
  if (!Array.isArray(state.players) || state.players.length === 0) return false;
  if (!Array.isArray(state.units)) return false;
  if (!Array.isArray(state.seatOrder) || state.seatOrder.length === 0) return false;
  if (typeof state.turnNumber !== 'number') return false;
  if (typeof state.activePlayerIndex !== 'number') return false;
  if (state.activePlayerIndex < 0 || state.activePlayerIndex >= state.seatOrder.length) return false;
  if (!isPhase(state.phase)) return false;
  if (typeof state.gameOver !== 'boolean') return false;

  for (const unit of state.units) {
    if (typeof unit !== 'object' || unit === null) return false;
    if (typeof unit.id !== 'string' || typeof unit.typeId !== 'string') return false;
    if (typeof unit.owner !== 'number') return false;
    if (typeof unit.position !== 'object' || unit.position === null) return false;
    if (typeof unit.position.q !== 'number' || typeof unit.position.r !== 'number') return false;
    if (typeof unit.movementLeft !== 'number' || typeof unit.facing !== 'number') return false;
    if (typeof unit.destroyed !== 'boolean') return false;
  }

  return true;
}

/**
 * Parses and validates raw JSON text. Returns the game or an error message
 * suitable for showing the player, rather than throwing.
 */
export function parseSavedGame(text: string): { save: SavedGame } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  if (typeof data === 'object' && data !== null) {
    const version = (data as Partial<SavedGame>).version;
    if (typeof version === 'number' && version !== SAVE_VERSION) {
      return { error: `Save file version ${version} isn't supported (expected ${SAVE_VERSION}).` };
    }
  }
  if (!isValidSavedGame(data)) return { error: "That file isn't a Héraklios save." };
  return { save: data };
}

/** Assembles a save file from its parts. Callers clone as needed; this does
 * not copy, so the result must be serialized before further mutation. */
export function buildSavedGame(parts: {
  savedAt: string;
  playerCount: number;
  playerNames: string[];
  edges: EdgeCode[];
  armySelections: ArmySelection[];
  combatMode: CombatMode;
  testMode: boolean;
  gameState: GameState;
  attackedThisPhase: string[];
  rammedThisTurn: string[];
}): SavedGame {
  return { version: SAVE_VERSION, ...parts };
}

/** The winner-check helper reads seat order by id; re-exported shape guard for
 * callers that want the active player after a load. */
export function activePlayerIdOf(state: GameState): PlayerId {
  return state.seatOrder[state.activePlayerIndex]!;
}
