<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §47 plan — The intent queue is generated from metadata.yml; the root plan.md stops carrying status

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Replace the hand-kept queue in the root `plan.md` with `npm run queue`, a
command that reads every intent's `metadata.yml` (from its branch while
unmerged, else from `main`) and git, and retire the root `plan.md`: its
snapshot, history map, pre-§26 shipped list and two carried-over backlog
items go to a short `OVERVIEW.md`, its agent workflow and runbook (§1, §4)
to `docs/runbook.md`. Every rule, skill, agent, script and doc that writes
a status row or points at "plan.md §4" changes accordingly, and `/ship`
loses its `plan.md` bookkeeping, so nobody edits a queue again (spec
B1–B7).

## Risks

- **Stale line citations** (this repo's recurring class): §45 and §46 moved
  `main` since the spec was written at `c617fcb`; every line below was
  re-read at `d6d77a1`. The implementer re-greps before each edit rather
  than trusting a line number.
- **Tests that pass whatever the code does:** a queue grouping test that
  only checks counts, or a `--next-id` test whose fixture has the max on
  `main` anyway. Each test below names the mutant it kills.
- **A missed pointer:** ~40 references across 15 files outside `src/`.
  AC3's grep is the net, run by the implementer and again by the review.
- **Breaking `/ship` mid-flight:** removing the `plan.md` half changes
  `isBookkept` and `moveRowToShipped`'s callers; the 31 sandbox tests in
  `scripts/ship.test.mjs` must stay meaningful (rewritten, not deleted
  wholesale). Never run `ship.mjs` against the real repository.
- **Status from a branch that's merged:** a merged branch not yet deleted
  must read from `main` (B2), or a shipped intent shows as in-review.
- **Windows:** CRLF/LF mixes in the files moved (`plan.md` is CRLF on
  checkout); `git ls-tree`/`git show` output with `\r\n`.
- **Encoding:** the moved text has "—", "§", "⚠️"; every new or changed
  file is checked with `iconv -f UTF-8 -t UTF-8` (two Latin-1 slips in
  §38/§44).
- **Lint cap 21:** new scripts stay within the guardrails (file ≤500 lines,
  function ≤80); never raise the cap.
- **Old code comments:** ~250 "plan.md §N" comments in 31 `src/` files
  point at sections already archived in `plan-history.md`. Owner's decision
  (2026-10-22): leave them; `OVERVIEW.md` says what they mean; AC3 excludes
  `src/` (spec amended).

## Verified against the codebase

Re-read on `main` at `d6d77a1`.

- `plan.md:15` "How To Manage This Plan", `:45` "Archiving to
  `plan-history.md`", `:71` Current Snapshot, `:166` Current Queue (`:171`
  Shipped, `:222` In flight, `:227` Queued), `:239` Backlog Map (the §19.5
  follow-up and the "Owed" browser pass), `:262` History Map, `:338` §1
  Agent workflow (`:395` "Editing this plan while a run is in flight"),
  `:422` §4 Runbook (`:447` "The `node_modules` problem", `:522` "`npx
  tsc` can report a false green").
- `plan-history.md` — 13 links into the root file: `plan.md#1-agent-workflow`
  ×1, `#10-sequenced-queue` ×5, `#21-elephant-drift-…` ×1,
  `#4-runbook-detailed-launch-hazards-appendix` ×6.
- `scripts/session-io.mjs:53` `readIntentMetadataFromBranch(root, id)` (one
  branch per id, `git ls-tree` + `git show`), `:80` `readIntentMetadata`,
  `:41` `findIntentDir`.
- `scripts/session-lib.mjs:21` `branchFor`, `:173-181` `gateSummary` —
  prints `I·S·P` (the summary the queue reuses), `:263` the spawn
  brief's "Do not edit `plan.md`. Its queue row is the coordinator's job."
  (pinned by
  `scripts/session-lib.test.mjs:318`).
- `scripts/sdlc-scan.mjs:75` `isPlanOnly = (s) => /^Plan[:\s]/i.test(s)` —
  by subject; untouched (B7).
- `scripts/spawn-intent.test.mjs:47-48` — the sandbox harness
  (`mkdtempSync(join(tmpdir(), 'h27-spawn-'))` in `beforeAll`).
- `scripts/spawn-intent.mjs:7`, `:127` — "plan.md §4".
- `scripts/ship.mjs:32` imports `moveRowToShipped`; `:129-133`
  `checkPlanClean`, called at `:144`; `:159` `isBookkept(meta, plan.md
  text, id)`; `:258-272` `bookkeepPlan`; `:291` `edits =
  [bookkeepMetadata, bookkeepPlan]`; `:297`, `:299` messages naming
  "plan.md row to Shipped".
- `scripts/ship-lib.mjs:2` header, `:12` step label "bookkeeping commit
  (metadata.yml, plan.md)", `:191-210` `moveRowToShipped`, `:213-216`
  `isBookkept` (needs `isShipped(planText, id)`).
- `scripts/ship.test.mjs:53` and `:131` the sandbox's `plan.md`, `:176-179`
  the Shipped-row assertions, `:204-218` the dirty-`plan.md` test, `:422`
  and `:695` bookkeeping commit file lists, `:563-576` the no-Shipped-table
  test; `scripts/ship-lib.test.mjs:178-…` `moveRowToShipped` tests and
  `isShipped` import.
- `package.json:13-17` — `check:intent`, `sdlc:scan`, `spawn`, `ship`,
  `sessions`; `queue` goes beside them.
- Root-`plan.md` references to change (B4, B5):
  - `CLAUDE.md:44` (§4), `:62` (coordinator view), `:119`, `:125` (who
    edits `plan.md`), `:144` (§4), `:171` ("plan.md §6.3" →
    `plan-history.md` §6.3).
  - `AGENTS.md:10`, `:15`, `:40`.
  - `REVIEW-POLICY.md:140` (bookkeeping: "the `plan.md` row to Shipped").
    `:148`, `:168`, `:174` mean the intent's `plan.md` — keep, `:168`
    reworded "the intent's `plan.md`" if ambiguous.
  - `intents/README.md:8` (coordinator view), `:26` (id numbering), `:164`
    ("`plan.md`'s queue mirrors it"); `:20`, `:85`, `:114`, `:118`,
    `:124`, `:128` are the intent's own — keep.
  - `intents/_templates/metadata.yml:7` ("as it appears in plan.md's
    queue").
  - `sdlc.md:13` (next id), `:88` (merge bookkeeping); `:31` is the
    intent's — keep.
  - `.claude/skills/intent/SKILL.md:35` (gather), `:62` (id), `:75-78`
    (queue row, §4.4); version and stamps 0.1.4 at `:6`, `:19-20`.
  - `.claude/skills/sessions/SKILL.md:15`, `:40` (step 5, queue drift).
  - `.claude/skills/spawn/SKILL.md:35` (step 5, update the queue), `:61`
    (§4), `:65` (row to Shipped).
  - `.claude/skills/review/SKILL.md:49` (§4); `:30` is the intent's — keep.
  - `.claude/skills/ship/SKILL.md:26`, `:57`.
  - `.claude/agents/heraklios-implementer.md:3` ("plan.md backlog"), `:26`
    (§4), `:31` ("do NOT edit `plan.md`"); `:16`, `:36` are the intent's.
  - `.claude/agents/heraklios-reviewer.md:3`, `:62`, `:69` (§4), `:98`,
    `:114`.
  - `.codex/agents/heraklios-implementer.toml:12`, `:14`; `:8` is the
    intent's.
- No reference in `README.md`, `docs/`, `*.json` or shell scripts; no
  `OVERVIEW.md` or `docs/runbook.md` yet.

## Subtasks

Each ends with `npm run verify` green and a commit.

1. **`scripts/queue-lib.mjs` + `scripts/queue-lib.test.mjs`** — pure:
   `groupIntents(entries)` → In flight / Queued / Shipped (newest first by
   merge order) / Stopped; `queueLine(entry)` (`§id`, title, type, status,
   gates, source `branch`/`main`, hash); `pickSource(mainMeta, branchMeta,
   branchMerged)` (B2); `nextId({ historyText, overviewText, ids })` (B6:
   max over `§N` in the two texts and the ids given, plus one). No git or
   fs here.
2. **`scripts/queue.mjs`** — the git half: list `intents/*/metadata.yml`
   on `main` (`git ls-tree`), for each id find its branch (reuse
   `readIntentMetadataFromBranch` from `session-io.mjs`), test
   `git merge-base --is-ancestor <branch> main`; collect ids from every
   local branch's `intents/` (`git for-each-ref refs/heads` + `git
   ls-tree --name-only <b>:intents`); print text, `--json`, `--next-id`.
   `package.json` gets `"queue": "node scripts/queue.mjs"`.
   **`scripts/queue.test.mjs`** — sandbox repo in the
   `spawn-intent.test.mjs` style (AC2).
3. **`docs/runbook.md`** — §1 and §4 of the root `plan.md` moved verbatim
   (headings keep "1." and "4." so "§4" still finds it), minus the queue
   rules in "Editing this plan while a run is in flight" that no longer
   apply.
4. **`OVERVIEW.md`** — header (what it is, how to archive into
   `plan-history.md`, "the queue: `npm run queue`"), Current Snapshot,
   the pre-§26 Shipped rows as a static list, "Carried over" (§19.5
   follow-up, the owed browser pass), History Map, and one line: "Code
   comments that say `plan.md §N` predate this file; that section is in
   `plan-history.md`." Then `git rm plan.md`, and re-link the 13
   `plan-history.md` links (`#1-…`, `#4-…` → `docs/runbook.md#…`;
   `#10-sequenced-queue` → `OVERVIEW.md`, with "now `npm run queue`";
   `#21-…` → its `plan-history.md` anchor).
5. **`/ship` without `plan.md`** — `ship.mjs`: drop `checkPlanClean` and
   its call, `bookkeepPlan`, the `moveRowToShipped` import; `isBookkept`
   takes metadata only; messages and the step label say "metadata.yml"
   only. `ship-lib.mjs`: remove `moveRowToShipped`, `isShipped`,
   `shippedRow` if unused, and their tests; update `isBookkept`'s tests.
   `ship.test.mjs`: the sandbox has no `plan.md`; the dirty-`plan.md` and
   no-Shipped-table tests go; the bookkeeping-commit file lists become
   `[metadata.yml]`; the atomicity test keeps a rejecting hook (the M2
   case still exists for one file). `SKILL.md` lines 26, 57.
6. **Rules and skills (B4)** — `/intent` 0.1.5: §2 gather reads
   `OVERVIEW.md` and draft intents (`npm run queue`), §4.1 id from `npm
   run queue -- --next-id`, §4.4 removed (renumber), stamps bumped in
   `SKILL.md` and its template references. `/sessions`: step 1 adds `npm
   run queue`, step 5 and the "changes nothing except …" sentence go.
   `/spawn`: step 5 and the "move the row to Shipped" step go, §4 →
   `docs/runbook.md`. `REVIEW-POLICY.md:140`. `CLAUDE.md`, `AGENTS.md`,
   `intents/README.md`, `sdlc.md`, `intents/_templates/metadata.yml`, both
   Claude agents, the Codex agent, `session-lib.mjs:263` + its test: "the
   queue is generated (`npm run queue`); nobody edits it".
7. **Pointers (B5)** — every "plan.md §4" → "`docs/runbook.md` §4"
   (`CLAUDE.md:44`, `:144`, agents, `/review:49`, `/spawn:61`,
   `spawn-intent.mjs:7`, `:127`); `CLAUDE.md:171` → `plan-history.md`
   §6.3. Run AC3's two greps and paste them in Progress.
8. **Progress** — AC4 sample (`npm run queue` against `metadata.yml` of
   five intents §26–§48), test counts, mutant results; `status:
   in-review`.

## Tests

- `queue-lib.test.mjs` (AC1), each killing a named mutant:
  - grouping: one fixture per status (accepted, in-progress, in-review,
    draft, done, abandoned, deferred) lands in its group — kills "drop the
    Stopped group" and "abandoned counted In flight";
  - shipped order: two done intents whose merge order differs from id
    order sort by merge, newest first — kills "sort by id";
  - `pickSource`: unmerged branch with `in-review` while `main` says
    `accepted` → branch; merged branch → `main`; no branch → `main` —
    kills "read status from main always" and "ignore branch-merged";
  - `nextId`: the max is only in a branch's ids → max+1; only in
    `plan-history.md` text → max+1; only in `OVERVIEW.md` → max+1 — kills
    "ignore branches", "ignore history", "ignore overview"; `§6.13`-style
    sub-numbers count as 6.
  - line: hash shown for shipped only; source shown.
- `queue.test.mjs` (AC2), sandbox: two intents on `main`, a branch for one
  carrying `status: in-review` → `npm run queue` shows it In flight,
  in-review, `branch`; after merging that branch the line reads `main`;
  `--next-id` counts an intent folder that exists only on a branch;
  `--json` parses and has the same entries.
- `ship-lib.test.mjs` / `ship.test.mjs`: `isBookkept` true only with
  `status: done` and a non-empty `merged:` (the empty-`merged:` case kept);
  the bookkeeping commit holds exactly the intent's `metadata.yml`; a
  rejecting hook leaves `git status` clean; mutants: re-adding a
  `plan.md` path to the commit fails (sandbox has none → git error),
  dropping the restore fails the hook test.
- `session-lib.test.mjs:318` rewritten to the new brief line.
- Full suite per mutant, files backed up and restored by copy, never
  `git checkout --`.

## Validation

- `npm run verify` green, lint ≤ 21 (AC6).
- `npm run check:intent` PASS (AC6).
- AC3: `git grep -n "plan\.md" -- ':!plan-history.md' ':!intents/*/'
  ':!intents/_templates/plan.md' ':!src'` finds only the intent's own
  `plan.md`; `git grep -n "§4"` outside history and intents names
  `docs/runbook.md`. Pasted in Progress and re-run by the review.
- AC4: `npm run queue` on the branch lists §26–§48 with their statuses; the
  review compares a sample.
- `npm run e2e`: not needed (no `src/scenes`, `src/ui`, `src/main.ts`,
  `e2e/` path).
- Live check (AC5, rule 3: skills' behaviour shows only when they run), in
  a session in the worktree: `/intent --feature throwaway: …` writes no
  queue row and takes its id from `npm run queue -- --next-id`; `/sessions`
  shows `npm run queue` and has no drift step; then delete the throwaway
  intent, commit nothing. And from the main checkout after merge, the first
  `/ship` run writes only `metadata.yml`.

## Assumptions I made

- **Gate letters:** the queue reuses `gateSummary` (`I·S·P`, what
  `npm run sessions` prints); the spec amendment corrected its "I·S·P·L".
- **Shipped order:** by merge order on `main` (`git log --merges
  --first-parent`), falling back to id; the merge hash in `metadata.yml`
  is the link.
- **`/intent` stays the one place an id is taken**; `npm run queue --
  --next-id` only computes it.
- **The §19.5 follow-up and the owed browser pass** move verbatim to
  "Carried over"; turning them into intents is out of scope (spec).
- **No compatibility stub `plan.md`** (spec Assumptions); old commits and
  `plan-history.md`'s archived text keep their references.
- **`/ship`'s `M2` atomicity code stays** even with one file: a hook can
  still reject the commit.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-22 — all eight subtasks

Commits (branch `feat/47-queue-from-metadata`, from `83ee9c8`):

- `e1864b1` queue-lib (subtask 1)
- `eba2f3a` queue.mjs, `npm run queue`, sandbox test (2)
- `7ba7990` `docs/runbook.md`, `OVERVIEW.md`, root `plan.md` removed, 13
  `plan-history.md` links re-pointed (3, 4)
- `928f107` `/ship` without `plan.md` (5)
- `096207a` rules, skills, agents and pointers (6, 7)
- the Progress commit (8)

What shipped:

- `npm run queue [-- --json | --next-id]`: In flight, Queued, Shipped (newest
  merge first, by position on main's first-parent log), Stopped, plus an
  "Unrecognised status" group shown only when non-empty. Status comes from
  the intent's branch while that branch exists and is unmerged, else from
  `main` (B2); each line says `branch` or `main`.
- `docs/runbook.md` (sections 1 and 4, queue pointers removed),
  `OVERVIEW.md` (header, snapshot, pre-§26 shipped list, carried over,
  history map), root `plan.md` removed.
- `/ship`: `checkPlanClean`, `bookkeepPlan`, `moveRowToShipped`, `isShipped`,
  `shippedRow` and `eolOf` gone; `isBookkept(metadata)`; the bookkeeping
  commit holds only `metadata.yml`. The atomicity code stays for one file.
- Rules: `/intent` 0.1.5 (no queue row; id from `--next-id`), `/sessions`
  (no drift step; step 1 adds `npm run queue`), `/spawn` (no queue steps,
  renumbered), `REVIEW-POLICY.md`, `CLAUDE.md`, `AGENTS.md`,
  `intents/README.md`, `sdlc.md`, the template, both Claude agents, the Codex
  agent, `session-lib.mjs` brief and its test, `spawn-intent.mjs` messages.

Tests: `npm run verify` green, 55 files / 911 tests (main had 54 / 917:
`queue-lib.test.mjs` 15 and `queue.test.mjs` 4 added, 25 `ship`/`ship-lib` tests net
that checked the `plan.md` half removed or rewritten), lint 21 warnings (cap
unchanged). `npm run check:intent`: PASS. Mutants on `queue-lib.mjs`, each
killed by the unit tests: status from `main` always; `nextId` ignoring the
branch ids; `nextId` ignoring `plan-history.md`; abandoned counted In
flight; Stopped group dropped; shipped sorted by id. Run on copies, restored
by copy.

AC3, run on the branch (`git grep -n "plan\.md" -- ':!plan-history.md'
':!intents/*/*' ':!intents/_templates/plan.md' ':!src'`). Every hit is an
intent's own `plan.md` or the generic artefact name (`.claude/agents`,
`build-plan`, `review`, `.codex`, `REVIEW-POLICY.md:148,168,174`,
`intents/README.md:22,89,118,122,128,132`, `sdlc.md:31`, `scripts/` fixtures
and the check-intent/scan rules, `docs/runbook.md:61`), except one, which the
spec asks for:

```
OVERVIEW.md:17:- **Code comments that say `plan.md §N`** predate this file: that section is
```

The "§4" grep (`git grep -n "§4" -- ':!plan-history.md' ':!intents/*/*'
':!src'`) finds every runbook pointer naming `docs/runbook.md`:

```
.claude/agents/heraklios-implementer.md:26:   junction it (`docs/runbook.md` §4) and never trust bare `npx tsc`. ...
.claude/agents/heraklios-reviewer.md:62:tree's install. See `docs/runbook.md` §4.
.claude/agents/heraklios-reviewer.md:69:"clean" on this project more than once (`docs/runbook.md` §4). ...
.claude/skills/review/SKILL.md:49:`docs/runbook.md` §4 — never junction into a worktree you'll delete, ...
.claude/skills/spawn/SKILL.md:59:   `node_modules` is a link (`docs/runbook.md` §4). Report the refusal ...
CLAUDE.md:45:`npx tsc`, which false-greens without a local install (`docs/runbook.md` §4). ...
CLAUDE.md:147:  from `npm ci`, never a junction (`docs/runbook.md` §4).
scripts/spawn-intent.mjs:7:// a junction; see docs/runbook.md §4), a reserved dev port, ...
scripts/spawn-intent.mjs:127:    fail(`${nm} is a link. Removing the worktree would wipe its target (docs/runbook.md §4). ...
```

(`CLAUDE.md:205`, `OVERVIEW.md:4` and `docs/runbook.md:4` also match "§4" as
part of "§45" or "§47" or as the quoted "§4" in the runbook's header; they
are not pointers.)

AC4, `npm run queue` on the branch against each `metadata.yml` (sample):

```
In flight (3)
  §30 ... [experiment] in-review  I  branch
  §47 ... [feature] accepted  I·S·P  branch
  §48 ... [fix] accepted  I·P  branch
Queued (1)
  §29 ... [feature] draft  -·-·-  main
Shipped (19)
  §46 ... [feature] done  I·S·P  main  d2d841a
  §45 ... [feature] done  I·S·P  main  56bda03
  §44 ... [feature] done  I·S·P  main  364afc5
  ...
  §26 ... [refactor] done  I·P  main  568f2a6
```

`metadata.yml` holds `done` / `merged:` d2d841a, 56bda03, 568f2a6 for §46,
§45, §26, and `accepted` for §48 (read from its branch).

Divergences from the plan:

- Subtasks 6 and 7 are one commit (the pointer edits touch the same files as
  the rule edits).
- `README.md` is unchanged: it had no queue or `plan.md` reference and no
  "Known simplification" for this.
- `/ship`'s `SKILL.md` and the `/sessions` and `/spawn` skills keep their
  `version:`; the spec bumps only `/intent`.
- `npm run queue` also lists an "Unrecognised status" group when a
  `metadata.yml` holds a status outside the seven in `intents/README.md`
  (not in the spec; it shows rather than hides a typo).
- `queue.mjs` reads `plan-history.md` and `OVERVIEW.md` from `main` and from
  the working copy, so a branch's own edit counts in `--next-id`.
- The first-parent log is searched for the merge hash by prefix; a hash not
  found sorts the intent after the known ones, by id.
- Not checked: AC5 (the live check of `/intent`, `/sessions` and `/ship` as
  skills) is the owner's; no skill was run.

### 2026-10-23 — round 2 (review round 1, verdict rework)

Commit `c73bb12` (code, tests, docs) and the Progress commit after it.

Review findings fixed:

- **B2, main wins (owner's amendment, spec 902bf49).** `pickSource` returns
  `main` whenever `main`'s `metadata.yml` holds `done`, `abandoned` or
  `deferred`, whatever an unmerged branch says. Unit tests per terminal
  status and for the non-terminal statuses still reading the branch; a
  sandbox case with a branch left unmerged after `main` says `done`. On the
  real repo `npm run queue` now lists §30 under Shipped with `f755609`.
- **Uncommitted intent folders.** `--next-id` also counts the folder names
  under the checkout's own `intents/` (sandbox case with an untracked
  folder: 71, back to 61 once removed). For the listing I took the smaller
  change: the listing stays "committed intents (on `main`)", and
  `/intent` SKILL.md and `OVERVIEW.md` now say a draft is listed under
  Queued "once committed". No `working copy` source was added.
- **Git-half tests.** A second shipped intent merged after §2 with a lower
  id, asserting the Shipped order (R4, R7 killed); `--json` `source:
  'branch'` for an in-review entry and `source: 'main'` for the shipped one
  (Q24 killed); `--next-id` with a higher `§N` only in an uncommitted
  `OVERVIEW.md` (R1 killed), then only on `main` (R2 killed). R9 and R10
  (the surviving cosmetic/near-equivalent mutants) stay unkilled on purpose.
- **`/ship` S9.** `ship.test.mjs`: a branch whose `metadata.yml` lacks
  `merged:` stops with `STOPPED bookkeeping … could not prepare the
  bookkeeping (nothing was written)`, `git status` clean, the merge kept
  (S9, the try/catch removed, now killed).
- **`docs/runbook.md`** link to `../plan-history.md#13-…`.
- **Branch conflict.** `collectEntries` catches the duplicate-id throw per
  id and shows `main`'s metadata with source `branch conflict` (sandbox
  test with two `fix/5-*` branches).
- **Dropped "How To Manage This Plan" parts** (Workflow defaults table,
  "Preserve useful postmortems", "Treat line references as unstable") moved
  to `docs/runbook.md` §1.
- **Nits:** the two doubled blank lines; the `/ship` SKILL.md design note
  says the `plan.md` bookkeeping was removed by §47.

Corrections to round 1's Progress: `main` had 53 files and 902 tests (not
54 / 917), and net 10 `ship`/`ship-lib` tests were removed (902 - 10 + 19 =
911), not 25. The AC3 pathspec that excludes the intent folders is
`':!intents/*/*'` (the spec's `':!intents/*/'` leaves their 175 lines in).

Tests now: 55 files, 922 tests, lint 21 (cap unchanged), `check:intent`
PASS. Mutants re-run on copies, restored by copy: R4, R7, R1, R2, Q24, the
main-wins mutant, the on-disk ids mutant, the conflict-catch mutant and S9
all killed; none survived. `/sessions` and `/spawn` still keep their
`version:` (the spec bumps only `/intent`).
