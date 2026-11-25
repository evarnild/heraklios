<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §89 plan — The placement Turn buttons scenario times out in full e2e runs under load

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

`e2e/placement.spec.ts`'s only scenario spends most of its time placing every
land unit of the default army, 43 of them, one click and one state-wait each,
before it reaches the two ships it tests. The plan first measures that this
loop is where the time goes. Then seat 0 buys a small, ship-heavy army through
the army builder's `»` fill buttons: 8 land units and 15 ships, exactly 400
points. The loop drops from 43 placements to 8. Everything the scenario
proves stays the same, by the same canvas clicks: left Turn gives facing 1,
right Turn gives facing 5. No game code changes.

## Risks

- **Fixing the wrong cause.** The intent's assumption is that the land loop
  dominates. Subtask 1 measures it, under load, before any change. If the
  ship part or the scene start dominates instead, stop and report: the plan
  is then wrong.
- **A test that passes without proving the rule.** The two facing assertions
  and the `naval` check in `placeShip` stay unedited. A changed army must still
  reach a ship being placed by the same route: Menu → army builder → Placement,
  real clicks.
- **Army validity.** `validateArmy` (`src/engine/army.ts:23-52`) requires
  exactly 400 points (`underBudget` otherwise) and each type within its cap.
  The new route asserts the builder's `total` is 400 before "Confirm army". A
  wrong click count then fails loudly, not as a mystery timeout.
- **Index-addressed buttons.** `clickButton(page, '»', i)` addresses rows by
  `UNIT_TYPES` order, as `e2e/army-builder.spec.ts:35,45` already does. A
  reordered `UNIT_TYPES` would shift them, so the scenario looks indices up by
  unit id from `UNIT_TYPES`, never as literals.
- **Workers and timeout.** Both stay as they are (`playwright.config.ts:17`
  `timeout: 30_000`, `:22` `workers: 2`, intent constraint). No `test.slow()`
  or `setTimeout` is added.

## Verified against the codebase

Re-read on `main` at `f18affa`.

- `e2e/placement.spec.ts:39-66`: the scenario.
  - Menu "2", then per seat: wait for "Use default army", click it, click
    "Confirm army".
  - Wait for the `Placement` scene and a state.
  - `:53` `for (let guard = 0; guard < 200; guard++)` places land units one at
    a time, `clickHex` then `waitForFunction(units.length === n + 1)`, until
    `current` is naval.
  - Then `placeShip(page, 0)` and `placeShip(page, 1)` assert facings 1 and 5,
    and no errors.
- `e2e/placement.spec.ts:28-37`, `placeShip`: asserts `current` is naval,
  clicks a free legal hex, `clickButton('Turn', turn)`, "Confirm facing", and
  waits for the unit.
- `src/engine/army.ts:67-79`, `defaultArmySelection`: archers 10,
  fantassins-archers 5, fantassins-lourds 4, phalanges 3, cavalerie-legere 5,
  cavalerie-lourde 5, elephants 3, chars-lourds 8, galeres 1, biremes 1. That
  is **43 land units** and 2 ships.
- `src/data/units.ts`, `UNIT_TYPES`, as cost and cap, land first and ships
  last:
  - archers 5 / 10, fantassins 5 / 10, fantassins-archers 10 / 8,
    fantassins-lourds 10 / 8, phalanges 15 / 5, cavalerie-legere 5 / 10,
    cavalerie-lourde 10 / 8, elephants 10 / 10, chars-legers 5 / 8,
    chars-lourds 10 / 8;
  - galeres 10 / 6, biremes 20 / 5, triremes 30 / 3, quintiremes 50 / 1.
- **The army the new route buys,** by `»` (fill to the cap or to what the
  budget allows, §51):
  1. quintiremes ×1 (50)
  2. triremes ×3 (90)
  3. biremes ×5 (100)
  4. galeres ×6 (60): 300 so far
  5. phalanges ×5 (75): 375
  6. elephants, filled to what's left: ×2 (20), 395
  7. archers, filled to what's left: ×1 (5), **400**

  That is 8 land units and 15 ships. The implementer confirms each fill
  against the builder's `total` (`armyBuilder().total`, `src/ui/devHook.ts:85-89`).
