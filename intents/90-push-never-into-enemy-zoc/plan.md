<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §90 plan — A retreating unit never pushes its way into a hex in enemy zone of control

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

`pushCandidates` stops offering a push whose taken hex is under the pushing
unit's enemy ZOC, at every link of a cascade. In the owner's reported
position (green 34,-11 and 33,-10; yellow 34,-12, 35,-12, 35,-11 and 34,-10;
all plain, no river) a DR then eliminates the defender. The mixed-neighbour
reading stays: a friend whose hex is free of enemy ZOC is still offered.
Every consumer goes through `pushCandidates`, so the Board, the computer
seats, the fuzz harness and combat odds all follow:

- `combatOdds.ts:215`;
- `combat.ts:1014`;
- `retreat.ts:41`;
- `combatResolution.ts:294`;
- `BoardScene.ts:2259`.

## Risks

- **Tests that pass whatever the code does.** The new rule is one condition
  in two places, the fixpoint edge and the top-level filter. Each gets its
  own test that fails if that one condition is removed (see Tests).
- **Existing tests whose boxing comes from enemies.** Several existing
  `pushCandidates` and cascade tests surround the pushing unit with enemy
  units. Those enemies' ZOC now also covers the friendly hexes the test
  expects to be pushed into, so the tests' expectations break for exactly
  the reason the owner ruled. Each such test is handled one of two ways,
  never by loosening an assertion to "whatever comes out":
  - **(a) Re-stated:** the expectation changes to the new rule's answer, with
    a comment naming the ZOC source.
  - **(b) Re-fixtured:** the enemy blockers that cast ZOC onto a pushed-into
    hex become enemy **naval** units. `hexesUnderZoc` skips naval units
    (`combat.ts:1093`, `if (t.domain === 'naval') continue;`), so the test
    keeps proving what it was written for, a cascade mechanic, not ZOC.

  Each test's choice is listed in Progress.
- **The fuzz harness's push scenario may stop pushing.** `buildPushScenarioGameState`
  ("reliably reaches several pushes within 30 seeds", the `combat.ts`
  comment) and the `pushesResolved` expectations (`fuzzHarness.test.ts:395`
  `toBe(1)`) may change. The pinned traces (`harnessPinned.test.ts`) may
  change where a seeded game had a push into ZOC.
  - Each changed number or trace line is explained in Progress, as a push
    that is now refused because its taken hex was in enemy ZOC.
  - If the push scenario no longer reaches a push, its builder is adjusted
    so the pushes it builds are legal under the new rule, and the reason is
    recorded. The scenario exists to make the push path reachable.
- **The drift footgun** (a transition falling through instead of returning)
  does not apply: no drift code changes. `combat.ts:1014` only calls
  `pushCandidates`.
- **§73 in flight.** It moves the retreat cascade into
  `engine/combatResolution.ts` and adds an e2e scenario, (c) "a boxed-in
  defender pushes its friend". If (c)'s fixture pushes into enemy ZOC, it
  breaks once both are merged. Whichever merges second re-runs that
  scenario and fixes its fixture, with a line in its review. Not a blocker.
- **Stale line citations.** The lines below are from `main` at `dd46717`.
- **The lint cap.** No new warning. `pushCandidates`' body grows by a few
  lines and stays under 80.

## Verified against the codebase

Re-read on `main` at `dd46717`.

