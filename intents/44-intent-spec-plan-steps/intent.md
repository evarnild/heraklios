<!-- generated-by: heraklios/intent@0.1.2 -->
# §44 — /spec and /build-plan skills write the spec and the plan, stamped

**Type:** feature
**Originator:** me (Eric), from the 2026-10-20 grid refresh
**Source:** `docs/sdlc-grid.md` → Design row ("Their stamp reads
`heraklios/intent@…`, but `/intent` covers only the intent: **no
versioned skill produced them**, so the stamp overstates L2") and its
"Gap to next level"

## Problem

Specs and plans are written in session by whatever agent is coordinating,
with no written procedure, and then stamped `heraklios/intent@0.1.x` as if
`/intent` had produced them. `/intent`'s `SKILL.md` (97 lines, version
0.1.2) covers drafting and validating the intent only; its last line says
"then the spec (feature) or plan (fix/refactor) comes next" and stops.
So:
- the stamp on 19 of the 21 `spec.md` and `plan.md` files in `intents/`
  (6 × `@0.1.1`, 13 × `@0.1.2`; the other 2 carry none; templates excluded, at `6c2d960`) claims a skill wrote them when none did,
  and `npm run sdlc:scan`'s "skill-stamped" count includes them;
- how a spec or plan is built (which sources to read, what to verify
  against the code, how to number behaviours, what the plan's "Verified
  against the codebase" must contain) lives only in the habits of
  whichever session does it, so quality varies and can't be versioned or
  reviewed;
- the grid scores Design at L1 for this reason, and the plan half of
  Build likewise.

## Outcome

- Two new skills sit beside `/intent` (owner's decision, 2026-10-22:
  three skills, not one): **`/spec`** (feature only, after
  `intent_accepted`) and **`/build-plan`** (feature, fix, refactor, after the
  gate before it). Each says what to read first, what the artefact must
  contain, and how to validate it before handing it to the owner, like
  `/intent` does. The rules the three share live in one place.
- A spec or plan the step produces carries a stamp that says so, distinct
  from the intent's (exact form for the spec), so `sdlc:scan` can tell a
  skill-made spec or plan from a hand-made one.
- `sdlc:scan` reports, per artefact type, how many carry the new stamps,
  so `/grid` can score Design and the plan half of Build from evidence.
- Existing specs and plans keep their stamps (owner's decision); the grid
  notes that only files from the new steps count as L2.

## Constraints

- `.claude/skills/**` is a **Reviewed** path (`REVIEW-POLICY.md` path
  table): the owner reads the diff.
- The gate rules don't change: a step drafts and stops; the owner accepts
  (or asks an agent to record it with `by-agent`), as in `intents/README.md`
  → "Who edits what". No step records a gate on its own.
- `npm run check:intent`'s rules (which artefacts each type needs, gates
  before code) don't change; it may learn the new stamp only if the spec
  decides it should.
- The templates in `intents/_templates/` stay the shape of each artefact;
  the steps fill them, they don't replace them.
- The global `new-sdlc-project` kit that seeded `/intent` is out of scope:
  this changes heraklios's copy only.

## Type-specific questions

### Feature
- **Users:** the owner (reads and accepts the artefacts), the coordinator
  session that drafts them, `/review` (pass 1 compares the diff with the
  spec and plan), `/grid`.
- **Rulebook basis:** digital-only (process, no game rule). The spec step
  must still tell the drafter to read `docs/research/` when a rule is
  involved.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - Stamp form: `heraklios/intent@0.2.0` with a step marker (e.g.
    `generated-by: heraklios/intent@0.2.0 step=spec`), or separate names
    (`heraklios/intent-spec@…`)? What does the scan's regex accept?
  - Invocation: `/intent --spec <id>` and `/intent --plan <id>`, or the
    skill picks the next missing artefact for an intent id?
  - What the plan step must verify against the code before handing over
    (today's practice: every file/symbol/line the plan relies on,
    re-read on current `main`), and whether it records the `main` commit
    it was verified at.
  - Should the spec step ask questions (one batched round, like the
    intent step) when the intent's open design questions aren't answered?
  - `sdlc:scan` output: a "spec/plan made by the skill" count per type,
    and how `/grid` uses it.

## Assumptions I made

- **Feature, not adjustment:** it changes a skill's behaviour, adds a
  stamp the scan reads, and has design questions; likely more than 5
  files (`SKILL.md`, scan + its tests, possibly `check-intent`,
  `intents/README.md`, `sdlc.md`, the grid's level table).
- ~~One skill with three steps~~ — changed 2026-10-22 by the owner after
  weighing it: **three skills** (`/intent`, `/spec`, `/build-plan`), each
  short and loaded only when used, versioned and stamped on its own, with
  their shared rules kept in one place so the copies can't drift.
