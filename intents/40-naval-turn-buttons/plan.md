<!-- generated-by: heraklios/intent@0.1.2 -->
# §40 plan — The naval Turn buttons turn the wrong way

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Make the left **Turn** button turn the selected ship 60° counter-clockwise on
screen and the right one 60° clockwise, on the Board and on the Placement
screen, with each arrowhead glyph still showing the facing its own button leads
to. The engine is untouched: only which `direction` each button sends, and the
facing each glyph previews, are swapped. Two failing-first tests prove it: the
existing `e2e/naval.spec.ts` scenario, changed to assert the on-screen sense on
the Board, and a new `e2e/placement.spec.ts` scenario that does the same on the
Placement screen (added at the owner's request).

## Risks

- **Sign confusion.** The intent's claim is "`facing + 1` is counter-clockwise
  on screen". Verified below from `hexToPixel` (y grows downward), but the
  wrong sign would just move the bug, so the failing-first e2e asserts it
  through the real buttons rather than through the plan's reasoning.
- **Glyphs drift from buttons.** The wiring and the glyph offsets are separate
  lines in each scene (Board and Placement: four places). Swap one pair and not
  the other and the arrowhead lies about what the click does. No automated test
  sees a glyph (Phaser `Graphics`), so it is a live-check item.
- **Placement has no e2e scenario and the hook cannot reach it yet.**
  `devHook.ts` finds hexes only through `BoardScene` (`board()` throws when the
  Board is not active), and Placement keeps the ship being placed in a private
  `pendingShip` until it is confirmed. The new scenario needs a small, read-only
  hook extension (subtask 3) and has to get past the army builder and the land
  units in the placement queue. If that turns out larger than described, stop
  and report instead of growing the fix (subtask 3's gate).
- **Names.** `rotateCCWBtn` is the *left* button in both scenes and its name was
  right all along; only its wiring was wrong. Do not rename anything: renaming
  would make the diff look like a layout change.

## Verified against the codebase

Re-read on `main` at `95ea9c1` (this worktree's base):

- `src/engine/hex.ts:7-14` — `DIRECTIONS` = `(1,0) (1,-1) (0,-1) (-1,0) (-1,1)
  (0,1)`; a facing is an index into it.
- `src/ui/hexRender.ts:7-10` — `hexToPixel`: `x = size·1.5q`,
  `y = size·√3·(r + q/2)`, y down. Facing 0 `(1,0)` → down-right; facing 1
  `(1,-1)` → up-right (`r + q/2 = −0.5`). Down-right to up-right is
  counter-clockwise on screen, so **`facing + 1` is CCW, `facing − 1` is CW**.
- `src/engine/actions.ts:299-306` — `navalRotate` does
  `facing = (facing + direction + 6) % 6`, `movementLeft -= 1`. Unchanged.
- `src/engine/hex.ts:21-23` — a turn costs 1 point per 60° in either direction;
  no rule depends on the sign.
- `src/scenes/BoardScene.ts:635-647` — `rotateCCWBtn` (x 76, the left one)
  → `rotateSelectedShip(-1)`; `:649-661` — `rotateCWBtn` (x 160, the right one)
  → `rotateSelectedShip(1)`.
- `src/scenes/BoardScene.ts:1626-1627` — left glyph (x 50) previews
  `(facing + 5) % 6`, right glyph (x 186) previews `(facing + 1) % 6`.
- `src/scenes/PlacementScene.ts:204-215` and `:217-228` — left button (`width/2 − 90`)
  → `rotatePendingShip(-1)`, right (`width/2 + 90`) → `rotatePendingShip(1)`;
  `:487-492` — `rotatePendingShip` applies `(facing + direction + 6) % 6`.
- `src/scenes/PlacementScene.ts:483-484` — left glyph `(facing + 5) % 6`, right
  glyph `(facing + 1) % 6`.
- `src/ui/devHook.ts:60-63`, `:83-91` — `board()` throws unless `Board` is
  active; `hexToCanvas`/`centerOn` go through it. `buttons()` already reads every
  active scene, so `buttonCount`/`buttonToCanvas('Turn', i)` already work on
  Placement. `state()` (`:72`) returns `session.gameState`, which Placement fills as ships
  are confirmed (`PlacementScene.ts:494-516` pushes the unit, with its `facing`).
- `src/scenes/PlacementScene.ts:286`, `:351-352`, `:376-377` — the queue is
  `Object.entries(selection)`; `currentItem()` is the first entry with
  `remaining > 0`; `currentLegalHexes()` depends on its domain. Ships are
  staged by `tryPlace` (`:412-424`) into `pendingShip` and only become units on
  Confirm.
- `src/scenes/ArmyBuilderScene.ts:77-90` — a **Use default army** button fills the
  selection from `defaultArmySelection()` (`src/engine/army.ts:67`, which
  includes `galeres` and `biremes`, `:77-78`). `MenuScene.ts:46-59` — the player
  count buttons start the builder.
- `e2e/naval.spec.ts:13-14` — `TURN_INDEX = { [-1]: 0, [1]: 1 }` with the comment
  "left to right: counter-clockwise (-1), then clockwise (+1)"; `:20-30` builds the
  expected facing as `(facing + dir + 6) % 6` for `dir` in `[-1, 1]` and clicks
  button `TURN_INDEX[dir]`.
- Line numbers rot: re-check them in the worktree before editing.

## Subtasks

Each is its own commit.

1. **Failing-first e2e.** In `e2e/naval.spec.ts`, change the mapping so the
   scenario asserts the on-screen sense: left button (index 0) turns
   counter-clockwise = `facing + 1`, right button (index 1) turns clockwise =
   `facing − 1`. Concretely `TURN_INDEX = { [1]: 0, [-1]: 1 }`, and the comment
   says "left to right: counter-clockwise on screen (facing +1), then clockwise
   (facing −1)" with a pointer to `hexToPixel` for why. Run `npm run e2e` and
   confirm the scenario **fails** (the ship ends one step the wrong way) before
   touching a scene. Record the failure output in the Progress entry.
2. **Board.** `BoardScene.ts`: `rotateCCWBtn` → `rotateSelectedShip(1)`,
   `rotateCWBtn` → `rotateSelectedShip(-1)`; left glyph previews
   `(facing + 1) % 6`, right glyph `(facing + 5) % 6`. Update the comment above
   the buttons (`:628-634`) to say `facing + 1` is counter-clockwise on screen.
   Re-run `npm run e2e`: the scenario now passes.
3. **Placement scenario, failing first.** Add `e2e/placement.spec.ts`: from the
   Menu click the player count `2`, then **Use default army** and **Confirm** for
   each seat, until the `Placement` scene is up with player 0's queue; place
   units by canvas clicks until a ship is the current item (land units come
   first or last depending on the queue's order, which the scenario must read,
   not assume); click a legal sea hex to stage the ship, click **Turn** left,
   then **Confirm** the facing, and assert the new unit's `facing` in `state()` is
   `1` (counter-clockwise from the initial `0`); repeat with the right button for
   `5`. Run it and confirm it **fails** against the unfixed Placement wiring.
   Needs, in `src/ui/devHook.ts`, a read-only addition so the hook can convert a
   hex to a canvas point and list the legal hexes while `Placement` is active:
   generalise `board()` to "the active scene that has a `mapView`", and read the
   legal hexes from `PlacementScene` by field name with the same
   throw-if-renamed guard `BUSY_FIELDS` uses. **Gate:** if this needs anything
   beyond `devHook.ts`, `devHookMatch.ts` and the new spec (a scene change, a new
   production export, a fake army), stop, record what was found in Progress and
   report; the owner decides whether to cut the Placement scenario or re-plan.
4. **Placement wiring.** `PlacementScene.ts`: same swap — left button
   `rotatePendingShip(1)`, right `rotatePendingShip(-1)`; left glyph
   `(facing + 1) % 6`, right `(facing + 5) % 6`. Re-run `placement.spec.ts`: it now passes, and so does
   `naval.spec.ts`.
5. **Close out.** `npm run verify`, `npm run check:intent`, `npm run e2e` all
   green; append the Progress entry; `status: in-review`.

Out of scope: renaming `direction` or adding a named constant in the engine, the
button labels, the arrowhead positions, and any rule or save change. If the
engine's `direction: 1 | -1` needs a doc comment saying "+1 is counter-clockwise
on screen", record it as a follow-up rather than editing `src/engine/` here.

## Tests

- **Failing-first:** the changed `e2e/naval.spec.ts` scenario (subtask 1). It
  fails against today's wiring, passes after subtask 2. The new
  `e2e/placement.spec.ts` scenario (subtask 3) fails the same way until subtask 4.
- **Which test fails if a line is mutated:**
  - `BoardScene.ts` `rotateCCWBtn` argument reverted to `-1` → the scenario
    fails (killed).
  - `BoardScene.ts` `rotateCWBtn` argument reverted to `1` → the scenario
    fails for whichever turn it picks first; it tries both signs and takes the
    first whose forward hex is open (`naval.spec.ts:20-31`), so it can pick the
    left turn and leave a reverted right button unseen. Checking which turn the
    scenario picks, and making the test exercise both buttons, is part of
    subtask 1 if it picks only one.
  - `PlacementScene.ts` left button reverted to `-1`, or right to `1` → the new
    placement scenario fails (killed), once for each button, because it clicks
    both.
  - Board and Placement **glyph offsets** (the arrowhead previews) → **no test
    sees them**; they are Phaser `Graphics`, not text or state. Covered only by
    the live check. This is the honest gap; the review's Not-checked list will
    carry it.
- No engine or data test changes: `navalRotate`'s arithmetic is untouched and
  already tested.

## Validation

- `npm run verify` green
- `npm run check:intent` PASS (type `fix`: the change carries a failing-first
  test, which is the changed `e2e/` file)
- `npm run e2e` green (both `naval.spec.ts` and the new `placement.spec.ts`), run from the worktree (port 5232; stop any dev server
  there first; once per machine `npx playwright install chromium`)
- Manual browser check (owed by path, `src/scenes/**`): `npm run dev -- --port
  5240 --strictPort --host 127.0.0.1` → Menu → **Combat test mode** → select a
  galley → click the left **Turn**: it turns counter-clockwise and the left
  arrowhead matches; the right does the opposite. Then start a normal game with
  a naval unit to reach Placement and check its two buttons the same way.

## Assumptions I made

- **The e2e is the failing-first test, and `check:intent` accepts it** as a test
  change on a fix. If `check:intent` routes this, the Progress entry says why.
- **The Placement scenario is part of this fix** (the owner asked for the test
  to be included). That takes the change from the intent's "three files" to
  five: `BoardScene.ts`, `PlacementScene.ts`, `e2e/naval.spec.ts`,
  `e2e/placement.spec.ts` and `src/ui/devHook.ts`. A fix has no file cap, but
  the review should read the hook change closely: it runs only under
  `import.meta.env.DEV`, is read-only, and `e2e/global-setup.ts` checks it is
  absent from a production build.
- **The scenario's route to a ship is unknown until it is tried.** Subtask 3 is
  written as discovery with a stop gate for that reason; the plan is not
  pretending to know the queue order or a good sea hex.
- **Both buttons should be exercised by the e2e.** If the scenario takes only
  the first open turn, subtask 1 extends it to click both, so each wiring line
  has a test that fails when reverted.
- **No rule or save impact:** a turn is still one `navalRotate` action; saves
  store facings, not button presses.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-21 - all five subtasks (implementer)

Commits: af3d79d (naval e2e, failing first), cfcdadb (Board wiring + glyphs), 45e59d2 (placement.spec.ts + read-only `placement()` hook, failing first), 3582f37 (Placement wiring + glyphs). This entry is the close-out commit.

Shipped: left Turn sends +1 (counter-clockwise on screen), right sends -1, on Board and Placement; each arrowhead previews its own button's new facing (left `(f+1)%6`, right `(f+5)%6`). Engine untouched. `e2e/naval.spec.ts` now clicks both buttons (left must give f+1, right must return to f) before the planned turn-and-move, so each Board wiring line is covered.

Failing first (before any scene change):
- naval: `Error: left Turn is counter-clockwise  Expected: 0  Received: 4`.
- placement: `Error: left Turn turns the new ship counter-clockwise  Expected: 1  Received: 5`.
Both pass after the wiring commits; `npm run e2e`: 8 passed.

Stop gate (subtask 3) not triggered: only `src/ui/devHook.ts` (+ new spec) changed; `devHookMatch.ts` untouched. The hook generalises centerOn/hexToCanvas from `board()` to "the active scene with a mapView" and adds `placement()` (current queue type + legal hexes, reading `PlacementScene.queue` / `currentLegalHexes` by name with a throw-if-renamed guard). Scenario assumptions: it reads the current item rather than assuming order, clicks the first free legal hex (land) and the first free sea hex (ships), and needs at least two ships in the default army (it has galeres and biremes).

Tests: verify green (44 files, 692 tests, lint within cap, cap not touched). `check:intent` exits 2 = ROUTE, not FAIL: "Declared fix, but no test changed" - the script does not count `e2e/` as a test; the failing-first tests are the e2e changes above. Not covered by any test: the arrowhead glyph offsets (Phaser Graphics) - live check.

Divergence: the plan's glyph-name swap was not done (names kept, per the plan's Risks).
