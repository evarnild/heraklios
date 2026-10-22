<!-- generated-by: heraklios/intent@0.1.2 -->
# §45 — Games are saved as files on this PC, reached by the game through a local API

**Type:** feature
**Originator:** me (Eric)
**Source:** none

## Problem

"I want to save the games in a file and the client should access them
through an API." Today a saved game lives only in one browser's
`localStorage` (six slots plus an autosave, `src/ui/saveStorage.ts:11-20`,
`readSlot` / `writeSlot` / `clearSlot`), with a manual export/import of a
`.json` file (`downloadSave`, `pickSaveFile`). There is no server: the game
is a static page (`npm run dev`, `npm run preview`), and the SDLC grid
records "no server" as a deliberate choice.

The reason is **groundwork** (owner's answer): a local server that owns the
saves is the first piece of a back end that later features (for example a
game history, or play across devices or online) can grow from. Saves are
the first thing it serves because they already have a defined format and
validation (`src/engine/saveGame.ts`, `SAVE_VERSION = 3`,
`isValidSavedGame`, `parseSavedGame`, `migrateSavedGame`).

## Outcome

- A small server runs **on this PC, listening on localhost only** (owner's
  decision), alongside the game in development and for the stable copy.
  It keeps each save as a **file in a folder on disk** and exposes them
  through an HTTP API: list the saves, read one, write one, delete one.
- The game's Save/Load panel and the autosave use the API **when the
  server answers, and fall back to `localStorage` when it doesn't**
  (owner's decision). Export/import to a `.json` file keeps working.
- What the player sees doesn't change beyond, at most, a note of where a
  save went (server or browser).
- A save written through the API is the same `SavedGame` JSON, validated
  with the same functions before it is stored and after it is read; a
  file on disk can be copied, backed up, or opened by hand.
- The static build still works with no server at all (the fallback).

## Constraints

- **Save format:** unchanged (`SAVE_VERSION` stays 3 unless the spec finds
  a reason); the server stores and returns `SavedGame` JSON as is. The
  save path is **Reviewed** (`src/engine/saveGame.ts`,
  `src/ui/saveStorage.ts`, `REVIEW-POLICY.md` path table), so the owner
  reads the diff.
- **Localhost only, no accounts.** Bound to `127.0.0.1`; no auth. Still
  safe by construction: a slot id from the URL must never become an
  arbitrary path (no path traversal), the body size is capped, and only a
  valid save is written.
- **Engine/presentation boundary:** the engine stays free of I/O; the
  server's logic (routing, slot ↔ file name, validation) is pure and
  tested where it can be, with the file and network layer thin.
- **Undo:** loading a game still clears the undo history, as today.
- **No new dependency without a reason in the plan** (pass 8): Node's own
  `http` and `fs` may be enough.
- **Live check:** owed by path (`src/ui/**`, and `vite.config.ts` if the
  dev server proxies the API). The e2e suite's `save-load` scenario must
  keep passing, with or without the server (the spec decides which it
  runs against).
- The grid's declared choice "Maintain has no monitoring dimension: there
  is no server" no longer holds once this lands; the next `/grid` revisits
  it.

## Type-specific questions

### Feature
- **Users:** hotseat players (their saves); the owner (the folder on
  disk); later features built on the server.
- **Rulebook basis:** digital-only.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - API shape: routes and status codes (e.g. `GET /api/saves`, `GET/PUT/
    DELETE /api/saves/:slot`), and whether slots stay "1–6 + autosave" or
    become named saves.
  - Where the folder lives (in the repo, ignored by git? under the user's
    profile?) and one file per slot vs. one file for all.
  - How the server runs: its own `npm run` script, started by `npm run
    dev` alongside Vite, Vite proxying `/api`, and how the stable copy
    (`scripts/update-stable.sh`, `vite preview`) gets one.
  - Fallback rules: how the game decides the server is there (a probe at
    start, or per request), what happens when a save was in the browser
    and the server comes back (shown separately? merged?), and whether
    existing browser saves are offered for copying to the server.
  - Node built-ins vs. a small framework.
  - The e2e suite: does `save-load` run against the server, the fallback,
    or both; does Playwright's `webServer` start the API too.

## Assumptions I made

- **Feature, Reviewed tier:** a new server and a change to the save path.
- The server is TypeScript or plain Node in a new top-level folder (e.g.
  `server/`), not inside `src/` (which Vite bundles for the browser).
- Saves written by the server are kept out of git (`.gitignore`).
- "Groundwork" means this change delivers only saves; any other route or
  feature is a later intent.
