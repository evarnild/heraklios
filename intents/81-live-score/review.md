<!-- generated-by: heraklios/review@0.2.0 -->
# §81 review — The Board shows every player's current score at all times

verdict: escalate
tier: reviewed
reviewed-commit: 77c745abff6aa0865314db711e3430d4267d9a54
round: 3
sampled: no
run: auto
live-check: owed

- **Tier: Reviewed.** `metadata.yml` sets `review_tier: reviewed`, because Q1 =
  yes changes the winner rule. The path table alone gives Attested.
- **Sampled: no.** `npm run sdlc:scan -- --sample-due auto --exclude 81`, run
  in the main checkout, printed `nth attested auto change = 14, every 3,
  sampled: no`.
- **Why escalate.**
  - The round 2 MEDIUM (R2) and the LOWs R5 and R7 are fixed, and their
    mutants are killed.
  - R8 was recorded as a survivor in rounds 1 and 2, but
    `e2e/hud-strays.spec.ts` kills it. Those rounds ran it against
    `score-panel.spec.ts` only.
  - Nothing left needs rework. The open items are LOW "worth a look", or are
    the owner's.
  - The tier is Reviewed, so the owner reads the diff.
- **Scope.** This round covers 96d154e (`git diff ff50545..HEAD`):
  `src/ui/scorePanel.ts` (+3/−2), `e2e/score-panel.spec.ts` (two scenarios
  extracted, plus the shrink case), and Progress and `auto_round`.
- **Reused from rounds 1 and 2 without re-reading:** the engine (`score.ts`,
  `endGameByTimeLimit`), the fixture replay (66 games, 3 flips), Game Over,
  i18n, devHook, the README, the rulebook reading
  (`05-rules-french-original.md:477-489`, `02-rules-transcription.md:292-305`)
  and the architecture pass.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the three round 2 items (R2, R5, R7) and the lint extraction are recorded in Progress |
| 2 | Type check | the only error is the owed live check |
| 3 | Rulebook fidelity | pass (reused from round 1); round 1's LOW on I4 is still open |
| 4 | Tests prove the rule | findings (1, LOW carried): M9 and M10 survive; R2, R5, R7, M12b, R1 and R8 are killed |
| 5 | Boundary and conventions | pass: presentation and test code only; no `GameState` shape change |
| 6 | Numbers in prose | pass for round 2's Progress entry. Round 1's `plan.md:41-44` LOW is still open and is the owner's |
| 7 | Documentation | pass: the README's load sentence now holds in both directions |
| 8 | Guardrails and hygiene | pass: lint 0 errors and 19 warnings (cap 19); no new dependency or `eslint-disable` |
| 9 | Repo footguns | pass (reused): `harnessPinned` is green in verify |
| 10 | Architecture | pass (reused); the "+30" literal LOW is open, by design |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 81, feature)
  error: A live check is owed and not recorded. Do the steps in intents/81-live-score/review.md → ## Live check, then set live_checked: <date> in intents/81-live-score/metadata.yml.
  note:  22 file(s), 996 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears.

## Findings
- **LOW, carried** `src/scenes/GameOverScene.ts:36-38`: M9 (the at-sea line
  never chosen) and M10 (`s.armyValue` printed instead of `s.score`) survive
  the full vitest run (1704 passed, 2 skipped).
  - No e2e scenario reaches Game Over. The code is correct by reading.
  - Live-check step 7 is B10's only check.
  - Worth a look: move the line choice into a pure, tested `ui` function.
- **LOW, carried** (each worth a look):
  - `e2e/score-panel.spec.ts:135`: seed 1's attack changes no score.
  - `src/engine/score.ts:4-30`: the I4 note on the alternative French reading
    of "en mer" against "sur le terrain".
  - `intents/81-live-score/plan.md:41-44`: "16" should be 19. It is above the
    Progress marker, so it is the owner's.
  - `src/ui/i18n/en.ts:154,174`, `fr.ts:140,160`: "+30" is a literal, by
    B12's design.
- **LOW, outside §81's scope** `e2e/save-load.spec.ts:83-85`: the pre-existing
  load race (rounds 1 and 2). Worth a look: a small fix intent using §81's
  `waitLoaded` pattern.
