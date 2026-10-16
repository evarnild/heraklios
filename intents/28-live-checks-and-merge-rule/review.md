<!-- generated-by: heraklios/review@0.1.2 -->
# §28 review — Live checks for untested behaviour, and the agent-merge rule

verdict: escalate
tier: reviewed
reviewed-commit: 951e76b
round: 3
sampled: no
live-check: owed

The tier comes from the **path table**: Reviewed, because the branch touches
`REVIEW-POLICY.md`, `.claude/skills/**`, `.claude/agents/**` and
`.codex/agents/**`. `metadata.yml` also says `review_tier: reviewed`.
Nothing lowers it.

All four round-2 findings are resolved (see "Round 2 (history)" below).
This round found nothing that needs rework. One new LOW finding is worth a
look, and there is one nit. The tier is Reviewed, so the verdict is
`escalate`: read this report **and** the diff (`git diff main...951e76b`).
A live check is still owed (AC8). Do it and record `live_checked:` before
the merge.

This run follows the branch's `/review` skill 0.1.2 and its
`REVIEW-POLICY.md`. The coordinator delegated it to the
`heraklios-reviewer` agent. That agent is not a fresh session that loaded
the skill, so this run does not count as AC8 either.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Since `7f956ae` the diff has the new CLI test, the precondition-1 text, the Progress entry and the owner's amendment of spec B2.1. Nothing else |
| 2 | Type check | pass. FAIL only on "A live check is owed and not recorded", which is the owner's to clear (skill §1) |
| 3 | Rulebook fidelity | not run: process change, no rulebook behaviour (spec: "digital-only") |
| 4 | Tests prove the rule, not only pass | pass. 5/5 mutants killed (M21, M14, M16, M17 in the CLI, plus T1 and T2 in the new test) |
| 5 | Engine/presentation boundary and conventions | pass: no `src/` change |
| 6 | Numbers in prose | pass. 608 tests / 35 files / 21 warnings reproduced. "M21 now killed (1 failed)" reproduced. The corrected CRLF claim in Progress matches round 2's probe |
| 7 | Documentation | findings (1): a nit about the spec's amendment note. Precondition 1 agrees across `REVIEW-POLICY.md`, `spec.md` B2.1 and `sdlc.md`. `CLAUDE.md`, `AGENTS.md`, the skill and the agents point to "Merging" and don't restate it. AC1 grep is clean |
| 8 | Guardrails and hygiene | findings (1): finding 1 (backstop vs `status.showUntrackedFiles=no`). Lint 0 errors / 21 warnings, cap 21 unchanged, no new dependency |
| 9 | Repository-specific footguns | not run: no drift, AI-tier or map-editor code touched |

## Type check
Working-tree mode, `npm run check:intent` in this worktree at `951e76b`,
before this report was written:
```
type-check: FAIL (intent 28, feature)
  error: A live check is owed and not recorded. Do the steps in intents/28-live-checks-and-merge-rule/review.md → ## Live check, then set live_checked: <date> in intents/28-live-checks-and-merge-rule/metadata.yml.
  note:  13 file(s), 471 line(s) changed outside intents/.
```
Branch mode, `node scripts/check-intent.mjs feat/28-live-checks-and-merge-rule`
in the same checkout, also before this report: the same FAIL with the same
single error, exit 1. The owed live check is the only error, so under
skill §1 it is the owner's to clear and not a rework item. Now that this
report is written and not yet committed, branch mode also reports "changes
not committed". That is the backstop working, not a finding.

## Findings

