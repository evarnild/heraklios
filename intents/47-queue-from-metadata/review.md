<!-- generated-by: heraklios/review@0.1.4 -->
# §47 review — The intent queue is generated from metadata.yml; the root plan.md stops carrying status

verdict: rework
tier: reviewed
reviewed-commit: cc1e704
round: 1
sampled: no
live-check: owed

**Tier:** set by input 1, the paths: `.claude/skills/**`,
`.claude/agents/**`, `.codex/agents/**` and `REVIEW-POLICY.md` are all
Reviewed. `review_tier` is empty. Passes run by the `heraklios-reviewer`
agent; the coordinator re-ran the results marked below.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (3) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run. This is a digital-only process change. |
| 4 | Tests prove the rule, not only pass | findings (2): 50 mutants, 37 killed, 13 survived |
| 5 | Engine/presentation boundary and conventions | pass. No `src/` change. The logic is in the pure `queue-lib.mjs`, and git/fs are in `queue.mjs`. |
| 6 | Numbers in prose | findings (1) |
| 7 | Documentation | findings (2) |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21 unchanged, no new dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 47, feature)
  note:  29 file(s), 1894 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `scripts/queue-lib.mjs:34-35` (spec B2): **§30 is listed
  wrongly.** `npm run queue` shows `§30 … [experiment] in-review  I
  branch` under In flight.
  - On `main`, §30 is `status: done` with `merged: f755609    # findings
    only; probe code stays on exp/30-browser-test-probe`.
  - The branch `exp/30-browser-test-probe` is kept unmerged on purpose,
    and its copy still says `in-review`.

  B2's rule ("a branch exists and isn't merged → read the branch") gives
  the wrong answer here. The hand-kept table it replaces listed §30 under
  Shipped, so the generated view is less accurate, and a coordinator could
  offer `/review` or `/ship` for a finished experiment.

  **Needs rework:**
  - when `main`'s metadata holds a terminal status (`done`, `abandoned`,
    `deferred`), `main` wins over any branch;
  - add a `pickSource` test, and a `queue.test.mjs` case with a branch
    left unmerged after `main` says `done`;
  - record it as an owner amendment to B2. This is the owner's decision;
    deleting the probe branch instead would leave the next "findings only"
    experiment with the same problem.
- **MEDIUM** `scripts/queue.mjs:32-35`, `:70-77` (B6),
  `.claude/skills/intent/SKILL.md:77-78`, `OVERVIEW.md:12-13`:
  **`--next-id` and the listing ignore intent folders not committed yet.**
  That is the state `/intent` leaves a draft in: it never commits, and
  `/spawn` carries an uncommitted folder into the worktree.
  `intentDirs` only reads `git ls-tree <ref>:intents`. In a sandbox with
  the branch's scripts, `--next-id` printed 6, and printed 6 again after
  an untracked `intents/6-second-draft/` was added. The old rule read the
  folders on disk.

  The new `/intent` step and `OVERVIEW.md` also say the draft is "listed
  under Queued", but it appears only once committed.

  **Needs rework:**
  - also count the folder names under the checkout's own `intents/`, with
    a `queue.test.mjs` case for an untracked folder;
  - either list uncommitted intents (source `working copy`), or say "once
    committed" in the skill and `OVERVIEW.md`.
- **MEDIUM** `scripts/queue.mjs` (pass 4): **the git half is mostly
  unproven.** Nine of the 21 mutants on `queue.mjs` and the JSON half of
  `queue-lib.mjs` survive the full suite:
  - R4 (`h.startsWith(hash)` → `h === hash`) and R7 (`mergeRank` always
    null): either turns Shipped on the real repo (7-character hashes)
    from newest-merge-first into id order. The sandbox has one shipped
    intent, so nothing checks the order end to end.
  - R1 and R2 (`textOf` drops the working copy, or drops `main`): Progress
    claims a branch's own edit counts in `--next-id`, and nothing proves
    it.
  - also R3, R9, R10, Q22 and Q24 (`--json` `source` hard-coded to `main`
    survives).

  **Needs rework:**
  - in the sandbox, merge a second intent so merge order and id order
    differ, and assert the Shipped order;
  - assert `--json` gives `source: 'branch'` for the in-review entry;
  - assert `--next-id` with a higher `§N` only in a working-copy
    `OVERVIEW.md`, then only on `main`.

  R9 and R10 may stay, if Progress says so.
