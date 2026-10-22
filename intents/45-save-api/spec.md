<!-- generated-by: heraklios/intent@0.1.2 -->
# §45 spec — Games are saved as files on this PC, reached by the game through a local API

Accepted intent: [intent.md](intent.md)

Written against `main` at `228f1e3`. (Written by hand: `/spec`, §44, is
still in review.) Revised 2026-10-22: no browser fallback, a read-only
import of browser saves instead (owner).

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
`dist/` served any other way has no API: saving fails with a message
(B6), and that setup isn't supported.

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
| `GET /api/health` | `200 {"ok":true}` (for tools and later features; the game doesn't probe it) |
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

**B5 — The game's storage goes through the API.** `saveStorage.ts`'s
`readSlot` / `writeSlot` / `clearSlot` are replaced by an asynchronous
client of B3: `read(slot)`, `readAll()`, `write(slot, save)`,
`clear(slot)`, returning promises, results as today (`null` for empty or
invalid, `false` for a failed write). Their callers
(`saveLoadPanel.ts`, the `BoardScene` autosave) use it. The
`localStorage` slot code goes away, except the read-only part B8 needs.

**B6 — No fallback; failures are visible** (owner's decision). The API is
served by the same server as the game, so when it is down the game
doesn't load either; the remaining case is a tab left open while the
server stops. Then:
- a manual save, load or delete fails and the panel's status line says
  "The game server isn't answering — nothing was saved" (or loaded /
  deleted), and **Export to file** still works as the manual backup;
- a failed autosave writes one line to the Board's log ("Autosave failed:
  the game server isn't answering") instead of failing silently.

**B7 — What the player sees.** The Save/Load panel shows "Loading…" until
the slot list arrives, then the rows as today, plus B6's messages and B8's
offer (both languages, via the §35 tables). Nothing else changes.

**B8 — Import of browser saves** (owner's decision: drop the fallback,
keep the import). When the panel opens and the browser still holds any
save (`localStorage` keys `heraklios.save.slot1`–`6`, the autosave key),
it offers **"Copy browser saves to files"**. The copy writes each valid
browser save into the **same file slot only if that slot is empty**, never
overwriting, and reports how many it copied and skipped. It **reads
`localStorage` and never writes or deletes it**. The offer is shown while
any browser save exists that isn't already in its file slot; once every
browser save has been copied (or its slot is taken), it no longer shows.

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
scenario, now against the server. A second scenario seeds one browser
save (`localStorage`, before the page loads), opens the panel, clicks
**Copy browser saves to files**, and loads it back from the file slot.

**B11 — Docs.** README's "Saving and loading" section: where saves live
(files, the folder, `HERAKLIOS_SAVES_DIR`), what happens when the server
isn't answering, and the import.
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
- **AC2** — client and import tests (stubbed `fetch` and `localStorage`):
  each call maps to its route; a network error or non-2xx gives `null` /
  `false` and the panel's message (B6); the import copies only into empty
  slots, skips invalid browser saves, counts copied/skipped, and never
  calls `localStorage.setItem` or `removeItem`; the offer shows only while
  an uncopied browser save exists. Mutants: overwrite a taken slot, write
  to `localStorage`, show the offer with nothing left to copy.
- **AC3** — `npm run e2e`: `save-load` passes against the server (temp
  folder) and the new import scenario passes; `--repeat-each=3` clean.
  The temp folder is gone after the run.
- **AC4** — the round trip: a save written by the game opens as readable
  JSON in the saves folder and loads back (e2e reads the file once
  through Node in the scenario).
- **AC5** — live check (owed by path: `src/ui/**`, `vite.config.ts`):
  `npm run dev` → save a game in slot 2 → the file appears in `saves/` →
  restart the dev server → load slot 2 → same position; stop the dev
  server with the tab open → save → the panel says the server isn't
  answering, and Export to file still works; with a save left in this
  browser from before (stable, or slot data from an older build) → the
  panel offers the copy → copy → it loads from the file slot. And once on
  the stable copy after `scripts/update-stable.sh` and `npm run preview`.

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
- **Existing browser saves:** never modified (B8); a player who doesn't
  copy them keeps them in the browser, readable by an older build.
- **Tooling coverage:** `server/` must be in `tsconfig.json`'s `include`,
  linted, and its `*.test.ts` picked up by `vitest.config.ts` (today
  `src/**/*.test.ts` and `scripts/**/*.test.mjs` only).
- **Lint cap 21.** `saveLoadPanel.ts` becomes async; keep functions under
  the guardrails.

## Out of scope

- Named saves or more than six slots.
- Any other API route or feature (the intent: groundwork, saves only).
- Running the API outside Vite, LAN access, accounts.
- A browser fallback (owner's decision) and serving `dist/` without the
  API.
- Moving browser saves automatically, or deleting them after the copy
  (B8 is an explicit, read-only action).
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
- **No health probe:** without a fallback there is nothing to choose
  between; a failed request is just a failure (B6).
- **2 MB cap** (B3): a save is one
  `GameState` as JSON, far below that (the plan measures a real one).
