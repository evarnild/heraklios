<!-- generated-by: heraklios/intent@0.1.2 -->
# §45 spec — Games are saved as files on this PC, reached by the game through a local API

Accepted intent: [intent.md](intent.md)

Written against `main` at `228f1e3`. (Written by hand: `/spec`, §44, is
still in review.)

## Sources that apply

| Source | What it settles |
| --- | --- |
| `src/ui/saveStorage.ts:11-20` | Today's slots: `SlotId = number \| 'autosave'`, six numbered slots plus the autosave, `localStorage` keys `heraklios.save.slot<n>` / autosave |
| `src/ui/saveStorage.ts:84-113` | `readSlot` (null on empty or invalid), `writeSlot` (false on failure), `clearSlot`, all **synchronous** |
| `src/ui/saveLoadPanel.ts:202-262` | The only reader/writer of numbered slots: `refreshRow`, `saveInto`, `loadFrom`, `deleteSlot`, export/import |
| `src/scenes/BoardScene.ts:990` | The autosave: `writeSlot('autosave', …)` at a movement phase's start; silent on failure |
| `src/engine/saveGame.ts` | `SAVE_VERSION = 3`, `parseSavedGame`, `isValidSavedGame`, `migrateSavedGame`: the format and its validation, pure |
| `vite.config.ts`; Vite 6.4.3 | Dev server on 5173; `vite preview` serves `dist/` for the stable copy; Vite plugins can add middleware to both (`configureServer`, `configurePreviewServer`) |
| `playwright.config.ts:24-30` | e2e starts its own `npx vite` on 5232 (`webServer`) |

## Behaviour

**B1 — Where the server runs.** The API is a Vite plugin
(`server/saveApiPlugin.ts`, registered in `vite.config.ts`) that adds
middleware under `/api/` to **both** the dev server (`npm run dev`) and the
preview server (`npm run preview`, which the stable copy runs). So it
starts and stops with the game, on the same host and port, with no second
process, no proxy, and no new dependency. It listens wherever Vite does:
`localhost` by default (owner's decision: this PC only). A static copy of
`dist/` served any other way has no API, and the game falls back (B6).

**B2 — Where the files go.** One file per slot in a saves folder:
`slot-1.json` … `slot-6.json`, `autosave.json`. The folder is
`HERAKLIOS_SAVES_DIR` if set, else `saves/` at the checkout's root, which
`.gitignore` excludes. Each checkout (main, stable, a worktree) has its own
saves unless pointed at a shared folder. A write goes to a temporary file in
the same folder and is renamed over the target, so a crash never leaves a
half-written save.

**B3 — The API.**

| Request | Response |
| --- | --- |
| `GET /api/health` | `200 {"ok":true,"saves":"file"}` |
| `GET /api/saves` | `200` and `{ "<slot>": <SavedGame> }` for every slot holding a valid save (invalid or unreadable files are left out, like `readSlot`) |
| `GET /api/saves/:slot` | `200` and the save, or `404` if empty or invalid |
| `PUT /api/saves/:slot` | body: a `SavedGame` JSON; `204` when stored; `400` if it doesn't parse or isn't valid (`parseSavedGame`); `413` above 2 MB |
| `DELETE /api/saves/:slot` | `204` (also when already empty) |

`:slot` is exactly `1`–`6` or `autosave`; anything else is `404` and never
reaches the file system, so no path can be built from the URL. Any other
method on a known path is `405`. Every response is JSON with `Cache-Control:
no-store`.

**B4 — Only the game may call it.** A request whose `Origin` header is
present and isn't the server's own origin gets `403`. This stops another
website open in the same browser from reading or writing saves on
`localhost`; the game itself sends same-origin requests.

**B5 — The game's storage layer becomes asynchronous.** `saveStorage.ts`
gets a `SaveStore` with two backends of the same shape: `read(slot)`,
`readAll()`, `write(slot, save)`, `clear(slot)`, all returning promises,
results as today (`null` for empty/invalid, `false` for a failed write).
- **file backend:** `fetch` to the API (B3);
- **browser backend:** today's `localStorage` code, wrapped.

`readSlot`/`writeSlot`/`clearSlot` as synchronous functions go away; their
callers (`saveLoadPanel.ts`, `BoardScene` autosave) use the store.

**B6 — Choosing the backend, and the fallback.** Once per page load, the
first use of the store calls `GET /api/health` with a 1.5 s timeout; `200`
picks the file backend, anything else (no server, error, timeout) the
browser backend, for the rest of the page's life (owner's decision:
fallback kept). If a file-backend request later fails (server stopped), that
operation falls back to the browser backend and the panel says so
(B7); a lost autosave is never silent: it goes to the browser instead.

**B7 — What the player sees.** The Save/Load panel:
- shows "Saving to files on this PC" or "Saving in this browser" in its
  header (both languages, via the §35 tables);
- shows "Loading…" until the slot list arrives, then the rows as today;
- after a fallback (B6), its status line says the save went to the
  browser instead.

Nothing else in the game changes.

