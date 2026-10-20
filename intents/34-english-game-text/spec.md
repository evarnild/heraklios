<!-- generated-by: heraklios/intent@0.1.2 -->
# §34 spec — English for all game text except unit and country names

Accepted intent: [intent.md](intent.md)

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/02-rules-transcription.md` terrain table (l. 108-113) | The English terrain names: "Plaine (plain)", "Rivière large (wide river)", "Flancs abrupts (steep flanks)", "Plateaux (plateau)", "Marais (marsh)" |
| `docs/research/02-rules-transcription.md` "Naval movement" (l. 216-217) | "coastal fringe (light blue), mid-sea (medium blue, the deployment zones), and high seas (dark blue)" |
| `docs/research/02-rules-transcription.md` combat results (l. 153-157) | AE/AR/DE/DR/EX and what each does |
| `README.md` l. 114, 125, 189 | The docs that quote a label this changes |

## Behaviour

**B1 — Menu buttons.** The three French Menu buttons read:

| Now | Becomes |
| --- | --- |
| Mode test (2 joueurs, armées prêtes) | Test mode (2 players, armies ready) |
| Mode test combat (unités face à face, 2 cases) | Combat test mode (units face to face, 2 hexes) |
| Charger une partie | Load a game |

**B2 — Combat log results.** The "Result:" line keeps the rulebook code
first, then the English words. `BoardScene.RESULT_LABELS` becomes:

| Code | Becomes |
| --- | --- |
| AE | AE — attacker eliminated |
| AR | AR — attacker retreats |
| DE | DE — defender eliminated |
| DR | DR — defender retreats |
| EX | EX — exchange |

"Eliminated" (not "destroyed") because it is what the code's letter
stands for, so a player reading the printed table can match them.

**B3 — Terrain names in the hex tooltip.** `TERRAIN_LABELS`
(`src/ui/hexRender.ts`) becomes the game's English table, worded as the
English rules transcription words it, capitalised:

| Terrain | Now | Becomes |
| --- | --- | --- |
| plain | Plaine | Plain |
| river-wide | Rivière large | Wide river |
| steep-flank | Flancs abrupts | Steep flanks |
| plateau | Plateaux | Plateau |
| marsh | Marais | Marsh |
| coast | Frange côtière | Coastal fringe |
| sea | Pleine mer | High seas |
| the four zones | Anse d'Hypnos, Pointe d'Eole, Baie d'Argos, Cap Zénon | unchanged (place names) |

Its doc comment ("French labels … as used in the map editor palette")
becomes "English labels shown by the game's hex tooltip".

**B4 — The map editor stays French.** The editor's palette gets its own
table, `PALETTE_LABELS` in a new `src/map-editor/paletteLabels.ts`,
holding today's French strings verbatim. `src/map-editor/main.ts:81`
reads it instead of `TERRAIN_LABELS`. Nothing the editor shows changes.

Why a separate table and not a per-language map: there are two
consumers and they want one language each. A language switch would be
machinery for a choice nobody makes.

**B5 — Docs and comments that quote a changed label quote the new one.**
`README.md:114` ("(4, 9) — Plateau"), `:125` and `:189` ("Load a game").
The comments that name a Menu button by its label
(`e2e/*.spec.ts` headers, `src/ui/session.ts:164`,
`src/ui/testMode.ts:44`, `:115`, `src/scenes/BoardScene.ts:1042`) name
the English one, so a search for the old label finds nothing outside
`intents/`, `plan-history.md` and `docs/research/`. `README.md:584-585`
describes the editor's palette and stays French.

**B6 — Nothing else changes.** Unit names, the default player names
(Athènes, Perse, Macédoine, Sparte), the four zone names, "HÉRAKLIOS"
and "Jeux & Stratégie #6 (1980)" stay as they are. Comments in
`src/data/combatTable.ts` stay French.

## Interpretations

None of the rulebook. Two wording choices, recorded here rather than in
code (they are labels, not rules):

- **"High seas" for `sea`.** The French "Pleine mer" is literally "open
  sea"; the transcription calls the dark-blue band "high seas". The
  transcription wins, so the tooltip and the rules writeup use one name.
- **"Plateau", singular.** The French name is plural ("Plateaux"), but
  the transcription glosses it "plateau", and every other English name
  is singular.

## Acceptance criteria

- **AC1** — the tooltip shows the English names (B3). Test:
  `src/ui/hexTooltip.test.ts`, updated: "(4, 9) — Plateau", the plain
  hex and the off-map fallback read "Plain".
- **AC2** — every terrain in `TERRAIN_ORDER` has a game label and a
  palette label, and the four zones read the same in both. Test: new
  `src/map-editor/paletteLabels.test.ts`.
- **AC3** — the editor palette is unchanged: `PALETTE_LABELS` equals
  today's French table, entry for entry. Test: same file, the eleven
  strings spelled out.
- **AC4** — the Menu buttons carry the new labels (B1). Check:
  `npm run e2e` stays green with `e2e/helpers.ts` `MENU_TEST` /
  `MENU_CLOSE_COMBAT` set to the new strings (the suite clicks the
  buttons by label, so a mismatch fails it).
- **AC5** — the combat log shows "Result: AE — attacker eliminated"
  etc. (B2). Check: the live check (no test reaches `logCombatOutcome`'s
  text).
- **AC6** — the sweep: no French string literal left in `src/scenes/`,
  `src/ui/` or `index.html` besides B6's exceptions. Check: `/review`
  re-runs the accented-literal sweep the intent used.
- **AC7** — live check (owed: `src/scenes/**`, `src/ui/**`): the owner
  sees the three Menu buttons, a hex tooltip on plain, sea and a zone,
  one combat result in the log, and the map editor's palette still
  French.

## Non-functional

- **Engine/presentation split:** nothing in `src/engine/` or `src/data/`.
  The new palette table lives in `src/map-editor/`, next to its only
  reader.
- **Save format:** unchanged. No changed string is saved (player names
  are, and stay).
- **Undo boundaries:** none.
- **AI / harness:** none.

## Out of scope

- The map editor's own UI text, and `README.md`'s editor section.
- Comments, except those that quote a Menu label (B5).
- `docs/research/`, `plan-history.md`, earlier intents.
- Translating unit, country or place names.
- Any layout change. Each new label has no more characters than the
  old one (35 vs 36, 46 vs 46, 11 vs 18), so the Menu buttons keep their positions.

## Assumptions I made

- The English terrain words follow the transcription (B3) rather than a
  fresh translation.
- "Load a game", not "Load game": it mirrors the French and the README's
  prose ("the Menu's Load a game offers …").
- Code first in the combat log ("AE — attacker eliminated"), as in the
  intent's example, not "attacker eliminated (AE)".
- Updating the Menu-label comments (B5) is worth the extra files: a
  later search for "Mode test" otherwise lands on comments naming a
  button that no longer exists.
