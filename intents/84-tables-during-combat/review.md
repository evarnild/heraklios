<!-- generated-by: heraklios/review@0.2.0 -->
# §84 review — The Tables panel stays available while a combat is being resolved

verdict: attest
tier: attested
reviewed-commit: 9995386
round: 2
sampled: no
run: auto
live-check: owed

The rework resolves every round 1 finding that needed rework:
- **F1:** the full e2e is green.
- **F2:** Escape has one route. With the Tables panel open it closes only the
  panel; with the panel closed it still cancels the End-phase warning (§83
  AC7); with no warning it does nothing.
- **F4, F5:** E5 and E10 are now killed.
- **F3:** decided by the owner in round 1 (accept).

Every new mutant on the changed lines is killed. E8 survives as an
equivalent mutant, and E11 because it is visual only. One new LOW is left:
two stale doc comments (F13), for the KonMari step.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. B6's Escape rule now holds for §83's warning too; F3 was accepted by the owner. |
| 2 | Type check | pass. The only error is the owed live check, which is the owner's. |
| 3 | Rulebook fidelity | pass. Display only. |
| 4 | Tests prove the rule | pass. 9 mutants: 7 KILLED, plus E8 (equivalent) and E11 (visual, covered by the live check). |
| 5 | Boundary and conventions | pass. The scene only routes the key; `EndMoveWarning.cancel()` is a one-line delegate. |
| 6 | Numbers in prose | pass. The Progress note's 1828 tests in 110 files, 70 e2e scenarios and `BoardScene` 2833 (main 2834) all reproduce. |
| 7 | Documentation | finding F13 (LOW). README `:562-563` and `:880-891` and CLAUDE.md are accurate. |
| 8 | Guardrails and hygiene | pass. `✖ 17 problems (0 errors, 17 warnings)`, cap 17. |
| 9 | Repository footguns | pass |
| 10 | Architecture | F12 left (LOW, principle 6); fine, see below. |

## Type check
```
type-check: FAIL (intent 84, feature)
  error: A live check is owed and not recorded. Do the steps in intents/84-tables-during-combat/review.md → ## Live check, then set live_checked: <date> in intents/84-tables-during-combat/metadata.yml.
  note:  16 file(s), 473 line(s) changed outside intents/.
exit: 1
```
The live check is the only error: it is the owner's gate, not a rework finding.

## Findings
- **F13 LOW** `src/ui/rulesPanel.ts:78` and `:95`: two doc comments still
  describe the removed suppression.
  - `:78` says "Shown now: open and not hidden by a pending decision.";
    `:95` ends "No effect while hidden."
  - No hidden state remains, and `isOpen()` now drives Escape at
    `BoardScene.ts:701`.
  - Worth a look: a two-line mechanical fix, for the KonMari step.
- **F12 LOW, left** `src/ui/rulesPanelLayout.test.ts:40-52`: the chooser sizes
  are still copied by hand. The e2e pins the real boxes (y 368, 452), so leaving
  it is acceptable. The skip's reason doesn't hold, though: the change replaces
  `320` and `340` in place, so `BoardScene` would grow by 0 lines.
  - Worth a look, not blocking.
- **F10 LOW, left:** the owner's spec text (line 55, "15 advance rows"). No
  code effect.
- **Round 1, resolved:**
  - F1: `end-move-warning.spec.ts:252` passes; the README and both comments
    are fixed.
  - F2: fixed (below).
  - F4 and F5: E5 and E10 KILLED.
  - F6: `rules-panel.spec.ts:47` asserts the button count after settle; the
    `:138` comment is true.
  - F7: the figures reproduce.
  - F8: the comment is rewritten; the line stays as an equivalent survivor.
  - F9: S1 KILLED.
  - F11: fixed.
- **F2's behaviour checks:**
  - Escape with the panel closed over the warning cancels it
    (`end-move-warning.spec.ts:116-120`; C1 and C2 fail it).
  - Escape with no warning reaches `cancel()` → `close(false)`, which
    returns at once (`endMoveWarning.ts:216`), as before.
  - Escape during a retreat or exchange prompt still only closes the panel
    (`tables-during-combat.spec.ts:90-93`, `:180`).
  - Enter still confirms (`endMoveWarning.ts:68`, `:121-124`).
  - `grep` finds no other ESC listener in `src/`.

