<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §72 plan — The engine can run a whole game for a host other than the Phaser scenes

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (with the amendment A1-A4)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

The engine can run a whole game for a host without Phaser.

- **`src/engine/deployment.ts`** builds a starting position. It holds the
  deployment zones moved from `ui/mapBounds.ts`, `deployUnit`, and `autoDeploy`
  (moved from `ui/aiSetup.ts`).
- **A JSON `GameSession`** settles a combat: retreat, push, advance, exchange
  sacrifice, and drift with trample. Each open choice is a pending question,
  answered by a new answer action.
- **`src/engine/host.ts`** is one JSON entry for the whole game. It requires a
  seed, and it carries the `ActionContext` itself.
- **The fuzz harness** settles its combats through the session, by way of a
  small `PlayerAgent` adapter. Its traces and stats stay byte-identical for a
  pinned set of games.
- **The turn-order shuffle** takes the caller's rng (B14).
- **`ui/aiSetup.ts` and `PlacementScene`** use the engine deployment functions.
- **Unchanged:** `BoardScene`, its computer seats, saves, undo and the drift's
  continue pauses.

## Risks

- **The drift state machine's fall-through footgun** (pass 9, §21). The session
  pumps `driftStep` itself.
  - Its loop must copy `resolveElephantDrift` (`drift.ts:568-666`) exactly. Each
    `driftStep` call is followed by its events, then by one input. There is no
    second `driftStep` call before the dice for the first request are rolled,
    and the drift never resumes before a paused trample retreat is resolved.
  - `drift.ts`'s frame logic is not edited. The only change there is `export`
    on `needsInput` (`:209`), so the session uses the same "which input" rule
    as the old driver. No line is added.
  - A parity test (Tests, B7) compares the session with `resolveElephantDrift`
    on the same states and the same rng streams.
- **Tests that pass whatever the code does.**
  - A snapshot test that writes its own fixture on first run proves nothing.
    The fixtures are produced once by a writer test that runs only when an
    environment variable is set. They are committed, and the comparison tests
    import them statically, so a missing file fails to compile.
  - Coverage of the pinned games is asserted, not assumed: pushes, drifts,
    drift combats and exchange choices must each be greater than 0. Otherwise
    "identical traces" could hold over games that never reach the code that
    moved.
  - Each new test names the mutant it kills (Tests).
- **The rng consumption order can change seeded traces.** The agents and the
  dice share one rng in the harness (`fuzzHarness.ts:907-908`, `:1114-1116`,
  `:1198-1201`). So the adapter must call the agent methods in exactly today's
  order and count.
  - **One-option steps still call the agent:**
    - `chooseRetreat` with a single hex (`retreat.ts:33-36`);
    - `choosePushTarget` with a single candidate (`retreat.ts:41-43`);
    - `chooseExchangeSacrifice` when only one minimal subset exists.
  - `RandomAgent.pick` draws one `rng()` even for a list of one
    (`randomAgent.ts:25-32`).
  - **A2:** the session reports each one-option step through `hooks.onForced`
    (the optional 4th argument of `sessionApply`) at the moment it applies it.
    The adapter calls the agent there, before any later die.
  - **No other rng use moves:**
    - dice are rolled inside `sessionApply` after the answer, as today;
    - answers are not added to the trace (`formatAction` covers turn actions
      only, `:928-947`);
    - `sessionLegalActions` with no question open returns `legalActions`
      unchanged.
- **The minimal-sacrifice mapping (spec I3) must be checked before it is relied
  on.**
  - `RandomAgent.chooseExchangeSacrifice` takes a random-order prefix
    (`randomAgent.ts:88-105`), which can be non-minimal. Reading the code, it is
    never called in harness games, because `RandomAgent` only plays singleton
    attacks and `requiresExchangeChoice` needs two or more attackers
    (`combat.ts:1012-1016`).
  - `HeuristicAgent` uses `cheapestSacrifice` (`heuristicAgent.ts:701-705`,
    `combatOdds.ts:263-298`). That function is an exact minimum-value cover, so
    it is minimal when every unit has a positive value (`combatOdds.ts:74-80`).
  - Subtask 1 checks this on the pinned games: every exchange choice made there
    must be minimal. If that check fails on `main`, stop. Under I3 the answer
    set becomes "every subset meeting the threshold", and the plan is amended.
- **Size ceilings.**
  - **`fuzzHarness.ts` (1350 lines) and `PlacementScene.ts` (574 since §66):**
    both are at their ceiling (`scripts/size-baseline.json`), so neither may
    grow at any commit. Both are planned to shrink. The commit that shrinks
    each one runs `npm run size:baseline -- --write`; otherwise rule 5 fails.
  - **`src/engine/actions.ts` (488 lines since §66):** it is not in the
    baseline. If it passes 500, both the lint cap and size rule 2 fail. B14
    changes one call there. A1 keeps the answers out of the `Action` union, so
    no other line is added.
  - **The new modules:** each stays under 500 lines. If `combatResolution.ts`
    nears 450, the retreat cascade moves to its own module.
  - **The lint cap (`--max-warnings 21`):** it must not rise. If the harness
    rewrite removes a warning (for example `applyOneAction`'s complexity), the
    cap is lowered in that same commit.
- **Stale line citations.** Every `path:line` below was read at `1749419`, and
  the files §66 changed were re-checked at `4572a90` (see the end of the next
  section). Subtasks 1-3 move lines in `ui/mapBounds.ts`, `turnManager.ts` and
  `actions.ts`. The implementer re-reads each cited line before editing it, and
  any comment written in the code names symbols, not lines.
- **Specific to §72:**
  - **Kept harness exports.** `processRetreats`, `processDrifts` and
    `capturePendingResolutionItems` are exported and tested directly
    (`fuzzHarness.test.ts:2-12`, `:338-688`), and those tests must stay
    unchanged (AC2). They become thin wrappers over the session machine. The
    session refers to units by id, so each unit those tests pass must be in
    `state.units`. Every case read so far is (`:206`, `:411`, `:446`, `:484`,
    `:527`, `:590`, `:654`).
  - **The dev hook.** `ui/devHook.ts:163-167` (since §66) reads
    `PlacementScene`'s `queue` and `currentLegalHexes()` by name, so both must
    stay.
  - **`autoPlaceSeat`'s callers.** `ui/aiSetup.test.ts` drives `autoPlaceSeat`
    through the `session` singleton, and `:274` parses ids. `autoPlaceSeat`
    therefore stays as a one-line wrapper.
  - **Placement ids (A4).** `n` is the number of units the seat already has.
    This matches `autoPlaceSeat` exactly. For a human seat ≥1 in Placement, ids
    restart at 0, where today `unitCounter` runs on across human seats
    (`PlacementScene.ts:59`). Ids are not shown to the player. The e2e suite
    reads `units.at(-1)`, not ids.
  - **Temporary duplication.** `engine/retreat.ts` and `resolveElephantDrift`
    stay for `BoardScene` (B16), so the retreat and drift sequencing has two
    drivers until the follow-up intent. Both reuse the same `combat.ts` and
    `driftStep` primitives, and only the glue is duplicated. The duplication is
    recorded in `docs/architecture.md` (principles 6, 17).
  - **Test runtime.** About 48 pinned games, plus the host games, are added to
    `npm test`. They are split across several `it` blocks, which stay under the
    60 s `testTimeout` (`vitest.config.ts`).

## Verified against the codebase

Re-read on `main` at `1749419`. `fd90410` (the A1-A4 amendment) changes only
`intents/72-engine-host-seams/`. §66's merge (`f32a5b7`, `main` now
`4572a90`) moved lines in `actions.ts`, `PlacementScene.ts`, `BoardScene.ts`,
`devHook.ts` and `scripts/size-baseline.json`. Those were re-checked by the
coordinator at `4572a90`, and the shifts are listed at the end of this section.

