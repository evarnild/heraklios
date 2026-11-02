<!-- generated-by: heraklios/intent@0.1.5 -->
# §61 — The SDLC checks the architecture: written principles, import rules, a size budget and a review pass

**Type:** feature
**Originator:** the owner (2026-11-02): "I would like my sdlc process to analyze
the architecture and keep it good"; then "draft the intent for 1-3 with these
principles"
**Source:** the coordinator's proposals 1-3 and its 17 principles, in that
conversation

## Problem

The process protects the architecture only partly, and big files can keep
growing unnoticed:

- **Nothing enforces the boundaries.** Today's code respects them: no
  `src/engine` or `src/data` file imports Phaser, `scenes` or `ui`, and no
  `src/ui` file imports `scenes`. But only review pass 5 checks this
  (`REVIEW-POLICY.md:168`); `eslint.config.js` has no import rule.
- **The lint cap can't see growth.** It counts warnings, not size, so an
  oversized file stays one warning however long it gets. `BoardScene.ts` went
  from 3,082 to 3,136 lines during recent work with the count unchanged at 21.
- **Plans don't say where code goes.** The plan template
  (`intents/_templates/plan.md`) has no section for it, so a placement problem
  surfaces at review, after the code exists. No review pass asks about module
  responsibility or duplication either.
- **The principles aren't written in one place.** There is no
  `docs/architecture.md`; some rules are in `CLAUDE.md` and `REVIEW-POLICY.md`,
  others are only practice.

## Outcome

- `docs/architecture.md` states the 17 principles below, how each is checked,
  and the recorded exceptions (at least the post-combat bookkeeping in
  `BoardScene`). `CLAUDE.md` keeps its module map and points to the file.
- **Import rules:** a change breaking principles 1-4's import boundaries fails
  `npm run verify`, through ESLint's built-in `no-restricted-imports`, with no
  new dependency. A test or demonstration shows each rule really fires.
- **Size budget:** a committed baseline of line counts covers the files over
  the 500-line limit. `npm run check:intent` fails when such a file grows past
  its allowance without a reason stated in the plan, or when a file newly
  crosses the limit. Shrinking a file lowers its baseline.
- **Plan and review:** plans gain a "Where this goes" section (modules touched,
  new modules, why there), produced by `/build-plan`. `REVIEW-POLICY.md` gains
  an architecture pass that checks the judged principles against that section
  and the diff. A wrong layer is a "Needs rework:" finding; a real trade-off or
  new exception is a "Needs decision:" finding. `/review` and the reviewer
  agent run it.

### The principles

Layers and dependencies:

1. **Engine and data stay pure:** `src/engine/` and `src/data/` never import
   Phaser, `scenes` or `ui`, and use no browser APIs. *Enforced for imports,
   judged for the rest.*
2. **Dependencies point one way:** `scenes` → `ui` → `engine` → `data`, never
   back up. *Enforced.*
3. **The server only stores:** `server/` holds no game rule and imports only
   `engine/saveGame.ts` from the game. *Enforced.*
4. **Tooling stays out of the game:** `tools/` and `scripts/` are never imported
   by the game, and the build contains nothing from them. *Enforced for
   imports.*

Where logic lives:

5. **Rules live in the engine or data:** scenes and UI only wire up clicks and
   draw. *Judged.*
6. **One source of truth:** a rule or number has one home, and anything showing
   it reads from there. *Judged.*
7. **State changes go through the engine:** a scene changes game state through
   `applyAction` or engine functions, not inline. The post-combat bookkeeping
   is the known exception; new exceptions aren't allowed. *Judged.*
8. **The engine returns data, not text:** player-facing text lives only in
   `src/ui/i18n/`, in English and French. *Enforced in part by
   `noLiterals.test.ts`, judged for the engine.*

State and determinism:

9. **Game behaviour stays deterministic:** randomness comes from the injected
   die or seeded generator, so a seeded game replays identically. *Judged,
   backed by the self-play tests.*
10. **Humans and computer players use the same rules:** anything a player can do
    has an action `legalActions` and `applyAction` know about, or the plan says
    why not. *Judged.*
11. **Save and undo stay safe:** a change to game state's shape deals with save
    compatibility, and each undoable change records history first. *Judged.*

