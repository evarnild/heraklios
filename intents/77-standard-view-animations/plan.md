<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §77 plan — The Standard view animates moves and combats, like the Drawn view

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

- **The Standard view animates.** Its counters slide, lunge, shake and fade as
  the Drawn figures do (spec B1-B5). A ship's facing mark travels with its
  counter and turns in place, and the counter image stays upright (B6, B7).
- **One animator.** The planner, queue and motion curves stay single copies.
  They now act on a small `UnitFigure` seam in `boardView.ts` instead of a Drawn
  `Container`. One shared unit layer (`unitLayer.ts`) does the reconcile,
  animate, settle and fade bookkeeping for both views. Each view only says how
  to make its own figure (I4).
- **The rest as in the Drawn view.** The drift arrow waits for the slide
  through one shared holder (B9). The Speed button shows in both views (B12).
  Snaps, cut-short and computer waits come from code that already exists and
  now runs in both views (B11).
- **No scene change.** `BoardScene.ts` and `PlacementScene.ts` are not in the
  diff. The scene already passes a cue or `'snap'` to whichever view is shown.

## Risks

- **The Drawn view must not change (B16).** `DrawnUnits` is re-plumbed onto
  the shared layer.
  - The shared layer keeps `DrawnUnits.setUnits`/`settle`/`depart` line for
    line (`drawnUnits.ts:126-190`). Only `container` becomes `figure`.
  - The galley's turn now goes through `facingPart`, which is
    `figureOf(container)` for a Drawn figure: the same object it rotates today.
  - Caught by: `unitLayer.test.ts` (below) and the Drawn e2e scenarios
    (`board-animations.spec.ts:38-59`, `:101-121`; `board-view.spec.ts`, which
    reads `unitRotations` and the ghost). Run in subtask 9.
- **A facing mark ahead of its counter (B6).** The arrows must stop coming
  from `setFacingIndicators`. Today it redraws every ship's arrow at its final
  hex and facing on every `renderAllUnits` (`BoardScene.ts:920`,
  `standardBoardView.ts:244-251`). If any non-ghost entry is still drawn
  there, the arrow jumps to the destination while the counter is still
  sliding.
  - The Standard `setFacingIndicators` draws only the staged ship (entries
    with `ghostTypeId`), as the Drawn view already does (`drawnBoardView.ts:77-79`).
  - A placed ship's mark comes from its `UnitDrawing.facing`, which both
    scenes already set for ships (`BoardScene.ts:914`, `PlacementScene.ts:326`).
