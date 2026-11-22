<!-- generated-by: heraklios/intent@0.1.5 -->
# §73 — The Board scene and its computer seats settle combats through the engine session

**Type:** refactor
**Originator:** the owner (2026-11-21), splitting it out of §72 in the spec
question round: "Split it out".
**Source:** `intents/72-engine-host-seams/intent.md` → the amendment;
`intents/72-engine-host-seams/spec.md` → Out of scope and I1.

## Problem

§72 gives the engine a JSON game session. That session settles a combat as
questions and answers: retreat, push target, advance, exchange sacrifice and
drift. The fuzz harness and the new host entry use it. `BoardScene` does not:

- **Its own sequencer.** It keeps a second copy of the same sequencing:
  `executeLandAttack`, `beginRetreatChoices`, the retreat and drift queues,
  the advance offers and the exchange prompt (`BoardScene.ts:2127-2178`,
  `:2543-2614`, at `0e76d5b`). That copy is driven by closures and callbacks.
- **Inline state changes.** It still mutates `GameState` inline for the
  post-combat bookkeeping. `CLAUDE.md` says so: "the post-combat
  advance/elimination bookkeeping is still not extracted and mutates
  `GameState` inline".
- **A different order.** §72's spec I1 records that the harness and
  `BoardScene` order one step differently: the harness offers an advance
  even after a skipped defender item. §72 pins the harness's order. The
  scene's order is still the old one.

As a result, the rules' sequencing lives in two places that can drift apart.
`BoardScene.ts` stays at its 3,173-line ceiling, and the sequencing in it has
no unit tests.

## Outcome

- **One sequencer.** `BoardScene` settles every land attack, retreat, push,
  advance, exchange and drift through §72's session:
  - its human prompts answer the session's questions;
  - its computer seats answer them through the same adapter the harness uses.
  - The scene keeps only presentation: highlights, panels, the log, the
    drift's continue pause and §66's animations.
- **No copy left.** No sequencing code is left in the scene that duplicates
  the session's.
  - The scene's own retreat and advance queues are gone.
  - So are its inline `retreatUnitTo`, `completePush`, `position =` and
    `destroyed =` writes for combat consequences.
- **Same play.** The web game plays the same, apart from the one ordering
  difference that §72's I1 names. The spec decides that difference and
  records the decision.
- **Smaller scene.** `BoardScene.ts` is shorter, and its size baseline is
  lowered to match.

## Constraints

- **Blocked by §72** (`blocked_by`), merged first: this needs its session,
  questions and answer actions.
- **Undo, saves and autosave keep today's boundaries.**
  - A die roll and a phase change still clear the history.
  - Saving and undo are still refused while a question is open.
  - The save format does not change.
- **Rules are not touched.** The drift footgun (`REVIEW-POLICY.md` pass 9)
  applies to anything near the drift pump.
- **Testing.**
  - `npm run e2e` covers combat today: `attacks.spec.ts`, `swap.spec.ts`,
    `naval.spec.ts` and `attack-log.spec.ts`. Those scenarios stay green.
  - A scenario is added for any path they miss: an advance, an exchange, a
    drift with a trample.
- **Live check owed** (rule 1: `src/scenes/**`).
- **Out of scope:**
  - combined attacks in `legalActions`;
  - Unity;
  - saving mid-question;
  - `devHook` refactors.

## Type-specific questions

### Refactor
- **What is restructured:** `src/scenes/BoardScene.ts`, the combat and drift
  sequencing (about 600 lines). The prompts it keeps are re-pointed at the
  session's questions.
- **How behaviour is held constant:**
  - The e2e combat scenarios (named above) stay green with their
    expectations unchanged.
  - New e2e scenarios cover the advance, exchange and drift paths.
  - They are written against `main` **before** the change, so they
    characterise today's behaviour.
  - The one intended difference (§72 I1) is called out in the spec, and its
    scenario is updated in the same commit, with the reason.
- **Why now:** §72 leaves two sequencers. Every later change to combat
  resolution, a computer opponent, or a second front end (Unity, §70) would
  otherwise have to be made twice.

## Assumptions I made

- **Type: refactor, not feature.** No new player-visible behaviour is
  intended, apart from the I1 order, which the spec settles.
- **The tier** comes from the path table (`src/scenes/**` Attested).
  `review_tier` is left empty.
- **The id is 73,** from `npm run queue -- --next-id`.
- **It is a draft.** The owner accepts it when §72 is near done. Until §72
  merges, `npm run spawn` and `/auto` will refuse to build it.
