<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §50 plan — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

A new `/auto <id>` skill runs the existing steps in the coordinator session:
spec, then the one spec stop, then plan, spawn, implement, review, the
coordinator's re-check, and rework, for at most three review rounds. It
stops for questions, decisions, the live check and the ship. The owner's
start command is recorded as `auto_authorized`, and every stop as
`auto_round` and `auto_stopped`, which `npm run sessions` and `npm run
queue` show. The review gains a "Needs decision:" form and a `run:` header
line. The scan counts quality and sampling by run kind. The pure parts are
in the existing `scripts/*-lib.mjs` modules with tests. The run itself is
skill instructions, and the policy text says what the authorisation
covers.

## Risks

- **Loosening a gate by accident.** The rule text is the control here. The
  authorisation must cover `plan_approved` of one intent and nothing else
  (spec B3, Interpretations). A sentence in `intents/README.md` or
  `REVIEW-POLICY.md` that reads as wider (any gate, any intent, "standing")
  is the worst defect this change can have. The review reads every changed
  policy sentence against spec B1–B3 and "Out of scope".
- **`GATE_RE` must not change.** `auto_authorized` reuses `parseGate`, so the
  gate grammar stays `date` or `date by-agent`
  (`scripts/intent-check-lib.mjs:91`).
- **Tests that pass whatever the code does.** Each new pure function lists
  its mutants below. The skill text has no unit test; review pass 1 and the
  live check carry it.
- **Metadata comments.** `stripComment` drops anything after ` #`
  (`intent-check-lib.mjs:70-86`), so an `auto_stopped` reason containing
  " #" would be cut. The skill writes reasons without `#`, and a test pins
  this.
- **Inline logic in `sdlc-scan.mjs`.** The tier counting
  (`sdlc-scan.mjs:85-116`) is inline and untested. Splitting it by run kind
  there would add untested logic, so it moves into `scan-lib.mjs` first,
  behaviour unchanged, then gains the split.
- **Old reviews.** A `review.md` with no `run:` line must count as
  `manual`, or every past change moves into the wrong bucket and the
  sampling counts shift.
- **Stale line citations; the lint cap (21, never raised).** `scripts/**` is
  linted too.
- **Reviewed tier.** `REVIEW-POLICY.md`, `intents/README.md`,
  `.claude/skills/**` and `.claude/agents/**` change, so the owner reads the
  diff.
- **Not dogfooded on itself.** §50 runs the normal way, by hand. The first
  `/auto` run is the live check.

## Verified against the codebase

Re-read on `main` at `859a0dc`.

- `scripts/intent-check-lib.mjs:45-68` — `parseMetadata`: any `key: value` line; an empty value starts a list
- `scripts/intent-check-lib.mjs:70-86` — `stripComment` drops ` #…` outside quotes
- `scripts/intent-check-lib.mjs:89` — `GATE_FIELDS = ['intent_accepted', 'spec_accepted', 'plan_approved', 'live_checked']`
- `scripts/intent-check-lib.mjs:91` — `GATE_RE = /^(\d{4}-\d{2}-\d{2})( by-agent)?$/`
- `scripts/intent-check-lib.mjs:101-106` — `parseGate` → empty / recorded (owner | agent) / malformed
- `scripts/intent-check-lib.mjs:176-182` — malformed gate → error naming the allowed forms
- `scripts/intent-check-lib.mjs:219-227` — `parseReviewHeader`: `key: value` lines before the first `## ` or `# Round`
- `scripts/sdlc-scan.mjs:52-57` — the review fields read: `verdict`, `tier`, `round`, `sampled`
- `scripts/sdlc-scan.mjs:58-61` — `followsUp`, `merged`, `gates` per intent
- `scripts/sdlc-scan.mjs:85-116` — quality per tier, inline: `tierOf`, `perTier`, `bump`, follow-ups from fix intents' `follows_up`, reverts by `§` in the subject
- `scripts/scan-lib.mjs:17`, `:34`, `:59` — `metadataProblems`, `gateShares`, `artefactOrigins` (72 lines)
- `scripts/session-lib.mjs:173-186` — `GATE_LETTERS`, `gateSummary`, `isRecorded` via `parseGate`
- `scripts/session-lib.mjs:202-222` — `formatStatusTable`, header `['§', 'branch', 'status', 'gates', '±main', 'dirty', 'session', 'port']`
- `scripts/sessions.mjs:50-51` — a row's `status` and `gates` from the worktree's metadata
- `scripts/queue-lib.mjs:62-71` — `queueLine`: `§id  title  [type] status  gates  source  merged`
- `scripts/queue-lib.mjs:86-98` — `queueData` (`--json`) fields
- `REVIEW-POLICY.md:52-56` — sampling "Every fifth attested change"
- `REVIEW-POLICY.md:194-235` — the report format; finding lines use "Needs rework: <minimal fix>." (`:219`)
- `.claude/skills/review/SKILL.md:81-82` (verdict), `:96-98` (`sampled:` by counting attested reviews)
- `.claude/agents/heraklios-reviewer.md:120-140` — "Reporting"
- `.claude/skills/spawn/SKILL.md` step 5 — launches `heraklios-implementer` in the background when the gate is recorded
- `intents/README.md:87-123` — "Who edits what": the request forms, what does not count, "A subagent … never records a gate"
- `intents/_templates/metadata.yml` — the field list with comments
- `CLAUDE.md` "How work flows" — the skill list (`/intent`, `/spec`, …, `/ship`)

