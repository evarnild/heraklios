<!-- generated-by: heraklios/intent@0.1.2 -->
# §34 — English for all game text except unit and country names

**Type:** feature
**Originator:** me (Eric)
**Source:** none

## Problem

All texts in the game should be in English, except the names of the units
and countries. Today the game mixes the two languages: most of the UI is
English, but some text a player reads is still French.

| Where | French text a player sees |
| --- | --- |
| `src/scenes/MenuScene.ts:184` | "Mode test (2 joueurs, armées prêtes)" |
| `src/scenes/MenuScene.ts:201` | "Mode test combat (unités face à face, 2 cases)" |
| `src/scenes/MenuScene.ts:220` | "Charger une partie" |
| `src/scenes/BoardScene.ts:2508-2514` `RESULT_LABELS` | "AE — Attaquant Éliminé (attacker destroyed)", "AR — Attaquant Recule …", "DE — Défense Éliminée …", "DR — Défense Recule …", "EX — Échange (exchange)" in the combat log |
| `src/ui/hexRender.ts:71-83` `TERRAIN_LABELS`, shown by the hex tooltip (`src/ui/hexTooltip.ts:25`) | Plaine, Rivière large, Flancs abrupts, Plateaux, Marais, Frange côtière, Pleine mer |

The inventory comes from a sweep of every literal the scenes and `src/ui`
draw (`.text(`, `setText(`, `log(`) on `main` at `145e102`. Everything
else they draw is already English.

## Outcome

- Every text the game shows a player is in English, except:
  - **unit names** (`src/data/units.ts` `name:`: Fantassins, Galères,
    Éléphants, …);
  - **country names**, the players' default names
    (`src/ui/session.ts:74`: Athènes, Perse, Macédoine, Sparte);
  - **proper place names** on the map: Anse d'Hypnos, Pointe d'Eole,
    Baie d'Argos, Cap Zénon (owner's decision, 2026-10-20);
  - **the title and source**: "HÉRAKLIOS", "Jeux & Stratégie #6 (1980)".
- Combat results keep the rulebook's codes with English words, e.g.
  "AE — attacker eliminated", so the log still matches the printed combat
  table (owner's decision).
- The documentation that quotes a changed label quotes the new English
  one (`README.md:125`, `:189` name "Charger une partie").
- A later reviewer can check this with the same sweep: no French outside
  the four exceptions.

## Constraints

- **Game only.** The map editor (`map-editor.html`, `src/map-editor/`)
  stays French (owner's decision). But `TERRAIN_LABELS` is shared: the
  editor's palette reads it too (`src/map-editor/main.ts:81`). Translating
  it for the game must leave the editor's palette French. How is the
  spec's call.
- Presentation and docs only. No change to `src/engine/` or `src/data/`
  behaviour. `combatTable.ts`'s French appears only in comments, and
  comments are out of scope.
- **Saves:** player names are saved (`src/ui/saveStorage.ts:34`, `:59`),
  but they stay as they are. No other changed string is in `GameState`,
  so the save format is unchanged.
- **Tests that pin the old text:** `src/ui/hexTooltip.test.ts:20`, `:30`
  (expect "Plaine"), and `e2e/helpers.ts` `MENU_TEST` /
  `MENU_CLOSE_COMBAT` (the e2e suite clicks Menu buttons by label). Both
  change with the labels; the suite must stay green.
- `src/scenes/**` and `src/ui/**` owe a live check (`REVIEW-POLICY.md` →
  "Live checks", rule 1).

## Type-specific questions

### Feature
- **Users:** every hotseat player; anyone reading the combat log or the
  hex tooltip.
- **Rulebook basis:** digital-only. Presentation text, no rule. The
  combat codes AE/AR/DE/DR/EX come from the printed combat table and are
  kept.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - The exact English for each string: the three Menu buttons, the five
    result descriptions, and the seven terrain names ("Frange côtière" →
    "Coastal strip"? "Flancs abrupts" → "Steep slopes"?). Should the
    terrain words follow the English rules transcription in
    `docs/research/`, where it has names for them?
  - The editor's palette: does it get its own French table, or does
    `TERRAIN_LABELS` become a per-language map?
  - Does the combat log keep the code at all once the words are English
    ("AE — attacker eliminated" versus "attacker eliminated (AE)")?

## Assumptions I made

- **Feature, not adjustment.** The change touches at least six files
  (MenuScene, BoardScene, hexRender, hexTooltip.test, e2e/helpers,
  README), seven if the editor gets its own label table. That's over the
  adjustment limit of ≤5 files, though every edit is a string.
- "Countries" means the four default player names. A player can rename a
  seat, and whatever they type is theirs.
- Code comments, docs other than those quoting a changed label, and
  `docs/research/` (the transcribed French rulebook) are out of scope.
- The magazine name "Jeux & Stratégie" and the game's title are proper
  names and stay as they are.
