<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §88 plan — The game canvas takes the browser window's width when the game starts

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

At startup the game reads the width `#app` offers. The canvas is that wide,
never under 1100, and 750 tall (spec B1–B4). Board and Placement then show
more map through the `MapView` code that already lays out from
`this.scale.width` (B5). The right-edge HUD already follows the canvas width
(B6). The army builder is offset as one 1100-px block into the middle (B7).
Nothing changes at 1100, so the existing e2e suite at its pinned 1100 × 750
viewport is the proof (AC4). A new scenario at 1600 × 750 proves the wide case
(AC3).

## Risks

- **A hard-coded x that should follow the edge.** The survey below found
  none outside the army builder. A position added by an in-flight intent
  (§83's end-move warning, §73's Board changes) could add one. The
  implementer re-runs the survey greps on its branch before the last commit.
- **Tests that pass whatever the code does.** At 1100 the army-builder
  offset is 0, so a test only at 1100 proves nothing. AC2 tests a wider
  width with exact numbers. The e2e at 1600 asserts numbers that differ from
  the 1100 values (canvas 1600 not 1100; view centre x 950 not 700).
- **Reading the width.** `#app` is `100vw` and `100vh`. If `clientWidth`
  reads 0 because the script runs before layout, the game would silently
  stay at 1100. `main.ts` runs as a module script after `<div id="app">`, so
  layout exists; `window.innerWidth` is the fallback (spec B1). AC3 fails if
  the width isn't picked up.
- **Stale line citations.** The lines below are from `main` at `25a5240`.
  §73 and §83 are in flight on the same files and will move them.
- **The lint cap.** No new warning. `main.ts` stays tiny, and the new helper
  is one small function.
- **The fixed 1100 × 750 viewport comment** in `playwright.config.ts:29`
  ("The game's own size (1100×750); the HUD is laid out for it.") becomes
  half-true. Reword it to "the default size", and leave the viewport itself
  unchanged.

## Verified against the codebase

Re-read on `main` at `25a5240`.

