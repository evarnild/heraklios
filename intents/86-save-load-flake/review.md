<!-- generated-by: heraklios/review@0.2.0 -->
# §86 review — The save-load e2e scenario reads the game before the load has happened

verdict: attest
tier: attested
reviewed-commit: 47ca884
round: 1
sampled: no
run: auto
live-check: not-needed

The fix works. With a 500 ms hold on the slot read, `save-load.spec.ts` fails
every time with the old wait and passes every time with `waitLoaded`. The
reviewer reproduced both. A second mutant, which removes the log-entry wait
inside the helper, also turns it red. Nothing needs rework. There are two
LOW notes and one follow-up.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The diff covers exactly the plan's subtasks: the helper in `e2e/helpers.ts`, three specs changed, nothing under `src/`. The text is read from `messagesFor('en').log.gameLoaded`, with no `'Game loaded.'` literal left in `e2e/` code. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: tests only, no rule behaviour |
| 4 | Tests prove the fix, not only pass | pass. Red 3 of 3, then green 3 of 3. The one survivor is equivalent (LOW 1). |
| 5 | Boundary and conventions | pass. `messagesFor` is imported from e2e as `attack-log.spec.ts` and `rules-panel.spec.ts` already do. |
| 6 | Numbers in prose | pass. The plan's red run (`q:2, movementLeft:2` instead of `q:1, movementLeft:3`), its counts and its line citations (`BoardScene.ts:572`, `:994`) reproduce. |
| 7 | Documentation | pass. No README or CLAUDE.md change is needed for test glue. |
| 8 | Guardrails and hygiene | pass. 18 warnings at a cap of 18, no dependency, `git diff --check` clean. |
| 9 | Repository footguns | not applicable |
| 10 | Architecture | pass. The helper sits beside `waitSavePanelLoaded`, and the duplicate in `score-panel.spec.ts` is gone (principle 6). The overlap with `loadFixture` on `main` is a follow-up. |

## Type check
```
type-check: PASS (intent 86, fix)
  note:  4 file(s), 42 line(s) changed outside intents/.
exit: 0
```

## Findings
- **LOW** `e2e/save-load.spec.ts:84-88`: the route's method filter never runs in
  this scenario.
  - The route is installed after the Save, so the only request it sees is
    the Load's GET. A mutant deleting the `if (route.request().method() !==
    'GET') return route.fallback();` line survives.
  - The comment says "POST/PUT", while `writeSave` is a `PUT` and `clearSave` a
    `DELETE` (`src/ui/saveStorage.ts:127-138`).
  - It's harmless and defensive: non-GET requests still fall through to the
    real API. Worth a look; no rework.
- **LOW** `e2e/save-import.spec.ts:76-77`: this scenario can't show the race red
  or green.
  - The fresh page starts from the same test mode and seed as the page that
    made the save, so its pre-load state already equals `saved`. With a 500
    ms hold and the old wait it passes, reading the state while the log still
    holds the 3-entry test-mode log.
  - Plan subtask 4 asked only to record that manual pair, so this isn't a plan
    gap. `waitLoaded` still strengthens the scenario: a load that never lands
    now times out, where before it passed silently.
  - Worth a look: a future fix could change the fresh page's position before
    the load.
- **Follow-up, not a defect of this branch:** `e2e/combatFixtures.ts:105-118` on
  `main` (§73, `loadFixture`).
  - Its `scenes().includes('Board')` wait is redundant.
  - It then waits on the crafted state's shape (phase `combat` plus the unit
    ids). That wait is correct, so §73 doesn't have the race.
  - It can't use `waitLoaded` as is, because `waitLoaded` always calls
    `waitIdle`, and `loadFixture` skips that when a computer seat is loaded.
  - The plan's "converge on the shared helper when they merge" is still to do.
- **Nit:** `e2e/score-panel.spec.ts:35` keeps a local `frames` duplicating
  `helpers.ts`'s. It predates this branch.

## Not checked
- **Reliability over many full-suite runs under heavy load.** One full suite
  plus targeted runs were run. The hold makes the old failure deterministic,
  so a regression would show on every run.
- **Why `placement.spec.ts:39` timed out in the full runs.** It's outside this
  diff; §89 fixed it on `main`, and this branch predates that fix.

## Live check
Not needed. The diff touches only `e2e/**` and `intents/**`. No rule-1 or
rule-2 path is touched, and no Not-checked item needs a live run.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `47ca884`:**
- `npm run verify`: exit 0, `Test Files 103 passed (103)`, `Tests 1747 passed
  | 2 skipped (1749)`, `✖ 18 problems (0 errors, 18 warnings)`.
- `npm run check:intent`: the PASS above.
- **Red:** the old-wait mutant with the hold, `--repeat-each=3`: `3 failed`, each
  at "the loaded game equals the one saved" (q 2 vs 1, movementLeft 2 vs 3).
- **Green:** the branch as committed, `--repeat-each=3`: `3 passed (39.0s)`.
- **Mutants**, each restored by copy:
  - `save-load.spec.ts:93`, the old wait with the hold: KILLED, 3 of 3.
  - `helpers.ts` `waitLoaded`'s log-entry wait replaced by `void loaded;`:
    KILLED (`1 failed`).
  - `save-load.spec.ts:88`, the method filter removed: SURVIVED,
    equivalent here (LOW 1).
  - `save-import.spec.ts:76`, the old wait with a hold on slot 5: SURVIVED,
    the plan's manual pair (LOW 2).
- **The log-entry match.** `en.ts:264` is `gameLoaded: 'Game loaded.'`;
  `startFromMenu` pins `en`. `loadInPlace` (`BoardScene.ts:986-994`) builds a
  new `LogHistory`, adopts the save, and logs `gameLoaded` in the same
  synchronous call.
- **`route.fallback()` is safe:** non-GET requests fall through untouched, and
  `**/api/saves/1` doesn't match the list read `/api/saves`.
- Full `npm run e2e`: `1 failed / 45 passed (3.1m)`, the failure being
  `placement.spec.ts:39` (§89's flake, fixed on `main`, not on this branch).
- `git merge-tree --write-tree main fix/86-save-load-flake` is clean. Nothing
  pushed, and `git status --short` clean.

**Coordinator, re-run, at `47ca884` (2026-11-25 12:20–12:26):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 18 problems (0 errors,
  18 warnings)`, `Test Files 103 passed (103)`, `Tests 1747 passed | 2 skipped
  (1749)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  86, fix)`, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `1 failed`, `45 passed (2.8m)`,
  the failure being `placement.spec.ts:39` (47.4 s, §89's flake). Matches.
- **Coordinator, re-run:** the two surviving mutants against
  `save-load.spec.ts` and `save-import.spec.ts`. MF (the method filter
  removed) SURVIVED, and SI (the old wait with a 500 ms hold on slot 5)
  SURVIVED, each `2 passed`. Matches.
- The tree was `clean` after each.

**Taken on trust:**
- the implementer's 46/46 second full run;
- its earlier standalone pass of `placement.spec.ts`.
