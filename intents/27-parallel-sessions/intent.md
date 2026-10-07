<!-- generated-by: heraklios/intent@0.1.0 -->
# §27 — Parallel sessions: spawn, event log, coordinator

**Type:** refactor
**Originator:** Eric — "work on several changes in parallel … it should enable
to have sessions working on different features … a global orchestrator and
some way to manage the state and the different events along the time"
**Source:** conversation with Claude, 2026-10-07; builds on [§26](../26-ai-sdlc-kit/)

## Problem

Running more than one Claude Code session on heraklios at a time is done by
hand today, and it keeps going wrong in the same ways. `plan.md` §4 records
them: worktrees without `node_modules`, junctions that wiped the main
install, dev servers colliding on a port, reviewers fighting over a branch
that is checked out somewhere else. There is no place that shows which
sessions exist, which intent each one is working on, or which one is
waiting for an answer, so the owner has to visit every terminal to find out.
`plan.md` is edited from several branches, which creates merge conflicts.

## Outcome

- One command turns an intent into a ready session: a worktree on the
  intent's branch, outside the repo, with its own `node_modules` and its own
  dev port, plus a local brief telling the session what it is and what it may
  touch.
- Every Claude Code session in any heraklios worktree appends its lifecycle
  events (start, prompt, turn done, needs you, end) to one shared log, and
  never has to remember to do so.
- One command in the main checkout shows every worktree with its intent
  status, gates, commits ahead/behind `main`, uncommitted files and what its
  session is doing, sorted so "needs you" comes first.
- `CLAUDE.md` says who the coordinator is and what only the coordinator
  does (`plan.md`, merges, rebase notices).

## Constraints

- Merges stay local and are done by the owner (§26 decision); the tooling
  only reports and suggests merges.
- Never junction `node_modules` into a worktree that will be deleted
  (`plan.md` §4 "The `node_modules` problem"). Spawn runs `npm ci` instead.
- Hooks must never block or slow a session: no output, always exit 0.
- No game behaviour changes; nothing under `src/` changes.
- Lint warning cap stays at 21.

## Type-specific questions

### Refactor
- **What is restructured:** how work is launched and tracked. New:
  `scripts/spawn-intent.mjs`, `scripts/sessions.mjs`,
  `scripts/session-event.mjs`, `scripts/session-lib.mjs` (+ tests),
  `.claude/settings.json` (hooks), `/spawn` and `/sessions` skills.
  Changed: `CLAUDE.md`, `AGENTS.md`, `.gitignore`, `package.json`, `plan.md` queue.
- **How behaviour is held constant:** no `src/` file changes; the full suite
  stays green untouched.
- **Why now:** Eric wants to run several intents at once, and the new intent
  ids make it possible to tie a session to a work item.

## Assumptions I made

- **Type is refactor**, following §26's precedent for repo tooling. Game
  behaviour doesn't change. A feature would also need a spec, and there is no
  design question here that one would settle.
- **Worktrees live in `../heraklios-wt/<id>-<slug>`**, outside the repo, so
  vite, vitest and eslint in the main tree never see a nested checkout.
  Claude's own agent worktrees stay in `.claude/worktrees/`.
- **Dev port = 5200 + (id mod 100)** (§27 → 5227). The range 5200–5299
  stays clear of Vite's default 5173 and the 5199 that the runbook uses.
- **The event log lives in the shared git dir** (`.git/heraklios-sessions.jsonl`):
  every worktree can reach it, and it is never committed.
- **A spawned session's intent folder moves with its branch.** If `/intent`
  drafted the folder in the main checkout and it isn't committed, spawn
  moves it into the new worktree. Otherwise it would block the merge back as
  an untracked-file conflict.
