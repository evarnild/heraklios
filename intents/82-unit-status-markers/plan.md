<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §82 plan — Each unit shows whether it has moved, charged, attacked or been attacked this phase

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

Written against `main` at `c8d9d53`. The spec's own sources were read at
`0fa7e95`; every line below was re-read at `c8d9d53`.

## Goal

Each living unit on the board carries a small mark for its state in the
current phase: in the movement phase the active player's units show not
moved, partly moved or done (and a cavalry unit its charge); in the combat
phase the active player's units show can attack or has attacked, any unit
that was attacked shows it, and a charged cavalry unit keeps its charge mark.
A pure engine function `unitStatuses` works out the data (spec B1 to B6, AC1
to AC4); the drawing carries it as a field on `UnitDrawing` (B8, AC5); both
views draw it on the unit's own figure so it moves, fades and shakes with the
counter (B9, AC6, AC7). No rule, no `GameState` field, no save change.

## Risks

- **Hard prerequisite: §83 is not on `main`.** B2's `notMoved` reuses
  `hasNotMoved` from `src/engine/unmoved.ts`, which exists only on
  `feat/83-end-move-phase-warning` (read there: `hasNotMoved(unit)` is
  `!unit.destroyed && unit.movementLeft === unitType(unit).movement`).
  §83 is in review round 2. The spec says import it and never duplicate it.
  Subtask 1 is therefore a precondition, not code: "§83 is merged on `main`
  (or this branch is based on it)". If it is not, the implementer stops at
  subtask 1; nothing after it compiles without the import. The branch merged
  first owns the file; if §83's helper changes shape in rework, this plan's
  call site (`hasNotMoved(unit)`) is the only thing that follows it.
- **BoardScene.ts is at its ceiling** (`scripts/size-baseline.json:6`:
  3169; the file is 3169 lines at `c8d9d53`). §83 and §73 also change it.
  The plan makes this intent net-negative there (see Where this goes); if
  §83 or §73 lands first and moves the baseline, subtask 7 re-reads it
  before editing, and the budget line below is only the fallback.
- **A status-only change is invisible to the layer today.** `reconcileUnits`
  (`src/ui/boardView.ts:157-173`) updates only on recreate, move or facing;
  `UnitLayer.setUnits` then settles an update only when `steps.length === 0`
  (`unitLayer.ts:141`). A mark that rides the existing settle would not
  redraw while another unit animates. The mark must be applied on every
  `add`, `recreate` and `update` path itself, independent of the animation
  plan (B8: "shows at once, even while its counter is still sliding").
- **Stale mark on a recreated or departing figure.** A recreate builds a new
  figure (the mark must be set at build, not only on update); a figure fading
  out in `departing` keeps the mark it had (B9: it takes its mark with it).
- **`facingPart` must stay the facing mark.** The Standard `jointFigure`
  exposes its single follower as `facingPart` and rotates it
  (`unitLayer.ts:23-58`, `settle` at `:161`). The status mark is a second
  follower that must not rotate and must not become `facingPart`, or a ship's
  status mark would spin with its bow.
- **Display-list order and the HUD camera.** `bringToTop` restacks
  `figure.objects()[0]` only (`unitLayer.ts:150`); a mark that is a separate
  Graphics must be above its counter and still be listed in `objects()` or
  `hudStrays()` goes non-empty (AC7).
- **Renders that don't follow a state change.** Markers are derived at
  `renderAllUnits` (30 call sites). The attacked set grows at
  `BoardScene.ts:2551` and `:2841` and clears at `:2941`; whether a render
  follows each of those must be shown by AC9, not assumed.
- **Tests that pass whatever the code does.** The engine tests must build the
  positions (ZOC-boxed unit, cavalry beside a phalanx, archer in range, a
  rammed ship) and assert statuses that differ if `legalActions`, the phase
  gate or the `rammedThisTurn` branch were removed (Tests, mutation table).
