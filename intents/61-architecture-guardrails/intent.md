<!-- generated-by: heraklios/intent@0.1.5 -->
# §61 — The SDLC keeps the architecture good: written principles, import rules, a size budget, a review pass and a KonMari tidy-up step

**Type:** feature
**Originator:** the owner (2026-11-02): "I would like my sdlc process to analyze
the architecture and keep it good"; then "draft the intent for 1-3 with these
principles". On 2026-11-06, the owner asked to "add a konmari step to our sdlc
process" (drafted as §68), then "Couldn't we merge 61 and 68" and "Go ahead".
**Source:**
- the coordinator's proposals 1-3 and its 17 principles, in the 2026-11-02 conversation;
- Tom Meyer's LinkedIn post on the "Vibing-Kruger effect"
  (https://www.linkedin.com/posts/tomto_in-1999-a-man-robbed-banks-after-smearing-share-7523687664953257984-ssCU/).
  It proposes six steps for AI-assisted work: ALIGN, TEST-BUILD, TEAR-DOWN,
  AMEND, CHECK and KONMARI. The last step: "Now ask the AI to clean up,
  refactor and DRY the code to make it simpler and more consistent,
  Marie-Kondo style", because "AIs like to duplicate code and this keeps your
  codebase manageable and simple."

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
- **Nothing removes what slips through.** The flow already covers five of the
  post's six steps:
  - ALIGN is the intent, spec and plan;
  - TEST-BUILD is the implementer;
  - TEAR-DOWN is the separate reviewer;
  - AMEND is the rework rounds;
  - CHECK is the live check.

  No step covers KONMARI, a tidy-up. The implementer's job is to meet the plan,
  and the reviewer only reads, so duplication an agent wrote stays unless a
  finding names it. Two review rules work against a tidy-up. Pass 1 says
  "Refactoring mixed into a feature is a finding". The "Finding vs nit" rule
  leaves out "could be shorter".

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
- **The KonMari step:** the process has a named tidy-up step, written in
  `sdlc.md`, `intents/README.md` and the skills that run it.
  - In the step, an agent simplifies the intent's own change against the
    principles below. It removes duplication, both inside the diff and with
    existing code. It takes out dead code, and it makes names and patterns
    consistent with their neighbours.
  - Behaviour doesn't change, and the evidence for that is:
    - `npm run verify` and `check:intent` stay green;
    - `npm run e2e` stays green when the paths call for it;
    - the test count doesn't fall, and no test is weakened;
    - the lint warning count doesn't rise;
    - the mutants review killed are still killed.
  - It ends with a short record, in the intent's folder, of what was tidied and
    what was looked at and left.
  - Review accepts the step's commits: they aren't a pass 1 "refactoring mixed
    in" finding, and the review that clears the branch has seen them.
  - `/auto` runs the step without a new prompt, and its stop rules and round
    budget still hold.

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
- **The KonMari step keeps the gates' meaning.** The `live_checked` gate must
  cover the code that merges, so the step can't change code after the live
  check without that check being redone.
- **The step tidies this intent's change, not the codebase.** A larger cleanup
  it notices becomes a new `refactor` intent.
- **`/auto`'s safety rules apply unchanged (step 10).** Nothing merges,
  pushes or rebases. No subagent records a gate. The lint cap is never raised.
  Mutants are restored by copy.

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
  - **Where the KonMari step sits.** The post puts KonMari after CHECK, but our
    live check must cover the code that merges. The options are:
    - after review attests and before the live check, with a short re-review
      of only the tidy-up commits;
    - inside the last rework round;
    - after the live check, which is then redone;
    - after merge, as a follow-up `refactor` intent.
  - **Who tidies.** The options are:
    - the implementer, which knows the code;
    - a fresh agent, as the post suggests for review ("use a new AI");
    - Claude Code's built-in `/simplify`, which makes quality-only changes.
  - **Its reach.** It could cover only the lines the diff added or changed, or
    also existing code the diff duplicates, for example replacing a new helper
    with an existing one.
  - **Its proof.** Is "suite and e2e green, review's killed mutants still
    killed" enough? Or does it need its own mutation sample over the moved
    lines?
  - **Its review.** Should pass 1 exempt the step's commits by name, or should
    the new architecture pass cover them? Does a tidy-up re-review count as
    one of `/auto`'s three rounds?
  - **Which types run it.** Feature, fix and refactor seem likely; adjustment
    and experiment probably not. Can the owner skip it for one intent, and
    where is that recorded?
  - **Phasing.** This intent is now large. Should the plan deliver it in phases
    with KonMari last, since it relies on `docs/architecture.md` and the
    architecture pass? Or should the spec split it again?

## Assumptions I made

- **Type is feature, not refactor or adjustment:** it adds new checks and a new
  plan section, well over an adjustment's limits, and has open design questions.
- This intent covers proposals 1-3, plus the KonMari step merged in from §68.
  The periodic `/architecture` review (proposal 4) and paying down `BoardScene`
  (proposal 5) are later intents. The KonMari step tidies only each new change,
  so nothing here shrinks an existing file.
- **What "KonMari" means here.** It is Marie Kondo's tidying method: keep only
  what earns its place, and put everything where it belongs. Following the
  post, I read it as cleaning up, refactoring and de-duplicating the change. It
  doesn't mean deleting features or tests.
- **§68 is folded in, not kept.** It was drafted on 2026-11-06 and never
  committed, and its folder is deleted. Its id isn't reused.
- **The post was read through a summary.** I fetched the LinkedIn post with a
  tool that summarised it, so the post's quotes are that tool's. I didn't check
  them against the page.
- `docs/architecture.md` is the single source of the principles;
  `REVIEW-POLICY.md`'s pass points to it instead of restating them.
- Principle 2's arrow allows skipping a layer: `scenes` may import `engine` and
  `data` directly, as they do today; only upward imports are refused.
- Line counts come from the coordinator's measurement on 2026-11-02; the plan
  re-measures.
