<!-- generated-by: heraklios/review@0.1.5 -->
# §57 review: Every continue in an elephant drift shows something

verdict: rework
tier: attested
reviewed-commit: 6ee271c7d06929fb0c462603e3cc5965848e48c4
round: 1
sampled: no
run: auto
live-check: owed

Tier: Attested, set by the path table (`src/engine/drift.ts`, its test, README, intent artefacts).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. `directionForbidden` is silent (no pause), recorded in the plan and a code comment. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass (n/a): `driftStep` untouched; determinism tests green. |
| 4 | Tests prove the rule | finding (1): 2 of 7 mutants survive |
| 5 | Engine/presentation boundary | pass |
| 6 | Numbers in prose | pass (61 files, 1110 tests reproduced) |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass; lint cap unchanged (21) |
| 9 | Repository footguns | pass; `needsInput` handling untouched |

## Type check
```
> heraklios@0.1.0 check:intent
type-check: PASS (intent 57, fix)
  note:  3 file(s), 61 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/engine/drift.test.ts:264-291`, `src/engine/drift.ts:180-181`: the invariant test covers only `directionRollNeeded` and `combatRollNeeded`; `retreatResolutionNeeded` and `directionForbidden` are unproven.
  - Needs rework: add two scenarios to the invariant test's list: (a) the DR trample (`phalanges` at {11,5}, dice `[1, dieForResult(el, d, 'DR')]`, 4 steps); (b) a forbidden first roll: `resolveElephantDrift(state, el, 1, agent, roll, recordHooks(calls), DIRECTIONS[0])` with dice `[1, 2]` (the scenario tuple needs an optional `forbiddenDirection`). Both must kill M4 and M5 below.

Surviving mutants:
- M4: `src/engine/drift.ts:180`, delete `'retreatResolutionNeeded',` from `SILENT_PAUSE_KINDS`: SURVIVED (1110/1110).
- M5: `src/engine/drift.ts:181`, delete `'directionForbidden',`: SURVIVED (1110/1110).

Killed: M1 (drop the skip, the unfixed loop; fails at "pause #3"), M2 (delete `directionRollNeeded`), M3 (delete `combatRollNeeded`), M6 (add `moved`), M7 (invert the condition).

## Not checked
- What the browser shows at each pause (e.g. `directionResumed` only calls `onDirectionRolled`; if the arrow does not move, a click could still look like nothing).
- `npm run e2e` not run: no scene/ui/e2e file changed, and no e2e scenario drives a drift.
- A nested trampled-elephant re-drift is not traced against the invariant.

## Live check
- owed: rule 3 (runtime pacing, the owner's original report).
- steps:
  1. In `C:/Users/eric/src/heraklios-wt/57-drift-silent-continue` run `npm run dev -- --port 5257 --strictPort --host 127.0.0.1`.
  2. Menu: "Combat test mode", human seat on its turn.
  3. Attack with or against elephants until one is forced to drift (AR/AE against an elephant attack, or a trample). Undo works in test mode.
  4. At each "Continue" pause click once.
- you should see: click 1 shows the direction arrow and a "direction rolled" line (no empty pause first); each later click moves the elephant a hex, stops the drift, or shows a trample combat report; none leaves board and log unchanged; a DR trample goes from the combat report straight to the retreat.

## Verified myself vs. taken on trust
Reviewer verified: `npm run verify` (61 files, 1110 tests), `check:intent`, lint of `main`'s drift.ts for comparison, seven mutants against the full suite (restored by copy, tree clean), a vite-node probe of the DR-trample and forbidden-direction traces.

**Coordinator, re-run** (worktree at 6ee271c): `npm run verify` exit 0, 61 files, 1110 tests; `npm run check:intent` PASS; M4 SURVIVED (1110/1110 pass); M5 SURVIVED (1110/1110 pass); each restored by copy, `git status --short` clean. All match the reviewer and the implementer. `npm run e2e` not run (no scene/ui/e2e path changed).

Taken on trust: that `BoardScene`'s hooks visibly redraw on every call (live check).
