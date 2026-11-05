<!-- generated-by: heraklios/intent@0.1.5 -->
# §66 — The vector view animates moves, combats and drifts

**Type:** feature
**Originator:** the owner (2026-11-05), splitting §64: the animations are
their own intent, after §65 (the view seam) and §64 (the static vector view)
**Source:** `intents/64-vector-view/intent.md` (the owner's original request:
"animated units movements and combats")

## Problem

With §64, the vector view draws a landscape and unit figures. But like the
standard view, it shows the result of an action at once: a moved unit is in
its new hex, a retreat has happened, an eliminated unit is gone. A player
reads the action from the log. The owner wants to see it happen.

## Outcome

- In the vector view, these animate:
  - **movement**: hex by hex along the path, ships turning to their facing,
    a swap's two units crossing;
  - **land combat**: the clash, then its result (retreat, push, advance,
    elimination, exchange);
  - **naval combat**: ramming and boarding;
  - **the elephant drift**: step by step, with its trampling.
- A **speed setting** (Off, Normal, Slow), on the board and remembered.
- **Any action cuts an animation short:** a click or key finishes the
  current animation instantly, then acts as usual.
- Computer turns animate too, at the chosen speed.
- The standard view does not animate (or animates nothing new). The game
  state, rules, saves, undo and the computer's choices are the same at every
  speed.

## Constraints

- **Depends on §65 and §64**, merged first.
- **Engine:** an animation needs two things the engine doesn't provide
  today: a move's path (`reachableHexes` returns costs only, `movement.ts`)
  and the order of a combat's consequences. Any such description is a pure,
  tested engine function or event list, never re-derived in a scene.
- **The game's flow:** the state changes at once and the animation only shows
  it, so an undo, a save or the end of a phase never sees a half-applied
  state. The drift's existing pauses (§21), the AI pacing
  (`BoardScene.ts:94-96`) and autosave keep working.
- **e2e:** the suite runs with animations off (or in the standard view) and
  stays as fast as today. `devHook.ts`'s idle check already counts tweens.
- Live check owed (visual, rule 1).

## Type-specific questions

### Feature
- **Users:** hotseat players and watchers of computer seats.
- **Rulebook basis:** digital-only.
- **Known simplification it removes:** none.
- **Settled by the owner (2026-11-05):** a speed setting (Off / Normal /
  Slow) rather than a fixed pace; any action cuts an animation short rather
  than waiting.
- **Open design questions (for the spec):**
  - where the speed setting lives (board, Menu or both);
  - the exact durations;
  - what "cut short" does to a queue of animations (a drift's several steps,
    a computer's several moves);
  - whether the standard view gets any of it (for example a short slide).

## Assumptions I made

- Animations exist only in the vector view unless the spec says otherwise.
- Tier: Attested by the path table, plus `src/engine/` for the path or event
  description.