- **The interaction with §76** (spec accepted, not built). §76 dims earlier
  seats' units in Placement. It asks that "The Drawn view's `settle` must not
  bring a dimmed unit back to alpha 1" (§76 spec B3), and that the Standard
  arrows be dimmed through a flag on `FacingShip`.
  - This plan adds `unitAlpha(drawing)` to `boardView.ts`. It returns 1 today
    and is the one function both views use for a unit's resting alpha. The
    shared layer applies it after `make` and in `settle`, never a hard 1. §76's
    spec names a function of exactly this shape ("a pure `unitAlpha(drawing)`
    (or the like)", §76 AC3), so §76 only adds its flag's branch there.
  - The Standard mark's alpha follows its counter's, because the joint figure's
    `setAlpha` sets both. So a dimmed counter dims its own mark, with no flag on
    `FacingShip`.
  - **If §76 merges first,** this branch rebases:
    - keep §76's `unitAlpha`;
    - drop its Standard dimming of non-ghost arrows in `setFacingIndicators`,
      which this plan no longer draws there;
    - keep §76's alpha parameter on `drawFacingArrowhead` beside this plan's
      `drawArrowheadAt` (subtask 5).
  - **If §77 merges first,** §76's plan uses the existing `unitAlpha` and
    the unit layer's arrows, and needs no `FacingShip.dimmed` for the Standard
    view.

  Either way the second to merge reworks a few lines, not a design.
- **The draw order of the marks.** Today all arrows are in one `Graphics` at
  depth 11 (`standardBoardView.ts:44`). It was made before `ringGraphics`
  (`:45`, also 11), and Phaser's depth sort is stable
  (`node_modules/phaser/src/gameobjects/DisplayList.js:190`, `StableSort`),
  so rings draw over arrows. Per-unit marks made later at depth 11 would draw
  over the rings.
  - The marks go at depth 10.5: over every counter (10), under the rings (11).
    That keeps today's look.
  - `displayListSorted` stays true, because the layer still calls
    `queueDepthSort` (`standardBoardView.ts:130`). Covered by
    `draw-order.spec.ts` and `board-view.spec.ts:58-87`.
- **HUD camera leaks.** Every per-unit mark is a new world object. It goes
  through `host.ignoreOnUiCamera` when made, and into `mapObjects()`, or the
  fixed HUD camera draws it twice. Covered by `e2e/hud-strays.spec.ts`.
- **Window listeners in the Standard view.** The animator adds capture-phase
  `pointerdown`/`keydown` listeners when built (`drawnAnimator.ts:39-46`).
  The Standard view is the default and is also Placement's, so the listeners
  now exist there too. They act only while an animation is `active`, and
  Placement always snaps, so nothing changes there.
  - Destroying the view removes them (`drawnAnimator.ts:79-89`). A view switch
    destroys the old view (`MapView.ts:173`).
  - The `once('shutdown')` closure each animator registers (`:45`) is not
    removed on destroy. That is already true of the Drawn view, and this plan
    leaves it as is.
- **Tests that pass whatever the code does.**
  - The layer and motion tests assert positions both part-way and after the
    end, against exact expected values, not only "changed".
  - The e2e Standard move asserts an intermediate position more than 12 px
    from both ends (AC2), as the Drawn case does.
- **Runtime Phaser in unit tests.** Vitest runs in `node`
  (`vitest.config.ts:5`), where importing `phaser` fails.
  - `unitMotions.ts` must lose its one runtime use,
    `Phaser.Math.Angle.Wrap` (`drawnMotions.ts:66`), for a local `wrapAngle`
    with the same formula.
  - `unitLayer.ts` and `unitAnimator.ts` import Phaser as a type only, as
    `drawnAnimator.ts:1` already does.
  - The Standard counter maker (`standardUnits.ts`) imports `hexDraw.ts`,
    which needs Phaser at runtime, so it is not unit-tested. Its testable part,
    the joint figure, lives in `unitLayer.ts`.
- **A stale comment we may not fix.** `devHook.ts:109` says "the markers
  re-stacking in `StandardBoardView.setUnits`". After this change the
  restacking is in `UnitLayer.setUnits`. `devHook.ts` is §75's to rewrite, so
  it is left alone and named in the review. `PlacementScene.ts:319` ("the
  Standard view ignores it") goes stale the same way. §76 rewrites those lines,
  and the scene is at its ceiling, so that comment is left alone too.
- **`BoardScene` still sends every ship to `setFacingIndicators`**
  (`BoardScene.ts:909`, `:915-917`, `:920`). Both views now ignore the
  non-ghost entries. Removing them would shrink the scene, but it would
  collide with §73 (BoardScene) and §76 (`FacingShip`). This plan keeps the
  call. The review may name it as a follow-up.
- **Computer turns are slower at Normal** in the Standard view, because a
  computer seat now waits for each animation (`BoardScene.ts:3065-3067`). That
  is the spec (B11). The e2e suite runs at Off (`playwright.config.ts:35-38`),
  so its time should not grow (AC10).
- **Renames.** `drawnAnimator.ts` and `drawnMotions.ts` become
  `unitAnimator.ts` and `unitMotions.ts`, since both views use them now. The
  rename is its own commit (subtask 1), with no other edit, so git still
  detects it.
- **The project's usual classes.**
  - Stale line citations: re-check the cites below before editing.
  - The lint cap: 19 (`package.json:12`). No new function goes past 80 lines
    or complexity 20, and if warnings fall, the cap is lowered in the same
    commit.
  - The size budget: no file over 500 lines is touched (below).
  - Drift-machine fall-through: not relevant, no engine change.

## Verified against the codebase

Re-read on `main` at `9eeb49a` (the spec cites `1c4ba2d`; only intent folders
changed between them).

**The seam today (I4)**
- `src/ui/drawnMotions.ts:6-9`: `figureOf(container)` returns
  `container.list[1]`, "The container's figure layer".
- `src/ui/drawnMotions.ts:17-22`: `MotionHost` is `toScreen`,
  `container(id): Phaser.GameObjects.Container | undefined` and `dispose(id)`.
- `src/ui/drawnMotions.ts:38-86`: `makeRunner`. It reads `c.x`/`c.y` at start;
  a slide, lunge and shake `setPosition` the container; a `turn` rotates
  `figureOf(c)` by `Phaser.Math.Angle.Wrap(target - start)` (`:62-71`, Wrap at
  `:66`); a `fade` does `c.setAlpha(1 - p)` and then `host.dispose` (`:72-76`).
- `src/ui/drawnAnimator.ts:1`: `import type Phaser from 'phaser'` (type only).
  `:7-14` `AnimatorHost extends MotionHost` adds `scene`, `settleAll`,
  `onDrained`. `:39-46` are the window capture listeners and the `shutdown`
  hook. `:67-77` is `finishAll`, `:79-89` is `destroy`, and `:97` builds
  runners through `makeRunner(this.host, m)`.
- `src/ui/animationPlan.ts:9-15`: doc says "The Drawn view's animation
  planner". `:81-114`, `planAnimation`, names no view.
- `src/ui/drawnUnits.ts:10`: imports `figureOf`. `:75-82` builds the animator
  with a `container` lookup over `units` then `departing`. `:112-117` is
  `inspect`, which reads `figureOf(u.container).rotation`. `:126-156` is
  `setUnits` (snap, plan, depart the fading ones, settle when the plan is
  empty, `bringToTop` and `queueDepthSort`). `:159-165` is `settle`, with
  `setAlpha(1)` at `:163`. `:168-190` are `settleAll`, `depart`, `dispose`
  and `remove`. `:192-204` is `make`, named by id at `:201`.
- `src/ui/drawnBoardView.ts:24`: `pendingArrow`. `:28`: `new DrawnUnits(host,
  () => this.showPendingArrow())`. `:77-79`: `setFacingIndicators` draws only
  the ghost. `:90-110`: the held drift arrow (set, clear, show on drain).

**The Standard view today**
- `src/ui/standardBoardView.ts:10`: `type Marker = Image | Text`. `:27`: the
  `markers` map. `:44-45`: `facingGraphics` and `ringGraphics`, both depth 11.
  `:54`: `driftArrowGraphics`, depth 12.
- `src/ui/standardBoardView.ts:94-104`: `mapObjects` lists the markers.
  `:106-131`: `setUnits(units)` takes no motion and repositions at once
  (`:117-118`). `:126` restacks and `:130` does `queueDepthSort`. `:133-136`:
  `removeMarker`.
- `src/ui/standardBoardView.ts:141-169`: `makeMarker`. It sets an image at
  depth 10 sized to `HEX_SIZE * 1.6`, or a text chip, then calls
  `ignoreOnUiCamera`. It sets no name and no rotation.
- `src/ui/standardBoardView.ts:236-251`: the arrowheads, with "the marker
  image itself … must stay upright". All ships are drawn into `facingGraphics`,
  which is cleared on each call. `:253-255`: `clearFacingIndicators`.
- `src/ui/standardBoardView.ts:267-275`: the drift arrow. `:360-370`:
  `destroy`.
- `src/ui/hexDraw.ts:15-47`: `drawFacingArrowhead(graphics, center, facing,
  colorHex, scale)` takes `angle = facingAngleRad(facing)` at `:22`.
- `src/ui/hexRender.ts:50-52`: `facingAngleRad(f) = π/180 · (30 − 60f)`, so no
  integer facing is angle 0. A mark drawn along +x needs an angle-taking
  helper. `hexRender.ts` imports no Phaser.

**The interface and the surface**
- `src/ui/boardView.ts:1`: `import type Phaser` only. `:8-10`: the doc says
  "the Standard view draws facings through `setFacingIndicators` instead".
  `:20-31`: `FacingShip` has no unit id. `:43-50`: `UnitMotion`, "The Standard
  view ignores it". `:62-66`: `finishAnimations?` and `animationsSettled?`
  are optional.
- `src/ui/MapView.ts:168-178`: `setViewKind` calls `finishAnimations?.()`,
  replays into the new view and destroys the old one. `:185`: `drawnInspect`
  is for the Drawn view only. `:306-311`: `setUnits` forwards the motion.
  `:314-316`: `animationsSettled` falls back to `Promise.resolve()`.
- `src/ui/speedToggle.ts:14-21`: "visible only in the Drawn view (B13)".
  `:22-42`: `createSpeedToggle(scene, x, y, viewKind)` returns `{ button,
  sync }`. `:48-56`: `createViewControls` passes `speed.sync` into
  `createViewToggle`.
- `src/ui/viewToggle.ts:36-51`: `createViewToggle(…, onChange?)`. `onChange`
  is used only by `createViewControls` (`speedToggle.ts:55`). Placement calls
  it with four arguments (`PlacementScene.ts:268`).
- `src/ui/animationSpeed.ts:3-5`: "How fast the Drawn view animates".
  `:18-21`: absent or invalid is Normal.
- `src/ui/devHook.ts:251-252`: `busy` counts the scene's tweens.
  `:369-372`: `unitCanvas` is `scene.children.getByName(unitId)` and reads its
  `x`/`y`. `:109`: the comment cited in Risks.

**The scenes (read only, not edited)**
- `src/scenes/BoardScene.ts:908-934`: `renderAllUnits`. `:914` puts `facing`
  on naval drawings. `:919` calls `setUnits(drawings, snap ? 'snap' :
  this.cues.take())`. `:920` calls `setFacingIndicators(ships)`. `:926-932`
  set the drift arrow.
- `src/scenes/BoardScene.ts:770`: `createViewControls(this, …, this.mapView)`.
  `:3065-3067`: `pause` waits on `mapView.animationsSettled()`.
- `src/scenes/PlacementScene.ts:319-327`: placed units are drawn with
  `'snap'`, and ships carry `facing`. `:334`, `:458-465`: `shipArrowList`,
  placed ships plus the ghost. `:541`: `'snap'`. `:268`: view toggle only.

**Checks and tests**
- `e2e/board-animations.spec.ts:38-59`: the Drawn Normal slide. `:61-78`:
  speed button (`:63` "no speed button in the Standard view", `:72` "hidden in
  the Standard view"). `:80-93`: "the Standard view starts no tween on a move".
  `:101-121`: Drawn Slow click-to-finish.
- `e2e/rules-panel.spec.ts:32-43`: local `frames` and `chord` (one key press,
  a frame between each event).
- `playwright.config.ts:35-38`: the suite's default storage sets the speed to
  `off`.
- `vitest.config.ts:5`: `environment: 'node'`.
- `package.json:12`: `eslint . --max-warnings 19`.
- `scripts/size-baseline.json:6-7`: `BoardScene.ts` 3172 and
  `PlacementScene.ts` 548. No `src/ui/` file is listed.
- `wc -l`: `standardBoardView.ts` 371, `drawnUnits.ts` 212,
  `drawnAnimator.ts` 135, `drawnMotions.ts` 86, `drawnBoardView.ts` 133,
  `boardView.ts` 140, `MapView.ts` 463 (not touched).
- `README.md:570`: "#### Animations in the Drawn view". `:602`: "(shown in the
  Drawn view only)". `:611`: "The Standard view never animates and has no
  speed button."
- `intents/76-placement-shows-placed-armies/spec.md` (accepted at `199dea4`),
  B2, B3, AC3 and "The view seam", as quoted in Risks.

## Where this goes

- **Modules touched:**
  - `src/ui/boardView.ts`: gains the `UnitFigure` seam and `unitAlpha`. The
    doc comments on `UnitDrawing.facing`, `FacingShip`, `UnitMotion` and
    `finishAnimations` now say what both views do.
  - `src/ui/drawnUnits.ts`: keeps the figure drawing, the ghost, `inspect` and
    `figureOf` (moved here from the motions). Its reconcile and animate
    bookkeeping moves to `unitLayer.ts`.
  - `src/ui/drawnBoardView.ts`: the held drift arrow goes through
    `HeldDriftArrow`.
  - `src/ui/standardBoardView.ts`: the markers move out to the layer.
    `setUnits` takes the motion, `finishAnimations` and `animationsSettled`
    are added, and the drift arrow is held. `setFacingIndicators` draws only
    the ghost.
  - `src/ui/hexDraw.ts`: `drawArrowheadAt(graphics, center, angle, colorHex,
    scale)` is pulled out of `drawFacingArrowhead`, which calls it. Same
    triangle, same callers.
  - `src/ui/animationPlan.ts`, `src/ui/animationSpeed.ts`: doc comments only.
  - `src/ui/speedToggle.ts`: the button is always shown. `src/ui/viewToggle.ts`:
    the now-unused `onChange` parameter goes.
  - `e2e/board-animations.spec.ts`, `e2e/helpers.ts`,
    `e2e/rules-panel.spec.ts` (`frames`/`chord` move to the helpers).
  - `README.md`: the animations section.
- **Renamed:** `src/ui/drawnAnimator.ts` → `src/ui/unitAnimator.ts`
  (`DrawnAnimator` → `UnitAnimator`); `src/ui/drawnMotions.ts` →
  `src/ui/unitMotions.ts`.
- **New modules:**
  - `src/ui/unitLayer.ts`: one board view's unit layer, minus the drawing.
    It holds the per-id figures, the fading ones and the one animator, and it
    reconciles, plans, plays, settles and disposes for whichever view supplies
    a `make`. It also exports `jointFigure`, a figure made of a lead object and
    a follower kept on it (the Standard counter and its facing mark).
  - `src/ui/standardUnits.ts`: makes the Standard view's figure for one unit.
    That is the counter image (or text chip), named by the unit id, plus for a
    ship a facing mark `Graphics` at depth 10.5, drawn along +x and rotated to
    its facing.
  - `src/ui/heldDriftArrow.ts`: holds a drift arrow while a unit animation
    plays and shows it when the queue drains, for either view. Pure, no Phaser.
  - Tests: `src/ui/unitMotions.test.ts`, `src/ui/unitLayer.test.ts`,
    `src/ui/heldDriftArrow.test.ts`.
- **Why there:**
  - Presentation only, all in `src/ui/` (principle 5). No rule is involved, and
    `engine/`/`data/` are untouched (AC8).
  - The seam type goes in `boardView.ts`, as the intent asks ("Where they name
    the Drawn view's containers, the seam moves into `boardView.ts`").
  - The shared bookkeeping goes in its own module, not copied into
    `standardBoardView.ts` (principle 6, intent "One animator, not two").
  - Each new module has one job (principle 12), and the testable parts are
    Phaser-free with unit tests (principle 15).
  - `standardUnits.ts` is the separable counter layer that §78 wants.
  - The scenes are not touched, which meets the size ceilings without a budget
    (principle 13).
- **Budget lines:** none. No file over 500 lines is in the diff. Expected
  sizes: `standardBoardView.ts` about 320, `drawnUnits.ts` about 130,
  `unitLayer.ts` about 150, each of the others under 140.

## Subtasks

Each ends with `./node_modules/.bin/tsc --noEmit` and `npx vitest run`, and is
committed. Subtasks 3, 5 and 9 also run `npm run verify`, on its own, not
alongside anything else heavy.

1. **Rename, no behaviour change.**
   - `git mv` `drawnAnimator.ts` → `unitAnimator.ts` and `drawnMotions.ts` →
     `unitMotions.ts`.
   - `DrawnAnimator` → `UnitAnimator`, and the imports in `drawnUnits.ts`.
   - Nothing else in the commit.
2. **The figure seam** (I4, B6, B7).
   - In `boardView.ts`, add:
     ```ts
     export interface UnitFigure {
       readonly active: boolean; readonly x: number; readonly y: number; readonly alpha: number;
       setPosition(x: number, y: number): void;
       setAlpha(alpha: number): void;
       /** What a turn rotates: the galley figure (Drawn), the facing mark (Standard); null with no facing. */
       readonly facingPart: { readonly rotation: number; setRotation(radians: number): void } | null;
     }
     export function unitAlpha(unit: UnitDrawing): number // 1 today: the one resting alpha (§76 adds its dim here)
     ```
   - `MotionHost.container` becomes `unit(id): UnitFigure | undefined`.
   - A `turn` rotates `facingPart`, and returns null when it is null.
   - A `fade` goes from the figure's alpha at its start to 0. That is
     identical for a Drawn figure, which is at 1.
   - `Phaser.Math.Angle.Wrap` becomes a local `wrapAngle` (Phaser's formula,
     wrapped to [−π, π)), so the module has no runtime Phaser import.
   - `figureOf` moves to `drawnUnits.ts`. `DrawnUnits` hands the animator a
     container figure whose `facingPart` is `figureOf(container)`.
   - Doc comments in `unitMotions.ts`, `unitAnimator.ts` and
     `animationPlan.ts` now name both views.
   - Tests: `unitMotions.test.ts`, and `unitAlpha` in `boardView.test.ts`.
3. **The shared unit layer** (B5, B11, B16).
   - `unitLayer.ts`: `UnitLayer<F extends LayerFigure>`, where `LayerFigure`
     is `UnitFigure` plus `objects()` (the first is the one restacked) and
     `destroy()`. Constructed with `(host: ViewHost, make, onDrained)`.
   - It carries over `drawnUnits.ts:126-190` unchanged in logic: `animating`,
     `finishAnimations`, `animationsSettled`, `figures()`, `objects()`,
     `setUnits(units, motion)`, `destroy`.
   - `settle` puts the figure on its hex, at `unitAlpha(drawing)`, with
     `facingPart` at `facingAngleRad(facing)` (or 0). It never uses a hard 1.
   - `make` is followed by `setAlpha(unitAlpha(unit))`.
   - `jointFigure(lead, follower | null)`: `x`, `y`, `alpha` and `active` are
     the lead's. `setPosition` and `setAlpha` go to both. `facingPart` is the
     follower. `objects()` is `[lead, follower]`. `destroy` destroys both.
   - `DrawnUnits` uses `UnitLayer`. `inspect` reads `figures()`.
   - Tests: `unitLayer.test.ts`, with a fake scene (`children.bringToTop`,
     `queueDepthSort`, `tweens.addCounter` recorded and driven by the test,
     `events.once`).
4. **The held drift arrow** (B9).
   - `heldDriftArrow.ts`: `HeldDriftArrow(animating, draw, erase)` with
     `set(arrow)`, `clear()` and `release()`, behaving as
     `drawnBoardView.ts:90-110` does.
   - `DrawnBoardView` uses it, and `pendingArrow`/`showPendingArrow` go.
   - Tests: `heldDriftArrow.test.ts`.
5. **The Standard view animates** (B1-B7, B11).
   - `hexDraw.ts`: add `drawArrowheadAt`.
   - `standardUnits.ts`: `makeStandardFigure(host, unit)`. It makes the
     counter as `makeMarker` does today plus `.setName(unit.id)` (AC2). A ship
     (`unit.facing !== undefined`) also gets a mark `Graphics`. The mark is
     drawn with `drawArrowheadAt(g, {0,0}, 0, owner colour)`, placed on the
     counter, set to depth 10.5 (a code comment says why), and rotated to
     `facingAngleRad(facing)`. Both objects go through `ignoreOnUiCamera`. It
     returns `jointFigure(marker, mark)`.
   - `StandardBoardView`:
     - it holds a `UnitLayer` and a `HeldDriftArrow`;
     - `setUnits(units, motion)` forwards both arguments;
     - `finishAnimations` and `animationsSettled` forward to the layer;
     - `mapObjects` includes `layer.objects()`;
     - `setFacingIndicators` draws only entries with `ghostTypeId` into
       `facingGraphics`, with a comment: placed ships' marks belong to their
       counters, B6;
     - `setDriftArrow` and `clearDriftArrow` go through the holder;
     - `destroy` destroys the layer;
     - `markers`, `removeMarker` and `makeMarker` are removed.
   - Code comments carry I1 (the mark fades and shakes with its counter), I2
     (only the mark turns; the counter stays upright) and I3 (the other
     decorations show the new state at once).
6. **One Speed button for both views** (B12, B13).
   - `createSpeedToggle(scene, x, y)` returns the button, always visible and
     interactive.
   - `createViewControls` keeps its signature, so `BoardScene.ts:770` is
     unchanged.
   - `createViewToggle` loses `onChange`.
   - Doc comments in `speedToggle.ts` and `animationSpeed.ts:3-5` say both
     views (B12 reverses §66 B13 and B17).
7. **e2e** (AC2-AC7).
   - Move `frames` and `chord` from `rules-panel.spec.ts` to `e2e/helpers.ts`.
   - In `board-animations.spec.ts`:
     - the Normal slide (`:38-59`) and the Slow click-finish (`:101-121`)
       run once per view, through a loop over `['standard', 'drawn']`, with the
       Drawn assertions unchanged;
     - the speed-button test is rewritten for AC5;
     - `:80-93` is replaced by a new `describe('at Off speed')` with explicit
       `off` storage (AC6);
     - a Slow Standard undo test is added (AC4);
     - the header comment is updated.
8. **README.** "Animations in the Drawn view" (`README.md:570-613`) becomes
   one section for both views:
   - the Standard specifics: the counter slides, its facing mark travels and
     turns, and the counter stays upright;
   - the Speed button in both views;
   - `:611` "The Standard view never animates …" goes, and "Placement never
     animates" stays.
9. **Validation**, below, one heavy command at a time.

## Tests

| Behaviour | Test that fails if it is broken |
| --- | --- |
| B1-B4 steps (unchanged planner) | `animationPlan.test.ts`, unchanged (AC1) |
| Slide, lunge, shake move the figure; end exactly at target or start (B1-B3) | `unitMotions.test.ts`: a fake figure's position at half time is strictly between the two ends, and `end()` gives the exact target (slide) or start (lunge, shake) |
| A turn rotates only `facingPart`, the shorter way (B1, B7, I2) | `unitMotions.test.ts`: facing 0→5 rotates by +π/3, not −5π/3. Position is unchanged. A null `facingPart` gives no runner |
| `wrapAngle` equals Phaser's `Angle.Wrap` | `unitMotions.test.ts`: the values at ±π, 3π and −3π/2 match Phaser's formula, written out in the test |
| A fade goes from the current alpha to 0, then disposes (B2, B3) | `unitMotions.test.ts`: a figure at 0.6 is at 0.3 half way. `end()` calls `dispose(id)` once |
| A missing or inactive unit gives no runner | `unitMotions.test.ts` |
| A move at Normal animates; `finishAnimations` lands it (B1, B11) | `unitLayer.test.ts`: after `setUnits` with a moved unit, a counter tween was started and the figure is still on its old hex. After `finishAnimations` it is on the new hex and `animating` is false |
| Off and `'snap'` draw at once (B11, B14) | `unitLayer.test.ts`: at Off no tween starts and the figure is on its new hex. `'snap'` mid-animation finishes the queue and draws at once |
| An added unit, or a recreated one, shows at once (B5) | `unitLayer.test.ts`: `make` is called, no tween, the figure is at its hex |
| A removed unit fades, then goes (B2) | `unitLayer.test.ts`: the removed figure is still in `objects()` during the fade and destroyed after it |
| Equal drawings play nothing (§66 B8) | `unitLayer.test.ts`: a second `setUnits` with the same list starts no tween and does not settle a moving figure |
| `settle` restores the resting alpha, not 1 (§76 interaction) | `unitLayer.test.ts`: a figure left at alpha 0.2 by an interrupted motion settles back to `unitAlpha(drawing)`. `make` is followed by the same alpha. The test spies on `setAlpha`'s argument, so a hard `1` that happens to equal today's `unitAlpha` still fails: the test stubs `unitAlpha` through a module mock to 0.6 |
| `settled()` resolves on drain, on finish and on destroy (B11) | `unitLayer.test.ts`: three waiters, one per exit |
| The joint figure moves, fades and turns its follower (B6) | `unitLayer.test.ts`: `jointFigure` with two fakes. `setPosition` and `setAlpha` reach both, `facingPart` is the follower, the lead never gets `setRotation`, and `destroy` destroys both |
| The drift arrow waits (B9) | `heldDriftArrow.test.ts`: set while idle draws at once; set while animating does not draw and `release` draws it once; a clear while held erases and `release` then draws nothing; two sets while held keep the latest |
| `unitAlpha` is 1 for a plain drawing | `boardView.test.ts` |
| B13 default Normal | `animationSpeed.test.ts` "maps everything else to normal", unchanged |
| B14 durations | `animationSpeed.test.ts` `durationsFor`, unchanged |
| AC2 Standard Normal slide via `unitCanvas` | `board-animations.spec.ts`, Standard pass of the slide loop |
| AC3 Standard Slow click finishes, then selects | `board-animations.spec.ts`, Standard pass of the Slow loop |
| AC4 Standard Slow undo | `board-animations.spec.ts`: move, then Ctrl+Z (`chord`). The unit's `unitCanvas` is within 1.5 px of its start hex, `busy()` is `[]` on 10 samples 40 ms apart, and the state position is the start hex |
| AC5 Speed button in both views | `board-animations.spec.ts`: in Standard, `buttonCount(LABEL.normal) === 1`. The cycle runs in Standard and ends on Slow. After a switch to Drawn `buttonCount(LABEL.slow) === 1`, after the switch back it is still 1, and after a reload the speed is `slow` |
| AC6 Standard at Off | `board-animations.spec.ts`, `describe('at Off speed')`: no tween on 10 samples, and the unit is at its destination |
| AC7 Drawn unchanged | the Drawn passes of both loops, `board-view.spec.ts` (galley rotation, ghost, `hudLeaks`) |
| No HUD leak, sorted display list | `hud-strays.spec.ts`, `draw-order.spec.ts`, `board-view.spec.ts:58-87`, unchanged |
| B6 mark travels, B7 counter upright, B8, every cue | Live check (AC11). The dev hook has no reader for a mark (spec Assumptions) |

## Validation

Run one at a time, in this order. Nothing else heavy runs alongside (memory).

- `npm run verify` green (build, lint at cap 19 or lower, vitest).
- `npm run check:intent` PASS. The size budget passes because neither scene
  is in the diff.
- The AC8 diff check, quoted in the review:
  `git diff --stat main...HEAD -- src/engine src/data src/scenes` is empty.
- `npm run e2e` green: the whole suite, once. Note its run time against a run
  on `main` for AC10. Stop any server on 5232 first.
- **Live check (owed: rule 1, `src/ui/**`; new and visual, so the smoke suite
  cannot stand in).** `npm run dev` in the worktree (port 5277). In the
  Standard view, at Normal, then again at Slow:
  - Test mode: a land move, a cavalry charge, a swap.
  - Combat test mode: a ship's move with turns, and the Turn button. The facing
    mark slides and turns with its counter, never ahead of it, and the counter
    stays upright.
  - Combat test mode: a land attack with a retreat and an advance, and an
    exchange.
  - Combat test mode: a ram (hit and miss) and a boarding. The mark lunges,
    shakes and fades with its counter.
  - An elephant drift with a trample, human-paced and in a computer turn. The
    drift arrow appears only once the slide has ended.
  - A game with a computer seat: its turn waits for each animation.
  - A click or a key during each of these finishes it at once.
  - A view switch mid-animation, both ways: the new view shows every unit at
    its final drawing.
  - The Speed button shows in both views, cycles, and keeps its label across
    a switch.
  - Placement in the Standard view: nothing animates, a staged ship's arrow
    follows Turn, and placed ships show their arrows.

## Assumptions I made

- **The marks come from `UnitDrawing.facing`, not `FacingShip`.** The spec
  leaves the seam to the plan (I4) and notes that `FacingShip` has no id. The
  scenes already put `facing` on every ship drawing (`BoardScene.ts:914`,
  `PlacementScene.ts:326`), so this needs no scene change and no new field.
  `setFacingIndicators` keeps one job in both views: the staged ship. The
  alternative, adding a unit id to `FacingShip`, would edit both scenes at
  their ceilings.
- **Marks at depth 10.5** keep today's draw order (over counters, under
  rings). The spec says nothing on depth, so this follows "unchanged" for
  everything not named.
- **The files are renamed** to `unitAnimator.ts`/`unitMotions.ts`, since the
  spec lets the plan decide "whether the Drawn names change". `drawnUnits.ts`
  and `drawnBoardView.ts` keep their names: they are still Drawn-only.
- **A fade starts from the figure's current alpha,** not a fixed 1. This makes
  no difference today, and it keeps a future dimmed unit (§76) from flashing
  to full before it fades.
- **`unitAlpha` is added now, returning 1,** at the coordinator's request (the
  §76 interaction), so that `settle` has one resting alpha to restore.
- **The two Drawn e2e scenarios become loops over both views.** That avoids
  copying them, and their Drawn assertions stay word for word (AC7).
- **`frames`/`chord` move to `e2e/helpers.ts`** rather than being copied, so
  AC4 can press Ctrl+Z the way `rules-panel.spec.ts` does.
- **No blocker.** §74 is merged. §76 and §78 are not prerequisites either way
  (Risks). Nothing is added to `blocked_by`.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-22: all subtasks (1-9), by the implementer

- **Commits:** `f425643` rename (`drawnAnimator`/`drawnMotions` to `unitAnimator`/`unitMotions`, nothing else); `f97b525` the `UnitFigure` seam, `unitAlpha`, `UnitLayer`, `HeldDriftArrow`, the Drawn view re-plumbed; `46c4343` the Standard view animates (`standardUnits.ts`, `drawArrowheadAt`) and one Speed button; then the e2e commit and the README commit.
- **Shipped:** as the plan. The Standard counter and its facing mark are one joint figure on the shared layer. `setFacingIndicators` draws only the staged ship in both views. The mark is a per-ship `Graphics` at depth 10.5. The drift arrow is held through `HeldDriftArrow` in both views. The Speed button is always shown. `unitAlpha(drawing)` is applied after `make` and in `settle`, never a hard 1, and a fade starts from the figure's current alpha.
- **Tests:** vitest 99 files, 1698 passed, 2 skipped (new: `unitMotions.test.ts`, `unitLayer.test.ts` (with `unitAlpha` mocked to 0.6 to catch a hard 1), `heldDriftArrow.test.ts`, `unitAlpha` in `boardView.test.ts`). `npm run e2e`: 34 passed in 1.7 min (the animation spec has 7: slide and Slow click-finish per view, speed button in both views, Off, Slow undo). `npm run check:intent`: PASS.
- **Lint:** 19 warnings, cap 19 (unchanged, none added).
- **Sizes:** `standardBoardView.ts` 335 (was 371), `drawnUnits.ts` 163 (was 212), `unitLayer.ts` 194, `standardUnits.ts` 59, `unitAnimator.ts` 135, `unitMotions.ts` 92, `heldDriftArrow.ts` 42, `drawnBoardView.ts` 127, `boardView.ts` 162. No file over 500 lines touched. `git diff --stat main...HEAD -- src/engine src/data src/scenes` is empty.
- **AC10:** the e2e suite ran in 1.7 min (106 s wall) with the 7 new or looped animation scenarios included. No run on `main` was made (the main checkout was off limits), so the comparison is not measured. Earlier recorded e2e times in `intents/*/review.md` are for smaller suites (15-19 scenarios). Every other scenario still runs at Off.
- **Divergences:** (1) `frames` already existed privately in `e2e/helpers.ts`, so it is exported there instead of copied from `rules-panel.spec.ts`; `chord` is moved. (2) `unitLayer.ts` is 194 lines, over the ~150 estimate; still under 500. (3) The `jointFigure` lead type is `Image | Text` (the counter). Nothing else.
- **Not checked:** the facing mark's travel, the turn, and every cue (B6-B9, B11) are for the live check (AC11). Stale comments left per the plan: `devHook.ts:109` and `PlacementScene.ts:319`.