1. **LOW** `scripts/check-intent.mjs:98`. The backstop's `git status
   --porcelain -- <paths>` follows the user's `status.showUntrackedFiles`
   setting. I made a temp repo with this branch's script, put an untracked
   `review.md` in the branch's own checkout, and ran `check:intent
   <branch>`. With the default setting it FAILs "changes not committed",
   as it should. With `git config status.showUntrackedFiles no` it
   **PASSes**. An untracked report is the round-1 case. The setting is
   uncommon, and the written rule (precondition 1 reads the committed
   `review.md`) still protects the merge. Worth a look: pass
   `--untracked-files=all` to that `git status` call.

Nit: `spec.md:38-39` says B2.1 was "amended 2026-10-16 by the owner, after
review round 1". The wording it now holds, with the ancestor check, came
from round 2's finding 4. "after review rounds 1 and 2" would be accurate.

Checked and fine:
- **The new test (`scripts/check-intent.test.mjs:93-106`) proves what it
  claims.** It commits the date first, so the branch-mode check has
  nothing to fail on except the dirty `review.md`. Without the dirty write
  (mutant T1), the test fails. Without `review.md` in the pathspec (M21),
  it fails too. It does not pass whatever the code does.
- **Test order.** The file was order-dependent already: test 2 checks out
  the branch and test 5 checks out `main`. The new test 4 now does the
  commit that test 5 used to do, and test 5 asserts a clean status. If
  test 4 stops before its commit, or someone runs test 5 alone, test 5
  fails loudly. It never passes by accident. Mutant T2 (drop test 4's
  commit) fails tests 5 and 6. This is fragile only in the way the file
  already was. Vitest runs one file's tests in order unless
  `sequence.shuffle` is set, and it isn't set here.
- **Precondition 1 works as literal commands.** I tried them in a temp
  repo:
  - review committed on top of the reviewed commit: `git show
    <branch>:…/review.md` → `attest`, `merge-base --is-ancestor` exit 0,
    and `git diff --name-only` lists only `review.md` and `metadata.yml`.
    Allowed.
  - an uncommitted edit on disk that says `rework`: `git show` still reads
    the committed `attest`. That is what the policy says ("never a copy on
    disk"). The intro paragraph's "committed first" rule covers the
    newer-report-on-disk case.
  - `main` merged into the branch: ancestor 0, but the diff lists `b.txt`.
    Refused.
  - rebased on `main`: `is-ancestor` exit 1. Refused.
  - rebased, and the old commit pruned by `gc`: `is-ancestor` exit 128
    and `git diff` errors with empty output. Because the ancestor check
    comes first, it is still refused. Someone who ran only the diff
    command and read empty output as "nothing changed" would be wrong, but
    the policy orders the checks correctly.
- **The coordinator's case** (`check:intent <branch>` from `main` while
  the report sits uncommitted in the spawned worktree) still PASSes. I
  re-probed this. Round 2 left it to the written rule, and that is what
  now closes it: precondition 1 reads the committed `review.md`, and
  "Merging" requires the report and date to be committed first. Not a
  finding.

## Not checked
- **Whether `/review` 0.1.2 behaves as written in a live session (AC8).**
  This run is a delegated reviewer agent following the skill's text, not a
  fresh session that loaded the skill. It is still owed, and it is why a
  live check is owed.
- Whether a real agent asked to merge runs precondition 1's three commands
  in that order, and refuses on `is-ancestor` exit 1 or 128. I ran the
  commands myself. Whether an agent follows the text can only be seen in a
  real session.
- The Codex agents (`.codex/agents/*.toml`) were not loaded in a Codex
  session and not run through a TOML parser. Nothing since round 2 touches
  them.
- The backstop on a repo whose `review.md` / `metadata.yml` are stored with
  CRLF in the index. Not probed. Here they are `i/lf`.
- `sdlc-scan.mjs` / `/grid` reading a report with two history blocks and
  `live-check:`. Out of scope per the spec; not run.
- The intent-check-lib mutants from rounds 1–2 (M1–M13, M4c, M5, M18–M22
  other than M21) were not re-run. `scripts/intent-check-lib.mjs` and
  `scripts/check-intent.mjs` are unchanged since `7f956ae` (`git diff
  7f956ae..HEAD --stat` lists neither).
- "Tests first: 12 red → green" from round 1's Progress is still taken on
  trust.

## Live check
- owed: rule 3, from the Not-checked item "whether `/review` 0.1.2 behaves
  as written in a live session" (AC8). The branch touches no rule 1 or
  rule 2 path (`git diff --stat main...HEAD -- src index.html
  map-editor.html vite.config.ts .claude/settings.json` is empty).
- steps: in the main checkout (`C:\Users\eric\src\heraklios`), make a
  scratch branch from this one:
  `git switch -c feat/99-live-check-probe feat/28-live-checks-and-merge-rule`.
  Copy `intents/_templates/` to `intents/99-live-check-probe/`, set
  `id: 99`, `slug: live-check-probe`, `type: feature` and today's date in
  the three gates, add a one-line `intent.md`, `spec.md` and `plan.md`, and
  change one comment line in `src/ui/session.ts`. Commit. Then open a
  **fresh** Claude Code session in that checkout, so it loads skill 0.1.2,
  and run `/review feat/99-live-check-probe`. Afterwards:
  `git switch main` and `git branch -D feat/99-live-check-probe`. Don't
  commit the probe's `review.md` anywhere.
- you should see:
  - The probe's `review.md` starts with `<!-- generated-by:
    heraklios/review@0.1.2 -->` and has `live-check: owed` citing rule 1
    (`src/ui/**`).
  - Its `## Live check` section gives a command with port (`npm run dev`),
    a `src/ui/testMode.ts` shortcut, the clicks, and what to see.
  - The closing message contains "live check owed: …".
  - `npm run check:intent` on the probe branch FAILs naming
    `## Live check`, and passes once `live_checked: <today>` is in its
    `metadata.yml`.

  If all of that holds, record `live_checked: <date>` in **this** intent's
  `metadata.yml` and commit it together with this `review.md`. Nothing
  else may be committed on top of `951e76b` (precondition 1).

## Verified myself vs. taken on trust
- Orientation: HEAD `951e76b`, branch `feat/28-live-checks-and-merge-rule`,
  checked out in this worktree. `git status --short` was clean at the
  start.
- `git diff 7f956ae..HEAD`: `REVIEW-POLICY.md` (precondition 1),
  `check-intent.test.mjs` (+1 test, test 5 reworded), `spec.md` B2.1,
  plan.md Progress, and `review.md` (round 2). `scripts/check-intent.mjs`
  and `scripts/intent-check-lib.mjs` are unchanged.
- `npm run verify` at `951e76b`: build OK, lint OK, **35 files / 608
  tests passed**, exit 0. That is 607 + 1 new test.
- `npx eslint .`: **0 errors, 21 warnings**. `package.json` `lint` is still
  `--max-warnings 21`. `git diff --stat main...HEAD -- package.json
  eslint.config.js src index.html map-editor.html vite.config.ts
  .claude/settings.json` is empty.
- `npm run check:intent` and branch mode in the same checkout, both before
  this report: **FAIL, exit 1**, with the owed live check as the only
  error (output above).
- AC1: `grep -rn -i "never by an agent" --include=*.md --include=*.toml .`
  excluding `node_modules` and `intents/2[678]-*` finds **nothing**.
- Precondition wording: I grepped `reviewed-commit|is-ancestor|git
  show|precondition|Merging` over `*.md`, `*.toml` and `*.mjs`. Only
  `REVIEW-POLICY.md:114-121` and `spec.md:35-39` state precondition 1, and
  they agree. `sdlc.md:83-86` summarises it ("nothing but the review and
  the metadata changed after the reviewed commit") and points to the
  policy. `CLAUDE.md:64`, `:101`, `AGENTS.md:33`, the skill (`:104`) and
  both implementer agents point to "Merging".
- Temp-repo probes of precondition 1's commands: the five cases under
  "Checked and fine".
- Temp-repo probes of the backstop with this branch's unmutated
  `scripts/check-intent.mjs`:
  - clean → PASS
  - untracked `review.md` in the branch checkout → FAIL "changes not
    committed"
  - the same with `status.showUntrackedFiles=no` → **PASS** (finding 1)
  - from a `main` worktree → PASS (the known coordinator case)

  An earlier attempt at this probe ran while mutant M21 was applied, and
  it read PASS for the default setting too. I discarded it and re-ran the
  probe after the restore. The results above come from the re-run.
- Mutation pass (pass 4): scratchpad node scripts, one mutant at a time,
  **full `npx vitest run`** each. Before each run the script checks that
  `git diff --quiet` exits 1. It restores the original bytes afterwards
  (CRLF kept for `check-intent.mjs`, which is `i/lf w/crlf`) and checks
  they are equal. `git status --short` was empty after both runs.
  - **M21** drop `review.md` from the backstop pathspec: killed (1 failed,
    the new test)
  - **M14** CLI never reads `review.md`: killed (3)
  - **M16** backstop error dropped: killed (2, both backstop tests)
  - **M17** `HEAD === branch` dropped: killed (1, "ignores another
    checkout's…")
  - **T1** new test without its dirty `review.md` write: killed (1, the
    test itself)
  - **T2** new test without its commit: killed (2, tests 5 and 6)
  - Two further test-side patterns failed to match and were skipped, not
    scored. T1 was then re-run by line number.
- Taken on trust: "12 red → green" (round 1 Progress). Also that the owner
  approved the B2.1 amendment. Commit `951e76b` and the spec's note say
  so, but I can't see that conversation.

# Round 2 (history)

- generated-by: heraklios/review@0.1.2
- verdict: rework
- tier: reviewed
- reviewed-commit: 7f956ae
- round: 2
- sampled: no
- live-check: owed

### Resolution of round-2 findings (checked in round 3 against `951e76b`)
1. MEDIUM, M21 survives (uncommitted `review.md` untested): **resolved**.
   `check-intent.test.mjs:93-106` dirties `review.md` after committing the
   date, so the backstop is the only possible error. M21 is now killed
   (1 failed), and T1 shows the test fails without its dirty write.
2. LOW, spec B2.1 stale: **resolved** by the owner in `951e76b`. B2.1 now
   matches `REVIEW-POLICY.md` precondition 1 (the round-3 nit is about its
   amendment note only).
3. LOW, the "CRLF can't false-alarm" claim: **resolved**. The 2026-10-16
   round-2 Progress entry corrects it: a line-ending-only rewrite shows
   ` M` until git refreshes the index. That matches round 2's probe. The
   code was left as is, which is acceptable for a rare case.
4. LOW, the backstop is narrower than the rule: **resolved** in the
   policy. Precondition 1 reads the verdict from `git show
   <branch>:…/review.md`, requires `reviewed-commit` to be an ancestor
   (`git merge-base --is-ancestor`), and keeps the `git diff --name-only`
   end-state check. Probed as literal commands (round 3, "Checked and
   fine"). The optional `git worktree list` lookup was declined ("the
   policy is the rule"), so the detached-HEAD and coordinator cases still
   PASS `check:intent`. The written precondition covers them.

The tier comes from the **path table**: Reviewed, because the branch touches
`REVIEW-POLICY.md`, `.claude/skills/**`, `.claude/agents/**` and
`.codex/agents/**`. `metadata.yml` also says `review_tier: reviewed`.
Nothing lowers it.

All five round-1 findings are resolved (see "Round 1 (history)" below). The
rework adds a new backstop to `check:intent`, and one line of it has no
test that would catch a mistake. Finding 1 asks for that one test, so the
verdict is `rework`. With finding 1 fixed it would be `escalate`.

This run follows the branch's `/review` skill 0.1.2 and its
`REVIEW-POLICY.md`. The coordinator delegated it to the `heraklios-reviewer`
agent. That agent is not a fresh session that loaded the skill, so it does
not count as AC8.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): finding 2. The rework changes spec B2.1 with the owner's approval, but `spec.md` still states the old rule |
| 2 | Type check | pass. FAIL only on "A live check is owed and not recorded", which is the owner's to clear (skill §1) |
| 3 | Rulebook fidelity | not run: process change, no rulebook behaviour (spec: "digital-only") |
| 4 | Tests prove the rule, not only pass | findings (1): 10/11 mutants killed, 1 equivalent survivor, 1 real survivor (finding 1) |
| 5 | Engine/presentation boundary and conventions | pass: no `src/` change |
| 6 | Numbers in prose | findings (1): finding 3 (Progress says CRLF "can't false-alarm"). 607 tests / 35 files / 21 warnings / 5 CLI tests all reproduced |
| 7 | Documentation | pass: the merge-precondition wording agrees across `REVIEW-POLICY.md`, `sdlc.md`, `CLAUDE.md`, `AGENTS.md`, the skill and the agents. AC1 grep is clean |
| 8 | Guardrails and hygiene | pass: lint 0 errors / 21 warnings, cap 21 unchanged, no new dependency, `package.json` and `eslint.config.js` untouched |
| 9 | Repository-specific footguns | not run: no drift, AI-tier or map-editor code touched |

## Type check
Working-tree mode, `npm run check:intent` in this worktree at `7f956ae`,
before this report was written:
```
type-check: FAIL (intent 28, feature)
  error: A live check is owed and not recorded. Do the steps in intents/28-live-checks-and-merge-rule/review.md → ## Live check, then set live_checked: <date> in intents/28-live-checks-and-merge-rule/metadata.yml.
  note:  13 file(s), 452 line(s) changed outside intents/.
```
Branch mode, `node scripts/check-intent.mjs feat/28-live-checks-and-merge-rule`,
same checkout, also before this report: the same FAIL with the same single
error. The owed live check is the only error, so under skill §1 it is the
owner's to clear and not a rework item. After this report was written,
branch mode also reports the new backstop error, because this `review.md`
is not committed yet (see "Verified myself"). That error is expected, and
it is the backstop doing its job.

## Findings

1. **MEDIUM** `scripts/check-intent.mjs:98` (test: `scripts/check-intent.test.mjs:83`).
   Mutant M21 drops `${intentDir}/review.md` from the backstop's
   `git status` pathspec, so only `metadata.yml` is watched, and it
   **survives** the full suite. The only test of the backstop dirties
   `metadata.yml`. No test runs branch mode with an *uncommitted
   `review.md`* in the branch's own checkout, which is exactly what round
   1's finding 1 found. So the half of the fix that matters most is
   unproven. **Needs rework:** in the same file, add one test that writes a
   changed `review.md` in the branch checkout and expects
   `check(BRANCH)` to exit 1 with "changes not committed". An untracked
   `review.md` would cover it as well, and that is the round-1 case. Then
   restore the file.
2. **LOW** `intents/28-live-checks-and-merge-rule/spec.md:35-37`. Spec B2.1
   still says "its `reviewed-commit` is the branch's current HEAD (no
   unreviewed commits on top)". `REVIEW-POLICY.md:114-118` and `sdlc.md`
   now say something different. Progress records the owner's approval, but
   the accepted spec and the shipped policy disagree. `spec.md` belongs to
   the owner (`intents/README.md` → "Who edits what"), so this is not
   implementer rework. Worth a look: amend B2.1 to the new wording, or add
   a line under its Interpretations saying the policy supersedes it.
3. **LOW** `scripts/check-intent.mjs:98`, plan.md Progress (2026-10-16
   entry). Progress says the backstop uses "`git status`, so CRLF
   conversion can't false-alarm". That is not quite true. I made a temp
   repo with `core.autocrlf true`, committed an LF `metadata.yml`, and
   rewrote it with CRLF line endings and the same content. `git status
   --porcelain` then reports ` M`, while `git diff` is empty. The backstop
   FAILs with "Commit them". `git commit -am` then finds nothing to commit,
   but its staging refreshes the index, and the next run passes. Real use
   is rare, since editors keep a file's line endings. Worth a look: use
   `git diff --quiet HEAD -- <paths>` plus `git ls-files --others
   --exclude-standard -- <paths>` for untracked files, or correct the
   Progress claim. The CLI tests set `core.autocrlf false`, so they cannot
   see this.
4. **LOW** `REVIEW-POLICY.md:106-118`, `scripts/check-intent.mjs:94`. The
   backstop covers less than the rule it backs up:
   - It compares branch names only. A checkout detached at the branch tip
     skips it. I probed this: a dirty `review.md` on a detached HEAD gives
     PASS. That is the scratch-worktree setup that skill §0 suggests for
     reviewing.
   - The usual merge path skips it too: the coordinator on `main` runs
     `check:intent <branch>` while the review sits uncommitted in the
     spawned worktree. (A full ref such as `refs/heads/feat/…` already
     FAILs at `parseBranch`, so that case is safe.)
   - The written rule is what protects the merge, but precondition 1 does
     not say to read `review.md` *from the branch*
     (`git show <branch>:…/review.md`). Picture a round-1 report that says
     `attest` + `owed`, sits uncommitted, and is read from disk.
     Precondition 1 passes, the diff check passes, and `check:intent
     <branch>` passes because git has no `review.md`. The merge goes ahead
     with neither the review nor the live check recorded.
   - `git diff --name-only <reviewed-commit> <branch>` compares end states,
     while the text says "every commit after". That is harmless, but after
     a rebase `reviewed-commit` is no longer an ancestor, and the diff then
     lists all of `main`'s changes. Refusing is the right answer there,
     which is fine, but the policy doesn't say so.

   Worth a look: in precondition 1, say "the verdict read from
   `<branch>`'s committed `review.md`". Optionally, have the backstop find
   the branch's checkout through `git worktree list --porcelain` instead of
   comparing it to `HEAD`.

Checked and fine: recording **this** round on top of `7f956ae` meets the
new precondition 1. With this report uncommitted, `git diff --name-only
7f956ae` lists only `intents/28-live-checks-and-merge-rule/review.md`.
Once it is committed, plus a later `live_checked:` commit, the diff lists
only `review.md` and `metadata.yml`.

## Not checked
- **Whether `/review` 0.1.2 behaves as written in a live session (AC8).**
  This run is a delegated reviewer agent following the skill's text, not a
  fresh session that loaded the skill. It is still owed, and it is why a
  live check is owed.
- Whether the merge-rule wording changes agent behaviour, i.e. whether a
  future session refuses an unrequested merge or one that fails a
  precondition, or the uncommitted-review case in finding 4. Only real
  sessions can show this.
- The Codex agents (`.codex/agents/*.toml`) were not loaded in a Codex
  session and not run through a TOML parser. The rework commit does not
  touch them.
- The backstop on a repo whose `review.md` / `metadata.yml` are stored with
  CRLF in the index. Here they are `i/lf`, so I only probed
  CRLF-in-working-tree (finding 3).
- `sdlc-scan.mjs` / `/grid` reading a report that has a `# Round 1
  (history)` block and `live-check:`. Out of scope per the spec; not run.
- "Tests first: 12 red → green" from round 1's Progress is still taken on
  trust.

## Live check
- owed: rule 3, from the Not-checked item "whether `/review` 0.1.2 behaves
  as written in a live session" (AC8). The branch touches no rule 1 or
  rule 2 path (`git diff --stat main...HEAD -- src index.html
  map-editor.html vite.config.ts .claude/settings.json` is empty).
- steps: in the main checkout (`C:\Users\eric\src\heraklios`), make a
  scratch branch from this one:
  `git switch -c feat/99-live-check-probe feat/28-live-checks-and-merge-rule`.
  Copy `intents/_templates/` to `intents/99-live-check-probe/`, set
  `id: 99`, `slug: live-check-probe`, `type: feature` and today's date in
  the three gates, add a one-line `intent.md`, `spec.md` and `plan.md`, and
  change one comment line in `src/ui/session.ts`. Commit. Then open a
  **fresh** Claude Code session in that checkout, so it loads skill 0.1.2,
  and run `/review feat/99-live-check-probe`. Afterwards:
  `git switch main` and `git branch -D feat/99-live-check-probe`. Don't
  commit the probe's `review.md` anywhere.
- you should see:
  - The probe's `review.md` starts with `<!-- generated-by:
    heraklios/review@0.1.2 -->` and has `live-check: owed` citing rule 1
    (`src/ui/**`).
  - Its `## Live check` section gives a command with port (`npm run dev`),
    a `src/ui/testMode.ts` shortcut, the clicks, and what to see.
  - The closing message contains "live check owed: …".
  - `npm run check:intent` on the probe branch FAILs naming
    `## Live check`, and passes once `live_checked: <today>` is in its
    `metadata.yml`.

  If all of that holds, record `live_checked: <date>` in **this** intent's
  `metadata.yml` and commit it together with this `review.md`.

## Verified myself vs. taken on trust
- Orientation: HEAD `7f956ae`, branch `feat/28-live-checks-and-merge-rule`,
  checked out in this worktree. `git status --short` was clean at the
  start.
- `npm run verify` at `7f956ae`: build OK, lint OK, **35 files / 607
  tests passed**, exit 0.
- `npx eslint .`: **0 errors, 21 warnings**. `package.json` `lint` is still
  `--max-warnings 21`.
- `npm run check:intent` (working tree) and `node scripts/check-intent.mjs
  feat/28-live-checks-and-merge-rule` (branch mode, same checkout), both
  before this report: **FAIL, exit 1**, with the owed live check as the
  only error (output above).
- Round-1 finding 4 claim: by reading `scripts/intent-check-lib.mjs:171-186`,
  I confirm that an invalid `live_checked` still sets `recorded = true`.
  So the removed `return` never stopped an "owed" error, only the
  bad-value error. Progress is right and round 1's analysis was wrong.
  Mutant M4c (re-adding the `return`) is killed by "reports a bad date and
  a bad live-check value together".
- AC1: `grep -rn -i "never by an agent" --include=*.md --include=*.toml .`
  excluding `node_modules` and `intents/2[678]-*` finds **nothing**. No
  "usually owes" is left outside `intents/`.
- Merge-precondition wording: I grepped `reviewed-commit|latest
  commit|branch's HEAD|current HEAD|unreviewed` over `*.md`, `*.toml` and
  `*.mjs`. The only stale copy is `spec.md:35-37` (finding 2).
  `CLAUDE.md`, `AGENTS.md`, the skill and the agents point to
  `REVIEW-POLICY.md` → "Merging" rather than restating it, and `sdlc.md`
  agrees.
- `git ls-files --eol`: `scripts/check-intent.mjs`,
  `intent-check-lib.mjs` and `intent-check-lib.test.mjs` are `i/lf
  w/crlf`. `check-intent.test.mjs`, `review.md` and `metadata.yml` are
  `w/lf`. `core.autocrlf=true`.
- Backstop probes, with this branch's `scripts/check-intent.mjs` in a temp
  repo (`core.autocrlf true`):
  - clean → PASS
  - same-content CRLF rewrite of `metadata.yml` → **FAIL** (finding 3)
  - dirty `review.md`, branch name → FAIL "changes not committed"
  - `refs/heads/…` and `heads/…` → FAIL at `parseBranch` ("carries no
    intent id")
  - detached at the branch tip with a dirty `review.md` → **PASS**
    (finding 4)
  - run from a subdirectory → FAIL "No intents/97-*/metadata.yml". That
    behaviour predates this branch: paths are relative to the repo root.
