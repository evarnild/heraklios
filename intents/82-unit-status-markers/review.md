<!-- generated-by: heraklios/review@0.2.0 -->
# §82 review — Each unit shows whether it has moved, charged, attacked or been attacked this phase

verdict: rework
tier: attested
reviewed-commit: 1729fe0
round: 1
sampled: no
run: auto
live-check: owed

The engine, the seam and the scene wiring are sound: `verify`,
`check:intent`, the full e2e (77) and lint are all green, and almost every
behavioural line is pinned by a mutant.

The main gap is that no test pins **whose units are the active player's once
the seat order has been reshuffled** (E17). One MEDIUM and six LOW findings
need rework. All are mechanical; none needs a decision.

**Tier:** Attested. The path table covers `src/engine/**`, `src/ui/**` and
`src/scenes/**`. `review_tier` is empty, the feature shows existing state
rather than adding a rule, and there is no CRITICAL or HIGH finding.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings: AC12 and AC10's Off half lack their proofs, and one row of the plan's test table is missing (F3–F5) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. Digital-only; it reads engine facts. "A unit may only be attacked once per combat phase" (`02-rules-transcription.md:126`, French `05-…:245-246`). The charge, "uses its full movement allowance moving in a straight line and ends adjacent to an enemy unit" (`02-…:189-191`, French `05-…:268-271`), supports I5. |
| 4 | Tests prove the rule, not only pass | findings: E17, and D6/B3 (F1, F2) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | finding: F6 (Progress stale after the rebase) |
| 7 | Documentation | pass. The README paragraph matches the code. |
| 8 | Guardrails and hygiene | pass. 17 warnings, cap 17; no dependency. |
| 9 | Repository footguns | pass. The harness is untouched; `legalActions` is a read with no RNG. |
| 10 | Architecture | pass. Status logic is in `src/engine/unitStatus.ts`, pure and tested (principles 5, 6, 15); the look is a pure, tested table plus a thin Phaser drawer; the drawings loop left `BoardScene`, which shrank by 7 lines (principle 12). |

## Type check
```
type-check: PASS (intent 82, feature)
  note:  24 file(s), 929 line(s) changed outside intents/.
exit: 0
```

## Findings
- **F1 MEDIUM** `src/engine/unitStatus.ts:57`: `const active =
  state.seatOrder[state.activePlayerIndex];` is unpinned.
  - Mutant E17, `state.activePlayerIndex`, survives the full vitest suite
    and `e2e/unit-status-markers.spec.ts`.
  - Every test uses `createInitialState`, where `seatOrder` is the identity
    (`turnManager.ts:21`). The two diverge only after the round-end reshuffle
    (`turnManager.ts:118`). The e2e's `expected()` calls `unitStatuses`
    itself.
  - Effect if it regressed: from round 2 on, the marks land on the wrong
    player's units (spec B2/B3).
  - Needs rework: a `unitStatus.test.ts` case with `seatOrder = [1, 0]`,
    `activePlayerIndex = 0`, in the movement phase and in the combat phase.
    Player 1's units get `notMoved` / `canAttack`; player 0's units get
    nothing.