**`src/engine/fuzzHarness.ts`**
- `src/engine/fuzzHarness.ts:32-45` — `PendingResolutionItem`, `capturePendingResolutionItems`, `normalizePendingResolutionItems` (originalHex captured once, before the loop).
- `src/engine/fuzzHarness.ts:149`, `:238`, `:326` — `buildFuzzGameState`, `buildPushScenarioGameState`, `buildElephantScenarioGameState`.
- `src/engine/fuzzHarness.ts:452-472` — `assertTurnOrderPreserved`: the harness never sets `randomizedTurnOrder`, so B14 draws nothing extra there.
- `src/engine/fuzzHarness.ts:676-690` — the exported `resolveUnitRetreat` wraps `engine/retreat.ts` and counts `onPush`.
- `src/engine/fuzzHarness.ts:707-713` — `processAdvanceOffer`: skips a hex that is occupied again or has no eligible candidate, otherwise calls `chooseAdvance(state, alive, hex)`.
- `src/engine/fuzzHarness.ts:732-755` — `processRetreats`: skips a destroyed or already-resolved unit and still makes the defender-side advance offer; resolves; then makes the defender-side offer.
- `src/engine/fuzzHarness.ts:757-796` — `processDrifts`: the same skip rule; `resolveElephantDrift` with `() => rollDie(rng)`; `onDriftStart` adds to `resolvedIds`; `onPush` counts.
- `src/engine/fuzzHarness.ts:802-861` — `HarnessStats` fields.
- `src/engine/fuzzHarness.ts:907-922` — one seeded rng shared by every seat's agent and by the dice.
- `src/engine/fuzzHarness.ts:928-947` — `formatAction` is an exhaustive switch over `Action`.
- `src/engine/fuzzHarness.ts:982-1005` — `assertChosenActionIsLegal` allows combined attacks.
- `src/engine/fuzzHarness.ts:1007-1009` — `emptyContext`.
- `src/engine/fuzzHarness.ts:1027-1057` — `SeatAgentRouter`: routes by unit owner; advance and sacrifice go by `candidates[0]`/`attackers[0]` owner.
- `src/engine/fuzzHarness.ts:1110-1182` — `playRandomGame`: rng at `:1114`, agents at `:1116`, `resetMovementForActivePlayer` at `:1123`, `legalActions(state, context)` at `:1163`, the trace push at `:1167`.
- `src/engine/fuzzHarness.ts:1206-1350` — `applyOneAction`:
  - `:1233-1236` clears `attackedThisPhase`, and clears `rammedThisTurn` on entering movement when the game is not over;
  - `:1269` adds a ram to `rammedThisTurn`;
  - `:1277` adds a boarding attacker;
  - `:1284` adds the land attackers;
  - `:1312-1316` is the exchange-plus-retreats invariant;
  - `:1318-1326` is the drift branch (retreats, then drifts, sharing `resolvedIds`);
  - `:1328-1333` is the exchange, then advances per defender hex;
  - `:1334-1336` is retreats only;
  - `:1337-1341` is advances after DE or EX.

**Agents**
- `src/engine/agent.ts:50-78` — `PlayerAgent`'s four async methods.
- `src/engine/agent.ts:155-158` — `DrivingAgent`.
- `src/engine/randomAgent.ts:25-32` — `pick` draws one `rng()` whatever the list length.
- `src/engine/randomAgent.ts:55-69` — the retreat, push and advance picks (advance adds `null`).
- `src/engine/randomAgent.ts:88-105` — the sacrifice: shuffle, then a prefix.
- `src/engine/heuristicAgent.ts:620-713` — retreat, push and advance answers are deterministic; the sacrifice uses `cheapestSacrifice`; no `await` comes before an rng use.
- `src/engine/combatOdds.ts:74-80` — `unitValue`.
- `src/engine/combatOdds.ts:263-298` — `cheapestSacrifice` is an exact minimum-value cover.

**Engine actions, combat and drift**
- `src/engine/actions.ts:66-74` — the `Action` union.
- `src/engine/actions.ts:253-290` — `applyAction` overloads; `rng = Math.random` default. Since §66 this is `:284`.
- `src/engine/actions.ts:292-303` — the `endPhase` case calls `advancePhase(state)` with no rng. Since §66 this is `:287-288`.
- `src/engine/actions.ts:376-387` — `landAttack`: `rollDie(rng)`, `applyLandCombatResult`, returns `attackers` and `defenderOriginalHexes`. Since §66 the lines are about 5 earlier.
- `src/engine/actions.ts:413-416` — `ActionContext`. Since §66 this is `:408`.
- `src/engine/actions.ts:447-493` — `legalActions(state, context)`. Since §66 it starts at `:442`, and the file is 488 lines.
- `src/engine/combat.ts:116-120` — `eligibleAdvanceCandidates`.
- `src/engine/combat.ts:127-129` — `unitAt`.
- `src/engine/combat.ts:388` — `describeLandAttack`.
- `src/engine/combat.ts:695` — `legalRetreatHexes`.
- `src/engine/combat.ts:854` — `pushCandidates(state, unit, visited)`.
- `src/engine/combat.ts:908-911` — `retreatUnitTo`.
- `src/engine/combat.ts:931-933` — `completePush`.
- `src/engine/combat.ts:935-958` — `LandCombatOutcome`.
- `src/engine/combat.ts:974-1019` — `applyLandCombatResult`: `forceRetreat` at `:985-995`, EX at `:1010-1016`.
- `src/engine/combat.ts:1053-1059` — `exchangeSacrificeMeetsThreshold`, `applyExchangeSacrifice`.
- `src/engine/retreat.ts:24-55` — the async cascade: `resolvedIds.add` on entry; one agent call even for one option; captures `vacatedHex` before recursing; `completePush`, then `onPush`; eliminates when there is neither a hex nor a candidate.
- `src/engine/drift.ts:43-91` — the frames, `DriftAwaiting` and `ElephantDriftState` (plain data: ids and hexes).
- `src/engine/drift.ts:93-114` — `DriftEvent` holds `Unit` references.
- `src/engine/drift.ts:209-221` — `needsInput` (not exported).
- `src/engine/drift.ts:232` — `driftStep(game, drift, input?)`.
- `src/engine/drift.ts:554-667` — `resolveElephantDrift`:
  - `:575-579` counts `driftStarted` and calls `onDriftStart`;
  - `:608-611` counts `combatResolved`;
  - `:640-665` turns the requests into a `rollDie()`, a `rollDie()`, and `resolveUnitRetreat(..., resolvedIds)` followed by `retreatResolved`.

