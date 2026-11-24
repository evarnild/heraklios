<!-- generated-by: heraklios/review@0.2.0 -->
# §73 review — The Board scene and its computer seats settle combats through the engine session

verdict: rework
tier: attested
reviewed-commit: 1ea16c9
round: 1
sampled: no
run: auto
live-check: owed

One MEDIUM finding: the new e2e fixture loader reads the game before the
load lands, and it went red in full runs. There are also three LOW test gaps,
each shown by a surviving mutant. Every finding that needs rework is
mechanical ("Needs rework:"). Nothing needs the owner's decision. The engine
side is strong: 29 of 33 engine mutants were killed, and the other 4 are
explained below.

The coordinator's re-check corrected one claim in the review: mutant S18 is
**killed**, not equivalent (see "Verified myself").

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | ROUTE, with the reason justified below |
| 3 | Rulebook fidelity | pass (one LOW note) |
| 4 | Tests prove the rule | findings (4) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass (LOW notes) |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository footguns | pass |
| 10 | Architecture | pass (one LOW note) |

## Type check
```
type-check: ROUTE (intent 73, refactor)
  route: Declared refactor, but existing tests lost lines (src/engine/drift.test.ts, src/engine/gameSession.test.ts). Behaviour may have changed — check, or route to feature.
  note:  33 file(s), 3140 line(s) changed outside intents/.
exit: 2
```

**Why the ROUTE is accepted.** Every lost line was read.

- **`drift.test.ts`:** only its import block, because `resolveElephantDrift`
  and `DriftStats` moved to `driftReference.ts`.
- **`gameSession.test.ts`:**
  - two import lines and one title rename;
  - three event-list expectations that now include the new `retreat` event
    (`:346`, `:376`);
  - `:310`'s two-`push` list, now filtered to `push` events. The new events
    are pinned separately in `sessionSeams.test.ts`.

No rule assertion was weakened. `fuzzHarness.test.ts`, `combat.test.ts`,
`harnessPinned.test.ts` and the soak tests are unchanged against `main`.

## Findings

- **MEDIUM** `e2e/combatFixtures.ts:105-109`: `loadFixture` reads the state
  before the in-place load has happened.
  - After the Load click it waits for `scenes().includes('Board')` and
    `waitIdle`. Both are already true before the save arrives over HTTP
    (`SaveLoadPanel.loadFrom` awaits `readSave`). This is the race §86 fixes
    in `save-load.spec.ts`, copied into the helper all nine new scenarios use.
  - Scenario (g) reads at once and has the same race.
  - Observed red: the reviewer's first full run, and the coordinator's
    scene-survivor baseline (`Expected: "combat" Received: "movement"` at
    `combatFixtures.ts:109`).
  - Needs rework: before reading, wait for the load itself. For example, wait
    with `page.waitForFunction` until `state().phase === 'combat'` and the unit
    ids equal the fixture's, or until the log holds the `Game loaded.` entry.
    That is §86's signal; use its shared `waitLoaded` helper if §86 has merged.
- **LOW** `src/scenes/BoardScene.ts:2205`: no test covers a computer seat's
  pushed-link wording. Mutant S07 (drop
  `if (question.kind === 'pushTarget') this.pushedThisCombat.add(...)` in
  `onForced`) survives the full e2e.
  - Needs rework: add a variant of scenario (c) using the `PUSH` fixture with
    the defender's seat a computer (`seatControls`).
  - Assert `nowhereToRetreat`, then `mustRetreatRoom`, then
    `retreatsMakingRoom`, with no `retreats.` line.
- **LOW** `src/scenes/BoardScene.ts:234`: nothing checks that the drift
  display ends after the drift's last step. Mutant S15
  (`if (!this.combat?.pending?.drift) this.endDriftDisplay(true)` →
  `if (false) …`) survives.
  - Needs rework: in scenario (d), at the `'advance'` stop, assert
    `driftArrow()` is `null` and `busy()` doesn't contain `driftState`.