- Mutation pass (pass 4): a scratchpad node script, one mutant at a time,
  **full `npx vitest run`** for each. It checks that the file bytes
  changed and that `git diff --quiet` exits 1 before running, restores the
  original bytes afterwards (CRLF kept) and checks the restored bytes are
  equal. `git status --short` was empty after the run.
  - killed: M14 CLI never reads `review.md` (3 failed) · M15 CLI doesn't
    pass `review` (3) · M16 backstop error dropped (1) · M17
    `HEAD === branch` dropped (1, "ignores another checkout's…") · M18
    `fromBranch &&` dropped (1) · M20 pathspec loses `metadata.yml` (1) ·
    M22 `if (pending)` inverted (2) · M4c early `return` re-added (1) · M5
    `=== undefined` → `!state` (1)
  - survived: **M21** pathspec loses `review.md` (finding 1) · M19
    `intentDir &&` dropped. M19 is equivalent: with `intentDir` null the
    pathspec is `null/review.md`, which matches nothing.
  - So round 1's survivors M14, M15, M5 and M4b are now all killed.
- After writing this report: `git diff --name-only 7f956ae` lists only
  this `review.md`. `node scripts/check-intent.mjs
  feat/28-live-checks-and-merge-rule` in this checkout FAILs with **both**
  the owed live check and "review.md or metadata.yml has changes not
  committed", which is the backstop working on a real uncommitted report.
