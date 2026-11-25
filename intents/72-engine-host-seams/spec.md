<!-- generated-by: heraklios/spec@0.1.0 -->
# §72 spec — The engine can run a whole game for a host other than the Phaser scenes

Accepted intent: [intent.md](intent.md) (with the owner's amendment of
2026-11-21)

Written against `main` at `0e76d5b`.

**The owner's decisions (2026-11-21, spec question round)**
- **Open question:** "Session object, not saved". A JSON engine session
  beside `GameState` holds the open question, the rest of the queue and the
  attacked/rammed sets. Saving and undo stay refused while a question is open.
  The save format and `SAVE_VERSION` do not change.
- **Answers:** "New Action kinds". While a question is open, `legalActions`
  lists exactly its legal answers, and applying an action takes one.
- **Scope:** "Split it out". `BoardScene` and the computer seats move onto the
  protocol in a follow-up intent, `blocked_by` §72. §72 moves the fuzz harness
  onto it, and `BoardScene` plays exactly as today.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/70-unity-front-end-probe/result.md` → "Findings" 1-4, 6 | The seams a host needs: an entry point, deployment in the engine, pending resolution as JSON questions/answers, `ActionContext` carried for the host, a required rng. |
| `src/engine/agent.ts:50-78` | `PlayerAgent`'s four questions: `chooseRetreat(state, unit, options)`, `choosePushTarget(state, unit, candidates)`, `chooseAdvance(state, candidates, vacated)` (`null` declines), `chooseExchangeSacrifice(state, attackers, requiredForce)`. Ram and boarding "ARE `Action`s" (:39-43). The drift direction "is an unavoidable die roll … not a choice" (:45-48). |
| `src/engine/combat.ts:935-1019` | `applyLandCombatResult` → `LandCombatOutcome {requiresExchangeChoice, requiredSacrificeForce, pendingDrifts, pendingRetreats}`. Retreats are taken "one at a time" (:954). `eligibleAdvanceCandidates` (:116-120), `applyExchangeSacrifice` (:1057), `exchangeSacrificeMeetsThreshold` (:1053). |
| `src/engine/retreat.ts:24-55` | `resolveUnitRetreat(state, unit, agent, hooks, visited, resolvedIds)`: the whole retreat and push cascade, async against a `PlayerAgent`. |
| `src/engine/drift.ts:62-91`, `:232`, `:554-667` | Drift is already a JSON state machine: `ElephantDriftState {frames, awaiting}`, `driftStep(game, drift, input?)`. Its inputs are `directionRoll`, `combatRoll` and `retreatResolved`. The driver `resolveElephantDrift` rolls the dice and answers trampled retreats through the agent (:655-664). |
| `src/engine/fuzzHarness.ts:637-796`, `:1282-1343` | Today's headless sequencer: `applyOneAction`'s `landAttack` case, `processRetreats`, `processDrifts`, `processAdvanceOffer`, with one shared seeded rng for the agents and the dice (:907-908). |
| `src/scenes/BoardScene.ts:2543-2614`, `:2127-2178` | The same sequence in the scene. It stays as it is in §72; it is the reference for the order. |
| `src/engine/actions.ts:289`, `:413-416`, `:425-436`, `:485-487` | `applyAction(state, action, rng = Math.random)`; `ActionContext {attackedThisPhase?, rammedThisTurn?}`; `legalActions` offers one attacker against one defender. |
| `src/engine/turnManager.ts:4-33`, `:46`, `:117` | `createInitialState(...)` returns `units: []`. `shuffleSeatOrder(seatOrder, rng = Math.random)` is called by `advancePhase` without an rng. |
| `src/ui/mapBounds.ts:20`, `:68-185` | The deployment rules: a band 3 hexes deep per edge, the named naval bay per edge, a 4-hex gap from enemy units (dropped if it leaves nothing). |
| `src/ui/aiSetup.ts:139-213` | The computer's placer: most-constrained units first, a plateau preference, exactly one `rng()` per unit, a random facing for ships, ids `p${i}u${n}`. |
| `src/scenes/PlacementScene.ts:391-541` | The human placer: legal hexes, terrain via `canEnterTerrain`, no stacking, ships staged then confirmed with a facing, the same id scheme. |
| `src/engine/saveGame.ts:124-144` | `SavedGame` already carries `attackedThisPhase` and `rammedThisTurn`. A pending retreat or drift "cannot be serialized, so saving is refused while one is in progress". |

## Behaviour

**The session**

- **B1.** A `GameSession` is plain JSON:
  - `state` is the `GameState`;
  - `context` is `{attackedThisPhase, rammedThisTurn}` as id arrays;
  - `pending` is the open resolution, or `null`.
  
  `JSON.parse(JSON.stringify(session))` gives an equal, usable session at any
  moment, including mid-question.
- **B2.** `sessionLegalActions(session)`:
  - with no question open, it returns `legalActions(state, context)` exactly
    as today, in the same order;
  - with a question open, it returns exactly that question's legal answers
    (B6) and nothing else.
- **B3.** `sessionApply(session, action, rng)` applies one action or one answer
  and returns a result plus the new `pending`.
  - A turn action goes through `applyAction`, with the `context` updated as the
    harness updates it today: attackers into `attackedThisPhase`, a ram into
    `rammedThisTurn`, and both cleared where the harness clears them.
  - A turn action while a question is open, an answer with no question open, or
    an answer that is not in B2's list throws, with no state change.
  - `rng` is required, with no `Math.random` default.
- **B4.** A land attack whose outcome needs choices leaves `pending` set. It
  keeps today's order (`fuzzHarness.ts:1282-1343`, `processRetreats`,
  `processDrifts`, `processAdvanceOffer`):
  1. the exchange sacrifice;
  2. or the retreats one at a time, then the drifts, with an advance offer after
     each defender's item;
  3. or the advance offers after a DE or EX.
  
  Each step that needs a player's choice is a question (B5). A step with
  nothing to choose (one legal hex, an elimination, a die roll) is applied
  without asking, exactly when today's code applies it.
- **B5.** A question names:
  - the player who answers it (the unit's owner; for an advance or a sacrifice,
    the attackers' owner, as `SeatAgentRouter` routes today);
  - its kind: `retreat {unitId, options: hex[]}`, `pushTarget {unitId,
    candidateIds}`, `advance {vacatedHex, candidateIds}` or
    `exchangeSacrifice {attackerIds, requiredForce}`;
  - its data, as ids and hexes only.
  
  A retreat that a trample forces inside a drift is asked as the same
  `retreat` or `pushTarget` question.
- **B6.** The answers are new `Action` kinds, each listed by B2 while its
  question is open:
  - `answerRetreat {hex}`: one per option;
  - `answerPushTarget {unitId}`: one per candidate;
  - `answerAdvance {unitId | null}`: one per candidate, plus `null` to decline;
  - `answerSacrifice {unitIds}`: every subset of the attackers that meets
    `exchangeSacrificeMeetsThreshold` and from which no unit can be removed
    while still meeting it, in a fixed order.
- **B7.** An elephant's drift runs inside the session. `driftStep` is driven,
  and its direction and combat dice are rolled from the `rng` passed to
  `sessionApply`, in the order `resolveElephantDrift` rolls them today. The
  session pauses only for a question (B5); there is no "continue" pause, which
  stays a presentation matter.
- **B8.** When the last step is done, `pending` is `null` and the combat is
  settled exactly as today's harness settles it: the same state, the same
  `context`.

**Deploying**

- **B9.** The deployment rules move from `src/ui/mapBounds.ts` to the engine,
  unchanged:
  - `deploymentBand(edge)`;
  - `navalDeploymentBand(edge)`;
  - the 4-hex gap with its fallback;
  - `legalDeploymentHexes`;
  - `legalNavalDeploymentHexes`.
  
  `ui/mapBounds.ts` re-exports or calls them, so the Placement screen shows the
  same legal hexes. `seaZoneNear`, which uses `ui/hexRender.ts`'s pixel maths,
  stays in `ui` (test mode only).
- **B10.** `deployUnit(state, playerIndex, {typeId, hex, facing?})` places one
  unit and returns either the new unit or a data error. The errors cover:
  - a hex that is not legal for that player's edge and domain;
  - terrain the unit cannot enter (`canEnterTerrain`);
  - an occupied hex;
  - a ship without a facing in 0-5.
  
  New units get Placement's fields and id scheme (`p${i}u${n}`,
  `movementLeft`, the ship's `equipmentPoints`).
- **B11.** `autoDeploy(state, playerIndex, selection, rng)` is
  `ui/aiSetup.ts`'s `autoPlaceSeat` algorithm moved to the engine. For the
  same state, selection and rng it places the same units on the same hexes
  with the same facings and ids. It throws, as today, when it runs out of
  hexes.
- **B12.** `ui/aiSetup.ts` and `PlacementScene` use B9-B11 in place of their
  own copies. What a player sees and does in Placement is unchanged, and so is
  what a computer seat deploys for a given rng.

**The host entry**

- **B13.** One module, `src/engine/host.ts`, is the supported entry. Its
  inputs and outputs are JSON-serialisable values only, and it takes its
  configuration as JSON. It offers:
  - `newGame(config, seed)`: players, edges, army selections, options and
    seat order. It builds the state with `createInitialState`, then
    deployment. Each seat is deployed by `autoDeploy`, or by explicit
    placements given in `config` and checked with `deployUnit`.
  - `legalActions()`, `apply(action)`, `question()` and `state()`.
  - `save()`: a `SavedGame` in today's format. It refuses while a question is
    open.
  - `load(savedJson, seed)`.
  
  Its rng is the seeded LCG (`engine/rng.ts`). It is required, and nothing in
  the host's path calls `Math.random`.
- **B14.** The turn-order shuffle is seeded too. `applyAction`'s `endPhase`
  passes its `rng` on to `advancePhase` and `shuffleSeatOrder`. A caller that
  passes no rng keeps `Math.random`, so the web game is unchanged.

**The harness**

- **B15.** The fuzz harness (`playRandomGame`, `applyOneAction`) drives
  combats through the session (B2-B8). Its `PlayerAgent`s answer the
  questions through a small adapter, which calls the same agent methods in the
  same order as today. For every seed in the pinned set, `playRandomGame`
  gives the same trace and stats as before §72.

**Unchanged**

- **B16.** The web game plays exactly as today. `BoardScene`, the computer
  seats in it, saves, undo, autosave and the drift's continue pauses are not
  changed by §72. `applyAction` and `legalActions` keep their signatures and
  behaviour for every existing caller. B14 only adds an optional pass-through.

## Interpretations

No rulebook passage is involved: this re-expresses the current sequencing.
Each of these becomes a comment at its site:

- **I1. "Pending resolution" is the order today's harness uses**
  (`fuzzHarness.ts:1282-1343`), not a new one. Where `BoardScene` and the
  harness differ (the harness offers an advance after a skipped defender item,
  `:732-796`), the harness wins, because B15 pins its traces. The follow-up
  intent reconciles `BoardScene`.
- **I2. A step with no choice is not a question** (B4), so a host sees exactly
  the decisions a human sees today. A one-option retreat is applied, because
  today's agents are asked even then. The adapter keeps that call, so the rng
  is consumed as before (B15). The session itself does not ask.
- **I3. The minimal sacrifice subsets** (B6) are the answer set, because every
  legal answer must be listable. A non-minimal sacrifice is never a better
  play, since it loses units for nothing. Today's `chooseExchangeSacrifice`
  can return a non-minimal set, so the adapter maps an agent's choice onto the
  listed answer it contains. If that changes a seeded trace, B15 fails. The plan
  must check this before relying on it, and if it fails, the answer set
  becomes "every subset meeting the threshold".

## Acceptance criteria

- **AC1 (B1-B8).** Tests in `src/engine/gameSession.test.ts`:
  - a land attack with each outcome (AR, DR, DE, EX with one and several
    attackers, a push, a blocked retreat, a drift with a trample that forces a
    retreat) yields the B4 sequence of questions;
  - `sessionLegalActions` lists exactly the B6 answers;
  - a wrong action throws without changing the state;
  - the session round-trips through JSON mid-question and plays on to the same
    result.
- **AC2 (B15).** `playRandomGame` gives byte-identical traces and stats to a
  snapshot taken on `main` before any §72 code, for a pinned set of at least
  30 seeds that includes elephant, push and exchange scenarios
  (`buildPushScenarioGameState`, `buildElephantScenarioGameState`). The
  existing fuzz and soak tests stay green and unchanged.
- **AC3 (B9-B12).** Tests in `src/engine/deployment.test.ts`:
  - the moved zone functions return what `ui/mapBounds.ts` returned (a
    snapshot for every edge, taken before the move);
  - each `deployUnit` error case;
  - `autoDeploy` equals today's `autoPlaceSeat` for a set of seeds and armies
    (snapshot taken before the move).
- **AC4 (B13, B14).** A test in `src/engine/host.test.ts` plays a seeded game
  from `newGame` to `gameOver` through `host.ts` only, with JSON-encoded
  inputs and outputs at every call. It ends in the same `GameState` as the
  same game driven through the session API directly. A second run with the
  same seed is identical. A test checks that `Math.random` is never called
  during it.
- **AC5 (B14).** With `randomizedTurnOrder: true`, two seeded runs give the same
  seat orders. A call without an rng still uses `Math.random`.
- **AC6 (B12, B16).** `npm run verify` and `npm run e2e` stay green with their
  expectations unchanged.
- **AC7 (B12).** Live check (owner): Placement in the Standard and Drawn views
  shows the same legal hexes as on `main`. A human and a computer seat
  deploy; the game plays into its first combat.

## Non-functional

- **Engine/presentation split:**
  - New engine modules:
    - `gameSession.ts`: the session and the question/answer machine;
    - `deployment.ts`: the zones, `deployUnit` and `autoDeploy`;
    - `host.ts`: the JSON entry.
  - The `ui` layer keeps only re-exports and wiring, plus `seaZoneNear`. No
    browser API in the new modules (principle 1).
- **Save format:** unchanged. `SAVE_VERSION` stays 3, and the host saves in
  today's format.
- **Undo boundaries:** unchanged. `BoardScene` is untouched.
- **AI / harness:**
  - `legalActions` and `applyAction` are unchanged for existing callers, and
    B14 adds an optional rng pass-through only.
  - The harness moves onto the session, and its traces are pinned (AC2).
  - The agents' decision code is unchanged; only an adapter is added.
- **Size:**
  - `fuzzHarness.ts` (at its 1350 ceiling) should shrink, and its baseline is
    lowered to match.
  - New modules stay under 500 lines.
  - `PlacementScene.ts` (at its ceiling) must not grow.

## Out of scope

- Moving `BoardScene` and the computer seats in it onto the protocol (the
  follow-up intent, `blocked_by` §72).
- Saving or undoing mid-question, and any `SAVE_VERSION` change.
- Combined attacks in `legalActions` (§70 finding 5).
- Unity, a bundle step, a CI parity gate (§70 steps 2-3).
- Moving `ui/testMode.ts`'s fixtures to the engine.

## Assumptions I made

- **Module names and places:** `src/engine/gameSession.ts`, `deployment.ts`
  and `host.ts`. They are in the engine, not a new top-level `src/host/`, so
  no new layer is needed (principle 17).
- **The host's `load` takes a seed.** A `SavedGame` holds no rng position, and
  the save format does not change.
- **The harness is the reference for the order** (I1), because its traces can
  be pinned and `BoardScene`'s can't.
- **The pinned trace set** is at least 30 seeds plus the push and elephant
  scenarios. The exact list is the plan's.
- **The follow-up intent** ("BoardScene and the computer seats use the session
  protocol", `blocked_by` §72) is drafted after this spec is accepted. It is
  not part of §72.

## Amendment: the owner's answers to the plan's questions (2026-11-21)

`/build-plan` found four points the spec left open. These are the owner's
answers. Each one clarifies the B it names.

- **A1 (B3, B6, B16), "Separate union".** The answer kinds are a separate
  `AnswerAction` union in the session module, with `SessionAction = Action |
  AnswerAction`. Only `sessionApply` takes answers, and only
  `sessionLegalActions` lists them. `Action`, `applyAction` and `legalActions`
  are untouched.
- **A2 (B4, I2), "onForced hook".**
  - `sessionApply(session, action, rng, hooks?)` takes an optional hooks
    argument. The session reports each step it applies without asking through
    `hooks.onForced(question)`, at the moment it applies the step. A
    one-option retreat or push is such a step.
  - The harness adapter calls the agent there, so the rng is drawn in today's
    order. This relies on agents drawing the rng synchronously, as both do
    today.
  - Hosts may ignore the hook.
- **A3 (B3), "No list check".** `sessionApply` and the host's `apply` check a
  turn action only through `applyAction`'s own errors, as the harness does
  today. They do not check it against `sessionLegalActions`, so caller-built
  combined attacks are accepted. Answers are still checked against the listed
  answers (B3).
- **A4 (B10), "Units the seat has".** In `deployUnit`'s id `p${seat}u${n}`, `n`
  is the number of units that seat already has in `state`. This is the same as
  today's computer placer. A second human seat's ids now restart at 0. Ids are
  never shown to players, and the seat in the id keeps them unique.

- **B7 amended by §73 O4 (2026-11-24).** A caller may opt into a pause after
  each drift step (`hooks.pauseAfterDriftStep`): the session then stops with the
  resolution pending, `paused` set and no question, and `sessionResume` goes on.
  With the flag absent B7 is unchanged, and a host never sets it.
- **I1 corrected by §73 O1 (2026-11-24).** `BoardScene` never differed in the
  order I1 describes: its skipped retreat or drift item went on to the advance
  offer too, so there is no ordering difference to reconcile.
