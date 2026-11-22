<!-- generated-by: heraklios/review@0.2.0 -->
# §74 review — Hovering a unit shows its characteristics; the Drawn view's number badge goes

verdict: rework
tier: attested
reviewed-commit: 0b05252
round: 2
sampled: no
run: auto
live-check: owed

`sampled: no`. Running `npm run sdlc:scan -- --sample-due auto --exclude 74`
gives "nth attested auto change = 10, every 3, sampled: no". It counts only
for an attest.

Every round 1 finding is resolved as the owner decided, apart from the `'\n'`
half of F6. The rework fixed the stale tooltip but brought in one new
mechanical problem (N2). The reviewer also found a Placement privacy leak
(N1), which has been there since round 1. N1 needs the owner's decision.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): N1. F1–F7 resolved as decided, apart from F6's `'\n'` (N3) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. `équipage` matches the rulebook's "points d'équipage" |
| 4 | Tests prove the rule | pass on the rework. Every new behavioural line has a mutant a test kills. VISGUARD survives, equivalent |
| 5 | Boundary and conventions | pass |
| 6 | Numbers in prose | findings (1): N3. Progress says the newline is escaped, and it is not |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass. Lint 21 warnings (cap 21). BoardScene.ts 3172 and PlacementScene.ts 574, both at their ceilings |
| 9 | Repo footguns | pass |
| 10 | Architecture | findings (1): N2 |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 74, feature)
  error: A live check is owed and not recorded. Do the steps in intents/74-unit-hover-stats/review.md → ## Live check, then set live_checked: <date> in intents/74-unit-hover-stats/metadata.yml.
  note:  15 file(s), 407 line(s) changed outside intents/.
