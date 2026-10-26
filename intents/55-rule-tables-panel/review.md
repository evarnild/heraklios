<!-- generated-by: heraklios/review@0.1.5 -->
# §55 review — A Tables panel on the board shows the terrain table and the three combat tables

verdict: rework
tier: attested
reviewed-commit: 6de296e
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table alone: the diff touches
`src/engine/ruleTables.ts` (an engine module not on the Reviewed list),
`src/ui/**`, `src/scenes/**`, `e2e/`, `README.md` and the intent folder;
`src/data/` is untouched (no file there in `git diff --stat`); no new
`eslint-disable`; `package.json` and `eslint.config.js` unchanged.
`review_tier` is empty, the feature is digital-only, no finding is HIGH or
CRITICAL.

**Verdict:** `rework`. All four tables match the print cell for cell, and the
highlight follows the roll's own numbers. One finding needs your decision
(the panel covers the game's centred decision prompts), three MEDIUM and
several LOW items are mechanical test or text gaps. With a "Needs decision:"
finding open, the auto run stops for you. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent, e2e
and all thirteen survivors (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: every subtask present; the extra undo/redo resync and `reset()` are small and in scope; the divergences are judged in the first and last findings |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass: every cell of the four tables compared with `05-rules-french-original.md` and `03-tables-reference.md` (notes below) |
| 4 | Tests prove the rule, not only pass | findings (4): survivors E21, E23, E17 (equivalent), S2, S5, S6, S10, S11, V3; render-only V1, V2, V4, V5 left to the live check |
| 5 | Engine/presentation boundary and conventions | findings (1): the boarding codes are formed in an untested UI module |
| 6 | Numbers in prose | findings (1): Progress's "1165 before" |
| 7 | Documentation | findings (1, LOW): CLAUDE.md's module lists don't name the new modules |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no new dependency; no `innerHTML` |
| 9 | Repository-specific footguns | pass: no drift, AI or harness change; the new engine module is imported by nothing headless |

**Pass 3 notes:** `LAND_CRT` matches the print (`05-…:224-231`) in all 60
cells; `BOARDING_TABLE` matches `:441-448` in all 42, with the null cells
exactly at the printed "rosé" cells; `RAMMING_SUCCESS_DICE` matches
`:390-394` in all 16 (attacker ↓, defender →; the tests pin the asymmetry,
galley × quintireme = [1], quintireme × galley = [1..5]). Terrain matches
`:177-184` (plain 1/0, wide river 3/+2, steep flank 3/+2 "si les attaquants
viennent du bas", plateau 1/+2 from below, marsh 2/+1), and the N.B. ("Chars
et cavaleries sont interdits sur les flancs abrupts ; chars, cavaleries et
éléphants ne peuvent accéder aux marais") matches `forbiddenFor`. "Rivières
normales 2/+1" is shown as the hexside row (+1 to cross, +1), the spec's
interpretation, labelled as a hexside. The EX legend follows `:237-239`, the
ramming bonus legend `:374-386`; `03-tables-reference.md:30-92` agrees with
the French original everywhere.

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 55, feature)
  note:  12 file(s), 854 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/ui/rulesPanel.ts:29-32`, `:98`, `:136`: the panel (580×392 at
  508..1088 × 12..404, depths 35-37) sits on top of the right half of the
  game's centred decision prompts above y=404: the ram prompt
  (`BoardScene.ts:1834`, 280×130 at depth 20-21, centred on 550, 375), the
  boarding prompt (`:2773`), the retreat chooser (`:2430`) and the advance
  chooser (`:2682`). E.g. the ram prompt's label at y≈335 is partly hidden and
  the upper half of its "Hold off" button (y≈385-415, x≥556) is under the
  panel, whose background swallows the click. The panel is non-modal, so it
  can be open when a ram prompt appears in movement; Close or Escape
  recovers, but a decision prompt should never be hidden. Derived from the
  code geometry, not seen in a browser. It is also the size divergence: the
  spec assumed about 460×320, and the panel covers the map's centre.
  Needs decision: lower the panel's depth below the prompts (under 20), close
  or hide the panel while a prompt is up, or shrink or move it.
- **MEDIUM** `src/ui/rulesPanel.ts:304`: the boarding cell code is built in the
  untested UI module (`` `${cell.side === 'attacker' ? 'A' : 'D'}-…` ``);
  swapping A and D (V3) survives every test and the e2e, and would show the
  boarding table with attacker and defender inverted. Spec B9 asks for one
  pure, tested function per table returning the cells. Needs rework: have
  `boardingTable()` return the code, or a tested `boardingCode(result):
  string | null` in `src/engine/ruleTables.ts`, pinning print cells (die 1 at
  1/3 = "D-1", die 6 at 1/3 = "A-2", die 1 at 5/1 = "D-4", die 2 at 1/3 =
  null).
- **MEDIUM** `src/engine/ruleTables.ts:107` /
  `src/engine/ruleTables.test.ts:89-112`: `boardingTable().columns` is never
  asserted; reversing the labels with the cells unchanged (E21) survives, and
  the panel would put the wrong ratio over every column (the land test does
  pin `table.columns`). Needs rework: `expect(table.columns).toEqual(
  BOARDING_RATIO_COLUMNS)` and a print check `['1-3','1-2','1-1','2-1','3-1',
  '4-1','5-1']`.
- **MEDIUM** `e2e/rules-panel.spec.ts`: several new scene and panel lines
  survive the scenario, though the plan's Tests table credits it with
  "highlight not cleared after resolve / clear": S5 (`BoardScene.ts:2115`, the
  `syncRulesPanel()` in `clearCombatSelection`: the resolve and end-of-phase
  clear in B6), S6 (`:1221`, the resync on undo/redo), S11
  (`rulesPanel.ts:89`, the button closing the panel when clicked again, B1),
  S2 (`BoardScene.ts:858`, `|| this.rulesPanel.contains(x, y)`: no pan or zoom
  from the panel, B3). Needs rework: resolve the attack and assert `highlight
  === null`; rebuild an attack, Ctrl+Z, assert the highlight follows the
  restored selection; click Tables with the panel open, assert `open ===
  false`; wheel over the panel, assert `cameraZoom()` unchanged (as
  `message-log.spec.ts` does for the log).
- **LOW** `src/scenes/BoardScene.ts:569`: `this.rulesPanel?.reset()` in
  `resetSceneState` survives (S10); a load or new game leaving a stale
  highlight or tab isn't exercised. Worth a look: a save-load step in the e2e.
- **LOW** `src/engine/ruleTables.ts:138`: the lower clamp `Math.max(1, …)`
  survives (E17), equivalent with today's data (every modifier ≥ 0). Worth a
  look.
- **LOW** `src/engine/ruleTables.test.ts:79-85`: the ships' order isn't pinned
  to the print's (galère, birème, trirème, quintirème); reversing ships and
  cells together (E23) survives. Needs rework:
  `expect(table.ships).toEqual(['galeres','biremes','triremes','quintiremes'])`.
- **LOW** `src/ui/i18n/fr.ts:198-199`: the French boarding legend says "points
  d'équipement"; the print (`05-…:426-430`, "points d'équipage") and the game's
  French boarding report (`fr.ts:317-322`, "d’équipage") say "équipage".
  Needs rework: "points d'équipage".
- **LOW** `src/ui/i18n/en.ts:200`, `fr.ts:185`: `rules.ratioHeader` is defined
  but never read. Needs rework: remove it from both.
- **LOW** `src/engine/ruleTables.test.ts:114`: `describe('landCombatHighlight
  (\xA755)'` holds a lone 0xA7 byte (invalid UTF-8, shows "�55"); the file's
  other four "§" are fine. Needs rework: a UTF-8 "§".
- **LOW** `plan.md:175` Progress: "1171 tests (1165 before this intent's
  builders)": the diff adds 18 tests (17 in `ruleTables.test.ts`, 1 in
  `names.test.ts`) and removes none, so the count before was 1153. Needs
  rework: correct it, or say what 1165 measured.
- **LOW** `src/ui/rulesPanel.ts:242`: the terrain tab's "Closed to" shows "—"
  for the wide river and the coast; only galleys may enter either
  (`canEnterTerrain`), and `03-tables-reference.md:36` lists the wide river as
  "non-galley ships". The tab follows spec B4 (`forbiddenFor`) as written.
  Worth a look (an owner call; the spec would need to change).
- **LOW** `CLAUDE.md` Architecture: the `src/engine/` and `src/ui/` lists
  don't name `ruleTables.ts` or `rulesPanel.ts`. Worth a look.

## Not checked
- **What the panel looks like:** cell tints, the column and hit-cell highlight
  (V1, V2, V4, V5 survive by design), text fit in 50-px cells, French label
  widths ("Coût de mouvement", "Modificateur du dé") in 80- and 220-px columns,
  legend wrapping in 392 px. Live check.
- **The prompt overlap** (first finding): from code geometry, not reproduced
  in a browser.
- **The highlight clearing** on resolve, end of phase and undo/redo, the button
  closing the panel, and drag or wheel over the panel: untested (the MEDIUM
  e2e finding).
- **A non-zero modifier in the browser:** the e2e exercised one archers attack
  on unknown terrain.
- **S12** (the naval guard in `syncRulesPanel`) and S13 sit on §53's context
  lines; S12 survived the single spec and wasn't judged.
- **Mutants ran against `vitest run src`** (684 tests) and the single e2e spec,
  not the full suites; the 487 tests outside `src/` import none of the changed
  modules.

## Live check
- **Owed** by rule 1 (`src/scenes/BoardScene.ts`, `src/ui/rulesPanel.ts`,
  `src/ui/devHook.ts`, `src/ui/i18n/*`); new and visual. It also covers the
  visual and overlap items above. Run it on the commit that resolves the
  findings.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/55-rule-tables-panel`, with
     `HERAKLIOS_SAVES_DIR` set to an empty temp folder, `npm run dev -- --port
     5255 --strictPort --host 127.0.0.1`, open `http://127.0.0.1:5255/`.
  2. "Combat test mode", then **📖 Tables** (beside Save / Load).
  3. Each tab against the print: Terrain with
     `docs/research/05-rules-french-original.md:177-184`, Land combat
     `:222-231`, Ramming `:388-394`, Boarding `:439-448`.
  4. Judge the size and placement: it covers the top right of the map and much
     of its centre, never the left side panel.
  5. End the phase to reach combat; with the panel open, build the §53
     live-check attack (into a wide-river hex, or across a river hexside, for
     +2 or +3), then **Resolve attack**.
  6. Click on the panel over a unit: nothing changes on the map. Drag and wheel
     over the panel: no pan or zoom.
  7. Escape closes it; click Tables twice: it opens and closes.
  8. In movement, with the panel open, move a ship into a ram contact so the
     ram prompt appears (the first finding).
  9. Switch to French on the Menu, start the same way, repeat 2-4.
- **You should see:** four tabs matching the print exactly (ramming rows are
  the attacker, columns the defender: galère × quintirème = "1"; boarding
  tinted exactly at the print's "rosé" cells: die 2 at 1/3, die 3 at 1/3 and
  1/2, die 4 at 1/2, 1/1 and 2/1); during the attack, a line above the table
  with both forces, the column and "die +n", the ratio column tinted, and in it
  rows face+n capped at 6 tinted brighter (+2: rows 3-6), following every click
  and clearing on resolve; panel clicks do nothing on the map; whether the ram
  prompt is readable and clickable with the panel open; French tab names
  "Effets du terrain / Combat terrestre / Éperonnage / Abordage", labels that
  fit.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `6de296e`; clean before, and after every
mutant):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 62 files,
  1171 tests (matches).