**Turns, rng and saves**
- `src/engine/turnManager.ts:4-33` — `createInitialState` returns `units: []` and `seatOrder` in player order.
- `src/engine/turnManager.ts:46` — `shuffleSeatOrder(seatOrder, rng = Math.random)`.
- `src/engine/turnManager.ts:56` — `advancePhase(state)` has no rng.
- `src/engine/turnManager.ts:116-117` — the shuffle on a round wrap when `randomizedTurnOrder` is set.
- `src/engine/rng.ts:19-30` — `createSeededRng(seed)`.
- `src/engine/dice.ts:11-13` — `rollDie(rng = Math.random)`.
- `src/engine/state.ts:149-155` — `Player` (edge typed inline).
- `src/engine/state.ts:157` — `GameState`.
- `src/engine/saveGame.ts:17` — `SAVE_VERSION = 3`.
- `src/engine/saveGame.ts:128-144` — `SavedGame` carries `attackedThisPhase` and `rammedThisTurn`.
- `src/engine/saveGame.ts:292-304` — `parseSavedGame`.
- `src/engine/saveGame.ts:307-321` — `buildSavedGame`.
- `src/engine/army.ts:5`, `:23` — `ArmySelection`, `validateArmy`.
- `src/engine/seatControl.ts:21` — `SeatControl`.

**`src/ui`, `src/scenes`, e2e and tooling**
- `src/ui/mapBounds.ts:1-6` — imports `hexToPixel` from `./hexRender`; `isSeaLike` and `hexDistance` from lower layers.
- `src/ui/mapBounds.ts:8` — `Edge`.
- `src/ui/mapBounds.ts:11-18` — `allHexes`.
- `src/ui/mapBounds.ts:20` — `DEPTH = 3`.
- `src/ui/mapBounds.ts:68-104` — `depthBand`.
- `src/ui/mapBounds.ts:112-120` — the memoised `deploymentBand`.
- `src/ui/mapBounds.ts:129-151` — `EDGE_NAVAL_ZONE`, `navalDeploymentBand`.
- `src/ui/mapBounds.ts:169-173` — `excludeTooClose` and its fallback.
- `src/ui/mapBounds.ts:177-185` — `legalDeploymentHexes` and `legalNavalDeploymentHexes` (`minGap = 4`).
- `src/ui/mapBounds.ts:193-207` — `seaZoneNear` uses `hexToPixel`.
- `src/ui/hexRender.ts:7` — `hexToPixel`.
- `src/ui/testMode.ts:3`, `src/ui/MapView.ts:5`, `src/ui/standardBoardView.ts:5`, `src/ui/hexHitTest.test.ts:4`, `src/ui/testMode.test.ts:6` — other importers of `ui/mapBounds`.
- `src/ui/aiSetup.ts:62-65` — `keepsOffPlateauxAtDeployment`.
- `src/ui/aiSetup.ts:88-91` — `unitsInPlacementOrder`.
- `src/ui/aiSetup.ts:139-192` — `autoPlaceSeat`:
  - it reads `session.armySelections` at `:163`;
  - it draws one rng per hex at `:152-160`, plus a ship facing at `:184`;
  - its counter starts at 0 at `:162`.
- `src/ui/aiSetup.ts:203-213` — `skipAiPlacementSeats`.
- `src/ui/aiSetup.test.ts:91-290` — the `autoPlaceSeat` tests; ids parsed at `:274`.
- `src/ui/session.ts:7` — `Edge`.
- `src/ui/session.ts:204-212` — `buildPlayers` (`purchasePoints: 400`).
- `src/ui/devHook.ts:157-163`, `:267-273` — reads `PlacementScene` `queue` and `currentLegalHexes()`. Since §66 this is `:163-167`.
- `src/scenes/PlacementScene.ts:4`, `:6` — imports from `ui/mapBounds` and `ui/aiSetup`.
- `src/scenes/PlacementScene.ts:59` — `unitCounter`, never reset in `create`.
- `src/scenes/PlacementScene.ts:97-118` — `create` builds the state and deploys computer seats.
- `src/scenes/PlacementScene.ts:126-129` — legal hexes computed once.
- `src/scenes/PlacementScene.ts:298-316` — the snapshot carries `unitCounter`. Since §66: `:303`, `:311`.
- `src/scenes/PlacementScene.ts:391-401` — `currentLegalHexes`. Since §66: `:390`.
- `src/scenes/PlacementScene.ts:422-466` — `tryPlace`; the unit literal at `:445-459`. Since §66: the id at `:448`.
- `src/scenes/PlacementScene.ts:512-541` — `confirmPendingShip`; the unit literal at `:519-530`.
- `src/scenes/PlacementScene.ts` — 575 lines at `1749419`, 574 since §66.
- `src/scenes/BoardScene.ts:467-470` — `diceRng` clears the history. Since §66: `:471`.
- `src/scenes/BoardScene.ts:2938` — `applyAction(state, endAction)` with no rng, so B14 leaves the web game on `Math.random`. Since §66: `:2942`.
- `src/engine/fuzzHarness.test.ts:2-12` — imports the exported harness functions.
- `src/engine/fuzzHarness.test.ts:338-688` — direct tests of `processRetreats` and `processDrifts`.
- `src/engine/heuristicSoak.test.ts:1`, `:139-159` — sha256-pinned harness traces (seed 7).
- `e2e/placement.spec.ts` — places land units and two ships through the dev hook; reads `units.at(-1)`.
- `eslint.config.js:98` — the engine import restriction covers engine tests.
- `eslint.config.js:142-145` — length rules are off for tests.
- `package.json:12` — `--max-warnings 21`.
- `scripts/size-baseline.json` — `fuzzHarness.ts` 1350, `PlacementScene.ts` 574 (since §66), `drift.ts` 667, `combat.ts` 1111.
- `scripts/size-budget-lib.mjs:85-118` — rule 5 requires lowering a shrunk ceiling.
- `docs/architecture.md:92`, `:95`, `:96` — the recorded exceptions (post-combat bookkeeping; `Math.random` defaults; `shuffleSeatOrder`).
- `intents/72-engine-host-seams/spec.md:270-298` — A1 to A4.

