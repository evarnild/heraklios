<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §71 plan — Record which intents must merge before another can be built (blocked_by)

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Port product-advice-agent §18 (`cc764da..3041c48`) into heraklios. The
result: a `blocked_by:` record that the queue shows, that spawn and
check:intent refuse on, and that `/auto` stops for before spawning. Add the
heraklios-only orchestrator display and Auto resume (spec B13-B16). Update
the skills and docs that describe it. Nothing changes for an intent without
the key (B5).

## Risks

- **Tests that pass whatever the code does.** Each refusal test must also
  assert that nothing was created: no worktree directory and no branch
  (AC4). Each check:intent test must assert the verdict *and* the message,
  so a FAIL for another reason can't pass it.
- **Breaking the orchestrator with the new JSON key.** `state.mjs:81` maps
  every top-level key of `queue --json` to rows. If `problems` is added
  before the orchestrator skips it, the dashboard breaks. Land subtask 5
  before, or in the same commit as, the `queue --json` change, and test
  the shape (AC5).
- **Reading the branch instead of `main`.** Blocker state must come from
  `main:intents/<dir>/metadata.yml` (B4), even when check:intent runs on a
  branch whose own copy of the blocker says merged. A test covers exactly
  that case.
- **The running `/auto 66` and `/auto 71`.** This changes
  `.claude/skills/auto/SKILL.md` and `spawn-intent.mjs`, which the
  coordinator runs. §66 has passed step 4. The new text only adds a check
  before spawn, and §66 and §70 declare no blocker (B5, AC6).
- **The lint cap and the size budget.**
  - `scripts/intent-check-lib.test.mjs` is already 509 lines. Tests are
    exempt from the budget (`size-budget-lib.mjs:25-26`), but the new cases
    go in a new file anyway.
  - The new scripts stay under 500 lines and functions under 80.
- **A port that drifts from its source.** Every difference from
  `3041c48` is one of I1-I3 or B13-B16. Any other difference is recorded
  in the Progress entry, with its reason.
- **Stale line citations.** Read at `7e2033c`; re-check before editing.

## Verified against the codebase

Re-read on `main` at `7e2033c`. Source files at
`../product-advice-agent` `3041c48`.

- `product-advice-agent:scripts/blockers-lib.mjs` (96 lines) —
  `parseBlockers`, `isMerged`, `blockerState`, `openChain`, `findCycles`;
  pure, no imports.
- `product-advice-agent:scripts/session-io.mjs` `readBlockers(root, id,
  metadata)` — reads `main:intents` through `git ls-tree`/`git show`;
  `exists` via `findIntentDir` or `readIntentMetadataFromBranch` (a throw
  counts as exists).
- `product-advice-agent:scripts/spawn-intent.mjs` `refuseIfBlocked(root,
  metadata)` — called in `spawn()` right after the metadata is found.
- `product-advice-agent:scripts/check-intent.mjs` — `mainMetaOf`,
  `onSomeBranch`, `blockers` passed to `checkChange`.
- `product-advice-agent:scripts/intent-check-lib.mjs` `checkBlockers` —
  problems and unknown blockers are errors, a missing reason is a note.
- `product-advice-agent:scripts/queue-lib.mjs` — `blockerReport(entries,
  knownIds)`, `blockedText(info)`, `queueLine(entry, blocked)`,
  `formatQueue(entries, {knownIds})` (a "Problems" block),
  `queueData(entries, {knownIds})` (the `blocked_by` and
  `blocked_by_open` fields, plus top-level `problems`).
- `product-advice-agent:scripts/queue.mjs` — `mainMerged:
  isMerged(mainMeta)` on each entry; `knownIds: allIntentIds()` passed to
  both outputs.
- `scripts/session-io.mjs:41`, `:53`, `:80` — `findIntentDir`,
  `readIntentMetadataFromBranch`, `readIntentMetadata` exist here as in the
  source.
- `scripts/spawn-intent.mjs:14` — imports from `session-io.mjs`;
  `:87-93` — `spawn()`: `worktreeFor`, then `readIntentMetadata(root, id)
  ?? readIntentMetadataFromBranch(root, id)`, then `const { dir, metadata
  } = found`.
- `scripts/check-intent.mjs:16` — imports from `intent-check-lib.mjs`;
  `:26` — `git` helper; `:37` — `parseBranch(branch)`; `:135` —
  `checkChange({ branch, metadata, intentDir, intentFiles, diff, review
  })`.
- `scripts/intent-check-lib.mjs:167` — `checkChange({ … review = null })`.
- `scripts/queue.mjs:15-17` — imports; `:55-73` — `collectEntries`, which
  pushes `{ id, ...picked, mergeRank }`; `:96`, `:98` — `queueData` and
  `formatQueue` calls.
