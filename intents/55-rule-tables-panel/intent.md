<!-- generated-by: heraklios/intent@0.1.5 -->
# §55 — A Tables panel on the board shows the terrain table and the three combat tables

**Type:** feature
**Originator:** the owner (2026-10-24): "I would like to have buttons that
open a small panel to show some tables: tableau des effets du terrain, les
trois tables des résultats de combat"
**Source:** none

## Problem

While playing, the players have to look up the rule tables outside the game:
the terrain effects table, the land combat results table, and the two naval
tables (ramming and boarding). The game uses all four
(`src/data/terrain.ts`, `combatTable.ts`, `navalRamming.ts`,
`navalBoarding.ts`), but the board shows none of them, so a player choosing
an attack or a move has to open the scanned rulebook or
`docs/research/` to know what a hill, a river or a 3-1 attack does.

## Outcome

- The board's side panel has one **Tables** button. It opens a small panel
  with four tabs: **Terrain effects**, **Land combat results**, **Ramming**,
  **Boarding**, each laid out like the print table, in English or French with
  the game's language. The panel closes with a button or Escape, and opening
  it changes nothing in the game.
- Every value shown comes from the game's own data in `src/data/` (the tables
  the engine resolves with), not from typed-in text, so the panel can't
  disagree with the rules being played.
- **Highlight:** while a land attack is being built (attackers and at least
  one target chosen), the Land combat tab highlights the column for the
  current force ratio and the die rows as shifted by the current terrain and
  river modifier. What the naval tabs highlight is for the spec.

## Constraints

- **Rulebook:** the tables as printed, `docs/research/05-rules-french-original.md`:
  "Tableau des effets de terrain" (`:175-184`), "Table des résultats"
  (`:220-236`), "Table des résultats pour l'éperonnage" (`:388-395`), "Table
  des résultats pour l'abordage" (`:439-450`), with the transcription in
  `02-rules-transcription.md`. Where the game's data encodes an
  interpretation (for example a river as a hexside, the "attacking from
  below" condition, the boarding table's pink cells), the panel shows the
  game's reading and the spec says how it is labelled.
- **Engine/presentation split:** the table contents come from `src/data/`
  through a pure, tested function that turns them into rows and cells; the
  panel only draws. The highlight's ratio column and die shift come from the
  engine (`ratioToColumnIndex`; §53's `previewLandAttack`), never computed in
  the scene.
- **Depends on §53** for the pre-roll forces and die modifier
  (`previewLandAttack`, in review on `feat/53-…`). This intent's build
  should start after §53 is merged, or the spec must say otherwise.
- **Text in `src/ui/i18n/`** (`noLiterals.test.ts`): headings, terrain and
  result names in English and French.
- **No game state change:** no save-format, undo or AI change.
- **Board only:** not in the army builder or placement screens.
- A live check is owed (`src/scenes/`, `src/ui/`, new and visual).

## Type-specific questions

### Feature
- **Users:** hotseat players on the board.
- **Rulebook basis:** the four printed tables (above); displaying them is
  digital-only.
- **Known simplification it removes:** none.
- **Open design questions:**
  - Panel size and placement over the map, and whether it stays open while
    the player keeps clicking the board (so the highlight follows the
    attack being built) or is modal.
  - The highlight's exact form: the column only, the column plus the shifted
    die rows, or the single cell the roll would land on for each die face.
  - Naval tabs: highlight the attacker/defender row and column for a ramming
    or boarding being chosen, given that both resolve as soon as the target
    is clicked (`log.navalImmediate`)?
  - The terrain tab: whether it also shows which units may not enter which
    terrain (the print table's N.B.), and the river as a hexside cost.
  - Result codes (AE, AR, DE, DR, EX; D-1, A-2; the pink boarding cells):
    shown as printed with a legend, or spelled out.

## Assumptions I made

- **Owner's answers (2026-10-24):** board only; the game's own data with a
  highlight during an attack; one Tables button with four tabs.
- "The three combat results tables" are the land table, the ramming table
  and the boarding table.
- The button sits in the board's side panel near Save / Load.