- Taken on trust: "12 red → green" (round 1 Progress), and that the owner
  approved changing B2.1 (Progress says so; I can't see that
  conversation).

# Round 1 (history)

- generated-by: heraklios/review@0.1.1
- verdict: rework
- tier: reviewed
- reviewed-commit: ac94c0a
- round: 1
- sampled: no
- live-check: owed

### Resolution of round-1 findings (checked in round 2 against `7f956ae`)
1. MEDIUM, merge preconditions vs committed reviews: **resolved**.
   `REVIEW-POLICY.md:106-118` allows review/metadata-only commits after
   `reviewed-commit` and requires both to be committed. `sdlc.md` agrees.
   There is a branch-mode backstop in `check-intent.mjs:94-102`. The
   remaining gaps are round-2 findings 1, 2 and 4.
2. MEDIUM, CLI wiring untested: **resolved**. The new
   `scripts/check-intent.test.mjs` (5 tests, temp repo) kills M14 and M15.
3. LOW, M5 bare `live-check:`: **resolved**. The test at
   `intent-check-lib.test.mjs` "fails a bare live-check: line" kills M5.
4. LOW, M4b early `return`: **resolved differently**. Round 1's analysis
   was wrong (no "owed" error was ever added). The `return` was removed,
   and a test pins that both errors are reported (M4c killed). The
   invalid-date loop asserts exactly one error.
