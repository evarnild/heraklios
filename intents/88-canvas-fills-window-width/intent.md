<!-- generated-by: heraklios/intent@0.1.5 -->
# §88 — The game canvas takes the browser window's width when the game starts

**Type:** feature
**Originator:** the owner, playing in the browser (2026-11-24): "the game has a fixed width which does not depend on the width of the browser window. Is there a way to extend horizontally automatically when the browser window is wider than the standard size". From the three options offered, the owner chose option 2: the width is set at startup.
**Source:** none

## Problem

The game is always 1100 × 750 pixels, whatever the size of the browser
window. `src/main.ts` fixes it:

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'app',
  width: 1100,
  height: 750,
```

`index.html` centres that canvas in a full-window `#app` on a `#111`
background. On a wider screen the player gets dark bars at the sides,
while the board, the one screen that would gain from more room, shows the
same 1100-pixel slice of map and has to be dragged around.

## Outcome

- **Wider window, wider canvas.** Opened in a window wider than 1100
  pixels, the canvas is as wide as the window, so there are no side bars,
  and the Board and Placement screens show correspondingly more map to the
  right of the side panel. A window 1100 pixels wide or narrower gets
  exactly today's 1100-wide game.
- **Every screen fits.** On a wide canvas every screen still lays out
  correctly: Menu, Army builder, Placement, Board and Game over. Nothing is
  cut off or left stranded, and the Board's right-edge elements (Tables
  panel, prompts, the language buttons on the Menu) follow the new right
  edge. The owner checks this live at two window widths.
- **e2e unchanged, new scenario added.** `npm run e2e` keeps passing
  unchanged at its pinned 1100 × 750 viewport. One new scenario opens the
  game in a wider viewport and checks that the canvas took that width and
  that the board's camera shows the wider view.

## Constraints

- **Width is read when the game starts, never live (owner's choice).**
  Resizing the window afterwards does nothing until a reload. Following the
  window live (Phaser `Scale.RESIZE`) was offered as option 3 and not
  chosen, because every scene would have to re-lay out on each resize.
- **Engine/presentation boundary.** This is presentation only. No game
  rule, `GameState` shape, save format, undo boundary or AI behaviour
  changes. Any width-dependent layout arithmetic worth testing goes in a
  pure `src/ui/` helper with tests, as `boardPrompts.ts`, `rulesPanelLayout.ts`
  and `armyBuilderLayout.ts` do today.
- **Most screens already lay out from `this.scale.width`** when they
  start: `BoardScene.ts:613` `const { width, height } = this.scale;` feeds
  `new MapView(this, width, height, PANEL_WIDTH)`. `rulesPanelRect(canvasWidth)`
  places the Tables panel from it. Menu items centre on `width / 2`. So the
  change should be mostly at startup. Places with fixed numbers need checking:
  `armyBuilderLayout.ts` is documented "in canvas pixels at 1100x750", and
  `boardPrompts.ts` comments "(550, 375 at 1100 x 750)".
- **e2e pins the viewport:** `playwright.config.ts:30` `viewport: { width:
  1100, height: 750 }`. With that viewport the game must behave exactly as
  today.
- **A live check is owed** (`src/main.ts`, `src/scenes/**`, `src/ui/**`,
  `index.html`), at a wide window and at a narrow one.
- **Overlapping work in flight, not blockers.** §73 (BoardScene on the
  engine session) and §83 (the end-move warning, which adds camera framing
  to `MapView.ts`) change the same files. Whichever merges later rebases.
  Neither is needed to build this correctly.

## Type-specific questions

### Feature
- **Users:** hotseat players, and anyone watching AI seats, in a browser.
  The map editor is a separate app and is not affected.
- **Rulebook basis:** digital-only. This is about the screen, not the rules.
- **Known simplification it removes:** none.
- **Open design questions** (for the spec):
  1. **Height too?** Should a taller window also give a taller canvas,
     never under 750? The owner asked about width. Height has the same
     problem, but bottom-anchored items like the Board's log and buttons
     (`height - 104`, `height - 136`) would move.
  2. **A maximum width?** On an ultra-wide screen (3440 px) the board may
     show the whole map and empty space. Cap it, or cap at the width where
     the map at the default zoom fits?
  3. **Screens that don't gain from width** (Menu, Army builder, Game
     over): keep their content centred in the wider canvas, or keep a
     1100-wide column centred? The army builder's rows are placed from the
     left at fixed x.
  4. **Map camera at a wide canvas.** Today's camera bounds "roughly the
     board's own extent" (`MapView.ts:130`), and the minimum zoom is
     `MIN_ZOOM = 0.4`. Should the starting view and the turn-start centring
     (§43) use the extra room?
  5. **Narrower than 1100:** keep today's behaviour (canvas 1100, browser
     scrollbars hidden by `overflow: hidden`, so the right part is cut), or
     scale down? The owner's ask covers only wider. The draft keeps today's.

## Assumptions I made

- **A feature, not an adjustment.** It touches `main.ts`, likely
  `index.html`, several scenes and a new e2e scenario, so it is over the
  adjustment limit of 5 files and 60 lines.
- **Review tier:** left empty. The path table makes `src/main.ts`,
  `src/scenes/**` and `src/ui/**` Attested, and no rule is involved.
- **"Width of the browser window"** means the `#app` element's width
  (`100vw`), read once before `new Phaser.Game`.
- **No `blocked_by`.** §73 and §83 overlap in files but are not
  prerequisites. They are recorded in `links:`.
