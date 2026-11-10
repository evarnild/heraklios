<!-- generated-by: heraklios/review@0.2.0 -->
# §67 review — The elephant drift arrow is drawn once, by the map camera only

verdict: rework
tier: attested
reviewed-commit: 11b7f26
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, set by the path table (`src/ui/**`, `e2e/**`). No `review_tier` is set, and no finding raises the tier.

**Verdict:** `rework`, with 1 MEDIUM ("Needs decision:") and 1 LOW ("Worth a look"). The auto run stops for the owner.
- The fix is right. With `main`'s `standardBoardView.ts`, the new e2e fails with exactly the depth-12 Graphics stray; with the fix, every one of the 1,347 objects on the Board's display list is skipped by exactly one camera.
- The new reader itself is not held by any test: three wiring mutants survive.

**How this round ran:**
- The `heraklios-reviewer` agent ran the ten passes and 12 mutants.
- The coordinator re-ran verify, check:intent, the full e2e suite and the three survivors. Every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The diff is subtasks 1–4, with no unplanned scope |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: presentation only, no rule behaviour changed |
| 4 | Tests prove it | findings (1): W3, W4 and W5 survive |
| 5 | Boundary and conventions | pass. The rule is a pure tested function in `src/ui/`, `MapView` applies it, and the dev hook only reads |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass. Behaviour stays as README describes it (one drift arrow, README:543) |
| 8 | Guardrails and hygiene | pass: lint 21, cap 21, no new dependency |
| 9 | Repository-specific footguns | pass. No `src/engine` change, so headless play is unaffected |
| 10 | Architecture | pass. `drawnInspect().hudLeaks` is a different check (the listed objects only, HUD bit only), so it does not duplicate the new one |

**"Rendered by both cameras", checked against Phaser 3.90.0:**
- `BaseCamera.ignore` (`BaseCamera.js:901-929`) sets `cameraFilter |= camera.id`.
- `GameObject.willRender` (`GameObject.js:632`) skips an object when its filter has the camera's bit.
- So the helper's test `(f & mainId) === 0 && (f & uiId) === 0` means exactly "both cameras render it".
- **Containers:** only the Drawn view's unit figures use one. Checking the top-level Container is enough, because its children are skipped with it.
- **Invisible objects:** visibility is ignored, which errs on the safe side. The empty drift arrow is checked even without a drift.

## Type check
```
type-check: PASS (intent 67, fix)
  note:  6 file(s), 101 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `e2e/hud-strays.spec.ts:16,21`, `src/ui/MapView.ts:187`, `src/ui/devHook.ts:257`: the e2e checks only that `hudStrays()` is `[]`. Nothing checks that the reader examined anything.
  - **The survivors** (each passes `hud-strays.spec.ts` and the full e2e suite):
    - W3: `MapView.cameraStrays` passes an empty list;
    - W4: it passes `this.boardView.mapObjects()` instead of `scene.children.list`. That is the "wrong list" failure the plan's Risk 1 names, and it would miss the original bug too;
    - W5: `hudStrays: () => []`.
  - **Why it matters:** the failing-first run proves the reader worked at `11b7f26`, but no test keeps it working. A later refactor could silently disable the guard. The plan's Tests section expected the empty-list mutant to be caught only "on main's code".
  - **Needs decision:**
    - (a) Add a positive control. For example, `hudStrays()` (or a sibling reader) also reports how many display-list objects it examined. The e2e then asserts that this is more than the view's `mapObjects().length`, or that it includes a known HUD-only object. This amends the plan's Tests section and the dev-hook shape. Expected kills: W3, W4, W5.
    - (b) Accept as is and record it here.
- **LOW** `plan.md`, Tests section, above Progress: the plan says flipping `===` to `!==` on either bit makes "the 'neither' and 'both' cases fail". Measured, the "both" case fails for neither mutant. Both mutants are still killed, by other cases. Worth a look; the prediction is stale.

## Not checked
- **A real drift:** no test or run drove one. That the arrow appears once and moves with the map is inferred from the camera filter (the arrow's `cameraFilter` is the HUD camera's id). That is the live check.
- **Placement:** it also pins a `StandardBoardView`, so it gets the fix, but `hud-strays` runs on the Board only.
- **Objects made during prompts or drifts:** `hudStrays()` is never called while a retreat, push, advance or exchange prompt, or an attack report, is open.
- **The Drawn view after its own selections, labels and drift overlays,** and a view swapped back to Standard: there is one check per view.
- **Screen-level rendering:** no screenshot was taken.

## Live check
- **owed:** rule 1 (`src/ui/`), plus the Not-checked item "a real drift".
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/67-drift-arrow-hud-camera`, run `npm run dev -- --port 5267 --strictPort --host 127.0.0.1` and open http://127.0.0.1:5267/.
  2. Menu → "Combat test mode (units face to face, 2 hexes)". Both seats are human. The elephants stand at (17,3) and (17,5).
  3. Pan and zoom the map well away from where it started.
  4. With the first player, move the elephant onto (17,4).
  5. In combat, attack the enemy elephant with that elephant alone. 8 against 5 is the 1-1 column, where every result is a retreat. An elephant drifts instead of retreating, so **every such attack starts a drift**, and it pauses with "▶ Continue".
  6. Before pressing Continue, pan and zoom again.
- **you should see:** one arrowhead, on the drifting elephant's hex, panning and scaling with the map. No second arrowhead appears over the left panel or anywhere else. Optionally, repeat in the Drawn view.
- **fallback:** if the second player moves first, use their elephant at (17,5). Test mode lets you Undo and retry.

## Verified myself vs. taken on trust
- **Coordinator, re-run (worktree at `11b7f26`):**
  - `npm run verify`: exit 0; 81 test files, 1418 tests passed; 0 errors, 21 warnings, cap 21.
  - `npm run check:intent`: exit 0, PASS (output above).
  - `npm run e2e`: exit 0, 23 passed. Port 5232 was free beforehand.
  - **W3**, the empty list in `MapView.cameraStrays`, against `hud-strays.spec.ts`: SURVIVED (1 passed). It matches the reviewer.
  - **W4**, `boardView.mapObjects()` in place of `scene.children.list`: SURVIVED (1 passed). It matches.
  - **W5**, `hudStrays: () => []`: SURVIVED (1 passed). It matches.
  - Each mutant was backed up by copy, its change asserted with `git diff`, and the file restored by copy. `git status --short` was clean after each.
  - `npm run sdlc:scan -- --sample-due auto --exclude 67`: "nth attested auto change = 7, every 3, sampled: no".
- **Reviewer:**
  - **Failing-first:** with `main`'s `standardBoardView.ts`, `hud-strays.spec.ts` fails with `[{ depth: 12, type: "Graphics" }]`.
  - **Inventory probe:** of 1,347 display-list objects, 1,305 are world objects (`cameraFilter` 2) and 42 are HUD objects (`cameraFilter` 1). None is rendered by both cameras, and none by neither. A label made after the pin was present.
  - **Mutants killed:**
    - U1–U7, the helper, against the full vitest suite;
    - W1, the arrow left out of `mapObjects()`;
    - W2, the main camera's id passed as the HUD id.
  - The Phaser source read cited above.
- **Taken on trust:**
  - "no stray in the Drawn view", from the passing spec;
  - the Progress claim that the Drawn view had no stray on `main`.
