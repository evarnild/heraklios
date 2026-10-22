<!-- generated-by: heraklios/intent@0.1.2 -->
# §45 plan — Games are saved as files on this PC, reached by the game through a local API

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

(Written by hand: `/build-plan`, §44, is still in review.)

## Goal

Saves live as one JSON file per slot in a local folder, served by a Vite
plugin under `/api/` on the dev and preview servers (spec B1–B4, B9); the
game reads and writes them through an asynchronous client with no browser
fallback and visible failures (B5–B7); existing browser saves can be copied
in, read-only (B8); e2e runs against the server in a temporary folder
(B10); docs follow (B11).

## Risks

- **Save path, Reviewed tier.** `src/ui/saveStorage.ts` changes shape (sync
  → async). Every caller must be found and moved (`saveLoadPanel.ts`, the
  `BoardScene` autosave); `tsc` catches a missed sync call only if the old
  functions are removed, not kept beside the new ones. Remove them.
- **Async UI races.** The panel's buttons act on a slot list that now
  arrives later: a click before it arrives, or two quick clicks (save then
  load), must not act on stale data. Rows stay disabled until their data
  is in; each operation re-reads what it needs.
- **The autosave timing.** It runs at a movement phase's start
  (`BoardScene.ts:866`, `:988-991`), synchronously today. Made async, it
  must not block the turn, and a failure must log (B6), not throw.
- **Path traversal and foreign origins** (B3, B4): the security of the
  whole feature sits in the pure handler; each rule gets a test and a
  mutant (AC1).
- **Real saves touched by tests.** The plugin's folder must come from
  `HERAKLIOS_SAVES_DIR` in e2e (temp, created and removed per run) and
  never default to `saves/` there; unit tests use the in-memory fs only.
- **Vite config runs in Node.** `vite.config.ts` imports the plugin, which
  imports `src/engine/saveGame.ts`; that module must stay free of browser
  globals (it is today: pure). If an import pulls in Phaser or DOM code,
  stop and re-plan.
- **Tooling gaps** (spec Non-functional): `server/` is outside today's
  `tsconfig.json` `include`, `vitest.config.ts` `include` and the eslint
  per-folder rules; without them its code and tests silently don't run.
- **The e2e flake history** (§38, §41): new scenarios run 3× (AC3); the
  temp folder is per run, so parallel workers share one server and one
  folder — the import scenario must use a slot no other scenario touches.
- **Lint cap 21.** `saveLoadPanel.ts` (274 lines) grows async code; keep
  every function under 80 lines and complexity 20.

## Verified against the codebase

Re-read on `main` at `f2ae7b6`:

- `src/ui/saveStorage.ts` (184 lines): `:11` `SLOT_COUNT = 6`; `:13`
  `SLOT_KEY_PREFIX = 'heraklios.save.slot'`; `:17` `SlotId = number |
  'autosave'`; `:19-20` `storageKey`; `:84-95` `readSlot`; `:98-105`
  `writeSlot`; `:107-113` `clearSlot`; `:117-124` `hasAnySave` (no caller
  outside the file); `:133-145` `stagePendingLoad` / `consumePendingLoad`
  (stay sync, in memory); `:146` `downloadSave`; `:166` `pickSaveFile`.
- `src/ui/saveLoadPanel.ts` (274 lines): imports `:7-11`; `mode: 'manage'
  | 'load'` `:21`; `build` `:90`; `buildRow` `:153`; `refreshRow`
  `:202-211`; `status` `:213`; `saveInto` `:217-228`; `loadFrom`
  `:230-238`; `deleteSlot` `:240-245`; export/import `:247-262`.
- `src/scenes/BoardScene.ts:15` imports `writeSlot`; `:866` `autosave()`
  in `create`; `:984-991` `autosave()` → `writeSlot('autosave', …)`,
  doc comment "Silent on failure"; `:587` `consumePendingLoad()`.
- `src/scenes/MenuScene.ts:7`, `:234` `stagePendingLoad` (unchanged).
- `src/ui/i18n/en.ts:301-326` `saves` messages (fr.ts mirrors);
  `savingFailed` today says "browser storage is full or unavailable".
- `src/engine/saveGame.ts`: `parseSavedGame` `:274`, `isValidSavedGame`
  `:160`, `SAVE_VERSION = 3` `:17`; no browser global used.
- `vite.config.ts` (16 lines): `server.port 5173`, `build.rollupOptions`;
  Vite 6.4.3 (`node_modules/vite/package.json`) supports
  `configureServer` and `configurePreviewServer`.
- `playwright.config.ts:30-36` `webServer` (`npx vite --port 5232
  --strictPort`), no `env`, no `globalTeardown`; `e2e/global-setup.ts`
  exists; `e2e/save-load.spec.ts` saves to slot 1 through the panel.
- `tsconfig.json:16` `include` (no `server`); `vitest.config.ts:6`
  `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`;
  `eslint.config.js:52` test-file overrides, `:60` `scripts/**` override.
- `.gitignore`: no `saves/` entry yet.

## Subtasks