5. LOW, "usually owes" and missing paths: **resolved**. `CLAUDE.md:65-70`
   and `sdlc.md:56-58` say "always owes" and list `index.html`,
   `map-editor.html` and `vite.config.ts`. The `CLAUDE.md:99` nit is
   rewrapped.


Tier: **path table** → Reviewed (`REVIEW-POLICY.md`, `.claude/skills/**`,
`.claude/agents/**`, `.codex/agents/**`), and `metadata.yml` says
`review_tier: reviewed` too. Two findings need rework, so the verdict is
`rework`. Without them it would be `escalate`.

Run with the `/review` skill at 0.1.1 (main's copy), against this branch's
`REVIEW-POLICY.md`. This branch changes the rules for its own merge, so the
report already uses the new `live-check:` field and `## Live check`
section (plan → Risks, AC8).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — see finding 1; the 4 divergences in Progress are declared, and each one holds up |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — process change, no rulebook behaviour (spec: "digital-only") |
| 4 | Tests prove the rule, not only pass | findings (3) — 12/16 mutants killed |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | pass — 600 tests and 21 warnings reproduced; 585 → 600 matches the 15 tests added; "12 red" taken on trust |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass — lint 0 errors / 21 warnings, cap 21 unchanged, no new dependency |
| 9 | Repository-specific footguns | not run — no drift, AI-tier or map-editor code touched |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 28, feature)
  note:  12 file(s), 302 line(s) changed outside intents/.
