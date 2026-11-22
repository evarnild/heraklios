<!-- generated-by: heraklios/intent@0.1.5 -->
# §83 — Ending the movement phase with unmoved units shows them and asks to confirm

**Type:** feature
**Originator:** the owner (2026-11-22): "when the end phase for move is
clicked and there are still units who have not moved at all, unzoom the map
to be able to see it whole and mark the units that have not moved. Then say
that some units have not moved and propose to cancel end phase or confirm".
**Source:** none (a request while playing).

## Problem

Clicking **End phase** in the movement phase (`BoardScene.ts:629-639`,
`endPhase`) ends the phase at once. A unit that was never moved stays where
it is for the whole turn.

On a large board, a unit off-screen or behind the panels is easy to forget,
and the mistake can't be undone. The phase change clears the undo history
(CLAUDE.md, "Phase changes are also a boundary").

## Outcome

- **The prompt.** When the active human player clicks End phase in the
  movement phase while at least one of their units has not moved at all
  (full `movementLeft`, no move this phase), the phase does not end straight
  away. Instead:
  1. **Zoom out.** The map zooms out so that the whole board is visible, or
     at least every unmoved unit.
  2. **Marking.** Every unmoved unit is marked clearly.
  3. **The message.** A message says that N units have not moved.
  4. **The choice.** Two buttons:
     - **Cancel** keeps the movement phase. The markings go, and the camera
       returns to where it was.
     - **End phase anyway** ends the phase as today.
- **No prompt otherwise.** When every unit has moved, End phase works exactly
  as today.
- **Units that cannot move.** A unit counts as unmoved only if it could have
  moved. A unit with no legal move is not flagged. The spec settles this.
- **What is unchanged.** The combat phase's End phase, computer seats (no
  prompt) and the rules.

## Constraints

- **The fact comes from the engine.** "Unmoved" is decided there, for
  example by `movementLeft === type.movement` and not `charged`. The spec
  confirms this against how moves update `movementLeft`.
- **"Could have moved".** If the spec uses it, it comes from
  `legalActions`.
- **Undo history.** The prompt changes nothing in the game. Cancel leaves the
  undo history intact. Only the confirmed end clears it, as today.
- **Camera.** The zoom-out uses `MapView`'s existing zoom and centre. Cancel
  restores the previous scroll and zoom.
- **Size.** `BoardScene.ts` is at its ceiling. The prompt and its layout go
  into a `src/ui` module, and the scene keeps at most a net-neutral hook in
  `endPhase`. If the scene must grow, the plan adds a budget line.
- **Text.** All text goes into `en.ts` and `fr.ts`.
- **Related to §82.** §82 marks unmoved units all the time. This intent
  reuses the same engine fact. The two don't block each other.
- **Live check owed:** visual and new.

## Type-specific questions

### Feature
- **Users:** hotseat players. Computer seats are never prompted.
- **Rulebook basis:** digital-only. The rules let a player leave units
  unmoved.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. **Zoom.** Zoom out to the whole board, or just enough to frame every
     unmoved unit? The draft assumes the whole board, as asked.
  2. **The mark.** A pulsing ring, a coloured highlight, or §82's
     "not moved" marker enlarged?
  3. **Partly moved units.** Should they also be listed? The owner asked
     about units "who have not moved at all", so the draft assumes no.
  4. **Ships.** Are unmoved ships included? The draft assumes yes.
  5. **Turning it off.** Can a player switch the warning off for the rest of
     the game? The draft assumes no.

## The owner's answers (2026-11-22)

1. **Zoom:** just enough to frame the unmoved units, making sure every unit
   that has not moved yet is visible. Not the whole board.
2. **Mark:** a coloured rectangle drawn in the centre of each unmoved unit.
3. **Partly moved units:** not listed. Only units that have not moved at all.
4. **Ships:** included.
5. **Turning it off:** yes. A player can switch the warning off for the rest of
   the game.

## Assumptions I made

- **Type:** feature. This is new interaction.
- **Tier:** set by the path table, so `review_tier` is left empty.
- **Id:** 83.
- **No blocker.** It doesn't need §82's markers. If both are built, the spec
  may reuse §82's not-moved fact.
- **Overlap with §73.** §73 rewrites combat settling in `BoardScene`. This
  intent only touches `endPhase`'s movement branch.
