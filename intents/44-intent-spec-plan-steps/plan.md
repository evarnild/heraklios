<!-- generated-by: heraklios/intent@0.1.2 -->
# §44 plan — /spec and /build-plan skills write the spec and the plan, stamped

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

(Written by hand, the last plan to be: `/build-plan` is what this change
adds.)

## Goal

Two new skills, `/spec` and `/build-plan`, write `spec.md` and `plan.md`
with their own stamps, following shared drafting rules kept once in
`intents/README.md`; `/intent` points to them; the scan tells skill-made
specs and plans from hand-made ones, and `/grid` scores Design and the
plan half of Build from that (spec B1–B9).

## Risks

- **Skill text that reads well and does nothing checkable.** The skills
  can't be unit-tested. AC3 (the review reads each line against B2–B6)
  and AC4 (the owner's dry run) are the evidence; every instruction in a
  `SKILL.md` must be one a reviewer can check off against the spec.
- **Shared rules restated in a skill** (B2): the copies drift. Each
  `SKILL.md` keeps only what is its own and points to the README section.
- **A skill that records a gate.** None may (`intents/README.md` → "Who
  edits what"); each `SKILL.md` says so via the shared section, and the
  dry run checks `metadata.yml` after each skill.
- **Name clashes.** `/plan` was rejected for clashing with Claude Code's
  plan mode command, the `Plan` agent and root `plan.md`; check that
  `spec` and `build-plan` appear in no other skill listing in this repo
  (`.claude/skills/`).
- **Tests that pass whatever the code does** (`artefactOrigins`): AC1's
  mutants run before hand-over.
- **Lint cap 21:** `scan-lib.mjs` is 44 lines, `sdlc-scan.mjs` 174; the
  additions stay small and add no warning.
- **Reviewed tier:** `.claude/skills/**`; the owner reads the diff.

## Verified against the codebase

Re-read on `main` at `4ba8209`:

- `.claude/skills/intent/SKILL.md` — frontmatter `version: 0.1.2` (`:6`),
  stamp line `:19`, §1–§5, last lines `:95-97` ("then the spec (feature)
  or plan (fix/refactor) comes next").
- `.claude/skills/review/SKILL.md:18`, `grid/SKILL.md:19` — the
  `heraklios/<skill>@<version>` stamp convention; `grid/SKILL.md:33`
  "## 2. Score each stage", `:41-42` the L2 rule.
- `intents/README.md` — `## Who edits what` (`:83`), its spawned-session
  bullet naming "the skills" for `spec.md`/`plan.md` (`:114-117`);
  `## Stamps` (`:121-126`); `## Status values` (`:128`). The new
  "Drafting an artefact" section goes before `## Stamps`.
- `sdlc.md` — step 1 (`:19`, `/intent`), step 2 "Spec — features only"
  (`:24-27`), step 3 "Plan" (`:29-34`).
- `CLAUDE.md:66` — "`/intent` drafts an intent, `/review` runs …".
- `scripts/sdlc-scan.mjs:39` `STAMP_RE`; `:47-51` `stamps[f]` per `.md`;
  `:61` the `intents` record (`files`, `stamps`); `:65` `stamped`;
  `:130-136` the JSON `intents` block; `:163` the "## Intents" text line.
- `scripts/scan-lib.mjs` (44 lines: `metadataProblems`, `gateShares`) and
  `scripts/scan-lib.test.mjs` (39 lines); `vitest.config.ts` includes
  `scripts/**/*.test.mjs`.
- `intents/_templates/spec.md`, `plan.md` — the sections B4.3 and B5.3
  name.
- Today's stamps on specs and plans: 23 files, 19 stamped
  `heraklios/intent@0.1.x` (6 × `0.1.1`, 13 × `0.1.2`), 4 unstamped
  (before §44's own files).

## Subtasks

1. **Scan (B7) + tests (AC1).** `artefactOrigins(intents)` in
   `scan-lib.mjs` (input: each intent's `stamps` map, as `sdlc-scan.mjs`
   builds it); tests in `scan-lib.test.mjs`; `sdlc-scan.mjs` prints the
   two lines and adds the JSON field. Run AC1's three mutants. One commit.
2. **Shared rules (B2).** `intents/README.md` "Drafting an artefact"; the
   "Who edits what" spawned-session bullet names `/spec` and
   `/build-plan`. One commit.
3. **`/spec` (B1, B3, B4, B6).** `.claude/skills/spec/SKILL.md`, version
   0.1.0, pointing to the README section for everything shared. One
   commit.
4. **`/build-plan` (B1, B3, B5, B6).**
   `.claude/skills/build-plan/SKILL.md`, version 0.1.0, same pattern. One
   commit.
5. **`/intent` 0.1.3 (B2, B6).** The pointer to the shared section, the
   last line naming `/spec` / `/build-plan`, stamp `@0.1.3`; nothing else
   changes. One commit.
6. **`/grid` (B8) and docs (B9).** `grid/SKILL.md` §2's rule; `sdlc.md`
   steps 2–3; `CLAUDE.md:66`. One commit.
7. **Hand-over.** `verify`, `check:intent`, `npm run sdlc:scan` output
   (AC2) compared with a `grep` of the stamps, the three mutants'
   results, a check that no shared rule is restated in a skill (AC3,
   self-check); Progress; `status: in-review`. The dry run (AC4) is the
   owner's live check.

## Tests

- `scan-lib.test.mjs` → `artefactOrigins`:
  - a `/spec`-stamped `spec.md` and a `/build-plan`-stamped `plan.md` →
    skill;
  - `heraklios/intent@0.1.2` on either → hand (old stamp);
  - no stamp → unstamped;
  - `heraklios/build-plan@…` on a `spec.md` → hand, not skill;
  - an intent with neither file → counted nowhere.

  Mutants that must fail it: swap the two names; drop the
  name-matches-file check; count unstamped as hand.
- AC2: the scan's printed counts equal a `grep -h generated-by
  intents/*/spec.md intents/*/plan.md` tally.
- The three `SKILL.md` files and the README section: no automated test
  (Risks); AC3 and AC4.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS (it will FAIL only on "A live check is
  owed and not recorded" once the review sets it).
- `npm run sdlc:scan`: the two new lines, with 0 by the skills.
- **Live check (AC4, rule 3):** in a Claude Code session started in the
  branch's worktree (`cd ../heraklios-wt/44-intent-spec-plan-steps &&
  claude`, so it loads that worktree's skills): `/intent --feature
  throwaway: a dummy feature for the dry run` → say yes to accept →
  `/build-plan <id>` (must stop: no `spec_accepted`) → `/spec <id>` →
  check its stamp (`heraklios/spec@0.1.0`), its "Written against" line,
  its B/AC numbering, and that `metadata.yml` has no new gate → accept →
  `/build-plan <id>` → check its stamp, "Re-read on `main` at" line and
  sections → delete the throwaway folder and its `plan.md` queue row; no
  commit.

## Assumptions I made

- `artefactOrigins` takes the `stamps` maps the scan already builds, so
  it reads no files itself and stays pure.
- The README section goes before `## Stamps`, which it refers to.
- `/grid`'s own stamp version isn't bumped for one added rule unless the
  review asks (the grid file itself isn't regenerated here).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-22 — subtasks 1-7

Commits: `5e07b69` (scan, 1), `434f2b1` (README section, 2), `c09beb6`
(/spec, 3), `0ae3f24` (/build-plan, 4), `6b5ee5f` (/intent 0.1.3, 5),
`c3708d1` (/grid rule + sdlc.md + CLAUDE.md, 6), and the hand-over commit
(this entry, `status: in-review`, 7).

Shipped: `artefactOrigins` with 4 new tests (scan-lib tests 4 -> 8 in the
file; full suite 720 passed, 46 files); the three mutants (swap names, drop
name check, unstamped as hand) fail 3, 2 and 1 of the tests. `verify`
green, lint 21 (cap unchanged), `check:intent` PASS. `sdlc:scan`: spec.md 0
by /spec, 8 hand, 0 unstamped; plan.md 0 by /build-plan, 13 hand, 2
unstamped; equals the `grep` tally (templates excluded).

Divergences: `metadata.yml` went to `status: in-progress` inside the first
commit. The game `README.md` is untouched (process change, no game
behaviour, no Known simplification). The AC4 dry run is the owner's.
