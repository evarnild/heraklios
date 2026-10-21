<!-- generated-by: heraklios/intent@0.1.2 -->
# §40 — The naval Turn buttons turn the wrong way (left should be counter-clockwise)

**Type:** fix
**Originator:** me (Eric), while playing
**Source:** none

## Problem

"The turn button for naval units should be reversed: the left one should
turn counterclockwise and the right one should turn clockwise." Today the
left **Turn** button turns the selected ship clockwise on screen and the
right one counter-clockwise, the opposite of what a player expects from
their positions.

Why, from the code (`main` at `8160eec`):
- A facing is an index into `DIRECTIONS` (`src/engine/hex.ts:7-14`). With
  the board's flat-top layout (`src/ui/hexRender.ts:7-10`, y grows
  downward), facing 0 points down-right and facing 1 up-right, so
  **facing + 1 is counter-clockwise on screen**.
- The left button is wired to `-1` and the right to `+1`, on the Board
  (`src/scenes/BoardScene.ts:635-661`, `rotateSelectedShip(-1)` /
  `(1)`) and in placement (`src/scenes/PlacementScene.ts:204-228`,
  `rotatePendingShip(-1)` / `(1)`). So left turns clockwise, right
  counter-clockwise. The variable names (`rotateCCWBtn` on the left,
  `rotateCWBtn` on the right) say the intended mapping; the wiring does
  the opposite.
- The arrowhead beside each button shows the facing it leads to
  (`BoardScene.ts:1626-1627`: left `(facing + 5) % 6`, right
  `(facing + 1) % 6`), so the glyphs match the wrong wiring.
- `e2e/naval.spec.ts:13-14` documents the same mistake: "left to right:
  counter-clockwise (-1), then clockwise (+1)".

## Outcome

- On the Board and on the Placement screen, the left Turn button turns
  the selected ship 60° counter-clockwise on screen, the right one 60°
  clockwise. Each costs one movement point on the Board, as today.
- The arrowhead beside each button still shows the facing that button
  leads to (it moves with its button's new direction).
- `e2e/naval.spec.ts` asserts the on-screen sense: clicking the left
  button gives facing `(f + 1) % 6`, the right one `(f + 5) % 6`, and its
  comment says so.

## Constraints

- Presentation only: the engine's `navalRotate` (`direction: 1 | -1`,
  `src/engine/actions.ts:304`), costs and rules are unchanged. The
  rulebook charges 1 movement point per 60° turn either way
  (`src/engine/hex.ts:21-23`); no rule depends on the direction.
- Saves and undo are unaffected (a turn is still one `navalRotate`
  action).
- `src/scenes/**` owes a live check by path (`REVIEW-POLICY.md` → "Live
  checks", rule 1). `e2e/naval.spec.ts` covers a Board turn, so the
  review decides whether the smoke-suite exception applies; placement's
  buttons have no scenario.
- Small: three files (`BoardScene.ts`, `PlacementScene.ts`,
  `e2e/naval.spec.ts`), a few lines each.

## Type-specific questions

### Fix
- **What broke:** left Turn turns clockwise, right turns counter-clockwise,
  on both the Board and the Placement screen.
- **Since when:** the first naval commit, `20b4379` ("Add ship facing,
  movement, ramming, and boarding for naval combat"), before the intents
  kit, so no `follows_up`.
- **Impact:** every naval turn; players learn to click the "wrong" side.
  No game or save is corrupted: the turn the player sees (arrowhead) is
  the turn that happens.
- **Reproduction:** `npm run dev` → Menu → **Combat test mode** → select a
  galley → click the left **Turn**: the ship turns clockwise.
- **The test that will fail first:** `e2e/naval.spec.ts` with the new
  on-screen assertion (left → `(f + 1) % 6`) fails against today's wiring.

## Assumptions I made

- **Fix, not adjustment:** it's a defect against what the buttons' own
  names and the player expect, and a fix needs the failing-first test
  above. It is also small enough for an adjustment (3 files).
- The French and English labels ("Turn" / "Pivoter") stay the same on
  both buttons; the arrowheads tell them apart.
- The variable names `rotateCCWBtn` / `rotateCWBtn` are kept (they become
  true); the plan may swap the glyph names to match.
