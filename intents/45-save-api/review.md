<!-- generated-by: heraklios/review@0.1.4 -->
# §45 review — Games are saved as files on this PC, reached by the game through a local API

verdict: rework
tier: reviewed
reviewed-commit: bf15e0f
round: 3
sampled: no
live-check: owed

Tier set by inputs 1 and 2 (save path; `review_tier: reviewed`). Passes run
by the `heraklios-reviewer` agent; results the coordinator re-ran are
marked. Round 2's M1 is fixed and proved: one store per plugin, every queue
and retry mutant killed (all six round-2 survivors included), concurrent
writes all succeed and land in order live. One finding needs rework, an e2e
isolation defect older than this rework (the e2e files are unchanged since
`53cf09f`) that fails the plan's own AC3 command: two copies of one save
scenario on the two workers delete each other's slot files. Three LOWs.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — AC3 ("new scenarios run 3×") not reliable (M1) |
| 2 | Type check | FAIL on the owed live check only (the owner's) |
| 3 | Rulebook fidelity | not run — digital-only |
| 4 | Tests prove the rule, not only pass | findings (2) — e2e repeats collide (M1); retry wiring/budget survivors (L2) |
| 5 | Engine/presentation boundary and conventions | pass — engine untouched, `SAVE_VERSION` 3, panel and BoardScene wiring only |
| 6 | Numbers in prose | pass — 51 files / 827 tests / lint 21, "under 0.9 s" (max 868 ms), Progress mutant counts re-derived |
| 7 | Documentation | findings (1) — `README.md:164` (L3); nit CLAUDE.md |
| 8 | Guardrails and hygiene | pass — lint 21/21, cap unchanged, no new dependency, UTF-8 clean on 29 files |
| 9 | Repository-specific footguns | pass |

## Type check
```
type-check: FAIL (intent 45, feature)
  error: A live check is owed and not recorded. Do the steps in intents/45-save-api/review.md → ## Live check, then set live_checked: <date> in intents/45-save-api/metadata.yml.
  note:  26 file(s), 1999 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **MEDIUM** (M1) `e2e/save-import.spec.ts:29-36`, `:44-49`;
  `e2e/save-load.spec.ts:32` — parallel repeats of one scenario collide on
  the shared slot files. All workers share one server and one `SAVES_DIR`;
  with `--repeat-each` Playwright runs two copies of a scenario at once, and
  each copy's `beforeEach`/`afterEach` `rmSync` deletes the other's
  `slot-5.json`/`slot-6.json` (and one copy's copy into slot 5 makes the
  other's "the copy is offered" false). Reviewer: the AC3 command failed
  2 of 6 on the first run; `save-import --repeat-each=10 --workers=2` 11
  of 30 over three runs; `--workers=1` 20 of 20. Coordinator re-ran:
  `--workers=2` 6 failed / 4 passed, `--workers=1` 10/10. Plain `npm run
  e2e` (one run each) passes. Needs rework: serialise the save scenarios
  across workers (e.g. a lock in `e2e/savesDir.ts` — exclusive `mkdirSync`
  of a lock folder in `SAVES_DIR`, retried until free, taken in
  `beforeEach`, released in `afterEach`; no new dependency), or give each
  copy its own slots; then AC3 3× and a `--repeat-each=10 --workers=2`
  stress of `save-import`.
- **LOW** (L1) `server/fileSaveFs.ts:90-92` — `remove` bypasses the slot's
  write queue: a DELETE 3 ms after two PUTs to slot 4 answered 204, but the
  file was back in 17 of 30 trials. In play only the autosave PUT is
  unawaited (`BoardScene.ts:991`). Worth a look: chain `remove` on `queues`
  like `write`, with a PUT-then-DELETE test.
- **LOW** (L2) `server/fileSaveFs.ts:111`, `:48`, `:42` — retry proven in
  isolation, but not its use in the write path nor its budget: `writeOnce`
  calling `rename` instead of `renameOver` survived 4 of 6 runs;
  `RENAME_ATTEMPTS = 4` survives; an instant `realOps.sleep` survives.
  Worth a look: a spy rename throwing EPERM once inside `fs.write`; a test
  that `renameOver` succeeds after `RENAME_ATTEMPTS - 1` transient errors.
- **LOW** (L3) `README.md:164` — the rewrap starts a line with `- nothing
  was saved";`, which CommonMark renders as a bullet; it also quotes "-"
  where `en.ts:316` has "—". Worth a look: use "—" and rewrap.
- Nit: `CLAUDE.md`'s `server/` entry names the Origin check but not the
  Host allow-list now checked first.

## Not checked
- The panel's copy-stopped ordering (round 2 L1 fix): reverting it (U1)
  passes all 827 tests; presentation code, live-check step 7.
- The game in a real browser beyond e2e: layout, French, a stopped server
  with the tab open — the live check.
- What `save-load`'s single failure in the reviewer's first AC3 run was
  (output cut off, 70 reruns clean); the shared-folder pattern is likely,
  not established.
- A request body aborted mid-upload.
- `npm run preview` on the stable checkout.
- Real antivirus locks; Chrome's own local-network protections.
- R13 (dropping the `!code` guard) is equivalent, not counted.

## Live check
- owed: rule 1 (`src/ui/**`, `BoardScene.ts`, `vite.config.ts`); new and
  visual. After the rework.
- steps, in `C:/Users/eric/src/heraklios-wt/45-save-api`:
  1. `npm run dev -- --port 5245 --strictPort --host 127.0.0.1` → open
     `http://127.0.0.1:5245` → **Test mode** → **💾 Save / Load**:
     "Loading…" then the rows → Save to slot 2: "Saved to slot 2." and
     `saves/slot-2.json` exists, readable JSON.
  2. Stop and restart the server, reload, Test mode, panel → Load slot 2 →
     the same position.
  3. Tab open, stop the server → Save: "The game server isn't answering —
     nothing was saved."; **Export to file** still downloads; play on to
     the next movement phase: the log shows "Autosave failed: the game
     server isn't answering."
  4. Restart, reload; devtools: `localStorage.setItem('heraklios.save.slot3',
     <contents of saves/slot-2.json>)` with no `slot-3.json` → panel →
     **Copy browser saves to files** → "Browser saves copied to files: 1,
     skipped: 0.", the button goes, `slot-3.json` exists, the key unchanged
     → Load slot 3.
  5. The same offer from the Menu's **Load a game**.
  6. French: the panel and its messages.
  7. Round 2's L1 fix (no test covers it): seed two or three browser slots
     (`heraklios.save.slot4`, `slot5`…) whose file slots are empty, click
     Copy and stop the server at once (a race; retry a few times) → "Browser
     saves copied to files: N, then the game server stopped answering."
     stays in the panel, on the Board and from the Menu, not replaced by
     "The game server isn't answering." If the race can't be hit, say so.
  8. Optional: `http://localhost:5245` works too; a LAN address gets no
     save API (deliberate).
  9. Once on stable: `bash scripts/update-stable.sh`, `npm run preview`
     there → save and load a slot → the file in that checkout's `saves/`.
  10. Delete the worktree's `saves/` afterwards if not wanted.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `bf15e0f`, worktree clean; read
  `e2e/save-import.spec.ts:25-62` (shared slot files removed in
  `beforeEach`/`afterEach`), `server/fileSaveFs.ts:84-92` (`remove` outside
  the queue), `README.md:160-166`; `npx playwright test
  e2e/save-import.spec.ts --repeat-each=10 --workers=2` → 6 failed, 4
  passed; the same with `--workers=1` → 10 passed; `git status --short`
  clean, no `saves/` afterwards.
- Reviewer agent: `npm run verify` → 51 files, 827 passed, lint 21/21;
  `npm run check:intent` → FAIL on the live check only; `npm run e2e` → 10
  passed; the two save scenarios `--repeat-each=3` over six runs → 2
  failed, then 6/6, 6/6, 1 failed, 6/6, 6/6; stress runs as in M1; 26
  mutants with the full suite (plugin P1–P3, queue Q1–Q4, temp name T1,
  retry R1–R10, R12 killed; R11, W1, W2, U1 survive, R13 equivalent; all
  six round-2 survivors killed), files restored, status clean; live on its
  own dev (5291) and preview (5293) servers with a temp
  `HERAKLIOS_SAVES_DIR`: 20 × 8 concurrent PUTs → 160 × 204; 30 ordering
  trials → last save on disk every time (round 2: 6/30 wrong); two
  processes 960 × 204 (round 2: 1 × 500 in 320); attacker Host → 403; the
  PUT-PUT-DELETE probe (L1); servers stopped by their own PIDs, temp
  folder removed; `git merge-tree` with `main` clean; UTF-8 on 29 files.
- Taken on trust: the implementer's first-survival of the shared-temp-name
  mutant; round 1's save sizes; Chrome's protections; antivirus behaviour.

# Round 2 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: 53cf09f
- round: 2
- sampled: no
- live-check: owed

Resolutions (round 3, all in `bf15e0f`):
- MEDIUM M1 queue not in effect: **fixed** (one store per plugin, built
  after `configResolved`; concurrent-PUT, rejected-write and `renameOver`
  tests; P1–P3, Q1–Q4 and all six survivors killed; live 160/160, 0/30 out
  of order).
- LOW L1 copy-stopped message: **fixed in code**, untestable by unit
  (U1 survives) — live-check step 7.
- LOW two processes: **fixed** (8 attempts, 25n ms + jitter, ≤868 ms; live
  960/960).
- Nits: brace **fixed**; `README.md:164` rewrapped but now renders as a
  bullet (round 3 L3).

# Round 1 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: b45d85c
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2, all in `53cf09f`):
- MEDIUM M1 DNS rebinding: **fixed** (Host allow-list first; live probes on
  dev and preview; six mutants killed).
