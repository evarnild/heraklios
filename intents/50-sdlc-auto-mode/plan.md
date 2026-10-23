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
