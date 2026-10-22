<!-- generated-by: heraklios/review@0.1.4 -->
# §45 review — Games are saved as files on this PC, reached by the game through a local API

verdict: rework
tier: reviewed
reviewed-commit: b45d85c
round: 1
sampled: no
live-check: owed

Tier set by input 1 (`src/ui/saveStorage.ts`, Reviewed) and input 2
(`review_tier: reviewed`). Passes run by the `heraklios-reviewer` agent;
results the coordinator re-ran are marked. Every gate is green; the pure
handler and the client prove their rules (all of AC1's and AC2's required
mutants killed). Four findings need rework: the Origin check (B4) is
bypassed by DNS rebinding because the plugin runs before Vite's own host
check; concurrent writes to one slot fail; the plugin adapter has no
tests; and the e2e wait for the saved file proves nothing.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — B4's purpose isn't met under DNS rebinding (M1); otherwise B1–B11, divergences recorded |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — digital-only |
| 4 | Tests prove the rule, not only pass | findings (3) — adapter untested (M3), vacuous e2e wait (M4), file-layer atomicity untested; small survivors (LOWs) |
| 5 | Engine/presentation boundary and conventions | pass — engine untouched, `SAVE_VERSION` 3, load still clears history |
| 6 | Numbers in prose | pass (save sizes taken on trust) |
| 7 | Documentation | findings (1) — `README.md:157` (L6) |
| 8 | Guardrails and hygiene | pass — lint 21/21, no dependency, UTF-8 clean |
| 9 | Repository-specific footguns | pass |

