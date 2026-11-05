<!-- generated-by: heraklios/spec@0.1.0 -->
# §59 spec — Computer players use unit swaps

Accepted intent: [intent.md](intent.md)

Written against `main` at `d32aa80`.

The owner's answers to the design questions (2026-11-05, "1 all, 2
dedicated heuristic, 3 re-measure thresholds"): every difficulty swaps; the
planning difficulties value a swap with a dedicated heuristic; the seeded
strength tests take the new games and their thresholds are re-measured.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `README.md` "Swapping places with a neighbour" (`:315-343`) | The swap rule this intent leaves untouched, and the bullet "**The computer never swaps**, at any difficulty (Random included) … A later intent (§59)" that this intent replaces |
| `README.md` "Computer opponent" (`:848-`), the difficulty table (`:885-891`) | Random's row "(never a unit swap …)" changes; the other rows gain what they do with a swap |
| `src/engine/heuristicAgent.ts:203-205` | `// §54: this agent never plans a unit swap (a later intent may teach it), so it never sees one — including at the 'random' difficulty.` `legal = legal.filter((a) => a.kind !== 'landSwap');` — the filter this intent removes |
| `src/engine/movement.ts:167-183` `swapStep` | Legality and each unit's cost (`costA`, `costB`); `null` whenever `state.allowSwaps` is false |
| `src/engine/actions.ts:220-225`, `:472-473` | `legalActions` offers each swappable pair once, as `{ kind: 'landSwap', unitId, otherId }` with `otherId > unitId`, in the movement phase only |
| `src/scenes/BoardScene.ts:3090-3097` | The scene already applies a computer `landSwap` and logs `log.computerSwaps` (`"${seat}: ${a} and ${b} swap places."`), "Unreachable until §59" |
| `src/engine/combatOdds.ts:74-80` `unitValue` | "land unit: no partial damage state": a land unit is never "weakened" by damage, so the heuristic's sense of weak is exposure, defined in B5 |
| `plan-history.md` §6.4, §6.9, §6.14 | The four tiers, why the fourth is bounded, and the tuning record the re-measured thresholds join |
| `docs/research/` | Nothing: the swap is digital-only (§54), no print rule |

## Behaviour

**Who swaps**

- **B1.** With swaps on (`state.allowSwaps`), a computer seat at **any**
  difficulty (Random, Greedy, Expected value, Cautious) may choose a
  `landSwap` from the options `legalActions` offers in its movement phase.
  The `landSwap` filter in `HeuristicAgent.chooseNextAction` is removed.
- **B2.** **Random** picks uniformly among all legal options, swaps included,
  exactly as `RandomAgent` already does for the fuzz harness (no weighting).
- **B3.** With swaps off, `legalActions` offers no `landSwap`, and every
  difficulty plays exactly as on `main` at `d32aa80`: the same seed gives the
  same game, action for action.

**How the planning difficulties value a swap (dedicated heuristic)**

A swap is scored in the same points (purchase points) as every other
candidate, and competes with the moves and the end-of-phase in
`chooseMovementAction`. It is not scored as two moves: the pair's hexes stay
the same, so approach and terrain are not its terms. Its score is the sum
of:

- **B4. Contact (Greedy, Expected value, Cautious).** The gain in the pair's
  attack: the best attack value available to each unit from the hex it
  would stand on after the swap, minus the same from where it stands now,
  summed over both units, times a `swapContact` weight. "Best attack value
  from a hex" is the existing `bestAttackValueFrom` measure under the tier's
  own scoring (`expectedDefenderLoss` for Greedy, `expectedValue` for the
  others), with `charged = false` (a swap is never a charge), priced with
  **both** units standing in their swapped hexes (today's
  `bestAttackValueFrom` displaces only the one unit it prices, which would
  leave two units on one hex). This is "bring the stronger attacker into
  contact".
