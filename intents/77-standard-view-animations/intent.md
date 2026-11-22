<!-- generated-by: heraklios/intent@0.1.5 -->
# §77 — The Standard view animates moves and combats, like the Drawn view

**Type:** feature
**Originator:** the owner (2026-11-22): "I want the animated moves on the
standard view".
**Source:** §66 (`intents/66-board-animations/spec.md`, B17 and its open
question 4); `README.md` → "Animations in the Drawn view".

## Problem

In the Standard view every move happens at once. A unit's counter jumps
straight to its new hex, and a counter that is eliminated vanishes.

- **Hard to follow.** It is hard to see what just happened, and hardest on a
  computer's turn, when several moves land in a row.
- **The Drawn view already animates.** §66 animated moves, clashes, rams,
  boardings, drifts and results there, at three speeds.
- **But not here, by choice.** §66 kept the Standard view still (spec B17,
  answering its open question 4 with "gets nothing"). The README says "The
  Standard view never animates and has no speed button".
- **Why that's a problem.** The Standard view is the default, so a player who
  never switches views never sees any of it.

## Outcome

- **Moves slide.** In the Standard view, a move slides the unit's counter hex
  by hex along its path, as in the Drawn view. That covers a charge's line,
  a ship's steps and a swap.
- **Combat and results too.** Unless the spec narrows this, the other §66
  cues play as well:
  - the clash, ram and boarding lunges;
  - fades and shakes;
  - retreats, pushes, advances and sacrifices, in the order they're committed;
  - drift beats.

  A ship's turn rotates its facing marker, since the Standard view has no
  figure to turn.
- **The same speed setting.** The **Speed** button shows in both views and
  sets one shared speed (Normal, Slow, Off), still stored as
  `heraklios.animationSpeed`.
- **Same rules as the Drawn view:**
  - the game state changes at once, so nothing waits on an animation;
  - a click or key finishes every animation;
  - undo, redo, load and a view switch snap straight to the new state;
  - a computer turn waits for its animations before its usual pause.
- **What doesn't change:**
  - rules, the log, saves, undo and the computer's choices;
  - Placement, which still never animates;
  - the e2e suite, which still runs with the speed set to Off.

## Constraints

- **No rule is involved.** The movement paths and cues are already engine
  functions (`movePath.ts`, `actionCue.ts`). This change only plays them in a
  second view.
- **One animator, not two.** The Drawn view's planner and animator
  (`animationPlan.ts`, `drawnAnimator.ts`, `drawnMotions.ts`) are reused for
  the Standard view's markers, not copied. Where they name the Drawn view's
  containers, the seam moves into `boardView.ts`.
- **Every cue plays in the view's own markers.** The Standard view's labels,
  rings, facing marks and drift arrow follow a moving counter, or show the new
  state at once, exactly as the Drawn view's highlights do (§66: "only the
  unit figures take their time").
- **Size budget.** `BoardScene.ts` (3172) and `PlacementScene.ts` are at
  their ceilings, so the work goes in `src/ui`, not the scenes.
  `standardBoardView.ts` is 371 lines.
- **Live check owed** (rule 1: `src/ui/**`), and the behaviour is visual and
  new, so the smoke suite cannot stand in. `e2e/board-animations.spec.ts`
  gains Standard-view cases.

## Type-specific questions

### Feature
- **Users:** hotseat players, and anyone watching a computer seat, in the
  Standard view.
- **Rulebook basis:** digital-only, no print rule.
- **Known simplification it removes:** none. It reverses a §66 design choice
  (B17), not a README "Known simplification".
- **Open design questions:**
  1. **Scope.** Moves only (the owner said "animated moves"), or every §66
     cue (clash, ram, boarding, fade, shake, drift)? The draft assumes every
     cue.
  2. **The speed setting.** One shared speed for both views, or a separate
     one for each? The draft assumes one shared speed.
  3. **The default.** Should the Standard view default to Normal like the
     Drawn view, or to Off, so that players used to the still board keep it
     until they opt in?
  4. **What moves with a counter.** Do the Standard view's counter labels,
     selection ring and facing mark slide with it, or appear at the end?

## Assumptions I made

- **Type: feature.** This is new player-visible behaviour, and it reverses a
  spec decision (§66 B17).
- **Tier.** The path table decides (`src/ui/**`, Attested). `review_tier` is
  left empty.
- **The id is 77,** from `npm run queue -- --next-id`.
- **Blocked by §74.** §74 changes `drawnUnits.ts`, which this work will
  refactor to share the animator. Building on top of §74 avoids reworking the
  same lines.
- **Not blocked by §73.** §73 changes how `BoardScene` settles combats, but
  it keeps the cue calls (`cues.apply`, `driftMove`, `driftClash`). This
  intent works in the views, so the two can be built in either order. A
  rebase may touch the same `renderAllUnits` call sites.
