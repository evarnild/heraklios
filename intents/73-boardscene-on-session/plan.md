<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §73 plan — The Board scene and its computer seats settle combats through the engine session

Intent: [intent.md](intent.md), with the owner's amendment of 2026-11-22 (O1-O5)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

`BoardScene` settles every land attack and its consequences through §72's
session: exchange sacrifice, retreats, pushes, drifts with tramples, and
advances.

- **One session per attack (O5).** It is built from the scene's attacked and
  rammed sets.
- **The scene drives it** with `sessionApply` and then a loop. Each open
  question is answered with `askAgent(this.seatRouter, …)`, the adapter the
  harness uses:
  - human seats answer through the scene's existing prompts, which still
    implement `PlayerAgent`;
  - computer seats answer through their `HeuristicAgent`;
  - steps the session applies without asking reach the computer agents
    through `onForced`, so their rng draws stay where they are today;
  - a human is still asked a one-option retreat, push or sacrifice, through a
    new `askForced` hook (O2).
- **Drift beats (O4).** The scene opts into a new pause after each drift step.
  - At each pause the live state really is at that beat.
  - The scene shows the step's events: log, arrow, cue, and a render of the
    live state.
  - It waits for Continue when a human is watching, and otherwise resumes at
    once.
- **What the scene keeps.** Only presentation: highlights, panels, log lines,
  renders and §66 cues, the drift arrow and Continue, and the AI pacing.
- **What goes:**
  - the scene's queues and closures;
  - its inline `retreatUnitTo`, `completePush`, `position =` and `destroyed =`
    writes for combat consequences;
  - `engine/retreat.ts` and `resolveElephantDrift` from production code (they
    move to a test-support module);
  - both `docs/architecture.md` exception rows.
- **Play is unchanged**, apart from O3's refusal of a larger-than-needed
  sacrifice. O1 settles that there is no ordering difference.
- **`BoardScene.ts` shrinks**, and its size baseline is lowered to match.

## Risks

- **The drift footgun (REVIEW-POLICY pass 9): the O4 pause.** This is the
  riskiest part.
  - **The early return.**
    - The pause adds one `return` inside `runResolution`'s loop
      (`combatResolution.ts:398-416`), right after `stepDrift(...)` (`:403`),
      once that step's events are stored.
    - `stepDrift` keeps its shape (`:310-345`):
      - it reads the events, and finishes the drift on `result.done`;
      - otherwise it sets exactly one `driftInput`, rolling the die only for a
        direction or combat request, before returning.
    - The pause check comes after `stepDrift` returns, when the drift is either
      finished or holds its next input. So a resume never runs a second
      `driftStep` before its input.
    - Every transition stays a `return`.
    - With the flag absent the loop body is identical to today's: the check is
      `if (hooks.pauseAfterDriftStep)` and nothing else.
  - **A third pending state.**
    - Today `session.pending` is `null` or has a `question`
      (`gameSession.ts:124`). The pause adds a pending with
      `question: null, paused: true`, and every reader must handle it.
    - `sessionLegalActions` returns `[]` while paused. With no question it
      would otherwise list turn actions, which `sessionApply` then refuses
      (`gameSession.ts:83`).
    - `sessionApply` throws while paused, with no state change:
      - a turn action fails at `:162`, with the message updated to "while the
        resolution is paused", not "undefined question";
      - an answer fails at `:153`, "no question is open".
    - `sessionBeginResolution` throws (`:181`).
    - `sessionResume(session, rng, hooks)` is the only way on, and it throws
      when the session is not paused.
  - **JSON round trip.**
    - `paused` is a JSON boolean on `Pending`, so B1 holds: a paused session
      that goes through `JSON.parse(JSON.stringify(...))` resumes to the same
      result.
    - The step's `DriftEvent`s, which hold live `Unit`s, are only in the
      returned `SessionStep.driftEvents`, never stored in the session.
  - **The host.** `host.ts` never sets the flag, so a host session never
    pauses.
    - `host.legalActions` and `apply` are unchanged.
    - `host.save` already refuses whenever `session.pending` is set
      (`host.ts:120`), and so it would refuse a paused session.
  - **Saves and undo are refused while paused.** In the scene a paused combat
    leaves `this.combat` set, and the `pending()` guard covers it.
  - **The pause after the final step.** The pause also comes after the
    drift's last step (`result.done`), so that step's events (`stopped` and
    the like) are shown, as `resolveElephantDrift` paced them. Resuming then
    goes on to the next queued step, or settles the combat.
- **`countEvents` miscounts new events.**
  - `fuzzHarness.ts:689-696` counts every event that is not `push` or
    `driftStarted` as a drift combat.
  - Adding `SessionEvent` kinds without making that an explicit `driftCombat`
    branch changes the harness stats, and the pinned snapshot fails.
  - Both go in the same commit.
- **Undo, die-roll and phase history boundaries.**
  - `recordAction` stays before the attack (`:2524`).
  - Both `sessionApply` and `sessionResume` get `this.diceRng` (`:471-474`),
    never `Math.random`. So the drift dice come through `diceRng` instead of
    `this.rollDie()`, and both clear the history.
  - The next drift die is now rolled before the pause rather than after
    Continue. Nothing else draws in between, and the attack's own die has
    already cleared the history.
  - Undo and redo stay refused while a combat is open, paused, or waiting on a
    prompt.
  - `commitEndPhase` still clears the history.
  - `restoreSnapshot` also clears `this.combat`.
- **Autosave, and saving refused while a question is open.**
  - These keep refusing exactly as today, through one `pending()` helper (a
    combat open, a prompt up, or a Continue awaited):
    - `autosave` (`:1016-1021`);
    - `openSaveLoad` (`:1028-1049`);
    - `confirmEndGame` (`:1136`);
    - `endPhase` (`:2919`);
    - `resolveGroupAttack` (`:2505`);
    - `undo`/`redo` (`:1273`, `:1291`).
  - The save format is unchanged, and no session is ever saved.
