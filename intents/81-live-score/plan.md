<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §81 plan — The Board shows every player's current score at all times

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (accepted 2026-11-22, Q1 answered yes)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

The Board always shows a small panel at the bottom right with one row per
player: their colour, name, score, a `(+30 at sea)` note when they hold the
naval bonus, and their units left. The active player's row is marked. The
figures come from one new pure engine function, `playerScores`
(`src/engine/score.ts`). It returns army value (`armyValue`, unchanged),
the naval bonus (30 or 0, spec I1/I2), the score and units left for every
player. Game Over prints the same score, with the same note, and
`endGameByTimeLimit` now picks the winner on that score (Q1 yes, B11). The
panel is a `src/ui` module that refreshes itself every frame from
`session.gameState`. The scene hook is two lines, paid for by collapsing one
multi-line import, so `BoardScene.ts` shrinks (AC9). Saves, undo and
`legalActions`/`applyAction` are unchanged.

## Risks

- **The winner rule moves three pinned harness games.** `endGameByTimeLimit`
  is the harness's turn-cap ending (`fuzzHarness.ts:1126`), and
  `stats.winnerIds` is pinned in `src/engine/fixtures/72-harness-traces.json`
  for all 66 games (`harnessPinned.test.ts:132`, `toEqual`). I replayed all
  66 pinned games at `cf79a1b` (a scratch vitest run outside the repo, same
  specs and agents as `harnessPinned.test.ts:90-102`), read each final
  state, and applied the new rule. Every replay matched its pinned
  `winnerIds`. With the bonus, exactly three change, all from `[1]` to `[0]`:

  | game | finalArmyValues | ships left | old → new |
  | --- | --- | --- | --- |
  | `ev-vs-ev/seed1` | 0: 10, 1: 35 | only seat 0 | `[1]` → `[0]` (40 > 35) |
  | `ev-vs-ev/seed6` | 0: 10, 1: 35 | only seat 0 | `[1]` → `[0]` (40 > 35) |
  | `ev-vs-ev-found/seed12` | 0: 25, 1: 35 | only seat 0 | `[1]` → `[0]` (55 > 35) |

  In 16 more games one seat holds the bonus without a change of winner:
  `random-default/seed12`, `seed14`, the other `ev-vs-ev*` and `ev-vs-random`
  games. The bonus-free games (`random-push*`, `random-elephant*`, the rest of
  `random-default*`) are unchanged.
  `length`, `sha256` and every other stat cannot move. The turn-cap check
  runs after the last traced action, and `finalArmyValues` still reads
  `armyValue`. So the fixture edit is these three `winnerIds` values, made by
  hand (not by the gated writer, `harnessPinned.test.ts:163-167`), and its
  `git diff` must show exactly three changed lines (subtask 2). Any other
  difference is a regression, never something to re-pin.
- **The soaks.** `fuzzHarness.test.ts:725-726` counts wins and draws only
  for its printed report. It asserts nothing about them (its `expect`s at
  `:762-798` are about coverage). `heuristicSoak.test.ts:79-80` sums
  `finalArmyValues`, which stays `armyValue`. Its trace fingerprints
  (`:157-159`) are not affected. Expected: no soak assertion changes, and
  the `[fuzz] outcomes:` line may print other numbers.
- **The size budget and the parallel intents.** `BoardScene.ts` is 3172, at
  its ceiling (`scripts/size-baseline.json`). This plan makes it 3169: +1
  import, +1 statement, −5 from collapsing the `saveStorage` import. Rule 5
  (`size-budget-lib.mjs:100-104`) then requires the ceiling to be lowered to
  3169 in the same commit. **§83** works against the same ceiling in
  parallel, and **§73** (in build) rewrites BoardScene's combat settling and
  lowers the ceiling a lot. Whichever of §81 and §83 merges second rebases,
  re-measures (`npm run size:baseline -- --write`), and re-checks its
  `budget:` arithmetic against the new base. If §83 already took the
  `saveStorage` collapse, §81 takes the `navalRamming` import instead
  (`BoardScene.ts:84-89`, 6 lines → a value import and an `import type`, −4).
- **`devHook.ts` and §73.** On `main`, `devHook.ts` is 454 lines, and this
  plan adds 5. §73's worktree has it at **exactly 500** right now
  (`git diff --stat` there: +48). If §73 merges first, §81's +5 takes the
  file to 505. It is not in the baseline, so `check:intent` rule 2 fails
  (`size-budget-lib.mjs:91-94`). This is a stop, not a re-pin: the
  implementer amends the plan. Either it adds a `budget:` line that puts
  `devHook.ts` into the baseline, or it moves a snapshot helper out (for
  example `logPanelSnapshot`, `devHook.ts:398-411`, into `logPanel.ts`).
  Both are owner decisions.
