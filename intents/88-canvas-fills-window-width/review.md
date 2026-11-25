<!-- generated-by: heraklios/review@0.2.0 -->
# §88 review — The game canvas takes the browser window's width when the game starts

verdict: attest
tier: attested
reviewed-commit: 645df2d
round: 3
sampled: no
run: auto
live-check: owed

Round 3 exists because, after round 2 attested and KonMari, §84 (the Tables
panel during combat) merged into `main`. On the owner's "rebase 88" the
branch was rebased onto `main` at `d1814ce`. The rebase is sound.

- **The `rulesPanel.ts` `snapshot()` conflict was resolved correctly.** The
  result is exactly `main`'s §84 body (`highlight: this.highlight()`, which
  returns the rolled cell when there is one) plus §88's `left?: number`.
- **The rebase fix `b54101d` is correct.** §84's `chooserRect`
  (`rulesPanelLayout.ts:46`) now uses `RULES_PANEL_MARGIN`, the name §88's
  KonMari gave the margin. Four mutants on it are killed by §84's own unit
  test.
- **§84's choosers centre on the real canvas width** (`left: canvasWidth/2 −
  w/2`; the scene draws at `this.scale.width / 2`), and the Tables panel's
  x follows the canvas (E3 and E4 killed).
- **§84's scenarios pass at a 1600 viewport.** The suite as pinned, at 1100,
  passes 73/73.

Only round 2's LOW notes remain.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Spec B1–B9 (B5 and AC3b as amended) and plan subtask 8; the rebase adds no behaviour. |
| 2 | Type check | pass. The only error is the owed live check (the owner's). |
| 3 | Rulebook fidelity | not run: screen layout only |
| 4 | Tests prove the rule | pass. `canvasSize`, `panBounds` (P1 equivalent), the Tables x, and the rebase-fixed `chooserRect` are all killed. The army builder wiring (E5–E8) is left to the live check. |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | F4 (LOW, carried) |
| 7 | Documentation | pass. README "The width of the game" is accurate. |
| 8 | Guardrails and hygiene | pass. `✖ 17 problems (0 errors, 17 warnings)`, cap 17. |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass |

## Type check
```
type-check: FAIL (intent 88, feature)
  error: A live check is owed and not recorded. Do the steps in intents/88-canvas-fills-window-width/review.md → ## Live check, then set live_checked: <date> in intents/88-canvas-fills-window-width/metadata.yml.
  note:  15 file(s), 271 line(s) changed outside intents/.