```
(Run before this `review.md` existed. Now that the report says
`live-check: owed`, the same command FAILs until `live_checked:` is
recorded. That FAIL is expected, it is the owner's to clear, and it is
the probe below.)

## Findings

1. **MEDIUM** `REVIEW-POLICY.md:109` (also `:93`, spec B2.1/B7) — the merge
   preconditions don't fit how a review gets recorded. The review is
   committed on top of the commit it reviewed: §27 has `reviewed-commit:
   02829c8`, and its review was committed as `f077fd3` on top of it. The
   owner's `live_checked:` date is another commit on top. Either way, "its
   `reviewed-commit` is the branch's HEAD (no unreviewed commits on top)"
   is false at merge time. An agent following it literally refuses every
   merge, and one that bends it is the "written rules can be bent" problem
   this intent sets out to fix. The opposite case is worse: if `review.md` is
   *not* committed, `npm run check:intent <branch>` reads the branch through
   `git show` and never sees `live-check: owed`, so the enforcement
   (precondition 2, the one B7 relies on) passes. The probe below shows
   exactly this. **Needs rework:** precondition 1 should allow commits
   after `reviewed-commit` that touch only `intents/<id>-*/review.md` and
   `metadata.yml`, and the policy (plus `sdlc.md` step 5) should say that
   `review.md` and `live_checked:` are committed to the branch before the
   merge check. A cheap backstop would be for `check:intent` in branch mode
   to warn when the working tree has a `review.md` that the branch lacks.
   That backstop is optional.
2. **MEDIUM** `scripts/check-intent.mjs:67`, `:93` — the CLI wiring that
   makes B7 real is untested. Mutants M14 (delete the `review.md` read) and
   M15 (stop passing `review` to `checkChange`) both **survive** the full
   suite. The plan's Tests section said that if they survive, a CLI test
   gets added "in the same style as `spawn-intent.test.mjs`, in a temp
   repo". The Progress entry records a manual probe instead. **Needs
   rework:** add that test (temp repo with a `review.md` saying `owed` →
   exit 1 with the `## Live check` message; add `live_checked: <date>` →
   exit 0). If it runs the CLI in branch mode too, it also pins finding 1's
   behaviour.
