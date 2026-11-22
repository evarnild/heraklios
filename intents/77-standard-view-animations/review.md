<!-- generated-by: heraklios/review@0.2.0 -->
# §77 review — The Standard view animates moves and combats, like the Drawn view

verdict: rework
tier: attested
reviewed-commit: 0f8ab11
round: 1
sampled: no
run: auto
live-check: owed

**Tier.** The path table sets it to Attested (`src/ui/**`, `e2e/**`, README
wording). `review_tier` is empty, and no finding is CRITICAL or HIGH.

**Sampling.** `sampled:` is set only on an attest. In the worktree, `npm run
sdlc:scan -- --sample-due auto --exclude 77` says "= 11, sampled: no". On main,
which now includes §75's attested review, it says "= 12, sampled: yes". If a
later round attests, re-run the scan on main.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: subtasks 1–9 present. The divergences are minor and recorded in Progress (`frames` exported, `unitLayer.ts` 194 lines, `jointFigure` lead type) |
| 2 | Type check | pass (PASS) |
| 3 | Rulebook fidelity | not run: digital-only; no `src/engine` or `src/data` file in the diff |
| 4 | Tests prove the rule | findings (2): M9a survives (MEDIUM); M16 and M21 survive (LOW, accepted by the spec as live-check only) |
| 5 | Boundary and conventions | pass: presentation only; no `GameState`, history or literal change |
| 6 | Numbers in prose | pass: Progress numbers reproduced; AC10 measured by the reviewer |
| 7 | Documentation | findings (1, LOW): two stale comments outside the diff |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19); no new dependency |
| 9 | Repo footguns | pass: engine, data and scenes untouched |
| 10 | Architecture | pass: one planner, one queue and one set of curves; shared `UnitLayer` with unit-tested Phaser-free parts |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 77, feature)
  note:  24 file(s), 1768 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/ui/drawnUnits.ts:84` (`facingPart: figureOf(container)`):
  the Drawn galley's turn wiring is untested (B16).
  - Mutant M9a sets `facingPart: null`. That stops every Drawn ship from
    turning, both during a turn motion and when it settles. The mutant
    survives the full vitest and e2e suites.
  - `board-view.spec.ts:160-163` reads only the rotation a figure has when
    it is made. It never reads the rotation after a turn.
  - **Needs rework:** add an e2e assertion that turning a ship in the Drawn
    view sets its `boardObjects().unitRotations[id]` to
    `facingAngleRad(newFacing)` at Off, or after `waitIdle`. Put it in
    `board-view.spec.ts` or `naval.spec.ts`: switch to Drawn, select a
    galley, press Turn, read the rotation. The assertion must kill M9a.
- **LOW** `src/ui/standardBoardView.ts:206`, `src/ui/standardUnits.ts:54`,
  `:58`: no automated test reads the Standard facing mark (B6, B7).
  - M16 removes the `ghostTypeId` filter, so every arrow is drawn at the
    final hex, ahead of its counter.
  - M21 drops the mark's rotation when the mark is made.
  - Both survive. The spec accepts the live check as their proof.
  - §75 is now merged, so a dev-hook reader for a Standard ship's mark is one
    line. Worth a look as a follow-up intent.
- **LOW** `src/scenes/BoardScene.ts:909-920`: `renderAllUnits` still sends
  every ship to `setFacingIndicators`, and both views now ignore every entry
  that isn't the ghost.
  - Together with M16, a one-line view edit could silently move the arrow
    ahead of the counter again.
  - Worth a look: a follow-up, after §73 and §76, that sends only the staged
    ship.
- **LOW** `src/ui/devHook.ts:109`, `src/scenes/PlacementScene.ts:319`: two
  stale comments.
  - `devHook.ts:109` names `StandardBoardView.setUnits` as the place that
    restacks the markers. That is now `UnitLayer.setUnits`.
  - `PlacementScene.ts:319` says the Standard view ignores `facing`. It no
    longer does.
  - Both were left alone on purpose, per the plan. Worth a look: fix them in
    whichever of §76 and §77 merges second, with no line growth.
- **LOW** `src/ui/unitLayer.test.ts:116-130`: the `finishAnimations` test
  uses a one-step slide.
  - So removing `settleAll()` from the drain (M8) survives vitest. Only the
    e2e Slow click-finish kills it.
  - Worth a look: drive a cue with several steps and finish it mid-queue.
- **Nits:**
  - `src/ui/hexDraw.ts:32` has `): void {  const tipRadius…` on one line.
  - `README.md:583` was not re-wrapped.

## Not checked
- **B6–B9 and B11 in a browser.** Nothing automated checks that:
  - the mark slides, lunges, shakes, fades and turns with its counter;
  - the counter stays upright;
  - the drift arrow waits for the slide;
  - each combat, ram, boarding and drift cue plays in Standard;
  - a computer turn waits for its animations;
  - a view switch in the middle of an animation works.

  These are for the live check (AC11).
- **M16 and M21** have no killing test (see above).
- **M8b** (Standard `finishAnimations` as a no-op) is near-equivalent. A view
  switch driven by keyboard or code mid-animation is not covered.
- **The per-view-switch `once('shutdown')` closures** were not measured.
  This was already true of the Drawn view.
- **AC10** was measured once per side: 111 s on the branch against 98 s on
  main. The growth matches the added animation scenarios, and the branch's
  own spread was 1.5–1.8 m.
- **The §76 second merge** was simulated with `git merge-tree` only. It has
  3 content conflicts and a duplicate `unitAlpha` in `boardView.ts` (tsc
  catches it). The resolution is in both plans: keep §76's `unitAlpha`, and
  pass `alpha` through `drawFacingArrowhead` to `drawArrowheadAt`.

## Live check
Owed: rule 1 (`src/ui/**`) and rule 3 (the browser-only behaviour above).
The change is new and visual. The steps will be restated by the round that
attests.

1. Run `npm run dev -- --port 5277 --strictPort --host 127.0.0.1` in the
   worktree. Use the Standard view at Normal, then repeat the key steps at
   Slow.
2. **Test mode:** a land move, a cavalry charge and a swap each slide hex by
   hex. The movement readout is already on the new hex.
3. **Combat test mode, ships.**
   - Arrowheads point along each ship's facing from the first frame.
   - On Turn and then a move, the arrowhead turns smoothly and slides with
     its counter, never ahead of it. The counter stays upright.
   - Ram (hit and miss) and board: the mark lunges, fades and shakes with its
     counter.
4. **Land combat:** a retreat, an advance and an exchange play in the order
   they are committed.
5. **An elephant drift with a trample:** the drift arrow appears only after
   the slide. Check this for a human and for a computer seat.
6. **A computer seat:** each move plays fully before its pause.
7. **A click or key** finishes everything at once.
8. **A view switch mid-animation,** both ways, shows the final state.
9. **The Speed button** shows in both views and keeps its label. Slow
   persists across a reload. At Off, moves jump.
10. **Placement:** nothing animates and there is no Speed button. The staged
    ship's arrow follows Turn, and placed ships point correctly.
11. **Drawn view:** unchanged, and a galley still turns (M9a).

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 0f8ab11. Exit 0, lint 0
  errors and 19 warnings (cap 19), 99 files, 1698 passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. PASS. Matches.
- **Coordinator, re-run:** `npm run e2e`. 34 passed (1.2m). An earlier
  attempt was discarded: another worktree's server held port 5232, and 8
  Standard-only scenarios ran against it.
- **Coordinator, re-run:** the surviving mutants. Each file was backed up and
  restored by copy, and each mutant ran `vitest src/ui` plus the full e2e
  suite.

  | Mutant | vitest | e2e | Result |
  | --- | --- | --- | --- |
  | M9a | 302 passed | 34 passed | survived |
  | M16 | 302 passed | 34 passed | survived |
  | M21 | 302 passed | 34 passed | survived |
  | M8b | 302 passed | 34 passed | survived |
  | M10 | 302 passed | not run (equivalent) | survived |

  `git status --short` was clean afterwards. All five match the reviewer.
- **Reviewer:**
  - verify, check:intent and e2e with the same counts as above.
  - 26 mutants: 21 killed and 5 survived. Killed: M1, M1b, M2, M3a, M3b,
    M3c, M4, M5, M5b, M5c, M6, M7, M8, M9b, M10b, M10c, M11, M12, M13, M14,
    M20.
  - File sizes match Progress.
  - B16 checked by reading the code.
  - AC10 measured on main.
  - Merge-tree against main is clean; against §76 there are conflicts, as
    described above.
- **Taken on trust:**
  - The planner and cue feed already give the Standard view the right cues.
  - Everything visual.
