<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §62 plan — One Ctrl+Z or Ctrl+Y press undoes or redoes one step, even on a slow frame

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Each keyboard event runs each scene key handler at most once. Today, Phaser
3.90.0 re-emits a chord's earlier events, so a key handler can run several
times for one press. After the fix, one press of Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y
or a Cmd form runs exactly one `undo()` or `redo()` on the Board and in
Placement, however many key events land in one frame. The same guard covers
the Board's Space, Enter and Escape handlers. A new e2e scenario delivers a
whole shortcut in one task: it fails on today's `main` and passes after.

## Risks

- **Fixing the symptom, not the cause.** Counting presses by timing, or
  debouncing, would also swallow a real second press, so it would be a
  different bug. The guard keys on the **event object** itself: Phaser
  re-emits the same `KeyboardEvent` from its queue, while a genuine second
  press, or a held key's auto-repeat, is a new object. Auto-repeat behaviour
  is unchanged.
- **A test that passes whatever the code does.** The e2e reproduction must be
  shown failing on `main` first (subtask 1). If dispatched events don't put
  the chord in one frame, the test proves nothing.
- **Changing undo semantics.** The fix changes only how often a key press
  reaches `undo()` and `redo()`, never what they do. Undo boundaries (die
  rolls, phase changes) are untouched.
- **The size budget (§61).** Both scenes sit at their ceilings:
  - `BoardScene.ts` has 3179 lines against a ceiling of 3179;
  - `PlacementScene.ts` has 581 against 581.

  Moving the wiring out makes both shorter. Rule 5, the ratchet, then fails
  until their ceilings are lowered in `scripts/size-baseline.json` on the
  same branch. Growth needs no budget line, because both files shrink.
- **Stale line citations.** The intent cites `BoardScene.ts:801-810` and
  `PlacementScene.ts:264-271`. Today they are at `:823-833` and `:266-273`
  (re-read below).
- **The lint cap** stays at 21.
- **A slower e2e run.** The new scenario adds one spec. It must pass
  reliably on a loaded machine, which is the condition the bug needs.

## Verified against the codebase

Re-read on `main` at `5d08c27` (Phaser 3.90.0, `node_modules/phaser/package.json:3`).

- **The handlers:**
  - `src/scenes/BoardScene.ts:823-833`: `keydown-Z` runs `redo()` with Shift and `undo()` without, if Ctrl or Meta is held; `keydown-Y` runs `redo()` with Ctrl or Meta; `keydown-ESC` closes the rules panel; `keydown-SPACE` and `keydown-ENTER` run `resolveDriftContinue()`.
  - `src/scenes/PlacementScene.ts:266-273`: the same `keydown-Z` and `keydown-Y` pair.
  - No other `keyboard` handler is registered in `src/scenes` or `src/ui`; a grep found only these.
- **Phaser's queue:**
  - `node_modules/phaser/src/input/keyboard/KeyboardManager.js:194,214`: each DOM keydown or keyup is pushed onto `queue`, then `MANAGER_PROCESS` is emitted, at `:196` and `:216`.
  - `:262` `postUpdate`: `this.queue = []`, once per game step.
- **Phaser's re-walk:**
  - `node_modules/phaser/src/input/keyboard/KeyboardPlugin.js:731` `update`: walks the whole `manager.queue` from the start, starting with `var queue` at `:733` and the loop at `:744`.
  - `:776` is the "Duplicate event bailout". It compares an event only with the previous one processed (`prevCode`, `prevTime`, `prevType`).
  - It emits `KEY_DOWN + KeyMap[code]` with the same `event` object every time.
