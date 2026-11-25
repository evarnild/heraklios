<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §84 plan — The Tables panel stays available while a combat is being resolved

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

The parts, each with its spec behaviour:

- **Remove the panel's suppression** (B1–B3).
- **Draw the advance and exchange choosers below the panel's area,** using a
  pure layout helper (B4).
- **Keep the rolled attack on the Land combat tab** with its die cell marked,
  until the next attack is built or the phase ends (B7).

B5, B6, B8 and B9 hold by today's code, and the tests below pin them. No
engine rule changes; at most a pure helper in `ruleTables.ts`.

## Risks

- **The highlight vanishes today right after a roll.**
  `showAttackOutcome` → `clearCombatSelection()` → `syncRulesPanel()` →
  `rulesPanel.setAttack(null)`.
  - B7 needs the rolled attack kept past that.
  - The exchange path returns before `clearCombatSelection` (`:2208`), so
    the roll must be handed to the panel before that early return.
  - Getting the order wrong gives a test that passes only by accident. AC5's
    e2e reads the snapshot after a real seeded roll, on both the ordinary and
    the exchange path.
- **Dead suppression code.** Once the Board stops calling `setSuppressed`, the
  suppression in `rulesPanelState.ts` is dead. It is removed, with its tests,
  so the change shows in `check:intent` as existing tests losing lines. That
  ROUTE is expected; review.md states the reason (the spec removes §55's
  suppression).
- **The size ceiling.** `BoardScene.ts` is at its ceiling (2824). The net
  change is small: −2 for the suppression, about +3 for wiring the roll, and
  0 for the chooser placement, which swaps a line for a helper call. Budget
  line below.
- **Drift Continue by map click.** A map click continues a drift (`:1347`).
  Clicks on the open panel never reach the map (`pointerBlocked`, `:730`), and
  the Tables button is HUD. The e2e asserts that neither continues a drift
  (AC4).
- **Stale citations.** The lines below are from `main` at `549b88b`. §83, which
  also sets `decisionPending`, and §88, which touches the same panel, are in
  flight. Whichever merges second rebases.
- **The lint cap** (17): no new warning.

## Verified against the codebase

Re-read on `main` at `549b88b`.

- `src/scenes/BoardScene.ts:1288-1289`: `// The Tables panel is hidden while a decision is pending (§55).` and `this.rulesPanel?.setSuppressed(this.decisionPending);`, in `update`.
- `BoardScene.ts:697`: `onKeyOnce(…, 'keydown-ESC', () => this.rulesPanel?.close());`. `:698-699`: Space and Enter → `resolveDriftContinue()`. `:694`: the Continue button. `:1347`: a map click resolves Continue.
- `BoardScene.ts:626`: the Tables button → `toggleRulesPanel()`. `:893-895`: `toggleRulesPanel` → `rulesPanel.toggle(phase === 'combat' ? 'land' : 'terrain')`.
- `BoardScene.ts:730`: `mapView.pointerBlocked = (x, y) => logPanel.contains(...) || rulesPanel.contains(x, y) || scorePanel.contains(...)`.
- `BoardScene.ts:1854-1861`, `syncRulesPanel`: `previewLandAttack(attackGroup, defenderGroup)` → `rulesPanel.setAttack(preview)`.
- `BoardScene.ts:1961-1966`, `clearCombatSelection`: empties the groups, `syncRulesPanel()`, clears highlights.
- `BoardScene.ts:2202-2211`, `showAttackOutcome(state, action, result: LandAttackResult)`: logs the outcome, `if (outcome.requiresExchangeChoice) return;`, `renderAllUnits()`, `clearCombatSelection()`.
- `src/engine/combat.ts:143-175`, `LandAttackDetail`: `attackForce`, `defenseForce`, `crtColumnIndex`, `terrainModifier` and the die roll. `actions.ts:379-381` builds it with `describeLandAttack(attackers, defenders, dieRoll)` and returns it as `result.detail`. The implementer confirms the die field's exact name.
- `BoardScene.ts:2015-2024`, `chooseAdvance`: `rowHeight = 26`, `panelHeight = 76 + n·26`, `panelY = height / 2`, `top = panelY − panelHeight/2`, a 320-wide rectangle at `(width/2, panelY)`.
- `BoardScene.ts:2328-2337`, `chooseExchangeSacrifice`: `rowHeight = 24`, `panelHeight = 110 + n·24`, `panelY = height / 2`, 340 wide.
- `BoardScene.ts:2585-2588`, `commitEndPhase`: `deselectMovement()`, then `clearCombatSelection()`.
- `src/ui/rulesPanel.ts:65`: `private attack`. `:80`: `snapshot()` → `{ open, tab, highlight: landCombatHighlight(this.attack) }`. `:107-108`: `setSuppressed`. `:129-133`: `setAttack`. `:136-140`: `reset`. `:272-292`: `renderLand`, with `HIT_FILL` and `COLUMN_FILL` at `:39-40` and the highlight text colour `'#f0d070'`.
- `src/ui/rulesPanelState.ts`: the suppression. `src/ui/rulesPanelState.test.ts:17-55`: its four suppression tests.
- `src/ui/rulesPanelLayout.ts:11-31`: `RULES_PANEL_H = 266`, `MARGIN = 12`, `TOP = 8`, `rulesPanelRect`. Its header comment says the choosers aren't modelled because the panel hides.
- `src/ui/rulesPanelLayout.test.ts:5-31`: five tests, including "sits at 312..1088 x 8..274".
- `src/ui/boardPrompts.ts`: `RAM_PROMPT`, `BOARD_PROMPT`, `centredPromptRect`. Its header comment says the same as the layout's.
- `src/engine/ruleTables.ts:119-146`: `LandCombatHighlight` and `landCombatHighlight(preview)`, with rows clamped `Math.min(6, Math.max(1, face + modifier))`.
- `src/ui/devHook.ts:153`: `rulesPanel(): { open; tab; highlight }`. `:173`: `RULES_MEMBERS`. A change of shape inside the existing member needs no new pinned member.
- `e2e/combatScenarios.ts`: `ADVANCE`, `ONE_OPTION`, `EXCHANGE`, `PUSH`, `DRIFT`, `COMPUTER_ATTACKS` (§73). `e2e/combatFixtures.ts:96`: `loadFixture(page, base, fixture, beforeLoad?)`, which waits for the load itself (§73 round 1).
- `e2e/rules-panel.spec.ts`: §55's scenario. It must pass unchanged (AC6).
- `README.md` → "The Tables panel": the suppression sentence. `CLAUDE.md` → "The board's Tables panel": "While a decision … is pending, `BoardScene.update` hides the panel through `RulesPanel.setSuppressed`".
- `scripts/size-baseline.json`: `"src/scenes/BoardScene.ts": 2824`.

