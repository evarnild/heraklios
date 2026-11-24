<!-- generated-by: heraklios/review@0.2.0 -->
# §90 review — A retreating unit never pushes its way into a hex in enemy zone of control

verdict: rework
tier: reviewed
reviewed-commit: d2d6a79
round: 1
sampled: no
run: auto
live-check: not-needed

The rule change is correct and its tests prove it:

- all five mutants were killed;
- all 15 re-pinned harness games were replayed and explained;
- the French rule text was re-read.

The verdict is `rework` only for three LOW findings, all mechanical: a stale
measurement in a test comment, a wrong count in Progress, and a test title
that no longer matches its assertion. Once they are fixed, the tier
(`reviewed`) caps the verdict at `escalate`, and the owner reads the diff.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The three departures from the plan are judged below; all are mechanical. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass |
| 4 | Tests prove the rule, not only pass | findings (1): all 5 mutants killed; one stale test title |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | findings (2) |
| 7 | Documentation | pass (one wording nit) |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass |

## Type check
```
type-check: PASS (intent 90, fix)
  note:  8 file(s), 517 line(s) changed outside intents/.
exit: 0
```
The plan expected a ROUTE because existing tests change. The checker
printed PASS, so no ROUTE reason is needed.

## Findings
- **LOW** `src/engine/heuristicSoak.test.ts:409`: the rewritten comment still
  says "none in 60 greedy mirror games".
  - Under the new rule, greedy-mirror seeds 1..60 hold one swapping game,
    seed 25.
  - With the old rule forced back, the same scan finds none, so §90 is what
    moved it.
  - Needs rework: write "1 in 60 greedy mirror games (seed 25)".
- **LOW** `intents/90-push-never-into-enemy-zoc/plan.md:263` (Progress): "exactly
  15 of 70 games changed, the other 55 are byte-identical" is wrong.
  - The fixture holds 66 games (SPECS 30+5+5+6+2+5+1+12): 15 changed, 51
    byte-identical.
  - The coordinator's round 1 prompt repeated the 70/55 figure.
  - Needs rework: append a dated correction to Progress, "15 of 66 … the
    other 51". Progress is the implementer's to append to.
- **LOW** `src/engine/combat.test.ts:733`: the title still reads "…the other 5
  friendlies still are", while the re-stated assertion expects only
  `['f1','f2','f3']`.
  - Needs rework: retitle it, e.g. "…only f1, f2 and f3 remain; f0 and f4
    stand in its ZOC".
- **LOW** `src/engine/gameSession.test.ts:248-258`: the comment names the river
  between e0 (3,17) and b (3,18). The map also has a river between a (2,18)
  and b (3,18), so the tested push crosses a river. That is legal
  (`legalRetreatHexes` ignores rivers, and the rulebook forbids no such
  retreat), but unstated. Worth a look.
- **LOW** `src/engine/fuzzHarness.test.ts`, "plays 100 seeded games headlessly
  end to end…": it now sits closer to its 60 s timeout.
  - Each `pushCandidates` call now builds the enemy ZOC set, and
    `combatOdds.retreatCost` calls it often.
  - Timed alone, it took 38.5 s and 32.5 s on the branch, against 35.4 s and
    28.3 s on an unchanged worktree: about 10% slower, well under 60 s.
  - Under parallel load it timed out in 2 of the coordinator's 4 full
    `verify` runs, and once in the reviewer's M2 run.
  - Worth a look: not a defect of this rule. If the timeouts recur on
    `main`, a later intent can pass the ZOC set into `retreatCost` instead.
- **Nit** `README.md:117`: "A unit never takes a hex that is in an enemy zone
  of control" reads broader than the rule outside its paragraph (movement and
  advances may enter ZOC). "A retreating unit never…" would be exact.

### The three departures from the plan: all mechanical
1. **All `buildChain` blockers became naval.** The plan's criterion ("the
   blockers that cast ZOC onto a pushed-into hex become naval") selects all
   of them. Every blocker beside link i+1 touches the hex link i takes, so
   the plan's "two per link" was a miscount. Land-blocker coverage is kept by
   the new `combat.test.ts:918` test.
2. **`fuzzHarness.test.ts` re-fixtures.** It is the same naval device. In the
   two drift tests the units had to move:
   - with a land blocker at 11,5 and the elephant at 9,5, every free
     neighbour of the trampled 10,5 is under ZOC (checked by hand);
   - dice and assertions are unchanged except the coordinate that follows
     the friend's move.
3. **`gameSession.test.ts` moved by (-8,+13).** e0 must be adjacent to both a
   and b, so on open ground it always puts ZOC on b's hex. A river is the
   only device the rules allow. All 13 hexes are `plain`.
   `riverBetween((3,17),(3,18))` is true and `riverBetween((3,17),(2,18))` is
   false, so the advance is still possible. Every expectation is the old one
   translated.

No assertion was loosened. The only changed expectation, `:733`'s, is
exactly the rule's answer: the enemy at (10,6) puts ZOC on f0 (11,5) and f4
(9,6). The plan expected the `:744` test to change; correctly, it didn't,
because its ZOC source touches only the empty 10,6.