```
The only error is the owed live check, which is the owner's to clear.

## Findings
- **N1, MEDIUM**: Placement's tooltip shows the other players' placed units.
  - **Where.** `src/scenes/PlacementScene.ts:143`: the hook calls
    `unitTooltipFor(session.gameState!, hex, { state: false })`, through
    `unitAt` (`src/engine/combat.ts:127-129`), which does not filter by owner.
  - **Why that leaks.** Placement draws only the placing player's own units
    (`PlacementScene.ts:318-321`: "only theirs, as each player places in
    private"). So the second player can hover the first player's band and see,
    by name and values, units that are not drawn.
  - **Why the spec didn't catch it.** B4 ("every unit, every player… Hotseat
    play hides nothing today") was written for the Board, and the spec never
    considered that Placement hides units.
  - **How it was found.** By reading the code. It has been there since
    `0020356`.
  - **Needs decision**, one of:
    - (a) in Placement, show only the placing player's own units, which needs
      a Placement clause in B4/B6 (a spec amendment);
    - (b) accept the leak and record it in the spec and README.

  The reviewer recommends (a).
- **N2, LOW**: `src/ui/MapView.ts:303`. The F1 refresh calls `setText`, but the
  box's position is computed only in `showHexTooltip` (`:415-420`), from the
  old size.
  - When a unit lands on a hovered hex near the right or bottom edge, the box
    grows from 1 line to 3–4 wider lines without re-flipping. It can run off
    the edge, which breaks B8.
  - This is new in the rework, and was found by reading the code.
  - Needs rework (B8 decides it): keep the last pointer x/y from
    `updateHover`, and in `setUnits` call
    `showHexTooltip(this.hoveredHex, lastX, lastY)` instead of a bare
    `setText`. Add an e2e step at the viewport edge that fails against a bare
    `setText`.
- **N3, LOW**: `src/ui/MapView.ts:432-433`. `tooltipTextFor` still uses a raw
  newline in a template literal, so F6's `'\n'` was not done.
  - `plan.md:264` (Progress) claims it was.
  - There is no runtime effect.
  - Needs rework (round 1 F6 decides it): use `'\n' + unitLines`.

**Round 1 findings, resolution.**
- **F1: resolved.**
  - `MapView.ts:209` remembers `hoveredHex`, and `:303` rebuilds the text in
    `setUnits`.
  - The e2e step at `e2e/unit-tooltip.spec.ts:60-77` covers it.
  - Every BoardScene state change that alters the tooltip is followed by
    `renderAllUnits`, including the new turn's refill through `commitEndPhase`
    → `refreshStatus`. Placement's changes go through `drawPlacedUnits`.
- **F2: resolved as the owner decided (a).** The comment is at
  `devHook.ts:271`. The split itself is §75.
- **F3: resolved.** The damaged trireme case is at `unitTooltip.test.ts:59-65`,
  and M5 is now killed.
- **F4: resolved.** The French string and the Placement bireme lines are now
  asserted in full.
- **F5: resolved.** `fr.ts:55` uses `équipage`.
- **F6: half resolved.** The re-export is beside `drawFacingArrowhead`'s
  (`MapView.ts:15-17`), but the `'\n'` is not done (N3).
- **F7: resolved.** The Placement e2e is at `e2e/unit-tooltip.spec.ts:80-107`,
  and M20 is now killed.

## Not checked
- N1 and N2 have not been seen on screen. Both rest on reading the code.
- A camera move under a still pointer (wheel zoom, `centreOnActivePlayer`)
  leaves the whole tooltip on the old hex. This predates §74 and is not §74's.
- B1 (the badge) rests on tsc and the live check.
- B8 (the box on screen) and B9 (touch) are not checked.
- M7 is equivalent on today's data.

## Live check
- owed: rule 1 (`src/ui/**`, `src/scenes/**`), for new, visual behaviour.
- steps:
  1. In `C:/Users/eric/src/heraklios-wt/74-unit-hover-stats`, run
     `npm run dev -- --port 5274 --strictPort --host 127.0.0.1` and open
     http://127.0.0.1:5274/.
  2. Start "Test mode (2 players, armies ready)".
  3. Switch to "🗺 Drawn view": there are no badges under the figures.
  4. Hover units of both players, in both views. Each shows
     `<unit> — <player> (<colour>)`, then the values line, then
     `movement left N`. Archers add `ranged 2, range 2`, and ships add
     `equipment E/M`.
  5. Rest the pointer on an empty reachable hex, select a unit, and click that
     hex without moving the pointer. The unit's lines appear at once.
     - Repeat this near the right and bottom edges: the grown box stays on
       screen (N2).
  6. Charge with a light cavalry unit: it shows `attack 6 (3)` and `charged`.
  7. Board so that a ship loses equipment: it shows reduced values with the
     printed values in brackets.
  8. Hover near the edges, and at both zoom limits: the box stays on screen.
  9. Switch to French on the Menu: the labels are French, and a ship shows
     `équipage E/M`.
  10. Start a normal 2-player game.
      - Player 1 places a unit and moves the pointer off and back on: it shows
        the name and values lines only.
      - While player 2 places, hover player 1's band. What shows there follows
        the N1 decision.
- you should see: steps 3–10 as described, with no text on the Drawn figures.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at `0b05252`. Exit 0; lint 0
  errors, 21 warnings (cap 21); 90 files, 1534 tests passed. Matches.
- **Coordinator, re-run:** `npm run check:intent`. FAIL, with only the owed
  live check (pasted above). Matches.
- **Coordinator, re-run:** `npm run e2e`. 30 passed in 1.1m. Matches.
- **Coordinator, re-run:** the survivors.
  - M7 (`type.range` → `type.rangedAttack`) SURVIVED against vitest. The
    control, M3, was KILLED.
  - VISGUARD (the `?.visible` guard dropped at `MapView.ts:303`) SURVIVED: e2e
    passed 30 with it applied.
  - Each was backed up by copy and restored by copy, and `git status --short`
    was clean after.
  - Both match the reviewer.
- **Reviewer:**
  - Eight mutants were run one at a time.
  - Killed: M5, STATE, FR, M20, F1REFRESH, HOVHEX and ALWAYSAPPEND.
  - Survived: VISGUARD, which is equivalent.
  - The F1 render paths in BoardScene and PlacementScene were read by hand.
  - The line endings were checked with `git ls-files --eol`.
- **Taken on trust:** N1 and N2 rest on reading the code. No browser was
  driven.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 0020356
- round: 1
- sampled: no
- run: auto
- live-check: owed

Tier is set by the paths (`src/ui/**`, `src/scenes/**`, `e2e/**`, `README.md`,
all Attested). `review_tier` is empty, no rule is added, and nothing is CRITICAL
or HIGH. `sdlc:scan -- --sample-due auto --exclude 74` says "sampled: yes", but
sampling applies only to `attest`. If a later round attests, re-run it.

The verdict is `rework`. Two findings need the owner's decision (F2, F5). The
others are mechanical.

### Passes
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

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 74, feature)
  note:  15 file(s), 335 line(s) changed outside intents/.
```

### Findings
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

### Not checked
- **B1, the badge:** no test can see a re-added badge. It rests on tsc
  (`counterBadge` is removed) and on the live check.
- **B8, the box on screen:** edge flipping and readability at the zoom limits.
- **B6 at the Placement wiring:** M20.
- **`MapView.tooltipText()` while hidden:** untested.
- **M7, the range value:** it survives, but it is equivalent on today's data,
  since every ranged unit has range = rangedAttack = 2.
- **B9, touch:** the code path is unchanged.

### Live check
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

### Verified myself vs. taken on trust
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
