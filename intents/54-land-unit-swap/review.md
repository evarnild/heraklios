<!-- generated-by: heraklios/review@0.1.5 -->
# §54 review — Two adjacent friendly land units can swap places, as a game option

verdict: rework
tier: reviewed
reviewed-commit: 0052a60
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed, by the path table (the save format:
`src/engine/saveGame.ts`, `src/ui/saveStorage.ts`). `review_tier` is empty
and no finding is above MEDIUM.

**Verdict:** `rework`. One finding needs your decision (does the computer ever
swap?); five MEDIUM and two LOW test or doc gaps need a mechanical fix. With a
"Needs decision:" finding open, the auto run stops for you. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent, e2e
and part of the survivors (see "Verified myself": a memory kill cut the
re-check short).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): the README and AI claim (Needs decision). The Progress divergences were judged and accepted (below) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | findings (1, LOW): the print rule is cited, not quoted |
| 4 | Tests prove the rule | findings (6): 55 mutants, 15 survived (4 equivalent) |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | findings (shares pass 1's) |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged, no new dependency, no `innerHTML` |
| 9 | Repository-specific footguns | pass: no drift change; the heuristic filter keeps its `random` tier's replays identical |

**Divergences judged:**
- **Green ring** (`MapView.highlightRings`, depth 11) above the markers:
  justified. Removing the fill alone (B4) leaves the e2e green, removing the
  ring kills it, so the fill never shows on an occupied hex. The ring is
  cleared by `highlightHexGroups` and `clearHighlights`.
- **Menu toggle on the turn-order row** (turn order moved 140 px left): B1
  said "under"; acceptable but visual (LOW below, live check step 1).
- **Read-only dev hook `swappable(unitId)`:** reads through `swapStep`,
  guarded like the hook's other members. Fine.
- **`landMove` body moved into `applyLandMove`:** the old case body at the
  merge-base and the new function body are identical once indentation is
  stripped; the charge-cost mutant (A12) is still killed.
- **The heuristic agent filters `landSwap` at every difficulty, `random`
  included:** matches B7 literally ("HeuristicAgent never chooses one").
  AC3's "plays at least one swap" is met by `RandomAgent` in the fuzz harness
  (`playRandomGame`, `fuzzHarness.ts:1200`), not by any game seat: every
  computer seat is a `HeuristicAgent` (`seatControl.ts:74`). See the Needs
  decision finding.
- **`migrateSavedGame` fills a missing `allowSwaps` with `true` at any
  version, v3 included:** correct per B8, tested at v3, untested at v1/v2
  (S6 below).
- **`046220f`'s repair of `0e97207`'s bytes:** every changed file decodes as
  UTF-8 (`iconv`, which catches a planted 0xFF); the only non-ASCII characters
  added are § — é É ’ ↶. `0e97207` itself keeps an invalid 0xa7 (a cp1252 §)
  in history; it's gone from the tree.

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 54, feature)
  note:  24 file(s), 665 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `README.md:337-338`, `README.md:798`,
  `src/engine/heuristicAgent.ts:203-205`, `src/scenes/BoardScene.ts:3042-3049`:
  the docs and the code disagree on whether the computer swaps. The README
  says "The computer may swap too when it picks moves at random", and its
  Random row says it "Picks uniformly among the legal options". The code
  filters `landSwap` at every heuristic difficulty, Random included, and every
  computer seat is a `HeuristicAgent`, so no computer seat ever swaps:
  `applyAiAction`'s `landSwap` case and `log.computerSwaps` (B7's "the AI's
  swap is logged as …") are dead code in the shipped game.
  Needs decision: (a) keep the filter, fix README:337-338 to "the computer
  never swaps" and note it in the Random row; or (b) let the Random tier see
  swaps (filter only for greedy, ev and cautious), which changes Random-tier
  play and makes the AI log reachable.
- **MEDIUM** `src/engine/heuristicAgent.test.ts:883-898`: the test doesn't
  prove the filter (H1 survives: removing `legal = legal.filter(...)` leaves
  the suite green; greedy and ev never score a swap, and the random tier over
  5 seeds never picks the one swap among ~40 options). Needs rework: give the
  random tier a list where a swap is likely without the filter (e.g.
  `[endPhase, landSwap]`, or the swap repeated) over ~20 seeds and assert it
  is never returned. (If you choose (b) above, this test changes with it.)
- **MEDIUM** `src/engine/saveGame.test.ts:425-431`: the pre-§54 case is tested
  at v3 only (S6 survives: filling only at `SAVE_VERSION` makes every v1/v2
  save without the field unloadable, suite green). Needs rework: a v2 (and/or
  v1) save with `allowSwaps` deleted that parses with `allowSwaps === true`.
- **MEDIUM** `src/engine/movement.test.ts:363-375`: the naval and distance
  checks are masked by other rules in the fixture. M4a and M4b (dropping
  either half of the naval guard, `movement.ts:173`) survive because the
  test's galley stands on plain (terrain refuses it), yet on `river-wide` both
  a galley and a land unit can enter, so without the guard a galley and an
  infantry on adjacent wide-river hexes would swap. M5b (`!== 1` → `> 2`)
  survives because the distance-2 unit is refused by the ZOC rule. M2b
  (dropping `a.destroyed`) survives: only a destroyed `b` is tested. Needs
  rework: a galley on (20,4) next to an infantry on (20,3) (both
  `river-wide`) → null; (10,3)/(12,3) in a state without the foe → null;
  `swapStep(state, dead, a)` → null.
