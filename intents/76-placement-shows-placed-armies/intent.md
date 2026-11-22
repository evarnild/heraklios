<!-- generated-by: heraklios/intent@0.1.5 -->
# §76 — Placement shows the armies other players have already placed

**Type:** feature
**Originator:** the owner (2026-11-22), after §74's review finding N1: "I
think we should show the already placed units".
**Source:** `intents/74-unit-hover-stats/review.md` → round 2, N1, and the
owner's question about whether the rules hide placement. The amendment at the
end of `intents/74-unit-hover-stats/spec.md` records the answer.

## Problem

In Placement, each player sees only their own units. The scene draws
`session.gameState!.units.filter((u) => u.owner === this.playerIndex)`
(`src/scenes/PlacementScene.ts:318`, `main` at `1b55e2b`). The comment above
it gives the reason "as each player places in private".

The rules hide nothing at placement (`docs/research/05-rules-french-original.md:83-96`):

> L'ensemble des unités doit être placé le long du bord qui lui est assigné
> sur une largeur ne pouvant pas excéder trois hexagones. Jamais deux unités
> d'armées différentes ne doivent être au contact avant que les hostilités ne
> soient engagées. […] L'écart minimum qui sépare deux armées au début du jeu
> a été fixé à 4 hexagones.

That minimum gap depends on where the other armies stand. The game already
applies it: `legalDeploymentHexes(edge, enemyHexes)` takes hexes out of a
later player's green band when they are too close to earlier players' units.
So a later player sees their band shrink because of units they are not shown.

The hiding was never decided. The scene only ever drew what was placed in it,
and the undo/redo commit `511ccc8` (2026-07-25) kept that by filtering on the
owner. Once §74 merges, its tooltip will show those hidden units on hover. The
board would then show nothing on a hex while the tooltip names a unit there.

## Outcome

- **Placement draws every placed unit.** A player in Placement sees the units
  of every player who placed before them, in every board view, in addition to
  their own.
- **Earlier players' units are told apart.** They are drawn visibly distinct
  from the placing player's own units, for example dimmed.
- **They cannot be touched.** A click on one does nothing: it is not
  selectable, and its hex is not legal. Undo and redo affect only the placing
  player's own placements, as today.
- **The tooltip matches the board.** Hovering an earlier player's unit shows
  the same lines as §74 gives it in Placement. Placement never shows a unit's
  state line, which is §74's B6.
- **The misleading comment goes.** The "places in private" comment is removed
  or corrected.
- **The rest of the game is unchanged.** The rules, the deployment zones, the
  gap check, saves and the computer seats stay as they are. A computer seat
  still deploys without a Placement screen of its own.

## Constraints

- **No rule change.** This is presentation only. The engine's deployment
  rules (`src/engine/deployment.ts`, from §72) are untouched.
- **Size ceiling.** `src/scenes/PlacementScene.ts` is at its ceiling (548
  lines). Any growth needs a budget line, or the logic goes into a `src/ui`
  helper.
- **Drawing seam.** The view interface (`BoardView`, `UnitDrawing`) has no
  per-unit dimming today. Its only translucent drawing is the staged ghost
  ship. How "visibly distinct" is drawn in both views is for the spec.
- **Blocked by §74.** Both intents touch Placement's tooltip and the same
  comment, and this intent's tooltip behaviour builds on §74's.
- **Live check owed** under rule 1 (`src/scenes/**`, `src/ui/**`), because
  the change is visual.
- **Out of scope:**
  - hidden or simultaneous deployment as an option;
  - showing a computer seat's deployment as it happens. Its units simply
    appear for the next human seat.

## Type-specific questions

### Feature
- **Users:** hotseat players placing after another seat, human or computer.
- **Rulebook basis:** `05-rules-french-original.md:83-96`, quoted above. It
  has no hidden placement, and the 4-hex gap is relative to the other armies.
- **Known simplification it removes:** none listed. This is a presentation gap.
- **Open design questions (for the spec):**
  - **How "distinct" is drawn.** Options include dimming (alpha), a muted
    outline, or the owner's colour at lower saturation. It must work in both
    the Standard view (counter images) and the Drawn view (figures), and it
    may need `UnitDrawing` to carry a flag.
  - **Whether the gap shows.** Should the band's excluded hexes near enemy
    units be shown differently, or is it enough that the band is shaped
    around the units now on screen?
  - **Hand-over.** Should the screen briefly point out "N units already
    placed" when the next player's Placement opens, or is drawing them
    enough?

## Assumptions I made

- **Type: feature.** It changes what a player sees. Per-unit dimming touches
  the view seam, so it does not fit an adjustment's 5 files and 60 lines.
- **Dimmed is the starting proposal** for "visibly distinct". The spec
  decides.
- **`blocked_by: 74`**, for the reasons under Constraints.
- **`review_tier` left empty.** The path table gives Attested.
- **The id is 76**, from `npm run queue -- --next-id`.