- **B5. Shelter (Expected value, Cautious; Greedy is blind to its own risk,
  as for moves).** The fall in the pair's exposure, times a `swapShelter`
  weight. A unit's **exposure** on a hex is the expected value of the
  strongest immediate enemy attack against that unit there, priced by the
  same opponent model Cautious already uses for its reply check
  (`enemyThreatAgainstUnit`). Exposure is taken only for a unit on, or
  swapping onto, a hex under enemy zone of control; elsewhere it is 0. This
  is "pull an exposed unit out of the enemy's reach and put a sturdier one
  there".
- **B6. Cautious** additionally applies its existing reply check to a swap
  candidate (if the swap survives its candidate cut, `LOOKAHEAD_CANDIDATE_LIMIT`):
  the marginal threat after the swap, against **both** units, discounted by
  `LOOKAHEAD_REPLY_WEIGHT` as for a move.
- **B7.** A swap is taken only when it is the best candidate and its score is
  at least `minMoveScore`, the same gate as a move. Ties keep the existing
  rule (the `legalActions` order, or the injected `rng`).
- **B8. No swap straight back.** The contact and shelter terms are
  differences between the swapped and unswapped placements, so swapping a
  pair back scores the negation of the swap just made (the board otherwise
  unchanged) and is never taken. A test proves this on a position where the
  first swap scores above the gate.
- **B9. Cost is bounded.** A swap candidate costs at most two
  `bestAttackValueFrom` calls per unit and, at Expected value and Cautious,
  exposure probes only for front-line pairs (B5). The planning tiers cap how
  many swap candidates get exposure probes per choice (a named constant, set
  in the plan, in the style of `LOOKAHEAD_CANDIDATE_LIMIT`), taking the best
  by contact score first.
- **B10.** Both weights (`swapContact`, `swapShelter`) join
  `HeuristicWeights` with defaults in `DEFAULT_WEIGHTS`, documented like the
  others ("worth as much as N points of army"); a test can override each to
  isolate its term.

**What the players see**

- **B11.** A computer's swap is logged as a human's companion line already
  is (`log.computerSwaps`, English and French, existing text) and the board
  shows both units in their new hexes; the scene comment "Unreachable until
  §59" goes.
- **B12.** A computer swap is undoable on the same terms as its other moves
  (no new boundary: no die roll, no phase change).

**Seeded tests (re-measured)**

- **B13.** The seeded self-play and tier tests (`heuristicSoak.test.ts`,
  `fuzzHarness.test.ts`, `heuristicAgent.test.ts`) run with swaps on, take
  the new games, and keep their claims: games complete and stay
  invariant-clean, replay identically from a seed, and the tier orderings
  they assert (EV ≫ Random from either seat, EV > Greedy and Cautious >
  Greedy seat for seat, Cautious not measurably worse than EV). Each numeric
  threshold and each "Measured at …" comment is re-measured on the new
  games and updated, with the old and new numbers in the plan's Progress.
- **B14.** If a re-measured ordering no longer holds (for example EV no
  longer beats Greedy), it is not loosened to pass: the implementer stops
  and it goes to the owner as a decision.

**Documentation**

- **B15.** `README.md`: the "The computer never swaps" bullet is replaced by
  what each difficulty does with a swap; Random's table row drops "(never a
  unit swap …)"; the planning rows say they swap to bring a stronger attacker
  into contact and (Expected value, Cautious) to pull an exposed unit out of
  reach.

## Interpretations

