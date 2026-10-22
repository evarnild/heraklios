<!-- generated-by: heraklios/intent@0.1.4 -->
# §47 — The intent queue is generated from metadata.yml; the root plan.md stops carrying status

**Type:** feature
**Originator:** me (Eric): "Do we really need the plan.md that is not in
the intent? It looks like it makes the work of the coordinator more
complicated."
**Source:** coordinator's assessment in chat, 2026-10-22

## Problem

The root `plan.md` (584 lines) keeps, among other things, a hand-maintained
**queue**: the Shipped, In flight and Queued tables, one row per intent with
its type and status. Its own rules say the status there is a copy:

> A queue row is one line linking to its intent folder, with the type and
> the status from its `metadata.yml` (which is the source of truth for
> status). (`plan.md`, "How To Manage This Plan")

> For intents (§26 on) it mirrors `metadata.yml`, which wins if they
> disagree; update both the moment anything merges.

Keeping that copy costs more than it gives:
- **Churn:** 31 of the 178 commits on `main` since 2026-10-20 touch
  `plan.md`, mostly to move or relabel a row.
- **Drift:** rows go stale whenever an intent's status changes without the
  row; `/sessions` partly exists to fix them, and two were wrong again on
  2026-10-22 (§45, §46 still "Queued").
- **Collisions:** two coordinator sessions edited it at once; uncommitted
  rows for §39, §40 and §42 were swept into another session's commits, and
  an id was taken twice (§42, renumbered to §43).
- **It gets in the way of automation:** `/ship` (§46) must refuse to run on
  a dirty `plan.md` and must rewrite a row on every merge.
- **Name clash:** the intent's `plan.md` and the root one share a name;
  `/build-plan` has to say "not the root `plan.md`".

The rest of the file is useful and not duplicated: the Current Snapshot,
the Backlog Map (ideas not yet intents), the History Map into
`plan-history.md`, and the agent workflow and runbook (§1, §4), which
`CLAUDE.md:43`, `:142` and `scripts/spawn-intent.mjs:127` cite as
"plan.md §4" and `AGENTS.md:40` points to.

## Outcome

- The queue view (shipped, in flight, queued, with type, status, gates and
  merge hash) is **generated** from `intents/*/metadata.yml` and git, on
  demand, never edited by hand. No skill, agent, script or merge writes a
  status row again.
- The runbook (§1, §4) lives in its own file, and every pointer to "plan.md
  §4" points there.
- Backlog ideas live where an agent can find them without the queue
  table (draft intents, or a short backlog file: the spec decides).
- What remains of the root overview is short, edited rarely and by the
  owner, and no longer named `plan.md` (or is removed, if the spec finds
  nothing left that needs it).
- Every reference to the root `plan.md` (in `CLAUDE.md`, `AGENTS.md`,
  `sdlc.md`, `intents/README.md`, `REVIEW-POLICY.md`, the skills, the
  agents, `scripts/`) is updated, and the rules that say "only the
  coordinator edits `plan.md`" become "nobody edits the queue; it's
  generated".
- `/ship` (§46) loses its root-`plan.md` bookkeeping step and its dirty
  `plan.md` check.

## Constraints

- **Reviewed tier:** `.claude/skills/**`, `.claude/agents/**`,
  `.codex/agents/**`, and likely `REVIEW-POLICY.md` (`REVIEW-POLICY.md` path
  table).
- `plan-history.md` stays as it is (the archive); only links into it may
  move.
- No history is rewritten; old commits keep pointing at the old file.
- `sdlc:scan`'s "plan-only commits excluded" rule
  (`scripts/sdlc-scan.mjs:171`) must keep meaning the same thing, or be
  changed on purpose.
- §46 is in flight and edits the queue: it ships as specified (its
  implementer keeps that step in its own function on request), and this
  intent removes the step afterwards. Order: §46 merges first.

## Type-specific questions

### Feature
- **Users:** the owner (one place to see where things stand), the
  coordinator session (no more row edits), every skill and agent that
  reads or writes `plan.md` today.
- **Rulebook basis:** digital-only (process).
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - The generated view: a command (`npm run queue`), a generated file
    (`docs/queue.md`, refreshed by `/sessions` or a hook), or both; what it
    shows for shipped intents before §26 (they have no `metadata.yml`).
  - Where the runbook goes (`docs/runbook.md`?) and whether parts belong in
    `CLAUDE.md` instead.
  - The backlog: each idea becomes a draft intent, or a `BACKLOG.md`.
  - The snapshot and history map: a short `OVERVIEW.md`, folded into
    `README.md` or `plan-history.md`, or dropped.
  - How `/intent` picks the next id once the queue table is gone (today it
    reads `plan.md`, `plan-history.md` and `intents/`).

## Assumptions I made

- **Feature:** it adds a generated view and changes the process, with
  design questions; not a refactor, since the coordinator's work changes.
- `metadata.yml` stays the only source of status; the generated view adds
  no fields of its own.
- §1–§25 history (pre-intent work) is reached through `plan-history.md`,
  as today.
