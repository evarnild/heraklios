<!-- generated-by: heraklios/intent@0.1.2 -->
# §44 spec — /intent writes the spec and the plan as stamped steps

Accepted intent: [intent.md](intent.md)

Written against `main` at `6c2d960`. (Written by hand, the last spec to be:
the step this spec defines doesn't exist yet.)

## Sources that apply

| Source | What it settles |
| --- | --- |
| `.claude/skills/intent/SKILL.md` (0.1.2, 97 lines) | The intent step's shape the new steps follow: gather before asking, one batched question round, write from the template, validate, report, stop for the owner |
| `intents/_templates/spec.md`, `plan.md` | The sections each artefact must have; the steps fill them, they don't replace them |
| `intents/README.md` → types table, "Who edits what", gates | Which types need a spec or plan; who records a gate |
| `scripts/sdlc-scan.mjs:39-65` | `STAMP_RE` reads the first `generated-by:` token of each `.md` in an intent; "skill-stamped" counts an intent with any stamp |
| `scripts/scan-lib.mjs` (`metadataProblems`, `gateShares`, tested) | Where new pure scan logic goes, with tests |
| `docs/sdlc-grid.md` → Design row, level table | What L2 means for Design: "a `/spec` skill loads rulebook + conventions" |

## Behaviour

**B1 — Three steps, one skill.** `.claude/skills/intent/SKILL.md` becomes
version 0.2.0 with three steps:
- **intent** (today's §1–§5, unchanged in substance);
- **spec** — feature only;
- **plan** — feature, fix, refactor.

**B2 — Invocation.**
- `/intent <what you have>` (with or without a type flag): the intent step,
  as today.
- `/intent --spec <id>`, `/intent --plan <id>`: that step for intent §id.
- `/intent <id>` alone, for an existing intent: the next missing artefact
  its type needs (spec, then plan), or "nothing to draft" with the
  intent's status.

**B3 — Preconditions, checked first.** The spec step needs `type:
feature` and `intent_accepted` recorded. The plan step needs
`spec_accepted` for a feature, `intent_accepted` for a fix or refactor.
If one is missing the step says which and stops; it never records a gate
(`intents/README.md` → "Who edits what"). An adjustment or experiment has
no spec or plan step: the step says so.

**B4 — The spec step.**
1. **Read first:** the intent (its Outcome, Constraints, open design
   questions, owner's decisions), the templates, the `docs/research/`
   passages for any rule involved (transcription, and the French original
   where the transcription may be damaged), `README.md` "Known
   simplifications", `plan-history.md` for the topic, and the code the
   behaviour touches, on current `main`.
2. **Ask at most one batched round**, only for open design questions the
   intent and sources leave open; otherwise decide, and list the decision
   under Assumptions with its reason.
3. **Write `spec.md`** from the template:
   - a "Written against `main` at `<hash>`" line;
   - Sources that apply, with the passages it relies on;
   - Behaviour as numbered **B1, B2, …** observable rules;
   - Interpretations: every ambiguous passage and the reading chosen
     (each becomes a code comment at its implementation site);
   - Acceptance criteria **AC1, AC2, …**, each naming the test, scenario
     or manual check that proves it;
   - Non-functional (engine/presentation split, save format, undo, AI),
     Out of scope, Assumptions.
4. **Validate before handing over:** every open question of the intent is
   answered in a B or an Assumption; every AC names its proof; every claim
   about code was re-read at the recorded commit; a rule quote is the
   source's wording, not a tidied one.
5. **Report and stop:** what it decides, the choices it made for the owner,
   what's weak; next step "accept by setting `spec_accepted`, or say yes".

**B5 — The plan step.**
1. **Read first:** the intent, the spec (feature), the template,
   `REVIEW-POLICY.md` (tiers, live checks, the passes the review will
   run), and every file, symbol and line the plan will rely on, on
   current `main`.
2. **Write `plan.md`** from the template:
   - Goal (one paragraph, in the outcome's terms);
   - Risks: the classes of bug this repo has hit (drift-machine
     fall-through, tests that pass whatever the code does, stale line
     citations, lint cap) plus anything specific;
   - **Verified against the codebase:** "Re-read on `main` at
     `<hash>`", then `path:line — what is there` for each reliance;
   - Subtasks, ordered, each committable with `npm run verify` green;
   - Tests: for each behavioural line, the test that would fail if it
     were mutated; for a fix, the failing-first test;
   - Validation: `verify`, `check:intent`, `e2e` when the paths call for
     it, and the live-check steps when one is owed by path;
   - Assumptions; the Progress marker left empty.
3. **Validate:** every spec B and AC (feature) or intent outcome (fix,
   refactor) maps to a subtask and a test or check; every `path:line` was
   read at the recorded commit; no subtask needs a gate that isn't
   recorded.
4. **Report and stop**, next step "approve by setting `plan_approved`, or
   say yes".

**B6 — Stamps.** The first line of a file each step writes:
- intent step (unchanged form): `<!-- generated-by: heraklios/intent@0.2.0 -->`
  on `intent.md`;
- spec step: `<!-- generated-by: heraklios/intent-spec@0.2.0 -->`;
- plan step: `<!-- generated-by: heraklios/intent-plan@0.2.0 -->`.

Separate names, not a suffix on one name: `STAMP_RE`'s first token
already carries the name, so no regex change is needed to tell them apart.

**B7 — The scan tells step-made from hand-made.** A pure, tested function
in `scripts/scan-lib.mjs`, `artefactOrigins(intents)`, classifies each
`spec.md` and `plan.md`:
- **step** — stamp name `heraklios/intent-spec` (for a spec) or
  `heraklios/intent-plan` (for a plan), any version;
- **hand (old stamp)** — any other `generated-by:` stamp (the 19 existing
  `heraklios/intent@0.1.x` files);
- **unstamped** — none.

`npm run sdlc:scan` prints one line per artefact under "## Intents", e.g.
`spec.md: 0 by the spec step · 7 hand (old stamp) · 1 unstamped`, and adds
`artefactOrigins` to the JSON. The existing "skill-stamped" count is
unchanged.

**B8 — `/grid` reads it.** `.claude/skills/grid/SKILL.md` §2 gains one
rule: Design (and the plan half of Build) count as L2 only for specs
(plans) the scan reports as made **by the step**; the old stamps count as
hand-made (owner's decision: existing files keep their stamps, and the
grid notes it).

**B9 — Docs.** `intents/README.md` ("Who edits what", artefacts), `sdlc.md`
steps 2 and 3, and `CLAUDE.md`'s "`/intent` drafts an intent" line name the
two new steps and their invocation.

## Interpretations

None of the rulebook. One reading: "spec step in intent" (the owner's
words) means a step of the same skill, not a separate `/spec` skill (B1).

## Acceptance criteria

- **AC1** — `scripts/scan-lib.test.mjs`: `artefactOrigins` classifies a
  step-stamped spec and plan, an old-stamped one, an unstamped one, a
  spec stamped `intent-plan` (counted hand, not step), and an intent with
  neither file. Mutants: swap the spec/plan names, drop the
  name-matches-file check, count unstamped as hand.
- **AC2** — `npm run sdlc:scan` on the branch prints the two lines (B7)
  with today's numbers: 0 step-made specs and plans, hand and unstamped
  counts matching a `grep` of the stamps.
- **AC3** — `SKILL.md` 0.2.0 contains B2–B6 (the review reads it against
  this spec, line by line: pass 1).
- **AC4** — **dry run (the live check, rule 3: a skill's behaviour shows
  only when it runs):** in a Claude Code session started in the branch's
  worktree (so it loads the new `SKILL.md`), the owner runs `/intent
  --spec <id>` on a throwaway accepted feature intent and `/intent --plan
  <id>` on it after accepting, and sees: the precondition check (try
  `--plan` first: it stops), the stamps of B6, the sections of B4/B5, the
  "Written against" / "Re-read on" commit lines, and no gate recorded. The
  throwaway intent is deleted afterwards, not committed.
- **AC5** — `npm run verify` green, lint ≤ 21; `npm run check:intent`
  PASS.

## Non-functional

- **Engine/presentation split, save format, undo, AI:** untouched.
- **Tier:** Reviewed by path (`.claude/skills/**`); the owner reads the
  diff.
- **check:intent:** unchanged; it doesn't read stamps.

## Out of scope

- Re-stamping the existing specs and plans (owner's decision).
- The global `new-sdlc-project` kit.
- Firing the steps automatically on a gate (that would be L3).
- A separate review of skill text quality beyond this spec's AC3.

## Assumptions I made

- Separate stamp names (B6) over a step marker: simpler for the scan,
  and the intent's open question allowed either.
- `/intent <id>` picks the next missing artefact (B2) in addition to the
  explicit flags: it costs a few lines and saves remembering which comes
  next.
- The spec step may ask one batched round (B4.2), like the intent step;
  the plan step asks none (a plan question is a sign the spec is
  incomplete, so the step reports it instead).
- AC4's dry run is the live check (rule 3), since no automated test can
  run a skill.
