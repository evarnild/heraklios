# Plan: agent-run features

> ### 👉 [§10](#10-sequenced-queue) is the single source of truth for status.
> Per-section status headers are kept in sync with it, but **§10 is the one
> table to read first** — and the one to update the moment anything merges.
> It went stale once and the user caught it.

**Shipped:** Feature A (cavalry charges + phalanx), AI Stage 1 (headless
action layer), AI Stage 2a (fuzz harness), start-a-new-game-anytime, move
through friendly units, combat reporting detail, and cascading push
([§12](#12-cascading-push-when-a-unit-cannot-retreat), merged `3c766d6`).
**In flight:** [§9.1](#91-post-combat-advance-ignores-terrain-restrictions)
advance terrain on `feat/advance-terrain` @ `4f639d1`, review PASSed and
ready to merge. **Live defects still open:**
[§9.2](#92-endgamebytimelimit-is-never-called).

> **Line citations were re-verified against `main` on 2026-08-07** (at
> `3b15577`), after ~440 lines of drift in `BoardScene.ts` had rotted most of
> them. `tsc --noEmit` clean, `vitest run` 272 passed / 1 skipped (the
> permanent Stage-2b elephant skip). Anything cited below is accurate as of
> that commit and will rot again — see
> [§14.1](#141-first-a-correction-the-constraint-is-partly-self-imposed) item 3.

Sections 1–5 cover **Feature A**, the first run through this pipeline;
[§5](#5-outcome) records how it actually went, including two rule-fidelity
defects the adversarial reviewer caught that a happy-path read of the diff
would have missed. Sections 2 and 4 (orchestration and runbook) are
feature-agnostic and apply to whatever runs next — **read §4's `node_modules`
and `npx tsc` warnings before launching anything**, both cost real time in
this project.

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

## 4. Runbook: running this in a fresh session

Everything needed to launch with no prior conversation context. **This
section is feature-agnostic** — it was written for Feature A (§1–§3, long
since shipped) but every hazard below has since bitten on a later run.
Substitute the slug of whatever is being launched for `<slug>`; the queue in
[§10](#10-sequenced-queue) says what that is.

### Preconditions

1. **Check connectivity first** — a prior run on this project died to a DNS
   failure mid-run:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/
   ```
   A `404` is success (the endpoint resolved and answered). A timeout or
   `ENOTFOUND` means do not launch.
2. `main` clean and at the commit the agent should branch from.
3. No stale `feat/<slug>` worktree or branch left over from a previous
   attempt (`git worktree list`, `git branch`). **These accumulate** — as of
   2026-08-07 three orphaned `worktree-agent-*` branches and one detached
   review worktree (`C:/Users/eric/src/heraklios-review-push2`) were still
   lying around from finished runs. Prune them *after* the junction check
   below, never before.

### The `node_modules` problem

A fresh worktree has **no `node_modules`** (gitignored), so the toolchain
isn't resolvable there.

**Check the junction target actually exists first** — during the AI action
layer run the main tree's `node_modules` was *empty*, so the junction below
silently produced a worktree with no toolchain and the agent had to
`npm install` in its worktree anyway:

```bash
ls node_modules | wc -l    # must be non-zero before junctioning
```

**Default to `npm install` in the worktree (~11s).** It is the safe option
and the cost is trivial. Only junction for a long-lived worktree you are
certain you will not delete:

```bash
powershell -Command "New-Item -ItemType Junction -Path node_modules -Target 'C:/Users/eric/src/heraklios/node_modules'"
```

#### ☠️ Never junction into a worktree you intend to delete

**This has already destroyed the main tree's install once.** A Windows
directory junction is a *link*, but a recursive delete — `rm -rf`,
`Remove-Item -Recurse`, `git worktree remove --force` — **follows it and
wipes the target's contents**, i.e. the main tree's `node_modules`, breaking
every other worktree at once. It fails silently: nothing reports an error,
and the damage only surfaces at the next `tsc` run, which then fails with
`./node_modules/.bin/tsc: No such file or directory` (or worse, falls back
to `npx`'s impostor `tsc` and reports a false green — see below).

It happened here when a reviewer was told to junction and then remove its
worktree when finished. Both instructions were reasonable; together they are
destructive. **It then happened a second time, minutes after this warning was
first written**, during routine post-merge cleanup:

```bash
git worktree remove .claude/worktrees/agent-<id> --force   # ☠️ wiped it again
```

That is the real trigger in practice — not a hand-written `rm -rf`, but the
ordinary cleanup command at the end of every successful run. **Agent
worktrees are created by the harness and may contain a junction you did not
make**, so the check below is mandatory before removing *any* worktree, not
just ones you junctioned yourself:

```bash
cmd //c "dir /AL .claude\worktrees\agent-<id>"   # lists junctions, if any
```

**This is not hypothetical right now.** As of 2026-08-07 the live worktree
`.claude/worktrees/agent-a0f2d0a8c70c82076` (the `feat/cascading-push`
implementer's) **contains exactly such a junction**:

```
<JUNCTION>  node_modules [\??\C:\Users\eric\src\heraklios\node_modules]
```

Removing that worktree with `--force` and no `rmdir` first would destroy the
main tree's install for the third time.

If a junctioned worktree must be removed, delete the **link** first:

```bash
cmd //c rmdir node_modules      # removes the link only, never the target
```

then remove the worktree, and verify the main install survived:

```bash
ls C:/Users/eric/src/heraklios/node_modules | wc -l   # must be non-zero
```

### ⚠️ `npx tsc` can report a false green

**Never verify a type-check with bare `npx tsc --noEmit`.** With no local
install, `npx` silently downloads an unrelated package named `tsc` from the
registry, which exits 0 without type-checking anything. This produced a
bogus "clean" result on `main` during the Feature A merge, and the reviewer
hit the same trap from the main tree during the AI action layer review.

Always invoke the project's own binary, and confirm the exit code:

```bash
./node_modules/.bin/tsc --noEmit; echo "exit: $?"
./node_modules/.bin/vitest run
```

`vitest` does not have this failure mode (it produced genuine results even
via `npx`), but prefer the local binary for both.

### Reviewer must check out DETACHED

Git refuses to check out a branch that's already checked out in another
worktree, which a plain `git checkout feat/<slug>` would hit while the
implementer's worktree still exists:

```bash
git checkout --detach feat/<slug>
```

### The workflow script

The shape validated across every run so far: a single `agent()` call using
the `heraklios-implementer` agent (`isolation: 'worktree'`), piped into a
second `agent()` call using `heraklios-reviewer`, each with a structured
output schema (see [§2](#2-how-the-orchestration-works)). The feature brief
(slug / files / design question — from whichever section
[§10](#10-sequenced-queue) points at) is the only per-run content the prompts
need to carry; process rules live in the agent files.

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

**Status:** stages 1 and 2a **✅ shipped** (merged `9cb7ed7` and `469f84a`).
Stage 2b (the elephant drift extraction, [§6.7](#67-the-elephant-problem-stage-2-split))
and stages 3-4 remain open. Scoped deliberately to **stages 1–2 only**
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

- **`BoardScene` refactor blast radius** — settled for Stage 1: it landed as
  its own reviewed branch with no AI code riding along, and review confirmed
  no behavioral regression. Still the main risk for any future extraction
  (drift cascade, post-combat advance).
- **Undo/redo semantics with an AI seat.** A die roll clears the history
  stack, and an AI turn contains many rolls. Likely resolution: undo rewinds
  past the AI's *entire* turn rather than into the middle of it — but this
  needs deciding, not defaulting. **Still open**; a Stage 3/4 decision.
- **Save format.** Which seats are AI must persist or loading a game silently
  turns them human; that implies a `SAVE_VERSION` bump and updates to
  `engine/saveGame.ts` + `ui/saveStorage.ts`. **Still open**, deferred to
  stage 4. Stage 1 left this unforeclosed: `GameState`'s shape is unchanged,
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
not extracted and still mutates `GameState` inline, so a headless caller
cannot resolve `outcome.pendingDrifts`. **Elephants cannot be fuzzed until
that is addressed** — see [§6.7](#67-the-elephant-problem-stage-2-split) for
the decided approach.

### 6.7 The elephant problem: Stage 2 split

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
| **2c** | Enable elephants in the harness; delete the guard and the skipped test. |

**Why this order.** The fuzz harness is a *test tool for refactors*.
Extracting drift first means reviewing another gnarly `BoardScene` change by
hand — and on Stage 1 that approach found two HIGH defects yet still missed
things until someone actually wrote a driver ([§6.6](#66-stage-1-outcome)).
Doing the hardest refactor first discards the very tool built to make hard
refactors safe.

**The exclusion must fail loudly.** This is the real risk: a green fuzzer
creates false confidence and the incentive to return evaporates. So 2a must
assert `outcome.pendingDrifts.length === 0` and **throw** if it ever sees
one, and carry a permanently-skipped test (e.g. `"elephants: drift cascade
not yet fuzzable (Stage 2b)"`) so the gap prints on every run. An exclusion
that cannot be forgotten is a different thing from one that can.

#### What 2b actually has to solve

An earlier sketch of this plan proposed a simple
`driftStep(state, elephant, dieRoll)` returning "moved / hit / eliminated".
**Reading the real cascade, that is too optimistic** — recording the
correction here so 2b doesn't get under-scoped the way it nearly was.

`stepDrift` (`BoardScene.ts:1415`) is the easy half: walk one hex, eliminate
off-map (`canElephantEnterHex`), advance into empty hexes, else hand off to
`resolveDriftHit`. That part genuinely is a pure step function.

`resolveDriftHit` (`:1465`) is the hard half. It rolls a die, resolves a real
combat, and branches five ways:

| Result | Behavior |
| --- | --- |
| `AE`/`EX` | Elephant destroyed; cascade ends. |
| `AR` | Elephant repelled and **re-drifts in a newly rolled direction** (recurses into `beginDrift`). |
| `DE` | Elephant advances into the hex and keeps drifting. |
| `DR`, occupant is an elephant | Occupant **drifts recursively**, with a *forbidden direction* so it can't drift back into its trampler (`:1516`). |
| `DR`, occupant is anything else | Occupant needs a **retreat choice — a live `PlayerAgent` decision** (`:1518`) — before the original elephant may continue. |

So a drift can contain a nested drift, a nested *player decision*, and an
unbounded chain of both.

**The real blocker is not the rules — it is that the continuation lives in
closures.** `continueAfterVacated` (`:1504`) captures the drift and must
re-assign `this.driftState` on resume "because a nested choice/drift may have
taken over"; `finishDrift` fires a captured `onComplete`. A headless caller
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

**What the soak actually exercises** (measured 2026-08-07, 100 seeds):

```
100 games, 9043 total actions (avg 90.4/game)
actionsByKind: landMove 3029, endPhase 2800, navalMove 2115, navalRotate 537,
               landAttack 551, board 6, ram 5
combatResultCounts: DR 306, AR 178, AE 28, EX 21, DE 18
landAttacksResolved=551  ramsResolved=5 (hits=1)  boardingsResolved=6
turnsReached: min=8 max=8 avg=8.0
outcomes: 100 decisive, 0 draws — all 100 by turn-limit/army-value ending
```

**What it does *not* cover** — the part that matters when reading a green
run:

- **Elephants** — excluded by design ([§6.7](#67-the-elephant-problem-stage-2-split)),
  behind a throwing guard and a `[fuzz] GAP:` line printed on every run.
- **Combined attacks** — `legalActions` enumerates singleton attacks only
  (`actions.ts:356-367`), so `multiAttacker` is structurally 0. This is why
  the harness could not have caught [§5](#5-outcome)'s multi-defender phalanx
  bypass, corrected in §6.3.
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
- **Every game ends the same way** (turn limit at turn 8, 0 mutual
  eliminations), so elimination endings and long games are untested paths.

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
instructed to update (see [§2](#2-how-the-orchestration-works)'s warning).
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
on `feat/advance-terrain` @ `4f639d1`, review PASSed, and is ready to merge.
§9.2 still affects hotseat play today.

### 9.1 Post-combat advance ignores terrain restrictions

**Status:** on `feat/advance-terrain` @ `4f639d1`, review PASSed, not yet
merged. `npm run build` clean; `npm test` clean (288 passed, 1 skipped).

`src/scenes/BoardScene.ts:1569`, in `promptAdvanceChoice`:

```ts
const candidates = this.advanceEligibleAttackers.filter((u) => !u.destroyed);
```

No terrain check, and `:1573-1576` assigns `chosen.position = vacatedHex`
unconditionally. So cavalry or a chariot that defeats an infantry or archer
unit standing on marsh or a steep flank is *offered*, and permitted, to
advance onto terrain it may never enter — violating
`05-rules-french-original.md:186`. Elephants advancing onto marsh are
affected too. Reachable in ordinary play: the only nearby restriction
(cavalry-vs-phalanx) doesn't cover infantry or archers.

**Sharper than when first written: the scene and the fuzz harness now
disagree about this rule.** Stage 2a landed
`eligibleAdvanceCandidates(candidates, vacatedHex)` (`combat.ts:68`), which
is `!u.destroyed && canUnitEnterHex(u, vacatedHex)` — and `fuzzHarness.ts:475`
uses it. So the harness enforces the terrain restriction on advance and the
scene does not, meaning **no amount of fuzzing can surface this defect**;
the two callers must be reconciled, not just patched.

**Fix:** replace the filter at `BoardScene.ts:1569` with a call to
`eligibleAdvanceCandidates` — one implementation, already tested, already
used by the harness. Do **not** re-inline `canUnitEnterHex` (`combat.ts:43`)
at the call site; that recreates the divergence in a subtler form.

### 9.2 `endGameByTimeLimit` is never called

`turnManager.ts:131` defines it; a repo-wide grep finds callers only in
`fuzzHarness.ts`. **No scene calls it.** So real hotseat play has no
turn-limit ending, and the rulebook's `on se fixera des temps limites pour la
partie entière` (`05-rules-french-original.md:41`) is unreachable outside the
fuzzer. Games can only end by elimination.

Needs a decision, not just a fix: what sets the limit (a Menu option? a fixed
count?) and how the player is told it's the final turn. Until then it belongs
in the README's "Known simplifications".

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


---

## 10. Sequenced queue

Current order of work, so parallel runs don't collide. **Keep this table in
sync when something merges** — it went stale once and the user caught it.

### Shipped

| Item | Merge |
| --- | --- |
| Feature A — cavalry charges + phalanx | `3b086d1` |
| [§6.3](#63-committed-scope-stages-12) Stage 1 — headless action layer | `9cb7ed7` |
| [§7](#7-start-a-new-game-at-any-time) start a new game at any time | `30c23e7` |
| [§6.3](#63-committed-scope-stages-12) Stage 2a — fuzz harness (+2 engine bugs it found) | `469f84a` |
| [§8](#8-bug-units-cannot-move-through-friendly-units) move through friendly units | `e87c55c` |
| [§11](#11-combat-reporting-detail) combat reporting detail | `12e1bf6` |
| [§12](#12-cascading-push-when-a-unit-cannot-retreat) cascading push | `3c766d6` |

### In flight

| Item | Touches | State |
| --- | --- | --- |
| [§9.1](#91-post-combat-advance-ignores-terrain-restrictions) advance terrain | `scenes/BoardScene.ts`, comments in `engine/combat.ts` / `engine/fuzzHarness.ts` | Branch `feat/advance-terrain` @ `4f639d1`. Review PASSed; `npm run build` clean; `npm test` clean (288 passed, 1 skipped). **Ready to merge.** |

### Queued

| # | Item | Touches | Notes |
| --- | --- | --- | --- |
| 0 | [§12](#12-cascading-push-when-a-unit-cannot-retreat) follow-ups | `engine/fuzzHarness*.ts`, `BoardScene.ts` | The three non-blocking findings that shipped with `3c766d6`: the untested `chainVisited` cycle guard (+ two comments wrongly claiming coverage), the stale "surrounded by friendly units" string, the thin `pushesResolved` canary. Small; fold into whatever touches those files next. |
| 1 | [§13](#13-hex-coordinate-tooltip) hex coordinate tooltip | `ui/MapView.ts`, `BoardScene.ts` | Presentation only. **Not** parallel-safe with §9.1 until `feat/advance-terrain` merges. |
| 2 | [§6.7](#67-the-elephant-problem-stage-2-split) Stage 2b drift extraction | `BoardScene.ts` drift cascade, `engine/` | Unblocks fuzzing elephants. **Not** parallel with anything else in `BoardScene`. |
| 3 | [§9.2](#92-endgamebytimelimit-is-never-called) turn-limit ending | design + scenes | **Live gap.** Needs a design decision first (what sets the limit, how the player is told). |
| 4 | [§6.4](#64-deferred-stages-3-4) Stage 3 — `HeuristicAgent` | `engine/` | Gated on 2b if elephants are to be handled. |
| 5 | [§6.4](#64-deferred-stages-3-4) Stage 4 — AI seat UI + save format | scenes, `saveGame.ts` | `SAVE_VERSION` bump. |

**Standing hazard:** almost everything queued touches `BoardScene.ts`, so
these mostly cannot run in parallel with each other. Do not start §13 until
`feat/advance-terrain` merges.

---

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
  concurrently with either. **Not parallel-safe with §9.1 or Stage 2b.**
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

Three non-blocking findings, **merged as-is and still open** — queued as #0
in [§10](#10-sequenced-queue):

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

---

## 13. Hex coordinate tooltip

**Status:** planned, not started.

> **Assumption flagged.** The request arrived truncated — *"a tooltip display
> that says the coordinates of the hex which…"*. Written up as **the hex
> currently under the cursor, shown on hover**, which is the natural reading
> for a tooltip. If what was meant was the *selected* hex, or the hex of a
> selected unit, this is a small edit — the display logic is the same, only
> the trigger changes.

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
  queue in [§10](#10-sequenced-queue).
- Little to unit-test by the repo's convention (it is scene/UI code); keep
  any coordinate-formatting helper pure if one is needed.

---

## 14. Decomposing `BoardScene.ts` for parallel work

**Status:** proposed, not started. Prompted by the user asking whether the
code can be refactored so tasks stop serializing on one file.

### 14.1 First, a correction: the constraint is partly self-imposed

`BoardScene.ts` is 2040 lines and most queued work touches it, so
[§10](#10-sequenced-queue) has been marking items "not parallel-safe". **The
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
| **Elephant drift cascade** | 1392-1541 | `beginDrift`, `stepDrift`, `resolveDriftHit` | [§6.7](#67-the-elephant-problem-stage-2-split) Stage 2b |
| **Advance offers** | 1542-1661 | `beginAdvanceOffers`, `promptAdvanceChoice` | [§9.1](#91-post-combat-advance-ignores-terrain-restrictions) |
| Combat resolution + log | 1662-1892 | `resolveGroupAttack`, `logCombatOutcome` | — |
| Naval attack prompt | 1893-2001 | `navalAttackPrompt` | — |
| Phase transition | 2002-2040 | `endPhase` | — |

The three bolded regions are the ones that keep colliding, and they share a
shape: **a prompt, a player decision, and a continuation** — the machinery
that already implements `PlayerAgent`. Extracting those three into their own
modules would let §12, §6.7 and §9.1 run genuinely concurrently.

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

1. **Land the queue first.** §12, §9.1 and §13 are all small and already
   specified; extracting underneath them mid-flight invites exactly the
   semantic conflicts §14.1 warns about.
2. **Extract one cascade, alone, behavior-preserving**, and verify by hand in
   the running game (the `run` path used to verify [§7](#7-start-a-new-game-at-any-time)).
   The advance-offer region is the smallest and has the fewest interactions —
   start there, not with drift.
3. **Then Stage 2b** ([§6.7](#67-the-elephant-problem-stage-2-split)), which
   already requires touching drift, and do the extraction as part of it rather
   than as a separate pass. That converts a refactor with no test coverage
   into one the fuzz harness *can* cover, because Stage 2b's whole purpose is
   making the cascade headlessly drivable.

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
