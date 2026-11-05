<!-- generated-by: heraklios/review@0.1.5 -->
# §65 review — The board's drawing goes through one view interface, keyed by unit

verdict: rework
tier: reviewed
reviewed-commit: 673b2c4
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** the path table gives Attested (`src/ui/**`, `src/scenes/**`,
`CLAUDE.md`) and `review_tier` is empty. This round's **HIGH** finding raises
it to **Reviewed** (input 3). Tiers never go down, so the owner reads the diff
before the merge.

**Verdict:** `rework`. "Behaviour held constant" doesn't hold. After a
render that only moves markers, the markers draw over the rings, facings,
the drift arrow and the movement, choice and range labels. The reviewer saw
it in a browser against `main`, and a one-line fix restores an identical
picture. Neither vitest nor e2e catches it. One `reconcileUnits` branch is
also untested (mutant B5). Both findings are mechanical.

Everything else held: hit-testing, hover, the UI-camera set, drag, zoom,
units by id, and the e2e suite, with no existing test or scenario edited.
The passes were run by the `heraklios-reviewer` agent, including browser
probes. The coordinator re-ran verify, check:intent, e2e and both surviving
mutants, and confirmed the Phaser cause in its source.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2): the HIGH; the `gameout` LOW. Every subtask delivered; subtasks 4 and 5 in one commit (harmless) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass, nothing to check: no `src/engine` or `src/data` change |
| 4 | Tests prove it | findings (1, MEDIUM): B5 survives. 13 of 14 vitest mutants killed; F3 killed by e2e (10 failed); F5 survives vitest and e2e (Phaser-only, live check) |
| 5 | Boundary and conventions | pass: pure helpers tested; no `GameState`, save or history change |
| 6 | Numbers in prose | pass: 66 files / 1195 tests, lint 21 (BoardScene 5, PlacementScene 1, MapView 0), e2e 17; the implementer's 7 mutants reproduce |
| 7 | Documentation | findings (1, LOW, plan prose); the `CLAUDE.md` `src/ui/` bullet is accurate |
| 8 | Guardrails and hygiene | pass: 21 warnings, none in a `src/ui` file; no new dependency |
| 9 | Repository-specific footguns | pass: no drift, AI or engine change |

## Type check
```
type-check: PASS (intent 65, refactor)
  note:  10 file(s), 1176 line(s) changed outside intents/.
```

## Findings
- **HIGH** `src/ui/standardBoardView.ts:120-124`: markers can draw over the
  overlays that should sit above them.
  - **Cause:** `setUnits` re-stacks markers with
    `scene.children.bringToTop(...)`. In Phaser 3.90, `List.bringToTop` only
    moves the item within the array (`node_modules/phaser/src/structs/List.js:502-505`,
    `ArrayUtils.BringToTop`) and never calls `queueDepthSort()`. Only add,
    remove and `setDepth` queue a sort (`DisplayList.js:115-150`).
  - **Effect:** a render that only moves markers leaves the depth-10 markers
    after everything else in the display list. The main camera then draws
    them over:
    - the rings and facings (depth 11);
    - the drift arrow and the movement-points label (12);
    - the choice and range labels (13).
  - **Reproduced** in Chromium against `main`: Combat test mode, seed 1;
    swap the r=3 units at q=10 and q=11, then Undo. On `main` the selected
    unit's "3" and the neighbour's green swap ring show. On the branch both
    are hidden under the counters, and the full-canvas screenshots differ.
  - **Needs rework:**
    - add `this.host.scene.children.queueDepthSort();` after the
      `bringToTop` loop. The reviewer verified, with a temporary edit since
      restored, that this makes every probed step byte-identical to `main`;
    - add a regression check the suite can run. For example, a new e2e
      scenario that swaps, undoes, and compares the selected hex's pixels
      (or the dev hook's display-list order of markers against the
      movement label) with the state before the swap. Without it, deleting
      the line goes unnoticed.

    The intent's "behaviour held constant" decides both.
- **MEDIUM** `src/ui/boardView.ts:96`: mutant **B5** survives (the
  `|| old.position.r !== unit.position.r` comparison removed; 1195 passed).
  Every move in `boardView.test.ts` changes q. The plan's Tests section
  says each branch has a mutation a test catches.
  - **Needs rework:** add a case where only r changes, for example
    `u('a', 1, 1)` → `u('a', 1, 2)` gives `update: [{ unit, recreate: false }]`.
    That kills B5.
