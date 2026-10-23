<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §51 plan — The army builder fills a unit type up to what the budget allows, or clears it, in one click

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Each row of the army builder gets `«` (clear the type) and `»` (fill the
type up to what the budget and its maximum allow), dimmed when they would
change nothing (spec B1-B5). The fill count comes from a pure, tested
function in `src/engine/army.ts` (B6). The README names the buttons (B7),
and a new smoke scenario drives them by canvas clicks (B8).

## Risks

- **Tests that pass whatever the code does.** The fill function's tests must
  pin exact counts (10, 2, 0, unchanged), not "more than before", so each
  operator in `min(maxCount, count + floor(remaining / cost))` is caught by
  a mutant.
- **The lint cap (21).** `ArmyBuilderScene.create` already warns at 109
  lines (`max-lines-per-function`). Adding the two buttons inline grows it
  but adds no warning. If the rows move into a helper method and `create`
  drops to 80 lines or fewer, the count falls to 20, and the cap in
  `package.json` must go down to 20 in the same commit. Never raise it.
- **The dev hook only sees interactive text.** `candidate`
  (`src/ui/devHook.ts:206-214`) skips objects whose `input` is disabled. So a
  dimmed button must stay interactive (alpha only, as "Confirm army" does),
  or the e2e can't click it to show that it changes nothing (spec B5).
- **The hook reaching into the scene** must be guarded by name, like
  `PLACEMENT_MEMBERS`, so a renamed field fails loudly, not silently.
- **README staleness.** `README.md:36` says the smoke suite is "four
  test-mode scenarios and the language switch", which is already out of
  date. Adding a scenario makes it worse. Reword it without a count.
- **Stale line citations:** re-check the lines below before launch.

## Verified against the codebase

Re-read on `main` at `8ee7ec8`.

- `src/engine/army.ts:3` — `ARMY_BUDGET = 400`.
- `src/engine/army.ts:23-51` — `validateArmy(selection)`, which returns
  `totalCost` and `remaining`; it skips counts ≤ 0 and calls `getUnitType`.
- `src/engine/army.ts:54-58` — `emptySelection()`.
- `src/engine/army.test.ts:1-2` — vitest, with imports from `./army`.
- `src/data/units.ts` — costs and caps: archers 5/10, quintiremes 50/1,
  triremes 30/3, elephants 10/10.
- `src/scenes/ArmyBuilderScene.ts:94-121` — `UNIT_TYPES.forEach`, the row:
  `-` at x 400, count at x 430, `+` at x 460, style `{ fontSize: '18px',
  color: '#fff', backgroundColor: '#553', padding: { x: 10, y: 2 } }`; `+`
  caps at `maxCount` (`:117`).
- `src/scenes/ArmyBuilderScene.ts:86-90` — "Use default army" copies the
  preset, then `refresh()`.
- `src/scenes/ArmyBuilderScene.ts:158-168` — `refresh()`: counts, total
  colour and text, errors, `confirmBtn.setAlpha(valid ? 1 : 0.4)`.
- `src/scenes/ArmyBuilderScene.ts:26` — the `create` lint warning (109
  lines).
- `src/ui/session.ts:106` — each seat starts from `emptySelection()`.
- `src/ui/devHook.ts:31-…` — the `DevHook` interface;
  `:90-95` — the `PLACEMENT_MEMBERS` guard pattern; `:117-118` — `buttons()`;
  `:206-214` — `candidate`, which takes visible text with enabled input only.
- `src/ui/i18n/noLiterals.test.ts:1-4` — only literals with a word of two or
  more letters are flagged.
- `e2e/placement.spec.ts:40-49` — the route: pin `en`, `goto('/')`, wait for
  the "2" button, click it, then per seat "Use default army" and "Confirm
  army".
- `e2e/helpers.ts:20-28` — `collectErrors`; `:133-136` — `clickButton(page,
  label, index?)`.
- `README.md:36` — the e2e line; `README.md:79-87` — the Army Builder
  paragraph.
- `package.json:12` — the lint script with `--max-warnings 21`.

## Subtasks

1. **The fill function** (spec B2, B6). In `src/engine/army.ts`, add
   `filledCount(selection, typeId): number`. It returns
   `max(count, min(maxCount, count + floor(remaining / cost)))`, with
   `remaining` from `validateArmy(selection)`, and never mutates. Put the
   interpretation comment at the function (spec "Interpretations"). Add the
   AC1 tests to `src/engine/army.test.ts`. Commit.
