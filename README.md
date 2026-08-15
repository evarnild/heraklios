# Héraklios (digital edition)

A browser-based, hotseat implementation of *Héraklios*, the 4-player ancient
hex wargame published as an insert in *Jeux & Stratégie* #6 (Dec 1980/Jan
1981, designed by François Marcela-Froideval). Built with TypeScript +
Phaser 3, rules and map data transcribed from a scan of the original
magazine.

## Running it

```
npm install
npm run dev
```

Then open the printed `localhost` URL in a browser. 2-4 players share one
screen/machine, taking turns.

```
npm test    # run the engine's unit tests (Vitest)
npm run build   # production build
```

## How to play

1. **Menu** — pick 2, 3, or 4 players, the land-combat rule variant
   (see "Combining attacks" below; defaults to several-vs-several),
   whether turn order should be re-randomized each turn (see "Turn order"
   below; defaults to off), an optional whole-game clock and/or round limit
   (see "Ending the game" below; both off by default), and which seats the
   computer should play (see "Computer opponent" below; defaults to all
   human).
2. **Army Builder** — each player spends 400 purchase points on units from
   the shared roster (archers, infantry, cavalry, chariots, elephants,
   phalanxes, and four tiers of warships), subject to per-unit quantity
   caps, one player at a time ("pass the device"). The budget must be spent
   exactly — "Confirm army" stays dimmed and inert while any points are
   unspent or overspent — and a "Use default army" button offers a
   ready-made 400-point army as a starting point that can still be
   hand-adjusted afterward.
3. **Placement** — each player deploys their purchased units within their
   randomly assigned edge's 3-hex-deep band (green highlight; see
   "Deployment zone position" below). Ships also let the placing player pick
   an initial facing (see "Naval movement and combat" below) instead of
   always starting bow-first in a fixed direction. Steps 2 and 3 are skipped
   for any seat the computer is playing — it buys and deploys its own army.
4. **Board** — turns proceed player by player, each running a Movement
   phase (click a unit, then a highlighted reachable hex) followed by a
   Combat phase. In the Combat phase: click friendly units to build an
   attacking group (blue highlight), click eligible enemy units to add them
   as targets (amber = eligible but not yet chosen, red = chosen), then
   click **"Resolve attack"** to roll the combined combat. When a result forces a retreat, the owning player picks the
   destination: legal hexes are highlighted blue — click one. If there's no
   legal hex to retreat to but at least one neighboring hex holds a friendly
   unit that can make room (either directly, or by pushing one of *its own*
   friendly neighbors in turn), those are highlighted amber instead — click
   one to have it retreat and make room. If *that* unit also has no direct
   retreat, the same choice repeats for it, cascading through as many links
   as needed until someone reaches a real hex; only once the whole chain is
   resolved does the original unit take the first hex vacated. A unit with
   no legal retreat and no friendly anywhere nearby able to make room is
   eliminated instead. **Elephants** are the exception: instead
   of a chosen retreat, a die roll picks a random direction and the elephant
   drifts that way, hex by hex, for its full movement allowance — the panel
   narrates each step, and every hex it enters that's occupied triggers a
   real combat (elephant vs. that unit) rather than an automatic kill; a
   result that would force the elephant itself to retreat instead re-rolls
   a new direction with whatever movement it has left, and it's eliminated
   outright if the drift would carry it out of the land zone — off the map,
   into the sea, or into a marsh, which elephants may never enter at all.
   When a
   **defender** retreats, or is eliminated outright (DE/EX), the attacking
   side is then offered the chance to advance a unit *adjacent to* that hex
   into it (see
   [Shooting](#shooting-melee-force-vs-projectile-force) for why a unit that
   shot from range doesn't get the offer). "End phase" advances movement →
   combat → the next player's
   movement. The game ends when only one army remains on the board, or by
   whichever of the clock, round limit, or "End game" button the table
   agreed to (see "Ending the game" below).

On both the Placement and Board screens, hovering any hex shows a small
tooltip with its coordinate and terrain type (e.g. "(4, 9) — Plateaux") —
useful for telling plain from plateau or marsh at a glance, or for pinning
down exactly which hex a rule, a bug, or a screenshot is talking about.

### Saving and loading

The Board's **💾 Save / Load** button opens a panel with six save slots plus a
separate autosave, each showing the turn, active player, phase and timestamp
so you can tell them apart. Saves live in the browser's `localStorage`, and
**"Export to file"** / **"Import from file"** round-trip a `.json` save for
backup, for moving between machines, or for handing a game to someone else.
The Menu's **"Charger une partie"** offers the same list (load and import
only) and drops you straight onto the board.

The game **autosaves at the start of each player's movement phase**, into its
own slot that manual saves never touch — so a closed tab or a browser crash
costs at most one turn. Saving is refused while a retreat or elephant drift is
still awaiting a choice: those sequences hold callbacks that can't be
serialized, so a save always lands on a stable position. It's also refused
mid-way through a computer seat's turn, which would otherwise capture a
half-finished position.

A save carries the whole session — the players and their assigned edges,
which seats are played by the computer and at what difficulty, the
combat-rule variant, every unit's position, facing, movement and damage, and
the per-phase record of which units have already attacked or rammed. Save
files made before computer seats existed still load, as the all-human games
they were; files made *since* won't open in an older build, which refuses
them rather than silently turning the computer's seats back into yours.
Loading a game clears the undo history, since undoing into a previous game's actions
would be meaningless.

### Undo and redo

Both the Placement screen and the Board have **↶ Undo / ↷ Redo** buttons
(also Ctrl+Z / Ctrl+Shift+Z, and Ctrl+Y for redo), labelled with the action
they'll take back — "Undo: Move fantassins", "Undo: Place archers". On the
board this covers moves, ship rotations, and building up an attack group
(selecting attackers and choosing targets), so a misclick that would
otherwise cost movement points is free to take back.

Two boundaries deliberately limit how far back it reaches:

- **A die roll is a commit point.** Rolling for a land combat, a ram, a
  boarding, or an elephant's drift direction discards the undo history, so a
  result can't be re-rolled by undoing and repeating the attack. (The Menu's
  test-mode shortcuts lift this, so the combat and drift code paths can be
  replayed while developing without starting a fresh game.)
