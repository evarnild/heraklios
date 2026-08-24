# Heraklios Plan History

This file holds every fully-written-up postmortem, shipped-feature design
brief, and archived backlog note that used to live inline in `plan.md`,
split out on 2026-08-16 because `plan.md` had grown past 3,200 lines and the
live rules/queue/backlog content was getting hard to find underneath it.

**This file is an archive, not the queue.** For current status, always start
at [`plan.md`](plan.md#10-sequenced-queue)'s Current Queue — its History Map
links into specific sections here for context. Section numbers below are
unchanged from their original place in `plan.md`, so old links/citations
elsewhere in the repo (agent files, commit messages) that say "plan.md §N"
for one of these sections should now be read as "plan-history.md §N" — see
`plan.md`'s own History Map for the current cross-reference table.

Nothing in this file is edited going forward except to append new
postmortems as work in `plan.md` ships or fails review; the historical
content itself (what happened, what a review found, why a decision was
made) is not rewritten after the fact.

---

## 2. History archive

Completed feature sections stay below for context and postmortems. They are
not the active queue; use [Current Queue](plan.md#10-sequenced-queue) for that.

### 2.1 Feature A launch goal

Historical archive: this was the goal for Feature A, the first full
implement → review run recorded in this plan.

Implement Feature A in its own git worktree, so the agent's edits couldn't
collide with anything else in flight, then review and merge it by hand.

This reused the same implement → verify pipeline the earlier batch ran
successfully — just for a single feature instead of several in parallel.

---

## 3. Feature: cavalry charges + the phalanx restriction

Historical archive: this was the Feature A implementation brief. It stays in
the plan because later reviews and bugs still refer back to the decisions
made here.

> README: *"Cavalry charges (doubling attack value when a cavalry unit uses
> its full movement in a straight line into contact) and the restriction
> that cavalry can never attack phalanxes are not implemented."*

- **Files:** `engine/combat.ts`, `engine/movement.ts`, `engine/state.ts`,
  `scenes/BoardScene.ts`
- **Unit ids involved:** `cavalerie-legere`, `cavalerie-lourde`, `phalanges`
- **Design problem to solve first:** `reachableHexes` returns only
  `Map<hexKey, cost>` — it records *that* a hex is reachable, not *how* the
  unit got there. Charge eligibility needs "arrived in a straight line
  having spent its full movement", so this needs either path reconstruction
  in the movement engine or a field on `Unit` (e.g. `chargedThisTurn`) set
  at move time in `BoardScene` and cleared each turn. **The agent should
  decide and justify this, as it's the crux of the feature.**
- The phalanx half is simpler by comparison: per the rulebook, cavalry may
  **never** attack a phalanx unit, neither as a charge nor as an ordinary
  attack (double-checked against
  [`docs/research/05-rules-french-original.md`](docs/research/05-rules-french-original.md) —
  "la cavalerie ne peut effectuer de charge ou plus simplement d'attaques
  contre ces unités"). This is one condition in whatever builds valid attack
  targets, not a special combat-resolution case.

---

## 3b. Early backlog notes

Historical archive: these were the first backlog notes captured during the
Feature A run. The current ordered backlog lives in [Current Queue](plan.md#10-sequenced-queue).

### From the README's "Known simplifications"

Not scheduled — each is either a large redesign or effectively unreachable
today:

- **Path-drawn naval movement** (replacing destination-click) — would
  rewrite the naval movement UI and collide with anything else touching
  `BoardScene`.
- **Ramming contact detection along arbitrary paths** — depends on the
  above.
- **Non-galley ships forced into coastal fringe** — currently unreachable,
  as nothing in the game can involuntarily move a ship.
- **Hand-redrawn map terrain** — a data task for the map editor, not code.

### AI player, later stages

Historical archive — this was the original sketch of both stages, written
before either existed. **Stage 3 has since shipped** (`a2a1329`; see
[§6.4](#64-stage-3-shipped-stage-4-deferred) and
[§6.9](#69-stage-3-outcome), which records where the sketch below held up
and where it didn't). Stage 4 is still open. Both were gated at the time on
stages 1–2 landing and the fuzz harness running clean:

- **Stage 3 — `HeuristicAgent`** — exact-EV combat selection over the CRT
  plus scored movement (charge geometry, defensive terrain, ZOC avoidance).
  Cheap *only* once the stage-1 action layer exists; difficulty tiers
  (random → greedy → EV-weighted → shallow lookahead) fall out nearly free.
- **Stage 4 — player-facing AI support** — per-seat Human/AI + difficulty
  config on the Menu screen (`ui/session.ts`), turn pacing/animation so AI
  moves are legible, and persisting AI seats in the save format (implies a
  `SAVE_VERSION` bump).

### Raised by the AI planning work

- **Injectable RNG throughout** — ~~`rollDie` calls `Math.random()`
  directly~~. **Done for the die**: Stage 1 landed `engine/dice.ts` and
  `BoardScene.rollDie` (`:724`) now takes an injectable `rng` defaulting to
  `Math.random`, with `applyAction` fed by `diceRng` (`:180-197`). Still
  worth auditing for other direct `Math.random()` uses, following
  `shuffleSeatOrder`'s existing injection convention.
- **`BoardScene` decomposition** — at 2040 lines it is the repo's largest
  file and, by convention, its least tested. Stage 1 extracts the movement
  and combat orchestration; the retreat/drift/advance prompt machinery and
  the naval ram/board UI are the obvious follow-on candidates if the first
  extraction goes well.

<!-- Add new feature ideas below this line. -->

---

## 5. Outcome

Historical archive: this is the Feature A postmortem.

The implement → verify loop ran twice before merge, not once — worth
recording since it validates why the process calls for an *adversarial*
reviewer rather than trusting the implementer's self-report.

**Design decision:** the implementer chose option (b) from [§3](#3-feature-cavalry-charges--the-phalanx-restriction) —
no path reconstruction in `reachableHexes`. Instead, `movement.ts` gained an
independent `straightLineMoveCost`/`straightLineDirection` walk that
recomputes cost from the unit's pre-move hex straight to the exact clicked
destination, called from `BoardScene.ts` right before a move commits.
Reasoning: there's no click-by-click path to reconstruct in the first place
(`BoardScene`'s movement UI is a single click to a destination via
`reachableHexes`'s cheapest-cost map), and BFS tie-breaking would only
recover one arbitrary shortest path per hex, not necessarily a straight one.
"Full movement allowance" was read literally — `unit.movementLeft` must equal
the unit's full printed `movement` stat *before* the move (i.e. this must be
its first move of the phase) and the straight-line cost must exactly equal
it.

**First review pass — FAIL, two real defects:**

1. **HIGH: phalanx restriction bypassable in multi-defender combat mode.**
   `cavalryMayAttack` was only checked per-attacker inside `validTargets`;
   the multi-defender group-join path (`unionValidTargets` — "reachable by
   at least one unit in the group") didn't re-check it across the whole
   attack group. Concrete exploit: build the attack group with a non-cavalry
   unit first (so the phalanx becomes a valid target via that unit's
   reachability), then add cavalry — the charging cavalry could land a
   doubled attack against a phalanx, the exact thing the rule forbids.
   Single-defender mode was unaffected. Fixed by making `attackerCanJoin`/
   `defenderCanJoin` check the *candidate against the entire opposite group*,
   not just the unit initiating the join.
2. **MEDIUM: a charge could be granted without actually spending the unit's
   full movement allowance.** The charge eligibility check validated against
   the straight-line cost, but `BoardScene.ts` deducted the *cheapest-path*
   cost from `reachableHexes` — different numbers whenever a detour around a
   river surcharge was cheaper than the straight line (confirmed on ~30 real
   hex pairs on the shipped map). Fixed by having `evaluateCharge` return the
   straight-line cost itself (`number | null`) and deducting that on a
   charge instead of the cheaper cost.
3. **MEDIUM (housekeeping): a design-note comment in `saveGame.ts` recorded
   a save/load behavior for the new `Unit.charged` field that turned out to
   be factually wrong** (charges do round-trip through save/load; only
   pre-feature saves, which contain no charges, load the field as
   `undefined`). Corrected, with a real round-trip test added.

Both rule-fidelity defects were reachable via the normal game UI and were
missed by the implementer's own (happy-path) tests, which is the case this
process is designed to catch.

**Second review pass — PASS**, with one **LOW cosmetic** finding: the
multi-defender target highlight still painted a phalanx as "eligible" in a
mixed cavalry+infantry attack group (it used `unionValidTargets` directly,
without the new group-level check), producing a misleading rejection message
on click even though the rule itself was already correctly enforced. Fixed
in a follow-up commit (highlight now filtered through `defenderCanJoin`,
plus a phalanx-specific rejection message) and merged without a further
review pass, since it was UI-only with no `GameState` shape change.

**Final:** 7 commits on `feat/cavalry-charges`, merged to `main` with
`--no-ff`, `tsc --noEmit` and `vitest run` (169 tests) green post-merge,
pushed to `origin/main`. Branch and worktree cleaned up after merge.

---

## 6. Next: AI player

**Status:** stages 1, 2a, 2b, 2c and 3 **✅ shipped** (merged `9cb7ed7`,
`469f84a`, `7544a96`, `0e54b59` and `a2a1329`). **Stage 2 is complete.**
**Stage 4 is ✅ shipped** (merged `556fbf8`,
[§6.12](#612-stage-4-outcome)). Only the optional **stage 3b** (shallow
lookahead) is still unstarted.

The original scope note said stages 3–4 were deferred "until the foundation
is proven." The foundation was proven, stage 3 came in on it, and for six
days the position was that **the AI existed, played well, and was reachable
from nothing but the test suite** — see
[§6.4](#64-stage-3-shipped-stage-4-deferred) and
[§6.9](#69-stage-3-outcome). Stage 4 is what closes that gap: any seat can
now be given to the computer from the Menu.

> **Stages 2b and 3 shipped in parallel and were merged together on
> 2026-08-08.** They were queued as sequential items and developed against
> the same merge base, colliding in `fuzzHarness.ts`, `agent.ts` and this
> file. The textual conflicts were small; the ones that mattered were
> semantic and invisible to git — see [§6.10](#610-the-2b3-parallel-merge).

### 6.1 What the codebase already provides

The engine's *query* surface is close to an action-enumeration API already,
and every function below is pure and tested:

- `reachableHexes`, `reachableNavalStates`, `findRammingContacts`,
  `evaluateCharge` — candidate moves
- `validTargets`, `commonValidTargets`/`unionValidTargets`,
  `attackerCanJoin`/`defenderCanJoin` — candidate attacks, with group
  legality (including the cavalry/phalanx rule) already enforced
- `legalRetreatHexes`, `pushCandidates`, `checkRangedEligibility`,
  `hexesUnderZoc` — the post-combat decision space

The *apply* half exists too: `applyLandCombatResult`, `retreatUnitTo`,
`completePush`, `applyExchangeSacrifice`, `applyRammingResult`,
`applyBoardingResult`, `advancePhase`.

Two properties worth building around:

1. **The CRT is exactly solvable, not merely simulatable.**
   `describeLandAttack(attackers, defenders, dieRoll)` is pure and the die is
   1–6, so any candidate attack grouping can be evaluated across all six
   faces for an *exact* outcome distribution over AE/AR/DE/DR/EX. A strong
   combat AI needs no rollouts or sampling — this is what makes stage 3
   cheap, and it's why the foundation is the expensive part, not the
   strategy.
2. **`BoardScene`'s prompts are already continuation-shaped.**
   `beginUnitRetreatChoice(unit, onDone)`, `beginAdvanceOffers(vacatedHexes,
   attackers)`, and `promptExchangeSacrifice(...)` are each "pending decision
   + callback". Converting them into an agent-facing decision interface is
   closer to rehoming than redesign.

### 6.2 What actually blocks an AI

> **Historical — this is the pre-Stage-1 analysis, and Stage 1 fixed the
> first and third bullets.** Retained because it is *why* the stage exists
> and because the second bullet is still substantially true. Do not chase the
> line numbers; the code they described is gone. Current state noted per
> bullet.

The engine is pure *calculation*; the **orchestration lives entirely in
`BoardScene`** (2040 lines), which is exactly the layer this repo
deliberately does not unit-test:

- ~~**Movement is not an engine operation.**~~ **Fixed by Stage 1.**
  `BoardScene` no longer performs `movementLeft -= cost; position = hex;
  charged = ...` inline — every click handler commits a whole `Action` via
  `applyAction` (`BoardScene.ts:836`).
- **A land attack is not atomic.** *Still true.* `resolveGroupAttack`
  (`BoardScene.ts:1662`) rolls, applies the result, then branches into UI
  prompts for exchange sacrifice, retreat, drift, and advance-after-combat.
  An AI must answer those mid-resolution questions too — "pick a move" is not
  a sufficient interface. Stage 1 gave those questions a typed home
  (`PlayerAgent`), but the drift and advance branches still mutate
  `GameState` inline in the scene — see
  [§6.7](#67-the-elephant-problem-stage-2-split) and
  [§9.1](#91-post-combat-advance-ignores-terrain-restrictions).
- ~~**The RNG is not injectable.**~~ **Fixed by Stage 1.** `engine/dice.ts`
  landed; `rollDie` (`BoardScene.ts:724`) takes an `rng` parameter and
  `applyAction` is fed by `diceRng`, following `shuffleSeatOrder`'s
  convention.

So the work is not "write an AI" — it is *extracting a headless action
layer*, after which the AI itself is comparatively small.

### 6.3 Committed scope: stages 1–2

**Stage 1 — headless action layer. ✅ Shipped** — merged to `main` as
`9cb7ed7` on 2026-08-04 (5 commits, 206 tests, tsc/build clean). Landed
`engine/actions.ts`, `engine/agent.ts` (`PlayerAgent` + `ActionObserver`),
`engine/dice.ts`, and rehomed `BoardScene`'s movement/attack/ram/boarding/
end-phase mutations. Two HIGH defects were caught in review and fixed before
merge — see [§6.6](#66-stage-1-outcome). Original spec follows.

New `engine/actions.ts` exposing
`legalActions(state)` and `applyAction(state, action, rng)`, where apply
either completes or returns a *pending decision* for a caller to answer.
Move the mutation sequences listed in [§6.2](#62-what-actually-blocks-an-ai)
out of `BoardScene` into it, and thread an injectable RNG through the die
rolls. Plus `engine/agent.ts` defining the one interface both a human and a
bot satisfy:

```ts
interface PlayerAgent {
  chooseAction(state, legal: Action[]): Promise<Action>;
  chooseRetreat(state, unit, options: HexCoord[]): Promise<HexCoord>;
  chooseAdvance(state, unit, vacated: HexCoord): Promise<boolean>;
  chooseExchangeSacrifice(state, attackers, requiredForce): Promise<Unit[]>;
}
```

`BoardScene` then becomes a renderer plus an input adapter implementing
`PlayerAgent` via its existing prompts — hotseat and AI stop being separate
code paths. **This stage must be behavior-preserving**: no rule changes, the
existing 169 tests stay green, and the scene plays identically by hand.

**Stage 2 — `RandomAgent` + self-play fuzz harness.** A trivial agent
picking uniformly from `legalActions`, driven by a headless harness that
plays thousands of seeded games in tests and asserts invariants (no unit on
an illegal hex, no negative `movementLeft`, no cavalry ever resolving an
attack against a phalanx, turn order preserved, games terminate).

**Stage 2 is the point of this scope.** It is a bug-finding tool in its own
right — a defect class that reaches review precisely because hand-written
tests follow happy paths. It also validates the stage-1 abstraction under
load before any strategy code depends on it.

> **Correction (post-2a).** An earlier version of this paragraph claimed the
> harness "would very likely have caught the multi-defender phalanx bypass
> from [§5](#5-outcome)". **That was wrong, and it was this plan's claim, not
> the implementer's.** `legalActions` enumerates *singleton* attacks only
> (`actions.ts:356-367`), so the harness structurally cannot assemble a
> combined attack group — the bypass required exactly that. Measured over
> 100 seeded games: `multiAttacker: 0`, `pushTarget: 0`, `exchangeChoice: 0`.
> See [§6.8](#68-stage-2a-outcome) for what 2a does and does not cover.

<a id="64-stage-3-shipped-stage-4-deferred"></a>

### 6.4 Stage 3 shipped; stage 4 deferred

- **Stage 3 — `HeuristicAgent`. ✅ Shipped** as `a2a1329`. Landed
  `engine/combatOdds.ts` (exact CRT distributions + an expected-value model)
  and `engine/heuristicAgent.ts`, plus per-seat agents in the fuzz harness.
  Outcome and postmortem: [§6.9](#69-stage-3-outcome). Original spec:
  "exact-EV combat selection over the CRT (see
  [§6.1](#61-what-the-codebase-already-provides)) plus scored movement
  (advance on weak high-value targets, seek charge geometry, prefer
  defensive terrain, avoid ZOC traps). Difficulty tiers fall out nearly
  free: random → greedy → EV-weighted → shallow lookahead."

  Three of those four tiers shipped. **"Nearly free" was right for three and
  wrong for the fourth** — see §6.9. "Avoid ZOC traps" split in two: ZOC
  avoidance shipped and is tested; *retreat* traps were implemented, found
  unreachable, and removed.

- **Stage 4 — player-facing. ✅ Shipped** as `556fbf8`. Landed
  `engine/seatControl.ts` (the `'human' | 'ai-random' | 'ai-greedy' |
  'ai-ev'` union + `createSeatAgent`), `engine/seatRouter.ts`'s
  `routeBySeat`, `ui/aiSetup.ts` (an AI seat's army and deployment),
  `session.seatControls` + the Menu's per-seat button, `SAVE_VERSION` 2 with
  a version-1 migration, and `BoardScene`'s driver loop. Outcome and the
  three decisions it forced: [§6.12](#612-stage-4-outcome). Original spec:
  "per-seat Human/AI + difficulty config on the Menu screen
  (`ui/session.ts`), turn pacing/animation so AI moves are legible rather
  than instant, and save-format support."

- **Stage 3b — shallow lookahead**: the fourth tier, queued separately (#6)
  rather than folded back into stage 3. Reasoning in
  `heuristicAgent.ts`'s header, summarized in §6.9. **In flight** on
  `codex-stage-3b-lookahead`, not yet merged — see
  [§6.13](#613-stage-3b-outcome).

### 6.5 Decisions to make before starting

- **`BoardScene` refactor blast radius** — settled for Stage 1: it landed as
  its own reviewed branch with no AI code riding along, and review confirmed
  no behavioral regression. Still the main risk for any future extraction
  (drift cascade, post-combat advance).
- **Undo/redo semantics with an AI seat.** A die roll clears the history
  stack, and an AI turn contains many rolls. Likely resolution: undo rewinds
  past the AI's *entire* turn rather than into the middle of it — but this
  needs deciding, not defaulting. **Settled in Stage 4, and neither option
  was the answer**: undo has always been *phase*-scoped (`endPhase` clears
  the stack), so it has never crossed a seat handoff in the first place. An
  AI turn needed no new rule — only a guard making undo/redo unavailable
  *during* it, which is what `BoardScene.undo` now says in place of this
  question.
- **Save format.** Which seats are AI must persist or loading a game silently
  turns them human; that implies a `SAVE_VERSION` bump and updates to
  `engine/saveGame.ts` + `ui/saveStorage.ts`. **Settled in Stage 4**, with a
  correction to the reasoning: the bump is NOT needed to read the field
  (an absent `seatControls` is exactly an all-human game, so version 1 files
  migrate cleanly and still load). It is needed for the *forward* direction —
  an older build must refuse a version-2 file rather than half-read it and
  hand the computer's army to the player. Stage 1 left this unforeclosed: `GameState`'s shape is unchanged,
  and `ActionContext` mirrors the existing `SavedGame`/`GameState` split
  rather than creating a new one.

### 6.6 Stage 1 outcome

Merged as `9cb7ed7`. The implement → verify loop ran twice, and the review
caught two defects that the 202-test green suite did not:

- **HIGH: `applyAction({kind:'endPhase'})` never refilled movement.** The
  refill lived only in `BoardScene`, so a headless caller got `advancePhase`
  without it. After turn 1 every unit sat at `movementLeft === 0`,
  `legalActions` returned only `endPhase` forever, and **Stage 2's fuzzer
  would have reported clean while exercising nothing** — the worst available
  failure mode for a test harness. Fixed by moving the refill into
  `applyAction`.
- **HIGH: `chooseAction` violated the contract it type-claimed.** It resolved
  *after* `applyAction`, so any driver written to the documented interface
  (`const a = await agent.chooseAction(...); applyAction(state, a)`) would
  double-apply every action. Fixed by splitting `ActionObserver` out of
  `PlayerAgent`, so the misleading signature is gone from the type system
  rather than merely from the docs.

Plus four MEDIUMs, of which two are worth remembering as patterns:
`legalActions`' `context` was *optional* despite its omission producing
illegal actions (now required); and the charge regression test ran along an
all-plain hex row where both cost models agree, so it could not have detected
a revert of the fix it appeared to guard (now uses a divergent pair, and was
mutation-tested).

**Verification that worked, worth reusing:** the reviewer wrote a throwaway
driver playing full turns through `legalActions`/`applyAction` alone, then
*deleted the fix* and re-ran it — movement died after turn 2 and no attack
ever occurred. A unit test asserting "`movementLeft` is non-zero" would have
passed in both cases. Mutation-testing a regression guard is now the expected
bar for this project, not an extra.

**Known gap carried into Stage 2:** the elephant drift/trample cascade was
not extracted in Stage 2a, so a headless caller could not resolve
`outcome.pendingDrifts`. Stage 2b replaced the scene-owned closure cascade
with `engine/drift.ts`'s explicit drift state machine; Stage 2c then made
ordinary seeded self-play include elephants ([§6.11](#611-stage-2c-outcome)).

### 6.7 The elephant problem: Stage 2 split

**Status: ✅ Shipped, all three sub-stages.** 2a `469f84a`, 2b `7544a96`,
2c `0e54b59` (see [§6.11](#611-stage-2c-outcome)). Verification of 2b on its
branch: `npm.cmd test -- src/engine/fuzzHarness.test.ts src/engine/drift.test.ts`,
`npm.cmd run build`, `git diff --check`, and `npm.cmd test` (302 passed,
1 planned Stage 2c skip).

`pendingDrifts` is populated **only** for elephants (`combat.ts:526`), so
excluding them provably keeps it empty — the exclusion is verifiable, not
approximate. But `defaultArmySelection()` puts **3 elephants** in a standard
army (`army.ts:68`): they are not an exotic corner case, they are in the army
people actually play.

Decided approach — split Stage 2 rather than choosing between the extremes:

| Sub-stage | Work |
| --- | --- |
| **2a** | Fuzz harness, elephants excluded from generated armies, with a *loud* guard (below). |
| **2b** | Extract drift as a pure **step function**, using 2a's harness as the safety net. |
| **2c** | Enable elephants in the harness; delete the guard and the skipped test. **✅ Shipped `0e54b59`** — see [§6.11](#611-stage-2c-outcome). |

**Why this order.** The fuzz harness is a *test tool for refactors*.
Extracting drift first means reviewing another gnarly `BoardScene` change by
hand — and on Stage 1 that approach found two HIGH defects yet still missed
things until someone actually wrote a driver ([§6.6](#66-stage-1-outcome)).
Doing the hardest refactor first discards the very tool built to make hard
refactors safe.

**Stage 2a exclusion status — now historical.** In Stage 2a the exclusion had
to fail loudly: the harness threw if `outcome.pendingDrifts` appeared and
carried a skipped test so the elephant gap printed on every run. Stage 2b
replaced that guard with `processDrifts`, and Stage 2c removed the exclusion
itself along with the skipped test and the `[fuzz] GAP:` line. The default
soak now reports `driftsResolved=148 driftCombatsResolved=65`, both asserted
rather than merely printed.

#### What 2b actually has to solve

An earlier sketch of this plan proposed a simple
`driftStep(state, elephant, dieRoll)` returning "moved / hit / eliminated".
**Reading the real cascade, that is too optimistic** — recording the
correction here so 2b doesn't get under-scoped the way it nearly was.

The original scene `stepDrift` was the easy half: walk one hex, eliminate
off-map (`canElephantEnterHex`), advance into empty hexes, else hand off to
`resolveDriftHit`. That part genuinely is a pure step function.

The original scene `resolveDriftHit` was the hard half. It rolled a die, resolved a real
combat, and branches five ways:

| Result | Behavior |
| --- | --- |
| `AE`/`EX` | Elephant destroyed; cascade ends. |
| `AR` | Elephant repelled and **re-drifts in a newly rolled direction** (recurses into `beginDrift`). |
| `DE` | Elephant advances into the hex and keeps drifting. |
| DR, occupant is an elephant | Occupant **drifts recursively**, with a *forbidden direction* so it can't drift back into its trampler. |
| `DR`, occupant is anything else | Occupant needs a **retreat choice - a live `PlayerAgent` decision** before the original elephant may continue. |

So a drift can contain a nested drift, a nested *player decision*, and an
unbounded chain of both.

**The real blocker is not the rules — it is that the continuation lives in
closures.** `continueAfterVacated` captured the drift and had to
re-assign `this.driftState` on resume "because a nested choice/drift may have
taken over"; `finishDrift` fired a captured `onComplete`. A headless caller
cannot enter a JS closure stack.

The correct shape is therefore the **same pending-decision pattern
`applyAction` already uses**, with the continuation made explicit and
serializable instead of implicit in closures:

```ts
type DriftEvent =
  | { kind: 'moved'; to: HexCoord }
  | { kind: 'eliminated'; unit: Unit; reason: 'off-map' | 'combat' }
  | { kind: 'needsRetreatChoice'; unit: Unit; options: HexCoord[] }
  | { kind: 'done' };

// `drift` is an explicit resumable stack, not a closure chain.
driftStep(state, drift: DriftState, rng): DriftEvent
```

The scene keeps its animation loop and pumps this; the harness pumps the same
function, answering `needsRetreatChoice` via its agent. Nested drifts become
frames pushed onto `DriftState`, not recursive calls.

This is a larger job than the original sketch implied — but it is still far
smaller than lifting the whole cascade into `applyAction`, and converting
closure-continuations into an explicit stack is the *only* part that is
strictly required to make drift fuzzable.

### 6.8 Stage 2a outcome

> **This section was referenced from [§6.3](#63-committed-scope-stages-12)
> but never written** — caught in the 2026-08-07 integrity pass. Filled in
> from the merge commit and a fresh soak run rather than from memory.

Merged as `469f84a` on 2026-08-05. Landed `engine/rng.ts` (a seeded LCG),
`engine/randomAgent.ts`, and `engine/fuzzHarness.ts` with continuously-checked
invariants plus a 100-seed soak test.

**It paid for itself immediately — two real engine bugs, both live in
hotseat play:** `legalRetreatHexes` and `pushCandidates` never consulted
`canEnterTerrain`, so a forced combat retreat could land cavalry, chariots or
elephants on steep-flank or marsh terrain. The reading was confirmed against
`05-rules-french-original.md:186-188` and `:239-241` (the N.B. puts "la mer
n'est pas accessible" in the same sentence as the steep-flank and marsh
prohibitions), and the pre-fix behavior — sea blocking retreat but steep
flanks not — was the inconsistent one. Consequence pinned by test: cavalry on
hex **(4,9)**, a plateau ringed by six steep-flank hexes and the shipped map's
only terrain-boxed hex, is now eliminated by an AR/DR where it previously
retreated.

**What the soak actually exercises** (re-measured 2026-08-14 on `main` after
[§15](#15-live-defect-ranged-attacks-resolve-at-zero-attack-force), 100
seeds):

```
100 games, 9209 total actions (avg 92.1/game)
actionsByKind: landMove 3177, endPhase 2800, navalMove 2118, navalRotate 545,
               landAttack 557, board 6, ram 6
combatResultCounts: DR 317, AR 195, DE 19, EX 20, AE 6
landAttacksResolved=557  ramsResolved=6 (hits=1)  boardingsResolved=6
turnsReached: min=8 max=8 avg=8.0
outcomes: 100 decisive, 0 draws — all 100 by turn-limit/army-value ending
```

The pre-§15 numbers, for comparison, were 9043 actions and
`DR 306, AR 178, AE 28, EX 21, DE 18`. **AE fell 28 → 6**, which is the fix
visible in aggregate: the harness fields `p1-archers` (plain archers), and
every volley they fired used to resolve on the 1-5 column, five of whose six
faces eliminate the attacker.

**What it does *not* cover** — the part that matters when reading a green
run:

- ~~**Elephants**~~ — **closed by Stage 2c** (`0e54b59`,
  [§6.11](#611-stage-2c-outcome)). The exclusion, the throwing guard and the
  `[fuzz] GAP:` line are all gone; the numbers above are the last ones
  measured before it, and the soak now reads `driftsResolved=148
  driftCombatsResolved=65` with 722 land attacks.
- **Combined attacks** — `legalActions` enumerates singleton attacks only
  (`actions.ts:356-367`), so `multiAttacker` is structurally 0. This is why
  the harness could not have caught [§5](#5-outcome)'s multi-defender phalanx
  bypass, corrected in §6.3. **Closed by Stage 3**, which is the only way it
  could have been: the *enumeration* is still singleton-only, but
  `HeuristicAgent` assembles groups itself and hands them to `applyAction`
  (the escape hatch `legalActions`' own doc comment sanctions), so
  `heuristicSoak.test.ts` now reaches 28 combined attacks in 12 games where
  a `RandomAgent` control over the same seeds reaches 0. (It was 12; §15 more
  than doubled it, because an archer that can actually hurt something is
  worth adding to a group.) This soak's own number stays 0 forever and is
  now printed with a pointer, per §6.9.
- **Pushes and exchange sacrifices** — `pushTarget: 0` and
  `exchangeChoice: 0` across 100 games with the default armies. §12's branch
  adds a dedicated scenario to reach a push at all.
- **Naval combat is barely sampled** — 5 rams (1 hit) and 6 boardings in
  9043 actions. Treat naval invariants as effectively unfuzzed.
- **Anything scene-side.** The harness mirrors `BoardScene`'s sequencing
  *independently*; it cannot see a scene-only regression. This is exactly how
  [§9.1](#91-post-combat-advance-ignores-terrain-restrictions) survived on
  `main` before `feat/advance-terrain`: the harness enforced advance terrain
  via `eligibleAdvanceCandidates` while the scene did not.
- ~~**Every game ends the same way**~~ (turn limit at turn 8, 0 mutual
  eliminations) — **incidentally closed by Stage 2c**, which added two units
  and with them the first mutual-elimination ending (1 of 100). Long games
  remain untested.

### 6.9 Stage 3 outcome

Merged as `a2a1329`. Landed `engine/combatOdds.ts`,
`engine/heuristicAgent.ts`, `ActionChooser`/`DrivingAgent` in `agent.ts`,
per-seat agents (`createAgent` + `SeatAgentRouter`) in the fuzz harness, and
three new test files. 333 tests (was 288), `tsc` and `npm run build` clean.

**Behavior-neutrality was proven, not asserted.** The harness gained a
per-seat indirection that every existing `RandomAgent` run now passes
through, so the 100-seed action trace was hashed before and after and in a
separate worktree at the merge base: **byte-identical**. Worth reusing —
this is the second branch (after [§11](#11-combat-reporting-detail)) where a
trace hash turned "I don't think I changed anything" into evidence.

**What "difficulty tiers fall out nearly free" actually bought.** Three
tiers, yes: `'random'` is a real delegation to `RandomAgent` (so the easiest
AI and the fuzz driver are provably the same code), `'greedy'` scores an
attack by expected *enemy* loss alone, `'ev'` by expected net swing. The
fourth — shallow lookahead — is **not** nearly free, and this is the
plan's own estimate being wrong rather than the implementer under-delivering:
a ply needs a cloned `GameState` (`history.ts` deliberately doesn't provide
one), an answer for every mid-resolution decision the clone provokes, an
opponent model, and a performance budget against a `legalActions` that
re-runs a `reachableHexes` BFS per unit per call. Queued (last in the
queue) with that
reasoning recorded in code rather than stubbed.

**Strength, measured seat-controlled.** ~3x a `RandomAgent`'s surviving army
value from either seat; ahead of `'greedy'` in both seats compared like for
like. Measuring this correctly took two attempts and the correction is the
useful part: `winnerId` is a bad metric here because
`endGameByTimeLimit` awards a tied army value to the lower seat, *and*
because moving first is worth a great deal once a side plays well at all
(two EV agents finish 35.8 to 6.7 where two random agents finish 30.4 to
32.1 — the first-move advantage is created by good play, not baked into the
position). The tests compare surviving army value with the seat held
constant.

> **Superseded by [§15](#15-live-defect-ranged-attacks-resolve-at-zero-attack-force)
> (2026-08-14).** Re-measured over the same 12 seeds once volleys resolved at
> the archer's projectile value: EV-vs-EV is now **23.3 to 16.3, wins 7-5**
> (was 35.8 to 6.7, wins 12-0), and EV-vs-`RandomAgent` widened to **~3.5x**.
> The seat-controlled *ordering* every test asserts is unchanged; what moved
> is the first-move advantage, which shrank from ~5:1 to ~3:2 because the
> second seat can now shoot back. The methodological point above stands — it
> is the numbers, not the reasoning, that were roster-dependent.

**A modelling bug caught before it reached the soak:** charging the
retreat "tempo" penalty per *unit* makes an attack score worse the more
attackers join it, so an EV agent using it declines every combined attack
and, at ratios of 2:1 and up, nearly every attack at all. It is charged once
per *side* now, with the reasoning at `RETREAT_TEMPO_VALUE`. Found by
working the arithmetic on a three-unit group by hand, not by testing.

**Review: FAIL, then fixed.** The implementation was sound — the reviewer
re-derived the trace hash, the combined-attack legality argument, the ship
pro-rating, the cache-staleness question and the strength margins, and all
held. What failed was the *test* half, in the way this project keeps
finding:

1. **HIGH — two guards that guarded nothing.** The `attackerCanJoin` gate
   could be deleted outright with the whole suite green: `legalActions`
   filters cavalry-vs-phalanx itself, so the gate's loop never ran, and the
   test named for it landed in a branch that only re-asserted `endPhase`.
   Worse, the *seed* attacker was never gated at all. There is now one gate
   covering seed and additions, reached by a test that hands the agent a
   deliberately malformed `legal` list. **The first rewrite of that test was
   vacuous too** (the attack scored negative and was declined either way) —
   caught only by re-running the deleted-gate mutation, which is the whole
   argument for [§6.6](#66-stage-1-outcome)'s bar.
2. **MEDIUM — the entire risk-aware movement half survived deletion.**
   `terrainDefense` and `zocPenalty` now have discriminating tests with
   controls. `retreatTrapPenalty` was **removed instead**: a destination is
   only a death-trap if its neighbours are occupied, ZOC-covered or
   impassable — the same neighbours a unit must move *through* to arrive —
   so the ZOC stop rule makes it unreachable. Probing the shipped map for a
   counter-example (peninsula tips, the (4,9) steep-flank box) found none.
   An untestable scoring knob is worse than no knob.
3. **MEDIUM — three worked examples wrong**, one of them the exact
   [§11.3](#113-ramming--show-the-roll-needed-which-is-already-computable)
   failure mode (a CRT citation of "1-3 column, three faces of AE" for what
   is really 1-5 with five), and two stale soak measurements.
4. **The legality oracle was a tautology.** `assertChosenActionIsLegal`
   asked whether every attacker had a legal singleton in `legal` — the very
   set the agent drew the group from, so it could not fail for the agent it
   polices. It now re-derives the pairing rule from `state` via
   `attackerCanJoin`, keeping the `legal` lookup only for the one question
   the board can't answer ("has this unit already attacked this phase?").

Final mutation sweep: 9 of 9 killed.

**Found on the way, not fixed here:**
[§15](#15-live-defect-ranged-attacks-resolve-at-zero-attack-force).

**Carried forward — ✅ now closed by Stage 2c (`0e54b59`).** This section
recorded that the AI had never played a game containing an elephant, which
mattered more than a coverage gap sounds: `defaultArmySelection()` puts three
elephants in a standard army, so the first human to play the AI would have
handed it a unit type no test had ever given it. `heuristicSoak.test.ts`
builds from `buildFuzzGameState`, so putting an elephant on each side there
closed it for free. Stage 2c also falsified this section's strength figures
in the process — see [§6.11](#611-stage-2c-outcome).

<a id="611-stage-2c-outcome"></a>

### 6.11 Stage 2c outcome

Merged as `0e54b59`, completing Stage 2. Elephants went into
`buildFuzzGameState()` (one per side, started adjacent) *and* got a
purpose-built `buildElephantScenarioGameState()`, rather than one or the
other — the default army makes drifts part of ordinary self-play, the
scenario makes a drift *combat* deterministic. 374 tests (was 366) and,
for the first time since Stage 2a, **0 skipped**: the `it.skip` queue
marker and the `[fuzz] GAP:` report line are both gone.

```
driftsResolved        0 -> 148
driftCombatsResolved  0 ->  65
landAttacks         557 -> 722
endings   100 by turn limit -> 99 turn limit, 1 by mutual elimination
```

That last line is a side effect worth noting: [§6.8](#68-stage-2a-outcome)
lists "every game ends the same way, so elimination endings are untested" as
a standing gap, and adding two units to the army closed it incidentally.

**It found a live defect, which is the argument for the 2a/2b/2c split
holding up.** `canElephantEnterHex` rejected only off-map, coast and
sea-like hexes — not **marsh**, which the rulebook's N.B. forbids elephants
unconditionally ("chars, cavaleries et éléphants ne peuvent accéder aux
marais", `05-rules-french-original.md:186-188`). Not a harness artefact:
`BoardScene` pumps the same `driftStep`, so a drifting elephant could land
on marsh in ordinary hotseat play. And not theoretical — reverting the fix
makes the *default soak* throw at action #63 with
`p1-elephant sits on terrain "marsh" it cannot enter`. The reading is
recorded on `canElephantEnterHex`: marsh blocks, and hitting it eliminates
(the rulebook's only two outcomes for a drift step are "moves" and "est
éliminé"), consistent with `legalRetreatHexes`' existing ruling that the
three restrictions in that one sentence apply to forced movement together.

**The review's real finding was a number nobody thought to re-measure.**
`buildFuzzGameState` is `playRandomGame`'s default state, so adding two
units silently falsified every strength figure documented in
`heuristicSoak.test.ts` — and, more quietly, ate an assertion's margin:
`heuristicTotal > randomTotal * 2` went from 76% headroom to **16.7%**.
The cause is the interesting part and generalizes:

> **An elephant is a material floor.** Every other unit type with no legal
> retreat hex is eliminated; an elephant is routed to `pendingDrifts` first
> and drifts instead. Ten points of army value that a badly-played side
> cannot lose lifts the *loser's* floor far more than the winner's ceiling,
> so every ratio compresses without any ordering changing. Visible in the
> mirror matches: random-vs-random rose from totals [375, 405] to
> [480, 435] while ev-vs-ev barely moved.

The floor was left at 2x rather than quietly relaxed, with the reduced
headroom stated at the assertion. **The lesson for the queue is narrower
than "re-measure things": changing a shared fixture is an API change to
every test that reads it.** [§6.10](#610-the-2b3-parallel-merge) already
records the doc-comment version of this; this is the numeric version, and it
was invisible to `tsc` and to a green suite alike.

**Two more prose defects, same family.** A README bullet claimed the AI now
plays elephants in "every scored game" — measured, 0 of the 12 EV-vs-EV
seeds contain a drift (6 of 30). And widening `canElephantEnterHex` widened
the elimination branch behind a *fixed string*, so the combat log narrated
marsh deaths as "drifts off the map or into the sea". The event is now
`eliminatedLeavingLandZone` and names the actual terrain, with a test that
fails on the old wording. Neither would have been caught by any test that
existed; both were caught by review reading the diff's consequences rather
than its lines.

**Mutation sweep: 5 of 5 killed** — revert the marsh fix (killed by the new
pin *and* both soaks), strip elephants from the default army, delete
`forceRetreat`'s elephant branch, unbox the elephant scenario, and drop
marsh from the log narration. The fourth is the informative one: it was
killed by the **deterministic** test only, with the soak still green. That
is the argument for [§12](#12-cascading-push-when-a-unit-cannot-retreat)'s
pairing of a no-dice property test with a seeded soak, now confirmed on a
second path.

### 6.10 The 2b/3 parallel merge

Recorded because [§14.1](#141-first-a-correction-the-constraint-is-partly-self-imposed)
argues the parallelism constraint in this project is partly self-imposed,
and this is the first run that tested that claim against two substantial
branches — and the first real data point on the failure mode §14.1 names as
the one that actually matters.

Stage 2b and Stage 3 were queued as sequential items (#2 and #4) but were
built concurrently from the same merge base and merged on the same day.
They overlapped in `fuzzHarness.ts`, `fuzzHarness.test.ts`, `agent.ts` and
this file.

**§14.1's prediction held, in both directions.** The textual conflicts were
trivial — two import lists and one report-line union, plus this plan's queue
tables. Git handled everything else across ~2,600 and ~1,200 changed lines.
What actually cost time was exactly what §14.1 said would:

1. **A semantic conflict git could not see.** Both branches added fields to
   `HarnessStats`; both merged cleanly; the result did not compile, because
   2b's five new test fixtures build the struct as an object literal and
   knew nothing about Stage 3's two new fields. Caught by `tsc`, which is
   the cheap case — a struct is type-checked. The expensive version of this
   bug is two branches agreeing textually about *behaviour*.
2. **Stale prose that was true when written.** Stage 3 shipped a README
   bullet and a `combatOdds.ts` doc comment both explaining that the AI
   avoids elephants because the drift cascade "can only be resolved by the
   board scene." Stage 2b made that false four days later. Nothing failed;
   no test covers a doc comment. Both were corrected at merge time, and the
   lesson is narrow but repeatable: **when two branches merge, grep the
   incoming one's subject matter across the other's comments**, not just its
   code.

**Cost:** roughly one working session's integration. **Verdict:** cheaper
than serializing the two branches would have been, which supports §14.1 —
but only because the collision was caught deliberately rather than by
whoever next read the README.

---

<a id="612-stage-4-outcome"></a>

### 6.12 Stage 4 outcome

Merged as `556fbf8`. 421 tests (was 411 — six new files' worth of
assertions across `seatControl`, `seatRouter`, `aiSetup` and the save
migration), `tsc --noEmit` clean, `npm run build` clean. **The AI is now
reachable from the UI**, which was the entire point: the strategy layer had
been done and idle since `a2a1329`.

**What landed.** `engine/seatControl.ts` (a flat `'human' | 'ai-random' |
'ai-greedy' | 'ai-ev'` union, `createSeatAgent`, `normalizeSeatControls`);
`engine/seatRouter.ts`'s `routeBySeat`; `ui/aiSetup.ts` (an AI seat's army
and deployment); `session.seatControls` plus the Menu's per-seat button;
`SAVE_VERSION` 2 with `migrateSavedGame`; and in `BoardScene`, the driver
loop (`maybeStartAiTurn`/`runAiSeats`/`applyAiAction`) with `commitRam`,
`commitBoarding`, `commitEndPhase` and `executeLandAttack` split out of the
click handlers so an AI action and a click go through *the same* code.

**Three decisions the stage forced, all of which moved off §6.5's guesses:**

1. **The save bump is for the forward direction, not the backward one.**
   §6.5 assumed persisting AI seats "implies a `SAVE_VERSION` bump" because
   the field is new. By this file's own established precedent
   (`randomizedTurnOrder`, `Unit.charged`) it does *not*: an absent
   `seatControls` is behaviourally identical to all-`'human'`, which is
   exactly what a version-1 file was. So version 1 migrates and still loads.
   The bump earns its keep the other way round — an older build reading a
   version-2 file would silently turn the computer's seats into the
   player's, and the version number is the only thing that can stop it.
2. **Undo needed no new rule at all.** §6.5 expected to choose between
   rewinding into an AI turn and rewinding past it. Neither: undo is
   phase-scoped (`endPhase` clears the stack), so it has never crossed a
   seat handoff, and an AI turn is just another seat's phase. All that was
   needed was a guard while it runs.
3. **Mid-resolution decisions are NOT the active player's.** The one piece
   of genuinely new dispatch logic. `applyLandCombatResult` hands the
   *defender* a retreat while the *attacker* is on turn, so a human
   defending against a computer must still click their own retreat hex, and
   a computer defending against a human must answer for itself. Answering
   either with the active seat's agent would have one side playing both —
   and it is **invisible in a hotseat game**, where the same human answers
   everything regardless. That is why it was extracted into
   `engine/seatRouter.ts` rather than left inline in the scene: it is
   exactly the shape of rule this project keeps finding untested. Its tests
   kill 6 of 6 on mutating the seat lookup to the fallback.

**A hazard worth remembering:** `routeBySeat` reads the seat-agent map
*live*, so `BoardScene` refills that map rather than replacing it. Replacing
it (the obvious `this.seatAgents = new Map()`) would leave the router
pointing at the previous game's agents after a load — silently, and only for
a game loaded over another one. There is a test for exactly that.

**Setup for an AI seat is deliberately crude** and is the one thing this
stage added to the README's "Known simplifications": the computer takes the
default 400-point army and scatters it over legal hexes in its own band
(terrain-respecting, so no cavalry on marsh). Composition and formation are
strategy problems of a different kind from the ones `heuristicAgent.ts`
solves, and picking the *same* army a hurried human picks keeps the
difficulty comparisons in §6.9 meaning what they say.

**One tactical preference was added to deployment on request
(2026-08-15):** cavalry, chariots and heavy infantry are kept off plateaux.
Worth recording precisely, because it is the kind of thing a later reader
will go looking for a rulebook basis for and not find one. **There is no
such rule.** The rulebook's terrain prohibitions are exactly three
(`05-rules-french-original.md:186-188`) and none of them mentions plateaux —
which are legal ground for every land unit, and stay that way in
`canEnterTerrain`. This is deployment *judgement* and lives only in
`ui/aiSetup.ts`: a plateau's benefit is defensive and conditional (+2 only
when attacked from below), so it is wasted on the arms you deploy to move,
and better spent on the archers/phalanxes/elephants that hold. It is a soft
preference — a band with no room left will still put a chariot on a plateau
rather than fail to field the army — and it deploys the constrained units
first for margin. Phalanxes are excluded despite being heavy foot: they are
precisely the unit that wants the ground.

Measured while building it, since the arithmetic is tight enough to matter:
the southern band is the worst case at 44 plateau + 37 steep-flank hexes of
126, leaving 43 plain for the default army's 22 plateau-avoiding units. Three
mutations (preference not applied, ordering removed, preference hardened
into a ban) each killed by their own test. The most-constrained-first
ordering turned out **not** to be strictly required at today's army and band
— recorded in the code as margin rather than necessity, rather than leaving
a comment claiming more than the measurement supports.

**Verification gap, stated plainly.** The engine and setup halves are
unit-tested; the `BoardScene` half is not, per this repo's engine/
presentation boundary, and it could **not** be exercised in a browser during
this run — the Chrome extension wasn't connected, so the §4 "pin the port"
procedure got as far as proving the dev server served the new code and no
further. The scene wiring has been read line by line but not *run*. A
manual pass — 2 players, seat 2 set to AI hard — is the outstanding check
before this should be considered done.

#### Review pass (2026-08-15)

Adversarial review of the branch, checks re-run independently. **Three real
defects, all fixed on the branch; no rule-fidelity defects.** The two probes
that could have blocked the feature both came back clean and are worth
recording so nobody re-derives them:

- **Four AI armies deploy fine.** 25 randomized four-seat runs, 180 units,
  no exhaustion. The `excludeTooClose` fallback (`clear.length > 0 ? clear :
  band`) plus the terrain filter leave enough room on every edge.
- **AI decision latency is ~47ms per action** on two full 45-unit armies
  (`legalActions` 52ms cold / ~33ms warm, `chooseNextAction` 14ms, 1020 legal
  actions). That is a main-thread hitch per action, not a freeze; a full AI
  turn lands around 10-15 seconds at the shipped pacing. Acceptable, but it
  is the number to check first if Stage 3b's lookahead ever lands.

**D1 — MEDIUM, and the one worth remembering: the terrain test was
vacuous.** `aiSetup.test.ts`'s "never deploys a unit onto terrain it may not
enter" **passed with the terrain filter deleted**. It probed the WESTERN
band, where only 4 of 90 hexes (4.4%) are barred to a chariot, with eight
draws — so it missed every barred hex by luck. Its "control" assertion
(barred hexes exist in the band) proved the hexes were there, not that the
draw could ever land on one, which is a control that looks like the real
thing and isn't. Now: southern band (39 of 126, 31%), 20 chariots, 20 seeds,
400 draws, and re-verified by mutation. **This is the third time on this
project a guard test has failed its own mutation** (§6.6's charge test,
§6.9's `attackerCanJoin` gate) — the pattern each time is a probe aimed at
the easy case.

**D2 — MEDIUM: the pacing paused before the action, not after.** The whole
point of `AI_COMBAT_DELAY_MS` is that a combat report is worth reading, but
`log` REPLACES the panel, so dwelling *before* an attack showed the previous
action's text for 700ms and the combat's own for however long until the next
action overwrote it — 160ms, or immediately for the last attack of a phase,
since `commitEndPhase` ends with `log('')`. The feature would have shipped
with the combat log effectively invisible. Fixed by pausing after applying,
sized by the action just applied.

**D3 — LOW, but the failure mode is bad: silent returns could livelock the
driver.** `applyAiAction`'s `'ram'`/`'board'` cases returned quietly if a
named unit or contact couldn't be found. Unreachable (the look-ups re-derive
exactly what `legalActions` used), but had it ever happened the board would
be unchanged, the same action would be re-chosen, and the AI would spin
forever looking like a hung turn with nothing in the console. Now throws,
which the driver's rejection handler already reports. This is the only
livelock the scene loop had that the fuzz harness's `actionCap` doesn't
already cover.

Also tightened: "End phase" now says why it's refused during an AI turn
instead of ignoring the press (board clicks stay silent on purpose — logging
there would wipe the combat report the player is reading).

**Checked and found sound:** the consequence-chain terminals (every path out
of `executeLandAttack` reaches `settleResolution` exactly once, enumerated
branch by branch); `aiRunToken` covers all three ways the board can be
replaced under a running turn; the occupancy check in `autoPlaceSeat`
(3 tests killed by mutation); the seat-agent map's live-read contract; the
save migration (killed by mutation); and hotseat equivalence — the only
changes on the human path are a `void`-ed promise, a status-line label that
only appears for AI seats, and guards on a flag that is always false without
an AI seat.

**Still outstanding: the manual browser pass.** Unchanged by this review —
it could not be run, and no amount of reading substitutes for it. D2 in
particular is exactly the class of defect only a human watching the screen
would have caught.

> **It shipped without that pass.** Merged on the user's instruction on
> 2026-08-15 with the gap open and stated. This is the first feature in this
> plan to reach `main` without anyone having watched it run, so if something
> is wrong with the AI's turn in the actual game, this is the reason and the
> place to start looking. The check itself is small: Menu -> set a seat to
> "AI — hard" -> 2 players -> confirm the computer builds, deploys and plays
> a turn. §4's port-pinning warning applies.

### 6.13 Stage 3b outcome

**Status: in flight, not merged.** Branch `codex-stage-3b-lookahead`, initial
commit `f7bb8e2` ("heuristic AI from codex"). §6.9's postmortem said the
fourth tier needed "a cloned `GameState`, an answer for every mid-resolution
decision that clone provokes, an opponent model, and a performance budget" —
what actually landed is narrower than that, and deliberately so: no
mid-resolution decisions, because the tier never explores past its own one
candidate move into a state where one could be asked. It clones the board,
applies a single deterministic movement action to the clone (`landMove`/
`navalMove`/`navalRotate` only — `'ram'` is a die roll and isn't
clone-probed), then hand-sets the clone's `phase`/`activePlayerIndex` to ask
`combatCandidates` (the same function `'ev'` combat already uses) what the
strongest enemy reply would be. `tsc`/`vitest` clean, 476 tests, adding
`'ai-lookahead'` to `SeatControl` and `'AI — expert'` as its label.

**Adversarial review (2026-08-15) failed the first commit — 4 HIGH, 4
MEDIUM, 4 LOW.** Recorded here because the failure modes are the instructive
part, not just that they got fixed:

- **HIGH — the threat probe hand-sets `phase = 'combat'` without going
  through `turnManager.advancePhase`, so it skipped that function's reset of
  `defendedThisPhase` (and, less consequentially, `charged`).** A unit
  attacked earlier in the SAME round (by an earlier seat in `seatOrder`, so
  only reachable at 3-4 seats) kept a stale `defendedThisPhase: true` into
  the hypothetical combat phase, where `combat.ts`'s `validTargets` then
  excluded it as a target — silently and one-sidedly UNDER-counting the
  threat against exactly the units the tier exists to protect. Measured
  reviewer-side over 12 seeded games: 14% of lookahead movement decisions
  had at least one candidate scored wrong, 1.9% picked a different move than
  the flag-corrected model would have. Fixed: `heuristicAgent.ts`'s
  `normalizedThreatProbeClone` resets both flags on every unit before the
  probe runs, with a comment naming `turnManager.ts`'s reset as the reason
  it's needed.
- **HIGH — "AI — expert" was not measurably stronger than "AI — hard."**
  Measured seat-controlled over the project's own metric (surviving army
  value): `'lookahead'` came in dead-even with `'ev'` on wins and slightly
  *behind* it on material, at 2-3x the decision cost — and `heuristicSoak.test.ts`
  had no test that would have caught it, unlike every earlier tier. Root
  cause turned out to be the same design gap as the MEDIUM below: an
  absolute threat penalty. Fixed by making the penalty marginal (see below);
  re-measured after the fix at **555 vs 530 total** (seat-held-constant, the
  same 12 seeds), i.e. a real but modest edge, now pinned by a new soak test
  ("the lookahead tier ends with more material than the ev tier, seat for
  seat").
- **HIGH — six mutation survivors** on behaviour this commit introduced:
  candidate truncation/sort order, the movement `riskAware` flag actually
  gaining `'lookahead'`, `enemyOwners` excluding the mover itself, the
  `reply.score > minAttackValue` gate, and `Math.max` over multiple enemies
  (the 3-4 player path, which had zero coverage). Fixed for the ones with a
  reasonably targeted test: `enemyOwners` is now exported and unit-tested
  directly; a `minAttackValue`-gate test and a risk-aware-with-nonzero-weights
  test were added (the original lookahead tests zeroed those weights, which
  is exactly what let the mutant hide). The candidate truncation/sort-order
  and the `Math.max`-over-enemies ordering survivors were **not** individually
  killed — see the MEDIUM below and the note at the end of this section.
- **HIGH — README.md was left actively contradicting the shipped code**
  ("Three difficulty levels... a fourth... is not implemented", and the
  Menu's button-cycle description missing the fifth option). Fixed; see the
  "Computer opponent" section.
- **MEDIUM — the threat penalty was absolute, not marginal, so a threat
  existing ANYWHERE on the board (unrelated to the candidate move) was
  charged against every candidate equally** — including `endPhase`'s
  implicit "do nothing" once every scored candidate fell below
  `minMoveScore`, which could freeze a unit's movement over a danger it had
  no power to change. This is what was actually behind the HIGH-2 strength
  gap above, not a fundamentally weak model. Fixed: `applyMovementLookahead`
  now computes a `baselineThreat` on the board before the move and only
  charges the increase over it (clamped at 0).
- **MEDIUM — truncating to `LOOKAHEAD_CANDIDATE_LIMIT` (8) baseline-best
  candidates BEFORE applying the threat penalty is disclosed in the header
  but unsound in principle:** a discarded 9th-or-later candidate could in
  theory outscore a kept one once the penalty is applied. The reviewer's own
  measurement never found this changing an actual choice (re-scoring all
  candidates on 270 sampled decisions never picked differently), so it was
  left as a documented performance/soundness tradeoff rather than reworked —
  reworking it (e.g. a per-unit cap, or scoring by margin-to-cutoff instead
  of a flat count) is real design work, not a bug fix, and belongs in its
  own pass if the soak numbers ever show it mattering.
- **MEDIUM — three stale doc comments** (one displaced onto the wrong
  function during the `chooseCombatAction`/`combatCandidates` split, "two
  SCORED tiers" after a third was added, "terrain/ZOC — `'ev'` only" after
  `'lookahead'` gained the same risk-aware branch). Fixed.
- **MEDIUM — `plan.md` itself was stale** (Stage 3b still listed Queued,
  and §6.9's promised latency check was never recorded). Fixed by this
  section; the latency check the reviewer ran: `chooseNextAction` 4ms at
  `'ev'` vs 15ms at `'lookahead'` on the same two-full-45-unit-army scenario
  §6.12 measured at 47ms/action total — comfortably inside that budget.
- **LOW — a new `SeatControl` string widens what a version-3 save file
  accepts with no note in `saveGame.ts`.** No `SAVE_VERSION` bump needed (an
  old build rejects the new value loudly rather than misreading it, matching
  this file's established precedent — see §6.12's first forced decision),
  but the decision itself wasn't recorded there. Fixed with a note in
  `saveGame.ts`.
- **LOW — `charged` went stale for the same reason `defendedThisPhase`
  did** (same fix, `normalizedThreatProbeClone`). Measured impact was
  negligible (1 of 270 sampled decisions, zero score change), but it shares
  a root cause with the HIGH above so it was fixed in the same place.
- **LOW — `'ram'` candidates are never clone-probed, so they escape the
  threat penalty entirely** while a competing `navalMove` doesn't — a
  structural bias toward ramming in naval positions. Not fixed: pricing a
  ram's threat properly means committing to a hit-or-miss outcome to clone
  past a die roll, which is a real modeling question, not a one-line
  correction. Documented instead, in `cloneAfterDeterministicMovementAction`'s
  doc comment, per the reviewer's own suggestion.

**What this section does NOT claim:** the fixes above were verified by
`tsc`/`vitest` (481 tests passing after the fixes, up from 476) and by re-measuring the
specific numbers the review cited, but the branch has **not** been through a
second adversarial review pass. Per this file's own verification-style
default ("adversarial — reviewer hunts for defects, does not trust the
implementer's self-report"), the person who reports fixing a review's
findings is the least reliable source on whether they're actually fixed.
Re-review before merge.

### 6.14 Stage 3b: second review outcome

**The re-review §6.13 asked for came back FAIL too** — the two things that
mattered most in that round didn't actually hold up:

- **HIGH — the "marginal threat" fix was a no-op.** Reverting
  `baselineThreat` to a literal `0` (i.e. undoing §6.13's fix and
  reproducing `f7bb8e2`'s original absolute-penalty bug exactly) left the
  full suite green. `Math.max(0, x - 0) === x` for any `x ≥ 0`, and
  `enemyCombatThreatOnBoard` (as it was then) computed a single **board-wide
  max** threat for both "before" and "after" — so the subtraction only ever
  did anything when the moving unit's exposure became the single worst
  thing on the ENTIRE board, which in any army bigger than two or three
  units is rare. All of the measured 535→555 material recovery in §6.13
  came from the `defendedThisPhase` reset fix alone; the causal claim in
  §6.13's own text and in `heuristicSoak.test.ts`'s docstring ("Fixed by
  `applyMovementLookahead` subtracting a `baselineThreat`") was wrong.
- **HIGH — "AI — expert" was still not reliably stronger than "AI — hard"
  after the fix.** The 555-vs-530 result reproduced exactly, but held on
  only 2 of the 12 seeds the test used. Extended to 160 seeds (4
  independent blocks of 40), the pooled edge was +1.0% with the **sign
  flipping in 2 of 4 blocks** — indistinguishable from noise, not a stable
  ordering.
- Three MEDIUM findings on test coverage (the `charged` reset, the
  headline `defendedThisPhase` reset itself, and the `Math.max(0, ...)`
  clamp were all mutation-survivors with no TARGETED test — only caught, if
  at all, by the fragile 12-seed soak test) and two LOW findings (README's
  "increasing strength" claim now provably false; a stale-latency-number
  mismatch between §6.12's 14ms and §6.13's 4ms citing the same scenario —
  §6.13's own number reproduced, §6.12's was the stale one, never
  reconciled).

**What actually got fixed this round, and — as important — what was
DELIBERATELY NOT force-fixed:**

- **Redesigned the threat model to be per-unit.** The re-review's own
  MEDIUM-1 named the mechanism: "make the baseline per-moving-unit (threat
  against *that* unit before vs after) rather than a board-wide max." Done:
  `enemyThreatAgainstUnit`/`enemyThreatAgainstUnitAfter` (replacing
  `enemyCombatThreatOnBoard`/`enemyCombatThreatAfter`) now filter a
  hypothetical enemy's combat candidates down to attacks that specifically
  target the unit being moved, via a new `targetsUnit` helper, so
  `baselineThreat` and `afterThreat` are both asking "how exposed is THIS
  unit," not "what's the worst thing on the board" — the two numbers can
  now actually differ because of the candidate move, which is the entire
  point of a marginal comparison.
- **Three tuning experiments, honestly reported as inconclusive rather than
  cherry-picked.** (1) The per-unit redesign alone, measured on the
  original 160-seed protocol: +0.9%, still sign-flipping — a THIRD review
  ([§6.15](#615-stage-3b-third-review-outcome)) independently re-ran this exact
  protocol against the shipped code and got -2.24% pooled, sign flipped
  from what's written here. The conclusion (no stable edge, so relabel
  rather than claim strength) is unaffected either way; the number itself
  was wrong and is corrected in §6.15, not here — this entry is left as
  originally written per this file's "don't rewrite archived content"
  convention. (2) Raising
  `LOOKAHEAD_CANDIDATE_LIMIT` 8→40 (in case truncation before re-scoring
  was hiding the effect, per §6.13's own MEDIUM-2): +1.0%, no change. (3)
  Raising `LOOKAHEAD_REPLY_WEIGHT` 0.75→2, nearly 3x: +0.3%, still
  sign-flipping. None of these levers produced a stable edge, which is
  informative: the combat phase is byte-identical between `'ev'` and
  `'lookahead'` (only `combatScoringMode()` differs, and it returns `'ev'`
  for both), so the ONLY lever this tier has is a bounded, single-ply,
  movement-time threat check on top of movement scoring that already
  accounts for terrain and ZOC — and that turns out to be a small,
  noisy effect on AGGREGATE material over a full game, not a bug to keep
  chasing with bigger knobs.
- **Relabeled rather than manufacturing a strength claim.**
  `seatControl.ts`'s `seatControlLabel('ai-lookahead')` now returns
  `'AI — cautious'`, not `'AI — expert'` — matching what's actually
  provable: real, verified, DIFFERENT decisions in specific positions (the
  targeted tests below), not a proven aggregate edge.
  `README.md`'s difficulty table and "Computer opponent" section were
  rewritten to match, explicitly stating the fourth tier is a different
  playstyle rather than a stronger one, and naming that it shipped once
  under a label ("Expert") the numbers didn't support.
- **`heuristicSoak.test.ts` rewritten to assert only what's true.** The
  false "ends with more material than ev" assertion is gone, replaced by
  two things that ARE true: a regression guard (lookahead's material stays
  above 85% of ev's, seat for seat — catching a real sabotage bug without
  asserting a fake ordering) and a genuine strength claim against
  `'greedy'` (310 vs 195, 310 vs 205 over the same 12 seeds — a large,
  stable, one-sided margin, since lookahead inherits every one of `'ev'`'s
  real advantages over `'greedy'` and only adds to them, never subtracts).
- **Two of the three test-coverage MEDIUMs got real, mutation-verified
  targeted tests** in `heuristicAgent.test.ts`: "resets a stale
  defendedThisPhase flag before probing an enemy reply" and "resets a stale
  charged flag before probing an enemy reply." Both were built the hard
  way — constructing a position, then literally deleting the reset line and
  confirming the test fails, then restoring it and confirming the test
  passes — rather than trusting that a plausible-looking assertion would
  catch a plausible-looking mutant. The `charged` test needed a
  `minAttackValue` set precisely between the matchup's uncharged EV (0.67,
  computed directly via `evaluateAttack`) and charged EV (3.33) to actually
  discriminate; the first version of that test passed even with the reset
  removed, because both charged and uncharged replies already cleared the
  default threshold either way.
- **NOT fixed, still an accepted disclosed gap (matching §6.13's posture on
  `'ram'`):** the `Math.max`-over-multiple-enemies ordering (3-4 player
  path — reviewer's LOW-3, "confirmed still surviving, as documented") and
  the `Math.max(0, ...)` clamp on a negative marginal threat (reviewer's
  MEDIUM-4). Both would need either careful multi-unit EV engineering (same
  difficulty as the `charged` test above, times two) or exporting more
  internals purely for testability, and neither showed any EVIDENCE of an
  actual behavioral bug in three rounds of measurement — unlike the
  board-wide-max issue, which was a proven, measured defect. Chasing every
  mutation survivor without a concrete failure mode behind it is how a
  fourth review round happens; these are named here as known gaps rather
  than silently dropped.

**Latency, re-measured after the redesign** (a different, smaller scenario
than §6.12's "two full 45-unit armies" — a real self-play game via
`playRandomGame`, up to 153 legal actions rather than ~1000, so the
absolute numbers aren't directly comparable to §6.12's 47ms/action; recorded
here rather than force-fitting the old scenario, per §6.13's own LOW-2
finding that citing a number from a DIFFERENT scenario without saying so is
exactly how the §6.12/§6.13 mismatch happened): `'ev'` averaged 0.69ms per
`chooseNextAction` call, `'lookahead'` averaged 4.54ms — roughly 6-7x
slower, consistent in order of magnitude with every prior measurement of
this tier, and still well under anything a player would perceive as a
freeze given the existing per-action pacing delay (§6.12).

**Verification:** `tsc --noEmit` clean, `vitest run` green at 484 tests (up
from 481 — the two new targeted tests plus the greedy-comparison test, minus
the one false assertion removed), `npm run build` clean. **Not yet through a
THIRD adversarial review pass** — this branch has now failed review twice
on the strength claim specifically, so re-review before merge is not
optional this time.

### 6.15 Stage 3b: third review outcome

**The THIRD review also came back FAIL, but a narrower one: 1 HIGH, 3
MEDIUM, 4 LOW** — and, unlike the first two rounds, the HIGH finding was
about test coverage for a fix that turned out to be genuinely correct, not
about the fix itself being wrong.

- **HIGH — the per-unit redesign had no test that could tell it apart from
  the board-wide-max bug it replaced.** Every existing lookahead test uses
  a board with exactly one friendly unit, and on a one-friendly-unit board
  "board-wide worst threat" and "threat against the mover" are the SAME
  NUMBER by construction — the two models are numerically indistinguishable
  there no matter how the test is written. Reverting `enemyThreatAgainstUnit`'s
  `targetsUnit` filter back to accepting every attack (i.e. exactly
  reproducing the bug §6.14 fixed) left the entire suite green. The
  reviewer proved this with a genuinely discriminating 4-unit position — a
  mover, a second friendly unit sitting in easy reach of a strong enemy (so
  it dominates any board-wide max regardless of what the mover does), and
  two enemies of very different strength — and handed over the exact
  numbers. **Fixed:** independently reproduced the reviewer's position and
  measurement before trusting it (ev picks the hex 1 away from the weak
  enemy; lookahead picks 2 away — exactly as reported), added it as
  `heuristicAgent.test.ts`'s "prices threat against the specific unit that
  moved, not the worst threat anywhere on the board," and mutation-verified
  it against the real, committed file: reverting the filter flips
  lookahead's choice to match ev's, and the new test catches it.
- **MEDIUM — the `Math.max(0, ...)` clamp is not the minor untested corner
  §6.14 called it.** The prompt asked whether it might be masking a real
  bug; it isn't, but §6.14's framing materially understated what the clamp
  does. Algebraically: `applyMovementLookahead` scores every candidate as
  `score − w·max(0, after_u − base_u)`, and `base_u` is a CONSTANT for a
  given unit — so without the clamp, `+w·base_u` factors out of every
  within-unit comparison and the per-unit baseline changes nothing about
  which of one unit's own candidates wins. **The clamp is therefore the
  only mechanism by which the per-unit baseline affects behavior at all**,
  which also cleanly explains why three rounds of tuning
  (`LOOKAHEAD_CANDIDATE_LIMIT`, `LOOKAHEAD_REPLY_WEIGHT`) found ~0 aggregate
  effect: the redesign's entire discriminating power runs through a
  flooring operation. **Fixed:** constructed a position where a mover
  starts within reach of a COMBINED attack (`buildAttackGroup` assembles
  two enemies into one group under 'ev' scoring: baseline 1.5, not either
  enemy's solo EV of 0.333) and has two 1-hex candidates of identical raw
  approach score, one toward each enemy — moving toward EITHER breaks up
  the group and drops afterThreat to something still below the 1.5
  baseline (0.333 one way, 0 the other), so a correct clamp scores BOTH
  candidates' marginal threat at 0. Without the clamp, "further below
  baseline" pays out as a bonus instead of clamping to zero, and the
  bigger drop earns the bigger bonus — enough to break the tie in its
  favor even though neither destination is actually less safe than the
  other in any way the raw score already didn't capture.
  **Correction (round 4):** the first version of this entry described the
  mechanism as "moving east stays inside a range-2 threat's range,
  marginal 0" vs. "moving west leaves it entirely, scores a bonus" — that
  was wrong; a fourth review's own instrumentation of the real code showed
  BOTH candidates score below baseline (0.333 and 0, both under 1.5), not
  one at parity and one below, and it was the second enemy's contribution
  to a COMBINED baseline attack — not "a harmless decoy just there for
  approach symmetry," which is what the test's own comment called it —
  that the whole test depends on. A maintainer who believed the original
  comment and simplified the decoy away would have silently turned the
  test into a no-op, which is exactly what a from-scratch mutant reproduced
  (decoy removed → clamp-removal mutant survives). Both the code comment
  and this entry were corrected to describe the group-attack mechanism
  actually operating. Added as "does not reward a move for dropping BELOW
  its baseline threat," asserting `lookaheadAction` exactly matches
  `evAction` (ev never sees threat at all, so any daylight between them is
  the bonus firing) — mutation-verified: removing the clamp switches the
  chosen hex from east to west even though its raw score is no better.
- **MEDIUM — two doc comments still named `enemyCombatThreatOnBoard`**, the
  function §6.14's redesign deleted and replaced with
  `enemyThreatAgainstUnit`. Same defect class §6.13 already logged once
  ("three stale doc comments") recurring in the same file. **Fixed:**
  renamed both references (`combatCandidates`'s and `bestSoloAttacker`'s
  doc comments).
- **MEDIUM — this file's own "+0.9%, still sign-flipping" measurement,
  three paragraphs up, does not reproduce.** The reviewer re-ran the exact
  same 160-seed protocol (4 blocks of 40, both seat orientations) against
  the shipped per-unit redesign and got **-2.24% pooled, sign flipped**.
  Independently re-verified before accepting the correction (this file's
  own habit of checking a subagent's numbers before writing them down):
  reimplemented `heuristicSoak.test.ts`'s `playSeries` in a throwaway
  script against the real modules and reproduced the reviewer's per-block
  numbers exactly (+2.6%, -0.9%, -3.1%, -7.4%, pooled -2.24%). The
  CONCLUSION above (no stable edge, relabel rather than claim strength) is
  unaffected — if anything the corrected number is a cleaner illustration
  of "sign not stable" than the wrong one was — but the paragraph above is
  left as originally written, per this file's own "archiving is a cut, not
  an edit" convention; the note inline there points here for the
  correction instead. `heuristicSoak.test.ts`'s docstring, which is NOT
  archived and gets read on every future review, was rewritten with the
  corrected number.
- **NOT fixed, an honestly-attempted and abandoned gap:** the reviewer
  separately flagged a shared-cache-key mutant (baseline keyed by a
  constant instead of `unitId`, so a later unit's move gets penalized
  against an earlier unit's baseline) and claimed the same 4-unit position
  above kills it too. It doesn't — `bait` never moves in that position, so
  only one unit's baseline is ever computed, and a shared-vs-per-unit key
  is unobservable when there's only one key. Constructing a real
  discriminator turned out to need three units in a specific score
  ordering (a "poisoner" processed first with a real self-penalty, and a
  second mover whose OWN true baseline would have offset an equally real
  afterThreat) with EV magnitudes threading a narrow numeric window — and
  the unit roster's small set of achievable attack EVs (multiples of
  1/3-ish, from ~13 matchups actually queried) made that window very hard
  to hit without stumbling into an unrelated rule (a unit already adjacent
  to ANY enemy has zero reachable hexes at all — an engagement lock, not a
  bug — which silently zeroed out three earlier attempts; a cavalry charge
  bonus silently doubling a fourth). After several worked geometries still
  came up empty, this was set aside rather than forced into something
  fragile. The shipped code is not wrong here — `baselineCache.get(unitId)`
  is correctly keyed per unit — this is a disclosed REGRESSION-test gap,
  same posture as the `'ram'`-clone-probe and multi-enemy-ordering gaps
  already accepted in §6.13/§6.14.
- **LOW — two more stale "board-wide" descriptions,** matching the pattern
  §6.14's redesign should have caught: `heuristicAgent.ts`'s file header
  ("what the strongest immediate combat reply would be from that resulting
  board") and `README.md`'s difficulty table ("prices the strongest attack
  you could make against the result"). Both described the pre-§6.14 model.
  **Fixed:** both reworded to say "against the specific unit that just
  moved."
- **LOW — three more disclosed, not fixed:** `navalMove`/`navalRotate` ARE
  handled in `cloneAfterDeterministicMovementAction`'s switch (unlike
  `'ram'`, which is genuinely unhandled — §6.13's already-logged bias), but
  no lookahead test involves a ship, so that handling is entirely
  UNTESTED — a mutant deleting both cases (falling through to `'ram'`'s
  `null`) leaves the suite green, and so does one collapsing
  `targetsUnit`'s `'board'` branch (boarding attacks, the naval
  equivalent of `landAttack`) to `false`. Both are one gap, not two — a
  single naval lookahead test would need to close them together; the
  probe's use of `pickBestDeterministic` over `pickBest` isn't
  pinned by any test (swapping it lets the probe consume `rng` draws);
  and the literal string `'AI — cautious'` isn't pinned either, though
  this is a pre-existing convention across every `SeatControl` label, not
  a regression this round introduced.

**What this round confirms about the branch's history:** all three review
rounds found real things, but of a different character each time — round 1
found the fix outright didn't work (a no-op), round 2 found the SECOND fix's
strength claim didn't hold up, round 3 found the (this time genuinely
correct) THIRD attempt's fix had no test standing between it and being
silently reverted, plus a wrong number in the round that fixed it. The
common thread is measuring rather than asserting: every fix in this section
that shipped without an adversarial pass first turned out to have a gap.

**Verification:** `tsc --noEmit` clean, `vitest run` green at 486 tests (up
from 484 — the two new mutation-verified targeted tests), `npm run build`
clean. **Not yet through a fourth adversarial review pass.**

### 6.16 Stage 3b: fourth review outcome

**The FOURTH review was the narrowest yet: 3 MEDIUM, 4 LOW, and — for the
first time — no correctness defect in the shipped code.** The reviewer's
own words: "the closest this branch has come to passing." Everything
found was about the RECORD (a wrong explanation, an undisclosed gap, a
disclosed gap whose stated reason for being unfixable didn't hold up), not
about behavior a player would ever see.

- **MEDIUM — the round-3 clamp test's own comment described a mechanism
  that wasn't the one operating, and called the load-bearing unit
  "harmless."** The comment said `decoy` was "harmless — only there to
  give the westward move an approach score" and that moving toward
  `watcher` "stays within its range (afterThreat == baseline, marginal
  0)." Instrumenting the real code (independently, before accepting the
  finding) showed baseline is actually **1.5**, not `watcher`'s solo
  0.333 — `buildAttackGroup` combines `watcher` and `decoy` into ONE
  attack group under `'ev'` scoring, and `decoy` is what produces the
  elevated baseline the whole test depends on. BOTH destinations
  (afterThreat 0.333 and 0) sit below that 1.5 baseline, not one at parity
  and one below as the comment claimed. A maintainer who believed the
  comment and "simplified" the decoy away as decorative would have
  silently turned the test into a no-op — confirmed by rebuilding the
  position without `decoy` and reconfirming the clamp-removal mutant
  survives there. **Fixed:** rewrote the test's comment and this file's
  matching §6.15 paragraph to describe the group-attack mechanism actually
  operating. The test's assertions and the fix itself were never wrong —
  only the explanation was.
  **Correction (round 5):** this round's own rewrite was still
  incomplete, not wrong — it said west's afterThreat drops to 0 "leaving
  watcher's range 2 entirely," which is only half the story. A fifth
  review checked `validTargets` directly at both destinations: at west,
  `decoy` (`archers`, `meleeCapable: false`) is now ADJACENT to `mover`
  but has no valid target from adjacency at all (ranged-only units can't
  attack from melee range), while `watcher` is the one that left range —
  so BOTH enemies go silent for different reasons, not one "leaving
  range" reason covering both. The prior wording would have survived a
  maintainer swapping `decoy` for a melee-capable type without warning
  that doing so breaks the test's asymmetry. Reworded again, this time
  citing the `validTargets` check directly rather than paraphrasing it.
- **MEDIUM — an undisclosed surviving mutant: the threat probe's choice of
  `'ev'` scoring for the hypothetical enemy reply was asserted in a doc
  comment but pinned by no test.** Swapping `combatCandidates(..., 'ev')`
  to `'greedy'` inside `enemyThreatAgainstUnit` left the whole suite green.
  **Fixed:** independently reproduced the reviewer's example (mover
  `archers` approaching `phalanges`, real code lands at `(13,3)`, the
  `'greedy'`-probe mutant at `(12,3)`) before trusting it, then added
  "prices the enemy's hypothetical reply under EV scoring, not greedy" —
  mutation-verified against the committed file.
- **MEDIUM — the shared-baseline-cache-key gap (§6.15's "set aside rather
  than forced") was closable after all, and for a different reason than
  §6.15 gave.** §6.15 concluded the achievable attack EVs on this unit
  roster made the needed numeric window too narrow to hit naturally. The
  fourth review showed that conclusion was itself wrong: the real blocker
  isn't EV magnitude, it's that ANY unpenalized alternative candidate
  wins ties regardless of a shared-vs-per-unit cache bug being present —
  remove the alternatives (by boxing each of two movers in with
  `movementLeft: 0` friendly units so each has exactly ONE legal
  destination) and zero every scoring weight (so raw scores are all
  exactly 0 and only the threat penalty is observable), and the numeric
  window disappears entirely — no EV tuning needed. **Fixed:**
  independently reproduced the reviewer's 14-unit position and confirmed
  it discriminates against the real committed file (`ev` picks `P`,
  correct lookahead picks `M`, the shared-key mutant collapses back onto
  `P`) before adding "caches each mover's baseline threat under its OWN
  id, not a shared key" — mutation-verified. §6.15's own "abandoned"
  framing stands as an honest record of what was tried and concluded at
  the time; this entry is the correction, not a rewrite of that one.
- **LOW — six code comments added by round 1–3 of this same branch cited
  `plan.md §N` for sections that had already moved to `plan-history.md` in
  the same commit that split the files** (`heuristicAgent.ts:50`, `:702`,
  `:710`; `seatControl.ts:6`, `:61`; `saveGame.ts:83`). An oversight, not a
  convention violation — the same commit correctly updated
  `heuristicSoak.test.ts`'s docstring and the reviewer agent's own file.
  **Fixed:** all six repointed to `plan-history.md`. The ~60 *pre-existing*
  `plan.md §N` citations elsewhere in `src/` (predating the split) were
  deliberately left alone, per this session's earlier judgment call that
  a repo-wide rename is out of scope for a feature branch — plan.md's own
  archiving convention keeps section numbers stable specifically so those
  stay findable via the History Map regardless.
- **LOW — two more undisclosed survivors, folded into the existing naval
  disclosure rather than left unnamed:** `targetsUnit`'s `'board'` branch
  (`return false` survives) and `cloneAfterDeterministicMovementAction`'s
  `navalMove`/`navalRotate` cases (deleting them, falling through to
  `'ram'`'s `null`, survives) are the SAME gap, not two — both are only
  reachable through naval clone-probing, which no lookahead test
  exercises. **Corrected the disclosure** (this file's own LOW-list above
  had claimed navalMove/navalRotate are "never clone-probed at all," which
  is imprecise — the code DOES handle them, it's just untested) and added
  a doc-comment note on `targetsUnit` pointing here. Not fixed — a single
  naval lookahead test would need to close both branches together, which
  is real scope, not a one-liner.
- **LOW — `plan.md` self-contradicted about live defects:** "Live defects
  still open: none" (Current Snapshot) alongside §18 (the ramming bonus
  defect, added to the queue on this same branch) listed as a confirmed,
  unfixed live defect elsewhere in the same file. **Fixed:** Current
  Snapshot now names §18.
- **LOW (pre-existing, not this branch's fault, swept up anyway):** the
  difficulty-tier table still credited `'ev'`'s movement scoring with
  "retreat-trap … value," a term `scoreLandMove`'s own doc comment records
  as deliberately removed after an earlier review found it survived
  deletion. Confirmed via `grep` that the term genuinely doesn't exist in
  the scoring logic before removing it from the table.

**What this round confirms:** the underlying fix has now survived four
independent adversarial passes without a single behavioral defect
surviving to this round — every finding here was about whether the CODE'S
OWN EXPLANATION of itself was accurate and complete, which is a real bar,
just a different one than "does it work." Two mutants remain intentionally
undiscriminated on record — `pickBestDeterministic` vs. `pickBest` inside
the probe, and the literal `'AI — cautious'` label string (a pre-existing
convention across every `SeatControl` label, not new to this tier) — both
named explicitly rather than left as silent gaps.

**Correction (round 5): this paragraph's own claim was an overclaim.**
"Two mutants remain intentionally undiscriminated on record" implied that
was the complete list. A fifth review found it wasn't — `enemyOwners`'s own
test couldn't discriminate a real mutation (both its living and destroyed
unit shared an owner), the `Math.max`-over-multiple-enemy-owners path had
zero coverage at all (every test in the file uses a 2-player board, so the
loop's second iteration is never reached), and three more design choices
(the `'ram'` clone-probe exclusion, `enemyThreatAgainstUnit`'s defensive
`index < 0` guard, and the tuning constants' unpinned-upward direction)
were equally undisclosed. See
[§6.17](#617-stage-3b-fifth-review-outcome) for the full, corrected
accounting. The lesson repeats one level up: a claim of completeness is
itself a claim that needs verifying, not a natural conclusion to reach
after fixing everything currently in view.

**Verification:** `tsc --noEmit` clean, `vitest run` green at 490 tests (up
from 486 — two new mutation-verified targeted tests plus two guard tests
for `movingUnitId`), `npm run build` clean. **Not yet through a fifth
adversarial review pass.**

### 6.17 Stage 3b: fifth review outcome

**The FIFTH review was narrow again — 3 MEDIUM, 5 LOW — and, for the
second round running, found no correctness defect in shipped behaviour.**
Its main finding was that §6.16's own closing sentence was wrong to claim
completeness (see the correction inline in §6.16 above): every review
round from the third onward has closed its own findings only to have the
next round find the CLOSING CLAIM itself was too strong. This entry
breaks that pattern on purpose by not asserting completeness at the end.

- **MEDIUM — the `enemyOwners` test couldn't observe the property it
  exists to check.** `heuristicAgent.test.ts`'s "lists every other owner
  with a living unit, and only those" built `dead` as `owner: 1` — the
  SAME owner as the living `enemy` — so `livingUnits(state)` filtering
  destroyed units out made no difference to the result (`[1]` either
  way). Mutating `livingUnits(state)` to `state.units` (i.e. stop
  filtering destroyed units) left the suite green. **Fixed:** changed
  `dead`'s owner to a third value (`2`) not otherwise present, so the
  destroyed unit's exclusion is the only thing that can produce `[1]`
  instead of `[1, 2]` — mutation-verified against the committed file.
- **MEDIUM — the multi-enemy `Math.max` in `enemyThreatAgainstUnit` had
  zero test coverage, and it's a real 3-4-player behavior, not a
  cosmetic one.** `worstReply = Math.max(worstReply, reply.score)` →
  `worstReply = reply.score` (last owner wins, not worst) survived the
  full suite, because every lookahead test in the file uses `makeGame`'s
  fixed 2-player board — the loop's second iteration is structurally
  unreachable there. In a real 3-4 player game this understates a real
  threat by however much the last-checked owner's reply happens to fall
  short of the worst one; the review measured a 5x understatement in a
  constructed example. **Fixed:** added `makeGame3` (a 3-player variant
  of the existing helper) and "takes the WORST reply across multiple
  enemy owners, not just the last one checked" — a boxed-in mover with
  exactly one legal destination, threatened by a strong owner-1 reply and
  a weak owner-2 reply processed after it, so the outcome is purely
  `endPhase` (correct, prices the strong reply) vs. an actual move
  (buggy, prices only the weak one it saw last) — mutation-verified
  against the committed file.
- **MEDIUM — this file's own §6.16 closing paragraph, and the matching
  sentence in `plan.md`'s In-flight entry, both overclaimed
  completeness** ("no undisclosed coverage gaps remain," "two mutants
  remain intentionally undiscriminated on record" as if that were the
  whole list). Both corrected in place — see §6.16's inline correction
  above and `plan.md`'s current In-flight text, which now deliberately
  does NOT re-assert completeness, pointing here instead.
- **LOW — three more design choices disclosed, not fixed:** the
  `'ram'`-clone-probe exclusion (a genuine, already-documented design
  choice, but nothing pins that adding `'ram'` to the probed cases would
  change anything); `enemyThreatAgainstUnit`'s defensive `index < 0`
  guard (structurally unreachable, because `seatOrder` always holds every
  player id for the life of the game — `turnManager.ts`'s
  `shuffleSeatOrder` only ever permutes it, never adds or drops one —
  unlike `movingUnitId`'s structurally similar throw, which WAS pinned
  once exported, because that one has a direct-call seam and this one
  doesn't without exporting a function and handing it a
  self-contradictory board); and `LOOKAHEAD_CANDIDATE_LIMIT`/
  `LOOKAHEAD_REPLY_WEIGHT` are only pinned in the direction that matters
  for correctness (lowering either breaks tests; raising either is a
  performance/accuracy tradeoff with no test asserting the shipped value
  specifically, consistent with the three tuning experiments in §6.14
  that already tried larger values without a behavior test objecting).
  All three got explanatory comments at their definition sites rather
  than forced tests, since none is a `heuristicAgent.test.ts`-shaped fix.
- **LOW — the clamp test's comment was corrected a second time.** Round
  4's rewrite said west's afterThreat drops to 0 by "leaving watcher's
  range 2 entirely" — true but incomplete. Checking `validTargets`
  directly at both destinations showed west is threatened by neither
  enemy for two DIFFERENT reasons: `watcher` genuinely leaves range, but
  `decoy` (`archers`, `meleeCapable: false`) is now ADJACENT and simply
  can't attack from melee range as a ranged-only unit — not "still in
  range but somehow zero." The prior wording would have survived a
  maintainer swapping `decoy` for a melee-capable unit without warning
  that doing so breaks the destinations' symmetry. Reworded to cite the
  `validTargets` check directly.
- **LOW — one more stale citation:** `ui/session.ts:42`, on a line this
  same branch's Stage 4 work had already touched, still said `plan.md
  §6.4` after the split. Fixed.

**What this round confirms:** the lookahead tier's actual behavior has
now been independently attacked five times with the last two rounds
finding zero shipped defects — the remaining friction is entirely about
whether this file and the code's own comments describe themselves
accurately, and about not overclaiming that description is finished.
Given that pattern, this entry deliberately stops short of declaring the
record complete; it names what changed and moves on.

**Verification:** `tsc --noEmit` clean, `vitest run` green at 491 tests
(up from 490 — one new mutation-verified targeted test; the `enemyOwners`
fix edited an existing test rather than adding one), `npm run build`
clean. **Not yet through a sixth adversarial review pass.**

### 6.18 Stage 3b: sixth review outcome — PASS

**The sixth review passed**, the first PASS this branch has received. The
reviewer enumerated 27 mutants directly from `git diff main...HEAD` — not
from a description of what changed — and ran all of them against the
committed file: 19 killed (every behavioral line the branch touches),
8 survived, and every survivor was already disclosed on the record except
one, which the reviewer confirmed is a provably EQUIVALENT mutant (a
secondary sort key that can never be observed, since the primary key is
already unique and V8's sort is stable) rather than an undisclosed gap.
Both of round 5's specific mutation claims (the `enemyOwners` fix, the
multi-owner `Math.max` fix) were independently re-verified against the
committed file and confirmed to hold, and every measured number in the
prose — including the 160-seed −2.24% figure and the new 3-player test's
exact 5x threat understatement — reproduced exactly.

**Three small findings, all prose, none behavioral — fixed directly
rather than spawning a seventh round:**

- **MEDIUM — round 5's own defensive-guard comment
  (`heuristicAgent.ts`'s `index < 0` check) gave a FALSE reason for why
  it's unreachable.** It claimed `seatOrder` is "fixed at game start and
  never mutated afterward" with "`fuzzHarness.ts`'s seat setup" as "the
  only writer." Both clauses are wrong: `turnManager.ts` reassigns
  `state.seatOrder = shuffleSeatOrder(state.seatOrder)` at every round
  boundary when randomized turn order is on, and `fuzzHarness.ts` never
  writes `seatOrder` at all, only reads it. The CONCLUSION (unreachable)
  was still right — `shuffleSeatOrder` only permutes, never adds or drops
  an id, so `indexOf` on a living unit's owner can't fail — just not for
  the reason stated. This is the fourth time in three rounds (§6.15's
  clamp comment, §6.16's own correction of it, §6.17's second correction
  of the SAME comment, and now this) that a defensive/explanatory comment
  introduced to satisfy one review round turned out to have its own small
  error, caught by the next. **Fixed:** corrected both the code comment
  and this file's matching §6.17 paragraph to state the real invariant.
- **LOW — "lowering it to 1 fails three tests" undercounted; verified by
  mutation before correcting.** Actually four: the three targeted
  lookahead tests plus `heuristicSoak.test.ts`'s ev-comparison soak
  (deterministic and seeded, not a flake). **Fixed:** corrected the
  count.
- **LOW — `plan.md`'s Current Snapshot still said "In flight: nothing"**
  while the Current Queue a few lines below has documented Stage 3b as
  in flight, failing review, for five straight rounds — the same
  self-contradiction class as the "Live defects: none" one §6.16 already
  fixed once, just a different sentence that never got the same sync.
  **Fixed:** now points at the In-flight table instead of asserting a
  stale absolute.

**On whether to keep reviewing:** the reviewer's own recommendation,
given directly: stop the per-round cycle here. Three consecutive rounds
found zero behavioral defects, and this round's diff-driven mutation
sweep is the strongest evidence yet that the disclosure discipline has
converged — every real survivor is named somewhere on the record. What
has NOT converged, and predictably won't by re-running the same process,
is prose accuracy: each round's comment fix creates a new comment, and a
sufficiently adversarial read will keep finding something small in it.
That is a property of the process, not a signal about remaining risk.
The residual gaps (no naval lookahead test, `'ram'` unprobed by design,
two tuning constants unpinned upward) are real but scoped — each would
need genuinely new test scenarios to close, which is better done as its
own future item than as another pass over an already-converged diff.

**Verification:** `tsc --noEmit` clean, `vitest run` green at 491 tests
(no new tests this round — comment-only fixes), `npm run build` clean.
**PASSED review. Ready to merge**, pending the operator's decision.

---

## 7. Start a new game at any time

**Status: ✅ Shipped** — merged to `main` as `30c23e7`. Reviewed twice; the
review's HIGH was that gating the control on `decisionPending` would disable
the escape hatch in exactly the wedged-board case the feature exists for, so
the guard was removed. Verified by hand in the running game: abandon → menu →
new game yields a genuinely fresh board (Turn 1, Movement phase, history
cleared, units back at start). Original plan follows.

It was **parallelizable with Stage 2a** — see
[§7.3](#73-running-this-in-parallel).

### 7.1 The gap

The only `scene.start('Menu')` in the codebase is `GameOverScene.ts:48`. From
`ArmyBuilderScene`, `PlacementScene`, or `BoardScene` there is no way back:
a player who misbuilds an army, misplaces a unit, or simply wants to restart
must either play the game to completion or reload the page. Reloading is
also the only escape from a wedged board — which [§6.6](#66-stage-1-outcome)'s
LOW-A soft-lock made briefly reachable.

### 7.2 What it needs

- An "Abandon / new game" control on `BoardScene`'s chrome, and the same on
  `ArmyBuilderScene` and `PlacementScene` (the pre-game scenes strand a
  player just as effectively).
- **A confirmation step.** Abandoning discards an in-progress game; this is
  the one genuinely destructive control in the UI.
- **`SessionState` reset.** `ui/session.ts` holds player setup, army
  selections, combat mode and test mode across scene handoffs. Returning to
  the Menu without clearing it leaks the previous game's selections into the
  next one — this is the most likely source of a subtle bug here, and the
  thing to test hardest.
- **Autosave interaction.** `BoardScene` autosaves to `localStorage`
  (`ui/saveStorage.ts`). Decide deliberately whether starting a new game
  clears the autosave, leaves it, or offers to save first — silently
  clobbering a game the player might have wanted back is the bad outcome.
- **Clean teardown, and this is new since Stage 1.** `BoardScene` now holds
  *pending Promises* — `decisionPending`, `pendingActionResolve`, and the
  four `PlayerAgent` `choose*` continuations. Abandoning mid-decision (during
  a retreat, drift, advance offer, or exchange sacrifice) leaves those
  unresolved. Either block the control while `decisionPending` is true —
  matching the existing guard pattern — or resolve/reject them on teardown.
  Leaking them is a real hazard, not a theoretical one.

### 7.3 Running this in parallel

This pairs well with **Stage 2a** and badly with **Stage 2b**:

- **2a** is pure engine plus new test files (`engine/`, a harness module). It
  does not touch `src/scenes/`. Genuinely disjoint from this work.
- **2b** edits the drift cascade (`BoardScene.ts:1392-1541`, per
  [§14.2](#142-the-structural-fix-extract-the-interaction-cascades)) — the same file this task adds
  chrome and teardown logic to. **Do not run these two concurrently.**

**The one real contention point is `README.md`**, which both agents are
instructed to update (see [§1](plan.md#1-agent-workflow)'s warning).
Mitigate by telling one of the two agents explicitly not to touch it, and
documenting that half by hand at merge time — a README conflict is cheap to
resolve but pointless to incur.


---

## 8. Bug: units cannot move through friendly units

**Status: ✅ Shipped** — merged to `main` as `e87c55c`. Found by the user
during play review, not by any test or agent.

Review found all three new restrictive tests *vacuous*: any different-owner
unit projects ZOC onto its own six neighbours, so traversal is never
attempted and the owner check is unobservable on open ground. They were
rewritten on river geometry — (1,20)/(2,20) are plain and river-separated,
and ZOC does not cross rivers — which is the only place the check is
observable. All three now fail under mutation.

Naval deliberately kept its blanket occupancy block; see §8.3(2) and the
recorded ruling in `navalMovement.ts`. Original plan follows.

### 8.1 The rule, and what the code does

`docs/research/05-rules-french-original.md:124-126`:

> Une unité ne peut en aucun cas se placer sur une case déjà occupée par
> une quelconque autre unité. Par contre, au cours d'un mouvement, une
> unité peut **traverser** une case où se trouve une unité de la même armée.

Matching transcription at `docs/research/02-rules-transcription.md:88-90`:
"a unit may never *end* its move on a hex already occupied by another unit.
It *may* pass through a hex occupied by a friendly unit mid-move."

The code conflates "may not stop here" with "may not enter here":

(Line numbers below are **pre-fix**, from before `e87c55c` — they describe
the code as it was, not as it is.)

| Site | Behavior then | Fixed to |
| --- | --- | --- |
| `movement.ts:62` (`reachableHexes`) | any occupied hex is impassable | friendly-occupied hexes traversable, not selectable as a destination |
| `movement.ts:172` (`straightLineMoveCost`) | a friendly unit anywhere on the line aborts the charge | friendlies traversable mid-line; destination still must be empty |
| `navalMovement.ts:52` | same blanket block | **open question** — see §8.3 |

This is **not** listed in the README's "Known simplifications", so it was an
unnoticed gap rather than a deliberate deferral.

### 8.2 Why this matters more than it looks

- **It silently weakens the cavalry charge feature** ([§5](#5-outcome)). A
  charge needs a straight line at full movement; today any friendly unit
  standing on that line makes the charge impossible. Note
  `straightLineMoveCost` already special-cases ZOC for the final step
  (`isFinalStep`, `movement.ts:180-181`) but applies occupancy uniformly —
  the asymmetry is the bug.
- **It distorts formation play generally.** A phalanx line blocking its own
  cavalry is precisely the situation the rule exists to permit.

### 8.3 Design questions to settle before implementing

1. **"Même armée" in a 3-4 player game.** The rule says *same army*, not
   *not-enemy*. In a 4-player hotseat game each player is their own army, so
   this should mean **same `owner`**, not merely "not the active player's
   enemy". Do not implement it as `unit.owner !== active` — that would let
   units traverse third parties.
2. **Naval.** The passage sits in the general movement section, but naval
   movement is facing-based and ramming keys off contact. Whether a ship may
   traverse a friendly ship needs a decision and a code comment recording it,
   per this repo's ambiguous-rulebook convention.
3. **ZOC interaction.** Passing *through* a friendly unit that itself sits in
   an enemy ZOC: the ZOC stop rule applies independently and must keep
   working. Worth an explicit test.

### 8.4 The implementation hazard

`reachableHexes` currently returns one `Map<hexKey, cost>` doing double duty
as "reachable" and "selectable destination". The fix must **separate
traversal from termination**: expand the search *through* friendly-occupied
hexes while excluding those hexes from the returned destination set. Getting
this wrong in the obvious way produces a stacking bug — two units on one hex,
which the rulebook forbids absolutely.

**Sequence this after Stage 2a lands**, and use the fuzz harness as the
safety net: its "no two units share a hex" invariant is exactly the check
that catches a botched fix, and this is a much better first real job for the
harness than a synthetic one.

---

## 9. Live defects found by Stage 2a

Both confirmed by adversarial review against the shipped code. §9.1 is fixed
on `main` as `6172f2f`. §9.2 still affects hotseat play today.

### 9.1 Post-combat advance ignores terrain restrictions

**Status: ✅ Shipped** — merged to `main` as `6172f2f` via
`feat/advance-terrain`. Review PASSed. `npm run build` clean; `npm test`
clean (288 passed, 1 skipped).

`src/scenes/BoardScene.ts:1569`, in `promptAdvanceChoice`:

```ts
const candidates = this.advanceEligibleAttackers.filter((u) => !u.destroyed);
```

Before the fix, there was no terrain check, and `:1573-1576` assigned
`chosen.position = vacatedHex` unconditionally. So cavalry or a chariot that
defeated an infantry or archer unit standing on marsh or a steep flank was
*offered*, and permitted, to advance onto terrain it may never enter — violating
`05-rules-french-original.md:186`. Elephants advancing onto marsh are
affected too. Reachable in ordinary play: the only nearby restriction
(cavalry-vs-phalanx) doesn't cover infantry or archers.

**Sharper than when first written: the scene and the fuzz harness disagreed
about this rule.** Stage 2a landed
`eligibleAdvanceCandidates(candidates, vacatedHex)` (`combat.ts:68`), which
is `!u.destroyed && canUnitEnterHex(u, vacatedHex)` — and `fuzzHarness.ts:475`
uses it. So the harness enforced the terrain restriction on advance and the
scene did not, meaning **no amount of fuzzing could surface this defect**.
The fix reconciled both callers by routing `BoardScene.promptAdvanceChoice`
through `eligibleAdvanceCandidates`.

**Fix shipped:** replace the filter at `BoardScene.ts:1569` with a call to
`eligibleAdvanceCandidates` — one implementation, already tested, already
used by the harness. Do **not** re-inline `canUnitEnterHex` (`combat.ts:43`)
at the call site; that recreates the divergence in a subtler form.

### 9.2 `endGameByTimeLimit` is never called

`turnManager.ts:131` defines it; a repo-wide grep finds callers only in
`fuzzHarness.ts`. **No scene calls it.** So real hotseat play has no
turn-limit ending, and the rulebook's `on se fixera des temps limites pour la
partie entière` (`05-rules-french-original.md:41`) is unreachable outside the
fuzzer. Games can only end by elimination.

**Design settled 2026-08-15** (see [§9.2.1](#921-the-agreed-design)), after
the item was twice deferred for want of it. It is no longer blocked; what
follows is an implementable brief. Note it was never added to the README's
"Known simplifications" either, as the old version of this section said it
should be — a grep finds no such bullet, so the gap is currently undocumented
for players as well as unfixed.

<a id="921-the-agreed-design"></a>

#### 9.2.1 The agreed design

Two independent ways to end a game, **both** offered, plus one rule that
applies to both and one that decides the winner.

| Piece | Decision |
| --- | --- |
| **Mode A — clock** | A wall-clock limit for the whole game, chosen before it starts. The rulebook's own framing (`par exemple 2 heures`). |
| **Mode B — round limit** | A number of complete rounds, chosen before it starts. Maps directly onto `GameState.turnNumber`, which already counts exactly this. |
| **Mode C — the button** | A dedicated **"End game"** control on the Board, available at any time regardless of A/B. |
| **Fairness rule (all modes)** | Whatever fires the trigger, **every player must have played the same number of turns.** The game does not stop on the spot: the players who have not yet acted in the current round still take their turn, and the game ends at the round boundary. |
| **Winner** | Highest remaining army value in purchase points, which `endGameByTimeLimit` already computes via `armyValue`. |
| **Ties** | **A draw.** Two or more players on the same highest value share the result; nobody is declared the winner. |

The clock and the round limit are separate options, not one setting with two
units — a player picks one, the other, or neither, and the button is always
there.

#### 9.2.2 What this actually requires

Working outward from the smallest change, since about half of this already
exists:

1. **The fairness rule is nearly free, and it is the crux.** `advancePhase`
   already detects the round boundary: `const wrapped = nextIndex <=
   state.activePlayerIndex` (`turnManager.ts:74`), which is where
   `turnNumber` increments. So a trigger should NOT end the game where it
   fires — it should set a *pending* flag, and `advancePhase` should end the
   game at the next `wrapped`. That gives "everyone has played an equal
   number of turns" by construction, for all three triggers at once, rather
   than three separate pieces of bookkeeping. It also handles the two cases
   that would otherwise need special-casing: eliminated seats (the wrap loop
   already skips them) and the re-randomised turn order house rule (which
   only reshuffles *at* the wrap).
2. **Draws need a `GameState` shape change**, and this is the one piece with
   real ripple. `winnerId: PlayerId | null` (`state.ts:175`) cannot express
   "these two drew" — `null` already means "nobody left." Adding
   `winnerIds: PlayerId[]` (or widening the existing field) touches:
   `endGameByTimeLimit` and `advancePhase` (`turnManager.ts:63`, `:143`),
   `GameOverScene.ts:13`, `fuzzHarness.ts`'s `HarnessStats.winnerId`
   (`:802`, `:1166`) and its tests, and **`SAVE_VERSION`, which would go
   2 -> 3**. Worth checking `heuristicSoak.test.ts:111` while there, though
   it should be unaffected: §6.9 already established that the strength tests
   compare surviving army value with the seat held constant precisely
   *because* `winnerId` was a bad metric — and the reason it was bad is
   exactly the silent lower-seat tiebreak this change removes.
3. **The clock needs to survive save/load, and must store elapsed time, not
   a start timestamp.** A game saved on Monday and resumed on Friday must not
   be instantly over. Also decide (and write down) whether it keeps running
   during AI turns and while a retreat prompt is open — recommended: **yes,
   it does**, because it is a limit on the length of the game, not a
   per-decision chess clock, and pausing it introduces a second piece of
   state that has to be correct across every prompt and every scene
   transition. The rulebook's separate per-turn thinking limit (`3 minutes`,
   same sentence) is explicitly **out of scope**.
4. **The Menu has no text input**, and building one for this would be the
   largest single piece of work in the task. Recommended instead: follow the
   existing cycling-button idiom the combat rule, turn order and seat
   controls all use (`MenuScene.ts`) — one button cycling `Off / 30 min /
   1 h / 2 h`, another cycling `Off / 6 / 8 / 12 rounds`. Presets are also
   easier to persist and validate than free text.
5. **The "End game" button is irreversible**, so it takes a confirm dialog,
   the same as Abandon (`showConfirmDialog`, see `confirmDialog.ts`). It
   needs the same guards as the other Board controls — not while a
   retreat/drift/advance choice is pending, and not during an AI seat's turn
   (`aiRunning`, [§6.12](#612-stage-4-outcome)).
6. **Telling the player.** The status line should say when the game is in its
   final round (the pending flag is set), and the clock mode needs the
   remaining time visible somewhere — otherwise "you have 2 hours" is
   information the player cannot act on.

#### 9.2.3 Already done, and deliberately not in scope

- **Counting the remaining points is already implemented.**
  `GameOverScene.ts:21-28` already lists `${p.name}: ${armyValue(...)} points
  remaining` for every player. The scoring half of the request needs nothing
  beyond the draw display.
- `endGameByTimeLimit` itself already picks the highest army value; only its
  tie behaviour changes.
- Out of scope: the rulebook's per-turn thinking limit, and any change to how
  elimination endings work (`advancePhase`'s `remainingPlayers.length <= 1`
  path stays exactly as it is).

<a id="924-outcome"></a>

#### 9.2.4 Outcome

**Status: ✅ Shipped, merged `836c70f` on 2026-08-15.** Implemented directly
(no implementer/reviewer agent pair for this one — the user ran the
implement → review loop themselves in the same session), landing
`engine/gameEndSettings.ts` (Menu preset/cycling/label/format helpers),
`turnManager.ts`'s `carryLiveGameClock`/`advanceGameClock`/`requestGameEnd`/
`setClockPaused`, the `winnerIds`/`clockLimitMs`/`elapsedMs`/`roundLimit`/
`paused`/`pendingGameEnd` fields on `GameState`, `SAVE_VERSION` 2 -> 3 with a
migration, and the Board's clock readout / "FINAL ROUND" status / End game
button / Pause button. 474 tests, `tsc`/`build` clean.

**Adversarial review: PASS, no HIGH, 4 MEDIUM (mutation-tested — 37 mutants
against the diff, 29 killed).** The reviewer independently probed the
fairness rule headlessly (eliminated-seat skipping, reshuffle-only-at-the-
wrap, clock-expiring-mid-round) and confirmed all three hold, matching
§9.2.2 point 1's claim that they'd fall out for free. All four MEDIUMs were
fixed before merge:

1. The clock silently stopped charging `elapsedMs` while the browser tab
   was hidden (Phaser pauses its render loop and resets its per-frame delta
   on resume) — at the time this contradicted the design's "no way to pause
   it." See the design revision below for how this was actually resolved.
2. Nothing tested that a chosen clock/round limit reached `GameState` at
   all — a mutant that made `createInitialState` ignore both new parameters
   passed the whole suite. Fixed with a direct test.
3. The undo-vs-clock preserve rule (§9.2.2 didn't ask for this explicitly;
   it's the natural consequence of "the clock survives save/load" plus
   "undo restores a whole snapshotted `GameState`") lived untested inside
   `BoardScene.restoreSnapshot`. Extracted to `turnManager.ts`'s
   `carryLiveGameClock`, now unit-tested directly.
4. A test comment on the version-2 save fixture falsely claimed it was
   hand-built rather than derived from `sampleSave()` — corrected; the
   fixture itself was already correct.

**Mid-merge design revision: §9.2.1's "no way to pause it" was overridden by
the user, after the review's MEDIUM-1 fix had just made that claim actually
true.** The user's ask, once the tab-hide behavior was visible as a real
design fork rather than a bug: tab-hide *should* pause the clock (not be
patched around with a `Date.now()`-based delta), and there should also be an
explicit manual Pause/Resume button on the Board. This is a genuine reversal
of the original settled design, not an extension of it — recorded here per
this plan's own rule about preserving wrong assumptions. What shipped
instead: `advanceGameClock` is driven by Phaser's own per-frame `delta`
again (so `update` simply doesn't fire while the tab is hidden, and
`elapsedMs` stops accumulating for free), plus a new `GameState.paused`
boolean toggled by the Board's Pause button, gating `advanceGameClock`
exactly like `gameOver` does. `paused` is carried live across undo/redo
and survives save/load the same way `elapsedMs`/`pendingGameEnd` do
(`carryLiveGameClock`, extended rather than duplicated). Folded into the
same `SAVE_VERSION` 2 -> 3 migration as the other four fields rather than
earning a fifth bump, since the branch was still unmerged when `paused` was
added — no version-3 file without it has ever shipped. This does **not**
reopen §9.2.3's "per-turn thinking limit is out of scope" — pausing is a
whole-game control (a table break, or nobody looking at the screen), not a
per-turn clock.

### 9.3 Occupancy checks that don't filter destroyed units (latent)

Destroyed units are **tombstones** — they stay in `state.units` with
`destroyed: true` rather than being spliced out, so every occupancy check
must filter explicitly. The engine does this correctly (`unitAt`,
`combat.ts:77`, and `hexesUnderZoc`, `combat.ts:573`, both skip destroyed
units, so a dead unit neither blocks movement nor projects ZOC).

Two sites do not:

- `src/ui/testMode.ts:64` and `:72` —
  `!state.units.some((u) => u.position.q === hex.q && u.position.r === hex.r)`
  with no `!u.destroyed`.

Both run at setup time when nothing is destroyed yet, so this is **latent,
not live** — recorded because it is the exact shape of bug that bites once
a caller moves. (`PlacementScene.ts:374` was also suspected but is correct:
it does filter.) Cheapest durable fix is to route them through `unitAt`
rather than hand-rolling the predicate a third time.


## 11. Combat reporting detail

**Status: ✅ Shipped** — merged to `main` as `12e1bf6`. Three review rounds.
Proven combat-neutral by trace hash: the full formatted action trace of all
100 fuzz seeds is byte-identical to the merge base, and a trial merge hashes
identical to `main` alone.

Notable catches: the ramming log claimed a table row was reachable "at max
bonus" when bonus caps at 2 — **this plan's own wrong example, copied
verbatim** (corrected in §11.3); the boarding CRT column was derived in the
scene rather than the engine; and the multi-defender terrain attribution was
untested and survived mutation. The feature also surfaced a real fidelity
divergence: the bonus interpretation reproduces the rulebook's worked example
only for table rows of *exactly* 3 entries — galère vs quintirème, the book's
own example, has a printed row of just `1`.

Mostly a *presentation* task — the numbers
were already computed and, for ramming, the needed data was already exported.

### 11.1 What already exists

`BoardScene.logCombatOutcome` (`:1744`) already prints, for land combat:
per-unit attack values with a total, per-unit defense values with a total,
the ratio label, the die roll with its terrain modifier shown as
`raw + modifier = modified` (and the clamped value when it falls outside
1-6), and the full result label. **The land-combat ask is largely already
implemented** — see §11.2 for the two genuine gaps.

### 11.2 Land combat — remaining gaps

1. **Which terrain caused the modifier.** The line reads `Die: 3 + 1 terrain
   = 4` without naming the terrain or the defender hex it came from.
2. **Which CRT column was used.** `ratioLabel` is shown, but not that it
   resolved to a specific column of `data/combatTable.ts`, nor the row the
   die landed on. Showing the column makes a surprising result auditable
   against the printed table.
3. Optional: the exchange-sacrifice threshold when `EX` occurs — the
   required force is computed (`requiredSacrificeForce`) but only surfaces
   in the prompt, not the log.

### 11.3 Ramming — show the roll needed, which is already computable

`BoardScene.promptRam`'s resolution (`:966`) currently logs only:

```
Ramming attempt (bonus +1): die 4 -> missed
```

The player cannot tell whether 4 was close or hopeless. **`rammingSuccessRange(attackerType, defenderType, bonus)`
in `data/navalRamming.ts:88` already returns the exact winning die values**,
and `promptRam` already has all three arguments in hand. So this is a
formatting change, not a rules change:

```
Ramming: trirème vs galère, bonus +1 (1 unused movement point)
Succeeds on: 1-2   (printed table row: 1-2-3-4 — entries past the first 2 are unreachable at any bonus)
Die: 4 -> missed
```

Showing both the *effective* range and the *full* table range matters here,
because the bonus-narrows-the-range behaviour is this repo's documented
interpretation of a conflict in the source material
(`navalRamming.ts:60-87`) — surfacing it in play makes that interpretation
visible rather than buried in a comment.

> **Correction.** An earlier version of the sketch above ended the
> parenthetical with *"1-2-3-4 **at max bonus**"*. **That is false, and it was
> this plan's error** — the implementer copied it verbatim despite having the
> contradicting fact in hand, and review caught it. Bonus caps at 2, so the
> effective range is at most the first 3 entries; a row's 4th and 5th entries
> are unreachable at *any* bonus. Saying "at max bonus" tells a player who
> rolls a 4 that the game mis-resolved a hit — defeating the exact
> auditability this feature exists for. Word it as "printed table row —
> entries past the first N are unreachable at any bonus".

### 11.4 Boarding — the least informative log today

`:1984` currently prints one line:

```
Boarding: die 5 -> attacker loses 2 equipment
```

Should show, for both ships: attack force and defense force entering the
combat, **equipment points before and after** (each point lost is -5 atk/-5
def per `state.ts:27`, so this is the ship's remaining fighting strength —
the "how many attackers/defenders each ship has left" the request asks for),
the die roll, and the resolved `BoardingResult`. Check `data/navalBoarding.ts`
for whether a success threshold analogous to `rammingSuccessRange` can be
surfaced too.

### 11.5 Where the logic belongs

Per `CLAUDE.md`'s hard boundary: any *derivation* (a success range, a CRT
column, a force total) belongs in `src/engine/` or `src/data/` with tests;
`BoardScene` should only format strings from values handed to it. Ramming
already satisfies this. If land combat needs the CRT column exposed, add it
to `LandAttackDetail` in `engine/combat.ts` rather than recomputing it in
the scene.

Worth extending `LandAttackDetail`/the naval result types rather than
returning ad-hoc shapes, so the fuzz harness can assert on the same fields.

### 11.6 Dependencies

- **Touches `BoardScene.ts`** — `logCombatOutcome` (~:1744), `promptRam`
  (~:966), the boarding prompt (`navalAttackPrompt`, ~:1893-2002). All
  distinct from
  [§9.1](#91-post-combat-advance-ignores-terrain-restrictions)'s `:1569` and
  from the drift cascade, but *same file*, so expect merge conflicts if run
  concurrently with either. §9.1 and Stage 2b have now shipped; future
  `BoardScene.ts` work remains the active collision risk.
- **Parallel-safe with [§8](#8-bug-units-cannot-move-through-friendly-units)**,
  which is confined to `engine/movement.ts` / `engine/navalMovement.ts`.
- No `GameState` shape change, so no `SAVE_VERSION` bump.

---

## 12. Cascading push when a unit cannot retreat

**Status: ✅ Shipped** — merged to `main` as `3c766d6`, tsc clean and 288
tests green post-merge. Reported by the user from real play: *"the unit died without
being asked to push."*

**First review: FAIL.** The implementation was correct but (a) `pushCandidates`
was exponential — 3m 44s at 20 encircled units, synchronously on the browser
main thread, i.e. a shipped hang in the very scenario the feature serves;
(b) the reported bug had no test at the decision site (`forceRetreat`) —
deleting the fix left all tests green; (c) the cascade *sequencing* was
untested in both callers; (d) the fuzzer recorded **0 pushes in 100 seeds**,
so the cascade had no fuzz coverage at all.

**Fix round: complete** (8 commits). The exponential DFS was replaced with an
O(V+E) fixpoint plus a perf regression test; tests were added at
`applyLandCombatResult` itself, at `resolveUnitRetreat`'s cascade sequencing,
and for mid-chain terrain; `pushesResolved` is now surfaced in the soak
report with a scenario that actually reaches a push.

**Second review (independent, 2026-08-07): PASS**, no blocking defects.
`tsc` clean, 288 tests. Four of five claimed mutation guards reproduced as
load-bearing. Trace-hash equivalence confirmed against the merge base:
**byte-identical action traces across all 100 default seeds** (9043 actions),
so the widening causes zero behavioral drift in the default scenario. The
reviewer also tried to prove the strict *entourée* reading vacuous and
**failed to** — archers (`range: 2, meleeCapable: false`) can legitimately be
ringed by friendlies after an `AR`, so §12.2's "nearly unreachable" is
accurate rather than overstated.

Three non-blocking findings, merged as-is and left open at the time. **All
three are now closed** — see [§12.6](#126-the-three-follow-ups). They were:

1. **MEDIUM — the `chainVisited` cycle guard is untested, and two comments
   claim it is.** In `buildRetreatChain`'s straight-line test geometry the
   mid-chain unit's only friendly neighbour is the already-excluded one, so
   it fails the `canMakeRoom` fixpoint regardless — passing stale `visited`
   instead of the grown `chainVisited` leaves every test green. A *branching*
   geometry does kill the mutant (confirmed). Fix by adding that case, or by
   softening the claims in `fuzzHarness.ts` and `fuzzHarness.test.ts`. The
   shipped code is correct; this is a coverage gap plus an inaccurate
   coverage claim — which matters precisely because this branch's premise was
   "the sequencing was untested".
2. **LOW — stale user-facing string.** `BoardScene.ts:1353` still reads
   *"X is surrounded by friendly units — click one to retreat and make
   room."* Under the widened reading it fires for a unit with one friendly
   neighbour and five enemies. The README was updated correctly ("at least
   one neighboring hex holds a friendly unit that can make room"); the
   in-game line now contradicts it.
3. **LOW — thin canary.** The push scenario yields `pushesResolved=4` over 30
   seeded games against a `> 0` assertion. Seeded, so not flaky, but any
   change to RNG consumption could drop it to 0 and read as a false
   regression.

### 12.1 The bug

`combat.ts:442` — `pushCandidates` returns `[]` the moment **any** of the six
neighbours is not a friendly unit, including an *empty* hex that is unusable
(enemy ZOC, or terrain the unit can't enter). With no legal retreat and no
push offered, `applyLandCombatResult` eliminates the unit.

### 12.2 The interpretation — decided

> `05-rules-french-original.md:239-243`: *"Une unité qui se trouve dans
> l'impossibilité de reculer... est tout simplement retirée du jeu. Le seul
> cas fait exception à la règle, lorsque cette unité est **entourée d'unités
> amies**. Dans ce cas, elle pousse une de ses pièces et prend sa place."*

The code read *entourée* literally: all six neighbours friendly. **Decision:
adopt the permissive reading** — a push is offered whenever retreat is
impossible and at least one adjacent friendly unit can make room.

Rationale, to be recorded in code per this repo's convention:

- The strict reading makes the exception nearly unreachable — it demands six
  units committed to surrounding one of your own. The fuzz harness measured
  **`pushTarget: 0` across 100 games**. A rule that essentially never fires is
  evidence of a misreading.
- The general rule's stated causes (`en bordure de mer`, `entourée de zones
  de contrôle ennemies`) are illustrative (`soit… soit…`), not exhaustive, so
  a mixed blocker set does not obviously fall under them.
- The exception's evident purpose is that a unit should not die merely
  because its **own side** is in the way. That purpose applies whether one
  neighbour or six are friendly.

### 12.3 The cascade — the part that makes this non-trivial

A pushed friendly may itself have nowhere legal to go, in which case **it
must push in turn**. The chain continues until someone reaches a legal
retreat hex. **The player chooses at every step** whenever more than one
option exists — both which friendly to push and, for each pushed unit, which
hex it retreats to.

Consequences:

1. **`pushCandidates` must widen.** Today it only accepts friendlies with
   `legalRetreatHexes(...).length > 0`. A friendly with no direct retreat but
   with its *own* viable push must now also qualify — which makes the
   predicate mutually recursive with itself.
2. **Cycles must terminate.** A pushes B, B pushes C, C pushes A — A has not
   moved yet, so it still looks like a blocked friendly. Carry a visited set
   down the chain; a unit already in the chain is not a candidate.
3. **`completePush` changes meaning.** Today it moves the pushed unit to a
   chosen hex and the pusher into the vacated one. With a cascade, the pushed
   unit's own move is resolved by the recursive step; the pusher then takes
   whatever hex was vacated.
4. **Terrain still applies at every level** — the existing
   `canEnterTerrain(terrainAt(f.position), category)` check (each pusher must
   be able to occupy the hex it inherits) must hold for every link, not just
   the first.

### 12.4 Implementation shape

`BoardScene` is already close: its push branch calls `chooseRetreat` for the
pushed unit. Making that a recursive `beginUnitRetreatChoice(pushed, onDone)`
yields retreat-or-push at every level for free, since that function already
decides which question to ask.

**But note the §6.7 lesson before copying that shape wholesale:** the elephant
drift cascade is un-drivable headlessly precisely *because* its continuation
lives in closures. This cascade has the same hazard. The engine half (which
units are viable candidates, and cycle detection) must be pure and tested;
`fuzzHarness.ts` mirrors `BoardScene`'s sequencing independently and will
need the same recursion, so keep the decision points explicit enough that
both callers can drive them.

### 12.5 Testing

The push path currently has **zero fuzz coverage** and only unit tests, which
is why this survived. Required:

- Engine tests for: single push; a 2-link and 3-link chain; a cycle that must
  terminate; terrain-blocked links; and the case that regressed here —
  neighbours that are a *mix* of friendlies and empty-but-unusable hexes.
- **Mutation-test each**, per [§6.6](#66-stage-1-outcome).
- Ideally give the harness a scenario that actually reaches a push, so
  `pushTarget` stops reading 0.

<a id="126-the-three-follow-ups"></a>

### 12.6 The three follow-ups

Merged to `main` as `c23648c`. `tsc` clean, build clean, 366 passed / 1
skipped (was 364). Independently reviewed: **PASS**, nothing above LOW — the
reviewer ran the mutation itself and confirmed the new branching test is the
only one of the 366 that dies under it, broke the scenario builder to prove
the deterministic test isn't tautological, and verified the 100-seed trace is
unchanged from `main`. Its five LOW findings are fixed in `c8a8109`; the two
that are worth remembering are recorded below.

**1 — the cycle guard, and why a straight line could never test it.** This
is the useful one, because the shape recurs: *a test can exercise a guard's
code path and still not test the guard.* In the straight-line chain
`a—b—c—d`, when the cascade recurses into `b`, the mutant (pass the caller's
`visited` instead of the grown `chainVisited`) does put `a` back in the
candidate pool — but `a` then fails `pushCandidates`'s `canMakeRoom` fixpoint
on its own merits, because in a line `a` is not adjacent to anything that can
make room except `b` itself, which is excluded. The guard's effect is masked
by an unrelated filter downstream of it.

The fix is a **branching** geometry: hang a side unit `d` off `a` that has
room of its own. Now `a` passes the fixpoint, and the visited set is the only
thing that can exclude it. Verified: the new test fails under the mutant and
the old one passes.

The specific mechanism here: **when a guard's output feeds another filter,
the test has to make the guard the only thing that can reject the input.**
That is finding 1's explanation, and independent review was right to push
back on an earlier version of this paragraph that offered it as the general
rule — it does not describe its two supposed siblings at all. §15.4's
`triremes` probe was masked by two attack values that happen to be *equal*,
with no second filter anywhere; §15.6's `cheapestSacrifice` gap had no
downstream test to be masked by.

What genuinely unifies all three is the weaker claim: **a test can exercise
a guard's code path and still not test the guard.** The operational rule that
catches all three is already recorded in §15.6 — *enumerate mutations from
`git diff`, one per changed behavioural line* — and it is the rule, not the
mechanism, that is worth carrying forward.

**2 — the stale string.** `BoardScene`'s prompt still said *"is surrounded by
friendly units"* after §12.2 widened the rule to "no retreat, and at least one
adjacent friendly can make room", so it was false in the common case and
contradicted the README. Now states the real condition plus how many units
can make room, since the next thing the player does is click one.

**3 — the thin canary, split in two.** 4 pushes in 30 seeds against a `> 0`
assertion meant an RNG-flow change would read as a defect in push code that
hadn't changed. Now:

- a **deterministic** test asserting the property the scenario exists to
  create — the freshly-built state has a unit with zero legal retreats and a
  non-empty `pushCandidates` — with no dice in it at all;
- the **soak** widened to 100 seeds (8 pushes across 8 distinct seeds,
  ~330ms more), reporting the seed spread as well as the total so coverage
  narrowing onto one lucky seed is visible.

The point is that the two now fail for *different* reasons: the first means
the builder stopped boxing the unit in, the second means self-play stopped
reaching it. The soak's failure message says so, so the next person doesn't
go hunting in `pushCandidates`.

**Two review findings worth carrying forward** (the other three were local):

- **A print pretending to be a guarantee.** The first version of item 3
  computed the seed spread, logged it, and commented that it guarded against
  coverage collapsing onto one lucky seed — while asserting nothing. The
  reviewer deleted the variable and the suite stayed green. Both numbers are
  asserted now. Worth generalizing: **a comment claiming a test defends
  something is itself a claim that has to be mutation-tested**, and this
  project has now shipped that mistake twice (see also §12's original finding
  1, two comments claiming coverage that did not exist).
- **A quote tidied into agreement with the decision made about it.**
  `combat.ts`'s paraphrase of the transcription had dropped "surrounded
  **entirely** by friendly units" — precisely the word carrying the strict
  reading that §12.2's interpretation goes on to reject. Nobody was misled,
  because the French is quoted verbatim four lines below, but it is the same
  class as §15.6's corrupt-transcription finding and the second instance in
  two branches. **When quoting a passage you are about to reinterpret, quote
  it in full or not at all** — the words that make the reading hard are the
  ones a paraphrase drops.

---

## 13. Hex coordinate tooltip

**Status: ✅ Shipped** — merged to `main` as `62892c3`. Post-merge: `tsc
--noEmit` and `npm run build` clean, 377 tests passing (374 + 3 new), and
the rendering confirmed by hand in a browser, which is the only way scene
code can be. See [§13.4](#134-outcome) for what the build decided and what
it cost.

> **Assumption flagged, and shipped unresolved.** The request arrived
> truncated — *"a tooltip display that says the coordinates of the hex
> which…"*. Built as **the hex currently under the cursor, shown on hover**,
> the natural reading for a tooltip. If the *selected* hex was meant, the
> swap is still cheap and was deliberately kept so: all display logic lives
> in `MapView`'s `showHexTooltip`/`hideHexTooltip`, so a different trigger
> calls the same pair and nothing else moves.

### 13.1 Why it earns its place

Beyond player convenience, this is a **debugging and authoring aid**. Hex
coordinates are currently invisible in-game, and several tasks in this plan
have needed them: pinning map-specific regression tests (the (4,9)
terrain-boxed hex in [§6.8](#68-stage-2a-outcome), the
(1,20)/(2,20) river pair in [§8](#8-bug-units-cannot-move-through-friendly-units)),
and reporting a bug against a specific board position. During a scripted
play-test of `main`, several minutes were lost guessing which screen pixel
corresponded to which hex. A visible coordinate removes that entirely.

Worth showing the **terrain type** alongside the coordinate for the same
reason — most of the map-derived test constants in this repo are of the form
"(q,r) is plain / plateau / marsh", and confirming that by eye is currently
impossible.

### 13.2 Implementation notes

The hard part is already done. `MapView.ts:71-80` builds one interactive
`Phaser.GameObjects.Polygon` per hex with the `HexCoord` captured in the
closure, and already wires `poly.on('pointerdown', …)` to an `onHexClick`
callback. A `pointerover` / `pointerout` pair alongside it, feeding a parallel
`onHexHover: ((hex: HexCoord | null) => void) | null` callback, follows the
existing pattern exactly.

Three things to get right:

1. **Pin it to the UI camera.** `MapView` adds a fixed HUD camera via
   `pinUIObjects` (`:180-184`). A tooltip that isn't pinned will drift and
   scale under pan/zoom — the same trap the Abandon button had to avoid
   ([§7](#7-start-a-new-game-at-any-time)).
2. **Pick a depth deliberately.** Current map: in-game prompts 20/21,
   panel background 25, `logText` 29, HUD buttons/status 30, SaveLoadPanel
   40/41, confirm dialog 50-52. A hover tooltip should sit above the HUD but
   **below the modals**, or it will float over the abandon dialog.
3. **Don't let it interfere with input.** The tooltip must not be
   interactive, or it will steal `pointerover` from the hexes beneath it and
   flicker. Offset it from the cursor, and clear it on `pointerout`.

### 13.3 Scope and dependencies

- Presentation only: `src/ui/MapView.ts` plus a small amount of
  `src/scenes/BoardScene.ts` wiring. **No engine change**, no `GameState`
  change, no `SAVE_VERSION` implication.
- Worth offering on `PlacementScene` too, which has the same `MapView` and
  where "which hex is this?" matters just as much during deployment.
- **Not parallel-safe with anything else editing `BoardScene.ts`** — see the
  queue in [Current Queue](plan.md#10-sequenced-queue).
- Little to unit-test by the repo's convention (it is scene/UI code); keep
  any coordinate-formatting helper pure if one is needed.

### 13.4 Outcome

Merged as `62892c3`; two commits, +140 lines, nothing deleted.

**The scope prediction was wrong in a useful direction.** §13.3 expected
"`src/ui/MapView.ts` plus a small amount of `src/scenes/BoardScene.ts`
wiring". The implementation needed **zero** scene code: both scenes that
show a map already construct a `MapView`, so putting the tooltip inside it
gave `PlacementScene` the feature for free and kept the pin/depth/clamp
logic in one place — which is the logic §13.2 warned would drift if
duplicated. Worth remembering for the queue's other UI items: "touches
`BoardScene.ts`" is sometimes an artefact of where a feature was first
imagined, not where it belongs.

Depth 35 as planned, above the HUD (30) and below SaveLoadPanel (40/41) and
the modals (50-52). The only unit-tested piece is `ui/hexTooltip.ts`'s pure
`formatHexTooltip`, per §13.3's own instruction not to inflate scene code
into a test suite.

**Carried, not fixed:** `MapView.onHexHover` is a public callback that fires
on every hover and that nothing consumes — the extension point for the
flagged hover-vs-selected assumption above. Speculative surface; delete it
if that assumption is ever resolved in hover's favour.

#### The verification failure, which cost more than the feature

The feature worked on the first try. **Confirming that took three rounds**,
and the cause was environmental, not a defect: four checkouts of this repo
(`heraklios`, `heraklios-stable`, `heraklios-codex`, and the agent worktree)
had three dev servers running between them, **two of them bound to port
5173**. A `localhost:5173` URL was handed over without checking for the
collision, so the first two manual tests ran against trees that did not
contain the feature at all, and both correctly showed no tooltip.

**The rule this earns:** when verifying a UI change by hand in this project,
start the server on an explicit unused port and say so —
`npm run dev -- --port 5199 --strictPort --host 127.0.0.1` — and prove the
right code is being served before asking anyone to look, e.g.
`curl -s http://127.0.0.1:<port>/src/ui/MapView.ts | grep -c showHexTooltip`.
`localhost` is ambiguous across IPv4/IPv6 when two servers contend for a
port, which is exactly the situation multiple worktrees create. Added to
[§4](plan.md#4-runbook-detailed-launch-hazards-appendix)'s hazards.

---

## 14. Decomposing `BoardScene.ts` for parallel work

**Status:** proposed, not started. Prompted by the user asking whether the
code can be refactored so tasks stop serializing on one file.

### 14.1 First, a correction: the constraint is partly self-imposed

`BoardScene.ts` is 2040 lines and most queued work touches it, so
[Current Queue](plan.md#10-sequenced-queue) has been marking items "not parallel-safe". **The
evidence does not support that being a hard blocker.** Every merge in this
project so far has auto-merged with **zero conflicts** — including
`30c23e7` (+162 lines to `BoardScene`) and `12e1bf6` (+142 lines to
`BoardScene`), which landed in different regions of the same file.

Git merges disjoint hunks fine. The risks that *are* real:

1. **Semantic conflict** — two agents independently changing logic that
   interacts, each correct alone. Textual merge succeeds and the result is
   wrong. This is the one that matters and no amount of file-splitting fully
   removes it.
2. **Review confusion** — a reviewer diffing against a `main` that moved
   under it (this happened; see §4's concurrent-reviewer warning).
3. **Line-number drift** — briefs and review findings cite `BoardScene.ts:1385`
   and similar; those rot fast when another branch inserts above them.
   **This has now happened to this document.** By 2026-08-07 that exact
   citation pointed 184 lines off (the advance filter had moved to `:1569`),
   and roughly a dozen others in §6, §9 and §11 were similarly stale after
   ~440 lines of growth. All were re-verified and corrected on that date.
   Prefer citing a *method name* plus an approximate line, never a bare line
   number.

**Cheapest immediate win, available today:** assign *region ownership* rather
than file ownership. Give each agent an explicit line range plus the method
names it owns, and forbid edits elsewhere in the file. That is already how
[§11](#11-combat-reporting-detail) and [§8](#8-bug-units-cannot-move-through-friendly-units)
ran successfully in parallel.

### 14.2 The structural fix: extract the interaction cascades

The file has clean seams, and — usefully — **every currently queued item lives
in a different one**:

Ranges are **non-overlapping and exhaustive** — that is the point, since the
near-term use is handing an agent a line range it owns and forbidding edits
outside it. Verified against `main` @ `3b15577`; re-derive with a method
index (`grep -n '^  \(private \|public \|\)[a-zA-Z_]*(' src/scenes/BoardScene.ts`)
before relying on them, since any merge shifts everything below it.

| Region | Lines | Entry points | Queued work living there |
| --- | --- | --- | --- |
| Scene shell, `create()` | 200-430 | `create`, `resetSceneState` | — |
| Small state/render helpers | 431-474 | `state`, `renderAllUnits` | — |
| Save/load, undo/redo, dice | 475-744 | `captureSave`, `undo`, `rollDie` | — |
| HUD + logging | 745-796 | `refreshStatus`, `log`, `appendLine` | — |
| Movement input | 797-874 | `onHexClick`, `selectForMovement` | [§13](#13-hex-coordinate-tooltip) tooltip |
| Naval movement + ram UI | 875-1077 | `promptRam`, `handleNavalMoveClick` | — |
| Combat group building | 1078-1203 | `toggleAttacker`, `toggleDefender` | — |
| **Retreat/push cascade** | 1204-1391 | `beginUnitRetreatChoice`, `choosePushTarget` | [§12](#12-cascading-push-when-a-unit-cannot-retreat) |
| **Elephant drift pump** | re-derive | `beginDrift` delegating to `engine/drift.ts` | [§6.7](#67-the-elephant-problem-stage-2-split) Stage 2b shipped |
| **Advance offers** | 1542-1661 | `beginAdvanceOffers`, `promptAdvanceChoice` | §9.1 shipped; future extraction candidate |
| Combat resolution + log | 1662-1892 | `resolveGroupAttack`, `logCombatOutcome` | — |
| Naval attack prompt | 1893-2001 | `navalAttackPrompt` | — |
| Phase transition | 2002-2040 | `endPhase` | — |

The bolded regions are the ones that keep colliding, and they share a
shape: **a prompt, a player decision, and a continuation** — the machinery
that already implements `PlayerAgent`. Extracting those three into their own
modules would have let §12, §6.7 and §9.1 run genuinely concurrently; after
§12, §9.1, and Stage 2b shipped, this mainly matters for future BoardScene
work.

Proposed shape — each takes a narrow context rather than the whole scene:

```ts
// ui/boardContext.ts — the only surface a cascade controller may touch
interface BoardContext {
  state(): GameState;
  mapView: MapView;
  log(msg: string): void;
  appendLine(msg: string): void;
  renderAllUnits(): void;
  rollDie(): number;
  recordAction(label: string): void;
  setDecisionPending(pending: boolean): void;
}
```

- `ui/retreatCascade.ts` — retreat/push, owns `retreatChoice` and the queue
- `ui/driftCascade.ts` — elephant drift/trample
- `ui/advanceOffers.ts` — post-combat advance

`BoardScene` keeps input routing, rendering and lifecycle, and delegates.
A narrow `BoardContext` is the point: it makes each controller's dependencies
explicit and reviewable, where today any method can reach any field.

### 14.3 Sequencing, and the honest risk

**Do NOT do this as one big-bang refactor.** `BoardScene` is the repo's
least-tested file by convention, and the last comparable refactor — Stage 1
([§6.6](#66-stage-1-outcome)) — needed two review rounds and shipped two HIGH
defects that a green suite did not catch. The fuzz harness is *not* a safety
net here: it mirrors the scene's sequencing independently and would not see a
scene-side regression.

Better order:

1. **Land the small queue first.** §12 and §9.1 have shipped; §13 is still
   small and already specified. Extracting underneath active work invites
   exactly the semantic conflicts §14.1 warns about.
2. **Extract one cascade, alone, behavior-preserving**, and verify by hand in
   the running game (the `run` path used to verify [§7](#7-start-a-new-game-at-any-time)).
   The advance-offer region is the smallest and has the fewest interactions —
   start there, not with drift.
3. **Stage 2b shipped this drift extraction** ([§6.7](#67-the-elephant-problem-stage-2-split)),
   converting a refactor with no test coverage into one the fuzz harness can
   cover because the cascade is now headlessly drivable.

### 14.4 The deeper point

Some of this file is large because orchestration that belongs in the engine
still lives in the scene — the drift cascade and post-combat advance
bookkeeping both still mutate `GameState` inline
([§6.6](#66-stage-1-outcome)'s carried-forward gap). **Every line moved into
`src/engine/` is both a line out of `BoardScene` and a line the fuzz harness
starts covering.** Splitting the scene into more scene files buys
parallelism; moving logic into the engine buys parallelism *and* test
coverage. Prefer the latter wherever a piece is genuinely rules logic rather
than presentation.

---

<a id="15-live-defect-ranged-attacks-resolve-at-zero-attack-force"></a>

## 15. Ranged attacks resolve at zero attack force

**Status: ✅ Shipped** — merged to `main` as `272bcf0`. Found while correcting a
wrong CRT worked example during [§6.9](#69-stage-3-outcome)'s review, pinned
there by a deliberately-failing-later regression test, and fixed on its own
branch because it changes live hotseat combat resolution. The original
write-up follows, then [§15.4](#154-outcome) records what it actually took.

### 15.1 The defect

`computeLandAttackDetail` sums `currentAttack(u)`, which returns
`UnitType.attack`. Plain `archers` are `attack: 0, rangedAttack: 2`
(`data/units.ts`). `rangedAttack` is read in exactly one place —
`checkRangedEligibility`, which only decides *whether* a shot is legal — and
never contributes force to anything.

So every volley from a plain archer unit resolves at **attack force 0**,
which `ratioToColumnIndex` short-circuits to column 0 (`1-5`). Five of that
column's six faces are `AE`. Measured:

```
archers @ range 2 vs fantassins:  attackForce=0  ratio=1-5  faces={AE:5, AR:1}
fantassins-archers @ range 2:     attackForce=2  ratio=2-1  faces={DR:4, AR:2}
```

**Firing an archer is a 5-in-6 chance of losing it and can never inflict
anything.** `fantassins-archers` (`attack: 2`) are unaffected, which is
presumably why this has gone unnoticed since the roster was transcribed —
the unit that exposes it is the one nobody has a reason to fire twice.

### 15.2 Why it needs a reading, not just a patch

The counter format is `attack (rangedAttack) range / defense movement`, so
`0 (2) 2 / 1 3` plainly means "no melee attack, ranged attack 2 at range 2."
The obvious fix — use `rangedAttack` as the force when the attack is being
made at range — is almost certainly right, but it is an *interpretation* and
needs the usual code comment, because the rulebook has to be checked on at
least these points:

1. **Which force applies at distance 1** for a unit that is both melee- and
   ranged-capable (`fantassins-archers`, `triremes`, `quintiremes` all have
   both). Adjacent, is it the melee value, the ranged value, or the
   attacker's choice?
2. **Whether a ranged attacker joins a combined attack at all**, and with
   which value, when the group also contains melee units at distance 1.
3. **Whether the defender may retreat into contact**, i.e. whether a ranged
   `DR` behaves like a melee one — currently it does, which may be right.

### 15.3 Scope

- `engine/combat.ts` (`computeLandAttackDetail`) or `engine/state.ts`
  (`currentAttack` gaining a distance/mode argument). Pure engine; no scene
  change, no `GameState` shape change, no `SAVE_VERSION` bump.
- **Expect the fuzz harness's numbers to move**, and check the trace hash
  deliberately rather than being surprised: `buildFuzzGameState` fields
  `p1-archers` (plain archers) and `p0-archers` (`fantassins-archers`), so
  the default soak's `combatResultCounts` will shift and every seeded trace
  will change. That is the fix working, not a regression — but it means the
  byte-identical-trace technique is unavailable for this branch, and the
  soak's own assertions should be re-derived instead.
- Worth re-running `heuristicSoak.test.ts`'s strength margins afterward: an
  EV agent currently never fires a plain archer, correctly, and will start
  to once a volley is worth something.

<a id="154-outcome"></a>

### 15.4 Outcome

Merged as `272bcf0`. `tsc --noEmit` clean, `npm run build` clean,
**357 passed / 1 skipped** against the pre-branch 347 / 1 — ten net new tests,
and the one skip is the permanent Stage 2c elephant skip in both. Reviewed
once, which found one real defect the branch made live
([§15.5](#155-review-finding-advance-after-combat-from-range)); fixed on the
branch.

**The reading held.** All three questions §15.2 raised are answered by the
rulebook once you read the counter-format footnote rather than the combat
section: "le chiffre entre parenthèses correspond à la valeur d'attaque par
projectiles ... Toutes les unités qui ont une valeur nulle en force d'attaque
par projectiles sont obligées de combattre au contact"
(`05-rules-french-original.md:78-81`) makes the parenthesized number an
*attack value*, not a flag. (1) A melee-capable shooter at contact uses its
melee value, because archer-infantry are described as having contact combat
"en outre" — additionally (`:261-263`). (2) A shooter joins a combined attack
at its projectile value, because the combining rule requires each attacker to
meet "les conditions de proximité inhérentes à leurs types d'armes" and names
archers-at-exactly-2 as its example (`:194-198`) — a *per-attacker*
condition. (3) A ranged result is an ordinary result: there is one CRT and no
ranged variant. All three are recorded at `attackForceAgainst` and in the
README's new "Shooting" section.

**The scope was wrong in one direction, and it mattered.** §15.3 said "pure
engine, no scene change." Two things fell out that it did not anticipate:

1. **A wedged board, not just a bad trade.** `exchangeSacrificeMeetsThreshold`
   priced attackers by `currentAttack` too, so fixing only the attack total
   would have left archers contributing 2 to the ratio and 0 to the EX
   sacrifice threshold. Two archers volleying at a `fantassins` is 4 vs 1 —
   the 4-1 column, whose die-6 row is EX — and with more than one attacker
   the sacrifice is a player choice. No subset of the attackers could ever
   reach a threshold of 1: `BoardScene`'s prompt can never be confirmed, and
   both `RandomAgent` and `HeuristicAgent` throw "CRT invariant violated".
   Fixed by `exchangeSacrificeForce` (the better of a unit's two attack
   values), which is exact on this roster and is pinned as exact by a test
   walking `UNIT_TYPES` — the honest fix if a future land unit ever has two
   different non-zero attack values is to thread
   `LandAttackDetail.attackerForces` through
   `PlayerAgent.chooseExchangeSacrifice`, and that test says so where it
   fails.
2. **The combat log would have lied.** It printed each attacker's
   `currentAttack`, so an archer's line would have read 0 under a total of 2.
   `LandAttackDetail` now carries `attackerForces` and the scene reads that.

**Verification.** Nine mutations, all killed: reverting `attackForceAgainst`
to `currentAttack` (5 tests), swapping its melee/ranged precedence (1 —
deliberately probed with `triremes`, the roster's only unit whose two attack
values differ, since a test written on `fantassins-archers` at 2/2 passes
with the branches inverted), reverting `exchangeSacrificeForce` (1), giving
`archers` a melee attack of 1 to break the roster coincidence (1, and it
names the offending unit id in the failure), dropping the advance adjacency
term (1), dropping the advance terrain term (1), and reverting
`cheapestSacrifice`'s pricing in each of its two branches (1 each — **both
survived until the independent review**, see
[§15.6](#156-independent-review)).

**Both soaks moved, as §15.3 predicted, and the trace-hash technique was
correctly unavailable.** Numbers re-derived rather than re-baselined:
`AE` across 100 random-agent games fell **28 → 6**; `heuristicSoak`'s
combined attacks rose **12 → 28**; and EV-vs-EV went from 35.8-6.7 (12-0) to
23.3-16.3 (7-5). Both §6.8 and §6.9 are updated above rather than left
stale — that exact staleness was a MEDIUM in §6.9's own review.

<a id="155-review-finding-advance-after-combat-from-range"></a>

### 15.5 Review finding: advance-after-combat from range

Caught reviewing the branch, fixed on it (`b78bc44`), and worth recording as
a *class* of finding rather than a one-off: **a change can be defective by
what it makes reachable, without touching the defective code at all.**

`eligibleAdvanceCandidates` filtered advance candidates on liveness and
terrain only — never distance. Confirmed with a throwaway probe rather than
by reading:

```
archer (10,5) shoots fantassins (12,5) -> force 2, ratio 2-1, result DR
archer offered advance to vacated hex? true | distance = 2
  | enemy sitting between at (11,5)? true
```

So an archer that never left its hex could occupy a hex two away, **crossing
an occupied enemy hex and its ZOC** — something no other rule in the game
permits. `HeuristicAgent.chooseAdvance` scores ground value and exposure with
no distance term, so the AI took it whenever the hex was unexposed.

**This branch did not introduce it** — an archer inside a combined group
could already reach it — but a *solo* volley used to resolve on the 1-5
column, whose only non-AE face is AR, so it could never produce the defender
retreat that triggers the offer. §15 made it DR on four faces of six. A
review that only diffed the changed lines would have passed it.

**The reading** is recorded at the function: the rulebook waives movement
points and ZOC for this advance ("sans tenir compte des limites de
déplacement qui lui sont propres ni ... des zones d'influence", `:248-254`)
and says nothing about distance, because for the attacker it was written for
there is nothing to say — a melee attacker is adjacent to the hex it just
attacked. Requiring adjacency is therefore a no-op for every melee attacker,
which is the argument for it being safe, and is pinned by a test sweeping
every melee-capable land type rather than asserting it for one.

It also narrows a second instance of the same defect that nobody had noticed:
in 'multi-defender' mode a group can vacate several hexes at once, and an
attacker in contact with defender A was being offered defender B's hex
across the board.

**Cost of the finding:** one more soak re-baseline (100-game `AE` 7 → 6) and
a third strength re-measurement, which barely moved — an EV agent rarely
wanted to walk a defense-1 archer into the contact it had just shot at.

<a id="156-independent-review"></a>

### 15.6 Independent review

Run by `heraklios-reviewer` after the branch had already been written *and
self-reviewed in the same session*. **Verdict: PASS**, 1 MEDIUM, 2
MEDIUM-LOW, 4 LOW, no HIGH. Every finding below was re-verified by hand
before being acted on; all were real.

**The self-review's blind spot was exactly where you'd expect it: the lines
it had just written.** §15's core fix touched `cheapestSacrifice`'s pricing
in three places (`combatOdds.ts`, the exact ≤12 branch and the greedy >12
branch). Reverting all three to `currentAttack` **left the entire 355-test
suite green** — two independent surviving mutations on changed lines, and the
self-review's four-mutation sweep had simply not thought to aim at them. The
consequence was not cosmetic: with archer pricing reverted, the exact search
returns `[]` for any EX group whose cheap units are archers, `HeuristicAgent`
reads `[]` as "sacrifice everything", and `evaluateAttack` then prices every
EX face at the full group value — skewing the EV of every attack that can
roll EX, silently, with a green suite. **This is plan.md §6.6's failure mode
happening to the very branch that cites §6.6.** Both branches now have a
guard that dies under that revert.

**The lesson worth keeping is about mutation coverage, not about this bug.**
A mutation sweep aimed at the *feature* is not the same as one aimed at the
*diff*. The rule going forward: enumerate mutations from `git diff`, one per
changed behavioural line, not from a mental list of what the feature does.

**And a second lesson, from re-running the sweep that way.** Four of the nine
mutations initially reported `SURVIVED` — falsely. The patch script matched
on `\n` while the files are `\r\n`, so those four never applied at all and
the harness scored an unmodified tree as a surviving mutant. It failed safe
here (a false SURVIVED gets investigated), but the same bug with a pattern
that matched the *wrong* place would have produced a false KILLED and
certified a guard that guards nothing — the exact thing the sweep exists to
disprove. **A mutation harness needs its own guard**: assert the file
actually changed (`git diff --quiet` before running the suite) rather than
trusting the patch step. Cheap, and it caught this immediately once added.

**Two of the remaining findings were claims in comments that were simply
false**, both written with confidence:

- "no-op for every melee attacker" — untrue on the drift path. A defending
  elephant on a DR drifts *before* the advance is offered, and that drift can
  trample an attacker of the same combat into a retreat, leaving it at
  distance 2 and now excluded. The behaviour is right; the universal claim
  was not.
- "both in-tree callers that assemble groups are separately policed for
  legality" — true of `HeuristicAgent`, false of `BoardScene`, whose
  `toggleDefender` splices a defender out without revalidating the attackers.
  That is a live hotseat path (target D1 and D2 with an archer that reaches
  only D1, then untarget D1) which resurrects the §15 defect for that unit,
  and is the ONE situation where `exchangeSacrificeForce`'s pricing differs
  from the real contribution. Pre-existing; queued as its own item rather
  than fixed here.

**Also corrected:** the roster-coincidence guard had a hole at exactly the
shape it exists to catch (`attack: 0, rangedAttack: n, meleeCapable: true`
passed via its `t.attack === 0` arm — real `archers` dodge it only by being
`meleeCapable: false`, so that flag is load-bearing and is now asserted);
three citation line ranges were off; and the advance passage's transcription
turns out to be **corrupt** — `:250-252` repeats "des limites de déplacement
qui lui sont propres" where the sentence needs an elided "sans tenir compte"
before "des zones d'influence". Both the code comment and the README had
quietly repaired it while quoting, which CLAUDE.md's ambiguous-passage
convention forbids; the duplication is now recorded where it is quoted.

**What the review confirmed rather than found**, worth recording because it
is what a PASS is made of: it re-read all six rulebook citations at source
and cross-checked them against `02-rules-transcription.md` and
`03-tables-reference.md`; it reconstructed `main`'s engine in place and
reproduced every documented measurement digit for digit, including §6.8's
before/after blocks and §15.5's intermediate `AE 7`; it re-ran all six
claimed mutations rather than believing them; and it could not construct a
legal in-game divergence for `exchangeSacrificeForce` via charged cavalry,
damaged ships, multi-defender mode, or the drift path.

<a id="157-the-two-follow-ups"></a>

### 15.7 The two follow-ups §15.6 left behind

Both shipped as `9f99b1a`, on `main`, after §15 merged.

**0c — combat groups were never revalidated after a removal.**
`attackerCanJoin`/`defenderCanJoin` gate *adding* to a group, and
`BoardScene` applies them faithfully on every add. Nothing re-checked after a
*removal*, and that is not symmetric: each side's legality is defined against
the other, so taking a unit out of one group can strand a unit in the other.
The review named one direction (untarget a defender → an archer that only
reached it stays in, contributing its melee 0 via `attackForceAgainst`'s
fallback). **The mirror is the same defect and was fixed with it**: deselect
an attacker and a defender only that attacker could reach stays targeted by a
group that cannot touch it.

The fix is `pruneIllegalSelections` in `engine/combat.ts` — deliberately in
the engine rather than inline in the scene, because `src/scenes/` is
untested by convention and this is precisely the class of defect that hides
there. One pass suffices, with the argument recorded at the function: a
dropped attacker reaches none of the surviving defenders, so it cannot have
been the sole support of any of them.

**0b — the reviewer agent file.** Rewritten. It had drifted into telling
every run to do two harmful things (`npx tsc --noEmit`, the
[§4](plan.md#4-runbook-detailed-launch-hazards-appendix) false-green trap; and a
`--detach` that leaves the operator's tree detached when the branch is
already HEAD) and to assert two false ones ("plan.md must not be edited",
"the item must move out of Known simplifications"). It now carries §15.6's
two lessons as instructions: enumerate mutations from `git diff` rather than
from the feature, and guard the mutation harness itself.

**An equivalent mutant, recorded so it isn't re-investigated.** Pruning
defenders against the *unpruned* attacker list survives the whole suite. It
is genuinely equivalent in 'multi-defender' for the reason above. In
'single-defender' the two would differ — `defenderCanJoin` there requires
*every* attacker to reach the target — but that difference is unreachable,
because in single-defender mode no attacker can ever be dropped (they all
already reach the one target, and removing one doesn't change what the others
reach). There is now a test asserting the prune is a no-op in that mode,
which is the real gap the surviving mutant exposed.

**And a third harness lesson, learned twice in one session the hard way.**
`git checkout -- src/` after a mutation restores to HEAD — which silently
discards *uncommitted* work in the same paths. It ate the adjacency fix once
and this entire feature once. **Commit before every mutation sweep**, without
exception. Related: the "did the patch apply?" guard §15.6 added must be
scoped to the file being patched (`git diff --quiet -- "$file"`), not the
whole tree, or one unrelated dirty file makes every mutation look applied.

**Process note (fixed in [§15.7](#157-the-two-follow-ups)).** The agent definition in
`.claude/agents/heraklios-reviewer.md` told the reviewer to run
`npx tsc --noEmit` (the false-green trap [§4](plan.md#4-runbook-detailed-launch-hazards-appendix)
documents) and to `git checkout --detach` a branch that was already the main
tree's HEAD (which would have left the operator's tree detached). Both had to
be overridden in the launch brief, along with its "plan.md must not be
edited" and "move the item out of Known simplifications" rules, neither of
which applied. **The agent file should be fixed so the next run doesn't need
the same four corrections.**


---

<a id="16-identify-which-unit-a-choice-dialog-means"></a>

## 16. Identify which unit a choice dialog means

**Status: queued** (#2). Requested 2026-08-15. A usability defect in two
existing prompts, not a rules defect — nothing resolves incorrectly, the
player just cannot always tell *which* of their units a button refers to.

### 16.1 The defect

Both post-combat choice dialogs label their rows by unit **type name** only:

- `BoardScene.chooseAdvance` (`:1779`) builds one button per candidate with
  the text `` `Advance ${unitType(unit).name}` `` (`:1811`).
- `BoardScene.chooseExchangeSacrifice` (`:2040`) builds one row per attacker
  reading `` `${selected...} ${unitType(u).name} (atk ${exchangeSacrificeForce(u)})` ``
  (`:2081`).

A combined attack of three `Cavalerie légère` therefore produces three
identical rows — "Advance Cavalerie légère" three times — with nothing on
screen tying any of them to a hex. The player picks blind, and on an
exchange that means choosing which of their own units dies without knowing
which one it is.

**This is reachable in ordinary play and is getting more common, not less.**
Combining attacks is not an edge case — the rulebook calls it "fortement
recommandé" (`05-rules-french-original.md:191-193`) — and the exchange
prompt only appears when an attack has **more than one** attacker, i.e.
exactly when duplicates are likely. `attack force` in the exchange row
partly disambiguates (a damaged unit differs from a fresh one), but two
identical healthy units of the same type are indistinguishable.

### 16.2 The task

Give each unit the dialog is asking about a short label — `A`, `B`, `C` … —
drawn **on the map over that unit's hex**, and show the same label in the
dialog row. So the exchange panel reads `☐ A — Cavalerie légère (atk 6)`
while an `A` sits on the map over the unit in question.

Applies to both prompts, which is the point of doing them together: they
have the same shape (a list of the player's own units, chosen by clicking a
row) and want the same affordance.

### 16.3 Implementation notes

- **`MapView` already has the right pattern to copy, twice over.**
  `setFacingIndicators` (`MapView.ts:347`) is the model for "draw a whole
  set of per-hex overlays, redrawn as a set" and `showMovementPoints`
  (`:313`) is the model for a single styled text overlay pinned to a hex
  (note its `uiCamera.ignore` call — a new overlay needs the same, or it
  will also draw on the fixed HUD camera). A `setChoiceLabels(labels:
  readonly { hex: HexCoord; text: string }[])` / `clearChoiceLabels()` pair
  in `MapView` is the natural shape.
- **Do not reuse `unitLabels`** (`MapView.ts:265-307`). That map is the unit
  *marker* layer, keyed by hex and wiped wholesale by `clearAllUnitLabels`
  on every `renderAllUnits` (`BoardScene.ts:631`) — a choice label put in
  there would be destroyed by the next redraw, which happens mid-prompt.
  Keep the new overlay in its own field with its own lifecycle.
- **Clear on every exit path.** Both prompts already have a `cleanup()` that
  destroys their panel objects; the labels must be cleared there too,
  including the decline path and the exchange confirm path. A leaked label
  is worse than no label: it points at a hex whose unit has since moved,
  advanced or died.
- **Labels must survive a camera pan/zoom** the same way markers do (they
  are positioned via `toScreen`, in world space, not screen space).
- Assigning letters: index order of the `candidates`/`attackers` array is
  fine and is what the dialog already iterates. Worth ordering the array
  itself deterministically if it isn't already, so the same board produces
  the same lettering twice.

### 16.4 Scope and boundaries

- **Presentation only.** No `GameState` change, no save-format change, no
  rules change, and no change to what either prompt *resolves* to. The
  engine already identifies units by `id`; this is about showing the player
  what the engine already knows.
- Per this repo's engine/presentation split, this lands in `src/ui/MapView.ts`
  and `src/scenes/BoardScene.ts` and is **not** unit-testable there — which
  makes it a good candidate for a manual pass, and a reason to keep the
  diff small.
- **Touches `BoardScene.ts`**, so it collides with anything else in flight
  there (the standing hazard in the queue).
- Related but deliberately out of scope: the same ambiguity exists in the
  *retreat* prompt only in reverse (the map highlights the hexes and the
  panel names the unit), and there the map highlight already does the job.
- Worth checking while in there: an AI seat answers both of these prompts
  without ever drawing a panel (see [§6.12](#612-stage-4-outcome)), so the
  labels must be created by the **prompt**, not by the decision, or an AI
  turn will litter the map with labels nobody asked for.


## 18. Live defect: ramming bonus narrows the table instead of extending it

**Status: ✅ Shipped.** Outcome and the four review findings on top of it:
[§18.5](#185-outcome). Reported by the user
2026-08-15 (bireme-vs-galere ramming resolving fewer die faces as
successful than expected), initially investigated and — wrongly — pushed
back on twice by this session before being confirmed against the actual
scanned rulebook page. Recorded here in full, including the mistaken
pushback, because getting an interpretation call backwards and defending it
confidently is exactly the failure mode this file's rulebook-citation
convention (`CLAUDE.md`) exists to catch, and papering over the false starts
would hide how the correct reading was actually found.

### 18.1 The defect

`src/data/navalRamming.ts`'s `rammingSuccessRange` currently does this:

```ts
export function rammingSuccessRange(attackerType, defenderType, bonus) {
  const fullRange = RAMMING_SUCCESS_DICE[attackerType][defenderType];
  return fullRange.slice(0, Math.min(fullRange.length, 1 + bonus));
}
```

— treats the printed per-matchup table row as the success range **at
maximum bonus**, and a lower bonus reveals fewer of that SAME row's
entries. For birème (attacker) vs. galère (defender), whose printed row is
`[1, 2, 3]`: 0 bonus → `[1]`, +1 bonus → `[1, 2]`, +2 (max) bonus →
`[1, 2, 3]` — capped at the row's own width no matter how much bonus is
available. This is what the user saw: 1 unused movement point (→ +1 bonus)
succeeding only on 1-2, not 1-2-3-4.

### 18.2 The correct rule, per the actual rulebook text

Read directly off the scanned page (`docs/Jeux & stratégie 06 - Heraklios -
Règles 2.jpg`, p.34 — the transcriptions in `docs/research/05-rules-french-original.md:375-386`
and `docs/research/03-tables-reference.md:60-69` both match the scan
exactly, so the transcription was never the problem):

> Selon qu'il lui reste 1, 2 (ou davantage encore) points de mouvement
> lorsque la galère rencontre la quintirème, la galère reçoit 1 ou 2 points
> de bonification. S'il lui reste un point de mouvement non utilisé, elle
> obtient 1 point de bonification. **Cette valeur augmente d'une unité pour
> la borne supérieure du jet de dé à réaliser pour que l'éperonnage soit
> réussi.** Concrètement, pour que la galère réussisse son éperonnage, le
> dé doit indiquer 1. Si la galère a un point de bonification, l'éperonnage
> sera réussi avec l'apparition de 1 ou 2 au dé. Si elle a 2 points de
> mouvement non utilisés, et donc 2 points de bonification, l'éperonnage
> sera réussi avec l'apparition de 1, 2 ou 3 au dé. Quelque soit le nombre
> de points de déplacement non utilisé supérieur à 2, on n'accordera jamais
> plus de 2 points de bonification.

The sentence in bold is a GENERAL statement, not scoped to the galère-vs-
quintirème worked example it's illustrated with: **each bonus point raises
the upper bound of a successful die roll by one**, on top of whatever the
printed table already gives at zero bonus. It is the bonus itself that caps
at +2 ("jamais plus de 2 points de bonification") — nothing in the text
caps the resulting die-range at the printed row's own width. The previous
interpretation had this backwards: it capped the *range*, when the rule
caps the *bonus that extends the range*.

Under this reading there is no conflict to paper over — the code's own
extensive comments in `navalRamming.ts` invented an "edition interpretation"
to reconcile the worked example against wider rows, and that invention was
the bug:

- **Galère vs. quintirème (the book's own worked example), row `[1]`:** 0
  bonus → succeeds on 1 (the printed row, unchanged). +1 bonus → upper bound
  1+1=2, succeeds on 1-2. +2 bonus → upper bound 3, succeeds on 1-2-3.
  **Matches the worked example exactly**, with no special-casing needed —
  the previous code's comment calling this matchup an exception ("this
  edition succeeds only on a 1 at every bonus level... not the book's
  '1, 2, or 3'") was describing its own bug, not a real discrepancy in the
  source material.
- **Birème vs. galère (the user's report), row `[1, 2, 3]`:** 0 bonus →
  1-2-3. +1 bonus → upper bound 3+1=4, succeeds on 1-2-3-4. +2 bonus → upper
  bound 5, succeeds on 1-2-3-4-5. Matches what the user described exactly.
- **A ceiling the rulebook text doesn't address, but a d6 forces:**
  quintirème vs. birème, row `[1, 2, 3, 4, 5]` — already 5 of 6 faces at
  zero bonus. +1 bonus would need upper bound 6 (succeeds on every face,
  i.e. an automatic hit), and +2 bonus has nowhere further to go (a die
  only has 6 faces). The fix needs `Math.min(upperBound, 6)`, and this is a
  genuinely new edge case worth its own test: is a ramming attempt that
  cannot possibly miss even legal/sensible under the rules, or should the
  UI say so plainly? (Almost certainly yes it's legal — nothing in the text
  suggests otherwise — this is just the first matchup+bonus combination
  where it actually happens.)

### 18.3 What needs to change

- **`src/data/navalRamming.ts`** — `rammingSuccessRange` (the core fix:
  extend the upper bound by `bonus`, capped at 6, instead of slicing the
  row to `1 + bonus` entries capped at the row's own length).
  `maxReachableRammingEntries` and `wholeRowReachableAtMaxBonus` are both
  built on the OLD premise ("some rows have entries no bonus can ever
  reach") — under the corrected rule every entry is reachable given enough
  bonus (mostly; see the die-face-6 ceiling above), so both of these likely
  become unnecessary rather than needing a new formula; confirm during
  implementation rather than assuming. `fullRammingSuccessRange` stays
  useful only as "the printed 0-bonus row," not as a distinct "wider than
  what bonus can reach" concept. Every doc comment in this file describing
  the old interpretation (`rammingSuccessRange`'s especially, which is
  several paragraphs of now-incorrect reasoning) needs rewriting, not
  patching around.
- **`src/data/navalRamming.test.ts`** — the `wholeRowReachableAtMaxBonus —
  exhaustive 16-matchup sweep` describe block (`:114-`) and the
  `rammingSuccessRange / isRammingHitWithBonus` block (`:47-`, especially
  "never exposes more entries than the printed table has, even at max
  bonus" at `:61`) encode the WRONG expected values throughout — this is
  the bulk of the implementation work, not a side effect of it. Needs a new
  case for the die-face-6 ceiling (quintirème vs. birème/galère at bonus
  ≥ 1).
- **`src/engine/combatOdds.ts`** — no logic change: `rammingHitChance`
  already delegates to `isRammingHitWithBonus` rather than re-deriving hit
  probability itself (see its own doc comment, `:427-434`, explaining
  exactly why — "so a change to it can't leave the odds quietly
  disagreeing with the resolution"), so fixing `navalRamming.ts` fixes the
  AI's odds for free. **This is also the reason the fix changes AI
  behavior**: `HeuristicAgent.scoreNavalMove`/`combatCandidates` price
  ramming via `evaluateRam`, which now sees higher hit chances for every
  matchup with any bonus — expect the AI to ram more often and value
  ramming positioning more highly than it did before. Worth a soak-test
  glance after the fix (`heuristicSoak.test.ts`), though no test there
  currently hardcodes ramming-specific numbers.
- **`src/scenes/BoardScene.ts`'s `commitRam`** (`:1474-1524`) — the
  `tableNote` sentence-selection logic (`wholeRowReachableAtMaxBonus` /
  `maxReachableRammingEntries` branches, `:1503-1516`) is built entirely on
  the old "some entries are unreachable" framing and needs to be rewritten
  around the new one (there IS still a genuinely new thing worth telling
  the player about — the die-face-6 "automatic hit" ceiling — just not the
  old "printed table row wider than what bonus can reach" framing).
- **`README.md`'s "Naval movement and combat" section** (`421-467`,
  specifically the "interpretive calls" paragraph at `451-466`) currently
  documents the OLD interpretation as this edition's deliberate,
  considered choice, with a worked-through explanation of why it diverges
  from the book. That entire paragraph is wrong and needs replacing with
  the corrected rule — this is the rare case where a "known simplification"
  /interpretation writeup wasn't a defensible judgment call, it was a
  transcription-adjacent bug that happened to get an elaborate
  justification written around it.

### 18.4 Why this got missed, and why it took three tries to find

Worth recording plainly rather than smoothing over. The first two responses
in this session verified the printed table CELL VALUES exhaustively (the
transcription, the tables-reference doc, and finally the scanned image
itself all agree on what `RAMMING_SUCCESS_DICE` should contain) and
concluded "not a bug" — technically correct about the table's cell
contents, but answering the wrong question. The actual bug is in
`rammingSuccessRange`'s FORMULA for combining a cell value with a bonus,
which no amount of re-checking the table itself would ever catch. The user
supplied the one piece of evidence that actually distinguishes the two
readings — the galère-vs-quintirème worked example, which the OLD code
already got right by construction (it's the exact matchup the interpretation
was built to match) — and asked for the same procedure to be applied
uniformly elsewhere, which is what exposed the divergence. The lesson for
next time: when a worked example and a printed table both exist, check
whether an interpretation was fitted to reproduce the ONE example given
(narrow evidence) rather than derived from the general sentence the example
is illustrating (broad evidence) — this file's own existing comments in
`navalRamming.ts` were transparent about doing the former ("This
reproduces the worked example's exact numbers... ONLY for the matchups
whose printed row has EXACTLY 3 entries"), which in hindsight was the tell.

### 18.5 Outcome

Merged as the fix described above, implemented by an agent on
`feat/ramming-bonus-fix`, then reviewed and extended in the main session.
`tsc --noEmit` clean, `vitest run` green, `npm run build` clean.

**The core fix landed exactly as §18.3 specified.** `rammingSuccessRange`
now extends the printed 0-bonus row's upper bound by `bonus`, capped at
`HIGHEST_DIE_FACE`, instead of slicing the row to its first `1 + bonus`
entries. Both rulebook checkpoints hold and are pinned by literal
(non-tautological) test cases: galère vs. quintirème `[1]` → `[1]`/`[1,2]`/
`[1,2,3]` matches the book's own worked example, and birème vs. galère
`[1,2,3]` at +1 gives `1-2-3-4`, matching the user's original report.
`maxReachableRammingEntries` and `wholeRowReachableAtMaxBonus` were removed
rather than reworked, as §18.3 predicted they would be.

**A load-bearing assumption worth recording, because the implementation
depends on it and nothing in the rulebook guarantees it.** The fix rebuilds
the range as `1..upperBound` rather than extending the actual printed array.
That is only correct because every one of the 16 printed rows happens to be
the consecutive run `1..N`. Verified by reading `RAMMING_SUCCESS_DICE`
directly; a future table edit that introduced a gap (say `[1, 3]`) would
silently break it. The 16-matchup sweep in `navalRamming.test.ts` would
catch it.

**Four review findings on top of the agent's work**, all fixed before merge:

1. **The soak-test threshold relaxation was justified with wrong numbers and
   a wrong cause** — the finding that mattered. See §19, which exists
   because of it.
2. `MAX_RAMMING_BONUS`'s doc comment still named two consumers that the fix
   had deleted, and conflated the bonus cap with the die-face ceiling. Split
   into `MAX_RAMMING_BONUS` (how much bonus can be earned) and
   `HIGHEST_DIE_FACE` (how far it can push the range), with the distinction
   spelled out — it is precisely the confusion the original bug was made of.
3. `engine/combat.ts`'s `isRammingHit` and `data/navalRamming.ts`'s
   `isRammingSuccessful` were both deleted. Pre-existing dead code, but the
   fix made them actively dangerous: an exported "did this ram hit" taking
   no bonus parameter can only ever give a wrong answer now. Their test
   coverage moved to `isRammingHitWithBonus(..., 0, ...)`, which is the same
   question asked correctly.
4. The bare `6` became `HIGHEST_DIE_FACE`, shared with `BoardScene`'s
   "this ram cannot miss" branch. `DIE_FACES` already exists but lives in
   `engine/combatOdds.ts`, and `src/data/` may not import from `src/engine/`.

**The reason this section is worth re-reading later** is §18.4's lesson
repeating one level up. §18.4 says: check whether an interpretation was
fitted to the one worked example rather than derived from the general rule.
The fix got that right. But its *own* postmortem — the soak-test comment —
then explained an inconvenient measurement by picking the available story
("aggregate noise," which this project's own history had already made
respectable) instead of measuring. Same shape, different altitude. The
correction cost one 40-seed run against both branches.

## 17. Manual step-by-step naval movement

**Status: queued** (#4). Requested 2026-08-15: the player wants to decide
each hex-step and each turn of a ship's move by hand, and wants the turn
buttons themselves to read more clearly. Not a rules defect — the engine
already computes and applies exactly the rules-legal cost for every hop —
this is a control-granularity gap, and it is exactly the "Known
simplifications" bullet already named in `README.md`:611 ("Naval movement is
destination-click, not path-drawn").

### 17.1 The gap, precisely

Today a ship move is one atomic action from the player's point of view:
click the ship, click a highlighted destination hex, and `handleNavalMoveClick`
(`BoardScene.ts:1379-1403`) fires a single `navalMove` action carrying only
`{ unitId, to }` — no facing, no path. `applyAction`'s `navalMove` case
(`actions.ts:246-270`) looks the destination up in `reachableNavalHexes`
(`navalMovement.ts:103-113`, itself a collapse of the full `(hex, facing)`
Dijkstra graph in `reachableNavalStates`, `:57-94`) and applies whichever
`{cost, facing}` was cheapest — **silently**. The player never sees or
chooses the interleaving of rotate-1-point/move-terrain-cost steps that got
the ship there, and cannot request a costlier alternate facing at a hex that
also has a cheaper one.

Rotation is the one piece of this that is **already** manual and explicit:
the `⟲ Turn` / `Turn ⟳` buttons (`BoardScene.ts:493-519`) each fire a single
`navalRotate` action, one 60° step, 1 movement point, via
`rotateSelectedShip` (`:1349-1362`). There is no equivalent single-hex
"step forward" button — forward movement only exists today as "click however
far away and let the engine solve it."

### 17.2 Design decisions made 2026-08-15

Two things were asked and answered before scoping the rest:

1. **Interaction model: step-by-step, hex by hex.** Click Turn to rotate 60°
   (unchanged), or click the single hex directly ahead of the bow to move
   forward one hex, and repeat — building the path one leg at a time,
   watching `movementLeft` debit as you go. Rejected: full-path-preview
   (plot the whole route, confirm once) and alternate-paths-to-one-hex (keep
   destination-click, just let the player pick among tied/costlier routes to
   the same hex) — both keep some or all of the "click far away" model this
   request exists to remove.
2. **Turn buttons: clearer labels/icons showing the resulting direction and
   the cost.** Not a hover preview and not a full move to a directional
   hex-grid overlay (both considered, both rejected) — the buttons stay
   buttons, they just stop reading as generic `⟲`/`⟳` glyphs. Cost is
   flat (always 1 point per 60°, `navalMovement.ts:24`), so the informative
   half of this is really the **direction**: the label should show the arrow
   the ship will be facing *after* the turn, computed live from
   `unit.facing`, not a static rotate icon. `MapView.setFacingIndicators`
   (`MapView.ts:347`, cited already in [§16.3](plan-history.md#163-implementation-notes))
   is the existing arrow-rendering primitive to reuse for the glyph.

### 17.3 What actually needs to change

**Likely no engine change at all, and that is worth confirming rather than
assuming.** `reachableNavalHexes` already contains an entry for the single
hex directly ahead of the bow, and — since no rotation is cheaper than
zero — that entry is necessarily the direct one-hop cost with the facing
unchanged. So a `navalMove` fired at exactly that hex should already resolve
to a plain forward step with today's `applyAction`, no new action kind
needed. **Before writing any UI code, prove this**, e.g. with a focused
`navalMovement.test.ts` assertion that the bow-adjacent hex's
`reachableNavalHexes` entry always has `cost === TERRAIN_EFFECTS[terrain]
.moveCost` and `facing === unit.facing` — if that ever fails (it shouldn't,
but the Dijkstra graph is general enough that a non-obvious cheaper detour
should be considered, not assumed away), the plan changes.

If confirmed, this is almost entirely a `BoardScene.ts` presentation change,
same shape as [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means):

- `refreshNavalMovementControls` (`:1320-1337`) stops highlighting the full
  `reachableNavalHexes` set in blue and instead highlights only the single
  hex directly ahead of the current facing (if reachable at all — i.e. if
  `movementLeft` covers its terrain cost).
- `handleNavalMoveClick` (`:1379-1403`) keeps working unmodified for that one
  hex once the highlight set is narrowed, since it already just fires
  `navalMove` at whatever was clicked.
- The Turn buttons get their label/icon rework from §17.2.
- `legalActions` (`actions.ts:371-397`) is **not** touched — it keeps
  enumerating every reachable hex, because that is the action surface the AI
  (`HeuristicAgent`) and the fuzz harness use, and neither goes through
  `BoardScene`'s highlight logic at all (see [§6.12](plan-history.md#612-stage-4-outcome)'s
  note that an AI seat never draws a panel). This keeps the AI's play
  strength and every existing engine test untouched — the redesign is scoped
  to *how a human clicks*, not to what's legal.

### 17.4 Open design question: distant ramming contacts

`findRammingContacts` (`navalMovement.ts:135-151`) currently reports every
reachable state whose bow would land pointed at an enemy — including ones
several hexes and several turns away — and today's orange highlight lets a
player click straight to one, auto-solving the whole approach exactly like
the blue destination-click does. Restricting movement to single steps makes
that inconsistent: the ship would have to be walked there leg by leg like
everything else, but should the game still show *where* the opportunities
are (an informational hint) even though clicking one no longer teleports the
ship? Both readings are defensible — showing nothing means the player has to
rediscover contacts by manual trial, showing a hint that isn't clickable
avoids that without reintroducing the auto-navigate shortcut. **Not decided
yet — settle this before implementing**, and settle it by asking the user
rather than guessing, since it's the same category of "what does the player
actually want to see" question §17.2 already needed the user for. The
zero-cost `Ram!` button (`:521-529`, `attemptImmediateRam`) is unaffected
either way: it only ever fires once the ship is already bow-on and adjacent.

### 17.5 Scope and dependencies

- **Presentation only, if §17.3's assumption holds** — no `GameState`
  change, no save-format change, no new engine tests strictly required
  (though the `reachableNavalHexes` confirmation test from §17.3 is cheap
  insurance and should be added regardless). Per this repo's engine/presentation
  split, the `BoardScene.ts` half is not unit-testable and needs a manual
  browser pass — expect this to join [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means)
  and [Stage 4's outstanding check](plan-history.md#612-stage-4-outcome) on the "owed manual
  pass" list.
- **Touches `BoardScene.ts`**, so it collides with anything else in flight
  there — currently nothing (Stage 3b, [§6.13](plan-history.md#613-stage-3b-outcome), is
  `engine/`-only and doesn't touch this file).
- **Placement-phase facing selection reuses the same Turn buttons**
  (`README.md`:426-429) — the label/icon rework from §17.2 lands there too,
  for free, since it's the same two buttons; worth a placement-phase line in
  the manual pass rather than assuming it inherited the change correctly.
- **`README.md`'s "Naval movement and combat" section** (421-467) and the
  "Naval movement is destination-click, not path-drawn" Known Simplification
  (~611) both describe the *current* behavior this replaces — per this
  file's own convention (`CLAUDE.md`: "When a 'Known simplification' ...
  gets implemented, move its bullet out of that section and document the
  new behavior in place"), that bullet moves into the "Naval movement and
  combat" section once this ships, rather than staying as a caveat for
  behavior that no longer exists.

### 17.6 Outcome

**Shipped, merged `3dee4e8`.** §17.4's open question was settled with the
user before implementation: distant ramming contacts stay visible as a
non-clickable hint rather than disappearing, so the player still knows an
opportunity exists without the game auto-navigating there.

§17.3's assumption held — no engine change was needed for the base case,
confirmed by a `navalMovement.test.ts` assertion added before any UI code,
per the plan.

Two adversarial review rounds:

- **Round 1: FAIL.** One HIGH defect — `applyAction`'s `navalMove` case
  preferred a ramming-contact match over a plain terrain-cost entry, so
  clicking the single bow-adjacent hex (the only hex the new UI highlights
  as clickable) could silently auto-rotate the ship and overcharge
  movement whenever that hex *also* carried a ramming contact at a
  different facing — reintroducing exactly the auto-navigate shortcut
  §17.4 exists to remove. The new engine test only checked
  `reachableNavalHexes`, never the actual `applyAction` outcome, so it
  didn't catch this. Plus two MEDIUM findings (a README bullet removed
  with backwards reasoning about what `findRammingContacts` recomputation
  can reveal; a test/commit message asserting more than the test actually
  checked) and three LOW findings.
- **Fix round:** the HIGH defect was fixed by giving the `navalMove`
  action an optional `facing` field — `applyAction` only takes the
  ramming-contact branch when the caller's pinned facing is undefined or
  matches the contact's, and `BoardScene.ts`'s forward-step click always
  pins the ship's current facing. `legalActions` (the AI/fuzz-harness
  action surface) never sets this field, so that surface stayed
  byte-identical — verified by mutation testing in round 2, not just
  asserted. The fix agent also found and fixed an adjacent defect on its
  own (the forward hex's highlight color didn't agree with the
  facing-pinned click's actual behavior) before the reviewer independently
  flagged the same thing.
- **Round 2: PASS**, with 2 LOW findings — a README sentence overclaiming
  what was and wasn't possible under the old destination-click model
  (mechanically fixed by the coordinating session directly during merge,
  since it was a one-line documentation nit), and a double-painted-hex
  presentation detail folded into the still-owed manual browser pass
  rather than fixed blind.

**One process note for future runs:** a worktree lock got confused
mid-cycle — the original implementer's worktree was still holding the
branch checked out when a fresh fix agent tried to check it out, and the
fix agent that hit that lock never resumed cleanly afterward (its own
worktree came back with a broken `core.worktree` redirect once the lock
was cleared concurrently). The coordinating session had to unlock and
remove the stale worktree by hand (checking for the `node_modules`
junction first, per [§4](plan.md#4-runbook-detailed-launch-hazards-appendix)) and
launch a second fresh fix agent rather than resuming the stuck one. No
data was lost — all commits are branch-ref-safe regardless of worktree
state — but it cost a full extra agent round-trip. Lesson: don't leave an
implementer's worktree around once its commits are safely on the branch
and review has started; clean it up as soon as the reviewer's detached
checkout no longer needs it to exist for `git worktree list` bookkeeping.

`tsc --noEmit` and `vitest run` (494/494) clean on `main` post-merge.
**A manual browser pass is still owed**, joining
[§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) and
[Stage 4's outstanding check](plan-history.md#612-stage-4-outcome) on that
list — specifically: the single blue forward hex only; dim distant hints
non-clickable; solid orange forward hex → ram prompt; a differently-faced
contact on the forward hex → plain step, no prompt (the blended
blue/orange paint in that case is untested); Turn-button glyph directions
and positions in both `BoardScene` and `PlacementScene`; buttons vanishing
at 0 movement points.

**Correction (2026-08-20), written by the session that ran the actual
Round 2 review agent:** the "2 LOW findings" tally above undercounts what
that agent reported. Its real output was 4 LOW findings, all doc-comment
staleness introduced by the very fixes described above (the `cfe5e75`
highlight fix and the `8ee285a` README fix), and as of this note **none of
the four have been fixed**:

1. `README.md:456-457` still says "clicking one of those distant hexes
   directly is a no-op" — false since `cfe5e75`: a differently-faced
   contact on the forward hex is now clickable and resolves as a plain
   forward step, not a no-op.
2. `src/scenes/BoardScene.ts:1344`'s doc comment still says
   "`handleNavalMoveClick` rejects a click on any of these [distant
   hints]" — same staleness as #1, for the same reason.
3. `README.md:461` ("a hint's displayed bonus is computed from the
   cheapest route...") contradicts `README.md:687` ("the hint itself is a
   highlight only, carrying no bonus figure") — `8ee285a` corrected 687 but
   left 461 saying the opposite.
4. `src/scenes/BoardScene.ts:1338-1339`'s doc comment says the forward hex
   is highlighted "orange if it's ALSO a ramming contact" without
   specifying "at the ship's current facing," which has been the actual
   condition since `cfe5e75`.

The "mechanically fixed... one-line documentation nit" bullet above refers
to a *different*, earlier finding (labelled LOW-A, fixed as `8ee285a`) that
predates and is distinct from all four of these — it was not double-counted,
it just isn't part of this list. All four are tracked as an owed follow-up
in `plan.md`'s Current Snapshot rather than re-opening this already-merged
section.

---

## 20. Live defect: a unit that starts its move already inside an enemy ZOC can't move at all

**Status: shipped.** Fixed as `9d7b38a`, reviewed PASS in the coordinating
Codex session, fast-forwarded to `main`, and pushed to `origin/main`.

### 20.1 The report

An elephant at `(6,3)` with enemies at `(5,3)`, `(5,4)` and `(5,5)`, 4
movement points, could not move to any hex at all — including `(7,2)` and
`(7,3)`, which the user expected to be legal since neither sits in any
enemy unit's ZOC.

### 20.2 What the rulebook says

`docs/research/02-rules-transcription.md:99-102`:

> A unit that starts a movement phase already inside an enemy ZOC may not
> move directly to a different hex still within that same ZOC — it must
> first exit the ZOC entirely, then may re-enter (and immediately stop
> again) elsewhere.

The French original (`docs/research/05-rules-french-original.md:136-138`)
agrees. Read plainly, this forbids exactly one thing: sliding from one
ZOC-covered hex straight to another ZOC-covered hex without a hex of daylight
between them. It does **not** forbid moving to a hex outside all enemy ZOC
coverage — reaching such a hex *is* "exiting the ZOC entirely," which the
rule explicitly allows as the first leg of a longer move.

### 20.3 What the code actually did

`reachableHexes` computed `startedInZoc` and then, inside the BFS loop:

```ts
// A unit that began its move inside an enemy ZOC may not shuffle to
// another hex still within that same ZOC without first leaving it.
if (currentKey === startKey && startedInZoc) continue;
```

That `continue` fired on the very first iteration (`current ===
unit.position`) and skipped the entire neighbor-expansion loop for that
iteration — so the BFS frontier was emptied without ever visiting a single
neighbor. The comment described the correct rule ("may not shuffle to another
hex still within that same ZOC"), but the code implemented "may not move to
*any* hex, full stop," which was strictly more restrictive than the rule.

### 20.4 Reproduction

Verified directly against the shipped map and `hexesUnderZoc`/`reachableHexes`
(scratch test, not committed):

```
(6,3) terrain=plain   (5,3) terrain=plain   (5,4) terrain=plain
(5,5) terrain=plain   (7,2) terrain=steep-flank   (7,3) terrain=plain
zoc contains (6,3)? true
zoc contains (7,2)? false
zoc contains (7,3)? false
reachable: []
```

`(6,3)` is confirmed under enemy ZOC (adjacent to both `(5,3)` and `(5,4)`,
per `DIRECTIONS` in `hex.ts`); `(7,2)`/`(7,3)` are confirmed clear of it;
`reachableHexes` returned an **empty** map regardless — the elephant was
completely immobilized, matching the user's report exactly. `(5,5)` is not
actually adjacent to `(6,3)` (hex distance 2), so it isn't a factor —
`(5,3)` and `(5,4)` alone already put the elephant in ZOC.

### 20.5 Outcome

The shipped fix reads "that same ZOC" narrowly: not "any enemy ZOC coverage"
but **the specific set of enemy units projecting ZOC onto the start hex.**
`enemyZocProjectorsForHex` returns the ids of every non-naval enemy unit
adjacent to a given hex (river-blocked adjacency excluded, matching
`hexesUnderZoc`'s own rule); `reachableHexes` computes this set once for the
unit's start hex, and its per-neighbor loop blocks a direct first step only
into a hex that shares **any** projector with the start hex — not into every
ZOC hex in general. A hex covered by a *different* enemy's ZOC (no projector
overlap with the start hex) is a legal direct first step under this reading.

That was a real interpretation choice beyond §20.2's literal text, which
doesn't disambiguate "same ZOC" between "the same projecting unit(s)" and
"ZOC coverage in general." The user explicitly accepted this reading during
review ("it is ok"). `straightLineMoveCost` (the charge-cost helper) got the
equivalent fix, closing the analogous gap for charge evaluation; naval
movement's separate code path in `navalMovement.ts` was not touched because
naval ZOC is presently not modeled at all.

Two new `movement.test.ts` cases (`reachableHexes — starting in enemy ZOC`)
cover: the reported elephant scenario (exits to `(7,2)`/`(7,3)` directly,
reaches `(6,4)` via a two-step exit-and-re-enter route, still can't reach
`(6,2)` directly) and a minimal single-enemy case proving the
direct-shuffle-within-the-same-ZOC prohibition still holds.

Review found no blocking issues. The only noted open question was the
"same projecting unit(s)" interpretation above, which the user approved.
`npm.cmd run build` and `npm.cmd test` were both clean on `main`, with
496/496 tests passing.

---

## 23. Live defect: elephant drift hides the combat report

**Status: shipped.** Fixed on `fix/elephant-drift-combat-log` and merged
back to `main` in the coordinating Codex session.

### 23.1 The report

When an elephant was attacked and forced to retreat, the log shown to the
player started with the drift narration:

```text
Elephants is forced to retreat - instead it drifts!
Direction die: 1 - 4 hex(es) of movement to go.
...
```

The normal combat report had disappeared. The missing information was the
attack force, defense force, ratio, combat die roll, and CRT result.

### 23.2 What the code actually did

`executeLandAttack` correctly called `logCombatOutcome` before starting the
retreat/drift queue, so the combat report existed briefly. The problem was
in `BoardScene.beginDrift`: it initialized `driftState.lines` as an empty
array. The first `appendLine` from `resolveElephantDrift` then replaced the
panel with the drift narration, erasing the combat block the user needed to
audit the result.

A related presentation gap already existed for trample combats during a
drift. The drift engine emitted a full `LandAttackDetail` through
`onCombat`, but `BoardScene` compressed it into one terse line rather than
using the same multi-line combat formatter as ordinary attacks.

### 23.3 The fix

`beginDrift` now seeds the drift narration with the current combat-log text
when no explicit `existingLines` are supplied. That preserves the original
attack report before the "forced to retreat - instead it drifts" line is
appended.

`logCombatOutcome` was split into a reusable `formatCombatOutcome` helper.
Ordinary attacks still log exactly the same block, and drift-trample combats
now append that same force/ratio/die/result block after the trample context
line.

This is presentation-only: no engine rules, save format, or drift state
machine behavior changed.

### 23.4 Outcome

`npm.cmd run build` passed on the branch before merge. No browser pass was
run in this session, so the verification is compile/build coverage plus code
inspection of the log flow.

---

## 22. Naval movement: show remaining range, and let a distant hex auto-path there, alongside manual stepping

**Status: queued, not started.** Requested by the user directly
(2026-08-21): show visually how far a ship can go with its remaining
movement points, and allow clicking any hex in that range to move there —
resolved to a coexistence design after discussion (see below), not a full
revert.

### 22.1 The request and its tension with §17

Read this before touching `BoardScene.ts`'s naval movement code — the
request as first stated ("show the full range, click any hex in it to get
there") is, almost word for word, the **pre-§17 destination-click model**:
click the ship, every reachable hex lights up, click one, the engine
silently solves whatever rotation/movement combination is cheapest to get
there. [§17](plan-history.md#17-manual-step-by-step-naval-movement) replaced
exactly that model, at the user's own prior request (2026-08-15), because
the destination-click model hid the rotate/move interleaving from the
player — the shipped replacement is manual, single-step: Turn buttons
rotate 60° one click at a time, and only the single hex directly ahead of
the bow is highlighted/clickable, built leg by leg. Two design alternatives
that would have kept some of the old convenience — full-path-preview, and
picking among alternate routes to one hex — were explicitly **rejected** at
the time for that reason (plan-history.md §17.2).

**Confirmed with the user (2026-08-21): coexistence, not a revert.** §17's
manual single-step forward click stays exactly as it is, unchanged. This
task *adds*, alongside it: (a) a visible indicator on every hex in the
ship's full remaining-movement range showing how many movement points would
be left if the ship ended its move there, and (b) the ability to click any
of those hexes (not just the immediate forward one) to move there directly
in one atomic action — restoring the old auto-solved-path convenience as an
*option*, not the only way to move.

### 22.2 What's already there, engine-side (no change expected)

`reachableNavalHexes` (`engine/navalMovement.ts:103`), built from
`reachableNavalStates`'s full `(hex, facing)` Dijkstra graph (`:57`), already
computes the cheapest `{cost, facing}` to reach *every* hex the ship can get
to this turn — this is the exact data source the pre-§17 destination-click
UI used, and it is still computed today: `refreshNavalMovementControls`
(`BoardScene.ts:1349`) calls it every refresh, just narrows the *display and
interaction* down to the single bow-adjacent hex (`BoardScene.ts:1370-1376`).
So both new pieces of this feature should be readable directly off data
that already exists — no `GameState` or `applyAction` change expected,
consistent with §17.3's finding that this whole feature area is UI-only.

### 22.3 What needs to change in `BoardScene.ts` / `MapView.ts`

1. **Remaining-movement-points indicator.** For every hex in `reachable`
   (the full `reachableNavalHexes` map, not just the forward one), show
   `ship.movementLeft - cost` as a small numeric label. Needs a new
   `MapView` primitive — a per-hex text-label layer, cleared and redrawn on
   every `refreshNavalMovementControls` call, the same lifecycle already
   used for `highlightHexGroups` and (per [§21](plan.md#21-elephant-drift-pause-between-steps-and-show-the-drift-direction-on-the-map))
   `driftArrowGraphics`.
2. **Highlight the full range**, visually distinct from the existing
   forward-hex highlight — the player needs to tell "the one manual-step
   hex, unchanged" apart from "any of these, new auto-path click" at a
   glance. A third color/alpha alongside the existing blue-forward /
   orange-contact scheme (`refreshNavalMovementControls`,
   `BoardScene.ts:1369-1381`) is the natural fit.
3. **Widen `handleNavalMoveClick`'s guard.** It currently early-returns for
   anything but the forward hex (`BoardScene.ts:1473`:
   `if (hex.q !== forwardHex.q || hex.r !== forwardHex.r) return;`). For a
   hex beyond the forward one, fire `navalMove` with `to: hex, facing:
   dest.facing` — the cheapest route's own ending facing from
   `reachableNavalHexes`, i.e. let the engine resolve rotation freely for
   *that* click, same as pre-§17. **Do not touch the forward-hex click's
   existing behavior** — it must keep pinning `facing: ship.facing`
   (`BoardScene.ts:1477`), which is precisely the fix for §17 review's
   HIGH-1 defect (a forward click silently auto-rotating onto a
   differently-faced ramming contact). The two clicks are allowed to resolve
   facing differently on purpose: "the one immediate hex, no-turn" vs. "some
   other hex, however the engine gets there."

### 22.4 Design decision — distant ramming-contact hexes stay non-clickable hints

**Settled with the user (2026-08-21): keep §17.4's non-clickable-hint
treatment as-is, unchanged by this feature.**
[§17.4](#174-open-design-question-distant-ramming-contacts)
deliberately decided that distant ramming contacts stay non-clickable dim
hints, specifically to prevent "click straight to a ram, auto-solving the
whole approach" — the exact shortcut §17 existed to remove for ramming. This
task's click-any-hex affordance applies only to plain reachable hexes;
every hex `findRammingContacts` reports keeps its existing behavior exactly
as it is today (solid-orange forward-hex-only ram click, dim non-clickable
hint everywhere else) — **not** touched or reopened by this feature.

### 22.5 Scope

Presentation-only: `BoardScene.ts` (`refreshNavalMovementControls`,
`handleNavalMoveClick`), `MapView.ts` (range labels + a third highlight
color). No `GameState`/save-format change expected. Joins the existing owed
manual-browser-pass list (see Current Snapshot) — this is inherently a
visual/interaction change `tsc`/`vitest` can't confirm looks or feels right.

### 22.6 Outcome

**Shipped, merged `b02a96c`.** Implemented as scoped: §17's forward-hex
manual click is unchanged, every hex in `reachableNavalHexes` gets a
`movementLeft - cost` badge (`MapView.setRangeLabels`/`clearRangeLabels`),
non-contact reachable hexes beyond the forward one highlight teal and are
clickable to auto-path there (`facing: dest.facing`, engine-resolved), and
every ramming-contact hex keeps its exact pre-existing behavior per §22.4.
No engine/`GameState` change was needed, confirming §22.2's expectation.

Two review rounds:

- **Round 1: PASS**, with one MEDIUM and two LOW findings. The MEDIUM —
  the ramming-contact click-guard exclusion (`contactHexKeys.has(...)` in
  `handleNavalMoveClick`) had zero test coverage; removing that guard line
  entirely still left all 496 tests passing, a surviving mutant on exactly
  the regression class this feature was built to avoid (a widened click
  guard silently letting a click auto-path into a ram). Fixed by extracting
  the guard's decision logic out of `BoardScene.ts` (which cannot be
  unit-tested in this repo at all — importing it under vitest's node
  environment throws `ReferenceError: window is not defined` from inside
  Phaser) into two plain, Phaser-free functions in `engine/navalMovement.ts`:
  `navalContactHexKeys` and `resolveNavalAutoPathClick`, both re-exported
  from `engine/movement.ts` alongside the module's other naval-movement
  functions. Both scene call sites became thin wrappers with no
  independently-derived guard logic left to drift out of sync. Five new
  tests, including the exact "reachable at one facing, contact at a
  different facing" trap scenario, mutation-tested by both the implementer
  and, independently, round 2. The two LOW notes (an overstated
  "byte-for-byte unchanged" doc claim, and comments citing this section
  before it was committed) were reworded/accepted as no-action-needed.
- **Round 2: PASS**, no outstanding findings. Independently re-verified the
  refactor genuinely removed all duplicated guard logic from `BoardScene.ts`,
  confirmed by construction that `resolveNavalAutoPathClick` and
  `applyAction`'s `navalMove` case cannot disagree (the auto-path resolver
  only returns non-null for a hex with zero ramming contacts, so
  `applyAction`'s contact-priority branch can never fire for a hex it
  resolved), re-ran the mutation test from scratch (same two tests fail,
  restore, green again), confirmed the "trap" test is a real trap rather
  than a vacuous pass, and confirmed `legalActions`/the AI action surface
  remain untouched.

`tsc --noEmit` and `vitest run` (501/501) clean on `main` post-merge.
**A manual browser pass is still owed**, joining the existing list — this
is inherently visual/interaction code no automated check can confirm looks
or feels right.

---

## 21. Elephant drift: pause between steps and show the drift direction on the map

**Status: queued, not started.** Requested directly by the user
(2026-08-21). Presentation-only — no rules change.

### 21.1 The problem

`BoardScene.beginDrift` (`BoardScene.ts:160`) drives `resolveElephantDrift`
(`engine/drift.ts`) as a synchronous pump: a drift that tramples through
several hexes, or cascades into a nested re-drift or a trampled unit's own
drift (§6.7's `AR`/`DE`/`DR` cases), resolves start-to-finish
in one call before the board re-renders. The player sees only the elephant's
final hex and a wall of narration text appended via `logDriftLine`
(`BoardScene.ts:1247`) — not the path it took or which direction it drifted
at each step. There is currently no visual indicator of drift direction on
the map at all.

### 21.2 Design questions

1. **What "pause" means.** Likely a per-step wait for explicit player
   input (click / key / a "Next" affordance) rather than a fixed timer —
   consistent with how retreat/advance choices already block on the
   player. Needs a decision on the exact UI (e.g. reuse the existing choice
   dialog affordance vs. a lighter "continue" prompt).
2. **Must not regress headless/AI play.** `resolveElephantDrift` is called
   from the same code path during AI-vs-AI turns and is the exact function
   the fuzz harness and heuristic soak drive directly
   (`fuzzHarness.ts`, `drift.test.ts`) — those must keep resolving a drift
   in one synchronous call with zero pauses. The pause/visualization is a
   `BoardScene` (human-seat presentation) concern only; it must not leak
   into `engine/drift.ts`'s pure step function or slow down soak runs.
   Likely means gating the pause on whether the drifting elephant's owning
   seat (or the observing seat) is human, the same way other
   presentation-only choices already key off seat type.
3. **How to visualize direction.** Needs a per-step marker on the map (e.g.
   an arrow or highlighted hex-edge showing the rolled drift direction)
   drawn in `MapView.ts` before each step's move/trample resolves, then
   cleared or advanced on the next step. Should reuse whatever hex-highlight
   primitives `MapView.ts` already has (see §13's hex tooltip work for
   precedent) rather than introducing a new rendering path.
4. **Log interaction.** `logDriftLine` currently appends all of a drift's
   narration as one block after the fact. Pausing per step means the log
   should append (and the player should see) each step's line as that step
   happens, not all at once at the end.

### 21.3 Scope

Presentation-only: `BoardScene.ts` (`beginDrift` and the drift queue
draining around it), `MapView.ts` (direction marker rendering). No engine
rule change — `engine/drift.ts`'s `driftStep`/`resolveElephantDrift` pure
step function should not need to change shape, only how `BoardScene` calls
it (step-by-step with a pause, instead of pumping to completion). Verify by
hand in a browser (see [§4](plan.md#4-runbook-detailed-launch-hazards-appendix)'s
port-pinning note) since this is inherently a visual/UX change; `tsc`/
`vitest` can confirm the soak and fuzz harness still see zero pauses but
cannot confirm the pause/visualization itself looks right.

### 21.4 Outcome

**Shipped, merged `1d6666f`.** A human seat's own turn now pauses on every
drift-cascade event (direction roll, each hex entered, each trample, a
nested re-drift) behind a "▶ Continue" affordance (button, bare map click,
Space, or Enter), with an arrowhead on the elephant's current hex showing
the direction it just rolled — reusing `drawFacingArrowhead`, the same
primitive naval facing uses. A fully computer-played turn never pauses,
resolving the whole cascade at the same speed as everything else the
computer does — `engine/drift.ts`'s `driftStep` gained an optional
`onStep` hook, awaited only when present, so every existing headless caller
(fuzz harness, soak tests, AI-vs-AI turns) sees byte-identical events/stats
with zero added delay.

**This took four rounds of adversarial review, all chasing the same
underlying bug class**, and is worth reading in full before touching
`driftStep` again:

- **Round 1: FAIL (CRITICAL).** `driftStep`'s free-run loop batched an
  entire uncontested multi-hex drift into one call before ever returning —
  so a paced elephant was already at its final hex by the first pause,
  defeating the feature's entire purpose. None of the first pass's 4 tests
  checked an *intermediate* pause position, only before-any-pause and
  after-all-pauses.
- **Round 2: FAIL (CRITICAL, new).** The plain free-run fix was correct, but
  the same bug survived in two more resumption paths (`DE` combat result,
  `continueAfterVacated` resume after a trample) that fell through into the
  shared loop instead of returning.
- **Round 3: FAIL (CRITICAL, new again).** Fixing those two surfaced a
  systematic sweep request; it found two *more* surviving instances (`AE`/
  `EX` combat result, `eliminatedLeavingLandZone`), both only reachable when
  the currently-resolving elephant is itself a nested trampled unit beneath
  an outer `continueAfterVacated` frame.
- **Round 4: PASS.** The implementer's own self-audit (requested after
  round 3) found and fixed a *third* new instance (the `stopped` branch)
  before the reviewer ever saw it, then produced a full enumeration of
  every `elephant.position`/`elephant.destroyed` mutation site. The
  reviewer did not trust that table — it re-derived the same enumeration
  from scratch by grepping every mutation site directly (there are exactly
  4, all now followed by an explicit `return`) and independently
  reproduced the two trickiest "safe by construction" fall-through cases
  with its own scenarios rather than the implementer's cited examples.

`tsc --noEmit` and `vitest run` (512/512) clean on `main` post-merge.
**Merge conflict note:** this branch was forked from `main` before
[§23](#23-live-defect-elephant-drift-hides-the-combat-report)'s live-defect
fix (full combat report on drift-trample combats via `formatCombatOutcome`)
merged — both touched `BoardScene.beginDrift`'s `onCombat` hook. Resolved by
keeping §23's `onCombat` body from `main` and adding only this branch's
`onStep` hook alongside it; the two changes are independent (pacing vs.
report content) and compose cleanly. A manual browser pass is still owed,
joining the existing list — inherently visual/UX code no automated check
can confirm looks or feels right.

---

## 25. Live defect: Save / Load panel labels overlap action buttons

**Status: shipped.** Reported directly by the user (2026-08-21).
Presentation-only. Fixed in `cc29f1f`, reviewed PASS, then merged after
`main` had advanced past §21.

### 25.1 The problem

`SaveLoadPanel.buildRow` laid out each row with the save description at
`left + 90` and the first row action button at `left + 400`. The description
text was built from `describeSave(save)` plus `formatSavedAt(save.savedAt)`;
with long army names, controller labels, or timestamps, that text could extend
past the implicit 310px label area and draw underneath the Save, Load, or
Delete buttons.

The result was visually ambiguous: the player could not easily read the saved
game's name/summary, and the row actions appeared on top of the label.

### 25.2 Scope

Presentation-only: `src/ui/saveLoadPanel.ts`. Reserve a real label column
before the action buttons, and constrain the save-description text so it
cannot overlap controls. Prefer truncation with an ellipsis or Phaser text
wrapping/clipping that preserves a single stable row height; do not change the
save data format or `describeSave`.

This should work in both panel modes:

- Board/manage mode: manual slots show Save, Load, and Delete; autosave shows
  Load and Delete.
- Menu/load mode: rows show Load only, but long labels still need a bounded
  readable area.

### 25.3 Verification

Create or simulate a save whose description is long enough to approach the
buttons, then verify in a pinned-port browser session (see [§4](plan.md#4-runbook-detailed-launch-hazards-appendix))
that no row label overlaps the Save, Load, or Delete buttons. `npm run build`
is enough for compile coverage; this is mainly a visual layout fix.

### 25.4 Outcome

**Shipped, fixed `cc29f1f`, reviewed PASS.** `SaveLoadPanel` now names the
row geometry instead of relying on raw offsets: the slot name column is 90px,
the action column starts at 400px, and the save description receives a
fixed-width/fixed-height Phaser `Text` box with a 16px gap before the action
buttons. Long descriptions are clipped inside that text canvas instead of
drawing underneath Save, Load, or Delete. The save format and `describeSave`
were deliberately unchanged.

`npm.cmd run build` and `npm.cmd test` (31 files, 501 tests) passed in both
the implementation pass and the independent reviewer pass. The reviewer found
no defects and specifically checked that the geometry covers both Board/manage
mode and Menu/load mode.

**Residual verification note:** the browser session confirmed the dev server
was pinned to `127.0.0.1:5199` and served the edited source, but the attempted
long-save visual setup was blocked by browser/localStorage/file-upload safety
controls. Static review confirms Phaser's fixed-size text cannot draw under
the buttons, but a manual pinned-port browser pass with a real long save is
still the only full end-to-end visual proof.

---

## 19. The lookahead tier is blind to ramming, and that now costs measurably more

**Status: shipped, merged `10a7c21`, one open MEDIUM finding (see §19.5).**
Surfaced by [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)'s
ramming fix during review, measured, and deliberately not fixed in that
branch — the fix is a rules correction and this is an AI-tuning question,
which are different jobs with different review bars.

### 19.1 The gap

`HeuristicAgent.cloneAfterDeterministicMovementAction` returns `null` for a
`'ram'` action, so the `'lookahead'` tier's threat probe never prices a ram
an enemy could make in reply. That is a deliberate, documented choice — a
ram's outcome is a die-roll distribution, and cloning "after" it would mean
committing to an arbitrarily chosen hit or miss, which is worse modelling
than not probing at all. It was disclosed rather than hidden (see that
function's own doc comment, and plan-history.md §6.13's posture on it).

What changed is the price. §18 made ramming hit substantially more often at
every bonus level, and `'lookahead'` is the only tier that prices movement
risk by probing enemy replies — so it is the only tier that is now blind to
a threat that got materially stronger. Every other tier is blind to *all*
reply threats and loses nothing by comparison.

### 19.2 What was measured

40 seeds, both seat assignments (80 games per build), `'lookahead'` vs
`'ev'` surviving army value, run against `main` and against the §18 branch:

```
             seat 0    seat 1    pooled    ram hit rate
  pre-fix     +3.17%    +1.67%    +2.64%    49.4% (80/162)
  post-fix    -3.27%   -10.28%    -5.40%    70.2% (80/114)
```

Lookahead led on both seats before and trails on both after. Rams resolved
fell 162 → 114 for the same 80 hits: ships die faster per attempt now, which
is what an unpriced threat costs.

**Read this before treating it as proven.** 29-37 of the 40 seed-pairs end
in an exact tie, so the margin rests on a handful of games, and block-level
signs still flip post-fix. The *direction* is consistent across both seats
and has a named mechanism that predicts it; the *magnitude* is not pinned
down. This is "a real effect with a plausible cause, size unknown," not a
measured regression — and this project has now burned six review rounds on
over-claiming exactly this comparison (plan-history.md §6.13–§6.18), so the
bar for claiming an ordering here is high and deliberately unmet.

### 19.3 Options, in preference order

1. **Price a ram by its expected value rather than cloning it.** The threat
   probe wants a number, not a board — and `combatOdds.ts`'s `evaluateRam`
   already returns exactly that number, as a proper distribution over six
   faces. `enemyThreatAgainstUnit` could take the max over `'ram'` candidates
   targeting the unit without ever cloning past the roll. This looks like
   the right answer and is a smaller change than the original "clone a ram"
   framing implied.
2. **Leave it, and say so in the code.** Legitimate: the tier is labelled
   "cautious," not "expert," precisely because it does not claim aggregate
   strength. If so, `cloneAfterDeterministicMovementAction`'s comment should
   record that the gap's cost went up in §18 and was accepted, rather than
   still reading as a neutral modelling choice.
3. **Re-measure at higher seed counts first.** 160 seeds in 4 blocks is the
   protocol plan-history.md §6.14/§6.15 established for this exact
   comparison. Cheap (the 40-seed run took ~11s per build) and would settle
   whether option 1 is worth doing at all.

### 19.4 Scope

Engine-only: `heuristicAgent.ts`, `heuristicSoak.test.ts`,
`heuristicAgent.test.ts`. No scene, no rules, no save format. Any change
here must come with a targeted, mutation-verified test — the aggregate soak
is too noisy to be the evidence, which is the standing lesson from
plan-history.md §6.14.

### 19.5 Outcome

**Shipped, merged `10a7c21`, reviewed PASS with one open MEDIUM finding.**
Took §19.3 option 1: `heuristicAgent.ts` gained `enemyRamThreatAgainstUnit`,
a separate, non-cloning term maxed into `enemyThreatAgainstUnit` alongside
the existing land/boarding reply-threat, using `combatOdds.ts`'s
`evaluateRam(...).expectedValue` over `findRammingContacts` results —
`cloneAfterDeterministicMovementAction`'s existing `null`-for-`'ram'` branch
was deliberately left untouched (it covers a different case, the mover's own
hypothetical ram, not the enemy's reply).

The review independently confirmed the structural reason a simpler fix
couldn't work: `enemyThreatAgainstUnit` fakes an enemy *combat* phase to
enumerate reply actions, but `'ram'` is only ever a *movement*-phase action
(`actions.ts`'s `legalActions`), so no amount of cloning into a combat phase
could ever have surfaced one — the new term had to be genuinely separate,
not a fix to the existing clone path. The new test's mutation-proof was
independently reproduced by the reviewer (not just re-read): the ram-pricing
call was independently commented out, the new test was confirmed to fail,
then the file was restored and the full suite (513 tests) confirmed green
again.

**Open MEDIUM finding, not yet fixed:** `enemyRamThreatAgainstUnit` reads the
threatening enemy ship's *current* `movementLeft` rather than its full
per-turn allowance. Since `resetMovementForActivePlayer` only restores a
ship's movement at the start of *its own* owner's next movement phase, a ship
that already spent movement earlier in the round reads as posing no ram
threat at probe time — even though the same threat exists once that ship's
movement genuinely resets. The reviewer verified this empirically (a raider
with `movementLeft: 0` collapses `'lookahead'` onto the same exposed hex
`'ev'` picks, i.e. zero threat detected, on the identical geometry the
shipped test proves the code *can* detect at `movementLeft: 1`). Not vacuous
— alert raiders often do hold reserved movement, per
`rammingBonusFromUnusedMovement`'s incentive — but narrower coverage than the
plan's "next turn" framing implies, and undisclosed in the shipped code's
comments (unlike `cloneAfterDeterministicMovementAction`'s own documented
gap). Minimal fix: clone the enemy unit with its full movement allowance
before calling `findRammingContacts`, or document the staleness the way the
`'ram'`-clone gap is already documented.

A single, uncommitted 40-seed re-measurement (§19.2's exact protocol) found
pooled **+8.57%** (seat0 +0.41%, seat1 +19.77%, ram hit rate 80/111) versus
§19.2's post-§18/pre-fix **-5.40%** — consistent with the fix's intended
direction but explicitly one data point, not a settled magnitude, per the
standing caution in plan-history.md §6.14/§6.15 against over-claiming this
exact comparison. `heuristicSoak.test.ts`'s committed 12-seed regression-guard
test is unmodified and still passes.

`./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest run`
(513 tests, 31 files) were clean in both the implementation and the
independent review pass.

---

## 24. Turn status should name the side and unit color

**Status: shipped, merged `74a169a`, reviewed PASS.** Requested directly by
the user (2026-08-21). Presentation-only.

### 24.1 The problem

`BoardScene.refreshStatus` currently renders the active player as the army
name only (plus the AI controller label when applicable):

```text
Turn 3 — Athènes — MOVEMENT phase
```

In hotseat play, the army name alone is not always enough to identify the
seat quickly. The player also wants the status line to say which map side
the seat owns (`E`, `W`, `N`, or `S`) and the visible color of that seat's
units.

### 24.2 Scope

Presentation-only: update the turn/status banner in `BoardScene.refreshStatus`.
Use the existing `Player.edge` field for side. Add or expose human-readable
names for the existing player colors in `ui/hexRender.ts`
(`PLAYER_COLORS_HEX`: yellow, red, blue, green) rather than hard-coding a
separate mapping inside the scene.

Likely target wording:

```text
Turn 3 — Athènes (W, yellow) — MOVEMENT phase
```

For AI seats, preserve the existing controller label as well; e.g. the army
name, side/color, and `[AI — cautious]` label should all remain visible.

### 24.3 Outcome

**Shipped, merged `74a169a`, reviewed PASS with no findings.**
`BoardScene.refreshStatus` builds a `seatLabel` as
`` `${player.name} (${player.edge}, ${colorName})` ``, with the existing AI
`[difficulty]` suffix still layered on for AI seats — matching the plan's
target wording exactly (`Turn 3 — Athènes (W, yellow) — MOVEMENT phase`).
`PLAYER_COLOR_NAMES` already existed in `ui/hexRender.ts` as a parallel
array to `PLAYER_COLORS_HEX` (`['yellow', 'red', 'blue', 'green']`), so no
new export was needed — the change indexes it with the same `PlayerId`
(`activeId`) already used everywhere else to pick a seat's rendered hex
color (`ship.owner`, `markerTextureKey`, `PlacementScene.playerIndex`), so
the printed color name is guaranteed to match what's actually rendered. The
review independently re-derived this indexing claim by grepping every
`PLAYER_COLORS_HEX` consumer rather than trusting the report, and found no
mismatch.

No README update was needed — grepped for a literal banner-text example and
found only descriptive mentions, neither of which described the exact
wording this branch changed. `./node_modules/.bin/tsc --noEmit` and
`./node_modules/.bin/vitest run` (512 tests, 31 files) were clean in both
the implementation and the independent review pass; `src/scenes/` has no
existing test target for this string format, consistent with `CLAUDE.md`'s
engine-tested/scenes-untested convention, so tsc/vitest-clean plus a careful
manual diff read was the available verification (no browser session was
available in either pass).