**B8 — Browser saves when the server is there.** If the file backend is in
use and the browser still holds saves, the panel offers **"Copy browser
saves to files"**: it copies each browser slot into the same file slot
**only if that file slot is empty**, never overwriting, then reports how
many it copied and how many it skipped. Browser saves aren't deleted.

**B9 — Pure parts, tested.** The plugin's request handling is a pure
function `handleSaveApi(request, fs)` in `server/saveApi.ts`, with the file
system behind a small interface (`read`, `write` (atomic), `remove`,
`list`), so tests run against an in-memory one. Slot parsing, origin check,
body cap and validation live there. The plugin only adapts Node's request
and response to it and supplies the real file system.

**B10 — The e2e suite runs against the server, in a temporary folder.**
`playwright.config.ts`'s `webServer` sets `HERAKLIOS_SAVES_DIR` to a fresh
temporary folder (created in global setup, removed in teardown), so a run
never touches anyone's real saves. `e2e/save-load.spec.ts` keeps its
scenario and now also checks the panel says "files". A second scenario
blocks `/api/**` (`page.route` → abort) and runs the same save/load,
checking the panel says "browser": the fallback, by real clicks.

**B11 — Docs.** README's "Saving and loading" section: where saves live
(files, the folder, `HERAKLIOS_SAVES_DIR`), the fallback, the copy action.
`CLAUDE.md` → Architecture names `server/` (the Vite plugin) and its
boundary: no game rule in it, only storage.

## Interpretations

None of the rulebook. Two readings of the owner's words:
- **"a file"**: one file per save slot (B2), not one file for all, so a
  save can be copied or backed up on its own, and a broken file costs one
  slot.
- **"through an API"**: an HTTP API on the same local server that serves the
  game (B1), not a separate service, since the owner chose "this PC,
  local only" and "groundwork": a Vite plugin can be lifted into a
  standalone Node server later without changing the API (B3).

## Acceptance criteria

- **AC1** — `server/saveApi.test.ts` (in-memory fs): each route and status
  of B3; `:slot` values `0`, `7`, `../x`, `autosave.json`, `%2e%2e` → `404`
  with no fs call; foreign `Origin` → `403`, same origin and no origin →
  allowed; body over 2 MB → `413`; invalid save → `400` and nothing
  written; list skips an invalid file. Mutants: drop the slot check, drop
  the origin check, drop validation before write, swap 404/204 on delete.
- **AC2** — `saveStorage` tests (file backend with a stubbed `fetch`,
  browser backend with a stubbed `localStorage`): backend choice on health
  200 / error / timeout; a failed file write falls back to the browser and
  reports it; the copy (B8) never overwrites and counts copied/skipped.
- **AC3** — `npm run e2e`: `save-load` passes against the server (temp
  folder) and the new fallback scenario passes with `/api` blocked;
  `--repeat-each=3` clean. The temp folder is gone after the run.
- **AC4** — the round trip: a save written by the game opens as readable
  JSON in the saves folder and loads back (e2e reads the file once
  through Node in the scenario).
- **AC5** — live check (owed by path: `src/ui/**`, `vite.config.ts`):
  `npm run dev` → save a game in slot 2 → the file appears in `saves/` →
  restart the dev server → load slot 2 → same position; stop the dev
  server, serve `dist/` some other way (or block `/api`) → the panel says
  "browser" and saving works; then the copy action with a browser save.
  And once on the stable copy after `scripts/update-stable.sh` and `npm run
  preview`.

## Non-functional

- **Engine/presentation split:** the engine stays I/O-free; `server/` uses
  `src/engine/saveGame.ts` for validation only.
- **Save format:** unchanged; `SAVE_VERSION` stays 3. Reviewed tier by
  path (`saveStorage.ts`; `saveGame.ts` only if touched).
- **Undo boundaries:** a load still clears history, as today.
- **AI / harness:** untouched.
- **Dependencies:** none new (Vite's plugin API, Node `fs`, `fetch`).
- **Security:** localhost only (B1), origin check (B4), slot allow-list
  (B3), 2 MB cap, validate before write.
- **Tooling coverage:** `server/` must be in `tsconfig.json`'s `include`,
  linted, and its `*.test.ts` picked up by `vitest.config.ts` (today
  `src/**/*.test.ts` and `scripts/**/*.test.mjs` only).
- **Lint cap 21.** `saveLoadPanel.ts` becomes async; keep functions under
  the guardrails.

## Out of scope

- Named saves or more than six slots.
- Any other API route or feature (the intent: groundwork, saves only).
- Running the API outside Vite, LAN access, accounts.
- Moving browser saves automatically (B8 is an explicit action).
- The map editor's own `localStorage` save.

## Assumptions I made

- **Vite plugin over a standalone server** (B1): no second process to
  start, works for dev and stable alike, no dependency; the pure handler
  (B9) keeps a later standalone server cheap.
- **Same slots** (B3): six plus autosave, so the panel and saves keep their
  shape; named saves would be a separate intent.
- **Per-checkout folder** (B2), with an env override, rather than one
  shared folder: dev code under work can't damage the stable copy's saves.
- **Copy, not move** (B8), and only into empty slots.
- **1.5 s health timeout** (B6) and **2 MB cap** (B3): a save is one
  `GameState` as JSON, far below that (the plan measures a real one).
