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
- The game's Save/Load panel and the autosave go through the API only.
  **No browser fallback** (owner's decision, 2026-10-22, revising the
  first answer once the API turned out to live in the server that serves
  the game: if that server is down, the game doesn't load either). A
  failed save says so; **Export to file** stays as the manual backup.
- **Existing browser saves are imported, not abandoned** (owner's
  decision): while the browser still holds saves, the panel offers to copy
  them into empty file slots; it reads `localStorage` and never writes it.
- What the player sees doesn't change beyond the import offer and a clear
  message when a save fails.
- A save written through the API is the same `SavedGame` JSON, validated
  with the same functions before it is stored and after it is read; a
  file on disk can be copied, backed up, or opened by hand.
- A static copy of `dist/` served without the API can't save (it says
  so); that case isn't supported.

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
  keep passing, now against the server.
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
  - The import: when it is offered, what it does with a slot that is
    taken on both sides, and when the offer goes away.
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
