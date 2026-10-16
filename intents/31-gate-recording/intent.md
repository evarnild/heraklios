<!-- generated-by: heraklios/intent@0.1.1 -->
# §31 — Who records a gate, and how

**Type:** feature
**Originator:** me (Eric) — split out of §28's scope
**Source:** [§28 spec → Out of scope](../28-live-checks-and-merge-rule/spec.md#out-of-scope), third bullet; the SDLC review on 2026-10-08, point 2

## Problem

`intents/README.md` says I record every gate, and the `/intent` skill says
"you never record a gate yourself". In practice, for §26 and §27, Claude
recorded `intent_accepted` and `plan_approved` from a "yes please" in chat
and left a comment saying so. That's convenient, but a gate I don't record
myself drifts toward a formality: I can approve something I haven't read,
and later nobody can tell which gates I passed deliberately. For §28 I set
the dates myself, so the two practices now coexist with nothing saying
which is allowed.

## Outcome

- One written rule, in `intents/README.md` and the skills, for who may
  write a gate date into `metadata.yml`: only me, or also an agent on an
  explicit approval in chat, and if so, which words count.
- If an agent may record a gate, it is visibly marked as such (for example a
  `recorded_by:` note or a comment format), and `check:intent` or
  `sdlc:scan` can tell the two apart.
- The rule is consistent with §28's merge rule (an explicit request in the
  current conversation, naming the action).
- §26 and §27's chat-recorded gates are either left as history with a note
  or re-dated by me; the rule says which.

## Constraints

- Depends on §28: same documents, and its "explicitly asks" interpretation
  should be reused, not reinvented.
- Must not make the cheap path expensive: an adjustment has one gate, and
  recording it should stay a one-line edit or one sentence in chat.
- Flat-text `metadata.yml`, no YAML dependency.
- `REVIEW-POLICY.md`, `.claude/skills/**` and `.claude/agents/**` are
  Reviewed-tier paths.

## Type-specific questions

### Feature
- **Users:** the owner, and every agent that drafts intents, specs or plans.
- **Rulebook basis:** digital-only — process, no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - Owner-only, or agent-on-explicit-approval? If the latter, what is the
    approval phrase ("accept intent §N", "approve the plan"), and does a
    bare "yes" after a proposal count?
  - How is an agent-recorded gate marked so a script can count it?
  - Should `sdlc:scan` report the share of gates recorded by an agent, as a
    rubber-stamping signal?
  - Does the live check (§28's `live_checked:`) follow the same rule, or
    stay owner-only as §28's spec decides?

## Assumptions I made

- Feature, not adjustment: the change spans `intents/README.md`, the
  `/intent` skill, `CLAUDE.md`, possibly `check:intent`, and it has a real
  design choice.
- §28's live-check gate stays owner-only whatever this decides, unless the
  spec here argues otherwise.
