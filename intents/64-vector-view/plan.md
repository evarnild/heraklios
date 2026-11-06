<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §64 plan — A second board view, a drawn 2D landscape with unit figures

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Add a second implementation of §65's `BoardView`, the **Drawn** view: a
landscape baked once into a texture from `MAP_TERRAIN` and
`RIVER_HEXSIDES`, a thin hex grid, vector unit figures on owner-shaped bases,
and restyled overlays. A toggle on the Board and in Placement switches
between Standard and Drawn at any moment, without touching `GameState`, and
the choice is remembered under `heraklios.boardView`. All geometry (region
outlines, smoothing, rivers, flank sides, seeded variation, figure shapes,
the badge text) is pure and unit-tested. Phaser code only draws what it
returns. The Standard view, the engine, the data and the save format are not
changed.

## Risks

- **Tests that pass whatever the code does.** Geometry tests must assert
  positions (point-in-polygon of real hex centres, segment-to-hexside
  matching), not just counts or "non-empty". Each pure function gets at
  least one test that a sign flip, an off-by-one or a dropped term breaks.
- **The replay of drawing state on a toggle (B2).** The new view must show
  exactly what the old one showed. The Standard view's `highlightHexGroups`
  also clears the rings (`standardBoardView.ts:178-179`). The recorder must
  copy that rule, or a toggle brings back stale rings. It gets its own unit
  tests against a fake `BoardView`.
- **The fixed HUD camera.** Objects of a view made after `pinUIObjects`
  must be kept off the UI camera, both at the swap and later, lazily.
  Otherwise a second, unzoomed copy shows. This is §65's F5 and §67's
  drift-arrow bug. The Drawn view lists **every** world object it owns in
  `mapObjects()`, its drift arrow included. `MapView.setViewKind` calls
  `uiCamera.ignore(newView.mapObjects())`.
- **Draw order.** Figures share one depth, like the Standard markers. Copy
  the `bringToTop` plus `queueDepthSort()` pattern
  (`standardBoardView.ts:124-128`), or the overlays at depths 11-13 end up
  under the figures. `e2e/draw-order.spec.ts`'s check runs in the Drawn view
  too.
- **Texture size and sharpness.** At the 2× bake scale the board is about
  2.9k × 2.4k px, under the 4096 px limit of common WebGL. At zoom 2.5 it is
  slightly soft. That is a live-check item, not a defect. If WebGL reports a
  smaller `maxTextureSize`, the bake scale drops to 1.
- **Input.** Nothing in the Drawn view may be interactive, so every click and
  hover still reaches the shared hit `Zone` (`MapView.ts:100-115`) (B13).
- **Stale line citations.** `spec.md`'s `MapView.ts` ranges predate §65. The
  ones below were re-read after §65's merge.
- **The lint cap (21).** New files stay under 500 lines and functions under
  80. `BoardScene.ts` (3176 lines) and `PlacementScene.ts` (564) already
  carry their file-length warning, so the toggle wiring goes in a helper,
  `ui/viewToggle.ts`, and adds only a few lines to each scene's `create`.
- **Drift-machine fall-through.** Not applicable: no `drift.ts` or engine
  change.

## Verified against the codebase

