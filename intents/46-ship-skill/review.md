<!-- generated-by: heraklios/review@0.1.4 -->
# §46 review — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

verdict: escalate
tier: reviewed
reviewed-commit: ace0bc1
round: 3
sampled: no
live-check: owed

Tier set by input 1 (`.claude/skills/**`, Reviewed); nothing lowers it and
sampling doesn't apply. Passes run by the `heraklios-reviewer` agent;
results the coordinator re-ran are marked. Every round-2 rework item is
fixed and pinned: N1 (reproduced for real on Windows: a child process held
the folder, `--cleanup` reported `LEFT`), N2/B18, B30, and each of the six
`NO_REASON` entries are killed. Six LOWs, all "worth a look": two untested
corners, wrong advice for a detached worktree at the spawn path, one
unreachable half-condition, the ROUTE blocklist's remaining gaps, Progress
wording. Next: the owner reads the diff, does the live check, then merges.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — round-2 changes are all review findings; cleanup now deletes the branch before reporting a left-behind folder (fits spec B5.7) |
| 2 | Type check | FAIL on the owed live check only (the owner's) |
| 3 | Rulebook fidelity | not run — process change |
| 4 | Tests prove the rule, not only pass | findings (2 LOW) — 18 mutants, full suite: 15 killed, 3 survived (N1c equivalent, N1f, "left to the owner") |
| 5 | Engine/presentation boundary and conventions | pass — `ship-lib` pure; ROUTE reading and leftover-folder lookup commented |
| 6 | Numbers in prose | findings (1 LOW) — counts right (36 + 31, 788 in 48 files, lint 21/21); two Progress sentences imprecise |
| 7 | Documentation | pass — CLAUDE.md, sdlc.md, SKILL.md unchanged since round 2, consistent |
| 8 | Guardrails and hygiene | pass — lint 21/21, cap unchanged, no dependency, safety grep clean |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
type-check: FAIL (intent 46, feature)
  error: A live check is owed and not recorded. Do the steps in intents/46-ship-skill/review.md → ## Live check, then set live_checked: <date> in intents/46-ship-skill/metadata.yml.
  note:  8 file(s), 1778 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **LOW** `scripts/ship.mjs:177` (`readState`, `cleanedUp … &&
  !leftoverFolder(…)`) — mutant N1f (drop the folder term) survives (788
  passed): no test runs `--dry-run` with the branch gone and the folder
  there. The behaviour is right (sandbox: `would remove` with the folder,
  `done remove` once gone). Worth a look: in the test at
  `scripts/ship.test.mjs:660-686`, after the third run, a `--dry-run`
  expecting `would\s+remove`.
- **LOW** `scripts/ship.mjs:324-329`, `:351-352` — a worktree still
  registered but **detached** at the spawn path: `worktreeOf` misses it,
  `git branch -d` succeeds, then `LEFT … delete it by hand` (sandbox §14;
  `git worktree list` still showed it). Deleting by hand skips `git
  worktree remove`'s uncommitted-work check and leaves a stale entry.
  Better than before round 2 (silent `done`), but wrong advice. Worth a
  look: when `git worktree list` has an entry at that path, say "git still
  lists <path> (detached HEAD?): remove it with `git worktree remove
  <path>`".
- **LOW** `scripts/ship.mjs:351` — `(wt && existsSync(wt.path) ? wt.path :
  null)` is unreachable (`spawn --remove` exits 0 only after the folder is
  gone; a failed delete returns at `:337-339`); N1c is equivalent. Worth a
  look: drop it, or comment it as defensive.
- **LOW** `scripts/ship-lib.mjs:49`, `scripts/ship-lib.test.mjs:91-102` —
  the `\bleft to the owner\b` alternative is untested (removing it
  survives); the `it.each` second assertion checks the same constant line
  on every row, unlike its comment. Worth a look: a phrase for it, and a
  per-row second assertion (or fix the comment).
- **LOW** `scripts/ship-lib.mjs:43-50` (`NO_REASON`) — still read as
  stated: `ROUTE; I could not find a reason`, `ROUTE, reason pending`,
  `ROUTE, reason absent`, `ROUTE, reason: ?`, `ROUTE — the reason has not
  been stated`; refused although real (safe side): reasons containing "not
  given", "not explained", "left to the owner, who accepted it". On main:
  §38 and §40 true, the other 16 false. LOW because an attest/escalate
  verdict beside an unstated reason is unlikely. Worth a look: have
  `/review` write one fixed form (`ROUTE, reason: <text>`) and accept only
  that.
- **LOW** `intents/46-ship-skill/plan.md` Progress, round-2 entry — "1 test
  each (S1 1, S4 13, S18 16 the exceptions)": B18 fails 2, dropping
  `NO_REASON[0]` 2, negation off 7; "the dry-run plan counts it too" is
  untested (first LOW); "the real Windows reproduction … was not run" — it
  now has been, and passes. Worth a look.
- Asked, judged: S4 (13 failures) and S18 (16) cascade because they make
  the run really merge or push in the shared sandbox; every extra failure
  is a true failure, no false pass — acceptable. The check removed in
  `ace0bc1` was unreachable at both call sites — confirmed.

## Not checked
- **The skill's behaviour in a live session** — the live check below.
- The held-open folder on other operating systems (Windows only).
- The ROUTE heuristic beyond the probed phrasings.
- `cleanup` with a worktree for the branch at a non-spawn path whose
  folder is held open (the early return should cover it; only the
  non-held case ran, §13 `done`).
- `npm run e2e`: not run, no `src/scenes`, `src/ui`, `src/main.ts` or
  `e2e/` path touched.

## Live check
- owed: rule 3 (a skill's behaviour shows only when it runs; spec AC4).
- before you start: `git show feat/45-save-api:intents/45-save-api/review.md
  | head -5` must say `verdict: rework`. If it no longer does, use **§47**
  instead in every step, without the `feat/45-save-api` rev-parse: §47 has
  no branch, so `/ship 47` stops at `start` ("the branch for §47 does not
  exist and main has no merged: record for it.") and changes nothing.
  Never §30: its branch is merged, so `/ship 30` would go straight to
  deleting it.
- Part 1, the skill (in the branch's worktree):
  1. In `C:/Users/eric/src/heraklios`, note `git status --short`, `git log
     -1 --format=%H`, `git rev-parse origin/main`, `git rev-parse
     feat/45-save-api`. (`main` is 7 commits ahead of `origin/main` with
     unpushed §47 commits; expected, doesn't block.)
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
- Coordinator, re-run: HEAD `ace0bc1`, worktree clean; `npm run
  check:intent` → FAIL on the live check only; mutant B18 (no pathspec on
  `git commit`) with the full suite → 2 failed / 786 passed (killed: "never
  commits a file another session stages while verify runs" and the
  unrelated-merge test), file restored, then 788 passed, status clean;
  `git rev-list --count origin/main..main` → 7 (§47 commits, unpushed).
- Reviewer agent: `npm run verify` → 48 files, 788 passed, lint 21/21;
  `git merge-tree --write-tree main HEAD` clean; UTF-8 on 11 changed files;
  safety grep (`--force`, `reset`, `-D`, `add -A`, `add .`, `kill` in
  comments only; push only `origin main`); N1's real Windows case in a
  sandbox under `%TEMP%` with a bare origin (a child `node` with its cwd in
  the worktree → `LEFT could not remove … Permission denied`, unregistered,
  folder left; child stopped → `--cleanup` `LEFT remove deleted branch`,
  dry runs `would remove`; folder deleted → `done`); misfire probes (§12
  never spawned → `done`; §13 non-spawn path → `done`; §14 detached → the
  LOW); sandbox deleted; `routeReasonStated` on every `intents/*/review.md`
  on main → §38, §40 true, 16 false; 18 mutants with the full suite (N1a,
  N1b, N1d, N1e, B18, B30, each `NO_REASON` entry, negation off, S4, S18
  killed; N1c, N1f, "left to the owner" survived), each restored, status
  clean; round 2's survivors re-run (B18, B30 killed; S20's successors
  killed; A8/A9 replaced, each killed); `ship.mjs` never run against the
  real repository, its origin or a real worktree.
- Taken on trust: that §45 stays at `rework` until its next review (hence
  the §47 fallback).

# Round 2 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: e34e138
- round: 2
- sampled: no
- live-check: owed

Resolutions (round 3, in `5461da1`, `ace0bc1`):
- MEDIUM N1 held-open folder reported done after `--cleanup`: **fixed**
  (`leftoverFolder` at the spawn path, branch or not; real Windows case
  reproduced in round 3; N1a, N1b, N1d, N1e killed); dry-run corner and
  detached-worktree advice LOW.
- MEDIUM N2 file staged during verify untested: **fixed** (B18 killed, 2
  tests).
- LOW B30 any merge: **fixed** (unrelated `--no-ff` merge test; killed).
- LOW negation gaps (A8, A9): **fixed as asked** (six `NO_REASON` entries,
  each killed); "left to the owner" untested and remaining gaps LOW.
- LOW test isolation: **fixed** (catch-ups in `finally`, test 31 removes
  only `note.md`); S4/S18 cascades acceptable.
- LOW Progress mutant claims: **fixed**; the new entry has imprecisions
  (LOW).

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
