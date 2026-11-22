<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §76 plan — Placement shows the armies other players have already placed

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (accepted 2026-11-22: B1-B10, I1-I3, AC1-AC7, A1-A6)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

When a seat's Placement opens, the board shows every unit already in
`session.gameState.units`: the placing seat's own at full opacity, every other
seat's (human or computer, all of them earlier seats, I3) dimmed to
`DIMMED_UNIT_ALPHA = 0.6` in both views, ships with their facing (Drawn: the
turned galley; Standard: a dimmed arrowhead in the owner's colour). The dim
survives view toggles, placements, ship staging, undo and redo (B3). Clicks on
those units still do nothing (B4, B5: unchanged legal-hex and occupied checks),
undo/redo still touch only the placing seat (B6), and the tooltip now agrees
with what is drawn (B7). The Board never sets the flag (B10). The drawing list
moves out of `PlacementScene` into a pure, tested `src/ui` helper, so the scene
shrinks below its 548-line ceiling.

## Risks

- **Tests that pass whatever the code does.** The alpha itself is applied in
  Phaser code (`drawnUnits.ts`, `standardBoardView.ts`) that no unit test
  reaches, and the dev hook has no alpha reader (and may not get one: §75 owns
  `devHook.ts`). A mutation of `settle` back to `setAlpha(1)`, or of
  `makeMarker` dropping the alpha, is caught only by the live check (AC7).
  The pure parts are pinned: `unitAlpha`, the `dimmed` flag on every drawing
  (helper tests), `reconcileUnits` recreating on a flag change, and the replay
  keeping it. The e2e's B5 assertion (no legal hex within 3 of a seat-0 unit)
  also passes on today's code, because the legal-hex code is unchanged; it is
  a regression guard, not proof of new behaviour. The e2e's real new
  assertions are the seat-0 units being drawn (`unitDrawings`,
  `unitCanvas(<seat-0 id>)`) from the first frame and through undo/redo.
- **Interaction with §77 (Standard view animations), being planned in
  parallel.** Both touch the alpha a unit settles at and the Standard ship
  arrows:
  - §76 changes `drawnUnits.ts:163` from `.setAlpha(1)` to
    `.setAlpha(unitAlpha(entry.drawing))`, and adds the same call where `make`
    builds the container (`:201`). The intended alpha comes from the drawing
    (`UnitDrawing.dimmed`, read through `unitAlpha` in `boardView.ts`), so it
    is a one-expression, local change. §77's plan is told to settle each unit
    at its intended alpha rather than a hard 1.
  - §77 animates the Standard markers (fades) and makes the ship arrows travel
    with their counters, so `standardBoardView.ts`'s `makeMarker` and
    `setFacingIndicators` (`:141-169`, `:244-251`) may be restructured there.
  - **Whichever merges second rebases:** if §77 is first, apply
    `unitAlpha(drawing)` in its Standard settle/fade-end path and to its
    per-ship arrow, not only in today's `makeMarker`; if §76 is first, §77's
    settle must use `unitAlpha` (already exported) instead of 1. The review of
    the second one checks this. `drawnMotions.ts:74`'s fade starts from 1;
    Placement never animates (A5), so it is left alone here.
- **Stale line citations.** Every `path:line` below was read at `9eeb49a`.
  §77, §75 and §78 are moving `src/ui` files; the implementer re-reads each
  cited line before editing, and a rebase onto a newer `main` re-checks them.
- **Lint cap (19).** `drawFacingArrowhead` goes from 5 to 6 parameters (limit
  7). The helper's functions are short. No function grows near 80 lines. The
  cap stays 19; if a removed warning drops the count, lower the cap in the same
  commit.
- **Size ceiling.** `PlacementScene.ts` shrinks (about 548 → ~522). The
  budget check fails a file *under* its ceiling (`size-budget-lib.mjs:104-105`,
  rule 5), so the subtask that shrinks it also runs
  `npm run size:baseline -- --write` and commits the lowered ceiling. If §77
  or another branch also rewrites `scripts/size-baseline.json`, the second to
  merge re-runs `--write` after the rebase.
- **Removing `placedShips`.** The own-ship arrow list is today kept in a
  scene field (`PlacementScene.ts:59-64`) and in each snapshot (`:36`). This
  plan derives it from state instead (the facing in state is exactly what was
  confirmed: `deployUnit` stores `facing` at `deployment.ts:329`). A mistake
  would show as a missing or stale own arrow after undo/redo in the Standard
  view; `placement.spec.ts` and `board-view.spec.ts`'s ghost scenario keep
  covering ship staging and confirmation, and the helper tests pin the list.
- **Drift-machine fall-through:** not applicable, no engine change.

## Verified against the codebase

Re-read on `main` at `9eeb49a` (code identical to the spec's `199dea4`
check; the only commit since touches `intents/79-*/metadata.yml`).

- `src/scenes/PlacementScene.ts` — 548 lines (`wc -l`).
- `PlacementScene.ts:2` — `import { MapView, drawFacingArrowhead, unitTooltipFor } from '../ui/MapView';`
- `PlacementScene.ts:20` — `import type { FacingShip } from '../ui/boardView';`
- `PlacementScene.ts:33-37` — `PlacementSnapshot { state; queue; placedShips }`.
- `PlacementScene.ts:59-64` — the `placedShips` field and its comment ("Ships placed so far by the CURRENT player, for the facing-arrow overlay. Reset in `create`…").
- `PlacementScene.ts:112-121` — `skipAiPlacementSeats(session.gameState!, this.playerIndex)`, then `this.placedShips = [];`, `this.pendingShip = null;`, `this.history.clear();`.
- `PlacementScene.ts:126-128` — `enemyHexes` = units with `u.owner !== this.playerIndex`; `legalDeploymentHexes`/`legalNavalDeploymentHexes` from them.
- `PlacementScene.ts:140-142` — `new MapView(...)`; `unitTooltipAt = (hex) => unitTooltipFor(session.gameState!, hex, { state: false })`.
- `PlacementScene.ts:291-294` — end of `create`: `refreshPlacementHighlight`, `updateInfo`, `refreshUndoRedoButtons`, `refreshShipControls`; no unit drawing.
- `PlacementScene.ts:297-313` — `captureSnapshot`/`restoreSnapshot` (copy `placedShips` at `:301`, `:308`; `restoreSnapshot` calls `redrawPlacedUnits` at `:309`).
- `PlacementScene.ts:315-328` — `drawPlacedUnits`: "Draws only this player's placed units (a choice of this scene, not a rule: the rules hide nothing, §74 spec amendment) from state."; filter `u.owner === this.playerIndex` (`:318`); naval facing (`:326`); `'snap'` with "// Placement never animates (§66 B13)" (`:327`).
- `PlacementScene.ts:330-335` — `redrawPlacedUnits` comment "Only this player's units are drawn, matching what `tryPlace` renders as you go."; calls `drawPlacedUnits` and `setFacingIndicators(this.shipArrowList())`.
- `PlacementScene.ts:418-425` — `tryPlace` returns on a non-legal hex (`:422`) and on an occupied hex of any owner (`:424-425`).
- `PlacementScene.ts:447` — `this.drawPlacedUnits();` after a land placement.
- `PlacementScene.ts:455-465` — `shipArrowList`: `this.placedShips` mapped with `playerIndex: this.playerIndex`, plus the pending ship with `ghostTypeId`.
- `PlacementScene.ts:506-509` — `confirmPendingShip`: `drawPlacedUnits()`, `this.placedShips.push(...)`, `pendingShip = null`, `setFacingIndicators(this.shipArrowList())`.
- `PlacementScene.ts:538-546` — `finishPlayer`: `setUnits([], 'snap')`, then `scene.start('Placement', { playerIndex: nextIndex })` or `'Board'`.
- `src/ui/boardView.ts:12-18` — `UnitDrawing { id; typeId; owner; position; facing? }`.
- `boardView.ts:26-31` — `FacingShip { hex; facing; playerIndex; ghostTypeId? }`.
- `boardView.ts:37-41` — `ghostDrawing(ships)` builds the ghost drawing from the `ghostTypeId` entry.
- `boardView.ts:104-109` — `UnitUpdate.recreate`: "True when the type or owner changed".
- `boardView.ts:124-139` — `reconcileUnits`; `:134` `const recreate = old.typeId !== unit.typeId || old.owner !== unit.owner;`. The file imports Phaser as a type only (`:1`), so it is unit-testable (`boardView.test.ts` imports it).
- `src/ui/drawnUnits.ts:5` — `import { reconcileUnits } from './boardView';`
- `drawnUnits.ts:18` — `const GHOST_ALPHA = 0.5;`; `:109` `this.make(drawing).setAlpha(GHOST_ALPHA)`.
- `drawnUnits.ts:126-156` — `setUnits`: `'snap'` → `animator.finishAll()`; recreate → `make`; plain update → `settle` when no steps.
- `drawnUnits.ts:158-165` — `settle`: "Puts one unit's container on its drawing: position, facing, opaque."; `:163` `entry.container.setPosition(at.x, at.y).setAlpha(1);`
- `drawnUnits.ts:168-171` — `settleAll` settles every unit (called when the animator drains or is finished).
- `drawnUnits.ts:192-204` — `make`; `:201` `scene.add.container(at.x, at.y, [base, fig]).setDepth(10).setName(unit.id)`.
- `src/ui/drawnBoardView.ts:74-79` — `setFacingIndicators` only draws the ghost (`ghostDrawing(ships)`); other entries are ignored.
- `src/ui/drawnMotions.ts:72-74` — the `fade` motion: `c.setAlpha(1 - progress(t, motion.ms))`.
- `src/ui/standardBoardView.ts:6` — imports `drawFacingArrowhead` from `./hexDraw`; `:7-8` imports `reconcileUnits` and types from `./boardView`.
- `standardBoardView.ts:106-131` — `setUnits`: recreate → `makeMarker`; plain update only moves.
- `standardBoardView.ts:141-169` — `makeMarker`: image (`:147`) or text chip (`:153-163`), no alpha set.
- `standardBoardView.ts:244-251` — `setFacingIndicators`: `drawFacingArrowhead(this.facingGraphics, center, facing, colorHex)` per ship.
- `src/ui/hexDraw.ts:15-21` — `drawFacingArrowhead(graphics, center, facing, colorHex, scale = 1)`; `:37-39` `fillStyle(color, 1)`, `lineStyle(1.5, 0x1a1408, 0.9)`.
- Other `drawFacingArrowhead` callers (unchanged by a defaulted alpha): `standardBoardView.ts:270`, `drawnOverlays.ts:79`, `BoardScene.ts:1725-1726`, `PlacementScene.ts:486-487`; re-exported by `MapView.ts:15`.
- `src/ui/viewDrawingState.ts:30-32` — `setUnits` keeps `[...units]`; `:60-62` keeps `[...ships]`; `:95-110` `replay` re-issues them as given.
- `src/ui/MapView.ts:306-311` — `setUnits` forwards the same list to `ViewDrawingState` and the current view.
- `src/scenes/BoardScene.ts:908-920` — `renderAllUnits` builds drawings and ships without any flag. Not touched (B10).
- `src/ui/aiSetup.ts:60-70` — `skipAiPlacementSeats` deploys AI seats in index order via `autoPlaceSeat`.
- `src/engine/deployment.ts:172-183` — boxed-in fallback comment and `excludeTooClose` ("the gap constraint is dropped rather than returning an empty, unplaceable set").
- `deployment.ts:298`, `:315-317`, `:329` — `deployUnit`; refuses an occupied hex (`kind: 'occupied'`); stores `facing: naval ? facing! : 0`.
- `deployment.ts:367` — `autoDeploy(state, playerIndex, selection, rng)`.
- `src/engine/state.ts:41` — `Unit.destroyed: boolean`.
- `src/ui/devHook.ts:168-174` — `PLACEMENT_MEMBERS = ['queue', 'currentLegalHexes']`: the hook does not read `placedShips`, so removing it needs no hook change. `:199-203` `mapScene()` finds the Placement scene too, so `boardObjects()`, `unitCanvas()` and `tooltipText()` work in Placement; `:41`/`:46` `unitDrawings`; `:81` `placement()`.
- `src/ui/shortcutKeys.ts:10-17` — Ctrl+Z undo, Ctrl+Shift+Z redo (and Ctrl+Y), bound in Placement at `PlacementScene.ts:266`.
- `e2e/board-view.spec.ts:33-39` — `expectDrawnObjects(page, label)`, a local function (living units = `unitDrawings`, `hudLeaks` 0); used at `:57`, `:91`, `:129`, `:156`.
- `e2e/placement.spec.ts:39-51` and `e2e/unit-tooltip.spec.ts:82-94` — the "Menu 2, default army ×2, Placement" route; `unit-tooltip.spec.ts:15-22` `tooltip`/`hoverLines`.
- `e2e/helpers.ts:177-196` — `clickHex` and `hoverHex` centre the camera first.
- `src/ui/i18n/en.ts:141` — `donePlacing: 'Done placing'`; `:90-94` seat labels (`'Human'`, `'AI — normal'`, …).
- `README.md:91-96` — the Placement step; `README.md:155-159` — "In Placement, hovering also shows earlier players' placed units that are not drawn on the screen (the rules hide nothing)."
- `docs/research/05-rules-french-original.md:91-96` — the placement passage quoted in the spec.
- `scripts/size-baseline.json` — `"src/scenes/PlacementScene.ts": 548`, `"src/scenes/BoardScene.ts": 3172`; `scripts/size-budget-lib.mjs:104-105` fails a file under its ceiling.
- `package.json:12` — `eslint . --max-warnings 19`.

## Where this goes

- **Modules touched:**
  - `src/ui/boardView.ts` — `dimmed?: true` on `UnitDrawing` and `FacingShip`;
    `DIMMED_UNIT_ALPHA = 0.6` with the I1 comment; pure
    `unitAlpha(d: { dimmed?: true }): number`; `reconcileUnits` recreates on a
    flag change (doc comments of `UnitUpdate` and `reconcileUnits` updated).
  - `src/ui/drawnUnits.ts` — `make` sets the container's alpha to
    `unitAlpha(unit)`; `settle` (`:163`) sets `unitAlpha(entry.drawing)`
    instead of 1, its doc saying "at its drawing's alpha". Nothing else.
  - `src/ui/standardBoardView.ts` — `makeMarker` sets `unitAlpha(unit)` on the
    marker; `setFacingIndicators` passes `unitAlpha(ship)` to
    `drawFacingArrowhead`.
  - `src/ui/hexDraw.ts` — `drawFacingArrowhead` gains a last parameter
    `alpha = 1`: fill at `alpha`, outline at `0.9 * alpha`. Callers that pass
    nothing draw exactly as today.
  - `src/scenes/PlacementScene.ts` — calls the new helper; draws units and
    arrows at the end of `create`; drops `placedShips`; comments per B9.
  - `README.md` — B9's two edits.
  - `scripts/size-baseline.json` — PlacementScene's ceiling lowered by
    `npm run size:baseline -- --write`.
  - Tests: `src/ui/boardView.test.ts`, `src/ui/viewDrawingState.test.ts`;
    e2e: `e2e/helpers.ts` (gains `expectDrawnObjects`, moved from
    `board-view.spec.ts`, which then imports it).
- **New modules:**
  - `src/ui/placementDrawings.ts` — "What Placement draws: every living unit
    in state (other seats' dimmed) and every placed ship's facing arrow plus
    the staged ghost." Exports `placementUnitDrawings(state, playerIndex)` and
    `placementFacingShips(state, playerIndex, pending)`. Carries the I2 and I3
    comments in its doc.
  - `src/ui/placementDrawings.test.ts` — AC1, AC2.
  - `e2e/placement-earlier-armies.spec.ts` — AC4.
- **Why there:** which drawings are dimmed is presentation, not a rule
  (principle 5), so it is `src/ui`, not `src/engine`; it is pure (type imports
  plus `data/units`'s `getUnitType` and `engine/state` types), so it is unit-
  tested (principle 15), and it keeps new work out of a scene over 500 lines
  (principles 12, 13). Dependencies point `scenes → ui → engine/data`
  (principle 2). The alpha value and the function that reads it live once, in
  `boardView.ts`, the view seam both views already import (principle 6); no
  view keeps its own copy. `BoardScene.ts` is not touched (B10).
- **Budget lines:** none. `PlacementScene.ts` shrinks (about −26 lines) and
  its ceiling is lowered; `BoardScene.ts` is untouched; no new file passes 500.

## Subtasks

Each ends with `npm run verify` green and a commit.

1. **The view seam (B2, B3, AC3).** In `boardView.ts` add `dimmed?: true` to
   `UnitDrawing` and `FacingShip`, `export const DIMMED_UNIT_ALPHA = 0.6` with
   the I1 comment ("Dimmed, owner colour kept: the colour says whose army, the
   alpha says not yours to move here; an outline would differ between counter
   and figure, a desaturated colour could collide with another hue. More solid
   than the staged ghost's 0.5. Spec §76 I1, A1"), and
   `export function unitAlpha(d: { readonly dimmed?: true }): number`.
   In `reconcileUnits`, `recreate` also when `old.dimmed !== unit.dimmed`.
   Tests in `boardView.test.ts` and `viewDrawingState.test.ts` (see Tests).
2. **Both views apply it (B2, B3).** `hexDraw.ts`: `alpha = 1` parameter.
   `standardBoardView.ts`: `makeMarker` ends with `marker.setAlpha(unitAlpha(unit))`
   (both the image and the text chip); `setFacingIndicators` passes
   `1, unitAlpha(ship)` (destructure the ship whole). `drawnUnits.ts`: `make`
   chains `.setAlpha(unitAlpha(unit))` on the container (the ghost keeps
   overriding with `GHOST_ALPHA` at `:109`); `settle` uses
   `unitAlpha(entry.drawing)`. No other line in these files changes (see
   Risks, §77). Until subtask 3 nothing sets the flag, so the game is
   unchanged; e2e unaffected.
3. **The helper (B1, B2, B8, I2, I3, AC1, AC2).** New
   `src/ui/placementDrawings.ts`:
   - `placementUnitDrawings(state, playerIndex)`: every unit with
     `!u.destroyed`, in state order, as
     `{ id, typeId, owner, position, facing: naval ? u.facing : undefined }`,
     plus `dimmed: true` only when `u.owner !== playerIndex` (no
     `dimmed: undefined` key).
   - `placementFacingShips(state, playerIndex, pending)`: one entry per living
     naval unit, `{ hex: position, facing, playerIndex: owner }` plus
     `dimmed: true` for another seat's, then the pending ship, if any, as
     `{ hex, facing, playerIndex, ghostTypeId: typeId }` (never dimmed).
     `pending` is typed `{ hex: HexCoord; facing: number; typeId: string } | null`,
     the shape of `PlacementScene.pendingShip`.
   - Doc: I3 ("not owned by the placing seat" = earlier seat: Placement and
     `skipAiPlacementSeats` run in index order; same test as the scene's
     `enemyHexes`), I2 (an earlier unit's hex is kept out of the band by the
     4-hex gap; in the boxed-in fallback it may show green, and `tryPlace`
     and `deployUnit` still refuse the occupied hex; occupied hexes are not
     taken out of the highlight, which would un-green the seat's own units),
     and the rules hiding nothing (`05-rules-french-original.md:91-96`).
   - `src/ui/placementDrawings.test.ts` (see Tests).
4. **The scene uses it (B1, B3, B4, B6, B8, B9).** In `PlacementScene.ts`:
   - import `placementFacingShips`, `placementUnitDrawings`;
   - `drawPlacedUnits` becomes one `setUnits(placementUnitDrawings(session.gameState!, this.playerIndex), 'snap')`
     (keep "Placement never animates (§66 B13)"), with a doc comment per B9:
     it draws every placed unit, other seats' dimmed; the rules hide nothing
     (`05-rules-french-original.md:91-96`);
   - `shipArrowList` returns `placementFacingShips(session.gameState!, this.playerIndex, this.pendingShip)`;
   - remove `placedShips` (field and comment `:59-64`, snapshot field `:36`,
     reset `:119`, copies `:301`/`:308`, push `:507`);
   - `redrawPlacedUnits`'s comment (`:330-331`) says it rebuilds every seat's
     units and arrows from state (on open, undo, redo);
   - call `this.redrawPlacedUnits()` at the end of `create` (after the
     `mapView` and the queue exist), so the first frame shows earlier seats
     (B1, B8).
   - Then `npm run size:baseline -- --write` and commit the lowered ceiling with
     the scene change (otherwise `check:intent` fails rule 5).
5. **e2e (AC4).** Move `expectDrawnObjects` from `board-view.spec.ts` to
   `e2e/helpers.ts` (exported, unchanged body) and import it back. New
   `e2e/placement-earlier-armies.spec.ts`: Menu "2", "Use default army" +
   "Confirm army" ×2; in seat 0's Placement, place two land units (first free
   legal hex, as `placement.spec.ts:19-25`), press **Done placing**; wait for
   seat 1's Placement (`placement().legalHexes` changes, or the title). Then:
   - no `placement().legalHexes` hex has `hexDistance` ≤ 3 to a seat-0 unit
     (`hexDistance` from `src/engine/hex`);
   - `clickHex` on a seat-0 unit's hex: `state().units.length` unchanged;
   - `hoverHex` on it: `tooltipText()` lines are the hex line, seat 0's
     name/owner/colour line, the values line, and nothing more (3 lines; no
     state line);
   - toggle to the Drawn view (click `'🗺 Drawn view'`, wait for
     `boardView() === 'drawn'`, two frames): `expectDrawnObjects` passes
     (seat 0's units counted) and `unitCanvas(<seat-0 id>)` is not null;
   - seat 1 places one land unit, Ctrl+Z: both seat-0 units still in
     `state()`, `expectDrawnObjects` still passes, seat 1 has 0 units;
     Ctrl+Y: seat 1's unit is back, seat-0 units unchanged;
   - `collectErrors` is empty.
   Run `npm run e2e` alone (nothing else heavy at the same time).
6. **README (B9, AC6).** `README.md:158-159`: drop "that are not drawn on the
   screen" ("In Placement, hovering also shows earlier players' placed units
   (the rules hide nothing)." or equivalent). Placement step (`:91-96`): add
   that the armies of the seats that already placed (human or computer) are
   shown dimmed, can't be moved, and their 4-hex gap shapes the green band.
   Set `status: in-review` in `metadata.yml` last (the implementer's only
   metadata edit).

## Tests

| Behaviour | Test | The mutation it catches |
| --- | --- | --- |
| B1/AC1 every living unit drawn | `placementDrawings.test.ts`: a state with seat 0 and seat 1 units and one destroyed unit gives one drawing per living unit, in state order | dropping the `!destroyed` filter; filtering by owner as today (`u.owner === playerIndex`) |
| B2/I3 other seats dimmed, own not | same file: for seat 1, every seat-0 (and, in a 3-seat state, seat-0 and seat-1 for seat 2) drawing has `dimmed: true`, every own drawing has `dimmed` undefined | `!==` → `===`; dimming everyone; dimming no one |
| AC1 facing | same file: a ship keeps `facing`, a land unit has `facing` undefined | always/never passing facing |
| B8/AC1 computer seat | same file: `createInitialState` with 2 players, `autoDeploy(state, 0, defaultArmySelection(...), createSeededRng(1))`, read for seat 1: one drawing per seat-0 unit, all dimmed, count > 0 | a helper that only reads units added in this scene |
| B2/AC2 arrows | same file: `placementFacingShips` lists every living naval unit of every seat (no land unit), `playerIndex` = owner, earlier seat's `dimmed: true`, own undimmed | own ships only (today's `placedShips`); land units included; wrong `playerIndex` |
| AC2 ghost | same file: with a pending ship, the last entry carries `ghostTypeId` and the placing seat, no `dimmed`; with `null`, no ghost entry | ghost dimmed; ghost dropped |
| AC3 alpha | `boardView.test.ts`: `unitAlpha({})` is 1; `unitAlpha({ dimmed: true })` is `DIMMED_UNIT_ALPHA`; `DIMMED_UNIT_ALPHA` is in [0.4, 0.75] (AC7's range) | returning 1 always; a constant of 1 |
| AC3 reconcile | `boardView.test.ts`: dimmed ↔ undimmed (both ways) is an `update` with `recreate: true`; the same flag twice gives no work | ignoring the flag (a view keeping a stale alpha) |
| B3/AC3 replay | `viewDrawingState.test.ts`: after `setUnits` with a dimmed drawing and `setFacingIndicators` with a dimmed ship, `replay` hands both on with `dimmed: true` | a replay that rebuilds drawings without the flag |
| B1, B4, B5, B6, B7, AC4 | `e2e/placement-earlier-armies.spec.ts` (subtask 5) | drawing only the placing seat (unitDrawings < living); not drawing on open (count before any click); undo/redo dropping or duplicating seat-0 units; a click on a seat-0 hex placing something |
| B3 settle/make alpha, Standard arrows, B10 | Live check (AC7); no unit test reaches Phaser objects and no hook reader exists (spec "Dev hook") | `settle` back to 1; `makeMarker` without alpha |
| B10 | `git diff main -- src/scenes/BoardScene.ts` empty (review, AC5); `board-view.spec.ts`, `board-animations.spec.ts` stay green | — |

Existing tests that must stay green unchanged: `placement.spec.ts` (ship
staging and Turn, now drawn from state), `board-view.spec.ts`'s Placement
ghost scenario (a seat-0-only Placement, so no dimmed units), `unit-tooltip.spec.ts`
F7, `boardView.test.ts`'s existing `reconcileUnits` cases (no flag on either
side → unchanged).

## Validation

Run one heavy command at a time (memory on this machine):

1. `./node_modules/.bin/tsc --noEmit`
2. `npm run verify` (build + lint at cap 19 + vitest)
3. `npm run check:intent` → PASS (size: PlacementScene under its old ceiling
   with the lowered baseline committed; no budget line needed)
4. `npm run e2e` (stop any dev server on 5232 first) — the new scenario,
   `placement.spec.ts`, `board-view.spec.ts`, `board-animations.spec.ts`,
   `unit-tooltip.spec.ts` all pass.
5. `git diff main -- src/scenes/BoardScene.ts src/ui/devHook.ts` is empty.

**Live check (owed: rule 1, `src/scenes/**` and `src/ui/**`, and visual;
the smoke-suite exception does not apply).** `npm run dev` (the worktree's
port) →
- Menu "2", default armies, seat 0 places a few land units and both ships,
  Done placing. In seat 1's Placement, Standard view: seat 0's counters are
  there from the first frame, dimmed (0.6), owner colours kept; seat 0's ships
  have a dimmed arrowhead in seat 0's colour. Judge whether 0.6 reads well
  (0.4-0.75 may be set without a spec amendment).
- Toggle to Drawn and back: still dimmed. Place a unit, stage a ship, Turn,
  Cancel, stage again, Confirm, Undo, Redo: seat 0's units stay dimmed and in
  place; seat 1's own units are opaque; the staged ghost (0.5) is told apart
  from seat 0's dimmed galleys; seat 0's galleys point their facing.
- Click a seat-0 unit: nothing happens. Hover it: name/values, no state line.
- New game with the first seat set to an "AI — …" level on the Menu
  and the second seat human: the human's Placement opens with the computer's army
  shown, dimmed.
- Finish placement: on the Board, every unit is at full opacity in both views
  and the ship arrows are as before.

## Assumptions I made

- **`placedShips` is removed and the own-ship arrows come from state** (beyond
  the spec, which only asks the helper to give "every placed ship of every
  seat"). Keeping the field would leave two sources for the same arrows
  (principle 6) and would cost lines the scene doesn't have. The facing in
  state is the confirmed facing (`deployment.ts:329`), and undo/redo restore
  state, so the arrows follow.
- **The arrowhead's outline is dimmed with its fill** (`0.9 * alpha`), so a
  dimmed arrow has no full-strength outline. The spec says only "at the same
  alpha".
- **The marker's alpha is set in `makeMarker` and the Drawn container's in
  `make` and `settle`**, as the spec's Non-functional names. A flag change
  recreates the object (via `reconcileUnits`), so a plain-move update never
  needs to touch alpha in the Standard view.
- **`placementUnitDrawings` filters `destroyed` units** (AC1 says "every
  living unit"); in Placement none are destroyed, so this changes nothing on
  screen.
- **`expectDrawnObjects` moves to `e2e/helpers.ts`** so the new scenario can
  use it "via the existing" helper (AC4); its body is unchanged.
- **The e2e lives in its own file** (`e2e/placement-earlier-armies.spec.ts`),
  which the spec allows, so `placement.spec.ts` keeps its one §40 scenario.
- **`blocked_by: 74` is satisfied** (§74 merged as `e80f74a`, spec A6); the
  metadata line is left for the coordinator.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-22 - implementation (subtasks 1-6)

- Commits: view seam + both views' alpha; `placementDrawings` helper and tests;
  scene change with size ceiling 548 -> 526 (`PlacementScene.ts` 548 -> 526
  lines); e2e + README + this entry.
- Shipped as planned: `dimmed` flag, `DIMMED_UNIT_ALPHA = 0.6`, `unitAlpha`,
  `drawFacingArrowhead` alpha parameter, `placementUnitDrawings` /
  `placementFacingShips`, `placedShips` removed (arrows derived from state),
  `redrawPlacedUnits()` at the end of `create`. `BoardScene.ts` and
  `devHook.ts` untouched.
- Tests: vitest 97 files, 1681 passed, 2 skipped (includes the new
  boardView, viewDrawingState and placementDrawings cases); e2e 32 passed.
  Lint 19 warnings, cap stays 19 (the `create` length warning remains).
- Divergence: the e2e counts seat-0 figures in the Drawn view only
  (`boardObjects().unitDrawings` is 0 in the Standard view), so it toggles to
  Drawn before the first `expectDrawnObjects`. Standard-view drawing of the
  earlier units, and the alpha itself, are covered by the live check.
