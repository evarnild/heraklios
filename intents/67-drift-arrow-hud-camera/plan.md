<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §67 plan — The elephant drift arrow is drawn once, by the map camera only

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Keep the Standard view's drift-arrow graphics off the fixed HUD camera, so a
drift shows one arrow, on the elephant, through the main camera. Make sure
no other world object is drawn by both cameras either. A new dev-hook reader
lists every object on the Board's display list that **both** cameras would
render, in either view. Today the Standard view has at least one such
object; after the fix there are none. An e2e scenario asserts that, and a
pure helper with unit tests holds the rule.

## Risks

- **A test that checks the wrong list.** §64's `hudLeaks` counts only
  objects a view lists in `mapObjects()`, so it can't see an object the
  view forgot to list, which is exactly this bug. The new check walks the
  scene's **display list**, not the view's list. It must be shown failing on
  `main` first.
- **Too wide a check.** A HUD object, such as the side panel or a prompt, is
  ignored by the main camera, so it is rendered by one camera only, as it
  should be. An object rendered by both cameras is always a defect, so
  "rendered by both" catches strays without listing the UI objects by hand.
  If the check finds a stray that is not a world object (for example a HUD
  object never excluded from the main camera), it is in the intent's scope
  only if it is a map object. Anything else is reported in Progress, not
  fixed.
- **Objects made later.** Labels and the Drawn view's overlays are created
  after `pinUIObjects` and go through `host.ignoreOnUiCamera`. The check
  runs at a point where some exist: after a selection, with range or choice
  labels shown.
- **Stale comment.** `standardBoardView.ts:88-91` says the drift arrow "was
  never in" the list. It must be updated in the same change.
- **No engine change.** No save or rule change; presentation only.
- **The lint cap** stays at 21. None of the touched files is in the size
  baseline (all under 500 lines).

## Verified against the codebase

Re-read on `main` at `3eb809c` (§65 and §64 merged).

- **The arrow is created but not listed:**
  - `src/ui/standardBoardView.ts:25` declares `driftArrowGraphics`, and `:54` creates it (`scene.add.graphics().setDepth(12)`).
  - `:93-100` `mapObjects()` returns the terrain polygons, the overlay, ring, river and facing graphics, and the markers, but **not** `driftArrowGraphics`.
  - `:88-91` has a comment saying so: "the drift arrow and the lazily made labels were never in it".
  - `:266-272` draws and clears the arrow, and `:366` destroys it with the other graphics.
- **How the HUD camera ignores world objects:**
  - `src/ui/MapView.ts:256-264` `pinUIObjects`: adds the HUD camera, calls `uiCam.ignore([...this.boardView.mapObjects(), this.hitZone])`, then `excludeFromMainCamera(uiObjects)`.
  - `:167`: a view swapped in after the pin is ignored through `next.mapObjects()`.
  - `:144` `viewHost().ignoreOnUiCamera`: the lazily made objects.
  - `:269-271` `excludeFromMainCamera`: `cameras.main.ignore(objects)`.
  - `:38`: `private uiCamera`.
- **§64's existing check:**
  - `src/ui/MapView.ts:175-180` `drawnInspect()`: `hudLeaks` counts the `mapObjects()` without the HUD camera's bit in `cameraFilter`. It is null for the Standard view.
  - `src/ui/devHook.ts:40` `BoardObjects`, `:121` `boardObjects()`, `:270-274`.
  - `e2e/board-view.spec.ts:38,141` asserts `hudLeaks` is 0 in the Drawn view only.
- `src/ui/drawnBoardView.ts:33-35` `mapObjects()`: the landscape, units and overlays.
- **Sizes:** `MapView.ts` 416 lines, `devHook.ts` 361, `standardBoardView.ts` 369. None is budgeted.

## Where this goes

- **Modules touched:**
  - `src/ui/standardBoardView.ts`: add `driftArrowGraphics` to `mapObjects()` and fix the comment;
  - `src/ui/MapView.ts`: a read-only `cameraStrays()` that applies the helper to `scene.children.list` with the two cameras' ids;
  - `src/ui/devHook.ts`: expose `hudStrays()`.
- **New modules:**
  - `src/ui/cameraStrays.ts`: pure. Given objects with `cameraFilter`, `type` and `depth`, plus the main and HUD camera ids, it returns those rendered by both cameras: `(cameraFilter & mainId) === 0 && (cameraFilter & uiId) === 0`.
  - `src/ui/cameraStrays.test.ts`: its unit tests.
  - `e2e/hud-strays.spec.ts`: the failing-first scenario.
