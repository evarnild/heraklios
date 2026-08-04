# Plan: agent-run features

Sections 1–5 cover **Feature A** (cavalry charges + the phalanx restriction),
now shipped. [§6](#6-next-ai-player) plans the **AI player** work, which is
next up and not yet started. Sections 2 and 4 (orchestration and runbook) are
feature-agnostic and apply to whatever runs next.

**Feature A status:** shipped. Merged to `main` as `3b086d1` on 2026-08-04 and
pushed to `origin/main`. The earlier batch (free deployment zones, ship facing
at deployment, re-randomized turn order) shipped previously. See
[§5](#5-outcome) for how the run actually went, including two rule-fidelity
defects the adversarial reviewer caught that a happy-path read of the diff
would have missed.

**Decided:**

| Decision | Value |
| --- | --- |
| Implementer model | **Sonnet** |
| Reviewer model | **Opus** |
| Verification style | **Adversarial** — reviewer hunts for defects, does not trust the implementer's self-report |
| Integration | Agent commits to its own `feat/*` branch. No auto-merge, no push, `main` untouched. Review and merge by hand. |

---

## 1. Goal

Implement Feature A in its own git worktree, so the agent's edits can't
collide with anything else in flight, then review and merge it by hand.

This reuses the same implement → verify pipeline the earlier batch ran
successfully — just for a single feature this time instead of several in
parallel.

---

## 2. How the orchestration works

| Stage | What happens |
| --- | --- |
| **Implement** | One agent, with `isolation: 'worktree'` — its own checkout of the repo. The agent creates a branch, implements the rule, adds engine tests, and runs `npx tsc --noEmit` + `npx vitest run` until green, then commits. |
| **Verify** | A second, independent agent re-reads the diff with fresh eyes, re-runs the checks, and reports whether the rule matches the rulebook text and whether the tests actually prove it. It does *not* trust the implementer's own summary. |

### Agents

Two project-scoped agent definitions live in `.claude/agents/` and carry
their own model, tools, and rules — invoke them by name rather than
re-specifying any of this per call:

- `heraklios-implementer` (Sonnet) — implement stage. Takes `isolation:
  'worktree'` at call time.
- `heraklios-reviewer` (Opus, adversarial) — verify stage.

```js
agent(implementBrief, { agent: 'heraklios-implementer', isolation: 'worktree', phase: 'Implement' })
agent(verifyBrief, { agent: 'heraklios-reviewer', phase: 'Verify' })
```

The model is fixed in each agent's frontmatter, so it no longer needs to be
passed (or risk being silently dropped) on every call — the prompt only
needs to carry the feature-specific brief (slug, files, design questions),
not the process rules, which live in the agent files themselves.

### Why a worktree

`isolation: 'worktree'` gives the agent a separate working directory backed
by the same `.git`. Two consequences worth knowing:

- Branches and commits **survive worktree cleanup**, because refs live in the
  shared `.git` directory, not in the worktree. Committing is therefore what
  makes the agent's work durable — an uncommitted edit in a discarded
  worktree is gone. **Have the agent commit early and often** (an initial WIP
  commit as soon as anything compiles), not just once at the end — a network
  or tool failure mid-run should lose minutes of work, not all of it.
- The worktree needs its own `node_modules` resolution to run tests. See the
  runbook below for the junction-based fix.

### Rules the agent must follow

Baked into `.claude/agents/heraklios-implementer.md` and
`heraklios-reviewer.md` — branch naming, the engine/presentation split,
tsc/vitest-clean-before-commit, README updates, the "never touch main /
never edit plan.md" boundary, and the ambiguous-rulebook-comment convention
all live there now. This plan only needs to supply the feature-specific
brief: slug (`cavalry-charges`), files, and the open design question
([§3](#3-feature-cavalry-charges--the-phalanx-restriction)).

### Editing this plan while a run is in flight

- **Avoid editing `README.md` in the main tree during a run** — the agent
  touches it (rule 4), so a simultaneous edit there means a conflict at
  merge time. Source files being implemented are best left alone for the
  same reason.
- **Don't merge into `main`, switch its branch, or reinstall `node_modules`
  mid-run.** The agent branches from the commit `main` pointed at when it
  started, and may be resolving modules against the shared install.

---

## 3. Feature: cavalry charges + the phalanx restriction

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

## 3b. Backlog / future work

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

Deferred out of the committed AI scope; full detail in
[§6.4](#64-deferred-stages-3-4). Both are gated on stages 1–2 landing and the
fuzz harness running clean:

- **Stage 3 — `HeuristicAgent`** — exact-EV combat selection over the CRT
  plus scored movement (charge geometry, defensive terrain, ZOC avoidance).
  Cheap *only* once the stage-1 action layer exists; difficulty tiers
  (random → greedy → EV-weighted → shallow lookahead) fall out nearly free.
- **Stage 4 — player-facing AI support** — per-seat Human/AI + difficulty
  config on the Menu screen (`ui/session.ts`), turn pacing/animation so AI
  moves are legible, and persisting AI seats in the save format (implies a
  `SAVE_VERSION` bump).

### Raised by the AI planning work

- **Injectable RNG throughout** — `rollDie` (`BoardScene.ts:540`) calls
  `Math.random()` directly, blocking deterministic replay and seeded tests.
  Stage 1 fixes this for the die specifically; worth auditing for other
  direct `Math.random()` uses at the same time, following
  `shuffleSeatOrder`'s existing injection convention.
- **`BoardScene` decomposition** — at ~1600 lines it is the repo's largest
  file and, by convention, its least tested. Stage 1 extracts the movement
  and combat orchestration; the retreat/drift/advance prompt machinery and
  the naval ram/board UI are the obvious follow-on candidates if the first
  extraction goes well.

<!-- Add new feature ideas below this line. -->

---

## 4. Runbook: running this in a fresh session

Everything needed to launch with no prior conversation context. No prior
run exists for this feature — this is a first attempt, not a resume.

### Preconditions

1. **Check connectivity first** — a prior run on this project died to a DNS
   failure mid-run:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/
   ```
   A `404` is success (the endpoint resolved and answered). A timeout or
   `ENOTFOUND` means do not launch.
2. `main` clean and at the commit the agent should branch from.
3. No stale `feat/cavalry-charges` worktree or branch left over from a
   previous attempt (`git worktree list`, `git branch`).

### The `node_modules` problem — validated solution

A fresh worktree has **no `node_modules`** (gitignored), so `npx tsc` and
`npx vitest` fail outright. Don't have the agent run `npm install` from
scratch. Instead, junction to the main install:

```bash
powershell -Command "New-Item -ItemType Junction -Path node_modules -Target 'C:/Users/eric/src/heraklios/node_modules'"
```

Windows directory junctions need no admin rights and are transparent to
Node's module resolution. Verify with `npx tsc --version`.

### Reviewer must check out DETACHED

Git refuses to check out a branch that's already checked out in another
worktree, which a plain `git checkout feat/cavalry-charges` would hit while
the implementer's worktree still exists:

```bash
git checkout --detach feat/cavalry-charges
```

### The workflow script

No script exists yet for this feature — author one following the shape
already validated on the earlier batch: a single `agent()` call using the
`heraklios-implementer` agent (`isolation: 'worktree'`), piped into a second
`agent()` call using `heraklios-reviewer`, each with a structured output
schema (see [§2](#2-how-the-orchestration-works)). The feature brief
(slug/files/design question from [§3](#3-feature-cavalry-charges--the-phalanx-restriction))
is the only per-run content the prompts need to carry — process rules live
in the agent files.

---

## 5. Outcome

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

**Status:** planned, not started. Scoped deliberately to **stages 1–2 only**
(the headless foundation + a self-play fuzz harness). Stages 3–4 (the actual
strategy code and its UI) are deferred until the foundation is proven — see
[§6.4](#64-deferred-stages-3-4).

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

The engine is pure *calculation*; the **orchestration lives entirely in
`BoardScene`** (~1600 lines), which is exactly the layer this repo
deliberately does not unit-test:

- **Movement is not an engine operation.** `BoardScene.ts:628-630` performs
  the `movementLeft -= cost; position = hex; charged = ...` sequence inline;
  naval movement does the same at `:706` and `:734-746`. There is no
  headless "apply a move" to call.
- **A land attack is not atomic.** `resolveGroupAttack` (`BoardScene.ts:1327`)
  rolls, applies the result, then branches into UI prompts for exchange
  sacrifice, retreat, drift, and advance-after-combat. An AI must answer
  those mid-resolution questions too — "pick a move" is not a sufficient
  interface.
- **The RNG is not injectable.** `rollDie` (`BoardScene.ts:540`) calls
  `Math.random()` directly in the scene, so no AI or harness run can be made
  deterministic. Note `shuffleSeatOrder` in `turnManager.ts` already
  establishes the RNG-injection convention to follow.

So the work is not "write an AI" — it is *extracting a headless action
layer*, after which the AI itself is comparatively small.

### 6.3 Committed scope: stages 1–2

**Stage 1 — headless action layer.** New `engine/actions.ts` exposing
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
right and would very likely have caught the multi-defender phalanx bypass
from [§5](#5-outcome) — a defect that reached review precisely because
hand-written tests follow happy paths. It also validates the stage-1
abstraction under load before any strategy code depends on it.

### 6.4 Deferred: stages 3-4

Not scheduled; revisit once stages 1–2 are merged and the harness has run
clean.

- **Stage 3 — `HeuristicAgent`**: exact-EV combat selection over the CRT
  (see [§6.1](#61-what-the-codebase-already-provides)) plus scored movement
  (advance on weak high-value targets, seek charge geometry, prefer
  defensive terrain, avoid ZOC traps). Difficulty tiers fall out nearly free:
  random → greedy → EV-weighted → shallow lookahead.
- **Stage 4 — player-facing**: per-seat Human/AI + difficulty config on the
  Menu screen (`ui/session.ts`), turn pacing/animation so AI moves are
  legible rather than instant, and save-format support.

### 6.5 Decisions to make before starting

- **`BoardScene` refactor blast radius** is the main risk in this plan: the
  largest file in the repo, and by convention the least tested. Stage 1
  should land as its own reviewed branch with no AI code riding along.
- **Undo/redo semantics with an AI seat.** A die roll clears the history
  stack, and an AI turn contains many rolls. Likely resolution: undo rewinds
  past the AI's *entire* turn rather than into the middle of it — but this
  needs deciding, not defaulting.
- **Save format.** Which seats are AI must persist or loading a game silently
  turns them human; that implies a `SAVE_VERSION` bump and updates to
  `engine/saveGame.ts` + `ui/saveStorage.ts`. Deferred to stage 4, but the
  stage-1 state shape should not make it awkward.
