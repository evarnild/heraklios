<!-- generated-by: heraklios/review@0.2.0 -->
# §81 review — The Board shows every player's current score at all times

verdict: rework
tier: reviewed
reviewed-commit: 6f12eb9d2eb5b0e96bd51dfea9183fe3e7306f6a
round: 1
sampled: no
run: auto
live-check: owed

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

## Passes
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

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 81, feature)
  note:  22 file(s), 887 line(s) changed outside intents/.
```

## Findings
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

## Not checked
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

## Live check
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

## Verified myself vs. taken on trust
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