## Mutants
| Mutant | Target | Result | Killed by |
| --- | --- | --- | --- |
| E5 `clearRolled()` removed from `commitEndPhase` | `BoardScene.ts:2596` | KILLED | `tables-during-combat.spec.ts:152` "ending the phase drops the rolled mark (B7)" |
| E10 `reset()` keeps the roll | `rulesPanel.ts` | KILLED | `tables-during-combat.spec.ts:161` "a load drops the rolled mark (B8)" |
| F2a the warning's own ESC re-added | `endMoveWarning.ts:68` | KILLED | `end-move-warning.spec.ts:252` |
| F2b close the panel AND cancel | `BoardScene.ts:701` | KILLED | `end-move-warning.spec.ts:252` |
| C1 `cancel()` emptied | `endMoveWarning.ts:205-207` | KILLED | `end-move-warning.spec.ts:71` and `:252` |
| C2 else-branch dropped | `BoardScene.ts:701` | KILLED | `end-move-warning.spec.ts:71` and `:252` |
| E8 `setAttack` keeps the roll | `rulesPanel.ts:132` | SURVIVED (equivalent, as in round 1) | — |
| E11 the marked-cell stroke removed | `rulesPanel.ts:246` | SURVIVED (visual only; live check) | — |
| S1 `setTab` ignored while closed | `rulesPanelState.ts` | KILLED | `rulesPanelState.test.ts` |

## Not checked
- **The look:** the rolled cell, the choosers' lower position, the Drawn view.
  Live check.
- **"Never cuts an animation short"** (B6): e2e runs with animations off.
- **Enter continuing a drift with the panel open,** and a click on the panel
  body during a drift.
- **B9 with a computer seat:** traced in code in round 1.
- **A 1600-wide canvas in the browser:** §88 is not merged.
- **Enter with the warning and the panel both open:** the warning confirms and
  the scene's `resolveDriftContinue` also fires, a no-op outside a drift. This
  is as on `main`; no scenario has the panel open here.

## Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`); the change is new and visual.
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/84-tables-during-combat`, run `npm
     run dev -- --port 5284`, open http://127.0.0.1:5284/, and choose
     **Combat test mode (units face to face, 2 hexes)**.
  2. Click **Tables**, then **End phase** into combat. The panel opens on
     Land combat.
  3. Build and resolve attacks. Test mode keeps Undo across the roll, so undo
     and resolve until you have seen a DR retreat, a push, an advance offer,
     an EX exchange and an elephant drift. `__heraklios.seed(n)` in the
     console varies the die.
  4. At each prompt: switch tabs, click on the panel, press Escape, reopen
     with **Tables**, then answer the prompt.
  5. Toggle to the **Drawn** view and repeat at least the retreat and the
     drift.
  6. After a rolled attack, click **End phase**.
  7. Menu → **Test mode (2 players)**. Click **Tables**, move one or two
     units, then **End phase** with units unmoved.
     - Press Escape, then Escape again.
     - With the panel closed: End phase, then Escape once.
     - End phase, then Enter.
     - With the panel open: End phase, then **Cancel**.
- **you should see:**
  - The panel stays open on its tab through every prompt, and never opens or
    changes tab by itself.
  - Highlights outside the panel stay clickable.
  - The advance and exchange boxes sit with their top at about y 286, whether
    or not the panel is open.
  - Drift Continue, Space and Enter work with the panel open.
  - Clicks on the panel and Escape never answer or skip anything.
  - The Land combat tab keeps the rolled attack's column and one outlined
    bright cell at the die face's row after the modifier, until a new
    attacker is clicked or the phase ends (step 6: it goes).
  - In step 7:
    - the first Escape closes only the panel, and the warning and its marks
      stay; the second cancels the warning, and you're still in movement;
    - with the panel closed, one Escape cancels the warning;
    - Enter ends the phase;
    - Cancel leaves the panel open on its tab.
  - The marks may sit under the open panel (F3, accepted).
  - The look and spacing are acceptable in both views.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `9995386`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 110 passed (110)`, `Tests 1828 passed | 2 skipped (1830)`.