## Where this goes

- **Modules touched:**
  - `src/ui/rulesPanelLayout.ts`: the chooser placement helper;
  - `src/ui/rulesPanel.ts`: the rolled attack, the mark, the snapshot;
  - `src/ui/rulesPanelState.ts`: the suppression removed;
  - `src/engine/ruleTables.ts`: the rolled cell, a pure function;
  - `src/scenes/BoardScene.ts`: the wiring;
  - `src/ui/devHook.ts`: the snapshot type only;
  - `README.md` and `CLAUDE.md`;
  - tests.
- **New modules:**
  - `e2e/tables-during-combat.spec.ts`: the scenarios for AC1, AC2, AC4 and
    AC5.
- **Why there:** layout arithmetic is pure `src/ui` (as `boardPrompts.ts` and
  `rulesPanelLayout.ts` already are), and the table data is engine
  (`ruleTables.ts`), per `docs/architecture.md`'s engine/presentation
  principle. `BoardScene` only wires them.
- **Budget lines:** `budget: src/scenes/BoardScene.ts +5: wiring the rolled
  attack into the Tables panel (B7); the suppression line goes and the
  choosers' placement moves to rulesPanelLayout`. If the real net growth is
  smaller, lower the ceiling to the real length.

## Subtasks

1. **The rolled cell (engine, pure).** In `ruleTables.ts`, add `rolled: { face,
   row } | null` to `LandCombatHighlight`. `landCombatHighlight(preview,
   dieRoll?)` sets it as `{ face: dieRoll, row: clamp(dieRoll + modifier) }`
   when a roll is given, else `null`. Tests: clamping at both ends, a negative
   and a positive modifier, and `null` without a roll. Commit.
2. **The chooser placement (ui, pure).** In `rulesPanelLayout.ts`, add
   `chooserRect(size, canvasWidth, canvasHeight): Rect`:
   - horizontally centred;
   - `top = max(0, min(TOP + RULES_PANEL_H + MARGIN, canvasHeight − size.height))`.

   Update both header comments (`rulesPanelLayout.ts`, `boardPrompts.ts`): the
   choosers are now modelled. Tests (AC3): advance n = 1..6 and exchange
   n = 1..8 at 1100×750 and at 1600×750 don't intersect `rulesPanelRect`; an
   oversize chooser is clamped inside the canvas; the existing five tests
   unchanged. Commit.
