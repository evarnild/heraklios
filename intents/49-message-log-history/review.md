<!-- generated-by: heraklios/review@0.1.4 -->
# §49 review — The Board keeps every message in a scrollable log, clear of the bottom-left buttons

verdict: rework
tier: attested
reviewed-commit: 20af820
round: 1
sampled: no
live-check: owed

**Tier:** set by input 1, the paths: `src/ui/**`, `src/scenes/**`, `e2e/**`
and `README.md` wording. `review_tier` is empty and the feature implements
no rulebook rule. No finding is CRITICAL or HIGH.

**Sampled: no.** `main` holds 11 attested reviews, so §49 is the 12th.

Passes run by the `heraklios-reviewer` agent; the coordinator re-ran the
results marked under "Verified myself".

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): dragging the scrollbar thumb also pans the map (B5) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: digital-only, no print rule |
| 4 | Tests prove the rule, not only pass | findings (3) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | pass. 57 files, 944 tests, lint 21, e2e 11 and the 16 named mutants reproduce. |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass. Lint 21 with cap 21, no new dependency. |
| 9 | Repository-specific footguns | pass. The drift machine is untouched; drift narration only routes through the log. |

## Type check
```
type-check: PASS (intent 49, feature)
  note:  10 file(s), 740 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/ui/MapView.ts:229-233` (with `src/ui/logPanel.ts:119-130`):
  dragging the scrollbar thumb also pans the map. `enableDrag` starts a map
  drag on every scene `pointerdown`, wherever the pointer is. So the drag
  that scrolls the log also moves the camera by the same distance.
  - The reviewer's probe: Combat test mode, seed 1, 30 Undo clicks, then a
    40 px thumb drag. The log offset went 12 → 8, and the archers' hex moved
    on screen from y 289.26 to 249.26.
  - B5 asks for the thumb to scroll the log. The plan covered the wheel and
    missed the drag, and E3 only checks `offset`.
  - Needs rework: `enableDrag`'s `pointerdown` returns early when a scene
    hook says the point is over the log panel. Widen `wheelBlocked` into one
    `pointerBlocked`, or add a second hook. Extend E3: a unit's
    `hexToCanvas` is the same before and after the drag. That check fails
    today.
- **MEDIUM** `README.md:614-615`: "Prompts, the status line and the Save /
  Load panel's messages are not log entries" is wrong twice.
  - The Save / Load panel's results are entries: its `onStatus` goes to
    `this.log(message)` (`src/scenes/BoardScene.ts:1014`), as before §49.
  - Many prompts are entries too (`selectAttacker`, `selectTarget`,
    `alreadyAttacked`…), as the plan's risks say. The spec's first
    Interpretations bullet says the same wrong thing.
  - Needs rework: reword it, for example "The status line and the dialogs
    (retreat, advance, exchange, the Save / Load panel itself) are not log
    entries; the Save / Load panel's results are." Fix the spec's bullet
    the same way, as a recorded amendment.
- **MEDIUM** `src/scenes/BoardScene.ts:1440` and `:563`: two wiring lines
  that carry spec behaviour survive both full suites, vitest and e2e:
  - the heading key cut to the turn alone (`` `${state.turnNumber}` ``),
    which breaks B2's "or the active player";
  - `this.logHistory = new LogHistory()` dropped from `resetSceneState`,
    which breaks B8. Phaser reuses the scene instance, so a second game or
    a load in place would keep the old history: the risk the plan named.
  - Needs rework, both cheap in e2e:
    - in `message-log.spec.ts`, end phases until the active player changes,
      click Undo, and assert a second heading for the same turn (the
      reviewer's probe showed "Turn 1 — Athens", "Turn 1 — Persia", "Turn
      2 — Athens");
    - in `save-load.spec.ts`, after the load, assert `logEntries()` is a
      heading then "Game loaded.".
- **LOW** `src/ui/logHistory.test.ts:118-122` (S2): the mutant
  `logHistory.ts:132` `return clampOffset(prevOffset, newTotal, visible)` →
  `return prevOffset` survives (944 passed, re-run by the coordinator).
  Nothing tests a shrinking history. Worth a look: add
  `expect(follow(10, 40, 3, 5)).toBe(0)`.
- **LOW** `src/scenes/BoardScene.ts:1455` and `:266`: the drift wiring has
  no automated test. "A new entry per drift line" and "seed copy restored"
  both survive. The spec gives drift readability to the live check (AC5),
  so step 8 carries B3. Worth a look: an e2e scenario, once a test-mode
  shortcut builds `buildElephantScenarioGameState`.
- **LOW** `src/ui/logPanel.ts:55-66, 122-130`: `draw()` re-renders every
  pooled line on each render, wheel notch and drag `pointermove`. Phaser's
  `setColor` redraws the text even when the colour is unchanged: up to 19
  redraws per move. It isn't slow at this size. Worth a look: skip `draw()`
  when the offset didn't change, and call `setColor` only on a change.
- **LOW** `src/ui/logPanel.ts:78-81`: the measuring `Text` is never bold,
  but headings are drawn bold, so a long player name could run under the
  scrollbar. Worth a look only if the live check shows it.

Nits:
- Several guards in `logHistory.ts` survive as equivalent mutants because
  they can't be reached: `:42`, `:56`, `:113`, `:149`, `:150`, `:167-169`.
- The `src/ui/` list in `CLAUDE.md` doesn't name `logHistory.ts` and
  `logPanel.ts`. That list isn't exhaustive.

## Not checked
- **Looks:** colours, bold headings, the brighter newest entry, and how long
  combat reports wrap at 256 px. These are for the live check.
- **The drift in a running game** (B3): one growing entry, no seed copy,
  and a `log()` landing mid-drift. Read in the code only; no automated
  path reaches a drift.
- **French headings in a running game:** `fr.ts` was read only.
- **No duplicate panel under zoom.** The mutant that drops
  `excludeFromMainCamera` survives e2e. Reading confirms all four object
  kinds are excluded, but only a zoomed look shows a duplicate.
- **Log lines aren't click targets.** The mutant that makes the pooled lines
  interactive survives, because no log line matches a button label.
  Reading confirms only the thumb is interactive.
- **No duplicate listeners across games.** Phaser's `InputPlugin.shutdown`
  removes them (`node_modules/phaser/src/input/InputPlugin.js:3134`), but
  two games in a row were not run.
- **A `log()` after Abandon has nulled `session.gameState`**, for example a
  late autosave failure (`:992`) or a save-panel status. `logContext()`
  reads `this.state()` and would throw. Not reproduced.
- **A long game:** hundreds of entries on a slow machine.

## Live check
- **Owed** by rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and
  visual, so the smoke suite can't stand in. It covers AC5. Do it after the
  rework.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/49-message-log-history`, run
  `npm run dev -- --port 5249 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5249/. Menu → "Combat test mode (units face to face, 2
  hexes)".
