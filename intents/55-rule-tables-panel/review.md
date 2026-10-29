<!-- generated-by: heraklios/review@0.1.5 -->
# §55 review — A Tables panel on the board shows the terrain table and the three combat tables

verdict: rework
tier: attested
reviewed-commit: e85b38e
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table alone: since round 1 the diff touches
`src/engine/ruleTables.ts` (not on the Reviewed list), `src/ui/**`, `e2e/`,
`CLAUDE.md` and the intent folder; nothing in `src/data/`; no new
`eslint-disable`; `package.json` and `eslint.config.js` unchanged.

**Verdict:** `rework`, for one "Needs decision:" finding. Round 1's
mechanical findings are all fixed and every mutant round 1 expected the
rework to kill is killed. The new panel position clears the ram and boarding
prompts and the small choosers, but not every prompt: the exchange-sacrifice
and advance choosers grow with their number of rows, and from 6 rows their
tops slide under the panel. The new geometry test models the prompts as a
fixed 340×200 box that no prompt in `BoardScene.ts` actually is. Passes run
by the `heraklios-reviewer` agent; the coordinator re-ran verify,
check:intent, e2e, both survivors and the expected kills (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework covers round 1's findings and the owner's decision (c); `rulesPanelLayout.ts` is in that decision's scope |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass: `src/data/` untouched; the builders unchanged apart from `codes`; "points d'équipage" now matches `05-rules-french-original.md:426-430` |
| 4 | Tests prove the rule | findings (1): 17 of 19 mutants killed; G6 (a 1 px boundary, equivalent in effect) and P1 (render only) survive; the prompt-box test proves the model, not the prompts |
| 5 | Engine/presentation boundary and conventions | pass: the boarding code is in the engine (`boardingCode`, tested); the layout is a pure tested module; no `GameState` change |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass: `CLAUDE.md:226-228` names the three modules; the README is accurate; the wrong layout comment is counted in the first finding |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no new dependency, `eslint-disable` or `innerHTML` |
| 9 | Repository-specific footguns | pass |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 55, feature)
  error: A live check is owed and not recorded. Do the steps in intents/55-rule-tables-panel/review.md → ## Live check, then set live_checked: <date> in intents/55-rule-tables-panel/metadata.yml.
  note:  15 file(s), 959 line(s) changed outside intents/.
