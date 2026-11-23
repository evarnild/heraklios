<!-- generated-by: heraklios/konmari@0.1.0 -->
# §79 KonMari record

outcome: kept
base: 4a1979a

## Tidied
- 239833a — `src/scenes/ArmyBuilderScene.ts` — `drawRow`'s parameter type `(typeof UNIT_TYPES)[number]` becomes the existing `UnitType` from `data/units.ts`; the `armyBuilderLayout` import is one line like the file's other imports; the comment above the counter image no longer repeats `counterTextureKey`'s doc comment and keeps only what is new (Menu's preload loaded every colour).
- 5be86a9 — `README.md` — the new "Each row shows the unit's original counter" sentence is wrapped at the paragraph's width instead of one long line.

## Looked at and left
- `counterTextureKey` in `src/ui/armyBuilderLayout.ts` is a one-line alias of `hexRender.markerTextureKey`. The unit test pins it (`counter` describe, H6), and it names the builder's choice of texture (principle 15's one source of truth stays `markerTextureKey`). Removing it would change a test, so it stays.
- The exported `ARMY_*` constants and `ArmyRowX`/`ArmyRowSlot` types are used only inside the layout module. Un-exporting them is cosmetic and the review's mutant pass ran against the exported form; left.
- `addAbandonButton` is a verbatim move from `create()` (review LOW, recorded in Progress). Nothing in it duplicates other code; left.
- The row-button style literal `rowBtn` and the local `button` closure replace three copies of the style from main; already unified by the change.
- `armyBottomY` returns `total` and `confirm` as the same y: two names for two controls that happen to share a row, not a duplicate; left.
- The README line "under budget) is written under the total — and a ..." is over-long too, but it is outside the diff; left.
- The review's LOW e2e gap (click `'+', 1`) is a test change and out of KonMari's remit.

## Proposed refactor intents
- none