- **Undo stops at the end of a phase**, so no player can rewind into another
  player's committed turn. During placement it's likewise scoped to the
  player currently deploying. A computer seat's turn is another player's
  turn by this rule: undo is unavailable while it plays, and picks up again
  from an empty history when your own phase begins.

Undo is also refused while a retreat, elephant drift, post-combat advance
offer, or exchange-sacrifice choice is still awaiting an answer — resolve it
first, the same rule "End phase" already follows. The advance-offer and
exchange-sacrifice panels are properly modal for the same reason: clicking
the board while one is open is ignored rather than (as in earlier builds)
silently falling through to select a unit or target underneath the panel.

### Abandoning a game

Army Builder, Placement, and the Board each have an **Abandon** button that
returns to the Menu — the only way back besides reloading the page, for a
misbuilt army, a misplaced unit, a wedged board, or one you just want to walk
away from. It's guarded by a confirm/cancel prompt (Phaser has no
`confirm()`, so this is a modal drawn on the canvas, not a browser dialog),
since it's the one control that discards in-progress work with no undo.
Unlike undo/redo/save-load/end-phase, it's deliberately available even mid
retreat/drift/advance/exchange-sacrifice choice — Abandon exists specifically
to escape a board wedged by exactly that kind of stuck state, so disabling it
in that situation would defeat its own purpose.

Abandoning does **not** clear the autosave: the game you just left is still
sitting in the Menu's **"Charger une partie"** > Autosave row if you change
your mind or abandoned by mistake, and it's overwritten the moment any other
game reaches the Board anyway.

### Deployment zone position

Per the rulebook, a player's units "must be placed along their assigned
edge of the map, within a strip no more than 3 hexes wide," with "a
minimum gap of 4 hexes" separating two different armies at the start
(`docs/research/02-rules-transcription.md`). The rulebook only bounds that
strip's *depth* — nothing limits how far along the edge a player may
spread out — so a player's legal placement area is simply their whole
edge's 3-hex-deep band, minus any hex within 4 of a unit an earlier player
has already placed (green highlight, live-updated as pieces go down; no
separate zone-picking step). Since every player is always assigned a
distinct edge (see the edge dice-off above), the 4-hex gap only ever
matters near a shared corner between two adjacent edges — opposite edges
(e.g. north vs. south) are always far enough apart on this map regardless
of where units sit.

If literally every hex on an edge is within 4 of an already-placed
neighbor (only possible on a very cramped edge), the gap constraint is
dropped rather than leaving the player with nowhere to click — see
`mapBounds.ts`'s `legalDeploymentHexes`, which is unit-tested
independently of the UI.

