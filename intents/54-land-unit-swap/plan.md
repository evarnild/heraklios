<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §54 plan — Two adjacent friendly land units can swap places, as a game option

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

A house rule, on by default and on for old saves (spec B1, B8): two of the
active player's land units on adjacent hexes swap places in the Movement
phase, each paying its own one-hex step under the normal movement rules (B2-B4).
The legality and the action live in the engine (`swapStep`, a `landSwap`
action) for both the board and the AI (B7); the board highlights swappable
neighbours and swaps on a click (B5), as one undo step (B6). The README says
it departs from the print rule (B9).

## Risks

- **A second copy of the movement rules.** `swapStep` must judge each step
  with the same rules `reachableHexes` applies (`canEnterTerrain`, river
  extra, `movementLeft`, the start-in-ZOC rule), sharing its helpers
  (`enemyZocProjectorsForHex`, `sharesAnyProjector`, the terrain cost) rather
  than re-deriving them. Tests compare a swap step's cost to the cost
  `reachableHexes` gives the same unit for the same hex once it is empty.
- **"Absent means on" (B8).** Every reader of the flag must treat a missing
  value as `true`. Fill it in one place, `migrateSavedGame`
  (`saveGame.ts:223`, "the one place allowed to invent a missing value"), and
  in `createInitialState`'s default, so the engine can read `state.allowSwaps`
  plainly; a test loads a pre-§54 save and checks `allowSwaps === true`.
- **The AI.** `HeuristicAgent` switches on action kinds in three places
  (`heuristicAgent.ts:416`, `:873`, `:997`) and the fuzz harness at
  `fuzzHarness.ts:611`; a new kind they don't expect can throw or be scored
  wrongly. The heuristic agent must skip `landSwap` explicitly, and the
  harness must apply it and keep its invariants.
- **Replays.** `legalActions` order must stay deterministic: list each pair
  once, lower id first, after the unit's `landMove`s, so existing seeded
  tests with swaps off are unchanged and with swaps on they replay the same.
  Existing seeded tests that assume a fixed action list get swaps **on** by
  default now; check which ones change and set `allowSwaps: false` in their
  fixture only where the test is about something else (say so in Progress).
- **The board click.** Today a click on another friendly unit reselects it
  (`BoardScene.ts:1499-1502`). With swaps on, a highlighted swappable
  neighbour swaps instead; every other friendly click still reselects. Don't
  break deselect-by-clicking-the-selected-unit (`:1495-1498`).
- **Undo.** `recordAction` before `applyAction`, as the move path does
  (`:1513-1516`).
- **Tests that pass whatever the code does:** exact costs and positions, the
  ZOC null case, and "none listed with the option off".
- **The lint cap (21)** and `BoardScene.ts`'s existing warnings: put the swap
  click in its own small method, don't grow `onHexClick` past its size.
- **Save format** is a Reviewed path; `SAVE_VERSION` stays 3 (B8), with the
  reasoning in a comment next to `saveGame.ts:24-30`'s.
- **Stale line citations:** re-check before relying on them.

## Verified against the codebase

Re-read on `main` at `2d1a752`.

- `src/engine/movement.ts:26-36` — `enemyZocProjectorsForHex`; `:38-43` —
  `sharesAnyProjector` (both module-private); `:75-147` — `reachableHexes`
  (terrain `:102-103`, start-in-ZOC `:105-113`, occupant `:114-118`, cost and
  river `:120-125`, `movementLeft` `:127`); `:148` — `terrainMoveCost`.
- `src/engine/state.ts:157-175` — `GameState` (`combatMode` `:164`,
  `randomizedTurnOrder` `:173`).
- `src/engine/turnManager.ts:4-21` — `createInitialState(players,
  combatMode, randomizedTurnOrder = false, …)`.
- `src/engine/actions.ts:65-72` — `Action`; `:144-151` — `ActionResult`;
  `:190-217` — the `applyAction` overloads; `:237-259` — `landMove`;
  `:398-425` — `legalActions`, land moves at `:419-422`.
