<!-- generated-by: heraklios/review@0.1.4 -->
# §48 review — e2e save-lock hooks touch nothing unless they hold the lock, and always release it

verdict: attest
tier: attested
reviewed-commit: d05310b
round: 2
sampled: no
live-check: not-needed

**Tier:** set by input 1, the paths: `e2e/**` is tests-only,
`playwright.config.ts` and `vitest.config.ts` are build config, and the rest
is `intents/**`. `review_tier` is empty, the intent is a fix, and no finding
is CRITICAL or HIGH.

**Sampled: no.** On `main`, ten intents carry an attested review (§30, 33,
34, 36, 37, 38, 40, 41, 42, 43). §47 merged as `escalate`, so §48 is the
11th. Round 1's side note stands: by this count, the 10th (§40 or §42, by
the order they merged) says `sampled: no`.

Round 2 covers `d05310b`: T8–T10 added, T7 reads `config.timeout`, and a
Progress entry. `e2e/savesDir.ts` is byte-identical to round 1's `34cf745`.
Every round-1 finding is resolved. Passes run by the `heraklios-reviewer`
agent; the coordinator re-ran the results marked below.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Only the test file and Progress changed, as round 1 asked. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run. Test infrastructure, no game rule. |
| 4 | Tests prove the rule, not only pass | findings (1, LOW). M7, M9 and M10 are now killed; a new lower-bound mutant survives. |
| 5 | Boundary and conventions | pass. Still `e2e/` and the two configs only. |
| 6 | Numbers in prose | pass. 912 tests and lint 21 reproduce, and the killing tests Progress names match. |
| 7 | Documentation | pass. No README text covers this. |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21, no new dependency, valid UTF-8. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 48, fix)
  note:  6 file(s), 229 line(s) changed outside intents/.
```

## Findings
- **LOW** `e2e/savesDir.test.ts:96-106` (T9): it proves `acquire()` gives
  up *by* `ACQUIRE_TIMEOUT_MS + 1 s`, not *at* it. With the default set to
  `5_000` (M9b, `e2e/savesDir.ts:47`), all 912 tests stay green. A shorter
  default would make waiters fail while a holder is still in its scenario.
  Worth a look: advance the fake clock to `ACQUIRE_TIMEOUT_MS − 1_000`
  first and assert it is still pending, then advance the rest.
- Nit: if T9 fails by hanging, its `finally { vi.useRealTimers() }` never
  runs. `afterEach(() => vi.useRealTimers())` would be more robust; it does
  no harm today.

## Not checked
- **`npm run verify` on the merged tree:** `git merge-tree --write-tree main
  HEAD` is clean, and no file overlaps `main`'s changes since the branch
  point (§47's merge and the §49 intent and spec). Verify runs on `main`
  after the merge.
- **The release-guard mutant** (`if (!held) return` dropped,
  `e2e/savesDir.ts:69`): survives, but equivalent, since the owner check
  stops a non-holder.
- **The double-takeover race:** carried over from round 1, out of scope.
- **The `save-load.spec.ts:57` flake:** not reproduced. Across both rounds,
  40 stress runs plus 2 `npm run e2e` runs were green. Not reproduced is
  not fixed.
- **H1 + P1 (the hook wiring):** not re-run, because the hooks and
  `savesDir.ts` are unchanged since round 1, where H1 showed red.

## Live check
Not needed. No rule-1 path changed (only `e2e/**`, the two test configs and
`intents/**`), and `.claude/settings.json` is untouched. The runtime
behaviour is covered by `npm run e2e` and the stress run, both run by the
reviewer.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at HEAD `d05310b`, clean):
- M9b (default `5_000`) against the full `npx vitest run`: 54 files,
  **912 passed**, so it survives. Restored by copy; `git status --short`
  empty.
- `git merge-tree --write-tree main HEAD` (`main` at `0e87aa8`): clean.
- `npm run check:intent`: PASS.
- Round 1's M7, re-run on `d05310b`'s test file: killed by T8.

**Reviewer agent** (same worktree and HEAD):
- `git diff 34cf745 HEAD`: only `e2e/savesDir.test.ts`, Progress and the
  round-1 `review.md` changed.
- `npm run verify`: exit 0, 54 files, 912 tests, lint 21.
- `npx playwright test --list`: 10 tests in 8 files.
- `npm run e2e`: 10 passed (52.6 s), on its own server.
- One stress run of the save scenarios: 20 passed.
- **Mutants**, full suite each, restored by copy:
  - killed: M7 (T8), M9 (T9), M10 (T10), M1 (T1), M3 (T6), M5 (T7), M11
    (T2, T8), M12 (T1, T6, T8, T10);
  - survived: M8 (equivalent) and M9b (the LOW);
  - a config mutant (`timeout: 40_000` in `playwright.config.ts`) is
    killed by T7, so T7 really reads the config.
- **T7's import of the config** starts nothing: after `vitest run
  e2e/savesDir.test.ts` (10 passed), there was no `heraklios-e2e-saves-5232*`
  or `h48-*` folder and nothing listening on 5232.
- **T9 exercises the default timeout.** `staleMs: 1e9` only prevents a
  takeover during the 26 s of fake time.
- The final `git status --short` was empty.

**Taken on trust:** the implementer's re-runs of four mutants not repeated
this round: no timeout check, takeover removed, comparison flipped, and
`STALE_MS` 25 s.

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 34cf745
- round: 1
- sampled: no
- live-check: not-needed

Resolutions (round 2, in `d05310b`):
- **MEDIUM M7** (`held = false` dropped, `e2e/savesDir.ts:70`): **fixed.**
  T8 kills it, re-run by both the reviewer and the coordinator.
- **LOW M9** (default timeout 60 s): **fixed.** T9 kills it. The remaining
  lower-bound gap (M9b) is round 2's LOW.
- **LOW T7 constant: fixed.** T7 reads `config.timeout`, and the
  config-timeout mutant is killed.
- **Not checked M10** (a missing owner file removes the folder): **fixed.**
  T10 kills it.
- **Nit (takeover race):** unchanged, out of scope, still under Not
  checked.
