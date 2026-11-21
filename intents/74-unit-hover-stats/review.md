<!-- generated-by: heraklios/review@0.2.0 -->
# §74 review — Hovering a unit shows its characteristics; the Drawn view's number badge goes

verdict: rework
tier: attested
reviewed-commit: 0020356
round: 1
sampled: no
run: auto
live-check: owed

Tier is set by the paths (`src/ui/**`, `src/scenes/**`, `e2e/**`, `README.md`,
all Attested). `review_tier` is empty, no rule is added, and nothing is CRITICAL
or HIGH. `sdlc:scan -- --sample-due auto --exclude 74` says "sampled: yes", but
sampling applies only to `attest`. If a later round attests, re-run it.

The verdict is `rework`. Two findings need the owner's decision (F2, F5). The
others are mechanical.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2): F1, F2 |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. No rule changes. The value order matches the counter, `05-rules-french-original.md:73-76`: "valeur d'attaque → force d'attaque par projectile (s'il y a lieu) → portée des projectiles … valeur de défense → valeur de mouvement" |
| 4 | Tests prove the rule | findings (3): F3, F4, F7 |
| 5 | Boundary and conventions | pass. I1 at `src/ui/unitTooltip.ts:15-19`, I2 at `src/ui/drawnUnits.ts:198-199`. No GameState, save or undo change, and all text goes through i18n |
| 6 | Numbers in prose | pass |
| 7 | Documentation | findings (1): F5. README `:148-158` and `:552-553` are accurate |
| 8 | Guardrails and hygiene | findings (1): F2. Lint 21 warnings, equal to the cap. No new dependency |
| 9 | Repo footguns | pass. The engine is untouched |
| 10 | Architecture | pass, with LOW F6. A pure `src/ui` formatter over the engine's `current*` functions (principles 5, 6, 15). MapView holds no GameState and takes a hook (principle 7) |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 74, feature)
  note:  15 file(s), 335 line(s) changed outside intents/.
```

## Findings
- **F1, MEDIUM**, `src/ui/MapView.ts:204-211` with `:391-394`: the tooltip goes
  stale when a unit arrives on or leaves the hovered hex.
  - The text is built only when the hovered hex changes. A move is made by
    clicking the destination, so the pointer is already there when the unit
    lands.
  - A probe spec (deleted afterwards) moved a unit onto the hovered hex. After
    `waitIdle` and 10 frames, `tooltipText()` still returned `"(0, 1) — Plain"`.
    That is against B2.
  - The same cause shows in Placement clicks, undo, a unit destroyed under the
    pointer, and a stale "movement left".
  - Needs rework (B2 decides it): when units are redrawn through MapView's
    `setUnits`, rebuild the visible tooltip for `hoveredKey`. Add an e2e step:
    click-move a unit onto the hovered hex and assert its lines.
- **F2, MEDIUM**, `src/ui/devHook.ts:271`: a second packed line keeps
  `installDevHook` at the 80-line limit.
  - The line is
    `landscapeBuilds: () => landscapeBuilds(), tooltipText: () => mapScene().mapView.tooltipText(),`.
    It is the second such line, after §66's at `:265`, which the owner accepted
    in §66's review.
  - Measured with eslint (stdin, file untouched): 80 at HEAD; 81 with §74's
    entry on its own line, which warns; 82 with both split.
  - No clean fix fits inside §74, and the plan's own Risks said to stop rather
    than add a warning.
  - Needs decision:
    - (a) accept a second packed line, recorded as §66's was; or
    - (b) split `installDevHook`, which is existing code beyond §74 and so a
      plan amendment.
- **F3, LOW**, `src/ui/unitTooltip.ts:34`: mutant M5 survives
  (`currentRangedAttack(unit)` → `type.rangedAttack`).
  - The only ranged case tested is archers, whose current and printed values
    never differ.
  - Needs rework: a damaged trireme case, asserted in full, with
    `ranged 0 (2), range 2`.
- **F4, LOW**, `src/ui/unitTooltip.test.ts:71`, and also `:34`, `:43`,
  `:60-61`: some assertions are not full strings.
  - The French case checks the first line by a regex, so the French unit name
    is never asserted. The plan asks for "the full string each time".
  - Needs rework: assert the whole French text, and the `{state:false}`
    bireme's two lines in full.
- **F5, LOW**, `src/ui/i18n/fr.ts:55`: the French word for equipment is
  `équipement`.
  - The rulebook says "points d'équipage" (`05-rules-french-original.md:426-432`,
    `:470-473`), and the app's French tables already say `d'équipage`
    (`fr.ts:214-215`, `:333`, `:337-338`).
  - Needs decision (the plan left the exact strings for review). The reviewer
    recommends `équipage`.