- **LOW** `src/engine/combatResolution.ts:376,378`: the `onEvent` contract
  ("exactly `SessionStep.events`, in order") is unit-tested only on a push
  position.
  - E10 (`driftStarted` via `events.push`) survives vitest; only e2e (d)
    kills it.
  - E11 (`driftCombat` the same way) survives everything.
  - Needs rework: extend `sessionSeams.test.ts`'s "onEvent receives exactly
    the events of each step" to an elephant position
    (`buildElephantScenarioGameState`, or `sessionPause.test.ts`'s
    `trampleScript`). That kills E10 and E11.
- **LOW** `src/engine/combat.test.ts:91`, `src/engine/fuzzHarness.test.ts:145`:
  comments still name the removed `BoardScene.promptAdvanceChoice` and
  `beginUnitRetreatChoice`. Worth a look: the check already ROUTEs for test
  edits, so fixing the two comments costs nothing.
- **LOW** `README.md:398-400`: O3's refusal ("select no more units than
  needed") narrows the rulebook's "unités attaquantes totalisant une force au
  moins égale" (`docs/research/05-rules-french-original.md:235-237`). It is
  documented in place, with a code trace at `BoardScene.ts:2423`. Worth a
  look: whether this owner-decided divergence also belongs in "Known
  simplifications" (`README.md:1095`).
- **LOW** `docs/architecture.md`: the "two drivers" exception row is gone, yet a
  test-only copy of the old pump stays in `src/engine/driftReference.ts`, and
  `fuzzHarness.ts:10` imports it. The plan calls retiring it "a follow-up",
  but no intent records that. Worth a look: file the follow-up intent.