A fleet doesn't deploy in that land band at all: per the rulebook, each
edge has one specific named bay assigned to it (west → Anse d'Hypnos,
south → Pointe d'Eole, north → Baie d'Argos, east → Cap Zénon) and ships
may only start there, never in the coastal fringe or open sea. The
placement screen's highlight switches from the land band to that bay
(and the camera follows) once the player's queue reaches their first
ship — see `mapBounds.ts`'s `legalNavalDeploymentHexes`.

Within the land band, the highlight also respects each land unit's normal
terrain-access restrictions — "chars et cavaleries sont interdits sur les
flancs abrupts ; chars, cavaleries et éléphants ne peuvent accéder aux
marais" (`docs/research/05-rules-french-original.md`; plateaux carry no
such restriction, only their attack-from-below combat bonus). Placing a
chariot or cavalry unit on a flanc-abrupt hex, or a chariot, cavalry, or
elephant unit on a marais hex, was previously possible at deployment even
though the same unit could never move onto that terrain afterward —
placement now runs the same `data/terrain.ts` `canEnterTerrain` check
movement already uses (via `engine/movement.ts`'s exported
`unitCategory`), so the highlighted hexes always match what a unit could
legally occupy.

### Moving through your own units

A unit may **pass through** a hex occupied by a unit of its own army, but may
never **end** its move there — per the rulebook, *"Une unité ne peut en aucun
cas se placer sur une case déjà occupée par une quelconque autre unité. Par
contre, au cours d'un mouvement, une unité peut traverser une case où se
trouve une unité de la même armée."* Enemy-occupied hexes stay impassable
outright.

"Same army" means the **same player**, not merely "not my current opponent":
in a 3- or 4-player game a unit may not walk through a third party's units
either. Note that in practice enemy zones of control usually stop a unit
before it could try — every unit projects ZOC onto its six neighbours, and
ZOC does not cross rivers, so the distinction is only visible where a river
shields the approach.

