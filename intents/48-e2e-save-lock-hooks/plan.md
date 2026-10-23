<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §48 plan — After a failed save scenario, the e2e lock hooks delete the holder's files and can block the next scenarios

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

The save-scenario lock in `e2e/savesDir.ts` gets one hook-side entry point,
`withSaveLockHeld(cleanup)`: it runs `cleanup` only when this worker holds
the lock and releases the lock in `finally`. Both save scenarios' `afterEach`
use it, so a worker whose acquire timed out touches nothing, and a holder
whose cleanup throws still releases. `STALE_MS` drops from 60 s to 35 s, so
a leaked lock fails the next scenarios for at most 10 s (less than one 25 s
acquire timeout) while staying above the 30 s test timeout. The lock records
its owner, so a holder that lost its lock to a takeover can't remove the new
holder's lock. The lock logic gets vitest tests for the first time, on a
temporary lock path. Five stress runs with their output kept settle the
1-in-100 `save-load.spec.ts:57` failure, or name its cause.

## Risks

- **Tests that pass whatever the code does.** The hooks in the spec files
  have no unit test. The helper does, and each behaviour line below names
  the mutant that must fail. The hook wiring is proved by an e2e probe that
  is red before and green after (subtask 4).
- **A unit test that meets a real e2e run.** Every vitest case uses its own
  temporary lock path, never `SAVE_LOCK` (`heraklios-e2e-saves-5232.lock`).
  Otherwise `npm test` in one worktree would block or take over another
  worktree's e2e run. Global setup clears that path on every run (§41: all
  worktrees share port 5232).
- **Playwright picking up the vitest file.** Its default `testMatch` takes
  `*.test.ts` as well as `*.spec.ts`. `playwright.config.ts` must limit
  itself to `*.spec.ts`, or `npm run e2e` would run the vitest file and fail.
- **A shorter `STALE_MS` takes over a live holder.** At 35 s, a holder whose
  test runs into the 30 s timeout and whose `afterEach` then runs for more
  than 5 s would lose the lock. The owner check (B4 below) then prevents
  the double release. The longest hold measured in §45's round 4 was 5.1 s.
- **A waiter's 25 s acquire is inside its own 30 s test budget**
  (`beforeEach` counts toward the test timeout). This is not new and not
  changed here; note it in Progress if a stress run shows it.
- **Stale line citations; the lint cap (21, never raised).**
- **Port 5232 is shared:** a second e2e run refuses. Never kill a server you
  didn't start.

## Verified against the codebase

Re-read on `main` at `83ee9c8`.

- `e2e/savesDir.ts:10` — `SAVES_DIR = join(tmpdir(), 'heraklios-e2e-saves-5232')`
- `e2e/savesDir.ts:21-22` — `SAVE_LOCK = \`${SAVES_DIR}.lock\``; `STALE_MS = 60_000`
- `e2e/savesDir.ts:25` — module-level `held` flag ("a failed acquire must not release someone else's")
- `e2e/savesDir.ts:27-45` — `acquireSaveLock(timeoutMs = 25_000)`: exclusive `mkdirSync`, takeover if `mtimeMs` is older than `STALE_MS`, poll every 50 ms, throws "Could not take the save-scenario lock…"
- `e2e/savesDir.ts:47-51` — `releaseSaveLock()`: no-op unless `held`; `rmSync(SAVE_LOCK, { recursive: true, force: true })`
- `e2e/save-import.spec.ts:30-34` — `beforeEach`: acquire, then `rmSync` of `slot-5.json`, `slot-6.json`
- `e2e/save-import.spec.ts:35-39` — `afterEach`: `rmSync` both slot files, then `releaseSaveLock()` (the bug: runs unheld, and the release is skipped on a throw)
- `e2e/save-load.spec.ts:32-36` — `beforeEach`: acquire, `rmSync(SLOT_1_FILE)`; `afterEach(() => releaseSaveLock())`
- `e2e/save-load.spec.ts:57` — `test('a saved game loads back to the saved position', …)`, the 1-in-100 failure
- `e2e/global-setup.ts:21-22`, `e2e/global-teardown.ts:6-7` — both remove `SAVES_DIR` and `SAVE_LOCK`
- `playwright.config.ts:12` — `testDir: 'e2e'`, no `testMatch`; `:15` `timeout: 30_000`; `:20` `workers: 2`; `:30` `trace: 'retain-on-failure'`
- `vitest.config.ts:6` — `include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.mjs']`; `environment: 'node'`
- `tsconfig.json:16` — `include` already has `e2e`, so the new test is type-checked by `npm run build`
- `package.json:12` — `eslint . --max-warnings 21`; `:18` `"e2e": "playwright test"`
- `server/saveApi.test.ts:1` — vitest style: `import { describe, expect, it } from 'vitest'`
- `@playwright/test` 1.64.0 installed
- every file in `e2e/` matching `*.spec.ts` is a scenario; none is named `*.test.ts`