- **LOW** `scripts/ship.mjs:264-268`: the "could not prepare the
  bookkeeping (nothing was written)" stop lost its only test, which was
  the removed "plan.md has no Shipped table" case. S9 (the try/catch
  removed) survives. The path is still reachable: `markMerged` →
  `setKeys` throws when `metadata.yml` lacks `merged:` or `status:`.

  The other `/ship` bookkeeping mutants are killed (S1, S2, S4–S8), so the
  tests still prove the bookkeeping is metadata-only and atomic.

  **Needs rework:** a sandbox test whose branch `metadata.yml` lacks
  `merged:`, asserting `STOPPED bookkeeping … could not prepare` and a
  clean `git status`.
- **LOW** `docs/runbook.md:214`: a link moved from the root into `docs/`
  is broken. `](plan-history.md#13-hex-coordinate-tooltip)` now resolves
  to `docs/plan-history.md`. **Needs rework:**
  `../plan-history.md#13-hex-coordinate-tooltip`.
- **LOW** `intents/47-queue-from-metadata/plan.md:286-288` (Progress): stale
  numbers. `main` has 53 files and 902 tests, not 54 / 917. Net 10 `ship`
  tests were removed, not 25: 902 − 10 + 19 = 911. Worth a look.
- **LOW** spec B3 / `OVERVIEW.md`: three parts of "How To Manage This
  Plan" went to neither `OVERVIEW.md` nor `docs/runbook.md`:
  - the **Workflow defaults** table (implementer and reviewer models,
    adversarial verification, no auto-merge, the Codex notes);
  - "Treat line references as unstable";
  - "Preserve useful postmortems".

  Worth a look: move them to `docs/runbook.md` §1, or record in Progress
  that they were dropped on purpose.
- **LOW** spec AC3: the pathspec `':!intents/*/'` doesn't exclude the
  files under the intent folders (175 extra lines). The implementer used
  `':!intents/*/*'` without saying so. Worth a look: note it in Progress.
- **LOW** `scripts/session-io.mjs:53-60` via `scripts/queue.mjs:61`: if two
  local branches carry the same id, `readIntentMetadataFromBranch` throws
  and `npm run queue` crashes, on the very collision B6 is meant to
  prevent. Worth a look: catch it per id and show a `branch conflict`
  source.
- **LOW** `.claude/skills/ship/SKILL.md:17` still points at
  `intents/46-ship-skill/spec.md` as "the design", which still describes
  the `plan.md` row move. Worth a look: add "(the `plan.md` bookkeeping was
  removed by §47)".
- Nits:
  - a doubled blank line at `scripts/ship.test.mjs:95-96`, and another
    after `## Current Snapshot` in `OVERVIEW.md`;
  - `/sessions` and `/spawn` changed behaviour but kept their `version:`
    (the spec asked only for `/intent`'s bump).

## Not checked
- **AC5, the skills as they run.** No skill was run: whether `/intent`
  takes its id from `--next-id` and writes no queue row, and whether
  `/sessions` runs `npm run queue` without a drift step. That is the live
  check.
- **`/ship` against a real merge:** not run, by the safety rule. Only the
  vitest sandboxes ran it. The first real `/ship` after the merge is the
  owner's post-merge check.
- **`npm run queue` from the main checkout:** it ran only in the worktree,
  because the script isn't on `main` yet.
- **About 60 `plan-history.md#…` anchors** in `OVERVIEW.md`'s Snapshot and
  History Map, copied verbatim at the same directory level, were not
  resolved one by one. The 13 re-pointed links and the pre-§26 rows were
  checked.
- **Mutants not run:** text-only lines (the `/ship` step label, the commit
  and stop messages, the `spawn-intent.mjs` messages, the `formatQueue`
  headings).
- **Markdown list rendering:** checked by a heuristic grep only, not
  rendered.
- **The ~250 `src/` "plan.md §N" comments:** they stay, by the B5
  amendment, and were not checked.

## Live check
- **Owed: rule 3,** for the Not-checked item "AC5, the skills as they
  run".
- **Steps:**
  1. Run `cd C:/Users/eric/src/heraklios-wt/47-queue-from-metadata && claude`.
     A session there loads the branch's skills. No dev server is needed.
  2. Run `npm run queue -- --next-id` and note N.
  3. Run `/intent --feature throwaway: probe for the §47 live check, delete me`
     and answer "just draft it". Watch which command it uses for the id.
  4. Run `git status --short`. Only `?? intents/N-…/` should be new.
  5. Run `/sessions`.
  6. Run `rm -r intents/N-*`, then `git status --short`: it should be
     empty. Commit nothing.
  7. After the merge, from the main checkout: the first real `/ship <id>`'s
     bookkeeping commit lists only `intents/<id>-*/metadata.yml`.
- **You should see:**
  - in step 3, `/intent` runs `npm run queue -- --next-id`, takes N and
    edits no other file. After rework, what it says about Queued matches
    what you see.
  - in step 5, `/sessions` shows the `npm run queue` groups, edits
    nothing, and mentions no queue rows or drift.
  - in step 7, the bookkeeping commit holds `metadata.yml` only.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at HEAD `cc1e704`, clean):
