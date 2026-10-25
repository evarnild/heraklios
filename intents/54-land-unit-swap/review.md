<!-- generated-by: heraklios/review@0.1.5 -->
# §54 review — Two adjacent friendly land units can swap places, as a game option

verdict: escalate
tier: reviewed
reviewed-commit: 3add149
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed, by the path table (the save format:
`src/engine/saveGame.ts`, `src/ui/saveStorage.ts`). `review_tier` is empty
and no finding is above LOW.

**Verdict:** `escalate`. Every round-1 finding is resolved, nothing needs
rework, and every mutant round 1 expected the rework to kill is killed. The
tier is Reviewed, so you read the diff; the live check is still owed. Passes
run by the `heraklios-reviewer` agent; the coordinator re-ran verify,
check:intent, e2e and all eleven mutants (below). One e2e scenario failed in
the coordinator's full-suite runs under memory pressure and passed alone; the
owner judged it environmental ("quick", 2026-10-25), see Not checked.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework matches the owner's decision (a): the heuristic filter stays, the README says the computer never swaps and names §59; nothing beyond round 1's findings changed |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass: the print rule is quoted verbatim in `README.md:316-319` and `src/engine/movement.ts:153-156`, word for word with `docs/research/05-rules-french-original.md:124-126` |
| 4 | Tests prove the rule | pass: 13 mutants run, 10 killed, 2 expected survivors (F2b, a regression guard; F2e, unreachable), probes G1 (the guard fires) and F2d (a deleted case is a build error) |
| 5 | Boundary and conventions | pass: engine changes are tests plus a harness guard; the scene change is a comment; no `GameState` change |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass: `README.md:340-342` and the Random row (`:802`) match (a) |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged; no new dependency; no `innerHTML` |
| 9 | Repository-specific footguns | pass: no drift change; every case of the harness's `applyOneAction` returns, so none falls into the new `default:` |

**The harness's new exhaustive `default:`** (`src/engine/fuzzHarness.ts:1345-1348`)
can't throw on a legitimate kind: `Action` (`src/engine/actions.ts:67-74`) has
8 kinds, each with its own case at `fuzzHarness.ts:1215-1343`, each ending in
`return`; `const unhandled: never = action` makes a missing case a compile
error (probe F2d: `tsc --noEmit` exits 2, TS2322 at `:1337`). The new
position check (`:1250-1258`) reads both positions through `requireUnit`
before and after `applyAction`; `landSwap` never destroys a unit.

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 54, feature)
  error: A live check is owed and not recorded. Do the steps in intents/54-land-unit-swap/review.md → ## Live check, then set live_checked: <date> in intents/54-land-unit-swap/metadata.yml.
  note:  24 file(s), 760 line(s) changed outside intents/.
