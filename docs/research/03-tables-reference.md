# Tables reference

Plain-reference copy of the game data, cross-checkable against
`src/data/*.ts`. Stats read directly off the physical counters; naval tiers
(Galères/Birèmes/Trirèmes/Quintirèmes) were disambiguated by matching each
counter-sheet stat block's unit *count* against the purchase table's known
quantity cap for that type (a unique match for all four).

## Unit roster

| Unit | Cost | Max qty | Melee atk | Ranged atk | Range | Defense | Move |
|---|---|---|---|---|---|---|---|
| Archers | 5 | 10 | 0 | 2 | 2 | 1 | 3 |
| Fantassins | 5 | 10 | 2 | — | — | 1 | 3 |
| Fantassins-Archers | 10 | 8 | 2 | 2 | 2 | 2 | 3 |
| Fantassins Lourds | 10 | 8 | 4 | — | — | 3 | 2 |
| Phalanges | 15 | 5 | 8 | — | — | 5 | 3 |
| Cavalerie Légère | 5 | 10 | 3 | — | — | 2 | 6 |
| Cavalerie Lourde | 10 | 8 | 6 | — | — | 4 | 4 |
| Éléphants | 10 | 10 | 8 | — | — | 5 | 4 |
| Chars Légers | 5 | 8 | 4 | — | — | 3 | 6 |
| Chars Lourds | 10 | 8 | 8 | — | — | 5 | 4 |
| Galères | 10 | 6 | 10 | — | — | 10 | 8 |
| Birèmes | 20 | 5 | 15 | — | — | 15 | 6 |
| Trirèmes | 30 | 3 | 20 | 2 | 2 | 20 | 6 |
| Quintirèmes | 50 | 1 | 25 | 2 | 2 | 25 | 4 |

Army budget: **400 purchase points** per player.

## Terrain effects

| Terrain | Move cost | Combat modifier | Forbidden to |
|---|---|---|---|
| Plaine | 1 | +0 | — |
| Rivière normale | 2 | +1 | — |
| Rivière large | 3 | +2 | non-galley ships |
| Flancs abrupts | 3 | +2 if attacking from below, else +0 | chariots, cavalry |
| Plateaux | 1 | +2 if attacking from below, else +0 | — |
| Marais | 2 | +1 | chariots, cavalry, elephants |
| Sea | — | — | land units |

## Land Combat Results Table

Columns: attacker:defender ratio. Rows: 1d6 (+ terrain modifier, clamped
to the table's row range).

|     | 1:5 | 1:4 | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 | 6:1 |
|---|---|---|---|---|---|---|---|---|---|---|
| **1** | AR | AR | DR | DR | DR | DR | DR | DE | DE | DE |
| **2** | AE | AR | AR | DR | DR | DR | DR | DR | DE | DE |
| **3** | AE | AE | AR | AR | DR | DR | DR | DR | DE | DE |
| **4** | AE | AE | AR | AR | AR | DR | DR | DR | DR | DE |
| **5** | AE | AE | AE | AR | AR | AR | DR | DR | DR | EX |
| **6** | AE | AE | AE | AR | AR | AR | AR | EX | EX | EX |

AE = attacker eliminated · AR = attacker retreats · DE = defender
eliminated · DR = defender retreats · EX = exchange (both sides'
engaged units eliminated, conditional on attacker force ≥ defender force).

## Naval ramming table

Cell = die values on 1d6 that succeed.

| Attacker ↓ / Defender → | Galère | Birème | Trirème | Quintirème |
|---|---|---|---|---|
| Galère | 1,2,3 | 1,2 | 1,2 | 1 |
| Birème | 1,2,3 | 1,2,3 | 1,2 | 1 |
| Trirème | 1,2,3,4 | 1,2,3 | 1,2,3 | 1,2 |
| Quintirème | 1,2,3,4,5 | 1,2,3,4,5 | 1,2,3 | 1,2,3 |

Success = target ship sunk outright.

## Naval boarding table

Rows: 1d6. Columns: attacker:defender force ratio. `—` = not decisive
(no effect). `A-n`/`D-n` = attacker/defender loses n equipment points
(each point = -5 attack / -5 defense; 0 equipment = ship destroyed).

| die\ratio | 1:3 | 1:2 | 1:1 | 2:1 | 3:1 | 4:1 | 5:1 |
|---|---|---|---|---|---|---|---|
| **1** | D-1 | D-1 | D-2 | D-2 | D-3 | D-3 | D-4 |
| **2** | — | D-1 | D-1 | D-2 | D-2 | D-2 | D-3 |
| **3** | — | — | D-1 | D-1 | D-1 | D-2 | D-3 |
| **4** | A-1 | — | — | — | D-1 | D-1 | D-2 |
| **5** | A-2 | A-1 | A-1 | A-1 | A-1 | D-1 | D-2 |
| **6** | A-2 | A-2 | A-2 | A-2 | A-1 | A-1 | D-1 |
