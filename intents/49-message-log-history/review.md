<!-- generated-by: heraklios/review@0.1.4 -->
# §49 review — The Board keeps every message in a scrollable log, clear of the bottom-left buttons

verdict: attest
tier: attested
reviewed-commit: 98521f2
round: 2
sampled: no
live-check: owed

**Tier:** set by input 1, the paths, as in round 1: `src/ui/**`,
`src/scenes/**`, `e2e/**` and `README.md` wording. No rulebook rule, and no
finding is CRITICAL, HIGH or MEDIUM.

**Sampled: no.** §49 is the 12th attested change.

Round 2 covers `2111b1d` (the owner-requested spec amendment) and
`98521f2` (the rework). All three round-1 MEDIUM findings are fixed, each
with a test that fails without the fix. The live check is still owed: the
owner's gate, and the only error `check:intent` reports. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran the results marked under
"Verified myself".

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Dragging the thumb no longer pans the map (B5). The rework adds no scope beyond round 1's findings. |
| 2 | Type check | FAIL on the owed live check only: the owner's gate, not rework |
| 3 | Rulebook fidelity | not run: digital-only, no print rule |
| 4 | Tests prove the rule, not only pass | findings (2, LOW) |
| 5 | Boundary and conventions | pass. No `GameState` or `SAVE_VERSION` change. |
| 6 | Numbers in prose | pass. 57 files, 944 tests, lint 21, e2e 12 reproduce. |
| 7 | Documentation | pass. The README, the amended spec and the code agree. |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21, no new dependency. |
| 9 | Repository-specific footguns | pass. The drift machine is untouched. |

## Type check
```
type-check: FAIL (intent 49, feature)
  error: A live check is owed and not recorded. Do the steps in intents/49-message-log-history/review.md → ## Live check, then set live_checked: <date> in intents/49-message-log-history/metadata.yml.
  note:  11 file(s), 796 line(s) changed outside intents/.
```

## Findings
- **LOW** `src/ui/logPanel.ts:65`: no automated test reads the text the
  panel draws.
  - The mutant `if (t.text !== line.text)` → `if (t.text === line.text)`
    leaves every line blank, and `message-log.spec.ts` still passes
    (re-run by the coordinator: 2 passed).
  - `logEntries()` reads the history, not the screen. The dev hook's panel
    snapshot gives bounds, offset and thumb, but not the pooled lines'
    text.
  - Live check step 1 shows it at once. Worth a look: have the panel
    snapshot (`src/ui/devHook.ts:190`) return the visible lines, and
    assert the last one in E1.
- **LOW** (visual, carried from round 1) `src/ui/logPanel.ts:66-67`: the
  newest-entry colour and the bold headings have no test. Mutants that
  disable either survive the full e2e suite. They are live check step 1's.

Nits:
- The `scrollTo` early return (`logPanel.ts:115`) is an equivalent mutant;
  removing it only redraws the same content.
- Dropping the clear of a pooled line that has nothing to show (`:60`)
  survives e2e. Only a load in place shrinks the history, and live check
  step 9 shows it.

## Not checked
- **Looks:** colours, bold headings, the brighter newest entry, how combat
  reports wrap, and that the panel draws its text at all (finding 1). These
  are for the live check.
- **The drift in a running game (B3):** read in the code only; no test-mode
  shortcut reaches a drift.
- **French headings in a running game.**
- **No duplicate panel under zoom:** confirmed by reading only.
- **Two games in one page,** for duplicate listeners: each e2e test starts
  a fresh page.
- **A `log()` after Abandon nulls `session.gameState`:** not reproduced;
  unchanged since round 1.
- **`pointerBlocked`'s edges:** checked by geometry, not driven.
  - The log's bounds are x 16–284, y 178 to h−240, and the map's camera
    starts at x = 300, so no hex lies inside the blocked area.
  - Every left-panel button lies outside that band.
  - The guard only skips starting a map drag; buttons and hexes get their
    own `pointerdown` either way.
  - The hex-clicking scenarios (attacks, land-move, naval, placement) pass.

