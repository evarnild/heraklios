<!-- generated-by: heraklios/review@0.2.0 -->
# §82 review — Each unit shows whether it has moved, charged, attacked or been attacked this phase

verdict: attest
tier: attested
reviewed-commit: e23c2e9
round: 2
sampled: no
run: auto
live-check: owed

All nine round 1 findings are resolved. The rework adds only tests, one
comment fix and the removal of a dead ternary. E17 (the active seat after a
reshuffle), D6 (the context reaching the drawings), both AC12 Placement
mutants and L4 (the mark lagging at Off speed) are now killed. No finding
needs rework.

The reviewer's own full e2e was killed by Claude Code for low system memory
before any §82 scenario ran. The coordinator's re-check, run alone, passed
the full suite (78/78), and the attest rests on that.

**Tier:** Attested, by the path table (`src/engine/**`, `src/ui/**`,
`src/scenes/**`); no rule added, no CRITICAL or HIGH finding.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. F3 (AC12), F4 (AC10 at Off) and F5 (`plan.md:272`) now have their proofs. |
| 2 | Type check | pass. The only error is the owed live check. |
| 3 | Rulebook fidelity | pass. `unitStatus.ts` is untouched by the rework; round 1's citations stand. |
| 4 | Tests prove the rule, not only pass | pass. E17, D6, P1, P2 and L4 are killed. The survivors are equivalent or live-check items. |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | pass. The Progress numbers reproduce. |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass. `✖ 17 problems (0 errors, 17 warnings)`, cap 17. |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass |

## Type check
```
type-check: FAIL (intent 82, feature)
  error: A live check is owed and not recorded. Do the steps in intents/82-unit-status-markers/review.md → ## Live check, then set live_checked: <date> in intents/82-unit-status-markers/metadata.yml.
  note:  25 file(s), 1002 line(s) changed outside intents/.
exit: 1
```
The live check is the only error.

## Findings
No finding needs rework.

**Round 1, resolved:**
- **F1:** "the active seat (F1)" in `unitStatus.test.ts` (`seatOrder = [1, 0]`,
  `activePlayerIndex = 0`, movement and combat). E17 KILLED by 2 tests.
- **F2:** "in combat, the attacked and rammed sets give hasAttacked (D6)" in
  `unitDrawings.test.ts`. D6 KILLED in vitest. B3 still survives; it is
  live-check step 7.
- **F3:** `placementDrawings.test.ts` "draws no phase mark and no charge, even
  for a charged or spent unit (§82 AC12)". P1 and P2 KILLED.
- **F4:** `e2e/unit-status-markers.spec.ts:262` "at Off speed › the mark
  equals the counter right after the click (standard view)". L4 (the badge's
  `setPosition` dropped, `unitLayer.ts:49`) is KILLED by it and by `:230`. In
  the Drawn view the mark is a container child and cannot lag.
  - Nit: `playwright.config.ts:37` already sets Off for the project; the
    describe restates it, which is harmless.
- **F5:** "combined attacks (B3, I6)". `legalActions` enumerates singleton
  attacks only (`actions.ts:481`), so the case is in practice a second
  archer-in-range case, as round 1 asked.
- **F6:** the Progress numbers reproduce: commits 5d5d884, 2e22606, f830cab
  and bd3c29e; `BoardScene.ts` 2826 (`main` 2833) with a 2826 baseline;
  1858 tests; 78 e2e.
  - Nit: the new entry has no `### ` heading.
- **F7:** the `sameMark` comment matches the code.
- **F8:** the dead ternary is gone.
- **F9:** the removed `expect(key(to)).toBeTruthy()` could never fail (`key`
  always returns a non-empty string); no coverage dropped.

**The merge with §88** (`main` at `88b64d3`, `git merge-tree` exit 0):
- **`MapView.ts`:** 495 lines, with §88's `panBounds` and §82's `unitMarks()`
  in separate hunks.
- **`devHook.ts`:** both changes, in separate hunks.
- **`dev-hook-members.spec.ts`:** lists `unitMarks`.
- **No semantic clash:** the marks are on the map camera and kept off the
  HUD.
- **Not built:** the merged tree was not built or tested here. The deliver's
  post-merge `verify` covers the unit tests.

## Mutants
| Mutant | Target | Result |
| --- | --- | --- |
| E17 seatOrder lookup → index | `unitStatus.ts:57` | **KILLED** by "the active seat (F1)" (2 tests) |
| D6 context → `{}` | `unitDrawings.ts:16` | **KILLED** by "in combat, the attacked and rammed sets give hasAttacked (D6)" |
| P1 Placement adds `status = 'done'` | `placementDrawings.ts:43` | **KILLED** by the AC12 test |
| P2 Placement copies `charged` | `placementDrawings.ts:43` | **KILLED** by the AC12 test |
| L4 badge `setPosition` dropped | `unitLayer.ts:49` | **KILLED** by `unitLayer.test.ts` (§82 AC6) and by e2e `:230` and `:262` |
| E11b naval guard dropped | `unitStatus.ts:68` | SURVIVED, equivalent |
| L8 `jointFigure` `setStatus` never draws | `unitLayer.ts:58` | SURVIVED (live check) |
| L9 `markAt` → lead | `unitLayer.ts:60` | SURVIVED (co-located by design) |
| L11 `marks()` charged → false | `unitLayer.ts:123` | SURVIVED (live-check step 4) |
| L12 `marks()` mark := counter | `unitLayer.ts:124` | SURVIVED (L4 now covers the real lag) |
| M3 `hasAttacked` fill → red | `unitMarkSpec.ts:37` | SURVIVED (live check) |
| M7 radius 4 → 14 | `unitMarkSpec.ts:19` | SURVIVED (live check) |
| SU1 badge not kept off the HUD | `standardUnits.ts:60` | SURVIVED (looks equivalent) |
| DR1 Drawn `setStatus` no-op | `drawnUnits.ts:88` | SURVIVED (live check) |
| B3 `rammedThisTurn` dropped | `BoardScene.ts:785` | SURVIVED (live-check step 7) |

