<!-- generated-by: heraklios/spec@0.1.0 -->
# §47 spec — The intent queue is generated from metadata.yml; the root plan.md stops carrying status

Accepted intent: [intent.md](intent.md)

Written against `main` at `c617fcb`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `plan.md` "How To Manage This Plan" | "A queue row is one line … with the type and the status from its `metadata.yml` (which is the source of truth for status)"; "it mirrors `metadata.yml`, which wins if they disagree" |
| `plan.md` sections | Current Snapshot `:71`, Current Queue `:166` (Shipped `:171`, In flight `:220`, Queued `:227`), Backlog Map `:238`, History Map `:261`, §1 Agent workflow `:337`, §4 Runbook `:421` |
| `intents/README.md:8-11` | "`plan.md` at the repo root stays the **coordinator view** — snapshot, queue, backlog, history map." |
| `intents/README.md:26-28` | the id is "the same numbering `plan.md`, `plan-history.md` and the commit messages already use" |
| `scripts/session-io.mjs:53` `readIntentMetadataFromBranch`, `:80` `readIntentMetadata`; `scripts/session-lib.mjs:21` `branchFor` | reading an intent's metadata from its branch or from `main` |
| `scripts/sdlc-scan.mjs:75` | `isPlanOnly = (s) => /^Plan[:\s]/i.test(s)`: commits by subject, not by file |
| References to the root `plan.md` | `CLAUDE.md:43`, `:61`, `:117`, `:123`, `:142`; `AGENTS.md:10`, `:15`, `:40`; `REVIEW-POLICY.md:140`, `:168`; `intents/README.md:8`, `:26`; `sdlc.md:13` (next id), step 6; `.claude/skills/intent/SKILL.md` (§2 gather, §4.1 id, §4.4 queue row); `.claude/skills/sessions/SKILL.md:15`, `:40`; `.claude/skills/spawn/SKILL.md:61`, `:65`; `.claude/skills/review/SKILL.md:49`; `.claude/agents/heraklios-implementer.md:3`, `:26`, `:31`; `.claude/agents/heraklios-reviewer.md:62`, `:69`, `:98`, `:114`; `.codex/agents/heraklios-implementer.toml:12`, `:14`; `scripts/session-lib.mjs:263`; `scripts/spawn-intent.mjs:7`, `:127` |

## Behaviour

