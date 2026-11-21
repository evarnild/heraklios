<!-- generated-by: heraklios/intent@0.1.5 -->
# §74 — Hovering a unit shows its characteristics; the Drawn view's number badge goes

**Type:** feature
**Originator:** the owner (2026-11-21): "in the drawing mode, the display of
the numbers is not good. Let's remove it and only display the unit
characteristics when hovering over the unit".
**Source:** none. This comes from playing the Drawn view that §64 shipped.

## Problem

- **The badge does not read well.** In the Drawn view, every unit figure
  carries a text badge under its base. It holds the counter's numbers in the
  print counter's format: `counterBadge`, `src/ui/figures/figureShapes.ts:226-229`,
  drawn by `src/ui/drawnUnits.ts:201`, for example `0 (2) 2 / 1 3` for
  archers. The owner finds it does not display well: it is small, it crowds
  the figures, and it is cryptic without the print counter's layout around
  it.
- **Nothing else shows a unit's values.** The board's hover tooltip names only
  the hex and its terrain: `formatHexTooltip`, `src/ui/hexTooltip.ts`, shown
  by `MapView.showHexTooltip`, `src/ui/MapView.ts:386`. So in the Drawn view,
  the badge is the only place a player can read a unit's values. Values that
  change in play are shown nowhere on the board: movement left, a ship's
  equipment, a charge.

## Outcome

- **No badge.** The Drawn view draws no number badge under its unit figures.
- **A unit on hover.** Hovering a hex that holds a unit adds that unit to the
  hover tooltip, under the existing coordinate and terrain line. This applies
  in both the Standard and the Drawn view. It shows:
  - the unit's name and its owner;
  - its attack, plus ranged attack and range when it has them;
  - its defense and its movement allowance;
  - what changes in play: movement left, equipment points for a ship, and
    "charged" when it applies.
- **In both languages.** The text is in English and French (`src/ui/i18n/`).
  It is built by a pure, tested function, as `formatHexTooltip` is.
- **Nothing else changes.** Hovering an empty hex shows the tooltip as today.
  The Standard view's counters keep their printed numbers. Game state, rules
  and saves do not change.

## Constraints

- **Presentation only.** No rule or engine change. The unit's values come
  from the existing data: `getUnitType` in `src/data/units.ts`, and the
  `Unit` fields in `src/engine/state.ts:17-42`.
- **Player-facing text goes through `src/ui/i18n/`**, in `en.ts` and `fr.ts`.
  `noLiterals.test.ts` forbids literals.
- **The tooltip stays on the HUD camera,** as today (`MapView.ts:374-402`).
  It must stay readable at the board's zoom range and not run off the screen
  edge.
- **`counterBadge` goes once nothing uses it**, along with its tests, or it
  is reused by the new text if that reads better. The spec decides.
- **The e2e suite stays green.** A test that counts the Drawn view's objects
  changes only by the badge (`devHook`'s `drawnInspect`, `e2e/board-view.spec.ts`).
- **Live check owed** (rule 1: `src/ui/**`). The change is visual.

## Type-specific questions

### Feature
- **Users:** hotseat players in either board view, and spectators of computer
  seats.
- **Rulebook basis:** digital-only. The values themselves are the print
  counter's (`src/data/units.ts`).
- **Known simplification it removes:** none.
- **Settled by the owner (2026-11-21):**
  - "Both views": the unit's line appears on hover in the Standard and Drawn
    views alike.
  - "Name + stats + current state": the content is the list under Outcome.
- **Open design questions (for the spec):**
  - **Layout.** One line or several, and the labels: "Atk 4 · Def 3 · Mov 5"
    or the print counter's order.
  - **Owner.** By the player's name, by their colour, or both.
  - **Hidden information.** Whether an opposing unit's current state (its
    movement left) is shown. Hotseat play has no hidden information today,
    which suggests yes.
  - **Touch.** What a touch screen without hover does. Nothing today, since
    the tooltip is hover-only.

## Assumptions I made

- **Type: feature.** It adds a new hover display, beyond the badge's removal.
  An adjustment would be too small for i18n, a formatter, its tests and two
  views.
- **The tooltip content is shared by both views** because the tooltip lives in
  the shared surface (`MapView`), not in a view.
- **`review_tier` is left empty.** The path table gives Attested (`src/ui/**`).
- **No `blocked_by`.** §72, in progress, does not touch the tooltip or the
  Drawn view's units.
- **The id is 74,** from `npm run queue -- --next-id`. §73 is an uncommitted
  draft.