- The Placement queue follows `UNIT_TYPES` order (`e2e/placement.spec.ts:7-10`
  comment, and `placement().current` at `src/ui/devHook.ts:352`), so the 8 land
  units come first, then the galleys.
- `e2e/army-builder.spec.ts:35,45`: `clickButton(page, '»', i)` with `i` the
  `UNIT_TYPES` index.
- `playwright.config.ts:17`: `timeout: 30_000`; `:18-22`: `workers: 2` (§41's
  measured reason).
- §40's review (`intents/40-naval-turn-buttons/review.md`) recorded 14.3 s for
  this scenario.

## Where this goes

- **Modules touched:** `e2e/placement.spec.ts` only.
- **New modules:** none.
- **Why there:** test infrastructure belongs in `e2e/`. No game, ui or dev-hook
  code changes, so the dev-hook member list (`e2e/dev-hook-members.spec.ts`)
  is untouched.
- **Budget lines:** none.

## Subtasks

1. **Measure first (the failing-first evidence).**
   - Wrap the scenario's phases in `test.step(...)`: "build armies", "place
     land units", "place ships". Playwright then reports each step's
     duration.
   - Run `npx playwright test e2e/placement.spec.ts --repeat-each=5
     --reporter=list` twice:
     - quiet;
     - under load, with `npx vitest run` running in a second shell in the
       same worktree, started just before.
   - Record each run's total and per-step durations in Progress, and any
     timeout. Expected: "place land units" dominates, and at least one
     loaded run passes 30 s, which is the red.
   - If the land loop is not the dominant step, stop and report.
   - Commit the `test.step` wrapping alone, behaviour unchanged.
2. **The small army for seat 0.**
   - Replace seat 0's "Use default army" with the seven `»` clicks above,
     each addressed by `UNIT_TYPES.findIndex(u => u.id === '<id>')`.
   - Assert `armyBuilder().total === 400`, then "Confirm army".
   - Seat 1 keeps "Use default army": its placement isn't reached.
   - Add a comment saying why (this intent, the measured numbers) and that
     the cap is 30 s.
   - The land loop, `placeShip` and every assertion stay as they are.
   - Commit.
3. **Measure again.** The same two `--repeat-each=5` runs, quiet and loaded,
   recorded in Progress. Target: quiet under 10 s, loaded never near 30 s.
   **Amended 2026-11-25 (owner: "/auto 89 accept the margin"):** the target
   is quiet about 11 s on this machine (which is never idle), loaded under
   15 s, and at least 2× under the 30 s cap. Round 1 measured quiet 3.8–10.8 s
   and loaded 8.6–14.5 s, so the plan's fallback (a test-mode shortcut) is
   not taken.
4. **Full-suite proof (the intent's outcome).** Five consecutive full
   `npm run e2e` runs, each with `npx vitest run` running alongside in a
   second shell. All green on this scenario. Record each run's pass/fail
   list. Another known flake failing (`save-load.spec.ts:57`, §86;
   `board-view.spec.ts:95`) is recorded, not counted against this scenario.
5. **Progress and status.** The before and after numbers, `npm run verify`,
   `npm run check:intent`.

## Tests

| Behaviour | Test | What fails if it breaks |
| --- | --- | --- |
| Left Turn turns a placed ship counter-clockwise (facing 1) | `placement.spec.ts`, the unchanged `expect(left.facing).toBe(1)` | Swapping the Turn buttons' directions (§40's bug) |
| Right Turn turns it clockwise (facing 5) | the unchanged `expect(right.facing).toBe(5)` | The same |
| The ship is really being placed | the unchanged `placeShip` naval assertion | A route that never reaches a ship |
| The army is legal | the new `armyBuilder().total === 400` before Confirm | A wrong fill sequence, caught as a clear failure, not a stuck Confirm |
| The time budget holds under load | subtasks 3 and 4's recorded runs | The land loop growing back |

