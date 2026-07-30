# Plan: parallel feature implementation via orchestrated subagents

**Status:** run 1 launched and **failed on a network error**; partial work
salvaged. Ready to relaunch. See [§6 Run log](#6-run-log) for what happened and
[§7 Runbook](#7-runbook-running-this-in-a-fresh-session) for how to start it
again from a cold session.

**Batch 1 (current):** feature **B+C** (placement, combined into one agent) and
feature **D** (turn order). Feature **A** (cavalry) is deferred to batch 2 — it
is the largest, the only one touching `BoardScene.ts`, and the one with an
unresolved design question.

**Decided:**

| Decision | Value |
| --- | --- |
| Implementer model | **Sonnet** |
| Reviewer model | **Opus** |
| Verification style | **Adversarial** — reviewer hunts for defects, does not trust the implementer's self-report |
| Integration | Each agent commits to its own `feat/*` branch. No auto-merge, no push, `main` untouched. Review and merge by hand. |
| Feature D default | Toggle defaults to today's fixed seat order |

---

## 1. Goal

Implement several independent rule features at once, each in its own git
worktree so the agents never touch each other's files, then review and merge
them one at a time.

The backlog below is drawn from the README's **"Known simplifications"**
section — places where the digital edition currently trades rules fidelity for
scope. They're documented, self-contained, and mostly touch different files,
which is what makes them suitable for parallel work.

---

## 2. How the orchestration works

One `Workflow` script drives the whole run:

| Stage | What happens |
| --- | --- |
| **Implement** | One agent per feature, each with `isolation: 'worktree'` — its own checkout of the repo, so parallel edits can't collide. The agent creates a branch, implements the rule, adds engine tests, and runs `npx tsc --noEmit` + `npx vitest run` until green, then commits. |
| **Verify** | A second, independent agent per feature re-reads the diff with fresh eyes, re-runs the checks, and reports whether the rule matches the rulebook text and whether the tests actually prove it. It does *not* trust the implementer's own summary. |

These run as a **pipeline**, not in lockstep: each feature moves to verification
as soon as its own implementation lands, rather than waiting for the slowest one.

### Models

Every subagent runs **Sonnet**. There are no agent definitions in
`.claude/agents/` in this repo, and the project's `.claude/settings.local.json`
only carries permission entries — so the model isn't inherited from any config
file. It's set explicitly per agent in the workflow script:

```js
agent(prompt, { model: 'sonnet', isolation: 'worktree', phase: 'Implement' })
```

Without that option an agent inherits the session model (currently Opus), so
the option has to appear on **every** `agent()` call — implement and verify
alike. This is worth stating because it's easy to add a stage later and
silently get Opus back.

The orchestrator itself — the workflow script and this conversation — stays on
the session model. Only the spawned agents change.

> Open: whether the **verify** stage should stay on Sonnet too. Adversarial
> review is the stage that benefits most from a stronger model, so keeping just
> that one on Opus is a defensible split. Currently planned as Sonnet
> throughout, per the decision above.

### Why worktrees

`isolation: 'worktree'` gives each agent a separate working directory backed by
the same `.git`. Two consequences worth knowing:

- Branches and commits **survive worktree cleanup**, because refs live in the
  shared `.git` directory, not in the worktree. Committing is therefore what
  makes an agent's work durable — an uncommitted edit in a discarded worktree
  is gone.
- Each worktree needs its own `node_modules` resolution to run tests. If this
  turns out to be slow or broken (the repo has a ~1500-module install), the
  fallback is to have agents write code and rely on a single verification pass
  in the main tree instead of each running the suite.

### Rules each agent must follow

1. Branch name: `feat/<slug>`, branched from current `main`.
2. Engine logic goes in `src/engine/` or `src/data/` with **unit tests**; only
   presentation goes in `src/scenes/` or `src/ui/`. This mirrors how the
   codebase is already split — the engine is fully tested and Phaser-free.
3. `npx tsc --noEmit` and `npx vitest run` must both be clean before committing.
4. Update the README: move the item out of "Known simplifications" and
   document the new behaviour.
5. Do **not** push, do **not** merge, do **not** touch `main`.
6. If the rulebook is ambiguous, implement the most literal reading and record
   the interpretation in a code comment — the convention already used in
   `src/data/navalRamming.ts`.
7. **Never edit `plan.md`.** It stays the human-owned planning document and is
   edited while runs are in flight (see below).

### Editing this plan while a run is in flight

The workflow runs in the background, and agents work in their own worktrees, so
this file can be edited freely throughout. Three things to know:

- **Additions don't join the running batch.** The feature list is fixed when the
  script launches. New entries go under
  [Next batch](#next-batch-not-in-the-current-run) and are picked up by a
  subsequent run.
- **Avoid editing `README.md` in the main tree during a run.** Every agent
  touches it (rule 4), so simultaneous edits here mean conflicts at merge time.
  Source files being implemented are best left alone for the same reason —
  `plan.md` is safe precisely because rule 7 keeps agents out of it.
- **Don't merge into `main`, switch its branch, or reinstall `node_modules`
  mid-run.** Agents branched from the commit `main` pointed at when they
  started, and may be resolving modules against the shared install.

---

## 3. Feature backlog

### A. Cavalry charges + the phalanx restriction

> README: *"Cavalry charges (doubling attack value when a cavalry unit uses its
> full movement in a straight line into contact) and the restriction that
> cavalry can never attack phalanxes are not implemented."*

- **Files:** `engine/combat.ts`, `engine/movement.ts`, `engine/state.ts`, `scenes/BoardScene.ts`
- **Unit ids involved:** `cavalerie-legere`, `cavalerie-lourde`, `phalanges`
- **Effort:** largest of the four.
- **Design problem to solve first:** `reachableHexes` returns only
  `Map<hexKey, cost>` — it records *that* a hex is reachable, not *how* the unit
  got there. Charge eligibility needs "arrived in a straight line having spent
  its full movement", so this needs either path reconstruction in the movement
  engine or a field on `Unit` (e.g. `chargedThisTurn`) set at move time in
  `BoardScene` and cleared each turn. **The agent should decide and justify
  this, as it's the crux of the feature.**
- The phalanx half is trivial by comparison: one condition in `validTargets`.

### B. Free deployment zones

> README: *"Deployment zones are a fixed 3-hex-deep strip spanning each
> player's entire assigned edge, rather than letting each player choose where
> along the edge to deploy (the original rule) with a 4-hex separation from
> other players."*

- **Files:** `ui/mapBounds.ts`, `scenes/PlacementScene.ts`, `ui/testMode.ts`
- **Effort:** medium-large — the only feature here needing genuinely new UI
  (choosing a strip position before placing units).
- **Note:** `deploymentZone(edge)` currently takes only an edge. Adding a
  player-chosen anchor changes its signature, so `ui/testMode.ts` (which calls
  it) has to be updated too.

### C. Ship facing at deployment

> README: *"Ship facing at deployment always starts at a fixed default
> direction (facing index 0) rather than letting the placing player choose."*

- **Files:** `scenes/PlacementScene.ts`
- **Effort:** smallest of the four. Rotate-before-placing, or place-then-rotate,
  reusing the facing-arrow overlay that already exists.

### D. Re-randomised turn order

> README: *"Turn order among the 4 players is fixed at the initial
> edge-assignment dice-off; the rulebook doesn't specify whether it should be
> re-randomized each turn, so this plays it as fixed seating order."*

- **Files:** `engine/turnManager.ts`, `scenes/MenuScene.ts`, `ui/session.ts`
- **Effort:** small.
- **Caveat:** the rulebook is *silent* here, so this is a house rule, not a
  fidelity fix. It should therefore be a **Menu toggle defaulting to today's
  behaviour**, matching how the combat-mode variant is already offered — not a
  silent change to how every game plays.
- **Interaction:** re-shuffling seat order mid-game affects the save format
  (`seatOrder` is stored) and the "undo only within the current phase" rule.
  Worth a test that a re-shuffle doesn't strand `activePlayerIndex` out of range.

### Also available (not proposed for this run)

From the same README section, but poor fits for parallel work — each is either
a large redesign or effectively unreachable:

- **Path-drawn naval movement** (replacing destination-click) — would rewrite
  the naval movement UI and collide with anything else touching `BoardScene`.
- **Ramming contact detection along arbitrary paths** — depends on the above.
- **Non-galley ships forced into coastal fringe** — currently unreachable, as
  nothing in the game can involuntarily move a ship.
- **Hand-redrawn map terrain** — a data task for the map editor, not code.

---

## 3b. Next batch (not in the current run)

Scratch space for features thought of *during* a run. Nothing here is picked up
by a batch already in flight — these feed the next one. Add freely; format is
whatever's convenient, and I'll work anything here up into a proper §3 entry
(files touched, effort, conflicts) when we scope the following run.

<!-- Add new feature ideas below this line. -->

- _(empty)_

## 4. File-conflict analysis

Even with separate worktrees, two agents editing the same file produce a merge
conflict at integration time. Overlaps:

| File | A cavalry | B deployment | C ship facing | D turn order |
| --- | --- | --- | --- | --- |
| `engine/combat.ts` | ● | | | |
| `engine/movement.ts` | ● | | | |
| `engine/state.ts` | ● | | | |
| `engine/turnManager.ts` | | | | ● |
| `ui/mapBounds.ts` | | ● | | |
| `ui/testMode.ts` | | ● | | |
| `ui/session.ts` | | | | ● |
| `scenes/BoardScene.ts` | ● | | | |
| `scenes/PlacementScene.ts` | | ● | ● | |
| `scenes/MenuScene.ts` | | | | ● |
| `README.md` | ● | ● | ● | ● |

**One real collision: B and C both edit `PlacementScene.ts`.** Options:

1. Give both to a single agent as one combined "placement improvements" task.
2. Run B and C in sequence, C branching from B's result.
3. Run them in parallel and hand-resolve the conflict at merge time — they
   touch different parts of the file (zone selection vs. facing choice), so this
   is likely small.

**Recommendation: option 1** — one agent, both features, since they share the
same screen and the same "let the player choose during placement" theme.

`README.md` is touched by every agent, but always in a different bullet of the
same list, so conflicts there are mechanical to resolve.

---

## 5. Merge order (after review)

Smallest and most isolated first, so each merge is a small diff against a known
tree:

1. **D** turn order — engine + menu only
2. **C**+**B** placement — no engine overlap with the others
3. **A** cavalry — largest, and the only one touching `BoardScene`

Re-run `npx tsc --noEmit` and `npx vitest run` in the main tree after each
merge, not just at the end.

---

## 6. Run log

### Run 1 — 2026-07-25 — FAILED (network)

| | |
| --- | --- |
| Run ID | `wf_9dbcc13b-3da` |
| Launched | 2 implementers (Sonnet, worktrees) + 2 reviewers (Opus, adversarial) |
| Outcome | **Both implementers died**: `API Error: Unable to connect to API (ENOTFOUND)` |
| Duration before failure | ~7.5 min, ~40 tool calls, ~120k subagent tokens |
| Reviewers | **Never ran** — the pipeline's stage 2 was skipped because stage 1 returned nothing |
| Journal | 2 `started` lines, 0 `result` lines |

**Cause was environmental, not the plan.** A DNS failure reaching the API
mid-run. Earlier in the same session `curl` to the npm registry also timed out,
so outbound connectivity was flaky throughout. Connectivity was confirmed
restored afterwards (`api.anthropic.com` resolves and responds).

**What survived:**

- `main` — untouched, clean, `540b092`.
- `feat/placement-choices` — branch created, **zero commits**. That agent got as
  far as `git checkout -b` and died. Work lost.
- `feat/turn-order` — **salvaged**. The turn-order agent's uncommitted work was
  found still on disk in its worktree and committed as `9be6d96`
  ("WIP: optional re-randomised turn order (engine core)").

This is exactly the hazard [§2 Why worktrees](#why-worktrees) warns about:
uncommitted work in a worktree dies with the worktree. It survived only because
the worktree hadn't been cleaned up yet.

### State of `feat/turn-order` (`9be6d96`) — roughly 60% done

Present and good quality:

- `shuffleSeatOrder` in `engine/turnManager.ts` — Fisher-Yates, RNG-injectable
  so it can be unit-tested deterministically.
- Reshuffle in `advancePhase` **only at the seam between full turns**, never
  mid-round, with the "player moves twice / gets skipped" hazard reasoned about
  in a comment. `activePlayerIndex` is recomputed against the new order.
- `randomizedTurnOrder` flag on `GameState` and `SessionState`, defaulting to
  `false`.

**It does not compile.** One known error:

```
src/ui/session.ts(33,14): error TS2741: Property 'randomizedTurnOrder' is missing
in type '{ playerCount: ... }' but required in type 'SessionState'
```

The field was added to the `SessionState` interface but the `session` object
literal below it was never updated.

Still to do on that branch:

- [ ] Fix the `session` literal so `tsc` is clean.
- [ ] Unit tests — none were written. Required: `activePlayerIndex` always valid
      after a reshuffle; every non-eliminated player appears exactly once;
      eliminated players aren't resurrected into the order.
- [ ] Menu toggle (`scenes/MenuScene.ts`), mirroring the combat-mode button.
- [ ] Thread the flag through `createInitialState`'s callers
      (`scenes/PlacementScene.ts`, `ui/testMode.ts`).
- [ ] Decide whether `GameState`'s new field needs save-format work —
      `engine/saveGame.ts` validation, `ui/saveStorage.ts` capture/apply, and
      whether `SAVE_VERSION` must be bumped. Existing save tests must stay green.
- [ ] README: move the item out of "Known simplifications".

### Leftover state to clean before relaunching

```bash
git worktree list                    # stale worktree from run 1
git branch                           # worktree-wf_9dbcc13b-3da-1 / -2 scratch branches
git branch -D feat/placement-choices # empty, zero commits
git worktree prune
```

There is also an untracked `install.cmd` in the repo root, most likely an
agent's attempt at the `node_modules` problem. Safe to delete. `plan.md` itself
is untracked — commit it if it should be shared.

---

## 7. Runbook: running this in a fresh session

Everything needed to relaunch with no prior conversation context.

### Preconditions

1. **Check connectivity first** — this is what killed run 1:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/
   ```
   A `404` is success (the endpoint resolved and answered). A timeout or
   `ENOTFOUND` means do not launch.
2. `main` clean and at the commit the agents should branch from.
3. Leftover worktrees/branches from any previous run pruned (see above).

### The `node_modules` problem — VALIDATED SOLUTION

A fresh worktree has **no `node_modules`** (gitignored), so `npx tsc` and
`npx vitest` fail outright. Do **not** have each agent run `npm install` — four
parallel installs of ~1500 packages. Instead, junction to the main install.
**This was tested after run 1 and works:**

```bash
powershell -Command "New-Item -ItemType Junction -Path node_modules -Target 'C:/Users/eric/OneDrive/src/heraklios/node_modules'"
```

Windows directory junctions need no admin rights and are transparent to Node's
module resolution. Verify with `npx tsc --version`.

### Reviewers must check out DETACHED

Git refuses to check out a branch that is already checked out in another
worktree, which a plain `git checkout feat/x` would hit while the implementer's
worktree still exists. Reviewers must use:

```bash
git checkout --detach feat/<slug>
```

### The workflow script

Run 1's script is persisted on disk and can be re-invoked directly:

```
C:\Users\eric\.claude\projects\c--Users-eric-OneDrive-src-heraklios\78aa24dd-a0ea-4afa-9358-224f88700bc1\workflows\scripts\heraklios-parallel-features-wf_9dbcc13b-3da.js
```

Launch it with `Workflow({scriptPath: "<that path>"})`. Edit the file in place
to change the feature list, then re-invoke with the same `scriptPath`.

**`resumeFromRunId` will not help here.** It is same-session only, and nothing
from run 1 completed, so there is no cache to replay — both agents re-run
regardless.

If that file is gone, the script's shape is: a `FEATURES` array of
`{slug, branch, title, brief}`, run through
`pipeline(FEATURES, implementStage, verifyStage)`, where the implement stage is
`agent(prompt, {model: 'sonnet', isolation: 'worktree', phase: 'Implement', schema})`
and the verify stage is the same with `model: 'opus'` and `phase: 'Verify'`.
Structured output schemas on both stages; see [§2](#2-how-the-orchestration-works).

### Changes to make before relaunching

- **Turn-order agent should start from `feat/turn-order`, not from scratch** —
  point it at commit `9be6d96` and give it the checklist above rather than the
  original brief.
- **Placement agent re-runs from scratch** — its branch is empty.
- Consider having agents **commit early and often** (e.g. an initial WIP commit
  as soon as anything compiles) so a mid-run failure loses less. Run 1 lost one
  feature entirely for want of a single commit.

---

## Open decisions

**Resolved** (carried into the table at the top of this file):

- [x] **Which features go in the first run?** Smaller batch first — B+C and D.
      A (cavalry) deferred to batch 2.
- [x] **Combine B and C into one agent?** Yes.
- [x] **Should the verify stage be adversarial?** Yes.
- [x] **Verify stage on Sonnet or Opus?** Opus. Implementation stays on Sonnet.
- [x] **Feature D's toggle default?** Today's fixed order.

**Still open:**

- [ ] **Finish `feat/turn-order` by agent, or by hand?** It is ~60% done and the
      remaining work is mostly mechanical wiring (see §6). Handing it to an
      agent tests the orchestration; doing it by hand is probably faster.
- [ ] **Should agents commit WIP early?** See §7 — run 1 lost a whole feature
      because nothing was committed before the network dropped.
- [ ] **Anything not on this list** you'd rather have built instead?
- [ ] **Commit `plan.md` to the repo?** Currently untracked.
