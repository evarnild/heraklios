<!-- generated-by: heraklios/review@0.1.5 -->
# §64 review — A second board view, a drawn 2D landscape with unit figures

verdict: escalate
tier: reviewed
reviewed-commit: 2f769c1
round: 3
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed. Round 1's HIGH set it, and a tier is never lowered. On its own, the path table gives Attested (`src/ui/**`, `src/scenes/**`, `e2e/**`).

**Verdict:** `escalate`. No finding needs rework, and all three round-2 findings are resolved. The tier is Reviewed, so the owner reads the diff, runs the live check and records `live_checked:`, then `/ship 64`. The passes were run by the `heraklios-reviewer` agent. The coordinator re-ran verify, check:intent, e2e and every mutant the rework claims to kill, and every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. `c5e3811` touches only `e2e/board-view.spec.ts`, `src/ui/MapView.ts` (a type), `src/ui/devHook.ts`, `src/ui/drawnBoardView.ts` (a type) and `src/ui/drawnUnits.ts`, which is exactly the round-2 rework. `10b536d` appends to Progress only |
| 2 | Type check | FAIL, but the only error is the owed live check, which the owner clears |
| 3 | Rulebook fidelity | not applicable: digital-only, and nothing in `src/engine`, `src/data` or the save format changes |
| 4 | Tests prove it | pass: 15 mutants this round, 15 killed |
| 5 | Boundary and conventions | pass. The new code is dev-hook readers and a container `name` only |
| 6 | Numbers in prose | pass. The round-2 Progress claims reproduce. Nit: Progress gives "see `git log`" instead of `c5e3811` |
| 7 | Documentation | pass. `README.md:518-546` covers the Placement ghost and placed-galley facing |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21, cap unchanged, no new dependency, `eslint-disable`, `innerHTML` or `eval` |
| 9 | Repository-specific footguns | pass. No drift or engine change, and headless and AI play are untouched |

## Type check
```
type-check: FAIL (intent 64, feature)
  error: A live check is owed and not recorded. Do the steps in intents/64-vector-view/review.md → ## Live check, then set live_checked: <date> in intents/64-vector-view/metadata.yml.
  note:  42 file(s), 2565 line(s) changed outside intents/.
```
The owed live check is the only error, and the owner clears it, so it isn't rework. The line count is up 38 from round 2's 2527, which matches `c5e3811`'s +47/−9.

## Findings
None need rework. One nit: the round-2 Progress entry names no commit hash.

Round 2's findings are resolved:
- **MEDIUM, placed-galley facing (S2, S3):** `board-view.spec.ts:163` checks the ship is drawn at the ghost's rotation `r1`, and `:165` checks a land unit is drawn upright.
- **MEDIUM, ghost lifecycle (U1, U4, RG):** `:143` checks one ghost after a Turn. `:147` checks none on Standard. `:149-150` check the ghost is back at `r1` after toggling to Drawn. `:156` checks none after Confirm.
- **LOW, Progress toggle claim:** proven now that RG is killed.

## Mutants (pass 4)
Every mutant was killed by the e2e suite. The vitest suite imports none of these files, so e2e is the only suite that can catch them.

| Mutant | Target | Killed by |
| --- | --- | --- |
| S2 | `PlacementScene.ts:335` naval facing → `undefined` | `board-view.spec.ts:163` (expected −0.5236, got 0) |
| S3 | `PlacementScene.ts:335` → `facing: u.facing,` | `:165` (expected 0, got 0.5236) |
| U1 | `drawnUnits.ts:78` `this.ghost?.destroy();` deleted | `:143` (expected 1, got 2) |
| U4 | `drawnUnits.ts` `destroy()`: `this.setGhost(null);` deleted | `:147` (expected 0, got 1) |
| RG | `viewDrawingState.ts:102`, replay strips `ghostTypeId` | `:149` (expected 1, got 0); vitest survives at 1279 |
| X1 | `MapView.ts:162` `this.drawing.replay(next);` deleted | `:41` and `:103` |
| X2 | `MapView.ts:167` `this.uiCamera?.ignore(next.mapObjects());` deleted | `:41` and `:103` (hudLeaks 4) |
| N1 | `drawnUnits.ts:128` `.setName(unit.id)` dropped | `:143` (expected 1, got 0). A missing name can't false-green |
| N2 | `drawnUnits.ts:128` → `.setName('unit')` | `:143` |
| H1 | `devHook.ts` ghost filter `===` → `!==` | `:143` (expected 1, got 62) |
| H2 | `devHook.ts` count `* 0` | `:143` |
| H3 | `devHook.ts` `ghosts: 1` constant | `:147` |
| R1 | `unitRotations` reads `list[0]`, the base | `:163` |
| R2 | `unitRotations` reads the container's rotation | `:163` |
| R3 | `unitRotations` loop over an empty map | `:163` (undefined) |

