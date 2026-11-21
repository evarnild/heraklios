<!-- generated-by: heraklios/review@0.2.0 -->
# §66 review — The vector view animates moves, combats and drifts

verdict: attest
tier: attested
reviewed-commit: 9b2142a7b8d1eab8d4c79c63d568b97724bf4475
round: 3
sampled: no
run: auto
live-check: owed

Tier is Attested by the path table (`src/ui/**`, `src/scenes/**`,
`src/engine/**`); nothing is CRITICAL or HIGH, and no finding needs rework.
`sampled: no` — `npm run sdlc:scan -- --sample-due auto --exclude 66`:
`sample-due auto: nth attested auto change = 8, every 3, sampled: no`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — the rework diff `6da8981..9b2142a` holds only the round 2 fixes: 4 planner tests, the watchdog switched to `planDuration`, one README sentence, Progress, `auto_round: 3` |
| 2 | Type check | the only error is the owed live check (pasted below) |
| 3 | Rulebook fidelity | pass — digital-only; the rework touches no rule |
| 4 | Tests prove the rule | pass — P8, P11, P13, P14 killed; the watchdog call has no test that can reach it (below) |
| 5 | Boundary and conventions | pass — the rework touches only `src/ui`; Placement's two `setUnits` still pass `'snap'` (`PlacementScene.ts:330`, `:567`) |
| 6 | Numbers in prose | pass — Progress figures (87 files, 1467 tests; e2e 27 in about 46 s) reproduce; the 830 in the new test matches `animationSpeed.ts:35` and the README |
| 7 | Documentation | pass — README:598 says "Placement never animates." (nit: the line is not wrapped like its paragraph) |
| 8 | Guardrails and hygiene | pass — lint 0 errors, 21 warnings, cap 21 |
| 9 | Footguns | pass — nothing pushed; `main` (`6af725c`) has moved since the branch point but touches no file the branch changes |
| 10 | Architecture | pass — `drawnAnimator.ts:128` calls `planDuration(this.queue)`; round 2's duplication is gone |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 66, feature)
  error: A live check is owed and not recorded. Do the steps in intents/66-board-animations/review.md → ## Live check, then set live_checked: <date> in intents/66-board-animations/metadata.yml.
  note:  32 file(s), 2248 line(s) changed outside intents/.
```
The only error is the owed live check, the owner's to clear.

## Findings
None needs rework. Two nits:
- **LOW** `README.md:598` — "Placement never animates." was added to an
  existing line, which is now longer than the rest of its wrapped paragraph.
  Cosmetic.
- **LOW** — the optional Placement e2e scenario was not added, and the
  reason given in Progress is weak: a small scenario is feasible (Placement in
  the Drawn view at Normal, place, Undo, `busy()` stays `[]`; dropping `'snap'`
  would make it fail). It was optional, and live check step 2 covers exactly
  this. Worth a look as a later harness item.

**Round 2 findings, resolution.**
- P14 (moves played before the clash) is resolved. "the clash plays before
  the moves (step 0 lunge, step 1 slide)" kills it.
- P13 (`planDuration` as one maximum, plus the duplicated formula) is
  resolved. "a plan of several steps lasts the sum of its step maxima…"
  asserts 830, and the watchdog now calls `planDuration`.
- P8 is resolved: "a clash by a unit that is not drawn plays no lunge".
- P11 is resolved: "a shake for a unit that is gone plays the fade only".
- The README nit is resolved.
- The optional Placement e2e was not added; see the second nit above.

**The watchdog's `planDuration` call** (`drawnAnimator.ts:128`) has no
reachable mutant:
- no unit test imports the Phaser-bound `drawnAnimator`;
- the e2e cannot tell `planDuration(this.queue)` from `0`, because the watchdog
  would still fire after 1000 ms, beyond the Normal test's 540 ms move;
- the Slow test cuts its move short.

The call is a plain pass-through to `planDuration`, and P13's kill proves that
function.

## Not checked
- Phaser-side mutants (`drawnAnimator.ts` including the watchdog,
  `drawnMotions.ts`, `drawnUnits.ts`, `drawnBoardView.ts`, `speedToggle.ts`,
  Placement's `'snap'` arguments): e2e and the live check only.
- The Placement snap in a browser: no automated test (live check step 2).
- The speed button against a long French End-game label, and every visual item
  of AC9: live-check items.
- The AC8 "before" e2e time remains the implementer's figure.

## Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`), new visual behaviour, AC9; it
  also covers the Placement snap, which no test proves.
