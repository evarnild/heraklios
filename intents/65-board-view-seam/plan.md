<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §65 plan — The board's drawing goes through one view interface, keyed by unit

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Split `src/ui/MapView.ts` into two parts:
- **A shared surface:** origin and coordinates, the main and UI cameras, drag,
  zoom, hit-testing, hover and the tooltip.
- **A drawing part behind a `BoardView` interface:** terrain, rivers, units,
  highlights, rings, facings, the drift arrow, the movement, choice and range
  labels. Its one implementation, `StandardBoardView`, draws exactly what the
  Standard view draws today.

Units are drawn **by unit id** through `setUnits`, which reconciles by id, so a
later view (§64) or animation (§66) knows a moved unit is the same unit. The
scenes keep holding `this.mapView`, a `MapView` façade with the same name and,
apart from the unit calls, the same methods. Their diff is limited to the unit
calls. Behaviour is held constant: verify and e2e stay unchanged, and the owner
live-checks the Standard view.

## Risks

- **Hit-testing changes mechanism.** Today each hex's terrain polygon is
  also its click and hover target (`MapView.ts:165-182`). With terrain drawing
  moving into the view, hit-testing moves to the surface: one interactive
  `Phaser.GameObjects.Zone` over the board, plus a pure `hexAtPoint`. The
  regions are the same tessellation. But clicks at hex edges and vertices,
  and hover enter/leave, are behaviour that tests must hold:
  - a unit test proves `hexAtPoint` agrees with polygon containment
    (`Phaser.Geom.Polygon.Contains` on `hexPolygonPointsAt`) for every map hex;
  - the e2e suite (canvas clicks at hex centres) runs unchanged;
  - hover enter/leave and the tooltip are live-check items.
- **Input order with UI on top.** Phaser's `topOnly` input gives a click to
  the top-most interactive object. Today the hex polygons sit at depth 0,
  under every panel and button. The Zone must sit at the same depth, under
  them, and `pointerBlocked` keeps working for drag and zoom (`:234`, `:262`). The e2e
  suite clicks buttons over the map, and the Tables panel (§55) blocks the
  wheel and clicks; both are covered by scenarios.
- **Hover events.** `pointerover`/`pointerout` per polygon become "the hex
  under the pointer changed" on the Zone's `pointermove`, plus
  `pointerout`/`gameout` to clear. `onHexHover(null)` must fire when the
  pointer leaves the board or moves onto a UI object (the rules panel and
  attack preview listen to it).
- **Units keyed by id instead of hex.**
  - The old map replaced a marker already on the same hex (`:356-357`).
  - By id, two units on one hex would both draw. Today that can only happen
    transiently, if at all, and the scenes always redraw everything from
    state.
  - `setUnits` takes the full list and removes ids no longer present. No
    "replace by hex" behaviour is needed.
  - Placement draws only the current player's units (`PlacementScene.ts:320-326`),
    so its list is filtered by owner, as today.
- **The UI camera's ignore list.** `pinUIObjects` ignores every map object in
  the fixed HUD camera (`:284-298`), and markers created later ignore it
  themselves (`:382`, `:419`, `:495`, `:539`). The view must report its
  objects to the surface and ignore the UI camera for objects it creates
  later. Getting this wrong shows map objects twice or HUD objects zoomed,
  which only the live check and the e2e screenshots on failure would show.
  The plan keeps one `ignoreOnUiCamera(objects)` hook on the surface that the
  view calls.
- **The lint cap (21).** `MapView.ts` has no warning today. `BoardScene.ts`
  has five and `PlacementScene.ts` has one, all in functions this plan
  touches at most a line in (`create`). The split keeps every new function
  ≤80 lines and every file ≤500 code lines. `npm run lint` must stay at 21.
- **Stale line citations.** Everything below was re-read on `main` at
  `b75df0f`.

## Verified against the codebase

Re-read on `main` at `b75df0f`.

