<!-- generated-by: heraklios/review@0.1.4 -->
# §40 review — The naval Turn buttons turn the wrong way (left should be counter-clockwise)

verdict: rework
tier: attested
reviewed-commit: b86726cc52cae4c1ef6c317b133b38cd0e674cd3
round: 1
sampled: no
live-check: owed

Tier set by the path table: `src/scenes/**` and `src/ui/**` are Attested, and
`e2e/**` is a tests-only change. The intent is a fix and nothing in it raises
the tier. The verdict is `rework` because of one MEDIUM finding (invalid UTF-8
written into four files); the fix itself is correct.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — the README sentence is not in the plan |
| 2 | Type check | ROUTE, reason stated below |
| 3 | Rulebook fidelity | pass — no rule changes; the direction claim re-derived and tested |
| 4 | Tests prove the rule | pass — 8 mutants, 6 killed, 2 survived (the arrowhead glyphs, as the plan predicted) |
| 5 | Engine/presentation boundary and conventions | pass — no `src/engine` or `src/data` change; the hook is dev-only |
| 6 | Numbers in prose | pass — the Progress entry's 692 tests and 8 e2e match my runs |
| 7 | Documentation | findings (1) — the README sentence is garbled (same defect as the MEDIUM below) |
| 8 | Guardrails and hygiene | findings (1) — invalid UTF-8 in four files |
| 9 | Repository-specific footguns | not run — drift, AI tiers and map editor not touched |

## Type check
```
type-check: ROUTE (intent 40, fix)
  route: Declared fix, but no test changed. A fix carries a test so the defect cannot come back.
  note:  6 file(s), 142 line(s) changed outside intents/.
```
The ROUTE is a mismatch in the checker, not in the change. The fix does carry
tests: `e2e/naval.spec.ts` (changed) and `e2e/placement.spec.ts` (new), both
shown failing before the scene change (`Expected: 0 / Received: 4` and
`Expected: 1 / Received: 5`, in the Progress entry) and passing after. The
script does not count `e2e/` files as tests. Re-declaring the type would be
wrong: this is a fix. Worth a follow-up intent on `scripts/` so `e2e/` counts.

## Findings
- **MEDIUM** `src/scenes/BoardScene.ts:630`, `src/scenes/PlacementScene.ts:205`,
  `src/ui/devHook.ts:53` and `:136`, `README.md:481` — the implementer wrote
  Latin-1/cp1252 bytes into UTF-8 files: a lone `0xA7` where "§" belongs
  (`(\xa740)` in three comments), a lone `0x97` where "—" belongs inside the
  hook's runtime error message (`devHook.ts:136`), and a bad byte for "°" in the
  README sentence ("60° counter-clockwise"). `main`'s copies of all three source
  files are valid UTF-8; these four lines are the only invalid bytes in the diff
  (checked with a strict UTF-8 decode of every changed file at the reviewed
  commit). The build and tests pass because the toolchain replaces the bad bytes
  with U+FFFD, but `grep` now reports the three source files as binary, the
  README shows "60�", and the error message in `devHook.ts:136` would print a
  replacement character. Needs rework: re-save those lines as UTF-8 (`§`, `—`,
  `°`), then re-run the strict-decode check on the changed files (a clean run
  prints nothing).
- **LOW** `README.md:481` — the intent and plan do not mention a README change;
  the implementer added one sentence stating the turn direction. It is correct
  and in the README's style, and no "Known simplification" moved, so it is
  benign scope. Worth a look.
- **LOW** `scripts/` — `check:intent` ignores `e2e/` as test files (see Type
  check), so every fix whose failing-first test is an e2e scenario will ROUTE.
  Worth a follow-up intent, not part of this change.

## Not checked
- **The arrowhead previews on both screens.** They are Phaser `Graphics`, which
  no test sees; mutants M5 and M6 survived for that reason. Only the live check
  covers them.
- **The Placement scenario's order assumption.** It reads the queue's current
  item and clicks land units until a ship is current. It ran in one order only
  (the one `UNIT_TYPES` gives); the other order is plausible but unexercised. It
  also needs at least two ships in the default army, which is true today.
- **Cold-start flakiness.** `placement.spec.ts` takes 14.3 s, about three times
  the other scenarios, and runs alongside the cold-start flake tracked in §38. It
  passed in my one run; I did not run it repeatedly.
- **Three- and four-player and AI-seat placement.** The scenario covers a human
  player 0 in a two-player game only.
- **A production build omitting the hook.** `e2e/global-setup.ts` checks it and
  my `npm run e2e` run passed, so I took that on its word rather than inspecting
  `dist/`.

## Live check
- owed: rule 1 — the diff touches `src/scenes/**` and `src/ui/**`. The smoke
  suite cannot stand in: the change is visual (the arrowheads) and adds new
  behaviour (the Placement scenario), and the two scenarios cannot see the
  arrowheads.
- steps: from the worktree, `npm run dev -- --port 5240 --strictPort --host
  127.0.0.1`, open the printed address, then:
  1. Menu → **Combat test mode** → click a galley → click the left **Turn**.
  2. Click the right **Turn**.
  3. Menu → a normal 2-player game → **Use default army** and **Confirm army**
     for each seat → on Placement, place land units until a ship is next → click
     a sea hex → click each **Turn** before **Confirm facing**.
- you should see: the left button turns the ship 60° counter-clockwise on screen
  and the right one clockwise, on both screens; the small arrowhead beside each
  button points to the facing that button will turn the ship to (left arrow
  counter-clockwise of the bow, right arrow clockwise of it); a Turn costs one
  movement point on the Board.

## Verified myself vs. taken on trust
- At `b86726c`, in the worktree: `npm run verify` → exit 0, 44 test files, 692
  tests passed, 21 lint warnings (= the cap), 0 errors. `npm run check:intent` →
  ROUTE (above). `npm run e2e` → 8 passed (30.4 s), including both new/changed
  scenarios.
- Mutations (one per changed behavioural line; each file backed up and restored
  byte-for-byte, harness asserts the file changed; `git status --short` clean
  afterwards):
  - M1 Board left button `rotateSelectedShip(1)` → `-1`: killed (`naval.spec.ts`).
  - M2 Board right button `-1` → `1`: killed.
  - M3 Placement left button `rotatePendingShip(1)` → `-1`: killed
    (`placement.spec.ts`).
  - M4 Placement right button `-1` → `1`: killed.
  - M5 Board left arrowhead `(f+1)` → `(f+5)`: **survived**.
  - M6 Placement left arrowhead `(f+1)` → `(f+5)`: **survived**.
  - M7 hook `mapScene` finds only the Board: killed.
  - M8 hook guard renames a member it reads: killed (the throw-if-renamed
    guard works).
- Re-derived the direction claim myself: `DIRECTIONS[0] = (1,0)` and
  `hexToPixel` give `y = 22·√3·0.5 > 0` (down-right); `DIRECTIONS[1] = (1,-1)`
  gives `r + q/2 = −0.5` (up-right). Down-right to up-right is counter-clockwise
  with y pointing down, so `facing + 1` is counter-clockwise. Mutants M1–M4 being
  killed shows the e2e asserts that sense, not just any sense.
- Read the full diff of `BoardScene.ts`, `PlacementScene.ts`, `devHook.ts`, both
  e2e files and the README line.
- Taken on trust: the implementer's description of the queue order and hex
  choice; `dist/` contents.
