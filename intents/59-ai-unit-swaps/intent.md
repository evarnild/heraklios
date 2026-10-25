<!-- generated-by: heraklios/intent@0.1.5 -->
# §59 — Computer players use unit swaps

**Type:** feature
**Originator:** the owner (2026-10-25), deciding §54's review: "a for 54 and
prepare an intent to handle swaps for computer players"
**Source:** `intents/54-land-unit-swap/review.md`, round 1, the Needs-decision
finding (owner chose (a): in §54 the computer never swaps)

## Problem

§54 lets two adjacent friendly land units swap places (on by default), and
offers the swap to the AI as a `landSwap` action in `legalActions`. But every
computer seat is a `HeuristicAgent` (`src/engine/seatControl.ts:74`), and it
filters `landSwap` out at every difficulty, Random included
(`src/engine/heuristicAgent.ts:202-205` on the §54 branch). So a human can
rotate a tired front line or bring a stronger unit forward in one action, and
the computer can't, even at the difficulties that plan their moves. The
owner wants the computer to use swaps too.

## Outcome

- With swaps on, computer seats can choose a `landSwap`, at the difficulties
  the spec decides (at least Random; the planning tiers Greedy, Expected value
  and Cautious when a swap scores better than the moves they consider today).
- A computer's swap is logged like a human's (`log.computerSwaps`, already
  written by §54 and unreachable until now), and the board shows it.
- With swaps off, computer play is unchanged: the same seeds give the same
  games as before.
- The README's AI section says which difficulties swap and how.

## Constraints

- **Depends on §54** (the `landSwap` action, `swapStep`, the option); build
  after §54 is merged.
- **Engine only:** the choice lives in `src/engine/heuristicAgent.ts` (and its
  scoring helpers) with tests; the scene already applies and logs an AI swap.
- **Determinism:** seeded games stay reproducible; existing seeded tests that
  run with swaps on may change their game and must be judged one by one
  (spec decides whether such a test pins swaps off or takes the new game).
- **No rule change:** the swap's legality stays §54's `swapStep`.
- **Performance:** the AI's per-turn cost must stay bounded (the Cautious
  tier already clones the board per candidate move).
- Live check likely owed by rule 3 (watching the computer swap in a real
  game); the review decides.

## Type-specific questions

### Feature
- **Users:** the AI seat (and the hotseat players who face it).
- **Rulebook basis:** digital-only, as §54's swap.
- **Known simplification it removes:** none (README gains a line).
- **Open design questions:**
  - Which difficulties swap: Random only, or also Greedy, Expected value and
    Cautious?
  - How the planning tiers value a swap: as the two one-hex moves it is
    (scoring each unit's new hex the way they score a move), or with a
    dedicated heuristic (bring the strongest attacker into contact, pull a
    weakened unit out of an enemy ZOC)?
  - Whether a swap counts against the "one action per unit" bookkeeping the
    agents use when assembling a turn.
  - How existing seeded AI tests that now see swaps are handled.

## Assumptions I made

- Swaps follow §54's rules exactly; this intent only changes who chooses
  them.
- Tier: Attested by the path table (`src/engine/**` not listed as Reviewed).