This also means a cavalry charge may run its straight line **through** a
friendly unit standing in the way, provided the destination itself is empty
and the line still costs exactly the charger's full movement allowance (see
[Cavalry charges and phalanxes](#cavalry-charges-and-phalanxes)).

### Combining attacks

Real *Héraklios* land combat lets several friendly units combine their
attack values against a single target, as long as each individually
satisfies its own weapon-range requirement (archers at exactly 2 hexes,
melee units adjacent). This digital edition supports that plus an optional
house-rule extension, chosen once at the Menu screen before a game starts:

- **Single-defender** (the literal rulebook rule): several attackers, but
  always exactly one target unit — every attacker in the group must be able
  to reach that one unit.
- **Multi-defender** (default; not in the original rulebook, which doesn't
  cover this case): both sides can be groups — several attackers *and*
  several defenders combined into one battle, as long as every attacker can
  reach at least one of the chosen defenders.

On an **EX (Échange)** result, per the rulebook ("les unités attaquées sont
retirées du jeu, ainsi que les unités attaquantes totalisant une force au
moins égale"): the defender(s) are always destroyed, and the attacking
player must choose which of their own units to also lose, totaling at
least the defenders' force — with only one attacker there's no real choice,
but a multi-unit attack group gets a prompt to pick which units to
sacrifice.

### Shooting: melee force vs. projectile force

Each counter carries two attack numbers — `attack (rangedAttack) range /
defense movement` — and the rulebook names the parenthesized one outright:
"le chiffre entre parenthèses correspond à la valeur d'attaque par
projectiles (flèches des archers, par exemple). Toutes les unités qui ont
une valeur nulle en force d'attaque par projectiles sont obligées de
combattre au contact." **Each attacker contributes the value matching how it
is engaging**: its melee value at contact, its projectile value when
shooting from range. Only Archers (`0 (2) 2`) and Fantassins-Archers
(`2 (2) 2`) have a projectile value at all among land units, so in practice
this is the archers' rule.

Three points the rulebook leaves to interpretation, resolved as follows (the
reasoning is recorded in full at `attackForceAgainst` in
`src/engine/combat.ts`):

- **A melee-capable shooter at contact uses its melee value.** Of the
  archer-infantry the rules say they shoot at two hexes and "ont en outre la
  possibilité de combattre au contact" — fighting at contact is described as
  an *additional* ability, i.e. the ordinary attack. On this roster it makes
  no numeric difference anyway: Fantassins-Archers are 2 either way.
- **A shooter may join a combined attack**, contributing its projectile
  value, because the combining rule states each attacker must satisfy "les
  conditions de proximité inhérentes à leurs types d'armes" and names
  archers-at-exactly-2 as its example — a per-attacker condition inside one
  combined attack. So archers firing from 2 hexes and infantry attacking
  from 1 add up normally.
- **A ranged result is an ordinary result, with one exception.** There is one
  combat-results table and no ranged variant, so AR/DR/EX resolve exactly as
  at contact, including the defender's retreat — and including an **AR**
  retreating a shooter that never closed, which is left literal because it is
  a forced move away from a threat. But **a shooter may not advance into the
  vacated hex**. The rulebook grants that advance "sans tenir compte des
  limites de déplacement qui lui sont propres ni ... des zones d'influence"
  and never mentions distance — because for the attacker it was written for
  there is nothing to mention: a melee attacker is adjacent to the hex it
  just attacked. Taken literally it would let an archer that never left its
  hex occupy a hex two away, crossing whatever sits between — including an
  occupied enemy hex, which nothing else in the game permits. That blocked
  case is what shows the literal reading can't be right, but the rule adopted
  is the general one: **advance requires adjacency**, so an archer is barred
  even where the intervening hex is empty. It changes nothing for a melee
  attacker, which was adjacent to the hex it attacked by definition. (One
  exception to *that*: a unit shoved backwards between the combat and the
  offer — trampled by a defending elephant's drift — is now excluded too,
  deliberately.)

Until this was fixed, every volley resolved at attack force **0** — the
CRT's 1-5 column, five of whose six faces are AE — so firing a plain archer
was a 5-in-6 chance of losing it for nothing.

### Cavalry charges and phalanxes

Per the rulebook: "à chaque fois qu'elle emploie son potentiel de
déplacement au maximum en ligne droite et que la dernière case où elle
aboutit jouxte une unité ennemie, il s'agit d'une charge" — whenever a
cavalry unit (light or heavy) spends its *entire* printed movement
allowance moving in one straight line and ends adjacent to an enemy unit,
that move is a **charge**, doubling its attack value for the rest of that
player's turn (light cavalry 3→6, heavy 6→12; the doubled value also counts
normally toward an EX exchange-sacrifice threshold). Any other cavalry move
— shorter than its full allowance, not a straight line, or not ending
adjacent to an enemy — is an ordinary attack at the printed value. The
Movement-phase log calls out "`<unit>` charges!" when a move qualifies.

Eligibility is recomputed from scratch for the exact destination hex the
player clicks, independently of the cheapest-path search that decides which
hexes are highlighted as reachable at all (`engine/movement.ts`'s
`reachableHexes`) — see that file's `evaluateCharge`/`straightLineMoveCost`
doc comments for why: the click-to-destination movement UI never exposes an
actual walked path for the engine to inspect, and reconstructing one out of
`reachableHexes`'s BFS would only recover an arbitrary tied-shortest path,
not necessarily a straight one. Instead, `evaluateCharge` independently
walks the specific straight line from the unit's pre-move hex to the
clicked destination and checks it's fully legal (on the map; free of enemy
units, though friendly ones may be passed through; ending on an empty hex;
not passing through — merely stopping on — an enemy zone of control) and
costs exactly the unit's full movement allowance — a unit that already spent
part of its allowance earlier in the same Movement phase can never charge on
a later move, even one that happens to be a straight line spending exactly
what's left, because that's not its FULL printed allowance. Since a
straight line can occasionally cost MORE than `reachableHexes`'s cheapest
route to that same hex (e.g. a direct line crossing a river that a detour
would avoid), a charging move deducts `evaluateCharge`'s straight-line cost,
not the cheaper cost the reachable-hex highlight was computed from — so a
charge always leaves the unit at exactly 0 movement remaining.

Separately — and regardless of charging — **phalanxes can never be
attacked by cavalry**, by charge or by an ordinary attack: "la cavalerie ne
peut effectuer de charge ou plus simplement d'attaques contre ces unités"
(`docs/research/05-rules-french-original.md`). A phalanx is filtered out of
`validTargets` for any cavalry attacker, which alone covers a single
attacker/single defender combat; combining attacks (see below) needs one
more check, since a phalanx can otherwise be reachable through a
non-cavalry groupmate's `validTargets` even while a cavalry unit sits
elsewhere in the same attack group — `attackerCanJoin`/`defenderCanJoin`
(the functions that gate joining either side of a combining-attacks group)
explicitly re-check the restriction against every member of the OTHER
side, not just the one candidate being added, so a phalanx is unreachable
by any group that contains cavalry and vice versa, regardless of the order
units join in. Every other unit type can still target (or be grouped
against) a phalanx normally.

### Turn order