- **MEDIUM** `src/engine/fuzzHarness.ts:1250-1255`,
  `src/engine/fuzzHarness.test.ts:1025-1033`: the harness test counts swaps
  chosen, not applied (F2 survives: dropping `case 'landSwap':` from
  `applyOneAction`, which has no default, silently skips the swap). The count
  is thin too: 2 swaps over 20 seeds (seeds 9 and 12). Needs rework: an
  exhaustive `default:` that throws on an unhandled kind, or a test asserting
  the pair's positions really exchanged.
- **MEDIUM** `e2e/swap.spec.ts:79-94`, `:52-77`: two AC5/B5 behaviours are
  unasserted. The off-test ("clicking the friend selects it instead") only
  checks nothing swapped (B9, a non-partner click selecting nothing,
  survives); "the selection clears" after a swap is unasserted (B6, dropping
  `deselectMovement()`, survives). Needs rework: in the off-test, after
  clicking `b`, click an empty hex `b` can reach and assert `b` moved there;
  after a swap, click an empty hex and assert neither unit moved (or a
  read-only dev-hook `selectedUnitId()`).
- **LOW** `README.md:313-317`, `src/engine/movement.ts:153-156`: the print rule
  is cited, not quoted, though B9 (and the plan, for the code comment) say
  quoted; the cited lines (`05-rules-french-original.md:124-126`) are right.
  Needs rework: add the sentence verbatim in both places: "Une unité ne peut
  en aucun cas se placer sur une case déjà occupée par une quelconque autre
  unité. Par contre, au cours d'un mouvement, une unité peut traverser une
  case où se trouve une unité de la même armée."
- **LOW** `plan.md` Progress: "actions 5" is stale; the `landSwap` describe in
  `actions.test.ts` has 6 tests (the other numbers check out). Needs rework:
  5 → 6.
- **LOW** `src/scenes/MenuScene.ts:83-118`: the swaps toggle sits under the
  "Turn order" heading with no heading of its own, so it reads as part of turn
  order. Worth a look in the live check.
- **LOW** `src/scenes/PlacementScene.ts:102`, `src/ui/saveStorage.ts:59`: P1
  (a real game ignoring the Menu option) and U1 (a loaded save not updating
  the Menu preference) survive; scene and ui wiring, covered by the live check
  (steps 6 and 7). Worth a look.

## Not checked
- **`npm run verify` on the merged result:** `git merge-tree --write-tree main
  HEAD` merges cleanly (README.md overlaps in separate hunks), but `main` has
  since added `tools/**/*.test.mjs` to vitest, an eslint override and §52's
  orchestrator, so the merged test and lint counts are unverified until
  `verify` runs on the merged tree.
- **The AI `landSwap` branch** in `BoardScene.applyAiAction` and
  `log.computerSwaps`: unreachable in the shipped game (finding above).
- **Mutants not run:** `formatAction`'s `landSwap` line (cosmetic),
  `devHook.swappable` (read-only test aid), `MapView.highlightRings`
  internals (covered as a whole by B3), `swapPartners`' naval early return
  (equivalent).
- **Equivalent survivors, no fix:** M2a (`a.id === b.id`; distance 0 already
  fails adjacency), M9 (off-map terrain; a neighbour of an on-map unit is on
  the map), F1 (the harness's dead-unit check; nothing offers a dead unit
  today), B4 (the fill under markers).
- **Scene mutants ran only against `e2e/swap.spec.ts`**, not the full suite.
- **A pre-§54 save through the running dev server's `/api/saves`:** the read
  path (`server/saveApi.ts:87-92`, `parseSavedGame` → `migrateSavedGame`) was
  read, not run.
- **The real-board ZOC, river and French Menu cases:** live check.
- **An e2e load flake:** the coordinator's full e2e runs failed
  `e2e/placement.spec.ts:39` ("the Turn buttons turn a ship being placed")
  three times out of three on this branch, at about 41 s against the 30 s
  test timeout. The scenario passes alone, and the same scenario failed the
  same way on §53's branch at the same time (it had passed there half an hour
  earlier), while another intent's run loaded the machine. The reviewer's
  run, on a quieter machine, gave 15 of 15. Judged environmental, not caused
  by §54; re-run `npm run e2e` when the machine is quiet.

## Live check
- **Owed** by rule 1 (`src/scenes/`, `src/ui/`); new and visual, so the smoke
  suite can't stand in. Run it on the commit that resolves the findings.
