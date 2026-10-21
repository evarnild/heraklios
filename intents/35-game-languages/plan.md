<!-- generated-by: heraklios/intent@0.1.2 -->
# §35 plan — Play the game in several languages, French and English first

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Every text the game shows comes from an English or a French table, chosen
on the Menu and remembered (spec B1–B4). Unit, country and place names
are translated (B5, B6, B8). The engine returns data instead of English
sentences (B9). The rules, the save format and the e2e suite's English
stay as they are.

## Shape of the code

```
src/ui/i18n/
  index.ts       messages(), language(), setLanguage(), resolveLanguage()
  en.ts          export const en = { menu: {…}, army: {…}, log: {…}, … }
  fr.ts          export const fr: Messages = { … }   // Messages = typeof en, widened
  names.ts       unitName(id), countryNames(), zoneName(id), terrainName(id)
  format.ts      formatArmyError, formatDriftEvent, describeSlot (B9's formatters)
  *.test.ts
```

Scenes call `messages().menu.loadGame` for a fixed text and
`messages().log.unitMoves({ unit, q, r })` for a sentence with values.
This is the spec's `t()` written as typed property access, so a wrong
key or a missing value is a `tsc` error, not a runtime miss. `Messages`
widens `en`'s literal strings to `string` and keeps each function's
parameter type, so `fr` must provide the same keys with the same
parameters (B2).

## Risks

- **A rule changing by accident in B9.** `validateArmy`, `drift.ts` and
  `checkRangedEligibility` are rule code. Only their *output shape*
  changes: the same conditions, in the same order, return data instead
  of text. Their existing tests keep every expectation about validity,
  positions and event order; only text assertions become data
  assertions. The fuzz and soak suites run unchanged.
- **Drift narration order.** `resolveElephantDrift` interleaves `onLine`
  with `onDirectionRolled`, `onDriftMoved`, `onRender` and `onStep`
  (`drift.ts:562-615`). The replacement hook, `onNarrate(event)`, is
  called at exactly the points `onLine` is today, for the same seven
  event kinds, so the log and the pacing don't move.
- **One missed string.** About 130 text sites across five scenes and
  `src/ui`, 86 of them in `BoardScene.ts`. AC1's scan test is written
  first (subtask 2) with every current site on a temporary
  "not yet migrated" list that each later commit shrinks; the list must
  be empty at hand-over.
