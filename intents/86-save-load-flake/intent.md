<!-- generated-by: heraklios/intent@0.1.5 -->
# §86 — The save-load e2e scenario reads the game before the load has happened

**Type:** fix
**Originator:** the owner (2026-11-23): "save-load flake", after the §81 and
§80 reviews both met it.
**Source:** `intents/81-live-score/review.md` (round 1, MEDIUM, and rounds 2
and 3); `intents/80-attack-sum-before-target/review.md` (LOW);
`intents/64-vector-view/review.md:244`.

## Problem

`e2e/save-load.spec.ts:57` ("a saved game loads back to the saved position")
fails now and then in a full `npm run e2e` run. It passes when run alone.

- **How often.**
  - §64's reviews record 2 failures in about 18 reviewer runs and 2 in 10
    coordinator runs.
  - The §81 and §80 reviews each saw it again.
  - §81's round 2 reviewer reproduced it on a clean `main`, once in 3 full
    runs.
- **What it shows.** The assertion at `:86` ("the loaded game equals the one
  saved") receives the position from before the load: the archers' second
  move is still there (`q:2, movementLeft:2` instead of `q:1,
  movementLeft:3`).
- **The cause**, found by reading in §81's reviews:
  - After the Load click, the scenario waits for
    `scenes().includes('Board')` (`save-load.spec.ts:83`) and then
    `waitIdle`.
  - Both are already true before the load lands, because the Board is
    already open.
  - `SaveLoadPanel.loadFrom` (`src/ui/saveLoadPanel.ts:339-354`) awaits
    `readSave` over HTTP before it calls `onLoad`. Under load the scenario
    can therefore read the state first.
- **Same pattern elsewhere.** Five other specs wait on the same
  already-true condition: `board-view.spec.ts:87`, `draw-order.spec.ts:17`,
  `language.spec.ts:48`, `save-import.spec.ts:76`, and `swap.spec.ts:41`.
  Whether any of them follows a Load click is for the spec or plan to check.
- **Impact.** It is test-only: no game state, save or rule is wrong. But it
  makes a red full run that is not a regression, costs a re-run of a
  1–1.5 GB suite on a tight machine, and teaches reviewers to ignore a red
  save-load result.

## Outcome

- `save-load.spec.ts` waits for the load itself before it reads the state.
  Today the scene logs `Game loaded.` once, so waiting for that log entry
  works, as §81's `waitLoaded` helper does
  (`e2e/score-panel.spec.ts` on that branch).
- **A shared helper.** The wait lives in one place in `e2e/helpers.ts`, so
  every scenario that clicks Load uses it, and §81's local copy can later go.
- **It can't pass by luck.** A test proves the wait works: a scenario that
  slows the save API's read (for example `page.route` on the save endpoint)
  and still passes. Before the fix, the same slowed run fails every time.
- **No change** to the game, the save API, or any other scenario's meaning.

## Constraints

- **Test code only.** No file under `src/` changes, unless the wait needs a
  new dev-hook reader. The spec should check whether `logEntries()` is
  enough.
- **The failing-first test** is `save-load.spec.ts` itself, run with the
  save read delayed (the repro below).
- **The log wording** `Game loaded.` is a player-facing message. The helper
  must read it from `messagesFor('en')` and not repeat the literal, so a
  rewording doesn't silently break the wait.
- **Blocked by nothing.** §81 adds its own `waitLoaded` and a second
  scenario with the same race (fixed there). Whichever merges second keeps
  one helper: if §81 merges first, this intent moves its helper into
  `helpers.ts` and points §81's cases at it.
- **Memory.** One heavy command at a time. The repro uses a delay, not a
  load test.

## Type-specific questions

### Fix
- **What broke:** a scenario reads state before an asynchronous load
  completes.
- **Since when:** since loads became asynchronous HTTP reads, which is §45
  ("Games are saved as files on this PC"). That is likely, but it was not
  verified. §33 and §48 have also seen it.
- **Impact:** test flake only; it does not corrupt a game or a save.
- **Reproduction (deterministic):**
  1. In `save-load.spec.ts`, before the Load click, add a route that holds
     the slot's GET response for about 500 ms
     (`page.route('**/api/saves/**', ...)`).
  2. Run `npx playwright test e2e/save-load.spec.ts`.
  3. Expected today: the "loaded game equals the one saved" assertion fails,
     with the pre-load position.
- **The test that fails first:** that same spec with the delay.

## Assumptions I made

- **Type: fix.** It corrects a defect in a test, with no new behaviour.
- **Tier.** The path table gives Attested (`e2e/**`), so `review_tier` is
  left empty.
- **Id:** 86, from `npm run queue -- --next-id`.
- **`follows_up` is not set.** §45 is the likely origin but isn't verified,
  so it is only in `links`.
- **The helper's name and home** (`waitForLoad` in `e2e/helpers.ts`) are the
  plan's to settle.
