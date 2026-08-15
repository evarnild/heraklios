import type { ArmySelection } from './army';
import { isSeatControl, normalizeSeatControls, type SeatControl } from './seatControl';
import type { CombatMode, GameState, Phase, PlayerId } from './state';

/**
 * Save-file format version. Bump whenever the shape changes incompatibly;
 * `isValidSavedGame` rejects anything it doesn't recognise, so an old file
 * fails with a clear message instead of loading into a half-broken game.
 */
export const SAVE_VERSION = 3;

/**
 * The oldest version `migrateSavedGame` below can bring forward. Files older
 * than this are rejected rather than guessed at.
 */
export const MIN_SUPPORTED_SAVE_VERSION = 1;

// `GameState.randomizedTurnOrder` (added for the re-randomised-turn-order
// house rule) deliberately did NOT bump `SAVE_VERSION`: it's read only via
// `if (state.randomizedTurnOrder)` in `advancePhase`, so a save file from
// before this field existed simply deserializes with it `undefined`, which is
// falsy and reproduces exactly the fixed-order behaviour that file was saved
// with. No migration and no stricter validation is needed for a field whose
// absence is indistinguishable, in behaviour, from its default.
//
// `Unit.charged` (added for cavalry charges) follows the same reasoning: it's
// read only via `if (unit.charged)` (see `currentAttack`), so the ONLY save
// files affected by its absence are ones written by a pre-feature build of
// the game — which, by definition, never recorded a charge to begin with —
// and those simply deserialize the field as `undefined` (falsy), identical
// in behaviour to an explicit `false`. This is not a lossy round-trip for
// saves made WITH this feature: `charged: true` is a plain boolean on a
// plain-data `Unit`, so it survives `structuredClone`/`JSON.stringify`
// exactly like every other `Unit` field (verified in `saveGame.test.ts`) —
// a save made mid-Combat-phase, after a charge but before that unit has
// attacked, reloads with the charge (and its doubled attack) intact.
//
// `seatControls` (Stage 4's per-seat Human/AI configuration, plan.md §6.4) is
// where that reasoning STOPS applying, and version 1 -> 2 is the bump it
// forced. Read BACKWARDS the field looks exactly like the two above: a
// version-1 file has no `seatControls`, and a version-1 file was necessarily
// an all-human hotseat game, so defaulting the absent field to all-`'human'`
// reproduces that game exactly — which is why `migrateSavedGame` below can
// load one rather than rejecting it. The danger is FORWARDS: a version-2 file
// with an AI seat, opened by a build that predates this field, would load as
// a fully human game and silently hand a bot's army to the player (or, in a
// 2-player game against the computer, present a board where nothing ever
// moves for the opponent). Nothing in a save can make an OLD build read a
// field it doesn't know about — the only thing that can protect that player
// is the version number itself, which makes the old build refuse the file
// outright with `parseSavedGame`'s clear message. Hence the bump: not because
// this build can't read version 1 (it can), but because older builds must not
// half-read version 2.
//
// `GameState.winnerId: PlayerId | null` -> `winnerIds: PlayerId[]` (plan.md
// §9.2.2 point 2) is version 2 -> 3, and for the OPPOSITE reason
// `randomizedTurnOrder`/`charged` did NOT need a bump: those fields'
// ABSENCE was indistinguishable from their default. `winnerId`'s presence
// isn't optional here — a version-2 file always has it, with a real value —
// so this is a genuine shape change on an existing, populated field, not an
// addition. `migrateSavedGame` translates it losslessly (`null` -> `[]`,
// otherwise a one-element array), because a version-2 file was written by a
// build that could only ever produce a single winner or "nobody," never a
// draw, so that translation reproduces exactly the outcome that game had.
//
// The same bump also backfills `GameState`'s other three new fields
// (`clockLimitMs`, `elapsedMs`, `roundLimit`, `pendingGameEnd` — plan.md
// §9.2.1's clock and round-limit endgame modes) to "off, nothing elapsed,
// nothing pending." These COULD have followed the absence-is-the-default
// reasoning on their own — but `elapsedMs` specifically can't: `advanceGameClock`
// does `state.elapsedMs += deltaMs`, and `undefined + number` is `NaN`, which
// then compares false against everything forever (a `clockLimitMs` of
// `undefined` also reads as "on" under a plain `!== null` check, unlike a
// proper `null`) — silently wedging the clock rather than reproducing "off."
// Since a version-2 file is already earning a version bump for `winnerIds`,
// folding these four in as part of the SAME migration is simpler than
// inventing a second special case for `elapsedMs` alone.

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
  /** Who plays each seat, indexed like `playerNames`. Added in version 2; a
   * migrated version-1 file gets all-`'human'` (see `migrateSavedGame`). */
  seatControls: SeatControl[];
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
  // Checked strictly (rather than normalized here) because everything reaching
  // this point has already been through `migrateSavedGame`, which is the one
  // place allowed to invent a missing or unreadable value — a version-2 file
  // whose `seatControls` still don't validate is corrupt, not merely old.
  if (!Array.isArray(save.seatControls) || !save.seatControls.every(isSeatControl)) return false;
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
  // Same "checked strictly, post-migration" reasoning as `seatControls`
  // above: a version-3 file missing any of these five is corrupt, not
  // merely old — `migrateSavedGame` is the only place allowed to invent them.
  if (!Array.isArray(state.winnerIds) || !state.winnerIds.every((w: unknown) => typeof w === 'number')) return false;
  if (state.clockLimitMs !== null && typeof state.clockLimitMs !== 'number') return false;
  if (typeof state.elapsedMs !== 'number') return false;
  if (state.roundLimit !== null && typeof state.roundLimit !== 'number') return false;
  if (typeof state.pendingGameEnd !== 'boolean') return false;

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
 * Brings an older-but-supported file up to `SAVE_VERSION`, in place on the
 * parsed object, and reports whether the version is one this build can use at
 * all. Anything already at `SAVE_VERSION` passes straight through untouched.
 *
 * Deliberately does NOT validate: it only fills in what a newer field's
 * absence means, leaving `isValidSavedGame` as the single gate on shape. So a
 * corrupt version-1 file is still rejected — just by the structural check
 * after this rather than by the version check before it.
 */
