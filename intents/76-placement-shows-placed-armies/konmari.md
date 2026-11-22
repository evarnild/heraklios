<!-- generated-by: heraklios/konmari@0.1.0 -->
# §76 KonMari record

outcome: kept
base: 7fcee11

## Tidied
- d15ff65 — `src/ui/placementDrawings.ts` — the review's nit: `getUnitType(u.typeId).domain === 'naval'`, written in both helpers, is now one private `isShip(u)`. Mutants M7–M11 and M14–M19 still hit the same tests (`keeps a ship facing…`, `lists every living ship…`).
- 3345d37 — `src/scenes/PlacementScene.ts` — the `pendingShip` field's inline `{ hex; typeId; facing }` type duplicated the `PendingShip` interface the diff added (whose doc says it is that field's type). The field now uses `PendingShip`. The file stays at 526 lines, so its size ceiling is unchanged.

## Looked at and left
- `boardView.ts` `unitAlpha` / `DIMMED_UNIT_ALPHA`: one definition, used by both views and the arrowhead (principle 5's one-source rule holds). Left.
- `hexDraw.ts`'s new `alpha` parameter: the positional `1` for `scale` in `standardBoardView.ts` reads oddly, but an options object would change every caller's signature. That is out of reach. Left.
- `e2e/helpers.ts` `expectDrawnObjects`: moved there from `board-view.spec.ts`, not copied. Both specs import it. Left.
- `placementDrawings.ts` uses `getUnitType(u.typeId)`, not `engine/state.ts`'s `unitType(u)`. They compute the same thing, but the file's neighbours in `src/ui` use `getUnitType`, so this is not a naming outlier. Left.
- The §77-overlap lines (`unitAlpha` and its call sites in `drawnUnits.ts` and `standardBoardView.ts`): not touched, as the coordinator asked.

## Proposed refactor intents
- `BoardScene.renderAllUnits` (`src/scenes/BoardScene.ts:908-918`) builds the same per-unit `UnitDrawing` (with ship-only facing) and the same ship `FacingShip` list from state that `placementUnitDrawings` and `placementFacingShips` build, without the dim. A `refactor` intent could give both scenes one pure helper in `src/ui` (dim as an option) and have BoardScene call it. It is not done here: it is outside this diff, in a live-check path, and BoardScene is the repo's largest file.
