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
`ceb106a`)**, presentation-only, and **[§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred)
Stage 3b — the shallow-lookahead fourth `HeuristicAgent` tier, labelled
"AI — cautious" (merged `f4573d3`, after six rounds of adversarial review
— two early rounds found and fixed real behavioral bugs, the last three
found none — see [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass)
for the full record and why the review cycle stopped there)**, which
completes plan-history.md's Stage 3 AI roadmap.
and **[§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
— the ramming bonus fix**, which closed the plan's last open live defect: a
bonus now *extends* the printed success range instead of narrowing it, per
the rulebook's own general sentence rather than the one worked example the
old reading had been fitted to (see
[§18.5](plan-history.md#185-outcome) for the outcome and the four review
findings on top of it), and **[§17](plan-history.md#17-manual-step-by-step-naval-movement)
— manual step-by-step naval movement** (merged `3dee4e8`), replacing
destination-click naval movement with hex-by-hex manual control and
reworked Turn-button glyphs, after a FAIL/fix/PASS review cycle (one HIGH
defect: a forward click could silently auto-rotate the ship onto a
differently-faced ramming contact and overcharge movement — see
[§17.6](plan-history.md#176-outcome) for the outcome and the review
findings).
**In flight:** [§20](#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
— live defect, fixed and green in the working tree, not yet committed or
reviewed.
**Carried over from merges, manual browser pass still owed:** Stage 4's
([§6.12](plan-history.md#612-stage-4-outcome)), §16's, and now §17's naval
movement controls too — Chrome automation was unavailable in the sessions
that shipped §16 and §17, so both have been verified by `tsc`/`vitest`/
`build` and code review only, not by eye.
**Also carried over from §17: 4 unfixed LOW doc-staleness findings.** §17's
second review round (post-merge) found `README.md:456-457`,
`src/scenes/BoardScene.ts:1344`, `README.md:461` (contradicts `README.md:687`),
and `src/scenes/BoardScene.ts:1338-1339` all still describe pre-`cfe5e75`
click/highlight behavior. Verified still present in `main` as of this note
(2026-08-20) — doc-only, no code-behavior risk, small enough to sweep in one
commit whenever someone's next in that file. See
[§17.6](plan-history.md#176-outcome)'s correction note for the exact wording
each one needs.
**Live defects still open:** none. [§20](#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all) —
a unit that starts its move already inside an enemy ZOC couldn't move at
all, not even to hexes free of any enemy ZOC — was reported by the user
2026-08-20, confirmed by direct reproduction, and fixed in the working tree
before this snapshot was written (`tsc -b` clean, `vitest run` 496/496).
**Not yet committed or reviewed** as of this note — see §20 for the
diagnosis and the chosen interpretation of "same ZOC."

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
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3b — shallow lookahead tier (6 review rounds; see [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass)) | `f4573d3` |
| [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it) ramming bonus extends the table (+4 review findings, +1 follow-up: [§19](#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more)) | see [§18.5](plan-history.md#185-outcome) |
| [§17](plan-history.md#17-manual-step-by-step-naval-movement) manual step-by-step naval movement (FAIL/fix/PASS; 1 HIGH + 2 MEDIUM + 4 LOW review findings, all fixed) | `3dee4e8` |

### In flight

[§20](#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
— live defect: a unit starting its move already inside an enemy ZOC
couldn't move at all. Diagnosed, fixed, and tested in the working tree
(`tsc -b` clean, `vitest run` 496/496); **not yet committed or reviewed.**

### Queued

All fully-shipped rows that previously lived here (Stage 3b, §17, §18 and
earlier) are in the [Shipped](#shipped) table above; see the History Map
for their postmortems.

| # | Item | Touches | Notes |
| --- | --- | --- | --- |
| 5 | [§19](#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more) lookahead tier is blind to ramming | `heuristicAgent.ts` + its tests | Engine-only AI tuning, surfaced and measured by §18. Not urgent and not proven — [§19.3](#193-options-in-preference-order) option 3 (re-measure at 160 seeds) is the cheap first step. |

## Backlog Map

- **Start here:** [Current Queue](#10-sequenced-queue).
- **Current next task:** get [§20](#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
  committed and through adversarial review — it's implemented and green but
  unreviewed, so it isn't done yet by this project's own standard. #5,
  [§19](#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more)
  — the lookahead AI tier's blindness to ramming threats — is next after
  that. Engine-only, not urgent; [§19.3](#193-options-in-preference-order)
  option 3 (re-measure at 160 seeds) is the cheap first step before deciding
  whether to fix it for real.
- **Live defects:** none confirmed-and-open. [§20](#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
  is fixed pending commit/review (see In flight, above);
  [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
  was the previous one and is shipped.
- **Owed:** a manual browser pass over §16's per-hex choice labels, §17's
  naval movement controls, and Stage 4's still-outstanding one
  ([§6.12](plan-history.md#612-stage-4-outcome)) — next person with a
  working browser session should give all three a look. Also owed: §17's 4
  LOW doc-staleness findings noted in Current Snapshot above.

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
  [§6.15](plan-history.md#615-stage-3b-third-review-outcome),
  [§6.16](plan-history.md#616-stage-3b-fourth-review-outcome),
  [§6.17](plan-history.md#617-stage-3b-fifth-review-outcome), and
  [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass) — Stage
  3b's full review history, five fails then a PASS, shipped `f4573d3`.
- **Shipped feature notes:** [§7](plan-history.md#7-start-a-new-game-at-any-time),
  [§8](plan-history.md#8-bug-units-cannot-move-through-friendly-units),
  [§9](plan-history.md#9-live-defects-found-by-stage-2a) (endgame + advance-terrain defects),
  [§11](plan-history.md#11-combat-reporting-detail),
  [§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat),
  [§13](plan-history.md#13-hex-coordinate-tooltip),
  [§14](plan-history.md#14-decomposing-boardscenets-for-parallel-work) (proposed, never started),
  [§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force),
  [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means),
  [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
  (the ramming bonus — read [§18.4](plan-history.md#184-why-this-got-missed-and-why-it-took-three-tries-to-find)
  and [§18.5](plan-history.md#185-outcome) together: the same "fitted to the
  one example available" failure, once in the original bug and once in the
  fix's own postmortem), and
  [§17](plan-history.md#17-manual-step-by-step-naval-movement) (manual
  step-by-step naval movement — [§17.6](plan-history.md#176-outcome) has
  the FAIL/fix/PASS review cycle and a process note on a worktree-lock
  snag worth reading before the next multi-round fix cycle).

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

## 19. The lookahead tier is blind to ramming, and that now costs measurably more

**Status: open, not urgent.** Surfaced by [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)'s
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

---

## 20. Live defect: a unit that starts its move already inside an enemy ZOC can't move at all

**Status: fixed in the working tree, not yet committed or reviewed** — see
[§20.5](#205-outcome). Reported by the user 2026-08-20 with a concrete
board position; confirmed by direct reproduction against the real map data
(not just read from the code) before being recorded here.

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

### 20.3 What the code actually does

`reachableHexes` in `src/engine/movement.ts:50-110` computes `startedInZoc`
(line 67) and then, inside the BFS loop:

```ts
// A unit that began its move inside an enemy ZOC may not shuffle to
// another hex still within that same ZOC without first leaving it.
if (currentKey === startKey && startedInZoc) continue;
```

This `continue` fires on the very first iteration (`current === unit.position`)
and skips the entire neighbor-expansion loop for that iteration — so the
BFS frontier is emptied without ever visiting a single neighbor. The
comment describes the correct rule ("may not shuffle to another hex still
within that same ZOC"), but the code doesn't implement that rule — it
implements "may not move to *any* hex, full stop," which is strictly more
restrictive than what's written above.

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
`reachableHexes` returns an **empty** map regardless — the elephant is
completely immobilized, matching the user's report exactly. `(5,5)` is not
actually adjacent to `(6,3)` (hex distance 2), so it isn't a factor —
`(5,3)` and `(5,4)` alone already put the elephant in ZOC.

### 20.5 Outcome

**Fixed in the working tree** (`src/engine/movement.ts`,
`src/engine/movement.test.ts`) while this section was still being written —
by a concurrent session working the same checkout, not by the session that
diagnosed and drafted §20.1-20.4 above. Left in place as-is rather than
rewritten, per this file's own archiving rule about describing what
actually happened.

The shipped fix reads "that same ZOC" more narrowly than §20.2's plain-text
gloss: not "any enemy ZOC coverage" but **the specific set of enemy units
projecting ZOC onto the start hex.** `enemyZocProjectorsForHex` returns the
ids of every non-naval enemy unit adjacent to a given hex (river-blocked
adjacency excluded, matching `hexesUnderZoc`'s own rule); `reachableHexes`
computes this set once for the unit's start hex, and its per-neighbor loop
blocks a direct first step only into a hex that shares **any** projector
with the start hex — not into every ZOC hex in general. A hex covered by a
*different* enemy's ZOC (no projector overlap with the start hex) is a
legal direct first step under this reading. This is a real interpretation
choice beyond §20.2's literal text (which doesn't disambiguate "same ZOC"
between "the same projecting unit(s)" and "ZOC coverage in general") and is
recorded as a code comment at the change site, per this project's
ambiguous-rule convention. `straightLineMoveCost` (the charge-cost helper)
got the equivalent fix, closing the analogous gap [§20.3](#203-what-the-code-actually-does)
flagged as unchecked for that path; naval movement's separate code path in
`navalMovement.ts` was not touched and wasn't found to have the same bug
shape (naval ZOC is presently not modeled at all, so the question doesn't
arise there).

Two new `movement.test.ts` cases (`reachableHexes — starting in enemy ZOC`)
cover: the reported elephant scenario (exits to `(7,2)`/`(7,3)` directly,
reaches `(6,4)` only via that two-step detour, still can't reach `(6,2)`
directly) and a minimal single-enemy case proving the direct-shuffle-within-
the-same-ZOC prohibition still holds. `tsc -b` and `vitest run` both clean,
496/496 tests passing (up from 494).

**Not yet done:** commit and adversarial review — this project's standing
process ([§1](#1-agent-workflow)) calls for a review pass on every rule
change before it's considered done, and none has happened yet for this one.