## Subtasks

1. **Metadata fields** (`scripts/intent-check-lib.mjs` with its test file).
   - `AUTO_FIELDS = ['auto_authorized', 'auto_round', 'auto_stopped']`.
   - `parseAuto(metadata)` returns `{ authorized: parseGate(...), round:
     number | null, stopped: string | null }`.
   - `checkChange` reports a malformed `auto_authorized` (same grammar and
     message style as a gate) and an `auto_round` that isn't a whole number
     from 1 to 3.
   - Nothing else changes: `GATE_FIELDS`, `GATE_RE` and the gates a type
     needs stay as they are.
   - `intents/_templates/metadata.yml` gains the three keys, empty, with a
     comment.
2. **Visibility** (`session-lib.mjs`, `sessions.mjs`, `queue-lib.mjs`, with
   tests).
   - `autoSummary(metadata)` gives `auto · r2 · live check` when stopped,
     `auto · r2` while running, and `''` without `auto_authorized`.
   - `formatStatusTable` gains an `auto` column after `gates`.
   - `queueLine` appends the summary when it isn't empty, and `queueData`
     gains `auto`.
3. **Scan by run kind** (`scan-lib.mjs`, `sdlc-scan.mjs`, with tests).
   - **Move first, unchanged:** the inline tier counting
     (`sdlc-scan.mjs:85-116`) becomes `qualityByTier({ intents, reverts,
     mergedInWindow })` in `scan-lib.mjs`, with a test pinning today's
     output. Commit.
   - **Then extend:**
     - the review read gains `run`, where missing means `manual`;
     - `qualityByTier` returns the same per-tier object plus `byRun:
       { auto, manual }` in the same shape;
     - `sampleDue({ reviews, run })` returns `{ nth, due }` for the next
       attested change of that run kind: every 3rd for `auto`, every 5th
       for `manual`;
     - `npm run sdlc:scan -- --sample-due <auto|manual>` prints it.
   - The scan's report shows the `byRun` split.
4. **Policy text** (`REVIEW-POLICY.md`, `intents/README.md`, `CLAUDE.md`,
   `sdlc.md`). Each change cites the spec B it implements.
   - **`intents/README.md` → "Who edits what":** one request form added: the
     owner's `/auto <id>` in the current conversation is a request to
     record that intent's `plan_approved`, with `by-agent` and a comment
     naming `auto_authorized`. It covers nothing else (B1, B3). The "What
     does not count" list is unchanged.
   - **`REVIEW-POLICY.md`:**
     - sampling: "every fifth attested manual change, every third attested
       auto-run change" (B14);
     - the report: the `run: auto | manual` header line, and the "Needs
       decision: <the choice>" finding form beside "Needs rework:" (B7);
     - **Merging is unchanged:** `/ship` still needs the owner's request.
   - **`CLAUDE.md` "How work flows"** and **`sdlc.md`**: `/auto` in the skill
     list, one paragraph on what it does and where it stops.
