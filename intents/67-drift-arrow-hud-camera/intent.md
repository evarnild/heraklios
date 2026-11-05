<!-- generated-by: heraklios/intent@0.1.5 -->
# §67 — The elephant drift arrow is drawn once, by the map camera only

**Type:** fix
**Originator:** the §65 implementer's report (2026-11-05), passed on by the
coordinator; the owner: "draft 65 finding as fix intent"
**Source:** §65's Progress in `intents/65-board-view-seam/plan.md`, which
flags it: "the drift-arrow graphics were never in that list, so the UI
camera may draw the arrow a second time … left as is to hold behaviour
constant"

## Problem

The Board has two cameras:
- the main camera, which scrolls and zooms over the map;
- a fixed HUD camera (`MapView.pinUIObjects`, `src/ui/MapView.ts:284-298`)
  for the side panel and prompts.

Every map object must be ignored by the HUD camera, or the HUD camera draws
it a second time at its unscrolled, unzoomed position. `pinUIObjects` ignores:
- the hex polygons;
- the overlay, ring, river and facing graphics;
- the unit markers.

It doesn't ignore `driftArrowGraphics` (created at `:163`, depth 12, drawn by
`setDriftArrow`). So during an elephant drift (plan-history §21), the arrow
showing the drift direction is likely drawn twice:
- once on the elephant, through the main camera;
- once by the HUD camera, at the same world coordinates without the scroll
  and zoom.

That second copy lands somewhere else on screen, over the panel or the map,
whenever the camera has moved.

## Outcome

- During a drift, exactly one drift arrow is drawn: on the drifting elephant,
  following the camera's scroll and zoom.
- No other map object is drawn by the HUD camera. The fix checks the rest of
  the list too: every graphics object `MapView` creates (or, after §65, the
  view's `mapObjects()`) is ignored by the HUD camera.

## Constraints

- Presentation only: no engine, rule or save change.
- **After §65:** the fix goes into `mapObjects()` in
  `src/ui/standardBoardView.ts` (§65 moves the drawing there). If §65 isn't
  merged first, it goes into `pinUIObjects` on `main`. The plan picks the
  target by what's merged when it's written.
- Live check owed by path rule 1 (`src/ui/`).

## Type-specific questions

### Fix
- **What broke:** the observed and expected behaviour aren't confirmed on
  screen yet. Expected: one arrow on the drifting elephant. Likely: a second
  arrow drawn by the HUD camera, offset by the camera's scroll and zoom.
- **Since when:** `6807cf4` (2026-08-21, "Pause elephant drift for human
  seats and show its direction on the map"), plan-history §21, before the
  intent workflow existed.
- **Impact:** cosmetic and confusing, during drifts only. No game or save
  corruption.
- **Reproduction:**
  1. Start a test-mode game with elephants (or a normal game) in a human
     seat.
  2. Scroll or zoom the map away from its starting position.
  3. Make an attack that forces an elephant to drift.
  4. While the drift pauses for the human seat, look for a second arrow away
     from the elephant.
- **The test that will fail first:** no vitest covers Phaser cameras. The
  failing-first check is an e2e assertion through the dev hook:
  - during a drift pause, the HUD camera's ignore list (or its render list)
    must contain the drift-arrow graphics;
  - equivalently, `cameras.cameras[1]` must not render it.

  The plan decides whether `devHook.ts` exposes that read-only fact, or
  whether a pure helper listing "every map object" gets a unit test that
  compares it with the objects a view creates.

## Assumptions I made

- The double draw is inferred from the code, not yet seen; the reproduction
  confirms it first. If no second arrow appears (for example because Phaser
  culls it), the intent becomes "add the arrow to the ignore list for
  consistency", and the plan says so.
- No `follows_up`: the cause predates the intent workflow (§21).
- Tier: Attested by the path table.