## Subtasks

1. **Make the lock testable, with no behaviour change.** In `e2e/savesDir.ts`,
   move the lock into `createDirLock(path, { staleMs, pollMs })`, which
   returns `{ acquire(timeoutMs), release(), withHeld(cleanup) }` and keeps
   its own `held`. The default instance on `SAVE_LOCK` backs the existing
   exports `acquireSaveLock` and `releaseSaveLock`.
   - `vitest.config.ts`: add `'e2e/**/*.test.ts'` to `include`.
   - `playwright.config.ts`: add `testMatch: '**/*.spec.ts'`, with a
     comment saying the `*.test.ts` files there are vitest.
   - New `e2e/savesDir.test.ts`: the current behaviour (T3, T4, T5 below)
     on a lock under `mkdtempSync(join(tmpdir(), 'h48-lock-'))`.
   - Commit with verify green and `npx playwright test --list` showing only
     the scenarios.
2. **Failing first.** Add T1 and T2 (and T6) for `withSaveLockHeld` and the
   owner check. Commit them as `it.fails` or `it.todo`, or run them red and
   record the output in Progress before writing the code (verify must stay
   green at each commit).
3. **The fix.**
   - `withHeld(cleanup)`: `if (!held) return;` then `try { await cleanup() }
     finally { release() }`. It rethrows cleanup's error, so the hook
     reports it.
   - Exported as `withSaveLockHeld`.
   - **Owner:** `acquire` writes `owner` (a random token) inside the lock
     folder after the `mkdir`. `release` removes the folder only if `owner`
     still holds this worker's token, and does nothing if it is gone.
   - `STALE_MS = 35_000`, with `ACQUIRE_TIMEOUT_MS = 25_000` exported. The
     comment on them states the rule: above the 30 s test timeout, at most
     twice the acquire timeout, so a leaked lock fails scenarios for at most
     `STALE_MS − ACQUIRE_TIMEOUT_MS` = 10 s.
   - Update the header comment.
4. **The hooks.**
   - `save-import.spec.ts` `afterEach`:
     `withSaveLockHeld(() => { rmSync(SLOT_5_FILE…); rmSync(SLOT_6_FILE…) })`.
   - `save-load.spec.ts` `afterEach`: `withSaveLockHeld(() => {})`.
   - `releaseSaveLock` stops being exported if nothing else uses it.
   - **e2e probe P1, red then green,** with an uncommitted local edit
     setting the acquire timeout to 1 s:
     ```
     npx playwright test e2e/save-import.spec.ts --repeat-each=4 --workers=2
     ```
     With the old hooks, a holder fails because the timed-out worker
     deleted its slot files. With the new hooks, only lock-timeout failures
     remain. Record both outputs and restore the timeout by copy
     (`git diff` empty for that line), never `git checkout --`.
5. **Stress and the flake.** Run this five times in a row, saving each run's
   output to a file in the scratchpad or `test-results/` (not committed):
   ```
   npx playwright test e2e/save-import.spec.ts e2e/save-load.spec.ts --repeat-each=10 --workers=2
   ```
   Then run `npm run e2e` once.
   - If `save-load.spec.ts:57` fails, open its trace and name the cause in
     Progress.
   - If the fix is in `e2e/`, make it here with a test or probe.
   - If the cause is in `src/` or `server/`, stop and report it for a
     follow-up intent (the constraint is test code only).
   - If it doesn't recur in 100, say so: not reproduced, which is not the
     same as fixed.
