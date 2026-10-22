<!-- generated-by: heraklios/review@0.1.4 -->
# §45 review — Games are saved as files on this PC, reached by the game through a local API

verdict: escalate
tier: reviewed
reviewed-commit: 065ad3b
round: 4
sampled: no
live-check: owed

Tier set by inputs 1 and 2 (save path; `review_tier: reviewed`). Passes run
by the `heraklios-reviewer` agent; results the coordinator re-ran are
marked. Every round-3 finding is fixed and proved: the cross-worker lock
serialises the save scenarios (AC3 3/3 runs, stress 60/60, mixed 20/20;
no-op and instant-takeover lock mutants fail 6 of 10; longest hold 5.1 s;
never left behind), `remove` goes through the slot queue, and round 3's
three retry survivors are killed. No finding needs rework; one LOW asks to
harden the e2e hooks after a failure. Next: the owner reads the diff, does
the live check, then merges.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — AC3 holds; nothing beyond round 3's findings |
| 2 | Type check | FAIL on the owed live check only (the owner's) |
| 3 | Rulebook fidelity | not run — digital-only |
| 4 | Tests prove the rule, not only pass | findings (1 LOW) — every rework mutant a green run can reach is killed; failure-only paths (E3, E4, E6) probed directly |
| 5 | Engine/presentation boundary and conventions | pass — engine untouched, `SAVE_VERSION` 3, `src/` unchanged since `bf15e0f` |
| 6 | Numbers in prose | pass — 51 files, 830 tests, lint 21; "at least 40 ms"; `RENAME_ATTEMPTS` 8 |
| 7 | Documentation | pass — README "—" fixed; CLAUDE.md Host allow-list named |
| 8 | Guardrails and hygiene | pass — lint 21/21, cap unchanged, no dependency, UTF-8 clean on 29 files |
| 9 | Repository-specific footguns | pass |

## Type check
```
type-check: FAIL (intent 45, feature)
  error: A live check is owed and not recorded. Do the steps in intents/45-save-api/review.md → ## Live check, then set live_checked: <date> in intents/45-save-api/metadata.yml.
  note:  26 file(s), 2098 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **LOW** `e2e/save-import.spec.ts:35-39`, `e2e/save-load.spec.ts:36` — the
  `afterEach` hooks don't depend on holding the lock; this matters only
  after an earlier failure (a red run gets redder, a green run never turns
  red). A failed 25 s acquire still runs `save-import`'s `rmSync` of the
  holder's `slot-5.json`/`slot-6.json`; and if that `rmSync` throws (EPERM),
  `releaseSaveLock()` never runs, and since `STALE_MS` (60 s) exceeds the
  acquire timeout (25 s), every save scenario starting in the next ~35–60 s
  fails with "Could not take the save-scenario lock" (E7, E8: 1 and 3
  failures, 25 s each). Worth a look: clean up only when the lock is held,
  release in `finally` (e.g. a `withSaveLockHeld(cleanup)` helper in
  `e2e/savesDir.ts`).
- Nit: in-run takeover only rescues an acquire starting when the lock is
  already >35 s old; a crashed run's lock is cleared by global setup.
  Either set `STALE_MS` below the acquire timeout (above the 30 s test
  timeout) or say why in the comment.
- Coordinator observation (not a finding yet): in five stress runs of both
  save scenarios (`--repeat-each=10 --workers=2`, 100 tests), one
  `save-load.spec.ts:57` test failed in the first run; its output wasn't
  captured, and the next 80 passed. Cause unknown.

## Not checked
- **PUT-PUT-DELETE with no gap** (by design, not a finding): with a 3 ms
  gap no file is left in 30 trials; sent at the same instant the file stays
  30 of 30, because a request reaches the store only after its body is read
  (`saveApiPlugin.ts:53`), so a body-less DELETE overtakes PUT bodies still
  arriving. Concurrent requests on separate connections have no defined
  order, and the game never sends them so (one panel action at a time; only
  the autosave PUT is unawaited).
- Lock paths that run only after a failure have no automated test (probed
  directly: release by a non-holder leaves the lock; a 61 s-old lock taken
  over in 58 ms; teardown clears a leaked lock). Known weakness, unreachable
  under the 30 s test timeout: after a takeover, the original holder's
  release removes the new holder's lock.
- A Playwright test timing out while holding the lock (relied on
  `afterEach` running after a timeout).
- The `save-load` failure in the coordinator's first stress run (above).
- U1, the panel's copy-stopped message order — live-check step 7.
- The game in a real browser beyond e2e (layout, French, a stopped server
  with the tab open) — the live check.
- A request body aborted mid-upload; `npm run preview` on the stable
  checkout; antivirus locks; Chrome's local-network protections.
- R13 is equivalent, not counted.

## Live check
- owed: rule 1 (`src/ui/**`, `BoardScene.ts`, `vite.config.ts`); new and
  visual, so the smoke suite can't stand in. Nothing user-facing changed
  this round; the steps are round 3's.
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
  4. Restart, reload; with no `slot-3.json`, in devtools
     `localStorage.setItem('heraklios.save.slot3', <contents of
     saves/slot-2.json>)` → panel → **Copy browser saves to files** →
     "Browser saves copied to files: 1, skipped: 0.", the button goes,
     `slot-3.json` exists, the key unchanged → Load slot 3.
  5. The same offer from the Menu's **Load a game**.
  6. French: the panel and its messages.
  7. Round 2's L1 fix (no test covers it): seed two or three browser slots
     (`heraklios.save.slot4`, `slot5`…) whose file slots are empty, click
     Copy and stop the server at once (a race; retry a few times) →
     "Browser saves copied to files: N, then the game server stopped
     answering." stays in the panel, on the Board and from the Menu, not
     replaced by "The game server isn't answering." If the race can't be
     hit, say so.
  8. Optional: `http://localhost:5245` works too; a LAN address gets no
     save API (deliberate).
  9. Once on stable: `bash scripts/update-stable.sh`, `npm run preview`
     there → save and load a slot → the file in that checkout's `saves/`.
  10. Delete the worktree's `saves/` afterwards if not wanted.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `065ad3b`, worktree clean; `npm run
  check:intent` → FAIL on the live check only; `npx playwright test
  e2e/save-import.spec.ts e2e/save-load.spec.ts --repeat-each=10
  --workers=2` five times → 19 passed / 1 failed (`save-load.spec.ts:57`,
  output not kept), then 20/20 four times; `git status --short` clean, no
  `saves/` or lock left.
- Reviewer agent: `npm run verify` → 51 files, 830 passed, lint 21/21;
  `npm run e2e` → 10/10; AC3 3 runs → 6/6 each; `save-import` and
  `save-load` stress 3 runs each → 10/10; mixed `--repeat-each=5` 2 runs →
  10/10; a lock watcher sampling every 20 ms (longest hold 5,059 ms,
  acquire timeout never fired, lock never left); server mutants with the
  full suite (remove outside the queue, `writeOnce` plain `rename`,
  `RENAME_ATTEMPTS = 4`, instant sleep, enqueue without `.catch`, queue not
  stored, write bypassing the queue — all killed; the timing ones 8 of 8;
  the unmutated file 30/30); e2e mutants (no-op lock 6/10 failed, instant
  takeover 6/10, setup not clearing killed with a planted lock, missing
  releases 1 and 3 failures; release by anyone, no takeover, teardown not
  clearing survive green runs — probed directly); live on its own Vite
  (127.0.0.1:5291, temp `HERAKLIOS_SAVES_DIR`): 160 × 204, last save on
  disk 20/20, PUT-PUT-DELETE (3 ms) 0/30 left (round 3: 17/30), no gap
  30/30 left, foreign Host/Origin/rebinding → 403; servers stopped by their
  own PIDs, temp folders removed; `git merge-tree` with `main` clean;
  UTF-8 on 29 files.
- Taken on trust: rounds 1–3's passes over the unchanged `src/` code (re-
  checked unchanged and green); Playwright running `afterEach` after a
  timeout; antivirus and Chrome behaviour.

# Round 3 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: bf15e0f
- round: 3
- sampled: no
- live-check: owed

Resolutions (round 4, in `6d98a4b`, `065ad3b`):
- MEDIUM M1 e2e save scenarios collide: **fixed** (cross-worker lock; AC3
  3/3, stress 60/60, mixed 20/20; lock mutants fail 6/10); hook hardening
  after a failure is round 4's LOW.
- LOW L1 `remove` outside the queue: **fixed** (killed 8/8; live 0/30 with
  a 3 ms gap); a DELETE at the same instant stays unordered by design.
- LOW L2 retry not pinned: **fixed** (R11, W1, W2 killed).
- LOW L3 README bullet: **fixed**. Nit CLAUDE.md: **fixed**.

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
