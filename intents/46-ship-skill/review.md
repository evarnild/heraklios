<!-- generated-by: heraklios/review@0.1.4 -->
# §46 review — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

verdict: rework
tier: reviewed
reviewed-commit: 0188ef9
round: 1
sampled: no
live-check: owed

Tier set by input 1 (`.claude/skills/**`, Reviewed). Passes run by the
`heraklios-reviewer` agent; results the coordinator re-ran are marked.
`ship.mjs` follows `REVIEW-POLICY.md` → "Merging" step for step and never
forces, resets, uses `-D` or stages everything. Its tests don't hold it:
20 of 40 extra mutants survived, including the wiring of two of
precondition 1's three checks (reviewed-commit ancestry, files changed
since). And two behaviours need fixing: the ROUTE-reason test accepts any
mention of "route", and a failure during bookkeeping leaves half-written
bookkeeping on `main`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2) — the ROUTE-reason reading (M1); the planned live-check steps can't run as written (L) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — process change |
| 4 | Tests prove the rule, not only pass | findings — 20/40 mutants survived, incl. S8 and S10 (H1, M3, LOW) |
| 5 | Engine/presentation boundary and conventions | pass — pure lib plus a git half |
| 6 | Numbers in prose | pass |
| 7 | Documentation | findings (LOW) — `sdlc.md:93` vs `SKILL.md` on `--dry-run` |
| 8 | Guardrails and hygiene | findings (1) — bookkeeping atomicity (M2); lint 21/21, safety grep clean |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
type-check: PASS (intent 46, feature)
  note:  8 file(s), 1252 line(s) changed outside intents/.
