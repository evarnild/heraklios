<!-- generated-by: heraklios/konmari@0.1.0 -->
# §72 KonMari record

outcome: kept
base: 6f132bd

## Tidied
- f89046d — `src/engine/sessionAgents.ts`, `src/engine/combatResolution.ts` — removed `sessionAgents.ts`'s private `unitsOf`, a second copy of the id lookup `combatResolution.ts`'s `unitById` already does (find by id, throw when missing). `unitById` is now exported and `askAgent` uses it. The agent methods are called in the same order with the same arguments; only the missing-unit error's prefix changes (`sessionAgents:` to `session:`), and no test reads it. Pinned traces and fixtures are untouched.

## Looked at and left
- The retreat and drift sequencing in two drivers (`engine/retreat.ts` + `resolveElephantDrift`, and `combatResolution.ts`): a recorded exception in `docs/architecture.md` (principles 6, 17), removed by §73.
- `fuzzHarness.ts`'s `resolveUnitRetreat`, `processRetreats`, `processDrifts` and `capturePendingResolutionItems`: now used only by `fuzzHarness.test.ts`. They are that test's API, so removing them would delete test cases. The section banner above them ("mirrors BoardScene's ... sequencing exactly") is older than §72 and outside the diff's lines.
- `deployUnit`'s legality and occupancy checks and `PlacementScene.tryPlace`'s own checks: the scene checks before it stages a ship's facing, ahead of any `deployUnit` call. That is a different reason to change (principle 5 wiring), so they stay apart.
- `deployment.ts`'s `unitsOf(selection)` and the removed `sessionAgents.ts` `unitsOf`: the same name, but different inputs (an army selection versus unit ids).
- "Push the id if it is not already in the list" appears in `combatResolution.ts` (`newFrame`, `stepDrift`) and in `gameSession.ts`'s `add`. Each is one line, and folding them would add an export for very little.
- `host.ts`'s `HostStep.result` repeats `SessionStep['result']`'s union. These are two public shapes, kept explicit for a host reader.
- `host.ts`'s `copy` (a JSON round trip): there is no other engine helper like it, and `structuredClone` would keep `undefined` fields that the JSON contract drops.
- `ui/mapBounds.ts`'s `seaZoneNear(edge: 'N' | 'S' | 'E' | 'W')` could take the re-exported `Edge`, but that line predates §72 and changing it needs a local type import for no gain.
- `export` on `askAgent`, `forcedHooks` (`sessionAgents.ts`) and `isAnswerAction` (`gameSession.ts`), which no other module uses: the plan names `askAgent` and `forcedHooks` as the adapter's API, so they stay.

## Proposed refactor intents
- none (§73 already covers moving `BoardScene` onto the session and removing the second driver).