**Re-checked at `4572a90`, after §66 merged (coordinator).**
- `actions.ts` is 488 lines:
  - `rng = Math.random` at `:284`;
  - `case 'endPhase'` / `advancePhase(state)` at `:287-288`;
  - `ActionContext` at `:408`;
  - `legalActions` at `:442`.
- `PlacementScene.ts` is 574 lines, with a ceiling of 574:
  - `unitCounter` at `:59`;
  - the snapshot at `:303`, `:311`;
  - `currentLegalHexes` at `:390`;
  - the id at `:448`.
- `BoardScene.ts`: `diceRng` at `:471` and `applyAction(state, endAction)` at `:2942`.
- `devHook.ts`: `PLACEMENT_MEMBERS` at `:163-167`.
- `hex.ts` gained `parseHexKey`.

None of these moves changes a step of this plan.

## Where this goes

**Modules touched**
- `src/engine/drift.ts` — `export` on `needsInput` only. Nothing else changes.
- `src/engine/turnManager.ts` — `advancePhase(state, rng = Math.random)` passes `rng` to `shuffleSeatOrder` (B14).
- `src/engine/actions.ts` — the `endPhase` case passes its `rng` to `advancePhase`. The file stays at 488 lines.
- `src/engine/fuzzHarness.ts`, which shrinks:
  - `playRandomGame` and `applyOneAction` run on a `GameSession`;
  - `processRetreats` and `processDrifts` become thin wrappers over the session machine;
  - `processAdvanceOffer`, `emptyContext` and the inline combat sequencing go.
- `src/ui/mapBounds.ts` — re-exports the moved zone functions and `Edge`, and keeps `seaZoneNear`.
- `src/ui/aiSetup.ts` — `autoPlaceSeat` delegates to `autoDeploy`; the placement-order helpers move out.
- `src/scenes/PlacementScene.ts`, which shrinks:
  - `tryPlace` and `confirmPendingShip` build units with `deployUnit`;
  - `unitCounter` and its snapshot field go (A4);
  - `queue` and `currentLegalHexes` stay.
- `README.md` ("Project structure"), `CLAUDE.md` (Architecture module map), `docs/architecture.md` (recorded exceptions).
- `scripts/size-baseline.json` — the two ceilings are lowered by `--write`.

**New modules**
- `src/engine/deployment.ts` — where a seat may deploy and how a unit is deployed: the zones, `deployUnit` and `autoDeploy`.
- `src/engine/gameSession.ts` — the JSON session: the state, the context, the open question; legal actions and answers; applying an action or an answer.
- `src/engine/combatResolution.ts` — the resumable, JSON-only machine that settles one land combat in today's harness order, stopping at each choice.
- `src/engine/sessionAgents.ts` — answers a session's questions with a `PlayerAgent`, in the order and number of calls the agents had before §72.
- `src/engine/host.ts` — the supported JSON entry: new game, legal actions, apply, question, state, save, load, all with a seeded rng.
- `src/engine/fixtures/72-*.json` — the before-§72 snapshots (test data, never imported by the game).

**Why there** (`docs/architecture.md`)
- **The zones go to `src/engine/deployment.ts`, not `src/data`.**
  - `src/data` is the bottom layer, and the gap rule needs `hexDistance` from
    `engine/hex.ts`, so the zones cannot live in data (principle 2).
  - The zones are rules computed from map data, not a table (principle 5).
  - `deployUnit` and `autoDeploy` need `engine/state` and `unitCategory`, and
    one module keeps the zone rule and its checks in one home (principle 6).
  - `ui/mapBounds.ts` keeps its exports by re-exporting them, with
    `export { allHexes, deploymentBand, navalDeploymentBand, legalDeploymentHexes, legalNavalDeploymentHexes, type Edge } from '../engine/deployment';`.
    Its importers (`PlacementScene`, `aiSetup`, `testMode`, `MapView`,
    `standardBoardView` and two tests) are untouched until subtask 7.
  - `seaZoneNear` stays in `ui`, because it sorts by `hexToPixel` pixels
    (principle 1).
  - `allHexes` moves too: `depthBand` depends on it, and it is pure.
- **The session is engine code** (principles 5, 7, 10, 15). The questions and
  answers are game rules a human and a bot both answer. They are pure, tested
  and free of browser APIs.
- **The session is three modules** (principle 12). `gameSession.ts` is the API,
  and `combatResolution.ts` is the machine. Splitting them keeps each under 500
  lines and gives each one job. `sessionAgents.ts` is the only bridge to
  `PlayerAgent`, so the session never imports agents. The follow-up intent's
  computer seats can reuse it.
- **The answers are a separate `AnswerAction` union in `gameSession.ts`** (A1).
  `Action`, `applyAction` and `legalActions` are untouched (B16), and
  `actions.ts` stays under 500 lines.
- **`host.ts` is in the engine, not a new `src/host/` layer** (spec assumption,
  principle 17). It imports only engine modules, plus data through them.
- **The harness keeps its invariants** and loses its own copy of the
  sequencing, so the sequence has one home on the headless side (principle 6).
- **A trade-off recorded in `docs/architecture.md` (principles 6, 17).**
  `engine/retreat.ts` and `resolveElephantDrift` stay as `BoardScene`'s driver
  (B16), so the retreat and drift glue has two drivers until the follow-up
  intent (§73). Subtask 4 adds this as a row under "Recorded exceptions".
- **The injectable default spreads.** `advancePhase` gains `rng = Math.random`,
  a second injectable default. Subtask 3 adds it to the existing row at
  `docs/architecture.md:96` (principle 9).

**Budget lines:** none. No file over 500 lines grows. `fuzzHarness.ts` and
`PlacementScene.ts` shrink, and their ceilings are lowered with
`npm run size:baseline -- --write` in the commits that shrink them. `drift.ts`
and `combat.ts` keep their line counts.

## Subtasks

Each subtask is one commit (or a short run of commits), with `npm run verify`
green after each.

