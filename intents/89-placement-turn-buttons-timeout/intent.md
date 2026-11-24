<!-- generated-by: heraklios/intent@0.1.5 -->
# §89 — The placement "Turn buttons" scenario times out in full e2e runs under load

**Type:** fix
**Originator:** the coordinator, seeing it three times in one day (2026-11-24), raised by the owner: "make the placement Turn buttons flake an intent"
**Source:** the implementer reports of §83, §86 and §88 (2026-11-24), and §40's review.md "Not checked"

## Problem

`e2e/placement.spec.ts`, "the Turn buttons turn a ship being placed the way
they sit", fails in full `npm run e2e` runs by hitting the 30 s test timeout,
then passes when run alone. On 2026-11-24 it happened in three different
worktrees:

- §83's run: 51 passed, 1 failed. This scenario hit a 30 s timeout while
  other worktrees were running, then passed alone.
- §86's run: 45 passed, 1 failed (`placement.spec.ts:39`). It passed alone,
  and the next full run was 46/46.
- §88's run: 47 passed, 1 failed. "Turn buttons" took 55.7 s and timed out
  under load. Alone it took 12.0 s.

In a quiet run it takes 8.8–14 s. That is already the slowest scenario by
far: §40's review recorded "`placement.spec.ts` takes 14.3 s, about three
times the other scenarios" and listed repeat runs under "Not checked". The
scenario places every land unit of the default army one click at a time,
waiting on the state after each (`for (let guard = 0; guard < 200; guard++) {
… clickHex … waitForFunction(… units.length === n + 1 …) }`), before it
reaches the two ships it is about. Each click costs more when the machine is
busy, and the per-test budget is `timeout: 30_000` (`playwright.config.ts:17`).
Under load the scenario needs more than its whole budget.

The cost: every red full run makes an implementer, a reviewer and the
coordinator re-run the scenario alone and argue that the red isn't theirs.
Each time this happens, a real regression in Placement is easier to wave
through as "the known flake".

## Outcome

- The scenario passes in full `npm run e2e` runs under the load these runs
  see. That means two workers plus another worktree's e2e or vitest run.
  Concretely: 5 consecutive full runs green while another worktree runs
  `npm run verify` alongside. Today, 3 of the 8 full runs recorded on
  2026-11-24 went red on this scenario: §83 1 of 1, §86 1 of 2, §88 1 of 1,
  the §73 reviewer 0 of 2, the coordinator's re-check 0 of 2.
- It still proves §40's behaviour, by canvas clicks: the left Turn button
  gives facing 1, the right gives facing 5, for a ship being placed.
- A quiet run of it takes well under the 30 s budget, with a margin recorded
  in the plan (e.g. under 10 s).

## Constraints

- **e2e acts by canvas clicks** (`CLAUDE.md`: "Scenarios live in `e2e/`, start
  from a `src/ui/testMode.ts` shortcut and act by canvas clicks"). Reaching the
  ships' turn may use a shortcut, but the Turn and Confirm facing clicks under
  test stay real clicks.
- **The dev hook ships only in dev builds** (`src/ui/devHook.ts`, checked by
  `e2e/global-setup.ts`). Any new reader or shortcut follows the pinned
  member list in `e2e/dev-hook-members.spec.ts`.
- **No game behaviour changes.** This is test infrastructure. If a test-mode
  shortcut is added to `src/ui/testMode.ts`, it changes no rule and no
  default.
- **Don't fix it by only raising the timeout.** That hides the slowness the
  next scenario will hit. A longer budget for this one test is acceptable
  only beside a change that makes it faster, and the plan says why.
- **Workers stay at 2** (`playwright.config.ts:18-22`, §41's measured
  reason).

## Type-specific questions

### Fix
- **What broke:** the scenario times out at 30 s in full e2e runs on a busy
  machine (observed 55.7 s), though alone it takes 8.8–14 s.
- **Since when:** since it was added by §40 (`45e59d2`, 2026-10-21), which
  already noted its 14.3 s and left repeat runs unchecked. It became visible
  as more worktrees started running e2e side by side (§60, five parallel
  intents).
- **Impact:** test-only. No game or save is affected. Full e2e runs go red
  about one time in three under parallel work, costing re-runs and making
  real Placement regressions easier to dismiss.
- **Reproduction:** run `npm run e2e` in one worktree while another runs
  `npm run verify` or `npm run e2e`. Or loop the scenario under a CPU hog:
  `npx playwright test e2e/placement.spec.ts --repeat-each=5` beside a busy
  `npm test`.
- **The test that will fail first:** `e2e/placement.spec.ts:39` itself, with
  its duration measured. Before the fix, a loaded repeat run exceeds 30 s at
  least once. After the fix, the same loaded loop stays green, and its
  quiet duration drops below the plan's target. The plan names the exact
  loop and load.

## Assumptions I made

- **A fix, not a feature.** The scenario misbehaves, while the game is fine.
- **`follows_up: 40`.** §40 added the scenario, and its review already
  recorded the long duration as a risk.
- **Review tier:** left empty. `e2e/**` and any `src/ui/testMode.ts` or dev-hook
  touch are Attested by the path table.
- **A live check is probably not owed.** It's owed only if `src/ui/` changes
  (a test-mode shortcut or dev-hook reader). Then the smoke suite itself
  covers it, and `/review` decides.
- **No `blocked_by`.** It doesn't wait on §86, whose own save-load fix is
  separate, though both make full runs flaky.
- **The cause is the land-placement loop's length, not the Turn buttons.**
  The failures came at the timeout and the scenario passes alone. The plan
  confirms this from a trace before choosing the fix.