- `npm run check:intent`: PASS, 12 files, 854 lines (matches).
- `npm run e2e`: **17 passed** (1.1 min) (matches). A first run, while another
  worktree's review was running its suites, failed 4 scenarios at the 1-minute
  timeout (`attack-log`, `attacks`, `message-log`, `placement`); the repeat on
  a quieter machine passed 17 of 17. Load, not code.
- All 13 survivors, one at a time, backed up and restored by copy, each
  checked as applied; engine with `npx vitest run src`, scene and panel with
  `npx playwright test e2e/rules-panel.spec.ts`: E17, E21, E23 (684 passed
  each); S2, S5, S6, S10, S11, V3, V1, V2, V4, V5 (1 passed each):
  **survived** (matches).

**Reviewer agent** (same worktree and HEAD; nothing checked out):
- `npm run verify` (62 files, 1171 tests, lint 21), `check:intent` PASS, `npm
  run e2e` 17 passed (49.6 s; `rules-panel.spec.ts` 3.0 s), port 5232 free
  before.
- `npm run sdlc:scan -- --sample-due auto --exclude 55`: nth attested auto
  change = 4, every 3, `sampled: no`.
- The diff stat against the merge-base `25366f2`: nothing in `src/data/`, no
  `package.json` or `eslint.config.js` change, no `eslint-disable`; nothing
  pushed; `main` untouched.