- `docs/research/05-rules-french-original.md:136`: "il est interdit de faire retraite dans une zone de contrôle ennemie".
- `docs/research/05-rules-french-original.md:239-243`: the elimination rule and its push exception, as quoted in intent.md.
- `src/engine/combat.ts:719-730`, `legalRetreatHexes`: `const enemyZoc = hexesUnderZoc(state, unit.owner)`, then `if (enemyZoc.has(mapHexKey(hex.q, hex.r))) return false;`. This is the pattern to reuse.
- `src/engine/combat.ts:732-877`: the `pushCandidates` doc comment. The widened reading is at about `:745-790`, the cascade at `:792-822`, terrain at `:824-839`, and `:841-856` is the paragraph ending "Left as-is … not this comment's call to make unilaterally".
- `src/engine/combat.ts:878`: the `pushCandidates(state, unit, visited = new Set())` signature.
- `src/engine/combat.ts:890`: the `canMakeRoom` seed, from pool units with `legalRetreatHexes(state, u).length > 0`.
- `src/engine/combat.ts:893-910`: the fixpoint edge. `u` joins when a neighbour is same-owner, not excluded, `canMakeRoom`, and `canEnterTerrain(terrainAt(neighbor.position), uCategory)` (`:903`).
- `src/engine/combat.ts:921-929`: the top-level filter. It skips non-friendly or excluded neighbours and terrain `unit` can't enter, then `if (canMakeRoom.has(f.id)) candidates.push(f);` (`:927`).
- `src/engine/combat.ts:1088-1103`, `hexesUnderZoc(state, forOwner)`: enemy land units' six neighbours, skipping off-map hexes and river hexsides (`riverBetween`), with naval units skipped (`:1093`).
- The callers: `combat.ts:1014`, `combatOdds.ts:215`, `retreat.ts:41`, `combatResolution.ts:294`, `BoardScene.ts:2259`. All take the result as is.
- `src/data/map.ts`: hexes 33..35 by -12..-10 are all `plain` (`:1016-1018`, `:1047-1049`, `:1077-1079`), and `RIVER_HEXSIDES` has no edge among the reported hexes.
- `src/engine/combat.test.ts:622-630`: `CENTER = {q:10, r:5}` and its `NEIGHBORS` ring.
- `src/engine/combat.test.ts:690-811`, `describe('pushCandidates')`. The tests are at `:691` (fully friendly ring), `:704` (one enemy neighbour), `:714` (a boxed `f0`), `:744` (mix plus a ZOC-blocked empty hex, via `zocSource` at (10,7)), `:761` (empty marsh), and `:788` (marsh friendlies).
- `src/engine/combat.test.ts:860-877`, `buildChain(length)`. It boxes every link but the last with owner-1 `fantassins` on its five other sides. The links are adjacent, so those enemies cast ZOC onto the next link's hex.
- `src/engine/combat.test.ts:879`: `describe('cascading push')`, which uses `buildChain`.
- `src/engine/fuzzHarness.ts:234`: `buildPushScenarioGameState`.
- `src/engine/fuzzHarness.test.ts:395`: `expect(stats.pushesResolved).toBe(1)`.
- `src/engine/harnessPinned.test.ts:141`: `totals.pushes += game.stats.pushesResolved`.
- `README.md:108-118`: the retreat and push paragraph ("If there's no legal hex to retreat to but at least one neighboring hex holds a friendly unit that can make room …").

## Where this goes

- **Modules touched:**
  - `src/engine/combat.ts`: the rule, plus its interpretation comment;
  - `src/engine/combat.test.ts`;
  - `src/engine/fuzzHarness.ts` and its tests, only if the push scenario
    needs a legal push again;
  - `src/engine/harnessPinned.test.ts`, only for justified re-pins;
  - `README.md`.
- **New modules:** none.
- **Why there:** a rule belongs in the engine (`docs/architecture.md`, the
  engine/presentation principle), at its single source,
  `pushCandidates`. No caller changes.
- **Budget lines:** none. `combat.ts` is not in `scripts/size-baseline.json`
  at a ceiling this change would pass. The implementer re-checks with
  `npm run size:baseline`.

## Subtasks

1. **Failing-first test**, in `describe('pushCandidates')`:
   - **"the reported position: a DR with the only friend's hex in enemy ZOC
     offers no push".** It builds exactly the owner's units (any land type,
     e.g. `fantassins`, owner 0 green, owner 1 yellow), then asserts
     `legalRetreatHexes(state, defender)` is `[]` and
     `pushCandidates(state, defender)` is `[]`.
   - **The control case:** the same position without the yellow unit at
     34,-10 expects `[unit at 33,-10]`, since 33,-10 is now ZOC-free and
     33,-11 is still under 34,-12's ZOC.
   - Commit with the first case red. Its failure output (today it returns
     the 33,-10 unit) goes in Progress.
