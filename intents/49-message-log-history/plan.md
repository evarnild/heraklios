<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §49 plan — The Board keeps every message in a scrollable log, clear of the bottom-left buttons

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

The Board's single replace-on-write log text becomes a history: a pure,
tested `src/ui/logHistory.ts` keeps every message as an entry, adds a
"Turn N — <player>" heading when the turn or the active player changes,
lets a drift grow one entry in place, and does the scroll arithmetic. A new
`src/ui/logPanel.ts` draws it between y = 178 and `height − 240` as a fixed
pool of one-line texts with a draggable scrollbar, so nothing can be drawn
below the panel. The map's wheel zoom skips the panel. `BoardScene` only
routes `log`/`appendLine` to the history and creates the panel. A new e2e
scenario reads the history and the panel's bounds through `devHook`.

## Risks

- **Tests that pass whatever the code does.** Each behaviour line below
  names its mutant. The panel drawing has no unit test; the e2e scenario
  covers what it does (entries kept, bounds, wheel, drag, follow).
- **Phaser reuses the scene instance.** A field initialiser runs once per
  instance, not once per game, so a history created there would carry over
  from one game to the next. It is created in `resetSceneState()`, which
  `create()` (:583) and `loadInPlace()` (:962) both call.
- **Log lines becoming click targets.** `devHook`'s `buttons()` takes every
  visible *interactive* `Text` as a button. The pooled line texts stay
  non-interactive; only the scrollbar thumb (a rectangle, not a `Text`) is
  interactive. An entry reading "Undo" must never shadow the Undo button.
- **Two cameras.** The panel objects must be pinned like the rest of the
  HUD (`mapView.pinUIObjects` / `excludeFromMainCamera`), or they also draw
  zoomed in the main camera. A geometry mask across two cameras is a known
  Phaser trap; this plan avoids masks entirely (see Assumptions).
- **The wheel.** `MapView`'s handler is scene-wide (:252-263). The panel's
  own `wheel` listener and the map's both fire; the map's must return early
  when the pointer is over the panel, or the map zooms while the log
  scrolls.
- **Drift entries.** `appendLine` during a drift must update the drift's
  own entry, which is normally the last but need not be if a `log()` lands
  in between. A drift that ends by error, undo restore (:1204) or reset
  (:547) must not leave later `appendLine` calls updating a stale entry.
- **`log('')` at a phase change** (:2863) clears the text today. As an
  entry it would be a blank line; it adds nothing.
- **Many prompts are messages too** (`selectAttacker`, `alreadyAttacked`…).
  Under B1 each becomes an entry, so the history can fill with repeats. The
  spec decided this; the live check is where it shows.
- **Stale line citations; the lint cap (21, never raised).** `BoardScene`'s
  `create` (226 lines) and `beginDrift` (96) already carry one warning each,
  so growing them adds none, but new functions must stay ≤ 80 lines and
  complexity ≤ 20. `MapView.ts` and `devHook.ts` have no warning today.
- **Port 5232 is shared** by every worktree's e2e run. Never kill a server
  you didn't start.

## Verified against the codebase

Re-read on `main` at `28af561`.

