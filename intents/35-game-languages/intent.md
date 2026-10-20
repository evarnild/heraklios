<!-- generated-by: heraklios/intent@0.1.2 -->
# §35 — Play the game in several languages, French and English first

**Type:** feature
**Originator:** me (Eric)
**Source:** none

## Problem

The game should let people play in several languages, with French and
English first. Today every text is written into the code in one
language, so a French table can't play in French and an English one
can't play fully in English. Even after §34 the game is English-only,
and unit and country names are French whatever the table speaks.
Adding a language today would mean editing every scene.

Where the text lives (on `main` at `1331afb`):

| Where | What |
| --- | --- |
| `src/scenes/*.ts` | about 140 `.text(` / `setText(` / log calls; `BoardScene.ts` alone has about 87 |
| `src/ui/*.ts` | the save/load panel, confirm dialog, hex tooltip, `MapView` |
| `src/ui/hexRender.ts` `TERRAIN_LABELS` | terrain names (English after §34) |
| `src/data/units.ts` `name:` | the fourteen unit names (Archers, Fantassins, … Quintirèmes) |
| `src/ui/session.ts:74` | default player names Athènes, Perse, Macédoine, Sparte |
| `src/engine/combat.ts:550`, `:555` | English `reason` strings built in the engine and shown to a player |
| `index.html:2` | `<html lang="en">` |

## Outcome

- The Menu has a language switch, English / Français. The choice is
  remembered in the browser. On a first visit the game follows the
  browser's language: French if it is French, English otherwise
  (owner's decision).
- In each language, every text the game shows is in that language,
  including unit names and the default country names (owner's decision:
  "translated per language").
- Adding a third language means adding one table, not editing scenes.
  A test fails if a language table is missing a text the others have.
- The engine and data stay language-free. The rules don't change, and
  a saved game loads the same in either language.

## Constraints

- **Builds on §34** (owner's decision). §34 ships the all-English text
  first; this spec is written against §34's merged labels, and §35 is
  spawned after §34 merges.
- **Game only.** The map editor (`map-editor.html`, `src/map-editor/`)
  stays French (owner's decision).
- **Engine/presentation boundary** (CLAUDE.md → Architecture). Language
  lives in `src/ui/` and the scenes. `src/data/units.ts`'s `name:` and the
  engine's `reason` strings are read by tests and engine code
  (`combat.ts:550` builds a reason from `t.name`). How the display name is
  separated from the data, and how the engine says *why* without English
  text, is the spec's call.
- **Saves:** player names are saved as typed (`src/engine/saveGame.ts:117`,
  `src/ui/saveStorage.ts:34`). The language is not part of a game, so it
  is not saved with one, and `SAVE_VERSION` should not change.
- **Combat codes** AE/AR/DE/DR/EX stay codes in both languages; the words
  after them are translated (§34's rule).
- **The e2e suite clicks Menu buttons by label** (`e2e/helpers.ts:16-17`).
  It has to pin one language so it can't depend on the browser it runs in.
- `src/scenes/**`, `src/ui/**`, `index.html` owe a live check
  (`REVIEW-POLICY.md` → "Live checks").
- `BoardScene.ts` is about 3000 lines and over the 500-line guardrail. Any
  change there must leave the lint warnings at the cap or under it.

## Type-specific questions

### Feature
- **Users:** every hotseat player, in French or English.
- **Rulebook basis:** digital-only. The source rulebook is French
  (`docs/research/05-rules-french-original.md`); its terms are the
  natural French labels, and the English transcription
  (`docs/research/02-rules-transcription.md`) supplies the English ones.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - The mechanism: a home-made `t(key, params)` with one table per
    language, or a library? Phaser has none built in.
  - Switching language while a game is running: only from the Menu, so
    the next scene draws in the new language? Or live, which means every
    open text redraws?
  - English unit names: Infantry, Light cavalry, Galleys, …? Do they follow
    the English transcription's terms where it has them?
  - Default country names in English: Athens, Persia, Macedonia, Sparta.
    A seat still holding the other language's default when the language
    changes: rename it, or leave it as the player sees it?
  - Place names (Anse d'Hypnos, Pointe d'Eole, Baie d'Argos, Cap Zénon)
    in English mode: translated, or kept as proper names?
  - The combat log is built from sentences with numbers and names in
    them. Does each language get whole sentence templates, so word order
    and plurals are its own?
  - The README: does it say how to switch, or document the game in both
    languages?

## Assumptions I made

- **Feature.** A new player-visible capability across every scene.
- The switch is on the Menu only. "Remembered" means `localStorage`,
  per browser, the way saves are.
- Player names a seat has typed are never translated; only the four
  defaults are.
- The map editor and `docs/` stay as they are.
- §34's exception for unit and country names (French in English mode) is
  overruled by this intent, but only once §35 ships. §34 ships as
  accepted.