- **French overflowing.** French runs 15–30 % longer. Fixed-position
  texts (Menu buttons, placement prompt vs "Done placing" at x = 960,
  the board's side panel at `PANEL_WIDTH`, dialogs) are measured in
  Chromium in both languages (§33's method) in subtask 9, then wrapped
  or reworded.
- **The e2e suite and the dev hook match buttons by label**
  (`e2e/helpers.ts`, `src/ui/devHookMatch.ts`). Pinning English before
  the page loads (B11) keeps them stable; done in subtask 3, before any
  scene changes, so a forgotten pin fails early.
- **`BoardScene.ts` and the lint cap (21).** Replacing literals with
  `messages()` calls must not push a function over 80 lines or a
  complexity over 20. Long `log(...)` templates become one-line calls,
  so it should shrink. Lint is checked per commit.
- **Reviewed tier.** `saveGame.ts` changes (B9: `describeSave` leaves).
  Nothing else in it changes, and `SAVE_VERSION` stays.

## Verified against the codebase

Re-read on `main` at `7df9812`:

- `src/main.ts:11-12` — canvas 1100 × 750.
- `src/scenes/MenuScene.ts:30`, `:33` — title and source line; `:38`
  "Number of players"; `:162` seat labels; `:184`, `:201`, `:220` §34's
  English buttons (the switch goes in the free top-right corner).
- `src/scenes/BoardScene.ts:288` — `onLine: (line) => this.appendLine(line)`;
  `:1229`, `:1247` "Undone:/Redone:" + stored label; `:1338`
  `PLAYER_COLOR_NAMES` in the turn banner; `:1346` the banner with
  `state.phase.toUpperCase()`; `:2508-2514` `RESULT_LABELS` (§34
  English); `:2567` the "Result:" line.
- `src/scenes/ArmyBuilderScene.ts:91` `unit.name`; `:132`, `:150`
  `validateArmy` and its `errors`.
- `src/scenes/PlacementScene.ts:126`, `:356`, `:366`, `:430`, `:500`.
- `src/scenes/GameOverScene.ts:19-33`.
- `src/ui/session.ts:74` default names, `:75` edges `W E N S`; `:119`,
  `:198` names copied into the game.
- `src/ui/hexRender.ts:71-83` `TERRAIN_LABELS` (§34, English game table),
  `:102` `PLAYER_COLOR_NAMES` (also texture keys: display needs its own
  words); `src/ui/hexTooltip.ts:25` its reader.
- `src/ui/saveLoadPanel.ts:2`, `:197`, `:219` — `describeSave` callers.
- `src/engine/army.ts:24`, `:30`, `:36` — the three error strings; only
  reader `ArmyBuilderScene.ts`; tests `army.test.ts:24`, `:38`, `:46`.
- `src/engine/drift.ts:33-38` `describeDriftExit`; `:95-111` `DriftEvent`;
  `:119-135` `DriftHooks.onLine`; `:533` `defaultLine`; `:562-615` the
  narration switch. Readers of `onLine`: `BoardScene.ts:288`,
  `drift.test.ts:136-143` (asserts "into the marsh" / "eliminated").
- `src/engine/combat.ts:540-556` — `RangedCheck.reason`; no reader.
- `src/engine/saveGame.ts:130-137` `describeSave`; tests
  `saveGame.test.ts:5`, `:224`, `:395-403`.
- `src/data/units.ts` — fourteen ids, matching spec B5.
- `index.html:2` `lang="en"`.
- `package.json:12` `--max-warnings 21`.

## Subtasks

Each one is a commit (or two) with `npm run verify` green.

1. **i18n core.** `src/ui/i18n/` with `index.ts`, `names.ts`, empty-ish
   `en`/`fr` sections, the language store (`localStorage`
   `heraklios.language`, try/catch, in-memory fallback),
   `resolveLanguage`, `document.documentElement.lang` on set. Names
   tables for units, countries, zones, terrain, edges, colours, phases.
   Tests: AC3, AC4 (names), non-empty (AC2).
2. **Scan test (AC1)** with the full current-site list as
   "not yet migrated", each entry `file:line-text`. It fails on any
   *new* literal straight away.
3. **e2e pin (B11).** `e2e/helpers.ts` sets `heraklios.language = en`
   with `page.addInitScript` before navigation. `npm run e2e` green.
4. **Engine language-free (B9).** `ArmyError` union from
   `validateArmy`; `onNarrate(event)` replaces `onLine`, with
   `driftExitKind(hex)` exported for the formatter; `RangedCheck.reason`
   becomes `'no-melee' | 'wrong-range'`; `describeSave` moves to
   `src/ui/i18n/format.ts` as `describeSlot`. Callers switched to the
   formatters, English only for now, so the game reads the same.
   Engine tests rewritten to data; formatter tests in both languages.
5. **Menu**: every text, the **English | Français** switch top-right
   (redraws the scene on click via `scene.restart()`), seat labels,
   default names from the table in `resetSession`.
6. **ArmyBuilder, Placement, GameOver.**
7. **`src/ui`**: `saveLoadPanel`, `MapView`, `hexTooltip`
   (`TERRAIN_LABELS` → `terrainName`, zones through `zoneName`),
   `confirmDialog` callers.
8. **BoardScene**, in two commits (the log/narration sentences; then
   buttons, prompts, banners, dialogs). The not-yet-migrated list is
   empty after this.
9. **Fit.** Measure every fixed-position text in both languages
   (throwaway Chromium script, deleted), fix what overflows, record the
   widths in Progress.
10. **README** "Language" paragraph (B12). Final sweep, `verify`,
    `check:intent`, `e2e`; Progress; `status: in-review`.

## Tests

- **`i18n/index.test.ts`** — `resolveLanguage`: stored `fr`/`en` wins;
  stored `de` → navigator; `fr-CA` → `fr`; `de-DE` → `en`; nothing → `en`.
  `setLanguage` persists and survives a throwing `localStorage`.
  Mutants killed: swapped default, `startsWith('fr')` → `=== 'fr'`,
  stored value ignored.
- **`i18n/names.test.ts`** — every `UNIT_TYPES` id has a name in both;
  English equals B5, French equals `units.ts` `name:`; zones equal B8;
  countries equal B6; `resetSession` gives each language's defaults.
- **`i18n/messages.test.ts`** — every message in both tables, functions
  called with sample values, is a non-empty string; `fr` and `en` differ
  for every key except an explicit list (codes, "Archers", …), which
  catches a French table copied from English.
- **`i18n/format.test.ts`** — each `ArmyError`, each narrated
  `DriftEvent` kind (including the three exit kinds) and `describeSlot`,
  in both languages, exact strings.
- **`i18n/noLiterals.test.ts`** — AC1, as described in subtask 2; it
  also fails if an entry on the not-yet-migrated or allow list no longer
  matches any line (so the lists can't rot).
- **Engine:** `army.test.ts` asserts `{ kind: 'overMax', typeId, count,
  max }` etc.; `drift.test.ts:133-143` collects `onNarrate` events and
  asserts the `eliminatedLeavingLandZone` event with
  `driftExitKind === 'marsh'`; a new `combat.test.ts` case pins the two
  reason codes; `saveGame.test.ts`'s `describeSave` cases move to
  `format.test.ts`. Fuzz/soak suites untouched.
- **e2e:** the four scenarios, English pinned.

## Validation

- `npm run verify` green, lint ≤ 21 warnings.
- `npm run check:intent` PASS.
- `npm run e2e` green.
- Live check (spec AC8), on the dev server at the spawned port:
  switch to Français on the Menu, play Test mode through a move, a land
  combat (result line), a ram or boarding, a save and load (slot
  summary), and Combat test mode for an elephant drift if one comes up;
  start a new 2-player game to see the army builder (push over budget
  for the error) and placement; check every French text fits. Switch
  back to English, reload, and the choice holds. Hover a zone: "Cape
  Zeno" in English, "Cap Zénon" in French.

## Assumptions I made

- `messages()` property access stands for the spec's `t(key, params)`
  (same tables, typed keys instead of string keys).
- The Menu switch redraws by restarting the Menu scene, which rebuilds
  every text; nothing on the Menu holds state that a restart loses
  (seat controls live in `session`).
- Player colours shown in the turn banner get display words of their
  own; `PLAYER_COLOR_NAMES` stays as texture-path keys.
- The "fr and en differ" test is worth its exception list: it is the
  only automatic check that the French table was actually translated.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-20 — built (subtasks 1–10), `npm run verify` green

Commits: `87aca3d` i18n core · `6b5416a` engine returns data · `dc07b39` scan
test · Menu/ArmyBuilder/Placement/GameOver/SaveLoadPanel · BoardScene · fit
and README (this commit). 681 unit tests (was 655), lint 21 warnings (cap
unchanged: none of the existing ones sat in code this change removed), `npm
run e2e` 4/4 with English pinned, `npm run check:intent` PASS.

What shipped as planned: `src/ui/i18n/` (`index.ts`, `en.ts`, `fr.ts`,
`names.ts`, `format.ts`, `reports.ts`, tests); `Messages` is `typeof en`
widened, so `fr.ts` is checked by `tsc`; the scan test (AC1) has an empty
pending list and one allow-list entry (the title); B3–B12 as specified.

**Where it diverged from the plan (each one deliberate):**

- **Save-file errors are data too.** `parseSavedGame`/`migrateSavedGame`
  returned English sentences that the Save/Load panel shows. The spec's B9
  table missed them; they now return `SaveError` (`invalidJson`, `notASave`,
  `unsupportedVersion {version, expected}`) and `saveStorage.pickSaveFile`
  adds `unreadable`; `formatSaveError` words them. `saveGame.ts` was already
  Reviewed for `describeSave`; `SAVE_VERSION` and the format are untouched.
- **Three more engine label functions went to the tables:** `seatControlLabel`
  (seatControl.ts), `clockLimitLabel` and `roundLimitLabel`
  (gameEndSettings.ts) were display text in the engine; removed with their
  tests, replaced by `messages().seat`, `clockLimitText`, `roundLimitText`.
- **The Army Builder now shows why "Confirm army" is dimmed** (a red line
  under the total, from `formatArmyError`). Before, nothing read
  `validateArmy().errors`; AC8 asks for the over-budget message, so it needed
  a reader.
- **Report sentences take structured values** (`reports.ts`: `CombatReport`,
  `RamReport`, `BoardingReport`) so each language writes the whole multi-line
  report. English text is pinned line for line in `reports.test.ts`.
- **One English text changed:** a combat report's die-modifier line named
  the terrain by its internal id (`1 steep-flank at (4, 9)`); it now shows the
  terrain's display name from the table (`1 Steep flanks at (4, 9)`), the only
  way to put it in French. No other English string differs from `main`.
- **French labels shortened where the English-sized slot did not fit** (from
  screenshots at 1100×750): placement "Terminé", ship facing "Valider",
  save/delete "Sauver"/"Effacer".

**Fit (subtask 9)** — measured by screenshot in Chromium at 1100×750, French
and English: Menu (all four seats at the longest label "IA — prudente"), Army
Builder (with and without the error line, abandon dialog), Placement, Board
panel (ship selected, "Pivoter" buttons), the Save/Load panel, the abandon and
end-game dialogs. Fixed: Menu seat buttons were clipped (150 → 208 px wide);
Save/Load slot names collided with the description and the footer buttons
overlapped (description is now two lines — summary, then time — and button
spacing follows each button's width); the abandon/end-game dialog buttons and
the ram prompt's pair now grow outward from the middle; the Army Builder's
"Valider l'armée" is right-aligned like its neighbour.

**Not measured** (the live check, AC8, is the owner's): the report text at the
foot of the Board panel for a real land/boarding result — the test pair I
could reach always retreated, which replaces the report with the retreat prompt
— and the advance, exchange and boarding prompts, which need results I could
not force. By line count the French reports end above the panel buttons, and
the existing code already puts the buttons on top of a long log.

### 2026-10-20 — rework after review round 1

Fixed the review's MEDIUM and French-wording findings; `npm run verify` green
(lint 21), `e2e` unchanged (English only, not re-run: no English text moved).

- **Drift hook order (MEDIUM).** `drift.test.ts` records every hook
  (`onDriftStart`, `onNarrate:<kind>`, `onDirectionRolled`, `onDriftMoved`,
  `onRender`, `onCombat`, `onStep`) and pins the exact sequence for a move-and-stop
  drift, a combat that destroys the elephant, and one that repels it. Checked by
  mutation: deleting each of the seven `onNarrate` calls in `drift.ts` fails
  the new tests (7/7 killed).
- **French agreement.** Sentences with a unit as subject now say "L'unité
  <nom> …" (feminine singular), so they agree whatever the unit is called —
  "L'unité Éléphants est détruite.", "L'unité Cavalerie Légère est repoussée…"
  (both pinned in `format.test.ts`). The ram result reads "NAVIRE COULÉ !"; a
  sunk unit in a boarding is "L'unité X est COULÉE !".
- **Wording:** "table des résultats" (not TRC), "points d'équipage" (not
  d'équipement), "Tiré au sort à chaque tour", "restant/restants" agrees with the
  count, "Qui joue chaque camp" / "Les camps au-delà … sont ignorés".
- **LOW items taken:** README's loaded-game sentence corrected (a loaded game is
  shown in the current language, keeps its saved names); the stale
  `PLAYER_COLOR_NAMES` comment in `BoardScene` rewritten; `names.test.ts` now
  covers `edgeName`, `phaseName`, `seatControlName` and pins `en.colors` /
  `colorName` against `PLAYER_COLOR_NAMES`' order; the sea-exit sentence is
  pinned in both languages.
- **Fit re-checked** (Chromium, 1100×750): the Menu with "Qui joue chaque camp"
  and the four seat buttons still fit (widest label "Macédoine : IA — prudente"
  in a 208 px button); the longer drift/combat sentences are log text in the
  268 px wrapped panel, which wraps rather than clips. The French combat and
  boarding reports are now about three lines longer (by count, ending near y≈450
  of the panel's 583 px button row); still not seen live — the owner's re-check.
- `live_checked` cleared: the French texts changed after the owner's check.
