<!-- generated-by: heraklios/konmari@0.1.0 -->
# §77 KonMari record

outcome: kept
base: ac6bf5e

## Tidied
- 4a79157 — src/ui/hexDraw.ts — removed the dead `alpha` parameter of `drawFacingArrowhead` and `drawArrowheadAt` and its stale doc ("a dimmed ship's arrow"). The merge of §76 removed the only caller that passed it (main's `standardBoardView.ts:250`), so both always drew at 1. Fill and outline now use the constants 1 and 0.9. The drawing is unchanged. This retires the review's equivalent mutants H1 to H3, since their lines are gone.
- 38a5321 — src/scenes/PlacementScene.ts — reworded `shipArrowList`'s stale doc, which said other seats' arrows are dimmed. The file stays at 526 lines, its ceiling, so `scripts/size-baseline.json` is untouched.

## Looked at and left
- `src/ui/heldDriftArrow.ts`, `src/ui/standardUnits.ts`: each has one job (principle 12), and both views share them, with no copy left in either view.
- `src/ui/placementDrawings.ts` `placementFacingShips` still lists every placed ship, but the views draw only the ghost (the review's P7, LOW). Trimming the list touches the scene's and BoardScene's ship lists, which goes beyond a tidy-up. It is the review's follow-up.
- `src/ui/unitLayer.test.ts`'s `unitAlpha` mock ignores its argument (U3, U4 survive). Fixing it is a test change, out of scope by the brief.

## Proposed refactor intents
- Send only the staged ship to `setFacingIndicators`: reduce `placementFacingShips` and BoardScene's `renderAllUnits` ship list to the ghost (the review's P7 and "BoardScene ships" follow-ups).
