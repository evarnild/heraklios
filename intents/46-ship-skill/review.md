<!-- generated-by: heraklios/review@0.1.4 -->
# §46 review — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

verdict: rework
tier: reviewed
reviewed-commit: e34e138
round: 2
sampled: no
live-check: owed

Tier set by input 1 (`.claude/skills/**`, Reviewed). Passes run by the
`heraklios-reviewer` agent; results the coordinator re-ran are marked.
Round 1's H1, M1, M2 and M3 are fixed in code and tests, and most LOWs:
S8, S10, S1, S21, S22, S23, the M2 restore and unstage and the
empty-`merged:` fix are killed with the full suite. Two things still need
rework, both in the safety net the intent was written for: a held-open
worktree folder (the §33/§35/§36 case, reproduced on this machine) ends
with `--cleanup` reporting done while the folder is still there; and the
"another session's staged file stays out of our commit" guarantee is
untested (its mutant survives, and is killable).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — the rework's additions are round-1 LOWs; the planned live-check mismatch is acknowledged in Progress |
| 2 | Type check | FAIL on the owed live check only (the owner's) |
| 3 | Rulebook fidelity | not run — process change |
| 4 | Tests prove the rule, not only pass | findings (2 MEDIUM, 2 LOW) — 48 mutants, full suite: 43 killed, 5 survived (B18, B29 S20, B30 S26, A8, A9) |
| 5 | Engine/presentation boundary and conventions | pass — pure `ship-lib`, git half in `ship.mjs`; ROUTE reading in a code comment |
| 6 | Numbers in prose | findings (1 LOW) — counts right (30 + 28, 48 files, 779, lint 21/21); three mutant claims in Progress wrong |
| 7 | Documentation | pass — CLAUDE.md, sdlc.md, SKILL.md consistent |
| 8 | Guardrails and hygiene | pass — lint 21/21, cap unchanged, no dependency, safety grep clean |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
type-check: FAIL (intent 46, feature)
  error: A live check is owed and not recorded. Do the steps in intents/46-ship-skill/review.md → ## Live check, then set live_checked: <date> in intents/46-ship-skill/metadata.yml.
  note:  8 file(s), 1654 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **MEDIUM** (N1) `scripts/ship.mjs:318-341` (`cleanup`) — the held-open
  worktree folder still ends left behind with the run reporting done.
  Reproduced in a sandbox on this Windows machine: with a child process's
  cwd in the worktree, `git worktree remove` failed (`Permission denied`,
  exit 255) but had already unregistered the worktree, leaving the folder.
  Run 1 correctly said `LEFT remove could not remove … then run: npm run
  ship -- 11 --cleanup`; after the child stopped, `--cleanup` found no
  listed worktree, deleted the branch and reported `done remove deleted
  branch feat/11-t11` with no "Left for you", folder still on disk. The
  `existsSync(wt.path)` check (`:328-330`, S20) only runs when git still
  lists the worktree (coordinator read `:318-341`), so it is never reached
  here. Needs rework: when git no longer lists a worktree for the branch,
  check the expected path (`worktreePathFor(root, id, slug)`) on disk and,
  if present, report it as left ("delete <path> by hand"), never `left:
  null`; a test that removes the worktree with git, recreates the folder,
  runs `--cleanup` and expects `LEFT` naming it.
- **MEDIUM** (N2) `scripts/ship.mjs:92-95` (`commitPaths`),
  `scripts/ship.test.mjs:384-415` — the constraint that a run never commits
  another session's work is untested where it matters. Mutant B18 (drop the
  pathspec from `git commit`) survives the full suite (coordinator re-ran:
  779/779). Progress calls it unkillable because git refuses a merge over a
  staged file, but that covers only files staged before the run; a file
  staged during the ~1 min `npm run verify` after the merge is committed
  (sandbox: verify stub staging `other.txt` → real code commits
  `[metadata.yml, plan.md]`, `other.txt` stays staged; under B18 the commit
  holds all three). Needs rework: an end-to-end case whose verify stub
  stages a file, asserting the bookkeeping commit holds only the two files
  and the file stays staged; correct Progress.
- **LOW** `scripts/ship.mjs:250-256` (`findMergeCommit`) — B30 (match any
  merge, not the second parent) survives; with `--no-ff` the oldest merge
  on `--ancestry-path tip..main` is the branch's own, so near-equivalent.
  Progress says S26 killed; that mutant must have differed. Worth a look.
- **LOW** `scripts/ship-lib.mjs:56` — negation gaps: alternatives 2 and 3
  overlap (A8, A9 survive); still read as a stated reason: `ROUTE; the
  reason isn't stated`, `ROUTE, reason: none`, `ROUTE, reason unclear`,
  `ROUTE: Reason to be decided by the owner`. On main: §38, §40 true;
  §36, §42 and all others false, §26 included (its accepted ROUTE has no
  ROUTE + reason line, so it would be stopped for the owner — the safe
  side). Worth a look: a test per negation alternative; have `/review`
  write the "ROUTE, reason …" form.
