<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §86 plan — The save-load e2e scenario reads the game before the load has happened

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

After a Load click, a scenario waits for the load itself (the Board logging
`Game loaded.`, read from `messagesFor('en')`) before it reads the state. The
wait lives once, in `e2e/helpers.ts`, and every scenario on `main` that clicks
Load in a Board that is already open uses it: `save-load.spec.ts`,
`save-import.spec.ts` and `score-panel.spec.ts` (which drops its local copy).
A delayed save read (`page.route`) makes the save-load scenario red before
the fix, every run, and green after it. Test code only; nothing under `src/`
changes.

Only code on `main` is in scope. The §83 branch (`e2e/end-move-warning.spec.ts`,
AC10) and the §73 branch (`e2e/combatFixtures.ts`, `loadCombatFixture`) carry
the same race in their own new code, already fixed there with the
`Game loaded.` log wait; they converge on the shared helper when they merge.
This plan does not touch them.

## Risks

- **A test that passes whatever the code does.** The new wait could be true
  before the load, or the delay could fail to bite. The proof is the red run
  with the delay and the old wait, then green with the new wait (Tests).
- **A stale `Game loaded.` entry.** The wait is only sound if each load starts
  a fresh log. It does: `loadInPlace` runs `resetSceneState`, which creates a
  new `LogHistory` (`BoardScene.ts:572`), and logs `gameLoaded` after it
  (`BoardScene.ts:994`). A scenario that loads twice in one page is still
  correct.
- **The delay route catching the wrong request.** The save write is also a
  request to `/api/saves/1` (not a GET), and the panel's list read is
  `/api/saves` (no slot). The route must hold only the slot's GET, or it
  would delay the save itself, or nothing.
- **A load that fails.** If `readSave` fails or the slot is empty, `loadFrom`
  logs nothing and the wait times out: an honest red, not a hang.
- **Lint cap.** `npm run lint` is capped at 18 warnings. Test code is not
  expected to add any; the cap stays 18 and is never raised.
- **Stale line citations.** All lines below were read at the recorded commit;
  re-check before launch.

## Verified against the codebase

Re-read on `main` at `54ccccd`.

- `e2e/save-load.spec.ts:82-84` — `clickButton(page, 'Load', ...)`, then
  `waitForFunction(() => scenes().includes('Board'))`, then `waitIdle`. The
  Board is already open, so both are true before the load lands. `:86` is the
  assertion that fails (`withoutClock(await state(page))` equals
  `withoutClock(saved)`).
- `e2e/save-load.spec.ts:88-91` — the §49 B8 assertions (`logEntries()` kinds
  are `['heading','entry']`, `log[1]!.text` is the literal `'Game loaded.'`).
  They stay; the literal moves to `messagesFor('en').log.gameLoaded`.
- `e2e/save-load.spec.ts:30-36` — `acquireSaveLock` in `beforeEach`,
  `withSaveLockHeld` in `afterEach`, slot-1 file removed first. A `page.route`
  belongs to the test's page and goes with it.
- `src/ui/saveLoadPanel.ts:339-354` — `loadFrom`: `await readSave(slot)`;
  returns on `this.closed`, on `!result.ok` and on an empty slot; otherwise
  `this.close()` then `this.config.onLoad(result.value)`. This is the async gap.
- `src/ui/saveStorage.ts:85,97-108,112` — `savePath(slot)` is
  `` `/api/saves/${slot}` ``; `readSave` is a `fetch` of it (a GET);
  `readAllSaves` fetches `/api/saves`, a different URL.
- `src/scenes/BoardScene.ts:985-994` — `loadInPlace(save)`: `resetSceneState`,
  `adoptSave`, ..., `this.log(messages().log.gameLoaded)`; wired as the panel's
  `onLoad` at `:1042`. `:572` — `this.logHistory = new LogHistory()` in
  `resetSceneState`. `:888` — a Board opened from the Menu's Load also logs
  `gameLoaded` (`MenuScene.ts:267`); not used here.
- `src/ui/i18n/en.ts:264` — `gameLoaded: 'Game loaded.'`;
  `src/ui/i18n/index.ts:77` — `messagesFor(lang)`. `e2e/attack-log.spec.ts:12,23`
  and `e2e/rules-panel.spec.ts:12,26` already do
  `import { messagesFor } from '../src/ui/i18n/index'` and
  `const en = messagesFor('en')`: an e2e file importing it is the pattern.
- `src/ui/devHook.ts:93,289` — `logEntries(): {kind, text}[]`, read from the
  Board's `logHistory`. It is enough: no new dev-hook reader, no `src/` edit.
- `e2e/helpers.ts:59,97,134,161-163,170-189` — `waitIdle`, `state`, `frames`,
  `waitSavePanelLoaded`, `waitLoadOnRowOf`, `loadOnSameRowAs`. The file is 223
  lines and already imports from `../src/` (types only).
