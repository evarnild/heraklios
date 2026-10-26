<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §55 plan — A Tables panel on the board shows the terrain table and the three combat tables

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

A **Tables** button on the board opens a non-modal panel with four tabs
(terrain effects, land combat, ramming, boarding) built from the game's data
(spec B1-B5, B7-B10). During a land attack being built, the land tab
highlights the ratio column and the cell each die face lands on (B6).

## Risks

- **Editing rule tables by accident.** `LAND_CRT` and `BOARDING_TABLE` are
  module-private. **This plan reads them through the existing lookups**
  (`resolveLandCombat`, `resolveBoarding` with forces chosen per column, and
  `rammingSuccessRange`) so `src/data/` stays untouched and the change stays
  Attested. If a column can't be reached through forces (each must be), stop
  and report rather than export the table.
- **Forces that land on the wrong column.** The builder picks, per column,
  forces whose ratio `ratioToColumnIndex` maps to that index; a test asserts
  the index for each, so a rounding change can't silently shift a column.
- **Tests that pass whatever the code does:** AC1 compares every cell with the
  lookups **and** spot-checks printed cells (CRT die 1 at 1-5 = AR, at 6-1 =
  DE; boarding die 2 at 1/3 = no result; ramming galley × quintireme = "1"),
  so a builder that mirrors a bug in the lookups is still caught by the print.
- **The highlight drifting from the roll.** It uses `previewLandAttack` (§53)
  and the same `min(6, face + modifier)` clamp `resolveLandCombat` applies;
  AC2 tests the clamp at +2 and the diagonal at 0.
- **Non-modal clicks.** A click on the panel must not reach the map (B3):
  the panel's background is interactive and stops propagation, as
  `SaveLoadPanel` and the log panel do; the e2e checks a board click still
  selects outside it.
- **`BoardScene.ts` and the lint cap (21).** It already warns for length and
  four long functions. Put the panel in its own `src/ui/rulesPanel.ts`; the
  scene only creates it, toggles it, and calls `panel.setAttack(preview)` from
  `logAttackLine` and `clearCombatSelection`. Don't grow `create`. Never raise
  the cap.
- **Text:** every string through `messages()` (`noLiterals.test.ts`); unit
  categories for "may not enter" need names in `names.ts`.
- **Escape** is free today (`BoardScene.ts:801-810` binds Z, Y, Space, Enter);
  don't let it also close Save / Load in a surprising order: Escape closes the
  Tables panel only when it's open.
- **Stale line citations:** re-check before relying on them.

## Verified against the codebase

Re-read on `main` at `7d69063`.

- `src/data/terrain.ts:1-…` — `TerrainType`; `:27` — `isSeaLike`; `:53-104` —
  `TERRAIN_EFFECTS` (`moveCost`, `combatModifier`,
  `conditionalOnAttackingFromBelow`, `forbiddenFor`); `:105` — `RIVER_CROSSING`
  (`extraMoveCost`, `combatModifier`).
- `src/data/combatTable.ts:10-21` — `RATIO_COLUMNS`; `:25` — `LAND_CRT`
  (private); `:39` — `ratioToColumnIndex`; `:60-…` — `resolveLandCombat`,
  which clamps the die to 1-6 (`:65`).
- `src/data/navalRamming.ts:1` — `ShipTypeId`; `:3` — `SHIP_ORDER` (private;
  the four ship ids are in `ShipTypeId`); `:15` — `MAX_RAMMING_BONUS`; `:114`
  — `rammingSuccessRange(attacker, defender)`; `:158` —
  `fullRammingSuccessRange`.
- `src/data/navalBoarding.ts` — `BoardingResult` (`side: null` = no result),
  `BOARDING_RATIO_COLUMNS`, `BOARDING_TABLE` (private),
  `boardingRatioToColumnIndex`, `resolveBoarding`.
- `src/engine/combat.ts:294` — `previewLandAttack` (attackForce, defenseForce,
  terrainModifier, …).
- `src/engine/state.ts` / `movement.ts` — `unitCategory` (the categories
  `forbiddenFor` names).
- `src/scenes/BoardScene.ts:88` — `PANEL_WIDTH = 300`; `:606-732` — the side
  panel; `:722-732` — Save / Load; `:801-810` — key bindings; `:997` —
  `openSaveLoad`; `:1974` — `logAttackLine` (§53, called at every attack
  change); `:2079` — `clearCombatSelection`; `:548` — `resetSceneState`.
- `src/ui/saveLoadPanel.ts` — an overlay panel built from Phaser objects (the
  pattern for the new panel, minus the modality).
- `src/ui/i18n/names.ts:7`, `:17` — `unitName`, `terrainName`.
- `src/ui/devHook.ts:88`, `:102`, `:110` — the `*_MEMBERS` guard pattern.
- `e2e/helpers.ts` — `MENU_CLOSE_COMBAT`, `startFromMenu`, `clickButton`;
  `e2e/attack-log.spec.ts` — the §53 route to an attack being built.

## Subtasks

1. **The table builders** (B4, B5, B7, B8, B9; AC1). New
   `src/engine/ruleTables.ts` (pure, no Phaser): `terrainTable()`,
   `landCombatTable()`, `rammingTable()`, `boardingTable()`, each returning
   plain rows and cells (codes and numbers, no display text), built from the
   lookups above. Tests in `ruleTables.test.ts`: every cell against the lookup,
   each column's forces mapping to its index, the print spot-checks, sea-like
   terrains excluded, the river-crossing row. Commit.
