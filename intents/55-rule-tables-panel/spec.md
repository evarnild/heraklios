<!-- generated-by: heraklios/spec@0.1.0 -->
# §55 spec — A Tables panel on the board shows the terrain table and the three combat tables

Accepted intent: [intent.md](intent.md)

Written against `main` at `b0e5355`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/05-rules-french-original.md:175-184` | "Tableau des effets de terrain": per terrain, the movement cost and the die modifier ("nombre de points à ajouter à la valeur indiquée par le dé lancé par l'attaquant"), with "si les attaquants viennent du bas" for steep flanks and plateaus, and the N.B. on which units may not enter which terrain |
| `05-rules-french-original.md:220-236` | "Table des résultats": the land CRT, columns 1-5 … 6-1, rows die 1-6, codes AE/AR/DE/DR/EX and their legend |
| `05-rules-french-original.md:388-395` | "Table des résultats pour l'éperonnage": attacker ship (rows) × defender ship (columns), the faces that sink |
| `05-rules-french-original.md:439-450` | "Table des résultats pour l'abordage": columns 1/3 … 5/1, rows die 1-6, D-n / A-n and the pink (no result) cells |
| `src/data/terrain.ts:53-105` (`TERRAIN_EFFECTS`), `:105` (`RIVER_CROSSING`) | the game's terrain data: `moveCost`, `combatModifier`, `conditionalOnAttackingFromBelow`, `forbiddenFor`; a river is a hexside with its own extra cost and modifier, and `river-wide` is a terrain |
| `src/data/combatTable.ts:10-39` | `RATIO_COLUMNS`, `LAND_CRT` (module-private), `ratioToColumnIndex` |
| `src/data/navalRamming.ts:114`, `:158` | `rammingSuccessRange` / `fullRammingSuccessRange` per attacker × defender ship |
| `src/data/navalBoarding.ts` | `BOARDING_RATIO_COLUMNS`, `BOARDING_TABLE` (module-private, `side: null` = the pink cells) |
| `src/engine/combat.ts:294` (`previewLandAttack`, §53) | the pre-roll forces and die modifier of the attack being built |
| `src/scenes/BoardScene.ts:606-732` | the side panel (`PANEL_WIDTH` 300) and its buttons; Save / Load at `:722-732` |
| owner's answers, 2026-10-24 and 2026-10-25 | board only; the game's data with a highlight; one Tables button with tabs; the panel stays open and the board keeps working; the highlight is the ratio column plus the cell each die face lands on; printed codes with a legend |

## Behaviour

**B1 — The button.** The board's side panel gets a **Tables** button (French:
**Tables**), placed with the other panel buttons near Save / Load. Clicking it
opens the panel, and clicking it again closes it. It works in every phase,
including the computer's turn, and changes nothing in the game.

**B2 — The panel.** A small panel drawn over the map on the side away from
the side panel, with four tabs: **Terrain effects**, **Land combat**,
**Ramming**, **Boarding** (French: **Effets du terrain**, **Combat terrestre**,
**Éperonnage**, **Abordage**). It opens on the Land combat tab during a combat
phase and on Terrain effects otherwise; it remembers the last tab chosen while
the board is open. A **Close** button and **Escape** close it.

**B3 — Non-modal.** While it is open, the board keeps working: map clicks,
pan and zoom outside the panel, and every side-panel button act as today. A
click on the panel itself never reaches the map underneath.

**B4 — Terrain effects tab.** One row per terrain the game uses on land
(`TERRAIN_EFFECTS`, sea-like terrains excluded), in the print table's order
where it has one: name, movement cost, die modifier for the attacker, with
"if the attackers come from below, else 0" where
`conditionalOnAttackingFromBelow`, and which unit categories may not enter it
(`forbiddenFor`, the print table's N.B.). A last row for the **river
crossing** (a hexside): its extra movement cost and its die modifier
(`RIVER_CROSSING`), with a note that it is crossed between two hexes.

**B5 — Land combat tab.** The CRT as printed: a header row of the ratio
columns (`RATIO_COLUMNS`), six rows for die 1-6, each cell its code
(AE, AR, DE, DR, EX), from the game's table. Under it, a legend: each code in
words and the rule that an exchange removes attackers totalling at least the
defenders' force; the rounding rule ("the ratio is rounded in the defender's
favour"); and that the die modifier from B4 is added to the roll, a modified
roll above 6 counting as 6.

**B6 — The highlight.** While the active player is building a land attack
with at least one attacker and one target (the §53 attack line), the Land
combat tab highlights:
- the column `ratioToColumnIndex(attackForce, defenseForce)` from
  `previewLandAttack`;
- in that column, the cell each die face 1-6 lands on after the modifier,
  `min(6, face + terrainModifier)`, so with a +2 modifier faces 5 and 6 both
  land on row 6;
- a line above the table: the two forces, the ratio column and the modifier,
  in the attack line's wording.

It updates on every change to the attack (§53's B4 change sites) and clears
when the attack is resolved, cleared, or the phase ends. With no attack being
built, nothing is highlighted. The computer's attacks are not highlighted.

**B7 — Ramming tab.** Attacker ship (rows) × defender ship (columns) for the
four ship types, each cell the die faces that sink the defender
(`rammingSuccessRange`), as printed ("1-2-3"). A legend: the attacker rolls a
die; on one of the listed faces the defender sinks, otherwise the ram fails;
unused movement adds a bonus of up to `MAX_RAMMING_BONUS`, which widens the
range (`fullRammingSuccessRange`). No highlight: a ram resolves when its
target is clicked.

**B8 — Boarding tab.** Columns `BOARDING_RATIO_COLUMNS`, rows die 1-6, each
cell `D-n`, `A-n`, or blank-and-tinted for no result (the print table's pink
cells). A legend: D = defender, A = attacker, n = equipment points lost (each
point −5 attack and −5 defence; a ship at 0 is removed); a tinted cell
changes nothing. No highlight: a boarding resolves when its target is chosen.

**B9 — Data, not text.** Every cell, cost and modifier comes from `src/data/`
through one pure, tested function per table that returns rows and cells
(e.g. `src/ui/ruleTables.ts` or `src/engine/ruleTables.ts`); the two
module-private tables (`LAND_CRT`, `BOARDING_TABLE`) are exposed read-only for
it, or read through their resolve functions. The panel only draws.

**B10 — Both languages.** Headings, tab names, terrain, unit-category and
ship names (`src/ui/i18n/names.ts`) and the legends are in `en.ts` and
`fr.ts`. The result codes stay as printed (AE, DR, D-1 …) in both languages,
with the legend translated.

## Interpretations

- **"The three combat results tables"** (intent): land, ramming, boarding.
- **Rivers:** the print table lists "rivières normales" and "rivière large"
  as terrain rows; the game models a normal river as a hexside
  (`RIVER_CROSSING`) and a wide river as a terrain (`river-wide`). The
  terrain tab shows the game's model (B4), so the numbers are the ones the
  rules engine uses, with the river-crossing row labelled as a hexside.
- **Highlight cells:** the CRT's modified die is clamped to 1-6 by
  `resolveLandCombat`; the highlight shows exactly those clamped cells (B6).
- **Pink boarding cells:** shown tinted and blank, as printed, rather than
  with an invented code (B8).

## Acceptance criteria

- **AC1 — table data** (`*.test.ts` beside the new function): each table's
  rows equal the game's data cell for cell: the CRT at every column and die
  equals `resolveLandCombat` with forces at that column's ratio and that die;
  the boarding table equals `resolveBoarding`; the ramming table equals
  `rammingSuccessRange`; the terrain rows equal `TERRAIN_EFFECTS` and
  `RIVER_CROSSING`, sea-like terrains excluded. Spot-check against the print:
  CRT row 1 at 1-5 is AR and at 6-1 DE; boarding die 2 at 1/3 is the no-result
  cell; ramming galley × quintireme is "1".
- **AC2 — the highlight** (a pure function, tested): for a preview with given
  forces and modifier, the highlighted column and the six (face → row) cells,
  including the clamp (+2: faces 5 and 6 → row 6) and modifier 0 (the diagonal
  is the column itself).
- **AC3 — text** (`messages.test.ts`, `noLiterals.test.ts`): every new text
  in both languages.
- **AC4 — e2e** (a new scenario through the dev hook, read-only additions
  guarded like the hook's others): open Tables from the board: the panel and
  its four tabs exist; switch tabs; Escape closes it; with it open, build an
  attack in "Combat test mode": the hook reports the highlighted column and
  cells matching `previewLandAttack` for that attack, and a board click still
  selects units.
- **AC5 — live check** (owed: `src/scenes/`, `src/ui/`, new and visual): open
  each tab in English and French and compare with the print tables; build an
  attack on a hill or across a river with the panel open and watch the
  column and cells follow; check the panel doesn't hide the side panel and
  that clicks on it don't reach the map.
- **AC6** — `npm run verify` green, lint ≤ 21, `npm run check:intent` PASS
  apart from the owed live check.

## Non-functional

- **Engine/presentation split:** the table builders and the highlight are
  pure and tested; `BoardScene` only opens the panel and passes the current
  preview.
- **Save format, undo, AI/harness:** untouched; no `GameState` change.
- **Rule data:** read only; no change to `src/data/` values (exposing a
  private table read-only is not a value change, but a `src/data/` edit puts
  those files in the diff: the path table's Reviewed rule tables if
  `combatTable.ts`, `navalRamming.ts` or `navalBoarding.ts` change at all).

## Out of scope

- The tables in the army builder or placement screens.
- Highlights for ramming and boarding, or for the computer's attacks.
- Expected-result odds or percentages.
- Unit statistics tables.

## Assumptions I made

- Panel size and position: about 460 × 320 px on the map side away from the
  side panel; the implementer may adjust it to fit the CRT's 11 columns.
- The panel opens on Land combat during a combat phase, Terrain effects
  otherwise (B2).
- If exposing `LAND_CRT` or `BOARDING_TABLE` is needed, it is a read-only
  export (e.g. `readonly CombatResult[][]`), which makes the change Reviewed
  by the path table; reading them through `resolveLandCombat` and
  `resolveBoarding` instead keeps `src/data/` untouched. The plan picks.
- The tab, legend and category texts' exact wording is the implementer's,
  following the README's terms.
