<!-- generated-by: heraklios/review@0.1.5 -->
# §55 review — A Tables panel on the board shows the terrain table and the three combat tables

verdict: rework
tier: attested
reviewed-commit: 014851c
round: 3
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table alone: across the branch the diff
touches `src/ui/**`, `src/scenes/**`, `src/engine/ruleTables.ts` (not on the
Reviewed list), `e2e/`, `README.md`, `CLAUDE.md` and the intent folder;
nothing in `src/data/`; no new `eslint-disable`; `package.json` and
`eslint.config.js` unchanged. No `review_tier`, no CRITICAL or HIGH finding.

**Verdict:** `rework`, on four mechanical findings. The owner's decision (c)
is implemented correctly in code: all four choosers set `decisionPending`
before they draw, `update()` applies the suppression before the frame
renders, and `RulesPanelState` restores open/closed and the tab. The gaps:
the e2e reads the panel's *state*, not the drawn panel (a `RulesPanel` that
never rebuilds after a decision passes every test); the branch's own e2e
scenario is flaky under load (the coordinator's re-check: 2 failures in 3
runs, counted as a finding on the owner's word, "count the flake as a
round-3 finding"); a recurring stray 0xA7 byte in two files; README and
CLAUDE.md don't describe the hide. Round 2's LOW items are resolved, and
every mutant round 2 expected killed is killed.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework does decision (c) and round 2's LOW items, nothing else; `boardPrompts.ts` and `rulesPanelState.ts` are in the decision's scope |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass: `src/data/` untouched; `src/engine/ruleTables.ts` unchanged since round 2; V3, E21, E23 still killed |
| 4 | Tests prove the rule, not only pass | findings (3): 25 of 32 mutants killed; survivors RP1, RP2 (findings), RP4 (render only), RP6 (equivalent), BSR, BSB, BSP (scene literals, inherent); the scenario itself is flaky under load |
| 5 | Engine/presentation boundary and conventions | pass: visibility logic is a pure tested `RulesPanelState`; `BoardScene` only wires `setSuppressed(decisionPending)`; no `GameState` change; undo, save/load, end phase and end game all refuse while `decisionPending` is set |
| 6 | Numbers in prose | pass: Progress's 1177 → 1183, lint 21, e2e 17 reproduced |
| 7 | Documentation | findings (1): README and CLAUDE.md don't describe the hide; CLAUDE.md:228 still says "kept clear of the centred prompts" |
| 8 | Guardrails and hygiene | findings (1): two files not valid UTF-8 (0xA7); lint 21 of 21; no new dependency, `eslint-disable` or `innerHTML` |
| 9 | Repository-specific footguns | pass: drift state machine untouched; headless play unaffected (presentation only) |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 55, feature)
  error: A live check is owed and not recorded. Do the steps in intents/55-rule-tables-panel/review.md → ## Live check, then set live_checked: <date> in intents/55-rule-tables-panel/metadata.yml.
  note:  18 file(s), 1140 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Findings
