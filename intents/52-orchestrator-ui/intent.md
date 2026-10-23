<!-- generated-by: heraklios/intent@0.1.5 -->
# §52 — Orchestrator UI for intents and Claude sessions

**Type:** feature
**Originator:** me — the SDLC assumes a coordinator Claude Code session
**Source:** none (CLAUDE.md → "Parallel sessions"; `npm run queue`, `npm run sessions`, `/spawn`, `/auto`, `/ship`)

## Problem

Running several intents in parallel needs one Claude Code session acting as
coordinator: it reads `npm run queue` / `npm run sessions`, runs `/spawn`,
`/review`, `/auto`, `/ship`, and relays state to the owner in a terminal.
The owner's view of the work is whatever that session reports, the
coordinator's context is spent on bookkeeping, and nothing shows at a glance
which intents wait on the owner, which sessions are running, or which gate
is next.

## Outcome

- A local web app (separate from the game) lists every intent with type,
  status, gates and next step, and every worktree/session with its state,
  using the data `npm run queue --json` and `npm run sessions` already produce.
- From it the owner can spawn a worktree, launch and stop a Claude Code
  session per intent (implementer, reviewer, `/auto`), see its progress and
  output, and ship a reviewed intent. Using it needs no coordinator session.
- A gate is recorded only by an explicit owner click, written the same way as
  today (`<date>`, not `by-agent`, since the owner did it), and the existing
  "agent never records a gate or merges on its own" rules still hold.

## Constraints

- The rules in `CLAUDE.md` / `intents/README.md` / `REVIEW-POLICY.md` stay
  authoritative: the UI wraps the existing scripts (`queue`, `sessions`,
  `spawn`, `ship`, `check:intent`); it adds no second source of state.
  `metadata.yml` and `.git/heraklios-sessions.jsonl` remain the owners of
  their data.
- Local only: bound to localhost with the Host/Origin checks the save API
  uses (`server/saveApi.ts`); it spawns processes and edits the repo, so it
  must not be reachable from a web page or the network.
- Outside the game: no game rule, no `src/engine` change, no change to the
  game bundle. Pure logic (parsing, state derivation, what an action is
  allowed) is unit-tested; the UI is not.
- `ship` and gate recording are outward-facing/hard to reverse: the UI
  confirms, and `ship` keeps its dry-run and preconditions.
- Out of scope: remote/multi-user access, replacing hooks or the session log.

## Type-specific questions

### Feature
- **Users:** the owner (sole user); also the agents, whose current `/sessions`, `/spawn` etc. skills would be reduced to the same scripts.
- **Rulebook basis:** digital-only — no print rule.
- **Known simplification it removes:** none.
- **Open design questions:** for spec.md to settle —
  1. How to launch and stream a Claude Code session: `claude -p` / Agent SDK
     headless with stream-json, versus driving the interactive CLI in a pty
     (permission prompts and questions need an answer path in the UI).
  2. Where it lives and runs: a `tools/orchestrator/` Node server + web page
     (`npm run orchestrator`), versus a second Vite entry like the map editor.
  3. Whether `/auto` becomes UI-driven logic or stays a skill the UI launches.
  4. How `/review`'s "only the coordinator" rule maps: the UI as coordinator.
  5. Reading live session state: the hooks' jsonl only covers interactive
     sessions; launched implementers show no events today.
  6. What happens to the coordinator-session skills and CLAUDE.md wording.

## Assumptions I made

- Feature, not refactor, because it adds a user-facing capability and has
  real design questions.
- Review tier left to the path table; it adds a process-spawning server, so
  the spec may argue to raise it to `reviewed`.
- The owner wants this alongside the coordinator session at first, not an
  immediate removal of it.
- Windows is the primary platform (pty/process handling matters).
