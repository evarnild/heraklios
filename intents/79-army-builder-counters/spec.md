<!-- generated-by: heraklios/spec@0.1.0 -->
# §79 spec — The army builder shows each unit's original counter

Accepted intent: [intent.md](intent.md)

Written against `main` at `9eeb49a`.

The spec decides **what** gets built. No rule is involved; this is a
presentation change to one scene.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intent.md` Outcome | "Each of the 14 rows shows that unit type's original counter image (`public/markers/<colour>/<type>.png`), in the colour of the player building the army." / "The counter's printed numbers can be read at the game's 1100×750 size." / "Costs, limits, the default army, validation and the hand-off to Placement are unchanged." |
| `README.md:80-90` ("2. **Army Builder**") | The builder's documented behaviour (budget, dimmed Confirm, "Use default army", `»`/`«`). This spec keeps all of it and adds one sentence about the counter. |
| `src/scenes/ArmyBuilderScene.ts:95-138` | Today's rows: `const startY = 70;` `const rowH = 32;`, the name at x 20 (`this.add.text(20, y, unitName(unit.id), { fontSize: '15px', …})`), cost/max at x 220 (13px), `«` 370, `-` 400, count 430, `+` 460, `»` 490, all with origin (0, 0). |
| `src/scenes/ArmyBuilderScene.ts:140-160` | The bottom controls sit relative to the rows: total at `startY + UNIT_TYPES.length * rowH + 20`, error at `… + 56` (wrap `width - 40`), Confirm at `… + 20` with `.setOrigin(1, 0)` at `width - 20`. |
| `src/scenes/ArmyBuilderScene.ts:25-39` | Who is building: `this.playerIndex` from `init`, then `this.playerIndex = firstHumanSeat;` after `skipAiArmySeats` skips the computer seats. |
| `src/scenes/MenuScene.ts:19-28` | Every `markerTextureKey(playerIndex, unit.id)` is loaded in Menu's `preload`, for all four colours and all unit types. |
| `src/scenes/MenuScene.ts:58`, `ArmyBuilderScene.ts:167` | The only two routes into the builder: Menu's player-count button, and the builder restarting itself for the next seat. Menu has always preloaded the textures first. |
| `src/ui/hexRender.ts:88-95` | `PLAYER_COLOR_NAMES = ['yellow', 'red', 'blue', 'green']`; `markerTextureKey(playerIndex, typeId)` returns `` `marker-${color}-${typeId}` ``. |
| `src/ui/standardBoardView.ts:143-150` | The board draws the same texture at `HEX_SIZE * 1.6` = 35.2 px wide (`hexRender.ts:4`, `HEX_SIZE = 22`). The builder's counter is larger than that. |
| `public/markers/*/*.png` | 56 PNGs, measured at 73–74 px wide and 76–78 px tall (`73×76`, `73×77`, `73×78`, `74×76`, `74×77`). |
| `src/main.ts:8-15` | `width: 1100, height: 750`, `type: Phaser.CANVAS`, and no `scale` entry, so Phaser's default (no scaling) applies: the canvas is drawn 1:1 at 1100×750. |
| `src/ui/i18n/en.ts:12-27,123-135`, `fr.ts:7-22,109-121` | Unit names and builder texts. The longest name is `'Fantassins-Archers'` (18 characters, French). The longest cost line is French `` `${cost} pts  (max ${max})` `` = `10 pts  (max 10)` (16 characters). |
| `src/ui/devHookMatch.ts:15-17` | `matchingButtons` sorts same-label buttons `(a, b) => a.y - b.y \|\| a.x - b.x`, so a button's index is its reading order: top to bottom, then left to right. |
| `src/ui/devHook.ts:352-360,390-391` | Only a visible, input-enabled `Text` counts as a button, and only if its centre is inside the camera viewport (`inside`). An off-canvas button is not counted. |
| `e2e/army-builder.spec.ts:24-25,33,43,47` | The §51 scenario counts 14 `«`/`»` buttons and clicks `'»', 0` (archers) and `'»', 3` / `'«', 3` (fantassins-lourds, `UNIT_TYPES[3]`), so it relies on index *i* being `UNIT_TYPES[i]`. |
| `scripts/size-baseline.json` | Lists only files over budget. `ArmyBuilderScene.ts` (190 lines) is not in it. |

Not applicable: `docs/research/` (no rule) and `README.md` "Known
simplifications" (none removed).

## Behaviour

**B1 — Every row shows its counter.** Each of the 14 unit rows shows the
scanned counter image of its unit type, the same texture the Standard board
view draws (`markerTextureKey`). The image is not interactive: clicking it
does nothing, and hovering it shows nothing (no enlargement, no values line).

**B2 — The counter is in the building player's colour.** The texture is
`markerTextureKey(this.playerIndex, unit.id)`, read after the AI-seat skip
(`ArmyBuilderScene.ts:39`). Player 1 sees yellow counters, player 2 red,
player 3 blue and player 4 green. When the builder restarts for the next
human seat, the counters change to that seat's colour.

**B3 — The rows form two columns of seven, in reading order.** The rows are
placed left to right, then top to bottom: row *r* holds `UNIT_TYPES[2r]` on
the left and `UNIT_TYPES[2r+1]` on the right. The bottom two rows hold the
four ships (galleys and biremes, then triremes and quinqueremes). A row's
`«`, `-`, `+` and `»` buttons in both columns share one centre y. A button's
reading-order index *i* is therefore still `UNIT_TYPES[i]`.

**B4 — Exact layout.** All numbers are canvas pixels at 1100×750. A column
starts at x `cx`, with `cx = 20` (left) and `cx = 565` (right). Row *r*
(0–6) has its top at `56 + 68·r` and its centre at `90 + 68·r`. Every item
of a row has origin (0, 0.5) and sits at the row's centre y:

| Item | x | Size |
| --- | --- | --- |
| counter | `cx` | scaled to 60 px tall, aspect kept (56–58 px wide); slot 60 px |
| name | `cx + 66` | 15px, as today |
| cost / max | `cx + 234` | 13px, as today |
| `«` | `cx + 364` | as today |
| `-` | `cx + 394` | as today |
| count | `cx + 424` | 16px, as today |
| `+` | `cx + 454` | as today |
| `»` | `cx + 484` | as today; it ends near `cx + 515` |

The rows end at y 532 (`56 + 7·68`). The bottom controls keep today's
offsets below the rows: the total at x 20, y 552; the error at x 20, y 588,
still wrapped at `width - 40`; Confirm at x `width - 20`, y 552, origin
(1, 0). The title, "Abandon" and "Use default army" do not move.

**B5 — Every control stays visible and clickable.** All 14 rows, "Abandon",
"Use default army", the total line, the error line and "Confirm army" are
inside the 1100×750 canvas. Nothing overlaps: the left column's `»` ends
before the right column's counter starts. Each `«`, `-`, `+` and `»` button
still changes its own row's count.

**B6 — Both languages fit.** In English and in French, each name ends before
its cost line, and each cost line ends before its `«`. "Use default army" /
"Armée par défaut" stays right-aligned at `width - 20`. "Confirm army" /
"Valider l’armée" stays right-aligned and on screen.

**B7 — Nothing else changes.** Costs, per-type maximums, the 400-point
budget, the default army, validation and its error texts, `«`/`»` and their
dimming, the Abandon dialog, the hand-off to the next seat or to Placement,
and the computer seats' skip all behave as they do on `main`. No new
player-facing text is added.

## Interpretations

- **"The original unit" is the scanned counter** (`public/markers/`), not
  the Drawn view's vector figure. This follows the intent's own assumption.
  Comment at the image call: the builder shows the print counter the
  Standard view draws.
- **"Readable at 1100×750" means a 60 px tall counter.** The board shows
  the same image at 35.2 px wide (`standardBoardView.ts:148`). At 60 px tall
  it is drawn at about 0.79 of its native size, so the printed numbers are
  close to native size. The canvas is not scaled (`main.ts`, no `scale`
  entry), so this is what the player sees at 100 % browser zoom. Whether the
  numbers read well is the live check's call (AC6).
- **Row-major order, not column-major.** Reading left to right keeps each
  button's index equal to its `UNIT_TYPES` index (`devHookMatch.ts:16`), so
  the §51 e2e scenario and its `'»', 3` stays valid unchanged. It also puts
  all four ships in the bottom two rows. Comment at the layout helper.
- **No missing-texture fallback.** Both routes into the builder pass through
  Menu's `preload` first (`MenuScene.ts:19-28,58`; `ArmyBuilderScene.ts:167`).
  Unlike `standardBoardView.ts:146`, the builder draws the image without
  a `textures.exists` check.
- **Text widths assume Phaser's default monospace font.** No builder text
  sets `fontFamily` (`ArmyBuilderScene.ts:99-126`), so each glyph is 0.6 em
  wide. That is 9 px at 15px and 7.8 px at 13px. `'Fantassins-Archers'` is
  162 px, within the 168 px name slot (`cx + 66` to `cx + 234`).
  `10 pts  (max 10)` is about 125 px, within the 130 px cost slot (`cx + 234`
  to `cx + 364`). The margins are small (6 px and 5 px). The layout test
  (AC1) checks these sums, and the live check checks the drawn text.

## Acceptance criteria

- **AC1 (B3, B4, B5, B6) — the layout helper fits.** Proof: a unit test,
  `src/ui/armyBuilderLayout.test.ts`. For each of 14 indices, the helper
  returns the column and row of B3, and the x and y of B4. The test also
  checks:
  - the left column's `»` slot (`cx + 484` + 31 px) ends before the right
    column's `cx`;
  - the right column's `»` ends at or before 1080;
  - the 168 px name slot holds 18 glyphs at 15px, and the 130 px cost slot
    holds 16 glyphs at 13px, each at 0.6 em;
  - the rows' bottom (532) is above the total's top (552);
  - the error line's top plus one 13px line, and Confirm's top plus its
    height, are each at or under 750.
- **AC2 (B1, B2) — every row gets the right texture.** Proof: the same unit
  test. For every `playerIndex` 0–3 and every unit type, the helper's
  texture key equals `markerTextureKey(playerIndex, unit.id)`. A scaled
  counter for a 73×78 and a 74×76 source is 60 px tall and at most 60 px
  wide.
- **AC3 (B5, B7) — the §51 scenario passes unchanged.** Proof: `npm run e2e`,
  `e2e/army-builder.spec.ts`'s existing test with no edit. Its index-based
  clicks still hit `UNIT_TYPES[0]` and `UNIT_TYPES[3]`, its counts, totals
  and dimming are as before, and there are no page errors.
- **AC4 (B3, B5) — every control is on the canvas, in both columns.** Proof:
  a new test in `e2e/army-builder.spec.ts` using only the existing readers
  `buttonCount` and `buttonToCanvas`. It checks:
  - `buttonCount` is 14 for each of `«`, `-`, `+` and `»`, which counts only
    buttons inside the viewport (`devHook.ts:390`);
  - for each *r* in 0–6, `«` at indices 2r and 2r+1 have the same y, and
    `«` at 2r+1 is right of `»` at 2r;
  - y rises from row to row;
  - "Use default army" and "Confirm army" each count 1, and Confirm's y is
    below every `»`;
  - a click on `+` at index 13 makes `armyBuilder().counts.quintiremes` 1.
- **AC5 (B6) — French fits too.** Proof: AC4's test again, with
  `heraklios.language` set to `fr` and the French labels
  (`fr.builder.useDefault`, `fr.builder.confirm`). The checks are the same.
- **AC6 (B1, B2, B4, B6, readability) — live check by the owner.** At
  1100×750:
  - each row shows its counter, and the printed attack, defence and
    movement numbers can be read;
  - player 1's counters are yellow, and player 2's are red after Confirm;
  - no name touches its cost line, and no column touches the other, in
    English and in French;
  - the error line ("under budget") and Confirm don't overlap.

  The check is owed under the path rule (`src/scenes/**`), and the change is
  new and visual, so the e2e suite cannot stand in for it.

## Non-functional

- **Engine/presentation split:** presentation only. No change to
  `src/engine/` or `src/data/`.
- **Layout helper:** the B4 numbers, the row-major index mapping, the counter
  scaling and the texture key go into a new pure module,
  `src/ui/armyBuilderLayout.ts`, with no Phaser import. Its test is AC1–AC2.
  `ArmyBuilderScene.ts` only draws from it. `create()` is already over the
  80-line guardrail (lines 29–174). If the row drawing moves to a private
  method, that is welcome, but not required. The lint cap is not raised.
- **Size budget:** the scene stays far under 500 lines, and the helper is
  small. `scripts/size-baseline.json` is unchanged.
- **Save format:** unchanged. No `GameState` or `SAVE_VERSION` change.
- **Undo boundaries:** none. The builder has no history.
- **AI / harness:** none. Computer seats still skip the screen
  (`aiSetup.ts`, `ArmyBuilderScene.ts:34`).
- **Dev hook:** `src/ui/devHook.ts` is not changed (§75 is rewriting it).
  The e2e work uses only `buttonCount`, `buttonToCanvas` and `armyBuilder()`.
  The scene keeps the `playerIndex`, `clearBtns` and `fillBtns` members that
  `armyBuilder()` reads (`devHook.ts:177`).
- **i18n:** no new text. The counter is an image.
- **README:** one sentence in "2. **Army Builder**" (`README.md:80-90`): each
  row shows the unit's counter in the player's colour, in two columns.

## Out of scope

- Hover enlargement, a tooltip, or §74's values line on the builder.
- Replacing the name with a caption, or any new label.
- The Drawn view's figures, or a neutral-colour counter set.
- Scrolling, a resizable canvas, or a `scale` mode in `main.ts`.
- Any change to the title, "Abandon", "Use default army", the Confirm rules,
  the default army or `engine/army.ts`.
- A dev-hook reader for the counter images. That waits for §75's rewrite.

## Assumptions I made

- **Size and layout (open question 1), the coordinator's decision.** The
  counter is 60 px tall, in two columns of 7 rows that are 68 px tall,
  exactly as in B4. I chose this over taller rows in one column because the
  height doesn't allow it. One column needs
  `70 + 14·rowH + 56 + ~16 ≤ 750`, so `rowH ≤ 43`, and even with the rows
  starting at y 48 the counter could be only about 40 px. That is barely
  above the board's 35 px, and the error line would end 8 px from the bottom.
  Two columns give 60 px counters, and the bottom controls end near y 604.
  The cost is width: each column is about 515 px. The name slot shrinks from
  200 to 168 px and the cost slot from 150 to 130 px. The longest French
  name and cost line still fit, with 5–6 px to spare (see Interpretations).
- **Hover (open question 2), the coordinator's decision.** No hover
  enlargement and no values line: just the counter (B1).
- **Colour (open question 3), the coordinator's decision.** The building
  player's own colour, `markerTextureKey(playerIndex, typeId)`, using the
  scene's `playerIndex` after the AI-seat skip (B2).
- **Placement (open question 4), the coordinator's decision.** The counter
  sits left of the name. The name, cost/max and the
  `«` `-` count `+` `»` controls keep their order, to its right (B4).
- **Row-major order** was my choice. It keeps the e2e index contract and the
  §51 scenario unchanged (Interpretations).
- **Vertical centring.** All row items switch from origin (0, 0) to (0, 0.5)
  on the row's centre. This aligns text and buttons with the counter. Their
  font sizes and paddings are unchanged.
- **Image presence is not checked by e2e.** No dev-hook reader exposes the
  scene's images, and §75 owns that file. B1 is proven by the helper's unit
  test (the right key for every row) and the live check.

## Questions for the owner

None.
