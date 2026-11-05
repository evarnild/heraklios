<!-- generated-by: heraklios/review@0.1.5 -->
# §65 review — The board's drawing goes through one view interface, keyed by unit

verdict: escalate
tier: reviewed
reviewed-commit: fafe80b
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed. Round 1's HIGH finding raised it (input 3), and tiers are
never lowered.

**Verdict:** `escalate`. Both of round 1's "Needs rework:" findings are fixed
in `2f1bd2e`, and no finding in this round needs rework. The tier is
Reviewed, so the owner reads the diff before the merge. The passes were run
by the `heraklios-reviewer` agent, which also re-ran the browser probe
against `main`: identical at every capture. The coordinator re-ran verify,
check:intent, e2e and the mutants B5, M1 and M2.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework does what round 1 prescribed; round 1's `gameout` LOW carried |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass, nothing to check |
| 4 | Tests prove it | pass, one LOW: M1 (fix removed) and B5 killed; M2 survives (Phaser-only) |
| 5 | Boundary and conventions | pass: `reconcileUnits` pure and tested; the new accessor is read-only and dev-only; no `GameState`, save or history change |
| 6 | Numbers in prose | pass: 66 files / 1196 tests, lint 21, e2e 18 reproduce |
| 7 | Documentation | pass: the Progress entry is accurate; round 1's plan-prose LOW carried |
| 8 | Guardrails and hygiene | pass: 21 of 21 warnings, none in the changed files; no new dependency |
| 9 | Repository-specific footguns | pass: no drift, AI or engine change |

