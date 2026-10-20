<!-- generated-by: heraklios/intent@0.1.2 -->
# §35 spec — Play the game in several languages, French and English first

Accepted intent: [intent.md](intent.md)

Written against `main` at `ef7276d`, after §34's merge (`d36e7b5`).

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/05-rules-french-original.md` | The French terms: unit names, terrain, combat codes, phases |
| `docs/research/02-rules-transcription.md` l. 108-113, 182-218 | The English terrain names (already used by §34) and the English unit terms it uses: archers, phalanxes, light/heavy cavalry, elephants, chariots, galleys |
| `docs/research/01-history-and-background.md:19` | "the armies of Athens, Sparta, Macedon, and Persia" — the English country names |
| `intents/34-english-game-text/spec.md` | Today's English labels, the combat codes rule, the editor's separate French palette |

## Behaviour

**B1 — Two languages, one table each.** The game ships English (`en`)
and French (`fr`). Every text the game shows comes from the current
language's table, in `src/ui/i18n/`. A message with values in it (a unit
name, a number, a hex) is a function in the table, so each language
writes its whole sentence: its own word order, its own plurals.

**B2 — The tables can't drift apart.** The English table defines the
set of messages; the French one is typed against it, so a missing,
extra or wrongly-typed message is a build error (`tsc`). A test also
fails if any message returns an empty string in either language.

**B3 — Choosing the language.** The Menu shows a two-button switch,
**English | Français**, the current one highlighted. Clicking the other
redraws the Menu in that language at once. The choice is stored in
`localStorage` (key `heraklios.language`). With nothing stored, or a
value that isn't a known language, the game uses French when
`navigator.language` starts with `fr`, English otherwise. If storage is
unavailable the switch still works for the session.

**B4 — Switching happens only on the Menu.** Every other scene reads
the language when it is created and doesn't redraw on a change; there
is no switch outside the Menu. A game started in one language plays in
it to the end.

**B5 — Unit names per language.** Each unit is named by its `id`
through the table. `src/data/units.ts`'s `name:` field is not shown to
players any more (it stays, as the rulebook's French name, for tests and
code comments). English names:

| id | French (as today) | English |
| --- | --- | --- |
| archers | Archers | Archers |
| fantassins | Fantassins | Infantry |
| fantassins-archers | Fantassins-Archers | Infantry-archers |
| fantassins-lourds | Fantassins Lourds | Heavy infantry |
| phalanges | Phalanges | Phalanxes |
| cavalerie-legere | Cavalerie Légère | Light cavalry |
| cavalerie-lourde | Cavalerie Lourde | Heavy cavalry |
| elephants | Éléphants | Elephants |
| chars-legers | Chars Légers | Light chariots |
| chars-lourds | Chars Lourds | Heavy chariots |
| galeres | Galères | Galleys |
| biremes | Birèmes | Biremes |
| triremes | Trirèmes | Triremes |
| quintiremes | Quintirèmes | Quinqueremes |

The ids are `units.ts`'s (checked at `ef7276d`).

**B6 — Country names per language.** The four default player names
come from the table: Athènes / Athens, Perse / Persia, Macédoine /
Macedon, Sparte / Sparta. They are set when a game starts
(`resetSession`), in the language of that moment, and saved with the
game as today. A loaded game shows the names it was saved with,
whatever the current language. (Players can't rename a seat today, so
these are the only names there are.)

**B7 — Other labels per language.**
- Terrain: §34's English table and the French names the editor uses
  (Plaine, Rivière large, …, Pleine mer).
- Combat results: the codes AE/AR/DE/DR/EX stay in both languages;
  French adds "attaquant éliminé", "attaquant recule", "défenseur
  éliminé", "défenseur recule", "échange".
- Edges (W/E/N/S → O/E/N/S in French), player colours, phase names, and
  the slot summary of a save ("Turn 3 — Athens (movement)" / "Tour 3 —
  Athènes (mouvement)").
- Undo/redo labels ("Move Galleys" / "Déplacer Galères") are made in the
  language of the moment and kept in the history as text.

**B8 — Place names per language** (owner's decision, 2026-10-20). The
four named zones are shown in the hex tooltip through the table:

| Zone | French (as today) | English |
| --- | --- | --- |
| zone-anse-hypnos | Anse d'Hypnos | Hypnos Cove |
| zone-pointe-eole | Pointe d'Eole | Aeolus Point |
| zone-baie-argos | Baie d'Argos | Bay of Argos |
| zone-cap-zenon | Cap Zénon | Cape Zeno |

Éole and Zénon take their usual English forms (Aeolus, Zeno); Hypnos
and Argos are the same in both. The map editor keeps its French palette
(§34 B4). The title "HÉRAKLIOS" and the source line's
"Jeux & Stratégie #6 (1980)" are unchanged; the rest of that line is
translated.

**B9 — The engine stops producing display text.** Four engine places
build English sentences today. Each returns data instead, and the
presentation writes the sentence:

| Where | Today | Becomes |
| --- | --- | --- |
| `src/engine/army.ts:24`, `:30`, `:36` | `validateArmy`'s `errors: string[]` | a typed list: over a unit's maximum (type id, count, max), over budget (total), under budget (total) |
| `src/engine/drift.ts:533-612` | `DriftHooks.onLine(line)` narration | the presentation formats each `DriftEvent` it already receives; `onLine` is removed |
| `src/engine/combat.ts:550`, `:555` | `RangedCheck.reason` text (no reader shows it) | a code: `'no-melee'` or `'wrong-range'` |
| `src/engine/saveGame.ts:131` | `describeSave()` | moves to `src/ui/` as the translated slot summary; removed from the engine |

The rules don't change: the same armies are valid, the same drifts
happen, in the same order.

**B10 — The page's language.** `document.documentElement.lang` follows
the current language (`index.html` keeps `lang="en"` as the default
before the script runs). The map editor isn't touched (`lang="fr"`).

**B11 — The smoke suite pins English.** `e2e/` sets the stored language
to `en` before the page loads, so it never depends on the browser's
locale. Its Menu labels stay §34's English ones.

**B12 — README.** A short "Language" paragraph under the Menu
description: the switch, that it is remembered, and that it is set from
the Menu only. The rules writeup stays English.

## Interpretations

No rulebook passage is involved. Two choices without another home:

- **"Quinqueremes", not "Quintiremes".** The transcription's own gloss
  of the French example is "the attacking galley sinks the quinquereme"
  (`02-rules-transcription.md:256-257`); that is the English word.
- **"Macedon", not "Macedonia".** The history document's form
  (`01-history-and-background.md:19`), and the period-correct name.

## Acceptance criteria

- **AC1 — no text without a table** (B1). A test in `src/ui/i18n/`
  reads every `.ts` file in `src/scenes/` and `src/ui/` (not tests, not
  `i18n/` itself) and fails on a string or template literal containing
  a word of two or more letters passed to `.text(`, `setText(`,
  `log(`, `appendLine(`, `recordAction(`, `history.push(`, `status(` or
  assigned to `textContent`. An allow-list names the exceptions (the
  title and source, font names, colour strings, texture keys) with a
  reason each.
- **AC2 — tables complete** (B2). `tsc` in `npm run verify`; the
  non-empty test runs every message of both tables, with sample values
  for the functions.
- **AC3 — choosing** (B3). Unit tests of the pure part
  (`resolveLanguage(stored, navigatorLanguage)`): stored `fr` / `en`
  wins; unknown stored value → navigator; `fr-CA` → `fr`; `de-DE` →
  `en`; nothing at all → `en`.
- **AC4 — unit, country and place names** (B5, B6, B8). Test: every unit type in
  `UNIT_TYPES` has a name in both tables; the English names equal B5's and the zone names B8's;
  the French equal `units.ts`'s `name:`; `resetSession` in French gives
  the French defaults, in English the English ones.
- **AC5 — engine is language-free** (B9). Tests of `army.ts`,
  `drift.ts`, `combat.ts` assert the structured results, not text; the
  presentation's formatters for them are tested in both languages. The
  fuzz and soak harnesses (`fuzzHarness.test.ts`,
  `heuristicSoak.test.ts`) still pass unchanged in behaviour.
- **AC6 — rules unchanged.** `npm run verify` green with no change to
  any test's expected game state, only to expected text.
- **AC7 — smoke suite** (B11). `npm run e2e` green.
- **AC8 — live check** (owed: `src/scenes/**`, `src/ui/**`,
  `index.html`). In French: the Menu, the army builder (including an
  over-budget message), placement prompts, a move, a land combat with
  its result line, a ram or a boarding, an elephant drift if the test
  shortcut reaches one, save/load slot summaries, game over. Then the
  switch back to English, and a reload keeps the choice. Every French
  text fits where it is drawn (no overlap, nothing cut off).

## Non-functional

- **Engine/presentation split:** the tables, `t()`, `resolveLanguage`
  and the formatters for B9's structured results live in `src/ui/i18n/`
  (pure, tested). The engine changes only to return data instead of
  English text.
- **Save format:** unchanged; `SAVE_VERSION` stays. Names are saved as
  today. `describeSave` leaving `saveGame.ts` is a function move, not a
  format change, but it touches a Reviewed path, so this change is
  **Reviewed** (`REVIEW-POLICY.md` path table).
- **Undo boundaries:** none new.
- **AI / harness:** `legalActions`/`applyAction` unchanged. Only
  `BoardScene.ts:288` and `drift.test.ts:136` read `onLine` today; the
  harness never does.
- **Width:** French sentences run longer. Every fixed-position text the
  plan touches is measured in both languages against its neighbour
  (as §33 did for the placement prompt), and wrapped or shortened where
  it doesn't fit.
- **Lint cap (21):** no new warning. `BoardScene.ts` already exceeds
  the file-size guardrail; moving its sentences into tables should
  shrink it, never grow it.

## Out of scope

- The map editor and `map-editor.html`.
- A third language (the structure allows one; none is added).
- Translating `README.md`, `docs/`, code comments, or console output.
- Letting players rename a seat.
- Translating a loaded game's player names (B6).
- Number and date formats: the slot timestamp stays `YYYY-MM-DD HH:MM`.

## Assumptions I made

- Home-made `t()` and plain TypeScript tables, no library: two
  languages, every message typed, and nothing to load at runtime.
- English unit names follow the transcription where it has a term
  (archers, phalanxes, cavalry, elephants, chariots, galleys) and are my
  translation elsewhere (Infantry, Infantry-archers, Heavy infantry,
  Biremes, Triremes, Quinqueremes).
- The English place names (B8): "Cove" for *anse*, "Point" for
  *pointe*, "Bay of" for *baie*, "Cape" for *cap*.
- A game keeps the names it started with (B6) rather than renaming its
  players when it is loaded in the other language.
- Removing `describeSave` from the engine is worth making the change
  Reviewed. The alternative is to leave the engine's English
  `describeSave` in place, unused, which keeps the change Attested but
  leaves dead text in the engine.
