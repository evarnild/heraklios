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
   (see "Combining attacks" below; defaults to several-vs-several), and
   whether turn order should be re-randomized each turn (see "Turn order"
   below; defaults to off).
2. **Army Builder** — each player spends 400 purchase points on units from
   the shared roster (archers, infantry, cavalry, chariots, elephants,
   phalanxes, and four tiers of warships), subject to per-unit quantity
   caps, one player at a time ("pass the device").
3. **Placement** — each player first chooses where along their randomly
   assigned edge their 3-hex-deep deployment strip sits (see "Deployment
   zone position" below), then deploys their purchased units within it
   (green highlight). Ships also let the placing player pick an initial
   facing (see "Naval movement and combat" below) instead of always
   starting bow-first in a fixed direction.
4. **Board** — turns proceed player by player, each running a Movement
   phase (click a unit, then a highlighted reachable hex) followed by a
   Combat phase. In the Combat phase: click friendly units to build an
   attacking group (blue highlight), click eligible enemy units to add them
   as targets (amber = eligible but not yet chosen, red = chosen), then
   click **"Resolve attack"** to roll the combined combat. When a result forces a retreat, the owning player picks the
   destination: legal hexes are highlighted blue — click one. If every
   neighboring hex is occupied by a friendly unit, those are highlighted
   amber instead — click one to have it retreat and make room, then pick
   *its* destination the same way. **Elephants** are the exception: instead
   of a chosen retreat, a die roll picks a random direction and the elephant
   drifts that way, hex by hex, for its full movement allowance — the panel
   narrates each step, and every hex it enters that's occupied triggers a
   real combat (elephant vs. that unit) rather than an automatic kill; a
   result that would force the elephant itself to retreat instead re-rolls
   a new direction with whatever movement it has left, and it's eliminated
   outright if the drift would carry it off the map or into the sea. When a
   **defender** retreats, or is eliminated outright (DE/EX), the attacking
   side is then offered the chance to advance a unit into the hex it
   vacated. "End phase" advances movement → combat → the next player's
   movement. The game ends when only one army remains on the board.

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
serialized, so a save always lands on a stable position.

A save carries the whole session — the players and their assigned edges, the
combat-rule variant, every unit's position, facing, movement and damage, and
the per-phase record of which units have already attacked or rammed. Loading
a game clears the undo history, since undoing into a previous game's actions
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
  player currently deploying.

Undo is also refused while a retreat or elephant drift is still awaiting a
choice — resolve it first, the same rule "End phase" already follows.

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
lower bonus exposes only the first `1 + bonus` entries of it — reproducing
the worked example exactly for every matchup narrow enough to fit, and
capping the benefit of movement alone at "1, 2, or 3" for the widest rows.

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
  combat resolution, turn sequencing, the undo/redo history primitive, and the
  save-file format and its validation. Fully unit-tested and independent of
  Phaser (the browser-side half of saving — `localStorage` and file
  download/upload — lives in `src/ui/saveStorage.ts`).
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

## Known simplifications

A few places trade a little rules fidelity for a shippable scope — flagged
here rather than silently:

- **Cavalry charges** (doubling attack value when a cavalry unit uses its
  full movement in a straight line into contact) and the restriction that
  cavalry can never attack phalanxes are not implemented; cavalry always
  attacks at its printed value against any target.
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