- steps:
  1. In `C:/Users/eric/src/heraklios-wt/66-board-animations` run
     `npm run dev -- --port 5266 --strictPort --host 127.0.0.1`, open
     http://127.0.0.1:5266.
  2. **Placement first.**
     - From the Menu, start a normal game (not the test-mode shortcut) so
       Placement shows, and click "🗺 Drawn view" there.
     - Make sure the speed is Normal: clear `heraklios.animationSpeed` in
       devtools if needed. The speed button is on the Board only.
     - Place two units, then press Undo and Ctrl+Z.
     - Place a ship and rotate it.
     - Finish the player.
  3. **The Board.** Start "Test mode (2 players, armies ready)" and click
     "🗺 Drawn view". The "⏩ Speed: Normal" button sits one row above the view
     toggle and overlaps nothing.
  4. **Each action, at Normal and then at Slow.** Click or press a key during
     each one:
     - a long land move (3+ hexes);
     - a cavalry charge;
     - a ship move with turns, then Turn;
     - a swap;
     - a land attack ending in a retreat and an advance, and one ending in an
       exchange;
     - a ram;
     - a boarding;
     - an elephant drift with a trample, on your turn and in a computer turn;
     - a full computer turn.
  5. Switch the language to French and look at the speed button against
     "⚑ Finir la partie".
  6. Switch to the Standard view, make a move, and do a drift with a trample.
- you should see:
  - **Placement:** an undo removes the unit at once, with no fade. Placed
    units and ships appear and rotate at once. The handoff to the next player
    has no fade-out.
  - **Movement:** units slide hex by hex along their path, and a charge goes
    in a straight line. Ships turn in place, then slide. Swapped units cross.
  - **Combat:** attackers lunge and return before the result. Eliminated
    units fade. Retreats and advances slide in commit order.
  - **Ram and boarding:** a ram lunges, then the target fades on a hit or
    shakes on a miss. A boarding clashes, then a sunk ship fades and a damaged
    survivor shakes.
  - **Drift:** the elephant moves one hex per beat, and its arrow appears
    after the slide. A trample's result is drawn on the trample's own beat, in
    both views (decision (a)).
  - **Timing:** the computer waits for each animation, and Slow takes twice
    as long. Any click or key snaps every unit to its final hex, then acts.
  - **Speed button:** it is hidden in the Standard view, which never animates.
    The speed survives a reload.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `9b2142a`: exit 0; lint 0
  errors, 21 warnings (cap 21); 87 test files, 1467 tests passed. Matches.
