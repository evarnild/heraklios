<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §79 plan — The army builder shows each unit's original counter

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

- **A counter on every row.** Each of the 14 builder rows draws its unit
  type's scanned counter, `markerTextureKey(this.playerIndex, unit.id)`, 60 px
  tall, in the building player's colour (spec B1, B2).
- **Two columns of seven, in reading order.** Row *r* holds `UNIT_TYPES[2r]`
  and `UNIT_TYPES[2r+1]`, so a button's reading-order index stays its
  `UNIT_TYPES` index and the §51 scenario passes unedited (B3, AC3).
- **Every number in one pure helper.** The B4 offsets, the index-to-slot
  mapping, the counter's scaled size and the texture key live in a new
  `src/ui/armyBuilderLayout.ts` with a unit test. `ArmyBuilderScene.ts` only
  draws from it (spec "Non-functional").
- **Nothing else changes** (B7): costs, maximums, budget, default army,
  validation, `«`/`»` and their dimming, Abandon, the hand-off, the AI-seat
  skip. No new text.

## Risks

- **Column-major by mistake.** If the helper placed `UNIT_TYPES[0..6]` in the
  left column, reading order would interleave the columns, so the button at
  index 1 would belong to `UNIT_TYPES[7]`, and the §51 scenario's `'»', 3`
  would no longer fill `fantassins-lourds`.
  - Caught by: the unit test's slot table (index 1 → column 1, row 0;
    index 13 → column 1, row 6) and the e2e checks that `«` at 2r and 2r+1
    share a y (AC4), plus the unedited §51 scenario (AC3).
- **Wrong colour.** The key must use `this.playerIndex` *after* line 39's
  `this.playerIndex = firstHumanSeat;`, not `data.playerIndex`. The unit test
  proves the helper's key for every seat; it cannot see which index the scene
  passes. No dev-hook reader exposes the images (§75 owns `devHook.ts`), so
  the scene's wiring is proven only by the live check (AC6: player 2's
  counters are red). Named under "Not checked" in the review.
- **Tight text slots.** The name slot is 168 px for an 18-glyph French name
  (162 px) and the cost slot 130 px for 16 glyphs (125 px), assuming Phaser's
  default monospace (spec Interpretations). The unit test derives the longest
  name and cost line from `en`/`fr` themselves rather than hard-coding 18 and
  16, so a longer name added later fails the test. The drawn width is the live
  check's.
- **Vertical centring.** Every row item moves from origin (0, 0) to (0, 0.5)
  at the row's centre y. A forgotten `.setOrigin(0, 0.5)` leaves that item
  34 px low, but still inside its row; e2e cannot see the name or cost texts
  (not interactive), so only `«`, `-`, `+`, `»` are covered by AC4's
  same-y check. The count text and the name/cost lines are the live check's.
- **The error line's height.** The error text starts at y 588 (today 574).
  Only one error line is reachable from the UI: `+` clamps at `maxCount`
  (`ArmyBuilderScene.ts:135`) and `»` fills within it, so `overMax` cannot
  occur, and over- and under-budget are exclusive. One 13px line ends near
  y 604. The unit test checks that line (AC1); a stack of `overMax` lines is
  not reachable and is not tested.
- **The lint cap (19, `package.json:12`).** `create()` already warns, at 122
  lines (`ArmyBuilderScene.ts:29`, `max-lines-per-function`). The row drawing
  moves into a private `drawRow` (about 40 lines), so no new warning appears.
  If `create()` drops to 80 lines or fewer, the warning count falls to 18 and
  the cap is lowered to 18 in the same commit (CLAUDE.md). The cap never
  rises.
- **Tests that pass whatever the code does.** The layout test asserts exact
  coordinates per index (a table of 14 expected `{column, row, x, centreY}`),
  not only "inside the canvas". The e2e test compares positions between rows
  and columns and checks a click on index 13 changes `quintiremes`, not only
  that 14 buttons exist.
- **Phaser in unit tests.** Vitest runs in `node` (`vitest.config.ts:5`). The
  helper imports only `markerTextureKey` from `hexRender.ts`, which has type
  imports only (`hexRender.ts:1-2`). The scaling is computed from the source
  width and height the scene passes in, never from a Phaser object.
- **Collision with §75.** §75 rewrites `devHook.ts`. This plan does not touch
  it, and the new e2e test uses only `buttonCount`, `buttonToCanvas`
  (through `clickButton`) and `armyBuilder()`, as the §51 test does. If §75
  renames those readers, whichever merges second adapts the e2e file; the
  scene keeps `playerIndex`, `clearBtns` and `fillBtns` (`devHook.ts:177`).