```
The only error is the owed live check, which you clear; not rework.

## Findings
- **LOW** `intents/54-land-unit-swap/plan.md:224` (Progress, the rework entry):
  "F2 (… harness tests fail, 4)": dropping the case at runtime fails 5 tests,
  4 in `fuzzHarness.test.ts` and 1 in `heuristicSoak.test.ts` ("resolves
  combined attacks…"). "4" holds for the harness file alone, so likely
  wording. Worth a look: "5 (4 harness, 1 heuristic soak)". Doesn't affect
  the verdict.

## Not checked
- **`npm run verify` on the merged result:** `git merge-tree --write-tree main
  HEAD` is clean (`207b7fc`), but `main` has moved (§52 merged, intent folders
  55-59), so the merged test and lint counts stay unverified until `verify`
  runs on `main` after the merge (`/ship` does).
- **The scene's AI `landSwap` case** (`src/scenes/BoardScene.ts:3042-3051`) and
  `log.computerSwaps` (`en.ts:229`, `fr.ts:213`): unreachable by decision (a)
  until §59, as the comment says.
- **Mutants not run, as in round 1:** P1 (`PlacementScene.ts:102`) and U1
  (`saveStorage.ts:59`), left to live check steps 6 and 7; `formatAction`'s
  `landSwap` line, `devHook.swappable`, `MapView.highlightRings` internals,
  `swapPartners`' naval early return; round 1's equivalents M2a, M9, F1, B4
  (code untouched).
- **B6 and B9 ran against `e2e/swap.spec.ts` only.**
- **A pre-§54 save through the running dev server's `/api/saves`:** the engine
  path is tested at v2 and v3; the server round trip is live check step 8.
- **The real-board ZOC, river and French Menu cases:** live check.
- **An e2e load flake, judged environmental by the owner:** in the
  coordinator's full-suite run `e2e/placement.spec.ts:39` ("the Turn buttons
  turn a ship being placed") failed at about 42 s against the 30 s timeout
  (14 passed, 1 failed), and passed alone (47 s with the server start). The
  reviewer's run gave 15 of 15, that scenario at 10.3 s. The same failure
  showed in round 1 on this branch and on §53's branch, which had passed it
  earlier, while the machine had about 1.5 of 16 GB free. The owner chose to
  treat it as the environment ("quick"). Re-run `npm run e2e` on a quiet
  machine before or after the merge.

## Live check
- **Owed** by rule 1 (`src/scenes/`, `src/ui/`); new and visual, so the smoke
  suite can't stand in. The rework changed only a scene comment and added e2e
  assertions (the selection clearing after a swap; the friend selected with
  swaps off), so the steps are round 1's, with notes in 2 and 6 and a new 10.
- **Setup:** in `C:/Users/eric/src/heraklios-wt/54-land-unit-swap`, with an
  empty temp folder for saves, `HERAKLIOS_SAVES_DIR=<temp folder> npm run dev
  -- --port 5254 --strictPort --host 127.0.0.1`, then open
  `http://127.0.0.1:5254/`.
  1. **Menu:** "Unit swaps: on" on the turn-order row; click for "off", again
     for "on". Judge whether it reads as part of "Turn order" (round 1's LOW).
  2. **Basic swap:** "Combat test mode (units face to face, 2 hexes)". Your
     land units are on r=3 (q=10, 11, …), the enemy's on r=5. Select (10,3):
     (11,3) gets a **green ring**. Click (11,3): they trade places, the log
     says "`<A>` and `<B>` swap places.", the selection clears (now also
     asserted by e2e), and each unit's movement drops by 1. The Undo button
     reads "↶ Undo: Swap `<A>` and `<B>`"; undo: both go back.
  3. **Out of an enemy ZOC:** move (10,3) forward to (10,4), next to the enemy
     at (10,5). Select it: (11,3) is ringed; click it: they swap, and the
     (11,3) unit now stands at (10,4), in the ZOC.
  4. **A ZOC slide is refused:** two friends on (10,4) and (11,4), both next to
     the enemy at (10,5); select one: the other gets **no** ring.
  5. **Too little movement:** spend a unit down to 0 next to a friend: no ring.
     If a river hexside is in reach, a pair across it where one unit has 1
     point left: no ring.
  6. **Option off:** on the Menu set "Unit swaps: off" and start a **normal**
     2-player game (army builder, placement). In Movement, select a unit next
     to a friend: no ring; clicking the friend selects it (e2e checks this in
     test mode; check it here in a real game).
  7. **Save and reload:** a swaps-on game: Save, reload, Load: swaps still
     offered. A swaps-off game: still off, and the Menu shows "off".
  8. **A pre-§54 save:** "Export to file", delete `"allowSwaps": …` from
     `gameState` in the `.json`, "Import from file": swaps offered, the Menu
     shows "on". (Or export from `heraklios-stable`, which predates §54, and
     import it here.)
  9. **French:** "Échange d’unités : oui/non"; the log "Les unités …
     échangent leurs places."; the undo label "Échanger … et …".
  10. **(Optional) The computer never swaps:** play a few turns against a
      computer seat (any difficulty, Random included) with swaps on: the log
      never shows "`<seat>`: … swap places.".
- **You should see:** a green ring only on legal partners, a swap on click with
  a log line, the selection cleared, one undo step per swap, the option
  respected and saved, an old file loading with swaps on, no computer swaps,
  no console errors.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `3add149`; clean before, and after every
mutant):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 57
  files, 1022 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 24 files, 760
  lines (matches).