6. **Progress.** Fill in the dates, commits, test counts, P1's red and
   green output, the five stress results and the mutants. Then set
   `status: in-review`.

## Tests

`e2e/savesDir.test.ts` (vitest). Every case uses its own temporary lock path
and two lock instances where "two workers" are needed:

- **T1** — the holder's cleanup throws: the error propagates, the lock
  folder is gone, and a second instance acquires at once. *Mutant:* release
  outside `finally` (after the cleanup call).
- **T2** — not held: another instance holds the lock, this one's acquire
  times out (short timeout), then `withHeld(spy)`. The spy is not called
  and the other's lock folder is still there. *Mutants:* drop the
  `if (!held)` guard; acquire setting `held = true` before `mkdir`
  succeeds.
- **T3** — a fresh lock held by another instance makes `acquire(200)`
  throw "Could not take the save-scenario lock". *Mutant:* no timeout check.
- **T4** — a lock folder older than `staleMs` (`utimesSync` back-dated) is
  taken over within one poll. *Mutant:* takeover removed.
- **T5** — a lock younger than `staleMs` is not taken over. *Mutant:* the
  comparison flipped, or `staleMs` ignored.
- **T6** — owner: A holds, B takes over a back-dated lock, A releases, and
  B's lock folder is still there. *Mutants:* release ignoring `owner`;
  acquire not writing it.
- **T7** — the timing rule: `STALE_MS > 30_000` (the config's `timeout`,
  imported from `playwright.config.ts` if that loads cleanly in vitest,
  otherwise the constant with a comment) and `STALE_MS − ACQUIRE_TIMEOUT_MS
  ≤ ACQUIRE_TIMEOUT_MS`. *Mutants:* `STALE_MS = 60_000`; `STALE_MS =
  25_000`.