- **LOW, unrelated flake seen by the coordinator** `e2e/board-view.spec.ts:95`
  ("in Placement the Drawn view shows the staged ship as a ghost that follows
  Turn"): it failed once in a full e2e run (30.4s), and then passed 6/6 alone
  on the branch and 6/6 alone on main.
  - It is a long Placement scenario that is sensitive to load. §81 doesn't
    touch Placement.
  - It was not reproduced.
- **The R5 hover check (`score-panel.spec.ts:233-242`) is reliable.**
  - The hover strip is inside the old panel's rectangle (y 672, against an old
    top of 638 and a new top of 674).
  - On the real code, 10 of 10 points reach a hex. Under R5, 0 of 10 do.
  - A future layout change would fail loudly, never pass falsely.
  - It passed 5 of 5 with `--repeat-each 5`.

## Round 2 findings: resolution
- **MEDIUM R2** (rebuild tested for growth only): **resolved.**
  - The new shrink scenario (`score-panel.spec.ts:287`, body in
    `shrinkScenario`) kills R2. It fails at `:226` (`rect.height` 104,
    expected less than 104).
  - The rows assertion alone would not catch it, because `snapshot()` filters
    out hidden rows.
- **LOW R5** (no `destroy` on a rebuild): **resolved.** It is killed at
  `:241`, the hover check.
- **LOW R7** (`marker.setVisible(true)`): **resolved.** `snapshot()` reports
  `marker` separately (`scorePanel.ts:162-163`), and `expected()` sets it
  equal to `active`. 6 of 7 scenarios fail under R7; the wheel scenario
  compares no rows.
- **LOW R8** (no `excludeFromMainCamera`): **already covered.**
  `e2e/hud-strays.spec.ts` kills it (66 strays, Standard view).
- **LOW M9, M10 and the other LOWs:** still open, carried above.

## Not checked
- **The merged tree was not built or tested.**
  - `git merge-tree --write-tree main HEAD` against main a38213d (after §80)
    is clean.
  - In that tree, `BoardScene.ts` is 3169 against a ceiling of 3169,
    `combat.ts` is 1135 against 1135, and `devHook.ts` is 459.
  - `/ship` runs verify after the merge.
  - The §73 merge stop from round 1 still applies to whichever branch merges
    second.
- **Game Over content at runtime** (B10). M9 and M10 survive. It was checked
  only by reading, and by live-check step 7.
- **Camera exclusion of a rebuilt panel.** `hud-strays.spec.ts` scans a
  freshly started Board only, not a panel rebuilt by an in-place load. The
  rebuild uses the same `build()`, so the exclusion holds by reading.
  Live-check step 8a covers it.
- **The live-check items:**
  - readability and colours;
  - overlap with the Tables panel and the prompts;
  - the computer's turn;
  - the Drawn view and French at runtime.
- **Mutants not run:**
  - the click-swallow `pointerdown` (`scorePanel.ts:62-64`);
  - the `SHUTDOWN` clean-up (`:176-179`);
  - `MARGIN_RIGHT`;
  - the English `scoreUnits` singular.
- **R6** (no `lastKey` reset) is judged equivalent (round 2).
- **Main was not re-run by the reviewer** this round. The coordinator ran only
  `board-view.spec.ts` on main.