- **Why the bug happens:** in a frame holding Ctrl↓ Z↓ Z↑ Ctrl↑, the walk after each later event re-emits `keydown-Z` for the queued Z↓. The interleaved events defeat the bailout. A lone key's own re-walk is caught by the bailout. A lone Space in the same frame as another key is not caught, so the Board's Space, Enter and Escape handlers are exposed to the same defect when a frame holds other keys.
- **Messages:** `src/ui/i18n/en.ts:255` `undone: (label) => \`Undone: ${label}\``, and `:259` `redone`.
- **The dev hook:** `src/ui/devHook.ts:87` `logEntries()` returns the Board's log (§49), and `:76` `placement()` returns `{ current, legalHexes }`.
- **e2e:**
  - `e2e/helpers.ts:17` has `MENU_CLOSE_COMBAT`, plus `startFromMenu`, `clickHex`, `waitIdle` and `settle`.
  - `e2e/placement.spec.ts` drives Placement.
  - No scenario presses an undo or redo shortcut today.
- `vitest.config.ts:11` includes `src/**/*.test.ts`, so a test beside a `src/ui/` module runs in `verify`. `src/ui/` already has pure tested helpers, for example `hexHitTest.test.ts` and `logHistory.test.ts`.
- **The size baseline:** `scripts/size-baseline.json` has `BoardScene.ts: 3179` and `PlacementScene.ts: 581`, and `wc -l` gives the same today.

## Where this goes

- **Modules touched:**
  - `src/scenes/BoardScene.ts` and `src/scenes/PlacementScene.ts`: their inline `keyboard?.on(...)` handlers are replaced by one call each;
  - `scripts/size-baseline.json`: both ceilings are lowered to the new lengths with `npm run size:baseline -- --write`.
- **New modules:**
  - `src/ui/onceEach.ts`: wraps an event handler so it runs at most once per event object (a `WeakSet` of seen events); pure, no Phaser.
  - `src/ui/onceEach.test.ts`: its tests.
  - `src/ui/shortcutKeys.ts`: `bindUndoRedoKeys(keyboard, { undo, redo })`, which registers the Z and Y handlers through `onceEach`, plus `onKeyOnce(keyboard, name, fn)` for the Board's Space, Enter and Escape.
  - `e2e/undo-shortcuts.spec.ts`: the failing-first scenario.