1. **Snapshots first, before any code moves.**
   - **`src/engine/fixtures/72-harness-traces.json`.** For each pinned game, it
     records the scenario, the seed, the agents, the trace length, the trace's
     sha256 (as in `heuristicSoak.test.ts`), the full `HarnessStats`, and an
     `exchangeChoices` count. The pinned set:
     - `RandomAgent`, default army, seeds 1-30;
     - `buildPushScenarioGameState`, seeds 1-5;
     - `buildElephantScenarioGameState`, seeds 1-5;
     - `HeuristicAgent` `'ev'` against `'ev'`, default army, seeds 1-6;
     - `'ev'` (seat 0) against `RandomAgent` (seat 1), seeds 1-2.

     Exchange choices are counted by a test-local wrapper agent that forwards
     every call and draws no rng. If seeds 1-6 of `'ev'` against `'ev'` give no
     exchange choice, use the first seeds in 1-60 that do, and record them in
     Progress.
   - **`src/engine/fixtures/72-deployment-zones.json`.** For N, S, E and W:
     - `deploymentBand` and `navalDeploymentBand`;
     - `legalDeploymentHexes` with no enemies, with two enemies taken from the
       band (index 0 and the middle), with every band hex an enemy (the
       fallback), and with `minGap` 2;
     - `legalNavalDeploymentHexes` with no enemies, and with the bay's first hex
       as an enemy;
     - the length and sha256 of `allHexes`.
   - **`src/engine/fixtures/72-auto-deploy.json`.** The full unit lists from
     `autoPlaceSeat` (id, typeId, position, facing, equipmentPoints,
     movementLeft) for these cases:
     - two players W/E, default army, seeds 1-5;
     - four players N/E/S/W, default army, seats placed in order, seeds 1-3;
     - a ship-heavy army (2 triremes, 2 quinqueremes, 4 cavalry, 2 elephants),
       seeds 1-3.
   - **The tests.**
     - `src/engine/harnessPinned.test.ts` compares every pinned game with the
       fixture. It also asserts coverage: pushes, drifts, drift combats and
       exchange choices each greater than 0, and the AR, DR, DE, EX and AE
       counts each greater than 0. And it asserts that every exchange choice
       made in the pinned games is minimal: no unit can be removed while the
       threshold is still met. This is the I3 check. If it fails, stop and amend
       the plan.
     - `src/ui/deploymentSnapshot.test.ts` compares `ui/mapBounds` and
       `autoPlaceSeat` with the two deployment fixtures. It sits in `ui`
       because engine tests may not import `ui` (`eslint.config.js:98`).
   - **The writers.** They are gated
     `it.runIf(process.env.HERAKLIOS_WRITE_FIXTURES === '72')` and placed beside
     the comparisons. They are run once on this commit's code, which is still
     `main`'s code. The fixtures are imported statically.
2. **The deployment move.**
   - Create `src/engine/deployment.ts`:
     - move `Edge`, `allHexes`, `DEPTH`, `depthBand`, the caches,
       `EDGE_NAVAL_ZONE`, `navalDeploymentBand`, `excludeTooClose`,
       `legalDeploymentHexes` and `legalNavalDeploymentHexes` verbatim, with
       their doc comments;
     - add `deployUnit` (B10). Its id is `p${seat}u${n}`, where `n` is the
       number of units the seat already has in `state` (A4);
     - add `autoDeploy` (B11): the `autoPlaceSeat` algorithm, taking the
       selection and a required rng. It moves `unitsOf`,
       `keepsOffPlateauxAtDeployment` (with its "preference, not a rule"
       comment) and `unitsInPlacementOrder`. It picks a hex (one `rng()`), then a
       ship facing (one `rng()`), then calls `deployUnit`, and throws on an
       error or on running out of hexes, as today.
   - `ui/mapBounds.ts` re-exports the moved functions and keeps `seaZoneNear`,
     which now imports `allHexes` from the engine.
   - Add `src/engine/deployment.test.ts` (AC3).
   - `aiSetup.ts` and `PlacementScene` are not changed yet (subtask 7). Until
     then their own copies exist beside the engine's.
3. **B14, the rng pass-through.**
   - `advancePhase(state, rng = Math.random)` → `shuffleSeatOrder(state.seatOrder, rng)`.
   - In `actions.ts`'s `endPhase`: `advancePhase(state, rng)`, with no line added.
   - Add the AC5 tests to `turnManager.test.ts` and `actions.test.ts`.
   - Update the `docs/architecture.md:96` row to name `advancePhase` too.
4. **The session state machine, with its tests.**
   - **`gameSession.ts`:**
     - the types `GameSession`, `Question`, `AnswerAction` (A1),
       `SessionAction = Action | AnswerAction`, `SessionEvent` and
       `SessionStep`;
     - `newSession(state, context?)`, `sessionQuestion` and
       `sessionLegalActions`;
     - `sessionApply(session, action, rng, hooks?)`, where `hooks.onForced` is
       A2's hook. It mutates the session in place and returns
       `{result, events, pending}`. The three B3 checks come first: a turn
       action while a question is open, an answer with no question open, or an
       answer that is not listed. A turn action is otherwise not checked
       against the list; `applyAction`'s own throws apply (A3). Then it applies,
       then updates the context after `applyAction` returns.
       `typeof rng !== 'function'` throws.
   - **`combatResolution.ts`:** this machine follows `fuzzHarness.ts:1312-1341`,
     `:732-796` and `retreat.ts:24-55`. Its pending state is JSON. It holds:
     - the branch, the side, the attacker ids, the defender hexes and the
       required force;
     - the queue of `{unitId, originalHex, kind: 'retreat' | 'drift'}`;
     - `resolvedIds` as an array, and the push frame stack
       `{unitId, visited, pushedId, vacatedHex}`;
     - the current `ElephantDriftState`, plus whether the drift is waiting on a
       trample retreat;
     - the open `question`.

     The machine runs until a question with two or more answers. Each
     one-option step goes through `hooks.onForced` (A2) and is then applied. The
     I1 comment goes at the advance after a skipped item, and the I2/I3 comments
     go at their sites. The structurally impossible exchange-plus-retreats case
     throws, as `:1312-1316` does now.
   - Add `gameSession.test.ts` (AC1, B7 parity).
   - Add the dual-driver row to `docs/architecture.md`.
   - The harness is not changed yet.
5. **The harness onto the session through the adapter, keeping the traces
   identical.**
   - **`sessionAgents.ts`:**
     - `askAgent(agent, session)`: maps the open question to the same agent
       method and arguments as today (`Unit` objects found by id, options in
       question order), then maps the reply to an answer. For a sacrifice, it
       takes the first listed answer whose ids the agent's choice contains (I3).
     - `forcedHooks(agent, session)`: A2's `onForced`. It calls the matching
       agent method on a one-option step and keeps the promise.
     - `settleWithAgent(session, action, agent, rng)`: `sessionApply`, then ask
       and apply until `pending` is null. It awaits the kept promises at the
       end, so an agent's error surfaces.
   - **`playRandomGame`** holds a `GameSession`:
     - `sessionLegalActions(session)` replaces `legalActions(state, context)`;
     - `applyOneAction` keeps its invariant checks and stats around
       `settleWithAgent`. Combined attacks still pass, because turn actions are
       not checked against the list (A3);
     - pushes and drifts are counted from the `SessionEvent`s.
   - **`processRetreats` and `processDrifts`** keep their signatures. Each
     builds a queue resolution, settles it with the agent, and copies the
     session's `resolvedIds` back into the caller's `Set`.
     - **`processAdvanceOffer`, `emptyContext` and the inline branch** are
       deleted.
   - All the pinned tests, `fuzzHarness.test.ts` and `heuristicSoak.test.ts`
     pass unchanged.
   - Run `npm run size:baseline -- --write`, and lower the lint cap if a warning
     went.
