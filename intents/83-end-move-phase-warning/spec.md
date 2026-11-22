<!-- generated-by: heraklios/spec@0.1.0 -->
# §83 spec — Ending the movement phase with unmoved units shows them and asks to confirm

Accepted intent: [intent.md](intent.md)

Written against `main` at `c822f4b`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/02-rules-transcription.md:85-86` | "During the Movement phase, each player may move any or all of their units, each up to its own movement allowance." Leaving units unmoved is legal; the warning only asks, never forbids |
| `docs/research/05-rules-french-original.md:120-122` | "chaque joueur déplace autant d'unités qu'il le désire, dans la limite des points de mouvements attribués à chacune des unités." Same reading |
| intent, "The owner's answers (2026-11-22)" | 1 "just enough to frame the unmoved units … Not the whole board"; 2 "a coloured rectangle drawn in the centre of each unmoved unit"; 3 "Only units that have not moved at all"; 4 "Ships: included"; 5 "A player can switch the warning off for the rest of the game" |
| intent, Outcome | "A unit counts as unmoved only if it could have moved. A unit with no legal move is not flagged." |
| `README.md` "Known simplifications" | none removed |
| `src/scenes/BoardScene.ts:628-639` | the End phase button: `endBtn.on('pointerdown', () => this.endPhase());` (`:639`) |
| `src/scenes/BoardScene.ts:2909-2926` (`endPhase`) | the click path: refuses during `aiRunning` (`:2910`) and while `retreatChoice \|\| driftState \|\| decisionPending` (`:2919`), then `this.commitEndPhase();` (`:2923`) and `this.maybeStartAiTurn();` (`:2926`) |
| `src/scenes/BoardScene.ts:2933-2965` (`commitEndPhase`) | `this.deselectMovement()` (`:2934`), `this.history.clear()` (`:2938`), `applyAction(state, endAction)`, `this.attackedThisPhase.clear()` (`:2944`); on a new movement phase `centreOnActivePlayer()` (`:2958`) and `autosave()` (`:2961`) |
| `src/scenes/BoardScene.ts:3079-3081` | an AI seat's `endPhase` action calls `this.commitEndPhase()` directly, never `endPhase` |
| `src/scenes/BoardScene.ts:1084-1162` (`confirmAbandon`, `confirmEndGame`) | today's confirms go through `showConfirmDialog` with `excludeFromMainCamera` |
| `src/ui/confirmDialog.ts:87` | that dialog's backdrop is `.rectangle(0, 0, width, height, 0x000000, 0.6)` over the whole canvas, so the map behind it is darkened: unfit for a prompt whose point is to show the board |
| `src/scenes/BoardScene.ts:385-400` (`decisionPending` doc) | the flag that gates "undo, autosave, save/load, `onHexClick`, ending the phase, starting a new attack" |
| `src/scenes/BoardScene.ts:1446-1448` (`update`) | `this.rulesPanel?.setSuppressed(this.decisionPending);` each frame |
| `src/scenes/BoardScene.ts:1520` | `if (this.decisionPending \|\| this.aiRunning) return;` in `onHexClick` |
| `src/ui/rulesPanelState.ts` (`setSuppressed`, `shown`) | suppressed, the Tables panel is hidden and comes back "as it was, open or closed, on the same tab" |
| `src/scenes/BoardScene.ts:826-830` | `keydown-ESC` closes the Tables panel; `keydown-ENTER` and `keydown-SPACE` call `resolveDriftContinue`, a no-op with no drift pending (`:251-257`) |
| `src/scenes/BoardScene.ts:560-591`, `:988-990` | `resetSceneState` runs at every `create()` (new game, Menu load, after Abandon) and at `loadInPlace` |
| `src/ui/MapView.ts:248-268` | wheel zoom: `const MIN_ZOOM = 0.4; const MAX_ZOOM = 2.5;` (`:250-251`), local to `enableZoom` |
| `src/ui/MapView.ts:130-143` | camera bounds = the board's pixel box plus `boundsPadding = 200` (`:133`); main camera viewport `setViewport(leftPanelWidth, 0, availableWidth, viewportHeight)` (`:142`) |
| `src/ui/MapView.ts:452-460` | `centerOn(hex)`, `centerOnPoint(point)`: "the camera's bounds clamp it" |
| `src/main.ts:11-12`, `src/ui/rulesPanelLayout.ts:11` | canvas 1100 × 750; side panel 300, so the map viewport is 800 × 750 |
| `src/ui/hexRender.ts:4`, `:7-10` | `HEX_SIZE = 22`; flat-top `hexToPixel`. The board's hex centres span 1386 × 1124 px (measured from `MAP_TERRAIN` at `c822f4b`), so the whole board fits the 800 × 750 viewport at zoom ≈ 0.55, above `MIN_ZOOM` |
| `src/ui/logHistory.ts:97-99`, `:108-110` | the log panel: `LOG_TOP = 178`, bottom `height - 240` = 510, left 16, width 268 |
| `src/engine/state.ts:22-23`, `:31-40` | `movementLeft`: "Movement points remaining in the current Movement phase"; `charged`: set only by a move that "spent its ENTIRE movement allowance" |
| `src/engine/turnManager.ts:153-160` | each movement phase starts with `u.movementLeft = unitType(u).movement; u.charged = false;` for the active owner |
| `src/engine/actions.ts:190-192`, `:207-211`, `:328`, `:337`, `:349`, `:367` | every movement-phase action lowers `movementLeft`: land move `-= cost`, swap `-= step.costA` / `costB`, naval move `-= contact.cost` / `dest.cost`, rotate `-= 1`, ram `= 0` |
| `src/data/terrain.ts:47-85`, `src/engine/movement.ts:202-216` | every terrain `moveCost` is 1, 2 or 3, so any move or swap costs at least 1 point |
| `src/engine/movement.ts:369-374` (`evaluateCharge`) | `if (unit.movementLeft !== fullAllowance) return null;` with `fullAllowance = getUnitType(unit.typeId).movement`: the engine's own "has not moved yet" test |
| `src/engine/actions.ts:408-411`, `:442-488` (`legalActions`) | movement phase, per own living unit: `navalMove`, `navalRotate` (if `movementLeft >= 1`), `ram`, `landMove`, `landSwap` (`unitId`/`otherId`, each pair once); a naval unit in `rammedThisTurn` is skipped |
| `src/scenes/BoardScene.ts:3029-3032` | the scene builds the context as `{ attackedThisPhase: this.attackedThisPhase, rammedThisTurn: this.rammedThisTurn }` |
| `src/ui/devHook.ts:32`, `:240-290`, `:292-331` | `BUSY_FIELDS` includes `decisionPending`; readers `cameraZoom`, `cameraScroll`, `hexToCanvas`, `rulesPanel`, `logEntries` exist |
| `e2e/*.spec.ts` | `clickButton(page, 'End phase')` in a movement phase with unmoved units: `attack-log.spec.ts:33`, `attacks.spec.ts:54`, `message-log.spec.ts:102`, `:132`, `:144`, `rules-panel.spec.ts:90`, `undo-shortcuts.spec.ts:51`, `view-centre.spec.ts:50` |
| `scripts/size-baseline.json:6` | `"src/scenes/BoardScene.ts": 3172`, its line count today |
| `intents/82-unit-status-markers/intent.md` | §82's "not moved: full movement left" marker is the same fact (B1 below) |
| `intents/73-boardscene-on-session/plan.md:111-121` | §73 folds the refusal guards (`endPhase` `:2919` among them) into one `pending()` helper |

## Behaviour

### The engine fact

**B1 — Not moved.** A unit *has not moved* this phase when it is not
destroyed and its `movementLeft` equals its type's printed `movement`.
`charged` adds nothing: a charge spends the whole allowance, so a charged
unit already fails the test. A ship that only turned in place has spent a
point and has moved. A unit that moved away and back has moved. A move
that is undone restores `movementLeft`, so the unit is unmoved again.

**B2 — Flagged units.** In the movement phase, the units the warning flags
are the active player's units that have not moved (B1) **and** appear in
at least one action of `legalActions(state, context)`, with the scene's
`attackedThisPhase` and `rammedThisTurn` as the context:

- as the `unitId` of a `landMove`, `landSwap`, `navalMove`, `navalRotate`
  or `ram`;
- or as the `otherId` of a `landSwap`.

A unit with no legal action is not flagged. Land units and ships are
counted alike. Outside the movement phase the list is empty.

### When the warning appears

**B3 — The trigger.** A click on **End phase** opens the warning instead
of ending the phase when all of these hold:

- the click passes today's guards (`endPhase`'s `aiRunning` and pending-choice
  refusals run first, unchanged);
- the phase is `movement`;
- the active seat is human (it has no computer agent);
- the active seat has not switched the warning off (B12);
- B2's list is not empty.

Otherwise End phase behaves exactly as today. Opening the warning clears
the current movement selection and its highlights, as ending the phase
would. It changes nothing in `GameState` and pushes nothing on the undo
history.

**B4 — Computer seats.** A computer seat is never warned. Its `endPhase`
goes through `commitEndPhase` directly (`BoardScene.ts:3081`), which the
warning does not touch.

**B5 — The combat phase.** End phase in the combat phase is unchanged:
no warning, whatever units have not attacked.

### What the warning shows

**B6 — Framing.** When the warning opens, the camera moves just enough
for every flagged unit to be on screen. All sizes are in the main camera's
viewport (the map area right of the side panel, 800 × 750 at today's
canvas):

1. **The box.** Take the bounding box of the flagged units' hex centres in
   world pixels, grown by one `HEX_SIZE` on every side, so each whole
   counter is inside it.
2. **The usable view.** The viewport less a 24-pixel screen margin on
   every side.
3. **Already visible.** If the box already lies inside the usable view at
   the current zoom and scroll, the camera does not move.
4. **Pan only.** Else, if the box fits the usable view at the current
   zoom, the camera centres on the box's centre and keeps its zoom.
5. **Zoom out.** Else the zoom becomes the largest value at which the box
   fits the usable view, `min(usableWidth / boxWidth, usableHeight / boxHeight)`,
   never below `MIN_ZOOM` (0.4), and the camera centres on the box's
   centre.
6. **Never zoom in.** The framing never raises the zoom: one unit far
   away gets a pan, not a close-up.
7. **When the box cannot fit.** If the box does not fit even at
   `MIN_ZOOM`, the zoom is `MIN_ZOOM` and the camera centres on the box's
   centre. At today's canvas this cannot happen (the whole board fits at
   ≈ 0.55), but the rule is defined and unit-tested.

The zoom limits are the same constants the mouse wheel uses, from one
definition. The camera's bounds then clamp the scroll, as for every
`centerOn` today. Since the box lies inside the board and the bounds
contain the board, the clamped view still contains the box.

**B7 — The marks.** Each flagged unit gets a coloured rectangle drawn at
the centre of its hex, on top of the unit:

- a filled magenta (`#e040fb`) rectangle with a 2-pixel near-black outline,
  a colour none of the four player colours (`hexRender.ts:89`) uses;
- 14 × 10 screen pixels at the zoom the framing chose; it scales with the
  map if the player zooms afterwards;
- in world space, so it pans and zooms with the board, and never on the
  fixed HUD camera;
- the same in the Standard and Drawn views. A view switch while the
  warning is open keeps the marks;
- the live check judges the look; the plan may tune size and colour,
  and records it if it does.

**B8 — The prompt.** The prompt is drawn in the side panel, over the top
of the log panel (inside `left 16, top 178, width 268, bottom 510`), so it
never covers the map viewport, the End phase button or the status line.
It holds, top to bottom:

- the message (B9);
- the switch-off box (B12);
- two buttons: **End phase anyway** and **Cancel**.

There is no darkened backdrop: the board stays fully visible. The log keeps
its entries underneath and shows again when the prompt closes.

**B9 — The message.** Two lines, `<n>` the number of flagged units:

| | English | French |
| --- | --- | --- |
| n = 1 | `1 unit has not moved yet.` | `1 unité n’a pas encore bougé.` |
| n > 1 | `<n> units have not moved yet.` | `<n> unités n’ont pas encore bougé.` |
| second line | `End the movement phase anyway?` | `Terminer quand même la phase de mouvement ?` |
| confirm button | `End phase anyway` | `Terminer quand même` |
| cancel button | `Cancel` (`en.ts:77`, `common.cancel`) | `Annuler` (`fr.ts:69`) |
| switch-off box | `Don't warn me again this game` | `Ne plus m’avertir pendant cette partie` |

French keeps the space before `?`, as in `fr.ts:181`.

### Answering it

**B10 — Cancel.** Cancel closes the prompt and:

- removes every mark;
- restores the camera's zoom and scroll to what they were when End phase
  was clicked, even if the player dragged or zoomed meanwhile;
- leaves the phase, the units and the undo/redo history as they were, so
  Ctrl+Z still undoes the last move;
- logs nothing.

**B11 — End phase anyway.** Closes the prompt, removes the marks, restores
the camera as Cancel does, then ends the phase exactly as today: history
cleared, `endPhase` applied, and the next computer seat started if there
is one. The camera ends where a plain End phase would have left it.

**B12 — "Don't warn me again this game".** A box in the prompt, unticked
when it opens, toggled by a click.

- **When it counts.** When the prompt closes with it ticked, by either
  button or key, the warning is switched off for the active seat.
- **The log.** One line confirms it:
  - en `End-phase warning off for <player> for the rest of this game.`
  - fr `Avertissement de fin de phase désactivé pour <player> jusqu’à la fin de la partie.`
- **Per seat.** It affects only that seat. The other human seats are
  still warned.
- **How long it lasts.** It stays off through undo, redo, phases and
  rounds. It is back on after a new game, a load (Menu or in-game
  Save/Load, autosave included) and an Abandon. It cannot be switched back
  on within the game.
- **Where it lives.** It is kept in memory only: not in `GameState`, not
  in the save file, not in `localStorage`.

**B13 — While the prompt is open.** The prompt is the pending decision:

- clicks on the board select nothing;
- End phase, Undo, Redo (buttons and Ctrl+Z/Y), Save/Load and End game
  do nothing but log their existing "resolve the pending … first" line. That
  line's wording changes from "the pending retreat/drift" to "the pending
  choice", in English and French. The old wording is already inexact for
  an advance or exchange choice;
- the Tables panel is hidden and comes back as it was (open or closed,
  same tab) when the prompt closes;
- map drag, wheel zoom, hover tooltips, the view toggle and the speed
  toggle still work;
- Abandon still works. It is the board's escape hatch (`BoardScene.ts:1074-1083`).
  If its dialog is cancelled, the warning is still open.

**B14 — Save/Load and the log.** The warning cannot open while the
Save/Load panel is open: that panel's backdrop swallows the End phase
click. The log is covered, not changed (B8).

**B15 — Keyboard.** While the prompt is open:

- **Escape** is Cancel. The Tables panel's own Escape-to-close does
  nothing then, because the panel is suppressed;
- **Enter** is End phase anyway. Enter's drift Continue is a no-op, since
  no drift can be pending in the movement phase;
- **Space** does nothing new.

With the prompt closed, the keys behave as today.

## Interpretations

**I1 — "Not moved at all" is "full allowance left" (B1).** The owner said
"units who have not moved at all", and answer 3 drops partly moved units.
`movementLeft === printed movement` is the engine's own test for the same
idea (`evaluateCharge`, `movement.ts:372`). Every movement-phase action
lowers `movementLeft` by at least 1 (Sources), so the test and "took no
movement action" agree. A ship that only rotated counts as moved: it
spent a movement point on a movement-phase action. Code comment at the
engine function.

**I2 — "Could have moved" comes from `legalActions` (B2).** The intent
sets that "a unit with no legal move is not flagged". The reasons:

- such a unit was not forgotten: there is nothing the player could do
  with it;
- flagging it would fire the warning every turn for a unit pinned in
  place, and teach players to click through it.

`legalActions` is the engine's single list of what the active player can
do, so the filter adds no rule of its own. A swap counts as a move for
both units, since `legalActions` lists it once under the lower id. Code
comment at the engine function.

**I3 — "Just enough to frame" (B6).** Answer 1 rules out the whole board.
"Just enough" is read as the least camera change: none if all the units
already show, a pan if they fit at the current zoom, else the smallest
zoom-out. It never zooms in. Code comment at the framing function.

**I4 — "In the centre of the unit" (B7).** The mark is drawn at the hex
centre, where both views draw the counter. It is drawn on top of the
counter and covers its middle while the prompt is open, which is the point.

**I5 — "Switch the warning off for the rest of the game" (B12).**

- **Per seat.** The box says "me", and in hotseat each seat is a
  different person.
- **Not in the save.** A save stores the game, not one player's taste in
  prompts. Adding a field would bump `SAVE_VERSION` for no rule.
- **Not in `localStorage`.** There is no game identity to key it by
  (`GameState` has none), and it would outlive the game.
- **Reset on load.** Memory tied to the board's scene state resets on
  every `resetSceneState`, which already marks "a different game, or this
  game resumed". So a player who switched it off and reloads is warned
  again.

Code comment where the switch is stored.

## Acceptance criteria

- **AC1 — Full allowance is unmoved; any spent point is moved (B1, I1).**
  A fresh unit, a unit after a land move, after a swap (both units), a
  charge, a ship after one rotation, after a naval move, after a ram, and
  a unit moved then restored by an undo-style copy of the state. *Proof:
  engine unit test (`src/engine/unmoved.test.ts`).*
- **AC2 — Only the active player's living units that can act are flagged
  (B2, I2).** Each of these is checked:
  - a unit with full allowance but no legal action (boxed in by enemy ZOC
    and terrain) is left out;
  - a unit whose only legal action is a swap is flagged;
  - an unmoved ship is flagged;
  - another player's units and destroyed units are left out;
  - the combat phase gives `[]`.

  *Proof: engine unit test, positions built like `movementCases.ts`.*
- **AC3 — Framing math (B6).** Each of these is pinned:
  - all units visible gives an unchanged camera;
  - a box that fits gives a pan with the zoom unchanged;
  - a box too big gives the exact fit zoom;
  - a box too big for 0.4 gives exactly 0.4, centred;
  - a single far unit never raises the zoom;
  - the 24-px margin and the one-`HEX_SIZE` growth are applied;
  - the limits are the wheel's constants.

  *Proof: pure framing-math unit test (`src/ui/…Framing.test.ts`), no
  Phaser.*
- **AC4 — The prompt sits in the side panel (B8).** Its rectangle lies
  inside the log panel's bounds, so it overlaps neither the map viewport
  (x ≥ 300) nor any side-panel button. *Proof: pure layout unit test,
  beside AC3.*
- **AC5 — Opening it (B3, B6, B7).** In "Test mode" (2 players, armies
  ready), the first player moves one unit, then clicks End phase. Then:
  - the phase is still `movement`;
  - the warning reader reports it open;
  - its flagged ids equal the engine function's list, read through the hook;
  - every flagged unit has a mark;
  - every flagged unit's `hexToCanvas` is inside the main viewport;
  - `cameraZoom()` is ≤ the zoom before and ≥ 0.4;
  - `hudStrays().strays` is empty.

  *Proof: e2e via readers (new `e2e/end-move-warning.spec.ts`).*
- **AC6 — Cancel (B10).** Continuing AC5, Cancel gives:
  - the reader closed with no marks;
  - `cameraZoom()` and `cameraScroll()` equal to the values before the
    click;
  - the phase is still `movement`;
  - Ctrl+Z puts the moved unit back.

  *Proof: e2e via readers.*
- **AC7 — Escape and Enter (B15).** Escape on an open warning acts as
  Cancel (as AC6). Enter on a reopened warning ends the phase (phase
  `combat`). *Proof: e2e via readers.*
- **AC8 — End phase anyway (B11).** Confirming gives:
  - phase `combat`;
  - the reader closed;
  - Undo has nothing to undo;
  - the camera back at the pre-click values.

  *Proof: e2e via readers.*
- **AC9 — Switch-off, per seat (B12).** Player 1 ticks the box and
  confirms. Then:
  - the log has the switch-off line;
  - player 2's movement-phase End phase still warns (confirm it);
  - on player 1's next movement phase, End phase goes straight to combat.

  *Proof: e2e via readers.*
- **AC10 — Switch-off resets on load (B12, I5).** After AC9's switch-off,
  an in-game load of an earlier save warns player 1 again. *Proof: e2e via
  readers. The Menu-load and new-game paths go through the same
  `resetSceneState`; checked at review.*
- **AC11 — Tables panel (B13).** With the Tables panel open on a tab,
  opening the warning hides it (`rulesPanel().open` false). Cancel brings
  it back open on the same tab. *Proof: e2e via readers.*
- **AC12 — Blocked controls (B13).** While the warning is open:
  - Ctrl+Z logs the reworded "pending choice" line and changes no state;
  - a board click selects nothing (`selectedUnitId()` null).

  *Proof: e2e via readers.*
- **AC13 — No warning when nothing is flagged (B3, B5).** These all end
  the phase at once:
  - End phase in the combat phase;
  - End phase for a seat with the warning off (AC9);
  - a movement phase whose flagged list is empty. The engine half is
    AC2's `[]`; the scene half is the same branch as the switched-off
    seat.

  *Proof: e2e via readers, plus the live check for a fully moved army.*
- **AC14 — Computer seats (B4).** A game with a computer seat plays its
  movement phases with no warning and no stall. *Proof: the live check (a
  game against a computer seat); and at review, that the hook sits in
  `endPhase` only, not `commitEndPhase`.*
- **AC15 — Existing e2e stay green.** Every scenario that clicks End phase
  in a movement phase (Sources, `e2e/*.spec.ts`) goes through one helper.
  The helper clicks End phase and confirms the warning if it opens.
  `npm run e2e` passes. *Proof: e2e suite.*
- **AC16 — Text (B9, B12, B13).** Every string is in `en.ts` and `fr.ts`,
  and the count form is right for 1 and for more. *Proof: unit test on the
  message functions (both languages), `noLiterals.test.ts`, the build.*
- **AC17 — The look (B7, B8).** Each of these is checked by eye:
  - the marks read clearly in the Standard and Drawn views, at the framed
    zoom;
  - the prompt fits the side panel in English and French;
  - nothing covers a flagged unit.

  *Proof: the live check.*

## Non-functional

- **Engine/presentation split.**
  - **Engine** (`src/engine/unmoved.ts`, the plan may rename):
    - `hasNotMoved(unit)` (B1), the fact §82 reuses;
    - `unmovedUnits(state, context)` (B2), built on `legalActions`.

    Pure and unit-tested.
  - **Framing and layout** (`src/ui/`): the pure framing math (B6) and the
    prompt rectangle (B8), with no Phaser import, unit-tested.
  - **Presentation** (`src/ui/`, Phaser):
    - the prompt;
    - the marks;
    - saving and restoring the camera;
    - the per-seat switch.
  - **`MapView`** exports its zoom limits and gives the camera save,
    restore and frame calls. It is 463 lines, under 500.
  - **`devHook.ts`** gets one reader, `endMoveWarning()`, through §75's
    groups. It returns: open or not, flagged ids, marked ids, seats
    switched off.
  - **`e2e/helpers.ts`** gets the End-phase helper (AC15).
- **`BoardScene.ts` size.** The scene is at its 3172-line ceiling. Its
  part is a hook in `endPhase`: where it calls `commitEndPhase(); maybeStartAiTurn();`,
  it calls the warning instead, with those two as the confirm callback.
  It also needs one reset in `resetSceneState`.
  - **The plan's job.** Aim for net-neutral. B13's "prompt is the pending
    decision" can come from setting the existing `decisionPending` while
    it is open, which brings every guard at no scene cost (Assumptions).
  - **If it must grow.** The plan names a budget line in
    `scripts/size-baseline.json` of at most +10 lines, with the reason.
- **Save format.** Unchanged. No `GameState` field, no `SAVE_VERSION` bump
  (I5).
- **Undo boundaries.** No new boundary. Opening and Cancel push and clear
  nothing. Only the confirmed end clears history, as today
  (`BoardScene.ts:2938`).
- **AI / harness.** `legalActions` and `applyAction` are unchanged. The
  harness never ends a phase through the scene, so it is untouched. A
  computer seat is never prompted (B4).

## Out of scope

- Any warning in the combat phase (units that could still attack).
- Flagging partly moved units (owner's answer 3).
- Switching the warning back on within a game, or a global or Menu
  setting for it.
- Clicking a marked unit to cancel and select it in one step. Cancel
  first, then click.
- §82's permanent status markers. This intent only shares the B1 fact.
- Restyling `showConfirmDialog` or the other dialogs.

## Assumptions I made

- **The prompt is the pending decision (B13).**
  - **Why.** The warning must block undo, save, end game and board
    clicks, or the flagged list could change under it. Reusing the
    existing pending-decision guard does that and hides the Tables panel
    through `update` (`:1448`).
  - **The cost.** Those guards' log lines said "retreat/drift". B13
    rewords them to "the pending choice", in both languages. It is a
    small text change outside the intent's letter, made because the old
    words would be wrong here, and are already wrong for an advance or
    exchange choice.
- **The prompt sits in the side panel, not on the map (B8).**
  `showConfirmDialog` darkens the whole canvas, and a centred prompt
  would cover the very units it shows.
- **Camera after Confirm (B11).** It goes back to where it was before the
  click, so "End phase anyway" leaves the board as a plain End phase does.
- **Selection is cleared on open (B3)**, and Cancel does not bring it
  back. Leaving the reachable-hex highlights under the marks would
  confuse the two.
- **The switch applies on any close (B12)**, Cancel included. A tick is
  the player's statement whichever button follows.
- **Enter confirms (B15).** End phase has no key of its own, so a
  double-press cannot skip the warning by accident. The owner asked for
  both keys.
- **Mark style (B7).** Magenta with a dark outline, 14 × 10 screen px. It
  is a starting point; the live check decides.
- **Not a blocker on §73 or §82.** Either merge order works:
  - **§73.** It folds the same guards into a `pending()` helper
    (`intents/73-boardscene-on-session/plan.md:111-121`). If §73 merges
    first, §83 adds the warning to `pending()`. If §83 merges first, §73
    keeps the warning in it. §73 also shrinks `BoardScene.ts`, which
    would remove §83's budget question.
  - **§82.** Whichever of §82 and §83 lands first writes `hasNotMoved`,
    and the other reuses it.
- **Live check owed.** The change is new and visual (intent; rule 1 for
  `src/scenes/` and `src/ui/`).