- `src/ui/MapView.ts:28-62` — `drawFacingArrowhead` (exported; used by facings and the drift arrow).
- `MapView.ts:64-125` — the fields: `hexPolys`, `overlayGraphics` (depth 5), `ringGraphics` (11), `riverGraphics` (3), `facingGraphics` (11), `driftArrowGraphics` (12), `unitLabels` keyed by `"q,r"`, `movementLabel`, `choiceLabels`, `rangeLabels`, `uiCamera`, `onHexClick`, `pointerBlocked`, `onHexHover`, `hoverTooltip`, `TOOLTIP_DEPTH = 35`.
- `MapView.ts:127-203` — the constructor (polygon loop `:165-182`): origin from `allHexes()` bounds and `leftPanelWidth`; graphics depths; one `scene.add.polygon` per hex (filled `TERRAIN_COLORS`, stroke `0x2a2016` at 0.4) that is also the interactive target (`pointerdown` → `onHexClick`, `pointerover` → `onHexHover` + tooltip, `pointerout` → `onHexHover(null)` + hide); `drawRivers()`; drag bounds with padding 200; `enableZoom()`; the main camera's viewport and scroll.
- `MapView.ts:205-226` — `drawRivers` (4 px `RIVER_COLOR` lines across each `RIVER_HEXSIDES` hexside).
- `MapView.ts:228-252` — `enableDrag` (scene-level `pointerdown/up/move`, `pointerBlocked` check, camera bounds).
- `MapView.ts:254-282` — `enableZoom` (`MIN_ZOOM = 0.4` at `:256`, `MAX_ZOOM = 2.5` at `:257`, cursor-centred, `pointerBlocked`).
- `MapView.ts:284-306` — `pinUIObjects` (adds the UI camera, ignores map objects in it, `excludeFromMainCamera(uiObjects)`), and `excludeFromMainCamera`.
- `MapView.ts:308-311` — `toScreen` (`hexToPixel` + origin).
- `MapView.ts:313-350` — `highlightHexes`, `highlightHexGroups` (clears both overlay and ring graphics first), `highlightRings`, `clearHighlights`.
- `MapView.ts:352-398` — `setUnitMarker(hex, typeId, playerIndex)` (replaces the marker on that hex; the image `markerTextureKey` scaled to `HEX_SIZE * 1.6`, or a 3-letter text fallback; ignores the UI camera), `clearUnitLabel(hex)`, `clearAllUnitLabels()`.
- `MapView.ts:400-432` — `showMovementPoints` and `hideMovementPoints`.
- `MapView.ts:434-468` — `setFacingIndicators`, `clearFacingIndicators`, `setDriftArrow`, `clearDriftArrow`.
- `MapView.ts:481-561` — `setChoiceLabels`, `clearChoiceLabels`, `setRangeLabels`, `clearRangeLabels`.
- `MapView.ts:563-595` — `showHexTooltip` (at pointer + 16, kept on screen, HUD-only) and `hideHexTooltip`.
- `MapView.ts:597-606` — `centerOn`, `centerOnPoint`. `:608-620` — `hexPolygonPointsAt` and `toVec` (module-private).
- `src/ui/hexRender.ts:13-17` — `pixelToHexRound(x, y)` (axial rounding, in `hexToPixel` space); also used by `ui/viewCentre.ts:34` and the map editor (`map-editor/input.ts:44`, `:50`), which this plan doesn't touch.
- `src/scenes/BoardScene.ts:613` — `this.mapView = new MapView(this, width, height, PANEL_WIDTH)`.
- `BoardScene.ts:859-862`, `:886` — `excludeFromMainCamera`, `pointerBlocked`, `pinUIObjects`, `onHexClick`.
- `BoardScene.ts:906-929` — `renderAllUnits`: `clearAllUnitLabels()`, then `setUnitMarker(u.position, u.typeId, u.owner)` per living unit; `setFacingIndicators(ships)`; the drift arrow; `refreshMovementLabel()`.
- `src/scenes/PlacementScene.ts:138` (`new MapView(this, width, height)`), `:139` (`onHexClick`), `:273` (`pinUIObjects`), `:320-326` (`redrawPlacedUnits`: this player's units only), `:450` (`setUnitMarker` after a land unit is placed), `:518` (after a ship is confirmed), `:553` (`clearAllUnitLabels`).
- `src/ui/logPanel.ts:75`, `:97` — `createLogPanel(scene, mapView, bounds)` calls only `mapView.excludeFromMainCamera`.
- `src/ui/devHook.ts:31`, `:140`, `:171-176` — reads `scene.mapView.toScreen(hex)` and `cameras.main`. It must keep working unchanged.
- `eslint.config.js:36-37` — `max-lines` 500 and `max-lines-per-function` 80 (comments skipped). Today: `MapView.ts` 0 warnings, `BoardScene.ts` 5, `PlacementScene.ts` 1.

## Subtasks

1. **`src/ui/hexHitTest.ts` (pure).** `hexAtPoint(x, y)` returns the map hex
   whose polygon contains the point (in `hexToPixel` space), or `null` off the
   map. It's built on `pixelToHexRound` plus a `MAP_TERRAIN` membership check.
   Tests in `hexHitTest.test.ts` (see Tests). Commit.
2. **`src/ui/boardView.ts` (types only).**
   - `interface UnitDrawing { id; typeId; owner; position; facing? }`.
   - `interface BoardView`, the drawing half of today's API:
     - `setUnits(units: readonly UnitDrawing[])`;
     - `highlightHexes`, `highlightHexGroups`, `highlightRings`, `clearHighlights`;
     - `showMovementPoints`, `hideMovementPoints`;
     - `setFacingIndicators`, `clearFacingIndicators`;
     - `setDriftArrow`, `clearDriftArrow`;
     - `setChoiceLabels`, `clearChoiceLabels`;
     - `setRangeLabels`, `clearRangeLabels`;
     - `mapObjects(): GameObject[]` (for the UI camera);
     - `destroy()`.

   Also a pure `reconcileUnits(prev: Map<id, UnitDrawing>, next)` that
   returns `{ add, update, remove }`, with tests. Commit.
3. **`src/ui/standardBoardView.ts`.**
   - Moves the drawing code out of `MapView.ts` unchanged: terrain polygons
     (now non-interactive, same fill and stroke), rivers, overlay and ring
     graphics, markers, movement points, facings, the drift arrow, choice
     and range labels.
   - `setUnits` uses `reconcileUnits`. It keeps one marker per id, recreating
     it when its type or owner changes and repositioning it when it moves.
   - It takes a small `ViewHost` from the surface (`scene`, `toScreen`,
     `ignoreOnUiCamera`) instead of the whole `MapView`.
   - `drawFacingArrowhead` and `hexPolygonPointsAt` move to a shared helper
     module (`src/ui/hexDraw.ts`). `MapView.ts` re-exports
     `drawFacingArrowhead` so the existing imports keep working.

   Commit.
4. **`MapView.ts` becomes the surface and façade.** It keeps:
   - the origin, `toScreen`, `centerOn` and `centerOnPoint`;
   - `pinUIObjects` (the ignore list = `view.mapObjects()` plus the Zone) and
     `excludeFromMainCamera`;
   - drag and zoom;
   - `onHexClick`, `onHexHover` and `pointerBlocked`;
   - the tooltip.

   Changes inside it:
   - It creates one `Zone` covering the board's padded bounds at depth 0.
   - Its `pointerdown`/`pointermove`/`pointerout` handlers map through
     `hexAtPoint` (world point = camera's `getWorldPoint` minus the origin)
     to the same callbacks as before. Hover fires only when the hex changes.
   - It constructs a `StandardBoardView` and forwards each `BoardView` method
     to it. `setUnits` replaces `setUnitMarker`, `clearUnitLabel` and
     `clearAllUnitLabels`.
   - It exposes `get view(): BoardView` for §64's toggle, unused here.

   Commit.
5. **Scenes.**
   - `BoardScene.renderAllUnits` builds the `UnitDrawing` list (living units,
     with facing for ships) and calls `setUnits`. The ships' facing list and
     the drift arrow stay as they are.
   - `PlacementScene`: `redrawPlacedUnits`, the two placement paths
     (`:450`, `:518`) and `:553` call `setUnits` with this player's placed
     units.

   No other scene change. Commit.
6. **Docs.** `CLAUDE.md` Architecture's `src/ui/` bullet names `MapView.ts`
   (camera, input, façade), `boardView.ts` (the interface) and
   `standardBoardView.ts`, and says a second view implements `BoardView`.
   Progress entry; set `status: in-review`. Commit.

## Tests

- **`hexHitTest.test.ts`:**
  - for every hex in `MAP_TERRAIN`, `hexAtPoint` returns that hex for its
    centre and for 12 points at 0.9 × `HEX_SIZE` toward each vertex and edge
    midpoint;
  - for points just outside the map's outer edge it returns `null`;
  - for 1000 seeded random points in the board's bounds, it agrees with
    `Phaser.Geom.Polygon.Contains` over `hexPolygonPointsAt` of the hex it
    names (and of no hex, when it returns `null`).

  Mutating the membership check (always the rounded hex) fails the `null`
  case. Mutating the rounding fails the vertex points.
- **`boardView.test.ts`** (`reconcileUnits`):
  - an unchanged list gives no work;
  - a moved unit is an `update`, not a remove and add;
  - a changed owner or type is an `update` flagged for recreate;
  - a missing id is a `remove`;
  - a new id is an `add`;
  - order-independence.

  Each branch has a mutation the test catches (for example, comparing by
  position instead of id makes a move a remove and add).
- **Unchanged and green:** all 1183+ vitest tests and all 17 e2e scenarios,
  with no edits to any test or scenario. If an e2e edit turns out to be
  needed, stop and record why: it means behaviour moved.
- The Phaser classes (`StandardBoardView`, the `MapView` surface) stay
  untested by vitest, as `MapView.ts` is today. The e2e suite and the live
  check cover them.

## Validation

- `npm run verify` green, lint at 21, test count reported.
- `npm run check:intent` PASS (or FAIL only on an owed live check).
- `npm run e2e`: 17 passed, unchanged scenarios.
- **Live check** (owed by rule 1). `npm run dev -- --port 5265 --strictPort
  --host 127.0.0.1` in the worktree, with `HERAKLIOS_SAVES_DIR` set to a temp
  folder, compared side by side with `main` (the worktree of any other
  branch, or `heraklios-stable` on its own port):
  1. **Board** in "Combat test mode": the terrain, rivers and counters look
     identical. Hovering shows the tooltip, and it moves hex to hex at hex
     edges with no gap or flicker. Leaving the map, or moving onto the side
     panel, hides it.
  2. Click a unit and a destination: the move happens. Click near a hex
     vertex: the hex under the pointer is the one selected.
  3. Drag and wheel-zoom: same feel, same limits. The Tables panel still
     blocks both over it.
  4. Ships: facing arrows. An elephant drift (if reachable): the drift arrow.
     Swap rings, range labels when building an attack, choice labels in a
     retreat.
  5. **Placement**: the zone highlight, placing land units and a ship with
     facing, undo/redo of a placement, and the other player's units hidden.

## Assumptions I made

- The façade keeps the name `MapView` and the scenes' field `mapView`, so
  `devHook.ts` and `logPanel.ts` are untouched. Renaming is not part of this
  refactor.
- `setFacingIndicators` stays a separate call (Placement shows a pending,
  not-yet-placed ship's facing). `UnitDrawing.facing` is carried for views
  that draw the facing on the unit (§64), and the Standard view ignores it.
- The Zone replaces per-hex interactive polygons, rather than keeping
  polygons as hit areas inside the Standard view. That way §64's view needs
  no hit shapes of its own (the intent: "hit-testing … stay shared").
- No change to the map editor, which has its own canvas and input.
- Tier: Attested by the path table.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-05 - all six subtasks

Commits: `hexAtPoint` + tests; `BoardView` + `reconcileUnits` + tests;
`StandardBoardView` + `hexDraw.ts`; `MapView` surface/facade together with the
scene call sites (subtasks 4 and 5 in one commit, so every commit builds);
docs (`CLAUDE.md` `src/ui/` bullet) + this entry + `status: in-review`.

Shipped: as planned. `MapView.ts` is the surface (origin, cameras, drag, zoom,
one depth-0 `Zone` mapped through `hexAtPoint`, hover on hex change, tooltip)
and forwards all drawing to a `StandardBoardView` behind `BoardView`. Scenes
call `setUnits` with `UnitDrawing[]` (Board: living units, facing for ships;
Placement: this player's units, via a new `drawPlacedUnits`). `devHook.ts` and
`logPanel.ts` are untouched.

Tests: 1195 vitest (was 1183+; +3 `hexHitTest`, +6 `boardView`), 66 files. No
existing test or e2e scenario edited. `npm run e2e`: 17 passed. Lint: 21
warnings (unchanged; `MapView.ts` 0, `BoardScene.ts` 5, `PlacementScene.ts` 1).
Mutants (full `npx vitest run`, each caught, each restored by copy): membership
check dropped (2 fail); rounding shifted (3 fail); `reconcileUnits` keyed by
position (1 fail); owner ignored in recreate (1); move not an update (1);
remove disabled (1); every unit always an update (2).

Divergences and notes:
- `hexHitTest.test.ts` uses its own ray-casting containment (the algorithm of
  `Phaser.Geom.Polygon.Contains`), because importing Phaser needs a browser
  `window` and the suite runs in node.
- "0.9 x `HEX_SIZE` toward each edge midpoint" is read as 0.9 of the distance
  to the midpoint (0.9 x `HEX_SIZE` would lie outside the hex).
- `hexAtPoint` normalises `-0` to `0` so callers get the same hex values as
  before.
- `StandardBoardView.setUnits` re-sorts markers with `children.bringToTop` in
  list order after any add or update, to keep which stacked counter is on top
  as it was when every render rebuilt all markers in state order.
- `mapObjects()` lists exactly what the old `pinUIObjects` ignored. The drift
  arrow graphics were never in that list (so the UI camera may draw it a second
  time at its world position); kept as is to hold behaviour constant. Flagged
  for the owner, a one-line fix if wanted.
- README: nothing to move (no "Known simplification" covers this refactor and
  README does not mention `MapView`), so it is unchanged.
- Live check still owed (hover/tooltip at edges, leaving the map, drag/zoom,
  Placement).