- `src/engine/heuristicAgent.ts:416`, `:873`, `:997` — switches on action
  kind; `src/engine/randomAgent.ts` — picks from `legalActions`.
- `src/engine/fuzzHarness.ts:611` — applies action kinds; `:456-470` — the
  `randomizedTurnOrder` invariant (a model for a swaps-off invariant).
- `src/engine/saveGame.ts:17` — `SAVE_VERSION = 3`; `:24-30` — the
  no-bump reasoning; `:160-175` — `isValidSavedGame`; `:223` —
  `migrateSavedGame`; `:274` — `parseSavedGame`; `:288-300` —
  `buildSavedGame`.
- `src/ui/session.ts:28`, `:79` — `randomizedTurnOrder` in the session and
  its default; `:173-185` — what `applySavedGame` overwrites.
- `src/scenes/MenuScene.ts:83-100` — the turn-order toggle (label `:83`,
  button `:86-94`, click `:95-98`).
- `src/scenes/PlacementScene.ts:96-102`, `src/ui/testMode.ts:65`, `:138` —
  `createInitialState` callers.
- `src/scenes/BoardScene.ts:1463-1523` — `onHexClick`, movement branch
  `:1490-1522`; `selectForMovement` with
  `mapView.highlightHexes(…, 0x4aa6ff, 0.35)` (`:1544`); `src/ui/MapView.ts:309`,
  `:317` — `highlightHexes`, `highlightHexGroups`.