- **AI pacing and §66's cue/animation wiring.**
  - `applyAiAction` must await the whole settlement, pauses included, before
    `runAiSeats` calls `pause(AI_COMBAT_DELAY_MS)` (`:3044`, `:3065-3067`).
  - The attack's own cue frame must come first: `sessionApply` gains
    `onActionApplied(result)`, after `applyAction` and before the resolution.
  - Each consequence renders at its own event (`onEvent`), so a forced retreat
    and an advance don't merge into one frame.
  - Drift beats render the live state with `cues.driftMove` and
    `cues.driftClash`, as `beginDrift`'s hooks do today (`:305-316`).
  - During computer turns a drift resumes without waiting, as
    `driftOnStepHook` does today (`:235-238`).
- **The pause count per drift step.**
  - Today one Continue is awaited per event outside `SILENT_PAUSE_KINDS`, not
    per `driftStep` (`drift.ts:177-181`, and the `onStep` await in
    `resolveElephantDrift`).
  - At each session pause, the scene walks the step's events and awaits
    Continue once per such event, against the same live state, as today.
  - The characterisation scenario counts the Continues.
- **Human prompts become answers to session questions.**
  - The highlights and panels look the same, and they now resolve the open
    question.
  - The log lines stay where they are today:
    - `mustRetreat`, `mustRetreatRoom` or `nowhereToRetreat` come before a
      top-level retreat or push, forced and computer ones included (`:2230`,
      `:2271`);
    - none before a retreat a trample forces (`retreat.ts` has none);
    - no "retreats." line for a pushed link;
    - only `eliminatedNowhere` for a unit with nowhere to go.
  - O2 keeps the one-option prompts for humans. O3 refuses a
    larger-than-needed sacrifice.
  - The characterisation scenarios assert all of these.
- **BoardScene's size ceiling.**
  - The baseline is 3172. The file must shrink, and rule 5 requires the
    ceiling to be lowered to the measured length in the commit that shrinks
    it.
  - `drift.ts` (667) is lowered the same way when `resolveElephantDrift`
    moves out.
  - `combatResolution.ts` (417) gains the event kinds, `askForced` and the
    pause. If it nears 480, `emit` and the event types move to a small
    sibling module rather than letting it pass 500.
  - No `budget:` line is expected.
- **The lint cap (19).**
  - The settle loop and `showDriftStep` each stay under 80 lines and
    complexity 20.
  - `beginDrift` and `beginUnitRetreatChoice` (about 110 lines each) are
    removed. If the warning count falls, lower the cap in the same commit, and
    never raise it.
- **The characterisation tests come first.**
  - The new e2e scenarios are committed before any change, against the
    unchanged scene, and pass there.
  - Later commits may change an expectation only for O3, with the reason in
    the commit.
  - They read only presentation that survives the change: `retreatChoice`,
    the drift arrow fields, buttons, the log, and drawn and live positions.
    With O4, the live state at a Continue pause is meaningful, so the drift
    scenario may read `state()` there.
- **Tests that pass whatever the code does.**
  - Each scenario asserts the prompt kinds, the log lines and the final
    positions.
  - The seeds are pinned.
  - Human-only games draw `Math.random` in the same order before and after:
    the attack's die, then the drift dice in `driftStep`'s order. So each
    pinned seed gives the same outcome on both sides.
- **Stale line citations.**
  - The cites were read at `d8163fe`. `042ac89` changes only `intents/`
    (checked with `git diff`).
  - §75 hasn't merged, and it moves `devHook.ts`. Re-read everything after it
    merges (subtask 0).
- **Members the dev hook reads by name.**
  - `devHook.ts:32` reads `aiRunning`, `decisionPending`, `retreatChoice` and
    `driftState`, and `pendingHexes` reads `retreatChoice` (`:250-254`).
  - The scene keeps all four, with the same meaning:
    - `driftState`: a drift step is being shown or awaits Continue;
    - `decisionPending`: true from the start of a settle to its end, cleared
      in a `finally`.
  - Abandon stays unguarded.

## Verified against the codebase

Re-read on `main` at `d8163fe`. `042ac89` and the amendment `f59705f` change
only `intents/` (`git diff --quiet d8163fe 042ac89 -- src e2e docs scripts
CLAUDE.md package.json`).

**src/scenes/BoardScene.ts (3172 lines)**
- `src/scenes/BoardScene.ts:46-66` — imports `applyExchangeSacrifice`, `legalRetreatHexes`, `pushCandidates`, `retreatUnitTo`, `completePush`, `eligibleAdvanceCandidates`; `:66` `resolveElephantDrift`; `:83` `CueKeeper`.
- `src/scenes/BoardScene.ts:114-122` — `RetreatQueueItem`.
- `src/scenes/BoardScene.ts:136-138` — `RetreatChoice`.
- `src/scenes/BoardScene.ts:142-147` — `DriftState {lines, entry?, onComplete}`.
- `src/scenes/BoardScene.ts:175-182` — `retreatQueue`, `driftQueue`, `resolutionResolvedIds`, `retreatChoice`, `driftState`.
- `src/scenes/BoardScene.ts:195-205` — `driftArrowElephant`, `driftArrowFacing`, `driftContinueResolve`.
- `src/scenes/BoardScene.ts:235-257` — `driftOnStepHook` (no pause while `aiRunning`), `awaitDriftContinue`, `resolveDriftContinue`.
- `src/scenes/BoardScene.ts:259-370` — `beginDrift`:
  - calls `resolveElephantDrift(state, elephant, steps, this.seatRouter, () => this.rollDie(), hooks, forbidden, undefined, this.resolutionResolvedIds)`;
  - hooks: `onDriftStart` resets the arrow (`:288-299`); `onDirectionRolled` sets it and renders (`:300-304`); `onDriftMoved` sets `cues.driftMove` (`:305-308`); `onNarrate` appends (`:309-312`); `onRender` (`:313`); `onStep` (`:314`); `onCombat` sets `cues.driftClash` and logs two lines (`:315-327`);
  - retreat, push and elimination hooks (`:328-342`).