3. **The panel keeps the rolled attack.** In `rulesPanel.ts`:
   - `setRolled(attack, dieRoll)` stores both and re-renders.
   - `setAttack(a)` with a non-null `a` clears any roll (the player is
     building the next attack). With `null` it keeps a stored roll, so
     `clearCombatSelection` doesn't wipe it.
   - `clearRolled()` drops it. `reset()` clears it.
   - `snapshot().highlight` is `landCombatHighlight(attackOrRolled,
     dieRoll)`, so `rolled` shows.
   - `renderLand` marks the rolled cell distinctly (an outline plus the
     brighter `'#f0d070'` accent as fill) on top of today's column and face
     fills.

   Commit.
4. **The scene wiring.** In `BoardScene.ts`:
   - Delete the suppression comment and the call (`:1288-1289`).
   - In `showAttackOutcome`, before the exchange early return, call
     `this.rulesPanel?.setRolled({ attackForce, defenseForce, terrainModifier
     }, <die>)` from `result.detail`.
   - In `commitEndPhase`, call `this.rulesPanel?.clearRolled()` after
     `clearCombatSelection()`.
   - In `chooseAdvance` and `chooseExchangeSacrifice`, take the box's top
     from `chooserRect(...)` instead of `height / 2 − panelHeight / 2`.
     Derive `panelY` from it so the rows below follow.
   - Remove `setSuppressed` from `RulesPanel` and the suppression from
     `rulesPanelState.ts` and its tests. Record each removed test in
     Progress.
   - Measure `BoardScene.ts` and set its ceiling per the budget line.

   Commit.
5. **e2e.** `e2e/tables-during-combat.spec.ts`, on §73's fixtures through
   `loadFixture`:
   - **AC1/AC2:** open the Tables panel and load `ONE_OPTION` (a single-hex
     retreat). While the retreat is pending, `rulesPanel().open` is true;
     switching tabs leaves `pendingChoice()` unchanged. With the panel
     closed, it stays closed through the decision. Opened on the terrain tab,
     it stays on the terrain tab.
   - **AC4:**
     - with the retreat pending and the panel open, clicking a tab, the panel
       body and the Tables button leaves the choice pending;
     - Escape closes the panel and the choice stays pending;
     - with `DRIFT` at a Continue pause, opening, closing and Escape leave the
       pause, and Space advances it.
   - **AC5:** after the seeded roll, `rulesPanel().highlight.rolled` equals
     the die face and its clamped row, on `ONE_OPTION` and on `EXCHANGE` (the
     early-return path). Clicking a new attacker clears it.
   - The advance and exchange choosers' rectangles (from the snapshot or
     `buttonToCanvas`) don't intersect the open panel.

   Then `npm run e2e`, full. Commit.
6. **Docs.**
   - `README.md` → "The Tables panel": replace the suppression sentence with
     the new behaviour (available during every decision; choosers below it;
     the rolled cell marked; Escape only closes it).
   - `CLAUDE.md` → "The board's Tables panel": drop the
     `setSuppressed` sentence and say the choosers are placed by
     `rulesPanelLayout`.

   Commit.

## Tests

| Behaviour | Test | Mutation it catches |
| --- | --- | --- |
| B1 no suppression | e2e AC1: open during a pending retreat | Re-adding `setSuppressed(decisionPending)` |
| B2 no auto-open, tab kept | e2e AC2 | Opening the panel on a result; resetting the tab |
| B4 chooser below the panel | `rulesPanelLayout.test.ts` AC3 | `top` back to centred; dropping the clamp |
| B4 wired in the scene | e2e: chooser rect vs panel rect | `chooseAdvance` still using `height / 2` |
| B6 the panel never answers | e2e AC4 | A panel click reaching the map; Escape continuing a drift |
| B7 the rolled cell | `ruleTables` unit tests | No clamp; face and row swapped |
| B7 kept through the roll | e2e AC5 on `ONE_OPTION` and `EXCHANGE` | `setRolled` after the exchange early return; `setAttack(null)` clearing the roll |
| B7 cleared by the next attack | e2e AC5 | `setAttack(non-null)` not clearing the roll |
| B8 unchanged otherwise | `e2e/rules-panel.spec.ts` unchanged | Any regression in §55's behaviour |

Mutants for the implementer to run and report, each restored by copy:

- the suppression line restored;
- `chooserRect` top = centred;
- `setRolled` moved after the early return;
- `setAttack(null)` clears the roll;
- the clamp removed in the rolled cell.

## Validation

- `npm run verify` green; lint not above 17; ceiling per the budget line.
- `npm run check:intent`: a ROUTE is expected (the suppression tests removed).
  The reason goes in review.md.
- `npm run e2e`: full, plus the new spec.
- **Live check:** owed (`src/scenes/**`, `src/ui/**`, new and visual). It is
  the spec's AC7: in both views, open the panel and resolve a retreat, a push,
  an advance, an exchange and a drift. Check that the choosers sit below the
  panel, the rolled cell is marked, Escape only closes the panel, and the
  look is acceptable.

