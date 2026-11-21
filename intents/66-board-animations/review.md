<!-- generated-by: heraklios/review@0.2.0 -->
# §66 review — The vector view animates moves, combats and drifts

verdict: rework
tier: attested
reviewed-commit: 9ecfc06191592f68d91f81385f7a4bb04edf9232
round: 1
sampled: no
run: auto
live-check: owed

Tier is Attested by the path table (`src/ui/**`, `src/scenes/**`, `src/engine/**`
paths not on the Reviewed list). `review_tier` is empty, the rulebook basis is
"digital-only", and no finding is CRITICAL or HIGH. `sampled: no`: the verdict
is not `attest`.

The verdict is `rework`. One finding needs the owner's decision; the others are
mechanical. The reviewer's mutation pass was stopped by Claude Code for low
memory after 30 of 54 mutants; the 24 not run are listed under Not checked.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — digital-only; the charge path reuses `evaluateCharge`/`straightLineDirection`, the naval path mirrors `applyAction`'s `navalMove` (`actions.ts:310-345`) |
| 4 | Tests prove the rule | findings (3); partial: 30 of 54 mutants |
| 5 | Boundary and conventions | pass — each `applyAction` is replaced one for one by `cues.apply`, with every `recordAction`/history push still before it; no new die roll, undo boundary, `GameState` shape or `SAVE_VERSION` change; nearest-defender commented at `actionCue.ts:74-79` |
| 6 | Numbers in prose | findings (1) |
| 7 | Documentation | pass — README "Animations in the Drawn view"; its durations match `animationSpeed.ts` |
| 8 | Guardrails and hygiene | pass — lint 21 warnings, cap 21, unchanged; no new dependency; no `innerHTML` |
| 9 | Footguns | pass — `drift.ts` untouched; headless and AI play byte-identical (the cue functions are pure reads with no RNG, before `applyAction`); the movement snapshot predates the search edit and reproduces from `main`'s code |
| 10 | Architecture | findings (1) — `cueKeeper.ts` is pure logic with no test (principle 15) |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 66, feature)
  note:  30 file(s), 2093 line(s) changed outside intents/.
```

## Findings
- **LOW** `src/scenes/BoardScene.ts:315-316` — the drift `onCombat` hook now
  renders (`cues.driftClash`) in both views. Before, a trample's result was
  drawn only at the next drift event, after the paced continue (`drift.ts:607-609`:
  `combatResolved` calls only `onCombat`). The plan assumed `onCombat` was
  followed by `onRender`, which is wrong. Spec B17 says the Standard view
  "behaves exactly as today", but `drift.ts:614-620` calls the old late frame a
  bug. Needs decision: (a) keep the earlier render in both views and record it as
  accepted, or (b) render at the trample only in the Drawn view.
- **MEDIUM** `src/scenes/PlacementScene.ts:323` (with `src/ui/drawnUnits.ts:129-131`)
  — Placement animates in the Drawn view, against spec B13 ("Placement does not
  animate") and Out of scope. Placement's `setUnits` passes no motion, which
  `DrawnUnits.setUnits` treats as "animate the difference". So at Normal or Slow
  an Undo fades the removed unit, and `finishPlayer`'s `setUnits([])`
  (`PlacementScene.ts:568`) fades every unit before `scene.start`. Found by
  reading; the e2e Placement scenarios run at Off. Needs rework: Placement's two
  `setUnits` calls pass `'snap'`.
- **MEDIUM** `src/ui/cueKeeper.ts` — new pure logic with no test (no test file
  imports it): `apply` takes the cue from the state before `applyAction` and
  completes it with the result; `take` clears the pending cue; `driftClash`
  renders before the next beat overwrites the cue. Mutants K1-K3 cannot be
  killed by the suite as it stands. Principle 15 and plan Risk 1. Needs rework:
  `src/ui/cueKeeper.test.ts` covering the three, killing K1 (`take` keeps the
  cue), K2 (cue taken after the apply) and K3 (no render in `driftClash`).
- **LOW** `src/engine/movePath.ts:70` — mutant M7 survives: the contact sort
  reversed. No case has two ramming contacts at one hex with different costs
  and `facing` unpinned. Needs rework: one AC2 case asserting the path ends on
  the cheaper contact.
- **LOW** `src/engine/actionCue.ts:147` — mutant C11 survives: dropping the
  `victim.destroyed` check shakes a ship that sank. The boarding test never
  destroys a ship. Spec B3: a ship whose equipment reaches zero fades. Needs
  rework: a boarding case that destroys the loser and expects `shakes: []`.
- **LOW** `src/engine/movement.ts:76` — mutant E2 survives: the naval branch of
  `reachableHexes` can be bypassed, because no test calls `reachableHexes` on a
  ship. Needs rework: one assertion that `reachableHexes(ship)` equals
  `reachableNavalHexes`'s costs.
- **LOW** `intents/66-board-animations/plan.md`, Progress — stale after the
  owner's amendment `c57684c`: it still says "well inside the +45 the plan
  allows" and that check:intent fails pending an amendment. Needs rework: a
  Progress note (below the marker).

The plan divergences listed in Progress, judged: `driftMoveCue`/`driftClashCue`
(within the plan); `onCombat` rendering (the decision above); the speed button
a row above the view toggle (within the plan, reason recorded — overlap with a
long End-game label is a live-check item); `createViewToggle`'s `onChange`
(within the plan); the watchdog and the end on scene shutdown (within Risk 4);
`CueKeeper` (placement within the plan; untested, above); `finishAll` on any
page key or pointer press (within subtask 5; a superset of B9, harmless).

## Not checked
- 24 of 54 mutants (the reviewer's run was stopped for low memory): C14, C15
  (`actionCue.ts`), P1-P15 (`animationPlan.ts`), S1-S6 (`animationSpeed.ts`),
  K1-K3 (`cueKeeper.ts`). Round 2 runs them.
- No mutants on the Phaser side (`drawnAnimator.ts`, `drawnMotions.ts`,
  `drawnUnits.ts`, `drawnBoardView.ts`, `speedToggle.ts`); covered by e2e and
  the live check only.
- The speed button against a long End-game label ("⚑ Finir la partie", or with
  a game end pending): not seen in a browser.
- The Placement fade: from reading the code, not seen in a browser.
- The Progress test-count arithmetic ("from 83 / 1427"); the suite was not run
  on `main`.
- The AC8 "before" e2e time (1m21.6s) is the implementer's.
- B10, B12, the exchange-sacrifice ordering, and the ram, boarding and drift
  visuals: live-check items.

## Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`), new visual behaviour; AC9.
- steps: in `C:/Users/eric/src/heraklios-wt/66-board-animations` run
  `npm run dev -- --port 5266 --strictPort --host 127.0.0.1`, open
  http://127.0.0.1:5266, choose "Test mode (2 players, armies ready)", click
  "🗺 Drawn view". Check a "⏩ Speed: Normal" button sits one row above the view
  toggle and overlaps nothing. At Normal, then at Slow: a long land move (3+
  hexes); a cavalry charge; a ship move with turns, then Turn; a swap; a land
  attack ending in a retreat and an advance, and one ending in an exchange; a
  ram; a boarding; an elephant drift with a trample on your turn and in a
  computer turn; a full computer turn. Click or press a key during each. Switch
  the language to French and look at the speed button against "⚑ Finir la
  partie". In Placement in the Drawn view, place a unit and press Undo. Switch to
  the Standard view and make a move.
