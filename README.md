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

1. **Menu** — pick 2, 3, or 4 players, and the land-combat rule variant
   (see "Combining attacks" below; defaults to several-vs-several).
2. **Army Builder** — each player spends 400 purchase points on units from
   the shared roster (archers, infantry, cavalry, chariots, elephants,
   phalanxes, and four tiers of warships), subject to per-unit quantity
   caps, one player at a time ("pass the device").
3. **Placement** — each player deploys their purchased units within a
   3-hex-deep strip along their randomly assigned edge of the map (green
   highlight).
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

### Naval movement and combat

Ships have a **facing** (the direction their bow points) as well as a
movement allowance: selecting a ship in the Movement phase highlights every
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
  combat resolution, turn sequencing. Fully unit-tested and independent of
  Phaser.
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

- **Deployment zones** are a fixed 3-hex-deep strip spanning each player's
  entire assigned edge, rather than letting each player choose where along
  the edge to deploy (the original rule) with a 4-hex separation from
  other players.
- **Cavalry charges** (doubling attack value when a cavalry unit uses its
  full movement in a straight line into contact) and the restriction that
  cavalry can never attack phalanxes are not implemented; cavalry always
  attacks at its printed value against any target.
- **Turn order** among the 4 players is fixed at the initial edge-assignment
  dice-off; the rulebook doesn't specify whether it should be re-randomized
  each turn, so this plays it as fixed seating order.
- **Ship facing at deployment** always starts at a fixed default direction
  (facing index 0) rather than letting the placing player choose — the
  rulebook doesn't cover initial facing at all.
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
