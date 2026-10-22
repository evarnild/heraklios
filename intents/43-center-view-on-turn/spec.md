<!-- generated-by: heraklios/intent@0.1.2 -->
# §43 spec — Centre the view on the new player's land units when their turn starts

Accepted intent: [intent.md](intent.md)

Written against `main` at `b856517`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/` | Nothing: digital-only behaviour, no print rule |
| `src/ui/MapView.ts:191-196` | The Board's camera starts at the board's top-left and is clamped to the board's bounds (`enableDrag` → `setBounds`) |
| `src/ui/MapView.ts:576-579` `centerOn(hex)` | Centring on one hex already exists; the Placement screen uses it |
| `intents/32-e2e-smoke-suite`, `intents/36-e2e-language-scenario` | How a scenario reads the board through the dev hook and imports pure modules |

## Behaviour

**B1 — The point.** The view's target is the **average of the screen
positions** (`hexToPixel`) of the player's land units that are not
destroyed: units whose type's `domain` is `'land'` (`src/data/units.ts`).
Ships never count (owner's decision).
Why the average, not the centre of the box around them: one unit far from
the rest (a scout, a unit cut off) moves the average a little and the box
centre a lot; the average stays on the main body of the army.

**B2 — No land unit, no move.** If the player has no land unit left, the
view stays where it is.

**B3 — When.** The view moves to the active player's point:
1. when a player's movement phase begins after another player's turn
   (`BoardScene.endPhase`, the branch where the new phase is
   `'movement'`, next to the autosave there);
2. when the Board opens on a game: a new game after placement, a test-mode
   shortcut, or a load from the Menu (`BoardScene.create`), and after an
   in-place load (`BoardScene.loadInPlace`).

It does not move on movement → combat, on undo or redo, on any unit move or
attack, or at any other time (owner's decision).

**B4 — Every seat.** It happens for AI seats too: when an AI's turn
starts, the view moves to its land units, and when the turn passes to the
next seat, it moves again (owner's decision).

**B5 — How it moves.** It jumps: the camera is centred on the point at once,
at the current zoom. No animation: a pan would slow AI-only games and the
smoke suite, and B4 already moves the view often in a game with AI seats.
The camera's bounds clamp the jump at the board's edges, as dragging does.

**B6 — The pieces.**
- A pure function in `src/ui/` (next to `mapBounds.ts`, e.g.
  `src/ui/viewCentre.ts`): `landUnitsCentre(units, owner, unitType)` →
  the average point in `hexToPixel` space, or `null` (B2). No Phaser
  import.
- `MapView.centerOnPoint(point)`: the same as `centerOn(hex)` but for a
  point in `hexToPixel` space (adds the board origin the way `toScreen`
  does).
- `BoardScene`: one private method, `centreOnActivePlayer()`, called at
  the three places in B3.

**B7 — The dev hook gets one read-only field**, `viewCentre(): Point`: the
main camera's midpoint in canvas coordinates. The scenario (B8) compares
it with `hexToCanvas` of the target. Dev-only, like the rest of the hook.

**B8 — A smoke scenario, `e2e/view-centre.spec.ts`.**
1. From **Test mode**: once the Board is idle, player 1's land-units
   centre is near the view's centre: `hexToCanvas` of the hex nearest the
   centre (from the pure function) is within one hex width of
   `viewCentre()`, unless that point is clamped by the board edge, in
   which case it is at least on screen.
2. End player 1's movement and combat phases (End phase twice, by real
   clicks). Now player 2's land-units centre is on screen and nearer the
   view's centre than player 1's.
3. No page or console error.

The scenario computes each player's centre with the same pure function it
imports (as §36 imports the tables), from `__heraklios.state()`.

## Interpretations

None of the rulebook. One reading of the owner's words: "the middle of all
the pieces of the player" is the average position of their land units
(B1), at the current zoom (intent: "Centre, keep zoom").

## Acceptance criteria

- **AC1** — `viewCentre.test.ts`: the average of two, three and one
  land unit; ships and destroyed units ignored; another player's units
  ignored; no land unit → `null`. Mutants: drop the domain filter, drop
  the `destroyed` filter, drop the owner filter, sum without dividing.
- **AC2** — the three call sites of B3, and no other: the review reads
  `BoardScene` for every `centreOnActivePlayer()` call.
- **AC3** — `npm run e2e` passes with the new scenario (8 tests), and
  passes 5× on the new file (`--repeat-each=5`).
- **AC4** — the existing four game scenarios still pass: they centre the
  camera themselves before each click (`e2e/helpers.ts` `clickHex`), so
  the jump doesn't move their targets.
- **AC5** — live check, owed by path (`src/scenes/**`, `src/ui/**`) and
  kept (owner, 2026-10-22): Test mode → the view starts on player 1's
  army → end both phases → the view jumps to player 2's army; then a game
  with an AI seat for one round, watching the view follow each seat.

## Non-functional

- **Engine/presentation split:** the point is computed in `src/ui/`, pure
  and tested; `src/engine/` and `src/data/` don't change.
- **Save format:** unchanged; the camera isn't saved.
- **Undo boundaries:** unchanged; undo doesn't move the view (B3).
- **AI / harness:** unchanged; the fuzz harness has no camera.
- **Lint cap 21:** `BoardScene.ts` gains one short method and three
  calls; no function grows past its guardrail.

## Out of scope

- The Placement screen (it already follows the deployment zone).
- Zooming to fit; animation; a "centre on my army" button (a possible
  later intent).
- Changing `REVIEW-POLICY.md`'s live-check rule.

## Assumptions I made

- The average (B1) and the jump (B5): the intent left both open; the
  reasons are above.
- After a load from the Menu the view centres on the active player, even
  mid-turn, since a load puts the player back at the board.
- One hex width as the e2e tolerance (B8), and "on screen" when clamped:
  a pixel-exact check would fail on rounding and edge clamping.
