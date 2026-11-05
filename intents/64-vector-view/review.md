<!-- generated-by: heraklios/review@0.1.5 -->
# §64 review — A second board view, a drawn 2D landscape with unit figures

verdict: rework
tier: reviewed
reviewed-commit: 3e26fff
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed. The path table gives Attested (`src/ui/**`, `src/scenes/**`,
`e2e/**`), and the metadata sets no `review_tier`, but this round's HIGH finding
raises it (input 3).

**Verdict:** `rework`. There is 1 HIGH, 1 MEDIUM and 3 LOW. The HIGH is a
"Needs decision:", so the auto run stops for the owner. The passes were run by
the `heraklios-reviewer` agent. The coordinator re-ran verify, check:intent,
e2e and every surviving mutant, and all results match.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): the Placement facing gap (HIGH), a plan-level miss. The other divergences are recorded in Progress and acceptable (below) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not applicable: digital-only, with no `src/engine`, `src/data` or save change |
| 4 | Tests prove it | findings (1): two MapView swap mutants survive the full e2e suite (MEDIUM). Pure modules: 57 of 61 vitest mutants killed, and the 4 survivors are equivalent or harmless |
| 5 | Boundary and conventions | pass: geometry and figures are pure and tested; Phaser only draws; no `GameState`, history or save change |
| 6 | Numbers in prose | findings (1): the Progress before-counts are wrong (LOW). The bundle numbers reproduce |
| 7 | Documentation | findings (1): `README.md:541-543` says the galley's orientation is the facing, which is false in Placement (part of the HIGH) |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged, no new dependency, no `eslint-disable` |
| 9 | Repository-specific footguns | pass: no drift or engine change; headless and AI play untouched |

## Type check
```
type-check: PASS (intent 64, feature)
  note:  39 file(s), 2337 line(s) changed outside intents/.
```

## Findings
- **HIGH** `src/scenes/PlacementScene.ts:327`, `:433-435`; `src/ui/drawnBoardView.ts:65-71`; `src/ui/drawnUnits.ts:56`. In Placement, the Drawn view shows no ship facing.
  - Placement calls `setUnits` without `facing`, so every placed galley is drawn at 0 rad (due east). That is not one of the six facings: `facingAngleRad(0)` is 30°.
  - The staged ship (`pendingShip`) isn't a unit. In Standard it shows only as its `setFacingIndicators` arrow, and the Drawn view's `setFacingIndicators` draws nothing. So in Drawn the staged ship is invisible, and the Turn buttons change nothing on the map.
  - This breaks B11 ("ship facing … none may be missing") and B12, and makes `README.md:541-543` false for Placement. The Board is fine (`BoardScene.ts:916` passes `facing`).
  - **Needs decision:** pick one, with a test or e2e step for the staged ship in Drawn.
    - **(a)** The Drawn view's `setFacingIndicators` draws arrowheads as Standard does, possibly restyled. This drops the spec assumption that the galley's orientation replaces the arrowhead.
    - **(b)** Keep the assumption. Placement passes `facing` in its `UnitDrawing`s, and the staged ship is drawn in Drawn as a ghost figure (a provisional id, rotated to the pending facing).
- **MEDIUM** `src/ui/MapView.ts:162`, `:167`. The toggle's two load-bearing lines are unproven.
  - Deleting `this.drawing.replay(next)` (X1) or `this.uiCamera?.ignore(next.mapObjects())` (X2) leaves e2e at 19 passed.
  - `board-view.spec.ts` checks state, camera, selection and `displayListSorted`. None of those sees what the new view draws or which camera renders it.
  - The code is correct: the reviewer's browser probe confirmed it.
  - **Needs rework:**
    - Add a read-only, dev-only hook reader, `boardObjects(): { unitDrawings: number; hudLeaks: number }`: the view's unit objects, and the world objects that neither camera ignores.
    - In `board-view.spec.ts`, after each toggle to Drawn with a unit selected, assert `unitDrawings` equals the number of living units and `hudLeaks` is 0. Assert `hudLeaks` for Drawn only: Standard has the known empty drift-arrow leak from §67.
    - This should kill X1 and X2.