- **The lint cap** (`package.json:12`: `--max-warnings 18`; 17 after §73)
  never rises. New files stay within the guardrails (file <= 500 lines,
  function <= 80, complexity <= 20, <= 7 params, nesting <= 4); a mark drawer
  with one `switch` per glyph is where complexity could creep, so the drawer
  is table-driven from a pure spec (subtask 4).
- **Colour clash.** Four player colours; the activity dot uses shape plus
  colour (spec B7). The look is only settled in the live check, so the
  constants live in one table (subtask 4) so a tuning is a one-file change.

## Verified against the codebase

Re-read on `main` at `c8d9d53`.

- `src/engine/state.ts:22-23` — `movementLeft`: "Movement points remaining
  in the current Movement phase".
- `src/engine/state.ts:28-40` — `defendedThisPhase` ("Reset at the start of
  each combat phase") and `charged` (cavalry only, cleared at the owner's next
  movement phase); `destroyed` follows. Phase type at `state.ts:163`.
- `src/engine/actions.ts:408-411` — `ActionContext { attackedThisPhase?,
  rammedThisTurn? }`, both `ReadonlySet<string>`.
- `src/engine/actions.ts:442-488` — `legalActions(state, context)`; combat
  branch: `ownUnits` skipped if `attackedThisPhase.has(unit.id)`; naval
  skipped if `rammedThisTurn.has(unit.id)`; one `board` (`attackerId`,
  `defenderId`) per `validTargets` for a ship and one `landAttack`
  (`attackerIds: [unit.id]`) per target for a land unit.
- `src/engine/combat.ts` `validTargets` (spec cites `:436-453`) — excludes
  `defendedThisPhase` targets; "has a legal target" is already in
  `legalActions`.
- `src/engine/unmoved.ts` on `feat/83-end-move-phase-warning` (head
  `be8b258`), NOT on `main` — exports `hasNotMoved(unit)` and
  `unmovedUnits(state, context)`; the first is the one this plan imports.
- `src/scenes/BoardScene.ts:167` — `private attackedThisPhase = new Set<string>()`;
  `:456` — `rammedThisTurn`; `:2551` and `:2841` add to the attacked set;
  `:2941` clears it; `:901` clears `rammedThisTurn`; `:1189`/`:1218`
  snapshot and restore both with undo; `:956-969` captures and adopts them
  for save/load; `:3020-3030` already passes `{ attackedThisPhase,
  rammedThisTurn }` to `legalActions` (the context shape this plan reuses).
- `src/scenes/BoardScene.ts:905-920` (`renderAllUnits`) — loops
  `state().units`, skips destroyed, pushes `{ id, typeId, owner, position,
  facing }` (facing only for naval) and a `ships` list, then calls
  `this.mapView.setUnits(drawings, snap ? 'snap' : this.cues.take())` and
  `setFacingIndicators(ships)`. `wc -l` of the file is 3169.
- `scripts/size-baseline.json:6` — `"src/scenes/BoardScene.ts": 3169`; no
  other `src/ui` file named in this plan is in the baseline (all are under
  500 lines: `unitLayer.ts` 194, `boardView.ts` 173, `standardUnits.ts` 59,
  `drawnUnits.ts` 163, `devHook.ts` 459).
- `src/ui/boardView.ts:5-18` — `UnitDrawing { id, typeId, owner, position,
  facing?, dimmed? }`; `:74-83` — `UnitFigure` (`active`, `x`, `y`, `alpha`,
  `setPosition`, `setAlpha`, `facingPart`).
- `src/ui/boardView.ts:157-173` — `reconcileUnits`: `recreate` = type, owner
  or dimmed differs; an update only if recreate, moved or facing differs.