- `src/main.ts:8-15` — `const config … { type: Phaser.CANVAS, parent: 'app', width: 1100, height: 750, backgroundColor, scene: [...] }`.
- `index.html` — `#app { display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; }`, `html, body { overflow: hidden }`, and the `<script type="module" src="/src/main.ts">` after `<div id="app">`.
- `src/ui/MapView.ts:82` — `constructor(scene, viewportWidth, viewportHeight, leftPanelWidth = 0)`.
- `src/ui/MapView.ts:101-104` — `availableWidth = viewportWidth - leftPanelWidth` and `originX = leftPanelWidth - minX + Math.max(margin, (availableWidth - boardWidth) / 2)`.
- `src/ui/MapView.ts:142` — `mainCam.setViewport(leftPanelWidth, 0, availableWidth, viewportHeight)`.
- `src/ui/MapView.ts:279` — the HUD camera is `cameras.add(0, 0, this.viewportWidth, this.viewportHeight)`.
- `src/ui/MapView.ts:425` — the tooltip flips at `this.viewportWidth`.
- `src/scenes/BoardScene.ts:613-615` — `const { width, height } = this.scale; … new MapView(this, width, height, PANEL_WIDTH)`.
- `src/scenes/PlacementScene.ts:116,133` — the same, `new MapView(this, width, height)`.
- `src/scenes/PlacementScene.ts:125,147,159,203,216,234,247,465-466` — the title at `width / 2`, Done placing at `width - 140`, Abandon at `width - 20`, the Turn and Confirm buttons and glyphs at `width / 2 ± …`. Undo, Redo and the info text are at x 20 (left, stay).
- `src/scenes/BoardScene.ts:673,692` — the only literal-x HUD texts on the Board (160, 244). They sit inside the 300-px left panel and stay.
- `src/ui/rulesPanelLayout.ts:11,30-31` — `SIDE_PANEL_WIDTH = 300`, and `rulesPanelRect(canvasWidth)` gives `left: canvasWidth - RULES_PANEL_W - MARGIN`.
- `src/ui/rulesPanel.ts:79-81` — `snapshot()` returns `{ open, tab, highlight }` with no position. `:118` places from `rulesPanelRect(this.scene.scale.width)`.
- `src/ui/scorePanelLayout.ts:20-23` — `scorePanelRect(canvasWidth, …)` gives `left: canvasWidth - MARGIN_RIGHT - SCORE_PANEL_W`. `src/ui/scorePanel.ts:146-147` — `snapshot()` carries `left, top, width, height`.
- `src/ui/boardPrompts.ts:15-16` — `centredPromptRect(size, canvasWidth, canvasHeight)` centres on `canvasWidth / 2`.
- `src/scenes/MenuScene.ts` — every x is `width / 2 ± …`, `width - 20 - …` (`:290`, the language buttons) or relative to another button (`:239`).
- `src/scenes/GameOverScene.ts:27,38,46` — all at `width / 2`.
- `src/scenes/ArmyBuilderScene.ts:42-91,118` — the title at `width / 2`, Abandon at x 20, "use default" at `width - 20`, total and error lines at x 20 (error wrapped to `width - 40`), Confirm at `width - 20`, and rows from `armyRowSlot(index)` (`:143`).
- `src/ui/armyBuilderLayout.ts:3` — "in canvas pixels at 1100x750". `:6` `ARMY_COLUMN_X = [20, 565]`. `:40-48` `armyRowSlot(index)` builds each x from `ARMY_COLUMN_X[column] + ARMY_ROW_OFFSETS[key]`.
- `src/ui/armyBuilderLayout.test.ts:14,27,43,62` — the existing tests: row-major placement, literal offsets, "keeps the columns apart and on the canvas", and bottom controls.
- `src/ui/devHook.ts:322-325` — `viewCentre` returns `{ x: cam.x + cam.width / 2, … }` for the main camera, giving 700 at 1100 and 950 at 1600 (300 + 1300 / 2). `:291-292` — `rulesPanel` and `scorePanel` readers.
- `e2e/dev-hook-members.spec.ts` — the pinned member list. No new member is planned.
- `playwright.config.ts:29-30` — the comment, and `viewport: { width: 1100, height: 750 }`.
- `scripts/size-baseline.json` — budgeted files are `BoardScene.ts` (3169) and `PlacementScene.ts` (526), among others. Neither grows here.
- The survey greps, re-runnable: `grep -nE "\.(text|rectangle|image|sprite|graphics|zone|container)\(\s*[0-9]{3,4}\b" src/scenes/*.ts src/ui/*.ts` found only `BoardScene.ts:673,692`. A grep for the literals 1100/550/750 found only comments (`boardPrompts.ts:7`, `armyBuilderLayout.ts:3`).

## Where this goes

- **Modules touched:**
  - `src/main.ts`: reads the width and passes the size to the config;
  - `src/ui/armyBuilderLayout.ts`: an x offset for the block;
  - `src/scenes/ArmyBuilderScene.ts`: uses the offset for every x;
  - `src/ui/rulesPanel.ts`: its snapshot also returns `left`;
  - `src/ui/devHook.ts`: the `rulesPanel` reader's return type;
  - `playwright.config.ts`: the comment only;
  - `README.md`.
- **New modules:**
  - `src/ui/canvasSize.ts`: turns the width the page offers into the canvas size (pure, tested);
  - `e2e/wide-canvas.spec.ts`: the 1600-px scenario.
- **Why there:** presentation layout is `src/ui`'s, and pure layout
  arithmetic sits in small tested helpers beside it, like `boardPrompts.ts`,
  `rulesPanelLayout.ts` and `armyBuilderLayout.ts`, per the
  engine/presentation principle in `docs/architecture.md`. `main.ts` only
  wires it, and scenes only draw from it.
- **Budget lines:** none. No budgeted file grows.

## Subtasks

1. **`canvasSize.ts` and its test.**
   - `export const BASE_WIDTH = 1100, BASE_HEIGHT = 750`.
   - `export function canvasSize(availableWidth: number): { width: number; height: number }` returns `{ width: Math.max(BASE_WIDTH, Math.floor(availableWidth) || 0), height: BASE_HEIGHT }`. A NaN or 0 input gives 1100.
   - Test with AC1's values.
