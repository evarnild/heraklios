<!-- generated-by: heraklios/konmari@0.1.0 -->
# §73 KonMari record

outcome: kept
base: deb5a58

## Tidied
- f865bce (now 81d720a after the rebase) — `src/ui/driftBeats.ts`, `src/ui/i18n/format.ts` — `driftBeats.ts`'s private `unitIn(m, unit)` computed the same name from the same table as `format.ts`'s `unitNameIn(m, typeId)`; `unitNameIn` is exported and the copy removed (principle 6).
- ff24f1a (now ca21a69 after the rebase) — `src/scenes/BoardScene.ts`, `scripts/size-baseline.json` — `resetSceneState` and `restoreSnapshot` each cleared the combat, the prompt and every drift-display field inline, and the drift half was `endDriftDisplay(false)` line for line. Both now call a new `dropCombat()` (combat, `pushedThisCombat`, `retreatChoice`, `decisionPending`, then `endDriftDisplay(false)`). `endDriftDisplay` became null-safe on `driftContinueBtn` and `mapView`, as the reset's copy was. `BoardScene.ts` is 2835 → 2824 lines, and its ceiling is lowered to 2824.
- e4db807 (now fdd98a4 after the rebase) — `src/scenes/BoardScene.ts` — two comments that still named what §73 removed: `RetreatChoice`'s doc ("the normal post-combat retreat queue") and `openSaveLoad`'s ("`onComplete` closures"). Comment-only.

**Mutant target lines.** No recorded mutant's target line changed text. Lines are numbered as at `deb5a58`.
- `BoardScene.ts` is unchanged above line 259. S15's `if (!this.combat?.pending?.drift) this.endDriftDisplay(true)` stays at :234.
- Every scene mutant target from :1101 on moved up 11 lines with its text unchanged (net +9 at :259, −10 at :435, −10 at :1101). So S01, S03, S05, S06, S07, S10–S16 (except S15) and S18 move from `:2154–2805` to `:2143–2794`. For example, S18's `this.decisionPending = true;` moves 2154 → 2143, and S07's `if (question.kind === 'pushTarget') this.pushedThisCombat.add(...)` in `onForced` moves 2205 → 2194.
- The `finally` in `settleLandAttack` was not touched. It still clears `combat`, `decisionPending` and the drift display itself.
- No engine file changed: E01–E33 (`combatResolution.ts`, `gameSession.ts`, `sessionAgents.ts`, `fuzzHarness.ts`, `cueKeeper.ts`) are where `review.md` left them.

## Looked at and left
- **`settleLandAttack`'s `finally`.** It could call `dropCombat()`, but that would also clear `retreatChoice` and `pushedThisCombat` on a throw. It sits in the S-mutant range, and a behaviour difference on the error path isn't worth it. Left as is.
- **`sessionAgents.ts`'s `isListedSacrifice`.** It sorts and joins ids, as `combatResolution.ts`'s `sameAnswer` does for `answerSacrifice`. Routing it through `sameAnswer` would need two wrapper answer objects and would read no better. Left as is.
- **`src/engine/sessionTestKit.ts`.** Its `unit`, `gameWith`, `dieFor`, `scripted` and `attack` copy `gameSession.test.ts`'s local helpers (`gameWith` without the `phase` parameter). Folding them means editing `gameSession.test.ts` beyond what a moved symbol forces, which is out of reach here. Proposed below.
- **`e2e/combatFixtures.ts`.** `loadFixture`'s closing `expect`s repeat the `waitForFunction` condition just above them, and `unitFrom` resembles `fuzzHarness.ts`'s `makeUnit` and `deployment.ts`'s unit literal. The `expect`s are assertions and stay. `unitFrom` has a different reason to change (full movement, an e2e-only fixture). Left as is.
- **`src/ui/devHook.ts`'s `driftArrow`.** Its member guard repeats the `for (const m of X_MEMBERS) if (!(m in b)) throw …` pattern that `busy`, `placementSnapshot`, `rulesPanelSnapshot`, `armyBuilderSnapshot` and `logInternals` each hold. One `requireMembers` helper would serve all of them, but the intent puts `devHook` refactors out of scope. Proposed below.
- **`BoardScene`'s `pending()`.** It checks both `combat` and `decisionPending`, which are set and cleared together in `settleLandAttack`. They aren't redundant: `decisionPending` also drives the Tables panel's suppression (`review.md`, S18 killed). Left as is.
- **`logCombatOutcome` / `formatCombatOutcome`.** Both predate §73 (on `main`). Left as is.
- **`src/engine/driftReference.ts`.** Its retirement is a recorded follow-up and was not touched. Proposed below.
- **Docs, README and the tests.** Read, with nothing to tidy within reach. Test files were not edited.

## Proposed refactor intents
- **Retire `src/engine/driftReference.ts`.** The test-only copy of the old drift pump and `resolveUnitRetreat` would move into the tests that pin against it, or be dropped once the session's pinned traces stand alone. `fuzzHarness.ts:10` would stop importing it. That ends the asymmetry `review.md` notes under principle 10, and removes `resolveElephantDrift`'s complexity-40 warning, so the lint cap can go down.
- **One set of session test helpers.** `gameSession.test.ts` would import `unit`, `gameWith`, `dieFor`, `scripted` and `attack` from `sessionTestKit.ts` (giving `gameWith` the optional `phase`), and drop its copies.
- **A `requireMembers(scene, members, listName)` guard in `src/ui/devHook.ts`.** It would replace the six hand-written "BoardScene has no … any more" loops.

## Second pass (after the rebase onto main)

outcome: nothing to tidy
base: 09354a9

Covers the commits after the rebased `§73: konmari record` (2e20861): c53a092 (`§73: move the push fixtures onto §90's rule`), 3f69246 (Progress), c1609bf (auto round 3 started) and 09354a9 (round 3 review). Only c53a092 touches code: `src/engine/sessionSeams.test.ts`'s `singlePush()` and `e2e/combatScenarios.ts`'s `PUSH`.

Reason: both are fixture data, each new box earns its place under §90's rule (checked box by box in round 3). `singlePush()` resembles `gameSession.test.ts`'s local `pushPosition()`, but the two are different positions (a friend `d` at (1,18) there; three more naval boxes and no friend here), so they are not one computation, and sharing a builder would mean editing `gameSession.test.ts` beyond a forced change. Already covered by the first pass's "one set of session test helpers" proposal.

The rebase rewrote the first pass's tidy-up hashes. Under `## Tidied`, the old hash is followed by the new one, matched by subject: f865bce → 81d720a (`driftBeats reuses format.ts's unitNameIn`), ff24f1a → ca21a69 (`one dropCombat for the scene reset and the undo restore`), e4db807 → fdd98a4 (`two comments that still named the removed retreat queue and drift closures`). The first record's own commit is now 2e20861. The first pass's `base: deb5a58` is the pre-rebase hash.
