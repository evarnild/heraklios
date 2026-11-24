<!-- generated-by: heraklios/konmari@0.1.0 -->
# §90 KonMari record

outcome: nothing to tidy
base: f92d994

## Tidied
- none

## Looked at and left
- `src/engine/combat.ts` `pushCandidates`: the hoisted `enemyZoc` set copies `legalRetreatHexes`'s own first line (`hexesUnderZoc(state, unit.owner)`) and its `enemyZoc.has(mapHexKey(...))` pattern, so the names already match the file. One set serves the whole chain, as the comment says.
- The fixpoint edge and the top-level filter now each check "the pusher may take this friend's hex" (terrain plus ZOC). A shared closure would remove the repetition, but it saves no lines (the file stays at its 1135 ceiling). It would also merge the two ZOC lines that the review's mutants M1 (`:926`) and M2 (`:901`) prove separately, so the per-site evidence would be lost. Left.
- The replaced "NOT checked here … ZOC" paragraph is gone, and the new INTERPRETATION paragraph follows the file's convention (§90, owner's ruling, rule citation, readings that were turned down). Nothing dead is left.
- `fuzzHarness.test.ts`: the two `processDrifts` fixtures repeat the same six-line §90 comment. This is test-file prose, and the reach allows edits to a test file only where a moved symbol forces them. Left.
- `buildChain`'s `blockerType` and `makeChainUnit`'s `typeId` parameters do the same job in two test files with different helpers that already existed. They are fixtures with separate reasons to change. Left.
- `README.md`, `harnessPinned.test.ts` and its fixture, `heuristicSoak.test.ts`, and `gameSession.test.ts`: documentation, re-pinned data and re-fixtured positions. Nothing duplicated or dead.

## Proposed refactor intents
- none