- `npm run check:intent`: the FAIL above (live check only).
- Full `npm run e2e`: `1 failed` (`save-load.spec.ts:57`, §86's flake, whose
  fix is on `main` and not on this branch), `69 passed (2.8m)`. Re-run alone:
  `1 passed`.
- 9 mutants as above, each restored by copy; the tree was clean after each.
- The rework diff, the append-only `plan.md`, `BoardScene.ts` 2833 vs `main`
  2834, and no other ESC listener in `src/`.

**Coordinator, re-run, at `9995386` (2026-11-25 15:45–16:03):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 110 passed (110)`, `Tests 1828 passed | 2 skipped
  (1830)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `70 passed (4.4m)`. Matches;
  the reviewer's single failure was the §86 flake, which did not recur.
- **Coordinator, re-run:** the mutants against `end-move-warning.spec.ts`,
  `tables-during-combat.spec.ts` and `rules-panel.spec.ts`:
  - E5 KILLED by `tables-during-combat.spec.ts:152`;
  - E10 KILLED by `:161`;
  - F2a and F2b KILLED by `end-move-warning.spec.ts:252`;
  - C1 and C2 KILLED by `end-move-warning.spec.ts:71` and `:252`;
  - E8 SURVIVED and E11 SURVIVED (`15 passed` each).

  All match. The tree was `clean` after each.

