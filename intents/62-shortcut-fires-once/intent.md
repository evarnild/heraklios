<!-- generated-by: heraklios/intent@0.1.5 -->
# §62 — One Ctrl+Z or Ctrl+Y press undoes or redoes one step, even on a slow frame

**Type:** fix
**Originator:** the coordinator's round-3 re-check of §55 (2026-11-03): the
Tables panel's e2e scenario failed 2 runs in 3 on a loaded machine; the owner
asked for the cause, then for this intent ("count the flake as a round-3
finding", then `/intent --fix`).
**Source:** `intents/55-rule-tables-panel/review.md`, round 3, second MEDIUM
finding (the flake), and its "Verified myself" diagnosis.

## Problem

One press of an undo or redo shortcut sometimes undoes or redoes **several**
steps. On the Board, a single Ctrl+Shift+Z was logged as "Undone: Select
Archers, Redone: Select Archers", and the next single press as "Redone:
Target Archers, Nothing to redo., Nothing to redo.". A player who presses
Ctrl+Z once can lose two or three steps of their move with no way to tell
which, and redo then can't put back what they expected.

It shows when a frame is slow: the e2e suite on a loaded machine hits it
reliably; a human on a fast machine rarely does, because a finger's key-up
comes many frames after its key-down.

## Outcome

- One press of Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y (and the Cmd forms) runs
  exactly one undo or redo, on the Board and in Placement, however many key
  events land in the same frame.
- A test that delivers a whole shortcut (modifier down, key down, key up,
  modifier up) inside one frame fails on today's `main` and passes after.
- No other key behaviour changes: Space and Enter still continue a paused
  elephant drift once per press, and Escape still does what it does.

## Constraints

- **Cause, as traced (§55 round 3):** Phaser 3.90.0's `KeyboardManager`
  queues each DOM key event and emits `MANAGER_PROCESS` on every one
  (`node_modules/phaser/src/input/keyboard/KeyboardManager.js:186-216`), so
  each scene's `KeyboardPlugin.update` re-walks the **whole** queue each
  time; the queue is only cleared at the game's `POST_STEP` (`:262-264`). The
  plugin's duplicate guard compares an event only with the one processed just
  before it (`KeyboardPlugin.js:776`), so in a chord the interleaved events
  defeat it and `keydown-Z` is emitted once for itself and again for each
  later event of the same frame (up to 3 times for Ctrl+Z, 4 for
  Ctrl+Shift+Z). A lone key is not repeated (its own re-walk is caught by the
  guard), which is why Space and Enter are believed unaffected; the spec of
  the fix confirms it.
- **The handlers:** `src/scenes/BoardScene.ts:801-808` and
  `src/scenes/PlacementScene.ts:264-271` (`keydown-Z`/`keydown-Y`), and
  `BoardScene.ts:809-810` (`keydown-SPACE`/`keydown-ENTER`) to check.
- **Undo boundaries stay as they are** (`CLAUDE.md` → "A die roll is an
  undo/redo boundary"): the fix changes how often a press reaches `undo()` /
  `redo()`, never what they do.
- **Engine/presentation split:** any "handle each event once" logic that can
  be pure lives in a small tested module, the scenes only wire it.
- **No Phaser upgrade** in this intent (that would be its own refactor, like
  §56 for vite/vitest); the fix works on 3.90.0.
- **§55's scenario** (`e2e/rules-panel.spec.ts`) is being changed on its own
  branch to avoid the chord; this fix must not depend on §55 merging first,
  nor break it after.
- A live check is owed (`src/scenes/`).

## Type-specific questions

### Fix
- **What broke:** one shortcut press can run `undo()`/`redo()` 2-4 times when
  the chord's key events fall in one frame; expected exactly once.
- **Since when:** the shortcuts' first commit, `511ccc8` (2026-07-25, "Add
  undo/redo to the board and placement screens"), before intents existed, so
  no `follows_up`. Phaser's queue behaviour is the same in 3.90.0, the
  version in use.
- **Impact:** any player using the keyboard shortcuts, more often on a slow
  or loaded machine; the on-screen Undo/Redo buttons are not affected. It
  doesn't corrupt a game or a save (each step is a valid history entry), but
  it silently rewinds more than asked, and redo can't always restore it (a
  new action after the extra undo drops the redo stack).
- **Reproduction:** deterministic: from "Combat test mode", select a unit and
  a target (two history entries), then in one `page.evaluate` dispatch
  keydown Control, keydown Z (`ctrlKey: true`), keyup Z, keyup Control on
  `window` (Phaser reads `keyCode`, so define it on each event); one undo
  expected, the log shows two or three "Undone:". By hand: on a heavily
  loaded machine press Ctrl+Z quickly; or, in e2e, `page.keyboard.press(
  'Control+z')` then `'Control+Shift+z'` with no wait (§55's flake).
- **The test that will fail first:** a new `e2e/` scenario (e.g.
  `e2e/undo-shortcuts.spec.ts`) that delivers each shortcut as one burst in a
  single task, as above, and asserts the "Undone:"/"Redone:" log lines and the
  restored selection grew by exactly one, on the Board and in Placement; plus
  unit tests for any pure "once per event" helper.

## Assumptions I made

- Space and Enter (drift continue) are unaffected because they are single
  keys; that follows from Phaser's code as read, not from a run. If the plan
  finds them affected, they are in scope: same defect, same handlers.
- The dispatched-event reproduction works in Chromium with `keyCode` set via
  `Object.defineProperty`; not tried yet. If it doesn't, the plan picks
  another way to put a chord in one frame.
- No other scene registers key handlers (`grep` of `src/scenes` and `src/ui`
  on `main` finds only the six above); the map editor has its own DOM input
  and no Phaser, so it is out of scope.
- `review_tier` left empty: the path table puts `src/scenes/**` at Attested.