- **LOW** `intents/64-vector-view/plan.md` (Progress): "before: 69 files, 1236 tests; +8 files, +41 tests" doesn't match the diff. `main` has 67 test files, and the branch adds 10 files and 54 cases, so before was 67 files and 1223 tests. **Needs rework:** correct the Progress line.
- **LOW** `intents/64-vector-view/plan.md:91`: the plan's bundle "before" (1,660.04 kB) came from the main checkout's stale install, vite 6.4.5 against the lockfile's 8.3.4. With the lockfile's vite it is 1,366.81 kB before and 1,387.33 kB after (+20.52 kB, gzip +6.40). The Progress correction stands. Worth a look: `npm ci` in the main checkout.
- **LOW** `src/ui/landscape/paintLandscape.ts:32-35`: the 1× bake fallback is dead code. The game runs `Phaser.CANVAS` (`src/main.ts:9`), so `renderer.gl` is undefined and the bake is always 2× (2884×2362). Worth a look: fix the comment or drop the branch.

## Implementer's reported divergences, judged
- **Bundle "before":** the implementer is right (above).
- **`flankSides` "every flank has a side":** acceptable as weakened. Two of the 111 flanks are walled in (`30,-2` and `32,-2`). The `30,-2 → []` pin is load-bearing: it alone kills F2.
- **The `queueDepthSort()` mutant in `drawnUnits.ts` survives:** equivalent. `DisplayList.addChildCallback` (Phaser 3.90 `DisplayList.js:121-123`) queues a sort on every add, and the Drawn view re-adds a container on each add or update. The plan's claim that `draw-order` kills it was wrong in premise.
- **`regionLoops(members)` instead of a predicate:** same semantics, so acceptable.

## Mutants (pass 4)
61 vitest mutants, 57 killed. Each is listed with its killing test in the reviewer's report.

| Module | Killed |
| --- | --- |
| `boardViewPreference.ts` | P1-P5 |
| `viewDrawingState.ts` | R1-R14 |
| `regions.ts` | G1, G2, G4 |
| `smoothing.ts` | S1-S4 |
| `rivers.ts` | V1-V6 |
| `variation.ts` | N1, N2 |
| `flanks.ts` | F1, F2 |
| `gridLines.ts` | L1 |
| `geometry.ts` | E1-E4 |
| `figureShapes.ts` | H1-H10 |
| `testMode.ts` | T2, T3, T5, T6 |

Survivors, accepted as equivalent or harmless:
- **G3** `regions.ts:52`, `p.x <` → `>`: a leftward ray gives the same even-odd parity.
- **N3** `variation.ts:8`, the final avalanche dropped: the spec asks only for determinism, range and distinctness.
- **T1** `testMode.ts:203-204`, the `canEnterTerrain` guard removed: on today's map it never fires, and the test asserts the outcome.
- **T4** `testMode.ts:204`, `typeId === 'galeres'` → `false`: this only narrows galleys to sea hexes.

e2e mutants, survived (the MEDIUM finding):
- **X1** `MapView.ts:162`, the replay deleted.
- **X2** `MapView.ts:167`, the UI-camera ignore deleted.

## Not checked
- **The look itself** (B5, B6, B9, B10): the landscape, figure recognisability, base distinctness in greyscale and badge legibility. In the gallery, adjacent badges overlap at the default zoom. This is the owner's live check.
- **Pan and zoom smoothness on real hardware.** Headless frame times are vsync-capped and can't tell the two views apart.
- **The other Drawn overlays, live:** choice labels, range labels, the drift arrow and swap rings. They are wired and listed in `mapObjects()`, and the probe saw fills, rings and the movement label replayed.
- **A toggle during a prompt, a drift pause or a computer turn** (B2).
- **Placement in Drawn** beyond reading the code. The facing gap was found by reading.
- **`main`'s before-count** (1223 tests): derived from the diff, not run.
- **Soft-edge strokes:** whether they ever tint a neighbour's centre. Region outlines were checked, pixels weren't.

## Live check
- **Owed** by rule 1 (`src/scenes/**`, `src/ui/**`), and new and visual (AC4-AC6), so the smoke suite can't stand in. Run it after the rework, since the HIGH finding changes Placement.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/64-vector-view`, run:
  - PowerShell: `$env:HERAKLIOS_SAVES_DIR = (New-Item -ItemType Directory -Force "$env:TEMP\h64-saves").FullName; npm run dev -- --port 5264 --strictPort --host 127.0.0.1`
  - Git Bash: `HERAKLIOS_SAVES_DIR=$(mktemp -d) npm run dev -- --port 5264 --strictPort --host 127.0.0.1`

  Then open http://127.0.0.1:5264/.
