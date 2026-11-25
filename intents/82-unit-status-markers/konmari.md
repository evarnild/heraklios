<!-- generated-by: heraklios/konmari@0.1.0 -->
# §82 KonMari record

outcome: kept
base: f659280

## Tidied
- 63f2935 — `src/ui/unitDrawings.ts`, `src/ui/placementDrawings.ts` — `buildUnitDrawings` and `placementUnitDrawings` built the same base drawing (id, type, owner, position, a ship's facing) from a unit, each with its own naval test; both now use `drawingOf` and `isShip`, exported from `unitDrawings.ts` (principle 6). Placement's private `isShip` and its inline drawing literal are gone. Moved mutant lines: D6 (context → `{}`) is now `unitDrawings.ts:26`; P1/P2 (Placement adds `status`/`charged`) are now after `placementDrawings.ts:32`, the `dimmed` line. Both re-checked here against their test files: still KILLED.
- 2b8ed1c — `src/ui/devHook.ts` — the second `import type { UnitMark } from './boardView'` folded into the `GHOST_SHIP_ID` import, in the inline `type` form the neighbouring imports use.

## Looked at and left
- E11b, the naval guard in `unitStatus.ts`: equivalent (only ships ram), but it states the intent; left.
- `MapView.ts`'s one-line `unitMarks()`: cramped to keep the file under 500 after §88; left.
- The plan's Progress entry without a `### ` heading: `plan.md` is not KonMari's to edit.
- `jointFigure`'s badge in `unitLayer.ts` and `containerFigure`'s third child in `drawnUnits.ts`: each figure's own way of holding the mark, not a duplicate computation; both already share `drawStatusMark`.
- The `unitMarks()` delegators in `standardBoardView.ts` and `drawnBoardView.ts`, and `marks()` in `drawnUnits.ts`: the `BoardView` interface needs each; they are one line and hold no logic.
- `placementFacingShips`'s ship loop vs the ships list in `buildUnitDrawings`: same shape, but Placement's also appends the ghost and walks a separate pass; now both share `isShip`, and a further fold would couple two different call shapes for two lines.
- `LayerFigure.setStatus`'s `UnitDrawing['status']` vs `UnitActivity | undefined` in `unitMarkGraphics.ts`: the same type, each written in its file's own terms.

## Proposed refactor intents
- none
