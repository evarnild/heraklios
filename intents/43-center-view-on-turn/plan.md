<!-- generated-by: heraklios/intent@0.1.2 -->
# §43 plan — Centre the view on the new player's land units when their turn starts

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

When a player's turn starts, and when the Board opens or loads a game, the
view jumps to the average position of that player's land units, at the
current zoom (spec B1–B5), through a pure tested helper, one `MapView`
method and one `BoardScene` method (B6), proven by an e2e scenario (B7–B8)
and the owner's live check (AC5).

## Risks

- **A call in the wrong place.** The view must move only at the three
  points of B3. In `endPhase`, the call goes inside the existing `if
  (state.phase === 'movement')` branch, after `applyAction` has made the
  next seat active, and not on the `gameOver` path (which leaves the
  scene). AC2: the review reads every call.
- **An AI turn starting before the centring.** `create`, `loadInPlace` and
  `endPhase` end with `maybeStartAiTurn()`; centre first, then start the AI,
  so the view is on the AI's army when it begins.
- **Breaking the existing scenarios.** `e2e/helpers.ts` `clickHex` centres
  the camera on its target before each click, so a jump at turn start
  doesn't move their targets; the four game scenarios must still pass.
- **Edge clamping** makes "centred" inexact near the board's edge; the
  scenario's tolerance (spec B8) covers it.
- **Lint cap 21:** `BoardScene.ts` is already over the file-size guardrail
  (counted once, as a file); `create` is already over the function-length
  one (counted once). Adding a line to an already-warned function adds no
  warning, but check with `npm run lint` after each commit.

## Verified against the codebase

Re-read on `main` at `a500ab6`:

- `src/ui/hexRender.ts` `hexToPixel` (pure, no Phaser import);
  `src/ui/mapBounds.ts` the pattern for a pure, tested `src/ui/` module.
- `src/engine/state.ts:44` `unitType(unit)`; `src/data/units.ts`
  `domain: 'land' | 'naval'`; units carry `owner`, `position`,
  `destroyed`.
- `src/ui/MapView.ts:299` `toScreen(hex)` (board origin + `hexToPixel`);
  `:576-579` `centerOn(hex)`; `:191-196` initial scroll; bounds set in
  `enableDrag`.
- `src/scenes/BoardScene.ts`: `create` ends `refreshStatus()` →
  `refreshUndoRedoButtons()` → `autosave()` → `maybeStartAiTurn()`
  (around `:862-869`); `loadInPlace` `:959-969` ends `log(gameLoaded)` →
  `maybeStartAiTurn()`; `endPhase`'s movement branch `:2837-2846`
  (`rammedThisTurn.clear()`, `autosave()`).
- `src/ui/devHook.ts:37-38`, `:104-110` `centerOn`, `hexToCanvas` (the
  hook's shape for B7).
- `e2e/attacks.spec.ts:54` clicks **End phase** by label;
  `e2e/helpers.ts` `startFromMenu`, `clickButton`, `waitIdle`, `state`,
  `collectErrors`.

## Subtasks

1. **Pure helper + tests (AC1).** `src/ui/viewCentre.ts`:
   `landUnitsCentre(units, owner)` → `{ x, y } | null` in `hexToPixel`
   space, plus `nearestHex(point)` for the scenario (via the existing
   pixel→hex rounding in `hexRender.ts`). `src/ui/viewCentre.test.ts`.
   One commit.
2. **`MapView.centerOnPoint(point)`** (origin offset as `toScreen`) and
   **`BoardScene.centreOnActivePlayer()`**, called at the three B3 points,
   before `maybeStartAiTurn()`. One commit.
3. **Dev hook `viewCentre()`** (B7): the main camera's midpoint in canvas
   coordinates; dev-only like the rest. One commit.
4. **`e2e/view-centre.spec.ts`** (B8), failing first against a build
   without step 2's calls (run it before wiring them, or with them
   commented out, and record the red run in Progress). One commit.
5. **README**: one sentence where the Board is described ("at the start of
   each turn the view jumps to the active player's army"). One commit.
6. **Hand-over.** `verify`, `check:intent`, `npm run e2e` (8 tests),
   `--repeat-each=5` on the new file; AC1's mutants recorded; Progress;
   `status: in-review`. The live check stays owed.

## Tests

- `viewCentre.test.ts`: one land unit → its point; two and three → their
  average; a ship, a destroyed unit and another player's unit are ignored;
  no land unit → `null`. Mutants that must fail it: drop the `domain`
  filter, the `destroyed` filter, the `owner` filter; sum without
  dividing.
- `e2e/view-centre.spec.ts`: fails first without the calls (subtask 4);
  then passes; `--repeat-each=5` clean (AC3).
- The four existing game scenarios and §36's language tests still pass
  (AC4).

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e`: 8 tests pass.
- **Live check** (owed, kept): `npm run dev -- --port 5243 --strictPort
  --host 127.0.0.1` in the worktree → Menu → **Test mode** → the view
  opens on player 1's army → End phase twice → it jumps to player 2's
  army → then a new 2-player game with one AI seat, and watch one round:
  the view follows each seat's army at the start of its turn.

## Assumptions I made

- Centring happens before `maybeStartAiTurn()` everywhere (Risks).
- The e2e scenario uses Test mode's two human seats; the AI-seat case is
  covered by the live check, not by the scenario.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-22 — implementation (subtasks 1-6)

Commits: see `git log main..feat/43-center-view-on-turn`.

- **1.** `src/ui/viewCentre.ts` (`landUnitsCentre(units, owner)`, `nearestHex`) and `viewCentre.test.ts` (6 tests). AC1 mutants, each killed: no domain filter (2 tests fail), no `destroyed` filter (1), no owner filter (2), sum without dividing (2).
- **2.** `MapView.centerOnPoint`; `BoardScene.centreOnActivePlayer()` called in `create` and `loadInPlace` (before `maybeStartAiTurn()`) and in `commitEndPhase`'s `phase === 'movement'` branch (after the gameOver return; AI seats' endPhase passes through it too). Exactly three call sites.
- **3.** Dev hook `viewCentre()`.
- **4.** `e2e/view-centre.spec.ts`. Red first (calls not yet wired: player 1 not centred, 488 px off); its first version also failed on a board-edge clamp (228 px with the calls wired), so the check became clamp-aware: it compares the target's canvas position with its position after the hook's own `centerOn` (same clamping), within one hex width (44 px). Red re-run with `centreOnActivePlayer` disabled: failed "player 1 centred when the Board opens" (260 px); green with it restored.
- **5.** README: new "The view at the start of a turn" section.
- **6.** `npm run verify` green (45 files, 704 tests; lint 21 warnings, cap unchanged). The suite now has 9 tests, not 8 (the plan miscounted §36's three language tests); all 9 pass with `--workers=1`; `--repeat-each=5` on the new file passes 5/5 with `--workers=1`.

Divergences: (a) commit order: MapView method, hook and scenario came before the BoardScene wiring so the scenario could be shown red. (b) With Playwright's default parallel workers, every scenario (old ones too) times out at 30 s with the game loaded and an empty page snapshot: the known machine slowdown signature, not a failure of this change; `--workers=1` is green. (c) `landUnitsCentre` takes `(units, owner)` as in the plan; the spec's `unitType` parameter was unnecessary (`unitType(unit)` from the engine).
Live check (AC5) remains owed to the owner.
