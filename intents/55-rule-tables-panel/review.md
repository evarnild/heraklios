<!-- generated-by: heraklios/review@0.1.5 -->
# §55 review — A Tables panel on the board shows the terrain table and the three combat tables

verdict: rework
tier: attested
reviewed-commit: f8da4e3
round: 4
sampled: no
run: manual
live-check: owed

**Tier:** Attested, by the path table alone (`src/ui/**`, `src/scenes/**`,
`src/engine/ruleTables.ts`, `e2e/`, `README.md`, `CLAUDE.md`, the intent
folder); no `review_tier`; no CRITICAL or HIGH finding. **Run:** manual, a
fourth round after the `/auto` run stopped out of rounds (`auto_round: 3`).
The coordinator ran every pass itself, no reviewer agent: the change since
round 3 (`2af8898..f8da4e3`) is 62 lines, of which `src/` is two bytes.

**Verdict:** `rework`, on one mechanical finding: the new CLAUDE.md
sentence names the wrong module for the decision choosers. Every round-3
finding marked "Needs rework:" is resolved, RP1 and RP2 are killed, the
regression set stays killed, and the scenario that was flaky passed 10 of 10
repeats and the full suite.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework covers round 3's findings and nothing else (`e2e/rules-panel.spec.ts`, README, CLAUDE.md, two bytes, Progress) |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass: `src/data/` and `src/engine/ruleTables.ts` unchanged since round 2 |
| 4 | Tests prove the rule, not only pass | pass: RP1 and RP2 now killed; M1, S2, S5, S6, S11, ST5 still killed by the e2e; RP4 survives (render only, optional) |
| 5 | Engine/presentation boundary and conventions | pass: no code change beyond two comment bytes |
| 6 | Numbers in prose | pass: Progress's 1183 → 1183, lint 21, e2e 17, repeat 10 of 10 reproduced |
| 7 | Documentation | findings (1): CLAUDE.md:229-231 credits `ui/boardPrompts.ts` with the decision choosers |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged; every changed file valid UTF-8; no new dependency, `eslint-disable` or `innerHTML` |
| 9 | Repository-specific footguns | pass: presentation only |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 55, feature)
  error: A live check is owed and not recorded. Do the steps in intents/55-rule-tables-panel/review.md → ## Live check, then set live_checked: <date> in intents/55-rule-tables-panel/metadata.yml.
  note:  18 file(s), 1168 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Findings
- **MEDIUM** `CLAUDE.md:229-231`: "`ui/boardPrompts.ts`' decision choosers
  (retreat, push, advance, exchange, drift) hide the panel while pending".
  `ui/boardPrompts.ts` holds only the ram and boarding prompt sizes
  (`RAM_PROMPT`, `BOARD_PROMPT`, `centredPromptRect`); the decision choosers
  are `BoardScene`'s (`chooseRetreat`, `choosePushTarget`, `chooseAdvance`,
  `chooseExchangeSacrifice`, `beginDrift`), and what hides the panel is
  `BoardScene.update` passing `decisionPending` to `RulesPanel.setSuppressed`.
  Every agent reads CLAUDE.md, so it would send the next one to the wrong
  file. Needs rework: reword it to, for example, "…; `ui/rulesPanelState.ts`
  holds open/tab/hidden, `ui/boardPrompts.ts` sizes the ram and boarding
  prompts the layout keeps clear of, and the Board hides the panel while a
  decision (retreat, push, advance, exchange, drift) is pending; it returns as
  it was."
- Nit: `e2e/rules-panel.spec.ts:41`, `chord`'s `mods.reverse()` reverses the
  caller's array in place (harmless with the literal arrays passed today).

## Not checked
- **Vitest-killed mutants** (ST1-ST10, G6, L1, SP1, BP1-BP4, V3, E21, E23):
  not re-run; the unit tests and their targets are unchanged since round 3,
  where the coordinator re-ran ST1, ST2, ST5, S11, G6, BP1, V3, E21 and E23.
- **The `chord` helper's timing** relies on two `requestAnimationFrame`s
  covering at least one Phaser step between key events; it passed 10 of 10
  repeats and the full suite under load, but is not proven for every machine.
- **The game's own keyboard double handling** (Ctrl+Z/Y on the Board and in
  Placement): outside this intent, drafted as §62. The live check's undo/redo
  presses should be made one key at a time.