## Live check
- **Owed** under rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and
  visual, so the smoke suite cannot stand in. This is also the only check of
  Game Over (M9, M10) and of a rebuilt panel's camera exclusion.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/81-live-score`, run
  `npm run dev -- --port 5281 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5281/.
- **Steps:**
  1. **Start a game.** Use 3 or 4 players, one of them a computer, and give at
     least two players a ship. Play through to the Board.
     - A "Score" panel is at the bottom right, with one row per player in
       player order.
     - Each row shows a coloured square and the name, matching that player's
       counters, then "N pts" and "N units".
     - The panel covers no button, the log or the Tables panel, and it stays
       fixed when you pan or zoom.
  2. **End phases through a full round,** including the computer's turn.
     - Only the active row has the triangle and the highlight, and both move
       with the turn.
     - The figures drop as the computer's attacks resolve.
  3. **Attack until a unit is destroyed, then Undo, then Redo.**
     - That owner's points and units drop at once, come back on Undo, and
       drop again on Redo.
  4. **Open the Tables panel.** Trigger a retreat or exchange prompt, then a
     ram prompt.
     - The score panel stays, and nothing overlaps it.
  5. **Wheel, drag and click on the panel.**
     - There is no zoom, no pan and no selection.
  6. **Switch to the Drawn view, then to French** (restart Test mode).
     - The panel is in the same place.
     - Every French row fits ("Macédoine", "unités", "(+30 en mer)").
  7. **Play until only one player has ships,** or start a game where only one
     player bought ships. Press "⚑ End game" and finish the round.
     - That player's row shows "(+30 at sea)", and their points are 30 above
       their units' value.
     - Game Over lists the same figures with "(+30 at sea)", and the named
       winner agrees with them.
  8. **Load in place with a different player count.**
     - a. Save "Figure gallery (dev)" (4 players) to slot 3. Start Test mode
       (2 players), then use Save / Load to load slot 3 from the Board.
       - Four rows, and a taller panel.
       - No second copy of the panel moves when you pan or zoom.
     - b. Save that 2-player game to slot 4. Open the gallery and load slot 4
       from its Board.
       - Two rows, and a shorter panel.
       - Nothing of the old 4-row panel is left above it.
       - Hovering or clicking a hex just above the panel works normally.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** the `scorePanel.ts` mutants. Each was backed up
  and restored by copy and run against `e2e/score-panel.spec.ts`:
  - R2 (`!==` → `>`): 1 failed and 6 passed, so **killed**;
  - R5 (no `destroy`): 1 failed and 6 passed, so **killed**;
  - R7 (`marker.setVisible(true)`): 6 failed and 1 passed, so **killed**;
  - M12b (marker inverted): 6 failed and 1 passed, so **killed**;
  - R1 (rebuild disabled): 2 failed and 5 passed, so **killed**.
- **Coordinator, re-run:** R8 (no `excludeFromMainCamera`) against
  `e2e/hud-strays.spec.ts`: 1 failed, so **killed**. This confirms the
  reviewer's correction to rounds 1 and 2. `git status --short` was clean
  after.
- **Coordinator, re-run:** `npm run verify` at 77c745a. Exit 0, lint 0 errors
  and 19 warnings (cap 19), 99 files, 1704 passed and 2 skipped. Matches.
- **Coordinator, re-run:** `npm run check:intent`. The only error is the owed
  live check. Matches.
- **Coordinator, re-run:** `npm run e2e`. 39 passed and 1 failed. The failure
  was `board-view.spec.ts:95` (30.4s), not the known `save-load` flake.
  - It passed 6/6 alone on the branch and 6/6 alone on main. It is recorded
    above as a load flake that was not reproduced.
  - The reviewer's own full run was 40/40.
- **Reviewer:**
  - verify, check:intent and a full e2e run (40 passed, no flake);
  - R2, R5, R7, M12b, R1 and R8 as above;
  - M9 and M10 against the full vitest run;
  - the R5 hover probe, with an untracked copy of the spec deleted afterwards:
    10 of 10 points reached a hex on the real code, and 0 of 10 under R5;
  - `git merge-tree` against main;
  - sampling.
- **Taken on trust:**
  - rounds 1 and 2's analysis of code this rework did not change;
  - the "first draft made it 20 warnings" line in Progress;
  - everything visual.

## KonMari check
- **Record:** 1c2eba2, base af58b44, `outcome: kept`.
- **Tidied:** 40e62a9 re-wraps two doc comments that §81's edit had left
  ragged, in `src/engine/state.ts` (`winnerIds`) and
  `src/engine/combatOdds.ts`. It changes where lines break and no words. The
  diff is 12 lines in 2 files.
- **Coordinator, re-run.**
  - The diff has no changed line that isn't a comment. This was checked by
    filtering out comment lines from `git diff af58b44..40e62a9`, and nothing
    was left.
  - `npm run verify`: lint 0 errors and 19 warnings; 99 files, 1704 passed
    and 2 skipped. Matches.
  - `npm run check:intent`: the only error is the owed live check.
  - e2e was not re-run, because no file under `src/scenes/**`, `src/ui/**`,
    `src/main.ts` or `e2e/**` changed.
  - `git status --short` was clean.
- **Mutants.** None of M1–M18 or R1–R8 touches a line that changed.
- **Left alone:** `BoardScene.ts` (3169), `devHook.ts` (459), the fixture,
  `harnessPinned.test.ts`, every test assertion, and `plan.md`, so
  `size-baseline.json` is unchanged.
- **Proposed refactor intent** (in konmari.md): one shared
  `rectContains(rect, x, y)` beside `rectsIntersect` in
  `src/ui/rulesPanelLayout.ts`. The score, Tables and log panels each do this
  point-in-rectangle test themselves. It was not done, because it means
  editing two files outside the diff.

# Round 2 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: d938ae9afc139b436d246e357a150913763761ec
- round: 2
- sampled: no
- run: auto
- live-check: owed

- **Tier: Reviewed.** `metadata.yml` sets `review_tier: reviewed`, because Q1
  = yes changes the winner rule.
- **Sampled: no.** `npm run sdlc:scan -- --sample-due auto --exclude 81`, run
  in the main checkout, printed `= 14, every 3, sampled: no`.
- **Why rework and not escalate.** All three round-1 fixes work, and their
  named mutants are killed. But the new check `state.players.length !==
  this.rows.length` is tested only for growth (2 → 4). Changing it to "grow
  only" (`>`, mutant R2) passes every test, although round 1's HIGH named
  both directions. Adding the shrink test is one mechanical case. After it,
  this Reviewed tier goes to `escalate`.
- **What was reused from round 1.** Only `src/ui/scorePanel.ts` and
  `e2e/score-panel.spec.ts` changed since round 1, so round 1's analysis of
  the rest is reused: the engine, the fixture replay, Game Over, i18n,
  devHook, the README and the rulebook reading.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the three round-1 fixes and nothing else, recorded in Progress |
| 2 | Type check | the only error is the owed live check |
| 3 | Rulebook fidelity | pass (reused from round 1); round 1's LOW on I4 is still open |
| 4 | Tests prove the rule | findings (4): R2 survives (MEDIUM); R5, R7 and R8 survive (LOW); M9 and M10 still survive (LOW, carried) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | pass for the rework's Progress entry; round 1's `plan.md:41-44` LOW is still open and is the owner's |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19) |
| 9 | Repo footguns | pass (reused); `harnessPinned` is green |
| 10 | Architecture | pass (reused); the "+30" literal LOW is still open, by design |

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 81, feature)
  error: A live check is owed and not recorded. Do the steps in intents/81-live-score/review.md → ## Live check, then set live_checked: <date> in intents/81-live-score/metadata.yml.
  note:  22 file(s), 937 line(s) changed outside intents/.
```
The only error is the owed live check.

### Findings
- **MEDIUM** `src/ui/scorePanel.ts:112`: the rebuild condition is tested only
  for growth.
  - Mutant R2 (`!==` → `>`) passes all 6 `score-panel.spec.ts` scenarios.
    Under it, a 2-player save loaded in place into a 4-player Board would
    keep a 4-row panel with two empty rows. That is the other direction of
    round 1's HIGH.
  - The code is correct by reading.
  - **Needs rework:** add the shrink case to `e2e/score-panel.spec.ts`,
    mirroring the case at `:197-231`:
    1. Save a 2-player Test mode Board into slot 3.
    2. From a running "Figure gallery (dev)" Board (4 players), load it in
       place.
    3. Assert rows `[0, 1]`, `fits`, a `rect.height` smaller than before the
       load, and `expectRowsMatchEngine`.

    That kills R2.
- **LOW** `src/ui/scorePanel.ts:113`: R5 (old objects not destroyed on a
  rebuild) survives, because `snapshot()` reads only the new rows.
  - On a shrink, the old, taller and interactive rectangle would stay drawn
    and swallow map clicks.
  - Worth a look: in the shrink case, click a hex just above the new panel
    and expect a selection.
- **LOW** `src/ui/scorePanel.ts:131`/`:162`: R7 (`marker.setVisible(true)`, a
  triangle on every row) survives. `active: highlight && marker` cannot see
  the marker on inactive rows.
  - Worth a look: report `marker: r.marker.visible` separately and assert it
    equals `active`.
- **LOW** `src/ui/scorePanel.ts:69`: R8 (no `excludeFromMainCamera`)
  survives. The panel would then also be drawn by the zoomable camera, as a
  ghost. The live check covers it. Worth a look.
- **LOW, carried from round 1 and unchanged:**
  - M9 and M10 at `GameOverScene.ts:36-38`;
  - seed 1 at `score-panel.spec.ts:134`;
  - the I4 note at `score.ts:4-30`;
  - "16" against 19 at `plan.md:41-44` (the owner's);
  - the "+30" literals in `en.ts`/`fr.ts`.

  Worth a look.
- **LOW, outside §81's scope** `e2e/save-load.spec.ts:83-85`: the flake is
  pre-existing.
  - It failed once on main in 3 full runs, with the same assertion.
  - It passes alone, 5/5 on both main and the branch.
  - Its cause is the race named in round 1. §81's `waitLoaded`
    (`score-panel.spec.ts:61`) is the fix.
  - Worth a look: a small fix intent.

### Round 1 findings: resolution
- **HIGH** (the panel not rebuilt on an in-place load): **resolved for
  growth.** `build(count)` now runs from `refresh()` on a count change, after
  destroying the old objects. The e2e at `score-panel.spec.ts:197` kills R1,
  R3 and R4. Shrinking is the residual MEDIUM above.
- **MEDIUM** (load tests read too early): **resolved.** `waitLoaded` waits for
  `Game loaded.`, and both load cases use it.
- **MEDIUM** (M12b): **resolved.** `snapshot()` reports `highlight &&
  marker`, and M12b fails 5 of the 6 scenarios. A related LOW is R7.
- **The LOWs and the nit:** still open, carried above.

### Not checked
- **The merged tree was not built.**
  - `git merge-tree` against main (a38213d, after §80) is clean.
  - Both sides touched `README.md`, `scripts/size-baseline.json`,
    `BoardScene.ts`, `en.ts` and `fr.ts`.
  - In the merged tree, `BoardScene.ts` is 3169 against a ceiling of 3169,
    and `combat.ts` is 1135 against 1135.
  - `/ship` runs verify after the merge.
- **The panel shrinking on an in-place load at runtime** (R2). It is correct
  by reading. Live-check step 8b covers it.
- **Visual leftovers from a rebuild** (R5, R8), and Game Over content (M9,
  M10).
- **The live-check items:**
  - readability and colours;
  - overlap with the Tables panel and the prompts;
  - the computer's turn.
- **Mutants not run:**
  - the click-swallow `pointerdown`;
  - the `SHUTDOWN` clean-up;
  - `MARGIN_RIGHT`;
  - the English singular.
- **R6** (no `lastKey` reset) is judged equivalent.

### Live check
- **Owed** under rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and
  visual. This is the only check of Game Over (M9, M10), of the panel
  shrinking, and of R5 and R8.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/81-live-score`, run
  `npm run dev -- --port 5281 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5281/.
- **Steps:**
  1. Start a game with 3 or 4 players, one of them a computer. Give at least
     two players a ship, and play through to the Board.
     - The "Score" panel is at the bottom right, with one row per player in
       player order.
     - Each row shows a coloured square and the name matching that player's
       counters, then "N pts" and "N units".
     - The panel covers no button, the log or the Tables panel, and it stays
       fixed on pan and zoom.
  2. End phases through a full round, including the computer's turn.
     - Only the active row has the triangle and the highlight, and both move
       with the turn.
     - The figures drop as the computer's attacks resolve.
  3. Destroy a unit, then Undo, then Redo.
     - The points and unit count drop, come back, and drop again.
  4. Open the Tables panel, and trigger a retreat or exchange prompt and a
     ram prompt.
     - The panel stays, and nothing overlaps it.
  5. Wheel, drag and click on the panel.
     - There is no zoom, no pan and no selection.
  6. Switch to the Drawn view, then to French.
     - The panel is in the same place, and every French row fits.
  7. Play until only one player has ships, press "End game", and finish the
     round.
     - That player's row shows "(+30 at sea)", with their points 30 over
       their unit value.
     - Game Over shows the same figures with "(+30 at sea)", and the winner
       agrees with them.
  8. Load a save in place with a different player count.
     - a. Save "Figure gallery (dev)" (4 players) to slot 3. Start Test mode
       (2 players), then use Save / Load to load slot 3.
       - The panel shows four rows and grows taller.
       - No second copy of the panel moves when you pan or zoom.
     - b. Save that 2-player game to slot 4. Open the gallery and load slot 4
       from its Board.
       - The panel shows two rows and is shorter.
       - Nothing of the old 4-row panel is left above it.
       - A click on a hex just above the panel works normally.

### Verified myself vs. taken on trust
- **Coordinator, re-run:** the `scorePanel.ts` mutants. Each was backed up
  and restored by copy and run against `e2e/score-panel.spec.ts`.
  - M12b (marker inverted): 5 failed and 1 passed, so it was **killed**.
  - R1 (rebuild disabled): 1 failed and 5 passed, so it was **killed**.
  - R2 (grow only), R5 (no destroy), R7 (marker always on) and R8 (no camera
    exclude): 6 passed each, so all survived.

  All six match the reviewer.
- **Coordinator, re-run:** M9 and M10 against the full vitest suite. 1704
  passed each, so both survived, matching the reviewer. `git status --short`
  was clean after.
- **Coordinator, re-run:** `npm run verify` at d938ae9. Exit 0, lint 0 errors
  and 19 warnings (cap 19), 99 files, 1704 passed and 2 skipped. Matches.
- **Coordinator, re-run:** `npm run check:intent`. The only error is the owed
  live check. Matches.
- **Coordinator, re-run:** `npm run e2e`. 38 passed and 1 failed. The failure
  was `save-load.spec.ts:57`, the pre-existing flake. This matches the
  reviewer's run 1 on the branch, and the reviewer saw the same failure on
  main.
- **Reviewer:**
  - Verify, check:intent and e2e: 3 full runs on the branch (38/1, 39, 39)
    and 3 on main (33, 32/1, 33).
  - `save-load --repeat-each 5`: 5/5 on both.
  - The mixed set: 24/24.
  - 12 mutants, all as above. R3, R4 and M12a were killed; R6 is
    equivalent.
  - Merge-tree against main is clean.
  - The Progress numbers were reproduced.
- **Taken on trust:** round 1's analysis of the unchanged code, and
  everything visual.

- **Note added in round 3:** R8 was later found killed by `e2e/hud-strays.spec.ts`.

# Round 1 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: 6f12eb9d2eb5b0e96bd51dfea9183fe3e7306f6a
- round: 1
- sampled: no
- run: auto
- live-check: owed

- **Tier: Reviewed.** `metadata.yml` sets `review_tier: reviewed` because Q1 =
  yes changes the winner rule; the path table alone gives Attested. Once the
  rework is re-reviewed, the verdict will be `escalate`, for the owner's diff
  read.
- **Sampled: no.** `npm run sdlc:scan -- --sample-due auto --exclude 81`, run
  in the main checkout, printed `nth attested auto change = 14, every 3,
  sampled: no`.
- **The rule work is sound.** The bonus reading is recorded where it is
  implemented, with the quote. Replaying all 66 pinned games shows the
  fixture change flips exactly the three games named.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the only unplanned change, `messages.test.ts` `SAME_IN_BOTH`, is recorded in Progress |
| 2 | Type check | pass (PASS) |
| 3 | Rulebook fidelity | findings (1, LOW) |
| 4 | Tests prove the rule | findings (3) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | findings: README promises a refresh on "a load", which is broken for an in-place load (part of the HIGH) |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19); no dependency; names reach Phaser `setText` only |
| 9 | Repo footguns | pass: `harnessPinned` passes on the three-line fixture, so the traces are byte-identical |
| 10 | Architecture | findings (1, LOW) |

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 81, feature)
  note:  22 file(s), 887 line(s) changed outside intents/.
```

### Findings
- **HIGH** `src/ui/scorePanel.ts:48-64, 108, 177-178`: the panel builds its
  rows and rectangle once, from the player count when the scene is created.
  - **The cause.** `BoardScene.loadInPlace` (`BoardScene.ts:985-997`) loads
    without restarting the scene, so a save with a different number of
    players keeps the old panel. `refresh` then draws only
    `this.rows.length` rows and silently drops the rest.
  - **Reproduced by the reviewer** with a throwaway spec:
    - a 4-player save, loaded from the Board into a 2-player game, gave
      `state().players.length` 4;
    - `scorePanel()` returned 2 rows, with a 2-player rectangle.
  - **The other direction:** a 2-player save loaded into a 4-player game
    leaves two empty rows.
  - **What it breaks:**
    - B4, B6 and B8;
    - the README sentence promising a refresh on any load.
  - **Not affected:** a load from the Menu, because `create()` adopts the save
    before the panel is built.
  - **Needs rework:**
    - when `state.players.length` differs from the built row count, rebuild
      the row objects and resize the background and rectangle (or build four
      rows once and size from the current count);
    - add an e2e case where an in-place load of a save with a different
      player count shows one row per player and `fits`.
- **MEDIUM** `e2e/score-panel.spec.ts:183-186`: the bonus-after-load test
  waits for nothing the load changes.
  - Its waits (`scenes().includes('Board')`, `waitIdle`, two frames) are
    already true before the load lands, while `SaveLoadPanel.loadFrom`
    (`saveLoadPanel.ts:339-354`) awaits `readSave` over HTTP. So the test can
    read the panel before the load is applied.
  - `save-load.spec.ts:83-85` has the identical race, which explains the
    implementer's failures.
  - **Needs rework:** after the Load click, wait on the load itself. Either
    the log line `Game loaded.` (`logEntries()`), or the state showing player
    1's ships destroyed.
- **MEDIUM** `src/ui/scorePanel.ts:120`: mutant M12b survives.
  - M12b shows the triangle marker on every row except the active one.
  - It survives because `snapshot()` (`:153`) derives `active` from
    `r.highlight.visible` alone, so the marker B5 requires is never
    observed.
  - **Needs rework:** report the marker as well, either as
    `active: r.highlight.visible && r.marker.visible` or as a separate
    `marker` field asserted equal to `active`. This should kill M12b.
- **LOW** `e2e/score-panel.spec.ts:127-153`: the combat, undo and redo
  scenario (seed 1) passes against a panel that never refreshes (M13).
  - Seed 1's attack changes no score. M13 is killed only by the turn and load
    scenarios.
  - Worth a look: a seed whose attack destroys a unit, or an assertion that
    the figures change.
- **LOW** `src/scenes/GameOverScene.ts:33-38`: M9 (no at-sea note) and M10
  (`armyValue` shown instead of `score`) survive.
  - No test reaches Game Over, which the plan accepted. The code is correct
    by reading, and live-check step 7 is B10's only check.
  - Worth a look: move the line choice into a pure, tested `ui` function.
- **LOW** `src/engine/score.ts:4-30`: the interpretation comment doesn't note
  one reading of the French.
  - "en mer" is contrasted with "sur le terrain", and the bonus "s'additionnera
    à d'éventuelles unités présentes sur le terrain". That suggests a fleet's
    own value might not count, with the 30 standing in for it.
  - The engine has always counted ships in `armyValue`, and the spec kept
    that on purpose (B1, B7, I4), so this is not a §81 deviation.
  - Worth a look: one line in I4 noting the alternative reading, and perhaps
    a follow-up intent.
- **LOW** `intents/81-live-score/plan.md:41-44`: the plan says "16 more games"
  hold the bonus without a change of winner. The replay counts 19, and so
  does the plan's own list. The line is above the Progress marker, so it is
  the owner's to correct. Worth a look.
- **LOW** `src/ui/i18n/en.ts:154,174`, `fr.ts:140,160`: the bonus is
  `NAVAL_BONUS_POINTS` in code but a literal "+30" in four strings. The spec's
  B12 fixed those strings, so this is by design. Worth a look: pass the
  amount in.
- **Nit:** `README.md:671-675`, the one-line "The bonus does not change that"
  paragraph.

### Not checked
- **The live check (AC10):**
  - readability and colours;
  - overlap with the Tables panel and the prompts;
  - the computer's turn.
- **Game Over content at runtime** (B10). M9 and M10 survive; it was checked
  only by reading.
- **The `save-load.spec.ts` flake was not reproduced.**
  - Branch: 10/10, then 42/42 with neighbours.
  - Main: 16/16.
  - Its cause is established by reading (the MEDIUM above).
- **Merge with §73:** `size-baseline.json` conflicts, and §73's `devHook.ts`
  is at exactly 500, so §81's +5 would make 505. The plan makes this a stop
  for whichever branch merges second. §80 has since merged (`e432204`) and
  touched `BoardScene.ts:2010` and `size-baseline.json`, so this branch must
  re-check its merge.
- **Not mutated:**
  - `excludeFromMainCamera`;
  - the click-swallow `pointerdown`;
  - the `SHUTDOWN` clean-up;
  - `MARGIN_RIGHT`;
  - the English `scoreUnits` singular.

### Live check
- **Owed** under rule 1 (`src/scenes/**`, `src/ui/**`). It is new and visual,
  and it is the only check of Game Over (M9, M10).
- **Setup:** in `C:/Users/eric/src/heraklios-wt/81-live-score`, run
  `npm run dev -- --port 5281 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5281/.
- **Steps:**
  1. Start a game with 3 or 4 players, one of them a computer. Give at least
     two players a ship, and go through to the Board.
     - **Expect:** a "Score" panel at the bottom right, with one row per
       player in player order. Each row shows a coloured square and the name,
       matching that player's counters, then "N pts" and "N units".
     - It covers no button, the log or the Tables panel, and it stays fixed
       when you pan or zoom.
  2. End phases through a full round, including the computer's turn.
     - **Expect:** the active row has a triangle and a highlight, and both
       move with the turn.
     - Victims' figures drop as the computer's attacks resolve.
  3. Attack until a unit is destroyed, then Undo, then Redo.
     - **Expect:** the owner's points and units drop at once, come back on
       Undo, and drop again on Redo.
  4. Open the Tables panel and trigger a retreat or exchange prompt, then a
     ram prompt.
     - **Expect:** the panel stays, and nothing overlaps it.
  5. Wheel, drag and click on the panel.
     - **Expect:** no zoom, no pan, no selection.
  6. Switch to the Drawn view, then to French (restart test mode).
     - **Expect:** the panel is in the same place, and every French row fits
       ("Macédoine", "unités", "(+30 en mer)").
  7. Play until only one player has ships, or start a game where only one
     player bought ships. Then press "End game" and finish the round.
     - **Expect:** "(+30 at sea)" on that player's panel row, with their
       points 30 above their units' value.
     - Game Over lists the same figures with "(+30 at sea)", and the named
       winner agrees with them.
  8. After the rework: from a 2-player Test mode Board, use Save / Load to
     load a 4-player save (save the "Figure gallery (dev)" game to a slot
     first).
     - **Expect:** four rows, a taller panel, and every row fitting.

### Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 6f12eb9. Exit 0, lint 0
  errors and 19 warnings (cap 19), 99 files, 1704 passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. PASS. Matches.
- **Coordinator, re-run:** `npm run e2e`. 38 passed (59.1s). Matches.
- **Coordinator, re-run:** the surviving mutants, each backed up and restored
  by copy.
  - M9 (no at-sea line): vitest 1704 passed, survived.
  - M10 (`armyValue` printed): vitest 1704 passed, survived.
  - M12b (marker inverted): `score-panel.spec.ts` 5 passed, survived.

  `git status --short` was clean after. All three match the reviewer.
- **Reviewer:**
  - verify, check:intent and e2e with the same counts.
  - The fixture diff: exactly 3 lines, at lines 1527, 1722 and 2176.
  - Fixture derivation, replaying all 66 games:
    - the old rule reproduces main;
    - the new rule reproduces the branch fixture with 0 mismatches;
    - 3 flips, and 19 games with a bonus but no change of winner.
  - The rulebook read at `05-rules-french-original.md:477-489` and
    `02-rules-transcription.md:292-305`.
  - Sizes: `BoardScene.ts` 3169, its ceiling lowered to match; `devHook.ts`
    459.
  - Merge-tree against main and §77 is clean; against §73 it conflicts.
  - The in-place-load probe, with a screenshot.
  - 19 mutants: 16 killed (M1–M8, M11, M12a, M13–M18), 3 survived (M9, M10,
    M12b).
- **Taken on trust:**
  - the implementer's 2-in-3 `save-load` failures;
  - everything visual.
