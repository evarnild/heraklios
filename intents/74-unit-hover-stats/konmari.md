<!-- generated-by: heraklios/konmari@0.1.0 -->
# §74 KonMari record

outcome: kept
base: 943b9ea

## Tidied
- ab0842a — src/ui/MapView.ts — the private `tooltipTextFor` moved from between the two public dev-hook readers (`tooltipText`, `tooltipBox`) to just after `showHexTooltip`, its only caller, so the readers sit together; the new `hoveredHex`/`pointerX`/`pointerY` fields got a doc comment like their neighbours (`hoveredKey`, `uiCamera`). No line of code changed; the NL, HOOKBOX, F1REFRESH, HOVHEX and ALWAYSAPPEND lines are unchanged.
- cb37155 — e2e/helpers.ts — the new `hoverHex` repeated the canvas-box lookup and its throw that `clickCanvas` and `hexShot` already had; the three now share one private `canvasBox(page)`. No assertion changed.

## Looked at and left
- `MapView.hoveredKey` and the new `hoveredHex` hold the same fact (the key is derived from the hex). Folding the key into the hex would change the hover gate's compare and the line HOVHEX mutates; the gain is one field, so it stays.
- `src/ui/unitTooltip.ts`: no duplicate. Nothing else in `src/ui` formats a unit's values (the removed `counterBadge` was the only one, and it went with its tests); the stat values come from the engine's `currentAttack`/`currentDefense`/`currentRangedAttack`/`maxEquipmentPoints` (principle 6). It is a ui module reading engine data and returning text (principles 2, 8).
- The `unitTooltipFor` re-export from `MapView.ts`: deliberate (its comment says why), keeps both scenes at one import line and at their ceilings.
- `drawnUnits.ts`: the I2 comment where the badge was records a spec interpretation (principle 16); the `DrawnUnits` doc comment, now one long line, reads fine against the file's other long lines.
- `devHook.ts:274`, the packed line: kept by the owner's decision ((a)); §75 splits `installDevHook`.
- `BoardScene.ts`, `PlacementScene.ts`: left as asked (at their ceilings, 3172 and 574); the hook lines there are one each and duplicate nothing.
- i18n `tooltip` blocks: `tooltip.owner` is the same function in both languages, listed in `SAME_IN_BOTH` as the convention asks; no existing key carries these labels (`phases.movement` is the phase name, a different reason to change).
- `e2e/message-log.spec.ts:29` has a fourth copy of the canvas-box lookup; that file is outside the diff and `canvasBox` is private to the helpers, so it stays.
- README: the new paragraph's last line is longer than its wrapped neighbours; a prose rewrap is not worth a commit.

## Proposed refactor intents
- none
