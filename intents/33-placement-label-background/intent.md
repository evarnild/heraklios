<!-- generated-by: heraklios/intent@0.1.1 -->
# §33 — Give the placement prompt label a background

**Type:** adjustment
**Originator:** me (Eric), while placing units
**Source:** none

## Problem

When placing units, the label indicating which unit is to be placed is hard
to read: it has no background, so it is drawn straight over the map.

The label is `PlacementScene`'s `infoText`
(`src/scenes/PlacementScene.ts:136-139`): 15px yellow text (`#ffe08a`),
bottom-left of the screen, with no `backgroundColor`. It shows "Placing:
<unit> (<n> left) — click a highlighted hex" (`:361`), the ship-facing
prompt (`:350-351`), and "All units placed…" (`:357`). The map's terrain
colours run underneath it.

## Outcome

- The placement prompt label has a solid background behind its text, with
  padding, so it reads clearly over any terrain. That covers all three of
  its messages: placing a unit, picking a ship's facing, and all placed.
- Nothing else about placement changes: same text, position, depth and
  behaviour.

## Constraints

- Presentation only. No change to `src/engine/` or `src/data/`, and no
  rule code.
- Matches the scene's existing style: its buttons already use
  `backgroundColor` plus `padding` (`PlacementScene.ts:146-147`,
  `#2a5a2a` / `padding { x: 10, y: 6 }`; others `{ x: 8, y: 4 }`).
- The label must not grow over the scene's other bottom-of-screen controls
  once it has padding. Its longest text, the ship-facing prompt, is the one
  to check.
- `src/scenes/**` owes a live check (`REVIEW-POLICY.md` → "Live checks",
  rule 1).

## Type-specific questions

### Adjustment
- **Exactly what changes:** `infoText`'s text style in
  `src/scenes/PlacementScene.ts:137` gains a `backgroundColor` (a dark,
  mostly opaque colour, e.g. `#1a1a1a` or the panel tone `#3a3a55`) and a
  `padding`.
- **Blast radius:** 1 file, about 2–3 lines, no rule code. Well inside ≤5
  files / ≤60 lines.

## Assumptions I made

- "The label indicating which unit is to be placed" is `infoText`, the only
  label that names the unit being placed. The title at the top ("<player> —
  place your army (edge …)", `:126`) is not included. Say if you want it
  too.
- The background applies to all three of `infoText`'s messages, not only
  "Placing: …": it is one text object, and a background that appears and
  disappears between messages would look like a glitch.
- The colour is left for the implementer to pick from the scene's existing
  palette. The live check is where you'd reject it.
- The board's `statusText` (`BoardScene.ts:792`) sits on the side panel,
  not over the map, so it doesn't need the same change.