3. **LOW** `scripts/intent-check-lib.mjs:180` — mutant M5 (`state ===
   undefined` → `!state`) survives. A bare `live-check:` header line (empty
   value) FAILs today as "not a value", but no test pins that, so a
   "simplification" to `!state` would quietly read a half-written report as
   "nothing owed". **Needs rework:** one assertion,
   `checkChange(feature({ review: { 'live-check': '' } }))` has an error.
   It folds into finding 2's commit.
4. **LOW** `scripts/intent-check-lib.mjs:177` — mutant M4b (drop the
   `return` after an invalid `live_checked`) survives. The only effect is an
   extra "owed" error next to the date error. Worth a look:
   `expect(r.errors).toHaveLength(1)` in the invalid-date loop would pin it.
5. **LOW** `CLAUDE.md:66`, `sdlc.md:57` — CLAUDE.md says a scenes/UI/
   map-editor/settings change "**usually** owes" a live check, but by
   `REVIEW-POLICY.md` → "Live checks" rules 1–2 it always does. Neither file
   lists `index.html`, `map-editor.html` or `vite.config.ts`. An agent reading
   only CLAUDE.md would treat a `vite.config.ts` change as exempt. Worth a
   look: drop "usually" and add the three paths (or "… and the HTML entry
   points / `vite.config.ts`").

Nit: `CLAUDE.md:99` is now a 120-character line inside a paragraph wrapped
at about 75 characters.

Pass 1 notes. These are not findings, just the owner's to accept, as
Progress asks:
- *Worktree, not the main checkout.* Fine. It matches §27's lesson.
- *`parseReviewHeader` stops at the first `## ` as well.* An improvement
  on the plan. Mutants M9/M10/M10b confirm both stops are tested.
- *The `/review` exemption for an owed-live-check-only FAIL.* This is new
  scope, but it follows from B7 + B8. Without it, every round after the
  first would turn into `rework`. Accept.
- *Empty `live_checked:` read as `[]` = not recorded.* Correct for
  `parseMetadata`, and pinned by a test (M2 killed).

## Not checked
- **Whether `/review` 0.1.2 actually behaves as written in a live session.**
  This run used 0.1.1. AC8 (run the new skill on a scratch branch touching
  `src/ui/`, see `live-check: owed` with concrete steps) is the owner's
  check and hasn't been done. → this is why a live check is owed.
- Whether the merge-rule wording changes agent behaviour, i.e. whether a
  future session refuses a merge it wasn't asked for, or one that fails a
  precondition. Only observable over real sessions.
- The Codex agents (`.codex/agents/*.toml`): I checked the text matches the
  Claude ones, but no Codex session was run to see them load. The TOML still
  parses as far as `"""` balance goes; I didn't run a TOML parser on it.
- "Tests first: 12 red → green" (Progress) is not reproduced. Checking it
  would mean checking out `aee3d7a`'s tests against the pre-change lib.
- `sdlc-scan.mjs` / `/grid` with a report that has `live-check:`. The spec
  leaves this out of scope. I confirmed by reading that `field()` takes the
  first match and doesn't depend on field order, but didn't run the scan.

## Live check
- owed: rule 3. The Not-checked item "whether `/review` 0.1.2 actually
  behaves as written in a live session" (AC8). No rule 1 or 2 path is
  touched.
- steps: in the main checkout (`C:\Users\eric\src\heraklios`), make a
  scratch branch from this one:
  `git switch -c feat/99-live-check-probe feat/28-live-checks-and-merge-rule`.
  Copy `intents/_templates/` to `intents/99-live-check-probe/`, fill in
  `id: 99`, `type: feature` and today's date in the three gates, add an
  empty `intent.md`, `spec.md` and `plan.md`, and change one comment line in
  `src/ui/session.ts`. Commit, then run `/review feat/99-live-check-probe` in
  a fresh Claude Code session (so it loads skill 0.1.2). Afterwards:
  `git switch main`, `git branch -D feat/99-live-check-probe`.
- you should see: the probe's `review.md` stamped `review@0.1.2`, with
  `live-check: owed` citing rule 1 (`src/ui/**`), and a `## Live check`
  section giving a command and port, a test-mode shortcut, the clicks and
  what to see. The closing message should contain "live check owed: …".
  Then `npm run check:intent` on that branch FAILs naming `## Live check`,
  and passes once you add `live_checked: <today>` to its `metadata.yml`.
  Then record `live_checked: <date>` in **this** intent's `metadata.yml`.

## Verified myself vs. taken on trust
- `npm run verify` in the worktree at `ac94c0a`: build OK, lint OK, **34
  files / 600 tests passed**.
- `npx eslint .`: **0 errors, 21 warnings** (cap 21, `package.json` and
  `eslint.config.js` unchanged on this branch).
- `npm run check:intent` (worktree, before writing this report): **PASS**,
  output above.
- `git diff --stat main...HEAD -- src index.html map-editor.html
  vite.config.ts .claude/settings.json eslint.config.js package.json`:
  empty.
- AC1 `grep -rn -i "never by an agent" --include=*.md --include=*.toml .`
  excluding `intents/2[678]-*` and `node_modules`: **no matches**.
- Merge-wording sweep over `CLAUDE.md`, `AGENTS.md`, `sdlc.md`,
  `.claude/agents`, `.codex/agents`, `.claude/skills`: everything that states
  the rule agrees with B1 (finding 5 is about the live-check wording, not
  the merge rule).
- Mutation pass: scratchpad script, one mutant at a time, **full `npx vitest
  run`** each time. Before each run it checks the file really changed, and
  it restores the file from memory afterwards. `git status --short` was
  clean at the end.
  - killed: M1 drop the `checkLiveCheck` call (9 failed) · M2 `[]` counts as
    recorded · M3 drop `typeof v !== 'string'` · M4 drop the invalid-date
    check (5) · M6 drop the value check · M7 owed never fails (3) · M9 no
    stop at `## ` (2) · M10 no stop at `# Round` · M10b `break` → `continue`
    (3) · M11 unanchored key regex · M12 no trailing-space trim · M13 LF-only
    split
  - survived: **M4b** drop the early `return` (finding 4) · **M5**
    `=== undefined` → `!state` (finding 3) · **M14** drop the CLI
    `review.md` read · **M15** CLI not passing `review` (finding 2)
  - not run: `state !== 'not-needed'` in place of `state === 'owed'` is
    equivalent behind the value check.
- CLI probe of finding 1, run with this branch's own `scripts/check-intent.mjs`
  after writing this report (uncommitted, `live-check: owed`, no
  `live_checked:`):
  - working-tree mode, `node scripts/check-intent.mjs` in the worktree:
    **FAIL, exit 1**, "A live check is owed and not recorded. Do the steps
    in intents/28-live-checks-and-merge-rule/review.md → ## Live check …".
    So B7 works when the report is on disk.
  - branch mode, `node scripts/check-intent.mjs
    feat/28-live-checks-and-merge-rule` in the same worktree: **PASS, exit
    0**. The uncommitted report is invisible, so the owed check isn't
    enforced. This is finding 1.
  - (Running branch mode from the main checkout also PASSes, but that tells
    you nothing: main's script predates this branch.)
- Taken on trust: "12 red → green" (tests first), and the implementer's
  own CLI probe in Progress (re-done myself below).