- **Steps.** In `C:/Users/eric/src/heraklios-wt/54-land-unit-swap`, with an
  empty temp folder for saves: `HERAKLIOS_SAVES_DIR=<temp folder> npm run dev
  -- --port 5254 --strictPort --host 127.0.0.1`, then open
  `http://127.0.0.1:5254/`.
  1. **Menu:** "Unit swaps: on" on the turn-order row; click for "off", again
     for "on". Judge whether it reads as part of "Turn order".
  2. **Basic swap:** "Combat test mode (units face to face, 2 hexes)". Your
     land units are on r=3 (q=10, 11, …), the enemy's on r=5. Select (10,3):
     (11,3) gets a **green ring**. Click (11,3): the units trade places, the
     log says "`<A>` and `<B>` swap places.", the selection clears, and each
     unit's movement drops by 1. The Undo button reads "↶ Undo: Swap `<A>` and
     `<B>`"; undo: both go back.
  3. **Out of an enemy ZOC:** move (10,3) forward to (10,4), next to the enemy
     at (10,5). Select it: (11,3) is ringed; click it: they swap, and the
     (11,3) unit now stands at (10,4), in the ZOC.
  4. **A ZOC slide is refused:** put two friends on (10,4) and (11,4), both
     next to the enemy at (10,5); select one: the other gets **no** ring.
  5. **Too little movement:** spend a unit down to 0 next to a friend: no
     ring. If a river hexside is in reach, try a pair across it where one unit
     has 1 point left: no ring.
  6. **Option off:** on the Menu set "Unit swaps: off" and start a **normal**
     2-player game (army builder, placement). In Movement, select a unit next
     to a friend: no ring, and clicking the friend selects it.
  7. **Save and reload:** in a swaps-on game, Save, reload, Load: swaps still
     offered. Same with a swaps-off game: still off, and the Menu shows "off".
  8. **A pre-§54 save:** "Export to file", delete `"allowSwaps": …` from
     `gameState` in the `.json`, "Import from file": swaps offered, the Menu
     shows "on". (Or export from `heraklios-stable`, which predates §54, and
     import it here.)
  9. **French:** "Échange d’unités : oui/non"; the log and undo label read
     "Les unités … échangent leurs places." and "Échanger … et …".
- **You should see:** a green ring only on legal partners, a swap on click
  with a log line, the selection cleared, one undo step, the option respected
  and saved, an old file loading with swaps on, no console errors.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `0052a60`):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 57
  files, 1017 tests (matches).
- `npm run check:intent`: PASS, 24 files, 665 lines (matches).
- `npm run e2e`: **14 passed, 1 failed** three times
  (`e2e/placement.spec.ts:39`, about 41 s against a 30 s timeout); the
  scenario passes alone, and §53's branch failed it the same way under the
  same load. **Mismatch with the reviewer's 15 of 15, judged environmental**
  (Not checked above).
- Survivors re-run one at a time, backed up and restored by copy, each
  checked as applied, with the full `vitest run`: M2a, M2b, M4a, M4b, M5b, M9:
  **survived**, 1017 passed each (matches).
- **Not re-run by the coordinator:** S6 (Claude Code stopped the batch for low
  system memory while S6's suite was running; the mutated `saveGame.ts` was
  restored from its backup copy and `git status --short` was empty
  afterwards), and H1, F1, F2, B4, B6, B9, P1, U1 (not started, since Claude
  Code asks not to restart a memory-stopped run unasked). Their results rest
  on the reviewer.

**Reviewer agent** (same worktree and HEAD; nothing checked out; the tree
empty after every mutant):
- `git diff 594e923..HEAD` in full; `npm run verify` (57 files, 1017 tests,
  lint 21), `check:intent` PASS, `npm run e2e` 15 passed (port 5232 free).
- **55 mutants:** 44 engine with the full `vitest run` (killed: M1, M2c, M3,
  M5-M8, M10, M11a-c, M12, M13a-b, M14, A1-A12 with A3b, S1-S5, T1; survived:
  M2a, M2b, M4a, M4b, M5b, M9, S6, H1, F1, F2); 11 scene with `playwright test
  e2e/swap.spec.ts` (killed: B1, B2, B3, B5, B7, B8; survived: B4, B6, B9, P1,
  U1). Two early B1 runs collided with another process on port 5232 and were
  discarded; a port wait and retry was added and B1 re-run.
- Probes (vite-node, no tracked file touched): 2 swaps over seeds 0-19 (9 and
  12); (20,3) and (20,4) are `river-wide`; distances and `canEnterTerrain` as
  in the findings.
- UTF-8 checked on every changed file; `npm run sdlc:scan -- --sample-due
  auto --exclude 54`: nth attested auto change = 2, every 3, `sampled: no`.
- Rule text re-read (`05-rules-french-original.md:124-140`,
  `02-rules-transcription.md:84-102`); `swapStep` reuses
  `enemyZocProjectorsForHex` and `sharesAnyProjector`.

**Taken on trust:** that the live-check test-mode coordinates are reachable
with each unit's movement (reasoned from `testMode.ts`, not clicked); the
results of the survivors the coordinator couldn't re-run (above).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut54/`
(reviewer) and `…/scratchpad/coord54/` (coordinator).

Mutants a rework is expected to kill: M2b, M4a, M4b, M5b, S6, H1, F2 (vitest)
and B6, B9 (`e2e/swap.spec.ts`).
