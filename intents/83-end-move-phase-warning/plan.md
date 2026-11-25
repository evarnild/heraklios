<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §83 plan — Ending the movement phase with unmoved units shows them and asks to confirm

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (accepted 2026-11-22)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

A human seat that clicks **End phase** in its movement phase while some of
its units have not moved, and could have, gets a warning before the phase
ends (spec B1-B15). The warning:

- frames those units with the least camera change (B6);
- marks each one with a magenta rectangle (B7);
- asks in the side panel, over the top of the log, with **End phase anyway**,
  **Cancel** and a "Don't warn me again this game" box (B8-B12).

Cancel leaves the phase, the units, the undo history and the camera as they
were. Confirm ends the phase exactly as today.

The split:

- **Engine.** The fact "has not moved" and the flagged list are in a new
  pure module, `src/engine/unmoved.ts`, which §82 reuses.
- **Pure UI.** The framing math and the prompt's rectangle are pure `src/ui`
  functions.
- **Phaser.** The prompt, the marks, the camera save and restore, and the
  per-seat switch are one Phaser module in `src/ui`.
- **Scene.** `BoardScene` keeps a hook of +10 lines. While the warning is
  open it sets the existing `decisionPending`, so every pending-choice guard
  already covers it (B13).

## Risks

- **Stale line citations.** Every `path:line` below was read at `cf79a1b`.
  §73 is rewriting `BoardScene`'s guards on `refactor/73-boardscene-on-session`,
  and §81 is planned against the same ceiling. Re-grep each symbol before
  editing it; never trust a line number after a rebase.
- **The `BoardScene.ts` ceiling (3172) and the parallel intents.**
  - This plan raises it by exactly +10 (budget line below).
  - §81 also targets this ceiling. §73 lowers it.
  - **Whichever of §81, §83 and §73 merges later rebases.** It re-measures
    with `npm run size:baseline -- --write` and keeps its own budget line
    true against the new base.
  - The coordinator sends the "main moved, rebase" notice. §83's
    implementer rebases if §83 is the later one.
- **§73's `pending()` helper.** §73 folds the six guards
  (`intents/73-boardscene-on-session/plan.md:114-121`) into one `pending()`
  helper and may stop using `decisionPending`. Whichever of §73 and §83
  merges second must make the warning part of `pending()`, or the warning
  loses every guard (B13) without any test failing at compile time. The
  guards to keep are undo, redo, save/load, end game, end phase, board
  click, autosave and the Tables suppression in `update`.
  - If §83 merges first, §73's rebase owns this. The coordinator relays it.
  - If §73 merges first, this plan's subtask 5 changes. The hook adds
    `this.endMoveWarning.isOpen` to `pending()` instead of setting
    `decisionPending`, and the plan is amended and re-approved before the
    code (it changes the budget count).
  - The guard is pinned by e2e AC12 (Ctrl+Z refused, board click selects
    nothing), so a lost guard fails `npm run e2e`.
- **The devHook's `busy()` while the warning is open.**
  - `BUSY_FIELDS` includes `decisionPending` (`devHook.ts:32`), so `idle()`
    is false while the warning is open.
  - So any e2e scenario that clicks End phase in a movement phase and then
    calls `waitIdle`/`settle` hangs until it times out. That is AC15's
    reason for the shared helper (subtask 7).
  - A scenario missed there fails loudly, with "still busy with:
    decisionPending", never silently.
  - There are 10 call sites, not the spec's 8: `view-centre.spec.ts:53`
    (a combat-phase click) is also routed, since the helper is a no-op
    there.
