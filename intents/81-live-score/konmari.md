<!-- generated-by: heraklios/konmari@0.1.0 -->
# §81 KonMari record

outcome: kept
base: af58b44

## Tidied
- 40e62a9 — `src/engine/state.ts`, `src/engine/combatOdds.ts` — rewrapped the two doc-comment paragraphs §81 edited (`winnerIds`, and `combatOdds`'s "Close to" note), which each had a line running past their neighbours' 80 columns. Comment text only, no word changed; no review mutant sits on these lines.

## Looked at and left
- `scorePanel.ts`'s `contains` beside `rulesPanel.ts`'s `contains` and `logPanel.ts`'s `inBounds`: the same point-in-rectangle test, but over three different bound shapes (a `Rect`, the `PANEL_W`/`PANEL_H` constants behind a shown flag, and a `LogBounds` with `bottom`). Folding them means a shared `rectContains` in `rulesPanelLayout.ts` and edits to two files the intent did not touch; small gain, so proposed below rather than done.
- `turnManager.ts`'s `endGameByTimeLimit` (the `alive` set before filtering `playerScores`): could index `state.players[i]` instead, but the set reads plainly, and this is the winner rule the review's engine mutants were run against. Left.
- `scorePanelLayout.ts`'s `scorePanelRows` finds each name by id while `GameOverScene.ts` indexes `scores[i]`: both are correct (`playerScores` keeps `state.players` order); not a duplicate, left.
- `scorePanel.ts`'s `snapshot()` reads the score and unit count back from the drawn text with a regex: that is deliberate (the smoke test checks what is drawn, and R7/M12b are killed through it). Left.
- `BoardScene.ts` (3169, at its ceiling) and `devHook.ts` (459): the one-line hook and the reader are already minimal; nothing to shrink without moving unrelated code.
- The review's open LOWs (M9/M10 at `GameOverScene.ts`, the I4 note in `score.ts`, the "+30" literals fixed by B12, `plan.md`'s "16", the e2e seed-1 attack): each needs a test, a spec decision or an owner edit, not a tidy-up. Left for the owner.
- `src/engine/fixtures/72-harness-traces.json` and `harnessPinned.test.ts`: not touched, as instructed.

## Proposed refactor intents
- refactor: one `rectContains(rect, x, y)` beside `rectsIntersect` in `src/ui/rulesPanelLayout.ts`, used by the score, Tables and log panels' `contains`.