5. **The review side** (`.claude/skills/review/SKILL.md`,
   `.claude/agents/heraklios-reviewer.md`).
   - `/review` writes `run:` (`auto` when called from `/auto`, else
     `manual`) and takes `sampled:` from `npm run sdlc:scan -- --sample-due
     <run>`.
   - The reviewer marks each finding that needs rework "Needs rework:"
     (mechanical: fixed by the spec, plan or a test) or "Needs decision:"
     (the fix chooses a behaviour or changes the spec or plan).
6. **The `/auto` skill** (`.claude/skills/auto/SKILL.md`). Coordinator only
   (main checkout, on `main`). It states B1–B13 as numbered steps:
   - **start/resume:** record `auto_authorized` (B1, B13);
   - **the spec stop** (B2);
   - **the plan:** record `plan_approved` with the authorisation comment,
     or stop if the plan finds the spec incomplete (B3);
   - **spawn and implementer** via `/spawn`'s step 5 (B4);
   - **the review loop** with the cap (B5, B9);
   - **the re-check** (B6): exactly which commands and mutants, and how a
     mismatch stops the run;
   - **the stop rules** (B7, B8, B10, B11). The ship stop runs `npm run ship
     -- <id> --dry-run` and reports "ready: `/ship <id>`";
   - **every stop** writes and commits `auto_round` and `auto_stopped`
     without `#`, and sends a push notification when the tool exists (B12);
   - **the safety rules** carried into every brief: no `npm run ship`, no
     real `saves/`, the lint cap, restore by copy, never kill a process it
     didn't start.
7. **Sandbox and Progress.** Prepare the live-check sandbox (Validation) and note its path. Fill in dates, commits, test counts, mutants. Then set `status:
   in-review`.

## Tests

Vitest (`scripts/*.test.mjs`). Each names the mutant it kills:

- **T1** — `parseAuto`: a date, a date plus `by-agent`, and empty all parse;
  `yes`, a date plus `by-auto` and `2026-1-2` are malformed. *Mutants:*
  `auto_authorized` read by a looser regex; the agent marker dropped.
- **T2** — `checkChange`: a malformed `auto_authorized` and `auto_round: 4`
  are errors; `auto_round: 2` passes; an intent with no auto fields is
  unaffected. *Mutants:* the round range check removed or set to ≤ 4.
- **T3** — the gate grammar didn't widen: `parseGate('2026-10-24 by-auto')`
  is still malformed. *Mutant:* `GATE_RE` widened.
- **T4** — `parseMetadata` of `auto_stopped: live check owed  # note` gives
  `live check owed`, and a reason without ` #` comes back whole. *Mutant:*
  comment stripping removed. It pins why the skill avoids `#`.
- **T5** — `autoSummary`: stopped, running, and absent; the sessions table
  has the `auto` column with that text. *Mutants:* the round omitted;
  shown without `auto_authorized`.
- **T6** — `queueLine` and `queueData` carry the summary only for auto-run
  intents. *Mutant:* always appended.
- **T7** — `qualityByTier` reproduces today's per-tier numbers on a fixture
  (written before the move, run after it). *Mutant:* a follow-up counted
  against the fix's own tier instead of the tier of the intent it follows.
- **T8** — the run split: a fixture with auto and manual reviews and one
  review with no `run:` splits correctly. *Mutants:* missing `run` counted
  as `auto`; follow-ups not split.
- **T9** — `sampleDue`: the 3rd and 6th auto attested reviews are due and
  the 1st, 2nd and 4th are not; the 5th manual is due and the 3rd is not;
  `escalate` and `rework` reviews don't count. *Mutants:* one shared
  counter; a rate of 5 for auto; non-attested counted.

