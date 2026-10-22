<!-- generated-by: heraklios/review@0.1.4 -->
# §48 review — e2e save-lock hooks touch nothing unless they hold the lock, and always release it

verdict: rework
tier: attested
reviewed-commit: 34cf745
round: 1
sampled: no
live-check: not-needed

**Tier:** set by input 1, the paths:
- `e2e/**` is a tests-only change;
- `playwright.config.ts` and `vitest.config.ts` are build config;
- `intents/**` is Automated.

The highest of these is Attested. `review_tier` is empty, the intent is a
fix, no rule is involved, and no finding is CRITICAL or HIGH.

**Sampled: no.** Ten attested reviews are on `main`: §30, 33, 34, 36, 37,
38, 40, 41, 42 and 43. If §48 attests after rework, it is the 11th.
Coordinator note: §36 was sampled as the 5th, but the 10th (§40 or §42,
depending on the order they merged) says `sampled: no`, so a post-merge
read may be owed there.

Passes run by the `heraklios-reviewer` agent; the coordinator re-ran the
results marked below.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The diff is subtasks 1–4 plus Progress. The divergences are stated in Progress: `releaseSaveLock` is no longer exported, and T7 uses a constant. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run. This is test infrastructure, with no game rule. |
| 4 | Tests prove the rule, not only pass | findings (2): 16 mutants, 12 killed, 1 equivalent, 3 survived (2 are findings, 1 is under Not checked) |
| 5 | Boundary and conventions | pass. Only `e2e/` and the two configs changed. |
| 6 | Numbers in prose | findings (1, folded into the T7 LOW). Every Progress figure re-run reproduces. |
| 7 | Documentation | pass. The README never described the lock, and `CLAUDE.md` still points at `e2e/savesDir.ts`. |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21 unchanged, no new dependency (`node:crypto` is built in), all 8 changed files valid UTF-8. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 48, fix)
  note:  6 file(s), 193 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `e2e/savesDir.ts:70` (`held = false;` in `release`): a
  surviving mutant brings back the very bug this intent fixes. With that
  line deleted, all 909 tests still pass, and the effect is:
  1. A worker that held and released the lock in one scenario keeps
     `held === true`.
  2. In a later scenario its acquire times out.
  3. Its `afterEach` still runs the cleanup and deletes the current
     holder's slot files.

  That breaks outcome 1 from each worker's second save scenario on.
  T2 (`e2e/savesDir.test.ts:52`) uses only a fresh instance that never
  held the lock. The reviewer confirmed the effect with a probe against
  the real module: A acquires and releases, B acquires, A's `acquire(100)`
  times out, then `A.withHeld(spy)` runs. The spy is called under the
  mutant and not without it.

  **Needs rework:** add one case, or extend T2:
  - A acquires, then `withHeld(() => {})`;
  - B acquires;
  - A's `acquire(100)` rejects;
  - `A.withHeld(spy)` leaves `spy` uncalled and B's lock folder in place.

  Then confirm the mutant is killed.
- **LOW** `e2e/savesDir.ts:47` (`acquire(timeoutMs = ACQUIRE_TIMEOUT_MS)`):
  a surviving mutant. With the default changed to `60_000`, everything
  stays green. T7 checks the constants, not the timeout `acquireSaveLock()`
  actually uses, and the 10 s bound depends on that default. Worth a look:
  a fake-timer case asserting that `acquire()` with no argument rejects
  after `ACQUIRE_TIMEOUT_MS`.
- **LOW** `e2e/savesDir.test.ts:75` (`const TEST_TIMEOUT_MS = 30_000`): T7
  checks against a copy of the config's timeout, so it would miss a change
  in `playwright.config.ts`. The plan said to import it "if that loads
  cleanly in vitest", and it does: `vite-node` importing
  `playwright.config.ts` prints `timeout 30000`. Worth a look: use
  `config.timeout`.
- Nit, not a regression (the same as in §45): takeover is stat-then-rm
  (`e2e/savesDir.ts:59`), so two waiters on the same stale lock can both
  end up holding it. In that case B removes the old lock, then creates its
  own with `mkdir`, then writes its owner token. C had already decided to
  remove the old lock; its removal then deletes B's new folder, and C
  creates its own. The owner token keeps the later releases safe, but not
  the overlap. It needs a leaked lock with both workers waiting, inside a
  window of milliseconds.