2. **The highlight** (B6; AC2). In the same file,
   `landCombatHighlight(preview): { column, cells: [face, row][] , … } | null`
   (null with no preview). Tests: +2 clamp, modifier 0, the column from the
   forces. Commit.
3. **Text** (B10; AC3). `en.ts` / `fr.ts`: the button, tab names, column
   headings, the legends (CRT codes, rounding, the die clamp, ramming bonus,
   boarding D/A/n and no result), the "attackers from below" note, the
   river-crossing row label, the highlight's summary line (reusing §53's
   wording where it fits); unit-category names in `names.ts`. Commit.
4. **The panel** (B1-B3, B6). `src/ui/rulesPanel.ts`: draws the four tabs from
   the builders and messages, tints the highlighted column and cells, has
   Close, swallows its own clicks; `setAttack(preview | null)`, `toggle()`,
   `isOpen()`. In `BoardScene`: the Tables button near Save / Load, Escape
   when open, `setAttack` from `logAttackLine` and `clearCombatSelection`, and
   cleanup in `resetSceneState`. Check the lint count. Commit.
5. **e2e and README** (AC4). Read-only dev-hook `rulesPanel()` (open, tab,
   highlighted column and cells), guarded like the others. `e2e/rules-panel.spec.ts`
   (header naming §55): from `MENU_CLOSE_COMBAT`, open Tables, switch tabs,
   Escape closes; reopen, build an attack (the §53 route), and assert the
   hook's column and cells equal `landCombatHighlight(previewLandAttack(...))`
   for that attack; a board click still selects a unit with the panel open.
   `npm run e2e` all green. README: one paragraph in the board section.
   Commit, then the Progress entry and `status: in-review`.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| a CRT cell from the wrong column or die | AC1 cell-by-cell comparison, and the print spot-checks |
| a column's forces mapping to the neighbour column | AC1 index assertion per column |
| a boarding no-result cell shown as a result | AC1 boarding die 2 at 1/3 |
| ramming rows and columns swapped | AC1 ramming galley × quintireme = "1" (asymmetric) |
| sea-like terrain included, or river row missing | AC1 terrain rows |
| `forbiddenFor` or the from-below flag dropped | AC1 terrain rows (steep flank: chariot, cavalry; conditional) |
| the clamp dropped, or the shift off by one | AC2 +2 case (faces 5, 6 → row 6), modifier 0 |
| highlight not cleared after resolve / clear | AC4 (and live check) |
| panel clicks reaching the map | AC4 board click outside, live check inside |

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS (apart from the owed live check after review).
- `npm run e2e` green, with the new scenario.
- **Live check (owed: `src/scenes/`, `src/ui/`, new and visual):**
  1. In the worktree, `npm run dev -- --port 5255 --strictPort --host
     127.0.0.1` (with `HERAKLIOS_SAVES_DIR` set to a temp folder), open
     `http://127.0.0.1:5255/`, "Combat test mode".
  2. Click Tables: four tabs; compare each with the print tables
     (`docs/research/05-rules-french-original.md:175-184`, `:220-236`,
     `:388-395`, `:439-450`).
  3. In a combat phase, with the panel open, build the §53 live-check attack
     (wide river, river crossing): the column and the shifted cells follow
     each click; resolve: the highlight clears.
  4. Click on the panel: nothing happens on the map under it. Escape closes.
  5. Switch to French and look again.

## Assumptions I made

- File names `src/engine/ruleTables.ts`, `src/ui/rulesPanel.ts`, and the
  method names above.
- `src/data/` is not edited (Risks), so the tier stays Attested by the path
  table.
- The worktree's dev port is 5255 (5200 + 55).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-26 — all five subtasks

Commits: `1f2fedc` table builders, `316bedb` highlight, `840d6a2` texts,
`939eed1` panel and button, `9fcd912` dev hook, e2e and README.

Shipped: `src/engine/ruleTables.ts` (terrain, land, ramming, boarding
builders and `landCombatHighlight`, all read through `resolveLandCombat`,
`resolveBoarding`, `rammingSuccessRange`; `src/data/` untouched), `rules`
and `board.tables` messages in English and French, `unitCategoryName`,
`src/ui/rulesPanel.ts`, the Tables button beside Save / Load, Escape, the
`rulesPanel()` dev-hook reader, `e2e/rules-panel.spec.ts`, README section
"The Tables panel".

Tests: `npm run verify` green, 62 files / 1171 tests (1165 before this
intent's builders). Lint 21 warnings (cap unchanged). `npm run e2e`: 17 of 17
passed, including the new scenario and placement.spec.ts (22.9 s, no timeout).

Divergences: the panel is drawn at the top right of the canvas, 580 x 392,
and covers the map centre at the 1100 x 750 game size, so the e2e pans the
camera 9 hexes before clicking and the live check should judge the placement.
The highlight also resyncs on undo/redo restores (not only on the §53 line
sites), and `reset()` clears the panel on a new game. Boarding codes D-n / A-n
are formed in the panel from `side` and `equipmentLoss`. Ramming shows the
printed (no-bonus) range, the bonus being in the legend.
