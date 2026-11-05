<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §59 plan — Computer players use unit swaps

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (feature only)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Every computer difficulty can choose a `landSwap` when swaps are on (spec
B1-B2): Random as one more uniform option, and Greedy, Expected value and
Cautious by a dedicated swap score of **contact** (B4) plus, for the
risk-aware tiers, **shelter** (B5), with Cautious's reply check over both
units (B6). With swaps off the computer plays exactly as today (B3, proven by
a trace fingerprint captured before any code changes). The seeded soak and
tier tests take the new games with re-measured thresholds (B13), stopping for
the owner if a tier ordering breaks (B14). README and the one scene comment
follow (B11, B15).

## Risks

- **A crash on the new action kind.** `movingUnitId` throws for any kind it
  doesn't list (`heuristicAgent.ts:998-1007`), and `applyMovementLookahead`
  calls it on every candidate (`:749`). A swap candidate reaching the
  lookahead unhandled would throw mid-game. Subtask 3 handles `landSwap`
  there explicitly, and AC1's Cautious test reaches it.
- **Tests that pass whatever the code does** (this repo's recurring class).
  Each term gets a test whose position makes it decisive, and a weight-zero
  twin that flips the outcome (AC3, AC4), so deleting the term fails a test.
  The cap is pinned downward (AC7), as `LOOKAHEAD_CANDIDATE_LIMIT` is.
- **Swap back and forth.** B8's antisymmetry holds only if the unswapped side
  is priced under the same conditions as the swapped side (`charged = false`
  on both, the same board otherwise). Subtask 2 builds both sides the same
  way; AC6 tests the reverse swap directly.
- **Two units on one hex while pricing.** `bestAttackValueFrom` moves only
  the unit it prices (`:556-573`). Contact is priced on a normalized clone
  with the swap applied, never by displacing one unit (spec B4).
- **The lint cap (21).** `heuristicAgent.ts` is about 470 code lines against
  `max-lines: 500` with comments skipped (`eslint.config.js:36`), and
  `chooseMovementAction` is near `max-lines-per-function: 80`. The swap
  scoring goes into a new `src/engine/swapScoring.ts`, and the agent's
  candidate gathering into one new short private method, so no new warning
  appears. `npm run lint` must stay at 21.
- **Performance.** Exposure probes call `legalActions` for the enemy on a
  clone, the expensive part. They're limited to front-line pairs (B5) and
  capped (B9). The soak must stay under the 60 s `testTimeout`
  (`vitest.config.ts`); the per-test durations go in Progress, before and
  after.
- **The tier orderings may not survive the new games** (B14). It's a real
  possibility: Random swapping often, or the planning tiers swapping where it
  doesn't help. The implementer measures, and stops with the numbers rather
  than loosening an assertion or tuning the weights (tuning is out of scope).
- **Stale line citations.** All lines below are re-read on `main` at
  `0214862`; the implementer re-checks them before editing.

## Verified against the codebase

Re-read on `main` at `0214862`.

- `src/engine/heuristicAgent.ts:201-206` — `chooseNextAction`: the §54 comment and `legal = legal.filter((a) => a.kind !== 'landSwap');` before the `'random'` delegation (B1, B2).
- `heuristicAgent.ts:87-124` — `HeuristicWeights` (approach, terrainDefense, zocPenalty, strike, minAttackValue, minMoveScore) and `DEFAULT_WEIGHTS`; `strike: 1`, `minMoveScore: 0.05` (B7, B10).
- `heuristicAgent.ts:171` — `const LOOKAHEAD_CANDIDATE_LIMIT = 8;`, with its "only pinned downward" comment (`:164-170`), the model for the swap cap (B9).
- `heuristicAgent.ts:389-465` — `chooseMovementAction`: `enemyZoc = hexesUnderZoc(state, activeOwner)` (`:408`), the `legal.forEach` switch over `landMove`, `navalMove`, `ram`, `navalRotate` with `default: return;` (so a `landSwap` is silently dropped today), then `applyMovementLookahead` for `'lookahead'` (`:458`) and the `minMoveScore` gate (`:461`).
- `heuristicAgent.ts:556-573` — `bestAttackValueFrom(state, unit, to, charged)`: displaces `unit` only; scores `expectedDefenderLoss` for greedy, `expectedValue` otherwise via `combatScoringMode()`.
- `heuristicAgent.ts:734-754` — `applyMovementLookahead`: the top `LOOKAHEAD_CANDIDATE_LIMIT` by score, `movingUnitId(candidate.action)`, `enemyThreatAgainstUnitAfter`, minus `LOOKAHEAD_REPLY_WEIGHT * marginalThreat`.
- `heuristicAgent.ts:760-763` — `enemyThreatAgainstUnitAfter` returns 0 when `cloneAfterDeterministicMovementAction` returns `null`.
- `heuristicAgent.ts:788-815` — `enemyThreatAgainstUnit(board, unitId)`: the max over enemy owners of the best `'ev'` combat reply targeting `unitId`, plus a ram reply; mutates `board.phase`/`activePlayerIndex`, so it must get a clone (the exposure term, B5).
- `heuristicAgent.ts:874-886` — `cloneAfterDeterministicMovementAction`: clones for `landMove`, `navalMove`, `navalRotate`; `default: return null` (a `landSwap` gets no reply check today).
- `heuristicAgent.ts:902-909` — `normalizedThreatProbeClone`: `structuredClone`, then `defendedThisPhase = false`, `charged = false` on every unit.
- `heuristicAgent.ts:998-1007` — `movingUnitId`: throws `"<kind>" is not a movement-phase candidate action` for anything but the four movement kinds (exported, tested at `heuristicAgent.test.ts:797`).
- `src/engine/actions.ts:69`, `:201-217`, `:220-225`, `:472-473` — the `landSwap` action, its `applyAction` path via `swapStep` (clears `charged`), and `legalActions` offering each pair once, movement phase only.
- `src/engine/movement.ts:167-183` — `swapStep`: `null` when `!state.allowSwaps`, the costs otherwise.
- `src/engine/turnManager.ts:13`, `:24` — `allowSwaps = true` by default in the initial state, so harness games have swaps on.
- `src/engine/fuzzHarness.ts:892` (`trace?: string[]`), `:901` (`buildInitialState?`), `:922` (`createAgent?`), `:927-945` (`formatAction`, including `landSwap:<a><-><b>`), `:1171` (`stats.actionsByKind[action.kind]++`), `:1250-1257` (the swap invariant).
- `src/engine/fuzzHarness.test.ts:1035-1045` — the "no landSwap with the option off" pattern (`buildFuzzGameState()`, `state.allowSwaps = false`).
- `src/engine/heuristicSoak.test.ts:30-56` (`agentFor`, `playSeries`), `:94-104` (the replay test), and the asserted numbers at `:160-161`, `:192` (`randomTotal * 1.75`), `:206-207`, `:291-292` (`evInSeat0 * 0.75`), `:310-311`, with their "Measured at …" comments (`:118-`, `:165`, `:255-`).
- `src/scenes/BoardScene.ts:3090-3099` — the "Unreachable until §59" comment and the `landSwap` case, which applies, reports, renders and logs `log.computerSwaps` the same way as a computer `landMove` (`:3080-3088`).
- `src/ui/i18n/en.ts:259`, `fr.ts:243` — `computerSwaps`, existing text.
- `README.md:315-343` ("Swapping places with a neighbour", the bullet "**The computer never swaps** …" at `:342-343`), `:881-891` (the difficulty table; Random's row at `:887`).
- `eslint.config.js:36-37` — `max-lines` 500 and `max-lines-per-function` 80, both skipping comments; tests exempt (`:52-55`).

## Subtasks

1. **Characterise before changing (B3, AC2).** Add a test to
   `heuristicSoak.test.ts`: for each difficulty (`random`, `greedy`, `ev`,
   `lookahead`), play seed 7 both seats at that difficulty with
   `buildInitialState` setting `allowSwaps = false`, collect `trace`, and
   compare `sha256(trace.join('\n'))` (`node:crypto`) and `trace.length` with
   constants recorded **from the unchanged code**. Also run the soak and tier
   tests once and record every asserted number and "Measured at" figure, plus
   per-test durations, in Progress as the baseline. Commit (verify green, no
   source change).
2. **`src/engine/swapScoring.ts` (B4, B5, B8, B9).** Pure functions, no class
   state, no Phaser:
   - `swappedClone(state, action)`: a probe clone with `defendedThisPhase`
     and `charged` cleared (as `normalizedThreatProbeClone`) and the swap
     applied with `applyAction`;
   - `contactGain(before, after, ids, attackFrom)`: the sum over the two unit
     ids of `attackFrom(after, unit)` minus `attackFrom(before, unit)`, where
     both boards have `charged = false` and `attackFrom` is a callback the
     agent provides (its own `bestAttackValueFrom` at the unit's current
     position);
   - `shelterGain(before, after, ids, exposure)`: the sum of `exposure(before,
     id)` minus `exposure(after, id)`, where `exposure` is a callback (the
     agent's `enemyThreatAgainstUnit` on a fresh clone of the board given),
     and returns 0 without calling it when neither unit's hex is in the
     enemy-ZOC set it is given, before or after;
   - the cap constant `SWAP_PROBE_LIMIT` (start at 4), with an "only pinned
     downward" comment.
   Unit tests for it in `swapScoring.test.ts`. Commit.
3. **Wire it into `HeuristicAgent` (B1, B2, B4-B7, B10).**
   - Remove the `landSwap` filter (`:203-205`); Random then sees swaps (B2).
   - Add `swapContact: 1` and `swapShelter: 1` to `HeuristicWeights` and
     `DEFAULT_WEIGHTS`, each documented in purchase points like `strike`.
     1.0 is the honest reading in the same currency as `strike: 1`; they are
     not tuned (spec, Out of scope).
   - A new private `swapCandidates(state, legal, enemyZoc)`, called from
     `chooseMovementAction` after its `forEach`. It scores contact for every
     offered swap. At `'ev'` and `'lookahead'` it adds shelter for the best
     `SWAP_PROBE_LIMIT` by contact score. It returns `Scored` entries
     (`order` = index in `legal`).
   - `applyMovementLookahead`: a `landSwap` candidate gets its reply check
     over **both** units (B6). Add `landSwap` to
     `cloneAfterDeterministicMovementAction`, sum the marginal threat for
     `unitId` and `otherId`, and keep `movingUnitId`'s behaviour for every
     other kind. Don't make `movingUnitId` return one id for a swap.
   - The shared `minMoveScore` gate and `pickBest` apply unchanged (B7).
   Commit.
4. **Behaviour tests in `heuristicAgent.test.ts`** (AC1, AC3-AC6), with
   `makeUnit`/`makeGame` positions; see Tests. Commit.
5. **Re-measure the seeded tests (B13, B14, AC7, AC8).** Run
   `heuristicSoak.test.ts`, `fuzzHarness.test.ts` and
   `heuristicAgent.test.ts`.
   - Update each changed "Measured at …" figure and threshold to the new
     games, keeping each assertion's direction. Ordering tests stay
     orderings; a ratio threshold is re-derived from the new measurement
     with the same margin the old comment explains.
   - Add one assertion per planning tier that its series made at least one
     swap (`actionsByKind.landSwap`).
   - Record old and new numbers and durations in Progress (AC9).
   - **If an ordering fails, stop.** Report it, with the numbers, and commit
     nothing that weakens it (B14).
   Commit.
6. **Docs and the scene comment (B11, B15).**
   - `BoardScene.ts:3090-3091`: replace "Unreachable until §59 …" with a
     one-line note that computer seats choose swaps (§59).
   - `README.md`: replace the "The computer never swaps" bullet with what each
     difficulty does. Drop "(never a unit swap …)" from Random's row, and add
     the swap to the other rows: contact for Greedy, and contact and shelter
     for Expected value and Cautious, with Cautious also checking your reply
     against both units.
   - `heuristicAgent.ts` header table: one line on swaps.
   Commit; set `status: in-review`; Progress entry.

## Tests

- **AC1 (B1, B2):** a position where the only non-end legal actions are swaps:
  `new HeuristicAgent({ difficulty: 'random', rng })` returns a `landSwap`.
  For each planning tier, a position where a swap is clearly best returns it.
  The Cautious case exercises `applyMovementLookahead` with a swap candidate.
  Mutating the filter back in fails all of them; dropping the `landSwap` case
  from the lookahead makes the Cautious test throw.
- **AC2 (B3):** subtask 1's fingerprints, written against the old code; any
  change to swaps-off play fails them.
- **AC3 (B4):** a pair where a strong attacker stands behind a weak one
  facing an enemy archer, and no ordinary move reaches better. Greedy, EV and
  Cautious swap; with `weights: { swapContact: 0 }` they don't (each tier).
- **AC4 (B5):** a front-line pair, both in enemy ZOC after the swap, with
  equal contact (e.g. two units with the same attack but different defence).
  EV and Cautious swap the sturdier unit forward; Greedy doesn't; with
  `swapShelter: 0`, EV doesn't. Mutating the ZOC short-cut to "always 0" fails
  it.
- **AC5 (B6):** a position where the swap's shelter gain is outweighed by a
  reply against the unit moving forward: EV swaps, Cautious doesn't. If no
  such position can be built on the shipped map (the implementer records the
  search in Progress), replace it with a test that a swap candidate's score at
  Cautious is lowered by `LOOKAHEAD_REPLY_WEIGHT` times the summed marginal
  threat, with a spy-free check through `weights` and a constructed reply.
- **AC6 (B7, B8):** a swap scoring below `minMoveScore` (contact gain 0.01 by
  construction, or `minMoveScore: 1e9`) is not taken. After the agent swaps a
  pair (AC3's position), applying it and asking again never returns the
  reverse swap of that pair. Removing `charged = false` on the unswapped side,
  if it makes the sides asymmetric, must fail this test.
- **AC7 (B9):** `SWAP_PROBE_LIMIT` set to 0 fails AC4. The soak runs within
  60 s, with durations recorded.
- **AC8 (B13):** the swap-count assertions per planning tier in the soak.
- `swapScoring.test.ts`: `contactGain` and `shelterGain` are exact negatives
  for the reverse swap. `shelterGain` doesn't call `exposure` off the front
  line (a counting callback). `swappedClone` leaves the input state unchanged.
- `movingUnitId`'s existing tests stay green unchanged.

## Validation

- `npm run verify` green, lint at 21 (cap unchanged), test count reported.
- `npm run check:intent` PASS (or FAIL only on an owed live check).
- `npm run e2e`: the review runs it, since `src/scenes/BoardScene.ts` is
  touched (a comment). No new scenario is planned: forcing a computer swap
  deterministically through the canvas would need a purpose-built position in
  `testMode.ts`, which is out of scope.
- **Live check (owed by rule 1 for the scene file, and rule 3 for AC10):**
  1. `npm run dev -- --port 5259 --strictPort --host 127.0.0.1` in the
     worktree, with `HERAKLIOS_SAVES_DIR` set to a temp folder.
  2. On the Menu, leave Unit swaps on and set one seat to the computer at
     Expected value. Start a game and play until the armies meet.
  3. Watch the log for "<seat>: A and B swap places." and the two units
     trading hexes on the board.
  4. Press Undo after the computer's turn and see what it restores, comparing
     it with a computer move's undo.
  5. Repeat briefly at Random: swaps appear among its moves.

## Assumptions I made

- Seed 7 and one game per difficulty are enough for the fingerprint. It's a
  trace equality, not a statistic, so any difference fails it. More seeds
  only cost time.
- `SWAP_PROBE_LIMIT` starts at 4, half of `LOOKAHEAD_CANDIDATE_LIMIT`,
  because each probe is a full enemy `legalActions` on a clone. The soak
  durations decide whether that's affordable. Raising it is not a behaviour
  change a test can object to (the same reasoning as `:164-170`).
- Contact uses the tier's own combat scoring (`combatScoringMode()`), so
  Greedy's contact counts enemy loss only, matching how it scores moves.
- Exposure uses `enemyThreatAgainstUnit`, which already maxes over enemies
  and adds rams. It runs on a fresh clone per call because it mutates the
  board's phase.
- No new `HarnessStats` field: `actionsByKind.landSwap` already counts swaps.
- The scene needs no code change: its `landSwap` case already does what a
  computer move does (`BoardScene.ts:3080-3099`).
- Tier: Attested by the path table (`src/engine/**`, plus a comment in
  `src/scenes/`).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-05 - subtask 1: characterise before changing (baseline, unchanged code)

No source change. `heuristicSoak.test.ts` gains four swaps-off fingerprint
tests (seed 7, both seats at the difficulty, `allowSwaps = false`),
constants recorded from the unchanged code:

| difficulty | trace length | sha256 of `trace.join('\n')` |
| --- | --- | --- |
| random | 118 | ca1d38335e373b4198e06ba92f4b7bd4827dcb894535f4a912288f94708949cd |
| greedy | 92 | 995c3ee87774013a5592e6a3fef7ab9734b960bd5455c266152f9a03739d9fe1 |
| ev | 72 | e95c6828ceb1ef961682861593601ebafce1187b5955127a55c34c4d7cb5cbb0 |
| lookahead | 58 | 662a47ec8a048e059a553b39dd5fcbb811d899e816e42634e87d3328ac0a8e3b |

Baseline material (sum of surviving army value over seeds 1-12, seat0/seat1;
measured now on the unchanged code, so some differ from the stale "Measured
at" comments in the file):

| series (seat0 vs seat1) | material | landSwap actions |
| --- | --- | --- |
| ev vs pure-random | 570 / 325 | 0 |
| pure-random vs ev | 180 / 450 | 0 |
| ev vs greedy | 400 / 140 | 0 |
| greedy vs ev | 275 / 290 | 0 |
| lookahead vs ev | 355 / 280 | 0 |
| ev vs lookahead | 330 / 345 | 0 |
| lookahead vs greedy | 370 / 125 | 0 |
| greedy vs lookahead | 285 / 295 | 0 |
| ev vs ev | 330 / 335 | 0 |
| pure-random vs pure-random | 490 / 550 | 2 |

(The soak's heuristic seats filter swaps out today; the pure-random control
already swaps, as the harness's RandomAgent always did.) Heuristic EV-vs-random
ratio 1020/505 = 2.02. Baseline per-test durations (soak file): self-play
889 ms, combined attacks 1982 ms, replay 216 ms, fingerprints 86-224 ms each,
EV vs random 2410 ms, EV vs greedy 1894 ms, lookahead vs ev 3152 ms,
lookahead vs greedy 3848 ms.

### 2026-11-05 - subtasks 2 to 6: swaps for the computer, shipped

Commits (branch `feat/59-ai-unit-swaps`): `cdc5db1` (subtask 1, above),
`408ecf5` (subtask 2: `swapScoring.ts` + `swapScoring.test.ts`), `0441aa5`
(subtasks 3 and 4 together: `HeuristicAgent` wiring + behaviour tests; the
two old section-54 "never swaps" tests could not stay green between them),
`5d8c971` (subtask 5: soak re-measure), and the final commit (subtask 6:
docs, the extra B6 test, Progress, `status: in-review`).

What shipped: `src/engine/swapScoring.ts` (`swappedClone`, `contactGain`,
`shelterGain`, `isFrontLinePair`, `scoreSwaps`, `SWAP_PROBE_LIMIT = 4`);
`HeuristicAgent` without the `landSwap` filter, `swapContact: 1` and
`swapShelter: 1` weights, one short private `swapCandidates`, `landSwap` in
`cloneAfterDeterministicMovementAction`, and a module-private
`threatenedUnitIds` so the Cautious reply check covers both units of a swap
(`movingUnitId` is unchanged and still throws on a swap); the scene comment;
README bullet and table rows; the `heuristicAgent.ts` header line.

Tests: 1183 on main, 1205 after (+22: 4 swaps-off fingerprints, 1 greedy
soak presence test, 7 in `swapScoring.test.ts`, and +10 in
`heuristicAgent.test.ts`, 38 to 48, where the two section-54 "never swaps"
tests became 12 swap tests). Lint stays at 21 warnings; `heuristicAgent.ts` gained no
new one.

Soak and tier numbers, old (unchanged code, from subtask 1) to new (swaps on),
12 seeds, material seat0/seat1:

| series | old | new | swaps (new) |
| --- | --- | --- | --- |
| ev vs pure-random | 570 / 325 | 570 / 325 | 0 |
| pure-random vs ev | 180 / 450 | 180 / 450 | 0 |
| ev vs greedy | 400 / 140 | 410 / 135 | ev 6, greedy 0 |
| greedy vs ev | 275 / 290 | 270 / 310 | ev 2, greedy 0 |
| lookahead vs ev | 355 / 280 | 355 / 280 | ev 1, lookahead 0 |
| ev vs lookahead | 330 / 345 | 350 / 355 | ev 4, lookahead 1 |
| lookahead vs greedy | 370 / 125 | 365 / 180 | not counted per tier |
| greedy vs lookahead | 285 / 295 | 295 / 295 | not counted per tier |
| ev vs ev | 330 / 335 | 350 / 345 | 5 |
| pure-random vs pure-random | 490 / 550 | 490 / 550 | 2 (unchanged) |

Assertions: EV vs random ratio 1020/505 = 2.02x (floor 1.75x, headroom 15.4%,
unchanged); EV beats Greedy seat for seat (410 > 270 and 310 > 135); Cautious
vs EV 355/350 (101.4%) and 355/280 (126.8%), floor 0.75x unchanged; Cautious
beats Greedy seat for seat (365 > 295 and 295 > 180). No ordering broke, so
B14 did not trigger and no threshold or weight was changed. The "Measured at"
comments in `heuristicSoak.test.ts` were stale before this work (they matched
an older roster); they now carry the figures above, and say what the code
just before Â§59 measured.

Swap presence per tier (AC8): the soak tests count swaps per tier with a
counting subclass. EV swaps (8 in the ev/greedy series), Cautious swaps (1 in
the lookahead/ev series). Greedy did NOT swap in any of the 12-seed series nor
in 60 greedy mirror games; it swaps in 1 of 60 games as seat 0 against EV (seed
24), so a dedicated one-game test pins that seed (`playSeries('greedy', 'ev',
1, 24)`). Swaps are rare in self-play at every planning tier (a plain move
toward the enemy usually outscores them); the targeted tests carry the
behaviour.

Durations (soak file, loaded machine, ms; old then new): self-play 889/972,
combined attacks 1982/2232, replay 216/383, fingerprints 86-224/101-267, EV vs
random 2410/3213, EV vs greedy 1894/2370, lookahead vs ev 3152/4015, lookahead
vs greedy 3848/4819, greedy swap test (new) 83. All far under the 60 s
timeout; the whole suite runs in about 57 s.

AC5: the Cautious-only position exists on the shipped map, so no fallback test
was needed: a spearman with archers (exposed to an elephant at 2.33) on the
front hex, a plain spearman behind (1.67 if moved forward). EV swaps (shelter
net +0.67), Cautious declines (0.75 of the 1.67 reply outweighs it). A second
test puts the forward-moving unit on the `otherId` side.

Mutants (back up by copy, one change, full `npx vitest run`, restore by copy;
`git status --short` clean afterwards), all killed:
- M1 restore the `landSwap` filter: 12 tests fail (all of AC1, AC3-AC6, the
  swaps-off random fingerprint, two soak tests, `seatControl.test.ts`);
- M2 `contactGain` returns 0: 7 fail (contact test, AC6 pair, the greedy soak
  presence test, three `swapScoring` tests);
- M3 `shelterGain` returns 0: 6 fail (shelter and B6 tests, a soak test, three
  `swapScoring` tests);
- M4 `SWAP_PROBE_LIMIT = 0`: 5 fail (shelter, B6, a soak test, two
  `swapScoring` tests);
- M5 `landSwap` dropped from `cloneAfterDeterministicMovementAction`: 1 fails
  (the B6 "EV swaps where Cautious declines" test);
- M6 reply check over `unitId` only: survived the first test set; added the
  `otherId`-side B6 test, now killed;
- M7 Greedy gets shelter: killed (shelter test);
- M8 `isFrontLinePair` always true: killed (`swapScoring` no-call test);
- M9 contact counts only the after side (reverse swap not negated): 4 fail
  (AC6 straight-back, three `swapScoring` tests);
- M10 shelter weight ignored: 2 fail;
- M11 the lookahead calls `movingUnitId` on a swap (throws): 10 fail.
Not mutated (no test can see it): clearing `charged` in `probeClone` for the
priced boards, since `bestAttackValueFrom` already forces `charged = false`
and `defendedThisPhase` is false in every constructed test position.

Divergences from the plan:
- Subtasks 3 and 4 are one commit (see above).
- The `SWAP_PROBE_LIMIT` cap is applied to front-line pairs only (best by
  contact, then `legal` order), not to all offered swaps: a non-front-line
  pair costs no probe anyway, so ranking it into the cap would only waste a
  slot. Same bound, spirit of B9.
- `contactGain` and `shelterGain` live in `swapScoring.ts` as planned, plus a
  `scoreSwaps` that holds the gathering (cap, per-unit caches of the unswapped
  side) so the agent's private method is a single call; the exposure callback
  clones the board each time because `enemyThreatAgainstUnit` mutates it.
- The tests use `{ swapShelter: 0 }` or `{ swapContact: 0, swapShelter: 0 }`
  as the twin where the plan said `{ swapContact: 0 }`, because at Expected
  value and Cautious shelter alone can carry the swap; each term is isolated
  on its own.
- The soak greedy presence is a dedicated one-game series (see above) because
  natural series never held a Greedy swap.