- **LOW** `scripts/ship.test.mjs:369-382`, `:467-477`, `:487-497` — one
  shared sandbox; tests 37 and 45 bring `main` up to `origin/main` after
  their assertions, not in `finally`, and test 31's `finally` removes
  `intents/31-t31` recursively (tracked files, if a mutant let the run
  merge). Hence mutants failing 6 to 16 tests at once; no false pass found.
  Worth a look: catch-ups in `finally`, test 31 removing only `note.md`, or
  a sandbox per `describe`.
- **LOW** `intents/46-ship-skill/plan.md` Progress — three mutant claims
  wrong: S20 "no portable stand-in" (N1), S26 "killed" (B30), commit
  without pathspec "not killable by design" (N2). Fix with N1 and N2.

## Not checked
- **The skill's behaviour in a live session** — the live check below.
- The held-open folder on other operating systems (Windows only).
- The implementer's exact S26 mutant.
- The ROUTE heuristic beyond the probed phrasings; future `/review`
  output isn't constrained to the §38/§40 form.
- `npm run e2e`: not run, no `src/scenes`, `src/ui`, `src/main.ts` or
  `e2e/` path touched.

## Live check
- owed: rule 3 (a skill's behaviour shows only when it runs; spec AC4).
  After the rework.
- before you start: `git show feat/45-save-api:intents/45-save-api/review.md
  | head -5` must say `verdict: rework` (§45 not ready). Don't use §30: its
  branch is merged, so `/ship 30` would go straight to deleting it.
- Part 1, the skill (in the branch's worktree):
  1. In `C:/Users/eric/src/heraklios`, note `git status --short`, `git log
     -1 --format=%H`, `git rev-parse origin/main`, `git rev-parse
     feat/45-save-api`.
  2. `cd C:/Users/eric/src/heraklios-wt/46-ship-skill && claude`; type
     `/ship 45` → it runs `npm run ship -- 45` with the session's
     `--trailer` lines and **no** `--live-checked`; the report says
     `STOPPED start … run from the main checkout (…), not from a
     worktree.`, relayed without a workaround.
  3. Ask "can §45 ship?" → it runs `npm run ship -- 45 --dry-run`, which
     stops at `start` the same way, relayed without a workaround.
  4. Re-run step 1's four commands: identical.
- Part 2, the script from the main checkout:
  1. In `C:/Users/eric/src/heraklios`: `node
     ../heraklios-wt/46-ship-skill/scripts/ship.mjs 45 --dry-run` → `§45
     dry run (nothing changed)`, a `note fetch a dry run does not fetch`
     line, steps as `would` / `n/a`, then `WOULD STOP preconditions
     verdict: … "rework"`.
  2. `node ../heraklios-wt/46-ship-skill/scripts/ship.mjs 45` → `STOPPED
     preconditions verdict`, exit 1 (this run fetches; if origin has
     commits `main` lacks it stops at `start` instead, also correct).
     `git status --short`, `git log -1` and `git rev-parse
     feat/45-save-api` unchanged; one `ship-stopped` line appended to
     `.git/heraklios-sessions.jsonl` (expected).
- after the merge: the first real `/ship` is watched by the owner and noted
  in that intent's Progress.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `e34e138`, worktree clean; read
  `scripts/ship.mjs:88-97` (`commitPaths`) and `:318-341` (`cleanup`: the
  folder check only inside `if (wt)`); mutant B18 (no pathspec on `git
  commit`) with the full suite → 48 files, 779 passed (survived), file
  restored from a backup, status clean.
- Reviewer agent: `npm run verify` → 48 files, 779 passed, lint 21/21;
  `npm run check:intent` → FAIL on the live check only; `git merge-tree
  --write-tree main HEAD` clean; UTF-8 on every changed file; safety grep
  (`--force`, `reset`, `-D`, `add -A`, `kill` in comments only; push only
  `origin main`); 48 mutants with the full suite (43 killed, survivors as
  above), each restored, status clean after each; sandbox probes with a
  bare origin, deleted afterwards (P1 held-open folder → N1; P2 file staged
  during verify → N2; raw `git worktree remove` on a held folder → exit
  255, unregistered, folder left); `routeReasonStated` on every
  `intents/*/review.md` on main; `ship.mjs` never run against the real
  repository, its origin or a real worktree.
- Taken on trust: the implementer's own mutant runs (re-run instead); that
  §45 stays at `rework` until its next review.

# Round 1 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: 0188ef9
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2, in `4eafe09`, `e34e138`):
- HIGH H1 precondition-1 wiring untested: **fixed** (end-to-end tests for
  `unreviewed-changes` and `reviewed-commit`; S8, S10 killed).
- MEDIUM M1 `routeReasonStated` too permissive: **fixed** (ROUTE + reason
  line in the current round, outside Type check, not negated; §38/§40
  true, §36/§42 false); residual negation gaps LOW.
- MEDIUM M2 bookkeeping not atomic: **fixed** (texts computed first,
  restore and unstage on failure; tests for a missing Shipped table and a
  rejecting hook).
- MEDIUM M3 start and safety checks untested: **mostly fixed** (S1, S21,
  S22, S23, S6 killed); commit without pathspec open as round 2 N2.
- LOWs: S4, S7, S13, S16–S19, S24, S27, L8, L12 killed; origin-ahead
  check, empty `--live-checked`, `--dry-run` without fetch, prior-merge
  hint, live-check steps, `--dry-run` docs **fixed**; S20 reopened as round
  2 N1; S26 near-equivalent (LOW).
