# Rules transcription

Transcribed from the scanned rulebook pages (*Jeux & Stratégie* #6, pp.
16, 33-35), credited to François Marcela-Froideval, 1980. Original
French retained for rule text with the French game terms; commentary/
clarification added inline in English where useful. This is the same
source material `src/data/` and `src/engine/` are built from. See
[05-rules-french-original.md](05-rules-french-original.md) for the full
verbatim French text this was transcribed from.

## Setup

**Players:** 4. Each player represents one of four armies (athénienne,
perse, macédonienne, spartiate) — cosmetic only, no stat differences
between armies.

**Materials:** a coastal Mediterranean-style hex map, die-cut counters,
and a six-sided die.

**Scale:** each hex = 100 meters of terrain. Each game turn = 20 minutes of
real time.

**Goal:**
- Preserve your own forces while destroying the others'.
- Alliances between armies are permitted at any point during play.
- At game end, the player whose army has the greatest value (counted in
  purchase points — see below) is the winner.
- A time limit is set for the whole game, plus a per-player time limit for
  each turn's decisions (the rulebook suggests e.g. 3 minutes/turn).

### Army purchase system

Each player has **400 purchase points** to build an army from the shared
unit list (see [03-tables-reference.md](03-tables-reference.md) for the
full list with costs and quantity caps).

### Placement on the map

Building a naval force is entirely optional — a player may field a
land-only army. Once a player's army (land, and optionally naval) totals
exactly 400 purchase points, it's time to place it on the map.

All of a player's units must be placed along their assigned edge of the
map, within a strip no more than **3 hexes wide**. Units of two different
armies may never start in contact, land or naval — a minimum gap of
**4 hexes** must separate two different armies at the start.

Each player rolls a die; the two highest rolls choose between the East and
West edges, the two lowest split North and South. Ties are re-rolled.
Players then agree among themselves (or, failing agreement, decide by
chance) which of the four named armies (athénienne, perse, macédonienne,
spartiate) each will play — the map edge is fixed by the die roll above,
but which army occupies it is a separate choice. Once edges and armies
are settled, each player deploys their fleet (if any) in the
corresponding named sea zone (medium-blue on the map):
- army on the **west** edge → **Anse d'Hypnos**
- army on the **south** edge → **Pointe d'Eole**
- army on the **north** edge → **Baie d'Argos**
- army on the **east** edge → **Cap Zénon**

At the start of the game, no ship may be placed in the coastal fringe
(light blue) or in open/high seas (dark blue) — only in its assigned
medium-blue deployment zone.

## Turn structure

Each game turn consists of all 4 players taking their turn in sequence.
Each player's turn has **two phases**: a **Movement phase**, then a
**Combat phase**. So one full game turn = 4 players × 2 phases = 8 phases
total.

### Reading a counter

Each physical counter shows four numbers around a central unit icon:
- top-left: melee attack value
- top-right: ranged attack value, in parentheses, followed by range (e.g.
  "0 (2) 2" = melee attack 0, ranged attack 2, range 2 hexes)
- bottom-left: defense value
- bottom-right: movement allowance

Units with a ranged attack value of 0 must fight in melee (adjacent) only.

## Movement

During the Movement phase, each player may move any or all of their units,
each up to its own movement allowance.

**Stacking:** a unit may never end its move on a hex already occupied by
another unit. It *may* pass through a hex occupied by a friendly unit
mid-move.

**Zone of control (ZOC):** every unit projects influence into the six
hexes surrounding it — its "zone of control." Rules governing ZOC:
- A unit may enter an enemy ZOC hex at no extra movement cost, but it may
  **not** continue moving once inside — it must stop there for the
  remainder of that movement phase.
- A ZOC does **not** cross rivers.
- A retreating unit may never be forced to retreat into an enemy ZOC hex.
- A unit that starts a movement phase already inside an enemy ZOC may not
  move directly to a different hex still within that same ZOC — it must
  first exit the ZOC entirely, then may re-enter (and immediately stop
  again) elsewhere.

### Terrain effects on movement

| Terrain | Move cost/hex | Notes |
|---|---|---|
| Plaine (plain) | 1 | — |
| Rivière normale (normal river) | 2 | |
| Rivière large (wide river) | 3 | Only galleys may enter |
| Flancs abrupts (steep flanks) | 3 | Chariots & cavalry forbidden |
| Plateaux (plateau) | 1 | |
| Marais (marsh) | 2 | Chariots, cavalry, elephants forbidden |