## Type check
```
type-check: FAIL (intent 65, refactor)
  error: A live check is owed and not recorded. Do the steps in intents/65-board-view-seam/review.md → ## Live check, then set live_checked: <date> in intents/65-board-view-seam/metadata.yml.
  note:  12 file(s), 1256 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears. It is not
rework.

## Findings
- None needing rework.
- **LOW** `src/ui/standardBoardView.ts:124`: mutant **M2** survives everything.
  - **The mutant:** remove the `bringToTop` loop and keep `queueDepthSort`.
  - **Why it survives:** the stable sort then keeps the markers in their old
    list order. The list stays depth-sorted, so `draw-order` passes (e2e: 18
    passed).
  - **Why it barely matters:**
    - two units never share a hex;
    - markers in neighbouring columns overlap only about 2 px at the corners
      (marker width 1.6 × 22 = 35.2 px, column spacing 33 px);
    - the loop only decides which corner sits on top.
  - Worth a look: a pixel or order assertion would kill it, but the plan
    doesn't call for one.
- **LOW** `src/ui/MapView.ts:115` (carried from round 1): leaving the canvas
  now hides the tooltip; on `main` it stays. The plan prescribes this, but
  the intent says no behaviour change. Worth a look: keep it, or remove the
  line for strict parity. That is the owner's call.
- **LOW** `intents/65-board-view-seam/plan.md` (Risks, "Hover events",
  carried): the plan says the rules panel and attack preview listen to
  `onHexHover`, but nothing does. Worth a look.

## Not checked
- Other paths that re-stack markers (redo, AI moves, drift, retreat, Load)
  were not driven. The fix sits in `setUnits`, which covers all of them.
- `displayListSorted()` was not run in the Placement scene; only
  `placement.spec.ts` passing was checked there.
- Carried from round 1:
  - F5: a UI-camera leak for markers made after the pin, on Load or in
    Placement. It survives vitest and e2e, so it's a live-check item.
  - Touch input.
  - Hover during a drag.
  - The text-fallback markers.
  - A real (not synthetic) pointer leaving the window.
- Whether M2's 2 px corner overlap is ever visible on the real marker images.

## Live check
- **Owed** by rule 1 (`src/ui/`, `src/scenes/`), and by rule 3 for hover,
  the tooltip and F5. The smoke suite can't stand in: no scenario covers the
  tooltip, UI-camera leaks or Placement drag and zoom.
- **Setup:** in the worktree, `HERAKLIOS_SAVES_DIR=<temp dir> npm run dev --
  --port 5265 --strictPort --host 127.0.0.1`. Beside it, run `main` (or
  `heraklios-stable`) on another port, for example `--port 5264`, with its own
  temp saves folder.
- **Steps:**
  1. **Combat test mode.**
     - Terrain, rivers and counters look identical to `main`.
     - The tooltip changes hex to hex at edges with no gap, and hides on the
       side panel or the dark margin.
     - Move the pointer out of the window: `main` keeps the tooltip, the
       branch hides it (the LOW).
  2. **Swap and Undo** (now also covered by `e2e/draw-order.spec.ts`).
     - Click the yellow unit at q=10, r=3, then its neighbour at q=11, r=3,
       then "↶ Undo: Swap …".
     - The selected unit's "3" and the neighbour's green ring show on top of
       the counters, as on `main`.
     - Optional, for M2: zoom in on two counters in neighbouring columns.
       Their touching corners should stack as on `main`.
  3. **Clicks.**
     - Click a unit and a destination: it moves.
     - Click near a hex vertex: the hex under the pointer is chosen.
  4. **Drag and wheel-zoom.** Same feel and limits as `main`. The Tables
     panel blocks both.
  5. **Ships and labels.**
     - Facing arrows stay above the hull after turning and moving.
     - Range labels show while building an attack.
     - Choice labels show in a retreat or advance.
     - The drift arrow, if you reach one.
  6. **Placement** (a normal game, through army building).
     - Place units and a ship with facing.
     - Undo and redo a placement.
     - The other player's units stay hidden.
     - Then drag and zoom: no second, unzoomed copy of any counter stays
       still on screen (F5).

## Verified myself vs. taken on trust

**Coordinator, re-run.** Worktree at `fafe80b`; `git status --short` clean
before and after.

| Check | Result | Matches |
| --- | --- | --- |
| `npm run verify` | exit 0; `21 problems (0 errors, 21 warnings)`; 66 files, 1196 tests | yes |
| `npm run check:intent` | FAIL only on the owed live check; 12 files, 1256 lines | yes |
| `npm run e2e` | 18 passed (55.0 s) | yes |
| **B5** (r comparison removed), full vitest | **killed**: 1 failed, "reconcileUnits > treats a move along r only as an update" | yes |
| **M1** (`queueDepthSort` removed), full e2e | **killed**: 1 failed, 17 passed; the failure is "the display list stays depth-sorted after a swap and Undo" (`e2e/draw-order.spec.ts:10`) | yes |
| **M2** (`bringToTop` loop removed), full e2e | **survived**: 18 passed | yes |

Each mutant was backed up and restored by copy.

**Reviewer agent** (same worktree and HEAD, foreground):
- `git diff 673b2c4 2f1bd2e`:
  - no line deleted in any existing test or scenario;
  - `plan.md` changed below the Progress marker only.
- verify, check:intent and e2e: as above.
- The regression check is not vacuous:
  - Phaser sorts only at render, when `sortChildrenFlag` is set
    (`Systems.js:384`, `DisplayList.js:186-194`).
  - The scenario asserts after `waitIdle` and two animation frames, so it
    passes with the fix and fails without it.
  - "Depths non-decreasing along the list" is exactly "draw order agrees
    with depth"; equal depths may sit in any order.
- The dev-hook accessor:
  - it reads `scene.children.list` and `.depth` only;
  - `devHook.ts` loads only through `main.ts:28`'s dynamic import, and
    `e2e/global-setup.ts`'s production-bundle check passed;
  - `placementSnapshot` matches the old inline body line for line, and
    `placement.spec.ts` passes.
- The browser probe (`probe2.cjs`): branch on 5266 and `main` on 5267, each
  with a scratch saves folder.
  - Every capture is identical: ship selected, turned, turned back, swap A,
    swap B, Undo A, and the full canvas after Undo.
  - There were no page errors.
  - It stopped both servers it started.
- `npm run sdlc:scan -- --sample-due auto --exclude 65`: nth attested auto
  change = 4, every 3, `sampled: no`.

**Taken on trust:** round 1's other mutants (H1-H3, B1-B4, B6-B11, F3, F5).
They were not re-run, and the rework doesn't touch those lines.

# Round 1 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 673b2c4
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `935299a`.

Resolutions (round 2, checked at `fafe80b`):
- **HIGH (the depth sort): fixed** in `2f1bd2e`.
  - `queueDepthSort()` is added after the `bringToTop` loop.
  - New `e2e/draw-order.spec.ts` uses the read-only dev-hook accessor
    `displayListSorted()`. M1 (the fix removed) fails it.
  - The browser probe now matches `main` at every step.
- **MEDIUM (B5): fixed.** The r-only `reconcileUnits` test kills it.
- **LOW (`gameout` tooltip):** unchanged; the owner's call.
- **LOW (plan prose):** unchanged.

