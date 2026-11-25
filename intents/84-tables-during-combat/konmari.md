<!-- generated-by: heraklios/konmari@0.1.0 -->
# §84 KonMari record

outcome: kept
base: 7a16fb1

## Tidied
- 0154c49 — `src/ui/rulesPanel.ts` — the `isOpen` and `toggle` doc comments no longer describe the removed suppression (F13); comments only.
- ebbf4d6 — `src/ui/boardPrompts.ts`, `src/scenes/BoardScene.ts`, `src/ui/rulesPanelLayout.test.ts` — the advance and exchange chooser sizes (`320`, `76 + 26n`, `340`, `110 + 24n`) now live once, as `ADVANCE_CHOOSER`/`EXCHANGE_CHOOSER` beside `RAM_PROMPT`/`BOARD_PROMPT`; the scene's literals are replaced in place and the test reads the real sizes instead of a hand copy (F12, principle 6). `BoardScene.ts` stays at 2833 lines, so no ceiling moved; no test assertion changed.

Killed mutants: no line moved. `BoardScene.ts:701` (F2b, C2) and `:2596` (E5) are where review.md puts them; `rulesPanel.ts` keeps its line count (E10 in `reset()`); `endMoveWarning.ts` is untouched (F2a `:68`, C1 `:205-207`). The three named e2e specs pass (15 passed).

## Looked at and left
- F8, `rulesPanel.ts:132` (`if (attack) this.rolled = null;`): equivalent to the scene's `clearRolled()` call, but it keeps the panel right on its own and is documented; removing it is not simpler.
- `ROLLED_FILL = 0xf0d070` and the `'#f0d070'` text colour: the same colour in two forms (Phaser fill number vs CSS string), as the file already does for its other accents; not a duplicate computation.
- `clampRow` in `ruleTables.ts`: the intent's own extraction, used twice; fine.
- `chooserRect` beside `centredPromptRect`: different placement rules with different reasons to change; kept apart.
- README, CLAUDE.md, `endMoveWarning.ts` and `rulesPanelState.ts` comments: accurate after the change.

## Proposed refactor intents
- none