- **MEDIUM** `src/ui/rulesPanel.ts:80`, `e2e/rules-panel.spec.ts:36-47`: the
  hide/restore e2e checks `snapshot().open`, which is `this.state.shown` (the
  state's opinion), not whether the panel's objects exist. Mutant RP1
  (`rulesPanel.ts:108`, `setSuppressed` returns before `sync()` when the
  suppression ends) **survives** with the whole e2e spec green: under it the
  panel vanishes after the first decision for good, the hook says `open:
  true`, and the Tables button needs two clicks to bring it back. The
  "never restored" kill is real only at the state layer (ST5). Needs rework:
  make `snapshot().open` report the drawn panel (`this.built`), or have
  `expectHiddenWhileDecisionPending` also assert the tab buttons are gone
  while hidden and back afterwards (`buttonCount(en.rules.tabs.land)` 0, then
  1). Expected to kill RP1 with M1, ST1, ST5 still killed.
- **MEDIUM** `e2e/rules-panel.spec.ts:96-99`: the scenario is flaky under
  load. In the coordinator's re-check it failed 2 of 3 runs (once in the full
  `npm run e2e`, 16 of 17; once of two runs alone), each time timing out at
  `:99` (the highlight back after redo); it also "killed" mutant RP2 once
  through that timeout, which would hide a real survivor. Cause, traced: the
  test presses `Control+z` then `Control+Shift+z` with no frame between, and
  Phaser 3.90's `KeyboardManager` (`node_modules/phaser/src/input/keyboard/KeyboardManager.js:194-196`)
  re-processes its whole queued event list on every DOM key event, clearing
  it only at the game's `POST_STEP`; `KeyboardPlugin.update`'s duplicate
  check (`KeyboardPlugin.js:776`) compares only with the previous event. When
  a frame is slow, the six key events land in one frame and `keydown-Z` fires
  1 to 4 times: a diagnostic run logged "Undone: Target Archers, Undone:
  Select Archers, Redone: Select Archers" for one undo and one redo, and the
  next redo press gave "Redone: Target Archers, Nothing to redo., Nothing to
  redo.". The double handling is in `main`'s `BoardScene` and `PlacementScene`
  Ctrl+Z/Y handlers since `511ccc8`, outside this intent; this scenario is
  only the first to press undo and redo by keyboard back to back. Needs
  rework: drive the undo/redo in this scenario so one press is one action
  (the on-screen Undo/Redo buttons, or `keyboard.down`/`up` with frames
  between), and show it green over several runs (e.g. `--repeat-each 5`). The
  game-side fix belongs to a separate fix intent.
- **LOW** `src/ui/rulesPanel.ts:85`: mutant RP2 (`contains` ignores whether
  the panel is shown) **survives**: a closed or hidden panel would still
  block drag-pan and wheel-zoom over its rectangle (`MapView.ts:234`, `:262`),
  against B3, most visibly over a hidden panel during a retreat choice. Needs
  rework: after "The Tables button closes an open panel"
  (`e2e/rules-panel.spec.ts:127-128`), wheel at the same point and assert
  `cameraZoom()` changed.