Sea is impassable to land armies entirely. When two terrain types occupy
the same hex, only the predominant one applies.

## Land combat

Combat is declared during the Combat phase. Multiple friendly units may
(and are encouraged to) combine to attack a single enemy unit, as long as
each attacking unit satisfies its own weapon-range requirements to reach
the target. **Ranged units (archers) may only fire at *exactly* their
listed range** — not "up to" that range; melee-capable hybrid units
(fantassins-archers) may fight either adjacent or at their exact range.
A unit may only be attacked once per combat phase.

**Resolving an attack:**
1. Sum the attack values of all attacking units; sum the defense values of
   all defending units on the target hex.
2. Compute the force ratio (attacker:defender), rounding in the
   **defender's** favor to the nearest of the table's listed ratios
   (1:5, 1:4, 1:3, 1:2, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1) — e.g. attack 5 vs.
   defense 3 = 5:3, rounds down to 1:1.
3. The attacker rolls 1d6, then adds the terrain modifier for the
   defender's hex (see below).
4. Cross-reference the (possibly modified) die value against the force
   ratio column on the Combat Results Table.

### Combat Results Table

Columns = attacker:defender ratio, rows = 1d6 (plus terrain modifier):

| die\ratio | 1:5 | 1:4 | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 | 6:1 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | AR | AR | DR | DR | DR | DR | DR | DE | DE | DE |
| 2 | AE | AR | AR | DR | DR | DR | DR | DR | DE | DE |
| 3 | AE | AE | AR | AR | DR | DR | DR | DR | DE | DE |
| 4 | AE | AE | AR | AR | AR | DR | DR | DR | DR | DE |
| 5 | AE | AE | AE | AR | AR | AR | DR | DR | DR | EX |
| 6 | AE | AE | AE | AR | AR | AR | AR | EX | EX | EX |

- **AE** (Attaquant Éliminé) — attacking units are removed from the game.
- **AR** (Attaquant Recule) — attacking units retreat one hex.
- **DE** (Défense Éliminée) — defending units are removed from the game.
- **DR** (Défense Recule) — defending units retreat one hex.
- **EX** (Échange) — the defending units are removed, and the attacking
  units are *also* removed, unless the attacking units' total force is at
  least equal to the defenders'.

A unit forced to retreat with nowhere legal to go (blocked by sea, enemy
ZOC on all sides) is simply eliminated — **unless** it's surrounded
entirely by friendly units, in which case it "pushes" one friendly unit
aside and takes its hex instead. Whenever a combat forces a retreat, the
attacker may optionally advance into the hex the defender vacated
(announced immediately, and that decision is final).

### Terrain effects on combat

Modifier is added to the attacker's die roll, based on the **defender's**
hex terrain:

| Terrain | Modifier |
|---|---|
| Plaine | +0 |
| Rivière normale | +1 |
| Rivière large | +2 |
| Flancs abrupts | +2 if the attack comes from a lower hex, else +0 |
| Plateaux | +2 if the attack comes from a lower hex, else +0 |
| Marais | +1 |

### Phalanxes, cavalry, and charges

- **Archers** fire at 2 hexes' range; archer-infantry hybrids can also
  fight adjacent.
- **Phalanxes** are lance-armed formations (5-7m lances); cavalry may
  **never** attack them, whether by charge or ordinary attack.
