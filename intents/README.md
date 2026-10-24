# Intents

One folder per piece of work, holding the artefacts that carry it from "what
do we want" to "merged". This is heraklios's slice of the AI-native SDLC: each
stage ends by writing something the next stage reads, and the chain is the
audit trail of who asked for what and who approved it.

The queue is **generated**: `npm run queue` lists every intent here with its
type, status and gates, reading each `metadata.yml` (from the intent's branch
while unmerged, else from `main`). Nobody edits it. `OVERVIEW.md` at the repo
root is the short, owner-edited snapshot and history map, and
`docs/runbook.md` the agent runbook. `plan-history.md` stays the archive of everything
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

**The id is the next `§` number** — the same numbering `OVERVIEW.md`,
`plan-history.md` and the commit messages already use, so `§27`,
`intents/27-…/` and `feat/27-…` all name the same thing. Take the number
`npm run queue -- --next-id` prints: one more than the highest used in
`plan-history.md`, `OVERVIEW.md` and the `intents/` folders on `main` and on
every local branch.

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
- **The orchestrator's gate buttons** (§52, `npm run orchestrator`). Your
  click on a gate button, after its confirm dialog, is you writing the gate
  directly: the page writes a bare date (no `by-agent`) and commits it under
  your git identity. No agent is involved, and an agent never presses it.
  Its **Auto** button is different: the click, after a confirm that says so,
  counts as your `/auto <id>` message below. A headless `/auto` session cannot
  take a "yes" in the conversation, so the click resumes only stops that need
  no answer: no run yet or a closed session; `spec drafted` and `live check
  owed` (record the gate with its button first); `escalate` (the click also
  means "I have read the diff"; the confirm says so); `ready for /ship`; a
  cause you have cleared. A stop that needs your answer (`spec questions`,
  `decision needed`, `spec or plan amendment needed`, `critical finding`,
  `plan exists unapproved`, `plan found the spec incomplete`) is answered in a
  coordinator terminal with `/auto <id>` plus the answer; the page disables Auto
  for it and the server refuses it. `out of rounds` is refused too: the intent
  continues by hand. An agent never presses the Auto button or POSTs to
  `/api/sessions`.
- **`/auto <id>`** (§50, spec B1 and B3). Your `/auto <id>` message in the
  coordinator conversation, for an intent whose `intent_accepted` is
  recorded, is a request to record that intent's `plan_approved`, and no
  other gate. The coordinator records it as `<date> by-agent` once the plan
  is drafted, and only if the plan finds the spec complete (`/build-plan`
  step 3), with a comment naming the authorisation, for example
  `# auto: owner "/auto 50" (auto_authorized 2026-10-24)`. It covers that one
  intent and that run: a second `/auto <id>` is a new request for the same
  gate and nothing wider. It is not a standing instruction. `intent_accepted`,
  `spec_accepted` (a feature's run stops once for it) and `live_checked`
  stay yours, and so does `/ship` (`REVIEW-POLICY.md` → "Merging"). A
  subagent still never records a gate; the coordinator writes this one, in
  the conversation that holds your message.
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
- **The auto fields** (spec B1 and B12). `auto_authorized: <date>` records the
  `/auto <id>` message above, with a bare date or `<date> by-agent` like a
  gate; `auto_round: <1-3>` and `auto_stopped: <reason>` record where a
  stopped run stands. None of them is a gate: nothing waits on them, and
  `check:intent` only rejects a malformed value. Write the reason without
  ` #`, which starts a comment.
- **The implementer agent** may only append to the `## Progress` section at
  the end of its item's `plan.md` and set `status: in-review` when done.
- **A spawned session** (`npm run spawn`, `CLAUDE.md` → "Parallel
  sessions") is the implementer for its intent, with one addition: if the
  gates its type needs are not recorded yet, it may draft the missing
  `spec.md` (`/spec`) or `plan.md` (`/build-plan`) with the skills, then stops for you to accept it.
- **The reviewer / `/review`** writes `review.md` and nothing else here.

## Drafting an artefact

`/intent`, `/spec` and `/build-plan` draft `intent.md`, `spec.md` and
`plan.md`. What they do the same way is written here once; each `SKILL.md`
points to this section and adds only what is its own.

1. **Gather before asking.** Read what exists first (the intent, the
   template, `plan.md`, `plan-history.md`, `README.md` "Known
   simplifications", `docs/research/`, the code on current `main`) and quote
   what you use.
2. **Ask at most one batched round**, only for what the material leaves
   open. If you skip a question, decide and list the decision, with its
   reason, under "Assumptions I made".
3. **Quote sources at their wording.** A rule, a line of code or an earlier
   decision is cited with its path and the passage as written, not
   paraphrased.
4. **Record the `main` commit** a spec or plan was checked against (short
   hash), in the artefact itself. An intent states a problem and is not
   checked against code, so it records none.
5. **Stamp the first line** of every file you write, in the form under
   "Stamps" with the skill's own name and version.
6. **Validate before handing over.** Check the draft against its template
   and the skill's own checklist.
7. **Report what is weak**, plainly: open assumptions, claims you could not
   verify, anything the owner should look at first.
8. **Stop for the owner.** Never record a gate on your own: see "Who edits what". The
   next step you name is the owner accepting it, or saying yes so an agent
   records it with `by-agent`.

An artefact that already exists is revised in place: read it, keep what
still holds, and say what changed.

## Stamps

A file a skill produced starts with
`<!-- generated-by: heraklios/<skill>@<version> -->`. That line is how the grid
tells "written by hand" (L1) from "produced by a versioned skill" (L2). Keep it
when you edit the file; remove it only if you rewrote the file from scratch.

## Status values

`draft` → `accepted` → `in-progress` → `in-review` → `done` (or `abandoned`
/ `deferred`). The status here is the source of truth; `npm run queue` reads it, and
there is no other copy.
