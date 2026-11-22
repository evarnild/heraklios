<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §74 plan — Hovering a unit shows its characteristics; the Drawn view's number badge goes

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

- **The badge goes.** The Drawn view's figures lose their number badge (B1).
- **The tooltip gains the unit.** Hovering a hex that holds a unit adds the
  unit to the board's hover tooltip, in both views (B2-B9). It shows:
  - its name and owner;
  - its labelled values, in play, with the printed value where they differ;
  - on the Board, its movement left, its equipment and whether it has charged.
- **How it is built.** The text comes from a pure, tested `src/ui/` formatter,
  with English and French labels. `MapView` gets it from the scene through a
  hook, so the engine does not change.

## Risks

- **`installDevHook` sits at the 80-line limit**
  (`src/ui/devHook.ts:186-271`; §66 packed one line to stay under, recorded in
  §66's review).
  - Adding a tooltip reader inside it would cross the limit and raise lint
    above the cap (19 after §72 merges, 21 on `main` today).
  - The reader goes in a small helper outside `installDevHook`, spread into the
    hook object in one line, or into an existing helper.
  - If it can't be added without a new warning, stop and report: a plan
    amendment, not a raised cap.
- **§72 is in flight and also edits `PlacementScene.ts`** (`deployUnit`,
  `unitCounter` removed).
  - §74 touches only Placement's `MapView` setup, about 3 lines near
    `PlacementScene.ts:141-142`.
  - Whichever merges second rebases; expect a trivial conflict at most.
  - `PlacementScene.ts` is at its size ceiling (574 on `main`), so §74 must not
    grow it net. If the hook line can't be absorbed, a budget line is needed:
    `- budget: src/scenes/PlacementScene.ts +<n>: <reason>`, with no leading
    backtick and n equal to the growth.
- **`BoardScene.ts` is at its ceiling too** (3172).
  - The hook is one line next to `onHexClick` (`BoardScene.ts:887`). The lookup
    and formatting live in the new `src/ui/unitTooltip.ts`, not in the scene.
  - If that one line can't be absorbed, a budget line `+1` is needed.
- **Tests that pass whatever the code does.**
  - Each formatter case asserts the full string, not a substring.
  - The e2e scenario asserts the tooltip's actual text through the dev hook,
    not just that a tooltip exists.
- **Text literals.** `noLiterals.test.ts` forbids literals passed to
  `.text(`/`setText(`. Every label goes into `en.ts` and `fr.ts`, typed by
  `Messages`, so a missing one is a build error.
- **Stale line citations.** The cites below were read at `2f045b6`; re-check
  before editing.

## Verified against the codebase

Re-read on `main` at `2f045b6`.

**The badge (B1)**
- `src/ui/drawnUnits.ts:3`: imports `counterBadge` from `./figures/figureShapes`.
- `src/ui/drawnUnits.ts:200-210`: `make` builds the badge with `scene.add.text(0, BASE_R * 0.92, counterBadge(...))` and puts `[base, fig, badge]` in the unit's container, named by id.
- `src/ui/drawnUnits.ts:61`: a comment mentions "The base and badge stay upright".
- `src/ui/figures/figureShapes.ts:226-229`: `counterBadge`. Its only other user is `src/ui/figures/figureShapes.test.ts:3`, `:64-81`.

**The tooltip and its hooks**
- `src/ui/MapView.ts:6`: imports `formatHexTooltip`.
- `src/ui/MapView.ts:40`: `onHexClick` (the precedent for a scene-set hook).
- `src/ui/MapView.ts:58`, `:64`: `hoverTooltip`, `TOOLTIP_DEPTH = 35`.
- `src/ui/MapView.ts:197-206`: `updateHover` calls `showHexTooltip(hex, x, y)`.
- `src/ui/MapView.ts:386-414`: `showHexTooltip`: `formatHexTooltip(hex)`, a 13 px text, the edge flip by measured `width`/`height`.
- `src/ui/MapView.ts:416-418`: `hideHexTooltip`.
- `src/ui/MapView.ts`: 431 lines.
- `src/ui/hexTooltip.ts`: `formatHexTooltip(hex)`.

**The scenes**
- `src/scenes/BoardScene.ts:619`, `:887`: `new MapView(...)`, `onHexClick` set.
- `src/scenes/PlacementScene.ts:141-142`: `new MapView(...)`, `onHexClick` set.

**Engine helpers it reads**
- `src/engine/combat.ts:127`: `unitAt(state, hex)`.
- `src/engine/state.ts:17-42`: `Unit`.
- `src/engine/state.ts:76-79`: `maxEquipmentPointsForType`.
- `src/engine/state.ts:93-146`: `currentAttack`, `currentRangedAttack`, `currentDefense`.
- `src/data/units.ts:3-16`: `UnitType`.

**i18n**
- `src/ui/i18n/names.ts:7`, `:26`: `unitName`, `colorName`.
- `src/ui/i18n/en.ts:54-60`: the `common` block.
- `src/ui/i18n/en.ts` (387 lines) and `fr.ts` (372) are typed against `Messages` (`index.ts`).

**Dev hook, e2e and limits**
- `src/ui/devHook.ts:186-271`: `installDevHook`, at the length limit.
- `e2e/board-view.spec.ts:71`, `:77`: canvas hover by `page.mouse.move`, the pattern for the new scenario.
- `scripts/size-baseline.json`: `BoardScene.ts` 3172, `PlacementScene.ts` 574.

## Where this goes

- **Modules touched:**
  - `src/ui/drawnUnits.ts`: no badge.
  - `src/ui/figures/figureShapes.ts`: `counterBadge` removed, with its tests.
  - `src/ui/MapView.ts`: a `unitTooltipAt` hook; `showHexTooltip` appends its
    lines.
  - `src/scenes/BoardScene.ts` and `src/scenes/PlacementScene.ts`: set the hook,
    one line each.
  - `src/ui/i18n/en.ts` and `fr.ts`: a `tooltip` block.
  - `src/ui/devHook.ts`: a tooltip-text reader, outside `installDevHook`'s body.
  - `README.md`: the board's hover tooltip.
- **New modules:**
  - `src/ui/unitTooltip.ts`: turns a unit and its owner into the tooltip lines
    (B2-B7). It is pure apart from reading the current language's messages, like
    `hexTooltip.ts`.
  - `src/ui/unitTooltip.test.ts`.
  - `e2e/unit-tooltip.spec.ts`.
- **Why there:**
  - The formatter is presentation logic over engine data, so it belongs in
    `src/ui` (principles 5 and 15). It reads values through the engine's
    `current*` functions and adds no rule (principle 6).
  - `MapView` stays free of `GameState` and takes a hook, like `onHexClick`
    (principle 7).
  - No new layer or dependency.
- **Budget lines:** none expected (see Risks).

## Subtasks

1. **The formatter.**
   - `unitTooltip.ts`: `formatUnitTooltip(unit, owner: {name, index}, opts: {state: boolean})`
     returns the B2 lines joined by `\n`. It covers:
     - name and owner (`unitName`, `colorName`);
     - values per B2/B3, with `current*` and the printed value in brackets
       when different;
     - the state line only when `opts.state` is set: movement left; for a ship,
       `equipment E/M` with `maxEquipmentPointsForType`; `charged` when set.
   - Add `tooltip` labels to `en.ts` and `fr.ts`.
   - Comment I1 at the "value in play" code, I2 at the badge removal.
   - Tests: AC1.
   - Commit.
2. **The hook.**
   - `MapView.unitTooltipAt: ((hex) => string | null) | null = null`.
   - `showHexTooltip` sets
     `formatHexTooltip(hex) + (lines ? '\n' + lines : '')`.
   - `BoardScene` sets the hook from `unitAt(this.state(), hex)` (living units
     only), with the player's name and index and `{state: true}`.
   - `PlacementScene` sets it from `session.gameState` with `{state: false}`.
   - Where possible, the lookup is a helper in `unitTooltip.ts`
     (`unitTooltipFor(state, hex, opts)`), so each scene adds one line.
   - Test: AC2.
   - Commit.
3. **The badge goes.**
   - Remove the badge from `drawnUnits.ts` (B1) and fix the comment at `:61`.
   - Remove `counterBadge` and its tests from `figureShapes.ts` and
     `figureShapes.test.ts`, if nothing else uses it.
   - Commit.
4. **e2e.**
   - Add a dev-hook reader `tooltipText()`: the visible tooltip's text, or
     null. It goes outside `installDevHook`'s body (Risks).
   - `e2e/unit-tooltip.spec.ts` covers AC4:
     - in test mode, hover a unit's hex in the Standard view, then in the Drawn
       view; assert the full text, with name and values;
     - hover an empty hex; assert one line.
   - Run `npm run e2e`.
   - Commit.
5. **README.**
   - In the board section, describe the hover tooltip's unit lines and the
     Drawn view without badges.
   - Add the Progress entry and set `status: in-review`.
   - Commit.

## Tests

- **AC1, `src/ui/unitTooltip.test.ts`.** English unless the case says French,
  and the full string each time.
  - **A plain land unit** (fantassins): name, owner, attack, defense,
    movement, movement left.
  - **Archers:** ranged attack and range are included. A unit without range
    has neither.
  - **Charging light cavalry:** `attack 6 (3)` and `charged`. The same unit
    not charged has no `charged`.
  - **A ship that lost two equipment points:** the reduced attack and defense,
    each with its printed value in brackets, and `equipment E/M`. A full ship
    shows no brackets.
  - **With `{state: false}`:** no state line.
  - **French:** with `setLanguage('fr')`, French labels and names.

  Mutants these kill:
  - the brackets dropped, or always shown;
  - the printed value shown instead of the current one;
  - the ranged part shown for every unit;
  - the state line ignoring `opts.state`;
  - `charged` always shown;
  - equipment shown for land units.
- **AC2, the `hexTooltip.test.ts` cases**, unchanged. A new case in
  `unitTooltip.test.ts`:
  - `unitTooltipFor(state, hex)` returns null for an empty hex and for a
    destroyed unit's hex;
  - it returns the lines for a living unit.

  Mutants killed:
  - the destroyed filter dropped;
  - lines returned for an empty hex.
- **AC3.** `npm run verify`. tsc fails on any `counterBadge` caller left
  behind, and `figureShapes.test.ts` no longer has the case.
- **AC4, `e2e/unit-tooltip.spec.ts`**, as in subtask 4.
- **AC5.** The live check below.

## Validation

- `npm run verify` green.
- `npm run check:intent` PASS (or FAIL only on the owed live check once
  reviewed).
- `npm run e2e` green: `src/ui/**`, `src/scenes/**` and `e2e/**` change.
- **Live check (owed by rule 1):**
  1. In `C:/Users/eric/src/heraklios-wt/74-unit-hover-stats`, run
     `npm run dev -- --port 5274 --strictPort --host 127.0.0.1`.
  2. Choose "Test mode (2 players, armies ready)".
  3. Switch to the "🗺 Drawn view": no badges under the figures.
  4. Hover units of both players, in both views. Each shows name — player
     (colour), labelled values, and movement left; ships show equipment.
  5. Charge with a light cavalry unit (a straight full-allowance move next to
     an enemy): it shows `attack 6 (3)` and `charged`.
  6. Damage a ship by boarding: it shows reduced values with the printed ones
     in brackets.
  7. Hover near the right and bottom edges, and at the zoom limits: the box
     stays on screen.
  8. Switch to French (Menu) and hover again: French labels.
  9. Start a normal game and hover a placed unit in Placement: no state line.

## Assumptions I made

- **The hook returns the extra lines as one string,** joined by `\n`, so
  `MapView` only appends. The exact name is the implementer's.
- **The labels** in English are "attack", "ranged", "range", "defense",
  "movement", "movement left", "equipment" and "charged". In French they are
  "attaque", "tir", "portée", "défense", "mouvement", "mouvement restant",
  "équipement" and "a chargé". The exact strings are for review and the live
  check.
- **The e2e reader** returns the tooltip's text only when it is visible.
- **No `blocked_by`:** §72 is not a prerequisite. The two only meet in
  `PlacementScene.ts`'s setup lines.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-21 - all five subtasks (implementer)

- **Commits:** 4c1f5f4 (formatter, labels), 9944ef4 (hook and badge removal, subtasks 2 and 3 together), 8de8c99 (e2e, dev-hook reader), plus the README/Progress commit.
- **Shipped:** `src/ui/unitTooltip.ts` (`formatUnitTooltip`, `unitTooltipFor`); a `tooltip` block in `en.ts`/`fr.ts`; `MapView.unitTooltipAt` and `tooltipText()`; the Drawn view's badge and `counterBadge` (with its tests) removed; `e2e/unit-tooltip.spec.ts` with a `hoverHex` helper; README.
- **Labels, English:** `attack`, `ranged`, `range`, `defense`, `movement`, `movement left`, `equipment`, `charged`; first line `<unit> — <player> (<colour>)`; values joined by ", ", state joined by ", " (e.g. `attack 6 (3), defense 2, movement 6` / `movement left 2, charged`).
- **Labels, French:** `attaque`, `tir`, `portée`, `défense`, `mouvement`, `mouvement restant`, `équipement`, `a chargé`; the first line has the same shape (`tooltip.owner` is on `messages.test.ts`'s same-in-both list).
- **Tests:** verify green, 1533 tests in 90 files (1528 on the base: `counterBadge`'s 3 cases left, 8 new in `unitTooltip.test.ts`). Lint 21 warnings, equal to the cap, none added. `npm run e2e`: 28 passed, including the new scenario.
- **Divergences:** (1) subtasks 2 and 3 are one commit. (2) The scene hooks need no new import line: `MapView.ts` re-exports `unitTooltipFor`, so each scene only extends its existing `MapView` import. Each scene's one hook line is absorbed by removing one blank line next to it, so `BoardScene.ts` stays 3172 and `PlacementScene.ts` 574; no budget line. (3) `tooltipText` is a `MapView` method that the dev hook calls from the one packed line next to `landscapeBuilds`, so `installDevHook` did not grow. (4) The Drawn-view doc comment in `drawnUnits.ts` was reflowed to one line. (5) The ship example in the tests is a bireme (equipment 1/3: attack 5 (15), defense 5 (15)).

### 2026-11-22 - rework after the round 1 review (implementer)

Owner's answers: F2 (a), F5 "équipage". Each mutant was applied by copy, the test run, and restored by copy; `git status --short` showed only the intended edits.

- **F2:** `installDevHook` is not split. The packed `tooltipText` line has a trailing comment saying it is packed to stay under the 80-line limit, as §66's is, and that splitting `installDevHook` is a separate refactor intent.
- **F5:** the French equipment label is now `équipage` (was `équipement`), as in the rulebook's "points d'équipage". The French test asserts `mouvement restant 2, équipage 1/3`. Killed by: the label put back to `équipement` (1 test failed).
- **F1 (stale tooltip):** `MapView` remembers `hoveredHex`; `setUnits` rebuilds the visible tooltip's text for it (`tooltipTextFor`). No scene line. New e2e `a unit that moves onto the hovered hex shows its lines at once`: hover an empty reachable hex, click to move there, the pointer unmoved, poll for the unit's lines (4 lines). Killed by: the refresh in `setUnits` disabled (the scenario failed).
- **F3 (M5):** new unit case `shows a damaged trireme` asserts `attack 15 (20), ranged 0 (2), range 2, defense 15 (20), movement 6` and `movement left 2, equipment 3/4`. Killed by: `currentRangedAttack(unit)` replaced by `type.rangedAttack` (1 failed).
- **F4:** the French case asserts the whole text (`Cavalerie Légère — Perse (rouge)` ...); the `{state: false}` bireme case asserts both lines in full. Killed by: the state line forced on (2 failed).
- **F6:** the `unitTooltipFor` re-export sits next to the `drawFacingArrowhead` one; the template literal uses an escaped newline, not a raw one. `MapView.ts` is back to CRLF throughout (my first edit had left 7 LF-only lines).
- **F7:** new e2e `Placement: hovering a placed unit shows no state line`, asserting the two lines in full. Killed by: `{ state: false }` changed to `{ state: true }` in `PlacementScene.ts` (the scenario failed). The scene file is unchanged in the final tree.
- `BoardScene.ts` 3172 and `PlacementScene.ts` 574 unchanged; lint cap unchanged.