6. **The host entry.**
   - **`host.ts`:**
     - `newGame(config, seed)`: `createInitialState`, the optional `seatOrder`,
       then each seat in index order, by `autoDeploy` or by the config's
       placements checked with `deployUnit` (a `DeployError` throws as data);
     - `load(savedJson, seed)`: `parseSavedGame`, with the context taken from
       the save;
     - each host offers `legalActions()`, `apply(action)`, `question()`,
       `state()` and `save()`. `apply` is `sessionApply` with no hooks, and a
       combined attack is accepted (A3). `save()` uses `buildSavedGame` and
       refuses while a question is open.

     Every output is a JSON copy. The rng is `createSeededRng(seed)`, and a seed
     that is not a finite integer throws.
   - Add `host.test.ts` (AC4).
7. **The ui and Placement re-wiring.**
   - `aiSetup.ts`: `autoPlaceSeat` becomes
     `autoDeploy(state, playerIndex, session.armySelections[playerIndex] ?? {}, rng)`,
     and its copies are deleted.
   - `PlacementScene`:
     - `tryPlace` and `confirmPendingShip` take the snapshot, call
       `deployUnit`, and push the history entry only on success. The scene's
       pre-checks keep a failure from ever being reached.
     - `unitCounter` and its snapshot field go (A4).
     - `queue` and `currentLegalHexes` stay, for the dev hook.
   - Lower `PlacementScene`'s ceiling with `--write`.
   - Run `npm run e2e`.
8. **README and docs.**
   - `README.md` "Project structure", engine bullet: the session, deployment and
     the host entry, in its existing style. No rule changes, so "Known
     simplifications" is untouched.
   - `CLAUDE.md` Architecture:
     - the engine module list gains `deployment.ts`, `gameSession.ts`,
       `combatResolution.ts`, `sessionAgents.ts` and `host.ts`;
     - `mapBounds.ts` becomes "re-exports the engine's deployment zones, plus
       `seaZoneNear`";
     - the harness description says that it settles combats through the
       session.
   - Check that the `docs/architecture.md` rows from subtasks 3 and 4 still read
     right.

## Tests

**AC1 (B1-B8): `src/engine/gameSession.test.ts`.**

The positions are built on known plain hexes, as in `fuzzHarness.test.ts`
(`buildRetreatChain`, `:183-208`). The die face comes from
`describeLandAttack` (`dieForResult`), and the rng is scripted.

**Question sequences (B4, B5, A2)**

Each case asserts the exact list of questions (kind, player, data) when every
answer is the first listed one:
- AR, two attackers;
- DR, with two or more retreat hexes;
- DR with a single retreat hex: no question, the unit moves, `onForced` fires
  once (A2);
- DE: an advance question for each defender hex;
- EX with one attacker: no question, the attacker is destroyed;
- EX with several attackers: a sacrifice question, then advance questions;
- a push: a `pushTarget` question, then the pushed unit's retreat;
- a blocked retreat: the unit is eliminated, with no question;
- a drift that tramples a unit and forces a retreat: the retreat question's
  player is the occupant's owner.

Mutants killed:
- swapping the retreat and drift order;
- dropping the advance after a skipped defender item (the I1 case);
- asking on one option;
- not calling `onForced`;
- giving the advance to the defender.

**Answer lists (B2, B6, A1)**
- With no question open, the list equals `legalActions(state, {...})` in order,
  after attacks and a ram. This kills losing a context entry.
- With a question open, the list is exactly the B6 answers, all of
  `AnswerAction` kinds (A1).
- Sacrifice set: forces [4, 4, 2] against threshold 5 give exactly {4a, 4b} and
  {4a, 2}, {4b, 2} in bitmask order. The non-minimal {4a, 4b, 2} is not listed.
  This kills dropping the minimality filter and a changed order.
- The advance list ends with `{unitId: null}`.

**Checks and context (B3, A3)**
- A turn action while a question is open throws, and the state and session are
  deep-equal to a `structuredClone` taken before. The same holds for an answer
  with no question open, and for an answer that is not listed. This kills
  checking after mutating.
- A two-attacker attack (not in `legalActions`) with no question open is
  applied (A3). This kills a list check on turn actions.
- Context tracking:
  - land attackers and a boarding attacker go into `attackedThisPhase`;
  - a ram goes into `rammedThisTurn`;
  - `endPhase` clears `attackedThisPhase`;
  - `endPhase` clears `rammedThisTurn` only when it enters a movement phase in a
    game that is not over.

  This kills clearing `rammedThisTurn` on every `endPhase`.
- A missing rng throws.

**JSON round-trip (B1)**

Mid-question, `JSON.parse(JSON.stringify(session))` is `toEqual` the original.
Both then play on with rngs at the same position (a counting wrapper on
`createSeededRng`) to equal final states. This kills a `Unit` reference stored
in `pending` and `resolvedIds` held as a `Set`.

**Settling (B8)**

After the last answer, `pending` is null. The context is what it was right
after the attack.

**Drift parity (B7)**

For about 20 seeds of `buildElephantScenarioGameState`, with the elephants'
attack forced:
- one copy is settled by the session with `sessionAgents` and a `RandomAgent`
  on rng A;
- the other copy is settled by `capturePendingResolutionItems` plus
  `resolveElephantDrift` and `engine/retreat.ts` (still the `BoardScene` path),
  with the same agent on rng A′.

The final states must be equal, with equal draw counts. This kills a die rolled
out of order, an extra `driftStep` call, and resuming the drift before the
trample retreat.

**AC2 (B15): `src/engine/harnessPinned.test.ts`.** For every pinned game, the
trace length and sha256 and the full stats equal the fixture, with the coverage
and I3 assertions described in subtask 1.
- Kills a changed agent-call order, a missing one-option agent call (A2), an
  answer added to the trace, a lost push or drift count, and the sacrifice
  mapping picking a different subset.
- `fuzzHarness.test.ts` and `heuristicSoak.test.ts` (with its seed-7 sha256
  pins) run unchanged.

**AC3 (B9-B12, A4): `src/engine/deployment.test.ts`.**
- The zones equal the `72-deployment-zones.json` fixture for every edge and
  case. This kills any edit to `depthBand`, `DEPTH`, the gap or the fallback.
- `deployUnit` errors:
  - a band hex for the wrong edge gives `illegalHex`;
  - a ship on a land band hex, and a land unit on a bay hex, give `illegalHex`;
  - a hex inside 4 hexes of an enemy, when another hex is clear, gives
    `illegalHex`;
  - cavalry on a band hex it cannot enter gives `terrain` (the test asserts such
    a hex exists);
  - an occupied hex gives `occupied`;
  - a ship with no facing, with 6, with -1 or with 1.5 gives `facing`;
  - nothing is pushed into `state.units` on any error.