- `scripts/queue-lib.mjs:63` `queueLine(entry)`, `:76`
  `formatQueue(entries)`, `:88-101` `queueData(entries)`.
- `scripts/queue-lib.test.mjs:1-9` — Vitest (`describe`, `expect`, `it`)
  with an `entry(id, status, extra, mergeRank, source)` helper.
- `scripts/size-budget-lib.mjs:25-36` — tests are not budgeted.
- `tools/orchestrator/state.mjs:76-81` — `queue --json` read; rows from
  `Object.entries(queue)`.
- `tools/orchestrator/orchestrator-lib.mjs:185-196` — `NEEDS_ANSWER`,
  `BY_HAND`; `:212-231` — `autoLaunch`.
- `tools/orchestrator/actions.mjs:38-39` — `spawnRoute` runs
  `spawn-intent.mjs` through `script(…)`.
- `tools/orchestrator/public/app.js:74-82` — `spawnButtons`; `:126-138`
  — `intentRow` (the gates cell joins `intent.gates` and `intent.auto`);
  `:142-145` — `renderState`.
- `tools/orchestrator/public/index.html:15` — the `waiting` section.
- `.claude/skills/auto/SKILL.md:91` — the first resume-table row;
  `:144` — `## 4. Build (B4)`.
- `.claude/skills/spawn/SKILL.md:31` — step 4, `--base` wording.
- `.claude/skills/intent/SKILL.md:73-75` — the links and `follows_up`
  item.
- `.claude/skills/spec/SKILL.md:67`, `.claude/skills/build-plan/SKILL.md:70`
  — `## 6. Report`.
- `intents/README.md:24` — the layout line for `metadata.yml`; `:148` —
  "The auto fields"; `:154` — "The implementer agent".
- `sdlc.md:40-44` — the spawn paragraph.

## Where this goes

- **Modules touched:**
  - `scripts/session-io.mjs` — `readBlockers`;
  - `scripts/spawn-intent.mjs` — `refuseIfBlocked`;
  - `scripts/check-intent.mjs` — read from `main`, pass `blockers`;
  - `scripts/intent-check-lib.mjs` — `checkBlockers` inside `checkChange`;
  - `scripts/queue-lib.mjs` — the report, the text and the JSON;
  - `scripts/queue.mjs` — `mainMerged`, `knownIds`;
  - `tools/orchestrator/state.mjs` — rows skip `problems`, and the state
    carries it;
  - `tools/orchestrator/orchestrator-lib.mjs` — `autoLaunch`'s confirm for
    the two blocker stops, plus a pure `blockedText`-style helper for the
    row;
  - `tools/orchestrator/public/app.js` and `index.html` — the row text and
    the problems line;
  - the five skills;
  - the docs: `intents/README.md`, `intents/_templates/metadata.yml`,
    `CLAUDE.md` and `sdlc.md`.
- **New modules:**
  - `scripts/blockers-lib.mjs` — the pure blocker logic: parse, state,
    open chain, cycles;
  - its test, `scripts/blockers-lib.test.mjs`;
  - `scripts/intent-check-blockers.test.mjs` — the `checkBlockers` cases,
    kept out of the 509-line `intent-check-lib.test.mjs`.
