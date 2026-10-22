<!-- generated-by: heraklios/intent@0.1.4 -->
# §48 — After a failed save scenario, the e2e lock hooks delete the holder's files and can block the next scenarios

**Type:** fix
**Originator:** `/review` of §45, round 4, LOW finding on the e2e hooks (and its nit)
**Source:** `intents/45-save-api/review.md` → round 4 Findings and Not checked

## Problem

§45 serialises the two browser save scenarios across Playwright's two
workers with a lock folder (`acquireSaveLock` / `releaseSaveLock` in
`e2e/savesDir.ts`). The scenarios' `afterEach` hooks
(`e2e/save-import.spec.ts:35-39`, `e2e/save-load.spec.ts:36`) run the same
way whether or not this worker holds the lock. That only matters after a
first failure, but then it makes the run worse:

- if `acquireSaveLock` times out (25 s), `save-import`'s `afterEach` still
  removes `slot-5.json` and `slot-6.json`, which belong to the worker that
  does hold the lock;
- if that `rmSync` throws (EPERM on Windows), `releaseSaveLock()` never runs;
  since the takeover age `STALE_MS` (60 s) is longer than the acquire
  timeout (25 s), every save scenario starting in the next ~35–60 s fails
  with "Could not take the save-scenario lock". The review's mutants E7 and
  E8 (a missing release) showed 1 and 3 such failures, 25 s each.

Also open from the same review: in-run takeover only rescues an acquire that
starts when the lock is already more than 35 s old, so `STALE_MS` as set
barely ever helps; and during the coordinator's stress runs, one
`save-load.spec.ts:57` run failed in 100 (output not kept, the next 80
passed), cause unknown.

## Outcome

- A worker whose acquire failed touches no slot file and no lock in its
  `afterEach`; a worker that holds the lock always releases it, even when
  its cleanup throws (release in `finally`).
- `STALE_MS` and the acquire timeout are set so a leaked lock cannot fail
  the next scenarios for longer than one acquire timeout, staying above the
  30 s test timeout (or the comment says why not).
- The save scenarios stay green under
  `npx playwright test e2e/save-import.spec.ts e2e/save-load.spec.ts
  --repeat-each=10 --workers=2`, five runs in a row, with any failure's
  output kept; if the `save-load.spec.ts:57` failure recurs, its cause is
  named.

## Constraints

- Test code only: `e2e/` (and its helpers). No change to `src/`,
  `server/` or the save API; no new dependency.
- Never touch a real `saves/` folder; the e2e runs use their temp
  `SAVES_DIR` (`e2e/savesDir.ts`).
- Port 5232 is shared by worktrees (§41): a second suite refuses cleanly;
  don't kill another session's server.

## Type-specific questions

### Fix
- **What broke:** `afterEach` cleans up and releases regardless of holding
  the lock, and the release is skipped when the cleanup throws.
- **Since when:** §45 (`6d98a4b`, "cross-worker lock for the save e2e
  scenarios"), so `follows_up: 45`.
- **Impact:** only after a first failure (a red run gets redder, never a
  green run red); no game or save affected.
- **Reproduction:** make `acquireSaveLock` time out (hold the lock folder
  from another process for 30 s) while `save-import` runs on two workers:
  the holder's slot files vanish; or make the cleanup throw before
  `releaseSaveLock()` (the review's E7/E8 mutants): the next save scenarios
  fail on the lock.
- **The test that will fail first:** the plan settles it. A candidate: a
  vitest case for a `withSaveLockHeld(cleanup)` helper in
  `e2e/savesDir.ts` (cleanup throws → lock released; not held → cleanup not
  run), if vitest can include that file; otherwise a recorded failing
  stress run with the review's E8 mutant.

## Assumptions I made

- **Type is fix**, not adjustment: it changes test behaviour and should
  carry a test of the helper.
- **The `save-load.spec.ts:57` failure is folded in** as an investigation
  item rather than its own intent: it was seen once in 100, and the stress
  runs this fix needs anyway are where it would show again.
- **The no-gap PUT-PUT-DELETE ordering** (also in §45's round 4 Not
  checked) is left out: it is by design, since concurrent HTTP requests on
  separate connections have no defined order and the game never sends them
  that way.