2. **The rule.** In `pushCandidates`:
   - compute `const enemyZoc = hexesUnderZoc(state, unit.owner)` once;
   - the fixpoint edge (`:898-904`) also requires
     `!enemyZoc.has(mapHexKey(neighbor.position.q, neighbor.position.r))`,
     because `u` would take `neighbor`'s hex;
   - the top-level filter (`:921-927`) skips `f` when its hex is in
     `enemyZoc`.

   All links share one owner, so one ZOC set serves the whole chain. Enemy
   units don't move during a cascade.
3. **The interpretation comment.** Replace the "NOT checked here …" paragraph
   (`:841-856`) with the ruling:
   - the owner's decision of 2026-11-24, made on this intent;
   - the rule (taken hex never under enemy ZOC, at every link);
   - the rulebook line it rests on (`:136`);
   - the two readings rejected;
   - that the mixed-neighbour widening stays.

   Fix any sentence elsewhere in the comment that now contradicts it.
4. **Existing tests.** Run `npx vitest run src/engine/combat.test.ts` and
   handle each red test as (a) or (b) from Risks:
   - `:704` (enemy at `NEIGHBORS[5]`) and `:744` (`zocSource` at (10,7))
     become (a). Their enemy's ZOC now removes the friends on the hexes it
     touches. List which ones in the assertion and in a comment.
   - The `buildChain`-based cascade tests become (b). The blockers on each
     link's two sides that touch the next link become naval placeholders,
     with a comment. Add one new (a)-style cascade test with land blockers:
     the chain is refused at its first link.

   Commit.
5. **The harness.** Run `npm test`. For each changed harness number or pinned
   trace, record in Progress the seed, the old and new values, and why (a
   push into enemy ZOC no longer offered). Adjust `buildPushScenarioGameState`
   only if it no longer reaches a push, and record why. Commit.
6. **README.** Add the condition to the retreat paragraph (`README.md:108-118`):
   a friendly unit can make room only if its hex is not in an enemy zone
   of control; otherwise the retreating unit is eliminated. Commit.

## Tests

| Behaviour | Test | Which mutation it catches |
| --- | --- | --- |
| The reported position: no push | subtask 1, first case | Dropping the top-level ZOC check, or the whole `enemyZoc`. |
| The mixed reading kept | subtask 1, the control case | Over-correcting to "no push if any enemy is adjacent". |
| The cascade link: no inheriting into ZOC | new test in subtask 4: a two-link chain where only the second link's taken hex is under enemy ZOC, from an enemy beside the second link (a land unit). The first link is offered nothing. | Dropping the fixpoint-edge check alone. The top-level check doesn't see the second link. |
| Cascades still work without ZOC | the re-fixtured `cascading push` tests (b) | Breaking the fixpoint itself. |
| The ruling, not a mutant | the `:704` and `:744` re-stated expectations (a) | — |
| The harness follows | `fuzzHarness.test.ts` and `harnessPinned.test.ts`, re-pinned with justification | — |

Mutants the implementer runs and reports, each backed up and restored by
copy:

- the top-level ZOC skip removed;
- the fixpoint-edge ZOC condition removed;
- `hexesUnderZoc(state, unit.owner)` replaced by an empty set.

Each must be killed by a named test above.

## Validation

- `npm run verify` green, lint not above the cap.
- `npm run check:intent`: a ROUTE is expected, because existing tests change
  (subtask 4). review.md states the reason: the owner's rule change
  re-states those expectations.
- `npm run e2e`: run it, since the Board offers pushes through this function.
  No e2e file changes are expected on `main`. §73's push scenario is handled
  as in Risks.
- **Live check:** not owed by path, since only `src/engine/**` and `README.md`
  change. /review decides on rule 3. If it is owed, the owner sets up the
  reported position (test mode, then move units into place), attacks 34,-11
  until DR, and sees the defender eliminated with no amber push hex.

