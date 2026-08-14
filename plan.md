# Heraklios Work Plan

This file is three things:

1. **Plan management rules** — how to keep the queue honest while agents and
   humans work in parallel.
2. **History** — what shipped, what reviews caught, and why earlier decisions
   were made.
3. **Backlog** — the current queue plus design notes for future work.

## How To Manage This Plan

- [Current Queue](#10-sequenced-queue) is the single source of truth for status. Read it
  first, and update it the moment anything merges.
- Keep per-section status headers in sync with the queue. If something moves from
  queued to in-flight or shipped, update both the section and the queue in the same
  commit.
- Do not let completed work stay visually central. Once a branch merges, move
  it into the shipped/history language and promote the next queued item.
- Preserve useful postmortems. Review failures, wrong assumptions, and
  rulebook interpretations belong in the history sections because they prevent
  repeat mistakes.
- Treat line references as unstable. If a task brief relies on line numbers,
  re-verify them against current `main` before launching work.
- Before launching implementation, read [§4](#4-runbook-detailed-launch-hazards-appendix)'s
  `node_modules` and `npx tsc` warnings; both have cost real time in this
  project.

**Workflow defaults:**

| Decision | Value |
| --- | --- |
| Implementer model | **Sonnet** for Claude Code; Codex implementers inherit the parent Codex model unless explicitly overridden. |
| Reviewer model | **Opus** for Claude Code; Codex reviewers use the project `heraklios_reviewer` agent or a read-only review pass. |
| Verification style | **Adversarial** — reviewer hunts for defects, does not trust the implementer's self-report. |
| Integration | Agent commits to its own `feat/*` branch. No auto-merge. Review and merge by hand. |

## Current Snapshot

**Shipped:** Feature A (cavalry charges + phalanx), AI Stage 1 (headless
action layer), AI Stage 2a (fuzz harness), start-a-new-game-anytime, move
through friendly units, combat reporting detail, cascading push
([§12](#12-cascading-push-when-a-unit-cannot-retreat), merged `3c766d6`),
[§9.1](#91-post-combat-advance-ignores-terrain-restrictions) advance
terrain (merged `6172f2f`), Stage 2b drift extraction
([§6.7](#67-the-elephant-problem-stage-2-split), merged `7544a96`), and AI
Stage 3 — the `HeuristicAgent`
([§6.4](#64-stage-3-shipped-stage-4-deferred), merged `a2a1329`), and
[§15](#15-live-defect-ranged-attacks-resolve-at-zero-attack-force)'s ranged
attack force (merged `272bcf0`).
**In flight:** nothing — [Current Queue](#10-sequenced-queue) is next, and
its first two items (`0b`, `0c`) both came out of §15's independent review.
**Live defects still open:**
[§9.2](#92-endgamebytimelimit-is-never-called).

<a id="10-sequenced-queue"></a>

## Current Queue

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
| [§9.1](#91-post-combat-advance-ignores-terrain-restrictions) advance terrain | `6172f2f` |
| [§6.7](#67-the-elephant-problem-stage-2-split) Stage 2b — drift extraction | `7544a96` |
| [§6.4](#64-stage-3-shipped-stage-4-deferred) Stage 3 — `HeuristicAgent` (+1 engine defect it found) | `a2a1329` |
| [§15](#15-live-defect-ranged-attacks-resolve-at-zero-attack-force) ranged attack force (+1 wedged-board defect, +2 review findings) | `272bcf0` |

### In flight

- [§12](#12-cascading-push-when-a-unit-cannot-retreat) **follow-ups** —
  `feat/push-followups`, tsc/build/366 tests green, cycle-guard mutant killed.
  Awaiting review/merge; see [§12.6](#126-the-three-follow-ups). Next up after
  it merges is #1, Stage 2c.

### Queued

| # | Item | Touches | Notes |
| --- | --- | --- | --- |
| ~~0~~ | ~~[§12](#12-cascading-push-when-a-unit-cannot-retreat) follow-ups~~ | — | **✅ Shipped `feat/push-followups`.** All three closed; see [§12.6](#126-the-three-follow-ups). |
| ~~0b~~ | ~~Reviewer-agent file corrections~~ | — | **✅ Shipped `9f99b1a`.** See [§15.7](#157-the-two-follow-ups). |
| ~~0c~~ | ~~Combat groups not revalidated after a removal~~ | — | **✅ Shipped `9f99b1a`.** See [§15.7](#157-the-two-follow-ups). |
| 1 | [§6.7](#67-the-elephant-problem-stage-2-split) Stage 2c — elephants in the harness | `engine/fuzzHarness.ts` | Now unblocked: 2b landed the extracted cascade, so this is putting elephants back into the generated armies, deleting the exclusion guard and the skipped test. Also what unblocks the AI ever using one (§6.9). |
| 2 | [§13](#13-hex-coordinate-tooltip) hex coordinate tooltip | `ui/MapView.ts`, `BoardScene.ts` | Presentation only. |
| 3 | [§9.2](#92-endgamebytimelimit-is-never-called) turn-limit ending | design + scenes | **Live gap, and now the only open one.** Needs a design decision first (what sets the limit, how the player is told). Stage 3 added a second reason to care: `endGameByTimeLimit` breaks a tied army value in favour of the lower seat, silently (§6.9). |
| 4 | [§6.4](#64-stage-3-shipped-stage-4-deferred) Stage 4 — AI seat UI + save format | scenes, `saveGame.ts` | `SAVE_VERSION` bump. The engine half is done and idle: nothing can reach the AI from the UI. |
| 5 | [§6.4](#64-stage-3-shipped-stage-4-deferred) Stage 3b — shallow lookahead tier | `engine/` | The fourth difficulty tier, deliberately not shipped with the other three. Needs state cloning + an opponent model + a performance budget; see `heuristicAgent.ts`'s header. |

**Standing hazard:** almost everything queued touches `BoardScene.ts`, so
these mostly cannot run in parallel with each other.

## Backlog Map

- **Start here:** [Current Queue](#10-sequenced-queue).
- **Current next task:** review and merge `feat/push-followups`
  ([§12.6](#126-the-three-follow-ups)), then #1's Stage 2c.
- **Live defects:** [§9.2](#92-endgamebytimelimit-is-never-called) (needs a
  design decision) is the only one left open.
- **Larger future work:** [§6.7](#67-the-elephant-problem-stage-2-split)'s
  Stage 2c, [§6.4](#64-stage-3-shipped-stage-4-deferred)'s Stage 4, and
  [§14](#14-decomposing-boardscenets-for-parallel-work).

## History Map

- **Feature A archive:** [§2.1](#21-feature-a-launch-goal), [§3](#3-feature-cavalry-charges--the-phalanx-restriction),
  and [§5](#5-outcome). It remains here as the first full implement/review
  run and as evidence for adversarial review.
- **AI foundation history:** [§6.6](#66-stage-1-outcome),
  [§6.8](#68-stage-2a-outcome), and [§6.9](#69-stage-3-outcome).
- **Shipped feature notes:** [§7](#7-start-a-new-game-at-any-time),
  [§8](#8-bug-units-cannot-move-through-friendly-units),
  [§11](#11-combat-reporting-detail), [§12](#12-cascading-push-when-a-unit-cannot-retreat),
  and [§9.1](#91-post-combat-advance-ignores-terrain-restrictions).

> **Line citations were re-verified against `main` on 2026-08-07** (at
> `3b15577`), after ~440 lines of drift in `BoardScene.ts` had rotted most of
> them. `tsc --noEmit` clean, `vitest run` 272 passed / 1 skipped (the
> permanent Stage-2b elephant skip). Anything cited below is accurate as of
> that commit and will rot again — see
> [§14.1](#141-first-a-correction-the-constraint-is-partly-self-imposed) item 3.

---

## 1. Agent workflow

| Stage | What happens |
| --- | --- |
| **Implement** | One agent, with `isolation: 'worktree'` — its own checkout of the repo. The agent creates a branch, implements the rule, adds engine tests, and runs `npm run build` + `npm test` until green, then commits. |
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
needs to carry the feature-specific brief (slug, files, design questions, and
the relevant plan section), not the process rules, which live in the agent
files themselves.

Codex equivalents live in `.codex/agents/`:

- `heraklios_implementer` — implements one scoped feature with tests.
- `heraklios_reviewer` — read-only adversarial reviewer.

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
build/test-clean-before-commit, README updates, the "never touch main /
never edit plan.md" boundary, and the ambiguous-rulebook-comment convention
all live there now. This plan only needs to supply the feature-specific
brief: slug, files, design questions, and any relevant rulebook or queue
references.

### Editing this plan while a run is in flight

- **Avoid editing `README.md` in the main tree during a run** — the agent
  touches it (rule 4), so a simultaneous edit there means a conflict at
  merge time. Source files being implemented are best left alone for the
  same reason.
- **Don't merge into `main`, switch its branch, or reinstall `node_modules`
  mid-run.** The agent branches from the commit `main` pointed at when it
  started, and may be resolving modules against the shared install.

### Launch checklist

Before launching a task:

1. Read [Current Queue](#10-sequenced-queue) and the target task section.
2. Verify `main` is clean and current.
3. Check `git worktree list`, `git branch`, and any stale `feat/<slug>`
   branch/worktree.
4. Use a fresh `feat/<slug>` branch or worktree.
5. Install dependencies in that worktree if needed; do not junction
   `node_modules` into a worktree that will be deleted.
6. Verify with `npm run build` and `npm test`.
7. Run an adversarial review before merging.
8. After merge, update the queue and the task section in the same status commit.

---

## 2. History archive

Completed feature sections stay below for context and postmortems. They are
not the active queue; use [Current Queue](#10-sequenced-queue) for that.

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
Feature A run. The current ordered backlog lives in [Current Queue](#10-sequenced-queue).

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

## 4. Runbook: detailed launch hazards appendix

Everything needed to launch with no prior conversation context. **This
section is feature-agnostic** — it was first written during Feature A, but
every hazard below has since bitten on a later run.
Substitute the slug of whatever is being launched for `<slug>`; the queue in
[Current Queue](#10-sequenced-queue) says what that is.

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
output schema (see [§1](#1-agent-workflow)). The feature brief
(slug / files / design question — from whichever section
[Current Queue](#10-sequenced-queue) points at) is the only per-run content the prompts
need to carry; process rules live in the agent files.

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

**Status:** stages 1, 2a, 2b and 3 **✅ shipped** (merged `9cb7ed7`,
`469f84a`, `7544a96` and `a2a1329`). **Stage 2c** (putting elephants back
into the harness's armies now that 2b has extracted the cascade,
[§6.7](#67-the-elephant-problem-stage-2-split)) and **stage 4** (the
player-facing half) remain open.

The original scope note said stages 3–4 were deferred "until the foundation
is proven." The foundation was proven, stage 3 came in on it, and the
position now is that **the AI exists, plays well, and is reachable from
nothing but the test suite** — see
[§6.4](#64-stage-3-shipped-stage-4-deferred) and
[§6.9](#69-stage-3-outcome).

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

- **Stage 4 — player-facing**: per-seat Human/AI + difficulty config on the
  Menu screen (`ui/session.ts`), turn pacing/animation so AI moves are
  legible rather than instant, and save-format support. **Still deferred**,
  and now the only thing between this project and a playable computer
  opponent — the strategy code is done, tested, and reachable by nothing but
  the test suite.

- **Stage 3b — shallow lookahead**: the fourth tier, queued separately (#6)
  rather than folded back into stage 3. Reasoning in
  `heuristicAgent.ts`'s header, summarized in §6.9.

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
not extracted in Stage 2a, so a headless caller could not resolve
`outcome.pendingDrifts`. Stage 2b replaced the scene-owned closure cascade
with `engine/drift.ts`'s explicit drift state machine; Stage 2c remains the
point where ordinary seeded self-play starts including elephants.

### 6.7 The elephant problem: Stage 2 split

**Status: ✅ Shipped** — merged to `main` as `7544a96`. Verification on the
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
| **2c** | Enable elephants in the harness; delete the guard and the skipped test. |

**Why this order.** The fuzz harness is a *test tool for refactors*.
Extracting drift first means reviewing another gnarly `BoardScene` change by
hand — and on Stage 1 that approach found two HIGH defects yet still missed
things until someone actually wrote a driver ([§6.6](#66-stage-1-outcome)).
Doing the hardest refactor first discards the very tool built to make hard
refactors safe.

**Stage 2a exclusion status.** In Stage 2a the exclusion had to fail loudly:
the harness threw if `outcome.pendingDrifts` appeared and carried a skipped
test so the elephant gap printed on every run. Stage 2b replaced that guard
with `processDrifts`; the default self-play army can still exclude elephants
until Stage 2c requires ordinary soak coverage to show non-zero
`driftsResolved` / `driftCombatsResolved`.

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

- **Elephants** — excluded by design ([§6.7](#67-the-elephant-problem-stage-2-split)),
  behind a throwing guard and a `[fuzz] GAP:` line printed on every run.
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
- **Every game ends the same way** (turn limit at turn 8, 0 mutual
  eliminations), so elimination endings and long games are untested paths.

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

**Carried forward:** the AI has still never played a game containing an
elephant. Written during the branch as "for the same reason nothing headless
can — Stage 2b"; that reason expired while the branch was in review, since
Stage 2b landed in parallel. The remaining blocker is only
[§6.7](#67-the-elephant-problem-stage-2-split)'s **Stage 2c** — the harness's
armies still exclude them. It matters more than a test-coverage gap sounds,
because `defaultArmySelection()` puts three elephants in a standard army, so
the first human to play the AI will hand it a unit type no test has ever
given it.

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
instructed to update (see [§1](#1-agent-workflow)'s warning).
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

Shipped on `feat/push-followups`. `tsc` clean, build clean, 366 passed / 1
skipped (was 364).

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
  queue in [Current Queue](#10-sequenced-queue).
- Little to unit-test by the repo's convention (it is scene/UI code); keep
  any coordinate-formatting helper pure if one is needed.

---

## 14. Decomposing `BoardScene.ts` for parallel work

**Status:** proposed, not started. Prompted by the user asking whether the
code can be refactored so tasks stop serializing on one file.

### 14.1 First, a correction: the constraint is partly self-imposed

`BoardScene.ts` is 2040 lines and most queued work touches it, so
[Current Queue](#10-sequenced-queue) has been marking items "not parallel-safe". **The
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
[§4](#4-runbook-detailed-launch-hazards-appendix) false-green trap; and a
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
`npx tsc --noEmit` (the false-green trap [§4](#4-runbook-detailed-launch-hazards-appendix)
documents) and to `git checkout --detach` a branch that was already the main
tree's HEAD (which would have left the operator's tree detached). Both had to
be overridden in the launch brief, along with its "plan.md must not be
edited" and "move the item out of Known simplifications" rules, neither of
which applied. **The agent file should be fixed so the next run doesn't need
the same four corrections.**