1. **Pure handler + tests (B3, B4, B9; AC1).** `server/saveApi.ts`:
   `handleSaveApi({ method, url, origin, host, body }, fs)` → `{ status,
   body }`; slot parsing (`1`–`6`, `autosave`), origin check, 2 MB cap,
   `parseSavedGame` before write; an in-memory `SaveFs` for tests.
   `server/saveApi.test.ts`. Tooling: add `server` to `tsconfig.json`
   `include` and `server/**/*.test.ts` to `vitest.config.ts`; confirm
   eslint lints it. Run AC1's four mutants. One commit.
2. **Real fs + plugin (B1, B2).** `server/fileSaveFs.ts` (folder from
   `HERAKLIOS_SAVES_DIR` or `<root>/saves`, created on first write; atomic
   write via temp + rename; `list` reads `slot-*.json`, `autosave.json`);
   `server/saveApiPlugin.ts` adapting Node `req`/`res` (body read with the
   cap) for `configureServer` and `configurePreviewServer`; register in
   `vite.config.ts`; `saves/` in `.gitignore`. A small test of the atomic
   write against a temp dir. One commit.
3. **Client + import (B5, B8; AC2).** In `saveStorage.ts`: remove
   `readSlot` / `writeSlot` / `clearSlot` / `hasAnySave`; add the async
   client (`readSave`, `readAllSaves`, `writeSave`, `clearSave`) over
   `fetch`, and `browserSaves()` (read-only `localStorage`) plus
   `copyBrowserSaves()` (empty slots only, counts). Tests in
   `src/ui/saveStorage.test.ts` with stubbed `fetch` and `localStorage`;
   AC2's mutants. One commit (it won't build until subtask 4 — so 3 and 4
   go in one commit, or the old functions stay until 4 removes them: the
   implementer's choice, recorded in Progress).
4. **Callers (B6, B7).** `saveLoadPanel.ts` async: "Loading…", rows
   enabled when their data arrives, each action re-reading its slot, B6's
   messages, B8's offer and action; `BoardScene.autosave()` async,
   logging on failure, doc comment updated. New/changed messages in
   `en.ts` and `fr.ts` (the `noLiterals` scan and `messages.test.ts`
   cover them). One commit.
5. **e2e (B10; AC3, AC4).** `playwright.config.ts`: a temp folder for
   `HERAKLIOS_SAVES_DIR` (created in global setup, passed to `webServer`
   via `env`, removed in a new `globalTeardown`); `save-load.spec.ts`
   against the server, plus a check that the slot's file exists and parses
   (AC4); new `e2e/save-import.spec.ts` (seed a browser save with
   `addInitScript` into slot 5, open the panel, copy, load slot 5). One
   commit.
6. **Docs (B11).** README "Saving and loading"; `CLAUDE.md` Architecture
   (`server/`, and the `saveStorage.ts` line). One commit.
7. **Hand-over.** `verify`, `check:intent`, `npm run e2e` and the two
   save scenarios `--repeat-each=3`; mutants recorded; a real save's size
   measured (spec assumption on the 2 MB cap); Progress; `status:
   in-review`.

## Tests

- `server/saveApi.test.ts` (AC1): every route and status; slot values
  `0`, `7`, `../x`, `autosave.json`, `%2e%2e` → 404 with no fs call; a
  foreign `Origin` → 403, same origin and none → allowed; > 2 MB → 413;
  invalid save → 400 and nothing written; list skips an invalid file;
  delete of an empty slot → 204. Mutants: drop the slot allow-list, drop
  the origin check, drop validation before write, swap 404/204 on delete.
- `server/fileSaveFs` test: a write leaves no temp file and replaces the
  old content.
- `src/ui/saveStorage.test.ts` (AC2): each client call hits its route; a
  network error / non-2xx → `null` / `false`; `copyBrowserSaves` copies
  only into empty slots, skips invalid browser saves, counts both, never
  calls `localStorage.setItem` / `removeItem`; the offer predicate is
  false once nothing is left to copy. Mutants: overwrite a taken slot,
  write to `localStorage`, offer with nothing left.
- e2e (AC3, AC4): `save-load` (server + file check), `save-import`;
  `--repeat-each=3`.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e` green; the temp saves folder gone afterwards.
- **Live check (AC5, owed by path: `src/ui/**`, `vite.config.ts`):**
  1. In the worktree, `npm run dev -- --port 5245 --strictPort --host
     127.0.0.1` → open the game → Test mode → **💾 Save / Load** → save to
     slot 2 → `saves/slot-2.json` exists and is readable JSON.
  2. Stop and restart the dev server, reload, load slot 2 → same position.
  3. With the tab open, stop the dev server → save → the panel says the
     game server isn't answering; **Export to file** still downloads.
  4. Restart; in the browser's devtools put a save into
     `localStorage['heraklios.save.slot3']` (or use a browser that still
     has an old save) → open the panel → **Copy browser saves to files** →
     it reports 1 copied → load slot 3.
  5. Once on the stable copy: `bash scripts/update-stable.sh`, then `npm
     run preview` there → save and load a slot → the file appears in that
     checkout's `saves/`.

## Assumptions I made

- `hasAnySave` is removed (no caller outside its file).
- `stagePendingLoad` / `consumePendingLoad` stay synchronous and
  in-memory (they hand a loaded save between scenes, not storage).
- The e2e import scenario uses slot 5 so it can't collide with
  `save-load`'s slot 1 when workers share the server.
- The `savingFailed` message is reworded for the server ("The game server
  isn't answering — nothing was saved"); its key stays.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
