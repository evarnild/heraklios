<!-- generated-by: heraklios/spec@0.1.0 -->
# §81 spec — The Board shows every player's current score at all times

Accepted intent: [intent.md](intent.md)

Written against `main` at `c822f4b`.

The spec decides **what** gets built. It does not repeat the rulebook or
README — it points at them and records the decisions that have no other home.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/05-rules-french-original.md:477-489` "fin de partie" | The score: "au terme du temps de jeu, chaque joueur possédant encore des unités sur le terrain additionne les valeurs d'achats qu'elles représentent. Celui qui a le plus de points est déclaré vainqueur ;" (`:480-482`). The bonus: "Le joueur dont les vaisseaux restent seuls en mer obtient, lors du compte final, une bonification de 30 points. Points qu'il additionnera à d'éventuelles unités présentes sur le terrain." (`:487-489`) |
| `docs/research/02-rules-transcription.md:292-305` "Victory conditions" | The transcription's reading of the bonus: "Regardless of which of the above ends the game, a separate scoring bonus applies at the final count: a player whose ships are the *only* ones left at sea (all other players' fleets sunk or absent) adds a **+30 point bonus** to their final total, on top of the purchase-point value of whatever units they still have." (`:301-305`). The parenthesis "sunk or absent" is the transcriber's gloss; the French says only "restent seuls en mer". |
| `README.md:619-662` "Ending the game" | Today's player-facing rule: "the winner is whoever holds the highest surviving army value in purchase points — the same figure the Game Over screen already lists for every player" (`:654-656`). No mention of the +30 bonus. |
| `README.md` "Known simplifications" | Nothing. The +30 bonus is not listed there, though the engine does not apply it (below). |
| intent, "The owner's answers (2026-11-22)" | 1 a small fixed panel, always shown; 2 score and units left; 3 eliminated players listed at 0; 4 the +30 bonus shown live whenever it applies. |

### The code this builds on (read at `c822f4b`)

- **The score today.** `src/engine/state.ts:247-253`:
  `livingUnits` filters `!u.destroyed`, and
  `armyValue(state, owner)` is `livingUnits(state, owner).reduce((sum, u) => sum + unitType(u).cost, 0)`.
  A damaged ship counts at its **full** printed cost: `equipmentPoints`
  (`state.ts:26-27`) is not read. `combatOdds.ts:60-62` records that this is
  deliberate: "`armyValue` — what that ending really counts — sums each
  surviving unit's FULL printed cost, while this pro-rates a damaged ship".
  A ship is destroyed when its equipment reaches 0 (`combat.ts:1110`).
- **Callers of `armyValue`** (grep over `src` and `e2e`): `turnManager.ts:178`
  and `:184` (`endGameByTimeLimit`), `GameOverScene.ts:35` (the per-player
  line), `fuzzHarness.ts:1154` (`stats.finalArmyValues`, a report). Doc
  comments only: `combatOdds.ts:60`, `state.ts:185`, `fuzzHarness.ts:821`.
- **How the game ends.** `advancePhase` (`turnManager.ts:68-76`), after each
  Combat phase, marks every player with no living unit `eliminated` and
  ends the game at once when one or none is left (`winnerIds` = the survivor,
  or `[]`). A clock, round limit or End game button sets `pendingGameEnd`,
  and at the round wrap `endGameByTimeLimit` (`turnManager.ts:172-185`) picks
  everyone not eliminated at the highest `armyValue` (a tie is a draw).
- **The +30 bonus is not applied anywhere.** A grep for `bonus`, `30`,
  `seuls en mer`, `alone at sea` over `src/engine`, `src/data`, `src/scenes`,
  `src/ui` finds only the ramming bonus (`actions.ts:105`,
  `navalRamming.ts`), the river-crossing bonus (`combat.ts:138-179`), the
  cavalry charge and the 30-minute clock option (`gameEndSettings.ts:17`).
  Neither `armyValue` nor `endGameByTimeLimit` adds it, and `GameOverScene`
  does not show it.
- **Where ships can be.** `terrain.ts:27-29` `isSeaLike` is high sea plus the
  four named zones; `canEnterTerrain` (`terrain.ts:110-130`) lets any ship
  enter sea-like terrain, a galley also `coast` and `river-wide`, and "Land
  armies cannot enter any sea-like terrain" (`:112-113`, `:127`). Nothing carries
  troops: a grep for `embark|transport|aboard|passenger` in `src/engine` and
  `src/data` finds nothing.
- **Game Over.** `GameOverScene.ts:33-40` writes one line per
  `state.players` entry, in player-id order:
  `t.gameOver.pointsRemaining(p.name, armyValue(state, p.id))`
  (en `"${name}: ${points} points remaining"`, `en.ts:153`; fr
  `"${name} : ${points} points restants"`, `fr.ts:139`).
- **The Board HUD at 1100 × 750** (`main.ts:11-12`, fixed canvas). The left
  side panel is `SIDE_PANEL_WIDTH = 300` wide (`rulesPanelLayout.ts:11`,
  `BoardScene.ts:95`, background `:622-626`). In it: End phase `y 24`
  (`:629`), Resolve `y 64` (`:642`), Turn/Turn/Ram `y 96` (`:663-696`),
  status line `y 118` (`:833`), clock `y 140` (`:846`), the message log from
  `LOG_TOP = 178` to `height − 240 = 510` (`logHistory.ts:96-99`, `:108-110`),
  drift Continue `h − 232` (`:814`), Pause clock `h − 200` (`:794`), End game
  `h − 168` (`:776`), the Speed button one row above the view toggle, so
  `h − 168` right of Abandon (`speedToggle.ts:54`, `BoardScene.ts:770`; §77
  shows it in both views, same place), Abandon and view toggle `h − 136`
  (`:760`, `:770`), Save/Load and Tables `h − 104` (`:736`, `:748`), Undo
  `h − 72` (`:710`), Redo `h − 40` (`:723`). In the map area: the Tables
  panel, `776 × 266` at the top right, `left = 1100 − 776 − 12 = 312`,
  `top = 8` (`rulesPanelLayout.ts:12-15`, `:30-33`); the ram and boarding
  prompts, `280 × 130` and `260 × 120`, centred (`boardPrompts.ts:11-17`);
  the decision choosers, centred, `320` (advance, `BoardScene.ts:2438`) and
  `340` (exchange, `:2690`) wide, so never right of `x = 720`; the confirm
  dialog (depth 50-52, `confirmDialog.ts:87-137`) and the Save/Load panel
  (depth 40-41, `saveLoadPanel.ts:104-188`), both modal over a dimmed screen;
  the hover tooltip (depth 35, `MapView.ts:72`), which follows the pointer.
  HUD buttons are depth 30.
- **Pointer handling.** `MapView.pointerBlocked` stops a map drag and wheel
  zoom on a HUD rectangle (`MapView.ts:228`, `:256`); the scene sets it to
  the log and the Tables panel (`BoardScene.ts:860`). A hex click goes to the
  `hitZone` (`MapView.ts:122-124`), so an interactive HUD object on top takes
  the click instead.
- **Player colours.** `PLAYER_COLORS_HEX` (`hexRender.ts:89`), indexed by
  player id, the order the status line uses (`BoardScene.ts:1388-1392`).
  The active player is `currentPlayer(state)` (`state.ts:255`).
- **Refresh points.** `refreshStatus` (`BoardScene.ts:1377-1407`) runs on
  phase and turn changes, not when a unit dies mid-combat. `update`
  (`:1446-1462`) runs every frame and returns early once `state.gameOver`.
- **Size.** `scripts/size-baseline.json`: `"src/scenes/BoardScene.ts": 3172`;
  the file is 3172 lines at `c822f4b`. `check:intent` enforces the ceiling
  (`scripts/check-intent.mjs:95-130`, §61).
- **Dev hook.** Readers are grouped builders since §75 (`devHook.ts:192-200`);
  a Board reader is one line in `boardReaders` (e.g. `rulesPanel`,
  `devHook.ts:287`) plus a guarded member read (`rulesPanelSnapshot`,
  `:368-374`). `e2e/dev-hook-members.spec.ts:7-39` pins the member list.
  e2e scenarios may import engine code (`e2e/attack-log.spec.ts:8-11`).
- **Test modes.** `MENU_TEST` gives each of two players three land units and
  `['galeres', 'biremes']` (`testMode.ts:12-13`), so both have ships and no
  bonus applies at the start.

## Behaviour

**B1 — One engine score.** The engine has one pure function that gives,
for every player in `state.players`: the army value (`armyValue`, unchanged:
the full printed cost of every unit not destroyed), the naval bonus (30 or
0, B9), the score (army value + bonus) and the units left (the count of that
player's units not destroyed, land and ships). The Board panel and the Game
Over screen both read it; nothing in `src/scenes` or `src/ui` sums unit costs
itself.

**B2 — Where.** A small panel at the bottom right of the map area, drawn on
the fixed HUD camera, so panning and zooming the map never moves or scales
it. At 1100 × 750: right edge 12 px from the canvas edge (the Tables panel's
margin), bottom edge 8 px from the bottom, width at most 300 px (left edge
at or right of `x = 788`), height `32 + 18 × players` px or less (104 px for
four players, 68 for two), growing upward. It overlaps none of: the left
side panel and everything in it (`x < 300`), the Tables panel's rectangle
(`rulesPanelRect`), the ram and boarding prompts, the decision choosers'
centred column (`x 380-720`). The modal confirm dialog and Save/Load panel
draw over it (it sits at HUD depth 30, below them); the hover tooltip
(depth 35) may draw over its edge for a moment.

**B3 — Always shown.** It is shown on the Board from the first frame to the
end of the game: in both phases, on every seat's turn (computer seats
included), while the Tables panel is open, while a retreat, push, advance,
exchange or drift decision is pending, while the clock is paused, during the
final round. It has no close button and no toggle. It is not shown on the
Menu, Army Builder, Placement or Game Over screens.

**B4 — Content.** A header line, then one row per player in player-id order
(the Game Over order), never re-sorted by score. Each row shows, left to
right: a square in the player's colour (`PLAYER_COLORS_HEX[id]`), the
player's name in that colour, the score, the bonus note when the bonus
applies (B9), and the units left. Nothing else (no difference from 400, no
controller name).

**B5 — Active player.** The active player's row (`currentPlayer(state)`)
stands out: a marker before it and a highlighted row background, the other
rows plain. It moves to the next seat when the turn passes, including to and
from a computer seat.

**B6 — Always current.** The panel shows the current state's figures within
one frame of any change: a unit destroyed by combat, by a retreat with no
hex, by an elephant drift or trample, by a ram or boarding (a ship sunk at 0
equipment), an undo, a redo, a game loaded from a save, a phase or turn
change. It updates during a computer turn as the computer's attacks resolve,
not only at its end. In the Drawn view a destroyed unit's figure may drop
before its fade animation finishes: the panel follows the state, not the
animation.

**B7 — Equipment loss.** A ship that loses equipment points but is not sunk
keeps its full purchase value and stays in the units left, following
`armyValue` (`combatOdds.ts:60-62`). The panel's figures do not change on
equipment loss; they change when the ship is sunk.

**B8 — Eliminated players.** A player with no unit left stays in the panel
at score 0 and 0 units left, in their colour, never removed. A player at 0
whose seat is skipped is never the active row.

**B9 — The naval bonus, shown live.** A player gets the 30-point bonus when
they are the only player with at least one ship not destroyed (I1, I2).
Whenever that holds, the player's score includes the 30 and their row shows
the bonus note; when it stops holding (a second player still has a ship
after an undo, say), the note goes and the score drops by 30. At most one
player has the bonus at a time; with no ships anywhere, or ships in two or
more armies, nobody has it.

**B10 — Game Over shows the same figures.** Each Game Over line shows the
player's score from B1 (bonus included), and the bonus player's line says so.
Under Q1's recommendation, the winner is also decided on that score (B11).

**B11 — The winner (depends on Q1).** `endGameByTimeLimit` picks the players
not eliminated at the highest **score** (B1), bonus included, instead of the
highest `armyValue`; a tie is still a draw. The elimination ending
(`turnManager.ts:68-76`) is unchanged: its single survivor wins whatever the
scores. If the owner answers Q1 "no", B11 is dropped, B10 shows `armyValue`
without the bonus, and the panel's bonus note says it does not count for the
winner (the spec is revised before the plan).

**B12 — Text, English and French.** Every label is in `src/ui/i18n/en.ts` and
`fr.ts`:

| key (suggested) | en | fr |
| --- | --- | --- |
| header | `Score` | `Score` |
| points | `${n} pts` | `${n} pts` |
| units | `1 unit` / `${n} units` (0 → `0 units`) | `${n} unité` for 0 and 1 / `${n} unités` |
| bonus note | `(+30 at sea)` | `(+30 en mer)` |
| Game Over line with bonus | `${name}: ${points} points remaining (+30 at sea)` | `${name} : ${points} points restants (+30 en mer)` |

Every row fits inside the panel in both languages with the longest names in
the game (`Macédoine`, `Athènes`) at a score of 430 and 80 units.

**B13 — Not interactive.** A click on the panel selects nothing and reaches
no hex beneath it; a drag or wheel that starts on it does not pan or zoom
the map (it joins `pointerBlocked`).

**B14 — Both views.** The Standard and Drawn views show the same panel at the
same place; switching view leaves it unchanged, and no panel object is drawn
by both cameras (§67).

## Interpretations

Each becomes a code comment at the bonus function, citing
`05-rules-french-original.md:487-489` and `02-rules-transcription.md:301-305`.

- **I1 — "dont les vaisseaux restent seuls en mer" means the only player with
  a ship still afloat, wherever it is.** The other reading the brief raised,
  "the only player with units of any kind at sea", names the same players in
  this game: land units can never enter sea-like terrain or the coast
  (`terrain.ts:112-113`, `:127`) and nothing carries troops, so the only units at
  sea are ships. A galley on a `coast` or `river-wide` hex
  (`terrain.ts:123-124`) counts as afloat: it is part of the fleet the
  sentence is about, and counting by hex would let a galley drop out of the
  count by rowing up a river. So: a player has the bonus when they own at
  least one ship (`domain: 'naval'`) not destroyed and no other player does.
- **I2 — "restent seuls" includes fleets that were never there.** The
  sentence does not say the others' ships must have been sunk. The
  transcription reads it as "all other players' fleets sunk or absent"
  (`02-rules-transcription.md:303`). So a player whose opponents bought no
  ships has the bonus from the first turn. This also keeps the score a
  function of the current state alone (no purchase history).
- **I3 — "lors du compte final" is shown live.** The rulebook awards the
  bonus at the final count. The live panel shows what the final count would
  be if the game ended now (the owner's answer 4), so it applies the same
  test to the current state.
- **I4 — "Points qu'il additionnera à d'éventuelles unités présentes sur le
  terrain"**: the 30 is added to the player's army value, whatever it is;
  a player with only ships left still adds it. Such a player always has a
  unit, so a score of exactly 30 cannot happen.
- **I5 — the bonus and the elimination ending.** The transcription says the
  bonus applies "regardless of which of the above ends the game". When one
  army is left it wins outright; the bonus then changes only the figure Game
  Over shows, not the winner.

## Acceptance criteria

- **AC1 — the score function** (engine unit test, a new
  `src/engine/score.test.ts` or the file the plan names): for a built state,
  army value equals `armyValue`; a ship at 1 of its equipment points counts at
  full cost and in units left (B7); destroyed units count in neither; an
  eliminated player is 0 and 0 (B8); 2- and 4-player states return one entry
  per player in id order (B1, B4).
- **AC2 — the bonus** (same test file): +30 for the only player with a living
  ship (B9, I1); none when two players have one; none with no ships at all;
  +30 when the opponents never had ships (I2); +30 for a player whose only
  ship is a galley on a `river-wide` hex (I1); the bonus goes when a second
  player's ship is restored (an un-destroyed unit, standing for undo); a
  player with only ships left scores ships + 30 (I4).
- **AC3 — the winner** (`src/engine/turnManager.test.ts`, depends on Q1):
  `endGameByTimeLimit` names the bonus player the winner where the bonus
  breaks a tie, and calls a draw where it creates one; the elimination ending
  still names the sole survivor (B11).
- **AC4 — one source** (review, by reading): `GameOverScene` and the panel
  module take their figures from the B1 function; a grep finds no other sum
  of unit costs in `src/scenes` or `src/ui` (B1, B10).
- **AC5 — the layout** (pure unit test, a new `src/ui/scorePanelLayout.test.ts`
  beside `rulesPanelLayout.test.ts`): for 2, 3 and 4 players at 1100 × 750 the
  panel rectangle is inside the canvas with the B2 margins, its left edge is
  right of `SIDE_PANEL_WIDTH`, and it intersects neither `rulesPanelRect(1100)`,
  nor any of `visiblePromptRects(1100, 750)`, nor the centred 340 px chooser
  column; its height grows with the player count, bottom fixed (B2).
- **AC6 — the rows** (pure unit test, same file or the panel module's): from a
  state, the rows carry each player's colour, name, score, bonus note and
  units text; exactly the active player's row is marked (B5); an eliminated
  player's row reads 0 points and 0 units (B8); the bonus note is present only
  on the bonus row (B9); en and fr texts, including the unit singulars (B12).
  `noLiterals.test.ts` stays green.
- **AC7 — e2e through a reader** (a new `e2e/score-panel.spec.ts`, through a
  new dev-hook reader `scorePanel()` that returns what the panel shows: its
  screen rectangle, and per row the player id, score, bonus flag, units left
  and active flag, and whether every row's text lies inside the rectangle):
  - `MENU_TEST`: two rows; each equals the engine function's figures for
    `state()`; the active row is `currentPlayer`; every row fits (B4, B5, B12);
  - after End phase twice, the active row is the other player (B5);
  - after the Drawn view toggle, the same rectangle and figures (B14);
  - `MENU_CLOSE_COMBAT`, seeded: after the scenario's attacks resolve, the
    rows equal the engine figures for the new state; after Undo, they equal
    them for the restored state; after Redo, again (B6). The test compares
    with the engine rather than expecting a kill, since the dice decide;
  - a wheel over the panel leaves `cameraZoom()` unchanged (B13);
  - load: a test-mode save with player 1's two ships set `destroyed`, written
    to a free slot under the save lock (`e2e/savesDir.ts`, as
    `save-import.spec.ts` does) and loaded, shows player 0's row with the
    bonus flag and a score of army value + 30, and player 1's without it
    (B6, B9);
  - the page logs no error.
  `e2e/dev-hook-members.spec.ts` adds `scorePanel` to its list, and
  `e2e/hud-strays.spec.ts` stays green with the panel on screen (B14).
- **AC8 — French** (in AC7's file or `e2e/language.spec.ts`): with the
  language set to French, every row still fits the panel (B12).
- **AC9 — size and checks**: `src/scenes/BoardScene.ts` is at most 3172 lines;
  `npm run verify` and `npm run check:intent` pass; the lint warning cap is
  not raised.
- **AC10 — live check** (the owner, `REVIEW-POLICY.md` → "Live checks"; owed
  for `src/ui`/`src/scenes`, new and visual): a 3- or 4-player game with one
  computer seat. The panel is readable at the bottom right and covers nothing
  in either view; colours match the units; the active row stands out and
  follows the turn through the computer's turn; a destroyed unit drops its
  player's score as it happens, and Undo puts it back; with the Tables panel
  open and during a retreat or exchange prompt the panel stays and overlaps
  neither; French text fits; Game Over lists the same figures.

## Non-functional

- **Engine/presentation split:** the score and the bonus are one pure engine
  function (B1), in `src/engine` (a small new `score.ts`, or beside
  `armyValue` in `state.ts`; the plan picks), unit-tested (AC1, AC2).
  `armyValue` keeps its meaning (army value without bonus) so
  `fuzzHarness.ts:1154`'s report and `combatOdds.ts`'s note stay true. The
  panel's geometry and rows are pure `src/ui` functions (AC5, AC6); a small
  `src/ui` module only draws them. No game rule in `src/ui`.
- **Size:** `BoardScene.ts` stays at or under 3172 lines. Its hook is at most
  net-neutral: creating the panel, giving the dev hook a way to find it, and
  adding it to `pointerBlocked` (`BoardScene.ts:860`). One way: the module
  registers its own objects with `mapView.excludeFromMainCamera` (as
  `RulesPanel` does, `BoardScene.ts:859`) and refreshes itself on the scene's
  update event, so the scene needs no per-frame or per-action call; the plan
  finds the lines to save if a hook costs any.
- **Save format:** no change. The bonus and the score derive from
  `state.units` and `state.players`; `GameState` keeps its shape and
  `SAVE_VERSION` is unchanged.
- **Undo boundaries:** none new. The panel records no history; it reads the
  state undo and redo restore.
- **AI / harness:** `legalActions`/`applyAction` unchanged. If Q1 is
  answered yes, `endGameByTimeLimit` changes, and the fuzz harness's
  turn-cap endings (`fuzzHarness.ts:1126`) use it: a seed whose game ends
  with one fleet left may now name a different winner. The plan checks the
  pinned harness and soak tests (`fuzzHarness.test.ts`,
  `heuristicSoak.test.ts`) and records any expectation that moves, with the
  reason. The computer's move choice does not learn about the bonus (Out of
  scope).
- **Performance:** the panel recomputes from a few hundred units at most and
  redraws its text only when a figure or the active row changes.
- **Docs:** README "Ending the game" (`README.md:619-662`) describes the
  panel, and (Q1 yes) the bonus in the final count, with the I1/I2 reading.

## Out of scope

- The computer opponent valuing the bonus (sinking the last enemy ship, or
  keeping its own). `heuristicAgent.ts` and `combatOdds.ts` are unchanged.
- Pro-rating damaged ships in the score (B7 keeps full cost).
- Any score other than surviving purchase value: kills, points lost,
  difference from the starting 400.
- Sorting rows by score, a leader marker, a score history or graph.
- Moving, resizing, collapsing or hiding the panel; other canvas sizes than
  the game's fixed 1100 × 750.
- The score on the Placement or Army Builder screens.
- Abandon by three of four players (`05-rules-french-original.md:483`),
  which the game does not implement per seat.

## Assumptions I made

- **Bottom right of the map area.** The left side panel has no free 70-104 px
  without moving the log, whose bounds a test pins
  (`logHistory.test.ts:143-151`); the top right is the Tables panel; the
  centre holds the prompts. The bottom right is the one corner clear of all
  of them (B2). It can cover a few hexes of the map's south-east, which the
  player pans to see.
- **Player-id order**, the Game Over order, not score order, so rows never
  jump while players read them, and the randomised turn order does not
  reorder them.
- **Eliminated rows are not greyed.** The owner chose "still listed, at 0"
  over "greyed out" (intent, answer 3).
- **The score is the total, the bonus a note beside it**, so the figure is the
  one the final count would use and the note says why it is 30 higher.
- **"Units left" counts land units and ships alike**, as `livingUnits` does.
- **No controller label in the panel.** The status line already names a
  computer seat (`BoardScene.ts:1384-1393`).
- **Within one frame, not in step with animations** (B6): the figure follows
  the state, which changes before a Drawn-view fade ends.
- **A die roll is not needed to see the bonus in e2e.** AC7 crafts a save
  with one fleet destroyed, since sinking a fleet by dice is not reliable in
  a smoke test.
- **The Game Over bonus note** reuses the panel's wording (B12), so the two
  screens read the same.

## Questions for the owner

None open. Q1 was answered by the owner (2026-11-22, "/auto 81 Q1 yes"):
the +30 naval bonus is added to the winner calculation and to Game Over
(B10, B11 and AC3 as written), so the panel, Game Over and the winner
agree.