- `node scripts/queue.mjs`: §30 is shown as `[experiment] in-review  I
  branch` (the first finding).
- `--next-id` gives `49`.
- `docs/runbook.md:214` still links `plan-history.md#13-…` from `docs/`,
  and `docs/plan-history.md` does not exist.
- `scripts/queue.mjs:33` lists intents only through `git ls-tree
  <ref>:intents`, with no read of the folder on disk.
- `npm run check:intent`: PASS, as above.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, 55 files and 911 tests, lint 21 with the cap
  21.
- `npm run queue`, `--json` and `--next-id`: In flight 3, Queued 1,
  Shipped 19, Stopped 0; next id 49.
- **AC4:** every §26–§48 line compared with its `metadata.yml` (on `main`,
  and §48 on its branch). Status, type, gates and merge hash all match,
  except §30.
- **AC3, with the spec's command:** apart from the 175 lines inside the
  intent folders, every hit is an intent's own `plan.md` or the generic
  artefact name. Two hits are not, and both are acceptable:
  ```
  OVERVIEW.md:17:- **Code comments that say `plan.md §N`** predate this file: that section is
  scripts/session-lib.test.mjs:319:    expect(brief).not.toContain('Do not edit `plan.md`');
  ```
  The first is required by the B5 amendment; the second asserts the old
  brief line doesn't come back.
- **The "§4" grep:** every runbook pointer names `docs/runbook.md`:
  `.claude/agents/heraklios-implementer.md:26`,
  `heraklios-reviewer.md:62,69`, `.claude/skills/review/SKILL.md:49`,
  `.claude/skills/spawn/SKILL.md:59`, `CLAUDE.md:45,147`,
  `scripts/spawn-intent.mjs:7,127`.
- **No queue-editing instruction left:** grepped for "queue row", "row to
  Shipped", "coordinator view", "Backlog Map", "queue drift" and "edits the
  queue". Every remaining hit says the queue is generated.
- **`docs/runbook.md` against the old `plan.md:338-586`:** verbatim apart
  from the header and the five queue pointers. Its anchors exist. The
  pre-§26 rows in `OVERVIEW.md` are identical to the old table apart from
  the corrected §19 link.
- **The uncommitted-draft id**, reproduced in a sandbox with the branch's
  scripts: 6 before and after an untracked `intents/6-*`.
- **Test counts with `vitest list`:** `main` 902 (`ship-lib` 36, `ship`
  31), the branch 911 (`ship-lib` 28, `ship` 29, `queue-lib` 15, `queue`
  4).
- **50 mutants**, full suite each, restored by copy with a byte-compare:
  - killed (37): Q1–Q15, Q17–Q20, Q23, Q25–Q29, R5, R6, R8, R11, R12, S1,
    S2, S4–S8, T1;
  - survived (13): Q16 (near-equivalent), Q21 (cosmetic), Q22, Q24, R1–R4,
    R7, R9, R10, S9.

  `git status --short` was clean afterwards, in the worktree and the main
  checkout.
- `git merge-tree --write-tree main HEAD`: clean. Nothing pushed. Every
  changed file is valid UTF-8, and the index is LF.
- e2e: not needed, since no `src/`, `e2e/`, `index.html` or
  `vite.config.ts` change.

**Taken on trust:**
- that the History Map and Snapshot anchors, copied verbatim, still
  resolve;
- that `README.md` needed no change (checked for `plan.md` or queue
  references, not read in full).