- `e2e/score-panel.spec.ts:61-66` — local `waitLoaded(page)`:
  `waitForFunction` on `logEntries().some((e) => e.text === 'Game loaded.')`,
  then `waitIdle`, then `frames`. Called at `:185`, `:221`, `:275`. It has its
  own local `frames` (`:35`) and imports from `./helpers` at `:12-26`.
- The five other specs the intent lists, each read at the cited line:
  - `board-view.spec.ts:87` — follows `page.reload()` and the Menu's test-mode
    button. **Not a Load click**; the Board really is absent until it starts.
  - `draw-order.spec.ts:17` — follows the Menu's combat-test button. Not a load.
  - `language.spec.ts:48` — follows the Menu's French test-mode button. Not a load.
  - `swap.spec.ts:41` — `openCloseCombat`, the Menu's combat-test button. Not a load.
  - `save-import.spec.ts:75-77` — **follows a Load click**. `startFromMenu`
    opens the Board (`:58`), then slot 5 is loaded in place and the wait is
    `scenes().includes('Board')`, already true; `state` is read next. Same
    race, in scope.

  So of the five, one has the race; the other four wait on a Board that does
  not exist yet and need no change.
- A search for `clickButton(..., 'Load', ...)` in `e2e/` finds only
  `save-load.spec.ts`, `save-import.spec.ts` and `score-panel.spec.ts` on `main`.
- `package.json:12` — `"lint": "eslint . --max-warnings 18"`.
- `intents/86-save-load-flake/metadata.yml` — `type: fix`,
  `intent_accepted: 2026-11-24 by-agent`, `blocked_by:` empty.

## Where this goes

- **Modules touched:** `e2e/helpers.ts` (new exported `waitLoaded`, plus an
  import of `messagesFor`); `e2e/save-load.spec.ts`; `e2e/save-import.spec.ts`;
  `e2e/score-panel.spec.ts` (local copy removed, imports the shared one).
- **New modules:** none.
- **Why there:** `helpers.ts` is the home of the shared scenario steps, and
  `waitSavePanelLoaded`, `waitLoadOnRowOf` and `loadOnSameRowAs` are the Load
  click's neighbours. Nothing under `src/` changes, so
  `docs/architecture.md`'s engine/presentation boundary is untouched.
- **Budget lines:** none. Every file stays well under 500 lines
  (`helpers.ts` from 223 to about 235).

## Subtasks