```
The only error is the owed live check, which you clear; not rework.

## Findings
- **MEDIUM** `src/ui/rulesPanelLayout.ts:19-27`, `src/ui/rulesPanelLayout.test.ts:24-26`:
  the model of the centred prompts doesn't match the real ones. It models one
  fixed 340×200 box centred on (550, 375) ("the retreat and advance choosers
  are the largest"). In `src/scenes/BoardScene.ts`: the **retreat chooser**
  (`:2322`) is not a box (it highlights map hexes); the **exchange-sacrifice
  chooser** (`:2677`, `:2682`), the largest and the source of the 340 width, is
  340 × (110 + 24·n), centred, depth 20-21; the **advance chooser** (`:2425`,
  `:2430`) is 320 × (76 + 26·n), centred. Against the panel (depth 35-37, y
  8..274): exchange at n=4 is 206 tall, top y 272, only its border covered; at
  n=6 its top is y 248 and the title (the force to give up, at top+20 = 268) is
  mostly hidden; at n=7 fully hidden; at n≥9 the first row (top+56) is under
  the panel, whose background swallows the click; advance at n=6 is 232 tall,
  top y 259, its title clipped by about 3 px. Attack groups have no size cap
  (archers count at range 2), and EX comes up in the 5-1 and 6-1 columns,
  where big groups land. Clear: the ram prompt (`:1834`, 280×130, y 310..440)
  and the boarding prompt (`:2773`, 260×120, y 315..435); the confirm dialog
  (depth 50) and Save / Load (depth 40-41) draw above the panel. The test
  "puts the prompt box where the prompts are" compares the constant with
  itself. From code geometry, not seen in a browser.
  Needs decision: (a) accept the overlap for exchange choices of 6 or more
  attackers and advance choices of 6 candidates, and correct the comment and
  model to say so; (b) anchor the growing choosers to grow downward from y ≈
  282 (468 px, about 14 exchange rows); (c) hide the Tables panel while
  `decisionPending` is set; (d) shrink the panel further. Whichever: derive the
  box from the choosers' own size formulas (exported), so the layout test is
  tied to the real prompts.
- **LOW** `plan.md:198` (Progress): "22-26 px rows"; the ramming rows are 32 px
  (`src/ui/rulesPanel.ts:288`). Needs rework: "22-32 px rows".
- **LOW** `src/ui/rulesPanelLayout.ts:6`: `SIDE_PANEL_WIDTH = 300` copies
  `BoardScene.ts:89`'s `PANEL_WIDTH = 300` with nothing linking them; widen the
  side panel and the "keeps clear of the side panel" test still passes. Worth
  a look: `BoardScene` imports the layout's constant.
- **LOW** `src/ui/rulesPanelLayout.ts:10`: `TOP = 8 → 9` survives (G6): the
  panel's bottom at 275 against the box's top at 275, and the `<` test still
  sees no overlap. Equivalent in effect. Worth a look.

## Not checked
- **The exchange and advance choosers with the panel open:** derived from code;
  a 6-attacker EX was not built in a browser (it needs a big attack and a lucky
  roll).
- **Hexes under the panel:** retreat, push-target and advance hexes under it
  can't be clicked until the player pans or closes it; inherent to a non-modal
  panel; a live-check observation.
- **How the panel reads:** the reviewer's screenshots of the four tabs in
  English and French at 1100×750 (evidence, not the live check) show
  everything inside y 8..274; several French terrain cells wrap to two 11 px
  lines in 22-24 px rows and touch their edges ("Coût de mouvement", "+2 si les
  attaquants viennent du bas, sinon 0", "chars, cavalerie, éléphants", "+1 pour
  traverser").
- **The no-result tint (P1):** render only.
- **S10** (a load leaving a stale highlight): still untested.
- **Mutant scope:** engine and layout mutants against `npx vitest run src`
  (690 tests); scene and panel mutants against `e2e/rules-panel.spec.ts` alone.

## Live check
- **Owed** by rule 1 (`src/ui/rulesPanel.ts`, `rulesPanelLayout.ts`,
  `i18n/*`, and `src/scenes/BoardScene.ts`, `src/ui/devHook.ts` across the
  branch); new and visual. Rule 3 too, for the overlap and legibility items.
  Run it on the commit that resolves the first finding.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/55-rule-tables-panel`, with
     `HERAKLIOS_SAVES_DIR` set to an empty temp folder, `npm run dev -- --port
     5255 --strictPort --host 127.0.0.1`, open `http://127.0.0.1:5255/`.
  2. "Combat test mode (units face to face, 2 hexes)", then **📖 Tables**
     (beside Save / Load, bottom left).
  3. Each tab against the print: Terrain `docs/research/05-rules-french-original.md:177-184`,
     Land combat `:222-231`, Ramming `:388-394`, Boarding `:439-448`.
  4. **Placement:** a wide band across the top (just right of the side panel
     to the right edge, about the top third), never over the side panel or the
     centre. Judge whether enough map stays visible below it.
  5. **Ram prompt with the panel open, in movement:** ships are in rows r=7
     and r=9 from q=25, bows-on; move one a hex towards its counterpart so the
     ram prompt appears: fully visible, both buttons (Ram / Hold off)
     clickable.
  6. **Land attack with the panel open:** end the phase (it opens on Land
     combat), build an attack (archers onto the enemy 2 hexes away, or a group);
     each click moves the column and row tint; resolve. On DR or DE with
     several adjacent units the **advance chooser** appears: its title and
     buttons fully visible? On a retreat, the **retreat chooser**'s hexes: any
     under the panel? Test mode keeps rolls undoable: Ctrl+Z and re-resolve to
     try other results; if you get an **EX with 5 or more attackers**, look at
     the exchange chooser's title with the panel open.
  7. Click the panel over a unit: nothing changes on the map. Drag and wheel
     over it: no pan or zoom. Escape closes it; Tables twice opens and closes it.
  8. On the Menu switch to French, start the same way, repeat 2-4; look closely
     at the Terrain tab's two-line cells.
- **You should see:** four tabs matching the print (ramming: rows attacker,
  columns defender, galère × quintirème = "1"; boarding tinted exactly at the
  "rosé" cells); the highlight following every click and clearing on resolve;
  the ram and boarding prompts and the small choosers fully clear; whether the
  tall choosers are covered (the first finding); French labels that fit and
  read.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `e85b38e`; clean before, and after every
mutant):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 63 files,
  1177 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 15 files, 959
  lines (matches).
- `npm run e2e`: 17 passed (33.5 s) (matches).
- Mutants, one at a time, backed up and restored by copy, each checked as
  applied; engine with `npx vitest run src`, scene and panel with `npx
  playwright test e2e/rules-panel.spec.ts`:
  - survivors: G6 (`TOP` 8 → 9) **survived**, 690 passed; P1 (no-result tint
    dropped) **survived**, 1 passed (matches);
  - expected kills: V3 (A/D swapped in `boardingCode`) killed, "words each cell
    as the print does"; E21 (boarding columns reversed) killed, "has the print
    columns, in order"; E23 (ships and cells reversed together) killed,
    "matches the print: attacker rows, defender columns"; S2, S5, S6, S11
    killed (1 failed each) (matches).

**Reviewer agent** (same worktree and HEAD; nothing checked out):
- Git state: HEAD `e85b38e`; `main` 10 commits past the merge-base `25366f2`,
  none in `src/` or `e2e/`; no remote ref; none of the branch's commits on
  `main`.
- `npm run verify` (63 files, 1177 tests, lint 21), `check:intent` as above,
  `npm run e2e` 17 passed (36.3 s), `npm run sdlc:scan -- --sample-due auto
  --exclude 55`: nth attested auto change = 4, every 3, `sampled: no`.
- Prose numbers: 6 new tests (2 in `ruleTables.test.ts`, 4 in
  `rulesPanelLayout.test.ts`), 1171 + 6 = 1177; round 1 added 18 on a base of
  1153, matching the in-place Progress correction (below the marker, disclosed
  in the new entry: not a finding). The panel's 312..1088 × 8..274 reproduced
  from the constants.
- Prompt geometry read from `BoardScene.ts:1834`, `:2322`, `:2420-2432`,
  `:2672-2684`, `:2773`, `confirmDialog.ts:87-137`, `saveLoadPanel.ts:104-217`.
- Screenshots (a throwaway Playwright script outside the repo, its own server
  on 5232, saves in a scratch folder): 4 tabs × 2 languages, everything within
  y 8..274 (land legends end near y 210 in English, 246 in French).
- **19 mutants:** killed V3, V3n (null guard), C1 (codes reversed), E21, E23,
  G1 (`rectsIntersect` vertical term), G2 (`<` → `<=`), G3 (prompt height
  200 → 150), G3b (box not centred), G4 (panel height 300), G5 (panel left =
  margin) with `vitest run src`; S6, S5, S11, S2, R1 (panel shifted +400) with
  the e2e spec; survived G6 and P1.

**Taken on trust:** that `05-rules-french-original.md` transcribes the scan
faithfully; round 1's cell-by-cell table comparison (tables and builders
unchanged since); that the depth-35 background swallows clicks meant for
depth-20 prompts beneath it (consistent with S1 and R1 against map hexes, not
seen against a prompt).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut55b/`
(reviewer, with the screenshots in `shot/`) and `…/scratchpad/coord55/`
(coordinator).

Mutants a rework is expected to kill: a mutant on the exchange or advance
chooser's height formula (`BoardScene.ts:2677`, `:2425`), once the layout test
derives the box from them; the regression set above stays killed.

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
- **LOW, the 0xA7 byte: fixed** (a UTF-8 "§").
- **LOW, Progress "1165 before": fixed** in place (base 1153, +18), disclosed.
- **LOW, terrain "Closed to" for the wide river and coast (owner call):
  unchanged.**
- **LOW, CLAUDE.md module lists: fixed** (`CLAUDE.md:226-228`).