- **LOW** `src/scenes/BoardScene.ts:1443`, `src/ui/rulesPanelLayout.ts:4`:
  each "§55" comment holds a lone 0xA7 byte (Windows-1252 "§"); both files
  are no longer valid UTF-8 (`main`'s `BoardScene.ts` is). Same defect round 1
  fixed elsewhere; it came in with 91f1966. Needs rework: rewrite those two
  characters as UTF-8 "§" with a byte-preserving tool; `iconv -f UTF-8 -t
  UTF-8` then passes on every changed file.
- **LOW** `README.md:665-685`, `CLAUDE.md:226-228`: decision (c) is new
  player-visible behaviour, documented in neither. The README's Tables
  section doesn't say the panel hides while a retreat, push, advance or
  exchange choice (or an elephant's drift) is pending and comes back as it
  was; CLAUDE.md doesn't name `ui/rulesPanelState.ts` or `ui/boardPrompts.ts`
  and still says the layout keeps the panel "clear of the centred prompts".
  Needs rework: one sentence in the README section in its existing style;
  correct CLAUDE.md:228 to name the two modules and say what holds.
- **LOW** `src/ui/rulesPanel.ts:132`: mutant RP4 (`setAttack` renders even
  while not built) survives: it would draw the land table's cells without the
  shell over the map while the panel is closed or hidden and an attack is
  built. Render only, like round 2's P1. Worth a look: assert a land-table
  cell label is absent while the panel is closed and an attack is built.

## Not checked
- **The panel never coexists with a chooser:** by code and Phaser's step
  order (scene `update()`, where `BoardScene.ts:1444` calls `setSuppressed`,
  runs before render; clock and tween callbacks run before `update()`), not
  observed. The only window is input between a chooser's creation and the
  next `update()` (under one frame), before the chooser is drawn.
- **Choosers individually:** the e2e covers one pending decision (seed 1's
  roll; the scenario doesn't say which kind). `chooseAdvance` (`:2425`),
  `chooseExchangeSacrifice` (`:2677`), `chooseRetreat` (`:2327`) and
  `choosePushTarget` (`:2338`) set `decisionPending` before drawing, by
  reading only.
- **Drift:** `beginDrift` (`:272`) sets `decisionPending`, so the panel hides
  during a drift; `onRetreat`/`onPush`/`onEliminated` (`:323-333`) clear it
  mid-cascade, so it may reappear and hide again within one drift. Not seen;
  a live-check item.
- **Prompt sizes in the scene:** `BoardScene.ts:1838`, `:2777` draw from
  `RAM_PROMPT`/`BOARD_PROMPT` (read); no test ties the scene to them (BSR,
  BSB survive), nor `PANEL_WIDTH = SIDE_PANEL_WIDTH` (`:91`, BSP survives).
  Ram and boarding labels sit at literal offsets from the centre.
- **RP6** (`reset` without `sync`): survives, equivalent in effect (the next
  frame's `setSuppressed` syncs).
- **S10** (a load leaving a stale highlight or tab): untested since round 1;
  reset is unit-tested in `RulesPanelState` only.
- **Hexes under the open panel:** unchanged from round 2.
- **The keyboard double handling in the game itself** (`BoardScene`,
  `PlacementScene`): traced, not fixed here; how often a human hits it on a
  loaded machine is unmeasured.
- No browser run beyond the e2e suite and the coordinator's diagnostic spec.

## Live check
- **Owed** by rule 1 (`src/ui/rulesPanel.ts`, `rulesPanelState.ts`,
  `boardPrompts.ts`, `rulesPanelLayout.ts`, `src/scenes/BoardScene.ts`, plus
  `i18n/*` and `devHook.ts` across the branch), new and visual; rule 3 too,
  for the drift flicker and the first Not-checked item. Run it on the commit
  that resolves this round's findings.
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
     switch to **Ramming** so the restored tab isn't the default; build a land
     attack (archers onto the enemy 2 hexes away) and Resolve. When a
     retreat, push, advance or exchange choice appears, the panel vanishes at
     once; **📖 Tables** and **Escape** do nothing. Make the choice: the panel
     comes back, drawn, on **Ramming**. Test mode keeps rolls undoable (Ctrl+Z
     and resolve again if no choice came up; press keys one at a time, see
     the flake finding). Repeat with the panel **closed** before resolving: it
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

**Coordinator, re-run** (worktree at `014851c`; `git status --short` clean
before, and after every mutant and the diagnostic spec, which was deleted):
- `npm run verify`: exit 0, 64 files, 1183 tests, `21 problems (0 errors, 21
  warnings)` (matches).
- `npm run check:intent`: FAIL only on the owed live check, 18 files, 1140
  lines (matches).
- `npm run e2e`: exit 1, **16 passed, 1 failed**: `rules-panel.spec.ts`
  timed out at `:99` (the reviewer had 17 passed). `npx playwright test
  e2e/rules-panel.spec.ts` alone: 1 passed, then 1 failed at `:99`. This was
  the run's re-check mismatch; on the owner's word it is the second finding.
- Diagnosis: a temporary copy of the spec logging `logEntries()` around the
  redo. With a hook read before the redo press: 4 of 4 passed. Without it: 5
  of 6 passed; the failure logged the double-handled presses quoted in the
  finding. Phaser source read at `KeyboardManager.js:186-216`, `:262-264`,
  `KeyboardPlugin.js:731-797`; `git log -S"keydown-Z"` puts the handlers at
  `511ccc8` on `main`.
- Encoding: `iconv -f UTF-8 -t UTF-8` over the changed files fails on
  `src/scenes/BoardScene.ts` and `src/ui/rulesPanelLayout.ts` only (matches).
- Mutants, one at a time, byte-preserving apply (CRLF-aware), checked as
  applied (`git diff --quiet` non-zero), restored by copy; vitest mutants
  against the **full** `npx vitest run`, scene and panel mutants against
  `e2e/rules-panel.spec.ts`:
  - claimed survivors: RP1 survived (1 passed); RP2 1 passed in one run and
    failed in two at `:99`, the flake's line, not the zoom check RP2 bears on:
    effectively survives (matches); RP4 survived; RP6 survived; BSR, BSB, BSP
    survived (full vitest and e2e green) (all match);
  - claimed kills: M1 killed ("hidden while a decision is pending"); ST1
    ("is hidden while suppressed and comes back open on the same tab"); ST2
    ("ignores open, toggle, close and tab changes while suppressed"); ST5
    (both of those); S11 (state "opens on the default tab, then on the last
    tab chosen", and e2e `:128`); G6 ("sits at 312..1088 x 8..274 …"); BP1
    ("puts the ram and boarding prompts where BoardScene draws them …"); V3
    ("words each cell as the print does …"); E21 ("equals resolveBoarding at
    every column and die", "matches the print"); E23 ("matches the print:
    attacker rows, defender columns (asymmetric)"); S2 (e2e `:124` zoom); S5
    ("cleared by the resolution"); S6 (e2e timeout at `:97`, the undo wait;
    the reviewer saw `:99`, same test and cause: no sync after a restore)
    (all match).
  - Not re-run: the reviewer's ST3, ST4, ST6-ST10, L1, SP1, BP2-BP4, RP5
    (claimed killed, not survivors or expected kills).

**Reviewer agent** (same worktree, HEAD `014851c`; nothing checked out):
- Git state: merge-base `25366f2`; `main` 11 commits past it, none in `src/`,
  `e2e/` or `server/`; no remote ref; clean before and after every mutant.
- `npm run verify` exit 0 (64 files, 1183 tests, lint 21, cap 21);
  `check:intent` as above; `npm run e2e` exit 0, 17 passed (1.9 m),
  `placement.spec.ts` 27.8 s against its 30 s timeout.
- The implementer's load timeouts: `server/fileSaveFs.test.ts` alone 25
  passed (also green in verify); `e2e/placement.spec.ts` alone 1 passed
  (44.6 s); neither touched by the branch.
- `npm run sdlc:scan -- --sample-due auto --exclude 55`: nth attested auto
  change = 4, every 3, `sampled: no`.
- Code reading: the four choosers and the drift set `decisionPending`
  (`:2327`, `:2338`, `:2425`, `:2677`, `:272`); undo (`:1269`), redo
  (`:1287`), save/load (`:1034`), end game (`:1132`), resolve (`:2501`) and
  end phase (`:2915`) refuse while it is set; `resetSceneState` (`:564`,
  `:571`) clears both; `promptRam` and `navalAttackPrompt` draw from
  `boardPrompts.ts`; `PANEL_WIDTH` imports `SIDE_PANEL_WIDTH`; `plan.md:198`
  reads "22-32 px rows".
- 32 mutants against `src/ui` + `src/engine/ruleTables.test.ts` (17 files, 178
  tests) and `e2e/rules-panel.spec.ts`: 25 killed (G6, L1, SP1, BP1-BP4,
  ST1-ST10, S11, M1, S2, S5, S6, RP5, V3, E21, E23), 7 survived (RP1, RP2,
  RP4, RP6, BSR, BSB, BSP).

**Taken on trust:** that `05-rules-french-original.md` transcribes the scan
faithfully; round 1's cell-by-cell table comparison (tables and builders
unchanged since); that seed 1's roll leads to a retreat, push or advance
choice (the e2e waits on `decisionPending`, so it would time out, not pass);
Phaser 3.90's step order (update before render), from the engine's design
rather than a run.

Scratch files, outside the repo: the reviewer's under
`C:/Users/eric/AppData/Local/Temp/claude/5fa25da4d97f8e6d/039c398c-c92e-4752-8e0d-48aac6d7afde/scratchpad/mut/`;
the coordinator's under `…/scratchpad/coord55r3/` (harness, logs,
`results.txt`), `…/scratchpad/coord-verify.log` and `…/coord-e2e.log`.

Mutants a rework is expected to kill: **RP1** (`src/ui/rulesPanel.ts:108`,
return before `sync()` when unsuppressing) and **RP2** (`:85`, drop the
`shown` guard), with the scenario green over repeated runs so a kill is not
the flake. RP4 optional (render only). The regression set stays killed: M1,
ST1, ST2, ST5, S11, G6, BP1, V3, E21, E23, S2, S5, S6.

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