- you should see: units slide hex by hex along the path (a charge in a straight
  line); ships turn in place, then slide; swapped units cross; attackers lunge
  and return before the result; eliminated units fade; retreats and advances
  slide in commit order; a ram lunges, the target fades on a hit or shakes on a
  miss; a boarding clashes, then fades or shakes; the drift moves one hex per
  beat and its arrow appears after the slide; the computer waits for each
  animation, and Slow is twice as long; any click or key snaps every unit to its
  final hex, then acts; the speed button is hidden in the Standard view, which
  never animates; the speed survives a reload.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `9ecfc06`: exit 0; lint 0
  errors, 21 warnings (cap 21); 86 test files, 1455 tests passed. Matches.
- **Coordinator, re-run:** `npm run check:intent`: PASS (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`: 27 passed in 47.8s (the reviewer:
  27 passed in 1.5m under load; the implementer: 1m10.5s and 1m24.2s). Pass
  count matches.
- **Coordinator, re-run:** the six surviving mutants, each backed up by copy,
  applied once, full `vitest run --bail 1`, restored by copy: E2 SURVIVED, M7
  SURVIVED, C11 SURVIVED, C5 SURVIVED, C9 SURVIVED, C13 SURVIVED. Control C6 (ram
  kind → clash) KILLED by `actionCue.test.ts` "a ram lunges at the target hex; a
  miss shakes the target, a hit does not". `git status --short` clean after.
  All match the reviewer. C5 (a cost-0 contact's target sits in the bow hex)
  and C9 (every non-null boarding side has loss 1-4 in `navalBoarding.ts`) are
  judged equivalent; C13 is defensive. None is a finding.
- Reviewer: orientation (HEAD `9ecfc06`, nothing pushed, `main` at `ef9b1aa`);
  snapshot provenance (`107f249` touches only the snapshot, cases and test
  files; reproduced against `main`'s untouched engine: 180 entries, 0
  differences); 30 mutants run, 24 killed (E1, E3, E4, M1-M6, M8-M11, C1-C4,
  C6-C8, C10, C12), 6 survived (above).
- Taken on trust: the e2e "before" time, the Progress test-count arithmetic,
  all visual behaviour (the live check).