## Assumptions I made

- **`landCombatHighlight` grows an optional `dieRoll`** rather than a second
  function, so the snapshot and the render share one source.
- **`ONE_OPTION`** (§73's single-retreat-hex fixture) is the simplest
  retreat-pending position for AC1, AC2 and AC4. The implementer confirms it
  leaves a retreat pending for a human.
- **The suppression is removed outright,** with its tests, rather than left as
  dead API. A later `/konmari` would remove it anyway.

## Progress

- **2026-11-25 — subtasks 1-6** (commits `e59780c`, `d9c4f9a`, `4d0ddcf`, `54adb44`, `c1494ec`, `ef594f2`).
  - Shipped: `landCombatHighlight(preview, dieRoll?)` with `rolled`; `chooserRect`
    in `rulesPanelLayout.ts` (both header comments updated); `RulesPanel.setRolled`
    / `clearRolled`, the outlined accent cell; the suppression removed
    (`setSuppressed`, `RulesPanelState`'s `suppressed`, the `update` call); the
    choosers placed by `chooserRect`; `e2e/tables-during-combat.spec.ts` (5
    tests); README and CLAUDE.md.
  - Tests: verify green, 1800 passed, 2 skipped (107 files); lint 17 (cap held);
    full `npm run e2e` 61 passed, no flakes; `check:intent` PASS, no ROUTE shown.
  - Removed tests (`rulesPanelState.test.ts`), all four suppression tests plus one
    reworded: "is hidden while suppressed and comes back open on the same tab";
    "stays closed when it was closed before the suppression"; "ignores open,
    toggle, close and tab changes while suppressed"; "reset forgets everything,
    suppression included" (replaced by "reset forgets everything"). Added: "keeps
    its tab through close and reopen ...".
  - The die field on `LandAttackDetail` is `rawDieRoll`.
  - Size: `BoardScene.ts` 2824 -> 2823 (ceiling lowered to 2823).
  - Mutants, each restored by copy: suppression restored (as `close()` while
    `decisionPending`) killed by e2e tests 1, 3, 4, 5; `chooserRect` centred
    killed by `rulesPanelLayout.test.ts` (2 tests) and the e2e box-top asserts;
    `setRolled` after the early return killed by the exchange e2e;
    `setAttack(null)` clearing the roll killed by the rolled-cell e2e;
    clamp removed killed by 3 `ruleTables.test.ts` tests.
  - Divergences from the plan:
    1. `e2e/rules-panel.spec.ts` was edited (AC6 said unchanged), because its
       `expectHiddenWhileDecisionPending` asserted the §55 hiding that B1
       removes; it now asserts the panel stays open on its tab, and the
       "cleared by the resolution" assertion became "the roll is marked".
    2. A new attacker click (not only a built attack with a target) clears the
       roll, as spec B7 says: `syncRulesPanel` calls `clearRolled` when either
       group is non-empty (`setAttack(null)` alone would not).
    3. The plan's `budget:` line is wrapped over lines, so
       `check:intent` could not match it; the scene growth was removed
       instead (`panelY` inlined), so no budget line is needed.
    4. The chooser e2e asserts the exact button y (368, 452) rather than
       "below the panel", since a centred box also cleared the panel's bottom
       edge; a spare attacker fixture (`WITH_SPARE`) starts the next attack.

### 2026-11-25 — rework after review round 1 (post-rebase values)

Commits since `main`: `c7a2b4b`, `cdd7b49`, `61d8355`, `98ec294`, `98d1ebf`,
`a7cb274` (the earlier hashes and the "2824 → 2823", "1800 passed", "e2e 61
passed" figures above are pre-rebase). After the rebase onto §83: `BoardScene`
2834 → 2833 (ceiling 2833), 1828 tests in 110 files, 68 e2e scenarios.

Rework commit `3eac13d`: F1 §83's e2e now asserts the panel stays open over
the warning (README and two comments fixed); F2 one Escape route in
`BoardScene` (panel open: close only it; else `EndMoveWarning.cancel()`; the
warning's own listener is gone), e2e asserts the warning and its marks survive
the first Escape; F3 accepted by the owner, no change; F4/F5 two new e2e
scenarios (end phase and load drop the rolled mark); F6 button-count assertion
restored, comment fixed; F8 comment; F9 `setTab` while closed tested; F11 dice
comment moved. F10 and F12 not done (spec is the owner's; F12 skipped to keep
the scene's ceiling). Now 1828 tests in 110 files, 70 e2e scenarios (all
pass), `BoardScene` still 2833.