- **Coordinator, re-run:** `npm run check:intent`: FAIL with only the owed
  live check (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`: 27 passed in 47.4s. Matches
  (the reviewer's run took 46.6s).
- **Coordinator, re-run:** the four mutants the rework claims to kill. Each
  file was backed up by copy, the mutant applied once, the full
  `vitest run --bail 1` run, and the file restored by copy:
  - P8: KILLED by "a clash by a unit that is not drawn plays no lunge";
  - P11: KILLED by "a shake for a unit that is gone plays the fade only";
  - P13: KILLED by "a plan of several steps lasts the sum of its step maxima";
  - P14: KILLED by "the clash plays before the moves (step 0 lunge, step 1
    slide)".

  `git status --short` was clean after the run. All four match the reviewer.
- **Reviewer:** read the rework diff in full, checked orientation (HEAD
  `9b2142a`, nothing pushed), ran the same four mutants on the full suite
  without bail with the same results, ran `sdlc:scan --sample-due auto`, and
  checked the Live check's labels, storage key and Placement toggle against
  the code.
- **Taken on trust:** earlier rounds' kills of all other mutants (this round
  touches none of their lines); the AC8 "before" e2e time; all visual
  behaviour (the live check).

# Round 2 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 6da8981aa6de77a30d7ea82d6408e9de190c3351
- round: 2
- sampled: no
- run: auto
- live-check: owed

Tier is Attested by the path table; nothing is CRITICAL or HIGH. Every round 1
finding is resolved, and every mutant round 1 named is now killed. The verdict
is `rework` because the 24 mutants round 1 could not run were run this round,
and four of them survive, all in `src/ui/animationPlan.ts`. That gives three LOW
findings, all mechanical; none needs a decision. `sampled: no`: the verdict is
not `attest`.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — the rework diff `9ecfc06..6da8981` holds only the round 1 fixes |
| 2 | Type check | the only error is the owed live check (pasted below) |
| 3 | Rulebook fidelity | pass — digital-only |
| 4 | Tests prove the rule | findings (3) — 30 mutants this round: 26 killed, 4 survived (P8, P11, P13, P14) |
| 5 | Boundary and conventions | pass — the decision-(a) comment is at `BoardScene.ts:316`; no `GameState`, save or undo-boundary change; Placement's two `setUnits` calls pass `'snap'` |
| 6 | Numbers in prose | pass — the PlacementScene baseline of 574 matches `wc -l`; BoardScene stays 3177; the `drift.ts:614-620` citation is exact |
| 7 | Documentation | pass — nit: README "Animations in the Drawn view" does not say Placement never animates |
| 8 | Guardrails and hygiene | pass — lint 0 errors, 21 warnings, cap 21 |
| 9 | Footguns | pass — `drift.ts` untouched; the `onCombat` render is presentation only; the size baseline went down |
| 10 | Architecture | findings (folded into P13) — `drawnAnimator.ts:127` repeats `planDuration`'s formula inline |

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 66, feature)
  error: A live check is owed and not recorded. Do the steps in intents/66-board-animations/review.md → ## Live check, then set live_checked: <date> in intents/66-board-animations/metadata.yml.
  note:  32 file(s), 2223 line(s) changed outside intents/.
```
The only error is the owed live check, the owner's to clear. It is not a rework
item.

### Findings
- **LOW** `src/ui/animationPlan.ts:114` — mutant P14 survives: playing the
  moves before the clash (`steps.unshift`) passes. The planner's documented
  order is "the clash, then the moves, then fades and shakes" (its docstring,
  spec B2/B4), but no test has a clash cue together with a unit that moved.
  Needs rework: one planner case with a clash cue and a moved unit, asserting
  step 0 is the lunge and step 1 the slide.
- **LOW** `src/ui/animationPlan.ts:125-127` with `src/ui/drawnAnimator.ts:127` —
  mutant P13 survives: `planDuration` as one maximum instead of a sum of
  per-step maximums passes, because its only test is a Slow/Normal ratio. It
  has no production caller: the animator's watchdog repeats the same reduce
  inline (duplication, pass 10). Needs rework: `drawnAnimator.ts:127` calls
  `planDuration`, and one test asserts an absolute total for a plan of two or
  more steps (e.g. clash 350 + slide 180 + fade 300 at Normal = 830).
- **LOW** `src/ui/animationPlan.ts:103` and `:118` — mutants P8 (clash filter
  `prev.has` dropped) and P11 (shake filter on `next` dropped) survive. Today's
  cue producers never hit these guards, but the planner's own contract is
  untested: under P11 a gone unit would shake while it fades (against B3), and
  both would add an empty pause. Needs rework: two planner cases — a clash by an
  undrawn id plays no lunge step; a shake for an id absent from `next` plays a
  fade only.

**Round 1 findings, resolution.**
- **Decision (a):** resolved. There is an interpretation comment at
  `BoardScene.ts:316`, and the Progress entry records it. spec.md is unchanged,
  because the decision is recorded as an accepted departure, not an amendment.
- **Placement animating (MEDIUM):** resolved in code. `drawPlacedUnits` and
  `finishPlayer` pass `'snap'`, and these are Placement's only two `setUnits`
  calls. No test proves it: the choice sits inside Phaser-bound `DrawnUnits`,
  and the Placement e2e runs at Off. The live check covers it. An e2e scenario
  at Normal (Placement, Drawn view, place, Undo, `busy()` stays `[]`) would make
  it automatic.
- **`cueKeeper.ts` untested (MEDIUM):** resolved. `src/ui/cueKeeper.test.ts`
  has 5 tests, and they kill K1, K2 and K3.
- **M7, C11, E2 (LOW):** resolved. Each now has a test that kills it.
- **Stale Progress (LOW):** resolved. A new entry below the marker corrects the
  "+45" and "still FAILS" notes.

### Not checked
- Phaser-side mutants (`drawnAnimator.ts`, `drawnMotions.ts`, `drawnUnits.ts`,
  `drawnBoardView.ts`, `speedToggle.ts`, and Placement's `'snap'` arguments):
  e2e and the live check only.
- The Placement snap in a browser: from reading the code only.
- The speed button against a long French End-game label, and every visual item
  of AC9: live-check items.
- The AC8 "before" e2e time remains the implementer's figure.

### Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`), new visual behaviour, AC9; it
  also covers the Placement snap, which no test proves.
- steps:
  1. In `C:/Users/eric/src/heraklios-wt/66-board-animations` run
     `npm run dev -- --port 5266 --strictPort --host 127.0.0.1`, open
     http://127.0.0.1:5266.
  2. Placement first: from the Menu start a normal game (not the test-mode
     shortcut) so Placement shows; click "🗺 Drawn view" there. The speed
     button is on the Board only, so make sure the speed is Normal (set it on
     the Board earlier, or clear `heraklios.animationSpeed` in devtools). Place
     two units and press Undo (and Ctrl+Z); place a ship and rotate it; finish
     the player so the next player's Placement opens.
  3. The Board: "Test mode (2 players, armies ready)", click "🗺 Drawn view".
     A "⏩ Speed: Normal" button sits one row above the view toggle and
     overlaps nothing.
  4. At Normal, then at Slow, clicking or pressing a key during each: a long
     land move (3+ hexes); a cavalry charge; a ship move with turns, then Turn;
     a swap; a land attack ending in a retreat and an advance, and one ending in
     an exchange; a ram; a boarding; an elephant drift with a trample on your
     turn and in a computer turn; a full computer turn.
  5. Switch the language to French and look at the speed button against
     "⚑ Finir la partie".
  6. Switch to the Standard view, make a move, and do a drift with a trample.
- you should see:
  - **Placement:** an undo removes the unit at once, with no fade. Placed
    units and ships appear and rotate at once. The handoff to the next player
    has no fade-out.
  - **Movement:** units slide hex by hex along their path, and a charge goes
    in a straight line. Ships turn in place, then slide. Swapped units cross.
  - **Combat:** attackers lunge and return before the result. Eliminated units
    fade. Retreats and advances slide in commit order.
  - **Ram and boarding:** a ram lunges, then the target fades on a hit or
    shakes on a miss. A boarding clashes, then a sunk ship fades and a
    damaged survivor shakes.
  - **Drift:** the elephant moves one hex per beat, and its arrow appears after
    the slide. A trample's result is drawn on the trample's own beat, in both
    views (decision (a)).
  - **Timing and cut short:** the computer waits for each animation, and Slow
    takes twice as long. Any click or key snaps every unit to its final hex,
    then acts.
  - **Speed button:** it is hidden in the Standard view, which never animates,
    and the speed survives a reload.

### Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `6da8981`: exit 0; lint 0 errors, 21 warnings (cap 21); 87 test files, 1463 tests passed. Matches.
- **Coordinator, re-run:** `npm run check:intent`: FAIL with only the owed live check (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`: 27 passed in 46.4s. Pass count matches (reviewer 49.8s).
- **Coordinator, re-run:** ten mutants, each backed up by copy, applied once, full `vitest run --bail 1`, restored by copy; `git status --short` clean after.
  - The round 1 claims are all KILLED:
    - E2: `movementSearch.test.ts` "matches the naval search costs, hex for hex";
    - M7: `movePath.test.ts` "with two contacts at one hex and no pinned facing, ends on the cheaper one";
    - C11: `actionCue.test.ts` "a boarding that sinks the loser shakes nobody";
    - K1: `cueKeeper.test.ts` "take returns the cue once and then nothing";
    - K2: "apply derives the cue from the state before the action…";
    - K3: "driftClash renders while its clash cue is still pending…".
  - This round's survivors P8, P11, P13 and P14 all SURVIVED.
  - All ten match the reviewer.
- Reviewer: orientation (HEAD `6da8981`, nothing pushed, `main` at `6af725c`);
  verify (87 files, 1463 tests, lint 21), check:intent (live check only), e2e
  27 passed in 49.8s; 30 mutants one at a time, of which 26 were killed:
  - the round 1 claims: E2, M7, C11 and K1-K3;
  - C14 and C15;
  - P1-P7, P9, P10, P12 and P15;
  - S1-S6.

  P8, P11, P13 and P14 survived.
- Taken on trust: the implementer's "before" e2e time (AC8); the first Progress
  entry's test-count arithmetic; all visual behaviour (the live check).

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 9ecfc06191592f68d91f81385f7a4bb04edf9232
- round: 1
- sampled: no
- run: auto
- live-check: owed

Tier is Attested by the path table (`src/ui/**`, `src/scenes/**`, `src/engine/**`
paths not on the Reviewed list). `review_tier` is empty, the rulebook basis is
"digital-only", and no finding is CRITICAL or HIGH. `sampled: no`: the verdict
is not `attest`.

The verdict is `rework`. One finding needs the owner's decision; the others are
mechanical. The reviewer's mutation pass was stopped by Claude Code for low
memory after 30 of 54 mutants; the 24 not run are listed under Not checked.

### Passes
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

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 66, feature)
  note:  30 file(s), 2093 line(s) changed outside intents/.
```

### Findings
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

### Not checked
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

### Live check
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

### Verified myself vs. taken on trust
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