export function migrateSavedGame(data: unknown): { migrated: unknown } | { error: string } {
  if (typeof data !== 'object' || data === null) return { migrated: data };
  const save = data as Partial<SavedGame> & Record<string, unknown>;
  const version = save.version;
  if (typeof version !== 'number') return { migrated: data };
  if (version === SAVE_VERSION) return { migrated: data };
  if (version < MIN_SUPPORTED_SAVE_VERSION || version > SAVE_VERSION) {
    return { error: `Save file version ${version} isn't supported (expected ${SAVE_VERSION}).` };
  }

  // 1 -> 2: `seatControls` didn't exist, and a game saved without it was
  // necessarily all-human (nothing could configure an AI seat), so filling
  // it that way reproduces the saved game exactly rather than guessing.
  // `playerNames` is the length `seatControls` is indexed against everywhere
  // else; `playerCount` can be shorter (test-mode games), and padding to the
  // longer of the two costs nothing and can't leave a seat unconfigured.
  if (version < 2) {
    const named = Array.isArray(save.playerNames) ? save.playerNames.length : 0;
    const counted = typeof save.playerCount === 'number' ? save.playerCount : 0;
    save.seatControls = normalizeSeatControls(save.seatControls, Math.max(named, counted));
    save.version = 2;
  }

  // 2 -> 3: see `SAVE_VERSION`'s doc comment above for the full reasoning.
  // `winnerId` -> `winnerIds` translates losslessly (a version-2 file could
  // only ever record a single winner or nobody, never a draw); the clock/
  // round-limit fields default to "off, nothing elapsed, nothing pending,"
  // which is the only state a pre-Mode-A/B file could have been in.
  if (version < 3) {
    const state = save.gameState as (Record<string, unknown> & { winnerId?: unknown }) | undefined;
    if (state && typeof state === 'object') {
      const oldWinnerId = state.winnerId;
      state.winnerIds = typeof oldWinnerId === 'number' ? [oldWinnerId] : [];
      delete state.winnerId;
      if (state.clockLimitMs === undefined) state.clockLimitMs = null;
      if (state.elapsedMs === undefined) state.elapsedMs = 0;
      if (state.roundLimit === undefined) state.roundLimit = null;
      if (state.pendingGameEnd === undefined) state.pendingGameEnd = false;
    }
    save.version = 3;
  }
  return { migrated: save };
}

/**
 * Parses, migrates and validates raw JSON text. Returns the game or an error
 * message suitable for showing the player, rather than throwing.
 */
export function parseSavedGame(text: string): { save: SavedGame } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const migration = migrateSavedGame(data);
  if ('error' in migration) return migration;
  if (!isValidSavedGame(migration.migrated)) return { error: "That file isn't a Héraklios save." };
  return { save: migration.migrated };
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
  seatControls: SeatControl[];
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