**Taken on trust:**
- round 1's probes (F2, F3) and B9's code trace;
- S1 (unit only, killed in the reviewer's run inside a full vitest pass);
- the seeds' die faces (checked by `combatScenarios.test.ts`, inside verify).

## KonMari check
**outcome: kept** (`konmari.md`, record `1de16b3`, base `7a16fb1`). Two
tidy-ups:
- `0154c49`: the Tables panel's `isOpen` and `toggle` comments made true (F13).
- `ebbf4d6`: the advance and exchange chooser sizes defined once,
  `ADVANCE_CHOOSER` and `EXCHANGE_CHOOSER` in `src/ui/boardPrompts.ts`. They
  are used in place in `BoardScene.ts` and in `rulesPanelLayout.test.ts`
  (F12, principle 6). `BoardScene.ts` stays at 2833 lines. No killed-mutant
  line moved.

**The B16 check, at `1de16b3` (2026-11-25 16:22–16:36):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 110 passed (110)`, `Tests 1828 passed | 2 skipped
  (1830)`. The counts are unchanged.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only (`16 file(s), 493 line(s)`).
- **Coordinator, re-run:** full `npm run e2e`. `70 passed (4.0m)`.
- **Coordinator, re-run:** the killed mutants in the tidied files, re-applied
  by line text.
  - **`rulesPanelLayout.ts`**, against `rulesPanelLayout.test.ts`, whose sizes
    now come from the constants: U5, U6, U7, U8 and U9 all **KILLED**.
  - **`BoardScene.ts` and `rulesPanel.ts`**, against `end-move-warning.spec.ts`,
    `tables-during-combat.spec.ts` and `rules-panel.spec.ts`:
    - E6 KILLED by `tables-during-combat.spec.ts:117`, on the chooser line the
      tidy-up rewrote;
    - E7 KILLED by `:170`, on the chooser line the tidy-up rewrote;
    - E5 KILLED by `:152`;
    - E10 KILLED by `:161`;
    - F2b KILLED by `end-move-warning.spec.ts:252`;
    - C2 KILLED by `:71` and `:252`.
  - The tree was `clean` after each.

**The reviewer's read of `7a16fb1..1de16b3`: pass.**
- Both tidy-ups are within §84's lines or the code they duplicate.
- The chooser sizes are identical, character by character: advance 320 and
  76 + 26n; exchange 340 and 110 + 24n.
- The layout test still pins the placement against fixed literals (top 286,
  centre w/2, no intersection with the panel), so it didn't become
  tautological. Only the constants' own values are no longer pinned by the
  unit test; the e2e's box positions still pin them.
- No size, lint or dependency change. `konmari.md` is exact.

# Round 1 (history)

verdict: rework
tier: attested
reviewed-commit: d575efa
round: 1
sampled: no
run: auto
live-check: owed

The rolled cell, the choosers' placement, the removed suppression and the
panel never answering a decision all work and are proven. Of 21 mutants, 17
are killed.

The rebase onto §83 left three gaps:
- the full e2e is red, because §83's scenario still expects the panel to hide
  during the End-phase warning;
- Escape over that warning closes the panel **and** cancels the warning;
- the warning's marks can sit under the open panel.

The owner decided the last one in this conversation: **accept it** (the
answer is below). The rest is mechanical rework.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings: F1 and F2 (B3/B6 not carried through to §83's warning after the rebase), F7 |
| 2 | Type check | pass. PASS, with no ROUTE. |
| 3 | Rulebook fidelity | pass. Display only. The rolled cell uses the engine's `rawDieRoll + terrainModifier`, clamped to 1–6, as `combat.ts:183-185` and `:368-369` do. |
| 4 | Tests prove the rule | findings: E5 and E10 survive (F4, F5), E8 is equivalent (F8) |
| 5 | Boundary and conventions | pass. Pure helpers in `ruleTables.ts` and `rulesPanelLayout.ts`; the scene only wires them. No `GameState`, save or undo change. |
| 6 | Numbers in prose | findings: F7, F10 |
| 7 | Documentation | findings: F1's README and comment staleness for §83 |
| 8 | Guardrails and hygiene | pass. 17 lint warnings, cap 17; no dependency. |
| 9 | Repository footguns | pass |
| 10 | Architecture | finding: F12 (LOW, principle 6) |

## Type check
```
type-check: PASS (intent 84, feature)
  note:  14 file(s), 405 line(s) changed outside intents/.
exit: 0
```

## Findings
- **F1 MEDIUM** `e2e/end-move-warning.spec.ts:252-264`: the full `npm run e2e`
  is red. "The Tables panel hides while the warning is open and returns as it
  was (seed 1)" fails at `:259` (`expect((await panel()).open).toBe(false)`,
  received `true`).
  - The rebase onto §83 was not followed by an e2e run.
  - Stale text from the same cause:
    - `README.md:562-563` ("the Tables panel hides and returns as it was");
    - `src/ui/endMoveWarning.ts:12` ("the Tables suppression");
    - `e2e/end-move-warning.spec.ts:57`.
  - Spec B3 includes "§83's End-phase warning, once merged".
  - Needs rework:
    - rewrite that scenario to assert the panel stays open, on its tab, while
      the warning is open and after Cancel;
    - fix the README bullet and the two comments.
- **F2 MEDIUM** `src/scenes/BoardScene.ts:701` and `src/ui/endMoveWarning.ts:66`:
  Escape with the Tables panel open over the End-phase warning closes the
  panel **and** cancels the warning.
  - Two independent `keydown-ESC` listeners both fire.
  - Reproduced by a throwaway probe (seed 1): before Escape
    `{"warnOpen":true,"marked":5,"panel":true}`, after
    `{"warnOpen":false,"panel":false}`.
  - This breaks spec B6 ("closes the panel and does nothing else") and the
    spec's Out of scope, which applies B6 to the warning.
  - Needs rework:
    - one Escape route: with the panel open, close it and stop; otherwise the
      warning's Escape cancels it;
    - an e2e assertion for it.
- **F3 MEDIUM, decided** `src/ui/endMoveWarning.ts:94-97` with
  `src/ui/MapView.ts:474-483`: with the panel open, the warning's magenta marks
  can sit under it. `frameWorldBox` ignores the panel rectangle; in the probe,
  3 of 5 flagged units are under it at seeds 1–5.
  - **The owner's decision (2026-11-25, in this conversation): "Accept it"**,
    as B5 accepts retreat highlights under the panel. After F2's fix, a first
    Escape closes only the panel. No code change; the spec stands.
- **F4 MEDIUM** `src/scenes/BoardScene.ts:2596` (B7, "or the phase ends"):
  mutant E5 (the `commitEndPhase` `clearRolled()` removed) survives the full
  e2e.
  - Needs rework: after a resolved attack, end the phase and assert that
    `rulesPanel().highlight` is `null`.
- **F5 LOW** `src/ui/rulesPanel.ts:156` (`reset()` drops the roll; B8): mutant
  E10 survives the full e2e.
  - Needs rework: assert `rulesPanel().highlight === null` after a load that
    follows a rolled attack.
- **F6 LOW** `e2e/rules-panel.spec.ts:37-47,137,144` (AC6, "unchanged").
  - The edit is what B1 and B7 force. Keeping the spec unchanged would mean
    failing B1 and B7, which the owner chose, so this is not a decision.
  - But the post-settle tab-button-count check was dropped, and the comment
    at `:137` ("Resolving the attack clears the highlight") is now false.
  - Needs rework: keep the button-count assertion after `settle`, and fix the
    comment.
  - Correcting AC6's wording is optional and the owner's.
- **F7 LOW** `plan.md` Progress: the hashes `e59780c`… `ef594f2` and the
  counts ("2824 → 2823", "1800 passed", "e2e 61 passed") are pre-rebase.
  - Needs rework: append a dated Progress note with the post-rebase values
    (commits `c7a2b4b`…`a7cb274`; 2834 → 2833; 1828 tests in 110 files; 68
    e2e scenarios).
- **F8 LOW** `src/ui/rulesPanel.ts:132` (`if (attack) this.rolled = null;`):
  mutant E8 is an equivalent survivor, because `syncRulesPanel:1862` always
  clears first.
  - Worth a look: drop the line, or say in its comment that the scene's line
    acts.
- **F9 LOW** `src/ui/rulesPanelState.test.ts:17`: the name says "a tab can be
  chosen while closed", but the test never calls `setTab` while closed.
  - Needs rework: add the call and its assertion, or shorten the name.
- **F10 LOW** `spec.md:55`: "15 advance rows" is off by one (76 + 15·26 = 466 >
  464, so 14 fit). It has no code effect; the clamp handles it.
  - Worth a look; the spec is the owner's.
- **F11 LOW** `e2e/tables-during-combat.spec.ts:16-17`: the dice doc comment is
  orphaned above `WITH_SPARE` instead of above `DIE`. Nit.
- **F12 LOW** `src/ui/rulesPanelLayout.test.ts:40-52` (principle 6): the
  chooser sizes are copied by hand from `BoardScene.ts:2022-2024` and
  `:2335-2337`. The e2e pins the real boxes (y 368, 452).
  - Worth a look: export the sizes from `boardPrompts.ts`, as
    `RAM_PROMPT`/`BOARD_PROMPT` are.

**The coordinator's specific points**, as the reviewer answered them:
- **The extra `clearRolled()` in `syncRulesPanel`** (`:1862`) matches B7's
  "a new attacker or target click". It never clears during the same attack's
  resolution, and never on a computer seat's turn: `applyAiAction` never fills
  `attackGroup`. E2 and E3 are killed.
- **B4:** `chooserRect` is top = max(0, min(286, H − h)), with unit cases at
  1100 and 1600 wide and both clamps. All five `chooserRect` mutants, plus E6
  and E7, are killed.
- **The rebase resolution:** at the merge base 209f2da, `BoardScene.ts` is
  2834 lines with a 2834 ceiling. The branch has 2833 lines and a 2833
  ceiling, a net change of −1. Correct.
- **The plan's missing Progress marker and its wrapped `budget:` line** don't
  matter: Progress is a pure append, and no script reads it. A future plan
  should write `budget:` as a bare `- budget: …` line (`BUDGET_RE`,
  `scripts/size-budget-lib.mjs:52`).
- **The deviations:** `WITH_SPARE`, `rawDieRoll` and no budget line are all
  fine.

## Mutants
**Engine and layout, full vitest suite:** all KILLED.
- U1, U2 and U3 in `ruleTables.ts:150`, killed by `ruleTables.test.ts`.
- U5–U9 in `rulesPanelLayout.ts:46-47`, killed by `rulesPanelLayout.test.ts`.

**Scene and panel, against `tables-during-combat.spec.ts` and `rules-panel.spec.ts`:**
- E1 (the suppression restored): KILLED.
- E2 and E3 (the `syncRulesPanel` clear removed, then made unconditional): KILLED by `:117`.
- E4 (`setRolled` after the exchange return): KILLED by `:140`.
- E6 and E7 (the choosers centred): KILLED.
- E9: KILLED.
- E12: KILLED.
- E5 and E10, against the full e2e: **SURVIVED** (F4, F5).
- E8: **SURVIVED**, equivalent (F8).
- E11 (the marked cell not drawn): **SURVIVED**. It's visual only, so the live
  check covers it.

The rework is expected to kill E5, E10, and a new mutant: Escape over the
warning reaching the warning while the panel is open (F2).

## Not checked
- **The look:** the rolled cell's outline and fill, the choosers' lower
  position, and the Drawn view. Live check.
- **"Never cuts an animation short"** (B6): e2e runs with animations off.
- **Enter continuing a drift with the panel open,** and a click on the panel
  body during a drift.
- **B9 with a computer seat:** traced in code only.
- **A 1600-wide canvas in the browser:** §88 is not merged; only the geometry
  is unit-tested.

## Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`); the change is new and visual.
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/84-tables-during-combat`, run `npm
     run dev -- --port 5284`, open http://127.0.0.1:5284/, and choose
     **Combat test mode (units face to face, 2 hexes)**.
  2. Click **Tables**, then **End phase** into combat. The panel is on Land
     combat.
  3. Build and resolve attacks. Test mode keeps Undo across the roll, so undo
     and resolve until you have seen a DR retreat, a push, an advance offer,
     an EX exchange and an elephant drift. `__heraklios.seed(n)` in the
     console varies the die.
  4. At each prompt: switch tabs, click on the panel, press Escape, reopen
     with Tables, then answer the prompt.
  5. Toggle to the **Drawn** view and repeat at least the retreat and the
     drift.
  6. In Test mode (2 players): Tables open, a few moves, **End phase** with
     units unmoved, then Escape, then Escape again.
- **you should see:**
  - the panel stays open on its tab through every prompt, and never opens or
    changes tab by itself;
  - highlights outside the panel stay clickable;
  - the advance and exchange boxes sit with their top at about y 286, whether
    or not the panel is open;
  - drift Continue, Space and Enter work with the panel open;
  - clicks on the panel and Escape never answer or skip anything;
  - the Land combat tab keeps the rolled attack's column and one outlined
    bright cell at the die face's row after the modifier, until a new
    attacker is clicked or the phase ends;
  - in step 6, the first Escape closes only the panel (the warning and its
    marks stay), and the second cancels the warning;
  - the look and spacing are acceptable in both views.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `d575efa`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 110 passed (110)`, `Tests 1828 passed | 2 skipped (1830)`.
