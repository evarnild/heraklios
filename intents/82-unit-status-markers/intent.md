<!-- generated-by: heraklios/intent@0.1.5 -->
# §82 — Each unit shows whether it has moved, charged, attacked or been attacked this phase

**Type:** feature
**Originator:** the owner (2026-11-22): "in the move phase, show a small
visual indicator on each unit to say: whether it has not moved yet, moved yet
but not all points, fully moved and whether a charge has been trigerred for
cavalry. In the attacke phase, I want an visual indicator that shows, if a
unit can attack, has already attacked, has already been attacked".
**Source:** none (a request while playing).

## Problem

A unit's state for the current phase is invisible on the board.

- **Movement phase.** The game tracks how far each unit has moved
  (`unit.movementLeft`, `src/engine/state.ts:23`) and whether a cavalry unit
  has charged (`unit.charged`, `:40`). The board shows neither. A player has
  to click or hover each unit to find out which units are still to move:
  §74's tooltip shows "movement left N" and "charged".
- **Combat phase.** The game tracks which units have attacked
  (`attackedThisPhase`, `BoardScene.ts:171`; `actions.ts:473`) and refuses a
  second attack with a log line ("has already attacked this phase",
  "has already been attacked this phase", `en.ts:278`, `:283`). None of this
  is drawn. So the player cannot see at a glance which units can still
  attack, or which enemies are no longer valid targets.

On a crowded board, this makes it easy to forget a unit or to click into
refusals.

## Outcome

- **Movement-phase marker.** Each of the active player's units carries a
  small marker with one of three states:
  - **not moved:** full movement left;
  - **partly moved:** some movement used, some left;
  - **done:** no movement left.

  A cavalry unit that has charged also carries a **charge** mark.
- **Combat-phase marker.** Each unit carries a small marker for its state in
  this phase:
  - **can attack:** the active player's unit has not attacked and has a
    legal target;
  - **has attacked:** the active player's unit has attacked;
  - **has been attacked:** any unit that has already been attacked, so it
    can't be targeted again.
- **The markers change instantly.** They update the moment the state changes:
  a move, a charge, an attack, undo or redo, and a phase change.
- **Both views.** The markers work in the Standard view and the Drawn view.
  They stay readable, and they don't hide the counter's printed values or a
  figure. They follow a unit's animated move (§66/§77), or appear at its end
  state.
- **A view-only aid.** The markers change no rule. The facts come from the
  engine and the session's attacked sets, never worked out in the scene.

## Constraints

- **Rule basis.** No new rule. The markers show existing state:
  `movementLeft`, `charged`, and the attacked and rammed sets.
  - "Can attack" uses the same legality the engine uses, `legalActions`, or
    `attackerCanJoin` and its relatives.
  - Ramming, boarding and naval units: the spec decides whether they get
    markers, and which ones.
- **Engine and presentation.** A pure function returns each unit's status
  for the phase, with unit tests. The views only draw it.
- **The drawing seam.** `UnitDrawing` (or a sibling) carries the status, so
  that both views draw it.
- **Blocked by §77.** §77 is in review and rebuilds both views' unit layers
  (`unitLayer.ts`, `standardUnits.ts`). Markers drawn before it lands would
  have to be redone.
- **Size.** `BoardScene.ts` is at its ceiling, so the logic goes in
  `src/engine` and `src/ui`.
- **Live check owed:** it is visual and new.

## Type-specific questions

### Feature
- **Users:** hotseat players. For computer seats, the markers simply show as
  the computer acts.
- **Rulebook basis:** digital-only. It visualises existing rules.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. **Look.**
     - **Movement:** a small dot or pip in a corner of the unit, coloured
       green, then amber, then grey for not moved, partly moved and done.
       Or a fraction ring.
     - **Charge:** a small lance or chevron.
     - **Combat:** a sword for "can attack", a tick for "has attacked", and a
       shield or cross for "has been attacked".
     - The draft assumes coloured dots plus a small charge chevron.
  2. **Whose units.** Movement markers for the active player only, or for
     everyone? The draft assumes active only: the others don't move this
     phase. In combat, "has been attacked" applies to any player's units.
  3. **"Can attack" with no legal target.** Show nothing, or a distinct "no
     target" state?
  4. **A toggle.** Should the markers be switchable off, for example with the
     view or speed buttons?
  5. **Placement.** The draft assumes no markers in Placement.

## The owner's answers (2026-11-22)

1. **Look:** coloured dots for the three movement states, plus a small
   chevron for a charge, as the draft assumed.
2. **Whose units:** movement markers on the active player's units only, as the
   draft assumed. In combat, "has been attacked" shows on any player's units.
3. **"Can attack" with no legal target:** show nothing.
4. **Toggle:** none. The markers are always on.

## Assumptions I made

- **Type:** feature. It is a new visual layer.
- **Tier:** set by the path table, so `review_tier` is left empty.
- **Id:** 82.
- **Blocked by §77:** recorded for the reason under Constraints.
- **One intent, not two.** Movement and combat markers share one layer, so
  they are kept together. The spec can split delivery.
