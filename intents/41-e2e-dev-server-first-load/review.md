<!-- generated-by: heraklios/review@0.1.4 -->
# §41 review — An e2e run can fail before any scenario: the game's first load never arrives

verdict: rework
tier: attested
reviewed-commit: 7f2bc39
round: 1
sampled: no
live-check: not-needed

Tier set by input 1 (paths): `scripts/**`, `playwright.config.ts` (build
config) and `README.md` wording are Attested at most; `review_tier` empty;
no rule. `sampled: no` (the 7th attested review; §36 was the 5th).

The sleep notice works on the real event log and is well tested. The
shared-port lead is refuted across worktrees, as the implementer found.
But this review reproduced the other half of the implementer's own side
note: **two suites in the same worktree can break the first**, and the
README now says the opposite. That sentence needs correcting.

## Passes
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

## Type check
```
type-check: PASS (intent 41, fix)
  note:  5 file(s), 162 line(s) changed outside intents/.
```

## Findings
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

## Not checked
- **Whether earlier flakes were sleeps or same-worktree collisions**:
  their times weren't recorded, so neither can be matched now.
- **The reporter on a red run that really overlaps a sleep, end to end**:
  driven here by calling `onEnd` with a past window against the real
  event log (below), not by sleeping the machine mid-run.
- **Non-Windows platforms**: the platform check is read, not run.
- A true fresh `/spawn` first run (as in the Progress).

## Live check
not needed — `scripts/`, `playwright.config.ts` and `README.md` only; no
path rule applies, and the behaviour is the suite's output, proven by the
runs and calls below.

## Verified myself vs. taken on trust
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
