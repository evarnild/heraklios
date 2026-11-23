<!-- generated-by: heraklios/review@0.2.0 -->
# §77 review — The Standard view animates moves and combats, like the Drawn view

verdict: attest
tier: attested
reviewed-commit: 5f83c30
round: 3
sampled: no
run: auto
live-check: owed

- **Tier: Attested.** The path table sets it (`src/ui/**`, `e2e/**`, README
  wording). No finding is CRITICAL or HIGH. The merge brought no §77 change
  into `src/engine`, `src/data` or `src/scenes`.
- **Sampled: no.** `npm run sdlc:scan -- --sample-due auto --exclude 77`, run
  in the main checkout at 47a8011, printed `nth attested auto change = 13,
  every 3, sampled: no`. Round 2's `yes` used count 12, which §76's merged
  review has since taken.
- **Scope of this round.**
  - What it covers:
    - the owner-approved merge of main, 3817a0e, which brings in §76 as
      6f258b0;
    - a4a1117, the Progress entry.
  - 5f83c30 only bumps `auto_round`.
  - What is unchanged since round 2's attested 9fa6121, so round 2's analysis
    of it is reused:
    - `drawnUnits.ts`, `standardBoardView.ts`, `unitLayer.ts`,
      `standardUnits.ts`, `unitMotions.ts`, `unitAnimator.ts` and
      `heldDriftArrow.ts`;
    - every §77 e2e file.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the resolution follows plan.md:59-67 ("If §76 merges first"); removing `FacingShip.dimmed` is the plan's own outcome |
| 2 | Type check | the only error is the owed live check |
| 3 | Rulebook fidelity | not run: digital-only (reused) |
| 4 | Tests prove the rule | findings (1, LOW): 19 mutants, 15 killed; 4 survive (U3 and U4 are new and LOW; P7 and H1–H3 are equivalent after §77) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | pass |
| 7 | Documentation | findings (1, LOW): a stale comment and a dead parameter's doc |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19) |
| 9 | Repo footguns | pass |
| 10 | Architecture | pass: one `unitAlpha` and one `DIMMED_UNIT_ALPHA`, applied in one place (`UnitLayer`) for both views |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 77, feature)
  error: A live check is owed and not recorded. Do the steps in intents/77-standard-view-animations/review.md → ## Live check, then set live_checked: <date> in intents/77-standard-view-animations/metadata.yml.
  note:  28 file(s), 1814 line(s) changed outside intents/.
