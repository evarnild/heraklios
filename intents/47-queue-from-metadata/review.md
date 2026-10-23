<!-- generated-by: heraklios/review@0.1.4 -->
# §47 review — The intent queue is generated from metadata.yml; the root plan.md stops carrying status

verdict: escalate
tier: reviewed
reviewed-commit: a484f8e
round: 2
sampled: no
live-check: owed

**Tier:** set by input 1, the paths: `.claude/skills/**`,
`.claude/agents/**`, `.codex/agents/**` and `REVIEW-POLICY.md` are all
Reviewed. `review_tier` is empty.

**Verdict escalate:** no finding needs rework, and at the Reviewed tier the
owner reads the diff before merging.

Every round-1 finding is resolved. Passes run by the `heraklios-reviewer`
agent; the coordinator re-ran the results marked below.

**Merge note:** merging into `main` conflicts on the root `plan.md` (the
MEDIUM below). Resolve it by keeping the deletion.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The round-2 code follows the B2 amendment (`902bf49`) and the round-1 findings. |
| 2 | Type check | FAIL only on the owed live check (the owner's, not rework) |
| 3 | Rulebook fidelity | not run. This is a digital-only process change. |
| 4 | Tests prove the rule, not only pass | findings (2): LOW survivors |
| 5 | Engine/presentation boundary and conventions | pass. No `src/` change, and main-wins is in the pure `queue-lib.mjs`. |
| 6 | Numbers in prose | pass. Round-1 counts are corrected, and 55 files / 922 tests reproduce. |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21, no new dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: FAIL (intent 47, feature)
  error: A live check is owed and not recorded. Do the steps in intents/47-queue-from-metadata/review.md → ## Live check, then set live_checked: <date> in intents/47-queue-from-metadata/metadata.yml.
  note:  29 file(s), 2026 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **MEDIUM (the merge, not the code)** `plan.md`: merging into `main`
  conflicts.
  - `git merge-tree --write-tree --name-only main HEAD` reports
    `CONFLICT (modify/delete): plan.md deleted in HEAD and modified in
    main`.
  - `main`'s `3083d81` (the §49 intent) added only one Queued row to the
    root `plan.md`.

  **Resolution:** keep the deletion (`git rm plan.md`, then commit the
  merge). §49 loses nothing: its `metadata.yml` is on `main`, and this
  branch's `npm run queue` already lists it under Queued from `main`.

  **`/ship` aborts on a conflicting merge** (`ship.test.mjs`, "aborts a
  conflicting merge and leaves main as it was"), so there are two ways
  through:
  - **By hand on `main`:** `git merge --no-ff feat/47-queue-from-metadata`,
    then `git rm plan.md`, then commit, then `npm run verify` and the
    `metadata.yml` bookkeeping.
  - **Rebase the branch** onto `main`, resolving the same way. That moves
    `reviewed-commit` off the branch's history, so it needs a new review
    round.

  Until the merge, `main` still carries `/intent` 0.1.4, which adds
  `plan.md` rows, so any intent drafted on `main` before then adds to the
  same conflict.
- **LOW** `scripts/queue.mjs:86`: the folder-name filter on the on-disk
  scan carries weight and has no test. N5 (`/^[0-9]+-/` → `/./`)
  survives. The real `intents/` holds `README.md` and `_templates`; without
  the filter, `nextId` would get `NaN` from `README.md` (by reading the
  code, not run). The sandbox has no `intents/README.md`. Worth a look: add
  one in the sandbox's `beforeAll`.
- **LOW** `scripts/queue-lib.mjs` (`queueData`, `merged:`) and
  `scripts/queue.mjs:49`: two round-1 survivors remain, and Progress
  doesn't mention them.
  - Q22: `--json` shows `merged` for a status other than `done`.
  - R3: the 7-character minimum in the hash guard is removed.

  Neither is reachable with today's metadata. Worth a look: one assertion
  each, or a line in Progress accepting them, as for R9 and R10.
- **LOW** `.claude/skills/intent/SKILL.md:35-36`, `:79`, `OVERVIEW.md:13`:
  "once it is committed" should say "once it is committed on `main`". The
  listing reads only `main`'s `intents/` (`queue.mjs:11`), and the
  sandbox's branch-only `fix/60-elsewhere` draft is never listed. Worth a
  look.

## Not checked
- **AC5, the skills as they run** (`/intent`, `/sessions`): the owner's
  live check, below.
- **`/ship 47` resuming after a manual merge** that resolved the `plan.md`
  conflict: not run outside the test sandboxes, by the safety rule.
- **`npm run queue` from the main checkout:** the script isn't on `main`
  until the merge; it ran from the worktree only.
- **Rendered Markdown:** checked by grep only.

## Live check
- **Owed: rule 3,** for "AC5, the skills as they run". `/intent` 0.1.5 and
  `/sessions` changed their instructions. Do it in the worktree: `main`
  still has `/intent` 0.1.4 until the merge.
- **Steps:**
  1. Run `cd C:/Users/eric/src/heraklios-wt/47-queue-from-metadata && claude`.
     No dev server is needed.
  2. Run `npm run queue -- --next-id` and note N (50 today).
  3. Run `/intent --feature throwaway: probe for the §47 live check, delete me`
     and say "just draft it".
  4. Run `git status --short` (only `?? intents/N-…/`), then
     `npm run queue -- --next-id` again.
  5. Run `/sessions`.
  6. Run `rm -r intents/N-*`, then `git status --short`: it should be
     empty. Commit nothing.
  7. After the merge, run `git show --stat` on the bookkeeping commit,
     whether made by `/ship` or by hand. It lists only
     `intents/47-queue-from-metadata/metadata.yml`.
- **You should see:**
  - in step 3, `/intent` runs `npm run queue -- --next-id`, takes N and
    writes only `intents/N-…/intent.md` and `metadata.yml`. It says the
    draft is listed under Queued once committed, not that it already is.
  - in step 4, `--next-id` prints N+1: the uncommitted draft counts.
  - in step 5, `/sessions` shows the `npm run queue` groups (§30 under
    Shipped with `f755609`), edits nothing, and says nothing about queue
    rows or drift.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at HEAD `a484f8e`, clean):
- `git merge-tree --write-tree --name-only main HEAD`: the `plan.md`
  modify/delete conflict.
- `node scripts/queue.mjs`: §30 under Shipped (`done … main f755609`),
  In flight 2.
- `--next-id` gives `50`.
- `npm run check:intent`: FAIL on the live check only.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, lint 21 with the cap 21, 55 files and 922
  tests (`queue-lib` 19, `queue` 10, `ship` 30, `ship-lib` 28).
- `npm run queue`:
  - In flight 2: §47 and §48, both from `branch`;
  - Queued 2: §29, and §49 from `main`;
  - Shipped 20, with §30 placed by merge order;
  - Stopped 0.

  `--json` gives §30 `{"status":"done","source":"main","merged":"f755609"}`.
- **AC3** (`':!intents/*/*'`): every hit is an intent's own `plan.md` or
  the generic name. The exceptions are all acceptable:
  - `OVERVIEW.md:17`, required by B5;
  - `scripts/session-lib.test.mjs:319`, a negative guard;
  - `.claude/skills/ship/SKILL.md:18`, a historical note.
- **The "§4" grep:** every runbook pointer names `docs/runbook.md`.
- **16 mutants**, full suite each, restored by copy with a byte-compare:
  - killed: R1, R2, R4, R7, Q24, S9, and the new N1 (main-wins removed),
    N2 and N3 (`abandoned` or `deferred` dropped), N4 (on-disk scan off),
    N6 and N7 (the branch-conflict label removed, or the catch rethrows),
    N8 (`noMerged` ignored);
  - survived: Q22, R3, N5.

  `git status --short` was clean afterwards, in the worktree and the main
  checkout.
- **By reading:** the Workflow defaults table and the two habits are in
  `docs/runbook.md` §1, and match the old `plan.md:62-69`. The Codex
  reviewer agent they name exists, and the runbook link is fixed.
- **UTF-8:** every file changed since `cc1e704` is valid, and the index is
  LF.

**Taken on trust:** that Q22 and R3 can't be reached, which is a reading of
today's metadata, not a run.

# Round 1 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: cc1e704
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2, in `c73bb12`, `a484f8e`):
- **MEDIUM §30 shown in flight (B2): fixed.** The owner amended B2 in
  `902bf49`: main wins for `done`, `abandoned` and `deferred`.
  `queue-lib.mjs:41` does this, with unit tests and a sandbox case; N1–N3
  are killed, and §30 lists under Shipped.
- **MEDIUM uncommitted intent folders: fixed for `--next-id`**
  (`queue.mjs:84-87`, sandbox test, N4 killed). The listing stays
  committed-only, and the docs say "once committed". The filter and the
  "on `main`" wording are round-2 LOWs.
- **MEDIUM git half unproven: mostly fixed.** R1, R2, R4, R7 and Q24 are
  killed. Q22 and R3 are a round-2 LOW, and R9 and R10 are accepted in
  Progress.
- **LOW `/ship` prepare-failure path (S9): fixed,** with a new sandbox test
  (`noMerged`).
- **LOW stale Progress numbers: fixed** (53 / 902; 10 removed net).
- **LOW broken `docs/runbook.md:214` link: fixed.**
- **LOW dropped Workflow defaults and habits: fixed,** moved to
  `docs/runbook.md` §1.
- **LOW AC3 pathspec: fixed,** recorded in Progress.
- **LOW duplicate-id crash: fixed,** shown as `branch conflict` (N6 and N7
  killed).
- **LOW `/ship` SKILL.md pointer: fixed.** The nits are fixed.
