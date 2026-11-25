<!-- generated-by: heraklios/review@0.2.0 -->
# §83 review — Ending the movement phase with unmoved units shows them and asks to confirm

verdict: attest
tier: attested
reviewed-commit: fe10933
round: 2
sampled: no
run: auto
live-check: owed

All five round 1 findings are fixed, each by a test change plus one small
reader change (`markedIds`). The six target mutants (M3, M2, E13, E1, C5, C8)
are all killed, and so are B1 and B2 at the two hooks the rebase moved, plus a
new E16.

The rebase onto `main` at `28c15d3` (after §73, on the owner's "rebase 83") is
clean. `git range-diff` shows only the scene-hook commit changed, in its
conflict context only. §83's hooks sit where they should against §73's
rewritten scene.

`verify`, the full e2e and the repeat run are green. `check:intent` fails
only on the owed live check, which is the owner's gate. What is left is three
LOW wording notes in Progress; nothing needs rework.

## Passes (full `git diff main...HEAD`, 28 files)
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The rework is limited to round 1's findings; the rebase resolution is judged below. |
| 2 | Type check | pass. The only error is the owed live check. |
| 3 | Rulebook fidelity | pass. Digital-only; the rebase changed no rule. |
| 4 | Tests prove the rule, not only pass | pass. All 6 targets, B1, B2 and the new E16 are killed. |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (2, LOW) |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass. 17 lint warnings, cap 17 on the branch and on `main`. |
| 9 | Repository footguns | pass (not applicable) |
| 10 | Architecture | pass |

## Type check
```
type-check: FAIL (intent 83, feature)
  error: A live check is owed and not recorded. Do the steps in intents/83-end-move-phase-warning/review.md → ## Live check, then set live_checked: <date> in intents/83-end-move-phase-warning/metadata.yml.
  note:  25 file(s), 1102 line(s) changed outside intents/.
exit: 1
```
The live check is the only error: it's the owner's gate, not a rework finding.

## The rebase resolution, against §73's scene
Lines are in `src/scenes/BoardScene.ts` at `fe10933`.
- **The `endPhase` hook comes after the pending guard.** `endPhase`
  (`:2566-2589`) refuses on `aiRunning`, then on `pending()`, then builds `end`,
  then calls `endMoveWarning.open(...)`. §73's `pending()` (`:291-293`) covers
  `combat`, `retreatChoice`, `driftState` and `decisionPending`, so it also
  covers the warning's held `decisionPending`.
- **`endMoveWarning?.reset()` is beside `dropCombat()`.** `resetSceneState`
  (`:445-466`) runs `dropCombat()` (`:450`), then `rulesPanel?.reset()` (`:452`),
  then `endMoveWarning?.reset()` (`:453`). The two dropped lines refer to fields
  §73 removed (`advanceEligibleAttackers`, `advanceOfferQueue`); neither name
  remains on the branch.
- **There's no undo-restore reset, before or after the rebase,** and none is
  needed. `undo` and `redo` (`:1124-1165`) refuse on `pending()` while the
  warning holds `decisionPending`.
- **`onOpen` still clears the selection** (`() => this.deselectMovement()`,
  `:2588`). This is now pinned: E1 is killed.
- **Nothing in §73's combat flow interacts with the warning's pending state.**
  - `settleLandAttack` sets and clears `decisionPending` (`:2148`, `:2173`)
    only in the combat phase. The warning opens only in movement.
  - `endPhase` refuses while `pending()` is true, and `onHexClick` returns
    early on `decisionPending` (`:1366`).
  - Computer seats end the phase through `commitEndPhase` (`:2743`), never
    through `endPhase`.
  - `rulesPanel.setSuppressed(this.decisionPending)` (`:1294`) still covers
    the open warning.
- **Sizes and the dev-hook list.** `BoardScene.ts` is 2834 lines (2824 + 10, the
  baseline's 2834); `MapView.ts` 496. The dev-hook member list has
  `driftArrow` and `endMoveWarning`, sorted.

## Findings
- **LOW** `intents/83-end-move-phase-warning/plan.md:606` (Progress, "rebase
  onto main after §73"): "cap 18" is wrong; the cap is 17 on the branch and
  on `main`, and the 17 warnings meet it exactly. Worth a look.
- **LOW** `plan.md:601` (same entry): "the undo-restore reset" auto-merged.
  §83 has no undo-restore reset; the behaviour is right because undo is
  refused while the warning is open. Worth a look.
- **LOW** (carried from round 1): the redundant `scene.events.once('shutdown',
  …)` (`endMoveWarning.ts:68`, E11), and the unreachable `|| this.isOpen`
  (`:85`, E12). Worth a look.

**Round 1's findings, status:**
- **M3 fixed:** the zoom is now asserted strictly below.
- **M2 fixed:** a new "the camera stays put when every flagged unit is
  already in view" e2e.
- **E13 fixed:** `markedIds` is recorded in the draw loop.
- **E1 fixed:** the selection is now asserted cleared.
- **C5/C8 fixed:** the margin test asserts identity.

## Not checked
- **AC14, computer seats:** still no e2e. That the computer never reaches the
  warning is shown by reading the code (`commitEndPhase` path, `:2743`).
- **The look (AC17):** mark size, colour and depth; the 150 px prompt; the
  French fit.
- **The Abandon dialog over an open warning** (Escape or Enter would act on
  the warning beneath).
- **B10 and B12** (restore after a drag or zoom while open; tick then Cancel).
  Correct on reading; no test drives them.
- **The mouse wheel over the prompt** may scroll the hidden log. Cosmetic.
- **Round 1's equivalent mutants** (U2, U5, U7, U8, C1, I1, E11, E12) were not
  re-run; their code is unchanged.

## Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and visual,
  and the check isn't recorded yet.
- **steps:** in `C:/Users/eric/src/heraklios-wt/83-end-move-phase-warning`, run
  `npm run dev -- --port 5283`, open `http://127.0.0.1:5283/`, then Menu → "Test
  mode (2 players, armies ready)".
  1. Move one unit one hex, select another of your units, and click **End
     phase**.
  2. With the warning open, toggle the Drawn view and back.
  3. Click **Cancel**, then press Ctrl+Z.
  4. Click End phase and press **Escape**. Click End phase again and press
     **Enter**.
  5. Switch to French and repeat step 1.
  6. Tick "Don't warn me again this game" and confirm. End combat. On player
     2's movement phase, End phase. End combat. On player 1's next movement
     phase, End phase.
  7. Optional: with the warning open, click Abandon, then press Enter under
     its dialog.
  8. In a game with a computer seat, let it play two turns, including a
     combat.
- **you should see:**
  1. The camera frames every unmoved unit, zooming out only as needed, with
     a magenta mark on each. The prompt sits at the top of the log, and the
     selection and its highlights are gone.
  2. The marks stay, on top of the figures.
  3. The camera returns exactly, the marks go, and Ctrl+Z restores the
     moved unit.
  4. Escape cancels; Enter ends the phase (now combat).
  5. The French fits: watch the tick label's right edge and the message's
     third line.
  6. The log says "End-phase warning off for …". Player 2 is still warned;
     player 1 goes straight to combat.
  7. You decide whether ending the phase under the Abandon dialog is
     acceptable.
  8. No warning and no stall on the computer's turns, and its combats settle
     as before (§73).
- **Untuned items for you to judge:** mark 14 × 10 px, colour `#e040fb`, depth
  14; `PROMPT_HEIGHT = 150`; the French fit.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `fe10933`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 110 passed (110)`, `Tests 1825 passed | 2 skipped (1827)`.
- `npm run check:intent`: the FAIL above (live check only).
- Full `npm run e2e`: exit 0, `63 passed (2.7m)`, with no flakes.
- `npx playwright test e2e/end-move-warning.spec.ts e2e/combat-resolution.spec.ts
  --repeat-each=2`: `34 passed (2.2m)`.
- **Mutants**, each guarded and restored by copy:
  - C5 and C8 KILLED by the margin unit test;
  - M2 KILLED by `:130`;
  - M3, E1 and E13 KILLED by `:71`;
  - B1 KILLED by `:221`;
  - B2 KILLED by `:71`, `:130`, `:160`, `:172` and `:194`;
  - E16 KILLED by `:71` and `:172`.
- `git range-diff`: only the scene-hook commit changed, in conflict context.
- The new e2e comment's arithmetic: q 10..28, width 638 px, usable view 752
  px.
- `git status --short` was clean, and HEAD stayed `fe10933`.

**Coordinator, re-run, at `fe10933` (2026-11-25):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 110 passed (110)`, `Tests 1825 passed | 2 skipped
  (1827)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: FAIL (intent
  83, feature)`, the live check only, exit 1. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `63 passed (3.1m)`. Matches.
  - A first attempt was stopped by Claude Code for low system memory; it was
    re-run alone, on the owner's word.
- **Coordinator, re-run:** unit mutants against the full vitest suite. C5
  KILLED and C8 KILLED (`1 failed | 1824 passed`). Matches.
- **Coordinator, re-run:** e2e mutants against `e2e/end-move-warning.spec.ts`
  with `--retries=1`:
  - E16 KILLED by `:71` and `:172`;
  - M3 KILLED by `:71`;
  - E1 KILLED by `:71`;
  - B1 KILLED by `:221`;
  - M2 KILLED by `:130`;
  - E13 KILLED by `:71`;
  - B2 KILLED by `:71`, `:130`, `:160`, `:172` and `:194` (7 failed).

  All on both tries, and all match.
- After every mutant the tree was `clean` and HEAD stayed `fe10933`.

**Taken on trust:**
- round 1's rule-fidelity and equivalent-mutant judgements (code unchanged);
- that the live check will settle the visual items.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: c18c187
- round: 1
- sampled: no
- run: auto
- live-check: owed

`verify`, `check:intent` and the full e2e are green, and the engine fact
(`unmoved.ts`) is well proven. But surviving mutants show that four behaviours
the spec names are not pinned by any test:

- the zoom-out wiring;
- "already visible, the camera doesn't move";
- "every flagged unit has a mark";
- "opening clears the selection".

The margin boundary in `cameraFraming` isn't pinned either. All five need
mechanical test fixes ("Needs rework:"). The code looks correct; none of this
is a rule defect.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Deviations judged below. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. Digital-only; the source quote checks out. |
| 4 | Tests prove the rule, not only pass | findings (5) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository footguns | pass (not applicable: no drift, AI or map change) |
| 10 | Architecture | pass |

### Type check
```
type-check: PASS (intent 83, feature)
  note:  25 file(s), 1061 line(s) changed outside intents/.
exit: 0
```
The counts differ from the branch's own `git diff main...HEAD` (27 files,
+1047/−37) because `main` has moved (§90 and §91).

### Findings
- **MEDIUM** `e2e/end-move-warning.spec.ts:91-92`, `src/ui/MapView.ts:481`: the
  zoom-out wiring isn't pinned.
  - Mutant M3 (remove `cam.setZoom(next.zoom)` in `frameWorldBox`) survives
    all 6 scenarios.
  - M1 (the restore's `setZoom` removed) is killed, so the seed-1 scenario
    really does zoom out.
  - AC5 asserts only `zoom <= before`.
  - Needs rework: assert `framed.zoom` strictly below `before.zoom`, or the
    exact zoom `frameBox` gives.
- **MEDIUM** `src/ui/MapView.ts:478`: B6.3, "already visible, the camera does
  not move", isn't pinned at the scene level.
  - Mutant M2 (the centre conversion `scroll + width*0.5` → `scroll`)
    survives.
  - Needs rework: add an e2e step where every flagged unit is already inside
    the usable view (for example, wheel-zoom out first, so the whole board
    fits at about 0.55), then assert the camera is unchanged after End
    phase.
- **MEDIUM** `src/ui/endMoveWarning.ts:116`: the reader's `marked` is
  `this.marks ? this.flagged.map(id) : []`. AC5's `marked == flagged` only
  proves one `Graphics` object exists.
  - Mutant E13 (draw only `centres.slice(0, 1)` at `:128`) survives.
  - Needs rework: record the ids actually drawn inside the `drawMarks` loop,
    and report those as `marked`.
- **MEDIUM** `src/ui/endMoveWarning.ts:85`: B3 (opening clears the movement
  selection and its highlights) has no test.
  - Mutant E1 (delete `onOpen();`) survives.
  - Needs rework: in the e2e, select an own unit (assert `selectedUnitId()` is
    non-null), click End phase, then assert `selectedUnitId()` is null once the
    warning is open.
- **LOW** `src/ui/cameraFraming.test.ts:31-33`: the test named "1 px inside
  the margin" uses a box exactly flush and centred.
  - So "leave the camera alone" and "pan to the box centre" give equal
    values, and `toEqual(at(1))` can't tell them apart.
  - Mutants C5 (`>=`→`>` at `cameraFraming.ts:55`) and C8 (`<=`→`<` at `:56`)
    survive.
  - Needs rework: assert `toBe(cur)` (identity, as the first test does), or
    use an off-centre box flush with one edge. Plan row B6 "margin and growth"
    (`plan.md:453`) asks for exactly this.
- **LOW** `src/ui/endMoveWarning.ts:66`: the extra `scene.events.once('shutdown',
  () => this.reset())` is redundant.
  - Phaser's `KeyboardPlugin.shutdown` calls `removeAllListeners()`
    (`node_modules/phaser/src/input/keyboard/KeyboardPlugin.js:880-883`), and
    `resetSceneState` resets the old instance at the next `create()`. So the
    Progress rationale ("listeners could fire after a restart") doesn't hold.
  - E11 survives as an equivalent mutant.
  - Worth a look only.
- **LOW** `src/ui/endMoveWarning.ts:83`: `|| this.isOpen` is unreachable from the
  scene, because `endPhase`'s `decisionPending` guard refuses first.
  - If it were ever reached, returning `false` would make the scene end the
    phase (`BoardScene.ts:274`).
  - E12 survives as an equivalent mutant.
  - Worth a look.
- **LOW** `intents/83-end-move-phase-warning/plan.md:447`: "removing the phase
  check fails" doesn't hold.
  - `legalActions` emits no movement actions in combat
    (`actions.ts:449-482`), so U2 is equivalent.
  - U5 (the owner filter) is equivalent too.
  - Above the Progress marker, so worth a look; no rework.
- **LOW** `plan.md` Progress, "5 + 1 messages in en/fr": it's 5 new messages
  per language (4 `board`, 1 `log`) plus 6 reworded. Worth a look.

**Judged deviations:**
- **C1** (`Math.min(fit, current.zoom)` → `fit`) is equivalent, as the
  implementer claims: the zoom-out branch is reached only when `fit < zoom`.
- The lint cap of 18 and baseline of 3169 are right on the merge base.
- The AC2 swap-only position is sound, and the `allowSwaps = false` control
  is a good addition.
- Stripping `elapsedMs`, clicking the tick box by its label, and the 12
  helper call sites in 7 specs (not 10) all hold.
- `MapView.ts` at 496 lines is under 500.

### Not checked
- **AC14, computer seats.** No e2e covers a computer seat. The `human:
  !isAiSeat(...)` wiring (`endMoveWarning.ts:79`) is unmutated, because a human
  can't click End phase during an AI turn. The hook is only in `endPhase`
  (`BoardScene.ts:2925-2934`).
- **The look (AC17):**
  - mark size, colour and depth in both views;
  - the 150 px prompt height;
  - the French fit. The tick label (about 41 characters at 13 px, no
    `wordWrap`) may run past the prompt's 248 px text width, and the
    3-line French message comes close to the tick at `top + 62`.
- **The Abandon dialog over an open warning.** `confirmDialog.ts` has no key
  handlers, so Escape or Enter under it would act on the warning.
- **B10, restore after a drag or zoom while the warning is open,** and **B12,
  tick then Cancel.** The code reads correctly; no test drives them.
- **Mouse wheel over the prompt** may scroll the hidden log. Cosmetic.

### Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and visual.
- **steps:** in `C:/Users/eric/src/heraklios-wt/83-end-move-phase-warning`,
  run `npm run dev -- --port 5283`, open `http://127.0.0.1:5283/`, then Menu →
  "Test mode (2 players, armies ready)".
  1. Move one unit one hex and click **End phase**.
  2. With the warning open, toggle the Drawn view and back.
  3. Click **Cancel**, then press Ctrl+Z.
  4. Click End phase and press **Escape**; click End phase again and press
     **Enter**.
  5. Switch to French and repeat step 1.
  6. Tick "Don't warn me again this game" and confirm. End combat. On player
     2's movement phase, End phase. End combat. On player 1's next movement
     phase, End phase.
  7. Optional: with the warning open, click Abandon, then press Enter under
     its dialog.
  8. In a game with a computer seat, let it play two turns.
- **you should see:**
  1. The camera frames every unmoved unit, zooming out only as needed, with
     a magenta mark on each. The prompt sits at the top of the log, the
     newest log lines show below it, and the selection is gone.
  2. The marks stay, on top of the drawn figures.
  3. The camera returns exactly, the marks go, and Ctrl+Z restores the
     moved unit.
  4. Escape cancels; Enter ends the phase (now combat).
  5. The French fits: watch the tick label's right edge and the message's
     third line.
  6. The log says "End-phase warning off for …". Player 2 is still warned;
     player 1 goes straight to combat.
  7. You decide whether ending the phase under the Abandon dialog is
     acceptable.
  8. No warning and no stall on the computer's turns.
- **Untuned items for you to judge:** mark 14 × 10 px, colour `#e040fb`,
  depth 14; `PROMPT_HEIGHT = 150`; the French fit.

### Verified myself vs. taken on trust

**Ran by the reviewer, at `c18c187`:**
- `npm run verify`: exit 0, `Test Files 106 passed (106)`, `Tests 1775 passed
  | 2 skipped (1777)`, lint `✖ 18 problems (0 errors, 18 warnings)`.
  `--max-warnings 18` on both the branch and `main`.
- `npm run check:intent`: PASS (above).
- Full `npm run e2e`: `52 passed (2.7m)`, 0 failed. All 6
  `end-move-warning.spec.ts` scenarios pass.
- Size: `BoardScene.ts` 3169 → 3179 (+10, the budget line), ceiling 3179.
  `MapView.ts` 496.
- **45 mutants**, each with a patch-applied guard, restored by copy. Engine
  and ui-unit mutants ran with vitest; e2e mutants with `npx playwright test
  e2e/end-move-warning.spec.ts --retries=1`.
  - **Killed:** U1, U3, U4, U6, U9, C2, C3, C4, C6, C7, C9, L1–L4, I2, E2–E10,
    E14, E15, M1, B1, B2.
  - **Surviving, needing rework:** M3, M2, E13, E1, C5, C8.
  - **Equivalent:** U2, U5, U7, U8, C1, I1, E11, E12.

**Coordinator, re-run, at `c18c187` (2026-11-25):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 18 problems (0 errors,
  18 warnings)`, `Test Files 106 passed (106)`, `Tests 1775 passed | 2 skipped
  (1777)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  83, feature)`, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `52 passed (2.1m)`. Matches.
- **Coordinator, re-run:** unit-level survivors against the full vitest suite.
  U2, U5, U7, U8, C1, C5, C8 and I1 all SURVIVED (`Tests 1775 passed`).
  Matches.
- **Coordinator, re-run:** e2e-level survivors against
  `e2e/end-move-warning.spec.ts` with `--retries=1`. M2, M3, E1 and E13 all
  SURVIVED (`6 passed`). Matches.
- After every mutant the tree was `clean` and HEAD stayed `c18c187`.

**Taken on trust:**
- that the live check will settle the visual items;
- the implementer's earlier e2e run, which is superseded.

**Mutants the rework is expected to kill** (round 2's re-check): M3, M2, E13
(after the reader fix), E1, C5, C8.