- **Tests that pass whatever the code does.** Three places are at risk:
  the bonus tests, the layout tests and the e2e. Bonus tests must use
  states where removing each filter (ship domain, `!destroyed`, "exactly
  one owner") changes the answer (see Tests). Layout tests compare against
  the real `rulesPanelRect`/`visiblePromptRects`, not copied numbers. The
  e2e compares the panel with `playerScores` on `state()` rather than with
  constants. The load case crafts a state where the bonus must be on, so
  the bonus flag is not vacuous.
- **Stale line citations.** Everything below was read at `cf79a1b`. §73 and
  §83 will move BoardScene and devHook lines, so re-read them before each
  subtask, especially `BoardScene.ts:859-862`.
- **Lint cap (19).** The new modules must add no warning: each function at
  most 80 lines, complexity at most 20, at most 7 parameters. After
  `endGameByTimeLimit` stops calling `armyValue`, `turnManager.ts`'s
  `armyValue` import becomes unused and must go (`turnManager.ts:2`), or it
  is an error. `create()` is already over 80 lines, so its +1 line adds no
  new warning.
- **Text width.** At most 300 px wide (B2), the longest French row is
  `Macédoine`, `460 pts`, `(+30 en mer)` and `80 unités`. AC8 checks it.
  If it does not fit at 12 px, the font drops to 11 px. The width never
  grows past 300.
- **Existing e2e clicks under the panel.** `clickHex` centres the camera
  first (`e2e/helpers.ts:176-187`). A hex near the map's south-east corner
  may still sit under the panel when the camera bounds stop the centring.
  The panel then takes the click (B13), and that scenario fails. The full
  `npm run e2e` run in Validation is the check. If it fails, stop: changing
  the panel's place is a spec amendment.
- **Drift-machine fall-through:** not touched, since no `drift.ts` or
  combat-resolution code changes.

## Verified against the codebase

Re-read on `main` at `cf79a1b`. The spec was checked at `c822f4b`, and
`git diff c822f4b cf79a1b` touches no file under `src`, `e2e`, `scripts` or
`README.md`.

**Engine**
- `src/engine/state.ts:247-249` — `livingUnits(state, owner?)` filters `!u.destroyed`.
- `src/engine/state.ts:251-253` — `armyValue(state, owner)` = `livingUnits(...).reduce((sum, u) => sum + unitType(u).cost, 0)`; equipment not read.
- `src/engine/state.ts:255-258` — `currentPlayer(state)` = the player at `seatOrder[activePlayerIndex]`.
- `src/engine/state.ts:183-195` — `winnerIds` doc: "at the highest surviving army value (`armyValue`)".
- `src/engine/turnManager.ts:1-2` — imports `armyValue, livingUnits, unitType` from `./state`.
- `src/engine/turnManager.ts:68-76` — the elimination ending; unchanged by this plan.
- `src/engine/turnManager.ts:163-171` — `endGameByTimeLimit` doc: "Winner: highest surviving army value in purchase points…".
- `src/engine/turnManager.ts:172-185` — `endGameByTimeLimit`: `bestValue` over non-eliminated `armyValue`, `winnerIds` = all at `bestValue`.
- `src/engine/turnManager.test.ts:328-341` `buildUnit(id, owner, typeId, q)`; `:346-360` `buildThreePlayerState()` (three `fantassins`, 5 points each); `:609-665` the `endGameByTimeLimit — draws` describe (no ships, so unaffected).
- `src/data/units.ts` — `fantassins` cost 5 (`:38`), `galeres` 10 (`:155`), `biremes` 20 (`:168`); `domain` field (`:6`).
- `src/data/terrain.ts:110-129` — `canEnterTerrain`: a galley may enter `coast`/`river-wide` (`:124`); land units never sea-like or coast (`:127`).
- `src/engine/combatOdds.ts:55-63` — doc: "`armyValue` — what that ending really counts — sums each surviving unit's FULL printed cost".

**Harness**
- `src/engine/fuzzHarness.ts:16` imports `endGameByTimeLimit`; `:1124-1128` turn cap → `endGameByTimeLimit(state)`, `endedByTimeLimit = true`, `break`, before the next traced action (`:1141`).
- `src/engine/fuzzHarness.ts:1152-1154` — `stats.winnerIds = state.winnerIds`; `finalArmyValues[...] = armyValue(...)`.
- `src/engine/fuzzHarness.ts:786-790` — `endedByTimeLimit` doc: "(highest army value wins)"; `:819-823` `finalArmyValues` doc: "the quantity `endGameByTimeLimit` actually decides a timed game on".
- `src/engine/harnessPinned.test.ts:90-102` the 66 specs; `:132` `expect(game).toEqual(games[spec.name])`; `:163-167` the gated writer (`HERAKLIOS_WRITE_FIXTURES === '72'`).
- `src/engine/fixtures/72-harness-traces.json` — 66 games, each with `stats.winnerIds`; `"ev-vs-ev/seed1"`, `"ev-vs-ev/seed6"`, `"ev-vs-ev-found/seed12"` hold `[1]`.
- `src/engine/fuzzHarness.test.ts:725-726` wins/draws only printed; `src/engine/heuristicSoak.test.ts:79-80` sums `finalArmyValues`.
- `scripts/size-baseline.json` — `BoardScene.ts` 3172, `fuzzHarness.ts` 1276, `combat.ts` 1111, `drift.ts` 667, `heuristicAgent.ts` 1065, `PlacementScene.ts` 548; all measured equal at `cf79a1b`.

**Scenes and UI**
- `src/scenes/GameOverScene.ts:3` imports `armyValue`; `:33-40` one line per `state.players` entry with `t.gameOver.pointsRemaining(p.name, armyValue(state, p.id))`.
- `src/scenes/BoardScene.ts:12` `import { RulesPanel } from '../ui/rulesPanel';`; `:15-20` the six-line `saveStorage` import (four names); `:84-89` the six-line `navalRamming` import.
- `src/scenes/BoardScene.ts:859` `this.rulesPanel = new RulesPanel(this, { onObjectsCreated: (objects) => this.mapView.excludeFromMainCamera(objects) });`
- `src/scenes/BoardScene.ts:860` `this.mapView.pointerBlocked = (x, y) => this.logPanel.contains(x, y) || this.rulesPanel.contains(x, y);`
- `src/scenes/BoardScene.ts:862` `this.mapView.pinUIObjects([...])` — after the panels are created.
- `src/scenes/BoardScene.ts:1446-1462` `update`: returns early when `state.gameOver`; `:2949` `this.scene.start('GameOver')`.
- `src/ui/MapView.ts:51` `pointerBlocked` field; `:228` drag and `:256` wheel return when it is true; `:113-124` the `hitZone` (depth 0, interactive) takes hex clicks; `:278-286` `pinUIObjects` adds the HUD camera; `:291-293` `excludeFromMainCamera`.
- `src/ui/rulesPanel.ts:68` constructor `(scene, config)`; `:84` `contains(x, y)`; `:153-156` its background is `setScrollFactor(0)`, depth, `setInteractive()` (swallows clicks over the map); `:170` `onObjectsCreated(this.shell)`.
- `src/ui/rulesPanelLayout.ts:11` `SIDE_PANEL_WIDTH = 300`; `:17-22` `Rect`; `:25-27` `visiblePromptRects`; `:30-32` `rulesPanelRect`; `:34-36` `rectsIntersect`.
- `src/scenes/BoardScene.ts:2438` advance chooser 320 wide and `:2690` exchange chooser 340 wide, both centred on `width / 2`.
- `src/ui/hexRender.ts:89` `PLAYER_COLORS_HEX = ['#ffd54a', '#ff5a5a', '#5ab4ff', '#5aff7a']`.
- `src/ui/confirmDialog.ts:162`, `src/ui/drawnAnimator.ts:45` — the `SHUTDOWN` clean-up pattern.
- `src/ui/i18n/en.ts:149-155` `gameOver` (`pointsRemaining` `:153`); `:169` `board: {`. `src/ui/i18n/fr.ts:135-141` `gameOver` (`:139`); `:155` `board: {`. en.ts 400 lines, fr.ts 385.
- `src/ui/i18n/en.ts:308`, `fr.ts:291` — the plural style (`count === 1 ? … : …`) inside a message function.

**Dev hook and e2e**
- `src/ui/devHook.ts` 454 lines. `:18` `import type { RulesTab } from './rulesPanel';`; `:148` `rulesPanel()` member; `:192-200` `installDevHook` spreads the builders; `:240-251` `boardReaders`' `Pick<…>` union; `:287` `rulesPanel: () => rulesPanelSnapshot(board(game)),`; `:202-205` `board(game)` throws unless Board is active.
- `e2e/dev-hook-members.spec.ts:7-39` `MEMBERS`, sorted; `:28` `'rulesPanel'`.
- `e2e/helpers.ts:16-17` `MENU_TEST`, `MENU_CLOSE_COMBAT`; `:38-57` `startFromMenu(page, label, scenario, seed)`; `:97` `state(page)`; `:139` `clickButton`; `:149-173` the save-panel helpers; `:176-187` `clickHex` centres then clicks.
- `e2e/savesDir.ts:11` `SAVES_DIR`; `:93-94` `acquireSaveLock`, `withSaveLockHeld`. Slots in use by e2e: 1 (`save-load.spec.ts:28`), 5 and 6 (`save-import.spec.ts:24-25`). Slot 3 is free.
- `e2e/save-import.spec.ts:29-41` the lock-and-clean pattern; `:44-54` save through the panel, read the file.
- `e2e/hud-strays.spec.ts:19-33` — both views, `strays` empty.
- `e2e/language.spec.ts:33-35` — pins the language through `localStorage` key `heraklios.language` before load.
- `e2e/attack-log.spec.ts:8-11` — e2e imports engine and i18n modules.
- `src/ui/testMode.ts:12-13` — `MENU_TEST`: three land units and `['galeres', 'biremes']` each.

**Docs and rules**
- `docs/research/05-rules-french-original.md:480-482` (the count) and `:487-489` (the +30), as quoted in the spec.
- `docs/research/02-rules-transcription.md:301-305` — "(all other players' fleets sunk or absent)".
- `README.md:619` `### Ending the game`; `:650-662` the winner paragraph ("the highest surviving army value in purchase points — the same figure the Game Over screen already lists").

## Where this goes

- **Modules touched:**
  - `src/engine/turnManager.ts` — `endGameByTimeLimit` decides on `playerScores(...).score`; doc comment updated; `armyValue` import dropped.
  - `src/engine/state.ts` — the `winnerIds` doc comment says "score (`playerScores`)" instead of "army value". Comment only, same line count.
  - `src/engine/fuzzHarness.ts` — two doc comments (`:787-788`, `:821-823`) re-worded line for line to say the winner is decided on the score (army value plus the naval bonus). No code change, and the line count stays 1276.
  - `src/engine/combatOdds.ts` — the `:60-62` note re-worded line for line: `armyValue` is what that ending counts, less the naval bonus.
  - `src/engine/harnessPinned.test.ts` — a comment above `SPECS` naming the three games §81 re-pinned and why.
  - `src/engine/fixtures/72-harness-traces.json` — three `winnerIds` values.
  - `src/engine/turnManager.test.ts` — AC3 cases.
  - `src/scenes/GameOverScene.ts` — reads `playerScores`, picks the bonus line.
  - `src/scenes/BoardScene.ts` — +1 import, +1 `createScorePanel` statement, `pointerBlocked` line extended in place, `saveStorage` import on one line.
  - `src/ui/i18n/en.ts`, `fr.ts` — the B12 texts.
  - `src/ui/devHook.ts` — one reader (+5 lines: import, `Pick` entry, member signature with its doc on one line, reader line, and the `ScorePanelSnapshot` type in the existing import).
  - `e2e/dev-hook-members.spec.ts` — `'scorePanel'` in `MEMBERS`.
  - `scripts/size-baseline.json` — `BoardScene.ts` 3172 → 3169 (rule 5).
  - `README.md` — "Ending the game".
- **New modules:**
  - `src/engine/score.ts` — computes every player's army value, naval bonus, score and units left from a `GameState`, applying the rulebook's end-of-game count and its +30 "seuls en mer" bonus.
  - `src/engine/score.test.ts` — AC1, AC2.
  - `src/ui/scorePanelLayout.ts` — what the score panel shows and where, as pure data: its rectangle for a canvas size and player count, and its rows from a state and a message table.
  - `src/ui/scorePanelLayout.test.ts` — AC5, AC6.
  - `src/ui/scorePanel.ts` — draws the score panel on the HUD camera, refreshes it every frame from `session.gameState`, and answers `contains` and the dev-hook snapshot.
  - `e2e/score-panel.spec.ts` — AC7, AC8.
- **Why there:**
  - The score and the bonus are rules, so they go in the engine (principle 5).
  - `score.ts` is their one home (principle 6), and the panel, Game Over and the winner all read it.
  - It is its own small module rather than part of `state.ts`, which holds the shape and its basic queries. The bonus carries a page of interpretation comment (I1-I5, principle 16).
  - The geometry and row content are pure and tested in `src/ui` (principle 15), following `rulesPanelLayout.ts`.
  - `scorePanel.ts` only draws.
  - The panel refreshes itself through the scene's `UPDATE` event and finds itself for the dev hook through a module `WeakMap<Phaser.Scene, ScorePanel>`. So the scene holds no field and no per-frame call (principle 12, spec "Size").
  - Dependencies point down: `scenes` → `ui` → `engine` (principle 2).
  - No state shape change, no new history push, and no new action (principles 7, 10, 11). The winner change is an engine-only rule change, reviewed under the intent's `reviewed` tier.
- **Budget lines:** none. `BoardScene.ts` goes down to 3169, and its
  ceiling is lowered in the same commit. `fuzzHarness.ts` stays at 1276.
  `devHook.ts` (459 after the change), `en.ts` and `fr.ts` stay under 500.

## Subtasks

Each ends with `npm run verify` green. Heavy commands run one at a time,
never in parallel, because memory on this machine is tight.

1. **Engine score** (B1, B7, B8, B9; AC1, AC2). In `src/engine/score.ts`:
   - `NAVAL_BONUS_POINTS = 30`;
   - `navalBonusPlayer(state): PlayerId | null`: the owner when exactly one
     player owns a unit with `unitType(u).domain === 'naval'` and
     `!u.destroyed`, else null;
   - `interface PlayerScore { playerId; armyValue; navalBonus; score; unitsLeft }`;
   - `playerScores(state): PlayerScore[]`: one entry per `state.players`
     entry, in that order. `armyValue` comes from `state.ts`'s `armyValue`,
     `unitsLeft` is `livingUnits(state, id).length`, and `score` is
     `armyValue + navalBonus`.

   The file comment records I1-I5, citing
   `05-rules-french-original.md:487-489` and `02-rules-transcription.md:301-305`.
   Write `score.test.ts`. Commit.
2. **The winner rule and the harness** (B11; AC3). `endGameByTimeLimit`
   takes the best `score` among non-eliminated players from
   `playerScores(state)`, and a tie is still a draw. Drop the `armyValue`
   import, and update the doc comment (`:163-171`) to name the score and the
   bonus. Add the AC3 cases to `turnManager.test.ts`.
   - **The fixture.** In `72-harness-traces.json`, change exactly the three
     `winnerIds` above from `[1]` to `[0]`. Check that
     `git diff -U0 src/engine/fixtures` shows three `-     1` / `+     0`
     pairs and nothing else.
   - **The test comment.** Add a comment in `harnessPinned.test.ts` that
     lists the three games with their values and says why each changed.
   - **Doc comments.** Re-word `state.ts:183-195`, `fuzzHarness.ts:787-788`
     and `:821-823`, and `combatOdds.ts:60-62`, each keeping its line count.
     Then check `wc -l src/engine/fuzzHarness.ts` = 1276.

   Run `npx vitest run src/engine/harnessPinned.test.ts`, then
   `src/engine/turnManager.test.ts`, then `npm run verify`. The rule change,
   the fixture and the tests must be one commit, or `verify` is red in
   between.
3. **Texts and Game Over** (B10, B12; AC4).
   - Add to `en.ts` and `fr.ts` under `board`:
     `scoreHeader` (`Score`/`Score`), `scorePoints(n)` (`${n} pts`),
     `scoreUnits(n)` (en `1 unit` / `${n} units`; fr `${n} unité` for 0
     and 1, `${n} unités` otherwise) and `scoreAtSea` (`(+30 at sea)` /
     `(+30 en mer)`).
   - Under `gameOver`, add `pointsRemainingAtSea(name, points)` with the
     B12 wording.
   - `GameOverScene` reads `playerScores(state)` by index, prints `score`,
     and uses `pointsRemainingAtSea` when `navalBonus > 0`. Its `armyValue`
     import goes.
   - Check with `npx vitest run src/ui/i18n` and commit.
4. **Pure panel model** (B2, B4, B5, B8, B9, B12; AC5, AC6). In
   `src/ui/scorePanelLayout.ts`:
   - `SCORE_PANEL_W = 300`;
   - `scorePanelRect(canvasWidth, canvasHeight, playerCount): Rect`, with
     right margin 12, bottom margin 8 and height `32 + 18 × playerCount`;
   - `scorePanelRows(state, t): ScoreRow[]`, where each row is
     `{ playerId, color: PLAYER_COLORS_HEX[id], name, points, atSea: string | null, units, active }`.
     `active` is `currentPlayer(state).id === id`, and the texts come from
     `t.board`.

   Write `scorePanelLayout.test.ts` and commit.
5. **The panel on the Board** (B2, B3, B6, B13, B14; AC9). In
   `src/ui/scorePanel.ts`:
   - `createScorePanel(scene, mapView): ScorePanel` builds a background
     rectangle (depth 30, `setScrollFactor(0)`, `setInteractive()` to
     swallow clicks, like `rulesPanel.ts:153-156`) and, for each player
     once, a highlight rectangle, a marker triangle, a colour square and
     three text objects. It passes them all to
     `mapView.excludeFromMainCamera`.
   - It registers itself in the module `WeakMap` and listens on
     `Phaser.Scenes.Events.UPDATE`. On each frame it builds the rows from
     `session.gameState` (hidden when null), compares them with the last
     rows as a JSON key, and only on a change calls `setText`/`setVisible`.
     It removes the listener on `SHUTDOWN`.
   - It exports `contains(x, y)` and `scorePanelSnapshot(scene)`, which
     returns the rectangle and, per row, `{ playerId, score, atSea,
     unitsLeft, active }`, plus `fits` (every row text's `getBounds()`
     lies inside the rectangle). The snapshot throws if the scene has no
     panel.
   - In `BoardScene.ts`, add
     `import { createScorePanel } from '../ui/scorePanel';`. After `:859`,
     add `const scorePanel = createScorePanel(this, this.mapView);`, and
     extend `:860` with `|| scorePanel.contains(x, y)`. Put the
     `saveStorage` import on one line.
   - Then `wc -l src/scenes/BoardScene.ts` must be 3169. Run
     `npm run size:baseline -- --write`: its diff must change only
     `BoardScene.ts`, to 3169. Run `npm run verify` and
     `npm run check:intent`, then commit.
6. **Dev hook and e2e** (AC7, AC8).
   - In `devHook.ts`, add `scorePanel()` to `DevHook` (one line, with its
     doc), `| 'scorePanel'` to `boardReaders`' `Pick`, and
     `scorePanel: () => scorePanelSnapshot(board(game)),`, importing
     `scorePanelSnapshot` and its type from `./scorePanel`.
   - Add `'scorePanel'` to `e2e/dev-hook-members.spec.ts` in sorted order.
   - Write `e2e/score-panel.spec.ts` (see Tests).
   - Run `npx playwright test e2e/score-panel.spec.ts e2e/dev-hook-members.spec.ts e2e/hud-strays.spec.ts`,
     then the full `npm run e2e` once, alone. Commit.
7. **README** (spec "Docs"). In "Ending the game" (`README.md:619-662`):
   - the winner is the highest **score**, the surviving purchase value plus
     the +30 naval bonus;
   - the bonus goes to the only player with a ship afloat, wherever it is
     and however the others lost theirs or never bought any (I1, I2);
   - the elimination ending still names its survivor (I5);
   - a paragraph on the always-on Score panel: where it is, what a row
     shows, the active marker, and that eliminated players stay at 0.

   Then `npm run verify` and `npm run check:intent`. Set
   `status: in-review` in `metadata.yml` and commit.

## Tests

**`src/engine/score.test.ts`** (AC1, AC2). The states are built by hand,
as `turnManager.test.ts:328-360` does.
- **Army value.** Two players, each with land units and ships. Each
  entry's `armyValue` equals `armyValue(state, id)` and a hand-summed
  number, so replacing the sum with anything else fails.
- **Damaged ship** (B7). A `biremes` at 1 equipment point counts 20 and is
  in `unitsLeft`. This fails if the score pro-rates damage or skips damaged
  ships.
- **Destroyed units** count in neither figure. This fails if the
  `!destroyed` filter goes.
- **Eliminated player** (B8). No living unit gives `{armyValue: 0,
  navalBonus: 0, score: 0, unitsLeft: 0}`, and the entry is still present.
  This fails if eliminated players are filtered out.
- **Two and four players** (B1, B4). One entry per player, ids ascending.
- **Bonus** (B9, I1). Only seat 0 has a living ship, seat 1 has land only:
  seat 0 has `navalBonus` 30 (literal 30, not the constant) and `score` =
  army value + 30. This fails if the 30 or the addition is mutated.
- **Two fleets.** Both seats have a living ship: no bonus. This fails if
  "exactly one" becomes "at least one".
- **No ships at all:** no bonus. This fails if the empty case gives a
  bonus to anyone.
- **Never bought ships** (I2). Opponents with land units only and seat 0
  with a ship: +30. This also fails if the domain filter is dropped, because
  then everyone "has a unit" and nobody gets the bonus.
- **The last enemy ship destroyed.** Seat 1's ship is `destroyed: true`:
  seat 0 gets +30. Flipping it back to `false` (standing for undo) removes
  the bonus. This fails if the bonus test ignores `destroyed`.
- **Galley up a river** (I1). Seat 0's only ship is a `galeres` on a
  `river-wide` hex: still +30. This fails if the code tests the hex's
  terrain instead of the unit's domain.
- **Ships only** (I4). Seat 0 has only ships: its score is the ships' cost
  + 30.

**`src/engine/turnManager.test.ts`** (AC3), in the `endGameByTimeLimit`
describe:
- **The bonus breaks a tie.** Seat 0 has a `fantassins` and a `galeres`
  (15), seat 1 has `fantassins` + `fantassins` + `fantassins` (15), seat 2
  is eliminated. `winnerIds` is `[0]`. This fails if the function still
  uses `armyValue`, which would give a draw.
- **The bonus creates a draw.** Seat 0 has `fantassins` + `galeres` (15 +
  30 = 45), seat 1 has 45 of land units: `[0, 1]`.
- **The elimination ending is unchanged.** Through `advancePhase`, with
  seat 1 the only one with living units and seat 0 holding only a
  destroyed ship: `winnerIds` is `[1]`.
- The existing draw tests stay green. They have no ships, so the score
  equals the army value.

**`harnessPinned.test.ts`** stays as written, against the three-line fixture
edit. If the rule is reverted, those three games fail. If any other game's
stats or trace move, it fails too.

**`src/ui/scorePanelLayout.test.ts`** (AC5, AC6)
- **The rectangle** (B2). For 2, 3 and 4 players at 1100 × 750:
  - it is inside the canvas, with right edge 1088 and bottom 742, and
    `left >= SIDE_PANEL_WIDTH`;
  - its width is at most 300, and its height is `32 + 18n`;
  - `rectsIntersect` is false against `rulesPanelRect(1100)`, each of
    `visiblePromptRects(1100, 750)`, and the column `{left: 380, top: 0,
    width: 340, height: 750}`;
  - height grows by 18 per player with the bottom fixed.

  This fails if a margin, the width or the growth direction is mutated.
- **Rows** (B4, B5, B8, B9, B12). From a 3-player state:
  - ids are in order, each with its `PLAYER_COLORS_HEX[id]`;
  - exactly one row is `active`, the `currentPlayer` one. Moving
    `activePlayerIndex` moves it. This fails if `active` is always the
    first row or the seat index is confused with the player id: the test
    uses a `seatOrder` that is not the identity.
  - an eliminated player reads `0 pts` and `0 units`;
  - `atSea` is non-null only on the bonus row;
  - with `messagesFor('fr')`: `1 unité`, `0 unité`, `2 unités`,
    `(+30 en mer)`; with `en`: `1 unit`, `0 units`, `2 units`.
- `noLiterals.test.ts` stays green: the panel passes only message-table
  strings and `''` to `.text(`/`setText(`.

**`e2e/score-panel.spec.ts`** (AC7, AC8). The expected figures come from
`playerScores` imported from `../src/engine/score`, applied to
`state(page)`.
- **`MENU_TEST`** (seed 1). Two rows, each equal to the engine's figures.
  The active row is `currentPlayer`, and `fits` is true. The rectangle is
  inside 788..1088 × ..742.
- **End phase ×2.** The active row is the other player.
- **Drawn view.** Click `🗺 Drawn view` and wait for `boardView() ===
  'drawn'`: the same rectangle and rows.
- **Wheel over the panel.** `page.mouse.wheel` at the panel's centre leaves
  `cameraZoom()` unchanged (B13).
- **`MENU_CLOSE_COMBAT`** (seed as `attacks.spec.ts`). Resolve the
  scenario's attacks with `settle`, and the rows equal the engine's figures
  on the new `state()`. After `Undo` the same holds for the restored
  state, and after `Redo` again (B6).
- **The bonus after a load** (B6, B9). Under `acquireSaveLock`, using slot
  3:
  - from `MENU_TEST`, save through the panel (`Save`, index 2) and read
    `slot-3.json`;
  - set both of player 1's ships `destroyed: true`, write the file back,
    then `Load` on that row;
  - player 0's row has `atSea` and `score` = `armyValue` + 30, and player
    1's has neither.

  The file is removed in `afterEach` under `withSaveLockHeld`, as
  `save-import.spec.ts:29-41` does.
- **French** (AC8). A second test pins `heraklios.language = 'fr'` as
  `language.spec.ts` does and starts `MENU_TEST`: `fits` is true.
- Each test ends with `expect(errors).toEqual([])`.

`e2e/hud-strays.spec.ts` stays green with the panel on screen (B14: no
panel object is drawn by both cameras), and `dev-hook-members.spec.ts`
lists `scorePanel`.

## Validation

- `npm run verify` green, run alone. It includes `harnessPinned`, the soaks
  and the lint cap at 19, which is not raised.
- `npm run check:intent` PASS, with `BoardScene.ts` at 3169, its ceiling
  lowered to 3169, and no `budget:` line.
- `git diff main -- src/engine/fixtures` shows exactly the three
  `winnerIds` lines.
- `npm run e2e` (once, alone, after verify) green. It is not part of
  verify, and the paths call for it: `src/scenes`, `src/ui`, `e2e`.
- **Live check** (owed: `src/ui/**` and `src/scenes/**`, new and visual,
  AC10). The owner checks the following:
  1. Start a 3- or 4-player game with one computer seat, from the Menu
     through Army Builder and Placement.
  2. On the Board, the Score panel is at the bottom right, readable, and
     covers no button, the log or the Tables panel, in the Standard and the
     Drawn view.
  3. Each row's square and name match that player's unit colour, and units
     left match the count on the board.
  4. The active row is marked and follows the turn, including into and out
     of the computer's turn. It updates while the computer attacks.
  5. Destroy a unit: its owner's score drops at once. Undo puts it back,
     and Redo takes it away again.
  6. Open the Tables panel, and trigger a retreat or exchange prompt and a
     ram prompt: the Score panel stays, and nothing overlaps it.
  7. A drag or wheel starting on the panel does not move the map, and a
     click on it selects nothing.
  8. Switch to French: every row fits.
  9. End the game (End game button, or a round limit): Game Over lists the
     same figures, with `(+30 at sea)` on a bonus player's line, and the
     winner agrees with them.

## Assumptions I made

- **`playerScores` lives in a new `src/engine/score.ts`**, not in
  `state.ts`. The spec leaves the choice to the plan. The bonus's
  interpretation comment is long, and `state.ts` is the shape plus basic
  queries.
- **`navalBonusPlayer` checks the unit's domain, never the hex** (I1 as
  written). A ship is "at sea" if `unitType(u).domain === 'naval'` and it
  is not destroyed.
