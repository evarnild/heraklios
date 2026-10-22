<!-- generated-by: heraklios/intent@0.1.2 -->
# §43 — Centre the view on the new player's land units when their turn starts

**Type:** feature
**Originator:** me (Eric), while playing
**Source:** none

## Problem

"When it is up for a new player to play, please move the view to the
middle of all the pieces of the player." Today the Board's camera stays
wherever the last player left it when the turn passes. The board is
larger than the viewport (`src/ui/MapView.ts:63`, drag to scroll), so in
hotseat play each player starts their turn by hunting for their own army
on the map, and from the other side of the table the previous player's
view is usually the wrong one.

What exists (`main` at `d74b8fe`):
- `MapView.centerOn(hex)` (`src/ui/MapView.ts:576-579`) centres the main
  camera on one hex; the Placement screen already uses it to follow the
  deployment highlight (`src/scenes/PlacementScene.ts:399`; README "and
  the camera follows").
- The Board starts its camera at the board's top-left
  (`MapView.ts:191-196`) and never moves it on its own.
- The turn passes in `BoardScene.endPhase` (`src/scenes/BoardScene.ts`,
  the `if (state.phase === 'movement')` branch after `applyAction(state,
  { kind: 'endPhase' })`), which already autosaves there as "a player's
  movement phase beginning".

## Outcome

- When a player's turn starts (their movement phase begins), the Board's
  view centres on the middle of that player's **land units** still in
  play, keeping the current zoom (owner's decisions). Ships don't count:
  an army and its fleet in a distant bay would otherwise put the centre
  on open sea between them.
- The same happens when the Board first opens on a game (new game, test
  mode, a load from the Menu or in place), so the first player starts
  centred too.
- It happens for every seat, AI included: you watch the computer's pieces
  while it plays, then the view moves to the next player (owner's
  decision).
- It does not happen when the same player goes from movement to combat
  (owner's decision), on undo/redo, or at any other time; dragging and
  zooming stay the player's.

## Constraints

- Presentation only: no change to `src/engine/` rules, `GameState` or
  saves. The camera isn't part of the game state, so undo and save/load
  are unaffected.
- Engine/presentation split (CLAUDE.md): the "middle of the pieces"
  calculation is pure and tested (in `src/ui/`, like `mapBounds.ts`); the
  scene only calls it and moves the camera.
- The camera is clamped to the board's bounds (`MapView.enableDrag`
  `setBounds`); centring near an edge stops at the edge.
- **Live check: kept** (owner, 2026-10-22, reversing the 2026-10-21 wish
  to skip it). `src/scenes/**` and `src/ui/**` owe one by path. The e2e
  scenario is delivered as well, as automated cover for later changes.

## Type-specific questions

### Feature
- **Users:** every hotseat player, and anyone watching an AI seat play.
- **Rulebook basis:** digital-only, no print rule.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - "Middle": the average of the land units' screen positions, or the
    centre of the box around them?
  - Jump or a short pan animation? A pan shows where the view went, but
    must not slow an AI-only game or the e2e suite.
  - A player with ships but no land units left: leave the view where it
    is (assumed below), or fall back to the ships?
  - The e2e scenario: end a phase in Test mode and check the camera's
    centre is within a hex of the computed middle.

## Assumptions I made

- **Feature:** new behaviour every player sees, with design questions.
- "Pieces" means the player's land units not destroyed (owner's
  decision: land only). A player with no land unit left: the view stays
  where it is.
- In a fully AI game the view jumps from seat to seat too; that's
  accepted (it follows from "every seat").
- The Placement screen is out of scope: it already follows the
  deployment zone.
