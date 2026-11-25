<!-- generated-by: heraklios/konmari@0.1.0 -->
# §88 KonMari record

outcome: kept
base: b82bc98

## Tidied
- ea7f23f — `src/ui/MapView.ts` — the `./panBounds` import moved from line 1 (above `phaser`) to beside its `./` neighbours (after `./cameraFraming`). Line count unchanged (492); the `panBounds(...)` call stays at `MapView.ts:136`, so W1–W3 are unmoved.
- 4816456 — `src/ui/rulesPanelLayout.ts`, `e2e/wide-canvas.spec.ts` — the spec's `TABLES_MARGIN = 12` copy ("not exported") removed; `rulesPanelLayout.ts`'s private `MARGIN` is now the exported `RULES_PANEL_MARGIN`, named like its neighbours `RULES_PANEL_W`/`RULES_PANEL_H`, and the spec imports it. The asserted value is unchanged (1600 − 776 − 12 = 812). The spec loses one line: the B5 test moves from `wide-canvas.spec.ts:52` to `:51` (F6's range is now `:51-66`). `rulesPanel.ts` is untouched, so E3 (`:124`) and E4 (`:85`) are unmoved.
- 095cda9 — `src/ui/armyBuilderLayout.ts` — the header comment's 130-character first line rewrapped to the file's ~80-column comments (2 lines become 3). Every line below moves down by one: `ARMY_LAYOUT_WIDTH` 8 → 9, `armyLayoutOffset`'s return 12 → 13, `armyRowSlot`'s `const left = offsetX + …` 53 → 54. Mutants M6–M10 target those lines; their text is unchanged.

## Looked at and left
- `panBounds.ts`'s `Box` and `cameraFraming.ts`'s `Box` share a name but not a shape (`x/y/width/height` against `left/top/right/bottom`) and have different reasons to change, so not a duplicate. `MapView.enableDrag`'s inline `{ x; y; width; height }` parameter type could be `panBounds`' `Box`, but MapView already imports `cameraFraming`'s `Box`; an aliased import would add noise, not remove it.
- `ARMY_LAYOUT_WIDTH = BASE_WIDTH`: a deliberate alias (round 1's F3), naming the builder's own design width.
- `e2e/wide-canvas.spec.ts:51-66` (F6, `:52-67` before 4816456): the unasserted zoom 1 is a test change, so left; the names there (`first`, `last`, `leftX`, `rightX`, `leftGap`, `rightGap`) already read well. `const leftX = left.x` is a one-line redundancy, left because it is in a test body and earns its keep as a name beside `rightX`.
- The literal 2400 twice in the B5 test (viewport and `rightGap`): left, a test file edit no symbol forces.
- `canvasSize.ts`, `panBounds.ts`, `main.ts`, `ArmyBuilderScene.ts`, `rulesPanel.ts` (snapshot `left`), `devHook.ts`, README and `playwright.config.ts` lines: nothing dead, duplicated or out of step.
- F4 (plan.md Progress numbers): the coordinator's; plan.md not touched.

## Proposed refactor intents
- none