- **Stale line citations.** No source, e2e, README, script or `package.json`
  file changed between the spec's `9eeb49a` and `174fab8`
  (`git log 9eeb49a..HEAD -- src e2e README.md scripts package.json` is
  empty). One spec citation is off by one: the README's builder paragraph is
  `README.md:80-91`, not `80-90`.
- **Drift-machine fall-through:** not relevant, no engine change.

## Verified against the codebase

Re-read on `main` at `174fab8`.

**The scene**
- `src/scenes/ArmyBuilderScene.ts` — 190 lines. `:12` `private playerIndex = 0;`.
  `:16-19` `countTexts`, `clearBtns`, `fillBtns`. `:25-27` `init` sets
  `this.playerIndex = data.playerIndex`. `:29` `create(): void {`. `:34`
  `skipAiArmySeats(this.playerIndex)`; `:39` `this.playerIndex = firstHumanSeat;`.
  `:41` `const { width } = this.scale;`.
- `ArmyBuilderScene.ts:46-51` the title at `(width / 2, 24)`; `:53-61`
  Abandon at `(20, 24)` origin (0, 0.5); `:80-88` "Use default army" at
  `(width - 20, 24)` origin (1, 0.5). None move (B4).
- `ArmyBuilderScene.ts:95-96` `const startY = 70;` `const rowH = 32;`. `:97`
  `UNIT_TYPES.forEach((unit, i) => {`. `:99` name at x 20, `fontSize: '15px'`.
  `:100` `t.builder.costAndMax(unit.cost, unit.maxCount)` at x 220, `'13px'`.
  `:102` `rowBtn = { fontSize: '18px', … padding: { x: 10, y: 2 } }`. `:104`
  `«` at 370, `:105` `»` at 490, `:117-119` `-` at 400, `:120-123` count at
  430 `'16px'`, `:124-126` `+` at 460. `:130-137` `-`/`+` handlers, `+`
  clamped by `Math.min(unit.maxCount, …)` at `:135`.
- `ArmyBuilderScene.ts:140` total at `startY + UNIT_TYPES.length * rowH + 20`;
  `:145-149` error at `… + 56`, `wordWrap: { width: width - 40 }`; `:151-160`
  Confirm at `(width - 20, … + 20)`, `fontSize: '18px'`, `padding: { x: 14, y: 8 }`,
  `.setOrigin(1, 0)`. `:167` restarts `'ArmyBuilder'` for the next seat.
- `ArmyBuilderScene.ts:176-189` `refresh()` reads `countTexts`, `clearBtns`,
  `fillBtns` by unit id. Unchanged.
- `npx eslint src/scenes/ArmyBuilderScene.ts`: one warning, `29:3 Method
  'create' has too many lines (122). Maximum allowed is 80`.

**Textures and colours**
- `src/scenes/MenuScene.ts:19-28` `preload` loads
  `markerTextureKey(playerIndex, unit.id)` for all four colours and every
  unit type. `:58` `this.scene.start('ArmyBuilder', { playerIndex: 0 });`.
- `src/ui/hexRender.ts:1-2` type-only imports. `:4` `HEX_SIZE = 22`.
  `:88` `PLAYER_COLOR_NAMES = ['yellow', 'red', 'blue', 'green']`. `:92-95`
  `markerTextureKey` returns `` `marker-${color}-${typeId}` ``.
- `src/ui/standardBoardView.ts:146-150` `scene.textures.exists(textureKey)`,
  `targetWidth = HEX_SIZE * 1.6`, `img.setDisplaySize(...)` — the board's
  scaling, the pattern the builder follows without the `exists` check (spec
  Interpretations).
- `public/markers/*/*.png`: 56 files, sizes `73×76`, `73×77`, `73×78`,
  `74×76`, `74×77` (read from the PNG headers).
- `src/main.ts:8-15` `type: Phaser.CANVAS`, `width: 1100`, `height: 750`, no
  `scale` entry.

**Data and text**
- `src/data/units.ts:22-191` `UNIT_TYPES` ids in order: archers, fantassins,
  fantassins-archers, fantassins-lourds, phalanges, cavalerie-legere,
  cavalerie-lourde, elephants, chars-legers, chars-lourds, galeres, biremes,
  triremes, quintiremes. So rows 5 and 6 hold the four ships (B3).
- `src/ui/i18n/en.ts:12-27` unit names; `:123-135` builder texts,
  `costAndMax: (cost, max) => \`${cost}pt  (max ${max})\``,
  `useDefault: 'Use default army'`, `confirm: 'Confirm army'`.