2. **`main.ts` uses it.**
   - Before the config: `const app = document.getElementById('app'); const { width, height } = canvasSize(app?.clientWidth || window.innerWidth);`, then `width, height` in the config.
   - Comment: read once (spec B3), no resize listener.
   - `npm run verify`, then a commit.
3. **The army builder centred (B7).**
   - In `armyBuilderLayout.ts`, add `export const ARMY_LAYOUT_WIDTH = 1100` and `export function armyLayoutOffset(canvasWidth: number): number` returning `Math.max(0, Math.floor((canvasWidth - ARMY_LAYOUT_WIDTH) / 2))`.
   - Give `armyRowSlot` a second parameter, `offsetX = 0`, added to every x.
   - In `ArmyBuilderScene.create`, `const ox = armyLayoutOffset(width)`:
     - Abandon, total and error at `ox + 20`;
     - the error wrap at `ARMY_LAYOUT_WIDTH - 40`;
     - "use default" and Confirm at `ox + ARMY_LAYOUT_WIDTH - 20`;
     - `drawRow` passes `ox` to `armyRowSlot`.
   - The title stays at `width / 2`, which equals `ox + 550`.
   - Update the header comment ("at 1100x750" becomes "an 1100-wide block, offset into the middle of a wider canvas, §88").
   - Tests per AC2, then a commit.
4. **The Tables panel's position in its snapshot.**
   - `rulesPanel.ts`'s `snapshot()` adds `left: this.bounds.left` (or the rect), and the `DevHook['rulesPanel']` type follows.
   - No new dev-hook member, so the pinned list is unchanged.
   - A commit.
5. **The e2e scenario `e2e/wide-canvas.spec.ts`.**
   - `test.use({ viewport: { width: 1600, height: 750 } })`, then start the existing 2-player test mode (`MENU_TEST`).
   - On the Board, assert:
     - the canvas `boundingBox().width` is 1600;
     - `viewCentre().x` is 950;
     - the score panel's `left + width` equals today's right margin from 1600 (the same `MARGIN_RIGHT` as at 1100, imported or read from the 1100 run);
     - with the Tables panel opened, its `left` equals `1600 - RULES_PANEL_W - MARGIN`.
   - A second test: a fresh page at 1600 goes from the Menu into the army builder (the non-test start), and asserts the canvas is 1600 and the builder opens. Its layout numbers are proved by AC2's unit test.
   - Commit.
6. **The scan for edge-bound literals.**
   - Re-run the two survey greps from "Verified" on the branch, after rebasing if `main` moved.
   - Any new literal x that should follow the edge or centre is fixed the same way (B6), with a line in Progress.
7. **Docs.**
   - `README.md`: one short paragraph where the game's screen is described. A wider window shows more map at startup, never under 1100 × 750, and a resize needs a reload.
   - `playwright.config.ts`: the comment fix.
   - Commit.

## Tests

| Behaviour | Test | What fails if it is mutated |
| --- | --- | --- |
| B1 floor and minimum | `canvasSize.test.ts`: 0, 800, 1100, 1100.9 → 1100; 1101 → 1101; 1600.7 → 1600; 3440 → 3440; NaN → 1100 | `Math.max` → identity fails 800. Dropping `Math.floor` fails 1600.7. Hard-coding 1100 fails 1600. |
| B1 height | the same test: the height is always 750 | Using the width for the height fails. |
| B1 wiring | `wide-canvas.spec.ts`: the canvas width is 1600 | Reverting `main.ts` to 1100 fails. Reading `innerHeight` fails. |
| B2, AC4 | the whole existing e2e suite at 1100 × 750, unedited | Any change at 1100 breaks a pinned scenario: `view-centre`, `rules-panel`, `score-panel`, `army-builder`. |
| B5 | `wide-canvas.spec.ts`: `viewCentre().x === 950` | The scene passing 1100 to `MapView` gives 700. |
| B6 | `wide-canvas.spec.ts`: the score panel's and Tables panel's right edges against 1600 | Placing either from a constant fails. |
| B7 | `armyBuilderLayout.test.ts`: `armyLayoutOffset(1100) === 0`, `(1500) === 200`, `(1101) === 0`, `(800) === 0`; `armyRowSlot(i, 200).x.*` equal `armyRowSlot(i).x.* + 200` for every i and key, with `centreY` unchanged; `armyRowSlot(i)` is unchanged from today (the existing literal test stays green, unedited) | Dropping the offset in `armyRowSlot` fails the 200 case. Rounding up fails 1101. A negative offset fails 800. |
| B7 in the scene | live check (AC5) | Visual. The scene only passes `ox`. |
| B3 no live resize | live check (AC5): resize the window after loading; nothing moves until a reload | — |

