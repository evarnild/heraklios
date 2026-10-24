<!-- generated-by: heraklios/intent@0.1.5 -->
# §57 — Every "continue" in an elephant drift shows something

**Type:** fix
**Originator:** the owner, while playing (2026-10-24): "When it starts, the
first time one pushes on continue, nothing happens. next time, it determines
the direction. next time nothing happens. please check why nothing happens"
**Source:** none

## Problem

During an elephant drift on a human seat's turn, the board pauses with a
"continue" button between steps (plan-history §21). Some of those pauses
show nothing new, so the player clicks "continue" and nothing visibly
happens.

**Why (found by reading the code at `e309c1c`):**
`resolveElephantDrift` (`src/engine/drift.ts:552-660`) awaits the `onStep`
pause after **every** event of a step (`:619-623`), including the events that
only ask the driver for input and that no hook narrates or renders:
`directionRollNeeded`, `combatRollNeeded` and `retreatResolutionNeeded`
(no case in the switch at `:566-617`; `formatDriftEvent` returns null for them,
`src/ui/i18n/format.ts:21-44`). `directionForbidden` (a rolled direction
that is refused, `drift.ts:241`) is silent too. So:

1. `driftStarted` is narrated → pause (the player reads "forced to drift").
2. Click → the next event is `directionRollNeeded`: nothing narrated or
   drawn → **pause with nothing new** ("nothing happens").
3. Click → the driver rolls; `directionRolled` is narrated and the arrow is
   drawn → pause ("it determines the direction").
4. Before each later direction or combat roll the same silent
   `…RollNeeded` pause comes back ("next time nothing happens").

The test suite pins this: `src/engine/drift.test.ts`'s expected hook traces
(`EXPECTED_MOVE_AND_STOP` and the others, `:21-60`) contain two `onStep`
in a row after `onNarrate:driftStarted`, and again before `onCombat`.

## Outcome

- Every pause in a drift follows a visible change: a narrated log line, a
  redraw, the direction arrow, or a combat report. No pause follows an event
  that only requests input (`directionRollNeeded`, `combatRollNeeded`,
  `retreatResolutionNeeded`).
- A refused direction (`directionForbidden`) is either narrated, so its pause
  shows something, or doesn't pause; the plan picks, and says which.
- A drift with no `onStep` hook (the AI, the fuzz harness, headless tests)
  produces the same events and results as today.

## Constraints

- **Engine/presentation split:** the fix belongs in `src/engine/drift.ts`'s
  driver loop (which events pause), not in `BoardScene`'s button.
- **Rulebook:** none changes; the drift rules
  (`docs/research/05-rules-french-original.md`, the elephants passage) and
  `driftStep`'s state machine are untouched.
- **Determinism:** the dice sequence and the event order stay identical
  (`drift.test.ts`'s "identical event trace and stats" test).
- **Undo, save format, AI:** unchanged.

## Type-specific questions

### Fix
- **What broke:** a "continue" click during a drift sometimes shows no
  change; expected: each click shows the next step.
- **Since when:** `6807cf4` ("Pause elephant drift for human seats and show
  its direction on the map", plan-history §21), which added the `onStep`
  await after every event. That change predates the intents folder, so no
  `follows_up` id.
- **Impact:** every human-seat drift, on every leg (start, each new
  direction roll, each trample's combat roll). Confusing, not corrupting: no
  game or save is affected.
- **Reproduction:** "Combat test mode" (or any game) with elephants; attack
  so an elephant is forced to drift (an AR/AE result against an elephant
  attack, or a trample); click "continue" at each pause and watch for one
  with no new log line or arrow. Headless: `resolveElephantDrift` with a
  hook recorder, as `drift.test.ts` does.
- **The test that will fail first:** `src/engine/drift.test.ts`: a new test
  asserting that each `onStep` call is preceded by at least one visible hook
  (`onNarrate`, `onRender`, `onDirectionRolled`, `onCombat`) since the
  previous `onStep`, over the move-and-stop, destroyed and repelled traces.
  Today it fails at the second `onStep`. The expected traces
  (`EXPECTED_MOVE_AND_STOP` etc.) are then updated to one `onStep` per beat.

## Assumptions I made

- The silent pauses are the request events above; the owner's "next time
  nothing happens" is the `directionRollNeeded` (or `combatRollNeeded`) of
  the next leg or trample.
- Tier: Attested by the path table (`src/engine/**`).
- A live check is likely owed by rule 3 (the pacing only shows in a real
  run); the review decides.