The hook wiring (`save-import`'s and `save-load`'s `afterEach`) has no
unit test. P1 proves it, red with the old hooks and green with the new, and
the review re-runs P1 with the old `save-import` hook as a mutant. Each
mutant is run against the full vitest suite, backed up and restored by
copy.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e` green (the diff touches `e2e/**`, so `/review` runs it too),
  plus P1 and the five stress runs above, with their output.
- `npx playwright test --list` lists only `*.spec.ts` scenarios.
- **Manual browser check:** none. No path owes a live check by rule 1 or
  2, and the e2e runs are the runtime evidence. Expected: `live-check:
  not-needed`. Tier Attested (tests-only change and build config).

## Assumptions I made

- **A vitest file inside `e2e/`,** made visible to vitest and hidden from
  Playwright by a `testMatch`, rather than moving the lock to `scripts/`.
  The lock stays next to its users, and the intent's "e2e/ and its helpers"
  covers both configs: they are test configuration, not game code.
- **35 s / 25 s.** The intent asks for a leaked lock to fail scenarios for
  no longer than one acquire timeout while staying above the 30 s test
  timeout. 35 s is the smallest round value above 30 s with margin, giving
  a 10 s window.
- **The owner token is in scope.** Lowering `STALE_MS` makes §45's known
  weakness (after a takeover, the old holder's release removes the new
  lock) more reachable, so the fix closes it with a few lines and T6. Strike
  it at approval if you'd rather keep §48 to the hooks.
- **`afterEach` still runs after a `beforeEach` throw or a test timeout** in
  Playwright 1.64. §45 relied on this; the helper's `if (!held)` makes it
  safe either way.
- **The flake is investigated, not promised fixed.** If 100 runs don't
  reproduce it, Progress says so.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-22 — all six subtasks

Commits: `65095af` (1, createDirLock, vitest includes `e2e/*.test.ts`, Playwright
`testMatch` `**/*.spec.ts`, T3-T5), `e4756d9` (2, T1/T2/T6 as `it.fails`),
`7af0112` (3, `withSaveLockHeld`, owner token, `STALE_MS` 35 s, T7),
`fb79424` (4, hooks). This entry is the sixth.

Tests: 54 files, 909 tests (902 on main, 7 new in `e2e/savesDir.test.ts`;
53 files on main). Lint 21 warnings, cap unchanged. `npx playwright test --list`
shows 10 tests in 8 files, all `*.spec.ts`.

Subtask 2, red before the fix (stub `withHeld` = cleanup then release; no
owner): T1 `expected true to be false` (lock folder left after a throwing
cleanup), T2 `expected "spy" to not be called at all, but actually been called
1 times`, T6 `expected false to be true` (the new holder's lock removed by the
old holder's release). T3-T5 passed. Green after subtask 3.

P1 (subtask 4; `save-import.spec.ts --repeat-each=4 --workers=2`, local edit
of `ACQUIRE_TIMEOUT_MS`, restored by copy, `savesDir.ts` identical to the
commit). The scenario holds the lock only about 3-4 s and the holder's slot
file exists for about 1 s, so the timeout had to land in that window; a sweep
over 1 s, 1.5, 2, 2.2, 2.5, 2.7, 2.9, 3.0, 3.2, 3.4 and 3.7 s found it at
3.4 s. Old hooks at 3.4 s: 2 failed, 2 passed: one lock timeout and one
`the file slot now holds the save ... Expected: true Received: false`
(save-import.spec.ts:66, the holder's slot-5.json deleted by the worker that
timed out). Other timeouts gave only lock-timeout failures, so the red is
timing-dependent (1 sweep point of 11). New hooks at 3.4 s, three runs: each
1 failed (lock timeout only), 3 passed. Outputs kept in the scratchpad
(`p1-red.txt`, `p1-green-1..3.txt`).

Subtask 5, stress, `save-import` + `save-load` `--repeat-each=10 --workers=2`,
five runs in a row: 20 passed (1.1m), 20 passed, 20 passed, 20 passed,
20 passed (1.2m). Then `npm run e2e`: 10 passed (31.1s). The
`save-load.spec.ts:57` failure did not recur in 50 runs of it here (100
scenario runs across the five); not reproduced, which is not the same as
fixed. No cause in `src/` or `server/` was found.

Mutants, each against the full `npx vitest run`, `savesDir.ts` restored by
copy after each: all 11 killed. Release outside `finally` (T1); drop the
`!held` guard (T2); `held` before `mkdir` (T2); no timeout check (T2, T3, T5);
takeover removed (T4, T6); comparison flipped (T2-T6); `staleMs` ignored
(T4, T6); release ignoring owner (T6); acquire not writing the owner (T1, T6);
`STALE_MS` 60 s and 25 s (T7). `git status` clean of mutants afterwards.

Divergences: T7 pins the 30 s test timeout as a constant with a comment, not
imported from `playwright.config.ts` (not tried). Subtask 1's `withHeld` was a
deliberate unguarded stub so T1/T2 could be run red. `releaseSaveLock` is no
longer exported (nothing used it). The owner is a file `owner` inside the lock
folder; a release finding no owner file does nothing.

### 2026-10-23 - review round 1 rework

Changes in `e2e/savesDir.test.ts` only (`e2e/savesDir.ts` unchanged):
T8 (the MEDIUM: A acquires and releases through `withHeld`, B acquires, A's
`acquire(100)` rejects, A's `withHeld(spy)` leaves the spy uncalled and B's
folder in place), T9 (fake timers: `acquire()` with no argument rejects after
`ACQUIRE_TIMEOUT_MS`, kills the 60 s default), T10 (release with the owner
file missing leaves the folder; done, the optional item), and T7 now reads
the test timeout from `playwright.config.ts` (`config.timeout`), which loads
cleanly in vitest. Tests: 54 files, 912 tests; lint 21.

Mutants re-run against the full `npx vitest run`, `savesDir.ts` restored by
copy, `git status` clean of mutants: M7 (delete `held = false;` in release)
killed by T8; default timeout 60 s killed by T9; missing owner removes the
folder killed by T10; release ignoring owner T6; release outside `finally`
T1; withHeld guard dropped T2, T8; held before mkdir T2, T8; no timeout check
T2, T3, T5, T8, T9; takeover removed T4, T6; comparison flipped T2-T6, T8, T9;
acquire not writing owner T1, T6, T8; `STALE_MS` 60 s and 25 s T7. Survivor:
`if (!held) return` dropped from `release`, equivalent (the owner check
already stops a non-holder), as the review noted. `npm run e2e`: 10 passed.