exit: 1
```
The live check is the only error.

## Findings
- **Rebase item 1, checked:** `src/ui/rulesPanel.ts:84-92`. It is `main`'s
  snapshot body plus `left`. §84's e2e reads the snapshot with `toMatchObject`
  or `.highlight`. The only `toEqual` is on the closed state
  (`rules-panel.spec.ts:55`), where `left` is `undefined`. No action.
- **Rebase item 2, checked:** `src/ui/rulesPanelLayout.ts:46`. `TOP +
  RULES_PANEL_H + RULES_PANEL_MARGIN` = 286, the value §84 pins; R1–R4 are
  killed. No action.
- **§84 on a wide canvas, checked.** The reviewer ran §84's and §55's
  scenarios through a scratch Playwright config.
  - At 1600: `8 passed`.
  - At 2400: 7 passed, and `rules-panel.spec.ts:50` failed at `:119`
    (`Expected: 3 / Received: 4`).
  - That is §55's test geometry, not a defect. At 2400 the pan bounds equal
    the room (B5), so `centerOn` cannot slide the archers' hex under the
    panel, and the test's guard only checks `under.x > 330`. The suite is
    pinned at 1100 (AC4), where it passes. No action; see the live check.
- **F4 LOW (carried):** `plan.md` Progress, "rework round 1". "70 passed" and
  "496 lines, was 499" don't reproduce: `MapView.ts` is 492, and the full
  e2e is now 73. Bookkeeping, not rework.
- **F5 LOW (carried):** below zoom 1 on a wide window, the board slides toward
  the panel. It follows the spec. Live check step 10.
- **F6 LOW (carried):** `e2e/wide-canvas.spec.ts:51-66` assumes zoom 1 and
  doesn't assert it. A wrong zoom would fail the test, not pass it.

No finding needs rework or a decision.

## Mutants
| Mutant | Target | Result |
| --- | --- | --- |
| R1 no margin | `rulesPanelLayout.ts:46` | KILLED by "places the advance and exchange choosers below the panel, centred, at 1100 and 1600 wide (§84)" |
| R2 margin → `TOP` | `rulesPanelLayout.ts:46` | KILLED by the same test |
| R3 chooser centred on 550 | `rulesPanelLayout.ts:47` | KILLED by the same test |
| R4 `RULES_PANEL_MARGIN = 13` | `rulesPanelLayout.ts:14` | KILLED by "sits at 312..1088 x 8..274 …" and the §84 chooser test |
| P1 `>` → `>=` | `panBounds.ts:18` | SURVIVED, equivalent |
| P2, P3, P5, P8, P9 | `panBounds.ts` | KILLED by `panBounds.test.ts` |
| W1, W2, W3 | `MapView.ts:136` | KILLED by `wide-canvas.spec.ts:51` |
| E1 `canvasSize(0)` | `main.ts:11` | KILLED by `:19`, `:37` and `:51` |
| E2 `window.innerWidth` only | `main.ts:11` | SURVIVED, equivalent |
| E3 `rulesPanelRect(1100)` | `rulesPanel.ts:123` | KILLED by `:19` |
| E4 `left + 1` | `rulesPanel.ts:90` | KILLED by `:19` |
| E5–E8 (the army builder wiring) | `ArmyBuilderScene.ts` | SURVIVED (live check) |

## KonMari
KonMari ran after round 2 (`outcome: kept`; record and check in round 2
below). The only commit since then outside `intents/` is the rebase fix
`b54101d`, a one-word rename to the name that KonMari introduced. There is
nothing in it to tidy, so no second KonMari pass ran.

## Not checked
- The army builder at 1600 or 2400 (E5–E8): live check.
- Zooming out and dragging on a wide window in a real browser (F5).
- A click on the open Tables panel at 2400 staying off the map. It's
  inferred from `contains()` using the same bounds that E3 and E4 prove; it
  wasn't observed.
- The choosers' x position in the browser. It's proven at unit level (R3)
  and by reading the code.
- Resizing after load (B3), and a window under 1100.

## Live check
- **owed:** rule 1 (`src/main.ts`, `src/ui/**`,
  `src/scenes/ArmyBuilderScene.ts`) and rule 3.
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/88-canvas-fills-window-width`, run
     `npm run dev -- --port 5288 --strictPort --host 127.0.0.1`, and open
     http://127.0.0.1:5288/ in a window about 1900 px wide.
  2. Look at the Menu.
  3. Click **2**, then for both players **Use default army** and **Confirm**.
  4. Placement: place a few units; find **Done placing**.
  5. Board: drag the map, open **Tables**, open an attack prompt, and **End
     phase** with units unmoved (§83's warning).
  6. Menu → **Combat test mode (units face to face, 2 hexes)**.
     - Open **Tables**, build an attack, and roll.
     - Keep the panel open through any retreat, advance or exchange prompt.
     - Press Escape while a chooser is up.
     - Attack again.
  7. Menu → **Test mode (2 players, armies ready)**, then **End game**, and
     look at Game over.
  8. Narrow the window without reloading, then reload.
  9. Repeat the walk at 1100 or narrower, including step 6.
  10. Very wide: a 2400+ px screen, or browser zoom at 50 % then reload.
      - Look at the Board in Test mode, and at Placement in a normal
        2-player game.
      - On each, try a horizontal drag, a vertical drag, a wheel zoom in and
        out, and ending a turn.
      - On the Board, also click on the open Tables panel over the map.
- **you should see:**
  - The Menu centred, with English/Français top-right.
  - The army builder as one centred block, looking as today.
  - On the Board: the map fills the area right of the panel, the score panel
    is bottom-right, the Tables panel top-right, and prompts and Game over
    are centred.
  - §83's warning frames the unmoved units, with its prompt over the log.
  - In step 6:
    - the Tables panel stays open at the top right, on its tab;
    - the rolled cell stays marked until the next attack is built;
    - the choosers sit below the panel, centred on the canvas;
    - Escape closes only the panel and leaves the chooser.
  - Resizing changes nothing until a reload.
  - At 1100 or narrower, everything exactly as today, §84 included.
  - In step 10:
    - the board is centred in the room on the Board, and on the whole canvas
      in Placement;
    - a horizontal drag does nothing at normal zoom, and a vertical drag
      pans;
    - zooming in lets you pan the whole board;
    - zooming out keeps the board fully visible but slides it toward the
      left (F5; say if that bothers you);
    - ending a turn doesn't shift the board sideways;
    - a click on the open panel doesn't act on the map.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `645df2d`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 112 passed (112)`, `Tests 1850 passed | 2 skipped (1852)`.
- `npm run check:intent`: the FAIL above (live check only).
- Full `npm run e2e`: `73 passed (3.1m)`, with no flakes.
- §84's and §55's scenarios at 1600 (`8 passed`) and at 2400 (7 passed, plus
  the `rules-panel.spec.ts:50` geometry failure explained above). Both runs
  used a scratch config that touched no tracked file.
- The mutants above.
  - The reviewer's first e2e batch was invalid: the port was busy, and an
    escaping bug stacked mutations. The four files were restored to their
    HEAD blobs, and every e2e mutant was re-run with a fixed harness.
  - `git status --short` was empty after each and at the end.
- Sampling, from the main checkout: `nth attested auto change = 22, every 3,
  sampled: no`.

**Coordinator, re-run, at `645df2d` (2026-11-25 17:25–17:32):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 112 passed (112)`, `Tests 1850 passed | 2 skipped
  (1852)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only, the same note. Matches.
- **Coordinator, re-run:** R1, R2, R3 and R4 against `rulesPanelLayout.test.ts`:
  all **KILLED**. Matches.
- **Coordinator, re-run:** P1 against `panBounds.test.ts`: **SURVIVED** (`11
  passed`). Matches.
- **Coordinator, re-run:** full `npm run e2e`. `73 passed (3.1m)`. Matches.
- **Coordinator, re-run:** E2, E5, E6, E7 and E8 against
  `e2e/wide-canvas.spec.ts`: all **SURVIVED** (`3 passed` each). Matches.
- The tree was `clean` after each. The worktree was clean before the
  re-check, after the reviewer's restore.

**Taken on trust:**
- P2–P9, W1–W3, E1, E3 and E4 in this round (the reviewer's; the same results
  as round 2 and its KonMari check, which the coordinator re-ran);
- Phaser's `clampX` behaviour behind F5.

# Round 2 (history)

verdict: attest
tier: attested
reviewed-commit: d21ff8b
round: 2
sampled: no
run: auto
live-check: owed

Round 1's F1 is fixed as the owner decided ("Centre it (amend spec)").
- **The helper.** A pure `src/ui/panBounds.ts` returns the old bounds when the
  room is at most the board plus 2 × 200 px. When the room is wider, it
  returns bounds exactly the room's width, centred on the board. Vertical
  bounds are unchanged.
- **The wiring.** `MapView` passes it `availableWidth`.
- **The proof.** A new e2e at 2400 × 750 proves the centring and fails on
  the old bounds ("gaps 200 / 514"). Every helper mutant is killed except one
  provably equivalent (P1).
- **F2 and F3** are done. Nothing changes at 1100 or narrower.

What remains: two LOW number slips in Progress, and one LOW note about
zooming out on a wide window.

**Sampling:** `sampled: no` in the worktree (nth 20). On `main` the same scan
says `sampled: yes` (nth 21); the count at merge comes from `main`, so a
post-merge full read is probably due.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Matches amended B5, AC3b and subtask 8. |
| 2 | Type check | pass. The only error is the owed live check (the owner's). |
| 3 | Rulebook fidelity | not run: screen layout only |
| 4 | Tests prove the rule | pass. `panBounds` fully killed (P1 equivalent), and the wiring killed by the 2400 e2e. The army builder wiring is left to the live check, as planned. |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | finding F4 (LOW) |
| 7 | Documentation | pass. `README.md:576` ("once the whole map fits, it is centred") is now true. |
| 8 | Guardrails and hygiene | pass. 17 warnings, cap 17. `MapView.ts` shrank. |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass. F3 is done: `ARMY_LAYOUT_WIDTH = BASE_WIDTH`, with no import cycle. |

## Type check
```
type-check: FAIL (intent 88, feature)
  error: A live check is owed and not recorded. Do the steps in intents/88-canvas-fills-window-width/review.md → ## Live check, then set live_checked: <date> in intents/88-canvas-fills-window-width/metadata.yml.
  note:  14 file(s), 263 line(s) changed outside intents/.
exit: 1
```
The live check is the only error.

## Findings
- **F1 (round 1), resolved** in `5a1bdb6`.
  - `panBounds.ts:15-22`; `MapView.ts:136` passes `availableWidth`.
  - **Initial scroll.** The new `bounds.x` equals `leftPanelWidth`, the
    `setScroll` value. Phaser 3.90's `clampX` (`BaseCamera.js:942-961`)
    then allows only the centred scroll.
  - **Turn-start centring (§43)** is a no-op horizontally on a wide window,
    and still works vertically.
  - **Dragging.** Horizontal drag is locked at zoom 1 on a wide window, since
    nothing is hidden; vertical drag works.
  - **Zooming in** keeps the whole board reachable.
  - **Placement** (room = the whole canvas) gets `bounds.x = 0`, its
    `setScroll(0, 0)`.
- **F2 (round 1), resolved** in `cecaef3`.
- **F3 (round 1), resolved:** `armyBuilderLayout.ts:8`.
- **F4 LOW** `plan.md` Progress, "2026-11-25 - rework round 1": two numbers
  don't reproduce.
  - "`npm run e2e`: 70 passed": the full run at `d21ff8b` is `66 passed`.
  - "496 lines, was 499": `MapView.ts` is 496 at `ac7ed6c` and 492 at HEAD.
  - Worth a look: a bookkeeping correction, not rework.
- **F5 LOW** `panBounds.ts` / `MapView.ts:136`: zooming out on a wide window
  doesn't keep the board centred.
  - Below zoom 1, `clampX` pins the visible left edge to `bounds.x`, so the
    board slides toward the panel.
  - This follows the spec ("fixed at zoom 1"), and the old bounds pin the
    same way. The board stays fully visible.
  - Derived from Phaser's source. Worth a look in the live check (step 9); a
    follow-up only if the owner minds.
- **F6 LOW** `e2e/wide-canvas.spec.ts:52-67`: the test assumes zoom 1 without
  asserting it. A wrong zoom would make it fail, not pass falsely.
  - Worth a look: assert `cameraZoom()` is 1.

## Mutants
**`panBounds.ts`:**

| Mutant | Target | Result |
| --- | --- | --- |
| P1 `>` → `>=` | `:18` | SURVIVED, **equivalent**: at room = board + 2p both branches return the same bounds |
| P2 boundary + 1 | `:18` | KILLED by "is the old bounds at exactly board + 2 x padding and wider just above it" |
| P3 centre without `board.width / 2` | `:19` | KILLED by Board 2400/3440 and Placement 2086/2400/3440 |
| P4 width = board + 2p in the wide branch | `:19` | KILLED (6 failed) |
| P5 `y = board.y` | `:16` | KILLED (11 failed) |
| P6 wide branch takes the board's `y`/`height` | `:19` | KILLED (5 failed) |
| P7 no widening | `:18` | KILLED (6 failed) |
| P8 `>` → `<` | `:18` | KILLED (10 failed) |
| P9 centre + 1 | `:19` | KILLED (5 failed) |

**Wiring, against `e2e/wide-canvas.spec.ts`:**

| Mutant | Target | Result |
| --- | --- | --- |
| W1 `panBounds` call removed | `MapView.ts:136` | KILLED: `gaps 200 / 514`, `Received: 314` |
| W2 room width `0` | `MapView.ts:136` | KILLED: `gaps 200 / 514` |
| W3 room = `viewportWidth` | `MapView.ts:136` | KILLED: `gaps 507 / 207`, `Received: 300` |
| E2 `window.innerWidth` only | `main.ts:11` | SURVIVED, equivalent |
| E5 `ox = 0` | `ArmyBuilderScene.ts:43` | SURVIVED (live check) |
| E6 Abandon at `20` | `ArmyBuilderScene.ts:119` | SURVIVED (live check) |
| E7 `armyRowSlot(index)` | `ArmyBuilderScene.ts:144` | SURVIVED (live check) |
| E8 Confirm at `width - 20` | `ArmyBuilderScene.ts:92` | SURVIVED (live check) |

## Not checked
- Zooming out and dragging on a wide window in a real browser (F5, from the
  Phaser source).
- Placement centring in the browser (unit cases only; shared wiring).
- §83's End-phase warning framing on a wide window (from code only).
- The army builder at 1600 or 2400 (E5–E8): live check.
- Resizing after load (B3), and a window under 1100: live check.
- e2e on the merged tree: the branch lacks §86's fix, though
  `save-load.spec.ts` passed in both runs.

## Live check
- **owed:** rule 1 (`src/main.ts`, `src/ui/**`,
  `src/scenes/ArmyBuilderScene.ts`) and rule 3 (builder offset, resize,
  wide-window centring and zoom only show live).
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/88-canvas-fills-window-width`, run
     `npm run dev -- --port 5288 --strictPort --host 127.0.0.1`, and open
     http://127.0.0.1:5288/ in a window about 1900 px wide.
  2. Look at the Menu.
  3. Click **2**, then for both players **Use default army** and **Confirm**.
  4. Placement: place a few units; find **Done placing**.
  5. Board: drag the map, open **Tables**, open an attack prompt, and **End
     phase** with units unmoved (§83's warning).
  6. From the Menu: **Test mode (2 players, armies ready)**, then **End
     game**, and look at Game over.
  7. Narrow the window without reloading, then reload.
  8. Repeat the walk at 1100 or narrower.
  9. Very wide: a 2400+ px screen, or browser zoom at 50 % then reload.
     - Look at the Board in Test mode, and at Placement in a normal 2-player
       game.
     - On each, try a horizontal drag, a vertical drag, a wheel zoom in and
       out, and ending a turn.
- **you should see:**
  - The Menu centred, with English/Français top-right.
  - The army builder as one centred block, looking as today.
  - On the Board: the map fills the area right of the panel, the score panel
    is bottom-right, the Tables panel top-right, and prompts and Game over
    are centred.
  - §83's warning frames the unmoved units, with its prompt over the log.
  - Resizing changes nothing until a reload.
  - At 1100 or narrower, everything exactly as today.
  - In step 9:
    - the board is centred in the room on the Board, and on the whole canvas
      in Placement;
    - a horizontal drag does nothing at normal zoom, and a vertical drag
      pans;
    - zooming in lets you pan the whole board;
    - zooming out keeps the board fully visible but slides it toward the
      left (F5; say if that bothers you);
    - ending a turn doesn't shift the board sideways.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `d21ff8b`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 112 passed (112)`, `Tests 1847 passed | 2 skipped (1849)`.
- `npm run check:intent`: the FAIL above (live check only).
- Full `npm run e2e`: `66 passed (3.4m)`, including `wide-canvas.spec.ts:52`
  "a very wide window centres the board (B5)".
- The mutants above.
  - The system stopped the reviewer's full-suite unit run for low memory
    during P4. `panBounds.ts` was restored by copy at once.
  - P4–P9 then ran against `panBounds.test.ts`, the only test importing it.
- The P1 equivalence by algebra; Phaser 3.90's `clampX` read from source;
  the line counts; the sampling scan.
- `git status --short` was empty at the end.

**Coordinator, re-run, at `d21ff8b` (2026-11-25 16:12–16:20):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 112 passed (112)`, `Tests 1847 passed | 2 skipped
  (1849)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `66 passed (3.8m)`. Matches.
- **Coordinator, re-run:** P1 against `src/ui/panBounds.test.ts`.
  **SURVIVED** (`Tests 11 passed (11)`). Matches (equivalent).
- **Coordinator, re-run:** E2, E5, E6, E7 and E8 against
  `e2e/wide-canvas.spec.ts`. All **SURVIVED** (`3 passed` each). Matches.
- No round 1 rework mutant had to be re-killed: round 1's only rework target
  was F1, whose new test is proven red on the old bounds by W1 and W2.
- The tree was `clean` after each.

**Taken on trust:**
- the reviewer's P2–P9 and W1–W3 kills;
- the round 1 width probe (W1 reproduces its "gaps 200 / 514").

## KonMari check
**outcome: kept** (`konmari.md`, record `7aeb591`, base `b82bc98`). Three
tidy-ups:
- `ea7f23f`: `MapView.ts` imports `./panBounds` below `phaser`, beside its
  neighbours.
- `4816456`: the Tables panel margin exported as `RULES_PANEL_MARGIN` from
  `rulesPanelLayout.ts`. `e2e/wide-canvas.spec.ts` imports it instead of its
  own `TABLES_MARGIN = 12` (principle 6); the assertion's value is still 812.
- `095cda9`: `armyBuilderLayout.ts`'s header comment wrapped like its
  neighbours.

Moved mutant lines: `armyBuilderLayout.ts` +1 (M6–M10), and the B5 e2e at
`wide-canvas.spec.ts:51`.

**The B16 check, at `7aeb591` (2026-11-25 16:37–16:45):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 112 passed (112)`, `Tests 1847 passed | 2 skipped
  (1849)`. The counts are unchanged.
- **Coordinator, re-run:** `npm run check:intent`. FAIL on the owed live check
  only (`15 file(s), 269 line(s)`).
- **Coordinator, re-run:** full `npm run e2e`. `66 passed (3.9m)`.
- **Coordinator, re-run:** the killed mutants in the tidied files, re-applied
  by line text.
  - **`armyBuilderLayout.ts`**, against `armyBuilderLayout.test.ts`: M6, M7,
    M8, M9 and M10 all **KILLED**.
  - **Against `e2e/wide-canvas.spec.ts`** (its margin now imported):
    - W1, W2 and W3 at `MapView.ts:136`: KILLED by `:51`;
    - E1 at `main.ts:11`: KILLED by `:19`, `:37` and `:51`;
    - E3 at `rulesPanel.ts:124`: KILLED by `:19`, so the imported margin
      still pins the right edge.
  - The tree was `clean` after each.

**The reviewer's read of `b82bc98..7aeb591`: pass.**
- `ea7f23f` and `095cda9` touch only §88's own lines.
- `4816456` removes §88's copy of the margin by exporting the original;
  `RULES_PANEL_MARGIN` is still 12, and its one use is `rulesPanelRect`.
- The e2e still expects 812 at 1600, so E3 and E4 stay killed.
  `rulesPanelLayout.test.ts:28` pins the literal 12 independently, so the
  test is not weakened and no assertion changed.
- `MapView.ts` is at 492 lines. No size, lint or dependency change.
  `konmari.md` is exact.

# Round 1 (history)

verdict: rework
tier: attested
reviewed-commit: b3e6b17
round: 1
sampled: no
run: auto
live-check: owed

The canvas takes the window's width and never drops under 1100. At 1100 or
narrower nothing changes, which the whole existing suite, passing unedited,
proves. The right-edge panels follow the right edge, and the army builder is
one centred block. All ten unit mutants are killed.

The one real defect is F1. On very wide windows the Board isn't centred: the
pan bounds pin it 200 px from the side panel, and the extra width sits empty
on the right. The README and spec B5 promised centring. The owner decided in
this conversation to **centre it (amend spec)**; spec B5, a new AC3b and plan
subtask 8 record the amendment.

`sampled: no` on the branch. Run on `main`, which has §86's review, the same
scan says `sampled: yes`. If a later round attests, the count is read from
`main`, where a post-merge full read may be due.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | finding: F1 (B5's centring does not hold) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: screen layout only, no rule |
| 4 | Tests prove the rule | pass, with stated survivors. The pure helpers are fully killed; the builder's wiring is left to the live check, as planned. |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | findings: F1 (the README and spec centring claim), F2 (stale Progress) |
| 7 | Documentation | finding: F1, `README.md:576` |
| 8 | Guardrails and hygiene | pass. 17 warnings, cap 17; no dependency. |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass. `canvasSize.ts` and `armyLayoutOffset` are pure, tested helpers; `main.ts` and the scene only wire them. F3 is minor. |

## Type check
```
type-check: PASS (intent 88, feature)
  note:  11 file(s), 168 line(s) changed outside intents/.
exit: 0
```

## Findings
- **F1 MEDIUM, decided** `README.md:576` and spec B5, with the root cause in
  `src/ui/MapView.ts:134-141` (pan bounds of board ± 200 px).
  - **What goes wrong.** Once the main camera's viewport (canvas − 300) is
    wider than the bounds (1386 + 400 = 1786 px, so a canvas over about 2086),
    Phaser's `clampX` pins `scrollX` to `bounds.x`. The board sits 200 px
    right of the panel, with the extra width empty on the right. From about
    1718 to 2086 the board fits but isn't centred either.
  - **The reviewer's probe** (its own dev server on 5277, test mode, seed 1).
    These are the gaps between the outer hex centres and the edges of the
    map room:

    | Canvas width | Left gap | Right gap |
    | --- | --- | --- |
    | 1100 | 200 | 6 |
    | 1600 | 200 | 11 |
    | 1900 | 200 | 14 |
    | 2400 | 200 | 514 |
    | 3440 | 200 | 1554 |

  - **Placement** has the same bounds and stops centring above about 1786 (derived from the code).
  - **The owner's decision (2026-11-25, in this conversation): "Centre it
    (amend spec)".** B5 is amended: when the room is wider than the board
    plus the 200-px padding, the horizontal pan bounds widen, symmetrically
    about the board, to the room's width at zoom 1. AC3b and plan subtask 8
    add a pure bounds helper with unit cases from 1100 to 3440 and an e2e at
    2400 that must fail on the old bounds.
  - Needs rework: implement subtask 8, and correct README:576 if its wording
    no longer matches.
- **F2 LOW** `plan.md` Progress ("2026-11-24 - subtasks 1-7"): the commits
  1310f31, 7722139 and ef59139 are pre-rebase, and the counts ("1758 passed",
  "lint 18, cap 18") are stale.
  - The branch's commits are f25a063, b409c8a, e7e34b8 and 8ff85d2; now 1836
    pass with 2 skipped, and lint is 17 with a cap of 17.
  - Needs rework: append a dated Progress line noting the rebase, the new
    hashes and the counts.
- **F3 LOW** `src/ui/canvasSize.ts:5` and `src/ui/armyBuilderLayout.ts:7`:
  `BASE_WIDTH = 1100` and `ARMY_LAYOUT_WIDTH = 1100` are two homes for one
  design width (principle 6).
  - Worth a look: the builder constant could re-export `BASE_WIDTH`.

**The coordinator's specific points**, as the reviewer answered them:
- **The rebase.** The README keeps §83's section (544-570), then §88's
  (572-580). `devHook.ts:154` `rulesPanel()` carries `left?: number` next to
  `endMoveWarning()`. `memberSnapshot` passes `left` through, and the e2e
  proves it: E4, `left + 1`, is killed ("Expected: 812 / Received: 813").
- **§86** is now on `main` and not on the branch. It touches only e2e files
  outside §88's diff, and `git merge-tree` is clean.
- **§83 on a wide canvas.** `frameBox` reads the real camera size
  (`MapView.ts:474-483`). The warning's prompt is anchored to the left
  panel. The Tables, score and centred prompts all place from
  `this.scale.width`; the score panel's left is always W − 312. No
  hard-coded 1100 width remains in `src/`.
- **At 1100 or narrower nothing changes.** `canvasSize` gives 1100 for 0,
  800, 1100, 1100.9 and NaN, and `armyLayoutOffset` is 0 at 1100 and 1101.
  The existing suite passes unedited at 1100 × 750.
- **Viewports.** `playwright.config.ts` changes only a comment. The 1600
  viewport is file-scoped to `wide-canvas.spec.ts`.

## Mutants
**Unit mutants, full vitest suite:** all **KILLED**.
- `canvasSize.ts` (M1–M5), by `canvasSize.test.ts`.
- `armyBuilderLayout.ts` (M6–M10), by `armyBuilderLayout.test.ts`.

**Wiring mutants, against `e2e/wide-canvas.spec.ts`:**

| Mutant | Target | Result |
| --- | --- | --- |
| E1 `canvasSize(0)` | `main.ts:11` | KILLED (Expected 1600, Received 1100) |
| E2 `window.innerWidth` only | `main.ts:11` | SURVIVED, equivalent (`#app` is 100vw) |
| E3 `rulesPanelRect(1100)` | `rulesPanel.ts:124` | KILLED (Expected 812, Received 312) |
| E4 `left + 1` in the snapshot | `rulesPanel.ts:85` | KILLED |
| E5 `const ox = 0` | `ArmyBuilderScene.ts:43` | SURVIVED (live check, AC5) |
| E6 Abandon at `20` | `ArmyBuilderScene.ts:119` | SURVIVED (live check) |
| E7 `armyRowSlot(index)` | `ArmyBuilderScene.ts:144` | SURVIVED (live check) |
| E8 Confirm at `width - 20` | `ArmyBuilderScene.ts:92` | SURVIVED (live check) |

F1's rework must add a test that fails on the current bounds at a canvas of
2400 or more; the coordinator re-runs that.

## Not checked
- Placement at a wide width in the browser (F1's Placement half is derived
  from the code).
- The army builder at 1600 or 2400 (E5–E8): live check.
- Game over, and the ram, boarding and decision prompts at wide widths:
  checked from code only.
- Resizing the window after load (B3), and a window under 1100.
- e2e on the merged tree (the branch lacks §86).
- §83's End-phase warning framing at a wide width in the browser.

## Live check
- **owed:** rule 1 (`src/main.ts`, `src/ui/**`,
  `src/scenes/ArmyBuilderScene.ts`) and rule 3 (the builder offset, resize
  and wide prompts only show in a live run).
- **steps** (after the F1 rework):
  1. In `C:/Users/eric/src/heraklios-wt/88-canvas-fills-window-width`, run
     `npm run dev -- --port 5288 --strictPort --host 127.0.0.1`, and open
     http://127.0.0.1:5288/ in a window about 1900 px wide.
  2. Look at the Menu.
  3. Click **2**, then for both players **Use default army** and **Confirm**.
  4. Placement: place a few units; find **Done placing**.
  5. Board: drag the map, open **Tables**, open an attack prompt, and **End
     phase** with units unmoved (§83's warning).
  6. From the Menu: **Test mode (2 players, armies ready)**, then **End
     game**, and look at Game over.
  7. Narrow the window without reloading, then reload.
  8. Repeat the walk at 1100 or narrower.
  9. On a screen 2400 px or wider (or at 50 % browser zoom, then reload),
     look at the Board and at Placement.
- **you should see:**
  - The Menu centred, with English/Français top-right.
  - The army builder as one centred block, looking as today.
  - On the Board, the map fills the area right of the panel; the score panel
    is bottom-right, the Tables panel top-right, and prompts and Game over
    are centred.
  - §83's warning frames the unmoved units, with its prompt over the log.
  - Resizing changes nothing until a reload.
  - At 1100 or narrower, everything exactly as today.
  - In step 9, the board centred in the room with equal space on both sides,
    on the Board and in Placement.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `b3e6b17`:**
- `npm run verify`: exit 0, `✖ 17 problems (0 errors, 17 warnings)`, `Test
  Files 111 passed (111)`, `Tests 1836 passed | 2 skipped (1838)`.
- `npm run check:intent`: PASS.
- Full `npm run e2e`: `65 passed (2.3m)`.
- 10 unit mutants KILLED; 8 wiring mutants: 3 KILLED, 5 SURVIVED.
- The board width (1386 px) measured from `map.ts`.
- A Playwright probe at widths 1100–3440, against its own dev server on
  5277 with a temporary saves folder; that server was stopped by the
  reviewer. This is evidence, not the live check.
- `git status --short` was clean at the end.

**Coordinator, re-run, at `b3e6b17` (2026-11-25 15:01–15:08):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 17 problems (0 errors,
  17 warnings)`, `Test Files 111 passed (111)`, `Tests 1836 passed | 2 skipped
  (1838)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  88, feature)`, the same note. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `65 passed (3.7m)`. Matches.
- **Coordinator, re-run:** the five surviving mutants against
  `e2e/wide-canvas.spec.ts`: E2, E5, E6, E7 and E8 all **SURVIVED** (`2
  passed` each). Matches.
- The tree was `clean` of code after each. The spec and plan amendment was
  uncommitted in the working tree; it is code-free and committed afterwards.

**Taken on trust:**
- the reviewer's width probe and its 3440 screenshot (F1);
- the implementer's report that `placement.spec.ts` "Turn buttons" was a
  load flake.
