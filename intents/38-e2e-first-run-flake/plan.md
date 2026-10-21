<!-- generated-by: heraklios/intent@0.1.2 -->
# §38 plan — The first e2e run after a cold start fails one scenario

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Find the cause with a reproduction that fails on demand, fix it without
retries, and make any future e2e failure name its scenario the first
time (intent → Outcome).

## What the coordinator already tried (2026-10-21, main at `259fee1`)

- **Cold Vite cache** (`node_modules/.vite` deleted, then `npm run e2e`):
  7/7 passed. The intent's leading hypothesis is **not** reproduced by
  this alone.
- **`npm run verify` then `npm run e2e`**, twice: 7/7 both times.

## Leading hypothesis now: the test reads state before the click lands

`e2e/save-load.spec.ts:55-60` clicks **Load**, then waits for
`scenes()` to include `'Board'` and for `idle()`, then compares the state.
But the load is **in place** (`BoardScene.loadInPlace`,
`BoardScene.ts:957-968`, called from `SaveLoadPanel.loadFrom`,
`saveLoadPanel.ts:230-238`): the Board is already active and already
idle *before* the click is handled. Phaser handles a pointer event in its
game loop, so on a slow frame both waits pass at once and `state()`
returns the position from before the load, which is exactly the failing
assertion ("the loaded game equals the one saved"). A cold first run is
the slowest run (51 s once), which would explain why only first runs
fail. The same pattern may affect `clickButton('Save')` →
`clickButton('Close')` → `waitIdle` earlier in the scenario.

## Risks

- **Fixing a guess.** No fix lands until a reproduction fails on demand
  without it (subtask 2). If none does within the budget, stop: ship
  subtask 1 (capture) only, record what was tried in Progress, and come
  back for re-approval.
- **A wait that waits for the assertion itself.** The new wait must look
  for *a change* (the state moving off the pre-click position), not for
  equality with the saved state, or the test can't fail any more.
- **Retries.** Not allowed (intent → Constraints).
- **Slowing the suite.** The capture settings must cost nothing on a pass
  (`retain-on-failure`, not `on`).

## Verified against the codebase

Re-read on `main` at `259fee1`:

- `e2e/save-load.spec.ts:40-63` — the scenario; `:13-16` `withoutClock`;
  `:47-50` Save → Close → `waitIdle`; `:55-60` Load → `scenes()` →
  `waitIdle` → assertion.
- `src/scenes/BoardScene.ts:957-968` `loadInPlace` (synchronous on the
  click); `src/ui/saveLoadPanel.ts:230-238` `loadFrom` → `onLoad`.
- `e2e/helpers.ts` `clickButton` (`page.mouse` click at the hook's
  canvas point), `waitIdle`, `state`.
- `playwright.config.ts`: no `trace`, no `retries`, default reporter;
  `timeout: 30_000`.
- The machine has 20 logical CPUs; the reviews' failing runs happened
  while other sessions were busy.

## Subtasks

1. **Capture (intent outcome 3).** `playwright.config.ts`: `trace:
   'retain-on-failure'` and the `line` reporter alongside the default, so
   a failure prints scenario + assertion and keeps a trace under
   `test-results/`. One commit.