```

## Findings
- **HIGH** (H1) `scripts/ship.mjs:190-191` — precondition 1's git wiring is
  untested: dropping the `--is-ancestor` check (S8, `isAncestor = !!rc`;
  re-run by the coordinator: 758/758 pass) or the changed-files list (S10,
  `changedFiles = []`) leaves the suite green. The behaviour is right
  today (a probe refused `unreviewed-changes: … docs/fix23.md`), but
  nothing pins the two checks that stop an unreviewed commit from being
  merged. Needs rework: two `ship.test.mjs` cases — a commit added after
  the review stops at `unreviewed-changes` with `main` unchanged; a branch
  amended or rebased after the review stops at `reviewed-commit`.
- **MEDIUM** (M1) `scripts/ship-lib.mjs:48-56` — `routeReasonStated`
  accepts any "route/routes/routed" outside `## Type check`. A probe
  shipped a ROUTE branch whose review said only "check:intent ROUTE: no
  reason found, left to the owner"; a pasted `npm run check:intent ->
  ROUTE (exit 2)` passes too. On real reviews it fires on incidental prose
  (coordinator re-ran it: true for §36 "the Board has no route back" and
  §42). It also skips a `# Round N (history)` block after `## Type check`.
  Needs rework: require an explicit statement (a line outside `## Type
  check` with ROUTE and a reason marker, the convention of §38 "ROUTE,
  reason above" / "Reason:", §40 "ROUTE, reason stated"), else stop for
  the owner; negative tests for "no reason found" and a pasted "check:intent
  -> ROUTE".
- **MEDIUM** (M2) `scripts/ship.mjs:257-279` — bookkeeping isn't atomic. A
  `plan.md` without a `### Shipped` table: `metadata.yml` already written
  when `moveRowToShipped` throws, left uncommitted, reported as step `run`.
  A pre-commit hook rejecting the commit: both files left staged. Either
  way the re-run refuses at B4 ("uncommitted changes on main — another
  session's work?") although the leftover is its own. Needs rework:
  compute both new texts first; on any write or commit failure restore
  both files and unstage them (`git restore --staged -- <paths>`), then
  `Stop('bookkeeping', …)`; a test that a plan without a Shipped table
  stops with `git status` clean.
- **MEDIUM** (M3) `scripts/ship.mjs:121-144`, `:90-93`, `:214` — B4's start
  and safety checks are untested (mutants survived): a dirty intent folder
  on `main` (S1); `git add -A` plus a commit without pathspec (S6); not on
  `main` (S21); run from a worktree (S22); a dirty worktree `metadata.yml`
  before recording the live check (S23). The behaviour is right (probes
  kept another session's staged and unstaged files out). Needs rework:
  end-to-end cases for each, including an unrelated staged and unstaged
  file on `main` that stay out of the bookkeeping commit and stay dirty.
- **LOW** surviving mutants worth a look: S4 (origin check), S7 (`branch
  -D`), S13 (no `merge --abort`: no conflict test), S16–S18 (push-skip
  logic), S19–S20 (cleanup failure paths), S24 (live check re-recorded),
  S26 (second-parent match), S27 (resume after the branch is gone), L8
  (`isBookkept` ignores status), L12 (`tableAfter` crosses headings). The
  cheapest: S7 (`--cleanup` on an unmerged branch) and S13 (a conflicting
  branch).
- **LOW** `scripts/ship.mjs:143-174` — no check that `main` is up to date
  with `origin` before merging; after someone else pushed, a run merged and
  did the bookkeeping locally, then stopped at the rejected push, and every
  re-run retries it. Worth a look: refuse at the start if `origin/main`
  isn't an ancestor of `main`.
- **LOW** `scripts/ship.mjs:53` — `--live-checked ""` records `# owner: ""`.
  Worth a look: refuse empty words (B3).
- **LOW** `scripts/ship.mjs:154` — `--dry-run` runs `git fetch` (moves
  remote-tracking refs); "changes nothing" is slightly overstated.
- **LOW** `scripts/ship.mjs:147` — after a red-verify stop and a moved
  branch tip, the re-run stops at preconditions without saying `main`
  already carries a merge of the old tip. Worth a look: name it.
- **LOW** `intents/46-ship-skill/plan.md` Validation — the planned live
  check runs `/ship` in the worktree, but `ship.mjs` refuses to run from a
  worktree (even `--dry-run`). The steps below work around it.
- **LOW** `sdlc.md:93` documents `/ship <id> --dry-run`; `SKILL.md` maps
  only "can §N ship?" to `--dry-run`. `sdlc.md:93-94` is one unwrapped
  line.

## Not checked
- **The skill's behaviour in a live session** — the live check below.
- The Windows "folder held open" case (the test uses an untracked file as
  a stand-in).
- The implementer's seven mutants (not re-run; S8/S10 overlap two).

## Live check
- owed: rule 3 (a skill's behaviour shows only when it runs; spec AC4).
  After the rework.
- before you start: `git show feat/45-save-api:intents/45-save-api/review.md
  | head -5` must say `verdict: rework` (§45 not ready). Don't use §30:
  its branch is merged, so `/ship 30` would go straight to deleting it.
- Part 1, the skill (in the branch's worktree):
  1. In `C:/Users/eric/src/heraklios`, note `git status --short; git log -1
     --format=%H; git rev-parse origin/main`.
  2. `cd C:/Users/eric/src/heraklios-wt/46-ship-skill && claude`; type
     `/ship 45` → it runs `npm run ship -- 45` with the session's
     `--trailer` lines and **no** `--live-checked`; the report says
     `STOPPED start … run from the main checkout`, relayed without a
     workaround.
  3. Ask "can §45 ship?" → it runs `npm run ship -- 45 --dry-run`.
  4. Re-run step 1's three commands: identical.
- Part 2, the script from the main checkout:
  1. In `C:/Users/eric/src/heraklios`: `node
     ../heraklios-wt/46-ship-skill/scripts/ship.mjs 45 --dry-run` → `§45
     dry run (nothing changed)`, steps as `would` / `n/a`, then `WOULD STOP
     preconditions verdict: … "rework"`.
  2. `node ../heraklios-wt/46-ship-skill/scripts/ship.mjs 45` → `STOPPED
     preconditions verdict`, exit 1; `git status --short`, `git log -1`,
     `git rev-parse origin/main` and `git rev-parse feat/45-save-api`
     unchanged.
- after the merge: the first real `/ship` is watched by the owner and noted
  in that intent's Progress.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `0188ef9`, worktree clean; `npm run
  check:intent` → PASS; `routeReasonStated` on `main`'s §36 and §42
  `review.md` → `true` both (incidental "route"); mutant S8 (`isAncestor =
  !!rc`) → survived, 758 passed, file restored, status clean.
- Reviewer agent: `npm run verify` → 48 files, 758 passed, lint 21/21;
  `git merge-tree` with `main` (also after `main` moved to `4ec0607`) →
  clean; UTF-8 on every changed file; safety grep (comments and prose only;
  push is only `origin main`); 40 mutants with the full suite (20 killed,
  20 survived, listed above); sandbox probes P1–P9 in throwaway repos with
  a bare origin, deleted afterwards; `ship.mjs` never run against the real
  repository, its origin or a real worktree; the skill read against
  B2/B3/B7/B9; no `ship` name collision in `.claude/skills`,
  `~/.claude/skills` or plugin caches.
- Taken on trust: the implementer's seven mutant results; the busy-folder
  stand-in.