- **F2 LOW** `src/ui/unitDrawings.ts:16` and `src/scenes/BoardScene.ts:785`:
  passing the context through is only partly proven.
  - D6 (`unitStatuses(state, {})`) survives vitest; only the combat e2e kills
    it.
  - B3 (`rammedThisTurn` dropped from the scene's context) survives
    everything.
  - Needs rework: a combat-phase `unitDrawings.test.ts` case passing
    `attackedThisPhase` with a unit and a rammed ship in `rammedThisTurn`, and
    expecting `hasAttacked` on both. That kills D6. B3 stays live-check step 7.
- **F3 LOW** spec AC12: Placement shows no marks, but has no proof, and the
  spec names one (`placementDrawings.test.ts` or a `placement.spec.ts`
  line).
  - Needs rework: assert that no Placement drawing has `status` or
    `charged`.
- **F4 LOW** `e2e/unit-status-markers.spec.ts:229-263`: AC10 says "at Off it
  jumps with the counter", but only Normal speed is exercised.
  - In the Drawn view, the mark-vs-counter check is equal by construction
    (L12 survives).
  - Needs rework: add the Off variant: speed Off, one move, and the mark
    equals the counter right after the click.
- **F5 LOW** `src/engine/unitStatus.test.ts`: the plan's B3/I6 row
  (`plan.md:272`), "a unit that can only join a combined attack still
  `canAttack`", has no test.
  - Needs rework: add it (for example, an archer at range 2 plus infantry
    adjacent to the same enemy, both `canAttack`).
- **F6 LOW** `plan.md:351-368` Progress: stale after the rebase.
  - The commits are now `5d5d884`, `2e22606`, `f830cab` and `bd3c29e`.
  - `BoardScene.ts` is 2826 (`main` had 2833), with a 2826 baseline.
  - 1853 tests; 77 e2e scenarios.
  - Needs rework: refresh.
- **F7 LOW** `src/ui/boardView.ts:38`: the `sameMark` doc comment is inverted
  ("True when two drawings **differ**"). Needs rework: "True when two
  drawings show the same mark".
- **F8 LOW** `src/ui/unitMarkGraphics.ts:47`: `dot.glyph === 'cross' ?
  MARK.glyphColor : MARK.glyphColor` is a dead ternary. Needs rework:
  `g.lineStyle(1.5, MARK.glyphColor, 1)`.
- **F9 LOW** `e2e/unit-status-markers.spec.ts:184`: `expect(key(to)).toBeTruthy();`
  asserts nothing about the feature. Worth a look: remove it.

**The coordinator's points, as the reviewer answered them:**
- **`this.renderAllUnits()` in `commitEndPhase`** (`BoardScene.ts:2616`):
  needed, correct and tested. B2 (removing it) is killed by
  `unit-status-markers.spec.ts:129`.
  - It runs after the `gameOver` return and after the phase sets are cleared.
  - It pushes no undo.
  - A computer seat's `endPhase` takes the same path, and the render plans no
    motion.
- **`unitMarks()` on `BoardView`:** acceptable, beside the other dev readers
  on production classes (`MapView.drawnInspect`, `cameraStrays`,
  `tooltipText`). `e2e/dev-hook-members.spec.ts` lists it.
  - It reports the drawing the layer holds, not the painted `Graphics`, so
    L8 and DR1 survive by design (live check).
- **`MapView.ts` at 499:** not a guardrail problem. `max-lines` skips blanks
  and comments, and the size budget is for files over 500 physical lines.
  - After §88 merged, the merged file is 495 lines (coordinator, from
    `git merge-tree`).
- **AC12/AC13:** AC13 goes to the live check, as the spec says. AC12 has a
  test proof in the spec (F3).
- **I1–I6** are recorded on `unitStatuses` (`unitStatus.ts:35-52`) and are
  mutation-pinned: I1 (E1, E2), I2 (the ZOC test), I3 (E11), I4 (E13), I5
  (the charge test), and I6 (E3, E4; the combined-only case is F5).
  `legalActions` runs only in the combat phase (E7 killed by the spy test).
- **The rebase:** the baseline of 2826 is right. `hasNotMoved` is imported
  from §83, not copied.
  - §83's magenta rect and §82's dot don't overlap at zoom 1. Below about
    zoom 0.6 the rect covers part of the green dot; both flag a not-moved
    unit (live-check step 9).
  - §84's panel is on the HUD camera, and the marks are kept off it.

## Mutants
50 mutants; the survivors were re-run on the full suite.

**Survivors:**

| Mutant | Target | Result |
| --- | --- | --- |
| **E17** seatOrder lookup → index | `unitStatus.ts:57` | **SURVIVED** (vitest and e2e): F1 |
| E11b naval guard dropped | `unitStatus.ts:68` | SURVIVED, equivalent (only ships ram) |
| D6 context → `{}` | `unitDrawings.ts:16` | SURVIVED in vitest, KILLED in e2e (`:129`): F2 |
| **B3** `rammedThisTurn` dropped | `BoardScene.ts:785` | **SURVIVED**: F2, live-check step 7 |
| L8 `jointFigure` `setStatus` no-op | `unitLayer.ts:58` | SURVIVED (drawing; live check) |
| L9 `markAt` → lead | `unitLayer.ts:60` | SURVIVED (co-located by design) |
| L11 `marks()` charged → false | `unitLayer.ts:123` | SURVIVED (no charge in the e2e's seed) |
| L12 `marks()` mark := counter | `unitLayer.ts:124` | SURVIVED: F4 |
| M3 `hasAttacked` fill → red | `unitMarkSpec.ts:37` | SURVIVED (colour; live check) |
| M7 radius 4 → 14 | `unitMarkSpec.ts:19` | SURVIVED (look; live check) |
| SU1 badge not kept off the HUD | `standardUnits.ts:60` | SURVIVED (looks equivalent: `mapObjects()` is pinned off the HUD) |
| DR1 Drawn `setStatus` no-op | `drawnUnits.ts:88` | SURVIVED (drawing; live check) |

**Killed (each by the named §82 test):**
- **Engine:** E1–E5, E7–E10, E12–E16.
- **The seam:** S1–S3.
- **The layer:** L1–L3b; L4–L7 (`jointFigure` position, alpha, objects,
  destroy); L10.
- **The mark spec:** M1, M2, M4–M6, M8, M9.
- **The drawings:** D1–D5.
- **The scene:** B1, B2.
- **The Standard view:** SU2, killed by `unit-status-markers.spec.ts:86`
  and `:169` through `hudStrays`.

The rework should kill E17, D6 in vitest, an Off-speed AC10 variant, and an
AC12 Placement mutant. B3 stays for the live check.

## Not checked
- **The look (AC13):** size, corners, colours, readability at min and max
  zoom, against the four player colours, in English and French, next to a
  ship's facing mark.
- **The ram wiring in the scene** (B3).
- **A charged cavalry unit's chevron** in the browser (L11).
- **§83's rect overlapping the dot** below zoom 0.6 (from the constants).
- **A computer seat's marks while it acts.**
- **The marks after the round-end reshuffle** (F1).
- **Badges at depth 10.6** over a sliding counter at depth 10.

## Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`); the change is new and visual.
- **steps:** in `C:/Users/eric/src/heraklios-wt/82-unit-status-markers`,
  `npm run dev -- --port 5282`, http://127.0.0.1:5282/.
  1. Menu → **Test mode** (2 players), in the Standard view and English.
  2. Move an infantry unit one hex. Move another unit its whole allowance.
     Press Ctrl+Z.
  3. Rotate a ship once.
  4. Make a cavalry charge: the whole allowance in a straight line, ending
     next to an enemy.
  5. **End phase.**
  6. Attack with one unit. Then **End phase** again.
  7. Ram an enemy ship in the movement phase, then **End phase**.
  8. Watch a multi-hex slide at Normal speed, then one move at speed Off.
  9. Look at the marks at the default, minimum and maximum zoom. Then press
     **End phase** with units unmoved, and at minimum zoom look at §83's
     magenta rect against the green dot.
  10. A 4-player test start: look at the dots against each player colour.
  11. Toggle the **Drawn** view and back. Save to a slot, move a unit, then
      Load.
  12. Switch to French and glance again at steps 1 and 5.
  13. Set a seat to computer and watch its turn.
  14. Go into Placement.
- **you should see:**
  1. Every active unit has a solid green dot in its top-left corner, and the
     other player's units have none.
  2. A half-filled amber dot after a one-hex move, and an empty grey ring
     after a full move. Ctrl+Z brings the previous dot back.
  3. An amber dot; the ship's facing mark still shows, and the dot doesn't
     turn with the bow.
  4. A grey ring plus a yellow chevron in the top-right corner.
  5. Units with a target show a green dot with a sword; units without one
     show nothing. The charge chevron stays.
  6. The attacker shows a grey dot with a tick, and the defender a red dot
     with a cross. After End phase, the cross is gone and the new active
     player's units show green dots.
  7. **The ramming ship shows the grey tick, not the sword.**
  8. The dot travels with the counter, and at Off it jumps with it.
  9. The dots read at every zoom. Note whether the magenta rect hides the
     green dot.
  10. The dots never cover a counter's values or a ship's arrow, and read
      against every player colour.
  11. The same marks on the Drawn figures, and after the Load they return to
      the saved reading.
  12. The same marks in French.
  13. The computer's dots change as it acts.
  14. In Placement, no unit has a mark.
  - Any size, corner or colour change goes in `src/ui/unitMarkSpec.ts` and is
    recorded (spec B7).

## Verified myself vs. taken on trust

**Ran by the reviewer, at `1729fe0`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 113 passed (113)`, `Tests 1853 passed | 2 skipped (1855)`.
- `npm run check:intent`: PASS.
- Full `npm run e2e`: `77 passed (4.4m)`, with no flakes.
- 50 mutants as above.
  - Four e2e runs hit §88's server on the shared port and were discarded as
    false kills, then re-run in a quiet window.
  - All files were restored by copy; `git status --short` was empty.
- The rulebook passages (EN and FR), §83's `unmoved.ts` and
  `endMoveWarning*.ts`, and `UnitAnimator`'s input handling.

**Coordinator, re-run, at `1729fe0` (2026-11-25 17:37–18:00):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 113 passed (113)`, `Tests 1853 passed | 2 skipped
  (1855)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  82, feature)`, the same note. Matches.
- **Coordinator, re-run:** E17, D6, E11b, L8, L9, M3 and M7 against the full
  vitest suite: all **SURVIVED** (`Tests 1853 passed | 2 skipped` each).
  Matches.
- **Coordinator, re-run:** full `npm run e2e`. `77 passed (3.2m)`. Matches.
- **Coordinator, re-run:** E17, B3, L11, L12, SU1 and DR1 against
  `e2e/unit-status-markers.spec.ts` and `e2e/hud-strays.spec.ts`: all
  **SURVIVED** (`8 passed` each). Matches.
- The tree was `clean` after each.

**Taken on trust:**
- the reviewer's killed mutants (not re-run, as the skill asks only for the
  survivors in a round with no prior rework);
- its overlap arithmetic for §83's rect.