- MEDIUM M2 concurrent writes: **outcome holds, design defective** — no
  500s live, but only through the untested retry (round 2 M1).
- MEDIUM M3 adapter untested: **fixed** (15 tests; P1–P6 killed).
- MEDIUM M4 vacuous e2e wait: **fixed** (delay passes, no-save fails).
- LOWs (scheme, cap boundary, health 405, invalid read, README:157):
  **fixed**; partial-copy message: **code fixed, UI defect** (round 2 L1).

Tier set by input 1 (`src/ui/saveStorage.ts`, Reviewed) and input 2
(`review_tier: reviewed`). Passes run by the `heraklios-reviewer` agent;
results the coordinator re-ran are marked. Every gate is green; the pure
handler and the client prove their rules (all of AC1's and AC2's required
mutants killed). Four findings need rework: the Origin check (B4) is
bypassed by DNS rebinding because the plugin runs before Vite's own host
check; concurrent writes to one slot fail; the plugin adapter has no
tests; and the e2e wait for the saved file proves nothing.

### Passes
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

### Type check
```
type-check: PASS (intent 45, feature)
  note:  24 file(s), 1407 line(s) changed outside intents/.
```

### Findings
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

### Not checked
- The game in a real browser beyond e2e: a stopped server with the tab
  open, the panel's layout — the live check.
- `npm run preview` (stable) not run by the review; nothing tests the
  preview registration (M3).
- A request body aborted mid-upload: whether `readBody` settles.
- Windows `rename` EPERM under antivirus or another open handle.
- Whether Chrome's local-network-access protections would stop a real
  rebinding attack (simulated with Host headers only).
- The save sizes in Progress (2907 B, 2124 B).

### Live check
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

### Verified myself vs. taken on trust
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
