<!-- generated-by: heraklios/spec@0.1.0 -->
# §54 spec — Two adjacent friendly land units can swap places, as a game option

Accepted intent: [intent.md](intent.md)

Written against `main` at `dd714ca`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/05-rules-french-original.md:124-126` | the print rule this departs from: *"Une unité ne peut en aucun cas se placer sur une case déjà occupée par une quelconque autre unité. Par contre, au cours d'un mouvement, une unité peut traverser une case où se trouve une unité de la même armée."* |
| `docs/research/02-rules-transcription.md:88-102` | stacking; ZOC: entering an enemy ZOC hex stops the unit; ZOC doesn't cross rivers; a unit starting in an enemy ZOC may not move directly to another hex of the same ZOC |
| `src/engine/movement.ts:75-147` (`reachableHexes`) | how a land step is legal: terrain (`canEnterTerrain`), river extra cost, movement left, the start-in-ZOC rule (`:105-113`), enemy hexes impassable, friendly hexes traversable but never a destination |
| `src/engine/actions.ts:237-259` (`landMove`), `:421` (`legalActions`) | the move the swap mirrors, and where the AI's options come from |
| `src/engine/state.ts:164-174` (`randomizedTurnOrder`), `src/scenes/MenuScene.ts:83-100` | the precedent for an off-by-default house rule chosen on the Menu and kept in `GameState` |
| `src/engine/saveGame.ts:24-30` | why `randomizedTurnOrder` needed no `SAVE_VERSION` bump: an absent field is falsy and means the old behaviour |
| README "Moving through your own units", "Same army means the same player" | friendly = the same `owner` |
| owner's answers, 2026-10-24 | a game option, off by default; an adjacent swap where each unit pays its one-hex move; with a unit selected, swappable neighbours are highlighted and a click swaps |

## Behaviour

**B1 — The option.** The Menu gets a toggle under the turn-order one:
"Unit swaps: off / on" (French in `fr.ts`), off by default. It is stored as
`GameState.allowSwaps: boolean` and in the session like
`randomizedTurnOrder`. With it off, nothing in movement, the AI or the board
changes.

**B2 — What a swap is.** In the Movement phase, with the option on, the
active player may swap two of their own living **land** units A and B on
**adjacent** hexes: A ends on B's hex and B on A's, in one action.

**B3 — When it is legal.** Each unit must be able to make the one-hex step
into the other's hex as a normal move, as if that hex were empty:
- the terrain allows its category (`canEnterTerrain`);
- the step's cost (the destination's terrain cost, plus the river extra if
  a river runs between the two hexes) is no more than its `movementLeft`;
- the start-in-ZOC rule: a unit starting its step in an enemy ZOC may not
  step into another hex controlled by any of the same enemy units.

If either step fails, the pair can't swap.

**B4 — What it costs and what follows.** Each unit pays its own step cost
from `movementLeft`. A unit whose new hex is in an enemy ZOC stops there, as
after entering a ZOC hex by a normal move (its later moves this phase follow
today's rules from that hex). Otherwise a unit may keep moving with what it
has left, before or after the swap. A swap is never a charge: it sets
`charged = false` on both units.

**B5 — The board.** With the option on and a land unit selected in the
Movement phase, each adjacent friendly unit it can swap with (B3) is
highlighted in its own colour, distinct from the reachable-hex highlight.
Clicking one swaps the two units; the selection clears. Clicking any other
friendly unit still selects it, as today; to select a highlighted neighbour
instead, the player deselects first (clicking the selected unit again). The
log says `<A> and <B> swap places.` A refused swap can't be clicked (it is
not highlighted).

**B6 — Undo.** A swap is one undo step, labelled `Swap <A> and <B>`, like a
move.

**B7 — The AI.** `legalActions` offers a new action `{ kind: 'landSwap',
unitId, otherId }` for each legal pair once (the lower id as `unitId`) when
the option is on and none when it is off; `applyAction` applies it and throws
on an illegal one, as `landMove` does. `RandomAgent` picks swaps like any
action; `HeuristicAgent` never chooses one (it skips the kind) and must not
throw on it. The AI's swap is logged as `<seat>: <A> and <B> swap places.`

**B8 — Saves.** `allowSwaps` is saved with the game. A save without it
(every save today) loads with swaps off. Following `saveGame.ts:24-30`,
`SAVE_VERSION` stays 3: an older build opening a newer save loses only the
option, and every position a swap produced is a legal position, so nothing
half-reads into a wrong game. The validator accepts `allowSwaps` absent or a
boolean, and refuses any other value.

**B9 — README.** A section next to "Moving through your own units" says the
swap is a digital-only house rule, quotes the print rule it departs from,
and says it is off by default.

## Interpretations

- **"Adjacent swap, each pays its one-hex move"** (owner): the step is
  judged unit by unit with the movement rules a one-hex move already obeys
  (B3), reading the other unit's hex as empty, because each unit really does
  end there. Movement points come from each unit separately.
- **ZOC.** The print ZOC rules are kept as they apply to a one-hex move: a
  unit leaving a ZOC hex is fine (the usual way to rotate a tired front
  line), a unit entering one stops there, and the start-in-ZOC rule still
  forbids sliding from one hex of an enemy's ZOC to another of the same
  enemy's ZOC.
- **No charge.** A cavalry charge needs a straight-line move at full
  movement (`evaluateCharge`); a one-hex swap is not one, so it never
  charges, and a unit that has swapped has spent movement, which a later
  charge already accounts for.
- **No `SAVE_VERSION` bump** (B8): the same reasoning the file records for
  `randomizedTurnOrder`.

## Acceptance criteria

- **AC1 — legality and cost** (`src/engine/movement.test.ts` or a new
  `swap.test.ts`): a new pure function (e.g. `swapStep(state, a, b)` →
  `{ costA, costB } | null`) is tested for: an open-ground pair (cost 1
  each); a pair across a river (river extra for both); terrain one unit
  can't enter (null); a unit with too little movement left (null); the
  start-in-ZOC rule (null when sliding along the same enemy's ZOC; allowed
  when stepping out); non-adjacent, enemy, naval or destroyed units (null);
  option off (null). Exact costs.
- **AC2 — the action** (`src/engine/actions.test.ts`): `legalActions` lists
  each legal pair once with the option on and none with it off;
  `applyAction` swaps positions, deducts each cost, clears `charged`, sets a
  ZOC stop as a move would, and throws on an illegal pair.
- **AC3 — AI and harness** (`fuzzHarness.test.ts`): seeded self-play with the
  option on completes with the harness's invariants (no two units on a hex,
  movement never negative) and does play at least one swap over the seeds
  tested; `HeuristicAgent` never returns a `landSwap`.
- **AC4 — saves** (`src/engine/saveGame.test.ts`): `allowSwaps: true`
  round-trips; a save without it loads as off; a non-boolean value is
  refused.
- **AC5 — e2e** (a new `e2e/swap.spec.ts`, through the dev hook): from a test
  mode with the option on, select a unit, see an adjacent friend
  highlighted for a swap, click it: positions are exchanged and the log says
  so; undo restores both; with the option off, the same click selects the
  other unit.
- **AC6 — live check** (owed: `src/scenes/`, `src/ui/`, new behaviour): turn
  the option on in the Menu, swap two infantry, swap a front-line unit out of
  an enemy ZOC, try a pair across a river with too little movement (no
  highlight), undo a swap, save and reload with the option on, and play a
  game with it off to see nothing offered.
- **AC7** — `npm run verify` green, lint ≤ 21, `npm run check:intent` PASS
  apart from the owed live check.

## Non-functional

- **Engine/presentation split:** legality, cost and the action in
  `src/engine/` (movement and `actions.ts`); the scene highlights and calls
  `applyAction`.
- **Save format:** one new optional boolean in `GameState` and the save; no
  `SAVE_VERSION` bump (B8). This is a save-format change: Reviewed tier by the
  path table.
- **Undo boundaries:** none new; a swap pushes history like a move.
- **AI / harness:** a new `Action` kind; `legalActions`, `applyAction`,
  `RandomAgent`, `HeuristicAgent` (skip) and the fuzz harness (option on for
  some seeds) know it.

## Out of scope

- Swapping ships, or a ship with a land unit.
- Swaps during placement.
- Swaps between non-adjacent units, three-way rotations.
- The heuristic AI using swaps (a later intent may teach it).
- Changing how a unit that entered a ZOC moves later in the phase (today's
  rule stands).

## Assumptions I made

- The names `allowSwaps`, `landSwap`, `swapStep`, and the Menu label
  "Unit swaps".
- The highlight colour is the implementer's choice, distinct from the
  reachable-hex and attack highlights.
- Elephants and phalanxes swap like any land unit; only the B3 rules apply.
- `legalActions` lists each pair once, ordered by unit id, so `RandomAgent`'s
  odds aren't doubled and replays stay deterministic.
- The heuristic agent skipping swaps keeps today's AI behaviour unchanged
  with the option on, apart from the random agent.