The policy and skill text have no unit test. Review pass 1 reads each
sentence against spec B1–B14 and "Out of scope", at the Reviewed tier.
Mutants restored by copy, never `git checkout --`.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e`: not required. No `src/**` or `e2e/**` change.
- **Live check (owed by rule 3:** the skill's behaviour only shows in a real
  run; AC5). It runs **before the merge, in a sandbox clone**, because
  `/auto` only runs from a main checkout on `main`, and the real `main`
  won't have it until the merge.
  - The implementer prepares it: `git clone` the repo into the scratchpad,
    with `main` reset there to the §50 branch (that clone only, never the
    real repo), `npm ci`, and a small accepted fix intent there.
  - The clone has no remote to push to, and `/auto` never pushes anyway.

  The owner opens Claude Code in that clone:
  1. Type `/auto <id>` for the sandbox fix.
  2. See `auto_authorized` recorded with your words. A fix has no spec, so
     the plan follows; see `plan_approved … by-agent # auto: …`.
  3. Without further prompts it spawns, implements and reviews. Each
     round's `review.md` has a "Coordinator, re-run" block and `run: auto`.
  4. At the first stop, `npm run sessions` shows `auto · r<n> · <reason>`,
     and a push notification arrives if the tool is available.
  5. Close the session, start a new one, type `/auto <id>`: it resumes from
     the recorded round.
  6. It ends at "ready: `/ship <id>`" (or the live-check stop first, when one
     is owed), and nothing ships until you say `/ship <id>`. Don't ship in
     the sandbox; delete the clone afterwards.

  Then record `live_checked` on the real §50 branch and merge as usual.

## Assumptions I made

- **Coordinator-only, like `/ship`.** `/auto` refuses outside the main
  checkout on `main`.
- **`auto_round` 1 to 3**, validated by `check:intent`, so a fourth round
  can't be recorded by mistake.
- **The `auto` column in `npm run sessions`.** Not merged into `status`, so
  scripts that read the status keep working.
- **The tier-counting move is a separate first commit** in subtask 3, with
  T7 written against the old code first: a small refactor inside a
  feature, kept apart and covered by a test.
- **The live check runs in a sandbox clone** whose `main` is the §50 branch.
  The policy wants the check before the merge, and `/auto` only runs from a
  main checkout on `main`. The sandbox also keeps a test run's spawned
  worktree, commits and implementer away from the real repo. The cost: the
  check doesn't exercise the real `origin`. `/auto` never pushes, so that
  part of it is untested by design.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
### 2026-10-23 — subtasks 1 to 7 (implementer)

Commits (all `npm run verify` green at each; lint 21 warnings, cap 21, unchanged):

- `adcb2f8` subtask 1: `parseAuto`, `AUTO_FIELDS`, `AUTO_MAX_ROUND`, `checkAuto` in `intent-check-lib.mjs`; template keys. T1 to T4.
- `4edaa4e` subtask 2: `autoSummary`, the `auto` column, `queueLine`/`queueData`. T5, T6.
- `fe31788` subtask 3, first half, **the move as its own commit**: `qualityByTier` into `scan-lib.mjs`, inline code verbatim. T7 expected numbers were first produced by running a verbatim copy of the pre-move inline code on the fixture (a scratch script, `{attested: 4/1/2, reviewed: 1/1/1}`), and `npm run sdlc:scan` output on this repo is byte-identical before and after (diffed against `git show HEAD:scripts/sdlc-scan.mjs`).
- `f936661` subtask 3, second half: `runOf`, `qualityByRun`, `sampleDue`, `--sample-due <auto|manual> [--exclude <id>]`, the `run` header read, the report's per-run block. T8, T9.
- `ddc8c4c` subtasks 4 to 6: `.claude/skills/auto/SKILL.md`; `intents/README.md`, `REVIEW-POLICY.md`, `CLAUDE.md`, `sdlc.md`; `/review` skill 0.1.5 and the reviewer agent; a tightened T6 assertion.
- the commit that holds this entry: Progress and `status: in-review` (subtask 7).

Tests: 57 files, 977 tests (`npm run verify`). `npm run check:intent`: PASS (intent 50, feature). No `src/**` or `e2e/**` change, so no e2e run.

Mutants (full vitest per mutant, backup and restore by copy, `git status --short` clean after each), 16, all killed:

| Mutant | Killed by |
| --- | --- |
| `auto.round > AUTO_MAX_ROUND` to `> 4` | T2 `auto_round "4" is an error` |
| `GATE_RE` widened to `by-[a-z]+` | T1 `by-auto` malformed, T3, the existing `by-claude` and malformed-gate tests |
| `by:` always `owner` | T1, `parseGate` by-agent test, `gateShares` test |
| `authorized` read by a looser rule | T1 (several) |
| comment stripping removed | `parseMetadata` tests (T4 included in the file) |
| round omitted from `autoSummary` | T5, T6 |
| `autoSummary` shown without `auto_authorized` | T5, T6 |
| `queueLine` always appends the summary | **survived at first** (an empty string in the middle is not a trailing space); T6 now asserts no run of 3 spaces, and the mutant is killed by it |
| follow-up counted against the fix's own tier | T7, T8 |
| missing `run:` counted as `auto` | T8 (two tests), T9 |
| follow-ups not split by run | T8 (two tests) |
| reverts not split by run | T8 (two tests) |
| `sampleDue` one shared counter | T9 `the two kinds count separately` |
| rate 5 for auto | T9 (three tests) |
| non-attested counted | T9 `escalate, rework and unreadable verdicts do not count` |
| `excludeId` ignored | T9 `the intent under review is left out` |

Divergences from the plan:

- **`qualityByRun` is a separate function.** The plan has `qualityByTier` return the per-tier object "plus `byRun`". Adding a `byRun` key would put a non-tier key among the tier names the report iterates, so `qualityByTier` keeps its T7-pinned shape (with an optional run-kind filter argument) and `qualityByRun` returns `{ auto, manual }` of that shape. The scan's JSON gains `perRun`.
- **`auto_round` is written at the start of each review round, as well as at a stop** (skill step 5.2 and 9). B12 says on each stop; B13 needs the round to survive a closed session that never stopped cleanly, and `npm run sessions` shows `auto · r<n>` while running only if it is written then.
- **`--exclude <id>`** on `--sample-due`: not in the plan. `/review` runs before the intent's own `review.md` exists in round 1, but in later rounds an earlier round's `review.md` is there and would count as another change.
- **`README.md` (the game's) is untouched**: it has no SDLC section and no "Known simplification" for this item.
- The `/review` skill is bumped 0.1.4 to 0.1.5 (stamp and metadata).

Live-check sandbox (plan, Validation): a clone with no `origin`, at `C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/auto-sandbox`, its `main` set to the final §50 commit, `npm ci` done, and one accepted fix intent committed on its `main`: **§91 `clip-nonpositive-max`** (`clip('abc', 0)` returns `'ab…'`; fix it in `scripts/session-lib.mjs` with a test in `scripts/session-lib.test.mjs`). Its `intent_accepted` is set by the setup (comment says so), not by the owner. Port for a spawned §91 worktree is 5291. Delete the clone after the check; never ship from it.
### 2026-10-23 — review round 1 rework (implementer)

Read `review.md` (`da3ce47`) and the amended spec (`810ad37`: B5 escalate continuation, B12 `auto_round` at each round start, B13 resume by stop reason). One commit (the one that holds this entry); `verify` green, lint 21 of 21, `check:intent` PASS.

- **F1:** `CLAUDE.md` and `.claude/skills/spawn/SKILL.md` now say "outside an `/auto <id>` run (`.claude/skills/auto/SKILL.md`)" before "unprompted"; "records a gate or merges" kept (as "never records a gate or merges").
- **F2/F3:** the `/auto` skill's "first step not done" resume is replaced by the amended B13 table keyed on `auto_stopped`: decision or amendment gives the implementer the owner's answer and then round n+1; a re-check mismatch redoes the re-check for round n with no new round; `escalate` goes on to the live-check or ship stop with no new round; live check owed, out of rounds, ready for /ship and the red/agent-error/held-worktree stops each have a row. Step 5 says a new round is `auto_round` + 1 and passes the cap, the "no new round" resumes do not, and that `auto_round` is written at each round start (B12 as amended). The escalate stop line in step 5 points at the continuation.
- **F4 and the LOWs:** the review-header read and the `--sample-due`/`--exclude` handling moved from `sdlc-scan.mjs` into `scan-lib.mjs` (`parseReviewFields`, `sampleDueCommand`); the sessions row's metadata columns into `session-lib.mjs` (`metadataColumns`). `run` is read from the header only and only when exactly `auto` or `manual`, else null (counts as manual), so the template line `run: auto | manual` no longer counts as auto. `--sample-due` with no value, `--json` as the value, an unknown value or a bare `--exclude` prints a usage line to stderr and exits 2 (checked by running the CLI).
- **F6:** the stop lists in `CLAUDE.md` and `sdlc.md` now include escalate, a spec or plan amendment, out of rounds, a re-check mismatch, a held worktree and an agent error.
- **LOW, existing plan.md:** step 3 of the skill stops with `plan exists unapproved, owner decides` when a `plan.md` exists and `plan_approved` is not recorded, and records `plan_approved` only for a plan the run drafted. The resume table has a row for it.
- Left alone: the historical-sampling LOW (older than §50).

Mutants, full vitest each, restored by copy, `git status --short` clean after: all 16 earlier ones re-run and killed (same killers; the `queueLine` one by T6), plus 5 new, all killed: MS1 `run` read dropped (parseReviewFields tests), the strict `auto`/`manual` rule loosened (the template-line test), MS3 `--exclude` ignored (sampleDueCommand MS3 test and the usage test), the value check removed (usage test), MS2 `auto` dropped from the sessions columns (metadataColumns MS2 test).

Sandbox (the clone only): `main` reset to this branch's final commit with the §91 intent commit re-applied on top; a local bare `origin` at `scratchpad/auto-origin.git` with `main` pushed; `git remote -v` shows only that folder. `ship.mjs` was not run. Paths: sandbox `C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/auto-sandbox`; bare repo `.../scratchpad/auto-origin.git`.
### 2026-10-23 — review round 2 rework (implementer)

Read `review.md` (`3c3d80a`). Commits: the "review round 2 rework" commit, plus the commit holding this entry. `verify` green (57 files, 988 tests, lint 21 of 21); `check:intent` FAIL only for the owed live check, as the review said.

- **R2-1:** the `/auto` resume gains the empty-`auto_stopped` fallback ("the first step whose work is not done"; in the review loop a new round only if the implementer committed since round `auto_round`'s `review.md`, else the same round's review is redone; an empty `auto_round` is round 0, build then round 1). The re-check mismatch row redoes the review as the same round when the reviewer's report is not in the conversation. Step 1 item 3 no longer clears `auto_stopped` at the resume: it is cleared in the first commit the resumed step makes (the round-start write of step 5, a recorded live check, the ship stop).
- **R2-2:** step 8's precondition is "`attest`, or `escalate` after the owner's diff read". Spec B10 untouched.
- **R2-3:** at the out-of-rounds stop `auto_round` stays at 3; step 9 says never above 3.
- **R2-4:** `CLAUDE.md`: "never records `spec_accepted` or `live_checked` without the owner's yes; the `/auto` authorisation covers neither".
- **R2-5:** "plan exists unapproved" and "ship dry-run blocked" added to both stop lists, the fourth open session to `CLAUDE.md`.
- **R2-6:** a CRITICAL finding has its own resume row, like a decision: the implementer first, then a new round.
- **LOW:** `--exclude --json` added to the usage test; the `startsWith('--')` mutant is killed.

Mutants from the reviewer's batch (`scratchpad/mut50`, #2 to #18, one at a time, full vitest each, restored by copy, `git status --short` clean after; #0 and #1 were run by the reviewer): 14 killed (#2 to #10, #12 to #16, by the `parseReviewFields`, `sampleDueCommand` and `metadataColumns` tests named in the log), 3 survived:
- #11 `reviews` not filtered for intents with a review: **equivalent**. An intent without a review becomes `{id}` with no `verdict`, which `sampleDue` never counts (it needs `verdict === 'attest'`).
- #17 `sdlc-scan.mjs` drops `run` after `parseReviewFields`, and #18 `sessions.mjs` drops the metadata columns: both are the one-line glue in the two CLI scripts, which have no test harness; the lib functions they call are covered (MS1 and MS2 in the lib). Known and left as is.

Sandbox (the clone only): `main` set to this branch's final commit with the §91 intent commit re-applied, force-pushed to the local bare `auto-origin.git`; `git remote -v` shows only that.