- `npm run e2e`: **14 passed, 1 failed** (`e2e/placement.spec.ts:39`, about
  42 s); that scenario alone: passed. **Mismatch with the reviewer's 15 of
  15**, judged environmental by the owner (Not checked).
- Mutants, one at a time, backed up and restored by copy, each checked as
  applied; engine with the full `vitest run`, scene with `npx playwright test
  e2e/swap.spec.ts`:
  - M2b: **killed**, "is null when the FIRST unit is destroyed".
  - M4a, M4b: **killed**, "is null when a galley and a land unit stand on
    adjacent wide-river hexes both can enter".
  - M5b: **killed**, "is null at distance 2 even with no enemy about".
  - S6: **killed**, "loads a version-2 save with no allowSwaps with swaps ON".
  - H1: **killed**, "never returns a landSwap from a list where one is
    likely".
  - F2 (the `landSwap` case no longer matching): **killed**, 5 failed.
  - F2b (the position check → `if (false)`): **survived**, 1022 passed.
  - F2e (`default:` returns instead of throwing): **survived**, 1022 passed.
  - B6 (no `deselectMovement()` after a swap): **killed**, 1 failed.
  - B9 (no `selectForMovement(other)`): **killed**, 1 failed.
  - All match the reviewer.

**Reviewer agent** (same worktree and HEAD; nothing checked out; every
command in the foreground):
- `git diff 0052a60..HEAD` read in full (11 files).
- `npm run verify` (1022 tests: 1017 + 5 new), `check:intent` as above,
  `npm run e2e` 15 passed (33.5 s; `placement.spec.ts:39` 10.3 s).
- The same mutants, plus probes G1 (`applyLandSwap` not exchanging: 4 harness
  tests fail with the new invariant) and F2d (the `landSwap` case deleted:
  `tsc --noEmit` exit 2, TS2322).
- Rule text re-read; `seatControl.ts:74` builds every computer seat as a
  `HeuristicAgent`, so (a)'s "never swaps" holds; `intents/59-ai-unit-swaps`
  exists on `main`.
- `git merge-tree --write-tree main HEAD`: clean. `npm run sdlc:scan --
  --sample-due auto --exclude 54`: nth attested auto change = 2, every 3,
  `sampled: no`.
- HEAD not in `main`, no remote branch, `status: in-review`.

**Taken on trust:** that the live-check coordinates are reachable with each
unit's movement (from `testMode.ts`, not clicked).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut54b/`
(reviewer) and `…/scratchpad/coord54/` (coordinator).

# Round 1 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 0052a60
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `c30df30`.

Resolutions (round 2, checked at `3add149`):
- **MEDIUM, README vs code on computer swaps (Needs decision): the owner chose
  (a)** (2026-10-25): the filter stays, the computer never swaps in §54, §59
  will add it. `4533acd` rewrote `README.md:340-342` and the Random row
  (`:802`) and commented the scene's AI case as unreachable until §59
  (`BoardScene.ts:3042-3043`).
- **MEDIUM, H1: fixed** (`45a119f`): the random tier over `[endPhase, landSwap
  ×3]` and 20 seeds never returns a swap.
- **MEDIUM, S6: fixed** (`a6a3ddb`): a v2 save without `allowSwaps` loads with
  it on.
- **MEDIUM, M2b, M4a, M4b, M5b: fixed** (`4adfa0b`): the galley and infantry on
  (20,4)/(20,3) both ways, distance 2 with no enemy, a destroyed first unit.
- **MEDIUM, F2: fixed** (`6ddd5b6`): its own `landSwap` case checking the
  exchange, and an exhaustive `never` `default:`.
- **MEDIUM, B6, B9: fixed** (`d232e1a`): new e2e assertions after a swap and
  with swaps off.
- **LOW, the print rule cited, not quoted: fixed** (`4533acd`), verbatim.
- **LOW, "actions 5": fixed** (`f13d578`).
- **LOW, the Menu toggle under "Turn order": left** to live check step 1.
- **LOW, P1, U1: left** to live check steps 6 and 7.
