# Plan: implement Feature A (cavalry charges + the phalanx restriction)

**Status:** not yet launched. The earlier batch (free deployment zones, ship
facing at deployment, re-randomized turn order) shipped and is merged into
`main`. This plan now covers only the one remaining backlog item, **Feature
A** — deferred out of the first batch because it's the largest of the four
and the only one with an unresolved design question.

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

## 3b. Backlog (not part of this run)

Other items from the README's "Known simplifications" section, not
scheduled here — each is either a large redesign or effectively
unreachable today:

- **Path-drawn naval movement** (replacing destination-click) — would
  rewrite the naval movement UI and collide with anything else touching
  `BoardScene`.
- **Ramming contact detection along arbitrary paths** — depends on the
  above.
- **Non-galley ships forced into coastal fringe** — currently unreachable,
  as nothing in the game can involuntarily move a ship.
- **Hand-redrawn map terrain** — a data task for the map editor, not code.

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
