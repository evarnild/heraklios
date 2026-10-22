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

### 2026-10-22 - subtasks 1-7 (implementer)

- **1 (2a12bf1)** `server/saveApi.ts` pure handler + `saveApi.test.ts` (36 tests); `server` in `tsconfig.json` include, `server/**/*.test.ts` in `vitest.config.ts` (eslint lints `server/` by default). AC1 mutants, each with the full `npx vitest run`: drop the slot allow-list: 15 tests fail; drop the origin check: 2 fail; drop validation before write: 4 fail; delete answers 404 on an empty slot: 1 fails; delete always 404: 2 fail. All killed.
- **2 (1d8e6fd)** `server/fileSaveFs.ts` (+ 7 tests: atomic write, no temp file left, list ignores other files), `server/saveApiPlugin.ts` (`configureServer` and `configurePreviewServer`), registered in `vite.config.ts`; `saves/` in `.gitignore`. Checked by hand with curl against `vite` and `vite preview` (health, 400, list, foreign origin 403). `vite.config.ts` importing `saveApi.ts` -> `engine/saveGame.ts` pulled in no browser code (the plan's stop condition did not trigger).
- **3+4 (fb0dec0, one commit, as the plan allowed)** `saveStorage.ts`: `readSlot`/`writeSlot`/`clearSlot`/`hasAnySave` removed; async `readSave`, `readAllSaves`, `writeSave`, `clearSave`; read-only `browserSaves`, `hasCopyableBrowserSaves`, `copyBrowserSaves`. `saveStorage.test.ts` (17 tests). AC2 mutants (full run each): overwrite a taken slot: 1 fails; write to localStorage: 1 fails; offer with nothing left: 2 fail. Panel: "Loading..." and rows off until the list arrives, one action at a time, each action re-reads, own status line, copy offer button; `BoardScene.autosave()` async, logs on failure; texts in `en.ts` and `fr.ts`.
- **5 (e061fa1)** e2e: `save-load` against the server plus the file check (AC4), new `save-import.spec.ts`, `e2e/savesDir.ts`, `global-teardown.ts`. Both scenarios `--repeat-each=3`: 6 of 6 passed (twice).
- **6 (a36e49c)** README "Saving and loading" and "Architecture" (`server/`), CLAUDE.md Architecture. No "Known simplifications" bullet existed for this feature.
- **7** `npm run verify` green: 49 files, 776 tests (716 before this intent, +36 saveApi, +7 fileSaveFs, +17 saveStorage), lint 21 warnings (cap 21, unchanged), `check:intent` PASS, `npm run e2e` 10 of 10 passed, the temp saves folder gone, no `saves/` in the worktree. Size of a real save (test-mode game, written by the import scenario): 2907 bytes; a fuzz-harness state with 10 units serialises to 2124 bytes (about 200 bytes per unit), so 2 MB allows roughly 10,000 units.

**Divergences from the plan**
- The e2e temp folder is not created by global setup and passed to `webServer`: Playwright starts the web server before global setup runs, so its `env` must be known when the config loads. The path is fixed in `e2e/savesDir.ts` (one per port, under the OS temp folder); global setup empties it, the new global teardown removes it, and the scenarios read it by that name.
- Reads return `{ ok: true, value } | { ok: false }` rather than a bare `null`, so the panel can tell an empty slot from a server that does not answer (B6 words them differently). Writes and clears return a boolean as specified.
- The panel gets its own status line (the Menu passes no `onStatus`, so B6's messages would otherwise vanish there) and the import offer sits beside it.
- Save's pre-read goes through the list (`GET /api/saves`), not the slot, because a 404 on an empty slot prints a red console error in the browser on every first save (the e2e error check caught it).
- Help for the e2e: disabled buttons are not click targets in the dev hook (`input.enabled`), so the scenarios wait for `buttonCount('Save') === 6` as the "panel loaded" signal (`waitSavePanelLoaded`); no change to `devHook.ts`.

### 2026-10-22 - rework after review round 1 (implementer)

All findings of review.md round 1 fixed in one commit.
- **M1** `handleSaveApi` checks `Host` first: only `localhost`, `127.0.0.1`, `[::1]` (any port), else 403 (also for a missing Host and for a rebinding page whose Origin matches its own Host). The Origin check now compares the whole origin with `http://<Host>` (scheme too). README corrected: a LAN name or address therefore gets no API.
- **M2** temp name per write is `randomUUID()`; writes to one slot are queued in-process (concurrent renames over one target fail with EPERM on Windows even with unique temp names: the first concurrent test run showed 9 of 40 failing), and the rename retries a few times on EPERM/EBUSY/EACCES. Tests: 40 concurrent writes to one slot all succeed, one body wins, no temp file left; a failed write leaves no temp file.
- **M3** `server/saveApiPlugin.test.ts` (14 tests): fake request/response; Origin and Host forwarded, body cap and `bodyTooLarge` forwarding, 500 on an fs error, `Cache-Control: no-store` (also on 204), non-/api/ passes on, `readBody` bounded, registration on dev AND preview.
- **M4** `waitLoadOnRowOf` waits for a Load button on the saved slot's own row; each scenario removes its slot files first. Proof: with a 1.5 s delay inserted before `writeSave` in `saveInto`, both scenarios passed (23 s run); delay removed afterwards.
- **LOW** 2 MB boundary now counted in bytes (exactly the cap accepted, cap+1 and multibyte over-cap refused); health 405; a copy that stops partway returns `stopped` and the panel says how many it copied (new `copyStopped` text, en and fr); an invalid file reads as empty, a down server as not ok.

Mutants (full `npx vitest run`, each killed): drop origin forwarding (1 fails), drop host forwarding (1), drop the streaming cap (1), drop `bodyTooLarge` forwarding (1), drop Cache-Control (3), drop preview registration (1), drop the Host allow-list (12), contains-instead-of-exact origin compare (1), cap `>=` (1), health 405 dropped (1), shared temp name and no queue (1), partial copy reported as failure (1), invalid file read as not ok (2).

Results: `npm run verify` green (50 files, 813 tests, lint 21/21); `npm run e2e` 10 of 10; the two save scenarios `--repeat-each=3` 6 of 6; temp saves folder gone. `npm run check:intent` now FAILS only on "a live check is owed and not recorded" (the owner's gate; review.md exists), the type check itself is clean.

### 2026-10-22 - rework after review round 2 (implementer)

- **Correction to the round-1 entry:** its claim that writes to one slot are queued was true of `fileSaveFs` but not of the running server: the plugin built a new `fileSaveFs` per request, so every request had an empty queue, and concurrent writes survived only through the rename retry. Also, the "(1)" kill listed there for "shared temp name and no queue" was a combined mutant that hid that the two halves were not each killed.
- **Fix:** the plugin builds ONE store lazily after `configResolved` (`store ??= fileSaveFs(dir)`), shared by the dev and preview servers of a process.
- **Tests:** `saveApiPlugin.concurrency.test.ts` drives 12 concurrent PUTs through the plugin's two registered handlers with a real store in a temp folder, a rename spy proving no two renames overlap on one target, all 204, the last issued wins, no temp left. `fileSaveFs.test.ts` adds: the same through the store (12 writes, no retries needed, last wins), a rejected write does not block the next to the same slot, two stores on one folder use distinct temp names (checked on the temp paths, because on Windows two renames of one shared temp file can both report success), and `renameOver` with injected errors (succeeds after N transient errors with growing pauses; gives up after `RENAME_ATTEMPTS` with the error and a total pause under 1 s even with worst-case jitter; ENOENT/EISDIR/ENOSPC/no code are not retried).
- **Backoff (LOW, two processes on one folder):** 8 attempts, pause 25n ms plus up to 25 ms jitter, at most 7 pauses, under 0.9 s in all; the limit is documented in the code (two processes hammering one slot for longer can still lose a write with a 500).
- **Panel:** `copyFromBrowser` refreshes the rows first and sets the "copied N, then the server stopped answering" status after, so it is no longer overwritten. Nits: indentation in `fileSaveFs.ts`, README wrap.
- **Mutants** (full `npx vitest run` each, all killed): shared temp name alone (first survived; killed once the test checked temp paths: 1 fails), no queue alone (2), queue blocked after a rejected write (1), no retry (5), retry on every error code (4), no backoff (1), no retry bound (3), fs built per request (1).
- Results: `npm run verify` green (51 files, 827 tests, lint 21/21); `npm run e2e` 10 of 10; the two save scenarios `--repeat-each=3` 6 of 6; temp folder gone. `npm run check:intent` fails only on the owed live check.

### 2026-10-22 - rework after review round 3 (implementer)

- **M1** `e2e/savesDir.ts`: a cross-worker lock (`acquireSaveLock`/`releaseSaveLock`, an exclusive `mkdirSync` of `<SAVES_DIR>.lock`, retried every 50 ms up to 25 s, a lock older than 60 s taken over, released only by the worker that holds it). Both save scenarios take it in `beforeEach` and release it last in `afterEach` (after their files are removed). Global setup and teardown also remove it. Results: AC3 command (`save-load` + `save-import`, `--repeat-each=3`) 3 runs, each 6 of 6; `save-import --repeat-each=10 --workers=2` 2 runs, each 10 of 10. Mutant: lock made a no-op: the same stress run gave 7 failed, 3 passed.
- **L1** `remove` goes through the slot queue (`enqueue`, shared with `write`); test: PUT then DELETE issued back to back (rename delayed 40 ms) leaves no file. Mutant (remove bypasses the queue): 1 test fails.
- **L2** pinned: a write whose rename fails twice transiently still succeeds after a measured pause (at least 40 ms over the plain write; mutant `writeOnce` uses plain `rename`: 1 fails; instant sleep: 1 fails, the first version of the test, a fixed 45 ms threshold, did not kill it and was replaced by the baseline comparison); `renameOver` succeeds after `RENAME_ATTEMPTS - 1` = 7 transient errors and `RENAME_ATTEMPTS` is 8 (mutant 4: 1 fails).
- **L3 / nit** README line rewrapped with "—" (no line starts with "- "); CLAUDE.md `server/` entry names the Host allow-list checked first.
- Results: `npm run verify` green (51 files, 830 tests, lint 21/21); `npm run e2e` 10 of 10; temp folder (and lock) gone; `npm run check:intent` fails only on the owed live check.