- **Why there:** this is where the source puts it, and the intent says
  "port, don't redesign". The pure logic sits apart from the git reads
  (principle 15). The orchestrator only displays and relays (§52's "no rule
  of its own"). No new layer and no new dependency.
- **Budget lines:** none. Every touched non-test file stays under 500 lines
  (largest: `intent-check-lib.mjs`, 356 + about 20).

## Subtasks

1. **`blockers-lib.mjs` and its tests.** Copy the source file verbatim,
   apart from the header comment's intent reference. Convert
   `blockers-lib.test.mjs` to Vitest (`it.each` for the source's `each()`).
   AC1. Commit.
2. **check:intent.** Add `checkBlockers` to `intent-check-lib.mjs` and the
   `blockers` argument to `checkChange`. `check-intent.mjs` reads `main`
   (`mainMetaOf`, `onSomeBranch`). Port the source's cases into
   `intent-check-blockers.test.mjs` and `check-intent.test.mjs`, including a
   branch whose copy of the blocker says merged while `main`'s doesn't. AC2.
   Commit.
3. **spawn.** Add `readBlockers` to `session-io.mjs`, and `refuseIfBlocked`
   to `spawn-intent.mjs`, called before the worktree path is computed. Port
   the source's `spawn-intent.test.mjs` cases, asserting the message, a
   non-zero exit, and that no worktree or branch was created. AC4. Commit.
4. **queue, with the orchestrator in the same commit.**
   - `queue-lib.mjs` gets `blockerReport`, `blockedText`, and the new
     `queueLine`, `formatQueue` and `queueData` signatures. `queue.mjs`
     passes `mainMerged` and `knownIds`. Port the queue and queue-lib test
     cases. AC3.
   - Same commit: `state.mjs` builds rows from every key except `problems`
     and puts `problems` on the state.
   - `orchestrator-lib.test.mjs` or a `state` test proves a `queue --json`
     with `problems` gives no stray rows (AC5, first half). Commit.
5. **The orchestrator display.**
   - The row shows the blocked text (B14), with reasons on hover. The
     problems line goes above the lists (B13).
   - `autoLaunch` gets a specific confirm tail for `blocked by` and
     `blocked_by record broken` (B16), with tests.
   - The spawn button is unchanged (B15).

   AC5. Commit.
6. **The skills.**
   - `/auto`: the step 4 "Blockers first" paragraph and the resume-table
     row.
   - `/spawn`: the step 4 refusal and `--base` wording.
   - `/intent`: the `blocked_by` item.
   - `/spec` and `/build-plan`: the Report paragraph.

   Use the source's wording, with the agent names and step numbers adapted
   to heraklios. Commit.
7. **The docs.**
   - `intents/README.md`: the layout line, and the `blocked_by` bullet
     after "The auto fields".
   - `intents/_templates/metadata.yml`: the commented block.
   - `CLAUDE.md`: one line each in "How work flows" (the `/auto` stop list
     gains "an open blocker") and "Parallel sessions" (spawn refuses a
     blocked intent).
   - `sdlc.md`: the spawn paragraph.

   No backfill (I2): say so in the Progress entry. Commit.
8. **The Progress entry.** Set `status: in-review`. Commit.

## Tests

- **AC1** `scripts/blockers-lib.test.mjs` — every source case. Mutants it
  must kill:
  - dropping the self-id check;
  - `isMerged` accepting an empty string;
  - `blockerState` reading a branch's `merged:`;
  - `openChain` not sorting numerically (`'10' < '9'`);
  - `findCycles` reporting a cycle twice.
- **AC2** `scripts/intent-check-blockers.test.mjs` and
  `scripts/check-intent.test.mjs`. An open blocker FAILs with its message;
  each of the following is covered too:

  | Case | Verdict |
  | --- | --- |
  | cleared blocker | PASS |
  | unknown blocker | FAIL |
  | non-digit id | FAIL |
  | the intent's own id | FAIL |
  | item without a reason | a note only |
  | no `blocked_by` key | unchanged |
  | the branch copy says merged, `main` doesn't | FAIL |

  The end-to-end case runs against a temporary git repository, as the
  existing `check-intent.test.mjs` cases do. Mutant: dropping the
  `blockers` argument in `check-intent.mjs` (the end-to-end test fails).
- **AC3** `scripts/queue-lib.test.mjs` and `scripts/queue.test.mjs`:
  - the suffix with direct and further ids in order;
  - no suffix when all blockers are cleared;
  - the Problems block, with each line kind, and no heading when empty;
  - the JSON `blocked_by` (numeric ids), `blocked_by_open` (direct then
    further) and `problems`;
  - a branch-only intent counted as open.
- **AC4** `scripts/spawn-intent.test.mjs`:
  - each of the three refusal messages, a non-zero exit, and no worktree
    directory or branch afterwards;
  - a cleared blocker spawns as before. Use the existing test's
    temporary-repository pattern, with `npm ci` skipped as it is today.
- **AC5** orchestrator tests:
  - a queue JSON with `problems` gives rows only from the groups;
  - `autoLaunch('blocked by 3')` and `autoLaunch('blocked_by record
    broken')` are allowed, with the B16 confirm text;
  - the row text helper gives `blocked by §3 (§2)`.
- **AC6** `npm run verify` green. `npm run queue` on the branch matches
  `main`'s output (no intent declares `blocked_by`). `npm run check:intent`
  on §66's and §70's branches (`npm run check:intent -- <branch>` from the
  main checkout) gives the same verdict before and after, quoted in
  Progress.

## Validation

- `npm run verify` green
- `npm run check:intent` PASS (or ROUTE with a reason recorded in
  review.md)
- `npm run e2e`: not needed. No `src/scenes`, `src/ui`, `src/main.ts` or
  `e2e/` change.
- Live check (owed by rule 3, the orchestrator):
  1. On the branch, add a scratch intent folder, uncommitted, with
     `blocked_by: - 66    scratch`.
  2. `npm run orchestrator` → the scratch row shows `blocked by §66`, with
     the reason on hover.
  3. Spawn shows the refusal and creates nothing.
  4. Set that intent's `auto_stopped: blocked by 66`: Auto's confirm shows
     the B16 text (cancel it).
  5. Make §66's metadata on the branch name the scratch id, forming a
     cycle: the problems line appears.
  6. Remove the scratch edits afterwards.

## Assumptions I made

- **A new test file for the `checkBlockers` cases**, to keep
  `intent-check-lib.test.mjs` (509 lines) from growing. The source put them
  in its `intent-check-lib.test.mjs`.
- **Subtasks 4 and 5 are split, but the JSON shape change and the
  orchestrator's guard land together** (subtask 4), so no commit leaves the
  dashboard broken.
- **The `CLAUDE.md` lines are short additions to existing lists.** The
  source's `CLAUDE.md` diff is not in the `3041c48` range, so the wording
  is heraklios's own.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-21 — implementation (subtasks 1-7)

Commits: `75ef51a` blockers-lib, `39ac69b` check:intent, `97988bb` spawn,
`423caa6` queue plus orchestrator guard, `b48c00f` orchestrator display and
Auto resume, `8e64d38` skills, `056f032` docs (and the status flip in the
commit after it).

Shipped: B1-B18 as in the spec. `npm run verify` green at every commit: 83
test files, 1470 tests at the end (1436 before this work), 21 lint warnings,
cap 21 unchanged. `npm run check:intent` on this branch: PASS.

- **AC1** `scripts/blockers-lib.test.mjs`, 16 tests, every source case in Vitest.
- **AC2** `scripts/intent-check-blockers.test.mjs` (new, 7 tests) and three
  end-to-end cases in `scripts/check-intent.test.mjs`, including the branch
  whose copy of the blocker says `merged:` while `main`'s does not. Mutant:
  dropping `blockers` from the `checkChange` call in `check-intent.mjs` makes
  the three end-to-end cases fail (restored by copy).
- **AC3** `queue-lib.test.mjs` (7 cases) and `queue.test.mjs` (2 git-seam cases).
- **AC4** `spawn-intent.test.mjs` (7 cases): each refusal asserts the message,
  exit 1, no worktree directory and no branch; a cleared blocker spawns.
- **AC5** `state.mjs` builds rows from every key except `problems` and puts
  `problems` on the state, in the same commit as the `queue --json` change
  (`423caa6`). Tests: `server.test.mjs` (no stray rows, `problems` on the
  state, a row's `blocked`), `orchestrator-lib.test.mjs` (`autoLaunch` for
  `blocked by 3` / `blocked by 13` / `blocked_by record broken`, `blockedRow`).
- **AC6** `npm run queue` output on this branch is identical to `main`'s (no
  intent declares `blocked_by`). `npm run check:intent -- <branch>` from this
  worktree, before and after the change:
  - `feat/66-board-animations`: before `FAIL` (size budget: BoardScene.ts has
    3195 lines, over its ceiling of 3173; 25 files changed); after `FAIL`
    (size budget: the branch raises BoardScene.ts from 3173 to 3177 without a
    budget line; 30 files changed). Same verdict; the message differs only
    because §66's branch moved between the two runs (more commits). No
    `blocked_by` line appears in either.
  - `exp/70-unity-front-end-probe`: before `PASS` (13 files); after `PASS`
    (67 files; the branch moved).
- **No backfill (I2):** no `blocked_by` records were added to any existing
  intent, and the source's `blockers-backfill.test.mjs` is not ported. §64 and
  §65 are merged, so a record would be cleared at once.

Differences from the source (`3041c48`), beyond I1-I3 and B13-B16:
- `refuseIfBlocked` takes the lowest open and lowest unknown blocker through
  one small `lowest(state)` helper instead of two copies of the sort (same
  behaviour; keeps the function short).
- `queueData`'s `flat` is indented properly (the source left it misindented).
- The source's tests named their cases with its own spec numbers (`B3:`, `B5:`,
  `F3:`); those prefixes are dropped, as they mean something else here.
- The `checkBlockers` tests live in a new file, not in
  `intent-check-lib.test.mjs` (plan, Assumptions). One extra case checks the
  message without a reason and each broken-record kind alone.
- The skills' wording is the source's with `heraklios-implementer` and
  heraklios's step numbers; the `/intent` item is folded into heraklios's
  step 3 sentence. The `CLAUDE.md` and `sdlc.md` lines are heraklios's own,
  as the plan said, plus a short paragraph in `README.md`'s orchestrator
  section (there is no "Known simplifications" item for this).
- The orchestrator's `blockedRow` reuses queue-lib's `blockedText`; the split
  of `blocked_by_open` into direct and further is by membership in the row's
  own `blocked_by` (the JSON does not mark where the direct ids end).

Not run: the live check (owed to the owner, plan Validation) and `npm run e2e`
(not needed: no `src/` or `e2e/` change).
