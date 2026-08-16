# Heraklios Work Plan

This file is two things:

1. **Plan management rules** — how to keep the queue honest while agents and
   humans work in parallel.
2. **Backlog** — the current queue plus design notes for work still open.

Finished work's postmortems live in **[`plan-history.md`](plan-history.md)**,
not here — see "Archiving to `plan-history.md`" below. This split happened
on 2026-08-16 because inline history had pushed this file past 3,200 lines;
before that date, "shipped" sections stayed in this file forever instead of
moving out.

## How To Manage This Plan

- [Current Queue](#10-sequenced-queue) is the single source of truth for status. Read it
  first, and update it the moment anything merges.
- Keep per-section status headers in sync with the queue. If something moves from
  queued to in-flight or shipped, update both the section and the queue in the same
  commit.
- Do not let completed work stay visually central. Once a branch merges,
  **archive its section into `plan-history.md`** (see below) and promote the
  next queued item.
- Preserve useful postmortems. Review failures, wrong assumptions, and
  rulebook interpretations belong in `plan-history.md` because they prevent
  repeat mistakes — but write them *in this file* while the work is still
  live (mid-review, not yet merged), and only move the section once it's
  actually done with (shipped, or abandoned). Don't archive something still
  being argued about.
- Treat line references as unstable. If a task brief relies on line numbers,
  re-verify them against current `main` before launching work.
- Before launching implementation, read [§4](#4-runbook-detailed-launch-hazards-appendix)'s
  `node_modules` and `npx tsc` warnings; both have cost real time in this
  project.

### Archiving to `plan-history.md`

When a section is done (shipped and its postmortem written, or abandoned):

1. Cut the whole `## N. ...` section (and its `###` subsections) out of this
   file and append it to the end of `plan-history.md`, verbatim — keep its
   original section number so existing links elsewhere (commit messages,
   agent files, this file's own History Map) don't silently point at the
   wrong content.
2. Leave the Current Queue / Backlog Map entries pointing at it with a
   `plan-history.md#anchor` link instead of `#anchor`.
3. Add or update a line in this file's History Map summarizing what moved.
4. Don't rewrite the section's content while moving it — archiving is a cut,
   not an edit. Fix stale facts (line numbers, measurements) *before*
   archiving if they need fixing at all; once archived, the record is meant
   to describe what actually happened, not the current state of the code.

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
([§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat), merged `3c766d6`),
[§9.1](plan-history.md#91-post-combat-advance-ignores-terrain-restrictions) advance
terrain (merged `6172f2f`), Stage 2b drift extraction
([§6.7](plan-history.md#67-the-elephant-problem-stage-2-split), merged `7544a96`), and AI
Stage 3 — the `HeuristicAgent`
([§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred), merged `a2a1329`),
[§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force)'s ranged
attack force (merged `272bcf0`), Stage 2c — elephants in the harness
([§6.7](plan-history.md#67-the-elephant-problem-stage-2-split), merged `0e54b59`), which
completes Stage 2 and fixed a live defect in hotseat play on the way (a
drifting elephant could enter marsh), and
[§13](plan-history.md#13-hex-coordinate-tooltip)'s hex coordinate tooltip (merged
`62892c3`), **Stage 4 — the AI's seat UI and save format v2 (merged
`556fbf8`), which finally gives the computer opponent a seat**
([§6.12](plan-history.md#612-stage-4-outcome)), **[§9.2](plan-history.md#92-endgamebytimelimit-is-never-called) —
the endgame: clock limit, round limit, and the Board's "End game" button
(merged `836c70f`, +4 MEDIUM review findings fixed, +a mid-merge design
revision — see [§9.2.4](plan-history.md#924-outcome))**, which closed the plan's last open
live defect, and **[§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) —
per-hex "A"/"B"/"C" labels on the advance/exchange prompts (merged
`ceb106a`)**, presentation-only.
**In flight:** nothing. Queue is empty of self-contained items —
[§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred)'s Stage 3b (shallow lookahead)
is the only thing left queued, and it's a larger, deliberately-deferred
piece of work, not a quick pickup.
**Carried over from merges, manual browser pass still owed:** Stage 4's
([§6.12](plan-history.md#612-stage-4-outcome)) and now §16's too — Chrome automation was
unavailable in the session that shipped §16, so its per-hex badges have
been verified by `tsc`/`vitest`/`build` and code review only, not by eye.
**Live defects still open:** [§18](#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
— ramming bonus narrows the table instead of extending it. Confirmed, not
yet fixed.

<a id="10-sequenced-queue"></a>

## Current Queue

Current order of work, so parallel runs don't collide. **Keep this table in
sync when something merges** — it went stale once and the user caught it.

### Shipped

| Item | Merge |
| --- | --- |
| Feature A — cavalry charges + phalanx | `3b086d1` |
| [§6.3](plan-history.md#63-committed-scope-stages-12) Stage 1 — headless action layer | `9cb7ed7` |
| [§7](plan-history.md#7-start-a-new-game-at-any-time) start a new game at any time | `30c23e7` |
| [§6.3](plan-history.md#63-committed-scope-stages-12) Stage 2a — fuzz harness (+2 engine bugs it found) | `469f84a` |
| [§8](plan-history.md#8-bug-units-cannot-move-through-friendly-units) move through friendly units | `e87c55c` |
| [§11](plan-history.md#11-combat-reporting-detail) combat reporting detail | `12e1bf6` |
| [§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat) cascading push | `3c766d6` |
| [§9.1](plan-history.md#91-post-combat-advance-ignores-terrain-restrictions) advance terrain | `6172f2f` |
| [§6.7](plan-history.md#67-the-elephant-problem-stage-2-split) Stage 2b — drift extraction | `7544a96` |
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3 — `HeuristicAgent` (+1 engine defect it found) | `a2a1329` |
| [§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force) ranged attack force (+1 wedged-board defect, +2 review findings) | `272bcf0` |
| [§6.7](plan-history.md#67-the-elephant-problem-stage-2-split) Stage 2c — elephants in the harness (+1 live marsh defect, +1 HIGH/3 MEDIUM review findings) | `0e54b59` |
| [§13](plan-history.md#13-hex-coordinate-tooltip) hex coordinate tooltip | `62892c3` |
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 4 — AI seat UI + save format v2 (+3 review defects) | `556fbf8` |
| [§9.2](plan-history.md#92-endgamebytimelimit-is-never-called) endgame: clock, round limit, End game button (+4 MEDIUM review defects, +a mid-merge design revision) | `836c70f` |
| [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) label the units a choice dialog means | `ceb106a` |

### In flight

- [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3b — shallow lookahead
  tier, on branch `codex-stage-3b-lookahead` (initial commit `f7bb8e2`). Went
  through adversarial review before merge (this repo's usual gate) **four
  times**, and failed all four — 4 HIGH findings on the first pass
  ([§6.13](plan-history.md#613-stage-3b-outcome)), 2 more HIGH findings on the second pass
  after that round's own fix didn't hold up ([§6.14](plan-history.md#614-stage-3b-second-review-outcome)),
  a narrower 1 HIGH/3 MEDIUM/4 LOW on the third pass — the redesign itself
  was correct that time, but had no test standing between it and being
  silently reverted, plus a measurement that didn't reproduce
  ([§6.15](plan-history.md#615-stage-3b-third-review-outcome)) — and a
  narrower still 3 MEDIUM/4 LOW on the fourth pass, with **no correctness
  defect in the shipped code** for the first time: every finding was about
  the record (a test comment describing the wrong mechanism, two
  undisclosed mutation survivors, a disclosed gap whose stated reason for
  being unfixable turned out to be wrong)
  ([§6.16](plan-history.md#616-stage-3b-fourth-review-outcome)).
  The tier is now relabeled "AI — cautious" rather than "AI — expert" since
  no round of measurement established a reliable aggregate-strength edge
  over `'ev'`. Not yet re-reviewed a fifth time or merged. No live defects
  or undisclosed coverage gaps remain open — two mutants remain
  intentionally undiscriminated on record (§6.16).

### Queued

| # | Item | Touches | Notes |
| --- | --- | --- | --- |
| ~~0~~ | ~~[§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat) follow-ups~~ | — | **✅ Shipped `c23648c`.** All three closed; see [§12.6](plan-history.md#126-the-three-follow-ups). |
| ~~0b~~ | ~~Reviewer-agent file corrections~~ | — | **✅ Shipped `9f99b1a`.** See [§15.7](plan-history.md#157-the-two-follow-ups). |
| ~~0c~~ | ~~Combat groups not revalidated after a removal~~ | — | **✅ Shipped `9f99b1a`.** See [§15.7](plan-history.md#157-the-two-follow-ups). |
| ~~1~~ | ~~[§9.2](plan-history.md#92-endgamebytimelimit-is-never-called) endgame: clock, round limit, and an "End game" button~~ | — | **✅ Shipped `836c70f`.** See [§9.2.4](plan-history.md#924-outcome) — including the mid-merge pause-behavior revision. |
| ~~2~~ | ~~[§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 4 — AI seat UI + save format~~ | — | **✅ Shipped `556fbf8`.** See [§6.12](plan-history.md#612-stage-4-outcome) — including the one check it shipped without. |
| ~~2~~ | ~~[§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) label the units a choice dialog means~~ | — | **✅ Shipped `ceb106a`.** Implemented directly (no agent pair), verified by `tsc`/`vitest`/`build` and code review — the manual browser pass is still owed, Chrome automation wasn't available in that session. |
| ~~3~~ | ~~[§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3b — shallow lookahead tier~~ | `engine/` | **In flight, not queued** — see In flight above, [§6.13](plan-history.md#613-stage-3b-outcome), [§6.14](plan-history.md#614-stage-3b-second-review-outcome), [§6.15](plan-history.md#615-stage-3b-third-review-outcome), and [§6.16](plan-history.md#616-stage-3b-fourth-review-outcome). |
| 4 | [§18](#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it) ramming bonus narrows the table instead of extending it | `src/data/navalRamming.ts`, its tests, `BoardScene.ts`'s ram log, README | Confirmed live defect (user report, verified against the scanned rulebook page). Also affects AI ramming decisions via `combatOdds.ts`'s `evaluateRam`. |
| 5 | [§17](#17-manual-step-by-step-naval-movement) manual step-by-step naval movement | `BoardScene.ts` (likely presentation-only) | Replace destination-click naval movement with hex-by-hex manual control; clearer Turn button labels. [§17.4](#174-open-design-question-distant-ramming-contacts) has one open design question to settle with the user before implementation starts. |

## Backlog Map

- **Start here:** [Current Queue](#10-sequenced-queue).
- **Current next task:** #4, [§18](#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
  the ramming bonus defect — a confirmed rules bug, ahead of #5 (naval
  movement) at the user's request. [§6.16](plan-history.md#616-stage-3b-fourth-review-outcome)'s
  fixes need a FIFTH (re-)review pass and a merge decision — this branch
  has failed review four times now; all three items here are independent
  (different files) and can proceed in parallel.
- **Live defects:** [§18](#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
  — ramming bonus narrows the table instead of extending it. Confirmed, not
  yet fixed.
- **Owed:** a manual browser pass over §16's per-hex choice labels (and
  Stage 4's still-outstanding one, [§6.12](plan-history.md#612-stage-4-outcome)) — next
  person with a working browser session should give both a look. Stage 3b
  ([§6.16](plan-history.md#616-stage-3b-fourth-review-outcome)) still needs a FIFTH
  review pass before merge.

## History Map

Full history — every shipped feature's design brief, postmortem, and
review findings — now lives in **[`plan-history.md`](plan-history.md)**.
This map is just a fast index into it:

- **Feature A archive:** [§2.1](plan-history.md#21-feature-a-launch-goal), [§3](plan-history.md#3-feature-cavalry-charges--the-phalanx-restriction),
  and [§5](plan-history.md#5-outcome). It remains there as the first full implement/review
  run and as evidence for adversarial review.
- **AI foundation history:** [§6.6](plan-history.md#66-stage-1-outcome),
  [§6.8](plan-history.md#68-stage-2a-outcome), [§6.9](plan-history.md#69-stage-3-outcome),
  [§6.11](plan-history.md#611-stage-2c-outcome), [§6.12](plan-history.md#612-stage-4-outcome),
  [§6.13](plan-history.md#613-stage-3b-outcome),
  [§6.14](plan-history.md#614-stage-3b-second-review-outcome),
  [§6.15](plan-history.md#615-stage-3b-third-review-outcome), and
  [§6.16](plan-history.md#616-stage-3b-fourth-review-outcome) — the last
  four are Stage 3b's four failed review passes, still open (see In
  flight above).
- **Shipped feature notes:** [§7](plan-history.md#7-start-a-new-game-at-any-time),
  [§8](plan-history.md#8-bug-units-cannot-move-through-friendly-units),
  [§9](plan-history.md#9-live-defects-found-by-stage-2a) (endgame + advance-terrain defects),
  [§11](plan-history.md#11-combat-reporting-detail),
  [§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat),
  [§13](plan-history.md#13-hex-coordinate-tooltip),
  [§14](plan-history.md#14-decomposing-boardscenets-for-parallel-work) (proposed, never started),
  [§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force),
  and [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means).

> **Line citations were re-verified against `main` on 2026-08-07** (at
> `3b15577`), after ~440 lines of drift in `BoardScene.ts` had rotted most of
> them. `tsc --noEmit` clean, `vitest run` 272 passed / 1 skipped (the
> permanent Stage-2b elephant skip). Anything cited in `plan-history.md` is
> accurate as of that commit and will rot again — see
> [§14.1](plan-history.md#141-first-a-correction-the-constraint-is-partly-self-imposed) item 3.

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

### ⚠️ Verifying a UI change by hand: pin the port

This project routinely has **four checkouts** live (`heraklios`,
`heraklios-stable`, `heraklios-codex`, plus any agent worktree under
`.claude/worktrees/`), and a `npm run dev` in each grabs the next free Vite
port. During [§13](plan-history.md#13-hex-coordinate-tooltip) three servers were running
with **two bound to 5173**, so `http://localhost:5173` non-deterministically
served a tree that did not contain the feature under test — two rounds of
manual verification reported "no tooltip" against code that never had one.
`localhost` resolves to IPv4 or IPv6 depending on the client, and two
processes can each hold one of them on the same port.

So: start the server on an explicit port, and **prove the code is served
before asking anyone to look**.

```bash
npm run dev -- --port 5199 --strictPort --host 127.0.0.1
curl -s http://127.0.0.1:5199/src/ui/MapView.ts | grep -c showHexTooltip   # must be non-zero
```

`--strictPort` makes a collision fail loudly instead of silently sliding to
the next port, and quoting `127.0.0.1` rather than `localhost` removes the
IPv4/IPv6 ambiguity. To see what is actually running:

```bash
powershell -Command "Get-NetTCPConnection -State Listen -LocalPort 4173,5173,5174 | Select-Object LocalPort,OwningProcess"
```

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

## 18. Live defect: ramming bonus narrows the table instead of extending it

**Status: confirmed live defect, not yet fixed.** Reported by the user
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