1. **Failing-first (red).** In `save-load.spec.ts`, before the Load click,
   install a `page.route` that holds the slot's GET for about 500 ms and then
   continues, matching only that GET (see Risks). Leave the old `scenes()` /
   `waitIdle` wait as it is. Run `npx playwright test e2e/save-load.spec.ts`
   and record the failure: the assertion at `:86` receives the pre-load
   position (the archers' second move, `q:2, movementLeft:2`). Run it twice
   more; the intent expects red every time. Proof: the recorded red runs in
   `## Progress`. This subtask is not committed alone as a red final state;
   it is committed with subtask 3 (`verify` does not run e2e, so an
   intermediate commit would also be green on `verify`).
2. **Add `waitLoaded(page)` to `e2e/helpers.ts`.** It waits for a log entry
   whose text equals `messagesFor('en').log.gameLoaded` (passed to
   `waitForFunction` as an argument), then `waitIdle`, then `frames`, with a
   doc comment naming the race: a load is an async HTTP read and the Board is
   already open, so `scenes()` is no signal. Proof: subtask 3's green run.
3. **Use it in `save-load.spec.ts`:** replace `:83-84` with `waitLoaded`, and
   take the `'Game loaded.'` at `:91` from `messagesFor('en')`. Keep the delay
   from subtask 1. Run the spec three times (`--repeat-each=3` is supported):
   green each time. Proof: green with the delay.
4. **Use it in `save-import.spec.ts`:** replace `:76-77` with `waitLoaded`. Run
   the spec. By hand, once, hold the slot 5 GET with the old wait and then with
   `waitLoaded`, and record both results in `## Progress` (the delay is not
   left in that spec). Proof: the manual pair, and the spec staying green.
5. **Use it in `score-panel.spec.ts`:** delete the local `waitLoaded`
   (`:61-66`), add `waitLoaded` to the `./helpers` import; its three call
   sites are unchanged. Run that spec once.
6. **Gates:** `npm run verify`, `npm run check:intent`, then the whole
   `npm run e2e` once (one heavy command at a time, per the intent's memory
   constraint). Search `e2e/` for a leftover `'Game loaded.'` literal.

## Tests

- **The failing-first test** is `save-load.spec.ts` itself with the delayed
  slot read: red before subtask 3, green after it (the intent's own repro).
  The delay stays in the spec, so the scenario is deterministic from now on and
  a regression of the wait reds on every run, not one in six.
- **For each behavioural line, what would fail if it were mutated:**
  - `waitLoaded` waiting on the log text: swap it back to the `scenes()` /
    `waitIdle` pair and the delayed `save-load` run is red (subtask 1 again).
  - `waitLoaded` reading the text from `messagesFor('en').log.gameLoaded`,
    not a literal: a rewording changes both sides together; a stale literal
    would time out. Backed by the literal search in subtask 6.
  - The `:88-91` log assertions stay and fail if the load does not log.
  - The route holding only the slot GET: a route that also held the save
    write or the list read would not reproduce the `q:2` pre-load position
    under the old wait, so the red run in subtask 1 shows the route is scoped
    right.
- **No new unit test:** `waitLoaded` is e2e glue and `e2e/` has no unit tests
  for its helpers; the red/green pair is its proof.

## Validation

- `npm run verify` green (lint stays at the cap of 18: no warning is added or
  removed, so the cap is neither raised nor lowered)
- `npm run check:intent` PASS
- `npm run e2e` once, whole suite
- `npm run size:baseline` shows no growth beyond budget (`score-panel.spec.ts`
  shrinks by a few lines, `helpers.ts` grows by about 12; neither nears 500)
- Live check: none owed. The changed paths are `e2e/**` only (Attested per the
  intent); nothing in `src/scenes/`, `src/ui/`, `src/map-editor/`,
  `src/main.ts`, `index.html`, `vite.config.ts` or `.claude/settings.json`.
- Manual browser check: none — test code only

## Assumptions I made

- **The delay stays in the existing scenario** rather than being a second
  test: one startup, one saves lock, and the scenario becomes deterministic.
  The cost is about half a second per run. If the owner would rather keep the
  undelayed scenario and add a separate slow-load one, subtasks 1 and 3 split.
- **The helper is named `waitLoaded`**, the §81 name, so `score-panel`'s three
  call sites need no rename and the in-flight branches can adopt it as is.
  The intent left the name to the plan.
- **`waitLoaded` keeps §81's body** (log wait, `waitIdle`, `frames`).
  `save-load` and `save-import` gain one two-frame wait; harmless.
- **A 500 ms delay** (the intent's number) on the slot GET only; the write and
  the list GET are left alone.
- **`save-import.spec.ts` is in scope.** The intent left it to the plan to
  check, and it has the race; the other four named specs have no Load click.
- **No `follows_up`, no `blocked_by`.** The §83 and §73 branches are not on
  `main`; when they merge they use the shared helper.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-24 — implementation (one phase)

Commit: see `git log` on `fix/86-save-load-flake` (code commit "§86: waitLoaded helper ..."; this entry and `status: in-review` in a second commit).

- **Red first.** Added the 500 ms hold on `GET /api/saves/1` (method-checked, `route.fallback()` otherwise) to `save-load.spec.ts` with the old `scenes()`/`waitIdle` wait: `npx playwright test e2e/save-load.spec.ts` failed 3 of 3 runs at the "loaded game equals the one saved" assertion (pre-load position).
- **Shipped.** `waitLoaded(page)` in `e2e/helpers.ts` (waits for a log entry equal to `messagesFor('en').log.gameLoaded`, then `waitIdle`, then `frames`). Used in `save-load.spec.ts` (delay kept; log assertion now reads the text from `messagesFor('en')`), `save-import.spec.ts` (now-unused `waitIdle` import removed) and `score-panel.spec.ts` (local copy deleted). Nothing under `src/` changed.
- **Green.** `save-load.spec.ts --repeat-each=3`: 3 passed. `score-panel.spec.ts`: 7 passed. `save-import.spec.ts`: passed.
- **save-import manual pair (delay on slot 5 GET, not left in the spec).** With `waitLoaded`: passed. With the old wait: also passed. Interpretation: that scenario's pre-load state already equals the saved one, so the race cannot show there; the change is correct but not provable red/green for that spec. Recorded, not a plan deviation in code.
- **Gates.** `npm run verify`: 103 files, 1747 passed | 2 skipped; lint 0 errors, 18 warnings (cap 18, unchanged); `npm run check:intent`: `type-check: PASS (intent 86, fix)`. No leftover `'Game loaded.'` literal in `e2e/` (only comments).
- **Full `npm run e2e`.** Run 1: 45 passed, 1 failed (`placement.spec.ts:39`, "the Turn buttons turn a ship being placed", no Load involved; passed alone). Run 2: 46 passed. The placement failure is an unrelated flake, not investigated here.
- **Mutants.** The old-wait swap (plan's mutant) is subtask 1's red run. No other mutants run.
- **Deviations.** None in code. Port 5232 was busy at times; waited and retried.
