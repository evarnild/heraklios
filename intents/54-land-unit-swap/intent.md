<!-- generated-by: heraklios/intent@0.1.5 -->
# §54 — Two adjacent friendly land units can swap places, as a game option

**Type:** feature
**Originator:** the owner (2026-10-24): "2 land units should be able to swap
positions, I know this is not part of the original rules but this would make
sense"
**Source:** none

## Problem

Two friendly land units next to each other can't trade places. A unit may
pass through a friendly unit's hex but never end its move there, so to swap
A and B a player needs a third, empty hex nearby and three moves, and often
there is none (a line of phalanxes, a unit pinned by an enemy zone of
control, a narrow pass). Reordering a formation, such as bringing a fresh
unit to the front, is then impossible or costs a whole turn.

The print rules forbid it on purpose: *"Une unité ne peut en aucun cas se
placer sur une case déjà occupée par une quelconque autre unité. Par contre,
au cours d'un mouvement, une unité peut traverser une case où se trouve une
unité de la même armée."* (`docs/research/05-rules-french-original.md:124-126`;
transcription at `docs/research/02-rules-transcription.md:88-90`, the
"Stacking" paragraph; README "Moving through your own units"). The owner
knows this and wants the swap as a digital-only addition.

## Outcome

- A new game option, chosen at setup next to the combat mode and **off by
  default**, allows swaps. With it off, the game plays exactly as today.
- With it on, in the Movement phase, a player can swap two of their own
  **land** units on **adjacent** hexes: each ends on the other's hex. Each
  unit must be able to enter the other's hex (terrain, river) and pays that
  one-hex move from its own remaining movement, as a normal move would.
- The swap is offered to the AI through `legalActions`/`applyAction` like any
  other move, it can be undone like a move, and the option is saved with the
  game (an old save loads with it off).

## Constraints

- **Rulebook:** a deliberate digital-only departure from the stacking rule
  above. The README gets a section saying so, with the quote, and that it is
  off by default (CLAUDE.md: record the interpretation where it is
  implemented).
- **Engine/presentation split:** the legality and the move in
  `src/engine/` (movement and `actions.ts`), with tests; the scene only wires
  the click.
- **Save format:** the option is new game state, so `engine/saveGame.ts`,
  `ui/saveStorage.ts` and `SAVE_VERSION` (now 3) change; older saves load
  with swaps off. This puts the change in the Reviewed tier
  (`REVIEW-POLICY.md` path table).
- **Undo:** a swap is one undo step (`history.push` before it).
- **AI / harness:** a new `Action` kind (or a variant of `landMove`) means
  `legalActions`, `applyAction`, the heuristic and random agents and the fuzz
  harness's invariants must know it; the harness should play with the
  option on and off.
- **Land only:** ships and naval movement are out of scope.
- A live check is owed (`src/scenes/`, `src/ui/`).

## Type-specific questions

### Feature
- **Users:** hotseat players; the AI seat (through `legalActions`).
- **Rulebook basis:** digital-only — the print rule forbids ending on a
  friendly hex (quoted above).
- **Known simplification it removes:** none (it adds a departure, listed in
  the README).
- **Open design questions:**
  - **Movement points:** does a unit that has already moved this phase
    still swap, if it has the points left? Does a swap end either unit's
    movement, or can they move on afterwards?
  - **Zone of control:** may a unit in an enemy ZOC swap (leaving one ZOC
    hex for another), and does the swap obey the usual ZOC stop?
  - **Special units:** elephants (drift), cavalry (does a swap count against
    a later charge's straight line and full movement?), phalanxes.
  - **The click:** how the player asks for a swap (select A, then click B,
    where B's hex is not a normal destination today), and how the board
    shows it.
  - **Placement phase:** whether swapping during placement is in scope too.
  - **The AI:** whether the heuristic agent should use swaps or only the
    random agent sees them.

## Assumptions I made

- **Owner's answers (2026-10-24):** a game option, off by default; an
  adjacent swap where each unit pays its one-hex move.
- The option lives with the other setup choices (`session.combatMode`'s
  menu toggle, `MenuScene.ts:65-68`) and in `GameState` like `combatMode`
  (`state.ts:164`).
- "Friendly" means the same player, as for passing through (README, "Same
  army means the same player").
- Tier: Reviewed, from the path table (save format), not raised by hand.