- `src/scenes/BoardScene.ts:85` — `const PANEL_WIDTH = 300;`
- `:132-135` — `interface DriftState { lines: string[]; onComplete: () => void; }`
- `:258-260` — `const currentLog = this.logText?.text.trim(); const lines = existingLines ?? (currentLog ? [currentLog] : []); this.driftState = { lines, onComplete };` (the seed copy, B3)
- `:293-325` — drift callbacks narrate through `this.appendLine(...)` (onNarrate, onCombat, onRetreat, onPush, onEliminated)
- `:337-338`, `:348` — drift end and error set `this.driftState = null`
- `:538-548` — `resetSceneState()` sets `this.driftState = null`; called from `create()` (:583) and `loadInPlace()` (:962) only
- `:686-777` — bottom-left buttons at `height − 72` (Undo), `− 40` (Redo), `− 104` (Save / Load), `− 136` (Abandon), `− 168` (End game), `− 200` (Pause), `− 232` (drift Continue, hidden by default), all `setDepth(30)`
- `:801-821` — `statusText` at (16, 118), `clockText` at (16, 140)
- `:823-835` — `logText` at (16, 178), `fontSize: '13px'`, `color: '#a89878'`, `wordWrap: { width: PANEL_WIDTH - 32 }`, `lineSpacing: 4`, depth 29, with the "without having to cap or scroll the log itself" comment
- `:837-856` — `this.mapView.pinUIObjects([... this.logText])`
- `:867` — `if (staged) this.log(messages().log.gameLoaded);`
- `:961-970` — `loadInPlace`: `resetSceneState()`, then `this.log(messages().log.gameLoaded)`
- `:1204` — the undo/redo restore sets `this.driftState = null`
- `:1250`, `:1268` — `this.log(messages().log.undone(...))`, `redone(...)`
- `:1246` — `this.log(messages().log.nothingToUndo)` when there is nothing to undo
- `:1344-1365` — `refreshStatus`: `activeId = this.activePlayerId()`, `player = state.players[activeId]!`, `state.turnNumber`
- `:1420-1425` — `update()`'s comment: "`log`/`appendLine`, which REPLACE the panel"
- `:1430-1445` — `log(message)` does `this.logText.setText(message)`; `appendLine` pushes to `driftState.lines` and logs the join, else `log(line)`
- `:2863` — `this.log('');` at the end of the phase change
- `src/engine/state.ts:160-163` — `turnNumber`, `activePlayerIndex`, `seatOrder`; `:247` `currentPlayer(state)`
- `src/ui/MapView.ts:92` — `onHexClick` public hook field (the pattern for a new hook)
- `src/ui/MapView.ts:248-264` — `enableZoom()`: `this.scene.input.on('wheel', (pointer, _objects, _dx, deltaY) => …)` zooms around the pointer
- `src/ui/MapView.ts:276-297` — `pinUIObjects` adds the HUD camera; `excludeFromMainCamera(objects)`
- `src/ui/devHook.ts:25` — `BUSY_FIELDS` read by name, guarded by a throw if missing (the pattern for reading `logHistory`/`logPanel`)
- `src/ui/devHook.ts:86-87` — `buttons()` collects visible, input-enabled `Text` objects
- `src/ui/devHook.ts:161` — `candidate` skips a `Text` without `input.enabled`
- `src/ui/i18n/en.ts:208`, `fr.ts:192` — the `log` message groups
- `src/ui/i18n/noLiterals.test.ts:14-24` — the checked calls include `.text(`, `.setText(`, `log(`, `appendLine(`
- `e2e/helpers.ts:17` — `MENU_CLOSE_COMBAT`; `:38` `startFromMenu`; `:59` `waitIdle`; `:74` `settle`; `:133` `clickButton`; `:171` `clickHex`
- `e2e/attacks.spec.ts:28-60` — the ranged-attack steps from Combat test mode
- `package.json:12` — `eslint . --max-warnings 21`; `npx eslint` on BoardScene, MapView, devHook: 5 warnings, all in BoardScene (`beginDrift` 96 lines, `create` 226, file length, `chooseExchangeSacrifice` and its arrow)

## Subtasks

1. **The history model, test-first** (`src/ui/logHistory.ts`, no Phaser,
   no i18n import; `src/ui/logHistory.test.ts`).
   - `LogHistory`:
     - `add(text, ctx)` returns the entry's index; ignores an empty or
       blank `text`; first adds a heading when `ctx.key` differs from the
       last heading's key;
     - `update(index, text)` replaces that entry's text;
     - `clear()`; `entries()` gives `{ kind: 'heading' | 'entry', text }[]`;
     - `newest()` is the index of the newest entry.
   - `ctx` is `{ key, heading }`, built by the scene: `key` is
     `` `${turnNumber}:${activeId}` `` and `heading` is the translated
     text. The model stays free of i18n and `GameState`.
   - The layout and scroll arithmetic, as pure functions:
     - `logPanelBounds(height)` gives `{ left: 16, top: 178, width:
       PANEL_WIDTH − 32, bottom: height − 240 }`;
     - `visibleLineCount(bounds, lineHeight)`;
     - `layoutLines(entries, wrap, newest)`: the flat display lines, each
       with kind and "newest" flag. `wrap` is injected; a wrapped entry is
       cached by index and text, so one new entry re-wraps one entry;
     - `clampOffset`, `isAtBottom`, `follow(prev, newTotal, visible)`
       (to the bottom only if `prev` was at the bottom);
     - `thumb(total, visible, offset, trackHeight, minThumb)` for its size
       and position, and `offsetForThumb(y, …)` for the drag.
   - Offsets are in whole lines.
   - Commit with verify green.
