<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §75 plan — The dev hook is built from small groups, so a new reader is one plain line

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Split `installDevHook` into a few small builder functions. Each builder returns
one group of the `DevHook` members, and `installDevHook` spreads the groups
into the hook object. When the split is done:
- every member is on its own line;
- the packing comments are gone;
- each function is well under the 80-line guardrail;
- `window.__heraklios` exposes exactly the same members, which behave as
  before.

## Risks

- **A member could go missing or be renamed.** `const hook: DevHook = { ... }`
  is typed, so a missing member is a tsc error, but an extra one is not.
  - The hook object stays typed `DevHook`, and each builder returns
    `Pick<DevHook, ...>` of its own keys.
  - The member list is pinned as an e2e characterisation check, written and
    committed before the split, so a member that disappears or appears at run
    time fails the suite.
- **The builders' closures.** `board()`, `mapScene()` and `buttons()` close
  over `game`. They move to module level as functions of `game`, or are passed
  in, so that every builder sees the same game. Nothing else they capture may
  change: `hook.busy()` refers to `hook` itself (`idle: () =>
  hook.busy().length === 0`).
  - `idle` must still call the same `busy`, so it goes in the same group as
    `busy`, or calls a local `busy` function.
- **This plan can only partly be built against `main`.** §74, a blocker, adds
  a second packed line, `landscapeBuilds: …, tooltipText: …`, plus its comment.
  - This intent is `blocked_by: 74`, so the implementer starts from a `main`
    that has §74.
  - The implementer re-reads `devHook.ts` on that `main` before editing, and
    keeps every member it finds, `tooltipText` included.
- **The lint cap.** It must not rise. The split may remove warnings: if
  `installDevHook` drops from 80 lines, no warning was counted for it at 80
  anyway. If a warning goes, lower the cap in the same commit.
- **Size.** `devHook.ts` is 386 lines on `main`. The builders add a few
  function headers. If it nears 500 lines, the builders move to a sibling
  module `src/ui/devHookReaders.ts`.
- **Stale line citations.** They were read at `129b0c7`, before §74 merges.
  Re-check them once it has.

## Verified against the codebase

Re-read on `main` at `129b0c7`.
- `src/ui/devHook.ts:1-10`: the header. The hook is dev-only, installed from
  `main.ts` under `import.meta.env.DEV`, and `e2e/global-setup.ts` checks that
  a production build never contains it.
- `src/ui/devHook.ts:51-143`: `export interface DevHook`, 29 members on
  `main`.
- `src/ui/devHook.ts:186`: `export function installDevHook(game: Phaser.Game): void {`.
- `src/ui/devHook.ts:187-190`: `board()`.
- `src/ui/devHook.ts:192-197`: `mapScene()`, the Board or Placement scene.
- `src/ui/devHook.ts:199-200`: `buttons()`.
- `src/ui/devHook.ts:202-270`: `const hook: DevHook = { ... }`. On `main`, the
  only packed line is at `:265`:
  `animationSpeed: () => animationSpeed(), unitCanvas: (unitId) => unitCanvas(mapScene(), unitId),`.
- `src/ui/devHook.ts:264` (`idle: () => hook.busy().length === 0`): `idle`
  depends on `busy` through `hook`.
- `src/ui/devHook.ts:271`: `window.__heraklios = hook`.
- `src/ui/devHook.ts:273-…`: the module-level helpers already outside the
  function (`placementSnapshot`, `selectedUnitId`, `boardObjects`,
  `displayListSorted`, `rulesPanelSnapshot`, …). That is the pattern the
  builders follow.
- `eslint.config.js:77`: `'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }]`.
- `eslint.config.js:145`: the length rules are off for tests.
- `e2e/global-setup.ts:10`: `const HOOK = '__heraklios'`.
- `e2e/helpers.ts`: the shared helpers for e2e specs.
- §74's branch (`feat/74-unit-hover-stats`) adds
  `landscapeBuilds: () => landscapeBuilds(), tooltipText: () => mapScene().mapView.tooltipText(),`
  and its packing comment. This plan expects them on `main` before work starts.

## Where this goes

- **Modules touched:**
  - `src/ui/devHook.ts`: `installDevHook` becomes a short composition of
    builders.
  - `e2e/`: a new characterisation spec, `e2e/dev-hook-members.spec.ts`.
- **New modules:** `src/ui/devHookReaders.ts`, only if `devHook.ts` would pass
  about 450 lines. Its one job would be the builders that read the game for the
  test hook.
- **Why there:** this is presentation tooling in `src/ui`, the same layer as
  before. One module keeps one job (principle 12), and the size limits are met
  by structure, not layout (principle 13). No new layer and no dependency.
- **Budget lines:** none.

## Subtasks