- `src/scenes/BoardScene.ts:400` — `decisionPending`.
- `src/scenes/BoardScene.ts:404` — `advanceEligibleAttackers`.
- `src/scenes/BoardScene.ts:471-474` — `diceRng` clears the history, then `Math.random()`.
- `src/scenes/BoardScene.ts:493`, `:500`, `:510`, `:515` — `seatAgents`, `aiRunning`, `aiRunToken`, `resolutionDone`.
- `src/scenes/BoardScene.ts:540` — `seatRouter = routeBySeat(this.seatAgents, this)`.
- `src/scenes/BoardScene.ts:560-592` — `resetSceneState`.
- `src/scenes/BoardScene.ts:907` — `cues`.
- `src/scenes/BoardScene.ts:908-934` — `renderAllUnits` draws from `this.state()`, takes the cue, and draws the arrow from `driftArrowElephant.position` (`:927-932`).
- `src/scenes/BoardScene.ts:957-962` — `captureSave`.
- `src/scenes/BoardScene.ts:1016-1021` — `autosave` guard.
- `src/scenes/BoardScene.ts:1028-1049` — `openSaveLoad` (`:1034` `aiRunning`, `:1038` pending).
- `src/scenes/BoardScene.ts:1130-1139` — `confirmEndGame` guards.
- `src/scenes/BoardScene.ts:1189-1198` — `captureSnapshot`.
- `src/scenes/BoardScene.ts:1206-1259` — `restoreSnapshot` (`:1233-1245` resets).
- `src/scenes/BoardScene.ts:1261-1302` — `undo`/`redo` guards (`:1273`, `:1291`).
- `src/scenes/BoardScene.ts:1314-1333` — `clearHistoryOnRoll` (relaxed in test mode), `rollDie`.
- `src/scenes/BoardScene.ts:1446-1448` — `update` suppresses the rules panel on `decisionPending`.
- `src/scenes/BoardScene.ts:1498-1520` — `onHexClick`: drift continue, then `retreatChoice`, then `decisionPending || aiRunning`.
- `src/scenes/BoardScene.ts:2131-2142` — `beginRetreatChoices`.
- `src/scenes/BoardScene.ts:2144-2171` — `advanceRetreatQueue`; a skipped item still goes to `finishQueueItem` (`:2150-2152`, `:2160-2162`), which settles O1.
- `src/scenes/BoardScene.ts:2176-2182` — `finishQueueItem`: a defender item gets `promptAdvanceChoice`.
- `src/scenes/BoardScene.ts:2206-2322` — `beginUnitRetreatChoice`:
  - asks when `legalHexes.length > 0` (`:2229`);
  - `retreatUnitTo` (`:2248`);
  - asks for a push when `pushTargets.length > 0` (`:2263`);
  - `completePush` (`:2292`);
  - `unit.destroyed = true` (`:2317`).
- `src/scenes/BoardScene.ts:2330-2367` — `chooseRetreat`, `choosePushTarget`, `handleRetreatChoiceClick`.
- `src/scenes/BoardScene.ts:2373-2422` — the advance queue and `promptAdvanceChoice` (`chosen.position = vacatedHex` `:2413`).
- `src/scenes/BoardScene.ts:2428-2501` — the `chooseAdvance` panel.
- `src/scenes/BoardScene.ts:2503-2530` — `resolveGroupAttack` (`:2505` guard, `:2524` `recordAction`).
- `src/scenes/BoardScene.ts:2547-2605` — `executeLandAttack`:
  - `cues.apply(state, action, this.diceRng)` `:2555`;
  - exchange `:2569-2586`;
  - retreats and drifts `:2591-2593`;
  - DE/EX `:2594-2598`.