- `src/ui/unitLayer.ts:10-14` — `LayerFigure` (`objects()`, `destroy()`);
  `:23-58` `jointFigure(lead, follower)`, `facingPart: follower`,
  `objects` `[lead, follower]`; `:116-152` `setUnits` (diff, add, recreate,
  `settle` only when `steps.length === 0`, then `bringToTop` of
  `objects()[0]` per unit); `:155-162` `settle` (position, alpha, facing
  part); `:171-180` `depart`/`dispose` for fading figures; `:106-110`
  `objects()` includes departing figures.
- `src/ui/standardUnits.ts:21-59` — `makeStandardFigure`: counter image
  (width `HEX_SIZE * 1.6`, depth 10) or a text fallback, the ship's facing
  mark (`MARK_DEPTH`), `host.ignoreOnUiCamera(...)`, returns
  `jointFigure(counter, mark)`.
- `src/ui/drawnUnits.ts:62-67` `figureOf` reads `container.list[1]`;
  `:70-91` `containerFigure`; `:95-163` `DrawnUnits` (`make` builds
  `[base, fig]`; `setGhost` also uses `make`; `inspect()` returns
  `{ unitDrawings, ghostRotation, unitRotations }`).
- `src/ui/viewDrawingState.ts:19-30` — stores the last `setUnits` list and
  replays it into a new view, so a field on `UnitDrawing` survives a toggle.
- `src/ui/animationPlan.ts:36-60` — motions come from position and facing
  differences only.
- `src/ui/MapView.ts:185` — `drawnInspect()`; `src/ui/devHook.ts:42`,
  `:131`, `:330-331`, `:362-366` — `drawnInspect`, `boardObjects()`,
  `hudStrays()` (`mapView.cameraStrays()`), `boardObjects(scene)` builds on
  `drawnInspect`.
- `src/ui/standardBoardView.ts:111`, `src/ui/drawnBoardView.ts:41` — each
  view's `objects()` includes `units.objects()`.
- `src/ui/hexRender.ts` — `HEX_SIZE = 22` and the four player colours
  (spec cites `:4`, `:89-90`).
- `src/ui/unitLayer.test.ts`, `boardView.test.ts`, `animationPlan.test.ts`,
  `viewDrawingState.test.ts`, `placementDrawings.test.ts` exist; `e2e/` has
  `board-animations.spec.ts`, `hud-strays.spec.ts`, `board-view.spec.ts`,
  `save-load.spec.ts`, `placement.spec.ts` as models for the new spec.
- `package.json:12` — `"lint": "eslint . --max-warnings 18"`.

## Where this goes

- **Modules touched:**
  - `src/scenes/BoardScene.ts` — `renderAllUnits` calls the new drawings
    helper instead of building drawings inline; net-negative (see below).
  - `src/ui/boardView.ts` — `UnitDrawing` gets optional `status` and
    `charged`; `reconcileUnits` treats a difference as an update without
    recreate.
  - `src/ui/unitLayer.ts` — `LayerFigure` gets an optional
    `setStatus?(status, charged)`; `UnitLayer.setUnits` calls it on add,
    recreate (at build) and update, outside the animation plan.
  - `src/ui/standardUnits.ts`, `src/ui/drawnUnits.ts` — attach the mark to
    each figure.
  - `src/ui/MapView.ts`, `src/ui/devHook.ts` — one reader of the statuses
    each view is showing, by unit id.
  - `src/ui/viewDrawingState.ts`, `src/ui/animationPlan.ts` — no code
    change expected; their tests get a case (AC5).
  - `README.md` — one line in the board's description of what the markers
    mean (CLAUDE.md: document finished behaviour in place).
- **New modules:**
  - `src/engine/unitStatus.ts` — `UnitStatus` type and
    `unitStatuses(state, context)`: the pure per-unit status for the phase.
  - `src/ui/unitMarkSpec.ts` — pure: `markSpec(status, charged)` returns the
    shapes and colours to draw (dot fill, glyph, charge chevron), the one
    table the live check tunes.
  - `src/ui/unitMarkGraphics.ts` — Phaser: draws a `markSpec` onto a
    `Graphics` at a corner of the counter; shared by both views.
  - `src/ui/unitDrawings.ts` — pure-ish helper `buildUnitDrawings(state,
    context)` returning the `UnitDrawing[]` (with statuses) and the `ships`
    list that `renderAllUnits` builds today; takes the loop out of the
    scene.
  - Tests beside each: `src/engine/unitStatus.test.ts`,
    `src/ui/unitMarkSpec.test.ts`, `src/ui/unitDrawings.test.ts`,
    `e2e/unit-status-markers.spec.ts`.