- A successful `deployUnit` sets the id `p{i}u{n}`, where `n` is the seat's unit
  count (A4): a seat with three units gets `u3`, even when another seat has
  more. It also sets `movementLeft` equal to the movement allowance,
  `equipmentPoints` only for ships, facing 0 for land units, and the ship's
  facing as given.
- `autoDeploy` equals the `72-auto-deploy.json` fixture. It throws when it runs
  out of room.
- `src/ui/deploymentSnapshot.test.ts` stays. It proves the `ui` re-exports and
  `autoPlaceSeat` equal the same fixtures.
- `ui/mapBounds.test.ts` and `aiSetup.test.ts` run unchanged.

**AC4 (B13, B14): `src/engine/host.test.ts`.**
- **A new game, end to end.** `newGame` uses small armies (an elephant and a
  ship each), `roundLimit: 3`, seed S. A chooser on its own seeded stream picks
  from `legalActions()` until the game is over. Every input and output is
  passed through `JSON.parse(JSON.stringify(...))`. The final state equals a
  direct run: `createInitialState`, `autoDeploy` with `createSeededRng(S)`, then
  `newSession` with the same action list. A second run with S is identical.
- **A loaded game, end to end.** `load()` reads a save of `buildFuzzGameState()`
  with `roundLimit` set, so combat comes at once. The test asserts at least one
  question was answered through `apply`, and the same direct-session equality.
- **No `Math.random`.** `vi.spyOn(Math, 'random')` throws if called during
  either run. This kills a missing rng pass-through anywhere on the host's path,
  B14 included.
- **`save()`.** It throws while a question is open. Otherwise its output passes
  `parseSavedGame`, has `version === SAVE_VERSION`, and loads back to an equal
  state and context.
- **Placements in the config.** A placement on an illegal hex throws with
  `illegalHex` data.

**AC5 (B14): `turnManager.test.ts` and `actions.test.ts`.**
- With `randomizedTurnOrder: true`, two runs of
  `applyAction(endPhase, createSeededRng(9))` across round wraps give identical
  seat orders. This kills the rng not being passed on.
- With no rng and `Math.random` spied, the spy is called on a wrap. This kills
  removing the default.

**AC6 (B12, B16).** `npm run verify` and `npm run e2e` (`e2e/placement.spec.ts`
and the rest), with no expectation edited.

**AC7 (B12).** The live check below.

## Validation

- `npm run verify` green at every subtask.
- `npm run check:intent` PASS. The tier is Attested by path. `saveGame.ts`,
  `history.ts` and `saveStorage.ts` are not edited, and `host.ts` only imports
  them.
- `npm run e2e`, from subtask 7 on, because `src/scenes/PlacementScene.ts` and
  `src/ui/**` change. Stop any dev server on 5232 first.
- **Live check (AC7, owed by rule 1)**, run by the owner:
  1. In `C:/Users/eric/src/heraklios-wt/72-engine-host-seams`, run
     `npm run dev -- --port 5272 --strictPort --host 127.0.0.1`, then open
     `http://127.0.0.1:5272/`.
  2. For the comparison, run `main` side by side from `C:/Users/eric/src/heraklios`
     with `npm run dev -- --port 5273 --strictPort --host 127.0.0.1`.
  3. On the Menu, choose 2 players, seat 0 Human and seat 1 a computer tier.
     Seat 0 takes "Use default army", then "Confirm army".
  4. In Placement (Standard view), note the edge in the title. The green band is
     the 3-hex-deep strip along that edge, and it matches `main`'s for the same
     edge. Toggle the Drawn view: the same hexes are highlighted.
  5. Place several land units. Clicks outside the band, or on terrain the unit
     cannot enter (cavalry on marsh or steep flank), do nothing.
  6. Undo and redo a placement.
  7. When the queue reaches ships, the highlight jumps to the bay. Stage a ship,
     turn it with each Turn button, and confirm the facing. Cancel a second
     staged ship.
  8. Click "Done placing". The computer seat deploys without a screen, and the
     Board opens with both armies.
  9. Play into the first combat: move toward the enemy over turns, end phases,
     and attack. The combat resolves, and any retreat or advance prompt works as
     on `main`.

## Assumptions I made

- **The four open design points were settled by the owner as A1 to A4** (spec
  amendment, `fd90410`).
- **Two modules beyond the spec's three:** `combatResolution.ts` and
  `sessionAgents.ts`, for size and single purpose. The spec named
  `gameSession.ts` "the session and the question/answer machine".
- **The pinned set and fixture format.** 30 `RandomAgent` seeds, 5 push, 5
  elephant, 6 `'ev'`-against-`'ev'` and 2 mixed. Each is stored as a sha256 plus
  stats, not the full trace, to keep the fixtures small.
- **`processRetreats` and `processDrifts` are kept as wrappers**, so their
  existing tests stay unchanged and now cover the session machine. The exported
  `resolveUnitRetreat` in `fuzzHarness.ts` stays as it is, as a wrapper over
  `engine/retreat.ts`.
- **The host config:**
  - `{players: [{name, edge, army, placements?}], seatOrder?, options?, seatControls?}`.
    `purchasePoints` is 400, as in `buildPlayers`.
  - Armies are not re-checked with `validateArmy`, as `autoPlaceSeat` does not
    check them.
  - Explicit placements are taken as given. Each one is checked by `deployUnit`,
    and they need not cover the whole selection, since Placement also lets a
    player finish early.
- **`save()` stamps `savedAt` with `new Date().toISOString()`.** That is not game
  behaviour, and the tests compare states, not timestamps. `seatControls`
  defaults to all `'human'`.
- **`sessionApply` mutates the session in place,** following the engine's
  in-place convention. The host's outputs are JSON copies.
- **Fixture files** live in `src/engine/fixtures/`. Only tests import them, and
  they are not budgeted, since the budget covers `.ts`, `.mjs` and `.js` only.
- **No `blocked_by`** is needed. Nothing else must merge first.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-21 - subtasks 1-8, all shipped (implementer)

Commits (on `feat/72-engine-host-seams`):
- `eef4065` subtask 1: snapshots from `main`'s unchanged code
- `2d0a3d3` subtask 2: deployment moved to `engine/deployment.ts`
- `508f631` subtask 3: B14, `advancePhase(state, rng)`
- `8e78bc1` subtask 4: `GameSession`, `combatResolution.ts`, `sessionAgents.ts`
- `d2da2db` subtask 5: the harness onto the session
- `9dc50e0` subtask 6: `engine/host.ts`
- `c006735` subtask 7: `aiSetup` and `PlacementScene` rewired
- the final commit: subtask 8 (README, CLAUDE.md), this entry and `status: in-review`