## Not checked
- **M10, the owner file missing:** a mutant where `release` removes the
  folder when there is no owner file survives. No test covers the
  microseconds between someone else's `mkdir` and their owner write, or a
  failed owner write after our own `mkdir`. Doing nothing is correct in
  both cases, by reading the code, but it is not proved.
- **M8, `if (!held) return` in `release` dropped:** this mutant survives,
  but it is equivalent: the owner check already stops a non-holder.
- **The double-takeover race** (the nit): not exercised.
- **A holder hit by the 30 s test timeout** whose `afterEach` runs past
  35 s after its `mkdir`. Judged negligible, because that `afterEach` only
  makes `rmSync` calls, but not measured.
- **H1, the old import hook, under the full stress command:** run only with
  the 3.4 s probe timeout.
- **The intent's "five runs in a row":** the reviewer ran three stress runs
  plus `npm run e2e`. The implementer's five are taken on trust.
- **The `save-load.spec.ts:57` flake:** not reproduced. It passed in
  30 stress runs plus `npm run e2e`. Not reproduced is not fixed, and the
  cause is still unknown.

## Live check
Not needed. No rule-1 path changed (only `e2e/**`, the two test configs
and `intents/**`), and nothing hook-related changed, so rule 2 doesn't
apply. The runtime behaviour is the hooks in a real Playwright run. The
reviewer ran `npm run e2e`, the stress runs and P1 itself.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at HEAD `34cf745`, clean):
- The M7 mutant (the `held = false;` line in `release` deleted) against
  the full `npx vitest run`: 54 files, **909 passed**, so it survives.
  `e2e/savesDir.ts` was restored by copy and `git status --short` is empty.
- `npm run check:intent`: PASS, with the same note as above.
- I read `e2e/savesDir.ts:42-85` (`createDirLock`, `acquire`, `release`,
  `withHeld`).

**Reviewer agent** (worktree `C:/Users/eric/src/heraklios-wt/48-e2e-save-lock-hooks`,
HEAD `34cf745`):
- `npm run verify`: exit 0, 54 files and 909 tests, lint 21 warnings with
  the cap 21.
- `vitest run` on `main` (`a753714`): 53 files and 902 tests, matching
  Progress.
- `npx playwright test --list`: 10 tests in 8 files, all `*.spec.ts`.
  The vitest file is not listed.
- `npm run e2e`: 10 passed (39.4 s), with its own server.
- The stress command
  `npx playwright test e2e/save-import.spec.ts e2e/save-load.spec.ts --repeat-each=10 --workers=2`,
  three times: 20/20 each.
- **Mutants**, each against the full vitest suite, restored by copy:
  - killed: M1 (release outside `finally`), M2 (`!held` guard dropped in
    `withHeld`), M3 (release ignoring the owner), M4 (takeover removed),
    M5 and M6 (`STALE_MS` 60 s / 25 s), M11 (`held` set before `mkdir`),
    M12 (no owner write), M13 (comparison flipped), M14 (no timeout
    check), M15 (`staleMs` ignored), M16 (constant owner token);
  - survived: M7, M8 (equivalent), M9 (default timeout 60 s) and M10.
- **H1 + P1:** the old `save-import` hook with a 3.4 s acquire timeout,
  three runs:
  - runs 1 and 2: the lock timeout only;
  - run 3: also a holder failure at `save-import.spec.ts:78` (the
    holder's slot file deleted, a 404).

  So the red reproduces in 1 run of 3. P1 green (the new hooks, 3.4 s),
  four runs: the lock timeout only.
- Unit tests never name `SAVE_LOCK`. Every case uses its own `mkdtemp`
  folder, and no `h48-*` or `heraklios-e2e-saves-5232*` folder was left.
- `git merge-tree --write-tree main HEAD`: clean. Nothing pushed.

**Taken on trust:**
- the implementer's five stress runs;
- the failing-first record (`e4756d9` has T1, T2 and T6 as `it.fails`,
  not re-run);
- the P1 sweep over 11 timeout values.
