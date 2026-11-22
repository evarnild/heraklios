<!-- generated-by: heraklios/spec@0.1.0 -->
# §76 spec — Placement shows the armies other players have already placed

Accepted intent: [intent.md](intent.md)

Written against `main` at `c17b154` (§74 merged as `e80f74a`).

The intent's three open design questions are answered by the coordinator
under "Assumptions I made" (A1-A3). The owner can override any of them at
the spec-acceptance stop.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/05-rules-french-original.md:91-96` | "L'ensemble des unités doit être placé le long du bord qui lui est assigné sur une largeur ne pouvant pas excéder trois hexagones. Jamais deux unités d'armées différentes ne doivent être au contact avant que les hostilités ne soient engagées. Et ce, qu'elles soient maritimes ou terrestres. L'écart minimum qui sépare deux armées au début du jeu a été fixé à 4 hexagones." Nothing in the passage (`:83-96`) hides one army's deployment from another. The gap is measured from the other armies, so each army is placed in relation to them. |
| `docs/research/02-rules-transcription.md:44-46` | The transcription: "within a strip no more than **3 hexes wide**. Units of two different armies may never start in contact, land or naval — a minimum gap of **4 hexes** must separate two different armies at the start." |
| `intents/74-unit-hover-stats/spec.md`, "Amendment" | B4 reads "every unit, every player, on the Board and in Placement". Placement shows no state line (§74 B6). Drawing the other players' units in Placement "is left to a separate intent": this one. |
| `README.md:155-159` | "Placement shows no state line […] In Placement, hovering also shows earlier players' placed units that are not drawn on the screen (the rules hide nothing)." This sentence becomes false and is rewritten (B9). |
| `README.md:91-96` | The Placement step. It gains one sentence on the earlier armies (B9). |
| `README.md` "Known simplifications" | None removed. Hiding was never a listed simplification. |

### The code as it is at `c17b154`

- `src/scenes/PlacementScene.ts:315-328`. `drawPlacedUnits` draws
  `session.gameState!.units.filter((u) => u.owner === this.playerIndex)`
  (`:318`). §74 already corrected its comment: "Draws only this player's
  placed units (a choice of this scene, not a rule: the rules hide nothing,
  §74 spec amendment) from state." The second comment, at `:330-331`, still
  says "Only this player's units are drawn, matching what `tryPlace` renders
  as you go."
- `PlacementScene.ts:96-295`. `create` never calls `drawPlacedUnits`, so a
  new seat's Placement opens with an empty board. The first draw happens after
  the first placement (`:447`), or after an undo or redo (`:309`).
- `PlacementScene.ts:112`. The computer seats are deployed by
  `skipAiPlacementSeats` before the scene renders for the next human seat
  (`src/ui/aiSetup.ts:60-70`), so their units are already in
  `session.gameState.units` when `create` goes on.
- `PlacementScene.ts:126-128`. `enemyHexes` are all units not owned by the
  placing seat. `legalDeploymentHexes` and `legalNavalDeploymentHexes` drop
  every band hex closer than 4 to one of them, except in the boxed-in fallback
  (`src/engine/deployment.ts:179-183`: "the gap constraint is dropped rather
  than returning an empty, unplaceable set").
- `PlacementScene.ts:418-425`. `tryPlace` returns on a hex outside
  `currentLegalHexes()` and on an occupied hex, whoever owns it. The same check
  runs before a ship is staged. `deployUnit` refuses an occupied hex too
  (`deployment.ts:315-317`).
- `PlacementScene.ts:69-71`, `:121`, `:297-313`, `:337-351`. History is cleared
  in `create`, so it holds only this seat's placements. A snapshot is the
  whole `GameState`, in which the earlier seats' units never change.
- `PlacementScene.ts:142`. The hover hook is already
  `unitTooltipFor(session.gameState!, hex, { state: false })`, for any owner
  (`src/ui/unitTooltip.ts:51-56`).
- `PlacementScene.ts:458-465`. `shipArrowList` lists only this seat's
  `placedShips`, plus the staged ship. So the Standard view draws no facing
  arrow for an earlier seat's ship.
- `src/ui/boardView.ts:12-18`. `UnitDrawing` is `id`, `typeId`, `owner`,
  `position` and an optional `facing`. It has no per-unit look.
  `reconcileUnits` (`:124-139`) recreates a unit only on a type or owner
  change.
- `src/ui/boardView.ts:26-31`. `FacingShip` is `hex`, `facing`, `playerIndex`
  and `ghostTypeId?`.
- `src/ui/drawnUnits.ts:17-18`. `GHOST_ALPHA = 0.5` for the staged ship,
  applied at `:109`. `settle` forces `setAlpha(1)` (`:163`), and `make`
  (`:192-204`) leaves the alpha at 1.
- `src/ui/standardBoardView.ts:141-168`. `makeMarker` makes an image or text
  chip at alpha 1. `setFacingIndicators` (`:244-250`) draws each arrow through
  `drawFacingArrowhead`, which fills at alpha 1 (`src/ui/hexDraw.ts:37-38`).
- `src/ui/viewDrawingState.ts:30-32`. A view toggle replays the last
  `setUnits` list as given, so a field on `UnitDrawing` survives a toggle.
- `src/scenes/BoardScene.ts:908-920`. `renderAllUnits` builds the Board's
  drawings and ship arrows. It is not touched (B10).
- `scripts/size-baseline.json:7`. The ceiling is
  `"src/scenes/PlacementScene.ts": 548`, and the file is 548 lines. It is at
  its ceiling.

## Behaviour

- **B1. Every earlier-placed unit is drawn.** When a seat's Placement opens,
  the board already shows every unit in `session.gameState.units` owned by
  another seat. These are the units of every seat that placed before it, human
  or computer. They are shown in the Standard view and the Drawn view, from
  the first frame, before any click. The placing seat's own units are drawn
  as today.
- **B2. Earlier units are dimmed.** Every unit not owned by the placing seat is
  drawn at the alpha `DIMMED_UNIT_ALPHA = 0.6`, in both views. The placing
  seat's own units stay opaque. A dimmed unit keeps:
  - in the Standard view, its owner's counter image (or text-chip fallback);
  - in the Drawn view, its owner-coloured base, figure and base shape.

  A dimmed galley in the Drawn view points its facing, as it does on the
  Board. In the Standard view, an earlier seat's ship gets its facing
  arrowhead in its owner's colour, at the same alpha. The placing seat's own
  arrows and the staged ship (the ghost, `GHOST_ALPHA`) are unchanged.
- **B3. Dimming lasts.** A unit stays dimmed when the view is toggled either
  way, after a placement, after a ship is staged, turned, confirmed or
  cancelled, and after undo or redo. The Drawn view's `settle` must not bring
  a dimmed unit back to alpha 1.
- **B4. Earlier units can't be touched.** Placement has no unit selection, and
  none is added. A click on an earlier unit's hex places nothing, stages no
  ship and changes no state, history, queue or button.
- **B5. Their hexes are never accepted.** An earlier unit's hex, and every hex
  within 4 of it, stays out of the green band as today (`legalDeploymentHexes`
  and `legalNavalDeploymentHexes`, unchanged). In the boxed-in fallback the
  band may include such a hex: see I2.
- **B6. Undo and redo touch only the placing seat's units.** An undo or redo
  in seat N's Placement adds or removes only seat N's units. The earlier
  seats' units stay drawn, dimmed and in place through every undo and redo,
  and their count never changes.
- **B7. The tooltip agrees with the board.** Hovering an earlier unit's hex
  shows exactly what §74 gives it in Placement today: the hex line, then the
  name, owner and colour line, then the values line, with no state line (§74
  B2, B6). Hovering a hex shows unit lines if and only if a unit is drawn on
  it.
- **B8. A computer seat's deployment appears for the next human seat.** When
  one or more computer seats deploy before a human seat (`skipAiPlacementSeats`),
  their units are drawn, dimmed, from the first frame of that human seat's
  Placement. As today, there is no screen or animation for the computer's
  deployment.
- **B9. The wording is corrected.**
  - The comments at `PlacementScene.ts:315-316` and `:330-331` (or wherever
    the drawing code goes) say that the scene draws every placed unit, with
    the other seats' units dimmed, and that the rules hide nothing
    (`05-rules-french-original.md:91-96`).
  - `README.md:158-159` drops "that are not drawn on the screen".
  - `README.md`'s Placement step (`:91-96`) says that earlier armies are shown
    dimmed and their gap shapes the band.
- **B10. The Board is unaffected.** `BoardScene` never sets the dim flag. Every
  unit on the Board is drawn as today, at full opacity in both views, and the
  Board's facing arrows are unchanged. The Army Builder, Menu and Game Over
  scenes are untouched.

## Interpretations

No rulebook passage is ambiguous here: the rules hide nothing. The readings
below are about the screen. Each becomes a comment at its site.

- **I1. "Distinct" means dimmed, with the owner colour kept (B2).** The owner
  colour says whose army it is. The alpha says "not yours to move here". A
  muted outline would differ between a counter image and a figure. A
  desaturated colour could collide with another player's hue. Comment at the
  dim constant.
- **I2. "Their hexes are not legal" relies on the gap rule and the occupied
  check, not on a new filter (B5).** In the normal case the 4-hex gap already
  keeps every earlier unit's hex out of the band. In the engine's boxed-in
  fallback (`deployment.ts:172-177`), the band is the whole edge, and an
  earlier unit's hex can be shown green. The click still does nothing, because
  `tryPlace` (`PlacementScene.ts:424-425`) and `deployUnit`
  (`deployment.ts:315-317`) refuse an occupied hex. Taking occupied hexes out
  of the highlight would also un-green the seat's own placed units, which
  today stay green. That is a separate change, and the fallback is rare.
  Comment where the scene computes or highlights the legal hexes, if the plan
  touches that code. Otherwise put it in the drawing helper's doc.
- **I3. "Earlier" means "owned by another seat" (B1).** Placement runs seat by
  seat in index order (`PlacementScene.ts:538-546`), and computer seats are
  deployed in the same order (`aiSetup.ts:65-68`). So every unit in state not
  owned by the placing seat belongs to an earlier seat. The scene uses the
  same test for `enemyHexes` (`:126`). Comment in the helper.

## Acceptance criteria

- **AC1 (B1, B2, B8, I3).** A pure helper in `src/ui/`, for example
  `placementUnitDrawings(state, playerIndex)`, tested in a new `src/ui/*.test.ts`:
  - every living unit in state gives one drawing;
  - units of other seats are dimmed and the placing seat's are not;
  - a ship keeps its facing, and a land unit has `facing` undefined (as
    `PlacementScene.ts:326` does today);
  - a state built with `autoDeploy` for a computer seat 0, then read for seat 1,
    gives every seat-0 unit, dimmed.
- **AC2 (B2).** The same helper, or a sibling, gives the Standard view's
  facing list: every placed ship of every seat, earlier seats' ships dimmed,
  plus the staged ship as a ghost, undimmed. A unit test covers each case.
- **AC3 (B2, B3).** `src/ui/boardView.test.ts`:
  - a pure `unitAlpha(drawing)` (or the like) gives 1 without the flag and
    `DIMMED_UNIT_ALPHA` with it;
  - `reconcileUnits` treats a change of the flag as an update with
    `recreate`, so a view never keeps a stale alpha.

  `viewDrawingState.test.ts` checks that a replay keeps the flag.
- **AC4 (B1, B4, B5, B6, B7).** A new e2e scenario, in `e2e/placement.spec.ts`
  or its own file. Route: Menu "2", default army for each seat, seat 0 places
  two land units, then **Done placing**. In seat 1's Placement:
  - `placement().legalHexes` holds no hex within 3 of a seat-0 unit;
  - a click on a seat-0 unit's hex leaves `state().units.length` unchanged;
  - hovering a seat-0 unit's hex gives `tooltipText()` with seat 0's name line
    and no state line;
  - after toggling to the Drawn view, `boardObjects().unitDrawings` equals the
    number of living units (seat 0's included, via the existing
    `expectDrawnObjects`), and `unitCanvas(<seat-0 id>)` is not null;
  - after seat 1 places one unit and then presses Undo, the seat-0 units are
    still in state and still counted in `unitDrawings`. After Redo, seat 1's
    unit is back.

  The scenario uses only readers that already exist on `window.__heraklios`.
  It needs no `devHook.ts` change (see "Non-functional").
- **AC5 (B10).** Review checks that `git diff main -- src/scenes/BoardScene.ts`
  is empty. `npm run e2e` stays green, including `board-view.spec.ts` and
  `board-animations.spec.ts`, which draw the Board in both views. The Board's
  full opacity is part of the live check (AC7).
- **AC6 (B9).** Review reads the comments and README lines named in B9.
- **AC7 (B2, B3, B8, B10, I1).** Live check (owner):
  - In a 2-player game in both views, seat 1 sees seat 0's army dimmed and
    readable. The owner judges whether 0.6 reads well. A value from 0.4 to
    0.75 can be set without a spec amendment.
  - Dimmed units stay dimmed through a view toggle, an undo and a redo.
  - Seat 1's staged ship is still told apart from seat 0's dimmed galleys.
  - Seat 0's ships show their facing in both views.
  - With seat 0 played by the computer, the human seat 1 sees its army.
  - The Board shows every unit at full opacity in both views.

## Non-functional

- **Engine/presentation split:** presentation only. No change under
  `src/engine/` or `src/data/`. The gap rule, `deployUnit`, `autoDeploy` and
  the legal-hex functions stay as they are. The choice of which drawings are
  dimmed, and their facing list, is a pure, tested `src/ui/` helper. The
  scene only calls it.
- **The view seam:** one optional flag on `UnitDrawing` (for example
  `dimmed?: true`), and the same flag on `FacingShip` for the Standard arrows.
  Both views apply one shared constant, `DIMMED_UNIT_ALPHA`, through one shared
  pure function. Neither view keeps its own copy of the value. The Drawn view
  applies it in `make` and `settle`. The Standard view applies it in
  `makeMarker` and `setFacingIndicators`. That needs an alpha on
  `drawFacingArrowhead`, defaulting to 1, so its other callers are unchanged.
- **Size ceiling:** `PlacementScene.ts` is at its ceiling (548). The plan keeps
  it at 548 or below by moving the drawing list out to the helper (AC1, AC2).
  If it can't, the plan carries a `budget:` line (`docs/architecture.md`
  §13), and the logic still goes in `src/ui`. No other file in
  `size-baseline.json` is touched.
- **Save format:** unchanged. No `GameState` field, no `SAVE_VERSION` bump.
- **Undo boundaries:** unchanged. No die roll, no phase change. Placement's
  history still holds only the placing seat's snapshots.
- **AI / harness:** unaffected. `legalActions`, `applyAction`, the fuzz
  harness and `autoDeploy` don't change.
- **Dev hook:** not changed, so no conflict with §75, which is splitting
  `installDevHook`. A reader for a unit's drawn alpha is left out. Dimming is
  proved by AC1-AC3 and the live check.
- **Live check:** owed (`src/scenes/**`, `src/ui/**`, and the change is
  visual). The smoke-suite exception doesn't apply.

## Out of scope

- Hidden or simultaneous deployment as an option.
- Showing a computer seat's deployment as it happens, or animating it.
- A hand-over notice such as "N units already placed" (A3).
- A separate mark for the gap or the excluded hexes (A2).
- Taking occupied hexes out of the green band (I2).
- Any change to the Board's drawing, or to a unit's look outside Placement.
- A dev-hook reader for alpha.

## Assumptions I made

- **A1. Distinct look: dimmed (the coordinator's decision on the intent's
  first open question).** Earlier seats' units are drawn at reduced alpha in
  both views, through a flag on `UnitDrawing` (and `FacingShip` for the
  Standard view's arrows). Their owner colours stay. The value is 0.6: more
  solid than the staged ship's 0.5, so the two don't read alike, and
  translucent enough that the placing seat's own units stand out. The live
  check judges it (AC7).
- **A2. The gap is not marked separately (the coordinator's decision on the
  second open question).** The green band, already shaped around the units now
  on screen, is enough. With the units visible, the hole they cut in the band
  explains itself.
- **A3. No hand-over notice (the coordinator's decision on the third open
  question).** Drawing the units is enough. A notice would need new i18n
  messages and HUD space, and the board already shows the armies.
- **A4. An earlier seat's ship shows its facing in the Standard view, dimmed
  (B2).** The Drawn view shows it anyway, by turning the galley. Without an
  arrow, the Standard view would hide what the Drawn view shows. The arrow is
  dimmed with its counter, so a bright arrow doesn't sit on a faded counter.
- **A5. Placement keeps the alpha through `'snap'` only.** Placement never
  animates (§66 B13, `PlacementScene.ts:327`), so the Drawn animator's fade
  (`drawnMotions.ts:72-74`) never runs on a dimmed unit there. The spec asks
  only that `settle` respect the flag (B3).
- **A6. §74's `blocked_by` is met.** §74 is merged (`e80f74a`). The
  `blocked_by: 74` line in `metadata.yml` no longer blocks. Clearing it is
  bookkeeping for the coordinator, not for this spec.

## Questions for the owner

None open. A1-A3 are the coordinator's decisions, and A4 is mine. Override any
of them at acceptance if you want a different look.