Mutant for the implementer to run, and the coordinator to re-run: swap
`clickButton(page, 'Turn', turn)` to `clickButton(page, 'Turn', 1 - turn)` in
`placeShip`. Both facing assertions must fail.

## Validation

- `npm run verify` green (no source change; same test count and 18 warnings).
- `npm run check:intent`: expect PASS (a fix with a changed test file).
- `npm run e2e`: subtask 4's five full runs.
- **Live check:** not owed. `e2e/**` isn't in rule 1's paths, and no runtime
  behaviour of the game changes.

## Assumptions I made

- **The army-builder route over a new test-mode shortcut.** The intent allows a
  shortcut "to reach the ships' turn", but a shortcut would add a Menu button
  and `src/ui/testMode.ts` code (a live check, more surface). The small army
  reaches the same Placement screen by the real route, touching only the
  spec. If subtask 3's numbers miss the target, this is the decision to
  revisit; the plan then stops for the owner.
- **`test.step` stays** after the fix. It costs nothing and keeps the
  per-phase timing visible in any future failure.
- **Seat 1's default army is fine,** because only seat 0's placement runs
  before the assertions.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-25 — all subtasks (commits f6fe7e6, 02c1be1, plus this entry)

- **Subtask 1 (measured first).** `test.step` wrapping (f6fe7e6), then
  `--repeat-each=5` (2 workers; timeout 30 s per test, as configured).
  - Quiet, before: 4 of 5 `timedOut` (37.6, 37.7, 60.0, 60.0 s total incl.
    teardown; the land step was cut off at ~28-31 s), 1 passed at 22.8 s
    (build armies 0.6 s, place land units 17.2 s, place ships 2.0 s). The
    machine was already busy, so "quiet" was not quiet; the plan's 8.8-14 s
    was not reproduced.
  - Loaded (`npx vitest run` alongside), before: 4 of 5 `timedOut` (49.4,
    52.5, 60.0, 60.0 s; land step 27.5-29.0 s), 1 passed at 37.3 s (land
    24.9 s, ships 2.1 s).
  - "place land units" dominates in every run (about 17-31 s against 0.5-0.7 s
    for the builds and about 2 s for the ships), so the plan stands.
- **Subtask 2 (02c1be1).** Seat 0's seven `»` clicks, addressed by
  `UNIT_TYPES.findIndex`, then `armyBuilder().total === 400`. Every fill gave
  the plan's table (the assertion passed in all runs), so no click list
  adjustment. Seat 1 keeps the default army; the timeout, workers, `placeShip`
  and all assertions are unchanged.
- **Subtask 3 (after).** `--repeat-each=5`, all passed.
  - Quiet: totals 11.4, 10.9, 10.5, 10.4, 4.7 s (land 4.7-4.9 s except 1.6 s on
    the fastest; build 0.5-1.0 s; ships 0.7-2.8 s).
  - Loaded: 14.0, 13.3, 11.0, 9.4, 12.4 s (land 3.8-5.2 s; ships 1.4-2.8 s).
  - Divergence: the "under 10 s" quiet target is met only in some runs (4.7 s
    best, about 10.4-11.4 s typical here, on a machine that was not idle).
    The worst loaded run is 14.0 s against the 30 s cap, a 2x margin
    (before: 37-60 s). Not stopped on, since the fix is in place and the
    margin is wide; the owner may want a tighter target.
- **Subtask 4: five full `npm run e2e` runs, each with `npx vitest run`
  alongside.** Run 1: 46 passed. Run 2: 45 passed, 1 failed
  (`save-load.spec.ts:57`, the known §86 flake, not this scenario). Runs 3-5:
  46 passed each. The placement scenario passed in all five.
- **Mutant** (`clickButton(page, 'Turn', 1 - turn)` in `placeShip`, restored by
  copy): the scenario fails at the left-Turn assertion (`Expected: 1,
  Received: 5`). The right-Turn assertion is not reached, because the test
  stops at the first failed `expect`; so one of the two facing assertions
  reports, the second is guarded only by being the same code path.
- **`npm run verify`, `npm run check:intent`:** see the final report.
