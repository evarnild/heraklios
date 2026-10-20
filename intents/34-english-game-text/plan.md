<!-- generated-by: heraklios/intent@0.1.2 -->
# §34 plan — English for all game text except unit and country names

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Every text the game shows is English except unit, country and place
names and the title/source (spec B1–B3, B6). The map editor still shows
its French palette through its own table (B4). The docs and comments
that quote a changed label quote the new one (B5).

## Risks

- **The editor silently turning English.** `TERRAIN_LABELS` has two
  readers today. If `main.ts` isn't switched in the same commit that
  translates the table, the editor goes English. Subtask 1 does both in
  one commit, and AC3's test pins the French strings.
- **The e2e suite clicks Menu buttons by label.** A Menu string changed
  without `e2e/helpers.ts` (or the reverse) fails every scenario.
  Subtask 2 changes both together, and `npm run e2e` runs before
  hand-over.
- **Tests that pass whatever the code does.** AC2's coverage test must
  fail if a terrain loses its label, and AC3's must fail if one French
  string changes. Each is spelled out below, with the mutation that
  should kill it.
- **Typos in a pinned string.** Copy the French palette strings from
  `hexRender.ts:72-82` on `main`, not retyped.
- **Lint cap (21).** The new module and test add no warning.

## Verified against the codebase

Re-read on `main` at `288b0e1`:

- `src/scenes/MenuScene.ts:184`, `:201`, `:220` — the three French
  button labels.
- `src/scenes/BoardScene.ts:2508-2514` — `RESULT_LABELS`; read at `:2567`
  (`Result: ${…}`). `:1042` — comment naming "Charger une partie".
- `src/ui/hexRender.ts:70-83` — doc comment + `TERRAIN_LABELS`;
  `:86` `TERRAIN_ORDER` (eleven terrains).
- `src/ui/hexTooltip.ts:3`, `:25` — the game's reader of `TERRAIN_LABELS`.
- `src/map-editor/main.ts:2` (import), `:81`
  (`label.textContent = TERRAIN_LABELS[terrain] ?? terrain;`) — the
  editor's reader. `main.ts` is 186 lines.
- `src/ui/hexTooltip.test.ts:9` ("Plateaux"), `:20`, `:30` ("Plaine").
- `e2e/helpers.ts:16-17` — `MENU_TEST`, `MENU_CLOSE_COMBAT`.
- Comments quoting a Menu label: `e2e/attacks.spec.ts:1`,
  `e2e/land-move.spec.ts:1`, `e2e/naval.spec.ts:1`,
  `e2e/save-load.spec.ts:1`, `src/ui/session.ts:164`,
  `src/ui/testMode.ts:44`, `:115`.
- `README.md:114`, `:125`, `:189` — quoted labels; `:584-585` — the
  editor palette (unchanged).
- `vitest.config.ts:6` includes `src/**/*.test.ts`, so
  `src/map-editor/paletteLabels.test.ts` runs under `npm test`.
- `package.json:12` — `--max-warnings 21`.

## Subtasks

1. **Terrain labels.** Add `src/map-editor/paletteLabels.ts` exporting
   `PALETTE_LABELS` (today's French table, moved verbatim, with a doc
   comment: the editor stays French, §34 B4). Switch
   `src/map-editor/main.ts` to it. Translate `TERRAIN_LABELS` per B3 and
   fix its doc comment. Update `hexTooltip.test.ts` and add
   `paletteLabels.test.ts` (Tests below). One commit.
2. **Menu labels.** `MenuScene.ts` per B1, `e2e/helpers.ts` constants,
   and the seven comments that name a Menu label (B5). One commit.
3. **Combat results.** `BoardScene.RESULT_LABELS` per B2, and the
   `:1042` comment. One commit.
4. **README.** `:114`, `:125`, `:189` per B5. One commit.
5. **Sweep and hand-over.** Re-run the accented-literal sweep over
   `src/scenes/`, `src/ui/`, `index.html` (expect only B6's exceptions)
   and `grep -rn "Mode test\|Charger une partie" --exclude-dir=node_modules`
   outside `intents/`, `plan-history.md`, `docs/research/` (expect
   nothing). `npm run verify`, `npm run e2e`. Append Progress, set
   `status: in-review`.

## Tests

- **`hexTooltip.test.ts` (AC1):** expectations become "(4, 9) — Plateau"
  and "— Plain" (twice). Killed mutants: any B3 game label reverted or
  misspelt for `plateau`/`plain`.
- **`paletteLabels.test.ts` (AC2, AC3):**
  - every `TERRAIN_ORDER` terrain has a non-empty entry in both
    `TERRAIN_LABELS` and `PALETTE_LABELS` — fails if an entry is deleted
    from either;
  - the four zones read the same in both tables — fails if a zone name
    is translated in one;
  - `PALETTE_LABELS` equals the eleven French strings spelled out in the
    test — fails if any palette string changes, or if `main.ts`'s table
    were swapped for the English one;
  - the seven non-zone game labels differ from their palette labels —
    fails if `TERRAIN_LABELS` is left French.
- **Menu labels (AC4):** no unit test reaches a Phaser scene; `npm run
  e2e` is the check (the suite finds the buttons by these strings).
- **Combat results (AC5):** no test reaches `logCombatOutcome`'s text;
  the live check is the evidence. Not worth a seam for five strings.

## Validation

- `npm run verify` green, lint ≤ 21 warnings.
- `npm run check:intent` PASS.
- `npm run e2e` green (4 scenarios).
- Live check (owed: `src/scenes/**`, `src/ui/**`, `src/map-editor/**`):
  on the dev server, the Menu shows "Test mode (2 players, armies
  ready)", "Combat test mode (units face to face, 2 hexes)", "Load a
  game"; in Combat test mode, hovering a plain hex shows "Plain", a sea
  hex "High seas" or "Coastal fringe", a zone hex its French name; one
  attack logs "Result: XX — <English words>"; `/map-editor.html` still
  shows the French palette.

## Assumptions I made

- `src/map-editor/main.ts` changing adds the editor to the live check;
  the visible palette must not change, so it's one glance.
- Subtask commits are independent enough to land one at a time; none
  leaves `verify` or `e2e` red.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-20 — build

Commits: `defe22b` (terrain labels + `PALETTE_LABELS`), `c1bde93` (Menu
labels, e2e constants, comments, README l. 125/189), `f16984a` (combat
results), `f759e5d` (README l. 114).

Shipped per plan, no divergence. `npm run verify` green (637 tests, lint
under cap), `npm run e2e` 4/4, `npm run check:intent` PASS. Accented-literal
sweep over `src/scenes`, `src/ui`, `index.html` finds only B6's exceptions
(title, source, zone names, default player names); no "Mode test" /
"Charger une partie" left outside `intents/`, `plan-history.md`,
`docs/research/`. Not checked: AC5 (combat log text) and AC7 (live check,
owed by the owner).