- **Steps and what you should see:**
  1. Click "↶ Undo" about 25 times. A bold "Turn 1 — <player>" heading, then
     "Nothing to undo." lines. Past the panel's bottom a scrollbar appears;
     the newest line is brighter and at the bottom. No log text is drawn
     below about y = 510, above "⚑ End game".
  2. Wheel up over the log: it scrolls back and the map doesn't zoom. Wheel
     over the map: it zooms.
  3. Drag the scrollbar thumb: the log scrolls and the map stays still.
     Before the rework the map pans too (the first finding).
  4. Scroll up, click Undo: the view stays put. Scroll to the bottom, click
     Undo: it follows the new line.
  5. Click "End phase". Select the archers, then the enemy two hexes away,
     then "Resolve attack". The combat report is one multi-line entry
     under the earlier ones, readable in full, with no new heading.
  6. Click End phase until the other player is active, then Undo: a "Turn
     1 — <other player>" heading. After a full round: "Turn 2 — …".
  7. Menu, switch to French, Combat test mode again, click "Annuler": "Tour
     1 — …" headings.
  8. Menu → "Test mode (2 players, armies ready)". Attack with or against
     an elephant until one drifts. The narration (direction, each hex, each
     trample) is one growing entry under the combat report, with no copy of
     the report at its top. During the drift pause, "Continue" is fully
     visible and nothing in the log overlaps it.
  9. Undo after a move: every line stays. Save / Load: save to a slot,
     then load it. The log starts over with a heading and "Game loaded.".
     Start a new game from the Menu: the log is empty.
- **What an e2e scenario could take over** (your standing preference): the
  map not panning during a drag, headings on a player change and a turn
  change, the reset on load and on a new game, and French headings. The
  first three are already the rework above. A drift needs a new test-mode
  shortcut first. The colours, the readability, no duplicate under zoom,
  and Continue clear during a drift pause stay visual.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at `20af820`, clean):
- The `follow` clamp mutant (`logHistory.ts:132` → `return prevOffset`),
  full `npx vitest run`: 57 files, **944 passed**, so it survives. Restored
  by copy, checked with `cmp`; `git status --short` empty.
- Read `MapView.ts:224-245`: `pointerdown` sets `dragging = true` with no
  position check, which confirms the drag finding.
- Read `README.md:610-615` and `BoardScene.ts:1012-1016`: `onStatus` goes to
  `this.log`, which confirms the README finding.
- Read `BoardScene.ts:1435-1443` (the key `${turnNumber}:${activeId}`) and
  `:563`. `grep logEntries e2e/*.spec.ts`: only `message-log.spec.ts` reads
  the history, and it asserts a single heading (`:101`). That confirms no
  test covers a player-change heading or the reset on load.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, 57 files, 944 tests, lint 21 (cap 21), with no
  warning in the new files.
- `npm run check:intent`: PASS. `npm run e2e`: 11 passed (31.4 s), on its
  own server.
- **41 unit mutants** on `logHistory.ts`, full vitest each, from a passing
  baseline:
  - 32 killed, including all 16 in Progress;
  - 9 survived: `:132` (the LOW above) and 8 equivalent guards.
  - Its first harness run false-killed every mutant (cmd.exe couldn't run
    `./node_modules/.bin/vitest`). It added a baseline check and re-ran;
    these are the second run's results.
- **15 wiring mutants**, full e2e each:
  - killed (8): `wheelBlocked` return or assignment removed, `log()` not
    rendering, follow replaced by a clamp, the wheel's `contains` check
    removed, the wheel direction inverted, the drag never grabbing, the
    thumb always hidden;
  - survived (7): the turn-only key, `resetSceneState` keeping the history,
    an entry per drift line, the seed copy restored, the newest colour
    dropped, interactive pooled lines, and the panel not excluded from the
    main camera.
- **A probe spec** (`e2e/zz-probe49.spec.ts`, deleted after use) showed the
  −40 px pan and the headings on a player change and a turn change.
- **Read:**
  - B1–B9 against the diff;
  - B3's interpretation comment (`BoardScene.ts:262-266`);
  - B4's geometry: panel bottom 510, last line top 484, 19 lines, Continue
    at 518;
  - B8: `resetSceneState` is called from `create` (:593) and `loadInPlace`
    (:962); undo's restore doesn't touch the history; no `SAVE_VERSION`
    change;
  - the drift end, error and restore paths;
  - devHook stays dev-only.
- All mutated files restored by copy and checked with `cmp`;
  `git status --short` empty at the end.

**Taken on trust:** the e2e global setup's check that the production build
has no devHook (it ran inside `npm run e2e`; not inspected separately).