Re-read on `main` at `5575baf` (after §65's merge, `209600f`).

- `src/ui/boardView.ts:11-17` — `UnitDrawing { id, typeId, owner, position, facing? }`; `facing` is "for views that draw a ship's bow on the unit itself".
- `src/ui/boardView.ts:25-54` — the `BoardView` interface: `setUnits`, `highlightHexes`, `highlightHexGroups`, `highlightRings`, `clearHighlights`, movement points, facing indicators, drift arrow, choice and range labels, `mapObjects`, `destroy`.
- `src/ui/boardView.ts:59-63` — `ViewHost { scene, toScreen, ignoreOnUiCamera }`.
- `src/ui/boardView.ts:85-101` — `reconcileUnits(prev, next)`, the add/update/remove diff by id.
- `src/ui/MapView.ts:91-95` — the constructor builds `new StandardBoardView({...})` with the host. This is the one place a factory replaces.
- `src/ui/MapView.ts:100-115` — one interactive `Zone` and `hexAtPoint`, with click, hover, `pointerout` and `gameout`.
- `src/ui/MapView.ts:210-218` — `pinUIObjects` creates the UI camera and ignores `boardView.mapObjects()` and the zone; `uiCamera` is stored.
- `src/ui/MapView.ts:232-235` — the `view` getter, "for a view toggle".
- `src/ui/MapView.ts:237-295` — the forwarders to `boardView`, where the recorder hooks in.
- `src/ui/standardBoardView.ts:43-54` — depths: overlay 5, facings 11, rings 11, drift arrow 12; the river graphics at 3 (`:68`); markers at 10 (`:145`, `:161`); the movement label at 12 (`:226`); choice and range labels at 13 (`:302`, `:346`).
- `src/ui/standardBoardView.ts:104-129` — `setUnits` with reconcile, `bringToTop` and `queueDepthSort`.
- `src/ui/standardBoardView.ts:177-202` — `highlightHexGroups` clears the overlay **and the rings**; `highlightRings` adds; `clearHighlights` clears both.
- `src/ui/hexDraw.ts:15-47` — `drawFacingArrowhead(graphics, center, facing, colorHex, scale)`.
- `src/ui/hexRender.ts:4` — `HEX_SIZE = 22`; `:7-11` — `hexToPixel` (flat-top axial); `:35-42` — `hexPolygonPoints` (vertex `i` at `60·i`°); `:50-52` — `facingAngleRad`; `:54` — `TERRAIN_COLORS`; `:89` — `PLAYER_COLORS_HEX`.
- `src/ui/hexHitTest.ts:15-21` — `hexAtPoint(x, y)`.
- `src/data/terrain.ts:1-12` — the eleven `TerrainType`s; `:115` — `canEnterTerrain`; `:15-20` — `ZONE_TERRAINS`; `:27-29` — `isSeaLike` (the zones plus `sea`; `coast` is land, `:84-89`).
- `src/data/map.ts:15-19` — `riverEdgeKey` (the canonical `lo|hi` key); `:21` — `MAP_TERRAIN`; `:1315` — `RIVER_HEXSIDES`.
- `src/engine/hex.ts:78` — `neighbors(hex)`; `:99` — `DIRECTIONS`, in facing order.
- `src/data/units.ts:18-19` — the counter format "attack (rangedAttack) range / defense movement"; `:22-191` — the 14 type ids.
- `src/ui/mapBounds.ts:11` — `allHexes()`; `:114`, `:144` — `deploymentBand`, `navalDeploymentBand`.
- `src/ui/i18n/index.ts:8` — `LANGUAGE_STORAGE_KEY`; `:34-40` — `readStored` with try/catch; `:62-70` — `setLanguage`, which writes in try/catch and keeps the in-memory value.
- `src/scenes/BoardScene.ts:614` — `new MapView(this, width, height, PANEL_WIDTH)`; `:754-766` — `abandonBtn` at `(16, height - 136)`, its label `'✕ Abandon game'` / `'✕ Abandonner'` (`en.ts:158`, `fr.ts:144`); `:863-882` — the `pinUIObjects` list; `:905-918` — `renderAllUnits` builds the `UnitDrawing`s with `facing` for ships.
- `src/scenes/PlacementScene.ts:138` — `new MapView(this, width, height)`; `:177` — Undo at `(20, height - 104)`; `:273-286` — `pinUIObjects`; `:323` — `setUnits(...)`, without `facing`.
- `src/ui/rulesPanelLayout.ts:11` — `SIDE_PANEL_WIDTH = 300`.
- `src/ui/devHook.ts:30-32` — `BoardInternals` (only `mapView.toScreen`); `:184-187` — `viewCentre`; `:211-212` — `cameraZoom`, `displayListSorted`.
- `src/scenes/BoardScene.ts:165` — `private selected: Unit | null`.
- `src/scenes/MenuScene.ts:218-233` — the combat test button at `(width / 2, 612)`; `src/ui/testMode.ts:37`, `:111` — `startTestGame`, `startCloseCombatTestGame`.
- `e2e/helpers.ts:38` — `startFromMenu`; `:47` — the init script pins only `heraklios.language`; `:133` — `clickButton`; `:171` — `clickHex`.
- Bundle before: `main-*.js` 1,660.04 kB (gzip 390.16 kB), from `vite build` at `5575baf`.

## Subtasks

1. **The remembered choice (B3, B4).** `src/ui/boardViewPreference.ts`:
   - `BoardViewKind = 'standard' | 'drawn'` and `BOARD_VIEW_STORAGE_KEY = 'heraklios.boardView'`;
   - `resolveBoardView(stored)`: `'drawn'` only for exactly `'drawn'`, else `'standard'`;
   - `boardViewKind()` and `setBoardViewKind(kind)`, copying the language's try/catch read and write (`i18n/index.ts:34-40`, `:62-70`).

   No save change (B4).
2. **Recorded drawing state and the swap (B2).**
   - `src/ui/viewDrawingState.ts` (pure, type imports only): a `ViewDrawingState` that records the last call of each `BoardView` setter:
     - the units;
     - the highlight groups and the ring calls since the last group or clear, following `standardBoardView.ts:177-202`'s clearing rule;
     - the movement points (or hidden);
     - the facing indicators, the drift arrow, and the choice and range labels.

     `replay(view)` re-issues them in a fixed order: units, groups, rings, movement, facings, drift, choice, range.
   - In `MapView`:
     - every forwarder records first;
     - `createView(kind)` builds a `StandardBoardView` or a `DrawnBoardView`;
     - the constructor takes `boardViewKind()`;
     - `setViewKind(kind)` does nothing when the kind is unchanged. Otherwise it builds the new view, replays into it, destroys the old view, calls `uiCamera?.ignore(newView.mapObjects())`, and leaves the camera, zone and tooltip alone;
     - a `viewKind` getter is added.

   Committable with only the Standard view in the factory: `DrawnBoardView` comes in subtask 5, and until then `'drawn'` builds a Standard view.
3. **Landscape geometry (B5, B6, B8).** These files are pure, in `src/ui/landscape/`, in `hexToPixel` space:
   - `regions.ts`: `regionLoops(isMember)` returns closed loops of the hex edges between member and non-member hexes. Off-map counts as non-member. Edges are chained by vertex, with vertex keys rounded to 0.01 px. This one function outlines the water (`isSeaLike`), each `zone-*`, `plateau ∪ steep-flank`, `marsh` and `river-wide`.
   - `smoothing.ts`: `smoothLoop(points, iterations)`, a Chaikin corner cut. Two iterations is the default.
   - `rivers.ts`: `riverPolylines(hexsides)` maps each key to its shared edge (the two vertices common to both hexes), then chains edges that meet at a vertex of degree 2. A polyline ends at a vertex of degree 1 or 3 or more. `meander(polyline, amplitude)` adds bounded perpendicular midpoint offsets, at most `0.12 × HEX_SIZE`, seeded by the coordinates.
   - `variation.ts`: `hexNoise(q, r, salt)` returns a value in [0, 1) from an integer hash. It doesn't depend on the game seed.
   - `flanks.ts`: `flankSides(terrain)` returns, for each `steep-flank` hex, the side indices (0-5, in `DIRECTIONS` order) whose neighbour is neither `plateau` nor `steep-flank`.
   - `gridLines.ts`: `gridSegments(hexes)` returns each hex edge once, for the overlay.
4. **Figures (B9, B10).** `src/ui/figures/` (pure):
   - `figureShapes.ts`: `figureFor(typeId)` returns a list of primitives (`polygon`, `circle` and `line`, in unit-local coordinates within radius 1), one silhouette per type as B9 lists. The galleys draw `oarBanks` = 1, 2, 3, 5 rows (`galeres`, `biremes`, `triremes`, `quintiremes`), and the bow points along +x, so a rotation by `facingAngleRad` aims it.
   - `baseShape(owner)`: owners 0-3 are round, square, diamond, shield.
   - `counterBadge(type)`: `attack`, then `(rangedAttack) range` when `range > 0`, then `/ defense movement`, following `units.ts:18-19`.
5. **`src/ui/drawnBoardView.ts` (B5-B7, B9-B12).** It implements `BoardView`:
   - **The landscape**, in `landscape/paintLandscape.ts`. It is drawn once in the constructor into a `RenderTexture` at bake scale 2, or 1 when `maxTextureSize` is below the board's size × 2, and shown as one `Image` at depth 1, scale 0.5. It draws:
     - the land base, per-terrain fills inside the smoothed region loops, and soft edges;
     - the water body with shallow shading along the coastline, a tint per zone, and `coast` hexes as shore;
     - meandering rivers and `river-wide` water;
     - plateau relief, and hatching on the flank sides;
     - marsh reeds and pools;
     - grass variation from `hexNoise`;
     - the grid overlay last, 1 px at alpha 0.18.

     Only fixed-seed variation. A module counter `landscapeBuilds` counts the bakes, for the dev hook.
   - **Units:** one `Container` per unit id at depth 10, with a `Graphics` holding the base and the figure and a `Text` badge (11 px, dark outline). Ships are rotated by `facingAngleRad(facing)`, and the badge stays upright. Reconciled by `reconcileUnits`. `bringToTop` and `queueDepthSort()` follow §65. `setFacingIndicators` and `clearFacingIndicators` draw nothing, because the galley's orientation is the facing (spec assumption). The drift arrow stays an arrow.
   - **Overlays**, in `drawnOverlays.ts`, at the Standard view's depths:
     - highlights as a fill plus a 2 px outline, so they stay legible over the landscape;
     - rings at 4 px;
     - the movement points;
     - the drift arrow (`drawFacingArrowhead`, scale 1.15);
     - choice and range labels at the same offsets as Standard.
   - `mapObjects()` lists the image, every graphics object, every container and every label. Lazily made objects go through `host.ignoreOnUiCamera`. Nothing is interactive.
   - The factory in subtask 2 now builds it.
6. **The toggle (B1, B2, B14).**
   - `src/ui/viewToggle.ts`: `createViewToggle(scene, x, y, mapView)` returns the `Text` button, depth 30, scroll factor 0. A click flips `mapView.viewKind`, calls `setBoardViewKind`, then `mapView.setViewKind` and `setText`. The label names the view it switches to.
   - i18n: `messages().common.switchToDrawn` is `'🗺 Drawn view'` / `'🗺 Vue dessinée'`, and `switchToStandard` is `'🗺 Standard view'` / `'🗺 Vue standard'`.
   - **Board:** right of Abandon on its row, at `(abandonBtn.x + abandonBtn.width + 8, height - 136)`.
   - **Placement:** at `(20, height - 136)`, above Undo.
   - Both are added to their scene's `pinUIObjects` list.
   - Dev hook, read-only, all new:
     - `boardView()` returns `mapView.viewKind`;
     - `cameraScroll()` returns the main camera's `scrollX` and `scrollY`;
     - `selectedUnitId()` returns BoardScene's `selected?.id ?? null`;
     - `landscapeBuilds()`.
7. **A figure gallery (AC6).** `startFigureGalleryGame()` in `testMode.ts`: four players on edges N, E, S, W. Each player has the 10 land types on the first free land hexes of `deploymentBand(edge)` and the 4 ships on `navalDeploymentBand(edge)`, `session.testScenario = 'gallery'`. A Menu button, only under `import.meta.env.DEV`, sits to the right of the combat test button on its row (`MenuScene.ts:218`), with origin (0, 0.5), at `x = combatTestBtn.x + combatTestBtn.width / 2 + 8`.
8. **The e2e scenario**, `e2e/board-view.spec.ts` (AC1, AC2, AC5, AC7):
   - From the plain test mode, record the state, `cameraZoom`, `cameraScroll` and `selectedUnitId`. Select a unit, then click the toggle: everything is unchanged, `boardView()` is `'drawn'` and `displayListSorted()` is true.
   - In the Drawn view, move that unit to an adjacent reachable hex with `clickHex`. It lands there.
   - Zoom with the wheel and drag, then check that `landscapeBuilds()` hasn't grown.
   - Toggle back: everything is unchanged again.
   - Toggle to Drawn and reload, then start the test mode again: `boardView()` is `'drawn'`.
   - No page errors.
9. **Docs and numbers (AC9).**
   - README: the board and placement sections describe the toggle and the remembered choice.
   - The bundle size after the change, in Progress.
   - `noLiterals.test.ts` stays green.

## Tests

- **`boardViewPreference.test.ts`:**
  - `resolveBoardView` maps `'drawn'` to `'drawn'`, and `null`, `''`, `'Drawn'` and `'standard'` to `'standard'`.
  - A throwing `localStorage` stub reads `'standard'`, and its write keeps the in-memory value.
  - A write followed by a read round-trips.
- **`viewDrawingState.test.ts`**, against a fake view that logs calls:
  - Replay re-issues the last call of each kind, in order.
  - `highlightHexGroups` drops the earlier rings (kills a recorder that keeps them).
  - Rings after a group are kept.
  - `clearHighlights` drops both.
  - `hideMovementPoints` after a show replays as hidden.
  - `clearChoiceLabels` empties the labels.
  - An empty recorder replays only `setUnits([])` and the clears.
- **`MapView`'s swap.** It needs Phaser, so it is covered by e2e step 1 and the live check, not by vitest. The pure part is the recorder.
- **`regions.test.ts`:**
  - On the real map, every sea-like hex centre lies inside the water loops (even-odd point-in-polygon) and every land centre outside, both raw and after `smoothLoop(·, 2)`. This is AC3's "separates" and "smoothing never crosses a centre".
  - On a 3-hex toy region, the loop has exactly 12 vertices (kills a chaining off-by-one).
  - A region touching the map edge still closes.
  - Each zone's loops contain exactly that zone's centres.
- **`smoothing.test.ts`:**
  - A unit square smoothed once gives the 8 known Chaikin points (kills a 1/4 ↔ 3/4 swap).
  - A loop's point count doubles per iteration.
- **`rivers.test.ts`:**
  - Every `RIVER_HEXSIDES` key maps to exactly one segment across all polylines, and every segment to a key (AC3).
  - A segment's endpoints are the two vertices shared by its hexes (kills a perpendicular-sign error).
  - Two hexsides meeting at a vertex chain into one polyline.
  - `meander` is deterministic, keeps the endpoints fixed and offsets no more than the amplitude.
- **`variation.test.ts`:** the same `(q, r, salt)` gives the same value, the range is [0, 1), and neighbours differ (kills a constant hash).
- **`flanks.test.ts`:** a toy map gives the exact side indices facing lower ground (kills a direction offset). On the real map, every `steep-flank` hex has at least one side.
- **`gridLines.test.ts`:** two adjacent hexes give 11 segments, not 12 (kills the dedupe).
- **`figureShapes.test.ts`:**
  - All 14 type ids have a figure, and every point is within radius 1.
  - The galleys' `oarBanks` are 1, 2, 3, 5.
  - No two types share a primitive list (kills a copy-paste default).
  - The four `baseShape`s are pairwise different.
- **`counterBadge`:**
  - `archers` gives `0 (2) 2 / 1 3`, from `units.ts:22-33`.
  - `fantassins` has no parentheses.
  - The test lists all 14 against the `UNIT_TYPES` values.
- **The gallery** (`testMode.test.ts`, or the existing session tests' file): 56 units, every (type, owner) pair once, no two on one hex, and each unit on a terrain it may enter (`canEnterTerrain`).
- **e2e:** subtask 8. `draw-order`'s display-list check in the Drawn view kills a missing `queueDepthSort`. The whole existing suite stays green in Standard, unchanged (AC8).

## Validation

- `npm run verify` green: build, lint at 21 or below, and every test.
- `npm run check:intent` PASS, apart from the owed live check.
- `npm run e2e` green, including `board-view.spec.ts`.
- **Live check** (owed by path rule 1, and visual by nature: AC4, AC5, AC6). Run the branch on `npm run dev -- --port 5264 --strictPort --host 127.0.0.1` with a temporary `HERAKLIOS_SAVES_DIR`:
  1. **Combat test mode,** toggled to Drawn:
     - the coastline is smooth, with shallow water, shore on `coast` hexes and four distinct bay tints;
     - rivers meander along their hexsides, and wide rivers are broad water;
     - plateaus show relief, with hatched flanks on their outward sides;
     - marsh and grass look as described;
     - the grid is thin at zoom 0.4 and at 2.5;
     - the tooltip names each hex.
  2. **Drag and zoom** in both views: the same smoothness, and no unzoomed copy of anything.
  3. **Select, move, attack, swap and undo** in the Drawn view, with every overlay legible:
     - highlights and rings;
     - movement points;
     - range labels for a ship;
     - choice labels in a retreat or advance;
     - a ship turning, as the galley rotating;
     - a drift arrow, if you reach one.
  4. **Toggle in the middle** of a selection, a prompt and a computer turn: nothing changes but the look.
  5. **The figure gallery** (dev Menu button): each of the 14 types is recognisable, and each owner's base is distinct, also in greyscale (DevTools → Rendering → emulate achromatopsia).
  6. **Placement** in a normal game: the toggle is there, the zones are tinted, placing and undoing work, and a reload keeps the view.

## Assumptions I made

- Facing is shown by the galley's rotation, so the Drawn view's `setFacingIndicators` draws nothing (spec assumption). The Turn-button glyphs (`hexDraw.ts`) are unchanged.
- The overlays get their own code in the Drawn view (`drawnOverlays.ts`) instead of being extracted from `StandardBoardView`. The spec rules out any change to the Standard view, and the overlays are restyled anyway.
- The bake scale is 2, and drops to 1 on a small `maxTextureSize`. Softness at zoom 2.5 is judged by the live check.
- The toggle goes right of Abandon on the Board, because the Save/Load and Tables row has no room within 300 px, and above Undo in Placement.
- The gallery is a dev-only Menu button, which is not in a production build. The spec allows "a dev-only page or test-mode shortcut".
- The badge follows the counter format comment in `units.ts:18-19`, not the images.
- Tier: Attested by the path table. The review may raise it.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### Phase 1 (subtasks 1-9), 2026-11-05

Commits: `bded7a9` (subtasks 1-2: remembered choice, drawing-state recorder, `MapView` swap), `850fab0` (3-4: pure landscape geometry and figure shapes), `e780628` (5-6: the Drawn view, the toggle, the dev-hook readers), `1d7e4b0` (7-8: figure gallery, `e2e/board-view.spec.ts`, visual tuning), and the closing commit (9: README, this entry, `status: in-review`).

What shipped, as the plan lists it:
- `ui/boardViewPreference.ts`, `ui/viewDrawingState.ts` and `MapView`'s `createView` / `setViewKind` / `viewKind`: every forwarder records first, a swap builds the new view, replays into it, destroys the old one and keeps it off the UI camera. A single `localStorage` key, `heraklios.boardView`.
- `ui/landscape/` (pure: `geometry`, `regions`, `smoothing`, `rivers`, `variation`, `flanks`, `gridLines`; Phaser painters: `paintContext`, `paintTerrain`, `paintWater`, `paintLandscape`) and `ui/figures/figureShapes.ts` (pure).
- `ui/drawnBoardView.ts` with `drawnUnits.ts` and `drawnOverlays.ts`; the landscape is baked once into a `RenderTexture` at scale 2 (1 when the GPU's `MAX_TEXTURE_SIZE` is too small).
- `ui/viewToggle.ts` on the Board (right of Abandon) and in Placement (above Undo); i18n keys `common.switchToDrawn` / `switchToStandard` and `menu.figureGallery`; dev hook `boardView()`, `cameraScroll()`, `selectedUnitId()`, `landscapeBuilds()`.
- Dev-only Menu button "Figure gallery (dev)" and `startFigureGalleryGame()` (`session.testScenario` gains `'gallery'`).
- README: a "The Standard view and the Drawn view" section, and the `src/ui/` line of the project structure.

Numbers: `npm run verify` green: 77 test files, 1277 tests (before: 69 files, 1236 tests; +8 files, +41 tests); lint 21 warnings (cap 21, unchanged). `npm run e2e`: 19 passed (18 existing, unchanged, plus `board-view.spec.ts`). Bundle (`vite build`): `main-*.js` 1,387.33 kB, gzip 372.58 kB. The plan's "before" figure (1,660.04 kB, gzip 390.16 kB) is not what `vite build` gives at `5575baf` here: a clean build of that commit gave 1,366.81 kB, gzip 366.18 kB, so the change adds 20.52 kB (gzip 6.40 kB).

Divergences from the plan:
- `regionLoops` takes the member hexes (`regionLoops(members: HexCoord[])`) instead of an `isMember` predicate: the caller filters, and off-map still counts as non-member.
- `flanks.test.ts`: the plan's "every `steep-flank` hex on the real map has at least one side" is false on the real map (a flank at `30,-2` is walled in by plateau and flank). The test says "most flanks", and pins that hex to `[]`.
- `regions.test.ts` gains one test the plan did not list: every loop of the sea, marsh and high-ground regions winds the same way, which is what lets the painters fill each loop on its own (there is no hole on this map).
- `smoothing.ts` also has `smoothPolyline` (open-ended Chaikin, ends fixed), which the river painter needs.
- The Drawn view's units are rebuilt (container destroyed and made again) whenever one is updated, so `queueDepthSort()` is redundant there (adding a child already queues a sort). It is kept as the plan says, but a mutant that drops it is not killed by `board-view.spec.ts` or `draw-order`, because nothing in the Drawn view can leave the list unsorted that way today.
- The galley's oars are drawn in the pale tone and the bay tints are bright water hues (the print's brown and purple read as ground); both from looking at screenshots, not in the plan.
- The e2e checks everything in the state except `elapsedMs` (the play clock runs on its own), and waits two frames before `displayListSorted()` (the sort happens on the next render).

For the live check, look at:
- Badge text: 11 px, with the counter's numbers; in a crowded position (combat test mode) the badges of neighbouring figures overlap. Say if it needs a smaller font or a different place.
- Softness of the baked landscape at zoom 2.5 (scale 2 bake).
- The four bay tints (the gold one, Pointe d'Eole, reads grey-green over deep water), and the galley figures with 1, 2, 3 and 5 oar banks at default zoom.
- Placement's toggle at `(20, height - 136)` above Undo, and the Board's right of Abandon (it sits close to Tables on the row above).
- A toggle during a prompt, a retreat or a computer turn; drift arrow, range and choice labels in the Drawn view.
- The play against an unusually small `MAX_TEXTURE_SIZE` was not exercised (the 1x fallback is untested in a browser).

### Round 1 rework, 2026-11-06

Commits: `9609d79` (code, tests, README) and the closing commit (this entry).

Owner's decision on the HIGH finding: option (b), "/auto 64 b". The galley's orientation stays the facing in the Drawn view (no arrowheads).

Resolutions:
- **HIGH (Placement facing).** `PlacementScene.drawPlacedUnits` passes `facing` for ships, so placed galleys are drawn at their real facing in both views (Standard ignores it, unchanged). The staged ship rides on `setFacingIndicators`: `shipArrowList` marks the pending entry with `ghostTypeId` (new `FacingShip` type and pure `ghostDrawing` in `boardView.ts`, provisional id `ghost-ship`). The Drawn view draws it as a 50% alpha figure outside its unit map (`DrawnUnits.setGhost`), rebuilt on every call so it follows Turn and goes when the facings are cleared on confirm or cancel. Standard still draws its arrow. The recorder replays the entry, so a toggle mid-staging keeps the ghost. README section updated for Placement.
- **MEDIUM (X1, X2).** New dev-hook reader `boardObjects()` returns `{ unitDrawings, hudLeaks, ghostRotation }` (zeros and null in Standard), from `MapView.drawnInspect()`. `board-view.spec.ts` asserts `unitDrawings` equals the living units and `hudLeaks` is 0 after each toggle to Drawn with a unit selected. The new Placement scenario checks the ghost exists, one Turn changes its rotation by pi/3, and it is gone after Confirm.
- **LOW (Progress counts).** The Phase 1 line "before: 69 files, 1236 tests; +8 files, +41 tests" is wrong. `main` had 67 test files and 1223 tests; Phase 1 ended at 77 files, 1277 tests (+10 files, +54 tests).
- **LOW (dead 1x fallback).** Kept the branch, fixed the comment on `maxTextureSide`: the game runs `Phaser.CANVAS`, so it returns 4096 and the bake is 2x today.
- **LOW (stale install in main checkout):** not mine to act on; noted only.

Numbers: `npm run verify` green: 77 test files, 1279 tests (+2: `ghostDrawing`), lint 21 warnings (cap 21, unchanged). `npm run e2e`: 20 passed (19 + the Placement scenario).

Mutants, each applied to `src/ui/MapView.ts` by copy and restored by copy, one-line deletion confirmed by `git diff --stat`:
- X1 (`this.drawing.replay(next);` deleted): killed, `board-view.spec.ts` "the view toggle keeps state, camera and selection..." (unitDrawings 0).
- X2 (`this.uiCamera?.ignore(next.mapObjects());` deleted): killed by the same test (hudLeaks > 0) and by the Placement ghost scenario.

Divergence: none from the plan above the Progress marker. `boardObjects()` also carries `ghostRotation`, which the finding did not list.
