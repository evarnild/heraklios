<!-- generated-by: heraklios/spec@0.1.0 -->
# §88 spec — The game canvas takes the browser window's width when the game starts

Accepted intent: [intent.md](intent.md)

Written against `main` at `7d8ada0`.

No game rule is involved, so the rulebook sources do not apply. The owner
answered the intent's three behavioural questions on 2026-11-24, in the
`/auto 88` question round: **width only**, **no maximum**, **narrower windows
keep today's behaviour**.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `src/main.ts` | Today: `width: 1100, height: 750`, no `scale` block. The game is created once, with `parent: 'app'`. |
| `index.html` | `#app` is `width: 100vw; height: 100vh`, a flex box centring the canvas, with `overflow: hidden` on `html, body`. |
| `src/ui/MapView.ts:82–146` | `new MapView(scene, viewportWidth, viewportHeight, leftPanelWidth)` lays the board out from the width it is given. "place THAT flush against the panel (or centered, if it's smaller than the available space)" (`originX = leftPanelWidth - minX + Math.max(margin, (availableWidth - boardWidth) / 2)`). The main camera's viewport is `availableWidth` wide, and pan bounds are the board ± 200 px. |
| `src/ui/hexRender.ts` | `HEX_SIZE = 22` and `x = HEX_SIZE * (1.5 * hex.q)`. The map's q runs 0..42 (`MapView.ts` comment), so the hex centres span 42 × 33 = 1386 px. |
| `src/ui/rulesPanelLayout.ts` | `SIDE_PANEL_WIDTH = 300`, and `rulesPanelRect(canvasWidth)` puts the Tables panel at `canvasWidth - RULES_PANEL_W - MARGIN`. |
| `src/ui/armyBuilderLayout.ts` | "the army builder's row geometry, in canvas pixels at 1100x750": `ARMY_COLUMN_X = [20, 565]`. |
| `playwright.config.ts:30` | `viewport: { width: 1100, height: 750 }`. |
| `intents/43-center-view-on-turn` | Turn-start centring goes through `MapView.centerOn` / `centerOnPoint`, clamped by the camera bounds. |

## Behaviour

- **B1 — The width, read once.** Just before `new Phaser.Game`, the game
  reads the width available to it: the `#app` element's `clientWidth`, or
  `window.innerWidth` if that reads 0. The canvas width is that number
  rounded down, but never less than 1100. The height stays 750.
- **B2 — Narrower windows (owner: "keep today's").** In a window 1100 px
  wide or less, the canvas is 1100 × 750, exactly as today, including the
  part cut off on the right.