- `src/scenes/BoardScene.ts:2614-2618` — `settleResolution`.
- `src/scenes/BoardScene.ts:2680-2774` — `chooseExchangeSacrifice`; Confirm accepts any selection that meets the threshold (`:2759-2771`).
- `src/scenes/BoardScene.ts:2909-2965` — `endPhase` (`:2919`), `commitEndPhase` (`:2938` history cleared, `:2961` autosave).
- `src/scenes/BoardScene.ts:2983-3046` — `maybeStartAiTurn`, `runAiSeats` (`:3029` `legalActions` with the scene's sets).
- `src/scenes/BoardScene.ts:3065-3067` — `pause` waits for `animationsSettled()`.
- `src/scenes/BoardScene.ts:3074-3145` — `applyAiAction` (`:3141-3143` `landAttack`).

**Engine**
- `src/engine/gameSession.ts:55-65` — `newSession` wraps `state` by reference.
- `src/engine/gameSession.ts:80-84` — `sessionLegalActions`; with no question it lists `legalActions` (`:83`).
- `src/engine/gameSession.ts:92-111` — `updateContext`.
- `src/engine/gameSession.ts:117-125` — `advanceResolution`: `session.pending = question ? pending : null` (`:124`).
- `src/engine/gameSession.ts:140-169` — `sessionApply`:
  - the rng check (`:147`);
  - an answer with no question throws (`:153`);
  - an unlisted answer throws (`:155`);
  - a turn action while `pending` throws (`:162`, naming `question?.kind`).
- `src/engine/gameSession.ts:174-185` — `sessionBeginResolution` (`:181`).
- `src/engine/combatResolution.ts:23-28` — the stale I1 comment (O1).
- `src/engine/combatResolution.ts:53-63` — `SessionEvent` (`push | driftStarted | driftCombat`), `ResolutionHooks {onForced?}`.
- `src/engine/combatResolution.ts:82-93` — `Pending {attackerIds, steps, resolvedIds, frames, drift, driftInput, question}`.
- `src/engine/combatResolution.ts:131-155` — `pendingFromAttack`.
- `src/engine/combatResolution.ts:174-206` — `minimalSacrifices`, `questionAnswers`.
- `src/engine/combatResolution.ts:219-245` — `applyAnswer` (`question = null` `:243`).
- `src/engine/combatResolution.ts:272-304` — `stepRetreat`:
  - forced retreat `:286-290`;
  - elimination with no event `:293-297`;
  - forced push `:298-303`.
- `src/engine/combatResolution.ts:310-345` — `stepDrift`:
  - `driftStep`, then the events;
  - `if (result.done)` `:324`;
  - the single-hex return `:330`;
  - dice `:333`, `:336`;
  - a trample frame and `retreatResolved` `:338-341`.
- `src/engine/combatResolution.ts:348-393` — `beginStep`.
- `src/engine/combatResolution.ts:396-417` — `runResolution` (`for (;;)` `:398`, `stepDrift` `:403`, settled `:407`).
- `src/engine/sessionAgents.ts:26-31` — `sacrificeAnswer`.
- `src/engine/sessionAgents.ts:37-61` — `askAgent`.
- `src/engine/sessionAgents.ts:67-69` — `forcedHooks`.
- `src/engine/sessionAgents.ts:71-86` — `settle`.
- `src/engine/host.ts:112-120` — `legalActions` and `apply` go through the session; `save` refuses whenever `session.pending` (`:120`).
- `src/engine/fuzzHarness.ts:10` — imports `resolveUnitRetreat` from `./retreat`.
- `src/engine/fuzzHarness.ts:672-686` — the test-only `resolveUnitRetreat`.
- `src/engine/fuzzHarness.ts:689-696` — `countEvents`, with its catch-all `else`.
- `src/engine/retreat.ts:24-55` — `resolveUnitRetreat` (asks even with one option, `:33-34`).
- `src/engine/drift.ts:122-135` — `DriftHooks`.
- `src/engine/drift.ts:177-181` — `SILENT_PAUSE_KINDS`.
- `src/engine/drift.ts:554-667` — `resolveElephantDrift`: each event's hook, then `onStep` unless the event is silent; a trample goes through `resolveUnitRetreat` (`:655-664`).
- `src/engine/drift.test.ts` — 21 `resolveElephantDrift` uses (rules `:160-502`, hooks and pauses `:633-800`).
- `src/engine/gameSession.test.ts:8`, `:23`, `:617-673` — the parity oracle.
- `src/engine/fuzzHarness.test.ts:243-336` — the `resolveUnitRetreat` cases.
- `src/engine/seatRouter.ts:32-49` — routing by owner.
- `src/engine/seatControl.ts:71-74` — `HeuristicAgent` with no rng in the web game.
- `src/engine/randomAgent.ts:88-98` — a greedy-prefix sacrifice (can be non-minimal).
- `src/engine/combat.ts:116-120` — `eligibleAdvanceCandidates` filters out destroyed units.
- `src/engine/combat.ts:93`, `:798`, `:923` — comments naming the scene path.
- `src/engine/saveGame.ts:307-321` — `buildSavedGame` (`testMode`).
- `src/ui/saveStorage.ts:65` — loading sets `session.testMode`.

**UI, e2e and docs**
- `src/ui/cueKeeper.ts` — `apply`, `driftMove`, `driftClash`, `take`.
- `src/ui/devHook.ts:32` — `BUSY_FIELDS`.
- `src/ui/devHook.ts:186` — `installDevHook`.
- `src/ui/devHook.ts:208-210` — `seed`.
- `src/ui/devHook.ts:238-254` — `busy`, `idle`, `pendingHexes` (pre-§75 lines).
- `e2e/helpers.ts:73-95` — `settle`.
- `e2e/savesDir.ts:11`, `:93-94` — the saves folder and its lock. Slots 1, 5 and 6 are in use.
- `src/ui/testMode.ts:113-161` — Combat test mode.
- `docs/architecture.md:39-42` — principle 7.
- `docs/architecture.md:92` — the inline-bookkeeping row.
- `docs/architecture.md:97` — the two-drivers row.
- `CLAUDE.md:246-249`, `:262-267` — the two-drivers and inline-bookkeeping notes.
- `scripts/size-baseline.json` — `BoardScene.ts` 3172, `drift.ts` 667, `fuzzHarness.ts` 1276.
- `scripts/size-budget-lib.mjs:96-100` — rule 5.
- `package.json:12` — `--max-warnings 19`.

## Where this goes

- **Modules touched:**
  - `src/scenes/BoardScene.ts`:
    - a land attack is settled by the per-attack session and the question
      loop;
    - drift pauses are shown by `showDriftStep`;
    - the queues, the drift driver and the inline writes are removed;
    - the guards use `pending()`.
  - `src/engine/gameSession.ts`:
    - the `onActionApplied` hook;
    - `sessionResume`;
    - the paused-state rules in `sessionLegalActions`, `sessionApply` and
      `sessionBeginResolution`;
    - `advanceResolution` keeps a paused `pending`;
    - `SessionStep` gains `paused` and `driftEvents`.
  - `src/engine/combatResolution.ts`:
    - new event kinds (`retreat`, `eliminated`, `advance`, `sacrifice`; ids
      and hexes only), sent through one `emit` helper that also calls
      `onEvent`;
    - `askForced` (O2);
    - `pauseAfterDriftStep` and `Pending.paused` (O4);
    - the I1 comment corrected (O1).
  - `src/engine/fuzzHarness.ts`: an explicit `countEvents`, and its import
    moved to `driftReference.ts`.
  - `src/engine/drift.ts`: `resolveElephantDrift` and `DriftHooks` move out;
    `SILENT_PAUSE_KINDS` is exported.
  - `src/ui/cueKeeper.ts`: the cue around `sessionApply`.
  - `src/ui/devHook.ts`: two readers.
  - `src/ui/i18n/en.ts` and `fr.ts`: O3's refusal line.
  - `docs/architecture.md`, `CLAUDE.md`, and comments in `combat.ts` and
    `actionCue.ts`.
  - `e2e/`.
- **New modules:**
  - `src/ui/driftBeats.ts` turns one drift step's `DriftEvent`s into the
    Board's presentation as plain data: log line, arrow change, cue, render,
    and whether it waits for Continue.
    - It earns its place because it holds the pacing rules `drift.test.ts`
      tests today through `resolveElephantDrift`'s hooks: no pause on silent
      kinds, the arrow reset on `driftStarted`, `directionResumed` updating the
      arrow with no line, the clash on `combatResolved`, and the render on
      `driftElephantDestroyed`.
    - Those rules are unit-tested here instead of in the scene.
  - `src/engine/driftReference.ts` holds `resolveElephantDrift` and
    `resolveUnitRetreat` (today's `retreat.ts`).
    - They are kept only as the reference pump for `drift.test.ts`, for
      `gameSession.test.ts`'s parity oracle, and for the harness's test-only
      `resolveUnitRetreat`.
    - The module has no production caller.
  - `e2e/combatFixtures.ts` builds a crafted `SavedGame` (`buildSavedGame`,
    `testMode: false`), writes it to slot 4 under the save lock, and loads it
    through the Save/Load panel.
- **Why there:**
  - The sequencing has one home, the session (principle 6).
  - The scene changes state only through the engine, which ends principle 7's
    exception.
  - The pause lives in the session, because that is the only place the state
    really is at a beat (O4).
  - `driftBeats.ts` is pure presentation logic in `ui`, tested without a
    browser (principle 15).
  - The reference pump leaves `drift.ts`, so production has one driver
    (principle 12).
- **`engine/retreat.ts` and `resolveElephantDrift`.**
  - Once the scene switches, no production code uses them.
  - They can't simply be deleted: about 20 `drift.test.ts` rule and hook
    cases, the B7 parity oracle (`gameSession.test.ts:617-673`), and
    `fuzzHarness.test.ts:243-336` depend on them.
  - They move to `src/engine/driftReference.ts`, and the `engine/retreat.ts`
    file is deleted.
  - Porting those tests and deleting the pump is a follow-up.
- **The exception rows that go:**
  - `docs/architecture.md:97` (two drivers);
  - `docs/architecture.md:92` (post-combat bookkeeping inline in
    `BoardScene`);
  - principle 7's "The post-combat bookkeeping is the known exception;"
    becomes "No exceptions are allowed."
- **Budget lines:** none. `BoardScene.ts` and `drift.ts` shrink, and their
  ceilings are lowered.

## Subtasks

0. **Preconditions.**
   - §75 is merged (and so §74). Rebase.
   - Re-read every citation above, and record the shifts in Progress.
1. **Two dev-hook readers and the fixture helper.** No scene change.
   - `pendingChoice(): { kind: 'retreat' | 'pushTarget'; hexes: Hex[] } | null`
     reads `retreatChoice` and maps `'choosePushTarget'` to `'pushTarget'`.
     `pendingHexes` can't tell a push from a retreat.
   - `driftArrow(): { hex: Hex; facing: number } | null` reads
     `driftArrowElephant` and `driftArrowFacing`, guarded by name like
     `BUSY_FIELDS`.
   - Each reader is one line in §75's board-reader builder, plus its `DevHook`
     entry, plus §75's pinned member list in `e2e/dev-hook-members.spec.ts`.
   - Add `e2e/combatFixtures.ts`.
   - Run `npm run verify` and `npm run e2e`, and commit.
2. **Characterisation scenarios, against today's scene.** These are
   committed before any engine or scene change, in
   `e2e/combat-resolution.spec.ts`. Each scenario:
   - loads a fixture save (`testMode: false`);
   - seeds the dice with a searched seed (the `H32_SEEDS` pattern);
   - plays by clicks;
   - asserts the prompt kinds, the log lines (from `messagesFor('en')`) and
     the final positions.

   The scenarios:
   - **(a) Advance.** A DR against a lone defender.
     - `pendingChoice().kind === 'retreat'` with two or more hexes; click one.
     - The advance panel shows "Don't advance" and `A: <unit>`; click `A`.
     - The attacker ends on the vacated hex, and the log shows "retreats." then
       "advances".
   - **(b) Exchange.** Two or three attackers, EX.
     - A selection below the threshold is refused (`selectMoreForce`).
     - A minimal selection is confirmed: its units are destroyed, and
       `exchangeSacrificed` is logged.
     - Then come the advance offers.
   - **(c) Push.** A boxed-in defender with one friendly neighbour.
     - `pendingChoice()` shows `pushTarget`, with `nowhereToRetreat` logged.
       Click the friend.
     - Then `retreat` for the friend, with `mustRetreatRoom` logged. Click.
     - "retreats, making room for" is logged, with no extra "retreats." line.
     - Check the final positions.
   - **(d) Drift with a trample.** A human watches an elephant forced into an
     occupied hex.
     - Count the "▶ Continue" pauses.
     - At each pause, check `driftArrow()`, the elephant's drawn position
       (`unitCanvas` against `hexToCanvas`) and its live position
       (`state()`).
     - The trample is logged, then the trampled unit's retreat prompt comes
       up, with no "must retreat" line.
     - Check the final state.
   - **(e) Boundaries.**
     - While a question is open: Undo logs `resolvePendingUndo`, Save/Load
       logs `resolvePendingSave`, and End phase logs `resolvePendingPhase`.
     - The same three refuse at a drift Continue pause.
     - After the combat settles (not test mode), Undo logs "Nothing to undo".
   - **(f) One-option human retreat.** `pendingChoice()` has exactly one hex and
     waits for the click (O2 keeps this).
   - **(g) Computer attacker against a human defender.**
     - A human retreat prompt appears while `busy()` includes `aiRunning`.
     - The click settles the combat, and the computer goes on.
     - `errors` is empty.

   All pass on the unchanged scene. Commit as "characterisation, before §73's
   change".
3. **Engine seams that don't pause.** Additive, with the pinned traces
   unchanged.
   - New event kinds through `emit(events, hooks, event)`, which pushes the
     event and calls `hooks.onEvent?.(event)`:
     - `retreat {unitId, hex}` (answered and forced);
     - `eliminated {unitId}` (the branch at `:293-297`);
     - `advance {unitId, hex}`;
     - `sacrifice {unitIds}` (answered and forced).
   - Give `countEvents` an explicit `driftCombat` branch, in the same commit.
   - `onActionApplied?.(result)` in `sessionApply`, after `updateContext` and
     before `advanceResolution`.
   - `askForced?.(question)` (O2): when it returns true, a one-option retreat,
     push or sacrifice is returned as a question instead of being applied, and
     `onForced` is not called.
   - Correct `combatResolution.ts:23-28` (O1): the scene and the harness order
     the steps the same way.
   - Add the tests below. `harnessPinned.test.ts`, fuzz and soak stay green
     and unchanged.
   - Run `npm run verify` and commit.
4. **The opt-in drift pause (O4).** A separate commit, because it is the
   footgun.
   - `Pending.paused: boolean`, set to `false` by `newPending`.
   - `ResolutionHooks.pauseAfterDriftStep?: boolean`.
     - In `runResolution`'s drift branch, `stepDrift` returns that step's
       `DriftEvent`s.
     - Then:
       `if (hooks.pauseAfterDriftStep) { pending.paused = true; pending.question = null; <store the step's events on the call's out-list>; return null; }`.
     - The store and the `return` are the only additions. `stepDrift`'s own
       transitions are unchanged.
   - `advanceResolution` keeps `pending` when paused:
     `session.pending = question || pending.paused ? pending : null`.
   - `SessionStep` gains `paused: boolean` and `driftEvents: DriftEvent[]`,
     the paused step's events, never stored.
   - `sessionResume(session, rng, hooks = {})`:
     - it requires an rng;
     - it throws, with no change, unless `session.pending?.paused`;
     - it clears `paused` and calls `advanceResolution`.
   - While paused:
     - `sessionLegalActions` returns `[]`;
     - `sessionApply` throws for both turn actions and answers (`:162`,
       `:153`), with `:162`'s message saying the resolution is paused;
     - `sessionBeginResolution` throws.
   - The `gameSession.ts` header and the `ResolutionHooks` docs say that a host
     never sets the flag.
   - Add a dated note to §72's spec Amendment: "B7 amended by §73 O4: a caller
     may opt into a pause after each drift step; with the flag absent B7 is
     unchanged." Add the O1 correction of I1 to the same note.
   - Add the pause tests below.
   - Run `npm run verify` and commit.
5. **`src/ui/driftBeats.ts` and its tests (pure).**
   - Export `SILENT_PAUSE_KINDS` from `drift.ts`, and import it in the new
     module.
   - Run `npm run verify` and commit.
6. **The scene settles land attacks through the session.** One commit; the
   old code is left in place, unused.
   - `combat: GameSession | null` (O5): built per attack with
     `newSession(state, {attackedThisPhase, rammedThisTurn})` from the scene's
     sets, and dropped once the combat is settled.
   - `settleLandAttack(action)`:
     1. `step = sessionApply(combat, action, this.diceRng, hooks)`.
     2. Loop:
        - if `step.paused`: `await this.showDriftStep(step.driftEvents)`, then
          `step = sessionResume(combat, this.diceRng, hooks)`;
        - else, if a question is open: log its pre-question line,
          `answer = await askAgent(this.seatRouter, state, q)`, then
          `step = sessionApply(combat, answer, this.diceRng, hooks)`;
        - else stop.
     3. `await Promise.all(kept)`.
     4. `finally`: clear `combat`, `decisionPending` and the drift fields.
   - Hooks:
     - `onActionApplied`: complete the cue, log the combat outcome, render,
       and clear the combat selection.
     - `onEvent`: one log line and one render per event.
     - `onForced`: for computer seats only,
       `kept.push(askAgent(agentFor(q.player), state, q))`, plus the
       pre-question line.
     - `askForced`: `!this.seatAgents.has(q.player)` (O2).
     - `pauseAfterDriftStep: true`, always.
   - `showDriftStep(events)`:
     - set `driftState`;
     - for each event, take its beat from `driftBeats`: update the arrow
       fields, append the line, set `cues.driftMove` or `cues.driftClash`,
       and call `renderAllUnits()` unchanged, drawing the live state;
     - await Continue only when `!this.aiRunning` and the beat pauses;
       otherwise go on at once.
   - Pre-question lines are as in Risks. The scene tracks which units were
     chosen as push targets in this combat, for the pushed-link wording.
   - The prompts stay `PlayerAgent` methods. `chooseExchangeSacrifice` is given
     the listed answers, and Confirm accepts only one of them, with a new en/fr
     line (O3).
   - `resolveGroupAttack` and `applyAiAction` call `settleLandAttack`.
     `CueKeeper` gains a cue-around-`sessionApply` method.
   - Run `npm run verify` and `npm run e2e`. Every characterisation scenario
     passes unchanged. Scenario (b) gains O3's refusal of a larger-than-needed
     selection, with the reason in the commit.
   - Commit.
7. **Delete the dead sequencing in the scene.**
   - Remove `beginRetreatChoices`, `advanceRetreatQueue`, `finishQueueItem`,
     `beginUnitRetreatChoice`, the advance queue, `beginAdvanceOffers`,
     `processNextAdvanceOffer`, `promptAdvanceChoice`, `beginDrift`,
     `driftOnStepHook`, `settleResolution` and `executeLandAttack`.
   - Remove their fields (`retreatQueue`, `driftQueue`,
     `resolutionResolvedIds`, `advanceEligibleAttackers`, `resolutionDone`),
     `RetreatQueueItem`, `DriftState.onComplete`, and the unused imports.
   - The guards use `pending()`. `resetSceneState` and `restoreSnapshot`
     clear `combat`.
   - Rewrite the `decisionPending` doc comment (`:372-399`).
   - Lower `BoardScene.ts`'s ceiling (`npm run size:baseline -- --write`).
     Lower the lint cap if warnings fell.
   - Run `npm run verify` and `npm run e2e`, and commit.
8. **Move the reference pump out of production; update the docs.**
   - Create `src/engine/driftReference.ts`, and delete `engine/retreat.ts`.
   - Re-point `drift.test.ts`, `gameSession.test.ts` and `fuzzHarness.ts`.
   - Lower `drift.ts`'s ceiling.
   - Remove `docs/architecture.md:92` and `:97`, and reword principle 7.
   - Update `CLAUDE.md:246-249` and `:262-267`, and the comments at
     `combat.ts:93`, `:798`, `:923` and `actionCue.ts:152`, `:157`.
   - Run `npm run verify` and commit.
9. **Progress and status.**
   - Record `BoardScene.ts`'s length before and after, the warning count and
     the cap, and the test counts.
   - Commit with `status: in-review`.

## Tests

- **The pinned traces.** `harnessPinned.test.ts` stays unchanged and must stay
  green. It fails if:
  - `countEvents` keeps its catch-all `else`;
  - `emit` changes the order of the steps;
  - `askForced` or `pauseAfterDriftStep` leaks into the harness when absent.

  The harness and the host never pass the flag, so with it absent the traces
  stay byte-identical.
- **New events (`gameSession.test.ts`).**
  - A forced and an answered retreat each emit `retreat` with the hex.
  - A boxed-in unit that cannot push emits `eliminated`.
  - An advance emits `advance`. A declined advance emits nothing.
  - A sacrifice emits `sacrifice`, whether answered or forced.
  - `onEvent` receives exactly `step.events`, in order.
- **`onActionApplied`.** It is called once per turn action, with the result,
  before any `onForced`, event or question.
- **`askForced` (O2).**
  - When it returns true, a one-option retreat, push and sacrifice each
    become a question with exactly one answer, and `onForced` is not called.
  - When it is absent, the existing forced-step tests pass.
- **The pause (O4), in `gameSession.test.ts`.** Each test names the mutant it
  kills.
  - **Parity with an unpaused run.** For the elephant parity seeds, one copy is
    settled with `pauseAfterDriftStep`, resuming at every pause; the other is
    settled without the flag. These must be equal:
    - the final states;
    - the `context`;
    - the concatenated `SessionEvent`s;
    - the rng draw count (a counting rng).

    It kills: a lost step, a repeated `driftStep`, and a die rolled again on
    resume (draw count +1).
  - **Each step exactly once.**
    - The concatenated `driftEvents` across pauses equal the `DriftEvent`
      sequence `resolveElephantDrift` (from `driftReference.ts`) produces for
      the same seed.
    - The number of pauses equals the number of `driftStep` calls.
  - **The trample retreat.** Its question comes after the pause of the step
    that caused it, and resuming asks it. It kills resuming the drift before
    the trample retreat.
  - **While paused.** Each of these leaves the state deep-equal to before:
    - `sessionLegalActions` is `[]`;
    - `sessionApply` with a turn action throws;
    - `sessionApply` with an answer throws;
    - `sessionBeginResolution` throws.
  - **Resume when not paused.** Resuming throws when no combat is open, and
    when a question is open.
  - **Round trip.** Pause, then `JSON.parse(JSON.stringify(session))`, then
    resume: the result equals that of resuming the original.
  - **The host.**
    - A host-driven elephant game never pauses: `question` and `apply` behave
      as before.
    - `save()` refuses a paused session built by hand.
- **`driftBeats.test.ts`.**
  - Silent kinds don't pause.
  - Each `moved` beat pauses (the regression at `drift.test.ts:783`).
  - The arrow resets on `driftStarted`.
  - `directionResumed` updates the arrow with no line.
  - `combatResolved` gives a clash and two lines.
  - `driftElephantDestroyed` renders.
- **The scene (e2e, `combat-resolution.spec.ts`).** What each scenario catches:
  - (a) an advance applied wrongly, or its panel missing;
  - (b) a wrong sacrifice mapping, or a larger-than-needed selection accepted
    (O3);
  - (c) a wrong push order, or swapped log lines;
  - (d) pauses merged or skipped (the Continue count differs), a stale arrow,
    a drawn or live position that doesn't match the beat, or a "must retreat"
    line inside a drift;
  - (e) a dropped guard, including at a drift pause, or `Math.random` passed
    instead of `diceRng` (which "Nothing to undo" catches);
  - (f) `askForced` dropped for humans;
  - (g) `applyAiAction` not awaiting the settlement: the next turn action hits
    the open or paused session, `sessionApply` throws, and `errors` is
    non-empty.

  Not checked: a drift die that does not clear the history. That mutant is
  equivalent, because the attack's die has already cleared it.
- **The existing e2e** (`attacks`, `attack-log`, `swap`, `naval`,
  `undo-shortcuts`, `board-animations`, `message-log`, `hud-strays`): unchanged
  and green.
- **The reference pump move.** The `drift.test.ts`, parity and
  `fuzzHarness.test.ts` cases run unchanged against `driftReference.ts`.

## Validation

- `npm run verify` green. Lint at or below the cap; lower the cap if warnings
  fell.
- `npm run check:intent` PASS, with the ceilings lowered and no `budget:` line.
- `npm run e2e` green: the new characterisation spec plus every existing
  scenario unchanged. The only addition is O3's case.
- **Live check** (owed by rule 1, `src/scenes/**`).
  - Run `npm run dev` on port 5273 in
    `C:/Users/eric/src/heraklios-wt/73-boardscene-on-session`.
  - Use Combat test mode in the Standard view. Then repeat in the Drawn view at
    Normal speed.
  1. Melee until you get a DR. The retreat hexes are highlighted, even when only
     one is possible (O2). Click one, then answer the advance panel.
  2. Combine 2-3 units for an EX.
     - The exchange panel refuses a selection below the threshold.
     - It also refuses a larger-than-needed selection, with a message (O3).
     - Confirm a minimal set, then answer the advance offers.
  3. Attack with or against the elephants until one drifts.
     - Each Continue shows the board at that beat, one hex at a time, with the
       arrow following.
     - A trample logs its combat, and the trampled unit's retreat prompt
       appears.
  4. With a prompt open, and again at a Continue pause, Undo, Save/Load and End
     phase each refuse with their message.
  5. Play a game with a computer seat.
     - Its attacks and drifts resolve without pausing.
     - A retreat prompt for your units appears during its turn.
     - It pauses after each combat, as before.
     - There is no console error.
  - A push needs a set-up position. Scenario (c) stands in for it.

## Assumptions I made

- **Fixture saves.** The scenarios use crafted saves in slot 4, not new Menu
  test modes. That pins exact positions without touching `testMode.ts` or the
  Menu, and `testMode: false` makes "the roll clears the history" observable.
- **The two readers** join §75's board-reader group. If §75 groups the readers
  differently, they go where the Board readers are.
- **`resolveElephantDrift` and `retreat.ts`** move to a test-support module.
  They are not deleted, so no test case is lost. Porting their tests is a
  follow-up.
- **The scene keeps `implements PlayerAgent`** and its `seatRouter`.
  `askAgent(this.seatRouter, …)` is the harness's adapter.
- **The O4 API.**
  - It is `pauseAfterDriftStep` plus `sessionResume`, with `Pending.paused` as
    JSON.
  - The step's `DriftEvent`s are returned in `SessionStep.driftEvents`, never
    stored.
  - The scene always opts in, and during computer turns it resumes at once, so
    one code path serves both.
  - There is a pause after the drift's final step too, so its last beat
    (`stopped` and the like) is shown, as today.
  - Within one paused step, the scene awaits Continue once per pausing beat,
    as `resolveElephantDrift`'s `onStep` did.
- **Not yet confirmed:**
  - that `parseSavedGame` and the server accept a hand-built save (subtask 1
    proves it);
  - whether one `driftStep` can emit more than one pausing beat (the scene
    handles it either way);
  - `combatResolution.ts`'s size after the pause;
  - which `BoardScene` functions the 19 lint warnings come from.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-24: implemented (all subtasks)

Commits: `01daea6` dev-hook readers, fixture helper and characterisation scenarios;
`de4610c` engine seams that do not pause; `0accf50` the opt-in drift pause (O4);
`a8804e0` `ui/driftBeats.ts`; `434eea6` the Board settles land attacks through the
session (subtasks 6 and 7); `f3208c1` the reference pump leaves production, docs and
ceilings; one small commit after it keeps two existing tests' comment lines intact.

What shipped:
- **Characterisation first** (`e2e/combat-resolution.spec.ts`, 9 scenarios (a)-(g) on crafted
  positions in `e2e/combatScenarios.ts`, loaded from slot 4 by `e2e/combatFixtures.ts`;
  `combatScenarios.test.ts` checks each seed against the engine). All 9 passed on the unchanged
  scene before any engine or scene change. Drift scenario (d): 9 Continue pauses, the retreat
  prompt after the 4th (the trample), 5 more, then the advance offer.
- **Engine**: `retreat`, `eliminated`, `advance`, `sacrifice` events through one `emit` (also
  `onEvent`); `onActionApplied`; `askForced`; `pauseAfterDriftStep` + `Pending.paused` +
  `sessionResume` (one `return` in `runResolution`, after `stepDrift`); `SessionStep.paused` and
  `driftEvents`; `isListedSacrifice` (O3); `countEvents` has an explicit `driftCombat` branch.
- **UI**: `ui/driftBeats.ts` (the drift pacing rules as data, unit-tested), `CueKeeper.begin`,
  `BoardScene.settleLandAttack` (one session per attack, loop of `askAgent(seatRouter, ...)`,
  `showDriftStep`), one `pending()` guard helper, the O3 refusal line in en and fr.
- **Removed**: the scene's retreat, drift and advance queues, `beginDrift`, `driftOnStepHook`,
  `executeLandAttack`, `settleResolution`, its inline `retreatUnitTo`/`completePush`/`position =`/
  `destroyed =` writes, the `rollDie` method; `engine/retreat.ts` and `resolveElephantDrift`
  moved to `engine/driftReference.ts` (tests only); both `docs/architecture.md` exception rows and
  principle 7's exception.

Numbers: `BoardScene.ts` 3169 -> 2835 lines (ceiling lowered to 2835); `fuzzHarness.ts` 1276 -> 1275;
`drift.ts` left the baseline (under 500). `combatResolution.ts` is 487 lines (under 500, no split
needed). Lint: 17 warnings, cap lowered 18 -> 17. `npm run verify`: 107 test files, 1792 passed, 2
skipped. `npm run e2e`: 55 passed (the 9 new scenarios and every existing one; scenario (b) gained
only O3's refusal of a larger-than-needed selection, plus two tightened asserts in (f) and (g), see
below).

Mutants run (backup by copy, restored by copy):
- engine: pause without its `return` (4 tests fail); pause dropping a drift event (2 fail); resume
  not clearing `paused` (the session stays paused; 10 tests fail).
- scene (e2e): `Math.random` instead of `diceRng` for the attack (scenario (e) "nothing to undo"
  fails); `askForced` dropped (scenarios (c) and, after tightening, (f) fail); `applyAiAction` not
  awaiting the settlement (scenario (g), after tightening, fails).

Deviations from the plan:
1. **Citations** (subtask 0). `BoardScene.ts` was 3169 lines (not 3172) and the lint cap 18 (not 19)
   at the start; the dev hook was already split into builders by §75, so `pendingChoice` and
   `driftArrow` joined `boardReaders` and the pinned member list in `dev-hook-members.spec.ts`.
2. **Subtasks 6 and 7 are one commit.** The old sequencing could not stay unused under the build
   and lint, so it was deleted in the same commit.
3. **The dice are seeded just before "Resolve attack"**, not at load: building the attack draws
   from `Math.random` too. Scenario (g) seeds just before the Load click, because the computer
   attacks as the game loads. `loadFixture` does not wait for idle when a seat is a computer's.
4. **Existing tests changed** (plan said none): `gameSession.test.ts` has three event-list
   expectations that now include `retreat` events (and one `push` list filtered to `push`), and
   `drift.test.ts` and `gameSession.test.ts` import `resolveElephantDrift` and `resolveUnitRetreat`
   from `driftReference.ts`. This is why `check:intent` says ROUTE (below).
5. **Pause tests**: "each step exactly once" compares the pauses' events with the `driftStep`
   calls of an unpaused run (a mocked `driftStep` records them) rather than with
   `resolveElephantDrift`'s own sequence; the existing parity oracle already ties the session to
   the reference pump. The host test checks that a host-driven elephant game never pauses; a
   hand-built paused session cannot be passed to `host.save()` (the host does not expose its
   session), so that refusal is not separately tested (the `session.pending` guard is unchanged).
6. **Exchange render timing kept**: with an exchange to choose, the board is drawn once the losses
   are chosen (as before), not when the attack is applied; the plan's `onActionApplied` said to
   render always.
7. `minimalSacrifices` is exported and `isListedSacrifice` lives in `sessionAgents.ts`; `Pending`
   gained `paused` (an old JSON session without it reads as not paused).
8. The §72 spec Amendment got the dated B7 and I1 notes (plan subtask 4), a file outside this
   intent's folder.
9. `npx playwright install chromium` was run once (the machine had no browser).
10. Stale comments in `combat.test.ts` and `fuzzHarness.test.ts` that name removed scene functions
    were left alone so those files lose no lines; their comments in `combat.ts` and
    `fuzzHarness.ts` were updated.

`npm run check:intent`: ROUTE (exit 2), not FAIL: "Declared refactor, but existing tests lost lines
(src/engine/drift.test.ts, src/engine/gameSession.test.ts)". The reason is deviation 4: import
re-pointing for the moved pump, and the event-list expectations of the new event kinds.

Not checked: the live check (owed by rule 1, `src/scenes/**`); the Drawn view at Normal speed was
not run by hand (the e2e runs with animations off).
