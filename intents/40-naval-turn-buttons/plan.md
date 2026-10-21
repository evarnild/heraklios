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
facing each glyph previews, are swapped. The failing-first test is the existing
`e2e/naval.spec.ts` scenario, changed to assert the on-screen sense.

## Risks

- **Sign confusion.** The intent's claim is "`facing + 1` is counter-clockwise
  on screen". Verified below from `hexToPixel` (y grows downward), but the
  wrong sign would just move the bug, so the failing-first e2e asserts it
  through the real buttons rather than through the plan's reasoning.
- **Glyphs drift from buttons.** The wiring and the glyph offsets are separate
  lines in each scene (Board and Placement: four places). Swap one pair and not
  the other and the arrowhead lies about what the click does. No automated test
  sees a glyph (Phaser `Graphics`), so it is a live-check item.
- **Placement is not covered by any e2e scenario.** Its buttons change with no
  failing-first test; see Tests.
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
3. **Placement.** `PlacementScene.ts`: same swap — left button
   `rotatePendingShip(1)`, right `rotatePendingShip(-1)`; left glyph
   `(facing + 1) % 6`, right `(facing + 5) % 6`.
4. **Close out.** `npm run verify`, `npm run check:intent`, `npm run e2e` all
   green; append the Progress entry; `status: in-review`.

Out of scope: renaming `direction` or adding a named constant in the engine, the
button labels, the arrowhead positions, and any rule or save change. If the
engine's `direction: 1 | -1` needs a doc comment saying "+1 is counter-clockwise
on screen", record it as a follow-up rather than editing `src/engine/` here.

## Tests

- **Failing-first:** the changed `e2e/naval.spec.ts` scenario (subtask 1). It
  fails against today's wiring, passes after subtask 2.
- **Which test fails if a line is mutated:**
  - `BoardScene.ts` `rotateCCWBtn` argument reverted to `-1` → the scenario
    fails (killed).
  - `BoardScene.ts` `rotateCWBtn` argument reverted to `1` → the scenario
    fails for whichever turn it picks first; it tries both signs and takes the
    first whose forward hex is open (`naval.spec.ts:20-31`), so it can pick the
    left turn and leave a reverted right button unseen. Checking which turn the
    scenario picks, and making the test exercise both buttons, is part of
    subtask 1 if it picks only one.
  - Board glyph offsets, and **all** Placement lines (wiring and glyphs) → **no
    test sees them.** They are covered only by the live check. This is the
    honest gap; the review's Not-checked list will carry it.
- No engine or data test changes: `navalRotate`'s arithmetic is untouched and
  already tested.

## Validation

- `npm run verify` green
- `npm run check:intent` PASS (type `fix`: the change carries a failing-first
  test, which is the changed `e2e/` file)
- `npm run e2e` green, run from the worktree (port 5232; stop any dev server
  there first; once per machine `npx playwright install chromium`)
- Manual browser check (owed by path, `src/scenes/**`): `npm run dev -- --port
  5240 --strictPort --host 127.0.0.1` → Menu → **Combat test mode** → select a
  galley → click the left **Turn**: it turns counter-clockwise and the left
  arrowhead matches; the right does the opposite. Then start a normal game with
  a naval unit to reach Placement and check its two buttons the same way.

## Assumptions I made

- **The e2e is the failing-first test, and `check:intent` accepts it** as a test
  change on a fix. If `check:intent` routes this, the Progress entry says why.
- **A new Placement e2e scenario is not part of this fix.** Placement's buttons
  have no scenario and reaching Placement from the dev hook may need new hook
  support, which would grow a 3-file fix. Left to the live check; say so if you
  want that scenario added here instead.
- **Both buttons should be exercised by the e2e.** If the scenario takes only
  the first open turn, subtask 1 extends it to click both, so each wiring line
  has a test that fails when reverted.
- **No rule or save impact:** a turn is still one `navalRotate` action; saves
  store facings, not button presses.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