- **Why there:**
  - The guard is presentation input handling, not a rule, so it doesn't go in `src/engine`.
  - It is pure and tested, as the intent asks (principle 1's split: logic in a tested module, scenes only wire it).
  - One shared module replaces two copies of the same Z/Y wiring (principle against duplication). It shrinks both large scenes instead of growing them.
  - `shortcutKeys.ts` takes Phaser's `KeyboardPlugin` by type only and is thin wiring, like other `src/ui` helpers.
- **Budget lines:** none. Both budgeted files shrink, and their ceilings are lowered (rule 5).

## Subtasks

1. **The failing-first scenario**, `e2e/undo-shortcuts.spec.ts`.
   - **The burst:** in one `page.evaluate`, dispatch on `window` the events keydown Control, keydown Z (`ctrlKey: true`), keyup Z, keyup Control. Set `keyCode` on each through `Object.defineProperty`, because Phaser reads `keyCode`. For redo, add Shift for Ctrl+Shift+Z; also cover Ctrl+Y.
   - **Board:** start from `MENU_CLOSE_COMBAT`, select a unit and a target, which makes two history entries. Then:
     - one undo burst adds exactly one "Undone:" log entry, and `logEntries()` grows by one undo;
     - one redo burst (Ctrl+Shift+Z) adds exactly one "Redone:";
     - Ctrl+Y does the same as Ctrl+Shift+Z.
   - **Placement:** start from the placement path `e2e/placement.spec.ts` uses, place two units, then:
     - one undo burst leaves exactly one unit placed;
     - one redo burst brings the second back.
   - **Space on the Board:** a burst with Space plus an unrelated key in one task continues a paused drift **once**, if a drift pause is reachable from an existing test-mode shortcut. If none is, the unit test covers it (subtask 2), and the reason goes in Progress.
   - Run it on `main`'s code first. It must fail, the Board's undo with two or more "Undone:" lines. Record the failure output in Progress.
   - If dispatched events do not reproduce it, try `page.keyboard.down`/`up` without awaits between them inside one `Promise.all`. If neither reproduces it, **stop and report**: the plan's test would prove nothing.

   Commit the scenario, marked as expected to fail, only together with subtask 3. `verify` doesn't run e2e, so committing it alone would keep `verify` green but make `npm run e2e` red.
2. **`src/ui/onceEach.ts` with tests.** `onceEach(fn)` returns `(event) => void`. It calls `fn(event)` the first time an event object is seen and ignores it after. It records events in a `WeakSet`, so it keeps no references. The tests:
   - the same object twice gives one call;
   - two distinct objects give two calls, even when their fields are equal (a real second press, or auto-repeat);
   - interleaved A, B, A, B gives two calls;
   - the handler's argument is passed through.
3. **`src/ui/shortcutKeys.ts`, and wire the scenes.**
   - `bindUndoRedoKeys(keyboard | undefined, { undo, redo })` holds today's Z/Y logic, unchanged (Shift → redo; Ctrl or Meta required; Y with Ctrl or Meta → redo), each handler wrapped in `onceEach`. `onKeyOnce(keyboard, 'keydown-SPACE', fn)` and the same for ENTER and ESC.
   - `BoardScene` and `PlacementScene` call them in place of the inline handlers.
   - `npm run size:baseline -- --write` lowers the two ceilings, and `npm run check:intent` stays green.
   - The e2e scenario now passes, and so does the whole `npm run e2e`.
4. **Progress entry** in `plan.md`, with:
   - the failing-first output on `main` and the passing output after;
   - the e2e pass count;
   - the new baseline numbers;
   - test counts;
   - whether Space was covered in e2e, or why not.

   Set `status: in-review`.

## Tests

- **Failing-first:** `e2e/undo-shortcuts.spec.ts`, the Board's Ctrl+Z burst. It fails on `main` with more than one "Undone:" line and passes after.
- **Which test catches each mutation:**
  - drop `onceEach` around `keydown-Z` in `bindUndoRedoKeys`: the e2e Board and Placement undo cases fail;
  - drop it around `keydown-Y`: the e2e Ctrl+Y case fails;
  - in `onceEach`, never record seen events (or `has` → `false`): `onceEach.test.ts` "same object twice" fails;
  - in `onceEach`, compare by fields, not identity: "two distinct objects" fails;
  - swap undo and redo, or drop the Shift branch, in `bindUndoRedoKeys`: the e2e redo case fails;
  - drop the Ctrl/Meta requirement: no e2e case presses a bare Z, so this mutant is expected to survive. Add an e2e case where a bare Z burst changes nothing.
  - drop `onKeyOnce` around Space: the e2e Space case fails, if reachable. Otherwise the mutant survives, and that is recorded under Not checked.
- **Behaviour held:** the existing e2e scenarios (`rules-panel` for Escape, the drift scenarios if any) and the full `verify` suite stay green, with the same test count plus `onceEach.test.ts`.

## Validation

- `npm run verify` green, lint ≤ 21 warnings.
- `npm run check:intent` PASS: the fix carries tests, and the lowered ceilings pass rule 5.
- `npm run e2e`: all scenarios pass, including the new one. The coordinator re-runs it, since the diff touches `src/scenes` and `src/ui`.
- **Live check, owed by path (`src/scenes/`, `src/ui/`):** `npm run dev -- --port 5262 --strictPort --host 127.0.0.1` → the Menu's "Combat test mode (units face to face, 2 hexes)":
  1. select a unit and a target, then press Ctrl+Z once; the log shows one "Undone:" and the selection steps back once;
  2. Ctrl+Shift+Z once gives one "Redone:", and Ctrl+Y works the same;
  3. in Placement (Menu → a new game → Placement), place two units, press Ctrl+Z once, and one unit comes back off the board;
  4. on the Board, Escape still closes the Tables panel.

## Assumptions I made

- **Guard by event identity, not by time.** Phaser re-emits the same `KeyboardEvent` object from its queue (`KeyboardPlugin.js` emits `event` as queued), so identity separates a re-emit from a new press exactly. The tests pin this down.
- **Space, Enter and Escape are in scope.** The intent says they are, "same defect, same handlers", if they are affected. Read from Phaser's code, they are affected whenever other keys share their frame, and wrapping them keeps "once per press" true.
- **The new module goes in `src/ui/`, not `src/engine/`:** it handles input, not a game rule.
- **The e2e chord reproduction** follows the intent's description. If Chromium doesn't put dispatched events in one frame, subtask 1 tries the Playwright keyboard path, and otherwise stops.
- **Tier:** Attested by path (`src/scenes/**`, `src/ui/**`, `e2e/**`), and a live check is owed.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-10 — all four subtasks (commit 3439396)

- **Shipped:** `src/ui/onceEach.ts` (+ 4 tests), `src/ui/shortcutKeys.ts` (`bindUndoRedoKeys`, `onKeyOnce`), `BoardScene` and `PlacementScene` call them instead of the inline handlers (Z, Y, ESC, SPACE, ENTER on the Board), `e2e/undo-shortcuts.spec.ts` (2 scenarios: Board, Placement; each covers Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and a bare Z that changes nothing).
- **Failing first, on main's code** (dispatched events in one `page.evaluate` reproduce it; no Playwright keyboard fallback needed): Board `one Ctrl+Z, one undo` expected 1 `Undone:` line, received 2; Placement `one Ctrl+Z takes back one unit` expected 1 unit placed, received 0 (two placements all undone by one press).
- **After:** both pass. `npm run e2e`: 22 passed / 22 (one earlier run had `save-load.spec.ts` fail once under load with a movementLeft diff; it passed alone twice and in the next full run, and it uses no shortcut).
- **Baseline:** `BoardScene.ts` 3179 -> 3173, `PlacementScene.ts` 581 -> 575.
- **Tests:** vitest 80 files / 1412 tests passed (adds `onceEach.test.ts`). Lint 21 warnings (cap unchanged). `check:intent`: type-check PASS.
- **Mutant:** `onceEach` never records seen events: 2 of its 4 tests fail (same object twice, interleaved). Restored by copy.
- **Space:** not covered in e2e; no existing test-mode shortcut reaches a drift pause. Dropping `onKeyOnce` around Space survives e2e (Not checked). The `onceEach` unit tests cover the guard.
- **Divergence:** the scenario was committed together with the fix in one commit (as the plan allows), not separately.

### Round 1 rework (2026-11-10)

- **Finding -> resolution:** MEDIUM surviving mutant M8 (`shortcutKeys.ts` Y handler without the ctrl/meta check). `e2e/undo-shortcuts.spec.ts` now sends a bare Y right after the first Ctrl+Z, while the redo stack is non-empty: Board asserts the `Redone:` count stays 0, Placement asserts `placed()` unchanged.
- **M8 re-run:** one-line change applied (`git diff --quiet` exit 1), `npx playwright test e2e/undo-shortcuts.spec.ts`: 2 failed, killed by both "one undo or redo shortcut in Placement undoes or redoes one placement (seed 1)" ("a bare Y redoes nothing", expected 1 received 2) and the Board scenario. Restored by copy; tree clean of mutant.
- **LOW (Space/Enter, M10/M15):** skipped, no seeded drift pause is trivially reachable.
- **Counts:** vitest 80 files / 1412 tests; lint 21 warnings (cap unchanged); `npm run e2e` 22 passed / 22; `check:intent` type-check FAIL only for the owed, unrecorded live check (owner's gate), no other error.
