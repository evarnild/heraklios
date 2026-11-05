<!-- generated-by: heraklios/intent@0.1.5 -->
# §65 — The board's drawing goes through one view interface, keyed by unit

**Type:** refactor
**Originator:** the owner (2026-11-05), splitting §64 into three intents:
"Three intents" (a refactor first, then the static vector view, then the
animations)
**Source:** `intents/64-vector-view/intent.md` (Constraints: "Two views need
one seam they both draw through")

## Problem

§64 adds a second way to draw the Board and Placement, and §66 animates it.
Both scenes already draw through one class, `src/ui/MapView.ts`
(`BoardScene.ts:613`, `PlacementScene.ts:138`: `new MapView(this, width,
height, …)`), with calls such as `setUnitMarker`, `setFacingIndicators`,
`highlightHexes`, `highlightRings`, `setDriftArrow`, `setChoiceLabels`,
`setRangeLabels`, `showMovementPoints`, `centerOn`, `toScreen`,
`onHexClick`, `onHexHover`, `pointerBlocked`, `pinUIObjects` and
`excludeFromMainCamera`.

That seam isn't enough for a second view, for two reasons:
- It's a concrete class that also owns the terrain polygons, hit-testing,
  the camera, drag and zoom. A second view would have to copy the camera
  and input code.
- It knows units only by hex. `setUnitMarker(hex, typeId, playerIndex)`
  keys markers by `"q,r"` (`MapView.ts:352-383`), and every render clears
  and redraws them all (`BoardScene.renderAllUnits`, `:906-929`). An
  animation couldn't tell which unit moved where.

## Outcome

- An interface for what a scene asks a board view to draw: units,
  highlights, facings, the drift arrow, labels, the camera and coordinates.
  Today's look is its one implementation. §64's view can then be added
  behind it without touching the scenes' game logic.
- Units are drawn **by unit id** (type, owner, hex, facing, ship damage),
  not by hex, so a view knows a unit that moved is the same unit.
- Camera, drag, zoom, hit-testing and hover stay shared, not duplicated per
  view.
- Behaviour held constant: the standard view looks and acts exactly as
  today.

## Constraints

- **No behaviour change**, no `src/engine/` or `src/data/` change, no save
  change.
- `BoardScene.ts` (~3200 lines) and `PlacementScene.ts` change only where they
  call the view.
- The lint cap stays at 21; `MapView.ts` (620 lines) must not gain warnings.
- Live check owed by path rule 1 (`src/ui/`, `src/scenes/`): the standard
  view unchanged.

## Type-specific questions

### Refactor
- **What is restructured:**
  - `src/ui/MapView.ts`, split into the shared camera and input part and a
    standard-view drawing part behind an interface;
  - the call sites in `BoardScene.ts` and `PlacementScene.ts`;
  - the helpers that take a `MapView` (`createLogPanel`, the rules panel, …).
- **How behaviour is held constant:**
  - the full `npm run verify` suite and every `npm run e2e` scenario stay
    green and unchanged (the e2e suite drives both scenes by canvas clicks,
    and `devHook.ts` reads the board);
  - new unit tests for any pure helper the split produces.
- **Why now:** §64 (the vector view) and §66 (animations) build on it; the
  owner chose to do it first.

## Assumptions I made

- The interface is a TypeScript `interface BoardView`, with the standard view
  as one class implementing it. The shared camera and input live in a class
  both views use.
- The e2e scenarios need no change (same canvas, same coordinates). If one
  does, the reason is recorded.
- Tier: Attested by the path table.
