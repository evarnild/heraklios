<!-- generated-by: heraklios/review@0.2.0 -->
# §72 review — The engine can run a whole game for a host other than the Phaser scenes

verdict: rework
tier: attested
reviewed-commit: d9f0c6f03791fbd8806b96795794d39aaa9f4337
round: 1
sampled: no
run: auto
live-check: owed

**Tier: Attested, by the path table** (`src/engine/**`, `src/ui/**`,
`src/scenes/**`, tests, `scripts/size-baseline.json`, and the lowered
`package.json` cap).
- No Reviewed path was edited. `saveGame.ts`, `history.ts`, `saveStorage.ts`,
  `state.ts`, `src/data/**`, `eslint.config.js`, `.claude/**` and
  `BoardScene.ts` are all untouched.
- No CRITICAL or HIGH finding raises it.

**Sampling.** `npm run sdlc:scan -- --sample-due auto --exclude 72` says
"nth attested auto change = 9, every 3, sampled: yes". It applies when this
intent reaches `attest`. This round is `rework`, so `sampled: no`.

**Verdict.** The code is right, and B15 is proven: the pinned traces were
regenerated from `main`'s own code and match. Four mutants survive on real
behaviour that no test pins. Each fix is a mechanical test, and there is no
"Needs decision:" finding.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — all seven Progress divergences accepted (below) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — no rule changed; the deployment rules moved verbatim, proven against `main` |
| 4 | Tests prove the rule | findings (4) — 70 mutants: 61 killed, 4 real survivors, 5 equivalent |
| 5 | Boundary and conventions | pass — no `GameState` or `SAVE_VERSION` change; `BoardScene.ts` not in the diff (B16); I1, I2, I3 and A2 commented at `combatResolution.ts:23-35`, `:63-67`, `:165-172`, `:352-353`, `sessionAgents.ts:30-32`; Placement snapshots before `deployUnit` and pushes history only on success |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass — lint 19 warnings, cap lowered 21 → 19, never raised; no new dependency or `eslint-disable` |
| 9 | Repository footguns | pass — `stepDrift` (`combatResolution.ts:310-344`) makes one `driftStep`, handles its events, supplies at most one input and returns; `runResolution` (`:397-415`) clears any open retreat frames before the drift resumes, as `resolveElephantDrift` does |
| 10 | Architecture | findings (1, LOW) — one job per module, no `ui` import, the dual-driver and `advancePhase` default recorded in `docs/architecture.md`, `mapBounds` re-exports |

**Pass 1: the Progress divergences, accepted.**
- **66 pinned games instead of 48.** The planned 48 give only 1 push and 1
  exchange choice. The 66 give 9 and 5.
- **`deploymentSnapshotCases.ts`.** It follows the `movementCases.ts`
  precedent.
- **`sessionBeginResolution`.** It is used only by the harness wrappers and
  tests, refuses when a question is open, and is not exposed by `host.ts`.
- **A forced sacrifice through `onForced`.** This equals the I3 mapping: with
  one minimal subset and positive forces, every qualifying set contains it.
- **The drift parity oracle.** It drives the real `resolveElephantDrift` and
  `engine/retreat.ts`, which are still `BoardScene`'s path.
- **The flat step queue.** It gives the same item-then-advance order, and the
  66 traces are byte-identical.