- **The panel polls once per frame through the scene's `UPDATE` event** and
  redraws only on a change. It does not use refresh calls from the scene.
  That covers every path in B6 (combat, drift, ram, boarding, undo, redo,
  load, a computer turn) without adding a line to `BoardScene`, and it keeps
  running after `update`'s `gameOver` early return (B3).
- **The dev hook finds the panel through a module `WeakMap` keyed by scene**,
  not a `BoardScene` field read by name. A field would cost the scene a
  declaration line and need a member guard like `RULES_MEMBERS`.
- **The lines the scene hook needs come from putting the `saveStorage`
  import on one line** (101 characters, about the length of the file's
  other single-line imports). That edit is unrelated to the feature. It is
  the cheapest honest saving, and it leaves the scene 3 lines shorter.
- **The active marker is a drawn triangle plus a row highlight**, not a
  glyph in the text, so no new string is needed for it.
- **Width 300 px and font 12 px.** B2 allows up to 300. The text sizes are
  not in the spec, and AC8 checks the fit.
- **The new message keys** are `board.scoreHeader`, `scorePoints`,
  `scoreUnits` and `scoreAtSea`, and `gameOver.pointsRemainingAtSea`. The
  spec only suggests names.
- **Game Over has no unit test.** It is three lines of presentation reading
  `playerScores`. AC4 (reading) and the live check cover it, since no e2e
  scenario reaches Game Over today.
- **The fixture is edited by hand, not regenerated.** The gated writer
  would rewrite all 66 games, and the review would have to trust that
  nothing else moved. Three hand-edited lines show what moved.
- **Slot 3 for the e2e load.** e2e uses slots 1, 5 and 6 today.
- **The doc comments in `state.ts`, `fuzzHarness.ts` and `combatOdds.ts` are
  re-worded line for line**, so no file's size moves. Otherwise they would
  say the winner is decided on army value, which would be stale.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