- Carried over from round 3: the panel-versus-chooser window under one frame
  (by code); the choosers individually and the drift flicker (live-check
  items); scene literals BSR, BSB, BSP and RP6 (inherent or equivalent); S10;
  hexes under the open panel; RP4 (render only).
- No browser run beyond the e2e suite.

## Live check
- **Owed** by rule 1 (`src/ui/rulesPanel.ts`, `rulesPanelState.ts`,
  `boardPrompts.ts`, `rulesPanelLayout.ts`, `src/scenes/BoardScene.ts`,
  `i18n/*`, `devHook.ts` across the branch), new and visual; rule 3 for the
  drift flicker. Run it on the commit that resolves this round's finding
  (a CLAUDE.md wording change; the game is the same as at `f8da4e3`).
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/55-rule-tables-panel`, with
     `HERAKLIOS_SAVES_DIR` set to an empty temp folder, `npm run dev -- --port
     5255 --strictPort --host 127.0.0.1`, open `http://127.0.0.1:5255/`.
  2. "Combat test mode (units face to face, 2 hexes)", then **📖 Tables**
     (beside Save / Load, bottom left).
  3. Each tab against the print: Terrain `docs/research/05-rules-french-original.md:177-184`,
     Land combat `:222-231`, Ramming `:388-394`, Boarding `:439-448`.
  4. **Placement:** a wide band across the top, right of the side panel to
     the right edge, about the top third; never over the side panel. Judge
     whether enough map stays visible.
  5. **Ram prompt with the panel open (movement):** ships in rows r=7 and r=9
     from q=25, bows-on; move one a hex towards its counterpart: the ram
     prompt is fully visible below the panel, both buttons (Ram / Hold off)
     clickable, the panel still open.
  6. **Hide and restore:** end the phase (the panel opens on Land combat);
     switch to **Ramming**; build a land attack (archers onto the enemy 2
     hexes away) and Resolve. When a retreat, push, advance or exchange
     choice appears, the panel vanishes at once; **📖 Tables** and **Escape**
     do nothing. Make the choice: the panel comes back, drawn, on **Ramming**.
     Test mode keeps rolls undoable: if no choice came up, undo with the
     on-screen Undo button (or Ctrl+Z, keys one at a time, see §62) and
     resolve again. Repeat with the panel **closed** before resolving: it
     stays closed after. A tall advance or EX exchange chooser: title and
     buttons fully visible.
  7. **Elephants (if you build an elephant attack):** while one drifts, note
     whether the panel hides and reappears more than once.
  8. Click the panel over a unit: nothing changes on the map. Drag and wheel
     over it: no pan or zoom. Close it, wheel at the same spot: the map zooms.
  9. On the Menu switch to French and repeat 2-4; look at the Terrain tab's
     two-line cells.
- **You should see:** four tabs matching the print; the highlight following
  every click and clearing on resolve; the ram and boarding prompts fully
  clear of the panel; the panel absent while any choice is pending and back
  exactly as it was (open on the same tab, or closed); no pan or zoom
  blocked where a closed panel was; French labels that fit and read.

## Verified myself vs. taken on trust

**Coordinator** (worktree at `f8da4e3`, `git status --short` clean before,
and after every mutant):
- Read the whole diff `2af8898..f8da4e3`: `e2e/rules-panel.spec.ts` (+26/-2),
  `README.md` and `CLAUDE.md` (+4/-1 each), `plan.md` Progress (+28), and in
  `src/` only `BoardScene.ts:1443` and `rulesPanelLayout.ts:4`, 0xA7 → C2 A7.
- `npm run verify`: exit 0, 64 files, 1183 tests, `21 problems (0 errors, 21
  warnings)`.
- `npm run check:intent`: FAIL only on the owed live check (18 files, 1168
  lines).
- `iconv -f UTF-8 -t UTF-8` over every file changed vs `main` in `src`, `e2e`,
  `README.md`, `CLAUDE.md`: all pass.
- `npm run e2e`: exit 0, 17 passed (36.9 s).
- `npx playwright test e2e/rules-panel.spec.ts --repeat-each 10`: 10 passed
  (34.3 s).
- Mutants against `e2e/rules-panel.spec.ts` (byte-preserving apply, checked
  as applied, restored by copy): RP1 killed ("drawn again once the choice is
  made", `:61`); RP2 killed ("a closed panel does not block the wheel",
  `:150`); RP4 survived; M1 killed ("hidden while a decision is pending",
  `:52`); S2 killed (`:141` zoom); S5 killed ("cleared by the resolution",
  `:159`); S6 killed (undo wait `:113`); S11 killed (`:145`); ST5 killed
  ("back as it was", `:60`). These match the implementer's report.