What shipped, as planned: the zones, `deployUnit` and `autoDeploy` in the engine
(`ui/mapBounds.ts` re-exports them and keeps `seaZoneNear`; `autoPlaceSeat` is
one line); `advancePhase`/`endPhase` take the caller's rng; a JSON
`GameSession` with `sessionLegalActions`/`sessionApply` (answers are a separate
`AnswerAction` union, A1; `onForced` hook, A2; no list check on turn actions,
A3); the fuzz harness settling combats through it; `host.ts`; the
`docs/architecture.md` rows (rng default for `advancePhase`; the two retreat and
drift drivers).

Tests: 91 files and 1599 tests at subtask 1 (the snapshot tests included), 94
files and 1659 tests (2 skipped: the two gated fixture writers) at the end. `npm run verify`
green at every commit. Lint warnings 21 -> 19 and the cap lowered to 19 in
`package.json` in the harness commit (`applyOneAction`'s two warnings went;
`settleItems` was written with an options object so it adds none).

B15, the pinned traces: all 66 pinned games (6807 actions) give the same
length, sha256 and full `HarnessStats` as the fixture written from `main`
before any §72 code, on the first run of the rewritten harness, with no
re-pinning. `fuzzHarness.test.ts` (including the direct `processRetreats` and
`processDrifts` tests) and `heuristicSoak.test.ts` (seed-7 sha256 pins) run
unchanged. Coverage asserted in `harnessPinned.test.ts`: 9 pushes, 34 drifts, 24
drift combats, 5 exchange choices, 32 multi-attacker attacks, and AR 76, DR 144,
DE 28, EX 25, AE 9.

I3 check (gate): passed. Every one of the 5 exchange choices made in the pinned
games is minimal (`harnessPinned.test.ts`, "makes only minimal exchange
sacrifices"), so the answer set stayed "minimal subsets only".

Deployment snapshots (`72-deployment-zones.json`, `72-auto-deploy.json`): the
engine functions and the `ui` wrappers (`deployment.test.ts`,
`deploymentSnapshot.test.ts`) both equal them; `mapBounds.test.ts` and
`aiSetup.test.ts` are unchanged.

Mutants killed by copy-and-restore runs of `gameSession.test.ts`: swapping the
retreat/drift order, dropping the advance after a skipped item, asking on one
option, dropping `onForced`, giving the advance to the defender, an extra die
draw, resuming the drift before the trample retreat, dropping the minimality
filter, clearing `rammedThisTurn` on every `endPhase`, not threading `visited`.
One survived by being equivalent (`vacatedHex` aliasing a position that is only
ever reassigned). Removing the rng pass-through in `actions.ts` is killed by
`actions.test.ts` and by `host.test.ts`.

Line counts: new `deployment.ts` 409, `gameSession.ts` 185,
`combatResolution.ts` 416, `sessionAgents.ts` 118, `host.ts` 223 (all under
500). Shrunk: `fuzzHarness.ts` 1350 -> 1276 and `PlacementScene.ts` 574 -> 548
(both ceilings lowered with `size:baseline --write`); `ui/aiSetup.ts` 213 -> 70;
`ui/mapBounds.ts` 207 -> 39. `actions.ts` stays 488, `drift.ts` 667 and
`combat.ts` 1111 (only `export` on `needsInput`). No budget line was needed.

`npm run e2e`: 27 passed. The first run had one failure, `save-load.spec.ts`
"a saved game loads back to the saved position" (the loaded state still showed
the second move); it passed alone and in a second full run. It uses the Menu
test-mode shortcut, so it does not touch Placement or any code this intent
changed; I read it as a timing flake under load, not a regression.

Divergences from the plan:
- The pinned set is a superset: besides the planned 30 + 5 + 5 + 6 + 2 games it
  has 18 more ("found" games: push scenario seeds 17, 19, 22, 29, 50; default
  seed 76; `'ev'` against `'ev'` seeds 8, 9, 10, 12, 14, 15, 17, 20, 22, 24, 25,
  26), found by scanning, because the planned seeds gave one exchange choice and
  one push in total, which is too thin for the I3 check and the push path.
- `deploymentSnapshotCases.ts` (a small test-data module in `src/engine/`) holds
  the snapshot cases so the engine and `ui` comparisons share one list.
- `sessionApply` returns `pending` as the whole JSON `Pending` (the open
  question is `pending.question`, and `sessionQuestion` reads it), and a
  `sessionBeginResolution` entry exists for the harness's `processRetreats` and
  `processDrifts` wrappers.
- `needsInput` is the only line changed in `drift.ts`, as planned. The parity
  test in `gameSession.test.ts` keeps a test-local copy of the old driver
  sequencing, built on `resolveElephantDrift` and `engine/retreat.ts`, so it
  stays a real comparison now that the harness's own wrappers use the session.
- The live check (AC7) is still owed to the owner.

### 2026-11-21 - rework, round 1 (implementer)

Review `b36f69e` asked for tests for four surviving mutants and two LOW items.
No source file under `src/` changed except the hashing move below. Each mutant
was proved killed by backing the file up by copy, applying it, running the
test file, restoring by copy, and checking `git status --short` showed only
test files.

New tests, each with the mutant it kills:
- `gameSession.test.ts` "offers no advance into a defender hex that is occupied
  again" (CR21). The sequence: defenders a and b are both queued, a is boxed in
  and pushes b, so a takes b's original hex before b's own advance offer; an
  attacker stands next to that hex. The test asserts the only advance question
  is for a's hex. Kills removing `if (unitAt(game, step.hex)) return null;`
  in `combatResolution.ts`. (Pushing a defender into a sibling defender's hex is
  real, so no other sequence was needed; the items are queued with
  `stepsForItems` as `pendingFromAttack` would build them.)
- `sessionAgents.test.ts` "maps the second listed subset to that subset" and
  "maps a non-minimal superset to the first listed subset it contains" (SA2).
  Forces 4, 4, 2 against 5 list {a,b}, {a,c}, {b,c}; a stub agent returns {a,c},
  then all three; the destroyed units are {a,c} and {a,b}. Kills `.every` ->
  `.some` in `sacrificeAnswer`.
- `sessionAgents.test.ts` "makes settleWithAgent reject" (SA4). The agent's
  `chooseRetreat` rejects on a one-option (forced) retreat. Kills removing
  `await Promise.all(kept)`.
- `host.test.ts` "brings back the attacked and rammed lists, so nobody acts
  twice" (H4). A ram, `endPhase`, then a land attack are played through the
  host, saved and loaded: both lists come back equal, and `legalActions()`
  offers neither the attacker nor a `board` for the ship that rammed. Kills
  `load` restoring `attackedThisPhase: []` and, separately,
  `rammedThisTurn: []`.
- `gameSession.test.ts` `rejects` now matches `/question is open/`,
  `/no question is open/` and `/not one of/` (kills changing those messages);
  `deployment.test.ts` already matched `/rng/` and now kills changing its
  message.

LOW: `deploymentSnapshotCases.ts` no longer imports `node:crypto`; `zoneSnapshot`
takes the hash function, and the two tests that call it pass a `node:crypto`
one. The fixtures are unchanged.
