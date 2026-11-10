<!-- generated-by: heraklios/review@0.2.0 -->
# §67 review — The elephant drift arrow is drawn once, by the map camera only

verdict: attest
tier: attested
reviewed-commit: 08ffabb
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Attested, set by the path table (`src/ui/**`, `e2e/**`). No `review_tier` is set, and no finding raises the tier.

**Verdict:** `attest`. No finding needs rework.
- Round 1's MEDIUM is resolved by the owner's option (a) ("/auto 67 a").
  - `hudStrays()` now returns `{ examined, hudOnly, strays }` from a pure `scanCameras` in `src/ui/cameraStrays.ts`.
  - The e2e asserts all three, in both views.
  - W3, W4 and W5 now fail on "Standard view: HUD objects seen".
- There are 2 LOW findings ("Worth a look").
- The live check is still owed, and it is the owner's to clear.

**How this round ran:**
- The `heraklios-reviewer` agent ran the ten passes and 13 mutants.
- The coordinator re-ran verify, check:intent, the full e2e suite, the three mutants the rework claims to kill, and the one survivor. Every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The rework is the minimum for option (a): one pure function and its type, a changed return type passed through `MapView` and `devHook`, two unit tests and one e2e helper |
| 2 | Type check | pass. FAIL only on the owed live check (below) |
| 3 | Rulebook fidelity | not run: presentation only, no rule behaviour changed |
| 4 | Tests prove it | pass. All 7 `scanCameras` mutants are killed by the full vitest suite. W1, W3, W4, W5 and W6 are killed by the e2e. W7 survives, but it is equivalent for the stray check (LOW 1) |
| 5 | Boundary and conventions | pass. `scanCameras` is pure and unit-tested, `MapView` applies it, and `devHook.hudStrays` only reads. No `GameState`, save or undo change |
| 6 | Numbers in prose | findings (1, LOW): the plan above Progress is stale (LOW 2). Every number in the rework Progress entry reproduced |
| 7 | Documentation | pass. `DevHook.hudStrays`'s doc comment describes the new shape |
| 8 | Guardrails and hygiene | pass: lint 21, cap 21, no new dependency |
| 9 | Repository-specific footguns | pass. No `src/engine` or `src/data` change |
| 10 | Architecture | pass. `scanCameras` reuses `cameraStrays` for `strays`, so there is no duplication |

**Assertions weakened:** none. `strays` must still be `[]` in both views; the two count assertions are additions.