`c5e3811`'s changes to `MapView.ts` and `drawnBoardView.ts` only widen return types, so there is nothing there to mutate.

The accepted survivors are unchanged: D2, U2 and U3 from round 2, and G3, N3, T1 and T4 from round 1, all on lines untouched since.

## Not checked
- **The look:** the landscape, figures, greyscale bases, overlapping badges, sharpness at the maximum zoom, pan and zoom smoothness, the ghost's translucency, and placed galleys' orientation on screen. This is the owner's live check.
- **Cancel and Undo while a ship is staged in Drawn:** checked by reading only.
- **A toggle during a Board prompt, a drift pause or a computer turn (B2):** still untested by e2e.
- **The 1× bake fallback:** dead under `Phaser.CANVAS`.
- **The `save-load.spec.ts:57` flake:** it failed in 3 of the reviewer's 16 runs and in none of the coordinator's 8. It's pre-existing and was not investigated.
- **The rebase:** `main` is ahead by §61 and §69 artefact commits (merge base `d483ec7`). A rebase is due before the ship. Per "Merging", that needs a new review only if it changes the reviewed code.

## Live check
- **Owed** by rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and visual (AC4-AC6), so the smoke suite can't stand in. The steps are round 2's, unchanged.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/64-vector-view`:
  - PowerShell: `$env:HERAKLIOS_SAVES_DIR = (New-Item -ItemType Directory -Force "$env:TEMP\h64-saves").FullName; npm run dev -- --port 5264 --strictPort --host 127.0.0.1`
  - Git Bash: `HERAKLIOS_SAVES_DIR=$(mktemp -d) npm run dev -- --port 5264 --strictPort --host 127.0.0.1`

  Then open http://127.0.0.1:5264/.
- **Steps:**
  1. **Combat test mode,** then **🗺 Drawn view** (bottom left, right of **✕ Abandon game**). You should see:
     - a smooth coastline with shallow water;
     - a pale shore on `coast` hexes;
     - four distinct bay tints, named in the tooltip;
     - meandering rivers, and broad water for the wide river;
     - relief on plateaus and hatched outward flanks;
     - marsh pools and reeds;
     - grass with light variation;
     - a thin grid.
  2. **Zoom fully out and in, and drag,** comparing with **🗺 Standard view**:
     - the grid stays faint at the minimum zoom;
     - the landscape is acceptably sharp at the maximum zoom;
     - panning is as smooth as in Standard;
     - no second, unzoomed copy of anything appears.
  3. **In Drawn,** select, move, attack and Undo; turn a ship; answer a retreat or advance if one comes; watch a drift arrow if you reach one. You should see:
     - every overlay legible;
     - a turned galley rotating;
     - the badges showing the counter numbers.

     Say whether overlapping badges on adjacent units are acceptable.
  4. **Toggle at awkward moments:** with a unit selected, with a prompt open, and during a computer seat's turn. Only the look should change.
  5. **The gallery:** **Figure gallery (dev)** on the Menu shows 14 types × 4 owners.
     - Each type is recognisable.
     - The round, square, diamond and shield bases stay distinct under DevTools → Rendering → Emulate vision deficiencies → Achromatopsia.
  6. **Placement, the ghost.** From the Menu, pick **2** players, then **Use default army** and **Confirm army** for both seats. In Placement, click **🗺 Drawn view** (above **Undo**).
     1. Place the land units on tinted zone hexes. Each lands where clicked.
     2. When a ship comes up, click a sea hex in the zone. A translucent galley appears.
     3. Press each **Turn** button a few times. It turns 60° per press, and only one ghost is ever visible.
     4. With the ship staged, click **🗺 Standard view**. You should see no translucent galley, only the facing arrow.
     5. Switch back to Drawn. The ghost is back, at the same facing.
     6. Press **Confirm facing**. The ghost goes, and a solid galley stays, pointing the same way. Land figures stay upright.
     7. Stage another ship and press **Cancel**. The ghost goes, and nothing is placed.
     8. Press **Undo** once. The last placement is removed, and nothing stale remains.
  7. **Reload (F5)** and start test mode again. The board opens in Drawn.

## Verified myself vs. taken on trust
- **Coordinator, re-run,** in `C:/Users/eric/src/heraklios-wt/64-vector-view` at `2f769c1`, with each heavy command run one at a time:
  - `npm run verify`: exit 0. Lint shows 21 problems (0 errors, 21 warnings). Vitest shows 77 files and 1279 tests passed. This matches the reviewer and the implementer.
  - `npm run check:intent`: FAIL on the owed live check only, with 42 files and 2565 lines. This matches.
  - `npm run e2e`: 20 passed. This matches.
- **Coordinator, re-run, the mutants the rework claims to kill.** Each was backed up by copy, applied as an exact single-match replace, run with the full e2e suite, and restored by copy:

  | Mutant | Killed by |
  | --- | --- |
  | S2 | `board-view.spec.ts:163` |
  | S3 | `:165` |
  | U1 | `:143` |
  | U4 | `:147` |
  | RG | `:149` (vitest survives at 1279) |
  | X1 | `:41` and `:103` |
  | X2 | `:41` and `:103` |

  All 7 match the reviewer's results and assertions. `git status --short` was clean at the end.
- **The reviewer:**
  - verify, check:intent and e2e, with the counts above;
  - 15 mutant e2e runs and 1 vitest run, including the eight new N, H and R mutants and the false-green probes;
  - `npm run sdlc:scan -- --sample-due auto --exclude 64` printed "nth attested auto change = 5, every 3, sampled: no".
- **Taken on trust:**
  - the reviewer's N1, N2, H1-H3 and R1-R3 runs (killed, not re-run by the coordinator);
  - round 2's B1-B4, S1, D1, L1 and L2;
  - round 1's vitest mutants, browser probe, bundle sizes and Phaser readings.

# Round 2 (history)

# §64 review — A second board view, a drawn 2D landscape with unit figures

verdict: rework
tier: reviewed
reviewed-commit: bdc9160
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed. Round 1 set it, and a tier is never lowered. The path table alone gives Attested (`src/ui/**`, `src/scenes/**`, `e2e/**`), and the metadata sets no `review_tier`.

**Verdict:** `rework`. The round-1 HIGH is resolved as the owner decided, option (b). X1 and X2 are now killed. This round has 2 MEDIUM and 1 LOW, all "Needs rework:".
- The e2e step added for the HIGH proves the ghost appears and turns.
- It doesn't prove that placed galleys keep their facing: S2 and S3 survive.
- It doesn't prove the ghost goes away when it should: U1, U4 and RG survive.
- By reading, the code itself is correct.

The `heraklios-reviewer` agent ran the passes. The coordinator re-ran verify, check:intent, e2e and every listed mutant, and every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The rework does option (b) and nothing more. The ghost rides `setFacingIndicators`, so the `BoardView` method set is unchanged. `boardObjects().ghostRotation` goes beyond the finding, and Progress records it |
| 2 | Type check | FAIL, but its only error is the owed live check, which the owner clears |
| 3 | Rulebook fidelity | not applicable: digital-only, and nothing in `src/engine`, `src/data` or the save format changes |
| 4 | Tests prove it | findings (2): S2 and S3 survive; U1, U4 and RG survive. X1, X2, S1, D1, B1-B4, L1 and L2 are killed |
| 5 | Boundary and conventions | pass. `ghostDrawing` is pure and tested, and Phaser only draws. No `GameState`, history or save change |
| 6 | Numbers in prose | findings (1, LOW): Progress says a toggle mid-staging keeps the ghost, and that is unproven (RG survives). Every count reproduces |
| 7 | Documentation | pass. `README.md:543-546` describes Placement. The bake comment is fixed at `paintLandscape.ts:31-36` |
| 8 | Guardrails and hygiene | pass. Lint is 21 of 21, and `package.json` and `eslint.config.js` are untouched. No new dependency, no `innerHTML` or `eval` |
| 9 | Repository-specific footguns | pass. No drift or engine change, and headless and AI play are untouched |

## Type check
```
type-check: FAIL (intent 64, feature)
  error: A live check is owed and not recorded. Do the steps in intents/64-vector-view/review.md → ## Live check, then set live_checked: <date> in intents/64-vector-view/metadata.yml.
  note:  42 file(s), 2527 line(s) changed outside intents/.
```
That is the only error. It's the owed live check, which the owner records, so it isn't rework.

## Findings
- **MEDIUM**, `src/scenes/PlacementScene.ts:335`: the HIGH fix's other half, "placed galleys point their chosen way", is unproven.
  - Mutant S2 (`? u.facing : undefined` → `? undefined : undefined`) survives the full e2e suite.
  - So does S3, which passes `u.facing` for every unit and so would tilt land figures.
  - `boardObjects()` exposes no placed unit's rotation.
  - **Needs rework:**
    - add the placed figures' rotations to the dev-only reader, for example `unitRotations: Record<id, number>` from `DrawnUnits`;
    - in `board-view.spec.ts`, after "Confirm facing", assert that the new ship's figure rotation equals the ghost's last rotation (`r1`), and that a land unit's rotation is 0.
    - This kills S2 and S3.
- **MEDIUM**, `src/ui/drawnUnits.ts:78`, `:131` and `src/ui/viewDrawingState.ts:102`: the ghost's lifecycle is unproven. Three mutants survive:
  - **U1**, `this.ghost?.destroy();` deleted: stale ghosts pile up on every Turn.
  - **U4**, `this.setGhost(null);` deleted from `destroy()`: a Drawn ghost is left on the Standard board.
  - **RG**, the recorder's replay drops `ghostTypeId`: a toggle mid-staging loses the ghost. It also survives vitest.

  The reader can't see any of them. `inspect()` reads only the view's own reference, `drawnInspect()` returns null in Standard, and no scenario toggles while a ship is staged.
  - **Needs rework:** count ghost containers on the scene's display list instead, for example a `name` such as `GHOST_SHIP_ID` counted in `mapScene().children`, working in both views. In the Placement scenario, assert:
    - 1 ghost after the Turn;
    - 0 ghosts after toggling to Standard with the ship staged;
    - 1 ghost at rotation `r1` after toggling back to Drawn;
    - 0 ghosts after Confirm.

    This kills U1, U4 and RG.
- **LOW**, `intents/64-vector-view/plan.md` (Progress, the round-1 rework's HIGH bullet): "the recorder replays the entry, so a toggle mid-staging keeps the ghost" is stated as shipped but untested, since RG survives both suites. **Needs rework:** the e2e step above proves it. Otherwise, mark the claim as untested in Progress.

## Mutants (pass 4)
The reviewer applied each mutant as an exact-string replace with exactly one match, checked for a non-empty `git diff`, ran the full suite, then restored from a copy and checked for an empty `git diff`.

| Mutant | Target | Result | Killed by |
| --- | --- | --- | --- |
| B1 | `boardView.ts` `ghostDrawing`, find → `() => true` | killed (vitest) | `boardView.test.ts` › ghostDrawing |
| B2 | `facing: g.facing` → `0` | killed (vitest) | `boardView.test.ts` › "draws the staged ship… pending facing" |
| B3 | `owner: g.playerIndex` → `0` | killed (vitest) | same |
| B4 | `if (!g) return null` returns a drawing | killed (vitest) | `boardView.test.ts` › "is null when no ship is staged" |
| X1 | `MapView.ts:162` `this.drawing.replay(next);` deleted | killed (e2e) | `board-view.spec.ts:41` |
| X2 | `MapView.ts:167` `this.uiCamera?.ignore(next.mapObjects());` deleted | killed (e2e) | `board-view.spec.ts:41` and `:103` |
| S1 | `PlacementScene.ts:483` `ghostTypeId: typeId` dropped | killed (e2e) | `board-view.spec.ts:103` |
| D1 | `drawnBoardView.ts:69` `setGhost(…)` → `setGhost(null)` | killed (e2e) | `board-view.spec.ts:103` |
| L1 | probe: ghost not ignored by the UI camera | killed (e2e) | `board-view.spec.ts:103` (hudLeaks 1), so `hudLeaks` doesn't false-green |
| L2 | probe: `drawnUnits.ts:126` `ignoreOnUiCamera(container)` deleted | killed (e2e) | `board-view.spec.ts:103` |
| S2 | `PlacementScene.ts:335`, naval facing → `undefined` | **survived** | (MEDIUM 1) |
| S3 | `PlacementScene.ts:335`, `u.facing` for all units | **survived** | (MEDIUM 1) |
| U1 | `drawnUnits.ts:78`, the ghost's destroy dropped | **survived** | (MEDIUM 2) |
| U4 | `drawnUnits.ts:131`, `setGhost(null)` dropped | **survived** | (MEDIUM 2) |
| RG | `viewDrawingState.ts:102`, replay strips `ghostTypeId` | **survived** both suites | (MEDIUM 2) |
| D2 | `drawnBoardView.ts:73` `clearFacingIndicators` emptied | survived, accepted | equivalent: no scene calls it, and replay calls it only on a fresh view |
| U2 | `drawnUnits.ts:79` `.setAlpha(GHOST_ALPHA)` dropped | survived, accepted | visual only, covered by the live check |
| U3 | `drawnUnits.ts:73` `objects()` omits the ghost | survived, accepted | equivalent today. Keep the ghost in `objects()`, since U3 together with L1 would blind `hudLeaks` |

Round-1 accepted survivors G3, N3, T1 and T4: their files are byte-identical between 3e26fff and HEAD, so their status is unchanged.

## Not checked
- **The look:** the ghost's translucency, the placed galleys' orientation on screen, and all of round 1's visual items: landscape, figures, greyscale bases, overlapping badges, sharpness at maximum zoom, pan and zoom smoothness. This is the owner's live check. No browser was driven this round.
- **Cancel and Undo while a ship is staged, in Drawn:** checked by reading only.
- **The `save-load.spec.ts:57` flake:** it failed in 2 of about 18 reviewer e2e runs and in 2 of 10 coordinator runs (S2, RG), each time on a Standard-view path that no mutant touches. It's pre-existing (§33, §48) and wasn't investigated.
- **A toggle during a prompt, a drift pause or a computer turn** (B2): still untested by e2e.
- **`main` has moved ahead by four §61 artefact commits.** A rebase is due before ship. It isn't a code concern.

## Live check
- **Owed** by rule 1 (`src/scenes/**`, `src/ui/**`). The change is new and visual (AC4-AC6), so the smoke suite can't stand in for it. Run it after this round's rework.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/64-vector-view`, run:
  - PowerShell: `$env:HERAKLIOS_SAVES_DIR = (New-Item -ItemType Directory -Force "$env:TEMP\h64-saves").FullName; npm run dev -- --port 5264 --strictPort --host 127.0.0.1`
  - Git Bash: `HERAKLIOS_SAVES_DIR=$(mktemp -d) npm run dev -- --port 5264 --strictPort --host 127.0.0.1`

  Then open http://127.0.0.1:5264/.
- **Steps:**
  1. **Combat test mode,** then **🗺 Drawn view** (bottom left, right of **✕ Abandon game**). You should see:
     - a smooth coastline with shallow water;
     - a pale shore on `coast` hexes;
     - four distinct bay tints, named in the tooltip;
     - meandering rivers, and broad water for the wide river;
     - relief on plateaus and hatched outward flanks;
     - marsh pools and reeds, and grass with light variation;
     - a thin grid.
  2. **Zoom fully out and in, and drag,** comparing with **🗺 Standard view**:
     - the grid stays faint at the minimum zoom;
     - the landscape is acceptably sharp at the maximum zoom;
     - panning is as smooth as Standard;
     - no second, unzoomed copy of anything appears.
  3. **In Drawn,** select, move, attack and Undo; turn a ship; answer a retreat or advance if one comes; watch a drift arrow if you reach one.
     - Every overlay is legible.
     - A turned galley rotates.
     - The badges show the counter numbers.
     - Say whether overlapping badges on adjacent units are acceptable.
  4. **Toggle at awkward moments:** with a unit selected, with a prompt open, and during a computer seat's turn. Only the look should change.
  5. **The gallery:** **Figure gallery (dev)** on the Menu shows 14 types × 4 owners.
     - Each type is recognisable.
     - The round, square, diamond and shield bases stay distinct under DevTools → Rendering → Emulate vision deficiencies → Achromatopsia.
  6. **Placement, the ghost.** From the Menu: **2** players, then **Use default army** and **Confirm army** for both seats. In Placement, click **🗺 Drawn view** (above **Undo**).
     1. Place the land units on tinted zone hexes. Each lands where clicked.
     2. When a ship comes up, click a sea hex in the zone. A **translucent galley** appears.
     3. Press each **Turn** button a few times. The galley turns 60° per press, and only one ghost is ever visible.
     4. With the ship staged, click **🗺 Standard view**. You should see no translucent galley, only the facing arrow.
     5. Switch back to Drawn. The ghost is back, at the same facing.
     6. Press **Confirm facing**. The ghost goes, and a solid galley stays, pointing the same way.
     7. Stage another ship and press **Cancel**. The ghost goes, and nothing is placed.
     8. Press **Undo** once. The last placement is removed, and nothing stale remains.
  7. **Reload (F5)** and start test mode again. The board opens in Drawn.

## Verified myself vs. taken on trust
- **Coordinator, re-run**, in `C:/Users/eric/src/heraklios-wt/64-vector-view`. The code was at `bdc9160`; HEAD has only metadata commits after it.
  - `npm run verify`: exit 0. Lint shows 21 problems (0 errors, 21 warnings). Vitest shows 77 files and 1279 tests passed. This matches the reviewer and the implementer.
  - `npm run check:intent`: FAIL on the owed live check only, with 42 files and 2527 lines (output above). This matches.
  - `npm run e2e`: 20 passed. This matches.
- **Coordinator, re-run, mutants.** Each was backed up by copy, applied as an exact-string replace (one match, non-empty diff checked), run with the full e2e suite, and restored by copy (empty diff checked).

  | Mutant | Coordinator result | Matches the reviewer? |
  | --- | --- | --- |
  | S2 | first run: 1 failed, `save-load.spec.ts:57` only, the known flake. Clean re-run: 20 passed, so survived | yes |
  | S3 | 20 passed, survived | yes |
  | U1 | 20 passed, survived | yes |
  | U4 | 20 passed, survived | yes |
  | RG | vitest 1279 passed. e2e first run failed on the `save-load.spec.ts:57` flake only; clean re-run: 20 passed. Survived both suites | yes |
  | X1 | killed by `board-view.spec.ts:41` (19 passed, 1 failed) | yes |
  | X2 | killed by `board-view.spec.ts:41` and `:103` (18 passed, 2 failed) | yes |

  `git status --short` was clean at the end.
- **The reviewer, its own runs:**
  - verify, check:intent and e2e, with the counts above;
  - 19 mutant runs plus 1 re-run;
  - the main-baseline count: 67 files and 1223 tests, from `git ls-tree` and `it(`/`test(` line counts;
  - `npm run sdlc:scan -- --sample-due auto --exclude 64`: sampled: no;
  - by reading, that Standard Placement ignores `ghostTypeId` and `facing`.
- **Taken on trust:**
  - the reviewer's B1-B4, S1, D1, L1, L2, D2, U2 and U3 runs, which the coordinator didn't re-run because they're killed or accepted rather than survivors the rework must kill;
  - round 1's browser probe, bundle sizes and Phaser source readings.

The coordinator's mutant-line citation for X1 is `MapView.ts:162`, where the reviewer had `:164`. It's the same statement, and the outcome isn't affected.

# Round 1 (history)

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
