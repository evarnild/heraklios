<!-- generated-by: heraklios/intent@0.1.5 -->
# §64 — A second board view: a drawn 2D landscape with animated units

**Type:** feature
**Originator:** the owner (2026-11-05): "In addition to the standard view of
the game we have been developing until now, I would like to have a 2d vector
view with nice graphics for the terrain and animated units movements and
combats"
**Source:** none

## Problem

The board is drawn as a hex grid of flat colours, one per terrain
(`src/ui/hexRender.ts`, `TERRAIN_COLORS`: plain `0xdec08c`, sea `0x1e6eaa`,
…), with rivers as lines on hexsides and the units as the scanned print
counters (`public/markers/<colour>/<type>.png`). Nothing moves: a move, an
attack, a retreat or a drift redraws the units in their new hexes at once
(`BoardScene.renderAllUnits`), so a player reads what happened from the log
and from counters that jumped. It is faithful to the 1980 print, which is the
point of the standard view, but the owner wants a second way to see the same
game that looks like a drawn map and shows the action as it happens.

## Outcome

- A **second view** of the Board, switched by a **toggle on the board** at
  any moment of a game, keeping the camera position; the choice is
  remembered for the next game. The standard view stays as it is today.
- In the new view, **terrain is a continuous drawn landscape**: coastline
  and sea, rivers flowing along their hexsides, plateaus and steep flanks
  with relief, marsh, the named coastal zones, with the **hex grid as a thin
  overlay** so movement and ranges still read. It is drawn in code (vector),
  derived from the existing map data, with no hand-painted image.
- **Units are vector figures** per type (infantry, phalanx, archers,
  cavalry, chariots, elephants, galleys) in their player's colour, with their
  numbers readable, and with every state the counters show today (selected,
  in an attack group, damaged ship, facing, etc.).
- **Animated:** movement (hex by hex along the path, ships turning, swaps
  crossing), land combat (the clash and its result: retreat, push, advance,
  elimination, exchange), naval combat (ramming, boarding) and the elephant
  drift step by step.
- Same game either way: switching views never changes the state, the rules,
  saves, undo or what the computer decides.

## Constraints

- **Presentation only.** No change to `src/engine/` or `src/data/` rules or
  the save format; the new view reads the same `GameState`. If an animation
  needs to know what happened (a unit's path, a combat's result), it reads
  what the engine already returns, or the engine gains a pure, tested
  description of it, never a scene-side re-derivation of a rule.
- **`BoardScene.ts` is ~3200 lines** and draws its units and overlays itself.
  Two views need one seam they both draw through; the spec decides whether
  that is a separate refactor intent first (behaviour held constant, e2e
  green) or part of this one.
- **Animations and the game's flow:** the board already waits on human
  choices, AI pacing (`BoardScene.ts:94-96`), drift pauses (§21) and
  autosave. Input, undo/redo, save and the AI must behave correctly while
  something is animating (blocked, queued or skipped, as the spec says).
- **The e2e suite** drives the standard view by canvas clicks and waits for an
  idle board (`src/ui/devHook.ts:191-192` already counts running tweens); it
  must stay green and fast, so animations need a way to be off or instant
  under test.
- **Performance:** the map has about 1290 hexes; the landscape is drawn once
  (or cached) rather than every frame, and pan and zoom stay smooth.
- **i18n:** the toggle and any new text go into `src/ui/i18n/en.ts` and
  `fr.ts` (`noLiterals.test.ts`).
- **No external art or fonts** beyond what the repo already ships; any
  third-party asset would need its licence recorded.
- A live check is owed by path rule 1 (`src/scenes/`, `src/ui/`) and is
  visual by nature; the review decides its steps.

## Type-specific questions

### Feature
- **Users:** hotseat players, and anyone watching a computer seat play.
- **Rulebook basis:** digital-only; the print has one look, the standard
  view keeps it.
- **Known simplification it removes:** none.
- **Settled by the owner (2026-11-05):** landscape with a hex overlay, not
  styled hexes; vector figures, not redrawn counters; all four animation
  groups (movement, land combat, naval combat, elephant drift); a toggle on
  the board, not a Menu option.
- **Open design questions (for the spec):**
  - Does the Placement scene get the new view too, or only the Board?
  - Animation speed: one fixed pace, a speed setting, a "skip" key or click,
    and whether computer turns animate at the same pace as human ones.
  - What happens to input, undo, save and the end of a phase while an
    animation is playing (wait, cut it short, or queue)?
  - The seam between the two views: a refactor intent first, or within this
    one; and how the work is split into reviewable phases (for example
    terrain and units first, animations after).
  - Where the landscape comes from: generated from `MAP_TERRAIN` and
    `RIVER_HEXSIDES` alone, or with extra hand-tuned shape data (which the
    map editor would then need to author).
  - How an animation learns a unit's path and a combat's sequence of
    events, and whether the engine needs a structured event list for it.
  - Player colours and readability: colour-blind safety, and how figures
    show the same information as counters at every zoom level.

## Assumptions I made

- "Vector" means drawn in code with Phaser's graphics (or generated SVG),
  scaling cleanly with zoom, not bitmap art.
- The standard view stays the default, and is the one the e2e suite and the
  print comparisons use.
- The map editor (`map-editor.html`) is unaffected unless the spec chooses
  extra landscape shape data.
- This is large enough that the spec will likely split it into several
  intents or phased plans; this intent states the whole goal.
- Tier: Attested by the path table (`src/scenes/`, `src/ui/`); the spec or
  review may raise it.