**B1 — `npm run queue` prints the queue.** A new command
(`scripts/queue.mjs`, logic in a pure, tested `scripts/queue-lib.mjs`)
lists every intent in `intents/` on `main`, grouped **In flight** (accepted,
in-progress, in-review), **Queued** (draft), **Shipped** (done, newest
first), **Stopped** (abandoned, deferred), one line each: `§id`, title,
type, status, gates (the `I·S·P` summary `npm run sessions` already
prints), and the merge hash for shipped ones. `--json` gives the same as
data. Nothing is written to disk (owner's decision: command only).

**B2 — Status comes from where the intent lives.** For an intent whose
branch exists and isn't merged into `main`, the status and gates are read
from that branch's `metadata.yml` (an implementer sets `in-review` there,
not on `main`); otherwise from `main`. The line says which (`branch` /
`main`). **Amended 2026-10-23, owner's decision ("main wins"):** when
`main`'s `metadata.yml` holds a terminal status (`done`, `abandoned`,
`deferred`), `main` wins over any branch, so a branch kept unmerged on
purpose (§30's `exp/30-browser-test-probe`) doesn't show a finished
intent as in flight.

**B3 — The root `plan.md` is retired.** It is removed in this change. Its
parts go to:
- **Current Snapshot and History Map** → a new, short **`OVERVIEW.md`** at
  the repo root (owner's decision), edited rarely and by the owner. It also
  keeps the pre-§26 Shipped rows (Feature A, §6.x, §9–§25: items with no
  `metadata.yml`) as a static list that never changes again, and links to
  `npm run queue` for everything since.
- **§1 Agent workflow and §4 Runbook** → **`docs/runbook.md`** (owner's
  decision), unchanged in substance, section anchors kept so a reader can
  find "§4" there.
- **Current Queue** → nothing: `npm run queue` replaces it.
- **Backlog Map** → `OVERVIEW.md` "Carried over" lists the two open items
  it holds today (the §19.5 follow-up, the owed manual browser pass) once;
  from now on a new idea is a **draft intent** (owner's decision), which
  `npm run queue` lists under Queued.
- "How To Manage This Plan" and "Archiving to `plan-history.md`" → the
  parts that still apply move to `OVERVIEW.md`'s header (how to archive into
  `plan-history.md`); the queue rules are dropped.

**B4 — No one writes a status row.** Every rule that has the coordinator,
`/intent`, `/spawn`, `/sessions`, `/ship` or an agent edit the queue goes:
- `/intent`: §4.4 (the queue row) removed; version bumped to 0.1.5.
- `/sessions`: step 5 (queue drift) removed; step 1 adds `npm run queue`.
- `/spawn`: the "move the row to Shipped" step removed.
- `REVIEW-POLICY.md` → "Merging" bookkeeping: "the `plan.md` row to
  Shipped" removed (only `merged:` and `status: done` remain).
- `CLAUDE.md`, `AGENTS.md`, `intents/README.md`, `sdlc.md`, the agents
  (Claude and Codex) and `scripts/session-lib.mjs`'s spawn brief: "only the
  coordinator edits `plan.md`" / "do not edit `plan.md`" become "the queue
  is generated (`npm run queue`); nobody edits it".
- `/ship` (§46, merged before this): its root-`plan.md` row move and its
  "dirty `plan.md`" check removed, with their tests.

**B5 — Every other pointer moves.** "plan.md §4" → `docs/runbook.md` §4
(`CLAUDE.md`, `AGENTS.md`, the agents, `/review`, `/spawn`,
`scripts/spawn-intent.mjs` messages); "the coordinator view" →
`OVERVIEW.md` + `npm run queue`. References to an intent's own `plan.md`
(`intents/<id>-<slug>/plan.md`) are untouched. The 13 links in
`plan-history.md` into the root file (`#1-…`, `#4-…` → `docs/runbook.md`;
`#10-sequenced-queue` → `OVERVIEW.md`; `#21-…` → its `plan-history.md`
section) move too. **Amended 2026-10-22, owner's decision:** the ~250
"plan.md §N" comments in 31 `src/` files, which point at sections already
archived in `plan-history.md`, stay; `OVERVIEW.md` says that such a comment
means `plan-history.md` §N.

**B6 — The next id.** `/intent` §4.1 takes one more than the highest `§N`
found in `plan-history.md`, `OVERVIEW.md`, the `intents/` folders on `main`
**and on every local branch** (`git branch --list`, then `git ls-tree`), so
an id taken on a branch not yet merged isn't taken twice (the §42 / §43
collision of 2026-10-22). `npm run queue -- --next-id` prints it, and
`/intent` uses that.

**B7 — The scan keeps its meaning.** `sdlc-scan`'s "plan-only commits
excluded" rule matches commit subjects starting `Plan:` (`:75`), not the
file; it stays as is (old commits keep their subjects). No other scan
output depends on the root `plan.md`.

## Interpretations

None of the rulebook. One reading of the owner's "do we really need the
plan.md that is not in the intent": the root file goes entirely (B3), not
just its queue, since what's left (snapshot, history map) moves to
`OVERVIEW.md` by the owner's choice, and the name clash with the intents'
`plan.md` ends with it.

## Acceptance criteria

- **AC1** — `scripts/queue-lib.test.mjs`: grouping by status; status read
  from the branch when it exists and isn't merged, else from `main` (B2);
  shipped sorted newest first with the hash; `--next-id` takes the max
  over `plan-history.md`, `OVERVIEW.md`, `main`'s and branches' `intents/`
  (B6). Mutants: read status from `main` always; ignore branches in the id;
  drop the Stopped group.
- **AC2** — `scripts/queue.test.mjs` in a sandbox repo (the
  `spawn-intent.test.mjs` harness): two intents on `main`, one with a
  branch carrying `status: in-review`; `npm run queue` shows it In flight
  as in-review from `branch`; `--next-id` counts an intent folder that
  exists only on a branch.
- **AC3** — no stale pointer: `git grep -n "plan\.md"` outside
  `plan-history.md`, `intents/*/`, the intent template and `src/` (B5
  amendment) finds only references to an intent's own `plan.md`; `git grep
  -n "§4"` finds every
  runbook pointer naming `docs/runbook.md`. Run by the review and pasted.
- **AC4** — `npm run queue` on the branch prints every intent §26–§47 with
  the status its `metadata.yml` holds (the review compares a sample).
- **AC5** — live check (rule 3: the skills' behaviour shows only when they
  run): in a session in the worktree, `/intent --feature throwaway: …`
  writes no queue row anywhere and takes the next id from `npm run queue
  -- --next-id`; `/sessions` shows `npm run queue` and has no drift step;
  then delete the throwaway intent, commit nothing.
- **AC6** — `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS.

## Non-functional

- **Engine/presentation split, save format, undo, AI:** untouched.
- **Tier:** Reviewed (`.claude/skills/**`, `.claude/agents/**`,
  `.codex/agents/**`, `REVIEW-POLICY.md`).
- **Order:** §46 merges first; this change then edits `/ship` (B4).
- **Encoding:** every changed file valid UTF-8 (`iconv`), line endings as
  on `main`.

## Out of scope

- Rewriting or re-linking `plan-history.md` beyond links that pointed into
  the root `plan.md`.
- Turning the two carried-over backlog items into intents (the owner does
  that with `/intent` when he picks them up).
- A committed generated queue file (owner's decision: command only).
- Changing `sdlc-scan`'s commit classification.

## Assumptions I made

- **Remove the root `plan.md`** (B3) rather than leave a stub: every
  section has a new home, and a stub would keep the name clash.
- **Status from the branch** (B2): otherwise every in-review intent would
  show as accepted until merged, which is the drift this change removes.
- **Ids counted across local branches** (B6): the cheapest guard against
  two sessions taking the same id; remote-only branches aren't counted.
- **Pre-§26 shipped rows as a static list in `OVERVIEW.md`** (B3): they
  have no `metadata.yml`, so the generated queue can't show them.
- **`/intent` 0.1.5** (B4, B6): its queue-row step goes and its id rule
  changes.
