<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §66 plan — The vector view animates moves, combats and drifts

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

In the Drawn view, units visibly move along their real path, clash, fall,
ram, board and drift, at a speed the player picks (Normal, Slow, Off) on the
board. Any click or key finishes every animation at once and then acts. The
game state, rules, saves, undo and the computer's choices stay exactly as
they are at every speed, and the Standard view does not change (spec B1-B17).

## Risks

- **Tests that pass whatever the code does.** A path test that only checks
  "ends at `to`" would pass a teleport. AC1 and AC2 pin adjacency of every
  step and cost equality with `reachableHexes`/`reachableNavalStates` over
  every reachable destination of real positions, not one hand-picked hex.
- **Changing the movement search while adding the path.** `reachableHexes`
  and `reachableNavalStates` gain predecessor tracking. Their returned maps
  must stay byte-identical: a test compares them to a snapshot taken before
  the change over many units and seeds (subtask 1), and the fuzz harness
  stays green.
- **Drift-machine fall-through** (§21's recurring bug). This plan does not
  touch `drift.ts`'s state machine; the scene only reads `onDriftMoved` and
  `onCombat`, which already fire before `onRender` (`drift.ts:594-621`). Do
  not add a branch to `driftStep`.
- **A promise that never resolves.** The computer's driver waits on the
  view (B11). If the scene shuts down or the view is switched mid-animation,
  that wait must still resolve, or the AI loop strands mid-turn (the reason
  `pause` uses `setTimeout`, `BoardScene.ts:3057-3063`). `destroy` and
  `finishAll` resolve every waiter.
- **Input order.** B9 needs the animations finished *before* the click acts.
  Phaser emits a game object's `pointerdown` before the scene-level one, so
  a scene listener is too late. The animator listens on `window` in the
  capture phase for `pointerdown` and `keydown`, which runs before Phaser's
  canvas handlers. Verify by the e2e cut-short step (AC7).
- **Snap versus slide.** Undo, redo, load and the view toggle must not slide
  units backwards (B7). Every such render passes an explicit snap.
- **Overlays ahead of units.** Highlights move at once (B6) while a unit is
  still sliding; that is the spec. The drift arrow is the one exception
  (B4) and waits for the queue.
- **The lint cap and the size budget.** `BoardScene.ts` is at its ceiling
  (`scripts/size-baseline.json`: 3173). The scene edits are kept to one
  helper and one-line call-site changes; the budget line below caps them.
  New modules stay under 500 lines and functions under 80.
- **Stale line citations.** Every `path:line` below was read at `a5c3a90`;
  the implementer re-checks before editing.

## Verified against the codebase

Re-read on `main` at `a5c3a90`.

- `src/engine/actions.ts:66-74` — `Action`: `landMove {unitId, to}`,
  `landSwap {unitId, otherId}`, `navalMove {unitId, to, facing?}`,
  `navalRotate {unitId, direction}`, `ram {unitId}`, `landAttack
  {attackerIds, defenderIds}`, `board {attackerId, defenderId}`.
- `src/engine/actions.ts:99-147` — `RamResult {attacker, defender, dieRoll,
  hit, bonus}`, `LandAttackResult {detail, outcome, attackers,
  defenderOriginalHexes}`, `BoardResult {attacker, defender, dieRoll,
  result, …}`.
- `src/engine/actions.ts:308-333` — `landMove` goes through
  `applyLandMove`; `navalMove` prefers a ramming contact at `to` (filtered by
  a pinned `facing`), else a plain move.
- `src/engine/movement.ts:75-146` — `reachableHexes`: FIFO relaxation over
  `costSoFar`, expands through friendly-occupied hexes, strips them and the
  start from the result, stops expansion in enemy ZOC.
- `src/engine/movement.ts:257-261` — `straightLineDirection(from, to)`
  (module-private).
- `src/engine/movement.ts:277-320` — `straightLineMoveCost`.
- `src/engine/movement.ts:351-361` — `evaluateCharge(state, unit,
  destination): number | null`, to be called before the move.
- `src/engine/movement.ts:339-340` — the shipped-map case where the
  straight and cheapest costs differ: "light cavalry from (10,1) to (14,1):
  straight cost 6, cheapest 5".
- `src/engine/navalMovement.ts:57-94` — `reachableNavalStates`: Dijkstra
  over (hex, facing), keyed `hexKey|facing`, `best` map without
  predecessors.
- `src/engine/navalMovement.ts:103-113` — `reachableNavalHexes`: cheapest
  state per hex.
- `src/engine/combat.ts:974-1019` — `applyLandCombatResult`: immediate
  destruction for AE, DE, EX, and a retreat with nowhere to go; the rest in
  `pendingRetreats`/`pendingDrifts`.
- `src/engine/combat.ts:1092-1097` — a ram hit destroys the target; a miss
  leaves both.
- `src/engine/combat.ts:1105-1111` — boarding: the losing side loses
  equipment, destroyed at zero; `side === null` changes nothing.
- `src/engine/drift.ts:93-114` — `DriftEvent` kinds, including `moved`,
  `enteredVacatedHex` and `combatResolved {elephant, occupant, hex}`.
- `src/engine/drift.ts:594-621` — `onDriftMoved` then `onRender` for a move;
  `onCombat` then `onRender` for a trample.
- `src/ui/boardView.ts:48-77` — `BoardView` interface; `setUnits(units)`.
- `src/ui/boardView.ts:108-124` — `reconcileUnits(prev, next)` → `{add,
  update {unit, recreate}, remove}`.
- `src/ui/drawnUnits.ts:89-104` — `setUnits`: an update destroys the
  container and makes a new one; then `bringToTop` in `units` order and
  `queueDepthSort`.
- `src/ui/drawnUnits.ts:112-131` — `make`: a container at
  `host.toScreen(position)`, depth 10, named by unit id, kept off the HUD
  camera.
- `src/ui/drawnBoardView.ts:37-39`, `:81-87` — `setUnits` and
  `setDriftArrow`/`clearDriftArrow` forward to `DrawnUnits`/`DrawnOverlays`.
- `src/ui/boardViewPreference.ts` — the remembered-choice pattern (key,
  resolve function, in-memory fallback, reset for tests).
- `src/ui/viewToggle.ts:23-41` — the toggle: a HUD text button, depth 30,
  scroll factor 0, caller pins it.
- `src/ui/MapView.ts:154-174` — `viewKind`, `setViewKind` (creates the new
  view, `drawing.replay(next)`, destroys the old).
- `src/ui/MapView.ts:291-294` — `setUnits` records in `drawing` and
  forwards to the view.
- `src/ui/devHook.ts:240-244` — `busy()` counts `tweens.getTweens()`;
  `idle()` is `busy().length === 0`.
- `src/scenes/BoardScene.ts:110-111` — `AI_MOVE_DELAY_MS = 160`,
  `AI_COMBAT_DELAY_MS = 700`.
- `src/scenes/BoardScene.ts:299-313` — drift hooks: `onDirectionRolled`
  renders, `onDriftMoved` sets the arrow's elephant, `onRender` renders,
  `onCombat` logs the trample.
- `src/scenes/BoardScene.ts:767` — the view toggle's placement, next to
  Abandon.
- `src/scenes/BoardScene.ts:904-929` — `renderAllUnits()`.
- `src/scenes/BoardScene.ts:1202`, `:1257-1296` — `restoreSnapshot`,
  `undo`, `redo`.
- `src/scenes/BoardScene.ts:1541-1551` — the human land move:
  `applyAction`, `reportAction`, `renderAllUnits`.
- `src/scenes/BoardScene.ts:1575-1590` — the human swap.
- `src/scenes/BoardScene.ts:1900`, `:1913` — `commitRam`, its
  `applyAction`.
- `src/scenes/BoardScene.ts:2551` — the land attack's `applyAction`.
- `src/scenes/BoardScene.ts:2838`, `:2859` — `commitBoarding`, its
  `applyAction`.
- `src/scenes/BoardScene.ts:3026-3041` — the AI driver: apply, then
  `await this.pause(this.delayFor(action))`.
- `src/scenes/BoardScene.ts:3070-3141` — `applyAiAction`: moves, swaps and
  turns call `applyAction` then `renderAllUnits`; ram and board go through
  `commitRam`/`commitBoarding`; attacks through `executeLandAttack`.
- `e2e/helpers.ts:47` — `startFromMenu` pins `heraklios.language` with
  `addInitScript`.
- `playwright.config.ts` `use` block — no `storageState` today.
- `scripts/size-baseline.json` — `"src/scenes/BoardScene.ts": 3173`.

## Where this goes

- **Modules touched:**
  - `src/engine/movement.ts`, `src/engine/navalMovement.ts`: an internal
    search that also records predecessors; the public functions return what
    they return today.
  - `src/ui/boardView.ts`: `setUnits(units, motion?)` and three optional
    members (`finishAnimations`, `animationsSettled`), documented.
  - `src/ui/drawnUnits.ts`, `src/ui/drawnBoardView.ts`: keep a moved unit's
    container and hand it to the animator; the drift arrow waits for the
    queue.
  - `src/ui/standardBoardView.ts`: ignores `motion` (no behaviour change).
  - `src/ui/MapView.ts`: forwards `motion`, `finishAnimations`,
    `animationsSettled`; `setViewKind` finishes first.
  - `src/scenes/BoardScene.ts`: one `applyWithCue` helper; call sites pass
    the cue; undo/redo/restore render with a snap; the AI driver awaits
    `animationsSettled`; the speed button.
  - `src/ui/devHook.ts`: `animationSpeed()` reading for e2e.
  - `src/ui/i18n/en.ts`, `fr.ts`: the speed button's labels.
  - `playwright.config.ts`: `storageState` with `heraklios.animationSpeed:
    off` for every scenario.
  - `README.md`: the board section documents the speed button and what
    animates.
- **New modules:**
  - `src/engine/movePath.ts` — the path a land or naval move takes from the
    pre-move state: cheapest path, or the charge's straight line, or the
    (hex, facing) sequence for a ship.
  - `src/engine/actionCue.ts` — `ActionCue` data: for an action (before it
    is applied) and its result, which unit moves along which path, which
    units clash toward which hex, and which surviving ship shakes; plus the
    cue for a drift `moved`/`enteredVacatedHex` step and a drift trample.
  - `src/ui/animationSpeed.ts` — the remembered speed (`normal` | `slow` |
    `off`), like `boardViewPreference.ts`, and the B15 durations.
  - `src/ui/animationPlan.ts` — pure: from the drawn units, the new units,
    an optional cue and the speed, the ordered list of animation steps
    (slide along hexes, turn, lunge, fade, shake) with durations.
  - `src/ui/drawnAnimator.ts` — Phaser side: plays a plan's steps on
    `DrawnUnits` containers with tweens, keeps the queue, `finishAll`,
    `settled()`, and the window capture listeners for B9.
  - `src/ui/speedToggle.ts` — the HUD button (like `viewToggle.ts`),
    shown only in the Drawn view.
- **Why there:** paths and cues are derived from rules (principle 5, 15),
  so they are engine functions with tests and the scene re-derives nothing
  (intent constraint, spec I1). The planner is presentation logic but pure,
  so it is tested without a browser (principle 15). Only the animator and
  the button touch Phaser. Dependencies stay `scenes → ui → engine`
  (principle 2). No new layer, no new dependency.
- **Budget lines:**
  - `budget: src/scenes/BoardScene.ts +45: §66 passes a cue with each committed action, snaps on undo/redo/restore, waits on the view in the AI driver, and places the speed button; the logic is in engine/actionCue.ts and ui/ modules`

## Subtasks

1. **Land and naval paths** (`movement.ts`, `navalMovement.ts`,
   `movePath.ts`). Add predecessor tracking inside the searches without
   changing their returns; export `landMovePath(state, unit, to)` (charge
   line when `evaluateCharge` is non-null, else the cheapest path) and
   `navalMovePath(state, unit, to, facing?)` (the state `applyAction`'s
   `navalMove` lands on, contact first, as `actions.ts:311-333`). Tests
   AC1, AC2 and the unchanged-returns snapshot. Commit.
2. **Action cues** (`actionCue.ts`): `cueBeforeAction(state, action)` for
   every `Action` kind (`endPhase` → null), `completeCue(cue, result)` for
   the ram/boarding shake, `driftCue(event)` for `moved`,
   `enteredVacatedHex` and `combatResolved`. Each attacker in a land attack
   lunges toward the nearest defender hex (ties: the defender order). Tests
   AC3. Commit.
3. **Speed preference** (`animationSpeed.ts`) with the B15 durations; tests
   AC5. Commit.
4. **Planner** (`animationPlan.ts`): steps from `reconcileUnits`'s diff plus
   the cue — a cue path for a moved unit with one, a straight one-hex slide
   for a moved unit without one (retreat, push, advance), a turn for a
   facing change, a clash/ram lunge before the result, a fade for a removed
   unit, an instant add, a shake from the cue; nothing for equal drawings
   (B8); Off → none; Slow = 2 × Normal. Tests AC4. Commit.
5. **Animator and view seam** (`drawnAnimator.ts`, `drawnUnits.ts`,
   `drawnBoardView.ts`, `boardView.ts`, `standardBoardView.ts`,
   `MapView.ts`): `setUnits(units, motion)` where `motion` is a cue, the
   default, or `'snap'`; a queue played in order; `finishAll` (every unit
   to its final drawing, waiters resolved); `settled()`; window capture
   listeners for `pointerdown`/`keydown` (which also cover the drift continue
   of B10 and a click during a computer turn, B12) added on creation and removed on
   `destroy`; the drift arrow shown when the queue drains (B4); a view
   switch finishes first (B7). `devHook` keeps counting tweens. Commit.
6. **Scene wiring** (`BoardScene.ts`): `applyWithCue(action, rng?)` = cue
   before, `applyAction`, complete the cue, keep it for the next
   `renderAllUnits`; replace the `applyAction` calls at `:1547`, `:1585`,
   the naval move/turn sites, `:1913`, `:2551`, `:2859` and in
   `applyAiAction`; `onDriftMoved`/`onCombat` set the drift cue;
   `restoreSnapshot`, `undo`, `redo` and the start render snap; the AI
   driver awaits `mapView.animationsSettled()` before its pause (B11); the
   speed button next to the view toggle, visible in the Drawn view only
   (B13), labels in `en.ts`/`fr.ts`. Within the budget line. Commit.
7. **e2e** (`playwright.config.ts`, `e2e/board-animations.spec.ts`,
   `devHook.ts`): every scenario at Off through `storageState`; the new
   scenario per AC7. Commit.
8. **README**: the board section gains the speed button and what animates;
   plan-history is not touched (no rule). Commit, `status: in-review`.

## Tests

- **AC1** `src/engine/movement.test.ts` (or `movePath.test.ts`): over the
  test-mode armies and several fuzz seeds' positions, for every reachable
  land destination: the first step is adjacent to the start, every step is
  adjacent to the previous, no step enters an enemy-occupied hex, the last
  is the destination, the summed step cost (terrain + river) equals
  `reachableHexes`' cost. Charge: the `(10,1)` → `(14,1)` light cavalry
  gets the 4-hex straight line, not the cheaper detour. Mutations killed:
  dropping the charge branch; off-by-one in the predecessor walk; building
  the path from the wrong end.
- **Unchanged searches** — same files: `reachableHexes` and
  `reachableNavalStates` outputs equal a snapshot built from the pre-change
  code over the same positions (captured in the first commit, before the
  edit). Mutation killed: any change to relaxation.
- **AC2** `navalMovement.test.ts` (or `movePath.test.ts`): for every
  reachable (hex, facing), the path alternates only single rotations and
  bow-forward steps, ends at that state, and its cost equals
  `reachableNavalStates`'; `navalMovePath` with a pinned `facing` and with a
  contact at `to` ends at the state `applyAction` produces (applied on a
  clone). Mutation killed: ignoring `facing`; taking the cheapest hex
  instead of the contact.
- **AC3** `actionCue.test.ts`: each `Action` kind's cue; a two-attacker
  attack on two defenders gives each attacker its nearest defender hex; a
  ram miss shakes the target and a hit does not; a boarding with
  `side: 'attacker'` and survival shakes the attacker; `side: null` shakes
  nobody; drift `moved` gives a one-hex path; `combatResolved` a clash at
  `hex`.
- **AC4** `animationPlan.test.ts`: equal drawings → no steps; a cue path →
  one slide per hex in order; a move without cue → one slide; a facing
  change → a turn; a removed unit → a fade after the clash; Off → none;
  every Slow duration = 2 × Normal; an added unit → no step.
- **AC5** `animationSpeed.test.ts`: as `boardViewPreference.test.ts` does
  for the view.
- **AC6** `npm run verify`: `actions.test.ts`, the fuzz harness and the
  soak tests unchanged.
- **AC7** `e2e/board-animations.spec.ts` (sets Normal by init script):
  Drawn view, a 3+-hex land move: `idle()` false during it, the unit's
  container reaches an intermediate hex centre, ends on the clicked hex; a
  second move then an immediate click on another unit: the move is finished
  at once and the click selects; the speed button cycles Normal → Slow →
  Off and the value survives a reload; in the Standard view a move starts
  no tween.
- **AC8** the full `npm run e2e` time, before and after, quoted in the
  Progress entry.

## Validation

- `npm run verify` green
- `npm run check:intent` PASS (or ROUTE with a reason recorded in review.md)
- `npm run e2e` green, timing quoted (AC8)
- Live check (owed by rule 1, AC9): `npm run dev -- --port 5266 --strictPort
  --host 127.0.0.1` in the worktree → Menu test-mode shortcut → switch to
  the Drawn view → at Normal and at Slow: a long land move, a cavalry
  charge, a ship move with turns and a Turn click, a swap (option on), a
  land attack ending in a retreat and an advance, an exchange, a ram, a
  boarding, an elephant drift with a trample (your turn, then a computer
  turn), a full computer turn; click or press a key during each to cut it
  short; switch to Standard and see no animation.

## Assumptions I made

- **Predecessor tracking is an internal change to the two searches**, not a
  second copy of them: a copy would duplicate the movement rules
  (principle 6). Their returns are pinned unchanged. The spec's "new
  callers of the movement search, not a change to it" is read as "no
  behaviour change".
- **Default motion for an uncued render** is the one-hex slide or fade of
  spec B2, which covers retreat, push, advance and exchange sacrifice
  without cues; B5's "shows at once" covers additions.
- **Nearest defender** for a multi-defender attack's lunge: the spec says
  "the defender hex it fights"; the engine has no per-attacker pairing, so
  the nearest hex (ties by defender order) is the cue.
- **Window capture listeners** are the B9 mechanism; if the e2e step shows
  they don't run first, that is a plan amendment, not a silent change.
- **The live-check port** follows the spawn rule (5200 + 66).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-21 — all eight subtasks

Commits: `107f249` (pre-change snapshot of the searches, before any edit),
`9be04ea` (subtask 1: paths), `1c45c56` (2 and 3: cues, speed), `669c25f` (4:
planner), `2cacabb` (5: animator and BoardView seam), `14e7426` (6: scene
wiring and speed button), `c497698` (7: e2e), and the README/Progress commit
(8).

Shipped: B1-B17 as specified. `reachableHexes` and `reachableNavalStates` now
share internal `searchLand`/`searchNaval` that also record predecessors; their
returns are pinned by a fingerprint snapshot taken in `107f249`, before the
edit (`movementSearch.test.ts`, `movementCases.ts`, 3 armies x 6 walked
seeds). `movePath.ts` gives `landMovePath` (charge line when `evaluateCharge`
is non-null) and `navalMovePath`/`navalStatePath`; `actionCue.ts` the cues;
`animationSpeed.ts`, `animationPlan.ts`, `drawnMotions.ts`, `drawnAnimator.ts`,
`speedToggle.ts` the UI side. The window capture listeners (pointerdown,
keydown) do run before Phaser's handlers: the e2e Slow scenario clicks another
unit mid-move and the mover is on its final hex when the selection lands.

Tests: 86 files, 1455 tests (from 83 / 1427 at the first commit's baseline
of the branch: +8 cue, +8 speed, +12 planner, +5 path, +1 snapshot, rest are
counted in those files). `npm run verify` green, lint 21 warnings = the cap
(no new warning; `devHook.installDevHook` was kept under 80 lines by a helper).
`BoardScene.ts` 3173 -> 3195 (budget line +45).

e2e: before 23 passed in 1m21.6s (measured while I was also running vitest and
editing the worktree, so it is a pessimistic baseline); after 27 passed (23 +
the 4 new scenarios) in 1m10.5s on an idle machine. Every other scenario runs
at Off through `storageState` in `playwright.config.ts`.

Divergences from the plan, none of design:
- `driftCue(event)` became `driftMoveCue(elephantId, hex)` and
  `driftClashCue(elephantId, hex)`: the drift hooks the scene uses
  (`onDriftMoved`, `onCombat`) pass those arguments, not a `DriftEvent`.
- `onCombat` now also calls `renderAllUnits()` (the plan said it only logs): the
  trample's clash cue would otherwise be overwritten by the next beat's
  `onDriftMoved` cue before any render. The result shows after the clash, as B4.
- The speed button sits above the view toggle (same x, one row up), not beside
  it: the Standard-view label is wider than the Drawn-view one and overlapped a
  button placed beside it.
- `createViewToggle` gained an optional `onChange` callback so the speed button
  hides in the Standard view.
- `devHook` gained `animationSpeed()` and `unitCanvas(id)`; `idle()` was left
  counting tweens only (each animation step is one counter tween and the next
  step starts in the same callback, so there is no gap).
- A watchdog (2x the queued length + 1 s) finishes a queue that never drains,
  such as a hidden tab pausing Phaser's clock; the animator also ends on the
  scene's `shutdown`.
