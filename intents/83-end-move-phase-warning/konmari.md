<!-- generated-by: heraklios/konmari@0.1.0 -->
# §83 KonMari record

outcome: kept
base: 84babef

## Tidied
- 7d4d20a — `src/ui/devHook.ts` — `rulesPanelSnapshot` and the new `endMoveWarningSnapshot` computed the same thing (a guarded read of a `BoardScene` member's own `snapshot()`) for a different member; folded into one `memberSnapshot(scene, member)` with a `SnapshotMember` type, which replaces `RULES_MEMBERS`/`WARNING_MEMBERS`. `DevHook.endMoveWarning` now returns `EndMoveWarningSnapshot` instead of a copy of its shape (principle 6). devHook.ts 499 → 487 lines.
- ba256ef — `src/ui/cameraFraming.ts`, `src/ui/MapView.ts`, `src/ui/endMoveWarning.ts` — `{ zoom; scrollX; scrollY }` was spelled out three times (`cameraView`, `setCameraView`, `EndMoveWarning.saved`); one `CameraView` type in `cameraFraming.ts`, beside `CameraFrame`. MapView.ts stays at 496 lines (the type rides the existing import).
- 8927402 — `src/ui/endMoveWarning.ts` — removed the redundant `scene.events.once('shutdown', () => this.reset())` (equivalent mutant E11): Phaser's `KeyboardPlugin.shutdown` removes the key listeners and `create`'s `resetSceneState` resets the old instance. The constructor comment now says so.

Mutant target lines that moved (all re-applicable by their text; none in `MapView.ts`'s method bodies, `BoardScene.ts`, `unmoved.ts`, `cameraFraming.ts`'s `frameBox`/`boxAround`, `endMoveWarningLayout.ts` or i18n changed):
- E11's line is gone (the tidy-up above); there is nothing to re-apply.
- In `endMoveWarning.ts`, every line after the constructor moved up by one: E12's `if (!due || this.isOpen) return false;` is now `:84` (was `:85`), `onOpen();` (E1) `:86`, `this.markedIds.push(...)` (E13) `:131`, the restore `setCameraView(this.saved)` `:215`. Their text is unchanged.
- `cameraFraming.ts` gained 7 lines (the `CameraView` interface) above `boxAround`/`frameBox`; the C mutants' lines moved down by 7, their text unchanged.

## Looked at and left
- `|| this.isOpen` in `EndMoveWarning.open` (E12, unreachable from the scene because `endPhase`'s `decisionPending` guard refuses first). Left: it is a one-term invariant guard, and without it a second `open` would draw a second prompt and marks over the first and leak the first set. It is not a copy of other code.
- The `ActionContext` built inline in `BoardScene.endPhase` (`{ attackedThisPhase, rammedThisTurn }`) duplicates the one `runAiSeats` builds for `legalActions`. A `private actionContext()` helper would fold them, but nets out at zero lines or +1 with a doc comment, and `BoardScene.ts` sits exactly at its 2834 ceiling. `captureSave` builds the same pair for the save file, which is a different reason to change. Left; see the proposal below.
- `e2e/helpers.ts`'s `endPhase` and the 12 call sites the round changed are the right shape (a helper, not copies).
- `unmoved.ts`, `endMoveWarningLayout.ts`, `frameBox`, and the i18n entries have no duplicates or dead code.
- `MapView.frameWorldBox`/`centerOnPoint`/`centerOn` each move the camera differently; they are not duplicates.

## Proposed refactor intents
- refactor: give `BoardScene` one `actionContext()` for the per-phase bookkeeping that `legalActions` and `applyAction` take (today it is built inline in `endPhase` and `runAiSeats`, and possibly in `applyAction` call sites). Do it together with a `BoardScene.ts` shrink so the budget line can drop.