- `npm run sdlc:scan -- --sample-due manual --exclude 55`: nth attested
  manual change = 13, every 5, `sampled: no`.

**Taken on trust:** as in round 3 (the transcription; round 1's cell-by-cell
table comparison; seed 1's roll leading to a choice; Phaser's step order).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/5fa25da4d97f8e6d/039c398c-c92e-4752-8e0d-48aac6d7afde/scratchpad/coord55r3/`
(`r4.sh`, `r4-results.txt` and the logs).

# Round 3 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 014851c
- round: 3
- sampled: no
- run: auto
- live-check: owed

The full round-3 report is in git at `2af8898`.

Resolutions (round 4, checked at `f8da4e3`):
- **MEDIUM, the e2e read the state, not the drawn panel: fixed** in
  `3d0b750`: `expectHiddenWhileDecisionPending` asserts the Land combat tab
  button is gone while hidden and back after; RP1 killed.
- **MEDIUM, the scenario flaky under load: fixed** in `3d0b750`/`b2feed1`:
  undo and redo go through a `chord` helper with a frame between key events;
  10 of 10 repeats and the full suite green. The game-side cause is §62.
- **LOW RP2: fixed** (wheel at the closed panel's point changes the zoom).
- **LOW, the 0xA7 bytes: fixed** (every changed file valid UTF-8).
- **LOW, README and CLAUDE.md: README fixed; CLAUDE.md written but naming
  the wrong module** (round 4's finding).
- **LOW RP4 (Worth a look): not done.**

# Round 2 (history)
- verdict: rework
- tier: attested
- reviewed-commit: e85b38e
- round: 2
- sampled: no
- run: auto
- live-check: owed

The full round-2 report is in git at `154e9f4`.

Resolutions (round 3, checked at `014851c`):
- **MEDIUM, the growing exchange and advance choosers under the panel (Needs
  decision): the owner chose (c)**, hide the Tables panel while
  `decisionPending` is set (`0838e13`). Done in `91f1966`
  (`RulesPanelState`, `RulesPanel.setSuppressed`, `BoardScene.update`); all
  four choosers set the flag (checked in code); the fake 340×200 box is gone.
  The restore is proven for the state, not the drawn panel (round 3's first
  finding).
- **Expected kill, a mutant on the chooser height formulas:** superseded by
  (c); the choosers are hidden over, not modelled.
- **LOW, plan.md "22-26 px rows": fixed** ("22-32 px rows").
- **LOW, `SIDE_PANEL_WIDTH` copied from `PANEL_WIDTH`: fixed** (`BoardScene.ts:91`
  imports it; the scene-side literal BSP survives, inherent).
- **LOW G6 (`TOP` 8 → 9): fixed**, killed by "sits at 312..1088 x 8..274".

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 6de296e
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `e551d91`.

Resolutions (round 2, checked at `e85b38e`):
- **MEDIUM, the panel covering the centred prompts (Needs decision): the owner
  chose (c)**, shrink or move the panel so it never covers the centre
  (`786c731`); `c55d5d4` made it 776×266 at 312..1088 × 8..274 with
  `rulesPanelLayout.ts` and tests. Resolved for the ram and boarding prompts
  and the small choosers; open for the growing exchange and advance choosers
  (round 2's first finding).
- **MEDIUM V3: fixed** in `3cc1f3d` (`boardingCode`, `boardingTable().codes`,
  pinned to D-1, A-2, D-4, null).
- **MEDIUM E21: fixed** (columns pinned to the print).
- **MEDIUM, e2e gaps S5, S6, S11, S2: fixed** in `c55d5d4` (undo/redo,
  resolve, Tables closes, wheel).
- **LOW S10:** not done; still worth a look.
- **LOW E17:** equivalent; not done.
- **LOW E23: fixed** (ship order pinned).
- **LOW, French "points d'équipement": fixed** ("points d'équipage").
- **LOW, unused `rules.ratioHeader`: removed.**
- **LOW, the 0xA7 byte: fixed** (a UTF-8 "§"); it recurs in round 3, in
  other lines.
- **LOW, Progress "1165 before": fixed** in place (base 1153, +18), disclosed.
- **LOW, terrain "Closed to" for the wide river and coast (owner call):
  unchanged.**
- **LOW, CLAUDE.md module lists: fixed** (`CLAUDE.md:226-228`).