- `npm run check:intent`: PASS.
- Full `npm run e2e`: `1 failed` (`end-move-warning.spec.ts:252`), `67 passed
  (3.9m)`.
- Two throwaway probes, created and deleted, never committed: the Escape
  double action (F2), and the marks under the panel (F3).
- 21 mutants: 17 killed, 4 survived (E5, E8, E10, E11), each restored by copy.
- The rebase arithmetic, the append-only `plan.md` diff, and `sampled: no`.
  `git status --short` was clean.

**Coordinator, re-run, at `d575efa` (2026-11-25 13:55–14:45):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 110 passed (110)`, `Tests 1828 passed | 2 skipped
  (1830)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  84, feature)`, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `✘ end-move-warning.spec.ts:252`
  (the Tables panel scenario), `1 failed`, `67 passed (3.2m)`. Matches.
- **Coordinator, re-run:** E5 and E10 against the full e2e, without the known
  red scenario.
  - First run: each `1 failed ; 66 passed`, with the failing test not
    captured.
  - Second run: E5 **SURVIVED** and E10 **SURVIVED**, each `67 passed`.
  - The second run matches the reviewer; the first run's single failures were
    unnamed flakes.
- **Coordinator, re-run:** E8 and E11 against the two specs: both **SURVIVED**,
  `6 passed` each. Matches.
- The tree was `clean` after each.

**Taken on trust:**
- the reviewer's two probes (F2, F3);
- the seeds' die faces (checked in `combatScenarios.test.ts`, inside verify).