- **LOW** `src/ui/MapView.ts:115`: leaving the canvas now hides the tooltip.
  - The new `gameout` handler hides the tooltip and fires
    `onHexHover(null)`. On `main`, leaving the canvas left it showing:
    Phaser's `setCanvasOut` only emits GAME_OUT, and the polygons got no
    `pointerout`. The reviewer saw this with a synthetic canvas `mouseout`.
  - The approved plan prescribes the handler ("plus `pointerout`/`gameout`
    to clear"), but the intent says no behaviour change.
  - Worth a look: keep it as a harmless improvement, or delete the line for
    strict parity. That's the owner's choice, so it doesn't stop the run.
- **LOW** `intents/65-board-view-seam/plan.md` (Risks, "Hover events"): it
  says "the rules panel and attack preview listen to" `onHexHover`. Nothing
  in `src/` or `e2e/` assigns or reads it, and only the tooltip depends on
  hover. It sits above the Progress marker. Worth a look.

## Not checked
- **No vitest covers** `MapView.ts`, `standardBoardView.ts` or `hexDraw.ts`.
  e2e catches hit-mapping errors (F3) but not depth order (the HIGH),
  UI-camera leaks (**F5**, `standardBoardView.ts:161`, the
  `ignoreOnUiCamera(marker)` call: survives vitest and e2e) or the tooltip.
  These are live-check items.
- **Other paths that hit the depth-sort bug** (redo, AI moves, drift,
  retreat): not enumerated. Only Undo after a swap was reproduced. The fix
  covers all of them.
- **`gameout`:** the evidence is a synthetic `mouseout`, not a real pointer
  leaving the window.
- **Not exercised:** touch input; hover during a drag; the text-fallback
  markers (missing textures); Load replacing the whole unit set after the
  pin (F5's path).
- **F1** (the Zone's depth) argued equivalent, not run: the Zone is ignored by
  the UI camera, which is hit-tested first. **F2** (`pointerout` →
  `updateHover(null)`) not run, and expected to survive.
- The drift arrow drawn a second time by the UI camera: unchanged from
  `main`, tracked as §67.

## Live check
- **Owed** by rule 1 (`src/ui/`, `src/scenes/`), and by rule 3 for depth
  order, hover and the F5 path.
- **Setup:** the worktree with `HERAKLIOS_SAVES_DIR=<temp dir> npm run dev --
  --port 5265 --strictPort --host 127.0.0.1`, beside `main` (or
  `heraklios-stable`) on another port (for example `--port 5264`) with its
  own temp saves folder.
- **Steps:**
  1. **Combat test mode** ("Combat test mode (units face to face, 2 hexes)"):
     - terrain, rivers and counters look identical to `main`;
     - the tooltip changes hex to hex at edges with no gap, and hides on the
       side panel or the dark margin;
     - moving the pointer out of the window: `main` keeps the tooltip, the
       branch hides it (the LOW).
  2. **The HIGH, after the rework:** click the yellow unit at q=10, r=3, then
     its neighbour at q=11, r=3 (they swap), then "↶ Undo: Swap …". The
     selected unit's "3" and the neighbour's green ring should show on top
     of the counters, as on `main`.
  3. **Clicks:** click a unit and a destination, and it moves. Click near a
     hex vertex, and the hex under the pointer is chosen.
  4. **Drag and wheel-zoom:** same feel and limits; the Tables panel blocks
     both.
  5. **Ships:** facing arrows stay above the hull after turning and moving.
     Range labels show while building an attack, and choice labels in a
     retreat or advance. Check the drift arrow if you reach one.
  6. **Placement** (a normal game through army building): place units and a
     ship with facing, undo and redo a placement, and check the other
     player's units stay hidden. Then drag and zoom: no second, unzoomed copy
     of any counter stays still on screen (F5).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `673b2c4`, `git status --short` clean
before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 66 files,
  1195 tests (matches).
- `npm run check:intent`: PASS, 10 files, 1176 lines (matches).
- `npm run e2e`: 17 passed (51.9 s), port 5232 free (matches).
- **B5** (r comparison removed, `boardView.ts:96`, backed up and restored by
  copy): **survived**, full vitest 1195 passed (matches).
- **F5** (`ignoreOnUiCamera(marker)` removed, `standardBoardView.ts:161`):
  **survived**, full vitest 1195 passed and `npm run e2e` 17 passed (55.5 s)
  (matches).
- Phaser source read: `List.bringToTop` (`List.js:502-505`) is
  `ArrayUtils.BringToTop` with no depth sort; `DisplayList` queues a sort on
  add (`:123`) and remove (`:146`). This confirms the HIGH's cause. The
  browser reproduction itself is the reviewer's, not re-run.

**Reviewer agent** (same worktree and HEAD, foreground):
- verify, check:intent and e2e as above.
- `git diff main...HEAD --stat -- '*.test.*' e2e/`: only the new
  `boardView.test.ts` (+58) and `hexHitTest.test.ts` (+88).
- **Mutants:**
  - killed: H1-H3 (`hexHitTest.ts`); B1-B4 and B6-B11 (`boardView.ts`);
  - survived: B5;
  - façade: F3 (world-point origin offset dropped) killed by e2e, 10 failed;
    F5 survived vitest and e2e.
  - The implementer's 7 mutants reproduce with the same counts.
- **Browser probes** (Playwright, its own dev servers on 5266 for the branch
  and 5267 for `main`, scratch saves folders, both servers stopped after):
  - swap then Undo differs from `main` (the HIGH); with the one-line fix it
    is byte-identical at every step;
  - land move, ship turn and the swap itself were identical;
  - hover hex to hex, map → side panel → back, and zoom-then-hover were
    pixel-identical;
  - a synthetic canvas `mouseout` shows the `gameout` difference.
- **Read:**
  - `hexUnder` uses `cameras.main.getWorldPoint`, the call Phaser's own
    hit test makes;
  - the Zone spans every polygon;
  - `mapObjects()` equals the old ignore list plus the Zone;
  - two units can't rest on one hex (`movement.ts:61`);
  - `devHook.ts` and `logPanel.ts` are untouched.
- `npm run sdlc:scan -- --sample-due auto --exclude 65`: nth attested auto
  change = 4, every 3, `sampled: no`.

**Taken on trust:** the reviewer's browser reproduction and screenshots
(`main-full.png`, `branch-full.png`, the gameout pair) in the scratchpad; the
coordinator confirmed the cause in Phaser's source, not on screen.