### Rulebook (pass 3)
- `05-rules-french-original.md:136` reads verbatim "- il est interdit de faire
  retraite dans une zone de contrôle ennemie ;".
- `:239-243` matches the intent's quote.
- `02-rules-transcription.md:98` adds "forced" ("may never be forced to
  retreat into"). The French is stricter, and the code follows the French.
  That gap is in the transcription, not in this diff.
- The new interpretation comment (`combat.ts:841-853`) quotes the French
  exactly and records the owner's dated ruling, both rejected readings, and
  that the mixed reading stays. No sentence of the doc comment contradicts
  it.
- The rule is applied generally, not fitted to the reported position:
  - the top-level filter (`:926`) covers the first link;
  - the fixpoint edge (`:901`) covers every deeper link;
  - the friend that makes room takes its own hex through
    `legalRetreatHexes`, which already checks ZOC.

## Not checked
- **`npm run e2e`.** No scene, ui or e2e path changed. The implementer reports
  45 passed, plus the known placement timeout, which passed on its own.
- **The owner's position played in the browser.** `BoardScene.ts:2259` uses
  `pushCandidates` as is, and the engine test covers the exact position.
- **The interaction with §73's e2e push scenario (c)** (plan Risks). Whichever
  merges second re-runs it.
- **Greedy's second divergence point** ("p1-cav-h at 16,0" in the
  heuristicSoak comment). The first point (p0-phalanx 13,3) is confirmed.

## Live check
Not needed. No path rule applies (only `src/engine/**`, tests, `README.md` and
the intent changed). Rule 3 doesn't apply either: the scene's push UI only
displays `pushCandidates`, which is unit-tested on the exact reported
position.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `d2d6a79`:**
- `npm run verify`: exit 0, `✖ 18 problems (0 errors, 18 warnings)` (cap 18),
  `Test Files 103 passed (103)`, `Tests 1751 passed | 2 skipped (1753)`.
- `npm run check:intent`: the PASS above. `combat.ts` is 1135 lines, its
  ceiling.
- **Mutants**, a full `vitest run` each, backed up and restored by copy,
  each patch confirmed by `git diff --quiet`. No mutant survived.

  | # | file:line | change | result | killed by |
  | --- | --- | --- | --- | --- |
  | M1 | `combat.ts:926` | top-level ZOC skip removed | killed (21) | the reported-position test, `:733`, both §90 cascade tests, the 15 re-pinned games, soak fingerprints |
  | M2 | `combat.ts:901` | fixpoint-edge ZOC condition removed | killed (1 real) | "§90: a link may not inherit a hex under enemy ZOC…" (`combat.test.ts:926`). Its second failure was the 100-game soak's 60 s timeout under load. |
  | M3 | `combat.ts:881` | `enemyZoc` → empty set (pre-fix behaviour) | killed (22) | as M1 |
  | M4 | `combat.ts:926` | `f.position` → `unit.position` | killed (30) | control case, session and drift push tests |
  | M5 | `combat.ts:901` | `neighbor.position` → `u.position` | killed (1) | "§90: a link may not inherit…" |

- **Trace re-pins, all 15 replayed.** The reviewer instrumented
  `pushCandidates` to log the first call where the old and new answers
  differ, then restored it by copy. Every replay matched its fixture.
  - seed13: p0-phalanx 12,3 no longer offered p0-cav-l 12,2 (in ZOC);
  - seed17: ring0 11,5 and ring4 9,6 dropped (in ZOC);
  - 12 EV games: via `combatOdds.ts:215` `retreatCost`, p0-phalanx 12,3 loses
    p0-cav-l 12,4 (in ZOC);
  - ev-vs-ev-found seed12: p0-cav-l 15,2 loses p0-elephant 16,1 (in ZOC).
  - The other 51 games are byte-identical.
  - Fixture pushes went from 9 to 6.
  - Swap seed scans: old rule [24]; new rule 1..230 [211], 231..500 [].
  - `buildPushScenarioGameState` still reaches 4 pushes in 30 seeds.
- `git status --short` was clean at the end.

**Coordinator, re-run, at `d2d6a79` (2026-11-25):**
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS
  (intent 90, fix)`, the same note. Matches.
- **Coordinator, re-run:** `npm run verify`, four times while §73's round 2
  review ran e2e alongside. Lint was `18 problems (0 errors, 18 warnings)`
  each time.
  - Two runs green: `Tests 1751 passed | 2 skipped (1753)`. Matches.
  - Two runs red, each `1 failed | 1750 passed`. The failure was
    `fuzzHarness.test.ts › … plays 100 seeded games headlessly end to end …`,
    `Test timed out in 60000ms`.
  - This is the same timeout the reviewer saw under load during M2.
- **Coordinator, re-run:** the soak alone, twice per worktree. §90 took
  38.53 s and 32.51 s; §86's worktree (soak code as on `main`) took 35.44 s
  and 28.29 s. Both pass well under 60 s. The red is load-dependent and
  traced, not a mismatch. It is recorded as the LOW above.
- **Coordinator, re-run:** `combat.ts` line count 1135. `git status --short`
  clean.

**Taken on trust:**
- the implementer's red-run text for the failing-first test (M3 reproduces
  the equivalent failure);
- the implementer's e2e run;
- greedy's second divergence point.
