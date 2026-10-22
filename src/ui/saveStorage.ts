import { session, setSeatControls } from './session';
import {
  buildSavedGame,
  isValidSavedGame,
  parseSavedGame,
  type EdgeCode,
  type SavedGame,
  type SaveError,
} from '../engine/saveGame';

/** Manual save slots offered in the Save/Load panel. */
export const SLOT_COUNT = 6;

export type SlotId = number | 'autosave';

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
  // Both live on `GameState` (not `SavedGame` directly), same as
  // `randomizedTurnOrder` above — see `SessionState.clockLimitMs`'s doc
  // comment for why the Menu still needs its own copy synced here.
  session.clockLimitMs = save.gameState.clockLimitMs;
  session.roundLimit = save.gameState.roundLimit;
  session.testMode = save.testMode;
  session.gameState = structuredClone(save.gameState);
  return {
    attackedThisPhase: new Set(save.attackedThisPhase),
    rammedThisTurn: new Set(save.rammedThisTurn),
  };
}

// ---------------------------------------------------------------------------
// Saves live as files behind the local save API (intents/45-save-api, spec
// B3, B5, B6). There is no browser fallback: every call below goes to
// `/api/saves` on the server that serves the game, and a failure is reported,
// never swallowed. Reads return `{ ok: false }` when the server did not
// answer (network error or an unexpected status), so a caller can tell
// "empty slot" from "server down" — the panel words them differently.
// ---------------------------------------------------------------------------

/** A read that reached the server (`ok`) or did not. */
export type FileRead<T> = { ok: true; value: T } | { ok: false };

const savePath = (slot: SlotId): string => `/api/saves/${slot}`;

/** `fetch`, with a network error turned into `null`. */
async function call(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(path, init);
  } catch {
    return null;
  }
}

/** A slot's save. An empty slot (404) or an invalid file is `value: null`. */
export async function readSave(slot: SlotId): Promise<FileRead<SavedGame | null>> {
  const res = await call(savePath(slot));
  if (!res) return { ok: false };
  if (res.status === 404) return { ok: true, value: null };
  if (!res.ok) return { ok: false };
  try {
    const parsed = parseSavedGame(await res.text());
    return { ok: true, value: 'save' in parsed ? parsed.save : null };
  } catch {
    return { ok: false };
  }
}

/** Every slot that holds a valid save, in one request. */
export async function readAllSaves(): Promise<FileRead<Map<SlotId, SavedGame>>> {
  const res = await call('/api/saves');
  if (!res || !res.ok) return { ok: false };
  try {
    const body = (await res.json()) as Record<string, unknown>;
    const saves = new Map<SlotId, SavedGame>();
    for (const slot of ALL_SLOTS) {
      const value = body[`${slot}`];
      if (isValidSavedGame(value)) saves.set(slot, value);
    }
    return { ok: true, value: saves };
  } catch {
    return { ok: false };
  }
}

/** Stores a save in a slot. False if the server did not store it. */
export async function writeSave(slot: SlotId, save: SavedGame): Promise<boolean> {
  const res = await call(savePath(slot), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
  });
  return res !== null && res.ok;
}

/** Empties a slot (also when it already was). False if the server did not. */
export async function clearSave(slot: SlotId): Promise<boolean> {
  const res = await call(savePath(slot), { method: 'DELETE' });
  return res !== null && res.ok;
}

// ---------------------------------------------------------------------------
// Import of saves an older build left in this browser (spec B8). Read-only on
// `localStorage`: nothing here writes or deletes a browser key.
// ---------------------------------------------------------------------------

const SLOT_KEY_PREFIX = 'heraklios.save.slot';
/** The autosave had its own key so it could never clobber a deliberate save. */
const AUTOSAVE_KEY = 'heraklios.save.autosave';

const ALL_SLOTS: SlotId[] = ['autosave', ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)];

/** The only part of `Storage` the import may touch. */
export type BrowserStorage = Pick<Storage, 'getItem'>;

function browserKey(slot: SlotId): string {
  return slot === 'autosave' ? AUTOSAVE_KEY : `${SLOT_KEY_PREFIX}${slot}`;
}

function defaultStorage(): BrowserStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage unavailable (private mode, disabled cookies)
  }
}

/** The raw text a browser slot holds, for each slot that holds anything. */
function browserRaw(storage: BrowserStorage | null): Map<SlotId, string> {
  const held = new Map<SlotId, string>();
  for (const slot of ALL_SLOTS) {
    try {
      const raw = storage?.getItem(browserKey(slot));
      if (raw) held.set(slot, raw);
    } catch {
      // unreadable: treated as empty
    }
  }
  return held;
}

/** The browser saves that are valid, by slot. */
export function browserSaves(storage: BrowserStorage | null = defaultStorage()): Map<SlotId, SavedGame> {
  const saves = new Map<SlotId, SavedGame>();
  for (const [slot, raw] of browserRaw(storage)) {
    const parsed = parseSavedGame(raw);
    if ('save' in parsed) saves.set(slot, parsed.save);
  }
  return saves;
}

/** Whether the panel should offer the copy: a valid browser save whose file slot is empty. */
export function hasCopyableBrowserSaves(
  files: ReadonlyMap<SlotId, SavedGame>,
  storage: BrowserStorage | null = defaultStorage(),
): boolean {
  return [...browserSaves(storage).keys()].some((slot) => !files.has(slot));
}

/**
 * Copies each valid browser save into the same file slot, only if that slot
 * is empty — never overwriting. Counts what was copied and what was skipped
 * (invalid, or the slot is taken). Null when the server did not answer.
 */
export async function copyBrowserSaves(
  storage: BrowserStorage | null = defaultStorage(),
): Promise<{ copied: number; skipped: number } | null> {
  const files = await readAllSaves();
  if (!files.ok) return null;
  let copied = 0;
  let skipped = 0;
  for (const [slot, raw] of browserRaw(storage)) {
    const parsed = parseSavedGame(raw);
    if ('error' in parsed || files.value.has(slot)) {
      skipped++;
      continue;
    }
    if (!(await writeSave(slot, parsed.save))) return null;
    copied++;
  }
  return { copied, skipped };
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
 * Opens a file picker and resolves with the chosen save, or an error
 * to show the player. Resolves to null if they dismiss the dialog.
 *
 * Note: browsers fire no event when a file dialog is cancelled, so the
 * returned promise simply never settles in that case — callers must treat it
 * as fire-and-forget rather than awaiting it to re-enable UI.
 */
export function pickSaveFile(): Promise<{ save: SavedGame } | { error: SaveError | { kind: 'unreadable' } } | null> {
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
        .catch(() => resolve({ error: { kind: 'unreadable' } }));
    });
    input.click();
  });
}