Size and structure:

12. **Modules have one clear job:** a new module's purpose fits in a sentence,
    and new work doesn't pile into a large file when it has a natural home
    elsewhere. *Judged.*
13. **Size limits and the budget:** the existing limits stay (file 500 lines,
    function 80, complexity 20, 7 parameters, nesting 4, lint cap never raised),
    and a file over the limit can't grow beyond its allowance without a stated
    reason. *Enforced.*
14. **Few dependencies:** a new dependency needs a reason, is pinned and goes in
    the plan. *Judged.*

Tests and traceability:

15. **Logic is testable without a browser:** new logic goes in pure functions
    with tests; only wiring and drawing rely on e2e and the live check. *Judged.*
16. **Interpretations leave a trace:** a rulebook reading or deliberate departure
    gets a code comment where it's implemented, and the README records
    departures. *Judged.*
17. **Structural decisions are written down:** a new layer, a new boundary or an
    exception goes in `docs/architecture.md` with its reason. *Judged.*

## Constraints

- **No game behaviour change:** nothing in `src/` changes except what a new rule
  proves is an actual violation (none is expected for the import rules; see the
  open design questions).
- **The lint cap stays 21.** The new import rules are errors from the start, so
  they don't spend the warning count.
- **Tier:** `REVIEW-POLICY.md` and `.claude/skills/**` are Reviewed by the path
  table, so you read the diff. Tightening `eslint.config.js` doesn't itself
  raise it.
- **Skill stamps:** `/review`'s and `/build-plan`'s versions are bumped when
  those skills change.
- **Existing intents aren't rewritten:** an open plan without "Where this goes"
  stays valid, and the budget's baseline starts from `main` when this merges.
- **Parallel work:** §55, §56, §58 and §60 are open, and §58 and §60 edit
  `CLAUDE.md`, so this needs a careful merge. The baseline must be measured
  after whichever of them merge first, or be regenerated at merge.
- **Rulebook:** none; SDLC tooling.
- **Live check:** not expected, since nothing runtime-only changes; the review
  decides.

## Type-specific questions

### Feature
- **Users:** the owner, and the agents that plan, build and review.
- **Rulebook basis:** digital-only — no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - **Principle 2 and the map editor.** `src/map-editor/` is a second app and
    fits no layer; it imports `ui/hexRender`, `ui/i18n`, `data/*` and
    `engine/hex`. Is it a top layer beside `scenes`, with neither importing the
    other?
  - **Principle 3 and tests.** `server/*.test.ts` import more than
    `engine/saveGame.ts` (`engine/army`, `state`, `turnManager`) to build
    fixtures. The rule presumably exempts test files.
  - **Principle 9's wording.** `rollDie`, `applyAction` and `HeuristicAgent`
    default their generator to `Math.random` while accepting an injected one.
    That default is the current convention; the principle should allow it and
    forbid only a direct call that can't be injected.
  - **Budget numbers:** the allowance (the coordinator's suggestion: about 50
    lines), whether it is per change or per intent, and where a reason is
    written (the plan's "Where this goes").
  - **Budget scope:** `src/` only, or also `scripts/` and `tools/`? Test files?
  - **Where the budget's check lives:** in `scripts/check-intent.mjs`, or in its
    own script that `check:intent` runs.
  - **Pass numbering:** a new pass 10, or a rewrite of pass 5 that absorbs it
    (reports and the policy cite the numbers); and how it shares principle 14
    with pass 8.

## Assumptions I made

- **Type is feature, not refactor or adjustment:** it adds new checks and a new
  plan section, well over an adjustment's limits, and has open design questions.
- This intent covers proposals 1-3 only. The periodic `/architecture` review (4)
  and paying down `BoardScene` (5) are later intents, and nothing here shrinks
  an existing file.
- `docs/architecture.md` is the single source of the principles;
  `REVIEW-POLICY.md`'s pass points to it instead of restating them.
- Principle 2's arrow allows skipping a layer: `scenes` may import `engine` and
  `data` directly, as they do today; only upward imports are refused.
- Line counts come from the coordinator's measurement on 2026-11-02; the plan
  re-measures.
