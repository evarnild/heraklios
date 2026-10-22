<!-- generated-by: heraklios/review@0.1.4 -->
# §41 review — An e2e run can fail before any scenario: the game's first load never arrives

verdict: rework
tier: attested
reviewed-commit: 55c8c85
round: 2
sampled: no
live-check: not-needed

Tier set by input 1 (paths: `scripts/**`, `README.md`, intent files); no
rule; nothing raises it. Passes run by the `heraklios-reviewer` agent; the
results quoted below that the coordinator re-ran are marked. Round 1's
findings are resolved. Two things remain: the intent's "first runs pass 3
times" failed again (red, red, green, in both the implementer's and the
reviewer's runs, with a third failure kind still undiagnosed), and the
README now calls every non-sleep red run "a real failure", which today's
four red runs contradict.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — outcome partly met (M1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule |
| 4 | Tests prove the rule, not only pass | findings (1) — 3 of 4 mutants killed; the reporter's call site survives (L1) |
| 5 | Engine/presentation boundary and conventions | pass — the decision is the pure, tested `shouldCheck` |
| 6 | Numbers in prose | pass — 704 tests and 21 warnings reproduced |
| 7 | Documentation | findings (1) — M2; round 1's port sentence is now accurate |
| 8 | Guardrails and hygiene | pass — lint 21/21, no new dependency |
| 9 | Repository-specific footguns | pass — no `retries`, no game code |

## Type check
```
type-check: PASS (intent 41, fix)
  note:  5 file(s), 183 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** (pass 1) `intent.md` → Outcome vs. Progress — **met:** the
  shared-port lead is refuted (a second suite from another worktree is
  refused cleanly; the same-worktree hazard is documented), and a sleep is
  named in a red run's output. **Partly met:** "cause found, on demand":
  a sleep caused §38's red run (event log), but a sleep can't be made on
  demand. **Not met:** "the first `npm run e2e` … passes, 3 times": red,
  red, green again (both the implementer's round-2 runs and the
  reviewer's). A third kind is open: the game loads (165 × 200, no
  failures), every step takes 0.4–2.2 s, scenarios run 34–37 s and hit the
  30 s timeout; no sleep, CPU 6–24 %. Needs rework, **the owner's call**:
  (a) close §41 on its narrowed result (record the decision in Progress)
  and open a follow-up fix for the slowdown with the leads below, or (b)
  keep diagnosing here.
- **MEDIUM** `README.md:47-49` — "Any other red run is a real failure:
  open its trace … instead of rerunning." Today's four red runs had no
  sleep line and no code fault, and the next run passed unchanged; a
  reader following this sentence chases a code defect that isn't there.
  Needs rework: name the third kind (trace shows the game loaded, every
  step 1–2 s, scenarios time out at 30 s → a known, open slowdown: read
  the trace, then rerun), keeping "read before rerun".
- **LOW** `scripts/sleep-reporter.mjs:24` — the call site is untested:
  `if (!shouldCheck(…)) return;` → `if (false) return;` passes all 704
  (re-run by the coordinator). Worth a look: an `onEnd` test with an
  injected reader. Acceptable as thin glue, as the plan says.
- **LOW** (lead for the follow-up) — in run 1's `land-move` trace, steps
  were 0.3–2.2 s until about 33 s, then 16–177 ms once the other workers
  had finished or timed out: contention between the parallel workers, not
  a busy machine (CPU 6–24 %). Red, red, green appeared in both rounds,
  which may be the on-demand reproduction ("first runs after idle"). Try
  `--workers=1`, and check GPU vs. software GL (SwiftShader).

## Not checked
- The cause of the third kind (worker contention, software GL, Defender,
  first-after-idle): observed, not diagnosed.
- A true fresh `/spawn` first run.
- The same-worktree ENOENT mechanism: taken on trust from the
  implementer's single run (round 1's own failing pair had the third-kind
  signature, so it isn't evidence for it); the README says "can", which
  that run supports.
- The reporter's call site (L1); non-Windows only by `shouldCheck`'s unit
  test.

## Live check
not needed — `scripts/`, `README.md` and intent files only; no path rule
applies.

## Verified myself vs. taken on trust
- Coordinator, re-run: `git rev-parse HEAD` → `55c8c85`; `npm run verify`
  → lint 0 errors / 21 warnings (cap 21), **704 passed**; `npm run
  check:intent` → PASS; mutant M4 (reporter ignores `shouldCheck`) →
  survived, 704 passed, file restored, `git status --short` clean; read
  `README.md:44-50`.
- Reviewer agent (not re-run by the coordinator): `git diff 20f3c86 HEAD`
  read in full; mutants M1 (drop `passed`), M2 (drop platform), M3
  (`win32` → `darwin`) killed; e2e run 1 — 4 failed, 3 passed (57.7 s),
  run 2 — 3 failed, 4 passed (55.4 s), run 3 — 7 passed (27.2 s), port
  5232 free before each, on AC (100 %), no Kernel-Power events since
  09:15, CPU samples 6–57 %; traces of runs 1–2 analysed (no failed
  requests, no console errors, slow steps listed above), kept under the
  scratchpad `mut41r2/run1`, `run2`.
- Taken on trust: the implementer's round-2 e2e runs and the ENOENT run.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 7f2bc39
- round: 1
- sampled: no
- live-check: not-needed

Resolutions (round 2):
- MEDIUM README same-worktree sentence: **fixed** in `26e62fa` (now
  accurate; supported by the implementer's ENOENT run, not by round 1's
  own failing pair, which had the third-kind signature).
- LOW reporter `passed` guard: **fixed for the decision** (`shouldCheck`,
  tested, M1–M3 killed); the call site remains (round 2 L1).
- LOW lock-file lead: **declined** as out of scope; the README rule kept.

Tier set by input 1 (paths): `scripts/**`, `playwright.config.ts` (build
config) and `README.md` wording are Attested at most; `review_tier` empty;
no rule. `sampled: no` (the 7th attested review; §36 was the 5th).

The sleep notice works on the real event log and is well tested. The
shared-port lead is refuted across worktrees, as the implementer found.
But this review reproduced the other half of the implementer's own side
note: **two suites in the same worktree can break the first**, and the
README now says the opposite. That sentence needs correcting.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — subtasks 1, 2, 4, 5, 6 done; 3 skipped with evidence, as the plan allows |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule |
| 4 | Tests prove the rule, not only pass | findings (1) — 5 of 6 mutants killed; the reporter's "red run only" check is untested (L1) |
| 5 | Engine/presentation boundary and conventions | pass — pure module tested, PowerShell call kept thin |
| 6 | Numbers in prose | pass |
| 7 | Documentation | findings (1) — the README's "does not disturb the first" (M1) |
| 8 | Guardrails and hygiene | pass — lint 21/21; no new dependency; the reporter swallows every error and returns nothing, so the exit status can't change |
| 9 | Repository-specific footguns | pass — no `retries` |

### Type check
```
type-check: PASS (intent 41, fix)
  note:  5 file(s), 162 line(s) changed outside intents/.
```

### Findings
- **MEDIUM** `README.md:40-41` — "a second suite started meanwhile is
  refused cleanly and does not disturb the first" is true **across
  worktrees** but not **within one**. In this worktree, a second
  `npx playwright test` started 5 s into a first was refused at once
  ("…5232 is already used"), yet the first then **failed 4 of 7**
  (54.7 s): every step took 1–2 s instead of milliseconds, and four
  scenarios hit the 30 s timeout. Repeated once: 7/7. With separate
  `--output` dirs: 7/7 (16.3 s). The implementer's first attempt (shared
  `test-results/`) failed 5 of 7 with ENOENT on
  `test-results\.playwright-artifacts-N`. A refused suite still clears
  the shared `test-results/` on startup, under the running suite. Needs
  rework: say so ("…refused cleanly; from the *same* worktree it can still
  break the first, since it clears `test-results/` — run one suite per
  worktree at a time"). The sentence answers the very question this
  intent asked, so it mustn't be wrong.
- **LOW** `scripts/sleep-reporter.mjs:24` — the `result.status ===
  'passed'` guard is untested: dropping it passes all 701 tests (mutant
  R1), so a green run could start printing a sleep line unnoticed. Worth a
  look: export the decision (status + platform → read or not) and test it,
  or test `onEnd` with an injected reader.
- **LOW** (a lead for the remaining flake, not this change's defect) —
  "same-worktree runs collide" is one more way a red first run can
  happen without a code fault: a reviewer and an implementer session
  running `npm run e2e` in one worktree at the same time. Not shown to be
  what happened in §33's or §35's reviews. Worth a look: a guard (e.g.
  a lock file the global setup checks before anything else) or keep the
  README rule.

### Not checked
- **Whether earlier flakes were sleeps or same-worktree collisions**:
  their times weren't recorded, so neither can be matched now.
- **The reporter on a red run that really overlaps a sleep, end to end**:
  driven here by calling `onEnd` with a past window against the real
  event log (below), not by sleeping the machine mid-run.
- **Non-Windows platforms**: the platform check is read, not run.
- A true fresh `/spawn` first run (as in the Progress).

### Live check
not needed — `scripts/`, `playwright.config.ts` and `README.md` only; no
path rule applies, and the behaviour is the suite's output, proven by the
runs and calls below.

### Verified myself vs. taken on trust
- `git log main..fix/41-e2e-dev-server-first-load`: `b2afaf3`, `4d5674a`,
  `3898bda`, `7f2bc39`. `status: in-review`. Read `git diff main...HEAD`
  in full (config, two scripts, tests, README).
- `npm run verify` (worktree, `7f2bc39`): lint 0 errors / 21 warnings (cap
  21); Vitest 45 files, **701 passed**.
- `npm run check:intent`: PASS.
- `npm run e2e`: **7 passed** (18.1 s); a solo control later: 7 passed
  (16.6 s).
- Reporter against the real System log (`onEnd` called directly, window
  22:10–22:20 today): status `failed` → "The machine slept at 22:15:52
  during this run (critical battery); its failures may not be the code's.
  Rerun on mains power."; status `passed` → nothing; window 22:17–22:20 →
  nothing.
- Same-worktree pairs (second suite started 5 s after the first): shared
  `test-results/` → first **4 failed, 3 passed (54.7 s)**, second refused;
  repeated → 7 passed; separate `--output` dirs → first 7 passed (16.3 s),
  second refused in 2.5 s. The failed run's trace (`land-move`): the game
  loaded (`/src/main.ts` 200, Phaser started), then each step took 0.8–2.2
  s until the timeout. During the run the laptop was on mains (90 %), and
  the System log shows no power events after 22:17.
- Mutants (file backed up and restored, `git diff` checked per mutant):
  window bounds `>=`→`>` and `<=`→`<` killed; resume-only notice killed;
  battery suffix killed; single-object parse killed; reporter's `passed`
  guard **survived** (L1). `git status --short` clean afterwards.
- Taken on trust: the implementer's cross-worktree offset runs (+0/+3/
  +10/+17 s); this review's pairs match their direction.