- **F6, LOW**, `src/ui/MapView.ts:7-9`, `src/scenes/BoardScene.ts:883`,
  `src/scenes/PlacementScene.ts:143`: the size budget is met by layout.
  - Each scene deleted a blank line to stay at its ceiling, which hides growth
    (eslint's non-blank count rose).
  - MapView re-exports `unitTooltipFor` to save the scenes an import line, and
    sits between import statements.
  - `:393-394` puts a raw newline inside a template literal.
  - Worth a look: move the re-export next to `:18`, and use `'\n'`.
- **F7, LOW**, `src/scenes/PlacementScene.ts:143`: mutant M20 survives
  (`{ state: false }` → `{ state: true }`), because no test hovers in Placement.
  B6 at the wiring rests on live-check step 10. Worth a look: an e2e Placement
  hover.

Pass 1 divergences, judged:
- subtasks 2 and 3 in one commit: fine;
- the doc-comment reflow: fine;
- the re-export and blank lines: F6;
- the packed devHook line: F2.

`tooltip.owner` on `messages.test.ts`'s same-in-both list is correct: the
template holds only placeholders and punctuation, like `board.seat`.

## Not checked
- **B1, the badge:** no test can see a re-added badge. It rests on tsc
  (`counterBadge` is removed) and on the live check.
- **B8, the box on screen:** edge flipping and readability at the zoom limits.
- **B6 at the Placement wiring:** M20.
- **`MapView.tooltipText()` while hidden:** untested.
- **M7, the range value:** it survives, but it is equivalent on today's data,
  since every ranged unit has range = rangedAttack = 2.
- **B9, touch:** the code path is unchanged.

## Live check
- **Owed:** rule 1 (`src/ui/**`, `src/scenes/**`), for new, visual behaviour.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/74-unit-hover-stats`, run
     `npm run dev -- --port 5274 --strictPort --host 127.0.0.1` and open
     http://127.0.0.1:5274/.
  2. Start "Test mode (2 players, armies ready)".
  3. Switch to "🗺 Drawn view": there are no badges under the figures.
  4. Hover units of both players, in both views. Each shows
     `<unit> — <player> (<colour>)`, then a values line (archers add `ranged 2,
     range 2`), then `movement left N`. Ships also show `equipment E/M`.
  5. Move a unit by clicking its destination and keep the pointer still. The
     tooltip shows the unit's lines (F1).
  6. Charge with a light cavalry unit: `attack 6 (3)` and `charged`.
  7. Board so that a ship loses equipment. It shows reduced values with the
     printed ones in brackets.
  8. Hover near the right and bottom edges, and at both zoom limits. The box
     stays on screen.
  9. Switch to French on the Menu and hover again. The labels are French.
  10. Start a normal game, place a unit, and move the pointer off and back on.
      It shows the name and values lines only.
- **You should see:** steps 3-10 as described, with no text on the Drawn figures.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `0020356`: exit 0. Lint 0 errors,
  21 warnings (cap 21). 90 files, 1533 tests passed. Matches.
- **Coordinator, re-run:** `npm run check:intent`: PASS (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`: 28 passed in 47.2s. Matches.
- **Coordinator, re-run:** the three survivors:
  - M5 (`currentRangedAttack` → printed) SURVIVED;
  - M7 (`type.range` → `type.rangedAttack`) SURVIVED;
  - M20 (Placement `{state: false}` → `true`) SURVIVED: e2e 28 passed with it
    applied.

  The control M3 (attack shows the printed value) was KILLED by "shows a
  charge: doubled attack with the printed value, and charged". Each mutant was
  backed up by copy and restored by copy, and `git status --short` was clean
  after. All match the reviewer.
- **Reviewer:**
  - **Mutants:** 20 on `unitTooltip.ts`, the MapView join and the scene hooks.
    M5, M7 and M20 survived; the rest were killed (M18 and M19 by e2e).
  - **Probe:** the stale-tooltip probe spec (deleted).
  - **devHook line counts** via eslint stdin.
  - **Scene non-blank counts:** main vs HEAD.
  - **README examples:** checked against the code.
- **Taken on trust:** nothing beyond the e2e runs and the probe. No browser was
  driven.
