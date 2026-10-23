<!-- generated-by: heraklios/intent@0.1.5 -->
# §51 — The army builder fills a unit type up to what the budget allows, or clears it, in one click

**Type:** feature
**Originator:** the owner, typed as an `/auto` request (2026-10-23)
**Source:** none

## Problem

In the Army Builder (`src/scenes/ArmyBuilderScene.ts`) a player changes a
unit type's count only one at a time, with `-` and `+`. Buying, say, ten
archers takes ten clicks, and so does taking them back out. To spend the
budget on a type the player also has to work out by hand how many still fit
under the 400 points and the type's maximum.

## Outcome

- Each unit type's row has a button that sets its count to the most the
  player can have: the current count plus as many more as the remaining
  budget pays for, never above the type's maximum.
- Each row has a button that sets that type's count to 0.
- The total, the error lines and "Confirm army" update exactly as they do
  after `-` and `+`. The "how many fit" arithmetic is a pure, unit-tested
  function in `src/engine/army.ts`, not in the scene.

## Constraints

- **Budget rule:** "Once a player's army... totals exactly 400 purchase
  points, it's time to place it on the map"
  (`docs/research/02-rules-transcription.md`, quoted at
  `src/engine/army.ts:39-41`). The new buttons don't change that rule: an
  army must still total exactly 400 to confirm.
- **Per-type caps:** each type's `maxCount` (`src/data/units.ts`) still
  bounds the count, as `+` does today (`ArmyBuilderScene.ts:117`).
- **Engine/presentation split** (`CLAUDE.md`): the count arithmetic goes in
  `src/engine/army.ts` with tests; the scene only wires the buttons and
  calls `refresh()`.
- **Player-facing text** goes in `src/ui/i18n/en.ts` and `fr.ts`
  (`noLiterals.test.ts` fails on a new literal in `.text(`), unless the
  labels are symbols like the existing `-` and `+`.
- **Save format, undo, AI seats:** untouched. The army builder runs before
  the game state exists, and AI seats skip it (`skipAiArmySeats`).
- **Live check:** owed by path (`src/scenes/**`). `e2e/` has no army-builder
  scenario today.

## Type-specific questions

### Feature
- **Users:** hotseat players building an army by hand. AI seats get the
  default army and never see the screen.
- **Rulebook basis:** digital-only, no print rule. It is a purchase
  shortcut under the existing 400-point rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - The labels: symbols (for example `«` / `»`, or `0` / `max`) or words in
    the i18n tables.
  - Where the two buttons sit in the row (outside `-` and `+`, or after
    them), within the 1100-px-wide canvas.
  - What "max" does when the budget is already spent or overspent: leave the
    count as it is (my reading), or lower it to fit.
  - Whether the "set to 0" button is shown, or dimmed, when the count is
    already 0, and "max" when nothing more fits.
  - Whether `README.md`'s Army Builder paragraph names the new buttons (my
    reading: yes, one clause).

## Assumptions I made

- **Type feature, not adjustment:** it adds behaviour, a new engine function
  with tests, the scene wiring and probably two i18n entries in each
  language. That is close to an adjustment's 5-file, 60-line limit, and new
  behaviour with logic reads as a feature. So under `/auto` it stops once at
  the spec.
- **"Maximum available with the budget"** is
  `min(maxCount, count + floor(remaining / cost))`, where `remaining` is
  400 minus the whole army's current cost. With nothing remaining, it adds
  nothing and never removes units.
- **"Remove all units of a type"** sets that type's count to 0 and touches
  no other type.
- No confirmation dialog for either button: like `-` and `+`, they are
  undone by the other buttons.
