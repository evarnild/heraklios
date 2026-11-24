<!-- generated-by: heraklios/spec@0.1.0 -->
# §82 spec — Each unit shows whether it has moved, charged, attacked or been attacked this phase

Accepted intent: [intent.md](intent.md)

Written against `main` at `0fa7e95`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| intent, "The owner's answers (2026-11-22)" | 1 "coloured dots for the three movement states, plus a small chevron for a charge"; 2 "movement markers on the active player's units only … In combat, 'has been attacked' shows on any player's units"; 3 "show nothing" for a unit that can't attack; 4 "none. The markers are always on" |
| intent, Constraints | digital-only, no new rule; "can attack" uses the engine's own legality; "A pure function returns each unit's status for the phase, with unit tests. The views only draw it."; `UnitDrawing` "(or a sibling) carries the status" |
| intent, open question 5 | "The draft assumes no markers in Placement" (not contradicted by the owner: kept) |
| `README.md` "Known simplifications" | none removed |
| `src/engine/state.ts:22-23`, `:28-40` | `movementLeft`: "Movement points remaining in the current Movement phase"; `defendedThisPhase`: "True once this unit has been the target of a combat resolution this phase … Reset at the start of each combat phase"; `charged`: set only by a move that spent "its ENTIRE movement allowance" and cleared "at the start of their next Movement phase" (so it lasts through the owner's Combat phase) |
| `src/engine/turnManager.ts:62-66`, `:153-160` | `advancePhase` movement to combat: `for (const u of state.units) u.defendedThisPhase = false;`. It is not cleared again until the next combat phase, so it is still true on units during the following movement phases. `resetMovementForActivePlayer` sets `u.movementLeft = unitType(u).movement; u.charged = false;` for the active owner |
| `src/engine/actions.ts:408-411`, `:442-488` (`legalActions`) | `ActionContext { attackedThisPhase?, rammedThisTurn? }`; in combat, per own living unit: skipped if `attackedThisPhase.has(unit.id)`; naval skipped if `rammedThisTurn.has(unit.id)`; one `board` / `landAttack` (`attackerIds: [unit.id]`) per `validTargets` entry |
| `src/engine/combat.ts:436-453` (`validTargets`) | excludes destroyed, same-owner and `u.defendedThisPhase` targets, cavalry vs phalanx, out-of-range, non-parallel boarding: so "has a legal target" is already in `legalActions` |
| `src/engine/saveGame.ts:142`, `:186`; `src/engine/gameSession.ts:31`, `:60-72` | `attackedThisPhase` and `rammedThisTurn` are saved and restored as string lists, so a load restores the markers' inputs |
| `src/scenes/BoardScene.ts:167`, `:456`, `:2551`, `:2841`, `:2941`, `:2954` | the scene's `attackedThisPhase` (added to on a land attack, on a boarding, cleared in `commitEndPhase`) and `rammedThisTurn` (added on a ram, cleared when a new movement phase begins) |
| `src/scenes/BoardScene.ts:1189`, `:1218` | undo/redo snapshots and restores both sets with the state; the restore ends in `renderAllUnits(true)` (`:1245`) |
| `src/scenes/BoardScene.ts:905-916` (`renderAllUnits`) | builds one `UnitDrawing` per living unit (`{ id, typeId, owner, position, facing }`) and calls `this.mapView.setUnits(drawings, snap ? 'snap' : this.cues.take())` |
| `src/ui/boardView.ts:5-18`, `:101-111` | `UnitDrawing`; `reconcileUnits` makes a unit an `update` only on a type/owner/dimmed change (`recreate`), a move or a facing change, so a field that is none of these is never seen by the layer today |
| `src/ui/unitLayer.ts:36-61`, `:101-148` | `jointFigure(lead, follower)` (position and alpha reach both, only `facingPart` rotates); `UnitLayer.setUnits` reconciles by id, builds, animates, and keeps figures stacked in `units`' order; `objects()` feeds `mapObjects()` |
| `src/ui/standardUnits.ts:21-59` | the Standard figure: counter image (width `HEX_SIZE * 1.6`, depth 10) plus the ship's facing mark (depth `MARK_DEPTH` = 10.5, rotated), `host.ignoreOnUiCamera(...)` |
| `src/ui/drawnUnits.ts:62-67`, `:77-91`, `:138-150` | the Drawn figure: one container `[base, fig]` per unit (`figureOf` reads `container.list[1]`), `LayerFigure` over it, `objects: () => [container]`, `ignoreOnUiCamera(container)` |
| `src/ui/viewDrawingState.ts:19-30` | remembers the last `setUnits` list so a view toggle replays it into the new view: a `status` on `UnitDrawing` survives a switch for free |
| `src/ui/animationPlan.ts:39-59` | slides, turns and fades come from position/facing differences, so a drawing that differs only by status plans no motion |
| `src/ui/placementDrawings.ts:31-43` | Placement builds its own `UnitDrawing`s (no status) |
| `src/ui/unitTooltip.ts:46-64` (§74) | the hover tooltip's state line already shows `movementLeft` and `charged`; unchanged |
| `src/ui/devHook.ts:42`, `:131`, `:331` | dev-hook readers `drawnInspect`, `boardObjects()`, `hudStrays()`; e2e reads state through readers (§75) |
| `src/ui/hexRender.ts:4`, `:89-90` | `HEX_SIZE = 22`; the four player colours |
| `scripts/size-baseline.json:6` | `"src/scenes/BoardScene.ts": 3169` |
| `intents/83-end-move-phase-warning/spec.md` B1 and `feat/83-…:src/engine/unmoved.ts` | §83 (in review, not on `main`) defines `hasNotMoved(unit)`: `!unit.destroyed && unit.movementLeft === unitType(unit).movement` |
| `intents/77-standard-view-animations` (merged `b7758e2`, status `done`) | B6 "A ship's facing mark travels with its counter … whatever else redraws meanwhile"; B8 "Everything else shows the new state at once"; one shared `UnitLayer` for both views (I4) |

## Behaviour

### The engine fact

**B1 — One status per unit, per phase.** A pure engine function
`unitStatuses(state, context)` returns, for each living unit that has one,
its status, as data (`UnitStatus`, a small tagged union, no text). A unit
has at most one *activity* status (B2 to B4) plus, for cavalry, a *charge*
flag (B5). Units with no status are absent. It reads only `GameState` and
the `ActionContext` (`attackedThisPhase`, `rammedThisTurn`); it mutates
nothing.

**B2 — Movement phase, activity.** In the movement phase, each living unit
of the **active player** has one of:

| status | when |
| --- | --- |
| `notMoved` | `hasNotMoved(unit)`: `movementLeft` equals the type's printed `movement` |
| `partlyMoved` | `0 < movementLeft < printed movement` |
| `done` | `movementLeft === 0` (checked first, so a unit with a printed 0 would read `done`) |

Other players' units have no activity status in the movement phase.
Land and naval units are treated alike. This is the `movementLeft` fact,
deliberately **not** filtered by "has a legal move" (see I2).

**B3 — Combat phase, the active player's units.** In the combat phase, each
living unit of the active player has one of:

| status | when |
| --- | --- |
| `hasAttacked` | `attackedThisPhase` has the unit, or the unit is naval and `rammedThisTurn` has it (it spent its attack on a ram this turn and cannot board; I3) |
| `canAttack` | not `hasAttacked`, and the unit is the `attackerIds[0]` of a `landAttack` or the `attackerId` of a `board` in `legalActions(state, context)` |
| none | otherwise: a unit with no legal target shows nothing (owner's answer 3) |

**B4 — Combat phase, any unit that was attacked.** In the combat phase, a
living unit with `defendedThisPhase === true` has `beenAttacked`, whoever
owns it. It is the only status an opponent's unit can have. It is never
shown outside the combat phase (I4). The active player's own units are never
`beenAttacked` in their own combat phase (`advancePhase` clears the flag at
its start), so a unit never has two activity statuses.

**B5 — Charge flag.** A cavalry unit with `charged === true` carries the
charge flag in the movement phase and in the combat phase, whoever is
active (the flag is only ever true on the active player's units). It is shown
beside its activity status, not instead of it. In the movement phase a
charged unit is `done` (a charge spends the whole allowance), so it shows
both.

**B6 — Elsewhere.** In Placement, and in any phase or state that is not the
board's movement or combat phase, no unit has a status. A destroyed unit is
not drawn, so it has none.

### What the player sees

**B7 — The mark.** Each status is drawn as a small mark on the unit's
counter, in the same corner for every unit, in both views:

- **Movement activity** (a dot, not relying on colour alone): `notMoved` a
  solid green dot; `partlyMoved` an amber dot half filled; `done` a grey
  ring, empty.
- **Combat activity**: `canAttack` a green dot with a small crossed-swords
  or sword stroke; `hasAttacked` a grey dot with a tick; `beenAttacked` a
  red dot with a cross.
- **Charge**: a small chevron (a "^" or lance head) in the opposite top
  corner.
- All marks are small (about 8 px across at zoom 1), dark-outlined so they
  read on any counter or figure, and drawn above the counter and its
  facing mark. They are not clickable and never take a hex hit.
- **Do not hide what the counter shows.** They sit at the counter's
  corners, not its centre, so the Standard counter's printed values and the
  Drawn figure stay readable. The exact size, corner and colours are tuned
  in the live check; the plan records any change.

**B8 — They change at once.** The mark follows the unit's state the moment
`renderAllUnits` runs: after a move, a swap, a rotation, a charge, a ram, an
attack, undo, redo, a load, an end of phase or an AI action. A status-only
change redraws the mark only: it neither rebuilds the figure nor plays any
motion, in either view.

**B9 — They follow the unit.** A mark belongs to its unit's figure, as the
ship's facing mark does (§77 B6): during a slide, lunge, shake or fade it
moves, shakes and fades with the counter, and never shows ahead of it or
behind it. A unit that fades out takes its mark with it. A dimmed unit
(Placement) has none. The mark's new state shows at once (§77 B8) even
while its counter is still sliding; only its position follows the counter.

**B10 — Both views.** The Standard and the Drawn view show the same marks
from the same data. Switching view mid-board keeps them (the replayed
`UnitDrawing` list carries the status).

**B11 — Always on.** No toggle (owner's answer 4). They show for human and
computer seats alike: during a computer turn they show the computer's units'
states as it acts.

**B12 — A view-only aid.** No rule, no `GameState` field, no new message in
the log. The scene never works a status out itself: it asks the engine
function and hands the result to the view. The hover tooltip (§74) is
unchanged.

## Interpretations

**I1 — "Partly moved" and "done" (B2).** The owner's "moved yet but not all
points" and "fully moved" are read on `movementLeft` against the printed
`movement`. A ship that only turned has spent points, so it is `partlyMoved`
(or `done`). `hasNotMoved` is the shared fact with §83 B1 and §83's own I1
("not moved at all is full allowance left"); it is reused, not rewritten
(Assumptions). Code comment at `unitStatuses`.

**I2 — Movement markers do not ask "could it move?" (B2).** §83 flags only
units that *could* move, because it is about a forgotten unit. §82's
`notMoved` is the plain fact ("has not moved yet") that the intent asks for
and the tooltip already shows; a unit boxed in by ZOC keeps its green dot.
Filtering would also make a marker flip as other units move and need
`legalActions` for the whole army on every render. Code comment at
`unitStatuses`.

**I3 — A ship that rammed has "attacked" (B3).** A ram is an attack made in
the movement phase; the engine refuses that ship's boarding for the turn
(`legalActions`: `rammedThisTurn` skip). Showing it as `canAttack` would
contradict the refusal, and showing nothing would hide why. It reads as
`hasAttacked` through the combat phase. Code comment at the engine function.

**I4 — "Has been attacked" only in combat (B4).** `defendedThisPhase` is only
reset when a combat phase starts, so it stays true on units through the
next movement phases. Showing it there would mark units as "attacked this
phase" when it is a previous phase's fact. The phase gate is the reading of
"this phase". Code comment at the engine function.

**I5 — The charge is shown through combat too (B5).** The intent asks for it
in the movement phase. `charged` doubles the attack until the owner's next
movement phase (`state.ts:34-39`), so it is as useful when choosing attackers
as it is when moving; drawing it in the movement phase only would make it
vanish at the moment it starts to matter. Code comment at the charge flag.

**I6 — "Can attack" is the engine's singleton enumeration (B3).**
`legalActions` lists one attacker against one defender (its design note).
A unit is `canAttack` when it has at least one legal single target. A unit
that can only join a combined attack still has a legal single target, since
`attackerCanJoin` and `validTargets` share the reach rules. Code comment at
the engine function.

## Acceptance criteria

- **AC1 — Movement statuses (B2, I1).** A fresh unit is `notMoved`; after a
  one-hex move it is `partlyMoved`; with `movementLeft` 0 it is `done`; a
  ship after one rotation is `partlyMoved`; a charged cavalry unit is `done`
  with the charge flag; a unit boxed in by ZOC with full allowance is still
  `notMoved` (I2); another player's units and destroyed units have none; an
  undone move gives `notMoved` again. *Proof: engine unit test
  (`src/engine/unitStatus.test.ts`).*
- **AC2 — Combat statuses (B3, B4, I3, I4, I6).** In the combat phase: an
  active unit with a legal target is `canAttack`; with none, no status; one
  in `attackedThisPhase` is `hasAttacked` (and not `canAttack`); a ship in
  `rammedThisTurn` is `hasAttacked`; a cavalry unit whose only neighbour is a
  phalanx has none; an archer in range is `canAttack`; an enemy with
  `defendedThisPhase` is `beenAttacked`; that enemy is no longer a target,
  so it no longer makes a unit `canAttack`; no unit has two activity
  statuses. *Proof: engine unit test, positions built like
  `movementCases.ts` / `combat.test.ts`.*
- **AC3 — Phase gates (B4, B6, I4, I5).** In the movement phase a unit
  with `defendedThisPhase` true shows no `beenAttacked`; the charge flag is
  present in movement and combat and absent for a non-cavalry unit and for an
  uncharged cavalry unit; `unitStatuses` of a state outside movement and
  combat is empty. *Proof: engine unit test.*
- **AC4 — Pure.** `unitStatuses` does not mutate the state or the context,
  and gives the same result for equal inputs. *Proof: engine unit test
  (snapshot before and after).*
- **AC5 — The drawing carries it (B8, B10).** `reconcileUnits` makes a
  unit whose only difference is its status an `update` with `recreate`
  false; equal statuses make no work; `planAnimation` plans no step for a
  status-only change; the view-state replay keeps the status. *Proof: unit
  tests (`boardView.test.ts`, `animationPlan.test.ts`,
  `viewDrawingState.test.ts`).*
- **AC6 — The layer redraws the mark and keeps it on the figure (B8, B9).**
  With a fake figure, `UnitLayer.setUnits` calls the figure's status setter on
  a status-only change and not on an unchanged one; a figure's mark moves,
  fades and is destroyed with it. *Proof: `unitLayer.test.ts`, with fakes,
  no Phaser.*
- **AC7 — Both views draw it (B7, B9, B10).** In the Standard and in the
  Drawn view a unit's mark is among that unit's own display objects, so the
  HUD camera does not render it and `hudStrays().strays` stays empty. A
  reader returns, per unit id, the status the view is showing. *Proof: e2e
  via the dev hook, in both views (new `e2e/unit-status-markers.spec.ts`).*
- **AC8 — Live movement (B2, B8).** In "Test mode" (2 players), at the start
  of the movement phase every active unit reads `notMoved` and the other
  player's none; after one move that unit reads `partlyMoved`; after a move
  that spends the allowance it reads `done`; Ctrl+Z gives the previous reading
  back. *Proof: e2e via the reader.*
- **AC9 — Live combat (B3, B4, B8).** Ending the movement phase puts the
  active units with a target at `canAttack`; after an attack the attacker
  reads `hasAttacked`, the defender (the opponent's unit) `beenAttacked`; after
  End phase the new active player's units read `notMoved` and the old
  defender's `beenAttacked` is gone (a die roll clears undo history, so no
  undo step is claimed here). *Proof: e2e via the reader.*
- **AC10 — They ride the animation (B9).** During a slide at Normal speed,
  the mark's position equals its counter's (read from the display
  objects) at an intermediate frame, in both views; at Off it jumps with the
  counter. *Proof: e2e via the reader and `boardObjects()`.*
- **AC11 — View switch and load (B10, B8).** After the view toggle and after
  an in-game load, the readings are the same as before. *Proof: e2e via the
  reader.*
- **AC12 — No markers in Placement (B6).** The Placement scene's readings
  are empty. *Proof: e2e (`placement.spec.ts` style) or `placementDrawings.test.ts`.*
- **AC13 — The look (B7).** The marks read clearly in both views and in
  both languages' screens, at the default zoom and at min and max zoom;
  they hide neither a counter's printed values nor a figure, nor a ship's
  facing mark; a charged cavalry unit shows both marks; four players'
  colours do not clash with the dots. *Proof: the live check.*
- **AC14 — No extra work on the hot path (B8).** `unitStatuses` runs once
  per `renderAllUnits`, and calls `legalActions` only in the combat phase.
  *Proof: engine unit test that a movement-phase call with `{}` as context
  gives B2's result without enumerating moves (a spy on `legalActions`), and
  a review read of `renderAllUnits`.*
- **AC15 — Existing suites stay green.** `npm run verify`; `npm run e2e`.
  *Proof: both.*

## Non-functional

- **Engine/presentation split.**
  - **Engine** (`src/engine/unitStatus.ts`, plan may rename): `UnitStatus`
    type and `unitStatuses(state, context)`; it imports `hasNotMoved` from
    §83's `src/engine/unmoved.ts` (Assumptions) and `legalActions`. Pure,
    unit-tested.
  - **Seam** (`src/ui/boardView.ts`): `UnitDrawing` gets an optional
    `status` (and `charged`); `reconcileUnits` treats a difference there as
    an `update` without `recreate`; the `LayerFigure` interface gets an
    optional status setter that `UnitLayer` calls from its update path.
    Both pure and unit-tested.
  - **Drawing** (`src/ui/`, Phaser, no tests): one shared mark drawer (a
    `Graphics`, drawn the same in both views), attached to the Standard
    figure as a second, non-rotating follower in `jointFigure` and to the
    Drawn container as a third child, so it follows the animation (B9).
  - **`BoardScene.ts`** is at its 3169-line ceiling
    (`scripts/size-baseline.json`). Its part is passing the context to the
    engine call and the result into `renderAllUnits`'s drawings. The plan
    must make that net-neutral, for example by moving the drawings loop
    into a `src/ui` helper; if it must grow, a budget line of at most
    +10 lines with the reason (§61).
  - **`devHook.ts`** gets one reader of the statuses the views are showing,
    by unit id, through §75's groups.
- **Save format.** Unchanged. No `GameState` field and no `SAVE_VERSION`
  bump: every input (`movementLeft`, `charged`, `defendedThisPhase`,
  `attackedThisPhase`, `rammedThisTurn`) is already saved.
- **Undo boundaries.** None added. Markers are derived on each render.
- **AI / harness.** `legalActions`, `applyAction` and the fuzz harness are
  untouched; `unitStatuses` only reads them. A computer seat's markers show
  as it acts (B11).
- **Text.** The marks are shapes. If the plan adds an accessibility or
  debug label it goes in `en.ts` and `fr.ts`; none is planned.

## Out of scope

- A toggle for the markers (owner's answer 4).
- Markers in Placement, in the Army Builder or the Menu.
- Markers on non-active players' units in the movement phase.
- A "no target" state for a unit that cannot attack (owner's answer 3).
- Showing equipment points, attack or defence values (§74's tooltip).
- Any change to a rule, a log line, a message, or the hover tooltip.
- §83's warning, its marks or its framing. This intent only shares its
  `hasNotMoved` fact.
- A new animation for the marks themselves: they move with the counter and
  change at once.

## Assumptions I made

- **Look beyond the owner's answer.** The owner accepted "coloured dots plus a small charge
  chevron". The combat marks (sword, tick, cross in B7) and the
  shape-plus-colour difference between the three movement dots (solid,
  half, ring) are mine: the intent lists sword/tick/cross as options only,
  and colour alone fails for colour-blind players and for the green and
  yellow player colours. The live check decides the exact look.
- **One corner for the activity mark, the opposite corner for the charge.**
  The intent leaves placement to the spec; the counter's corners keep the
  centre (printed values, figure) free.
- **Charge also in combat (I5).** Broader than the intent's "move phase";
  cheap, same fact, and the first reading of "has the charge doubled my
  attack?".
- **Rammed ships read `hasAttacked` (I3).** The intent does not mention
  ramming ("Ramming, boarding and naval units: the spec decides").
  Boarding ships get the same marks as land units.
- **`notMoved` is not filtered by legal moves (I2).** Differs from §83's
  flag list on purpose.
- **Whose units in combat.** "Can attack" and "has attacked" only for the
  active player; "has been attacked" for any (owner's answer 2). The
  non-active player's other units show nothing.
- **Reuse of §83's `hasNotMoved`.** §83 is in review and not on `main`.
  Whichever of §82 and §83 merges first owns `src/engine/unmoved.ts`; the
  other imports it. The cleanest order is §83 first (the plan should check
  `main` and, if §83 has not merged, wait or base the branch on it; it is
  not a hard blocker, because the helper is one line and a copy could be
  swapped later, but a duplicate must not be merged).
- **§77 is merged.** The intent's `blocked_by: 77` is satisfied
  (`metadata.yml` of §77: `status: done`, `merged: b7758e2`), so the unit
  layer this builds on (`unitLayer.ts`, `standardUnits.ts`, `drawnUnits.ts`)
  is the one described here.
- **Tier.** Path rule: `src/ui/`, `src/scenes/` and `src/engine/` all
  change. Live check owed (new and visual).
