<!-- generated-by: heraklios/intent@0.1.2 -->
# §44 spec — /spec and /build-plan skills write the spec and the plan, stamped

Accepted intent: [intent.md](intent.md)

Written against `main` at `6c2d960`. (Written by hand, the last spec to be:
the skill this spec defines doesn't exist yet.) Revised 2026-10-22 for the
owner's decision: three skills, not one. Amended 2026-10-22 on the owner's
request after review round 2: B2, B6 and the last Assumption now match what
is built (`/intent` 0.1.4, thinned; rule 4 for spec and plan only; the `#`
stamp form for metadata.yml). `spec_accepted` stays as recorded.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `.claude/skills/intent/SKILL.md` (0.1.2, 97 lines) | The shape the new skills follow: gather before asking, one batched question round, write from the template, validate, report, stop for the owner |
| `.claude/skills/review/SKILL.md`, `grid/SKILL.md` | The kit's convention: one skill per job, its own version and stamp (`heraklios/<skill>@<version>`) |
| `intents/_templates/spec.md`, `plan.md` | The sections each artefact must have; the skills fill them, they don't replace them |
| `intents/README.md` → types table, "Who edits what", gates | Which types need a spec or plan; who records a gate |
| `scripts/sdlc-scan.mjs:39-65` | `STAMP_RE` reads the first `generated-by:` token of each `.md` in an intent; "skill-stamped" counts an intent with any stamp |
| `scripts/scan-lib.mjs` (`metadataProblems`, `gateShares`, tested) | Where new pure scan logic goes, with tests |
| `docs/sdlc-grid.md` → Design row, level table | L2 for Design: "a `/spec` skill loads rulebook + conventions" |

## Behaviour

**B1 — Three skills.** `/intent` (exists), and two new ones:
`.claude/skills/spec/SKILL.md` and `.claude/skills/build-plan/SKILL.md`, each
versioned `0.1.0` in its frontmatter, with a one-line description that
triggers on its own job ("draft or revise the spec for a heraklios
feature intent", "draft or revise the plan for …").

**B2 — Shared rules in one place.** A new section in `intents/README.md`,
"Drafting an artefact", holds what all three skills do the same way:
gather what exists before asking; ask at most one batched round; quote
sources at their wording; record the `main` commit the artefact was
checked against; stamp the first line; validate before handing over;
report what is weak; stop for the owner; never record a gate (pointing to
"Who edits what"). Each skill's `SKILL.md` says "follow `intents/README.md`
→ Drafting an artefact" and adds only what is its own. `/intent`'s
`SKILL.md` gets the same pointer and is thinned to its own rules: the
restatements the section covers are removed, its last line names `/spec`
(feature) or `/build-plan` (fix, refactor) as the next step, and its
version goes to `0.1.4`. The "record the `main` commit" rule applies to
spec and plan only (an intent is not checked against code).

**B3 — Invocation and preconditions.** `/spec <id>` and `/build-plan <id>`.
Each checks first and stops, saying which gate is missing, if:
- `/spec`: the intent isn't `type: feature` (fix and refactor have no
  spec; adjustment and experiment have neither), or `intent_accepted`
  isn't recorded;
- `/build-plan`: the type is adjustment or experiment, or the gate before it
  isn't recorded (`spec_accepted` for a feature, `intent_accepted` for a
  fix or refactor).

An existing artefact is revised in place, not overwritten blind: the
skill reads it, keeps what still holds, and says what changed.