- **Why there:**
  - It is presentation. The rule ("no object on both cameras") is pure and tested in `src/ui/`, like `hexHitTest.ts`.
  - `MapView` owns the cameras, so it applies the rule.
  - The dev hook only reads.
- **Budget lines:** none.

## Subtasks

1. **The rule as a pure helper.** `src/ui/cameraStrays.ts` and `cameraStrays.test.ts` cover:
   - an object ignored by the HUD camera only is not a stray;
   - an object ignored by the main camera only is not a stray;
   - an object ignored by neither camera is a stray;
   - an object ignored by both is not a stray;
   - each stray is returned with its `type` and `depth`.
2. **The reader.** `MapView.cameraStrays()` returns `[]` before the pin. Expose it as `__heraklios.hudStrays()` (read-only, documented beside `boardObjects`).
3. **The failing-first scenario**, `e2e/hud-strays.spec.ts`, from `MENU_TEST` (or the menu shortcut `board-view.spec.ts` uses):
   - in the Standard view, after a selection that shows labels, `hudStrays()` is `[]`;
   - toggle to the Drawn view; `hudStrays()` is `[]` there too.

   Run it before the fix: it must fail in the Standard view with a `Graphics` stray at depth 12, the drift arrow. Record the output in Progress. If it lists other strays, list them in Progress: a world object goes into its view's `mapObjects()` (or `ignoreOnUiCamera`) in this change, and anything else is reported, not fixed (see Risks). If it finds **no** stray on `main`, stop and report: the intent's premise would be wrong.
4. **The fix.** Add `this.driftArrowGraphics` to `StandardBoardView.mapObjects()`, and rewrite the comment at `:88-91` so it no longer says the drift arrow is left out. The scenario then passes, and the whole `npm run e2e` stays green.
5. **Progress entry:**
   - the failing-first output;
   - the strays found;
   - test counts and e2e results.

   Set `status: in-review`.

## Tests

- **Failing-first:** `e2e/hud-strays.spec.ts`, the Standard view case. On `main`, `hudStrays()` lists the depth-12 Graphics.
- **Which test catches each mutation:**
  - drop `driftArrowGraphics` from `mapObjects()`: the e2e Standard case fails;
  - in `cameraStrays`, test only the HUD bit (`(f & uiId) === 0`): the unit test "ignored by the main camera only is not a stray" fails;
  - test only the main bit: "ignored by the HUD camera only is not a stray" fails;
  - `===` → `!==` on either bit: the "neither" and "both" cases fail;
  - `MapView.cameraStrays()` passes the wrong camera id, or an empty list: the e2e Standard case fails on `main`'s code, and the "neither" unit case fails.
- **Behaviour held:**
  - `board-view.spec.ts`, including `hudLeaks`, stays green;
  - the existing drift and attack scenarios pass;
  - `verify`'s test count grows only by `cameraStrays.test.ts`.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS: a fix with tests.
- `npm run e2e`: all pass, including `hud-strays.spec.ts`.
- **Live check, owed by path (`src/ui/`):**
  1. Run `npm run dev -- --port 5267 --strictPort --host 127.0.0.1`.
  2. Menu → "Combat test mode (units face to face, 2 hexes)".
  3. Scroll and zoom the map away from its start.
  4. Attack with or against an elephant until a drift pauses for a human seat.
  5. You should see one arrow, on the drifting elephant, moving with the map when you pan, and no second arrow over the panel or elsewhere.

  If no drift comes up in a few tries, say so. The e2e check still proves that the HUD camera does not render the arrow.

## Assumptions I made

- **Judged from the camera lists, not seen on screen.** The double draw is confirmed by the camera filter (the HUD camera does not ignore the arrow), not by a screenshot. Phaser draws any object a camera doesn't ignore and that is visible. A second arrow should therefore appear whenever the arrow is drawn; the live check looks for it.
- **"Rendered by both cameras" is the right definition of a stray:** HUD objects are excluded from the main camera, and world objects from the HUD camera. Nothing on the Board is meant to be on both.
- **§65 is merged,** so the fix goes into `StandardBoardView.mapObjects()`, as the intent's constraint says.
- **Tier:** Attested by path (`src/ui/**`, `e2e/**`). A live check is owed.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
