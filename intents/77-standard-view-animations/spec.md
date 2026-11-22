<!-- generated-by: heraklios/spec@0.1.0 -->
# §77 spec — The Standard view animates moves and combats, like the Drawn view

Accepted intent: [intent.md](intent.md)

Written against `main` at `1c4ba2d`.

This spec reverses §66's **B13** ("A speed button on the board, in the Drawn
view only") and **B17** ("The Standard view does not animate, at any speed,
and shows no speed button"), `intents/66-board-animations/spec.md:107`,
`:124`. Everything else in §66 now holds in both views. This spec states only
what is new or different for the Standard view.

**The owner's answers (2026-11-22, "/auto 77 all, Normal, travels")** settle
the intent's open design questions 1, 3 and 4: every §66 cue plays (B1-B5),
the shared speed defaults to Normal (B13), and the facing mark travels with
its counter (B6). Question 2 (one speed or two) was decided by the
coordinator: one shared speed (B12, Assumptions).

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/77-standard-view-animations/intent.md` | Outcome, constraints ("One animator, not two"; size budget; live check owed), the four open questions. |
| `intents/66-board-animations/spec.md` B1-B16, I1, I2 | The behaviour this spec extends to the Standard view: what animates, snaps, cut short, computer turns, speed, durations. B13 and B17 are replaced here. |
| `README.md:570-611` "Animations in the Drawn view" | The player-facing text. `:611` says: "The Standard view never animates and has no speed button." This feature makes that sentence false, so the section is rewritten for both views. |
| `src/ui/boardView.ts:43-50` | `UnitMotion`: "`null` is the default … an `ActionCue` adds what a drawing cannot carry … `'snap'` draws at once … The Standard view ignores it." |
| `src/ui/boardView.ts:8-10` | `UnitDrawing.facing`: "the Standard view draws facings through `setFacingIndicators` instead and ignores it." |
| `src/ui/boardView.ts:26-31` | `FacingShip` is `{ hex, facing, playerIndex, ghostTypeId? }`. It has **no unit id**, so the Standard view cannot tell which counter a facing mark belongs to from it alone. |
| `src/ui/boardView.ts:62-66` | `finishAnimations?()` and `animationsSettled?()` are optional: "a view that does not animate has nothing to finish". The Standard view implements neither today. |
| `src/ui/standardBoardView.ts:106-131` | Today's jump. `setUnits(units)` takes no motion, and an `update` that is not a `recreate` just does `entry.marker.setPosition(center.x, center.y)` (`:117-118`). A removed unit's marker is destroyed at once (`:109`, `:133-136`). |
| `src/ui/standardBoardView.ts:236-251` | The counter image is **not rotated**, today or ever: "the marker image itself is a physical-counter icon that must stay upright for its printed stats to stay readable, so it can't just be rotated in place". All ships' arrowheads are drawn into one `facingGraphics` (depth 11, `:44`), cleared and redrawn on every call. `makeMarker` (`:141-169`) sets no rotation and no name. |
| `src/ui/standardBoardView.ts:171-234`, `:267-358` | The Standard view's other decorations: hex fills and rings (`:171-204`), the movement-points readout centred on the selected unit (`:206-234`), the drift arrow (`:267-275`, depth 12, `:54`), choice labels (`:291-317`), range labels (`:335-358`). |
| `src/ui/drawnUnits.ts:75-83`, `:126-171` | How the Drawn view drives the shared animator: a `DrawnAnimator` whose host returns the unit's `Phaser.GameObjects.Container`, plans with `planAnimation(prev, units, motion, animationSpeed())`, keeps fading units in `departing`, and settles every container on drain. |
| `src/ui/drawnAnimator.ts:7-14`, `:39-46`, `:67-77` | The animator: `AnimatorHost` (`settleAll`, `onDrained`), the window capture-phase `pointerdown`/`keydown` listeners that finish everything first (§66 B9), `finishAll`. |
| `src/ui/drawnMotions.ts:6-9`, `:17-22`, `:62-71` | Where the motions are tied to the Drawn containers: `MotionHost.container(id)` returns a `Phaser.GameObjects.Container`, and a `turn` rotates `figureOf(c)`, "the container's figure layer" (`container.list[1]`). |
| `src/ui/animationPlan.ts:81-114` | `planAnimation` is pure and names no view: from the drawn units, the wanted units, the cue and the speed, it lists `slide`, `turn`, `lunge`, `fade` and `shake` steps (`:16-22`). Turns come from `UnitDrawing.facing` (`:55-62`) or the cue's steps (`:30-52`). |
| `src/ui/drawnBoardView.ts:28`, `:90-110` | The drift arrow waits: "The arrow waits for the elephant's slide to end (B4): while an animation plays it is held and shown when the queue drains" (`pendingArrow`, shown from the animator's `onDrained`). |
| `src/ui/animationSpeed.ts:3-5`, `:18-21`, `:37-51` | One stored speed, `heraklios.animationSpeed`, Normal when absent or invalid; Normal durations; Slow is twice Normal; Off is null. Its doc comment still says "How fast the Drawn view animates". |
| `src/ui/speedToggle.ts:14-21`, `:35-39` | The button is "visible only in the Drawn view (B13), since the Standard view does not animate (B17)": `sync` hides it and disables its input outside `'drawn'`. |
| `src/ui/MapView.ts:168-178`, `:306-316` | A view switch already calls `this.boardView.finishAnimations?.()` before replaying into the new view; `setUnits` forwards the motion to whichever view is shown; `animationsSettled` falls back to `Promise.resolve()` when the view has none. |
| `src/ui/cueKeeper.ts:14-44` | The scene's cue holder, already used for both views: `apply`, `driftMove`, `driftClash` (which renders at once), `take`. |
| `src/scenes/BoardScene.ts:907-934` | `renderAllUnits`: `setUnits(drawings, snap ? 'snap' : this.cues.take())` (`:919`), then `setFacingIndicators(ships)` with every ship's final hex and facing (`:920`), then the drift arrow from scene state (`:926-932`). Naval drawings already carry `facing` (`:913`). |
| `src/scenes/BoardScene.ts:316` | "renders now, so the trample's result is drawn at its own beat in BOTH views … departs from spec B17, accepted". The drift's render order is already view-independent. |
| `src/scenes/BoardScene.ts:111-112`, `:3065-3067` | `AI_MOVE_DELAY_MS = 160`, `AI_COMBAT_DELAY_MS = 700`; `pause` is `this.mapView.animationsSettled().then(…setTimeout…)`, so a computer seat waits for whatever the current view reports. |
| `src/scenes/PlacementScene.ts:320-327`, `:541`, `:268` | Placement passes `'snap'` on every `setUnits` ("Placement never animates (§66 B13)") and creates the view toggle only, no speed button. |
| `src/ui/devHook.ts:251-255`, `:368-372` | `idle()` is false while any tween runs; `unitCanvas(id)` finds the object **named** by the unit id (`scene.children.getByName(unitId)`), which the Standard markers are not today. |
| `e2e/board-animations.spec.ts:61-93` | Asserts what this spec reverses: "no speed button in the Standard view" (`:63`), "hidden in the Standard view" (`:72`), and the whole test "the Standard view starts no tween on a move" (`:80-93`). |
| `playwright.config.ts:35-37` | The suite's default `storageState` sets `heraklios.animationSpeed` to `off`. A scenario that wants animations sets its own, as `board-animations.spec.ts:36` and `:97-99` do. |
| `scripts/size-baseline.json` | `"src/scenes/BoardScene.ts": 3172`, `"src/scenes/PlacementScene.ts": 548`: both files are at their recorded size today. |

## Behaviour

Every rule below applies to the Board in the Standard view. §66 B1-B12 and
B14-B16 keep applying to the Drawn view unchanged.

**What animates in the Standard view**

- **B1. Moves.** A land move slides the unit's counter hex by hex along the
  path its cost was worked out on. A cavalry charge slides along its straight
  line. A swap slides both counters across each other together. A ship's move
  slides the counter at each forward step and turns its facing mark in place
  at each rotation. The Turn button turns the facing mark 60°. This is the
  §66 B1 path and order, played on the counter.
- **B2. Land combat.** Each attacker's counter lunges part-way toward the
  defender hex it fights and back, then the result shows. An eliminated
  counter fades out at its hex. A retreat, a push, an advance and an exchange
  sacrifice each animate when they are committed, in commit order (§66 B2).
- **B3. Naval combat.** A ram lunges the rammer's counter into the target's
  hex side and back. On a hit the target's counter fades; on a miss it shakes.
  A boarding is a clash between the two counters. A ship whose equipment
  reaches zero fades, the ship that lost equipment and survives shakes, and an
  undecided boarding shows no result (§66 B3).
- **B4. Elephant drift.** Each drift beat animates as it is committed: a hex
  entered is a one-hex slide; a trample is a clash at the occupant's hex, then
  its result as in B2; an elephant that dies fades (§66 B4).
- **B5. Anything else** that changes the counters without one of these cues
  (a counter appearing, a type or owner change) shows at once (§66 B5).

**What moves with a counter, and what does not**

- **B6. A ship's facing mark travels with its counter.** For the whole
  animation, the arrowhead stays where it would be drawn on the counter at the
  counter's current on-screen point: it slides with a slide, goes out and back
  with a lunge, shakes with a shake, and fades with a fade. During a turn it
  rotates smoothly from the old facing to the new one. It never appears at the
  destination, or at the new facing, before its counter gets there. This holds
  whatever else redraws meanwhile (a highlight, a log line, a selection, a
  second `renderAllUnits`).
- **B7. The counter image never rotates.** A ship's counter stays upright
  during and after every animation, as today (`standardBoardView.ts:238-241`).
  Only its facing mark turns.
- **B8. Everything else shows the new state at once**, as in the Drawn view:
  - hex fills and rings (`highlightHexes`, `highlightHexGroups`,
    `highlightRings`);
  - the movement-points readout, which appears on the selected unit's new hex
    while its counter is still sliding there;
  - the choice labels (A, B, C) and the range labels;
  - the hover tooltip.
- **B9. The drift arrow waits for the slide.** While an animation plays, a
  drift arrow is held and shown when the queue drains; a clear removes it at
  once, held or shown, exactly as the Drawn view does
  (`drawnBoardView.ts:90-110`).

**The same rules as the Drawn view**

- **B10. The game state changes at once** at every speed; the animation only
  shows it (§66 B6). Rules, log, saves, autosave, undo and redo, dice and the
  computer's choices are identical at Normal, Slow and Off, and in both views.
- **B11. Snaps, cut short and computer turns are as in the Drawn view.**
  - Undo, redo, loading a game, starting the Board and switching view draw the
    new state at once after finishing any animation (§66 B7). A switch from
    the Standard view to the Drawn view mid-animation, or back, shows the new
    view with every unit at its final drawing.
  - A redraw that changes no counter neither restarts nor finishes an
    animation (§66 B8).
  - Any click on the page or any key press finishes every animation, the
    whole queue, before the click or key acts (§66 B9, I2). The drift continue
    prompt behaves as §66 B10.
  - A computer seat, after each action, waits for that action's animations,
    then its usual pause (§66 B11, B12). At Off it waits the pause alone.

**The speed setting**

- **B12. One speed for both views.** The Speed button is on the Board in both
  views, in the same place (one row above the view toggle). Each click steps
  Normal, Slow, Off, Normal and names the current speed. It sets the one
  stored speed, `heraklios.animationSpeed`, which both views read. Switching
  view keeps the speed and keeps the button visible.
- **B13. The default is Normal.** An absent or invalid stored speed is
  Normal, as today (`animationSpeed.ts:18-21`). A player who has never touched
  the button therefore sees the Standard view animate from this change on.
- **B14. Durations** are §66 B15's, in both views. At Normal: a hex step
  180 ms, a 60° turn 120 ms, a clash 350 ms, a ram 400 ms, a fade 300 ms, a
  shake 200 ms. Slow is twice that. At Off, nothing animates: a counter and its
  facing mark jump, exactly as the Standard view does today.

**What does not change**

- **B15. Placement never animates,** in either view, and has no Speed button.
- **B16. The Drawn view is unchanged:** what it animates, how, and how long.

## Interpretations

No rulebook passage is involved (the intent: "Rulebook basis: digital-only, no
print rule"). The readings of the intent and the owner's answers below each
become a code comment where they are implemented.

- **I1. "The facing arrowhead travels"** (owner's answer 3). Reading: the
  facing mark belongs to the counter for every motion, not only for slides
  and turns. So it also lunges, shakes and fades with the counter (B6). A
  sunk ship's arrow that stayed behind while its counter faded would point at
  an empty hex.
- **I2. "A ship's 60° turn rotates its facing mark, because the counter
  itself does not rotate"** (owner's answer 1). Checked: the counter is not
  rotated today (`standardBoardView.ts:236-251` says why; `makeMarker`,
  `:141-169`, sets no rotation; `setUnits`, `:117-118`, only repositions).
  Reading: a `turn` motion in the Standard view rotates the facing mark from
  its old angle to the new one, by the shorter way round as the Drawn figure
  does (`drawnMotions.ts:62-71`, `Phaser.Math.Angle.Wrap`). The counter stays
  upright (B7).
- **I3. "Any other per-unit decoration … or the spec must say explicitly that
  it shows the new state at once"** (owner's answer 3). The Standard view's
  per-unit or per-hex decorations, all in `standardBoardView.ts`, are:
  - the facing arrowheads (`:244-255`), which travel (B6);
  - the drift arrow (`:267-275`), which waits (B9);
  - the movement-points readout (`:210-234`), centred on the selected unit;
  - the choice labels (`:291-317`), offset from a candidate unit's hex;
  - the range labels (`:335-358`), per reachable hex;
  - the fills and rings (`:171-204`).

  The last four show the new state at once (B8). Reading: they describe the
  state the player acts on next, not the unit's figure, as in the Drawn view
  (§66 B6: "Highlights, labels and the movement-points readout show the new
  state immediately"). The readout sitting on the destination hex while the
  counter slides in is accepted, as in the Drawn view. The marker's fallback
  text chip (`:152-164`) is the counter itself and animates like the image.
- **I4. "One animator, not two"** (intent constraint). Reading: the Standard
  view plays the same planner's steps (`planAnimation`) through the same queue
  (`DrawnAnimator`: one step at a time, finish on any click or key, watchdog,
  waiters released on every exit) and the same motion curves
  (`drawnMotions.ts`: smooth slide, sine lunge, decaying shake, linear fade).
  It does not copy any of them. Today these are tied to the Drawn containers
  in two places: `MotionHost.container` returns a `Phaser.GameObjects.Container`
  (`drawnMotions.ts:17-22`), and a `turn` rotates `figureOf(c)`
  (`:62-71`). Where the seam goes, and whether the Drawn names change, is the
  plan's to decide. Behaviourally the seam must let a motion move, fade and
  shake "a unit's drawing", and turn "the part of it that shows the facing":
  the galley figure in the Drawn view, the facing mark in the Standard view.

## Acceptance criteria

- **AC1 (B1-B5, B14, B16).** `planAnimation` gives the same steps whichever
  view asks: the existing planner tests stay green unchanged. If the plan moves
  the planner's or the motions' seam, its pure parts keep or gain tests.
  Test: `src/ui/animationPlan.test.ts`, `src/ui/animationSpeed.test.ts`.
- **AC2 (B1, B11, B12, B13).** A new e2e scenario in the **Standard view at
  Normal** (empty `storageState`, as `board-animations.spec.ts:36`): a land
  move starts a tween (`idle()` false); the unit's counter, read with
  `unitCanvas(id)`, passes through a point more than 12 px from both its start
  and end hexes; it ends within 1.5 px of the clicked hex; the state shows the
  unit there. This needs the Standard view's counter to be findable by its unit
  id on the display list, as the Drawn container is (`drawnUnits.ts:201`), so
  that `devHook.ts` needs no change. Test: `e2e/board-animations.spec.ts`.
- **AC3 (B11).** A new e2e scenario in the **Standard view at Slow**: a click
  on another own unit during a move finishes it at once (the mover is within
  1.5 px of its destination) and then selects the other unit. Test:
  `e2e/board-animations.spec.ts`, mirroring `:101-121`.
- **AC4 (B11).** In the Standard view at Slow, an undo (Ctrl+Z) during or
  just after a move leaves the unit drawn on its start hex with no tween
  running afterwards. Test: `e2e/board-animations.spec.ts`.
- **AC5 (B12, B13).** The Speed button is shown in the Standard view, cycles
  Normal, Slow, Off there, stays shown with the same label after a switch to
  the Drawn view and back, and the speed is remembered across a reload. Test:
  `e2e/board-animations.spec.ts`, replacing the assertions at `:63` and `:72`.
- **AC6 (B14).** In the Standard view at **Off** (explicit `storageState`
  with `off`), a move starts no tween and the unit is at its destination.
  Test: `e2e/board-animations.spec.ts`, replacing "the Standard view starts no
  tween on a move" (`:80-93`) with this Off case.
- **AC7 (B16).** The Drawn view's scenarios in `board-animations.spec.ts`
  (`:38-59`, `:101-121`) pass unchanged in what they assert. Test: `npm run e2e`.
- **AC8 (B10, B15).** Headless play, saves and Placement are untouched:
  `npm run verify` is green with the engine tests unchanged, and no
  `src/engine/` or `src/data/` file is in the diff. Placement keeps its
  `'snap'` calls (`PlacementScene.ts:327`, `:541`). Check: `npm run verify`
  and the diff, quoted in the review.
- **AC9 (scene budget).** `BoardScene.ts` and `PlacementScene.ts` are at most
  their `scripts/size-baseline.json` values (3172 and 548) after the change,
  and lint's warning cap is not raised. Check: `npm run check:intent` and
  `npm run verify`.
- **AC10 (e2e speed).** Every other scenario still runs at Off
  (`playwright.config.ts:35-37` unchanged), and the suite's run time does not
  grow by more than its run-to-run noise. Check: `npm run e2e` timings quoted
  in the review.
- **AC11 (B1-B9, B11, B14).** Live check (owner), in the Standard view at
  Normal and at Slow:
  - a land move, a charge, a swap;
  - a ship move with turns, and the Turn button: the facing mark slides and
    turns with the counter, never ahead of it, and the counter stays upright;
  - a land attack with a retreat and an advance, and an exchange;
  - a ram (hit and miss), and a boarding: the facing mark lunges, shakes and
    fades with its counter;
  - an elephant drift with a trample, human-paced and in a computer turn: the
    drift arrow appears only once the slide has ended;
  - a full computer turn, which waits for each animation;
  - a click or key cutting each of these short;
  - a view switch mid-animation, in both directions.

## Non-functional

- **Engine/presentation split:** presentation only. No `src/engine/` or
  `src/data/` change: the paths (`movePath.ts`) and cues (`actionCue.ts`)
  are already engine functions, and `cueKeeper.ts` already feeds them to
  whichever view is shown. The work is in `src/ui/`: the Standard view's unit
  layer and facing marks, the animator/motion seam (I4), the speed button's
  visibility, the speed module's doc comment, and the README section.
- **Scenes:** zero or net-neutral change. `BoardScene.ts` (3172) and
  `PlacementScene.ts` (548) are at their `size-baseline.json` ceilings. The
  scene already passes the cue or `'snap'` to both views (`BoardScene.ts:919`),
  waits on `mapView.animationsSettled()` (`:3065-3067`), and creates the speed
  button through `createViewControls` (`:770`). So the Standard view only
  needs to honour what it is already given.
- **Save format:** unchanged. No `GameState` change, no `SAVE_VERSION` bump.
  The speed is not saved (§66 B14).
- **Undo boundaries:** unchanged. No new die roll or phase change. Undo and
  redo snap (B11).
- **AI / harness:** `legalActions`, `applyAction` and the fuzz harness are
  untouched. A computer seat waits for animations in both views: once the
  Standard view answers `animationsSettled`, `BoardScene.pause` waits on it
  with no scene change.
- **One animator per view, never two at once:** a view switch destroys the
  old view (`MapView.ts:173`). The Standard view's animator must stop its
  window listeners and release its waiters on destroy, as
  `DrawnAnimator.destroy` does (`drawnAnimator.ts:79-89`). Otherwise a stale
  listener or a stranded computer turn survives the switch.
- **File size:** `standardBoardView.ts` is 371 lines, and the lint guardrail
  is 500. The plan may give the Standard view its own unit layer module, like
  `drawnUnits.ts`. That would also suit §78, which wants the counter layer as
  a separable "unit part".
- **e2e:** the suite stays at Off. Only `board-animations.spec.ts` sets its
  own speed. `devHook.ts` needs no change (AC2), which keeps clear of §75.

## Out of scope

- Animating highlights, rings, labels, range labels, the movement-points
  readout or the hover tooltip (B8).
- Rotating the counter image (B7).
- A separate speed per view, a speed on the Menu, or a speed button in
  Placement.
- Any animation in Placement, in either view.
- New durations, curves or cue kinds; any change to the Drawn view's look.
- The counters-on-landscape combination (§78).
- Sound, particles and camera moves.

## Assumptions I made

- **One shared speed** (open question 2; coordinator's decision). One
  setting, one key (`heraklios.animationSpeed`), one button in both views. A
  per-view speed would add a key and a migration for no asked-for gain.
- **Default Normal** (open question 3; owner's answer 2). Players used to
  the still Standard board now see it move, and the Speed button in the same
  view turns it off.
- **Scope: every §66 cue** (open question 1; owner's answer 1), B1-B5.
- **What moves with a counter** (open question 4; owner's answer 3): the
  facing mark travels, through every motion (B6, I1). Every other decoration
  shows the new state at once (B8, I3; coordinator's decision). The drift arrow
  waits for the slide (B9; coordinator's decision, as `drawnBoardView.ts:90-110`).
- **Placement still never animates; undo, redo, load and a view switch snap;
  the e2e suite runs at Off** (coordinator's decisions, all already true of
  the code: `PlacementScene.ts:327`, `BoardScene.ts:919`, `MapView.ts:170`,
  `playwright.config.ts:37`).
- **One animator** (intent constraint; coordinator's decision): the seam is
  described in behaviour terms (I4) and designed in the plan.
- **The Standard markers get a name** (their unit id) so the existing
  `unitCanvas` reader works in both views (AC2). Nothing else looks objects
  up by a unit id. `boardObjects().ghosts` counts only `GHOST_SHIP_ID`
  (`devHook.ts:296`), and `unitDrawings` comes from `drawnInspect`, which is
  null in the Standard view (`MapView.ts:185-190`).
- **The facing mark's travel is proven by the live check (AC11),** not by
  e2e. The dev hook has no reader for an arrowhead's position, and adding one
  would touch `devHook.ts` while §75 rewrites it.
- **Not blocked by §73.** It rewrites BoardScene's combat settling but keeps
  the `cues.apply`/`driftMove`/`driftClash` calls, and this spec changes no
  scene. **§74** (`blocked_by` in `metadata.yml`) is merged (`846a22e`), so
  that blocker is clear. **§75** is a refactor of `devHook.ts`, which this
  spec avoids. **§78** overlaps `standardBoardView.ts` but is not a
  prerequisite in either direction (its intent: "Whichever is merged first,
  this combination shows the counters as the Standard view does at that
  point").
- **Tier:** Attested by the path table (`src/ui/**`). The live check is owed
  (rule 1), and the change is new and visual, so the smoke suite cannot stand
  in.

## Questions for the owner

None. Every open point is decided above.
