# Intents

One folder per piece of work, holding the artefacts that carry it from "what
do we want" to "merged". This is heraklios's slice of the AI-native SDLC: each
stage ends by writing something the next stage reads, and the chain is the
audit trail of who asked for what and who approved it.

`plan.md` at the repo root stays the **coordinator view** — snapshot,
queue, backlog, history map. It never holds a work item's detail again; its
queue rows point here. `plan-history.md` stays the archive of everything
shipped before this folder existed.

## Layout

```
intents/
  <id>-<slug>/
    intent.md      what we want and why — the problem, in the originator's words
    spec.md        what we will build (feature only)
    plan.md        how we will build it, approved before code; ends with ## Progress
    review.md      the review report (written by /review, updated in place)
    metadata.yml   id, type, status, gates, links
  _templates/      what the skills fill in; usable raw by hand
```

**The id is the next `§` number** — the same numbering `plan.md`,
`plan-history.md` and the commit messages already use, so `§27`,
`intents/27-…/` and `feat/27-…` all name the same thing. Take the number
after the highest one used in either plan file.

## Types

Every intent declares a type. The type decides which artefacts and gates
apply, so the heavy path is paid only where it earns its keep. **When in
doubt, it is a feature.**

| Type | Branch | Artefacts | Gates you record | Use for |
| --- | --- | --- | --- | --- |
| feature | `feat/<id>-<slug>` | intent, spec, plan | intent, spec, plan | new rules, new UI flows, anything with a design question |
| fix | `fix/<id>-<slug>` | intent, plan | intent, plan | a live defect; the intent *is* the spec. The change carries a failing-first test |
| refactor | `refactor/<id>-<slug>` | intent, plan | intent, plan | structure changes, behaviour held constant (e.g. splitting `BoardScene.ts`) |
| adjustment | `adjust/<id>-<slug>` | intent | intent | wording, README, config, constants — ≤5 files, ≤60 lines, no rule code |
| experiment | `exp/<id>-<slug>` | intent | intent | throwaway probes, tuning runs; never merged into rule code as-is |

The declaration is a claim; `npm run check:intent` is the evidence. It
compares what arrived against what the type should look like and reports
`ROUTE` when they disagree — an "adjustment" that touched `src/engine/`, a
"fix" with no test, a "refactor" that deleted test lines. A test is a `*.test.*` unit test or an
`e2e/**/*.spec.ts` scenario, counted when its file changed (the check never
reads test content); rule code in `src/engine` or `src/data` still needs a
unit test. A route is not a block: re-declare the type (and add the missing artefacts) or say in
`review.md` why the mismatch is fine. Expected noise: renaming or moving a
test file shows as lines deleted from the old path, so a refactor that does
it routes — say so in `review.md`.

A fix whose defect came from an earlier intent's change records that in
`metadata.yml` as `follows_up: <id>`. That is what lets `npm run sdlc:scan`
count follow-ups per review tier, so set it only for a real cause.

If an intent turns out wrong after merge, revert and keep the original
intent, or forward-fix with a new one. Don't rewrite the old folder.

## Gates

Four of the strategy's six human gates live here, plus heraklios's own
live check when a review says one is owed; each is your decision.

| Gate | Recorded as | Meaning |
| --- | --- | --- |
| accept the intent | `intent_accepted: <date>` | worth doing, and the problem statement is right |
| accept the spec | `spec_accepted: <date>` | this is what we will build |
| approve the plan | `plan_approved: <date>` | this is how — no code before this |
| live check, when owed | `live_checked: <date>` | you ran it yourself and saw what `review.md` → `## Live check` said you should; no merge before this (`REVIEW-POLICY.md` → "Live checks") |
| approve the change | `review.md` verdict + the merge commit | you read the report (and the diff, at the Reviewed tier) and take responsibility |

The other two — authorise the release (push to `origin/main` /
`scripts/update-stable.sh`) and triage a finding (turn a bug you hit while
playing into a new fix intent) — stay as they are.

`check:intent` fails a change whose source code moved before the gates its
type needs were recorded.

## Who edits what

- **You** write or accept `intent.md`, `spec.md` and `plan.md`. The skills
  draft; you decide.
- **Who records a gate.** A gate field is `intent_accepted`, `spec_accepted`,
  `plan_approved` or `live_checked`. You write it directly, or an agent writes
  it **on your request in the current conversation**. A request is an
  explicit instruction naming the gate ("accept §31", "record the live
  check"), or a "yes" (or "go ahead", "ok") in reply to the agent's own
  message that proposed recording it. A "yes" to a message that proposed
  several gates records every gate that message named, and nothing more and
  no later gate.
- **What does not count.** The exclusions of `REVIEW-POLICY.md` →
  "Merging": a standing instruction from an earlier session, a memory, a
  `CLAUDE.local.md` brief, an unprompted "yes" that answers no proposal, a
  request in another session. A subagent (`heraklios-implementer`,
  `heraklios-reviewer`, any `Agent`-tool worker) never records a gate: your
  request is not in its conversation. A spawned session is a conversation
  with you, so the rule applies there.
- **The decision stays yours.** For `live_checked:` you run the check; an
  agent records it only after you say you ran it. An agent's own browser run
  or a passing `npm run e2e` is never the check.
- **The marker.** An agent-recorded gate carries `by-agent` after the date,
  on the same line: `intent_accepted: 2026-10-20 by-agent`. Your own gate
  stays a bare date. The token is part of the value, not a comment; a free
  `# comment` after it is ignored. `check:intent` counts both forms as
  recorded and FAILs any other value (`yes`, `TBD`, `by-claude`);
  `sdlc:scan` lists bad values under "Metadata problems" and counts owner
  and agent gates. `merged:` is bookkeeping, not a gate; `REVIEW-POLICY.md`
  → "Merging" governs it.
- **The implementer agent** may only append to the `## Progress` section at
  the end of its item's `plan.md` and set `status: in-review` when done.
- **A spawned session** (`npm run spawn`, `CLAUDE.md` → "Parallel
  sessions") is the implementer for its intent, with one addition: if the
  gates its type needs are not recorded yet, it may draft the missing
  `spec.md` or `plan.md` with the skills, then stops for you to accept it.
- **The reviewer / `/review`** writes `review.md` and nothing else here.

## Stamps

A file a skill produced starts with
`<!-- generated-by: heraklios/<skill>@<version> -->`. That line is how the grid
tells "written by hand" (L1) from "produced by a versioned skill" (L2). Keep it
when you edit the file; remove it only if you rewrote the file from scratch.

## Status values

`draft` → `accepted` → `in-progress` → `in-review` → `done` (or `abandoned`
/ `deferred`). The status here is the source of truth; the one-line row in
`plan.md`'s queue mirrors it.