The rulebook has each of the 4 players draw for edge at the start of the
game (highest 2 rolls choose E/W, the rest get N/S) and doesn't say anything
further about turn order, so the seating order fixed by that dice-off is
kept for the rest of the game by default. This edition also offers an
optional house rule, chosen once at the Menu screen before a game starts
(off by default, so existing behaviour is unchanged unless a player opts in):

- **Fixed order** (default; matches the rulebook): the seating order drawn
  at the initial dice-off holds for every turn of the game.
- **Re-randomized order**: turn order is reshuffled at the start of every
  new full turn (i.e. once every player has taken their movement and combat
  phases), rather than only once at the start of the game. The reshuffle
  never happens mid-turn — only at the seam between one full turn and the
  next — so within any single round every surviving player still acts
  exactly once; eliminated players are simply never selected as the next to
  act, same as under fixed order. Since the reshuffle is a fresh draw each
  time, it doesn't avoid picking the same player who just finished last —
  about 1 time in *n* (for *n* surviving players), whoever went last in one
  round also goes first in the next, giving them two turns back to back.

### Ending the game

The rulebook lets the table agree on time and turn limits for the whole
game before it starts, alongside mutual elimination down to one surviving
army: *"à la fin de la partie est désigné vainqueur, le joueur dont l'armée
a la plus grande valeur (comptée en « points d'achats »)... On se fixera des
temps limites pour la partie entière (par exemple 2 heures)"*
(`docs/research/05-rules-french-original.md`). This edition offers three
ways to end a game, chosen once at the Menu screen before it starts (the
clock and round limit are independent — off by default, either, or both):

- **Clock limit**: Off, 30 minutes, 1 hour, or 2 hours, for the whole game.
  It's a whole-game limit, not a per-turn chess clock — the rulebook's
  separate *"3 minutes"*-per-turn suggestion, same sentence, isn't
  implemented — so the clock keeps running through every seat's turn
  (including the computer's) and through any open retreat/drift/advance/
  exchange-sacrifice prompt. It also survives save/load: a game saved
  Monday and reloaded Friday resumes with exactly the time it had left, not
  an instantly-expired one. Once a limit is set, the Board's HUD shows the
  time remaining, counting down live, plus a **Pause clock** button for a
  table that needs to stop for a break — press it again (now labeled
  **Resume clock**) to continue. The clock also pauses itself automatically
  whenever the browser tab or window is hidden, so switching away doesn't
  burn down the limit while nobody's looking at the board; either way the
  HUD shows **"(paused)"** next to the time remaining.
- **Round limit**: Off, 6, 8, or 12 full rounds (every player's Movement and
  Combat phases once).
- **"End game" button**: on the Board at any time, regardless of the two
  settings above — for a table that simply agrees a game is over. It asks
  for confirmation first, the same as Abandon, since it can't be undone.

Whichever of the three fires first, the game does **not** end on the spot:
every player still finishes the round already in progress, so nobody is
shorted a turn the others got to take. The status line reads **"FINAL
ROUND"** once that's happened, and the End game button relabels itself to
say so too. Once that final round completes, the winner is whoever holds
the highest surviving army value in purchase points — the same figure the
Game Over screen already lists for every player. Two or more players tied
at that value is a **draw**: nobody is declared the winner, and the Game
Over screen names everyone who tied instead of picking one by seat order.

Elimination remains the other way a game can end, and it isn't affected by
any of the above: the moment only one player still has any units on the
board, that player wins immediately.

### Naval movement and combat

Ships have a **facing** (the direction their bow points) as well as a
movement allowance. The rulebook doesn't cover initial facing at all, so
placing a ship during Placement stages it on the clicked hex without
committing it yet — the same **"⟲ Turn" / "Turn ⟳"** buttons used during
the Movement phase (below) let the placing player pick its facing, shown
live as the same arrow overlay, before **"Confirm facing"** actually adds
it to the board (or **"Cancel"** to pick a different hex instead).

During the Movement phase itself, selecting a ship highlights every
hex it can reach (blue) given that a ship may only move forward through the
side its bow faces, and rotating the facing costs 1 movement point per 60°
turn (so a full reversal costs 3) — movement and rotation may be freely
interleaved. The **"⟲ Turn" / "Turn ⟳"** buttons rotate the selected ship
in place; if it's already bow-on to an adjacent enemy ship, or can become
so, that's a **ramming** opportunity (orange highlight, or the **"Ram!"**
button if no move is needed) — declaring one rolls 1d6 against the
transcribed ramming table, with a bonus based on how much movement is left
unspent at the moment of contact (up to +2). A ship that declares a ram —
hit or miss — commits the rest of its movement to the attempt and can't
also board later that turn.

**Boarding** is a Combat-phase action instead, and requires the two ships
to be adjacent with *parallel* facings (identical or exactly opposite) —
one ship's bow pointing directly at the other is a ramming angle, not a
boarding one. It resolves via the transcribed boarding table (force ratio ×
1d6), stripping equipment points (5 attack/5 defense each) from the losing
side; a ship reduced to 0 equipment is destroyed.

A few interpretive calls were needed where the rulebook itself is
ambiguous or inconsistent (see `src/data/navalRamming.ts`'s comments for
detail) — most notably, the ramming bonus mechanic: the rulebook's worked
example describes success widening from "roll a 1" (no bonus) to "1, 2, or
3" (max +2 bonus) in general terms, but the printed per-ship-matchup table
already varies in width (1 to 5 entries) and some rows exceed what a max
bonus would reach under a literal reading of the example. This edition
treats the printed table as the success range at *maximum* bonus, and a
lower bonus exposes only the first `1 + bonus` entries of it. This
reproduces the worked example's exact numbers ("1, then 1-2, then 1-2-3")
only for the matchups whose printed row has **exactly 3 entries** — for
rows narrower than 3 (including galère vs. quintirème, the very matchup
the rulebook's own worked example uses, whose printed row is just `[1]`)
the effective range caps out below "1, 2, or 3" even at max bonus, and for
the widest rows (4-5 entries) the benefit of movement alone caps at "1, 2,
or 3" instead of the row's full printed width.

### Combat log detail

Every combat resolution's log entry is written to be auditable against the
printed tables in `docs/research/`, not just a bottom-line result:

- **Land combat** lists each attacker's/defender's individual and total
  force — for an attacker that shot rather than closed, the projectile value
  it actually contributed, so the per-unit lines always add up to the total
  (see "Shooting: melee force vs. projectile force" above) — the ratio *and*
  the exact CRT column it resolved to (name and
  index, so it can be checked directly against `src/data/combatTable.ts`),
  the die roll with every contributor to its modifier named separately —
  which terrain (and which defender's hex, for a multi-defender combat) and
  whether the river-crossing bonus also applied — and the result. An **EX**
  result additionally states the exchange-sacrifice threshold, but only when
  a sacrifice choice is actually still pending — a lone attacking unit on an
  EX result is destroyed outright with no choice ever offered (see
  "Combining attacks" above), so the line is suppressed there rather than
  stating a threshold nobody gets asked to meet.
- **Ramming** shows the effective success range for the bonus actually
  rolled next to the matchup's full printed-table range (e.g., for a
  trirème with bonus +1 against a galère: "Succeeds on: 1-2 (printed table
  row: 1-2-3-4 — entries past the first 3 are unreachable at any bonus; see
  `rammingSuccessRange`'s doc comment in `navalRamming.ts`)"), making the
  bonus-narrows-the-range interpretation above visible in play rather than
  only in that comment. For a matchup whose whole printed row IS reachable
  at max bonus, it says so instead ("full table for this matchup: 1-2-3 at
  max bonus" for a row of exactly 3 entries) — and for a row narrower than
  3 entries (e.g. galère vs. quintirème), it says so too, but adds that the
  row is narrower than the rulebook's own worked example. Which of the
  three sentences applies is decided by a single tested predicate
  (`wholeRowReachableAtMaxBonus`, swept across all 16 matchups in
  `navalRamming.test.ts`), not re-derived in the UI. Also shown: the
  unused-movement-point count the bonus was computed from.
- **Boarding** shows both ships' attack/defense force entering the combat,
  the resolved boarding-CRT column, the die roll and result, and each
  ship's equipment points (and the attack/defense derived from them) before
  and after, explicitly saying so if a ship's equipment reaches 0 and it's
  sunk — equipment points are a ship's remaining fighting strength, so this
  is "how many attackers/defenders each ship has left." Unlike ramming,
  `src/data/navalBoarding.ts`'s table has no single win/lose die threshold
  to surface the same way — a roll resolves to one of several graduated,
  column-dependent outcomes on either side rather than a boolean hit/miss —
  so the boarding CRT column is the closest equivalent audit trail. Both the
  attack/defense force and the CRT column are read off the resolved
  `applyAction` result rather than recomputed in the UI, so the log can't
  silently drift from whatever was actually resolved against.

## Map editor

`npm run dev` also serves a standalone hex-map editor at `/map-editor.html`,
for hand-drawing the board instead of relying on the automated extraction
pipeline:

1. Enter a grid size (columns × rows) and click "Créer la carte".
2. Pick a terrain from the palette (Plaine, Rivière large, Flancs abrupts,
   Plateaux, Marais, Frange côtière, the four named-bay deployment zones —
   Anse d'Hypnos / Pointe d'Eole / Baie d'Argos / Cap Zénon — or Pleine mer),
   then click (or click-drag) hexes to paint them.
3. Toggle **"Mode rivière (arêtes)"** to place normal rivers, which run
   *along hex edges* rather than filling a hex — hovering highlights the
   nearest hexside, click to toggle a river on it.
4. Right-drag pans the view, the mouse wheel zooms.
5. **"Télécharger map.ts"** downloads a file that's a drop-in replacement for
   `src/data/map.ts`. "Exporter/Importer (JSON)" round-trips a save file for
   continuing an edit later; the current map also autosaves to
   `localStorage` so an accidental reload doesn't lose work.

It's plain HTML5 Canvas + TypeScript (no Phaser) and shares the same
`TerrainType`/color palette as the game itself, so what you paint is exactly
what the game will use — see `src/map-editor/`.

## Project structure

- `src/data/` — the rules as data: unit stats, terrain effects, the land
  combat-results table, and the naval ramming/boarding tables, all
  transcribed from the scanned rulebook.
- `src/data/map.ts` — the actual board's hex terrain, derived from the
  scanned map (see `tools/map-extract/README.md` for how).
- `src/engine/` — pure game logic: hex math, army validation, movement/ZOC,
  combat resolution, turn sequencing, the undo/redo history primitive, an
  injectable die roll, a headless action layer (`actions.ts`'s
  `legalActions`/`applyAction`, enumerating and applying every
  move/attack/end-phase a player can take, plus the `PlayerAgent` interface
  in `agent.ts` for the retreat/push/advance/exchange decisions a human or a
  bot answers), the computer opponent described below (`combatOdds.ts`'s
  exact CRT odds, `heuristicAgent.ts`, `randomAgent.ts`, plus
  `seatControl.ts`/`seatRouter.ts` for which seat is played by whom and
  which agent answers each decision) and the headless
  self-play harness that soaks it (`fuzzHarness.ts`), and the save-file
  format and its validation. Fully
  unit-tested and independent of Phaser (the browser-side half of saving —
  `localStorage` and file download/upload — lives in `src/ui/saveStorage.ts`).
- `src/scenes/` — the Phaser UI: menu, army builder, placement, board,
  game-over.
- `src/ui/` — shared rendering helpers (hex grid rendering/camera, session
  state shared across scenes).
- `tools/map-extract/` — one-off scripts used to derive `map.ts` from the
  scanned board image (not run at build time; the source scan itself isn't
  included since it's copyrighted magazine content).
- `src/map-editor/` + `map-editor.html` — the standalone interactive map
  editor (see above): `editorState.ts` (pure grid/river model), `camera.ts`
  (pan/zoom + hexside hit-testing), `render.ts` (Canvas 2D drawing),
  `input.ts` (mouse handling), `serialize.ts` (map.ts generation + JSON
  save/load), `main.ts` (wires it all to the DOM). The pure modules are
  unit-tested independently of the DOM.
- `docs/research/` — the original research this project is built on: the
  game's history, a full rules transcription, a plain-reference copy of
  every table, and a list of sources. Start at
  [`docs/research/README.md`](docs/research/README.md).

## Computer opponent

Any seat can be played by the computer. On the menu screen, each of the four
seats has its own button cycling **Human → AI easy → AI normal → AI hard →
AI expert**; pick the ones you want before choosing the number of players
(which is also what starts the game — seats beyond the count you pick are
ignored).

A computer seat sets itself up: it takes the ready-made 400-point army and
deploys it into its own edge's zone, so the army-building and placement
screens only appear for seats a human actually plays. On the board its turn
runs on its own, one action at a time with a short pause between them so you
can follow it, and the status line names the seat as the computer's. While
it's playing, undo/redo and save/load are unavailable — but if one of *your*
units is forced to retreat by its attack, it still asks you where to go.
The choice of seats is saved with the game, so loading a save resumes
against the same opponents.

It plays through the same `legalActions`/`applyAction` layer the board scene
does, so it is bound by exactly the same rules as a player — it cannot make
a move the UI wouldn't allow.

**How it decides.** The combat-results table is small and fully known: one
die, six faces, and a pure resolution function. So the agent doesn't
simulate or sample a candidate attack, it solves it — `combatOdds.ts`
evaluates all six faces and gets the exact outcome distribution, then prices
each outcome in purchase points (the same currency that decides a game on
time). Movement is scored on what it buys: distance closed toward the enemy,
the defensive value of the ground, staying out of enemy zones of control,
and above all the value of the attack the destination makes possible — which
is how it finds cavalry charges, since a charge is simply a move whose
attack is worth twice as much.

**Four difficulty levels**, in increasing strength:

| Level | How it plays |
| --- | --- |
| Random | Picks uniformly among the legal options. |
| Greedy | Goes for the biggest expected damage to you, and ignores what the attempt might cost it. |
| Expected value | Weighs damage against its own risk, declines attacks that aren't worth making, and concentrates several units into one attack when that pushes the force ratio into a better column. |
| Expert | Everything expected value does, plus a bounded look at your best reply: before committing to a move, it clones the board, plays the move out, and prices the strongest attack you could make against the result — discounting a move for handing you a strong counter, not just for what it buys outright. |

The fourth level does not simulate your movement or search more than one ply
— see `heuristicAgent.ts` for why a genuine rollout turned out to be a much
larger job than the other three tiers, and what stayed in scope instead.

## Known simplifications

A few places trade a little rules fidelity for a shippable scope — flagged
here rather than silently:

- **A computer seat's army is the default one, deployed almost at random
  within its zone.** It doesn't choose a composition to suit the map or the
  opponents, and it doesn't arrange a line — it takes the same ready-made
  400-point army the army-builder's own "default army" button offers, and
  scatters it over legal hexes in its deployment band (respecting terrain, so
  no cavalry on marsh). It follows exactly one piece of tactical judgement:
  cavalry, chariots and heavy infantry are kept off plateaux where there's
  room, since a plateau's only benefit is defensive and conditional (+2
  against attacks from below) and those are the units you want free to
  advance and charge — the archers, phalanxes and elephants that hold ground
  get the high ground instead. That is a preference, not a rule: plateaux are
  legal for every land unit, and a crowded band will still put a chariot on
  one rather than fail to field the army. Everything after deployment is
  played properly.
- **The computer opponent doesn't predict where a drifting elephant ends
  up.** It commands them perfectly well — the self-play armies its tests are
  built from now include one per side, so the AI moves and fights with
  elephants and resolves drifts headlessly when one is forced — but when
  *weighing* an attack it scores a drifting elephant as surviving. A real
  drift can end anywhere from
  unharmed to dead, depending on a second die roll, whatever it tramples,
  and how far the cascade runs, so pricing it properly is lookahead rather
  than arithmetic. The assumption understates rather than overstates the
  value of hitting an elephant, which keeps the error on the cautious side.
- **Naval movement is destination-click, not path-drawn.** Clicking a
  highlighted hex moves the selected ship there by the cheapest combination
  of rotation + forward moves (or, for an orange-highlighted contact hex,
  by the specific facing that makes ramming eligible there, even if a
  cheaper non-contact facing exists for that same hex) — a player can't
  otherwise choose an *alternate*, costlier facing for a hex that also has a
  cheap one. Multi-leg moves (rotate/reposition, stop, then move the same
  ship again) are still possible by reselecting it mid-phase.
- **A ramming contact is only detected at hexes a single click can already
  reach** (the cheapest path to each hex, plus any bow-on contact along the
  way) — a ship can't be walked through an arbitrary hand-drawn path hex by
  hex, so an unusual route that would create a contact somewhere off that
  set isn't offered. In practice this rarely matters since a rational
  player wants the earliest (cheapest) contact anyway, for the best bonus.
- **Non-galley ships forced into the coastal fringe/wide rivers** ("removed
  from the game" per the rulebook) has no code path today, since nothing in
  this implementation forces a ship's position outside its own chosen
  moves — there's no naval retreat/drift mechanic that could push one there
  involuntarily.
- **Map terrain**: the currently shipped `src/data/map.ts` was extracted from
  the scanned board via a semi-automated pipeline (per-page grid calibration
  + color classification + river-hexside detection — see
  `tools/map-extract/`) rather than hand-transcribed. It's a reasonably close
  match to the original but not pixel-perfect (a few isolated hexes near the
  page fold may differ by one terrain category). The **map editor**
  (`/map-editor.html`, see above) exists specifically so the board can be
  redrawn by hand instead of relying on that extraction — use it and
  download a new `map.ts` if you want full control over the layout.
