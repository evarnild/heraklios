<!-- generated-by: heraklios/konmari@0.1.0 -->
# §86 KonMari record

outcome: kept
base: d19115b

## Tidied
- 5d65c30 — e2e/save-load.spec.ts — the route comment said the save write is "a POST/PUT"; it now names the real methods (`writeSave` is a PUT, `clearSave` a DELETE, `src/ui/saveStorage.ts`). Comment only (review LOW 1).
- 3184b5d — e2e/save-load.spec.ts — the `messagesFor` import sat between the `./helpers` and `./savesDir` imports; moved up with the other non-local imports, as `attack-log.spec.ts`, `rules-panel.spec.ts` and `score-panel.spec.ts` order them. No behaviour change.

## Looked at and left
- The route's `method !== 'GET'` filter in `save-load.spec.ts`: the review shows a mutant deleting it survives (the route is installed after the Save), but it is defensive and removing it changes the scenario's code path, so it stays.
- `score-panel.spec.ts:35`'s local `frames`: it computes the same as `helpers.ts`'s `frames`, but it predates this branch and no line of the diff duplicates it (the diff only removed a caller). Outside the reach; too small for its own intent, noted here.
- `waitLoaded` in `e2e/helpers.ts`: placed beside the other wait helpers' file, one copy (the `score-panel.spec.ts` local one is already removed by the diff); its doc comment is accurate. Nothing to unify.
- `save-import.spec.ts`: the import list stays sorted after `waitIdle` left it; nothing dead left behind.
- `e2e/combatFixtures.ts`'s `loadFixture` (§73, on `main`): not on this branch and cannot take `waitLoaded` as is (it skips `waitIdle` for a computer seat). Left, per the coordinator; it is the review's follow-up.

## Proposed refactor intents
- none (the `loadFixture` convergence is already the review's recorded follow-up)