- The cell-by-cell comparison of the `src/data/` tables against the print and
  `03-tables-reference.md` (pass 3).
- **39 mutants:** killed (28) E1-E16 and E18-E20, E22 (column forces swapped,
  sea-like filter, from-below flag, `forbiddenFor`, move cost and modifier,
  river cost and modifier, CRT forces and die order and columns, ramming
  sides and bonus, boarding forces and die order, highlight column, the clamp
  at 6, the shift, the modifier, a null preview, ships reversed alone); U1
  (`unitCategoryName` fallback); S1 (panel background not interactive: failed
  on "nothing selected through the panel"), S3 (Escape), S4 (`setAttack`
  dropped), S7 (default tab), S8 (last tab), S9 (`setAttack(null)`), S13 (an
  extra case on an unchanged line). Survived as listed above.

**Taken on trust:** that `docs/research/05-rules-french-original.md`
faithfully transcribes the scan (the images weren't opened); how Phaser's
top-only input orders the HUD and main cameras (S1 confirms it for the panel
against map hexes, not against the depth-20 prompts); the implementer's
22.9 s `placement.spec.ts` timing.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut55/`
(reviewer) and `…/scratchpad/coord55/` (coordinator).

Mutants a rework is expected to kill: E21, E23, V3 (once the code moves into
a tested function), S5, S6, S11, S2 (S10 optional; E17 equivalent).