1. **Characterisation first.**
   - Add `e2e/dev-hook-members.spec.ts`. After `startFromMenu`, it asserts that
     `Object.keys(window.__heraklios).sort()` equals a pinned, sorted list:
     every member the hook has at the start of this work, including §74's
     `tooltipText`. It also asserts each is a function.
   - Run `npm run e2e` and commit before touching `devHook.ts`.
2. **The split.**
   - Move `board`, `mapScene` and `buttons` to module level as functions of
     `game`.
   - Write builders by what they read, each returning `Pick<DevHook, …>`, for
     example:
     - `sceneReaders(game)`: `scenes`, `state`, `testScenario`, `seed`,
       `buttonCount`, `buttonToCanvas`, `placement`, `armyBuilder`;
     - `boardReaders(game)`: `reachable`, `swappable`, `busy`, `idle`,
       `pendingHexes`, `selectedUnitId`, `logEntries`, `logPanel`,
       `rulesPanel`;
     - `mapReaders(game)`: `centerOn`, `hexToCanvas`, `viewCentre`,
       `cameraZoom`, `cameraScroll`, `displayListSorted`, `boardView`,
       `boardObjects`, `hudStrays`, `unitCanvas`, `tooltipText`;
     - `viewReaders()`: `animationSpeed`, `landscapeBuilds`.

     The exact grouping is the implementer's, within the rules below.
   - `installDevHook` becomes
     `const hook: DevHook = { ...sceneReaders(game), ...boardReaders(game), ... }`.
   - `idle` keeps calling the same `busy`. Keep both in one builder, with
     `idle` calling a local `busy`.
   - Remove both packing comments and put every member on its own line.
   - Each builder is under 80 lines, with no new warning.
   - Run `npm run verify` and `npm run e2e`, and commit.
3. **Progress and status.** Record the new line counts (`installDevHook` and
   each builder, measured with eslint's rule), the warning count, and whether
   the cap was lowered. Commit with `status: in-review`.

## Tests

- **The member set.** `e2e/dev-hook-members.spec.ts`, written before the
  split, catches a member that is dropped, renamed or added. It is the mutant
  "drop one spread", or "rename one key", in the split.
- **Each member's behaviour.** Every existing e2e scenario, unchanged, through
  the readers it uses. A builder that reads the wrong scene fails the
  scenarios that use that reader.
- **`idle`/`busy` coupling.** `waitIdle` in every scenario. An `idle` that
  doesn't see `busy` would make scenarios race.
- **Types.** `npm run verify` (tsc): the hook stays typed `DevHook`, and each
  builder returns `Pick<DevHook, …>`.

## Validation

- `npm run verify` green, with lint not above the cap. Lower the cap if
  warnings fall.
- `npm run check:intent` PASS.
- `npm run e2e` green, unchanged apart from the new characterisation spec.
- **Live check:** owed by rule 1 (`src/ui/**`). The smoke suite can stand in
  ("When the smoke suite stands in"): the change is neither new nor visual,
  and every e2e scenario exercises the hook. `/review` decides, naming the
  scenarios and its own `npm run e2e` run.

## Assumptions I made

- **The grouping above is a proposal.** The implementer may regroup, as long as
  each builder has one theme and stays under the limit.
- **The member list is pinned in e2e, not in a unit test.** `installDevHook`
  needs a Phaser game, and e2e already runs it.
- **The plan is drafted against `main` before §74 merges.** The blocker makes
  the build wait for §74, and the implementer re-reads the file then.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### Phase 1-3 — 2026-11-22

- Commits: characterisation spec first, then the split (hashes in `git log`).
- Shipped: `e2e/dev-hook-members.spec.ts` pins the 31 members (including
  `tooltipText` and `tooltipBox` from §74) as functions; passed on the
  unsplit hook. `installDevHook` is now a spread of `sceneReaders`,
  `boardReaders`, `mapReaders` and `viewReaders`; `board`, `mapScene` and
  `buttons` moved to module level as functions of `game`. Both packing
  comments gone, one member per line. `idle` and `busy` live in
  `boardReaders`, `idle` calling the local `busy`.
- Lengths (eslint rule, blank/comment lines skipped): `installDevHook` 9
  (was 80), `sceneReaders` 17, `boardReaders` 49, `mapReaders` 40,
  `viewReaders` 6. `devHook.ts` is 454 lines, so no sibling module.
- Counts: verify green (1670 tests passed, 2 skipped); `npm run e2e` 32
  passed (31 before plus the new spec).
- Warnings: 19, the cap stays 19 (`installDevHook` at 80 was not counted, so
  nothing fell). Cap not lowered.
- Divergence: `viewReaders()` takes no `game` (it reads none); the plan
  sketched it the same way. None otherwise.