- **B3 — No live resize (owner's option 2).** Resizing the window after the
  game started changes nothing until the page is reloaded. No `resize`
  listener is added.
- **B4 — No maximum (owner: "no cap").** The canvas is as wide as the
  window, however wide.
- **B5 — Board and Placement show more map.** Both scenes already build
  `MapView` from `this.scale.width`, so a wider canvas gives a wider main
  camera viewport. The existing rule then applies unchanged: while the board
  (≈1386 px of hex centres plus a hex each side) is wider than the room
  right of the side panel, it starts flush against the panel and the
  extra width shows more of it. Once it fits, it is centred in that room.
  **Amended 2026-11-25** (the owner, answering review round 1's F1:
  "Centre it (amend spec)"): when the room right of the panel is wider than
  the board plus its 200-px pan padding, the horizontal pan bounds widen,
  symmetrically about the board, to the room's width at zoom 1. So a board
  that fits stays centred instead of being clamped 200 px from the panel,
  with the extra width on the right. Placement follows the same rule over
  its full width. At widths where the board doesn't fit, the bounds are as
  before (so nothing changes at ≤1100). Zoom limits and the vertical bounds
  are unchanged, and so is the §43 turn-start centring, which works through
  the same camera.
- **B6 — Right-edge items follow the right edge.** Everything placed from
  the canvas width keeps its offset from the new right edge or centre:
  - the Tables panel (`rulesPanelRect`);
  - the Menu's language buttons (`width - 20 - …`);
  - the centred prompts (ram, board, advance, exchange: `width / 2`);
  - the Placement title and turn arrows (`width / 2 ± 120`).

  Each element placed at a fixed x that should follow the edge or centre is
  moved to do so; the plan lists every one. Elements meant to sit at the
  left (the Board's side panel, its buttons and log, the Placement info
  text) stay where they are.
- **B7 — The Army builder stays one 1100-wide block, centred.** Its two
  columns of rows are designed for 1100 px and gain nothing from width.
  The whole layout (title, the "use default" button, both columns, the help
  text and Confirm) is offset by `(canvasWidth - 1100) / 2`, so it sits in
  the middle of a wide canvas exactly as it looks today. At 1100 the offset
  is 0.
- **B8 — Menu and Game over stay centred.** They already centre on
  `width / 2` and need no change beyond B6.
- **B9 — The page around the canvas.** In a window taller than 750, the
  canvas stays vertically centred, with dark bands above and below as
  today (owner: "width only"). No horizontal scrollbar appears, because the
  canvas is never wider than `#app`.

## Interpretations

- **I1 — "The width of the browser window"** means the width `#app` gives
  the canvas, not `screen.width` and not a device-pixel-ratio-scaled
  width. The canvas stays at CSS pixel size, as today.
- **I2 — Map-editor**: a separate app with its own canvas. Out of scope.

## Acceptance criteria

- **AC1 — B1, B2 and B4** (test: a pure helper's unit test, e.g.
  `src/ui/canvasSize.test.ts`). The width function gives:
  - 1100 for 0, 800, 1100 and 1100.9;
  - 1101 for 1101;
  - 1600 for 1600.7;
  - 3440 for 3440.

  The height is always 750.
- **AC2 — B7** (test: `src/ui/armyBuilderLayout.test.ts`). The army
  builder's slot positions at canvas width 1100 are today's values exactly.
  At width 1500, every x is today's + 200 and every y is unchanged.
- **AC3 — B5 in the browser** (e2e: a new scenario with its own viewport,
  1600 × 750). The canvas is 1600 wide. The Board's main camera viewport is
  1300 wide (1600 − the 300-px panel). The Tables panel's right edge is
  within its margin of 1600.
- **AC3b — B5 centring on very wide windows** (amended 2026-11-25).
  - A pure bounds helper (unit test) gives today's bounds when the room is
    at most board + 2 × 200, and bounds the room's width wide, centred on the
    board, when it is wider. Its cases cover widths 1100, 1600, 2086, 2400
    and 3440, Board and Placement.
  - An e2e at 2400 × 750 asserts the Board's leftmost and rightmost hex
    centres are equally far (within one hex) from the edges of the room
    right of the panel. The test must fail on the old bounds.
- **AC4 — Nothing changes at 1100** (e2e: the whole existing suite at the
  pinned 1100 × 750 viewport). It passes with no scenario edited for this
  intent.
- **AC5 — Every screen at two widths** (live check, the owner). With a
  window about 1900 px wide and again with one 1100 px or narrower, walk
  Menu → Army builder → Placement → Board, open the Tables panel and one
  prompt, then reach Game over (test mode is fine). At the wide width:
  - no side bars;
  - more map, or the whole map centred;
  - the army builder centred;
  - nothing cut off or overlapping.

  At the narrow width, everything looks as it does today.

## Non-functional

- **Engine/presentation split:** presentation only. The width arithmetic
  (B1) and the army-builder offset (B7) are pure functions in `src/ui/`
  with tests. Scenes and `main.ts` only use them.
- **Save format:** unchanged. A save holds no screen size.
- **Undo boundaries:** none.
- **AI / harness:** none. Headless play has no canvas.
- **e2e:** the dev hook may need a read-only reader for the canvas size and
  the main camera's viewport (AC3). If so, it is added to the pinned
  member list (`e2e/dev-hook-members.spec.ts`), as §83 did.
- **Live check:** owed (`src/main.ts`, `src/scenes/**`, `src/ui/**`).

## Out of scope

- Height (owner: "width only").
- Following window resizes live (option 3, not chosen).
- Shrinking the game for windows under 1100 (owner: "keep today's").
- A maximum width (owner: "no cap").
- Re-centring the Board's left-side HUD, or moving the log.
- The map editor.

## Assumptions I made

- **The army builder is centred as one block (B7)** rather than each column
  spread out. The intent left this open as question 3. Its rows are a
  fixed 1100-px design (§79), and spreading them would put the two columns
  far apart for no gain. The Menu and Game over already centre.
- **The map camera uses the existing rule (B5)** rather than new framing.
  The intent left this open as question 4. `MapView` already centres a
  board that fits and starts flush otherwise. No new camera behaviour is
  added, so §43 and §83's framing keep working on the same camera.
- **`clientWidth` of `#app`, falling back to `innerWidth` (B1).** `#app` is
  `100vw` with `overflow: hidden`, so the two agree today. Reading `#app`
  keeps the rule right if the page ever gains a frame.
- **The numbers in Sources were read from the code at `7d8ada0`.** The
  board-width figure is the span of hex centres; the hit zone adds one
  `HEX_SIZE` each side. The plan confirms the measured fit width if it
  matters for a test.
- **In-flight overlap.** §73 rewrites much of `BoardScene.ts` and §83 adds
  camera framing to `MapView.ts`. This spec depends on neither. Whichever
  merges later rebases. No `blocked_by`.