## Assumptions I made

- **Fixture choice (b), naval placeholders,** is a test device, not a rule.
  It keeps the cascade tests about cascades. The alternative, re-deriving
  every cascade geometry without nearby enemies, is larger and proves the
  same thing.
- **One ZOC set for the whole chain is correct,** because every link has the
  same owner and no enemy moves mid-cascade.
- **No e2e scenario on `main` builds a push into enemy ZOC.** `e2e/` on `main`
  has no push scenario; §73's arrives later (see Risks).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-24 — implementation (all six subtasks)

Commits (oldest first): failing-first test; the rule plus combat tests; harness and
session re-fixtures; harness re-pin; README and soak re-pin; comment trim to the size
ceiling; this entry. `git log fix/90-push-never-into-enemy-zoc` has the hashes.

**Subtask 1 (red).** The reported position (`def` 34,-11; `friend` 33,-10; yellow
34,-12, 35,-12, 35,-11, 34,-10), before the rule: `AssertionError: expected [ { id:
'friend', owner: +0, … position: { q: 33, r: -10 } … } ] to deeply equal []` at
`combat.test.ts:719` (`pushCandidates` returned the 33,-10 unit; `legalRetreatHexes`
was already `[]`). The control case (no yellow at 34,-10) passed throughout.

**Subtask 2/3.** `pushCandidates` computes `enemyZoc = hexesUnderZoc(state, owner)` once;
the fixpoint edge and the top-level filter both skip a taken hex in it. The "NOT checked
here ... left as-is" paragraph is replaced by the owner's ruling (rule, rulebook lines,
two rejected readings, mixed widening stays). `combat.ts` was 8 lines over its size
ceiling (1135); the comment was tightened to 1135 lines, no ceiling raised.

**Subtask 4, existing tests (each is (a) re-stated or (b) re-fixtured, none loosened).**
- `combat.test.ts` "a neighbor occupied by an enemy is simply not a candidate": (a). The
  enemy at 10,6 projects ZOC onto f0 (11,5) and f4 (9,6); expectation is now `f1,f2,f3`.
- `combat.test.ts` "regression: a mix of friendlies and one EMPTY, ZOC-blocked hex": the
  plan listed it as (a), but it did not break. The ZOC source at 10,7 touches only the empty
  10,6, not a friendly. Unchanged, still green.
- `combat.test.ts` `buildChain`-based tests (single push, 2-link, 3-link): (b). The blockers
  are naval `galeres` by default. Deviation from the plan's wording: ALL blockers go naval,
  not "the two sides that touch the next link", because every blocker beside a link also
  covers that link's own hex with ZOC. The end-to-end `completePush` test uses the same
  fixture and still passes. `buildChain(length, blockerType)` takes `'fantassins'` for land.
- New: "§90 (a): with LAND blockers the chain is refused at its first link", and "a link may
  not inherit a hex under enemy ZOC" (3-link naval chain plus a land enemy at 13,4 covering
  only the third hex: `pushCandidates(b)` and `pushCandidates(a)` both `[]`).
- `fuzzHarness.test.ts` `makeChainUnit` gained a `typeId` parameter. (b): `buildRetreatChain`
  and the "never offers a unit already in the chain" boxes are `galeres` (tests "drives a real
  3-link cascade", "never offers a unit already in the chain", "does not double-process a
  sibling", "shares resolved ids with the drift queue"). Not in the plan's list (it named only
  `combat.test.ts`).
- `fuzzHarness.test.ts` "counts push cascades triggered by a trampled non-elephant during
  drift" and "does not double-process a pending elephant pushed by a drift-triggered
  retreat": (b) plus geometry. With a land blocker at 11,5 and the elephant at 9,5, all six
  neighbours of the trampled unit are in enemy ZOC, so no push can ever be legal. The blocker
  moved to 12,5, the friend to 11,4, the boxes are naval. Same dice, same asserts (the
  asserted "not at the old hex" coordinate changed to 11,4).