## Type check
```
type-check: PASS (intent 45, feature)
  note:  24 file(s), 1407 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** (M1) `server/saveApiPlugin.ts:83`, `:86`; `server/saveApi.ts:63-70`
  — **DNS rebinding bypasses B4.** The middleware is added inside
  `configureServer` / `configurePreviewServer`, which in Vite 6.4.3 run
  before Vite installs its host check, so `/api/*` never meets
  `allowedHosts`. `foreignOrigin` compares the Origin with the request's own
  Host; a rebinding page sends both as `attacker.example:<port>`, and
  same-origin GETs carry no Origin at all. Reproduced by the coordinator
  (below): `GET /` with `Host: attacker.example` → 403 from Vite, `GET
  /api/saves` with the same Host → **200**. The reviewer also got `PUT` →
  204 and `DELETE` → 204 that way. A malicious site could read, overwrite
  or delete saves (valid saves only, no path traversal). Needs rework: a
  Host allow-list in `handleSaveApi` (`localhost`, `127.0.0.1`, `[::1]`,
  any port, or Vite's `allowedHosts`) answering 403 otherwise, with tests;
  correct `README.md:157`.
- **MEDIUM** (M2) `server/fileSaveFs.ts:46` — concurrent writes to one slot
  share a temp name (`<file>.<pid>.tmp`): 20 rounds × 8 concurrent PUTs to
  `/api/saves/autosave` gave 82 × 204 and **78 × 500** (reviewer's
  measurement). A 500 shows as "The game server isn't answering";
  back-to-back autosaves on fast AI turns (`BoardScene.ts:2860`,
  fire-and-forget) or two tabs can hit it. Needs rework: a unique temp
  name per write (`randomUUID()` or pid + counter) and a concurrent-write
  test.
- **MEDIUM** (M3) `server/saveApiPlugin.ts` — **the adapter has no
  tests**: removing the streaming cap, not forwarding `origin` (which
  switches B4 off entirely, and survives e2e too), not forwarding
  `bodyTooLarge`, dropping `Cache-Control`, or not registering the preview
  server all pass `npm run verify`. Needs rework: a test of
  `saveApiMiddleware` with a fake request (a Readable plus headers) and
  response: Origin and Host forwarded (foreign → 403), a body over the cap
  → 413 with the buffer bounded, an fs error → 500, `Cache-Control:
  no-store`, a non-`/api/` URL → `next()`; and the preview registration.
- **MEDIUM** (M4) `e2e/save-load.spec.ts:58`, `e2e/save-import.spec.ts:44`
  — the wait for the save is vacuous: `buttonCount('Load') > 0` is already
  true from the autosave row. A 1.5 s delay inserted before the write
  makes the AC4 file read fail with ENOENT; a real wait would pass. A
  latent flake of the §38/§41 kind, and under `--repeat-each` it can read
  the previous run's file. Needs rework: wait on the slot's own row (a
  Load at `savePoint.y`) or `expect.poll` on the file; delete
  `slot-1.json` before each test.
- **LOW** `server/saveApi.ts:66` — the scheme isn't compared
  (`https://127.0.0.1:<port>` accepted for an http server); a
  prefix-compare mutant survives. Worth a look: compare `new
  URL(origin).origin` with `http://${host}`.
- **LOW** `server/saveApi.ts:81` — the 2 MB boundary is untested (`>` →
  `>=` survives; the live server is correct at 2 MiB / 2 MiB + 1). Worth a
  look.
- **LOW** `server/saveApi.ts:124` — the health route's 405 is untested.
  Worth a look.
- **LOW** `src/ui/saveStorage.ts:218`, `src/ui/saveLoadPanel.ts:382` — a
  write failing partway through the copy reports "nothing was saved"
  though earlier slots were copied. Worth a look.
- **LOW** `src/ui/saveStorage.ts:103` — an invalid file read reported as
  "empty" vs "server down" is untested. Worth a look.
- **LOW** (L6) `README.md:157` — "refuses requests from another website's
  page" isn't true until M1 is fixed.

## Not checked
- The game in a real browser beyond e2e: a stopped server with the tab
  open, the panel's layout — the live check.
- `npm run preview` (stable) not run by the review; nothing tests the
  preview registration (M3).
- A request body aborted mid-upload: whether `readBody` settles.
- Windows `rename` EPERM under antivirus or another open handle.
- Whether Chrome's local-network-access protections would stop a real
  rebinding attack (simulated with Host headers only).
- The save sizes in Progress (2907 B, 2124 B).

## Live check
- owed: rule 1 (`src/ui/**`, `src/scenes/BoardScene.ts`, `vite.config.ts`);
  new and visual, so the smoke suite can't stand in. After the rework.
- steps, in `C:/Users/eric/src/heraklios-wt/45-save-api`:
  1. `npm run dev -- --port 5245 --strictPort --host 127.0.0.1` → open
     `http://127.0.0.1:5245` → **Test mode** → **💾 Save / Load**: "Loading…"
     then the rows → Save on slot 2: "Saved to slot 2." and
     `saves/slot-2.json` exists, readable JSON.
  2. Stop and restart the dev server, reload, Test mode, panel → Load slot
     2 → the same position.
  3. Tab open, stop the server → Save: "The game server isn't answering —
     nothing was saved."; **Export to file** still downloads; play on to the
     next movement phase: the log shows "Autosave failed: the game server
     isn't answering."
  4. Restart, reload; in devtools
     `localStorage.setItem('heraklios.save.slot3', <contents of
     saves/slot-2.json>)`, no `slot-3.json` → open the panel → **Copy
     browser saves to files** → "copied: 1, skipped: 0", the button goes,
     `saves/slot-3.json` exists, the `localStorage` key is unchanged → Load
     slot 3.
  5. The same offer from the Menu's **Load a game** (load mode).
  6. French: the panel and its messages in French.
  7. Once on stable: `bash scripts/update-stable.sh`, `npm run preview`
     there → save and load a slot → the file in that checkout's `saves/`.
  8. Delete the worktree's `saves/` afterwards if not wanted.
- you should see: files appear and go as you save and delete, loads
  restore the position, a stopped server gives the messages above (never
  a silent failure), the import copies only into empty slots and never
  changes the browser's copy.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `b45d85c`, worktree clean; `npm run
  check:intent` → PASS; a throwaway dev server on port 5292 with
  `HERAKLIOS_SAVES_DIR` in a temp folder: `GET /` with `Host:
  attacker.example:5292` → **403** (Vite), `GET /api/saves` with the same
  Host → **200**, `Origin: http://evil.example` → 403; server stopped,
  temp folder removed, no `saves/` in the worktree.
- Reviewer agent (not re-run by the coordinator): `npm run verify` — 49
  files, 776 passed, lint 21/21; `npm run e2e` 10 passed, the two save
  scenarios `--repeat-each=3` 6 passed, temp folder removed; 44 vitest
  mutants (AC1's four and AC2's three all killed; survivors listed in
  Findings) and the e2e delay mutant; live curl probes on its own server
  (slot allow-list: 15 hostile slot names → 404, query strings stripped,
  methods → 405, invalid body → 400 and nothing written, foreign and
  `null` Origin → 403, body cap enforced while streaming, the rebinding
  PUT/DELETE, the concurrent-write measurement); `git merge-tree` with
  `main` clean; UTF-8 on all 26 changed files; engine and data untouched.
- Taken on trust: the implementer's manual check of `vite preview`; the
  save sizes.