- `src/scenes/BoardScene.ts:2989-3049` — `applyAiAction` (the AI's switch).
- `src/ui/i18n/en.ts` — `menu.turnOrder*`, `actions.move`, `log.computerMoves`.
- README "Moving through your own units" (`README.md:291-305`).

## Subtasks

1. **The rule** (B2-B4, AC1). In `src/engine/movement.ts` add
   `swapStep(state, a, b): { costA: number; costB: number } | null`: null
   unless swaps are on, both are living land units of the same owner on
   adjacent hexes; each step legal by terrain, `movementLeft` and the
   start-in-ZOC rule, with each cost = the destination's terrain cost plus the
   river extra. Reuse the module's helpers. Interpretation comment at the
   function (spec Interpretations: digital-only, ZOC, no charge), quoting the
   print rule. Tests (exact costs, each null case, a cost equal to
   `reachableHexes` with the other hex emptied). Commit.
2. **The option and saves** (B1, B8, AC4). `GameState.allowSwaps: boolean`
   (doc comment like `randomizedTurnOrder`'s); `createInitialState` takes it,
   default `true`; `migrateSavedGame` fills a missing value with `true`;
   `isValidSavedGame` (or the game-state check it uses) accepts a boolean and
   refuses any other value; the no-bump comment beside `:24-30`. Session
   field and default `true`; `applySavedGame` copies it; the three
   `createInitialState` callers pass it. `saveGame.test.ts`: true and false
   round-trip, a pre-§54 save loads with `true`, a non-boolean is refused.
   Commit.
3. **The action and the AI** (B7, AC2, AC3). `{ kind: 'landSwap'; unitId;
   otherId }` in `Action`, a `LandSwapResult` in `ActionResult`, an overload
   and a case in `applyAction` (swap positions, deduct each cost, `charged =
   false` on both, throw on an illegal pair), `legalActions` listing each
   legal pair once (lower id first, after the land moves). `HeuristicAgent`
   skips the kind at its three switches; the fuzz harness applies it, keeps
   its invariants, and runs some seeds with swaps on and some off.
   `actions.test.ts` and `fuzzHarness.test.ts` (at least one swap played over
   the seeds; none with the option off). Fix any seeded test that the new
   default changes, as in Risks. Commit.
4. **The board and the Menu** (B1, B5, B6). Menu toggle under turn order
   (`menu.swaps`, `menu.swapsOn`, `menu.swapsOff` in `en.ts`/`fr.ts`).
   In `BoardScene`: with a land unit selected and swaps on, highlight
   `swapStep`-legal neighbours with their own colour beside the reachable
   ones (`highlightHexGroups`); a click on one runs a small `trySwap` method:
   `recordAction(actions.swap(a, b))`, `applyAction` `landSwap`,
   `reportAction`, log `log.swap(a, b)`, re-render, deselect. Other friendly
   clicks still reselect. `applyAiAction` gains a `landSwap` case logging
   `log.computerSwaps(seat, a, b)` (for the random agent). Check the lint
   count. Commit.
5. **e2e and README** (AC5, B9). `e2e/swap.spec.ts` (header naming §54):
   from a test mode with two adjacent own land units (use or extend a
   `testMode.ts` shortcut; if a new one is needed, add it with a short
   comment), select one, check the dev hook shows the neighbour highlighted
   for a swap (extend the hook read-only if it can't, guarded like its other
   members), click it: positions exchanged, the log line, undo restores both;
   with swaps off in the Menu, the same click selects the other unit. `npm
   run e2e` all green. README section after "Moving through your own units".
   Commit, then the Progress entry and `status: in-review`.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| adjacency check dropped | AC1 non-adjacent pair → null |
| owner check dropped | AC1 enemy pair → null |
| naval or destroyed allowed | AC1 those cases → null |
| terrain check dropped | AC1 impassable terrain → null |
| river extra dropped | AC1 river pair, exact cost |
| `movementLeft` check dropped or off by one | AC1 too-little-movement case, and exactly-enough case |
| start-in-ZOC rule dropped | AC1 sliding along one enemy's ZOC → null |
| option ignored | AC1 option off → null; AC2 none listed |
| a missing `allowSwaps` read as false | AC4 pre-§54 save → true |
| costs not deducted, or swapped between units | AC2 exact `movementLeft` after |
| `charged` not cleared | AC2 a charged unit swaps (if reachable with movement left) or the flag set by hand |
| a pair listed twice or in an unstable order | AC2 exact list |
| heuristic chooses or throws on a swap | AC3 |
| the board click not wired, or swaps on a non-highlighted unit | AC5 |

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS (apart from the owed live check after review).
- `npm run e2e` green, with the new scenario.
- **Live check (owed: `src/scenes/`, `src/ui/`, new behaviour):**
  1. In the worktree, `npm run dev -- --port 5254 --strictPort --host
     127.0.0.1`, open `http://127.0.0.1:5254/`.
  2. The Menu shows "Unit swaps: on". Start a 2-player game; in Movement,
     select a land unit next to a friend: the friend is highlighted for a
     swap; click: they trade places, the log says so, and each unit's
     remaining movement drops by its step.
  3. Swap a front-line unit out of an enemy ZOC; try a pair across a river
     where one unit has too little movement left (no highlight).
  4. Undo the swap: both back. Save, reload: swaps still on. Turn the option
     off in a new game: no swap highlight, a click on the friend selects it.
  5. Load a save made before §54: swaps are offered.
  6. Switch to French: the Menu and log texts.

## Assumptions I made

- Names: `allowSwaps`, `swapStep`, `landSwap`, `LandSwapResult`, `trySwap`,
  and the message keys above.
- The worktree's dev port is 5254 (5200 + 54).
- The swap highlight colour is the implementer's choice, distinct from
  `0x4aa6ff` (reachable) and the attack colours.
- A seeded test that changes only because swaps are now on by default gets
  `allowSwaps: false` in its own fixture, recorded in Progress.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-24 — all five subtasks

Commits: 0e97207 (swapStep + `allowSwaps` field), 046220f (saves, session, UTF-8 byte fix), b6dacbe + 3465fe7 (landSwap action, AI, harness; lint refactor), 66f03e3 (Menu, board, i18n), 3a25cd9 (ring, e2e, README).

Shipped: B1-B9 as specified. `swapStep` in `movement.ts` sharing `enemyZocProjectorsForHex`/`sharesAnyProjector`; `landSwap` action (`applyLandSwap`, `swapActionsFor` helpers); `allowSwaps` on `GameState`, session, Menu toggle (beside turn order), saved; `migrateSavedGame` fills an absent value with `true` at any supported version (so a v3 save without it gets swaps on), `isValidSavedGame` requires a boolean; `SAVE_VERSION` stays 3. The heuristic agent filters `landSwap` out of its legal list at every difficulty. Board: swap partners get a fill (`0x4ae08a`) and a ring; click swaps via `swapOrSelect`, one undo step.

Tests: 57 files, 1017 tests (new: swapStep 9, saves 5, actions 6, heuristic 1, harness 2). Lint 21 warnings (cap unchanged). `npm run e2e`: 15 passed, including the new `e2e/swap.spec.ts` (2 scenarios).

Seeded tests set to `allowSwaps: false`: none needed; every existing seeded test passed unchanged with swaps on by default. The harness test "plays no landSwap with the option off" builds its own state with the option off.

Divergences from the plan:
- The swap highlight alone is invisible: unit markers (depth 10) cover the fill overlay (depth 5). Added `MapView.highlightRings` (outline at depth 11) and ring the partners too; e2e checks a pixel region of the partner hex changes with swaps on and stays unchanged with them off.
- Dev hook gained a read-only `swappable(unitId)` (via `swapStep`); `e2e/swap.spec.ts` starts from "Combat test mode" (adjacent own land units), no new `testMode.ts` shortcut was needed.
- The Menu has no spare row, so the swaps toggle sits on the turn-order row (turn-order button moved 140 px left).
- `applyAction`'s `landMove` body moved to `applyLandMove` to keep lint at 21 (no behaviour change).
- Commit 0e97207 contains non-UTF-8 bytes (a Windows encoding slip in a script); 046220f repairs them, so only that one commit is affected.

### 2026-10-25 — review round 1 rework

Commits (after 27f9ac6): the README/AI-claim commit, then one each for H1 (heuristic test), S6 (saves test), M2b/M4/M5b (movement tests), F2 (fuzz harness), B6/B9 (e2e); this entry last.

Resolutions:
- Needs decision, owner chose (a): README says the computer never swaps at any difficulty (Random included; §59 will add it), and the Random table row says so. The scene's `landSwap` case in `applyAiAction` and `log.computerSwaps` stay, with a comment that they are unreachable until §59 (removing the case would only add an unhandled-kind hazard).
- H1: random-tier test with `[endPhase, landSwap x3]` over 20 seeds. S6: v2 save without `allowSwaps` loads with it `true`. M2b/M4a/M4b/M5b: galley next to infantry on (20,4)/(20,3) both ways, distance 2 with no enemy, destroyed first unit. F2: `applyOneAction` handles `landSwap` in its own case that asserts the two positions exchanged, plus an exhaustive `default:` that throws. B6/B9: e2e clicks an empty reachable hex after a swap (nobody moves) and, with swaps off, after clicking the friend (the friend moves).
- LOW: the print rule is quoted verbatim in README and the `swapStep` comment; "actions 5" corrected to 6 above. The Menu-toggle placement and P1/U1 wiring stay with the live check.

Mutants, each run alone and restored by copy, all killed: H1 (filter removed: heuristic test fails), S6 (fill only at `SAVE_VERSION`: saves test fails), M2b, M4a, M4b, M5b (movement tests fail), F2 (`landSwap` case dropped: harness tests fail, 4), B6 (drop `deselectMovement()`: e2e test 1 fails), B9 (`selectForMovement(other)` no-op: e2e test 2 fails).

Counts: 57 files, 1022 tests; lint 21 of 21; `npm run e2e` result in the report.