- **The host config.** It matches the plan's Assumptions. `HostDeployError`
  carries the `DeployError` as data.

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 72, feature)
  note:  28 file(s), 6130 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/engine/combatResolution.ts:360` — mutant CR21 survives:
  removing `if (unitAt(game, step.hex)) return null;`.
  - The guard stops an advance offer onto a hex that is occupied again.
    `eligibleAdvanceCandidates` (`combat.ts:116`) does not check occupancy, so
    without the guard two units could share a hex.
  - One case: in a DR, a boxed-in defender pushes its sibling into the
    sibling's original hex. The skipped sibling's advance offer still comes
    (I1).
  - Needs rework: a `gameSession.test.ts` case where a defender item's hex is
    occupied again before its advance offer, asserting that no advance question
    comes for that hex.
- **MEDIUM** `src/engine/sessionAgents.ts:33-38` — mutant SA2 survives:
  `a.unitIds.every(...)` changed to `.some(...)`.
  - No test proves the I3 sacrifice mapping. None of the 5 pinned exchange
    choices tells the two apart. The plan's claim that AC2 kills "the
    sacrifice mapping picking a different subset" does not hold.
  - Needs rework: a test of `askAgent`/`settleWithAgent` with a stub agent
    whose `chooseExchangeSacrifice` returns (a) the second listed minimal
    subset and (b) a non-minimal superset. Assert the mapped answer and which
    units are destroyed.
- **MEDIUM** `src/engine/host.ts:212-215` — mutant H4 survives: `load` with
  `attackedThisPhase: []`.
  - No test proves that `load` restores the saved `attackedThisPhase` and
    `rammedThisTurn`. Both `save()` tests use empty contexts. If it broke, a
    unit could attack twice in a phase after a load.
  - Needs rework: save mid-combat-phase after a land attack and a ram, `load`
    the save, and assert both context lists come back equal and the attacker is
    not offered again by `legalActions()`.
- **LOW** `src/engine/sessionAgents.ts:90` — mutant SA4 survives:
  `await Promise.all(kept)` is untested. That line is how an agent's error on a
  forced step surfaces. Needs rework: a test where the agent's method rejects on
  a one-option step, asserting that `settleWithAgent` rejects.
- **LOW** `src/engine/deploymentSnapshotCases.ts:1` — the first non-test module
  under `src/` to import a Node built-in (`node:crypto`). Nothing in the game
  imports it, but `src/engine` is what §70's host bundles. Worth a look: hash
  in the tests, or move the file beside `fixtures/`.
- **LOW** `src/engine/gameSession.test.ts:478`, `src/engine/deployment.test.ts:173`
  — `toThrow()` with no message. GS11 and D9 survive, but only in effect,
  since a `TypeError` is still thrown before any change. Worth a look: match
  `/no question is open/` and `/rng/`.

## Not checked
- **Mutants not run (one per behaviour was chosen):**
  - the `stepDrift` direction die;
  - `sameAnswer`, and `minimalSacrifices`' `n > 20` guard;
  - the unreachable `requiresExchangeChoice && hasItems` invariant;
  - `sessionBeginResolution`'s already-open guard;
  - `processRetreats`' `noDie`;
  - the moved `applyEndPhase` invariants;
  - `host.ts`'s `copy()`, `HostDeployError`, the `seatControls` default and the
    `rammedThisTurn` load line;
  - `newSession`'s context copy;
  - every `PlacementScene.ts` and `aiSetup.ts` line (covered by the deployment
    snapshot, `aiSetup.test.ts` and e2e, not by mutation).
- Progress's "91 files and 1599 tests at subtask 1": that needs `eef4065`
  checked out.
- Placement in a browser:
  - the band and Drawn-view highlight;
  - a ship's facing through `deployUnit`;
  - a second human seat's ids restarting at 0 (A4).

  The live check covers these.
- Bundling for a non-Node host (§70's ClearScript path).
- The implementer's one-off `save-load.spec.ts` failure: it did not recur for
  the reviewer or the coordinator, so it was not compared with `main`.

## Live check
- **Owed:** by rule 1. `src/scenes/PlacementScene.ts`, `src/ui/aiSetup.ts` and
  `src/ui/mapBounds.ts` changed, and A4 changes Placement ids. The smoke suite
  cannot stand in, because Placement's unit creation is new code.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/72-engine-host-seams`, run
     `npm run dev -- --port 5272 --strictPort --host 127.0.0.1` and open
     http://127.0.0.1:5272/.
  2. For comparison, from `C:/Users/eric/src/heraklios` run
     `npm run dev -- --port 5273 --strictPort --host 127.0.0.1`.
  3. On both: 2 players, seat 0 Human, seat 1 a computer tier. For seat 0,
     choose "Use default army", then "Confirm army".
  4. In Placement (Standard view), note the edge. The green band should be the
     same 3-hex strip on both ports. Toggle the Drawn view: the same hexes stay
     highlighted.
  5. Place land units. A click outside the band, or a cavalry unit on marsh or
     steep flank, does nothing.
  6. Undo, then redo.
  7. At the ships, the highlight jumps to the bay. Stage a ship, turn it with
     each Turn button and confirm: the facing you chose is kept. Stage a second
     ship and Cancel it.
  8. Click "Done placing". The computer seat deploys with no screen of its own,
     and the Board opens with both armies.
  9. Play into the first combat.
  10. Optional (A4): repeat with two Human seats. The second seat places
      normally.
- **You should see:**
  - the same legal hexes as on `main`, in both views;
  - the same refusals as on `main`;
  - Undo and Redo working;
  - a combat whose retreat or advance prompts behave as on `main`.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `d9f0c6f`: exit 0; lint 0
  errors, 19 warnings (cap 19); 94 test files, 1659 passed, 2 skipped (the gated
  writers). Matches.
- **Coordinator, re-run:** `npm run check:intent`: PASS (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`: 27 passed in 47.4s. No
  `save-load.spec.ts` failure. Matches.
- **Coordinator, re-run:** the nine survivors, each backed up by copy, applied
  once, full `vitest run --bail 1`, restored by copy: CR5, CR21, CR26, GS2,
  GS11, SA2, SA4, D9 and H4 all SURVIVED. Control CR13 was KILLED by
  `gameSession.test.ts` "a push asks which friend to push, resolves the chain,
  then offers the advance". `git status --short` was clean after. All match the
  reviewer.
- **Reviewer:**
  - It regenerated both deployment fixtures and the 66 pinned games from the
    main checkout's unchanged modules, and they match the committed fixtures.
    The totals were 9 pushes, 34 drifts, 24 drift combats and 5 exchange
    choices (all minimal); AR 76, DR 144, DE 28, EX 25, AE 9.
  - It checked that `eef4065` touches only fixtures and tests, that its parent
    is `main` (`67792b1`), and that the writers are gated.
  - It ran 70 mutants, one at a time.
  - **Killed (61):**
    - CR1-CR4, CR6-CR20, CR22-CR25;
    - GS1, GS3-GS10;
    - SA1, SA3, SA5;
    - H1-H3, H5-H8;
    - D1-D8, D10-D12;
    - T1, A1;
    - F1-F6.
  - **Survived (9):**
    - real gaps: CR21, SA2, H4 and SA4;
    - equivalent: CR5 (no candidate after a single-attacker EX), CR26
      (positions are only ever reassigned), GS2 (`advancePhase` never enters
      movement once the game is over), and GS11 and D9 (still a `TypeError`
      before any change).
  - It reproduced the Progress line counts and totals.
- **Taken on trust:**
  - the test count at subtask 1;
  - that the implementer's first e2e failure was a flake;
  - verify at each intermediate commit;
  - Placement in a browser (the live check).