- **Steps:**
  1. **Combat test mode,** then **🗺 Drawn view** (bottom left, right of **✕ Abandon game**). You should see:
     - a smooth coastline with shallow water;
     - pale beach on `coast` hexes;
     - four distinct bay tints, each named in the tooltip;
     - meandering rivers, and broad water for the wide river;
     - relief on plateaus and hatched outward flanks;
     - marsh pools and reeds, and grass with light variation;
     - a thin grid.
  2. **Zoom fully out and in, and drag,** comparing with **🗺 Standard view**:
     - the grid stays faintly visible at the minimum zoom;
     - the landscape is acceptably sharp at the maximum zoom;
     - panning is as smooth as Standard;
     - no second, unzoomed copy of anything appears.
  3. **In Drawn,** select, move, attack and Undo; select a ship and turn it; answer a retreat or advance if one comes; watch the drift arrow if you reach one. Every overlay should be legible, a turned galley should rotate, and the badges should show the counter numbers. Say whether overlapping badges on adjacent units are acceptable.
  4. **Toggle at awkward moments:** with a unit selected, with a prompt open, and during a computer seat's turn. Only the look should change.
  5. **The gallery:** **Figure gallery (dev)** on the Menu shows 14 types × 4 owners. Each type should be recognisable, and the round, square, diamond and shield bases should stay distinct under DevTools → Rendering → Achromatopsia.
  6. **Placement:** go through the army builder to Placement. The toggle should sit above **Undo**.
     - Switch to Drawn, place a land unit, stage a ship, use Turn, confirm and Undo.
     - The zones should be tinted and placement should land where you click.
     - The staged ship and its facing should be visible and follow Turn, and placed ships should point their chosen way (the HIGH finding's fix).
  7. **Reload (F5)** and start test mode again: the board should open in Drawn.

## Verified myself vs. taken on trust

**Coordinator, re-run.** Worktree at `3e26fff`; `git status --short` clean before and after.

| Check | Result | Matches |
| --- | --- | --- |
| `npm run verify` | exit 0; `21 problems (0 errors, 21 warnings)`; 77 files, 1277 tests | yes |
| `npm run check:intent` | PASS; 39 files, 2337 lines | yes |
| `npm run e2e` | 19 passed (37.8 s) | yes |
| G3, full vitest | survived (1277 passed) | yes |
| N3, full vitest | survived (1277 passed) | yes |
| T1, full vitest | survived (1277 passed) | yes |
| T4, full vitest | survived (1277 passed) | yes |
| X1, full e2e | survived (19 passed) | yes |
| X2, full e2e | survived (19 passed) | yes |

Each mutant was backed up and restored by copy, with a non-empty `git diff` checked before each run.

**Reviewer agent** (same worktree and HEAD):
- verify, check:intent and e2e as above. The e2e global setup's production-bundle check passed. `__heraklios` and the gallery body (`"no free hex"`) appear 0 times in `dist/assets/*.js`.
- **Scope:** no change to `src/engine`, `src/data`, `standardBoardView.ts`, `saveGame.ts`, `saveStorage.ts`, `package.json` or `eslint.config.js`. The i18n keys are in both `en.ts` and `fr.ts`. The dev-hook additions are getters only.
- **Bundle:** 1,366.81 kB before, from `main` `d483ec7` built with vite 8.3.4 in a scratch folder; 1,387.33 kB after.
- **Browser probe:** a scratch server on 5277 with a scratch saves folder, stopped afterwards. In Drawn:
  - 0 world objects reach the HUD camera, and only the hit `Zone` is interactive;
  - 10 containers for 10 units;
  - fills, rings and the movement label are replayed;
  - the landscape is a 2884×2362 RenderTexture at scale 0.5;
  - swaps took 57.7 ms and 35.9 ms, bake included;
  - `landscapeBuilds` was 2 after two toggles, so pan and zoom don't re-bake.

  Standard was identical before and after a toggle: 1307 objects, with the known empty drift-arrow leak. The gallery showed 56 units and no page errors.
- **Scratch measurement:** every smoothed region keeps all 1290 centres on the right side, and the walled-in flanks are exactly `30,-2` and `32,-2`.
- **Phaser source:** `RenderTexture.preDestroy` frees its texture, and `DisplayList.addChildCallback` queues a sort.
- `npm run sdlc:scan -- --sample-due auto --exclude 64`: nth attested auto change = 5, every 3, `sampled: no`.

**Taken on trust:**
- the Progress reasons for the bay tints and oar tones (aesthetic);
- the plan's line citations beyond those used above;
- that the 18 unchanged e2e scenarios cover Standard for AC8.
