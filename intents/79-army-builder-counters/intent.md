<!-- generated-by: heraklios/intent@0.1.5 -->
# §79 — The army builder shows each unit's original counter

**Type:** feature
**Originator:** the owner (2026-11-22): "in the army building, I want to see
for each row the corresponding unit, the original unit".
**Source:** none (a request while playing).

## Problem

Each row of the army builder (`ArmyBuilderScene.ts:96-138`) lists a unit
type by name only: "Phalanges", "Chars lourds" and so on, then its cost and
maximum, then the `«` count `»` buttons.

- **No picture of the unit.** The player chooses an army without seeing the
  counters they will place and fight with.
- **Values hidden.** The attack, defence and movement values printed on those
  counters are not shown anywhere on the screen.
- **Unclear names.** Names such as "Fantassins archers" next to "Archers", or
  "Birèmes" next to "Trirèmes", say little to a player who doesn't know the
  print game.

## Outcome

- **The counter on every row.** Each of the 14 rows shows that unit type's
  original counter image (`public/markers/<colour>/<type>.png`), in the
  colour of the player building the army.
- **Large enough to read.** The counter's printed numbers can be read at the
  game's 1100×750 size.
- **Everything else stays the same.** Every row stays on screen, and
  "Confirm army", the total line and the error line stay visible and
  clickable.
- **No other change.** Costs, limits, the default army, validation and the
  hand-off to Placement are unchanged.

## Constraints

- **No rule is involved.** The counters are the print game's own art, and
  the purchase rules (`engine/army.ts`) are untouched.
- **The textures already exist.** `MenuScene` loads every
  `markerTextureKey(player, type)` (`MenuScene.ts:25`), so the builder needs
  no new asset or loading.
- **Fit.** There are 14 rows at 32 px each from y = 70, and the counters are
  74×76 px. Either the rows grow, or the counters are scaled down, or both.
  Whatever is chosen must not push the bottom controls off a 750 px screen.
- **Player-facing text.** Any new label goes into `src/ui/i18n/en.ts` and
  `fr.ts`.
- **Size budget.** `ArmyBuilderScene.ts` is 190 lines, far from 500. If the
  row layout grows, it can move to a small `src/ui` helper.
- **Live check owed.** Rule 1 applies (`src/scenes/**`), and the change is
  new and visual. An e2e assertion can check that each row has its image.

## Type-specific questions

### Feature
- **Users:** hotseat players building an army, one player after another. A
  computer seat's army is built without this screen.
- **Rulebook basis:** digital-only, with no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. **Size.** Should the counter be a small thumbnail of about 30 px in the
     current row height, or full size of about 60 px, with rows split into
     two columns or the list scrolled?
  2. **Hover.** Should hovering the counter, or the row, show it enlarged,
     or show the values line from §74's tooltip
     (`attack (ranged) range / defence movement`)?
  3. **Colour.** Should it be the building player's own colour, as assumed,
     or a neutral set?
  4. **Placement.** Should the counter sit left of the name, or replace the
     name with the name as a caption?

## Assumptions I made

- **Type:** feature, because it is new visible behaviour.
- **Tier:** the path table decides (`src/scenes/**` → Attested), so
  `review_tier` is left empty.
- **Id:** 79, from `npm run queue -- --next-id`.
- **"The original unit"** means the scanned counter image the Standard view
  shows, not the Drawn view's vector figure.
- **No blocker.** No open intent touches `ArmyBuilderScene.ts`. §74 and §76
  change Placement, not the builder.
