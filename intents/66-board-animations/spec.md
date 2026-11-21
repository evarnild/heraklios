<!-- generated-by: heraklios/spec@0.1.0 -->
# §66 spec — The vector view animates moves, combats and drifts

Accepted intent: [intent.md](intent.md)

Written against `main` at `b7ffcbd`.

The intent's "vector view" is the view §64 shipped as the **Drawn view**
(`src/ui/drawnBoardView.ts`, toggle label "🗺 Drawn view"). This spec uses
that name.

**The owner's decisions (2026-11-05)**, from `intent.md` → "Settled by the
owner": "a speed setting (Off / Normal / Slow) rather than a fixed pace; any
action cuts an animation short rather than waiting." The four open design
questions are decided below (B3, B9, B10, B13) and listed under Assumptions.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/66-board-animations/intent.md` | Outcome, constraints, the owner's two decisions, the four open questions. |
| `src/ui/boardView.ts:8-16`, `:96-124` | Units are drawn by id (`UnitDrawing`), and `reconcileUnits` already tells a moved or re-faced unit (`update`) from an added or removed one: "a moved or re-faced unit is an `update`, never a remove plus add". The animation reads this diff. |
| `src/ui/drawnUnits.ts:91-104` | Today an `update` destroys the unit's container and makes a new one at the new hex: the jump this intent replaces. |
| `src/ui/boardViewPreference.ts` | The precedent for a remembered choice: `localStorage` key `heraklios.boardView`, kept in memory when storage is unavailable, "Not part of a save (§64 B4)". |
| `src/engine/actions.ts:66-74` | `landMove` and `navalMove` carry only `to` (and an optional `facing`), so a move's path is not known to the scene. |
| `src/engine/movement.ts:75` | `reachableHexes` "returns costs only" (intent): a `Map<string, number>` of hex key to cost. |
| `src/engine/movement.ts:322-361` | `evaluateCharge`: a charge is "a single straight hex-line", and its cost "can differ from `reachableHexes`'s cheapest-path cost". |
| `src/engine/navalMovement.ts:57-94` | `reachableNavalStates`: a Dijkstra over (hex, facing) states, rotation 1 point per 60°, forward through the bow only. It keeps the best cost per state but no predecessor. |
| `src/engine/combat.ts:935-1019` | `applyLandCombatResult` destroys at once (AE, DE, EX, a retreat with nowhere to go) and lists `pendingRetreats` and `pendingDrifts`, which the caller resolves "one at a time". |
| `src/engine/drift.ts:93-114`, `:143-174` | The drift's `DriftEvent`s, and `onStep`, awaited once per visible beat when a human is free to look (`BoardScene.driftOnStepHook`, `BoardScene.ts:234-237`). |
| `src/scenes/BoardScene.ts:96-111`, `:3026-3063` | The computer's pacing: `AI_MOVE_DELAY_MS = 160`, `AI_COMBAT_DELAY_MS = 700`, a pause "AFTER the action, not before". (The intent cites `:94-96`; the lines moved.) |
| `src/scenes/BoardScene.ts:904-929` | `renderAllUnits`: every state change reaches the view as one `setUnits` with all living units, plus the drift arrow from scene state. |
| `src/ui/devHook.ts:240-244` | `idle()` already counts running tweens, so e2e waits for an animation to end. |
| `plan-history.md` (§6.4 brief, line 104) | The origin of the AI pacing: "turn pacing/animation so AI moves are legible". |

## Behaviour

**What animates (Drawn view only)**

- **B1. Movement.** A land unit's move (`landMove`) slides hex by hex along
  its path: the cheapest path the move's cost came from, or, for a cavalry
  charge, the straight line `evaluateCharge` walked. A ship's move
  (`navalMove`) follows its (hex, facing) path, turning in place at each
  rotation and sliding at each forward step. A Turn button (`navalRotate`)
  turns the ship's figure by 60°. A swap (`landSwap`) slides the two units
  across each other at the same time.
- **B2. Land combat.** A land attack plays a **clash**: each attacker lunges
  part-way toward the defender hex it fights and back, then the result shows.
  An eliminated unit fades out at its hex. A retreat, a push, an advance and
  an exchange sacrifice each animate when they are committed, in the order
  the game already commits them (the retreat queue "one at a time", then the
  advance offer): a moved unit slides, a removed one fades.
- **B3. Naval combat.** A ram plays the rammer lunging into the target's hex
  side and back, then the result: on a hit the target fades ("A successful
  ram sinks the target ship outright", `combat.ts:1092-1097`); on a miss the
  target shakes. A boarding plays a clash between the two ships, then the
  result: a ship whose equipment reaches zero fades; the ship that lost
  equipment and survives shakes; an undecided boarding shows no result
  (`applyBoardingResult`, `combat.ts:1099-1111`). The shake needs the
  result, which the unit drawings do not carry, so it comes with the cue.
- **B4. Elephant drift.** Each drift beat animates as it is committed: a hex
  entered slides the elephant one hex; a trample plays a clash at the
  occupant's hex, then its result as in B2; an elephant that dies (destroyed,
  or leaving the land zone) fades. The drift arrow appears at the elephant's
  hex once its slide has ended, not before.
- **B5. Anything else that changes the units** without one of the cues above
  (for example a unit appearing) shows at once, as today.

**The game is unchanged**

- **B6. The state changes at once; the animation only shows it.** Every
  action is applied to `GameState` exactly when it is today, at every speed.
  The rules, the log, the saves, autosave, undo and redo, the computer's
  choices and the dice are the same at Off, Normal and Slow. Highlights,
  labels and the movement-points readout show the new state immediately.
- **B7. Snaps, not animations.** Undo, redo, loading a game, starting the
  Board, and switching view draw the new state at once, with no animation,
  after finishing any animation in progress (B9).
- **B8. Redraws that change nothing don't disturb an animation.** A
  `setUnits` whose units equal what the animation is heading to (a
  selection, a highlight, a log line) neither restarts nor finishes it.

**Cut short**

- **B9. Any action finishes every animation now.** A click anywhere on the
  page's canvas (board, HUD button, prompt) or any key press, while an
  animation is playing or queued, first brings every unit to its final
  drawing at once (the whole queue, not only the current animation), then
  acts as it would have with no animation. Nothing is lost or replayed.
- **B10. The drift continue prompt.** During a paced drift (a human is free
  to look, `driftOnStepHook`), the continue prompt is up while the beat
  animates; a continue (click, Space, Enter, or the button) during the beat
  finishes it (B9) and continues.

**Computer turns**

- **B11. Computer turns animate at the chosen speed.** After applying each
  of its actions, the computer waits until that action's animations have
  finished, then waits its existing delay (`AI_MOVE_DELAY_MS`,
  `AI_COMBAT_DELAY_MS`). At Off it waits the delay only, as today.
- **B12. A click or key during a computer turn** finishes the animations
  (B9); the computer goes on with its next action. The computer turn itself
  is not interrupted (the Pause button keeps its meaning).

**The speed setting**

- **B13. A speed button on the board**, in the Drawn view only, next to the
  view toggle. Each click steps Normal → Slow → Off → Normal, and its label
  names the current speed. It is not on the Menu, and not in Placement
  (Placement does not animate).
- **B14. Remembered** like the view: `localStorage` key
  `heraklios.animationSpeed`, read once, kept in memory when storage is
  unavailable, never part of a save. An absent or unknown stored value is
  Normal.
- **B15. Durations.** At Normal: a hex step 180 ms; a 60° turn 120 ms; a
  clash 350 ms; a ram 400 ms; a fade 300 ms; a shake 200 ms.
  Slow is exactly twice Normal. Off is no animation at all (the unit jumps,
  as today). A path of n hexes takes n steps; nothing is capped.
- **B16. A change of speed** takes effect from the next animation; one
  already playing keeps its speed.

**The Standard view**

- **B17. The Standard view does not animate**, at any speed, and shows no
  speed button. It behaves exactly as today.

## Interpretations

No rulebook passage is involved (the intent: "Rulebook basis: digital-only").
Two readings of the intent are recorded here, each as a comment at its
implementation site:

- **I1. "The order of a combat's consequences".** The intent's constraint
  says the engine lacks it and that "any such description is a pure, tested
  engine function or event list, never re-derived in a scene". The order
  already exists: `applyLandCombatResult` applies what is immediate and lists
  what is pending, and the scene and the drift state machine commit the rest
  one change at a time. Reading: the view animates the difference between
  successive committed drawings, in commit order, and nothing re-derives a
  consequence. The only new engine descriptions are the movement paths
  (B1), plus a pure cue saying which units clash for an action and, for a
  ram or a boarding, which surviving ship shakes (B2, B3, B4).
- **I2. "A click or key finishes the current animation instantly"** with a
  queue (a drift's beats, a combat's results, a computer's moves). Reading:
  it finishes the whole queue (B9), because everything queued is already
  committed state, and finishing only the head would leave the board showing
  a past state while the player acts on the present one.

## Acceptance criteria

- **AC1 (B1).** For every reachable land destination, the land path starts
  next to the unit, steps between adjacent hexes, ends at the destination,
  and its cost equals `reachableHexes`' cost for it; for a qualifying charge
  it is the straight line and its cost equals `evaluateCharge`'s. Test:
  `src/engine/movement.test.ts` (on the shipped map, including the
  `(10,1)` to `(14,1)` light-cavalry case where the two differ).
- **AC2 (B1).** For every reachable naval (hex, facing) state, the naval path
  is a sequence of single rotations and bow-forward steps, ends at that
  state, and its cost equals `reachableNavalStates`' cost; `navalMove` with
  and without `facing` follows the state `applyAction` lands on. Test:
  `src/engine/navalMovement.test.ts`.
- **AC3 (B2-B4, I1).** The clash cue for a land attack, a ram, a boarding and
  a drift trample names the right units and hexes. Test: the engine test
  file of the module that holds it.
- **AC4 (B1-B5, B8, B15).** The animation planner (pure, in `src/ui/`): from
  the drawn units, the new units, the cue and the speed, it produces the
  right steps and durations; equal drawings produce nothing; Slow is twice
  Normal; Off produces none. Test: a new `src/ui/*.test.ts`.
- **AC5 (B14).** The speed resolves like the view: only exactly `normal`,
  `slow` or `off` is taken; anything else is Normal; storage failure keeps
  the in-memory value. Test: a new `src/ui/*.test.ts`.
- **AC6 (B6, B17).** Headless play is unaffected: the fuzz harness and
  `actions.test.ts` stay green and unchanged in their expectations. Test:
  `npm run verify`.
- **AC7 (B9, B11, B13).** A new e2e scenario in the Drawn view at Normal: a
  land move animates (`idle()` is false during it, the unit's container
  passes through an intermediate hex) and ends on the clicked hex; a click
  during a second move finishes it at once and the click acts; the speed
  button cycles and is remembered across a reload; in the Standard view no
  tween starts on a move. Test: `e2e/board-animations.spec.ts`.
- **AC8 (e2e speed).** Every other e2e scenario runs with animations Off and
  the suite's run time does not grow by more than its run-to-run noise.
  Check: `npm run e2e` timings quoted in the review.
- **AC9 (B2-B4, B10-B12, B15, B16).** Live check (owner): in the Drawn view
  at Normal and Slow, a move, a charge, a ship move with turns, a swap, a
  land attack with retreat and advance, an exchange, a ram, a boarding, an
  elephant drift with a trample (human-paced and in a computer turn), and a
  computer turn look right and can be cut short.

## Non-functional

- **Engine/presentation split:** the paths (land, charge, naval) and the
  clash cue are pure engine functions with tests (`src/engine/`). The
  animation planner and the speed preference are pure `src/ui/` modules with
  tests. The tweens live in the Drawn view (`drawnUnits.ts` or a sibling),
  and the scene only passes the cue with the render and waits on the view
  for B11.
- **Save format:** unchanged. No `GameState` shape change, no
  `SAVE_VERSION` bump. The speed is not saved (B14).
- **Undo boundaries:** unchanged. No new die roll or phase change; undo and
  redo snap (B7).
- **AI / harness:** `legalActions`, `applyAction` and the fuzz harness are
  unchanged. The path functions are new callers of the movement search, not
  a change to it. The computer's choices are unchanged; only the wait
  after each action grows by the animation's length (B11).
- **e2e:** the suite runs at Off (B14's key set before each page load, except
  in the new scenario), so it stays as fast as today; `devHook.idle()`
  already waits for tweens.

## Out of scope

- Animation in the Standard view (B17) and in Placement.
- Animating overlays (highlights, rings, labels, the facing arrows); they
  change at once (B6).
- Sound, particles, camera moves that follow an animation, and a 3D look.
- A speed setting on the Menu.
- Pacing changes to the drift's continue pauses beyond B10.

## Assumptions I made

- **Where the speed lives (open question 1):** on the board only, in the
  Drawn view, next to the view toggle (B13). It matters only there, and the
  intent's Outcome already says "on the board and remembered".
- **The durations (open question 2):** B15's values, picked so a typical
  4-hex move takes under a second at Normal; the live check (AC9) is where
  the owner judges them.
- **Cut short with a queue (open question 3):** the whole queue finishes
  (B9, I2).
- **The Standard view (open question 4):** gets nothing (B17), matching the
  intent's own assumption "Animations exist only in the vector view unless
  the spec says otherwise".
- **Default speed:** Normal, so a player who picks the Drawn view sees the
  feature without hunting for it.
- **B12:** clicks during a computer turn are otherwise ignored today
  (`aiRunning`); finishing the animations is the only effect they gain.
- **The "shake"** (B3) is the one result cue for a ship that survives a ram
  or a boarding; its exact look is the live check's.
- **Tier:** Attested by the path table (`src/ui/**`, `src/scenes/**`,
  `src/engine/**` not listed as Reviewed). Live check owed (rule 1).