## Not checked
- The merged tree with §88, built and tested (`merge-tree` read only).
- **The look (AC13):** size, corners, colours, readability at min and max
  zoom, the four player colours, English and French, next to a ship's facing
  mark.
- The ram wiring in the scene (B3); a charged cavalry chevron in the browser
  (L11).
- §83's magenta rect over the dot below zoom 0.6.
- A computer seat's marks while it acts.
- The marks in a real game after the round-end reshuffle (the engine is now
  pinned by F1).
- Badges at depth 10.6 over a sliding counter at depth 10.

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
  15. Play on into round 2, after the seat order is reshuffled.
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
  15. The dots land on whoever is now active.
  - Any size, corner or colour change goes in `src/ui/unitMarkSpec.ts` and is
    recorded (spec B7).

## Verified myself vs. taken on trust

**Ran by the reviewer, at `e23c2e9`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 113 passed (113)`, `Tests 1858 passed | 2 skipped (1860)`.
- `npm run check:intent`: the FAIL above (live check only).
- `npm run e2e`: **not completed.** Claude Code killed it for low system
  memory after 47 passes; 8 then failed in 0–37 ms as the server died, and
  23 never ran. It was not restarted, as the harness instructs.
- 15 mutants on the full vitest suite, as above. Two early false kills, from
  a cmd.exe harness, were discarded and re-run. Each was restored by copy,
  and `git status --short` was empty.
- `git merge-tree --write-tree main HEAD` with the merged files read.
- The F6 numbers. `sampled:` from the main checkout: `nth attested auto
  change = 23, every 3, sampled: no`.

**Coordinator, re-run, at `e23c2e9` (2026-11-25 18:37–18:53), alone on the
machine:**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 113 passed (113)`, `Tests 1858 passed | 2 skipped
  (1860)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. **`78 passed (3.4m)`.** This
  is the run the reviewer could not finish; every §82 scenario passed,
  including `:262` at Off speed.
- **Coordinator, re-run:** E17, D6, P1 and P2 against the full vitest suite:
  all **KILLED** (E17 `2 failed`; the others `1 failed`). Matches.
- **Coordinator, re-run:** against `e2e/unit-status-markers.spec.ts` and
  `e2e/hud-strays.spec.ts`:
  - B3, L11, L12, SU1 and DR1 **SURVIVED** (`9 passed` each). Matches.
  - L4 is **KILLED** by `unit-status-markers.spec.ts:230` "at Normal speed ›
    the mark rides its counter through a slide" and `:262` "at Off speed ›
    the mark equals the counter right after the click". This is the F4
    proof the reviewer could not run.
- The tree was `clean` after each.

**Taken on trust:**
- round 1's killed mutants not named above (the rework touched no production
  line but a comment and the ternary);
- round 1's rulebook citations;
- the reviewer's vitest-only survivors E11b, L8, L9, M3 and M7, which round 1's
  coordinator re-check also saw survive.

## KonMari check
**outcome: kept** (`konmari.md`, record `041712d`, base `f659280`). Two
tidy-ups:
- `63f2935`: one unit drawing for the Board and Placement. `drawingOf(u)` and
  `isShip(u)` are exported from `src/ui/unitDrawings.ts`, and
  `placementDrawings.ts` uses them in place of its private `isShip` and its
  inline literal, which §82's `buildUnitDrawings` had copied (principle 6).
- `2b8ed1c`: one `boardView` import in `devHook.ts`.

Moved mutant lines: D6 is now at `unitDrawings.ts:26`; P1/P2 go after
`placementDrawings.ts:32`.

**The B16 check, at `041712d` (2026-11-25 19:00–19:21):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 113 passed (113)`, `Tests 1858 passed | 2 skipped
  (1860)`. The counts are unchanged.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only (`26 file(s), 1029 line(s)`).
- **Coordinator, re-run:** every killed mutant in the tidied drawing code,
  plus new ones on the shared helper, against the full vitest suite. All
  **KILLED**:
  - D1 (status dropped), D2 (charge dropped), D3 (the destroyed skip
    dropped), D4 (facing for every unit, in `drawingOf`), D5 (the ships list
    dropped) and D6 (context → `{}`);
  - P1 (Placement adds a status), P2 (Placement copies the charge) and P3
    (Placement's dimming dropped);
  - P4 (`isShip` always false), `4 failed`.

  The tree was `clean` after each.
- **Coordinator, re-run:** full `npm run e2e`. `78 passed (3.9m)`.
- `BoardScene.ts` 2826 and `MapView.ts` 499 are untouched; no baseline
  change.

**The reviewer's read of `f659280..041712d`: pass.**
- Within reach: `placementDrawings.ts` is untouched by §82, and §82's
  `buildUnitDrawings` had copied its base literal.
- Behaviour is identical field by field: the key order and the explicit
  `facing: undefined` for land are kept. `drawingOf` never writes a `status`
  or `charged` key, so AC12's `'status' in d` assertions hold.
- `unitType(u)` is `getUnitType(u.typeId)` (`state.ts:44-46`).
- There is no import cycle. Placement now reaches `engine/unitStatus`
  through the module graph, still in the ui → engine direction (principle
  2), and calls no status code (principle 5).
- No test, config or `eslint-disable` change; `konmari.md` is exact.

# Round 1 (history)

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
