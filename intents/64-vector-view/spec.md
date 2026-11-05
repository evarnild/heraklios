<!-- generated-by: heraklios/spec@0.1.0 -->
# §64 spec — A second board view, a drawn 2D landscape with unit figures

Accepted intent: [intent.md](intent.md)

Written against `main` at `02f054a`.

**The owner's decisions (2026-11-05)**
- From the intent round: a landscape with a hex overlay; vector figures; a
  toggle on the board.
- From the spec round:
  - "Three intents": §65 is the view seam, first; this spec covers the static
    view; §66 is the animations.
  - "Board and Placement" both get the view.
  - A speed setting, and "any action cuts it short". Both concern §66, so they
    are recorded there, not here.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/65-board-view-seam/intent.md` | The interface this view implements. Units are drawn by unit id. Camera, drag, zoom, hit-testing and hover are shared. **This spec assumes §65 is merged.** |
| `src/data/map.ts` (`MAP_TERRAIN`, `RIVER_HEXSIDES`) | The only map data: one terrain per hex, and river hexsides as `"q,r\|q,r"` keys. The landscape is derived from these alone. |
| `src/data/terrain.ts:1-12` | The eleven terrain types: `plain`, `river-wide`, `steep-flank`, `plateau`, `marsh`, `coast`, the four `zone-*` bays, and `sea`. |
| `src/ui/hexRender.ts` | `HEX_SIZE = 22`, `hexToPixel` (flat-top axial), `TERRAIN_COLORS`, `RIVER_COLOR`, and `PLAYER_COLORS_HEX = ['#ffd54a', '#ff5a5a', '#5ab4ff', '#5aff7a']`. |
| `src/ui/MapView.ts` | What the standard view draws today, every one of which the new view must also draw: hex polygons and their hit areas (`:152-169`); rivers as 4 px lines on hexsides (`:187-205`); zoom 0.4 to 2.5 (`:256-257`); unit markers (`:352-383`, the counter images `public/markers/<colour>/<type>.png`); movement points; facing arrowheads; the drift arrow; choice labels; range labels; highlights and rings; and the hover tooltip `(q, r) — <terrain>`. |
| `src/ui/i18n/index.ts:8` | The precedent for a remembered choice: `LANGUAGE_STORAGE_KEY = 'heraklios.language'` in `localStorage`, falling back when storage is unavailable. |
| `README.md` | The board and placement sections gain the toggle; the print look stays the default. |

## Behaviour

**The toggle**

- **B1.** The Board and Placement each show a **view toggle**. It sits beside
  the existing bottom-left buttons on the Board, and in the matching place in
  Placement. It switches between **Standard** (today's look) and **Drawn**
  (this view) at any moment. The label names the view it switches to, in
  English and French.
- **B2.** Switching keeps the camera's scroll and zoom, the selection, every
  highlight and label on screen, and any prompt or chooser that is open. It
  changes nothing in `GameState`, the history, the log or the computer's
  turn. A switch during a computer's turn, a drift pause or a prompt is
  allowed, and the game carries on in the new view.
- **B3.** The choice is remembered across games and reloads under a
  `localStorage` key (`heraklios.boardView`), read and written the way the
  language is. When storage is unavailable or holds an unknown value, the
  view is **Standard**. Standard is the default for a first visit.
- **B4.** Saves don't record the view. Loading a save keeps the view the
  player has chosen.

**The landscape**

- **B5.** The Drawn view paints the map as one continuous landscape, derived
  from `MAP_TERRAIN` and `RIVER_HEXSIDES` only. Nothing is hand-authored, and
  the map editor is unchanged.
  - **Sea and coast:** one sea body with a coastline that follows the
    boundary between sea and land hexes as a smoothed curve, not a staircase
    of hex edges. Shallow water is shaded near the shore, and the `coast` hexes
    are drawn as beach or shore.
  - **The four named bays** (`zone-*`) read as water inlets, each with a
    tint of its own, so a player can tell them apart, and the name shows in
    the hover tooltip as today.
  - **Rivers:** each `RIVER_HEXSIDES` run is drawn as a flowing, slightly
    meandering water line along its hexsides, joined where the hexsides
    meet. `river-wide` hexes are drawn as broad water.
  - **Plateau:** raised ground with relief shading. Steep flanks show as
    hatched or shaded slopes on the sides they face.
  - **Marsh:** a reed and pool texture. **Plain:** a grass texture with
    light, deterministic variation, the same on every load.
  - **Terrain edges** between land types blend over a short band rather than
    cutting along hex edges, but the terrain under each hex centre is always
    that hex's own terrain.
- **B6.** The **hex grid** is drawn over the landscape as a thin, low-contrast
  overlay at every zoom level, so movement, ranges and deployment zones read.
- **B7.** The landscape is drawn once per scene, or cached as a texture, not
  every frame. Panning and zooming the Drawn view is as smooth as the
  Standard view on the same machine.
- **B8.** Geometry is computed in **pure functions**, unit-tested, with no
  Phaser import: the coastline polygon from the sea and land hexes, the river
  polylines from the hexsides, the smoothing, and the seeded variation.
  Phaser code only draws what they return.

**The units**

- **B9.** Each unit type is drawn as a vector figure in its owner's colour
  (`PLAYER_COLORS_HEX`), recognisable by its silhouette alone:
  - **`fantassins`, `fantassins-lourds`, `fantassins-archers`:** infantry, with
    the heavier kind bulkier and the archer kind carrying a bow;
  - **`phalanges`:** a block of upright spears;
  - **`archers`:** a bow;
  - **`cavalerie-legere`, `cavalerie-lourde`:** a rider, with the heavy one
    armoured;
  - **`chars-legers`, `chars-lourds`:** a chariot, with the heavy one larger;
  - **`elephants`:** an elephant;
  - **`galeres`, `biremes`, `triremes`, `quintiremes`:** a galley, with one,
    two, three or five oar banks shown, drawn pointing along the ship's
    facing.

  Each figure carries the numbers the print counter shows, in a small badge
  readable at the default zoom.
- **B10.** Each figure stands on a base of its owner's colour, with a dark
  outline. The four players stay distinguishable by more than hue: the base
  shape differs per player (round, square, diamond, shield), so colour-blind
  players can tell owners apart.
- **B11.** Every overlay the Standard view draws has a Drawn-view
  counterpart, through the §65 interface:
  - hex highlights and groups;
  - rings (for example swap partners);
  - the selected unit's movement points;
  - ship facing;
  - the elephant drift arrow;
  - choice and range labels;
  - the hover tooltip.

  They may be restyled, but none may be missing, and each stays legible over
  the landscape.

**Placement**

- **B12.** In Placement, the Drawn view shows the deployment zones as a
  tinted overlay on the landscape (what `highlightHexes` draws today), and
  placed units as figures. Clicking places a unit exactly as it does in the
  Standard view.

**Input and the rest of the board**

- **B13.** Clicks, hover, drag and zoom hit the same hex in both views: the
  hex under the cursor is the one `pixelToHexRound` gives, whatever the
  landscape looks like there.
- **B14.** The side panel, log, buttons, the Tables panel (§55) and every
  prompt are the same in both views.

## Interpretations

- **"2D vector view"** is read as graphics drawn in code (Phaser Graphics,
  or generated paths cached to a texture) that scale cleanly with zoom. Bitmap
  art and external assets are not used.
- **"Nice graphics for the terrain"** is read as the continuous landscape of
  B5 at the level of a clean illustrated map, not photo-realism. The test is
  the live check, not a pixel test.
- **The coastal bays** (`zone-*`) are deployment zones on the print, coloured
  as distinct areas. They're read as water inlets, because their print colours
  sit with the sea's (`TERRAIN_COLORS`). The live check confirms they look
  right.

## Acceptance criteria

- **AC1 (B1, B2):** e2e scenario `e2e/board-view.spec.ts`. It starts a
  test-mode game, toggles to Drawn, makes a land move by canvas click,
  toggles back, and asserts that the state (through the dev hook), the
  camera's zoom and scroll, and the selection are unchanged by each toggle.
- **AC2 (B3, B4):** unit tests of the remembered choice (read, write, an
  unavailable store, an unknown value means Standard). The e2e scenario
  reloads the page and finds Drawn still selected.
- **AC3 (B5, B8):** unit tests of the geometry:
  - the coastline polygon separates every sea hex centre from every land hex
    centre;
  - every `RIVER_HEXSIDES` key is covered by exactly one river polyline
    segment;
  - smoothing never moves a coastline point across a hex centre;
  - the plain texture's variation is the same for the same seed;
  - each function is mutation-checked in review.
- **AC4 (B6, B11, B12):** live check, item by item (below).
- **AC5 (B7):** a manual timing in the review. The landscape is built once
  per scene (a unit test, or a counter through the dev hook), and pan and zoom
  feel the same in both views (live check).
- **AC6 (B9, B10):** live check. Each of the 14 types is recognisable and
  each owner distinguishable. A dev-only page or test-mode shortcut that
  lays out every type for every player is acceptable as the means.
- **AC7 (B13):** the e2e scenario's move is made in the Drawn view by
  clicking a hex centre computed with `hexToPixel`, and lands on that hex.
- **AC8 (B14):** the existing e2e suite stays green in the Standard view,
  unchanged.
- **AC9:** README's board and placement sections describe the toggle. i18n
  keys exist in `en.ts` and `fr.ts` (`noLiterals.test.ts`).

## Non-functional

- **Engine/presentation split:** no `src/engine/` or `src/data/` change.
  Geometry is pure in `src/ui/` (for example `src/ui/landscape/*.ts`), and
  drawing goes in the new view class.
- **Save format:** unchanged. **Undo boundaries:** none.
- **AI / harness:** unaffected.
- **Lint cap 21:** the new drawing code is split into files and functions
  within the guardrails, so no new warning appears.
- **Bundle size:** stated before and after in the plan's Progress.
- **Performance:** B7.

## Out of scope

- Animations of any kind (§66), including a moved unit sliding: units appear
  in their new hexes at once, as in the Standard view.
- Any change to the Standard view, the print counters or the map editor.
- Hand-authored landscape shapes, elevation data or new map data.
- The Army builder, Menu and Game-over scenes.

## Assumptions I made

- **§65 lands first** and gives an interface with units by id. This spec's
  plan can't be drafted against code until then, so the `/auto 64` run is
  expected to stop at the plan step until §65 is merged.
- The plain-texture variation is seeded from the hex coordinates, not from
  the game seed, so the map looks the same in every game.
- Facing for ships is shown by the galley's orientation, replacing the
  separate arrowhead in the Drawn view. The drift arrow stays an arrow.
- The badge numbers are the same ones the print counter images carry. The
  plan reads them from `src/data/units.ts`, not from the images.
- The toggle's labels are "Drawn view" / "Standard view" in English and
  "Vue dessinée" / "Vue standard" in French. The plan may refine them.
- Tier: Attested by the path table. The review may raise it.