## Live check
- **Owed** by rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and
  visual, so the smoke suite can't stand in. It covers AC5.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/49-message-log-history`,
  run `npm run dev -- --port 5249 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5249/. Menu → "Combat test mode (units face to face, 2
  hexes)".
- **Steps and what you should see:**
  1. Click "↶ Undo" about 25 times. You see a bold "Turn 1 — <player>"
     heading, then readable "Nothing to undo." lines. The text must
     actually be drawn: no test checks it (finding 1). Past the panel's
     bottom a scrollbar appears; the newest line is brighter and at the
     bottom. No log text below about y = 510, above "⚑ End game".
  2. Wheel up over the log: it scrolls back and the map doesn't zoom. Wheel
     over the map: it zooms.
  3. Drag the scrollbar thumb: the log scrolls and the map stays still.
     Press and drag on a log line away from the thumb: nothing moves. Drag
     on the map itself: it pans as before.
  4. Scroll up, click Undo: the view stays put. Scroll to the bottom, click
     Undo: it follows the new line.
  5. Click "End phase". Select the archers, then the enemy two hexes away,
     then "Resolve attack". The combat report is one multi-line entry under
     the earlier ones, readable in full, with no new heading.
  6. Click End phase until the other player is active, then Undo: a "Turn
     1 — <other player>" heading; after a full round, "Turn 2 — …". e2e
     covers that it happens; look at how the headings read.
  7. Menu, switch to French, Combat test mode again, click "Annuler": "Tour
     1 — …" headings.
  8. Menu → "Test mode (2 players, armies ready)". Attack with or against
     an elephant until one drifts. The narration (direction, each hex, each
     trample) is one growing entry under the combat report, with no copy of
     the report at its top. During the drift pause, "Continue" is fully
     visible and nothing in the log overlaps it.
  9. Undo after a move: every line stays. Save / Load: save to a slot, then
     load it. The log starts over with only a heading and "Game loaded.",
     and no leftover lines below them. Start a new game from the Menu: the
     log is empty.
- **What an e2e scenario could still take over:** the drawn text, once the
  dev hook exposes the visible lines, and French headings. The drift needs
  a test-mode shortcut. The colours, readability, no duplicate under zoom,
  and Continue staying clear stay visual.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at `98521f2`, clean):
- `npm run check:intent`: FAIL, and its only error is the owed live check
  (output above).
- The heading key cut to the turn alone (`BoardScene.ts:1440`), against
  `npx playwright test e2e/message-log.spec.ts`: **1 failed, 1 passed**, so
  it is now killed.
- The text-guard mutant (`logPanel.ts:65`, `!==` → `===`), same spec:
  **2 passed**, so it survives (finding 1).
- Each mutant was applied by an exact single-match replacement, checked to
  have changed the file, and restored by copy and `cmp`.
  `git status --short` was empty afterwards.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, 57 files, 944 passed, lint 21 warnings, 0 errors
  (cap 21).
- `npm run e2e`: 12 passed (25.3 s), on its own server.
- **Round 1's named mutants, all killed:**
  - the turn-only key, by the new heading test;
  - the history kept by `resetSceneState`, by `save-load.spec.ts:90`;
  - the drag guard removed, by E3's "the map did not pan", which shows the
    test was red before the fix;
  - `follow` → `prevOffset`, by S2 (1 failed, 943 passed).
- **Rework-line mutants in `logPanel.ts`:**
  - killed: the early-return condition inverted;
  - survived: the early return removed (equivalent), the text guard
    (finding 1), the colour and font guards (the visual LOW), and the clear
    removed (nit).
- **Read:** `git diff 20af820 HEAD`; `logPanel.ts` in full (`render()` still
  always draws, so updating the last drift entry while at the bottom
  redraws it); `MapView.ts:225-269`; the geometry of the panel and the
  buttons; `BoardScene.ts:1014`, `:1886`, `:2418` and `:2426` against the
  amended spec and README.
- Nothing touched `main` or was pushed. `git status --short` was empty at
  the end.

**Taken on trust:**
- E3 red before the fix as a separate run. The reviewer reproduced the
  equivalent: the pre-fix line restored fails E3.
- The e2e global setup's check that no devHook is in the production build.

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 20af820
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2, in `2111b1d` and `98521f2`):
- **MEDIUM — dragging the scrollbar thumb panned the map: fixed.**
  - `MapView.wheelBlocked` became `pointerBlocked`, checked by the wheel
    handler and by `enableDrag`'s `pointerdown`.
  - E3 asserts a unit's `hexToCanvas` is unchanged across the drag, and
    fails with the guard removed.
- **MEDIUM — the README said prompts and Save / Load messages aren't
  entries: fixed.**
  - `README.md:614-616` reworded.
  - The spec's Interpretations bullet was amended on the owner's request
    (`2111b1d`), with the same wording.
- **MEDIUM — two wiring lines had no test: fixed.**
  - A new heading test in `message-log.spec.ts` kills the turn-only key.
  - `save-load.spec.ts:90` kills the history surviving a load.
- **LOW — S2 had no shrinking case: fixed.** Two cases added; the `follow`
  mutant is killed.
- **LOW — the drift wiring has no test: left on purpose.** It needs an
  elephant test-mode shortcut; live check step 8 carries B3.
- **LOW — `draw()` redrew everything: fixed.** `scrollTo` returns early on
  an unchanged offset; text, colour and font style are set only on a
  change.
- **LOW — headings are measured without bold: left on purpose.** It
  depends on the live check.