- **A soft lock if `decisionPending` stays true.** If Cancel or Confirm
  throws after the warning set the flag, every guard stays shut
  (`BoardScene.ts:385-399`'s own warning about this class of bug).
  `close()` clears the flag in a `finally`, before the confirm callback
  runs. Confirm's `end()` then runs outside that `finally`, as the
  decision code at `:2232-2257` does.
- **The Escape key.**
  - Both the scene (`:828`, Tables close) and the warning listen for
    Escape. The Tables panel's `close()` is a no-op while suppressed
    (`rulesPanelState.ts:27-30`).
  - The suppression only follows `decisionPending` in `update()`
    (`:1448`), one frame late. So the e2e for AC7/AC11 waits two frames
    after opening before pressing Escape. Real players are always slower
    than a frame.
- **Tests that pass whatever the code does.**
  - **AC2 needs real positions.** A "boxed-in" or "swap-only" unit must be
    proved boxed in, not assumed. Each such test first asserts what
    `legalActions` offers that unit (nothing, or only the swap), so the case
    cannot pass vacuously.
  - **AC5 needs an independent oracle.** Its "flagged ids equal the engine
    list" calls `unmovedUnits` in the test on the hook's JSON state copy. It
    does not compare the reader with itself.
- **Camera math in Phaser terms.**
  - The pure framing works in "camera centre + zoom". `MapView` converts
    with `centre = scroll + viewport/2` (Phaser's `centerOnX`, `scrollX = x
    - width * 0.5`, `node_modules/phaser/src/cameras/2d/BaseCamera.js:639-653`).
  - The zoom is set before `centerOn`, because the bounds clamp depends on
    the zoom.
  - The restore uses `setZoom` then `setScroll` with the saved values.
- **The lint cap (19, today's count).**
  - New modules must add no warning: functions ≤ 80 lines, ≤ 7
    parameters, nesting ≤ 4.
  - `BoardScene.create` already warns for length, so the one line it gains
    adds no new warning.
  - Never raise `--max-warnings`.
- **`MapView.ts` near 500 lines.** It is 463 now and gains about 25, to
  about 488. It is not in the size baseline, so passing 500 would add a
  `max-lines` warning (breaking the lint cap) and fail `check:intent`'s
  size rule 2. If it would pass 500, `cameraView`/`setCameraView` move into
  `endMoveWarning.ts`, working on `scene.cameras.main` directly, and the
  implementer records that in Progress.

## Verified against the codebase

Re-read on `main` at `cf79a1b`. `git diff --stat c822f4b cf79a1b -- src e2e scripts`
is empty, so the spec's citations of `c822f4b` hold, with the differences noted.

- `src/scenes/BoardScene.ts`: 3172 lines (`wc -l`), the ceiling at `scripts/size-baseline.json:6`.
- `src/scenes/BoardScene.ts:79` — `import { LogHistory, logPanelBounds, type LogContext } from '../ui/logHistory';`.
- `src/scenes/BoardScene.ts:91` — `import { bindUndoRedoKeys, onKeyOnce } from '../ui/shortcutKeys';`.
- `src/scenes/BoardScene.ts:372-400` — the doc comment and `private decisionPending = false;`. The doc lists the guards it gates: "undo, autosave, save/load, `onHexClick`, ending the phase, starting a new attack".
- `src/scenes/BoardScene.ts:422` — `private rulesPanel!: RulesPanel;` (the `!`-field pattern the new field copies).
- `src/scenes/BoardScene.ts:493` — `private readonly seatAgents = new Map<PlayerId, DrivingAgent>();`.
- `src/scenes/BoardScene.ts:560-591` — `resetSceneState`: `this.decisionPending = false;` (`:570`), `this.rulesPanel?.reset();` (`:577`).
- `src/scenes/BoardScene.ts:598-603` — `buildSeatAgents`: `const agent = createSeatAgent(seatControlFor(i));` (`:601`).
- `src/scenes/BoardScene.ts:639` — `endBtn.on('pointerdown', () => this.endPhase());`.
- `src/scenes/BoardScene.ts:827-830` — `bindUndoRedoKeys(...)`; `onKeyOnce(this.input.keyboard, 'keydown-ESC', () => this.rulesPanel?.close());`; SPACE and ENTER → `resolveDriftContinue`.
- `src/scenes/BoardScene.ts:858-860` — `createLogPanel(this, this.mapView, logPanelBounds(height, PANEL_WIDTH))`; `new RulesPanel(...)`; `this.mapView.pointerBlocked = (x, y) => this.logPanel.contains(x, y) || this.rulesPanel.contains(x, y);`.
- `src/scenes/BoardScene.ts:988-990` — `loadInPlace` → `this.resetSceneState(); this.adoptSave(save);`.
- `src/scenes/BoardScene.ts:1017` — `autosave`: `if (this.retreatChoice || this.driftState || this.decisionPending) return;`.
- `src/scenes/BoardScene.ts:1038-1039` — `openSaveLoad` guard → `messages().log.resolvePendingSave`.
- `src/scenes/BoardScene.ts:1057`, `:1084` — `confirmAbandon` is "Deliberately UNGUARDED".
- `src/scenes/BoardScene.ts:1136-1137` — `confirmEndGame` guard → `resolvePendingEnd`.
- `src/scenes/BoardScene.ts:1273-1274`, `:1291-1292` — `undo`/`redo` guards → `resolvePendingUndo`/`resolvePendingRedo`.
- `src/scenes/BoardScene.ts:1448` — `this.rulesPanel?.setSuppressed(this.decisionPending);` in `update`.
- `src/scenes/BoardScene.ts:1464-1467` — `private log(message: string)`: `logHistory.add` + `logPanel.render`.
- `src/scenes/BoardScene.ts:1520` — `if (this.decisionPending || this.aiRunning) return;` in `onHexClick`.
- `src/scenes/BoardScene.ts:1944-1949` — `deselectMovement`: `selected = null`, `clearNavalMovementControls()`, `mapView.clearHighlights()`, `refreshMovementLabel()`.
- `src/scenes/BoardScene.ts:2505-2506` — `resolveGroupAttack` guard → `resolvePendingAttack`.
- `src/scenes/BoardScene.ts:2909-2927` — `endPhase`: the `aiRunning` refusal (`:2910-2918`), the pending refusal (`:2919-2922`), then `this.commitEndPhase();` (`:2923`), a two-line comment, and `this.maybeStartAiTurn();` (`:2926`).
- `src/scenes/BoardScene.ts:2933-2965` — `commitEndPhase`: `deselectMovement()` (`:2934`), `history.clear()` (`:2938`), on a new movement phase `centreOnActivePlayer()` (`:2958`) and `autosave()` (`:2961`), `this.log('')` (`:2964`).
- `src/scenes/BoardScene.ts:2983-2987` — `maybeStartAiTurn`: `if (!this.seatAgents.has(this.activePlayerId() as PlayerId)) return;`.
- `src/scenes/BoardScene.ts:3029-3032` — `legalActions(state, { attackedThisPhase: this.attackedThisPhase, rammedThisTurn: this.rammedThisTurn })`.
- `src/scenes/BoardScene.ts:3080-3081` — the AI's `case 'endPhase': this.commitEndPhase();`, which never goes through `endPhase` (B4).
- `src/engine/actions.ts:408-411` — `ActionContext { attackedThisPhase?; rammedThisTurn? }`.
- `src/engine/actions.ts:442-488` — `legalActions`. Its movement branch emits `navalMove`, `navalRotate` (if `movementLeft >= 1`), `ram`, `landMove` and `swapActionsFor` per own living unit, and skips a ship in `rammedThisTurn`.
- `src/engine/actions.ts:66-74` — `Action`: `landSwap` has `unitId` and `otherId`.
- `src/engine/actions.ts:190`, `:207-208`, `:328`, `:337`, `:349`, `:367` — every movement action lowers `movementLeft` (`-= cost`, `-= step.costA` / `costB`, `-= contact.cost`, `-= dest.cost`, `-= 1`, `= 0`). The only zero-cost one is a `navalMove` onto a cost-0 contact, which is the ship's own starting state (`navalMovement.ts:142-145`, "including the ship's starting spot"; `:154-169`). That is no move, so B1 holds.
- `src/engine/state.ts:23`, `:40`, `:44` — `movementLeft: number;`, `charged: boolean;`, `export function unitType(unit: Unit)`.
- `src/engine/turnManager.ts:157` — `u.movementLeft = unitType(u).movement;` at each movement phase.
- `src/engine/movement.ts:372` — `if (unit.movementLeft !== fullAllowance) return null;`, the engine's existing "not moved yet" test.
- `src/engine/movement.ts:185-200` — `swapStep` (needs `state.allowSwaps`, same owner, both land, adjacent).
- `src/engine/actions.test.ts:16-38` — `makeUnit`/`makeState`, the pattern for AC1/AC2 positions. `:507-538` holds the swap cases on the plain row `(10,3)-(13,3)`.
- `src/engine/movementCases.ts:31-35` — `refillMovement`.
- `src/engine/seatControl.ts:71-75` — `createSeatAgent` returns null exactly when `aiDifficultyOf(control) === null`. `:47-49` is `isAiSeat(control)`, the same test.
- `src/ui/session.ts:98-100` — `seatControlFor(playerIndex)`.
- `src/ui/MapView.ts:130-143` — bounds `boundsPadding = 200` (`:133`), `mainCam.setViewport(leftPanelWidth, 0, availableWidth, viewportHeight)` (`:142`).
- `src/ui/MapView.ts:149-155` — `viewHost().ignoreOnUiCamera` is private. `:278-293` has `pinUIObjects` and `excludeFromMainCamera`. There is no public way to keep a later world object off the HUD camera.
- `src/ui/MapView.ts:248-268` — `enableZoom`: `const MIN_ZOOM = 0.4; const MAX_ZOOM = 2.5;` (`:250-251`), local.
- `src/ui/MapView.ts:193-197` — `cameraStrays()` (the `hudStrays` reader).
- `src/ui/MapView.ts:295-298` — `toScreen(hex)` (world point of a hex centre).
- `src/ui/MapView.ts:452-460` — `centerOn`, `centerOnPoint`.
- `src/ui/MapView.ts`: 463 lines.
- `src/ui/standardBoardView.ts:147`, `:163` (units depth 10), `:304`, `:348` (labels depth 13). `src/ui/drawnUnits.ts:201` (Drawn units depth 10). `src/ui/logPanel.ts:31` (log depth 29). HUD buttons are depth 30. `MapView.ts:72` (tooltip depth 35).
- `src/ui/logHistory.ts:96-99`, `:108-110` — `LINE_HEIGHT = 17`, `LOG_TOP = 178`, `LOG_BOTTOM_MARGIN = 240`, `logPanelBounds(height, panelWidth) → { left: 16, top: LOG_TOP, width: panelWidth - 32, bottom: height - LOG_BOTTOM_MARGIN }`.
- `src/ui/rulesPanelLayout.ts:11`, `:17-22` — `SIDE_PANEL_WIDTH = 300`, `interface Rect { left; top; width; height }`.
- `src/ui/rulesPanelState.ts:27-30`, `:42-44` — `close()` returns early while suppressed, and `setSuppressed`.
- `src/ui/shortcutKeys.ts:28-30` — `onKeyOnce(keyboard, name, fn)`. `src/ui/onceEach.ts` explains Phaser's re-emit (§62).
- `src/ui/hexRender.ts:4`, `:89` — `HEX_SIZE = 22` and `PLAYER_COLORS_HEX` (no magenta). It has no Phaser import, so a pure module may use it.
- `src/ui/confirmDialog.ts:86-89` — the full-canvas `0x000000, 0.6` backdrop (why the prompt does not use it).
- `src/ui/i18n/en.ts:77`, `fr.ts:69` — `common.cancel`: `'Cancel'` / `'Annuler'`.
- `src/ui/i18n/en.ts:199-200` — `exchangeRow` uses `☒`/`☐` for a tick box (the switch-off box copies it).
- `src/ui/i18n/en.ts:261,263,267,271,289,297` and `fr.ts:245,247,251,255,273,280` — the six `resolvePending*` lines, all "retreat/drift" / "la retraite ou la dérive". No test or e2e asserts them (grep).
- `src/ui/i18n/fr.ts:179` — `` `Aborder ${defender} ?…` ``, the space before `?`.
- `src/ui/i18n/messages.test.ts:112-126` — both tables have the same keys, and every message is translated.
- `src/ui/devHook.ts:32` — `BUSY_FIELDS = ['aiRunning', 'decisionPending', 'retreatChoice', 'driftState']`.
- `src/ui/devHook.ts:192-200`, `:240-290` — `installDevHook` spreads the §75 groups. `boardReaders` (`:240`) has `rulesPanel: () => rulesPanelSnapshot(board(game))`, guarded by `RULES_MEMBERS` (`:166`, `:368-374`).
- `src/ui/devHook.ts`: 454 lines.
- `e2e/dev-hook-members.spec.ts:7-39` — the sorted `MEMBERS` list.
- `e2e/helpers.ts:59-95` — `waitIdle` and `settle`. `:122-125` is the private `frames()`. `:139-142` is `clickButton`.
- `src/ui/devHookMatch.ts:15-17` — labels match exactly, so `'End phase'` and `'End phase anyway'` never collide.
- End-phase clicks in e2e: `attack-log.spec.ts:33`, `attacks.spec.ts:54`, `message-log.spec.ts:102`, `:132`, `:144` (loops over both phases), `rules-panel.spec.ts:90`, `undo-shortcuts.spec.ts:51`, `view-centre.spec.ts:50`, `:53` (combat phase).
- `scripts/size-budget-lib.mjs:52`, `:107-123` — the `budget:` regex. A budget passes when `n >= growth`, and the baseline must equal the measured count (rule 5).
- `package.json:12` — `"lint": "eslint . --max-warnings 19"`. `npx eslint .` reports 19 warnings today.
- `README.md:141-144` ("End phase" advances movement → combat…), `:243-248` (undo refused while a choice is pending), `:524` (`### The view at the start of a turn`).

## Where this goes

- **Modules touched:**
  - `src/scenes/BoardScene.ts`: the hook (+10, itemised under subtask 5).
  - `src/ui/MapView.ts`:
    - `MIN_ZOOM`/`MAX_ZOOM` move out to `cameraFraming.ts` and are imported back;
    - `cameraView()`/`setCameraView(view)` save and restore the main camera;
    - `frameWorldBox(box)` moves the camera;
    - `keepOffHud(objects)` keeps a later world object off the HUD camera.

    It goes from 463 to about 488 lines.
  - `src/ui/devHook.ts`: one reader, `endMoveWarning()`, in `boardReaders` (§75), guarded by name like `rulesPanel`.
  - `src/ui/i18n/en.ts`, `fr.ts`: 5 new messages each; the six `resolvePending*` lines reworded.
  - `e2e/helpers.ts`: the `endPhase(page)` helper.
  - The 6 e2e specs with End-phase clicks.
  - `e2e/dev-hook-members.spec.ts`: one new member.
  - `README.md`.
- **New modules:**
  - `src/engine/unmoved.ts`: decides which units have not moved this phase (`hasNotMoved`, B1) and which of the active player's units the warning flags (`unmovedUnits`, B2).
  - `src/ui/cameraFraming.ts`: the map camera's zoom limits and the pure math that frames a world box in the viewport with the least change (B6).
  - `src/ui/endMoveWarningLayout.ts`: the pure parts of the warning's presentation: when it is due (B3, B12), where the prompt sits in the side panel (B8), and the mark's size and colour (B7).
  - `src/ui/endMoveWarning.ts`: the Phaser warning. It draws the prompt and the marks, saves, frames and restores the camera, keeps the per-seat switch, and answers Escape and Enter.
  - Tests: `src/engine/unmoved.test.ts`, `src/ui/cameraFraming.test.ts`, `src/ui/endMoveWarningLayout.test.ts`, `e2e/end-move-warning.spec.ts`.
- **Why there:**
  - **The engine fact (principles 1, 5, 6).** "Has not moved" and "could act" are rule facts. They come from `movementLeft` and `legalActions`, so they live in the engine, pure and tested, and §82 reuses them. That is why the module is `unmoved.ts` and not part of `actions.ts` (488 lines, near the limit).
  - **Pure UI (principle 15).** The framing and layout math is display logic with no rule in it, so it goes in pure `src/ui` modules with unit tests (the `rulesPanelLayout.ts`/`boardPrompts.ts` precedent).
  - **The zoom limits (principle 6).** They get one home, `cameraFraming.ts`. Both the wheel (`MapView`) and the framing read them there, and a Phaser-free test can import them.
  - **Drawing and input in `src/ui`.** These are Phaser, so they go in a `src/ui` module and not in the 3172-line scene (principle 12). The scene keeps only the wiring it alone can do: its private `decisionPending`, `log`, `deselectMovement`, the attacked and rammed sets, and the `commitEndPhase`/`maybeStartAiTurn` pair.
  - **The human check.** The module reads the active seat's control as `!isAiSeat(seatControlFor(seat))`. That is the same source `buildSeatAgents` uses (`:601`, `seatControl.ts:71-75`), so the scene needs no extra argument.
  - **Dependencies.** All point down: scene → ui → engine → data.
  - **Principles 7, 10 and 11.** No `GameState` change, no new action, no save change, no undo change.
- **Budget lines:**

- budget: src/scenes/BoardScene.ts +10: the End-phase warning hook (spec Non-functional, at most +10): import +1, field with doc +2, reset in resetSceneState +1, construction in create +1, endPhase's confirm closure and open call +5; everything else lives in src/ui/endMoveWarning.ts

No other file passes 500 lines, so no other budget line is needed.

## Subtasks

Each subtask ends with `npm run verify` green and a commit. Run heavy
commands one at a time (memory): never `verify` and `e2e` together.

1. **Engine fact: `src/engine/unmoved.ts` + `unmoved.test.ts` (B1, B2, I1, I2; AC1, AC2).**
   - `hasNotMoved(unit: Unit): boolean` is
     `!unit.destroyed && unit.movementLeft === unitType(unit).movement`.
     - The doc comment records I1: full allowance means "not moved at all";
       `charged` adds nothing; a rotate-only ship has moved; an undone move
       restores it.
     - It cites `evaluateCharge`'s identical test (`movement.ts:372`).
   - `unmovedUnits(state: GameState, context: ActionContext): Unit[]`:
     - returns `[]` unless `state.phase === 'movement'`;
     - otherwise collects the ids named by `legalActions(state, context)`:
       the `unitId` of `landMove`/`landSwap`/`navalMove`/`navalRotate`/`ram`,
       and the `otherId` of `landSwap`;
     - returns the active owner's living units that pass `hasNotMoved` and
       are in that set, in `state.units` order.

     The doc comment records I2: a unit with no legal action is not
     flagged, and a swap counts for both units.
   - No other engine file changes.
2. **Pure framing: `src/ui/cameraFraming.ts` + test (B6, I3; AC3).**
   - Exports:
     - `MIN_ZOOM = 0.4`, `MAX_ZOOM = 2.5`, `FRAME_MARGIN = 24`;
     - `boxAround(points, grow)`: the bounding box of world points, grown
       by `grow` on every side (callers pass `HEX_SIZE`);
     - `frameBox(box, current: { zoom, centerX, centerY }, viewport: { width, height })`,
       which returns the new `{ zoom, centerX, centerY }`.
   - `frameBox`, in order:
     1. If the box lies inside the usable view at the current camera, it
        returns `current` unchanged.
     2. Else, if the box fits the usable view at the current zoom, it pans
        to the box centre and keeps the zoom.
     3. Else the zoom becomes
        `max(MIN_ZOOM, min((w − 2m)/boxW, (h − 2m)/boxH))`, never above
        `current.zoom`, centred on the box.
   - The usable view is `(viewport − 2·FRAME_MARGIN) / zoom` in world units.
   - `MapView.enableZoom` drops its two local constants and imports these.
     This is the only `MapView` change in this commit, and the wheel
     behaviour is unchanged.
   - The doc comment records I3.
3. **Pure layout: `src/ui/endMoveWarningLayout.ts` + test (B3, B7, B8, B12; AC4).**
   - `endMoveWarningRect(log: LogBounds): Rect`:
     - `left`/`width` are the log's own;
     - `top` is the log's top;
     - the height is `PROMPT_HEIGHT` (about 150, tuned at the live check),
       capped at the log's height.

     So the newest log lines stay visible below the prompt.
   - `warningDue({ human, switchedOff, flaggedCount }): boolean`, true
     exactly when `human && !switchedOff && flaggedCount > 0`. The phase is
     already folded into `unmovedUnits`, which is empty outside movement.
   - `MARK = { width: 14, height: 10, outline: 2, fill: 0xe040fb, line: 0x111111, depth: 14 }`.
     Depth 14 is above units (10) and labels (13) in both views, and below
     the tooltip (35). These are screen pixels. The drawing divides by the
     framed zoom (B7).
4. **The Phaser warning: `src/ui/endMoveWarning.ts`, `MapView` additions, i18n (B6-B15).**
   - **`MapView`** gets four members:
     - `cameraView(): { zoom, scrollX, scrollY }`;
     - `setCameraView(v)`: `setZoom` then `setScroll`;
     - `frameWorldBox(box)`: reads `current` from `zoom` and `scroll + width/2`, calls `frameBox`, then `setZoom` and `centerOn`;
     - `keepOffHud(objects)`: `this.uiCamera?.ignore(objects)`.
   - **The constructor.** `class EndMoveWarning` is built as
     `new EndMoveWarning(scene, mapView, setPending: (on) => void, log: (text) => void)`.
     It registers `onKeyOnce(scene.input.keyboard, 'keydown-ESC', …)`
     (Cancel) and `'keydown-ENTER'` (confirm). Both are no-ops while
     closed, registered once per `create()` as the scene's own keys are
     (`:828-830`).
   - **`open(state, context, onConfirm, onOpen): boolean`:**
     - the seat is `state.seatOrder[state.activePlayerIndex]`;
     - flagged = `unmovedUnits(state, context)`;
     - if `!warningDue(...)` it returns false and does nothing else;
     - otherwise it calls `onOpen()` (the scene's `deselectMovement`, B3)
       and `setPending(true)`;
     - it saves `mapView.cameraView()`, then frames
       `boxAround(flagged.map(u => mapView.toScreen(u.position)), HEX_SIZE)`;
     - it draws the marks: one `Graphics`, a rect per flagged unit at its
       `toScreen` centre, sized `MARK / zoom`, then `mapView.keepOffHud`;
     - it builds the prompt in `endMoveWarningRect(logPanelBounds(height, SIDE_PANEL_WIDTH))`,
       registered with `mapView.excludeFromMainCamera`;
     - it returns true.
   - **The prompt** (depth 31-32, above the log's 29, no backdrop):
     - a background rectangle, `setInteractive()` so a click on it never
       reaches the log scrollbar beneath;
     - the two-line message, word-wrapped to the rect width;
     - the tick box (a `Text`, `board.warnOff(checked)`, toggled on click);
     - **End phase anyway** and **Cancel** buttons, as `Text` objects so
       `buttonToCanvas` finds them.
   - **`close(confirmed)`**, used by both buttons and both keys:
     - in a `try`/`finally`, it destroys the prompt and marks, restores the
       saved camera, and, if ticked, adds the seat to `switchedOff` and
       logs `log.endMoveWarningOff(player name)`;
     - `setPending(false)` runs in the `finally`;
     - after the `finally`, if confirmed, it calls `onConfirm()`.

     The order (restore and log, then end) gives B11's "camera ends where a
     plain End phase would have left it". The switch-off line lands under
     the current player's heading.
   - **`reset()`.** It destroys any prompt or marks (Phaser's `destroy` is a
     no-op on an already destroyed object), empties `switchedOff` and
     clears the open state. It never touches the camera, since it runs on
     a fresh or reloaded board.
   - **`snapshot()`** returns
     `{ open, flagged: string[], marked: string[], switchedOff: number[] }`
     for the dev hook.
   - **The doc comment records I5.** The switch is per seat, in memory
     only, and reset by `resetSceneState`.
   - **i18n**, in `en.ts` and `fr.ts` (spec B9 and B12 wording, `’` as
     written there). In `board`:
     - `unmovedCount(n)`, with the 1 / more forms;
     - `unmovedQuestion`;
     - `endPhaseAnyway`;
     - `warnOff(checked)`, `☒`/`☐` + `Don't warn me again this game` /
       `Ne plus m’avertir pendant cette partie`.

     In `log`, `endMoveWarningOff(player)`. Cancel reuses `common.cancel`.
   - **The six `resolvePending*` lines are reworded (B13):**
     - en: "Resolve the pending choice before saving or loading." / "…before ending the game." / "…before undoing." / "…before redoing." / "…before starting a new attack." / "…before ending the phase.";
     - fr: "Résolvez d’abord le choix en attente avant de sauvegarder ou de charger." / "…avant de terminer la partie." / "…avant d’annuler." / "…avant de rétablir." / "…avant une nouvelle attaque." / "…avant de terminer la phase.".
   - Add the message unit tests (AC16) to `messages.test.ts`.
   - Nothing calls the module yet, so `verify` stays green with behaviour unchanged.
5. **The scene hook: `BoardScene.ts`, exactly +10 lines (B3, B4, B13).**
   - **Import (+1).** After `:91`:
     `import { EndMoveWarning } from '../ui/endMoveWarning';`.
   - **Field (+2).** After `:422`:
     `/** §83: the End-phase warning; while open it holds decisionPending, so every pending-choice guard covers it. */`
     then `private endMoveWarning!: EndMoveWarning;`.
   - **Reset (+1).** In `resetSceneState`, after `:577`:
     `this.endMoveWarning?.reset();`.
   - **Construction (+1).** In `create`, after `:859`:
     `this.endMoveWarning = new EndMoveWarning(this, this.mapView, (on) => (this.decisionPending = on), (text) => this.log(text));`.
   - **`endPhase` (+5).** The four lines `:2923-2926` become nine:
     - a `const end = (): void => { … };` whose body holds
       `commitEndPhase()`, the existing two comment lines unchanged, and
       `maybeStartAiTurn()`;
     - `// §83 B3: a human seat's movement phase with units that could still move asks first.`;
     - `const context = { attackedThisPhase: this.attackedThisPhase, rammedThisTurn: this.rammedThisTurn };`;
     - `if (!this.endMoveWarning.open(this.state(), context, end, () => this.deselectMovement())) end();`.
   - `commitEndPhase` and the AI's `case 'endPhase'` (`:3080-3081`) are untouched (B4).
   - Raise the ceiling with `npm run size:baseline -- --write` (3172 →
     3182). If the measured growth differs from +10, stop and amend this
     plan. Never write a higher number than measured.
6. **Dev hook reader (AC5-AC12 support).**
   - In `devHook.ts`:
     - add `endMoveWarning(): { open: boolean; flagged: string[]; marked: string[]; switchedOff: number[] }`
       to `DevHook`, with a doc line;
     - add `WARNING_MEMBERS = ['endMoveWarning'] as const`, guarded like
       `RULES_MEMBERS`;
     - add an `endMoveWarningSnapshot(scene)` function;
     - add the reader to `boardReaders`'s `Pick` and return object.
   - Add `'endMoveWarning'` to `MEMBERS` in `e2e/dev-hook-members.spec.ts`,
     between `'displayListSorted'` and `'hexToCanvas'`.
   - Read-only. It never opens or answers the warning.
7. **e2e: the shared helper and the existing scenarios (AC15).**
   - In `e2e/helpers.ts`, add `endPhase(page)`:
     1. `clickButton(page, 'End phase')`;
     2. `frames(page)`;
     3. if `endMoveWarning().open`, `clickButton(page, 'End phase anyway')`.

     It is a no-op in the combat phase and when nothing is flagged.
   - Replace all 10 `clickButton(page, 'End phase')` calls listed under
     Verified with `endPhase(page)`, and leave each caller's
     `waitIdle`/`settle` as it is.
8. **e2e: `e2e/end-move-warning.spec.ts` (AC5-AC13).**
   - Start from `MENU_TEST`, seed 1. Move one unit, and record
     `cameraZoom()`/`cameraScroll()`.
   - Click End phase and wait two frames. Then (AC5):
     - the phase is still `movement` and the reader is open;
     - the flagged ids equal `unmovedUnits(stateCopy, {})`, computed in the
       test by importing `src/engine/unmoved`. The context is empty because
       no attack or ram happened in this scenario; the test asserts that
       first;
     - `marked` equals `flagged`;
     - every flagged `hexToCanvas` is non-null;
     - the zoom is in `[0.4, before]`;
     - `hudStrays().strays` is empty.
   - Then:
     - **AC6.** Cancel. The reader is closed with no marks, the zoom and
       scroll equal the saved values, the phase is `movement`, and Ctrl+Z
       puts the moved unit back.
     - **AC12.** Before Cancel, while open, Ctrl+Z logs "Resolve the
       pending choice before undoing." and leaves `state()` deep-equal. A
       click on an own unit's hex leaves `selectedUnitId()` null.
     - **AC7.** Escape on a reopened warning acts as Cancel. Enter on a
       reopened one gives phase `combat`.
     - **AC8.** A separate test confirms with the button. The phase is
       `combat`, the reader is closed, Undo logs "Nothing to undo.", and
       the camera equals the pre-click values.
     - **AC9.** Tick the box and confirm. The log has the switch-off line.
       End the combat phase. Player 2's movement End phase warns (confirm
       it). Then on to player 1's next movement phase, where End phase goes
       straight to `combat`.
     - **AC10.** Save to a slot at the start (the `save-load.spec.ts`
       helpers). Tick and confirm, then load that slot in-game. End phase
       warns again.
     - **AC11.** Open Tables on the terrain tab, then open the warning.
       After two frames `rulesPanel().open` is false. Cancel, and it is open
       on the same tab.
     - **AC13.** End phase in the combat phase ends it with no warning (in
       AC8's test). The switched-off seat is covered by AC9.
   - Each test ends with `expect(errors).toEqual([])`.
9. **README.**
   - Add `### Ending the movement phase with units unmoved` after "The view
     at the start of a turn" (`:524`). It covers what is flagged, the
     framing, the marks, the two buttons and the keys, the per-seat
     switch-off, and its reset on load and new game.
   - At `:243-245`, add the open warning to the choices undo waits on.
   - No "Known simplifications" change.

## Tests

| Behaviour | Test that fails if it is mutated |
| --- | --- |
| B1 `===` full allowance (not `>=`, not `charged`) | `unmoved.test.ts`. A fresh unit is true. After a land move, a swap (both units), a charge, one ship rotation, a naval move and a ram, it is false. After `structuredClone` before a move, then restored, it is true. |
| B1 destroyed excluded | `unmoved.test.ts`: a destroyed unit with full `movementLeft` is false |
| B2 legal-action filter | A unit with full allowance that is boxed in is left out. The test first asserts it is boxed in: `legalActions` names it in no action. The position uses enemy ZOC and `swapStep`'s start-in-ZOC rule on the plain row. |
| B2 `otherId` branch | A higher-id unit whose only appearance in `legalActions` is as a `landSwap`'s `otherId` (asserted first) is flagged. Dropping the `otherId` branch fails it. |
| B2 ships | An unmoved ship at `SEA_CENTER` (`actions.test.ts:14`) is flagged. Dropping `navalRotate`/`navalMove` from the id collection fails it. |
| B2 owner and phase | The other player's unmoved units are absent. The same state in `combat` gives `[]`, so removing the phase check fails. |
| B6.3 unchanged | `cameraFraming.test.ts`: a box inside the usable view returns `current` by value |
| B6.4 pan | A box that fits but is off-centre keeps the zoom, at the box centre |
| B6.5 exact fit zoom | A wide box gives `(w−48)/boxW` exactly. A tall box gives the height ratio. |
| B6.6 never zoom in | One far unit at zoom 0.6 gives a pan at 0.6, never above |
| B6.7 floor | A box too big for 0.4 gives exactly 0.4, centred |
| B6 margin and growth | `boxAround` grows by exactly `grow`. A box 1 px inside the margin counts as visible, and 1 px over does not. |
| B6 one definition | The test imports `MIN_ZOOM`/`MAX_ZOOM` from `cameraFraming`. `MapView` has no local copies (review grep). |
| B8 placement (AC4) | `endMoveWarningLayout.test.ts`: the rect lies inside `logPanelBounds(750, 300)`, and `left + width ≤ 300` |
| B3/B12 trigger | `warningDue` is false when each of the three conditions fails alone, and true when all hold |
| B7 constants | The test pins `MARK` (14 × 10, 2 px, `0xe040fb`, depth 14), so a change is a visible diff. The look is the live check. |
| B9/B12/B13 text (AC16) | `messages.test.ts`: `unmovedCount(1)` and `(3)` in en and fr, exact strings. `warnOff(true/false)` glyphs. The six reworded lines contain "choice" / "choix" and no longer "retreat" / "retraite". |
| B3, B6, B7 wiring (AC5) | e2e, with the engine oracle, not the reader against itself |
| B10 Cancel (AC6) | e2e: camera equality, phase, and a working Ctrl+Z |
| B15 keys (AC7) | e2e Escape and Enter |
| B11 confirm (AC8) | e2e: phase, an empty undo, and the camera |
| B12 per seat (AC9, AC10) | e2e |
| B13 guards (AC11, AC12) | e2e. A lost guard (§73 risk) fails here. |
| AC13 no warning | e2e for combat and switched-off. The engine `[]` covers an empty list, and the live check covers a fully moved army. |
| B14 Save/Load open | No code: the Save/Load panel's backdrop already swallows the End phase click. Checked at review, and the warning cannot open under it. |
| AC14 computer seats | Review grep: the hook is in `endPhase` only. `commitEndPhase` and `:3080-3081` are untouched. Plus the live check. |
| AC15 existing scenarios | `npm run e2e`, all green through `endPhase(page)` |
| AC17 the look | The live check |

There is no failing-first test, because this is a feature. Each AC above
must fail against `main` (no reader, no module), which `npm run e2e` on
the branch before subtask 5 would show. Running it is optional.

## Validation

Run one at a time:

- `npm run verify` green after every subtask. The lint count stays ≤ 19,
  and `--max-warnings` is untouched.
- `npm run check:intent` PASS. The size budget passes with
  `src/scenes/BoardScene.ts` at its new measured ceiling (≤ 3182) and the
  budget line above.
- `npm run e2e`, once, after subtask 8: the full suite, including the new
  spec and the 6 edited ones. Stop any dev server on 5232 first.
- **Live check, owed** (new and visual; `src/scenes/**` and `src/ui/**`,
  REVIEW-POLICY rule 1). The owner runs `npm run dev` (or the worktree's
  port).
  1. **Basic warning.** Menu → "Test mode (2 players, armies ready)". Move
     one unit and click End phase. See:
     - the camera frames the unmoved units, zooming out only if needed;
     - a magenta rectangle sits on each unmoved unit;
     - the prompt in the side panel over the top of the log, in English;
     - the newest log lines still visible below it.
  2. **Drawn view.** Toggle the Drawn view while it is open. The marks
     stay, on top of the figures.
  3. **Cancel.** The camera returns and the marks go. Ctrl+Z still undoes
     the move.
  4. **Escape and Enter.** Reopen and press Escape (Cancel). Reopen and
     press Enter: the phase ends.
  5. **French.** Switch to French and repeat step 1. The prompt text fits
     the panel.
  6. **Switch-off.** Tick the box and confirm. Player 2 is still warned,
     and player 1 is not on their next turn.
  7. **Fully moved army.** Move every unit that can move, or wait until
     only boxed-in ones remain. End phase goes straight to combat (AC13).
  8. **Computer seat.** Start a game with a computer seat. Its movement
     phases run with no warning and no stall (AC14).
  9. **Tuning.** Judge the mark's size and colour and the prompt's height.
     A tuning is recorded in Progress (B7).

## Assumptions I made

These go beyond the spec. Each one is a decision, not an open question.

- **Four modules, not two.** The spec names one pure framing/layout module.
  This plan splits it in two:
  - `cameraFraming.ts` is generic camera math, and also the zoom limits'
    one home, which `MapView` imports;
  - `endMoveWarningLayout.ts` holds what is the warning's own.

  Each has a one-sentence job.
- **`warningDue` is pure and tested** (principle 15). The spec left the
  trigger in the presentation.
- **The human check reads `seatControlFor` and `isAiSeat` in the module**,
  not the scene's `seatAgents`. Both come from `session.seatControls`
  (`:601`, `seatControl.ts:71-75`), so they agree, and the scene saves the
  argument.
- **Escape and Enter are registered by the module's constructor**, once per
  `create()`, and are no-ops while closed. The scene's own Escape handler
  stays. It is harmless while the panel is suppressed.
- **The prompt is top-anchored in the log rectangle and about 150 px tall**,
  so the newest log lines, including a guard's "pending choice" line (B13),
  stay readable below it. The prompt's background is interactive, so it
  swallows clicks.
- **Mark depth 14**: above units and labels in both views, below the
  tooltip. The marks are one `Graphics` owned by the module, so a view
  switch never touches them (B7).
- **Close order:** restore the camera and log the switch-off line first,
  clear `decisionPending` (in a `finally`), then run the confirm callback.
  So the line sits under the ending player's heading, and `autosave`
  inside `commitEndPhase` is not refused.
- **The e2e oracle passes an empty `ActionContext`.** In the scenario no
  unit has attacked or rammed, which the test asserts, so the empty
  context equals the scene's.
- **All 10 e2e End-phase clicks use the helper.** That includes the
  combat-phase one at `view-centre.spec.ts:53`, so no scenario has to know
  which phase it is in.
- **README:** a new subsection, plus one clause in "Undo and redo".
- **No `blocked_by`.** §73, §81 and §82 are coordinated by rebase (Risks),
  not blocked on. Whoever lands second adapts.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-24 — implementation (subtasks 1-9)

Commits: `aeb0871` (engine), `bb630dc` (module, framing, layout, i18n, scene hook, dev hook, e2e), the README commit, and the final e2e/progress commit.

Shipped as planned: `src/engine/unmoved.ts` (`hasNotMoved`, `unmovedUnits`), `src/ui/cameraFraming.ts`, `src/ui/endMoveWarningLayout.ts`, `src/ui/endMoveWarning.ts`, `MapView` additions (`cameraView`, `setCameraView`, `frameWorldBox`, `keepOffHud`; 496 lines, under 500), the dev hook reader `endMoveWarning()`, the `endPhase(page)` e2e helper (all End-phase clicks now use it, 12 sites in 7 specs, not the plan's 10, since `score-panel.spec.ts` gained 3 since the plan), `e2e/end-move-warning.spec.ts` (6 tests), README section, and 5 + 1 messages in en/fr.

Results: `npm run verify` green: 106 test files, 1775 passed | 2 skipped; lint 18 warnings, cap 18 (unchanged, no new warning). `npm run check:intent`: `type-check: PASS (intent 83, feature)`. `BoardScene.ts` grew exactly +10 (3169 to 3179), `scripts/size-baseline.json` rewritten to 3179. `npm run e2e`: 51 passed, 1 failed (`placement.spec.ts` "Turn buttons", a 30 s timeout while other worktrees ran; it passed alone, 1 passed). The full suite was run before the last spec tweak; the changed spec passes in its own run.

Deviations from the plan:
- The lint cap is 18 and the baseline 3169 on today's main (plan said 19 and 3172); the +10 budget line is unchanged and true.
- AC2 swap-only unit: the plan's "swap-only" position is impossible with enemy ZOC (the swap start-in-ZOC rule forbids it), so the `otherId` test rings the unit with friendly lower-id units plus an outer ring of enemies; it first asserts every action naming the unit is a `landSwap` with it as `otherId`.
- The module also resets itself on the scene's `shutdown` event, so a stale instance's Escape/Enter listeners cannot act after a scene restart (the keys are registered on a keyboard that outlives the scene).
- The e2e state comparison strips `elapsedMs` (the clock ticks).
- The tick-box click is by its label text `☐ Don't warn me again this game`.

Mutants: dropping the `otherId` branch of `unmovedUnits` is killed by `unmoved.test.ts`. Replacing `Math.min(fit, current.zoom)` with `fit` in `frameBox` survives, and is an equivalent mutant: the zoom-out branch is reached only when the box does not fit at the current zoom, so `fit < current.zoom` always. The clamp is kept as a defensive guard for B6.6.

Not run: the live check (owed; mark size, colour and prompt height at `PROMPT_HEIGHT = 150` are untuned).

### 2026-11-25 - round 1 rework

Fixed the five "Needs rework" findings (tests, plus one small reader change):
- **M3:** `end-move-warning.spec.ts` now asserts the framed zoom is strictly below the zoom before.
- **M2:** a new e2e test zooms to about 0.97 on the close-combat position, centres one hex off the flagged row's middle, and asserts the camera is unchanged after End phase (every flagged unit already in view).
- **E13:** `EndMoveWarning` keeps `markedIds`, pushed inside the draw loop of `drawMarks`; `snapshot().marked` reports it, so `marked == flagged` proves each mark.
- **E1:** the e2e selects an own unit (asserts `selectedUnitId()` non-null), clicks End phase, and asserts it is null once the warning is open.
- **C5/C8:** the "1 px inside the margin" unit test asserts identity (`toBe(cur)`).
No behaviour changed. The optional LOW items were left alone.

Mutants (backup and restore by copy), each killed:
- C5 `box.left >=` to `>`: `cameraFraming.test.ts` "treats a box 1 px inside the margin ...".
- C8 `box.right <=` to `<`: the same test.
- M3 remove `cam.setZoom(next.zoom)`: e2e test 1 (zoom strictly below).
- M2 centre = `cam.scrollX`/`cam.scrollY`: e2e "the camera stays put when every flagged unit is already in view". My first version (zoomed far out, then centred on the box centre) let M2 survive, so the test zooms in and centres off the box centre.
- E13 `centres.slice(0, 1).forEach`: e2e test 1 (`marked` equals `flagged`).
- E1 `onOpen` made a no-op: e2e test 1 (selection null once open).

Results: `npm run verify` green (106 files, 1775 passed | 2 skipped; lint 18 warnings, cap 18). `npm run check:intent`: `type-check: FAIL ... A live check is owed and not recorded` (the owner's gate, not recorded by me; no other error). `npm run e2e`: 52 passed, 1 failed (`placement.spec.ts` "Turn buttons", the same 30 s timeout as round 0 when run in the full suite; passes alone).