2. **The buttons** (B1, B3, B4, B5). In `ArmyBuilderScene.ts`:
   - add `«` at about x 370 and `»` at about x 490, in the `-`/`+` style;
   - `«` sets `selection[unit.id] = 0`; `»` sets it to `filledCount(...)`;
     both call `refresh()`;
   - keep them in `clearBtns`/`fillBtns: Record<string, Text>` fields;
   - in `refresh()`, set each one's alpha: `«` 0.4 at count 0, `»` 0.4 when
     `filledCount` equals the count, else 1;
   - keep them interactive when dimmed; a dimmed click changes nothing,
     which follows from B2/B3.

   Check the lint count after this subtask (Risks). Commit.
3. **The dev hook** (B8). Add `armyBuilder(): { counts: Record<string,
   number>; total: number; dimmed: Record<string, { clear: boolean; fill:
   boolean }> }`.
   - It reads `session.armySelections` for the scene's `playerIndex`, plus
     `validateArmy` for the total.
   - It reads the two button records' alpha, guarded like
     `PLACEMENT_MEMBERS` (`ARMY_BUILDER_MEMBERS`).
   - It throws if the ArmyBuilder scene is not active, and is read-only.

   Commit.
4. **The smoke scenario** (AC2). Add `e2e/army-builder.spec.ts`, with a
   header comment naming §51 and the route:
   - pin `en`, open `/`, click "2";
   - on an empty selection: every row's `«` is dimmed and its `»` is not;
   - click `»` with index 0 (archers, the first row): 10 archers, total 50;
   - click `«` index 0: 0 archers, total 0, and that `«` is dimmed;
   - click "Use default army": total 400, every `»` dimmed; click one `»`:
     every count unchanged;
   - no console errors.

   `buttonCount('»')` should equal `UNIT_TYPES.length`. Run `npm run e2e`;
   the whole suite must pass. Commit.
5. **README** (B7). In the Army Builder paragraph, one clause: "`»` adds as
   many of a type as the budget and its maximum allow, and `«` removes them
   all". Reword the e2e line at `:36` without a count. Commit, then the
   Progress entry and `status: in-review`.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| `min(maxCount, …)` dropped | AC1 "from empty, archers fill to 10" (the budget alone would give 80) |
| `floor(remaining / cost)` → `ceil`, or `remaining` → `ARMY_BUDGET` | AC1 "390 spent: archers +2, quintiremes +0" |
| `max(count, …)` dropped (lowers a count) | AC1 "over 400: unchanged" (with remaining negative, `count + floor(neg)` drops) |
| a mutated input selection | AC1 "the input is not mutated" (deep-equal to a copy) |
| `»` sets a constant or the wrong type | AC2 "`»` index 0: 10 archers, total 50" |
| `«` not wired, or wrong type | AC2 "`«` index 0: 0 archers, total 0" |
| `«` dimming inverted or missing | AC2 empty-selection dimming, and after `«` |
| `»` dimming missing | AC2 "after default army, every `»` dimmed" |
| `refresh()` not called after `«`/`»` | AC2 total and dimming checks (the hook reads the alpha that `refresh()` sets) |

The scene lines are proved by the e2e only. `/review` runs `npm run e2e`
because the diff touches `src/scenes/**` and `e2e/**`.

## Validation

- `npm run verify` green; lint ≤ 21 (lowered in the same commit if it drops).
- `npm run check:intent` PASS.
- `npm run e2e` green, with the new scenario.
- **Live check (owed by rule 1, `src/scenes/**`):**
  1. In the worktree, run `npm run dev -- --port 5251` and open the menu.
  2. Pick 2 players. In the army builder, on a few rows, click `»`, `«`, `-`
     and `+`, then "Use default army".
  3. Expect counts and the total to follow B2-B4; `«` dimmed at 0; `»`
     dimmed at the maximum or when its cost no longer fits, and after the
     default army.
  4. Switch the Menu language to French and look again.

## Assumptions I made

- **Function name** `filledCount`, and the hook method name `armyBuilder`.
- **`«` index 0 is archers:** rows follow `UNIT_TYPES` order, and archers are
  first (`units.ts:22`). The e2e asserts that through the hook's counts
  rather than assuming it silently.
- **Dimming by alpha only** (0.4, like "Confirm army"), with input kept on
  (Risks).
- The worktree's dev port is 5251 (5200 + 51, `CLAUDE.md`).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-23 — all five subtasks

Commits: 1bd5f04 (filledCount + 6 tests), 5769378 (buttons), 82c5361 (dev hook
`armyBuilder()`), d1c1c97 (e2e/army-builder.spec.ts), 506b594 (README).
Shipped as planned. Verify: 57 test files, 994 tests, lint 21 warnings (cap
unchanged at 21). `npm run e2e`: 13 passed (new scenario included).
`check:intent`: PASS. No mutants run.
Divergence: the hook reader is a module-level helper `armyBuilderSnapshot`
rather than inline, because inline pushed `installDevHook` past 80 lines (a
22nd warning). `ArmyBuilderScene.create` stays over 80 lines, so the cap is
not lowered.
