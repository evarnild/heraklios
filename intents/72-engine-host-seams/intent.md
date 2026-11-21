<!-- generated-by: heraklios/intent@0.1.5 -->
# §72 — The engine can run a whole game for a host other than the Phaser scenes

**Type:** feature
**Originator:** the owner (2026-11-21), after §70's result: "draft the
follow-up intent", scoped to "Step 1 only".
**Source:** `intents/70-unity-front-end-probe/result.md` → "Findings: seams for
a later intent" (1-4, 6) and "Proposed next intent", step 1.

## Problem

§70 showed that a Unity front end can host the unchanged engine through
ClearScript V8. It also showed that only movement could be played that way,
because three things a game needs live in Phaser scenes, not in
`src/engine/`. From `result.md`:

- **Finding 2, deploying the armies.** "No engine function builds a real
  starting position. Armies are placed in `PlacementScene` and `testMode.ts`;
  the engine only has `buildFuzzGameState` (a fixture in `fuzzHarness.ts`) and
  `createInitialState` (empty)."
- **Finding 3, settling a combat.** "Pending resolution is outside
  `applyAction`. Retreats, pushes, advances, elephant drift and the
  post-combat bookkeeping are `PlayerAgent` callbacks or inline scene code
  (`BoardScene` ~3000 lines). … Interactive combat from Unity needs those
  turned into JSON 'pending question / answer' actions. This is the biggest
  piece of the next intent."
- **Finding 1, the entry point.** "A real front end needs a small, supported
  `src/engine` entry … rather than a probe file reaching into modules."

Findings 4 and 6 add two traps a new host would fall into:

- `ActionContext` (`attackedThisPhase`, `rammedThisTurn`) is bookkeeping the
  caller owns.
- `applyAction` falls back to `Math.random` when the caller passes no rng.

The web game has the same problem from the other side. The post-combat
advance and elimination bookkeeping "is still not extracted and mutates
`GameState` inline" (`CLAUDE.md`, Architecture → `src/scenes/`), so the
scene holds rule sequencing that no test covers.

## Outcome

- **Deploying.** An engine function builds a game-ready `GameState` from the
  players' armies and their deployment. It applies the same placement rules
  `PlacementScene` and `ui/aiSetup.ts` apply today, and it has tests.
  Placement uses it.
- **Settling a combat.** A combat's open questions (retreat, push target,
  advance, exchange sacrifice, elephant drift, and the ram and boarding
  answers) are exposed as engine data: a pending question, plus an answer
  action that `applyAction` accepts. Its tests drive a whole game through
  questions and answers alone.
  - The fuzz harness uses it in place of its own sequencing. `BoardScene`
    and the computer seats keep theirs for now (see the amendment below).
  - Headless seeded play gives the same results as before: `playRandomGame`
    traces and stats are unchanged for a fixed set of seeds.
- **The host entry.** One supported module gives a host the whole game as
  JSON in and JSON out: new game, legal actions, apply, pending question,
  answer, state, save and load. It requires a seeded rng, and it carries the
  `ActionContext` bookkeeping itself.
- **Proof.** A test drives a seeded game from deployment to its end through
  the host entry only. It ends in the same state as the same game played
  through the existing engine calls.
- **Shape and size.** The web game plays exactly as before.

**Amendment (owner, 2026-11-21, spec question round: "Split it out").**
Moving `BoardScene` and the computer seats onto the protocol is split into its
own follow-up intent, recorded with `blocked_by` §72. §72's Outcome no longer
includes it, nor the shorter `BoardScene.ts`. In the same round the owner
chose two more points:
- the open question lives in a JSON session object beside `GameState`, not
  saved, so saving and undo stay refused mid-combat as today;
- answers are new `Action` kinds.

## Constraints

- **No rule changes.** The rules stay where they are. The pending-question
  protocol re-expresses the current sequence and adds no new one:
  `combat.ts`'s `pendingRetreats` are taken "one at a time", and the drift
  stays `drift.ts`'s resumable state machine.
  - The drift's "every frame transition *returns*" footgun (`REVIEW-POLICY.md`
    pass 9) applies to any change near it.
- **Byte-identical behaviour.** Headless and AI play stay byte-identical
  where the change is meant to keep behaviour (pass 9). The fuzz harness,
  `heuristicSoak.test.ts` and the e2e suite stay green with their
  expectations unchanged.
- **Save format.**
  - If `GameState` gains a field (for example the pending question), it
    changes `SAVE_VERSION`, `saveGame.ts` and `ui/saveStorage.ts`, with a
    loader for old saves.
  - A save taken mid-question must load back to the same question.
  - Undo and die-roll boundaries stay where they are (`CLAUDE.md`).
- **No Unity work.** No Unity code, no `unity-probe/`, and no new runtime
  dependency. The host entry is plain TypeScript that a bundler can pick up,
  as §70's `engine-entry.ts` was. §70's result describes how it is consumed.
- **Tier.** `src/engine/saveGame.ts` and `src/engine/history.ts`, if
  touched, are Reviewed by the path table. The scenes and ui changes owe a
  live check (rule 1).
- **Out of scope:**
  - the Unity shell and the CI parity gate (§70's proposed step 2);
  - a playable Unity board and a 3D look (step 3);
  - mobile and WebGL;
  - combined attacks in `legalActions` (§70 finding 5, which stays caller-built).

## Type-specific questions

### Feature
- **Users:**
  - hotseat players and computer seats, who must notice no change;
  - a future non-Phaser host (Unity, per §70);
  - the headless harness.
- **Rulebook basis:** none new. This restructures how existing rules are
  driven.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - **Where the pending question lives.** Is it in `GameState`, which is
    saved and undone with the game, or in a separate engine-owned "turn
    session" beside it? This decides the save-format and undo work.
  - **What the answer actions look like.** Are they new `Action` kinds
    accepted by `applyAction` and listed by `legalActions` while a question
    is open, or a separate `answer(...)` call?
  - **Where the two agent interfaces end up.** How `PlayerAgent` (async
    callbacks) and the drift's `onStep` pauses map onto question/answer, and
    whether `PlayerAgent` remains as an adapter or goes.
  - **Who keeps `ActionContext`.** Does the engine keep it inside the state
    or the session, or does the host entry keep it?
  - **How much of `BoardScene` moves.** The minimum is what the protocol
    needs. Whether the remaining post-combat advance and elimination
    bookkeeping (`CLAUDE.md`) moves too is for the spec to decide.
  - **The deploy function's input.** It could take a purchased army plus
    hexes, the `aiSetup` shape, or both.
  - **Phasing.** The spec may split this into phases with separate plans:
    deploy, then the questions, then the entry.

## Assumptions I made

- **One intent for step 1 only,** as the owner chose. Steps 2 and 3 of §70's
  proposal become their own intents once this lands. When §71 is merged they
  can record this one in `blocked_by`.
- **Type: feature,** not refactor. The entry point, the deploy function and
  the question/answer API are new behaviour for a host, even though the
  web game's play must not change.
- **`review_tier` left empty.** The path table decides it. It rises to
  Reviewed if the save format or history is touched, which the spec will
  know.
- **The id is 72,** from `npm run queue -- --next-id`.
- **`plan-history.md` is not edited here.** §70's intent asks for a
  `plan-history.md` entry with its result. That belongs with closing §70, and
  the owner hasn't asked for it yet.