## Type check
```
type-check: FAIL (intent 67, fix)
  error: A live check is owed and not recorded. Do the steps in intents/67-drift-arrow-hud-camera/review.md → ## Live check, then set live_checked: <date> in intents/67-drift-arrow-hud-camera/metadata.yml.
  note:  6 file(s), 144 line(s) changed outside intents/.
```
The only error is the owed live check. It clears when the owner records `live_checked` (review skill, step 1's exception).

## Findings
- **LOW** `e2e/hud-strays.spec.ts:16`, `src/ui/cameraStrays.ts:30`: `examined > hudOnly` is a weaker check than its comment suggests.
  - It kills only a reader that sees nothing but HUD objects (W6: expected > 42, received 42).
  - With the camera ids swapped (W7), `hudOnly` counts the world objects instead, and every assertion still passes. The stray rule is symmetric in the two ids, so `strays` is unchanged: the positive control is only mislabelled under that mutant.
  - A sharper control would be `hudOnly < examined / 2`, or a known HUD count. Worth a look.
- **LOW** `intents/67-drift-arrow-hud-camera/plan.md`, Subtask 2 and Tests, above Progress: the plan describes the round-1 shape.
  - Subtask 2 says the reader "returns `[]` before the pin", and Tests expects the empty-list mutant to fail only "on main's code". Neither is true any more.
  - Round 1's stale "both" prediction also still stands.
  - The rework Progress entry records all of it. Any edit is above Progress, so it is the owner's. Worth a look.

### Round-1 findings, round-2 status
| Finding | Status |
| --- | --- |
| MEDIUM: W3, W4 and W5 survive | Resolved by option (a), `f1a4c23`. All three are now killed |
| LOW: the stale "both" prediction in the plan | Open, left by the owner (folded into LOW 2) |

## KonMari check
Not run. The step runs only when `plan_approved` falls after §61's merge date (`8190d41`, 2026-11-10; `/auto` step 5a). §67's `plan_approved` is 2026-11-10, which is on that date, not after.

## Not checked
- **A real drift:** no test or run drove one. That the arrow appears once and moves with the map is inferred from the camera filter. That is the live check.
- **The Drawn view's control on its own:** every mutant failed first at the Standard view's assertions.
- **Placement:** it also pins a `StandardBoardView`, but `hud-strays` runs on the Board only.
- **Objects made during prompts or drifts:** `hudStrays()` is never called while a prompt, an attack report or a drift is open.
- **The Drawn view after its own selections and drift overlays,** and a view swapped back to Standard: there is one check per view.
- **Screen-level rendering:** no screenshot was taken.

## Live check
- **owed:** rule 1 (`src/ui/`), plus the Not-checked item "a real drift".
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/67-drift-arrow-hud-camera`, run `npm run dev -- --port 5267 --strictPort --host 127.0.0.1` and open http://127.0.0.1:5267/.
  2. Menu → "Combat test mode (units face to face, 2 hexes)". Both seats are human. The elephants stand at (17,3) and (17,5).
  3. Pan and zoom the map well away from where it started.
  4. With the first player, move the elephant at (17,3) onto (17,4).
  5. In combat, attack the enemy elephant with that elephant alone. 8 against 5 is the 1-1 column, where every result is a retreat. An elephant drifts instead of retreating, so **every such attack starts a drift**, and it pauses with "▶ Continue".
  6. Before pressing Continue, pan and zoom again.
- **you should see:** one arrowhead, on the drifting elephant's hex, panning and scaling with the map. No second arrowhead appears over the left panel or anywhere else. Optionally, repeat in the Drawn view.
- **fallback:** if the second player moves first, use their elephant at (17,5). Test mode lets you Undo and retry.

## Verified myself vs. taken on trust
- **Coordinator, re-run (worktree at `08ffabb`):**
  - `npm run verify`: exit 0; 81 test files, 1420 tests passed; 0 errors, 21 warnings, cap 21.
  - `npm run check:intent`: exit 1. The only error is the owed live check (output above).
  - `npm run e2e`: exit 0, 23 passed. Port 5232 was free beforehand.
  - **W3**, the empty list in `MapView.cameraStrays`: KILLED, on "Standard view: HUD objects seen". It matches.
  - **W4**, `boardView.mapObjects()` in place of `children.list`: KILLED, on the same assertion. It matches.
  - **W5**, `hudStrays` returning an empty scan: KILLED, on the same assertion. It matches.
  - **W7**, the camera ids swapped: SURVIVED (1 passed). It matches; it is equivalent for the stray check (LOW 1).
  - Each mutant was backed up by copy, its change asserted, and the file restored by copy. `git status --short` was clean after each.
  - `npm run sdlc:scan -- --sample-due auto --exclude 67`: "nth attested auto change = 7, every 3, sampled: no".
- **Reviewer:**
  - `git diff 11b7f26..08ffabb`, read in full;
  - verify, check:intent and e2e, with the same numbers;
  - **mutants:**
    - S1–S7 on `scanCameras`, all killed by "scanCameras > counts examined objects, HUD-only objects and strays" (S5 also by "reports zeros for an empty list");
    - W1, the failing-first: killed, with strays `[{ depth: 12, type: "Graphics" }]`;
    - W3, W4 and W5: killed;
    - W6: killed, on "examined beyond HUD";
    - W7: survived;
  - every rework Progress claim reproduced.
- **Taken on trust:**
  - round 1's Phaser source reading and its inventory of 1,347 objects. W6's "42" matches the 42 HUD objects round 1 counted;
  - "no stray in the Drawn view", from the passing spec.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 11b7f26
- round: 1
- sampled: no
- run: auto
- live-check: owed

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