- **"Weakened unit" (intent's open question).** A land unit has no damage
  state (`unitValue`: "land unit: no partial damage state"), so "pull a
  weakened unit out of an enemy ZOC" is read as "pull the more **exposed**
  unit out", exposure as in B5. Recorded as a code comment at the shelter
  term.
- **"Bring the strongest attacker into contact."** Read as the gain in the
  pair's best available attack (B4), not as raw attack strength, so the
  terrain, range and river hexsides between the unit and its target count,
  as they already do for a move's strike term.

## Acceptance criteria

- **AC1** — B1, B2: with swaps on, an agent at each difficulty can return a
  `landSwap`; Random returns one from a position whose only legal non-end
  actions are swaps (test: `heuristicAgent.test.ts`).
- **AC2** — B3: with `allowSwaps: false`, a fixed seed's full action trace
  equals a trace recorded on `main` at `d32aa80` before the change, at each
  difficulty (test: a fingerprint in `heuristicSoak.test.ts` or
  `heuristicAgent.test.ts`, captured first, per the plan).
- **AC3** — B4: a position where swapping brings a stronger attacker
  adjacent to an enemy (and no move does better): Greedy, Expected value and
  Cautious swap; with `swapContact: 0` they don't (test:
  `heuristicAgent.test.ts`).
- **AC4** — B5: a position where one unit of a pair is exposed in enemy ZOC
  and the other would be less exposed there: Expected value and Cautious
  swap; Greedy doesn't; with `swapShelter: 0` neither does (test).
- **AC5** — B6: a Cautious-only case where the reply check turns a swap
  Expected value takes into one Cautious declines (test), or, if no such
  position exists on the shipped map, the plan records the search and
  replaces it with a test that the reply check is applied to swap candidates.
- **AC6** — B7, B8: a swap below `minMoveScore` is not taken; after a swap
  the agent never chooses the reverse swap of the same pair in that phase
  (test).
- **AC7** — B9: the swap candidate cap is pinned downward (setting it to 0
  fails a test), as `LOOKAHEAD_CANDIDATE_LIMIT` is; the soak's run time stays
  inside the 60 s `testTimeout` (`vitest.config.ts`) (test: the soak itself).
- **AC8** — B13: the soak and tier tests pass with swaps on, and at least
  one soak game contains a computer `landSwap` at each planning difficulty
  (test: a counter in the soak's stats, asserted > 0).
- **AC9** — B14: the plan's Progress lists every re-measured number, old and
  new (manual check by the reviewer).
- **AC10** — B11, B12: in a real game the computer's swap is logged and drawn,
  and Undo restores it (live check, rule 3; e2e if the plan finds a scenario
  can force a computer swap deterministically).
- **AC11** — B15: README updated (review pass 7).

## Non-functional

- **Engine/presentation split:** all choice logic in
  `src/engine/heuristicAgent.ts` (and helpers in `src/engine/`), with tests;
  `BoardScene.ts` only loses the "Unreachable until §59" comment.
- **Save format:** unchanged (no `GameState` field; `allowSwaps` is §54's).
- **Undo boundaries:** none new.
- **AI / harness:** `legalActions` and `applyAction` unchanged; the fuzz
  harness already applies and checks `landSwap`
  (`fuzzHarness.ts:1250-1255`); the soak gains a swap counter (AC8).
- **Performance:** B9; the 60 s test timeout is the ceiling, the plan
  measures before and after.

## Out of scope

- Any change to the swap rule (`swapStep`), the option, or the human UI.
- Naval swaps (ships never swap, §54).
- Planning a swap followed by a move as one plan; each is its own choice.
- Tuning the existing weights, or making Cautious stronger than EV.
- An AI that decides when to turn the option on or off.

## Assumptions I made

- **"One action per unit" (the intent's third design question):** no
  change needed. The agents keep no per-unit action tally; `legalActions`
  already charges each unit its step cost (`swapStep`'s `costA`/`costB`) and
  offers whatever moves remain. A unit may move after a swap if it has the
  points, as a human's can.
- Random's uniform choice may swap often in dense formations (each adjacent
  pair is one option). That is the owner's "all" and the fuzz driver's
  existing behaviour, so it is not weighted down.
- Exposure is limited to units in or entering enemy ZOC (B5) to keep the
  cost bounded; a unit outside every enemy ZOC can still be attacked by
  archers at range 2, which the term ignores. If the plan finds that
  matters, it says so.
- The two new weights' default values are the plan's to set by measurement,
  not the spec's.
- Live check owed by rule 3 (watching the computer swap in a real game,
  AC10); the review decides.