**The implementer's deviations.**
- **Deviation 6** (the board drawn once after an exchange's losses) is
  mechanical. It matches `main`'s `executeLandAttack` exchange path, and the
  intent's "the web game plays the same" decides it. No test pins it; the
  live check covers it.
- **Deviation 8** (the §72 spec Amendment note) is what plan subtask 4 asks
  for, and its content is accurate.

## Not checked
- **Visual drift pacing in the Drawn view at Normal speed.** e2e runs with
  animations off.
- **Render timing at an exchange** (deviation 6, mutant S09). It is visual,
  and no test pins it.
- **A human retreat prompt during a computer seat's elephant drift.**
  Scenario (g) covers a plain retreat only.
- **Error surfacing from a computer agent that throws mid-settlement**
  (mutant S04).
- **That the nine characterisation scenarios passed on the unchanged scene
  at `01daea6`.** Not re-run at that commit. Its diff touches only `e2e/` and
  `devHook.ts`, and later commits only add asserts.

## Live check
- **owed:** rule 1 (`src/scenes/**`, `src/ui/**`). The smoke suite can't stand
  in, because O3's refusal is new behaviour and the drift beats are visual.
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/73-boardscene-on-session`, run
     `npm run dev -- --port 5273`, then open `http://localhost:5273/`.
  2. In the Combat test mode, use the Standard view, then repeat in the
     Drawn view at Normal speed.
  3. **Retreat and advance.** Melee until a DR. The retreat hexes are
     highlighted, even when only one exists. Click one, then answer the
     advance panel.
  4. **Exchange.** Get an EX with 2–3 combined units.
     - Confirming too little force is refused.
     - Selecting every unit when fewer would do is refused with "Select no
       more units than needed …".
     - A minimal set disappears only after Confirm, then the advance offers
       appear.
  5. **Drift.** Make an elephant drift.
     - Each "▶ Continue" shows that beat, one hex at a time, with the arrow
       following the elephant.
     - A trample logs its combat, then the trampled unit's retreat prompt
       appears with no "must retreat" line.
     - The arrow is gone once the drift ends.
  6. **Guards.** With a retreat prompt open, and at a Continue pause, press
     Ctrl+Z, Save/Load and End phase. Each refuses with its "Resolve the
     pending …" message.
  7. **Computer seat.** In a game with a computer seat:
     - its attacks and drifts resolve without waiting for Continue;
     - a retreat prompt for your units during its turn waits for your click;
     - it still pauses after each combat;
     - the console stays clean.
- **you should see:** the same play as on `main`, except that the exchange
  panel refuses a selection with a unit to spare.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `1ea16c9`:**
- `npm run verify`: exit 0, 17 lint warnings (cap 17), 107 test files,
  `Tests 1792 passed | 2 skipped (1794)`.
- `npm run check:intent`: the ROUTE above.
- Full `npm run e2e`, twice:
  - run 1: 54 passed, 1 failed (combat-resolution (a), the fixture race);
  - run 2: 54 passed, 1 failed (`save-load.spec.ts:57`, §86's flake).

  `combat-resolution.spec.ts` alone passed 9/9. The implementer's claimed
  55/55 was not reproduced.
- **Engine mutants** (E01–E33, `scratchpad/mut/engine.json`):
  - 29 killed, each by a named test;
  - E10, E11, E12 and E19 survive vitest;
  - E10 is killed by e2e (d);
  - E12 and E19 are equivalent: across 2000 elephant seeds with pauses on,
    no last step carried events, and `pending.question` is always null on
    the drift branch.
- **Scene mutants** (S01–S18). Killed: S01, S03, S05, S06, S10, S11, S12,
  S13, S14 and S16. Reported surviving: S02, S04, S07, S08, S15 and S17 (S09
  inconclusive). Reported equivalent: S18.
- Pass 9: `harnessPinned.test.ts` and the fuzz/soak tests are unchanged and
  green, and E32 breaks 57 pinned traces. Headless traces are
  byte-identical.
- Measured sizes:
  - `BoardScene.ts` 3169 → 2835, ceiling lowered;
  - `combatResolution.ts` 487;
  - `drift.ts` out of the baseline;
  - lint cap 18 → 17.
- `sdlc:scan --sample-due auto --exclude 73`: `sampled: no` (the 16th
  attested auto change).

**Coordinator, re-run, at `1ea16c9`** (same worktree, same commit,
2026-11-24 22:45–23:45):
- **Coordinator, re-run:** `npm run verify`. Exit 0, 17 warnings,
  `Test Files 107 passed`, `Tests 1792 passed | 2 skipped (1794)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. The same ROUTE, exit 2.
  Matches.
- **Coordinator, re-run:** full `npm run e2e`. `54 passed`, `1 failed`
  (`save-load.spec.ts:57`). Matches the reviewer's run 2.
- **Coordinator, re-run:** engine survivors E10, E11, E12 and E19 against
  the full vitest suite. All four SURVIVED (1792 passed). Matches.
- **Coordinator, re-run:** scene survivors against every e2e spec except
  `save-load`, with `--retries=1`.
  - S02, S04, S07 and S17: SURVIVED (each run had one flaky retry).
    Matches.
  - S08, S09 and S15: reported KILLED by the harness, but the only failure
    in each was `placement.spec.ts:39` "Turn buttons", which timed out on
    both tries under load (§89's flake). A Board-scene mutant can't affect
    Placement, so these count as SURVIVED, matching the reviewer for S08
    and S15. S09 stays inconclusive.
- **Coordinator, re-run, the mismatch:** S18 (`BoardScene.ts:2154`,
  `this.decisionPending = true;` removed).
  - The reviewer said it was equivalent and survived. The coordinator found
    it **KILLED** by `e2e/rules-panel.spec.ts:54`, "the Tables panel: tabs,
    Escape, a highlight that follows the attack, …".
  - In the full suite it failed on both tries.
  - In a targeted run (`--repeat-each=2`, `rules-panel` and
    `combat-resolution`) it failed 2 of 2, while the unmutated baseline
    passed 2 of 2.
  - `decisionPending` is not redundant with `combat`: the Tables panel's
    suppression depends on it. The run stopped on this (`auto_stopped:
    re-check mismatch`, 2026-11-24). The owner's `/auto 73` resumed it, and
    this report records the corrected result. No finding changes.
- **Coordinator, re-run:** after every mutant, `git status --short` was
  clean and HEAD still `1ea16c9`. Files were restored by copy; `git
  checkout --` was never used.

**Mutants the rework is expected to kill** (round 2's re-check):
- S07, by the computer-defender push scenario;
- S15, by the asserts at (d)'s advance stop;
- E10 and E11, by the drift `onEvent` unit test;
- the fixture race, with three consecutive clean full e2e runs (apart from
  the known §86 save-load and §89 placement flakes).

**Taken on trust:**
- that the nine characterisation scenarios were green at `01daea6`;
- the implementer's `npx playwright install chromium`.