```
The only error is the owed live check.

## Merge resolution
- **`boardView.ts`** keeps only §76's alpha code: `DIMMED_UNIT_ALPHA = 0.6`
  (:43) and `unitAlpha(d: { readonly dimmed?: true })` (:46-48).
  - §77's stub is gone.
  - `FacingShip.dimmed` is removed, and the `FacingShip` doc says why.
  - `reconcileUnits` keeps §76's recreate when the dimmed flag changes.
- **One application point.** `drawnUnits.ts` and `standardBoardView.ts` are
  round 2's files unchanged, without §76's per-view `setAlpha` copies. Alpha
  is applied only in `UnitLayer`:
  - `build` (`unitLayer.ts:111`) and `settle` (`:160`) call `unitAlpha(...)`,
    never a hard 1;
  - the Standard mark dims with its counter through `jointFigure.setAlpha`;
  - a fade starts from the current alpha;
  - the ghost keeps `GHOST_ALPHA`.
- **`hexDraw.ts`** passes `alpha` through to `drawArrowheadAt`, with the fill
  at `alpha` and the outline at `0.9 * alpha`. No caller passes it any more.
- **`placementDrawings.ts`** loses the `FacingShip.dimmed` setter.
  - The test trims weaken no test that §76's review counted.
  - The only affected mutant, §76's M7b, targeted the removed line.
- **Sizes and comments.**
  - `PlacementScene.ts` is 526, at its ceiling, unchanged from main.
  - `devHook.ts:109` now says `UnitLayer.setUnits`.
- **`git merge-tree --write-tree main HEAD`** is clean, and main 47a8011 is an
  ancestor of HEAD.

## Findings
- **LOW** `src/ui/unitLayer.test.ts:8-12`: the module mock `unitAlpha: () =>
  rest.alpha` ignores its argument.
  - **What survives.**
    - U4 (`unitLayer.ts:111` → `unitAlpha({})`) survives vitest and e2e.
      Every Placement unit would then be drawn opaque.
    - U3 (the same at `:160`, in `settle`) survives vitest.
  - **Context.** This is the gap §76's review accepted for dim application,
    and it is narrower now: §76's M2, M3 and M4 map onto U1 and U2, and both
    are killed.
  - **Worth a look.** Make the mock honour the flag, `(d) => (d.dimmed ? 0.6
    : rest.alpha)`, and test both cases. That would kill U3 and U4. Until
    then, live-check steps 11 and 12 are the proof.
- **LOW** stale text after the merge:
  - `src/scenes/PlacementScene.ts:440-441`: `shipArrowList`'s doc still says
    other seats' arrows are dimmed;
  - `src/ui/hexDraw.ts:13-14`, `:22`, `:34`: the `alpha` parameter's doc
    describes a dimmed arrow that nothing draws now. H1–H3 are therefore
    equivalent.
  - Worth a look: a follow-up, since the scene is at its ceiling.
- **LOW** `src/ui/placementDrawings.ts:59-70`: `placementFacingShips` still
  lists every placed ship, but both views use only the ghost.
  - P7 is equivalent.
  - Worth a look: fold this into round 2's follow-up, which reduces
    `BoardScene`'s ship list to the ghost as well.
- **Carried over, still open (LOW):**
  - M16 and M21: no reader for the Standard mark;
  - BoardScene sends every ship;
  - the `finishAnimations` test is a single step;
  - M8b is near-equivalent.

No finding needs rework.

## Resolution of round 2's findings
- **M16, M21; BoardScene ships; unitLayer M8 test:** open, as follow-ups.
- **Stale comments:**
  - `devHook.ts:109`: resolved by the merge.
  - `PlacementScene.ts:319`: resolved by §76's rewrite.
  - A new stale doc at `PlacementScene.ts:440`, listed above.
- **"The merge result was not built"** (round 2's Not checked): resolved. It
  is built, verified and run under e2e here.

## Not checked
- **Whether Placement draws anything at alpha 0.6** in either view: counters,
  marks, Drawn figures. This is runtime only, and U3 and U4 show no test
  catches a layer that passes the wrong drawing. It is left to the live check.
- **The Standard first frame in Placement, and §76 B8 in a browser.**
- **Round 2's untouched Not-checked items:**
  - B6–B9 and B11 in a browser;
  - the Turn e2e runs only at Off;
  - the `once('shutdown')` closures.
- **Mutants not run:**
  - U3 and P7 against e2e;
  - H1–H3, equivalent by grep;
  - §76 M12/M13, whose file is unchanged from main;
  - M9a, whose file and test are unchanged since round 2.

## Live check
- **Owed** under rule 1 (`src/ui/**`) and rule 3 (B6–B9, B11, and §76's dim
  through the new layer). The change is new and visual.
- **Setup.** In `C:/Users/eric/src/heraklios-wt/77-standard-view-animations`,
  run `npm run dev -- --port 5277 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5277/.
  - Use the Standard view at "⏩ Speed: Normal".
  - Repeat steps 2, 3 and 7 at Slow.

1. **Test mode (2 players, armies ready).**
   - A land move slides hex by hex; the movement readout is already on the
     new hex.
   - A cavalry charge slides along its line.
   - With "Unit swaps: on", a swap slides both units together.
2. **Combat test mode, ships** (at r=7 and r=9 from q=25).
   - Arrowheads point along their facing from the first frame.
   - Turn: the arrow turns 60° smoothly and the counter stays upright.
   - A forward move: the arrow slides with its counter, never ahead of it.
   - Ram, a hit and a miss: the arrow lunges or shakes with its counter, and
     a sunk ship fades together with its arrow.
   - Board: the arrow lunges and shakes with its counter.
3. **Land combat** (rows at r=3 and r=5 from q=10).
   - Attackers lunge and come back.
   - Eliminations fade; retreats, pushes, advances and exchanges play in
     commit order.
4. **Elephant drift, ideally with a trample.** The drift arrow appears only
   after the slide.
5. **A computer seat** ("AI — normal").
   - Each move plays fully before its pause.
   - The drift arrow still waits.
6. **Cut short.** At Slow, a click or key mid-slide lands everything at once,
   and Ctrl+Z mid-animation undoes cleanly.
7. **View switch mid-animation, both ways.** The final state shows, with no
   half-moved counter or arrow.
8. **Speed.**
   - The button shows in both views and keeps its label.
   - Slow persists across a reload.
   - At Off, moves jump.
9. **Placement, own seat.**
   - Nothing animates, and there is no Speed button.
   - The staged ship's arrow follows Turn.
   - Placed ships point correctly.
10. **Drawn view.** Unchanged; a galley turns smoothly at Normal and ends on
    its new facing.
11. **Placement, earlier seats dimmed** (§76 through the new layer; U3 and
    U4). Use a new game, not test mode.
    1. Click "2" on the Menu, then "Use default army" and "Confirm army" for
       both seats.
    2. In seat 0's Placement, place 3–4 land units and both ships, turning
       one before confirming. Click **Done placing**.
    3. In seat 1's Placement, in Standard and **before clicking anything**:
       - seat 0's counters are dimmed (about 0.6) in seat 0's colour;
       - each seat-0 ship's arrow is dimmed with its counter and points its
         facing;
       - seat 1's own counters are opaque once placed.
    4. Toggle to Drawn: seat 0's figures are dimmed, and their galleys point
       their facing. Toggle back to Standard: still dimmed.
    5. In both views:
       - place a land unit;
       - stage a ship (its ghost, at 0.5, is distinct from seat 0's dimmed
         ships), Turn, Cancel, stage again, Confirm;
       - Ctrl+Z, then Ctrl+Y.
    6. Click a seat-0 unit: nothing happens. Hover it: the hex line, then
       `<unit> — <seat-0 name> (<colour>)` and the values line, with no state
       line.
12. **Placement after a computer seat.** Seat 1 "AI — normal" and seat 2
    Human. Seat 1's Placement opens with the computer's army shown dimmed, in
    both views.
13. **The Board after Placement.**
    - Every unit is at full opacity in both views, and ship arrows are
      opaque.
    - The first move animates normally, with no unit starting dimmed or
      flashing.

You should see everything above:
- Standard counters never rotate.
- The arrow never detaches from its counter.
- Earlier seats stay dimmed in Placement through every toggle, undo and
  redo, and are never dimmed on the Board.
- No console errors.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** the surviving mutants. Each file was backed up and
  restored by copy.
  - U4 (`unitAlpha({})` after make): vitest `src/ui` 312 passed, full e2e 37
    passed. It survived.
  - U3 (the same in settle): vitest `src/ui` 312 passed. It survived.
  - P7 (destroyed check dropped in `placementFacingShips`): vitest `src/ui`
    312 passed. It survived.
  - `git status --short` was clean after. All three match the reviewer.
- **Coordinator, re-run:** `npm run verify` at 5f83c30. Exit 0, lint 0 errors
  and 19 warnings (cap 19), 100 files, 1708 passed and 2 skipped. Matches.
- **Coordinator, re-run:** `npm run check:intent`. The only error is the owed
  live check. Matches.
- **Coordinator, re-run:** `npm run e2e`. 37 passed (1.2m). Matches.
- **Coordinator note.** A first background run of this re-check was stopped
  by Claude Code for low memory, with U4 still applied. The file was restored
  from its backup and the tree was clean before these runs.
- **Reviewer:**
  - verify, check:intent and e2e, with the same counts;
  - the merge read site by site against §76's diff;
  - 15 mutants killed: U1, U2, U5, B1, B2, P1–P6 and Mm;
  - merge-tree clean;
  - sizes;
  - sampling.
- **Reused from rounds 1 and 2:**
  - passes 3, 9 and 10;
  - 21 killed mutants;
  - M9a;
  - the M16, M21 and M8b survivors;
  - AC10.
- **Taken on trust:**
  - everything visual;
  - that test mode honours "Who plays each seat";
  - that §76's live check holds for the pre-merge views. Step 11 re-checks
    it through the new layer.

# Round 2 (history)

- verdict: attest
- tier: attested
- reviewed-commit: 047f4ac
- round: 2
- sampled: yes
- run: auto
- live-check: owed

- **Tier: Attested.** The path table gives `src/ui/**`, `e2e/**` and README
  wording. Nothing in the diff touches `src/engine`, `src/data`,
  `src/scenes` or a Reviewed path.
- **Sampled: yes.** `npm run sdlc:scan -- --sample-due auto --exclude 77`,
  run in the main checkout, printed `nth attested auto change = 12, every 3,
  sampled: yes`. A full read of the diff is due after the merge.
- **Scope of this round.** It covers round 1's rework commit 63dadd7:
  - a new e2e test in `e2e/naval.spec.ts:22-44`;
  - the `hexDraw.ts:32` line split;
  - the `README.md:583` re-wrap.

  047f4ac only bumps `auto_round`. The rest of `main...HEAD` is unchanged
  since round 1, so passes 1, 3, 5, 9 and 10 and round 1's 21 killed
  mutants are reused.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework is exactly round 1's fix plus the two nits, recorded in Progress |
| 2 | Type check | the only error is the owed live check |
| 3 | Rulebook fidelity | not run: digital-only (reused) |
| 4 | Tests prove the rule | findings (1, LOW): the new test kills M9a; M16, M21 and M8b survive and are accepted as live check |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | pass: the rework's numbers reproduced |
| 7 | Documentation | findings (1, LOW, carried over): two stale comments |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19) |
| 9 | Repo footguns | pass: engine, data and scenes untouched |
| 10 | Architecture | pass (reused) |

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 77, feature)
  error: A live check is owed and not recorded. Do the steps in intents/77-standard-view-animations/review.md → ## Live check, then set live_checked: <date> in intents/77-standard-view-animations/metadata.yml.
  note:  25 file(s), 1793 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears.

### Findings
- **LOW** `src/ui/standardBoardView.ts:206`, `src/ui/standardUnits.ts:54`: no
  automated test reads the Standard facing mark (B6, B7).
  - M16 and M21 still survive vitest and e2e. The spec accepts the live check
    as their proof.
  - Worth a look: a follow-up adding a dev-hook reader for a Standard ship's
    mark rotation. That is one line after §75.
- **LOW** `src/scenes/BoardScene.ts:909-920`: `renderAllUnits` still sends
  every ship to `setFacingIndicators`. Worth a look: a follow-up, after §73,
  that sends only the staged ship.
- **LOW** `src/ui/devHook.ts:109`, `src/scenes/PlacementScene.ts:319`: two
  stale comments.
  - §76 has now merged, so §77 is the second of the two to merge. Its rebase
    can fix both without growth.
  - Worth a look.
- **LOW** `src/ui/unitLayer.test.ts:116-130`: the `finishAnimations` test
  uses a one-step slide, so M8 is killed only by e2e. Worth a look.

No finding needs rework.

### Resolution of round 1's findings
- **MEDIUM M9a** (`drawnUnits.ts:84`, `facingPart: null`): **resolved.**
  - The test "the Turn button turns the galley figure in the Drawn view"
    (`e2e/naval.spec.ts:23`) kills it. It fails with "the figure turned to
    the new facing": expected 0, received 1.0471975511965979.
  - The comparison modulo a whole turn cannot pass vacuously:
    - The first assertion pins the starting rotation.
    - The engine facing is asserted to be `(old+1)%6`.
    - A figure that doesn't turn is off by π/3.
    - A missing figure gives NaN, which `toBeCloseTo` rejects.
- **LOW M16, M21:** still survive. Open, as a follow-up.
- **LOW BoardScene ships, stale comments, unitLayer M8 test:** open.
- **Nits** `hexDraw.ts:32` and `README.md:583`: resolved.
- **M8b:** still survives; near-equivalent.

### Not checked
- **B6–B9 and B11 in a browser:**
  - the mark slides, lunges, shakes, fades and turns with its counter;
  - the counter stays upright;
  - the drift arrow waits;
  - each cue plays in Standard;
  - a computer turn waits;
  - a view switch mid-animation works.

  These are for the live check (AC11).
- **The new test runs only at Off.** It proves the settle path. That the
  galley turns during the motion at Normal is covered by the unitMotions unit
  tests and live-check step 10.
- **The merge result was not built.** `git merge-tree` against main was clean
  before §76 merged. §76 has since merged (6f258b0), and round 1 found 3
  content conflicts and a duplicate `unitAlpha` against it. Both plans
  describe the resolution: keep §76's `unitAlpha`, and pass `alpha` through
  `drawFacingArrowhead` → `drawArrowheadAt`.
  - §77's rebase must be done and re-verified before `/ship`. The ship
    script's preconditions and its `verify` on main catch a broken merge.
- **The per-view-switch `once('shutdown')` closures** were not measured.

### Live check
- **Owed:** rule 1 (`src/ui/**`) and rule 3 (B6–B9, B11 above). The change is
  new and visual.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/77-standard-view-animations`,
  run `npm run dev -- --port 5277 --strictPort --host 127.0.0.1` and open
  http://127.0.0.1:5277/.
  - Use the Standard view, with "⏩ Speed: Normal".
  - Repeat steps 2, 3 and 7 at Slow.

1. **Test mode (2 players, armies ready).**
   - A land move slides hex by hex; the movement readout is already on the
     new hex.
   - A cavalry charge slides along its line.
   - With "Unit swaps: on", a swap slides both units together.
2. **Combat test mode.** The ships are at r=7 and r=9 from q=25.
   - Arrowheads point along each ship's facing from the first frame.
   - Turn: the arrowhead turns 60° smoothly and the counter stays upright.
   - A forward move: the arrowhead slides with its counter, never ahead of
     it.
   - Ram, a hit and a miss: the mark lunges or shakes with its counter, and
     a sunk ship fades with its mark.
   - Board: the mark lunges and shakes with its counter.
3. **Land combat.** The land rows are at r=3 and r=5 from q=10.
   - Each attacker lunges and back.
   - Then an elimination fades, and retreats, pushes, advances and exchanges
     play in commit order.
4. **An elephant drift, ideally with a trample:** the drift arrow appears
   only after the slide.
5. **A computer seat** ("Who plays each seat": AI — normal):
   - each move plays fully before its pause;
   - the drift arrow still waits.
6. **Cut short:** at Slow, a click or key mid-slide lands everything at
   once, and Ctrl+Z mid-animation undoes cleanly.
7. **A view switch mid-animation, both ways:** the final state shows, with
   no half-moved counter or arrow.
8. **Speed:**
   - the button shows in both views and keeps its label;
   - Slow persists across a reload;
   - at Off, moves jump.
9. **Placement:**
   - nothing animates and there is no Speed button;
   - the staged ship's arrow follows Turn;
   - placed ships point correctly.
10. **The Drawn view:**
    - unchanged;
    - a galley turns smoothly at Normal and ends on its new facing (M9a).

You should see everything above, with Standard counters never rotating, the
mark never detaching, and no console errors.

### Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 047f4ac. Exit 0, lint 0
  errors and 19 warnings (cap 19), 99 files, 1698 passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. The only error is the owed
  live check. Matches.
- **Coordinator, re-run:** `npm run e2e`. 35 passed (59.2s). Matches.
- **Coordinator, re-run:** the mutants. Each was backed up and restored by
  copy, and each ran `vitest src/ui` and the full e2e suite:

  | Mutant | vitest | e2e | Result |
  | --- | --- | --- | --- |
  | M9a | 302 passed | 1 failed, 34 passed | **killed** |
  | M16 | 302 passed | 35 passed | survived |
  | M21 | 302 passed | 35 passed | survived |
  | M8b | 302 passed | 35 passed | survived |

  `git status --short` was clean after. All four match the reviewer.
- **Reviewer:**
  - verify, check:intent and e2e with the same counts;
  - M9a killed by `naval.spec.ts:23`, and M16, M21 and M8b survive;
  - the comparison analysis;
  - merge-tree against main, clean before §76 merged;
  - sampling.
- **Taken on trust:**
  - the planner and cue feed;
  - everything visual;
  - that test mode honours "Who plays each seat".

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 0f8ab11
- round: 1
- sampled: no
- run: auto
- live-check: owed

**Tier.** The path table sets it to Attested (`src/ui/**`, `e2e/**`, README
wording). `review_tier` is empty, and no finding is CRITICAL or HIGH.

**Sampling.** `sampled:` is set only on an attest. In the worktree, `npm run
sdlc:scan -- --sample-due auto --exclude 77` says "= 11, sampled: no". On main,
which now includes §75's attested review, it says "= 12, sampled: yes". If a
later round attests, re-run the scan on main.

### Passes
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

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 77, feature)
  note:  24 file(s), 1768 line(s) changed outside intents/.
```

### Findings
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

### Not checked
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

### Live check
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

### Verified myself vs. taken on trust
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