## Validation

- `npm run verify` green, with lint warnings not above the cap.
- `npm run check:intent` PASS.
- `npm run e2e`: the whole suite, including the new spec.
- **Live check (owed by path):**
  1. `npm run dev -- --port 5288 --strictPort --host 127.0.0.1` in the worktree, then open `http://127.0.0.1:5288/`.
  2. With the browser window about 1900 px wide:
     - the Menu is centred with no side bars;
     - start a normal 2-player game: the army builder is centred as one block, as it looks today;
     - Placement shows more map, with Done placing at the right edge;
     - on the Board the map fills the wider area (or is centred if the window is very wide), and the score and Tables panels sit at the right edge;
     - an attack's prompt is centred;
     - Game over is centred (test mode is fine for reaching it).
  3. Resize the window narrower without reloading: nothing moves. Reload: it fits the new width.
  4. With the window 1100 px or narrower, the same walk looks exactly as today.

## Assumptions I made

- **The new e2e uses test mode for the Board** (`MENU_TEST`), plus one
  start through the army builder, as other scenarios do. The army builder's
  layout is proved by unit tests on its pure layout, not by reading screen
  positions in the browser, because the dev hook has no position reader
  for it. Adding one would grow the pinned member list for one check.
- **The Tables panel reader gains a position field** rather than adding a new
  member. Changing a reader's return shape keeps the pinned member list
  unchanged.
- **The score panel's margin is read, not hard-coded, in the e2e**: from
  `scorePanelLayout.ts` if exported, else by comparing with the same reading
  at 1100 in the same spec. The implementer picks whichever needs no export
  change; both prove B6.
- **No `blocked_by`.** §73 and §83 overlap in files (BoardScene, MapView)
  but nothing here depends on them. The later merge rebases.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-24 - subtasks 1-7

Commits: 1310f31 (canvasSize, main.ts), 7722139 (army builder offset), ef59139
(Tables panel `left`, `e2e/wide-canvas.spec.ts`, README, playwright comment, UTF-8 fix of three
files I had mangled). Plus this Progress commit.

Shipped: `src/ui/canvasSize.ts` (+ test), `main.ts` reads `#app` clientWidth (innerWidth fallback)
once; `armyLayoutOffset` / `ARMY_LAYOUT_WIDTH` and `armyRowSlot(index, offsetX)`, with
`ArmyBuilderScene` offsetting every x; `RulesPanel.snapshot()` carries `left`; the new e2e (2
tests at 1600 x 750); README section "The width of the game"; playwright.config.ts comment.

Results: `npm run verify` green: 104 files, 1758 passed, 2 skipped; lint 18 warnings, cap 18
(unchanged). `npm run e2e`: 47 passed, 1 failed: `placement.spec.ts` "Turn buttons" (timed out
at 55.7 s under load); re-run alone it passed (12.0 s). Both `wide-canvas.spec.ts` tests passed.
Mutants (unit level, restored by copy): dropping `Math.max` fails 3 `canvasSize` tests, dropping
`Math.floor` fails 2, dropping the offset in `armyRowSlot` fails 1.

Deviations: (1) `rulesPanel().left` is `undefined` while the panel is closed (type `left?:
number`), so the existing `toEqual({ open: false, tab: null, highlight: null })` in
`rules-panel.spec.ts` stays unedited (AC4). (2) The e2e reads the score panel through its existing
`rect` field and compares with `scorePanelRect(1600, ...)`; the Tables margin 12 is repeated in
the spec because `MARGIN` is not exported. (3) Survey greps re-run: only BoardScene.ts:673,692
(inside the left panel) and comments; no new literal x.