- **Cavalry**: if a cavalry unit uses its full movement allowance moving
  in a straight line and ends adjacent to an enemy unit, that's a
  **charge**, doubling its attack value (×2 for light cavalry, per the
  counter's printed attack — light cavalry charges to 6, heavy to 12).
  Any other cavalry attack is an ordinary attack at its printed value.

### Elephants

Elephants fight normally in combat. But whenever an elephant unit is
forced to retreat (as attacker *or* defender), it does **not** retreat
normally — it becomes uncontrollable and "drifts" instead:
1. The elephant's owner rolls 1d6 to pick one of the 6 hex directions.
2. The elephant moves in a straight line in that direction for a number of
   hexes equal to its full movement allowance.
3. It combats (damages) **every** unit — friend or enemy — on its path.
4. If it's forced to retreat again later, roll again for a new random
   direction.
5. If it drifts off the edge of the map, or into the sea, it's eliminated.

## Naval combat

Two distinct sub-systems apply to ship-vs-ship combat: **ramming**
(éperonnage) and **boarding** (abordage). Two differences from land combat
throughout: the results tables are different, and ships project **no**
zone of control.

### Naval movement

Three shades of sea are marked on the map: coastal fringe (light blue),
mid-sea (medium blue, the deployment zones), and high seas (dark blue).
Only **galleys** may enter the coastal fringe or a wide river; all larger
ships are restricted to mid/high sea. A non-galley ship that ends up in
the coastal fringe or a wide river for any reason is immediately removed
from the game.

Ships have a **facing** (the direction their bow points) and can only
leave a hex through the side their bow faces. Rotating the facing costs
movement points at a rate of 1 point per 60° turn (so a 180° reversal
costs 3 points). Movement and rotation may be freely interleaved until the
ship's movement allowance is exhausted.

### Ramming

A ramming attempt happens when, during its movement, a ship's path brings
it into contact with an enemy ship — the attacking angle (bow-on, broadside,
or stern) doesn't matter for eligibility, but the ship's **remaining
movement points at the moment of contact** determine the die roll needed:
- If the galley finishes its full movement allowance without reaching an
  adjacent hex to the target: no ramming attempt occurs.
- If it reaches contact with movement points still unspent: each unused
  point (up to a maximum of 2) becomes a "bonus" that widens the die range
  counted as a success — e.g. 1 unused point → succeeds on a 1 or 2; 2
  unused points → succeeds on 1, 2, or 3.
- If it reaches contact exactly on its last point of movement: succeeds
  only on a roll of 1.

**Ramming success table** — die values (out of 1d6) that count as a
successful ram, by attacker ship type (rows) vs. defender ship type
(columns):

| Attacker ↓ / Defender → | Galère | Birème | Trirème | Quintirème |
|---|---|---|---|---|
| Galère | 1-2-3 | 1-2 | 1-2 | 1 |
| Birème | 1-2-3 | 1-2-3 | 1-2 | 1 |
| Trirème | 1-2-3-4 | 1-2-3 | 1-2-3 | 1-2 |
| Quintirème | 1-2-3-4-5 | 1-2-3-4-5 | 1-2-3 | 1-2-3 |

A successful ram **sinks** the target ship outright (the rulebook's worked
example: "la galère de l'attaquant coule la quintirème" — the attacking
galley sinks the quinquereme).

### Boarding

Boarding occurs when, after movement, two enemy ships end up side-by-side
(parallel, on contiguous hexes) rather than colliding bow-on. Combat is
resolved using the force ratio between the two ships (attacker's attack
value : defender's defense value) crossed with a 1d6 roll.

Each ship has an **equipment points** pool. The rulebook never states this
as an explicit starting formula — it only says each equipment point is
worth 5 attack + 5 defense, and losing one strips 5 from each; a starting
pool of `ceil(defense / 5)` is the natural reading of that (so a ship's
full defense value is "spent" exactly when its equipment reaches 0), but
treat it as a derived value to double-check against `src/data/` rather
than a verbatim rule. A boarding loss removes equipment points from the
losing side; each lost equipment point reduces that ship's attack **and**
defense by 5. A ship whose equipment points reach zero has no attack or
defense left and is
immediately removed from the game.

**Boarding results table** — rows are 1d6, columns are the attacker:defender
force ratio. Blank/pink cells mean the engagement isn't decisive (both
ships stay intact, try again another turn); `A-n`/`D-n` means the
attacker/defender loses `n` equipment points:

| die\ratio | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 |
|---|---|---|---|---|---|---|---|
| 1 | D-1 | D-1 | D-2 | D-2 | D-3 | D-3 | D-4 |
| 2 | — | D-1 | D-1 | D-2 | D-2 | D-2 | D-3 |
| 3 | — | — | D-1 | D-1 | D-1 | D-2 | D-3 |
| 4 | A-1 | — | — | — | D-1 | D-1 | D-2 |
| 5 | A-2 | A-1 | A-1 | A-1 | A-1 | D-1 | D-2 |
| 6 | A-2 | A-2 | A-2 | A-2 | A-1 | A-1 | D-1 |

## Victory conditions

The game ends when any one of the following occurs:
1. **Time limit reached** — each remaining player totals the purchase-point
   value of their surviving units; whoever has the highest total wins.
2. **Concession** — three of the four competitors abandon/concede.
3. **Last army standing** — only one army's units remain on the
   battlefield; that player is declared the winner.

Regardless of which of the above ends the game, a separate scoring bonus
applies at the final count: a player whose ships are the *only* ones left
at sea (all other players' fleets sunk or absent) adds a **+30 point
bonus** to their final total, on top of the purchase-point value of
whatever units they still have.