2. **The panel** (`src/ui/logPanel.ts`, Phaser).
   - `createLogPanel(scene, mapView, bounds)`:
     - a pool of `visibleLineCount` non-interactive `Text` objects, one
       per line, at `top + i × LINE_HEIGHT`;
     - a scrollbar track and an interactive, draggable thumb rectangle at
       the panel's right edge, hidden when everything fits;
     - a hidden measuring `Text` whose `getWrappedText` is the `wrap`;
     - every object `setScrollFactor(0)`, depth 29, pinned through
       `mapView.excludeFromMainCamera`.
   - Its API:
     - `render(history)`: lays out, applies `follow`, draws the visible
       slice. Entries are dim (`#a89878`, today's colour), the newest
       brighter, headings bright and bold;
     - `contains(x, y)`; `bounds`;
     - `offset`, `total` and `visible`, read by `devHook`.
   - The panel's own `scene.input.on('wheel')` scrolls by 3 lines a notch
     when `contains(pointer)`.
   - Lines of each entry wrap at `bounds.width − scrollbar width`.
3. **Wire the scene** (`BoardScene.ts`).
   - `resetSceneState()` sets `this.logHistory = new LogHistory()`, so it
     is empty for a new game and for a load (B8).
   - `logText` is replaced by `this.logPanel = createLogPanel(...)` at the
     same place in `create()`, and the depth-29 comment rewritten.
   - `log(message)` becomes `this.logHistory.add(message, this.logCtx());
     this.logPanel.render(this.logHistory)`. `logCtx()` takes the turn and
     player as `refreshStatus` does, plus a new
     `messages().log.turnHeading(turn, name)`.
   - **Drift:**
     - `DriftState` gains `entry?: number`;
     - `appendLine` during a drift adds the joined lines as an entry the
       first time and `update`s `driftState.entry` after that (B3);
     - drift end, error, reset and restore already null `driftState`, which
       ends the entry;
     - the seed copy at :258-259 is dropped (`lines = existingLines ?? []`),
       with a comment recording the spec's interpretation.
   - `log('')` (:2863) adds nothing, by the model's blank rule. The call
     stays, so a reader sees the phase boundary.
   - `MapView` gets `wheelBlocked: ((x: number, y: number) => boolean) |
     null = null`. `enableZoom`'s handler returns at once when it says true.
     The scene sets it to `(x, y) => this.logPanel.contains(x, y)`.
   - Update the `update()` comment at :1420 that says `log` replaces the
     panel.
   - Commit with verify green.
4. **i18n:** `log.turnHeading: (turn: number, name: string) => string` in
   `en.ts` ("Turn 3 — Alexios") and `fr.ts` ("Tour 3 — Alexios").
   `noLiterals.test.ts` stays green; extend its `CALLS` if the panel adds a
   new text-showing call name.
5. **devHook and e2e** (`src/ui/devHook.ts`, new
   `e2e/message-log.spec.ts`).
   - In `devHook.ts`:
     - `logEntries()` gives `{ kind, text }[]`;
     - `logPanel()` gives `{ top, bottom, left, right, offset, total,
       visible, thumb: Point | null }`, the thumb in canvas coordinates;
     - `cameraZoom()`;
     - the scene members read by name, guarded like `BUSY_FIELDS`.
   - The scenario is below under Tests (E1–E4).
   - `npm run e2e` all green: the existing scenarios still find the
     bottom-left buttons.
6. **README and Progress.**
   - In the README, a short "Message log" paragraph where the Board UI is
     described: kept for the whole game, headings, scroll, not saved,
     empty on load.
   - Fill in Progress (dates, commits, test counts, mutants, e2e output),
     then set `status: in-review`.

## Tests

`src/ui/logHistory.test.ts` (AC1, AC2). Each line names the mutant it kills:

- **H1** — three `add`s with the same key: one heading, then three entries
  in order (B1, B2). *Mutants:* heading on every entry; entries dropped or
  reordered.
- **H2** — a key change (turn, then player only) adds a heading before the
  next entry, and a return to an earlier key adds one again (B2).
  *Mutants:* heading never; comparing the turn only.
- **H3** — `add` then `update(i, …)` twice: still one entry, with the last
  text (B3). *Mutant:* append instead of update.
- **H4** — `update` of an entry that is no longer last changes that entry,
  and the newer one is untouched. *Mutant:* update the last entry.
- **H5** — blank and empty text adds no entry and no heading. *Mutant:* the
  blank check removed.
- **H6** — `clear()` empties it, and the next `add` gets a heading again
  (B8). *Mutant:* clear keeps the last heading key.
- **H7** — `layoutLines` marks only the newest entry's lines as newest and
  headings as headings (B7). *Mutant:* newest flag on all, or off by one
  entry.
- **H8** — `layoutLines` calls `wrap` once for an unchanged entry across two
  layouts and again after `update`. *Mutant:* the cache key without the
  text, so an updated drift entry shows stale lines.
- **S1** — `clampOffset` keeps the offset in `[0, max(0, total − visible)]`.
  *Mutants:* no lower or no upper clamp.
- **S2** — `follow`: at the bottom, growth moves to the new bottom; scrolled
  up, the offset stays; scrolled back to the bottom, it follows again (B6).
  *Mutant:* following when scrolled up.
- **S3** — `thumb`: its size is `visible/total` of the track, at least
  `minThumb`, at the top for offset 0 and at the bottom for the max offset;
  null when everything fits. `offsetForThumb` inverts it. *Mutants:* size
  not scaled; position not scaled by the max offset.
- **L1** — at 1100×750, `logPanelBounds(750)`: top 178, bottom 510 ≤ 750 −
  232, and `top + visibleLineCount × LINE_HEIGHT ≤ bottom` (B4, AC2).
  *Mutants:* bottom `height − 200`; the line count rounded up.

`e2e/message-log.spec.ts` (AC3), from Combat test mode, with a seed:

- **E1** — click Undo 30 times (nothing to undo yet: 30 "Nothing to undo."
  entries). `logEntries()` holds a heading then all 30 (B1, B2). The panel's
  bottom is ≤ 750 − 232 and above the Pause button's top (B4).
- **E2** — the log now overflows, so `logPanel()` is at the bottom.
  - The wheel up over the panel lowers `offset`, with `cameraZoom()`
    unchanged.
  - One more Undo click leaves `offset` put (B6).
  - The wheel over the map changes the zoom, so the probe can fail.
- **E3** — dragging the thumb (`page.mouse` down, move, up at `logPanel().
  thumb`) changes `offset` (B5).
- **E4** — end the movement phase and make the ranged attack as in
  `attacks.spec.ts`, then `settle`. No new heading (same turn and player),
  and the last entry is the combat report, which is longer than one line.
  `logEntries()` still begins with the 30 earlier entries (B1, B2).

The panel drawing, colours and drift readability are the live check's.
Each mutant is run against the full vitest suite, backed up and restored by
copy, never `git checkout --`.

## Validation

- `npm run verify` green, lint ≤ 21 (cap unchanged).
- `npm run check:intent` PASS.
- `npm run e2e` green, including `message-log.spec.ts` and every scenario
  that clicks a bottom-left button.
- **Live check (owed: `src/scenes/**`, `src/ui/**`, new and visual), AC5.**
  `npm run dev`, Menu → "Combat test mode":
  1. Act until the log overflows (attacks, or press Undo with nothing to
     undo). The scrollbar appears; the newest line is at the bottom and
     brighter.
  2. Wheel over the log: it scrolls, the map doesn't zoom. Wheel over the
     map: it zooms. Drag the scrollbar thumb.
  3. Scroll up, make another move or attack: the view stays put. Scroll to
     the bottom: it follows again.
  4. A combat entry reads in full; with "Test mode (2 players)" and an
     elephant, a drift reads as one growing block, with no copy of the
     combat above it.
  5. End the turn: a "Turn N — <player>" heading. Switch the Menu to French
     and start again: "Tour N — …".
  6. Nothing is drawn over or under the six buttons, including the drift
     Continue button during a drift pause.
  7. Undo: the history stays; load a save: it starts with "Game loaded.".

## Assumptions I made

- **No geometry mask; a fixed pool of one-line texts.** The spec's
  Non-functional section suggests "Phaser text in a masked container".
  Here the panel draws only the lines that fit, so clipping holds by
  construction (L1 proves it). This also avoids a mask under the two-camera
  HUD. Scrolling is by whole lines. Your call at approval if you want
  pixel-smooth scrolling.
- **The drift entry is tracked by index, not "the last entry"** (B3 says
  last). It is the same entry in every normal case, and it stays right if a
  `log()` lands mid-drift (H4).
- **A blank message adds nothing.** Today `log('')` clears the panel at a
  phase change; with a history there is nothing to clear.
- **The heading key is (turn, active player id)**, and its text names
  `player.name`, the name the status line uses. An AI seat gets a heading
  like any other.
- **E1 makes its overflow from "Nothing to undo."** It is a real message,
  cheap and deterministic. AC3 asked for "two moves and one attack", but a
  move logs nothing, so E4 uses the attack and E1 the Undo clicks.
- **Colours and sizes:** 13 px text as today; a line height of 17 px (13 +
  the `lineSpacing` 4); dim `#a89878`; newest `#d8c8a0`; headings
  `#e8d9b0`, bold; 3 lines per wheel notch; an 8 px scrollbar. The live
  check judges them.
- **No spacer between entries.** Headings and the newest colour separate
  them. Add one if the live check finds the history hard to read.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-23 - implementation (subtasks 1-6)

Commits: d1d8593 (model, panel, wiring, i18n, devHook, e2e), plus the
follow-up commit holding the e2e fixes, the README section and this entry.

Shipped: `src/ui/logHistory.ts` (+ 12 tests H1-H8, S1-S3, L1),
`src/ui/logPanel.ts` (fixed pool of one-line texts, scrollbar, wheel, thumb
drag), `BoardScene` routing (`logHistory` recreated in `resetSceneState`,
`log`/`appendLine`/`logContext`, drift entry by index, seed copy dropped),
`MapView.wheelBlocked`, `log.turnHeading` in en/fr, `devHook`
`logEntries`/`logPanel`/`cameraZoom`, `e2e/message-log.spec.ts` (E1-E4 in one
test), README "Message log" section.

Verify: 57 files, 944 tests passed; lint 21 warnings (cap 21, unchanged: two
new warnings from `installDevHook` and `createLogPanel` were removed by
extracting helpers). `npm run e2e`: 11 passed (incl. message-log.spec.ts).

Mutants (each run against the logHistory tests after a full-suite run; backed
up and restored by copy, tree clean after): heading every entry (H1,H4,H7),
heading never (H1-H4), append instead of update (H3,H4), update last entry
(H4), blank check removed (H5), clear keeps key (H6), newest on all (H7),
newest off by one (H7), cache ignores text (H8), clamp no lower (S1), clamp no
upper (S1), follow when scrolled up (S2), thumb size not scaled (S3), thumb
position not scaled (S3), bottom margin 200 (L1), line count ceil (L1). All
killed. Not covered by a unit test: "heading compares the turn only" - the key
is built in `BoardScene.logContext`, which is presentation; no test reaches it.

Divergences from the plan:
- `follow(prevOffset, prevTotal, newTotal, visible)` takes the previous total
  (needed to know "was at the bottom"); the plan's signature lacked it.
- `layoutLines` is the `LineLayout` class (`layout(entries, newest)`), which
  owns the per-entry wrap cache; `logPanelBounds(height, panelWidth)` takes the
  panel width as a parameter instead of importing the scene's constant.
- E1-E4 are one Playwright test (one game, steps in order). E1 clicks the
  Undo button `'↶ Undo'`, the End game button `'⚑ End game'` is the "above the
  buttons" reference (Pause is hidden without a clock). E4 asserts that a
  report with a newline appears after the earlier entries (a retreat message
  may follow it), not that it is the last entry.
- Not done: live check (owed to the owner).

### 2026-10-23 - review round 1 rework

Commit: the one after 2111b1d (this entry's commit).

Fixed:
- MEDIUM thumb drag panned the map: `MapView.wheelBlocked` became
  `pointerBlocked`, checked by the wheel handler and by `enableDrag`'s
  `pointerdown`. E3 now asserts the archers' `hexToCanvas` is unchanged across
  the drag. Red before the fix ("the map did not pan"), green after.
- MEDIUM README: the status line and the dialogs (retreat, advance, exchange,
  the Save / Load panel itself) are not log entries; the Board's prompts and
  the Save / Load panel's results are. spec.md left to the coordinator.
- MEDIUM untested wiring: new e2e test in message-log.spec.ts (heading for the
  other player in the same turn, then for the next turn); save-load.spec.ts
  asserts a heading then "Game loaded." after the load.
- LOW S2: `follow(10, 40, 3, 5) = 0` and `follow(10, 40, 12, 5) = 7` added.
- LOW logPanel: `scrollTo` returns early when the offset is unchanged; text,
  colour and font style are set only when they differ.

Mutants re-run, each restored by copy, tree clean after: turn-only heading key
(killed by the new heading e2e test), `this.logHistory = new LogHistory()`
dropped from `resetSceneState` (killed by save-load.spec.ts), drag not blocked
(killed by E3's "map did not pan"), `follow` returning `prevOffset` (killed by
S2).

Not done, on purpose: the bold-heading measuring LOW (only if the live check
shows a long name running under the scrollbar) and the drift e2e LOW (needs a
test-mode shortcut for an elephant scenario that does not exist; B3 stays with
the live check).
