<!-- generated-by: heraklios/konmari@0.1.0 -->
# §66 KonMari record

outcome: kept
base: 3d7f12c

## Tidied
- b946a5a — `src/engine/hex.ts`, `src/engine/movePath.ts`, `src/engine/actions.ts`, `src/scenes/BoardScene.ts`, `scripts/size-baseline.json` — `movePath.ts`'s new `parseKey` was the third copy of `hexKey`'s inverse (with `actions.ts`'s `parseHexKey` and `BoardScene`'s `parseKey`). It is now one `parseHexKey` in `hex.ts`, beside `hexKey` (principle 6). `BoardScene.ts` shrinks by 5 lines, so its ceiling goes from 3177 to 3172.
- 0d513f2 — `src/ui/animationPlan.ts` — the planner's `samePlace` and `facingTurns` recomputed `hexEquals` and `facingRotationCost` from `engine/hex.ts`, with the same answers for facings 0-5. Any mutant on the old lines applies to `facingRotationCost`/`hexEquals`, which the hex tests and the planner's turn tests still exercise.
- be76057 — `src/ui/MapView.ts`, `src/ui/drawnUnits.ts` — dead code from the rework. `MapView.finishAnimations()` had no caller: the cut-short runs from the animator's window listener, and `setViewKind` calls the view directly. `DrawnUnits`' `onDrained = () => {}` default was never used, because its one caller always passes it.
- 567c5fa — `src/ui/viewToggle.ts`, `src/ui/speedToggle.ts` — the speed button copied the view toggle's text style, depth and scroll factor. Both buttons are now built by `hudToggleButton` in `viewToggle.ts`.
- d79eb69 — `src/ui/rememberedChoice.ts` (new), `src/ui/animationSpeed.ts`, `src/ui/boardViewPreference.ts` — `animationSpeed.ts` copied `boardViewPreference.ts`'s storage code: the `localStorage` read, the in-memory value, the guarded write and the test reset. The two modules now share `rememberedChoice(key, resolve)`. Every exported name stays the same, and both existing store tests cover the shared code.
- c55cfc4 — `src/ui/devHook.ts`, `src/ui/drawnUnits.ts` — `unitCanvas` had been inserted between `worldToCanvas` and its doc comment, so that comment described the wrong function. `DrawnUnits.inspect` read the ghost's figure layer by hand, on the line next to one that uses `figureOf`.

## Looked at and left
- `devHook.ts`: `animationSpeed` and `unitCanvas` stay on one line, unlike the entries around them. Splitting them makes `installDevHook` 81 lines and raises the lint warnings from 21 to 22 (tried, then undone). A proposed refactor is below.
- `i18n/index.ts` (language) repeats the same stored-choice code. It also reads the browser language and sets the page's `lang`, and it is older code that this change does not duplicate, so it was not folded into `rememberedChoice`. A proposed refactor is below.
- `navalMovement.ts`'s `navalStateKey` only passes through to the private `stateKey`. Exporting `stateKey` under that name would rename five lines this intent did not write. It is harmless, so it was left.
- `movePath.ts` parses the naval state key (`k.split('|')`), while `navalMovement.ts` builds it. The format now lives in two places. A `parseNavalStateKey` beside `stateKey` would be its natural home, but this is minor, and `movePath.test.ts` proves the round trip.
- The long one-line comments in `BoardScene.ts` (the decision-(a) `INTERPRETATION` note and `pause`'s doc) and `PlacementScene.ts`'s `})), 'snap');`: wrapping them adds lines to two files already at their size ceilings, and a ceiling may not rise here.
- `BoardScene`'s `cues` field sits just above `renderAllUnits`, not at the top of the class. That matches the file's habit of declaring fields beside their code (`history`, `navalContacts`, `advanceOfferQueue`).
- `animationSpeed.ts` and `speedToggle.ts` export `ANIMATION_SPEEDS`, `createSpeedToggle` and `speedToggleLabel`, but use them only inside their own modules. The exports are harmless, so they were left.
- `planAnimation` and `DrawnUnits.setUnits` each call `reconcileUnits` on the same inputs. Sharing one result would change the planner's signature, which its tests (and the P-mutants) are written against.
- `CueKeeper`, `actionCue.ts`, `movePath.ts`, `drawnAnimator.ts`, `drawnMotions.ts`, `drawnBoardView.ts`'s held arrow, and the search changes in `movement.ts`/`navalMovement.ts`: each has one job and no copy elsewhere.

## Proposed refactor intents
- refactor: split `installDevHook` (`src/ui/devHook.ts`, 80 of 80 lines) into grouped builders (camera, units, panels), so each hook entry can sit on its own line and adding a hook stops brushing against the function-length guardrail.
- refactor: move the language preference (`src/ui/i18n/index.ts`) onto `rememberedChoice`, keeping its browser-language fallback and `applyToPage`, so all three remembered choices share one storage path.