- `src/ui/i18n/fr.ts:7-22` unit names (`'Fantassins-Archers'`, 18 chars);
  `:109-121` `costAndMax: (cost, max) => \`${cost} pts  (max ${max})\``,
  `useDefault: 'Armée par défaut'`, `confirm: 'Valider l’armée'`.
  `fr.ts:1` and `en.ts:1` have type-only imports, so a node test can import
  them.
- `src/ui/i18n/index.ts:8` `LANGUAGE_STORAGE_KEY = 'heraklios.language'`.

**Dev hook and e2e**
- `src/ui/devHookMatch.ts:15-17` `matchingButtons` sorts
  `(a, b) => a.y - b.y || a.x - b.x`.
- `src/ui/devHook.ts:65-66` `buttonCount`, `buttonToCanvas`; `:86-90`
  `armyBuilder()` returns `counts`, `total`, `dimmed`; `:177`
  `ARMY_BUILDER_MEMBERS = ['playerIndex', 'clearBtns', 'fillBtns']`;
  `:352-360` `candidate` takes only a visible, input-enabled `Text`;
  `:390-391` `inside` drops a point outside the camera viewport.
- `e2e/army-builder.spec.ts:11` the `builder` reader; `:15` pins `'en'`
  through `addInitScript`; `:17-19` Menu `'2'` then waits for "Use default
  army"; `:24-25` counts 14 `«`/`»`; `:33`, `:43`, `:47` click `'»', 0`,
  `'»', 3`, `'«', 3`; `:68` `expect(errors).toEqual([])`.
- `e2e/helpers.ts:18-30` `collectErrors`; `:139-142` `clickButton(page,
  label, index?)`.
- `e2e/language.spec.ts:5-6` imports `en` and `fr` from `src/ui/i18n` — the
  precedent for AC5's labels.
- `e2e/placement.spec.ts:46-48`, `board-view.spec.ts:110-112`,
  `undo-shortcuts.spec.ts:94-96` also click "Use default army" and
  "Confirm army" by label; they stay single buttons.
- `playwright.config.ts:22` `workers: 2`.

**Gates and budgets**
- `intents/79-army-builder-counters/metadata.yml`: `type: feature`,
  `spec_accepted: 2026-11-22 by-agent`, `plan_approved:` empty,
  `blocked_by:` empty.
- `scripts/size-baseline.json`: lists combat, drift, fuzzHarness,
  heuristicAgent, BoardScene, PlacementScene. `ArmyBuilderScene.ts` is not
  in it.
- `package.json:12` `"lint": "eslint . --max-warnings 19"`.
- `vitest.config.ts:5` `environment: 'node'`.
- `README.md:80-91` the "2. **Army Builder**" paragraph.

## Where this goes