2. **Reproduce.** A throwaway spec (not committed, or committed skipped
   with a comment, the implementer's call recorded in Progress) that runs
   `save-load` with Chromium CPU throttling (CDP
   `Emulation.setCPUThrottlingRate`, rate 4–10) under `--repeat-each=10`.
   It must fail at least once on today's code. If it doesn't, try the
   Save → Close step and one more cause (a fresh `npm ci` worktree's first
   run), then stop per Risks.
3. **Fix the wait** in `save-load.spec.ts` (and the Save step if 2 showed
   it): after clicking Load, wait until the state's units differ from the
   pre-click units, then `waitIdle`. If a helper fits more than one
   scenario (e.g. `clickAndWaitForChange`), put it in `helpers.ts` and use
   it where the same pattern appears. Reproduction from 2 now passes
   10/10. One commit, with the failing-first run in Progress.
4. **Sweep the other scenarios** for the same pattern (click, then a wait
   that was already true before the click) and fix each the same way, or
   record why it can't race.
5. **Hand-over.** `npm run e2e` from a freshly spawned worktree as its
   first run, 3 times (3 fresh spawns or `node_modules/.vite` + browser
   cache cleared); the throttled reproduction 10/10; `verify`,
   `check:intent`; Progress; `status: in-review`. Set `follows_up: 32` if
   the cause is in §32's scenario code.

## Tests

- The throttled reproduction fails before subtask 3 and passes 10/10
  after (the failing-first test).
- Mutant for the fix: remove the new wait → the throttled run fails
  again.
- The full suite keeps passing (7 tests, 5 files).

## Validation

- `npm run verify` green, lint ≤ 21 (the e2e folder is linted).
- `npm run check:intent` PASS.
- `npm run e2e` first run in a fresh worktree passes, 3 times.
- No live check owed by path (`e2e/**`, `playwright.config.ts` is build
  config, not in rule 1's list); if `vite.config.ts` ends up changed, one
  is owed.

## Assumptions I made

- CPU throttling is a fair stand-in for a slow cold first run. If the
  reproduction needs it, the fix makes the scenario robust to slow frames,
  which is the property the suite needs.
- The capture settings (subtask 1) stay even if the cause is never found.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-21 — subtask 1 shipped; subtasks 2–5 stopped per Risks

- **Subtask 1 (capture):** `playwright.config.ts` now has
  `reporter: [['list'], ['line']]` and `trace: 'retain-on-failure'`.
- **Subtask 2 (reproduce), not reproduced.** Temporary CDP
  `Emulation.setCPUThrottlingRate` after `page.goto` in `startFromMenu`
  (since reverted, not committed), `save-load` only, `--repeat-each=10`:
  - rate 4, 1 worker: **10/10 passed**, none of them fail at the Load assertion.
  - rate 8, 1 worker: 9 of 10 failed, but all on the 30 s test timeout
    (`page.evaluate` / `mouse.click` / `locator.boundingBox` at
    `save-load.spec.ts:52-56`) plus one `No canvas on the page`, i.e. a
    too-slow run, not the "state read before the click lands" assertion
    failure of the hypothesis.
  - rate 4 with 10 parallel workers failed 10/10 in `startFromMenu`
    (helpers.ts:50): contention, not the race.
  The "state read before the load lands" hypothesis is therefore **not
  confirmed**; the Vite cold-cache hypothesis was already not reproduced
  by the coordinator. Throttling at rates where the test finishes does
  not fail it, and where it fails it fails by timeout.
- Not tried yet: the fresh-`npm ci`-worktree first run (plan subtask 2's
  last fallback), and the `No canvas on the page` at rate 8, which hints
  at a page reload/navigation mid-test and may be worth a trace.
- No fix landed (nothing reproduces). Status stays `accepted`; plan needs
  the owner's call on how to proceed (fresh-spawn first-run attempts, or
  accept the capture alone and wait for the next red run's trace).

### 2026-10-21 (later) — fresh-state first runs, then capture-only

- Rebased on `main` after §39; `verify` green (44 files, 692 tests).
- **Fresh-state first run, 3 rounds:** each round removed
  `node_modules/.vite` and `test-results`, ran `npm run verify`, then
  `npm run e2e` straight after (the review sequence). 7/7 passed all three
  times (22.0 s, 24.0 s, 23.6 s). Not reproduced. A real `/spawn` (fresh
  `npm ci`, cold browser/disk caches) is the coordinator's and was not run.
- **Outcome:** the capture setting stays as the deliverable. The next red
  `npm run e2e` will print its scenario and assertion and leave a trace in
  `test-results/`; the review should keep that output. The cause remains
  unknown, so the intent's "cause found and written down" outcome is open.

### 2026-10-21 (closing) — closed on the capture alone, on the owner's call

Owner: "close on capture alone". Delivered: intent outcome 3 only (a failing
scenario names itself and keeps a trace). Outcomes 1 and 2 (cause found,
first-run fix) are **not met**: nothing reproduced. For `/review`: judge
this as a partial close; the next red `npm run e2e` must be diagnosed from
its trace, not rerun until green. `status: in-review`.
