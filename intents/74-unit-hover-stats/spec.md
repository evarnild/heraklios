<!-- generated-by: heraklios/spec@0.1.0 -->
# §74 spec — Hovering a unit shows its characteristics; the Drawn view's number badge goes

Accepted intent: [intent.md](intent.md)

Written against `main` at `dea1d2b`.

**The owner's decisions (2026-11-21, intent round)**
- **"Both views":** the unit's lines appear on hover in the Standard and Drawn
  views alike.
- **"Name + stats + current state":** the tooltip shows the unit's name and
  owner, its attack (with any ranged attack and range), defense and movement
  allowance, its movement left, a ship's equipment, and whether it charged.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `src/ui/figures/figureShapes.ts:226-229` | `counterBadge(type)`, the print counter's format `attack (ranged) range / defense movement`. Its only caller is `src/ui/drawnUnits.ts:201`, plus its tests at `figureShapes.test.ts:64-81`. |
| `src/ui/MapView.ts:197-206` | `updateHover` calls `showHexTooltip(hex, x, y)` only when the hovered hex changes. |
| `src/ui/MapView.ts:374-410` | `showHexTooltip` makes one HUD text object (13 px, depth `TOOLTIP_DEPTH`, kept off the main camera) and flips it at the right and bottom edges. |
| `src/ui/MapView.ts:40`, `:54` | The existing scene hooks: `onHexClick` and `onHexHover`. |
| `src/ui/hexTooltip.ts` | `formatHexTooltip(hex)` → `(q, r) — <terrain>`, a pure function with tests (`hexTooltip.test.ts`). |
| `src/engine/state.ts:17-42` | `Unit`: `owner`, `typeId`, `movementLeft`, `equipmentPoints?` (ships), `charged` (cavalry). |
| `src/engine/state.ts:76-79`, `:93-146` | `maxEquipmentPointsForType`, `currentAttack`, `currentRangedAttack` and `currentDefense`. These are the values in play: a charge doubles attack, and lost equipment takes 5 from a ship's attack and defense per point. |
| `src/data/units.ts:3-16` | `UnitType`: `attack`, `rangedAttack`, `range`, `defense`, `movement`. |
| `src/ui/i18n/names.ts:7`, `:26` | `unitName(typeId)` and `colorName(playerIndex)` in the current language. |
| `src/scenes/BoardScene.ts:1392` | The status bar already names a player as `seat(name, edge, colour)`. |
| `src/scenes/BoardScene.ts:919`, `src/scenes/PlacementScene.ts:323` | The two scenes that draw units on the board. |

## Behaviour

- **B1. No badge.** The Drawn view's unit figures carry no text: no number
  badge, no other label. The figure, its base and its facing are unchanged.
- **B2. Hovering a unit.** When the hovered hex holds a living unit, in the
  Board or in Placement and in either view, the tooltip keeps its first line
  `(q, r) — <terrain>` as today and adds these lines:
  1. `<unit name> — <player name> (<colour>)`;
  2. the unit's values, labelled, in the print counter's order: attack; then
     ranged attack and range, only for a unit with a range; then defense;
     then movement allowance;
  3. its state, only on the Board:
     - "movement left N";
     - for a ship, "equipment E/M";
     - for cavalry, "charged" when `charged` is true.

  The parts that apply are joined on one line.
- **B3. Values in play.** Attack, ranged attack and defense are the current
  values (`currentAttack`, `currentRangedAttack`, `currentDefense`). Where a
  current value differs from the printed one, the printed value follows in
  brackets, e.g. "attack 6 (3)" for a charging light cavalry, or "defense 15
  (25)" for a ship that has lost two equipment points. Range and movement
  allowance are printed values.
- **B4. Every unit, every player.** The lines show for any unit, whichever
  player owns it. Hotseat play hides nothing today.
- **B5. Empty hexes are unchanged.** A hex without a living unit shows exactly
  today's one line.
- **B6. Placement shows no state line.** Units being placed have full
  movement and full equipment and have not charged, so only lines 1 and 2
  show there.
- **B7. Both languages.** Every label is in `src/ui/i18n/en.ts` and `fr.ts`.
  The unit and colour names come from `unitName` and `colorName`. Switching
  language changes the next hover's text.
- **B8. Placement on screen.** The tooltip keeps today's style, HUD camera,
  offset and edge flipping, now for a box of up to four lines. It never runs
  off the right or bottom edge.
- **B9. Touch.** Nothing changes. A pointer with no hover shows no tooltip,
  as today.

## Interpretations