- **Modules touched:**
  - `src/scenes/ArmyBuilderScene.ts` — draws each row from the helper (image,
    texts, buttons at the helper's x and centre y), places the total, error
    and Confirm from the helper's bottom y. Row drawing moves to a private
    `drawRow`.
  - `e2e/army-builder.spec.ts` — one new test, run in English and French
    (AC4, AC5). The §51 test is not edited.
  - `README.md` — one sentence in the "2. **Army Builder**" paragraph.
  - `package.json` — only if the lint warning count falls (cap 19 → 18).
- **New modules:**
  - `src/ui/armyBuilderLayout.ts` — the army builder's row geometry: which
    column and row a unit index takes, each item's x and the row's centre y,
    the bottom controls' y, the counter's scaled size and its texture key.
  - `src/ui/armyBuilderLayout.test.ts` — AC1, AC2.
- **Why there:** layout is presentation, so it belongs in `src/ui/`, not the
  engine (principle 5). Pulling the numbers out of the scene into a pure
  module makes them testable without a browser (principle 15) and gives the
  B4 numbers one home (principle 6). It imports `hexRender.ts` (ui → ui) and
  nothing from `scenes`, so dependencies still point down (principle 2). Its
  job fits one sentence (principle 12).
- **Budget lines:** none. `ArmyBuilderScene.ts` (190 lines, expected about
  200–215 after) is not in `scripts/size-baseline.json` and stays under 500;
  the helper is about 70 lines.

## Subtasks

Each ends with `npm run verify` green and a commit.

1. **The layout helper and its test.** Add `src/ui/armyBuilderLayout.ts`, no
   Phaser import:
   - `ARMY_COLUMN_X = [20, 565]`, `ARMY_ROW_TOP = 56`, `ARMY_ROW_HEIGHT = 68`,
     `ARMY_COUNTER_HEIGHT = 60`, and `ARMY_ROW_OFFSETS = { counter: 0, name:
     66, cost: 234, clear: 364, minus: 394, count: 424, plus: 454, fill: 484 }`.
   - `armyRowSlot(index)` → `{ column, row, centreY, x }`, with
     `column = index % 2`, `row = Math.floor(index / 2)`,
     `centreY = ARMY_ROW_TOP + ARMY_ROW_HEIGHT * row + ARMY_ROW_HEIGHT / 2`
     (90 + 68·r), and `x` each offset plus `ARMY_COLUMN_X[column]`. A comment
     records the row-major interpretation (reading order = `UNIT_TYPES` order,
     `devHookMatch.ts:16`; ships in the bottom two rows).
   - `armyRowsBottom(count)` → `ARMY_ROW_TOP + ARMY_ROW_HEIGHT *
     Math.ceil(count / 2)` (532 for 14), and `armyBottomY(count)` →
     `{ total: bottom + 20, error: bottom + 56, confirm: bottom + 20 }`
     (552, 588, 552), today's offsets.
   - `counterDisplaySize(srcWidth, srcHeight)` → height
     `ARMY_COUNTER_HEIGHT`, width `srcWidth * 60 / srcHeight`.
   - `counterTextureKey(playerIndex, typeId)` → `markerTextureKey(playerIndex,
     typeId)`, with the spec's comment: the builder shows the print counter
     the Standard view draws.
   - Write `armyBuilderLayout.test.ts` (see Tests).
2. **The scene draws from the helper.** In `ArmyBuilderScene.ts`:
   - remove `startY`/`rowH`; for each `(unit, i)` call a private
     `drawRow(unit, i, selection)` that reads `armyRowSlot(i)`;
   - add `this.add.image(x.counter, centreY, counterTextureKey(this.playerIndex,
     unit.id)).setOrigin(0, 0.5)`, then `setDisplaySize` from
     `counterDisplaySize(img.width, img.height)`. Not interactive, no
     `textures.exists` check (spec Interpretations), with the comment at the
     image call;
   - draw the name, cost/max, `«`, `-`, count, `+`, `»` at their `x.*` and
     `centreY`, each `.setOrigin(0, 0.5)`, fonts, colours, paddings and
     handlers unchanged; `countTexts`, `clearBtns`, `fillBtns` filled as now;
   - place total, error and Confirm at `armyBottomY(UNIT_TYPES.length)`;
     x, origins, `wordWrap` and styles unchanged;
   - add the README sentence (spec "Non-functional"): each row shows the
     unit's counter in the player's colour, in two columns;
   - run `npx eslint src/scenes/ArmyBuilderScene.ts`: `drawRow` must not warn.
     If `create()` no longer warns, lower `--max-warnings` to 18 in
     `package.json` in this commit.
3. **The e2e checks (AC4, AC5).** Add one test body in
   `e2e/army-builder.spec.ts`, run for `en` (labels `en.builder.useDefault`,
   `en.builder.confirm`) and `fr` (`fr.builder.useDefault`,
   `fr.builder.confirm`), pinning `heraklios.language` through
   `addInitScript` as `:15` does. Imports `en`/`fr` as
   `e2e/language.spec.ts:5-6` does. The §51 test is not edited.
4. **Validation** (below), one heavy command at a time, then set
   `status: in-review`.

## Tests

**`src/ui/armyBuilderLayout.test.ts`** (AC1, AC2)

| Check | Would fail if |
| --- | --- |
| A table of all 14 indices: `armyRowSlot(i)` equals `{ column: i % 2, row: ⌊i/2⌋ }`, `centreY` 90, 158, …, 498, and `x.counter` 20 or 565, written out as literals | column-major order; a wrong row height or top; a wrong column x |
| For a left and a right slot, every `x.*` equals the literal B4 value (`cx + 66`, `+ 234`, `+ 364`, `+ 394`, `+ 424`, `+ 454`, `+ 484`) | any offset changed |
| Left column's `x.fill + 31` < right column's `x.counter` (565) | the columns overlap |
| Right column's `x.fill + 31` ≤ 1080 | the right column runs off the canvas |
| `x.cost − x.name ≥ 0.6 × 15 × L`, where L is the longest unit name over `en.units` and `fr.units` (18) | a narrower name slot, or a longer name |
| `x.clear − x.cost ≥ 0.6 × 13 × L`, L the longest `costAndMax(u.cost, u.maxCount)` over `UNIT_TYPES` in `en` and `fr` (16) | a narrower cost slot |
| `armyRowsBottom(14)` is 532 and < `armyBottomY(14).total` (552); `error` is 588, `confirm` 552 | the bottom controls' offsets changed or overlap the rows |
| `error + 1.25 × 13 ≤ 750` and `confirm + 1.25 × 18 + 2 × 8 ≤ 750` | the bottom controls pushed off a 750 px canvas |
| For `playerIndex` 0–3 and every `UNIT_TYPES` id, `counterTextureKey(p, id) === markerTextureKey(p, id)`, and for `p = 1` the key contains `-red-` | a fixed colour, or a different key scheme |
| `counterDisplaySize(73, 78)` and `(74, 76)`: height 60, width ≤ 60 and equal to the aspect-kept value | the aspect ratio not kept, or a wrong height |

**`e2e/army-builder.spec.ts`, new test, `en` and `fr`** (AC4, AC5)

- `buttonCount` is 14 for each of `«`, `-`, `+`, `»` (fails if a button is
  off the viewport, `devHook.ts:390`).
- For each r in 0–6: `buttonToCanvas('«', 2r).y === buttonToCanvas('«', 2r+1).y`,
  and `buttonToCanvas('«', 2r+1).x > buttonToCanvas('»', 2r).x` (fails for
  column-major order, for a missing `setOrigin(0, 0.5)` on one column's
  buttons, or for overlapping columns).
- `«` at 2r+2 has a larger y than `«` at 2r (rows go down).
- `buttonCount(useDefault)` and `buttonCount(confirm)` are 1; Confirm's y is
  greater than every `»`'s y.
- `clickButton(page, '+', 13)`: `armyBuilder().counts.quintiremes` is 1 and
  every other count is 0 (fails if index 13 is not the last `UNIT_TYPES`).
- `collectErrors` is empty at the end (a missing texture would log).

**Existing:** the §51 test (`e2e/army-builder.spec.ts:13-69`) unedited (AC3);
`placement.spec.ts`, `board-view.spec.ts` and `undo-shortcuts.spec.ts` still
reach Placement through the builder.

**Not covered by an automated test:** that the scene passes the post-skip
`this.playerIndex` (the image is not readable through the hook), that the
name, cost and count texts are centred, and that the printed numbers are
legible. These are AC6, the live check.

## Validation

Heavy commands run one at a time, never in parallel, and not while another
worktree runs e2e or a mutation pass.

- `npm run verify` green (build, lint with the cap at 19 or lowered, test).
- `npm run check:intent` PASS (or ROUTE with a reason recorded in review.md).
- `npm run e2e -- e2e/army-builder.spec.ts` green, then the full `npm run e2e`
  green (AC3: the scenarios that route through the builder). Port 5232 free
  first.
- **Live check (owed, path rule 1, `src/scenes/**`; new and visual, so e2e
  cannot stand in), AC6:** `npm run dev` on the worktree's port → Menu → `2`
  players (both human) →
  - English: each of the 14 rows shows its counter, yellow, in two columns of
    seven with the four ships in the bottom two rows; the attack, defence and
    movement numbers read at 100 % zoom; no name touches its cost line; the
    left `»` does not touch the right column's counter;
  - with points under budget, the error line and Confirm don't overlap;
  - "Use default army" → "Confirm army": player 2's counters are red;
  - switch to French (Menu) and repeat the fit checks
    ("Fantassins-Archers", `10 pts  (max 10)`, "Valider l’armée").

## Assumptions I made

- **The helper's API** (names, `armyRowSlot`/`armyBottomY`/`counterDisplaySize`/
  `counterTextureKey`, a `count` parameter instead of importing
  `UNIT_TYPES`) is mine; the spec fixes only its numbers and its job.
- **Height estimates in the test.** A text line is taken as 1.25 × its font
  size, and Confirm's height adds its 2 × 8 px padding. The spec says "plus
  its height" without a formula; the margins are wide (Confirm ends near
  y 590, the error line near 604).
- **The `»` width of 31 px** is the spec's (0.6 × 18 + 2 × 10 = 30.8).
- **Longest strings from the tables.** The test computes the longest name and
  cost line from `en`/`fr` rather than the spec's literal 18 and 16; today
  both give 18 and 16.
- **`drawRow` as a private method.** The spec welcomes it; it keeps the new
  code under the 80-line guardrail and may let `create()` drop below it.
- **One error line.** Only one builder error is reachable from the UI (see
  Risks), so the test checks one 13px line, as AC1 says.
- **No `blocked_by`.** §75 touches `devHook.ts`, which this plan does not
  edit; at most the e2e file adapts after a rename. Not a hard prerequisite.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
