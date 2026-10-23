<!-- generated-by: heraklios/intent@0.1.5 -->
# §50 — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

**Type:** feature
**Originator:** the owner, while running §47–§49 through the coordinator
**Source:** none (design discussed in the coordinator session, 2026-10-23)

## Problem

Every intent waits on the owner between steps whose outcome is usually
"yes": accept the spec, approve the plan, spawn, resume the implementer for
rework, run the next review round. In §47–§49 most of the owner's messages
were of that kind ("yes", "resume implementers", "resume implementer for
49 rework", "/review 49"). The owner's real decisions came in only a few
places:
- design questions (§49's four spec answers);
- a design choice a review raised (§47's "main wins");
- authorising a spec change (§49's "fix the spec");
- the live check and the merge.

The waits between the routine steps cost hours of elapsed time. They are
also gates the owner passes without new information, which wears down what
a gate is for.

The rules also forbid shortcutting them today. A gate is recorded only "on
your request in the current conversation", naming the gate or answering a
proposal (`intents/README.md` → "Who edits what"). A merge needs "the owner
explicitly asks for that action" (`REVIEW-POLICY.md` → "Merging"). A
subagent "never records a gate".

## Outcome

- **One start:** a single owner command, for example `/auto <id>`, takes an
  accepted intent through spec (feature), plan, implementation, review and
  up to three rework rounds with no further prompt. It stops for the owner
  only:
  - for a question round (the spec's, or a review finding that needs a
    decision);
  - for the live check, when one is owed;
  - for the ship.
- **The authorisation is visible:** the owner's start command is recorded in
  `metadata.yml` with their words, the way gates are. Every gate the run then
  records points to that one authorisation. `npm run sessions` and
  `npm run queue` show a run's round and why it last stopped.
- **The usual checks still run:** each round runs every pass in
  `REVIEW-POLICY.md`. An independent re-check, scripted rather than left to
  the coordinator's judgement, re-runs the claims the review and the
  implementer quote, and a mismatch stops the run.
  - `npm run sdlc:scan` counts follow-up fixes for auto-run changes
    separately, so the grid shows whether the mode costs quality.

## Constraints

- **The owner still decides.** The live check stays the owner's (an agent's
  browser run "is evidence, never that gate", `REVIEW-POLICY.md` → "Live
  checks"). The merge still needs the owner's explicit request (`/ship <id>`).
  A subagent still never records a gate. The run records gates as the
  coordinator, under the owner's recorded start authorisation, never on its
  own judgement.
- **The authorisation covers one intent.** It covers one intent and the
  artefacts that intent's own skills draft. It does not carry over to
  another intent, to a later session's new intent, or to an amendment of a
  spec or plan the owner already accepted.
- **It must stop for anything the owner would need to decide:**
  - a review finding that needs a design decision, not a mechanical fix;
  - any spec or plan amendment;
  - verdict `escalate` (the Reviewed tier needs the owner's diff read);
  - still `rework` after round 3 (§45 took 4 rounds, §46 3, §47 and §48 2);
  - a CRITICAL finding;
  - a red `verify` or `check:intent` the run cannot attribute to a
    mechanical cause;
  - a spawned worktree or session it didn't create.
- **Existing tools stay the building blocks:** `/intent`, `/spec`,
  `/build-plan`, `/spawn`, `/review` and `/ship` (`npm run ship` still never
  runs without the owner's request). The hard safety rules carried in briefs
  still hold: no `scripts/ship.mjs` against the real repo outside `/ship`,
  no real `saves/`, the lint cap never raised, mutants restored by copy, no
  killing processes it didn't start.
- **Paths:** this touches `REVIEW-POLICY.md`, `intents/README.md`,
  `.claude/skills/**`, probably `.claude/agents/**` and `scripts/**`. The
  first four are Reviewed by the path table, so the change is Reviewed tier.
- **Load:** the "about three intent sessions" limit (`CLAUDE.md` → "Parallel
  sessions") applies to auto runs too.

## Type-specific questions

### Feature
- **Users:** the owner, as coordinator; no player-facing change.
- **Rulebook basis:** digital-only, no print rule. SDLC tooling.
- **Known simplification it removes:** none.
- **Open design questions:**
  - **The start gate:** which gates the start command pre-authorises.
    `intent_accepted` comes first and is passed by the owner directly;
    `spec_accepted` and `plan_approved` would be recorded by the run. And
    how it is recorded: a new `auto_authorized:` field with the owner's
    quote, or the existing gates with a `by-auto` marker.
  - **Question rounds:** whether the run stops before the spec is written or
    after the draft. That is, does the owner see the spec at all before
    implementation, or only its question round? The same for the plan,
    which has no question round today.
  - **Telling "needs a decision" from "mechanical":** who classifies a
    review finding, and how a misclassification is caught. One option is a
    new field per finding in `review.md`.
  - **What "independent re-check" runs:**
    - re-run `verify` and `e2e`;
    - re-run every surviving mutant and the killers the implementer quotes;
    - compare the counts the reports quote with the real ones.

    Also: is it a script (`scripts/**`, tested) or a third agent?
  - **Driver:** a skill that chains the existing skills, a Workflow script,
    or both. And where the run's state lives (round, last stop reason):
    `metadata.yml` fields, or the sessions event log.
  - **Sampling:** a tighter rate for auto-run changes (every 3rd instead of
    every 5th), and whether `sampled:` keeps one count or two.
  - **Live check timing:** if the live check finds a defect, the rework
    after it either counts toward the three rounds or starts a new budget.
  - **Notification:** how the owner hears about a stop when not watching
    the terminal (push notification, `npm run sessions`, both).

## Assumptions I made

- **Feature, not adjustment or refactor:** it adds a new mode, new metadata
  fields and new policy text across many files.
- **An intent still starts the normal way** (`/intent`, then the owner
  accepts it). Auto mode starts from an accepted intent, so the problem
  statement is always owner-approved. A "draft and run" in one command is
  left for the spec to decide or reject.
- **The ship stays a separate owner request:** "stops for ship" means it
  stops and waits for `/ship <id>`, not that it ships.
- **Three rounds** is the owner's number, taken as the cap on review rounds
  (round 1 plus up to two reworks re-reviewed, or three reworks). The spec
  settles which.
- **The re-check exists because of evidence:** the coordinator's own re-runs
  caught a surviving mutant the review had missed in §48 (M7) and confirmed
  §49's `follow` survivor. §49's rework also reported four mutant runs and
  twelve e2e passes in eleven tool calls, which nobody re-ran at the time.
