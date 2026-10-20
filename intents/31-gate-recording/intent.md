<!-- generated-by: heraklios/intent@0.1.1 -->
# §31 — Who records a gate, and how

**Type:** feature
**Originator:** me (Eric) — split out of §28's scope; sharpened 2026-10-20 after §32
**Source:** [§28 spec → Out of scope](../28-live-checks-and-merge-rule/spec.md#out-of-scope), third bullet; the SDLC review on 2026-10-08, point 2; §32's gates and merge bookkeeping (2026-10-16 to 2026-10-20)

## Problem

The written rules say I record every gate:
- `intents/README.md` → "Who edits what": "**You** write or accept …
  every gate in `metadata.yml`".
- The `/intent` skill: "you never record a gate yourself".
- `REVIEW-POLICY.md` → "Live checks": "**Who records it.** You".

In practice an agent records most of them, on my word in chat, and each
time it marks that differently or not at all:

| Intent | Gates written by | How it is marked |
| --- | --- | --- |
| §26 | Claude, from chat | a free-text comment block above the gates ("Approved in conversation … Re-date if you want …") |
| §27 | Claude, after I said "yes please" | a different free-text comment block |
| §28 | me | nothing (commit `585682f` says "gates recorded by Eric") |
| §30 | not recorded in the file | nothing |
| §32 | Claude, on request, all five: `intent_accepted`, `spec_accepted`, `plan_approved`, `live_checked`, `merged` | an end-of-line comment, worded three ways ("on the owner's request", "on the owner's explicit request in chat", "…with the two spec changes …") |

Three problems follow:

1. **Rules and practice disagree, with nothing saying which wins.** §32's
   `live_checked:` was written by Claude after I said I had run the check.
   `REVIEW-POLICY.md` says I record it. Was that allowed?
2. **No script can tell who recorded a gate.** The markers are free
   comments, so `check:intent` and `sdlc:scan` count an agent-recorded gate
   and one I wrote the same way. A gate I didn't record myself drifts
   toward a formality: I can approve something I haven't read, and later
   nobody can tell which gates I passed deliberately.
3. **Nothing checks the recorded value itself.** On the §32 merge, Claude
   wrote `merged: 2026-10-20` (a date) where the template asks for the
   merge commit hash. `check:intent` can't see it, since it runs on the
   branch before the merge. `sdlc:scan` passes the value to `git show`,
   which fails. The scan catches that and silently drops §32 from "Quality
   per review tier", so it reported 3 reviewed changes instead of 4. The
   value was fixed by hand on 2026-10-20 (`merged: a66d4d4`), only because
   someone happened to look.

## Outcome

- **One written rule** (decided 2026-10-20): an agent may write a gate
  field into `metadata.yml` (`intent_accepted`, `spec_accepted`,
  `plan_approved`, `live_checked`, `merged`) when I ask it to in the
  current conversation, and **a "yes" is enough**. The "yes" answers a
  message that proposed recording that gate, the way a "go ahead" in
  reply to a proposed merge counts under §28. A "yes" to a message that
  proposes several gates at once records every gate it named. I can still
  write a gate myself. Stated the same way in `intents/README.md`, `REVIEW-POLICY.md`,
  `CLAUDE.md`, the `/intent` and `/review` skills and the reviewer agents,
  replacing "you never record a gate yourself" and "**Who records it.**
  You".
- **What the gate still means:** the decision is mine whoever types the
  date. For `live_checked`, I still run the check myself. The agent only
  writes the date after I say I did, and an agent's own browser run still
  never counts.
- **An agent-recorded gate is marked in one fixed, parseable form**, not a
  free comment, so `sdlc:scan` can count gates by who recorded them.
  Recording still takes one line.
- **Gate values are checked.** A `merged:` that doesn't resolve to a
  commit, or a date gate that isn't a date, is reported loudly by whichever
  tool can see it, never silently dropped.
- **Consistent with §28's merge rule:** the same notion of "the owner
  explicitly asked, in the current conversation, naming the action".
- **History settled:** the rule says what happens to the gates already
  recorded for §26, §27 and §32: left as they are with a note, re-marked in
  the new form, or re-dated by me.

## Constraints

- Builds on §28 (merged): reuse its "explicitly asks" interpretation from
  `REVIEW-POLICY.md` → "Merging"; don't invent a second one.
- Must not make the cheap path expensive. An adjustment has one gate, and
  recording it should stay a one-line edit or one sentence in chat.
- `metadata.yml` stays flat text, parsed by
  `scripts/intent-check-lib.mjs` with no YAML dependency. Any marker must
  survive that parser and stay readable by hand.
- `check:intent` runs on the branch, before the merge. `merged:` is written
  on `main` after it, so checking `merged:` belongs to `sdlc:scan` (or a
  post-merge step), not `check:intent`.
- `REVIEW-POLICY.md`, `.claude/skills/**` and `.claude/agents/**` are
  Reviewed-tier paths, so this whole change is Reviewed.

## Type-specific questions

### Feature
- **Users:** the owner, and every agent that drafts intents, specs or plans,
  runs `/review`, or does merge bookkeeping.
- **Rulebook basis:** digital-only — process, no print rule.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - ~~Owner-only, or agent on request?~~ Decided: agent on request, and a
    "yes" is enough (Outcome).
  - ~~Does a "yes" to a message proposing several gates record all of
    them?~~ Decided: yes (Outcome).
  - The marker's form: a suffix on the value (`2026-10-16 by:agent`), a
    sibling key (`intent_accepted_by: agent`), or a fixed comment format the
    parser reads? Which one keeps the parser simple and the line short?
  - Should `sdlc:scan` report the share of agent-recorded gates as a
    rubber-stamping signal, and per gate type?
  - `merged:` is bookkeeping, not an approval: the approval is the review
    verdict plus my merge request. Does it belong under this rule at all, or
    only under "values are checked"?
  - For an unresolvable `merged:`: should `sdlc:scan` warn, or fail?

## Assumptions I made

- Still a feature, not an adjustment: the change spans `intents/README.md`,
  `REVIEW-POLICY.md`, `CLAUDE.md`, two skills, the reviewer agents and at
  least `sdlc:scan`, and it has a real design choice.
- **Validating gate values** (problem 3) is in scope here, not a separate
  fix intent: it is about how a gate is recorded, and the `merged:` slip
  happened while an agent was recording one. If you'd rather keep §31 to
  the who-records rule, it splits off cleanly as a small fix.
- The core rule covers `live_checked` too: you said "an agent on my
  request" without excepting it, and §32 already worked that way. The
  check itself stays yours (Outcome).
- A "yes" counts only as the answer to a message that proposed the gate.
  An unprompted "yes" can't name which gate it approves, and §28's merge
  rule draws the same line.
- No `follows_up:`: the `merged:` slip was made during §32's bookkeeping
  and is already corrected, and this intent is not a fix.
