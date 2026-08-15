import { session, setSeatControls } from './session';
import {
  buildSavedGame,
  parseSavedGame,
  type EdgeCode,
  type SavedGame,
} from '../engine/saveGame';

/** Manual save slots offered in the Save/Load panel. */
export const SLOT_COUNT = 6;

const SLOT_KEY_PREFIX = 'heraklios.save.slot';
/** Autosave lives in its own key so it can never clobber a deliberate save. */
const AUTOSAVE_KEY = 'heraklios.save.autosave';

export type SlotId = number | 'autosave';

function storageKey(slot: SlotId): string {
  return slot === 'autosave' ? AUTOSAVE_KEY : `${SLOT_KEY_PREFIX}${slot}`;
}

/**
 * Captures the whole current game as a save file. `attackedThisPhase` and
 * `rammedThisTurn` are passed in by the board scene, which owns them — they're
 * per-phase bookkeeping that lives outside `GameState` (see SavedGame's docs).
 */
export function captureCurrentGame(bookkeeping: {
  attackedThisPhase: Iterable<string>;
  rammedThisTurn: Iterable<string>;
}): SavedGame {
  return buildSavedGame({
    savedAt: new Date().toISOString(),
    playerCount: session.playerCount,
    playerNames: [...session.playerNames],
    edges: [...session.edges] as EdgeCode[],
    armySelections: structuredClone(session.armySelections),
    combatMode: session.combatMode,
    // Sliced to the seats this game actually has: `session.seatControls` is
    // always MAX_PLAYERS long so the Menu can offer all four, but a save
    // describing a 2-player game shouldn't claim four seats.
    seatControls: session.seatControls.slice(0, session.playerCount),
    testMode: session.testMode,
    gameState: structuredClone(session.gameState!),
    attackedThisPhase: [...bookkeeping.attackedThisPhase],
    rammedThisTurn: [...bookkeeping.rammedThisTurn],
  });
}

/**
 * Restores a save into the live session. Returns the board-scene bookkeeping
 * that the caller must adopt — the scene can't read it off `session`, since
 * it deliberately isn't part of `GameState`.
 */
export function applySavedGame(save: SavedGame): {
  attackedThisPhase: Set<string>;
  rammedThisTurn: Set<string>;
} {
  session.playerCount = save.playerCount;
  session.playerNames = [...save.playerNames];
  session.edges = [...save.edges];
  session.armySelections = structuredClone(save.armySelections);
  session.combatMode = save.combatMode;
  setSeatControls(save.seatControls);
  session.randomizedTurnOrder = save.gameState.randomizedTurnOrder;
  session.testMode = save.testMode;
  session.gameState = structuredClone(save.gameState);
  return {
    attackedThisPhase: new Set(save.attackedThisPhase),
    rammedThisTurn: new Set(save.rammedThisTurn),
  };
}

/**
 * Reads a slot, returning null when empty — and also when the stored value is
 * corrupt or from an unsupported version, so one bad slot can never stop the
 * panel from listing the others.
 */
export function readSlot(slot: SlotId): SavedGame | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(slot));
  } catch {
    return null; // storage unavailable (private mode, disabled cookies)
  }
  if (!raw) return null;
  const result = parseSavedGame(raw);
  return 'save' in result ? result.save : null;
}

/** Writes a slot. Returns false if storage rejected it (quota/unavailable),
 * so the caller can tell the player rather than silently losing the save. */
export function writeSlot(slot: SlotId, save: SavedGame): boolean {
  try {
    localStorage.setItem(storageKey(slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSlot(slot: SlotId): void {
  try {
    localStorage.removeItem(storageKey(slot));
  } catch {
    // nothing to do — the slot is effectively unavailable either way
  }
}

/** True if any slot (including the autosave) holds a loadable game — used to
 * decide whether the Menu shows its "Load game" button at all. */
export function hasAnySave(): boolean {
  if (readSlot('autosave') !== null) return true;
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    if (readSlot(slot) !== null) return true;
  }
  return false;
}

/**
 * A save handed off between scenes: the Menu stages one here and starts the
 * Board, which consumes it in `create`. This is what tells the board it was
 * started from a save and must NOT reset the active player's movement points
 * (or the per-turn ramming record) the way a fresh game does.
 */
let pendingLoad: SavedGame | null = null;

export function stagePendingLoad(save: SavedGame): void {
  pendingLoad = save;
}

/** Returns the staged save, if any, and clears it so a later scene restart
 * doesn't re-apply a stale game. */
export function consumePendingLoad(): SavedGame | null {
  const staged = pendingLoad;
  pendingLoad = null;
  return staged;
}

/** Triggers a browser download of the save as a .json file. */
export function downloadSave(save: SavedGame): void {
  const state = save.gameState;
  const filename = `heraklios-turn${state.turnNumber}-${save.savedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Opens a file picker and resolves with the chosen save, or an error message
 * to show the player. Resolves to null if they dismiss the dialog.
 *
 * Note: browsers fire no event when a file dialog is cancelled, so the
 * returned promise simply never settles in that case — callers must treat it
 * as fire-and-forget rather than awaiting it to re-enable UI.
 */
export function pickSaveFile(): Promise<{ save: SavedGame } | { error: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file
        .text()
        .then((text) => resolve(parseSavedGame(text)))
        .catch(() => resolve({ error: "That file couldn't be read." }));
    });
    input.click();
  });
}