No rulebook passage is involved: these are the print counter's values shown
in text. Two readings, each to be a comment at its site:

- **I1. "Unit characteristics" means the values in play, with the printed value
  alongside where it differs (B3).** The owner asked for "current state". A
  charge's doubled attack and a ship's lost equipment change the numbers the
  combat uses, so showing only the printed value would mislead.
- **I2. "The display of the numbers" means the Drawn view's badge only (B1).**
  The Standard view's counter images print their own numbers. Those are the
  print counters and stay as they are.

## Acceptance criteria

- **AC1 (B2-B7).** A pure `formatUnitTooltip(unit, ownerName, options)` (or
  the like) in `src/ui/`, tested in a new `src/ui/*.test.ts`, gives:
  - a plain land unit: name, owner, attack, defense, movement and movement
    left;
  - archers: ranged attack and range are included;
  - charging light cavalry: "attack 6 (3)" and "charged";
  - a ship that lost equipment: the reduced attack and defense with printed
    values in brackets, and "equipment E/M";
  - with the Placement option, no state line;
  - the French table gives French labels and names.
- **AC2 (B2, B5).** `formatHexTooltip` and the new lines join as B2 says: a
  test with a unit and one without. The existing `hexTooltip.test.ts` cases
  stay green, unchanged.
- **AC3 (B1).** `counterBadge` and its tests are removed (no caller is left),
  and `drawnUnits.ts` makes no text object for a unit. The test is
  `npm run verify`: tsc fails on any caller left behind.
- **AC4 (B2, B4, B8).** An e2e scenario: hover a unit's hex in the Board in
  each view, and read the tooltip text through the dev hook. It shows the
  unit's name and values; an empty hex shows one line. The existing e2e
  scenarios stay green.
- **AC5 (B1, B8, B9).** Live check (owner):
  - the Drawn view has no badges;
  - hovering units of both players, in both views and both languages, shows
    readable lines that stay on screen at the edges and at the zoom limits;
  - a charged cavalry unit and a damaged ship show their changed values;
  - Placement shows no state line.

## Non-functional

- **Engine/presentation split:**
  - The formatting is a pure `src/ui/` function with tests, like
    `formatHexTooltip`.
  - The values come from the engine's existing `current*` functions and the
    data tables. No engine change.
  - `MapView` gets the unit for a hex from the scene through a hook, like
    `onHexClick`. It holds no `GameState`.
- **Save format:** unchanged.
- **Undo boundaries:** unchanged.
- **AI / harness:** unaffected.

## Out of scope

- The Standard view's counter images and their printed numbers.
- A tooltip for touch screens.
- Hiding an opponent's information.
- Any other text on the Drawn view's figures.

## Assumptions I made

- **The owner is shown by name and colour**, matching the status bar's seat
  label (`BoardScene.ts:1392`). It is the intent's open question on how the
  owner is shown.
- **The layout is labelled lines** (B2), with values in the print counter's
  order. Labels read better than the counter's bare format, and the order
  stays familiar. It is the intent's open question on layout.
- **Opposing units show everything** (B4), since hotseat play has no hidden
  information. It is the intent's open question on hidden information.
- **Touch is unchanged** (B9). It is the intent's open question on touch.
- **The hook is something like `MapView.unitAt?: (hex) => tooltip lines |
  null`, set by each scene** (Non-functional). The exact shape is for the
  plan.

## Amendment: Placement shows every player's units on hover (owner, 2026-11-22)

Review round 2's N1 found that, in Placement, the tooltip shows units the
screen does not draw: Placement draws only the placing player's own units. The
owner's answer was "/auto 74 (b)": accept it and record it. The reasons:

- **The rules hide nothing.** `05-rules-french-original.md:83-96` describes a
  band at most 3 hexes deep, no contact between armies, and a 4-hex minimum gap
  ("L'écart minimum qui sépare deux armées au début du jeu a été fixé à 4
  hexagones"). It has no secret or simultaneous deployment. The gap rule also
  means each army is placed in view of the others.
- **The hiding is not a design choice.** Placement only ever drew the units
  placed in that scene. The undo/redo commit `511ccc8` kept this by filtering on
  the owner. The comment at `PlacementScene.ts:315-316` ("as each player places
  in private") explains it after the fact, and the rules do not support it.

**B4 now reads "every unit, every player, on the Board and in Placement".**
Hovering an earlier player's placed unit in Placement shows its lines (without
the state line, B6), although Placement does not draw it.
`PlacementScene.ts`'s comment is corrected to say the scene draws only the
placing player's units, which is not a rule. Drawing the other players' units
in Placement is left to a separate intent.