- `gameSession.test.ts` "offers no advance into a defender hex that is occupied again" and
  "a push asks which friend to push": (b) plus geometry. An attacker adjacent to the pushed
  hex always ZOCs it, so these cannot hold on open ground. The fixture moved by (-8,+13) to
  a plain patch where a river runs between e0 (3,17) and b (3,18); the river blocks e0's
  ZOC onto b's hex, and advances ignore rivers. e1..e5 are naval. All expectations are the
  old ones, translated; the attack still has e0 adjacent to a.

**Subtask 5, the harness.** `fuzzHarness.test.ts` `pushesResolved` stays 1 and
`buildPushScenarioGameState` needed no change. For every re-pinned game I instrumented
`pushCandidates` (temporary, restored by copy) to find the first call whose answer differs
between the old and new rule: in every case it is a push refused because its taken hex was in
enemy ZOC. `harnessPinned.test.ts`' fixture: exactly 15 of 70 games changed, the other 55 are
byte-identical (winnerIds of the §81 hand edits kept):

| game | length | pushes | first differing call |
| --- | --- | --- | --- |
| random-default/seed13 | 136 -> 132 | 1 -> 0 | real retreat: p0-phalanx 12,3 was offered p0-cav-l 12,2 |
| random-push-found/seed17 | 118 -> 117 | 1 -> 1 | real retreat: defender 10,5 offered ring0..4, now ring1..3 (ring0 11,5 and ring4 9,6 are in ZOC) |
| ev-vs-ev/seed3 | 36 -> 43 | 0 -> 0 | `retreatCost` priced p0-phalanx 12,3 as pushing p0-cav-l 12,4; now eliminated |
| ev-vs-ev/seed5 | 56 -> 35 | 0 -> 0 | same, p0-phalanx 12,3 |
| ev-vs-ev-found/seed9, 10, 14, 15, 17, 20, 22, 24, 25, 26 | various | 14 and 20: 1 -> 0, rest 0 -> 0 | same, p0-phalanx 12,3 |
| ev-vs-ev-found/seed12 | 53 -> 52 | 0 -> 0 | same, p0-cav-l 15,2 (push of p0-elephant 16,1 refused) |

The EV games diverge without a changed push count because `combatOdds.retreatCost` prices the
defender's elimination through `pushCandidates`; a refused push changes the odds the agent
sees, and play follows from there. `heuristicSoak.test.ts`: swaps-off seed 7 fingerprints
greedy 92 -> 97 and lookahead 58 -> 39 (first differing call: `retreatCost` for p0-phalanx
13,3 / p1-cav-h 16,0 and p0-phalanx 12,3); random and ev did not move. The pinned
greedy-swap game (seed 24) no longer swaps; re-found the same way (greedy seat 0 vs EV,
seeds 1..500): only seed 211 swaps (1 swap), pinned, comment updated.

**Subtask 6.** `README.md` retreat paragraph now states the rule.

**Mutants** (backed up and restored by copy; run on `combat.test.ts`, `fuzzHarness.test.ts`,
`gameSession.test.ts`):
- top-level ZOC skip removed: 4 failed, including the reported-position test;
- fixpoint-edge condition removed: 1 failed, the "a link may not inherit a hex under enemy
  ZOC" test (only that one, as planned);
- `enemyZoc` replaced by an empty set: 4 failed, including the reported-position test.

**Checks.** `npm run verify`: 103 files, 1751 passed, 2 skipped; lint 18 warnings, cap 18
(unchanged). `npm run check:intent`: `type-check: PASS (intent 90, fix)`, no ROUTE printed.
`npm run e2e`: 45 passed, 1 failed (placement "the Turn buttons turn a ship", the known
load timeout); rerun alone: passed.

**Divergences from the plan:** the `:744` test did not break; all chain blockers (not two)
went naval; extra tests in `fuzzHarness.test.ts`, `gameSession.test.ts` and `heuristicSoak.test.ts`
needed re-fixturing, which the plan did not list.