- **Why there:** `docs/architecture.md`'s boundary is engine/data pure and
  tested, scenes/ui wiring and drawing. The status is a rule-reading
  (legality, phase gates) so it is engine, beside `unmoved.ts` and
  `actions.ts`. What a status looks like is presentation, split into a pure
  spec (tested) and a thin Phaser drawer (not tested, live-checked). The
  scene never works a status out (B12); the loop that does it moves out of
  the 3169-line scene to a file with a natural home in `src/ui/`.
- **Budget lines:** none planned. `renderAllUnits` shrinks by about 8 lines
  (the loop and its body, replaced by one call and one `setFacingIndicators`
  line), and the context it passes is built from the two fields the scene
  already holds; the scene's growth is zero or negative, so
  `npm run size:baseline` is run after subtask 7 and, if the file shrank,
  `--write` lowers the baseline in the same commit (§61). Fallback only if
  the scene must grow by wiring that cannot move out:
  `budget: src/scenes/BoardScene.ts +10: pass the attacked/rammed context
  into the drawings helper` (spec's own ceiling; never more).

## Subtasks

Each is committable with `npm run verify` green.

1. **Precondition (no code): §83 is merged on `main`, or this branch is
   based on it.** Check `ls src/engine/unmoved.ts` and `git branch --contains`
   the §83 merge. If absent, stop and report; do not copy `hasNotMoved`. If
   §83's rework changed `hasNotMoved`'s signature, report that to the owner
   before going on. (Proof: `src/engine/unmoved.ts` exists on the branch and
   `hasNotMoved` is exported.)
2. **Engine: `unitStatus.ts` + tests.** `UnitStatus` tagged union
   (`notMoved`, `partlyMoved`, `done`, `canAttack`, `hasAttacked`,
   `beenAttacked`) plus the charge flag; `unitStatuses(state, context)`
   returns a Map or record by unit id: movement phase per B2 (active
   player's units only; `done` checked first; `hasNotMoved` imported), combat
   phase per B3 (`hasAttacked` from `attackedThisPhase` or a ship in
   `rammedThisTurn`; `canAttack` from the `landAttack` `attackerIds[0]` /
   `board` `attackerId` of one `legalActions` call, made only in the combat
   phase) and B4 (`beenAttacked` for any owner, combat phase only), the
   charge flag per B5 in both phases, empty outside both (B6, B1). Code
   comments at the function record I1 to I6 (Ambiguity convention). Covers
   AC1 to AC4, AC14 (engine half).
3. **Seam: the drawing carries the status.** `UnitDrawing.status?` and
   `.charged?`; `reconcileUnits` makes a status or charge difference an
   `update` with `recreate: false`; `LayerFigure.setStatus?`; `UnitLayer`
   calls it at build (add and recreate) and on every update, whether or not
   the plan has steps, and not for an unchanged drawing. Fading figures keep
   what they have. Covers AC5 and AC6 (layer half). Tests extended:
   `boardView.test.ts`, `animationPlan.test.ts`, `viewDrawingState.test.ts`,
   `unitLayer.test.ts` (fake figure).
4. **Pure mark spec + Phaser drawer.** `unitMarkSpec.ts` (activity dot:
   solid green, half-filled amber, grey ring; combat dot with sword, tick or
   cross glyph; charge chevron in the opposite corner; size about 8 px at
   zoom 1, dark outline) and `unitMarkGraphics.ts` drawing it onto a
   `Graphics`. Pure part tested; the drawer is not (the live check). Covers
   AC13's data half.
5. **Attach to both figures.** Standard: a second, non-rotating follower in
   `jointFigure` (new optional param; `facingPart` stays the facing mark;
   `objects()` lists it; `setPosition`/`setAlpha`/`destroy` reach it; added
   to `ignoreOnUiCamera`). Drawn: a third child of the container, so
   `figureOf` (`list[1]`) is unchanged; `setGhost`'s drawing has no status
   so no mark. Depth above the counter and the facing mark. Covers B7 to B10
   (view half).
6. **Drawings helper + scene wiring (BoardScene net-negative).**
   `unitDrawings.ts` builds drawings (and the ships list) from `GameState`
   and the context, calling `unitStatuses` once per call; `renderAllUnits`
   uses it with `{ attackedThisPhase, rammedThisTurn }` already held by the
   scene (`BoardScene.ts:167`, `:456`). Re-read `renderAllUnits` first (§83
   and §73 may have moved it). Run `npm run size:baseline`; lower the
   baseline with `--write` if the file shrank. Placement keeps its own
   drawings (no status; AC12).
7. **Dev-hook reader + e2e.** `MapView`/view method returning, per unit id,
   the status each view is showing; `devHook` exposes it; the dev-hook
   members test is updated for the new reader. `e2e/unit-status-markers.spec.ts`
   starting from a Test mode shortcut, acting by canvas clicks (AC7 to
   AC12); both views; a mid-slide frame at Normal speed and a jump at Off
   (AC10).
8. **README line and live-check tuning.** One sentence in the README's
   board section; any size, corner or colour change from the live check goes
   in `unitMarkSpec.ts` and is recorded in the review (spec B7).

## Tests

Every spec B and AC maps to a subtask and a test or check:

| Spec | Subtask | Proof |
| --- | --- | --- |
| B1, B6, AC4 | 2 | `unitStatus.test.ts`: absent units; destroyed has none; outside movement/combat empty; state and context deep-equal before and after; same result twice |
| B2, I1, I2, AC1 | 2 | fresh `notMoved`; one hex `partlyMoved`; `movementLeft` 0 `done`; ship after one rotation `partlyMoved`; charged cavalry `done` + charge; ZOC-boxed full allowance `notMoved`; other players' units none; undone move (state restored) `notMoved` |
| B3, I3, I6, AC2 | 2 | `canAttack` with a legal target; no target none; in `attackedThisPhase` `hasAttacked`; ship in `rammedThisTurn` `hasAttacked`; cavalry beside a phalanx none; archer in range `canAttack`; a unit that can only join a combined attack still `canAttack` |
| B4, I4, AC2, AC3 | 2 | `defendedThisPhase` enemy `beenAttacked` in combat, none in movement; that enemy no longer makes a unit `canAttack`; no unit with two activity statuses |
| B5, I5, AC3 | 2 | charge flag in both phases, absent for non-cavalry and for uncharged cavalry |
| AC14 | 2 | spy on `legalActions`: zero calls in a movement-phase call with `{}`; a call in combat; review read of `renderAllUnits` for once per render |
| B8, AC5 | 3 | `reconcileUnits`: status-only diff is `update`, `recreate` false; equal statuses no work; `planAnimation` returns no step; replay in `viewDrawingState` keeps the status |
| B8, B9, AC6 | 3 | `unitLayer.test.ts` with fakes: `setStatus` called on a status-only change, also while another unit animates, not on an unchanged drawing; set at build on add and on recreate; position, alpha and destroy reach a figure's mark |
| B7 | 4 | `unitMarkSpec.test.ts`: each status maps to a distinct dot shape and colour pair (shape differs, not colour alone); charge chevron independent of the activity |
| B7, B9, B10, AC7 | 5, 7 | e2e both views: mark among the unit's own objects, `hudStrays().strays` empty, reader returns the shown status |
| AC8 | 7 | e2e Test mode: start `notMoved` (other player none), one move `partlyMoved`, full spend `done`, Ctrl+Z restores |
| AC9 | 7 | e2e: end movement gives `canAttack`; after an attack attacker `hasAttacked`, defender `beenAttacked`; after End phase new active `notMoved`, old `beenAttacked` gone. No undo claimed after a roll |
| AC10 | 7 | e2e: at Normal speed mid-slide the mark's position equals its counter's, both views; at Off it jumps with it |
| AC11 | 7 | e2e: view toggle and in-game load leave the readings unchanged |
| AC12 | 6, 7 | `placementDrawings.test.ts` (no status field) or `placement.spec.ts` reader empty |
| AC13 | 8 | the live check |
| AC15 | all | `npm run verify` and `npm run e2e` |

Mutation list (a test that fails if the line is mutated): removing the
`rammedThisTurn` branch fails the rammed-ship test; dropping the combat-phase
gate on `defendedThisPhase` fails the movement-phase `beenAttacked` test;
swapping `done`/`notMoved` order fails the printed-0 and charged-cavalry
tests; removing the `legalActions` call fails the no-target and
cavalry-vs-phalanx tests; calling it in movement fails the spy test; removing
the status from `reconcileUnits` fails the `update` test; setting the mark
only inside the animation settle fails the "while another unit animates"
layer test.

## Validation

- `npm run verify` green (lint stays at or below the cap in `package.json`;
  the cap is never raised and is lowered in the same commit if warnings drop)
- `npm run check:intent` PASS (or ROUTE with a reason recorded in review.md)
- `npm run e2e` (paths `src/ui/`, `src/scenes/` change; the new scenario
  covers the reader and both views)
- **Live check owed** (new and visual, `src/ui/` and `src/scenes/`; the owner
  runs it, the smoke suite does not stand in). Steps, in "Test mode" with 2
  players, in both the Standard and the Drawn view, English and French
  screens, at the default, min and max zoom: (1) start of the movement phase:
  every active unit carries the green solid dot, the other player's units
  none; (2) move one land unit one hex, then a unit its whole allowance:
  half amber dot then grey ring; (3) rotate a ship once: amber; (4) a charged
  cavalry unit shows ring plus chevron; (5) End phase: units with a target
  show the sword dot, others nothing; (6) attack: attacker tick, defender red
  cross, the red cross gone after End phase; (7) watch a slide at Normal
  speed: the mark travels with the counter, never ahead; (8) the marks hide
  neither a counter's printed values nor a ship's facing mark, and read next
  to each of the four player colours; (9) toggle the view and load a save
  mid-phase; (10) a computer seat's turn shows its states as it acts. The
  owner may instead accept a new e2e scenario for the legible parts, per the
  recorded preference to propose e2e for live checks; AC13 (the look) stays
  a live check.

## Assumptions I made

- **Where the helper lives.** The spec says to move the drawings loop "for
  example" into a `src/ui` helper; I chose `src/ui/unitDrawings.ts`, because
  it needs a drawings type that lives in `src/ui/boardView.ts` and `engine`
  must not import `ui`.
- **A separate pure `unitMarkSpec.ts`.** Not in the spec's non-functional
  list; it makes the look a tested table and the Phaser drawer a thin
  wrapper. Not a rule or look decision (the look stays the spec's B7).
- **Reader name and shape.** The spec says "one reader of the statuses the
  views are showing, by unit id"; the exact name and return type are mine and
  settle in subtask 7.
- **Engine return type** (a Map or a record by unit id) is mine; the spec
  only says "for each living unit that has one".
- **Subtask order puts the engine before the seam**, so a failing §83
  dependency stops the work before any UI file is touched.
- **The owner accepted the spec as written** (combat glyphs sword, tick,
  cross; solid, half, ring dots; chevron in combat too), as reported by the
  coordinator; no spec change is made here.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-25 - subtasks 1 to 7 (the README line of subtask 8; the live-check tuning is the owner's)

Commits: `657c5e1` (engine `unitStatuses`), `8a65dcb` (the drawing carries the
status; the layer shows it outside the animation plan), `d430389` (mark spec
and drawers, both figures, drawings helper, dev-hook reader `unitMarks`, e2e,
README), plus the follow-up commit that renders on End phase and keeps
`MapView.ts` under 500 lines.

Shipped: as planned. `src/engine/unitStatus.ts` (14 tests),
`UnitDrawing.status/charged` + `sameMark` in `reconcileUnits`,
`LayerFigure.setStatus?/markAt?`, a non-rotating badge in `jointFigure`
(Standard) and a third container child (Drawn), `unitMarkSpec.ts` (3 tests) and
`unitMarkGraphics.ts`, `unitDrawings.ts` (1 test) used by `renderAllUnits`,
`BoardView.unitMarks()` / `MapView.unitMarks()` / dev hook `unitMarks`, and
`e2e/unit-status-markers.spec.ts` (7 scenarios). `npm run verify` green (113
files, 1850 tests passed, 2 skipped); `npm run e2e` 70 passed; lint cap stays 17.

Subtask 1: `src/engine/unmoved.ts` with `hasNotMoved` is on `main` (bf80d3a),
imported unchanged. BoardScene.ts: 2834 on main, 2827 now; the baseline is
lowered to 2827.

Divergences from the plan:
- `commitEndPhase` now calls `renderAllUnits()` (one line). The plan's risk
  "renders that don't follow a state change" was real: End phase changes no
  unit, so no cue rendered, and the markers stayed on the old phase's reading
  (found by the combat e2e). The attack and ram paths already render.
- The dev-hook reader is `unitMarks()` returning, per unit id, `{ status,
  charged, mark, counter }` (the last two are the drawn positions, for AC10).
  It is on the `BoardView` interface (both views implement it through
  `UnitLayer.marks()`); the existing `memberSnapshot` pattern is for scene
  members, so it was not used. `e2e/dev-hook-members.spec.ts` lists it.
- `MapView.ts` was at 496 lines; the reader is two lines there so it stays
  under 500.
- AC11 (view switch and load) and AC12 (Placement) are covered by e2e for the
  view switch and the load; AC12 is by construction (Placement's own drawings
  carry no status) with no extra test.
- The look (AC13, size, corners, colours) is untuned: it is the owner's live
  check. All constants are in `src/ui/unitMarkSpec.ts`.


2026-11-25, rework after review round 1 (commit 7c060a5). The branch was
rebased onto the new `main` first (commits 5d5d884, 2e22606, f830cab, bd3c29e);
`BoardScene.ts` is 2826 lines (`main` had 2833), baseline 2826. The suite was
1853 tests before the rework, 77 e2e.
- F1: `unitStatus.test.ts` pins `seatOrder[activePlayerIndex]` with
  `seatOrder = [1, 0]` (movement and combat); the mutant
  `const active = state.activePlayerIndex;` now fails 2 tests (E17 killed).
- F2: `unitDrawings.test.ts` combat case with `attackedThisPhase` and
  `rammedThisTurn` expects `hasAttacked` on both; the mutant
  `unitStatuses(state, {})` fails it (D6 killed).
- F3: `placementDrawings.test.ts` asserts no drawing has `status` or `charged`
  (AC12); a mutant adding `charged: true` fails it.
- F4: e2e "at Off speed": the mark equals the counter right after the click
  (Standard view).
- F5: `unitStatus.test.ts` B3/I6 row: an archer at range 2 and infantry beside
  the same enemy both read `canAttack`.
- F7, F8: `sameMark` comment and the dead ternary in `unitMarkGraphics.ts`.
- F9: the `key(to)` assertion and its import removed from the e2e spec.
- Numbers: `npm run verify` green, 113 files, 1858 tests passed (2 skipped),
  lint cap 17; `npm run e2e` 78 passed.