**B4 — `/spec`.**
1. **Read first:** the intent (Outcome, Constraints, open design
   questions, owner's decisions), the template, the `docs/research/`
   passages for any rule involved (transcription, and the French original
   where the transcription may be damaged), `README.md` "Known
   simplifications", `plan-history.md` for the topic, and the code the
   behaviour touches, on current `main`.
2. **Questions:** only for open design questions the intent and sources
   leave open, one batched round; otherwise decide, and list the decision
   under Assumptions with its reason.
3. **Write `spec.md`** from the template: a "Written against `main` at
   `<hash>`" line; Sources that apply; Behaviour as numbered **B1, B2, …**
   observable rules; Interpretations (every ambiguous passage and the
   reading chosen, each to become a code comment at its implementation
   site); Acceptance criteria **AC1, AC2, …**, each naming the test,
   scenario or manual check that proves it; Non-functional
   (engine/presentation split, save format, undo, AI); Out of scope;
   Assumptions.
4. **Validate:** every open question of the intent answered in a B or an
   Assumption; every AC names its proof; every claim about code re-read at
   the recorded commit; rule quotes at the source's wording.
5. **Report and stop:** next step "accept by setting `spec_accepted`, or
   say yes".

**B5 — `/build-plan`.**
1. **Read first:** the intent, the spec (feature), the template,
   `REVIEW-POLICY.md` (tiers, live checks, the review passes), and every
   file, symbol and line the plan will rely on, on current `main`.
2. **No question round:** a question at plan time means the spec (or, for
   a fix, the intent) is incomplete; the skill reports it and stops rather
   than deciding a design point itself.
3. **Write `plan.md`** from the template: Goal; Risks (this repo's known
   bug classes — drift-machine fall-through, tests that pass whatever the
   code does, stale line citations, the lint cap — plus anything
   specific); **Verified against the codebase** ("Re-read on `main` at
   `<hash>`", then `path:line — what is there` for each reliance);
   Subtasks, each committable with `npm run verify` green; Tests (for
   each behavioural line, the test that would fail if it were mutated; for
   a fix, the failing-first test); Validation (`verify`, `check:intent`,
   `e2e` when the paths call for it, and the live-check steps when one is
   owed by path); Assumptions; the Progress marker left empty.
4. **Validate:** every spec B and AC (feature), or intent outcome (fix,
   refactor), maps to a subtask and a test or check; every `path:line`
   read at the recorded commit; no subtask needs an unrecorded gate.
5. **Report and stop:** next step "approve by setting `plan_approved`,
   or say yes".

**B6 — Stamps.** First line of each file a skill writes:
`<!-- generated-by: heraklios/spec@0.1.0 -->` (spec.md),
`<!-- generated-by: heraklios/build-plan@0.1.0 -->` (plan.md),
`<!-- generated-by: heraklios/intent@0.1.4 -->` (intent.md) and
`# generated-by: heraklios/intent@0.1.4` (metadata.yml, as today). The name is the skill, as for `/review` and
`/grid`; `STAMP_RE` already reads it, so no regex change.

**B7 — The scan tells skill-made from hand-made.** A pure, tested function
in `scripts/scan-lib.mjs`, `artefactOrigins(intents)`, classifies each
`spec.md` and `plan.md`:
- **skill** — stamp name `heraklios/spec` on a spec, `heraklios/build-plan` on
  a plan, any version;
- **hand (old stamp)** — any other `generated-by:` stamp (the 19 existing
  `heraklios/intent@0.1.x` files, or a mismatched one);
- **unstamped** — none.

`npm run sdlc:scan` prints one line per artefact under "## Intents", e.g.
`spec.md: 0 by /spec · 7 hand (old stamp) · 1 unstamped`, and adds
`artefactOrigins` to the JSON. "skill-stamped" is unchanged.

**B8 — `/grid` reads it.** `.claude/skills/grid/SKILL.md` §2 gains one
rule: Design (and the plan half of Build) count as L2 only for specs
(plans) the scan reports as made by `/spec` (`/build-plan`); old stamps count as
hand-made (owner's decision: existing files keep their stamps).

**B9 — Docs.** `intents/README.md` (the new section, and "Who edits what"
naming the skills), `sdlc.md` steps 2–3, and `CLAUDE.md`'s line on the
skills ("`/intent` drafts an intent, `/review` …") name `/spec` and
`/build-plan`.

## Interpretations

None of the rulebook. The owner first asked for a "spec step in intent",
then chose three skills after weighing both (2026-10-22): B1 follows the
later decision. The plan skill is named `/build-plan`, not `/plan` (owner, 2026-10-22):
`/plan` clashes with Claude Code's plan mode command, the built-in `Plan`
agent and the repo's own root `plan.md`. The artefact stays `plan.md`.

## Acceptance criteria

- **AC1** — `scripts/scan-lib.test.mjs`: `artefactOrigins` classifies a
  `/spec`- and `/build-plan`-stamped pair, an old-stamped one, an unstamped one,
  a spec stamped `heraklios/build-plan` (hand, not skill), and an intent with
  neither file. Mutants: swap the two names, drop the
  name-matches-file check, count unstamped as hand.
- **AC2** — `npm run sdlc:scan` on the branch prints the two lines (B7)
  with today's numbers: 0 by the skills; hand and unstamped counts
  matching a `grep` of the stamps.
- **AC3** — the review reads the three `SKILL.md` files and the README
  section against B1–B6, line by line (pass 1), and checks no shared rule
  is restated in a skill (B2).
- **AC4** — **dry run, the live check (rule 3: a skill's behaviour shows
  only when it runs):** in a Claude Code session started in the branch's
  worktree (it loads that worktree's skills), the owner creates a
  throwaway feature intent with `/intent`, accepts it, runs `/build-plan <id>`
  first (it must stop: no `spec_accepted`), then `/spec <id>`, accepts,
  then `/build-plan <id>`, and sees the stamps of B6, the sections of B4/B5,
  the commit lines, and no gate recorded by a skill. The throwaway intent
  is deleted, not committed.
- **AC5** — `npm run verify` green, lint ≤ 21; `npm run check:intent`
  PASS.

## Non-functional

- **Engine/presentation split, save format, undo, AI:** untouched.
- **Tier:** Reviewed by path (`.claude/skills/**`); the owner reads the
  diff.
- **check:intent:** unchanged; it doesn't read stamps.
- **Codex:** `.codex/` has agents only, no skills; nothing to mirror.

## Out of scope

- Re-stamping existing specs and plans (owner's decision).
- The global `new-sdlc-project` kit.
- Firing a skill automatically when a gate is recorded (L3).

## Assumptions I made

- Shared rules in `intents/README.md` (B2) rather than a shared file under
  `.claude/skills/`: the README is already where gates and "Who edits
  what" live, and humans read it too.
- `/build-plan` asks no questions (B5.2); `/spec` may ask one round (B4.2).
- Revising an existing artefact in place (B3) rather than refusing:
  rework after a review touches specs and plans often.
- `/intent` goes to `0.1.4` (a pointer, a changed last line, and its
  restatements of the shared rules removed, no new behaviour); the new skills start at `0.1.0`.
