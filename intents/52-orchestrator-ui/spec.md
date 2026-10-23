<!-- generated-by: heraklios/spec@0.1.0 -->
# §52 spec — Orchestrator UI to manage intents and their Claude sessions

Accepted intent: [intent.md](intent.md)

Written against `main` at `9a0ac4e`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| rulebook | nothing: SDLC tooling, no game rule |
| `intents/README.md` → "Who edits what" | a gate is written by the owner directly, or by an agent on the owner's request in the current conversation; a subagent never records one |
| `REVIEW-POLICY.md` → "Merging" | a merge only on the owner's explicit request for that intent; the three preconditions; `/ship` wraps them in `npm run ship` |
| `CLAUDE.md` → "Parallel sessions" | one coordinator in the main checkout; only it runs `/spawn`, `/sessions`, `/review`; about three intent sessions at once |
| `scripts/queue.mjs:95` (`--json`), `scripts/queue-lib.mjs:88` (`queueData`) | the queue as data already exists |
| `scripts/sessions.mjs` | prints a table and `--log`; **no `--json` yet** |
| `scripts/session-lib.mjs:47-209` | `parseWorktreeList`, `parseEvents`, `latestEventByWorktree`, `sessionState`, `gateSummary`, `autoSummary`, `metadataColumns`, `sortRows`: the sessions view's logic, pure and tested |
| `server/saveApi.ts:37-80` | the Host allow-list against DNS rebinding and the Origin check, the model for a local-only server |
| `.claude/settings.json` | the hooks that write `.git/heraklios-sessions.jsonl`, filed by `CLAUDE_PROJECT_DIR` |
| owner's answers, 2026-10-23 | sessions through **both** the Agent SDK (headless) and an interactive CLI in a pty, **the pty split out to a later intent** (owner, at the spec stop: "split out the terminal"); lives in `tools/orchestrator/` with its own server; `/auto`, `/review` and `/spawn` stay skills the UI launches; **staged**: §52 is the dashboard plus spawn, launching and stopping sessions with their live output and permission answers, and the gate and ship buttons |

## Behaviour

**B1 — Starting it.** `npm run orchestrator` starts a Node server from
`tools/orchestrator/` on `127.0.0.1` at its own port (5299 by default, see Assumptions,
and overridable with
`--port`). It prints the URL and serves one web page. It is never part of
the game build, Vite or `npm run verify`'s bundle, and it runs from the main
checkout only (like `npm run ship`).

**B2 — Local only.** Every request passes the save API's two checks before
anything else: the `Host` header is this PC's own name and port, and a
request that changes something carries an `Origin` equal to the server's own
`http://<host>`. Anything else gets 403. It listens on `127.0.0.1` only.

**B3 — The dashboard (read-only).** One page shows:
- every intent from `queueData` (id, title, type, status, gates, auto
  summary, branch or `main`);
- every worktree from the sessions view (status, gates, ±main, dirty,
  session state, port), from a new `npm run sessions -- --json`;
- for each intent, **the next step**: the gate or action that comes next and
  who owns it (owner or agent), derived by a pure function from its
  metadata, review header and worktree state;
- what waits on the owner, first.

It refreshes on its own (polling or file watch; the plan picks), and never
writes to show something.

**B4 — Spawn.** A "Spawn" button on an intent without a worktree runs
`npm run spawn -- <id>` and shows its output. "Remove" on a merged one runs
`npm run spawn -- <id> --remove`, which keeps its own refusals.

**B5 — Headless sessions (Agent SDK).** The owner launches a session for an
intent in one of three roles, each with its prompt and working directory:
- **implementer:** in the intent's worktree, the `heraklios-implementer`
  brief `/spawn` step 5 gives today;
- **reviewer:** `/review <id>`, in the main checkout as coordinator;
- **auto:** `/auto <id>`, in the main checkout as coordinator.

The session loads the project's settings, so `CLAUDE.md`, the skills and
the hooks apply as in a terminal session. Its messages stream into the page
as they come (text, tool calls and results, final result). "Stop" interrupts
it. A session's transcript is kept until the server stops.

**B6 — Answering a session.** A permission prompt or a question from a
headless session appears in the page with its options. The owner's click is
the answer; nothing is allowed by default. While one waits, the intent shows
"needs you".

**B7 — Interactive sessions: split out.** The owner moved the interactive
terminal (the real `claude` command line in a pseudo-terminal, shown in the
page) to a later intent. §52 has no pty and no terminal widget; B7 keeps its
number so the other references stay stable.

**B8 — Gate buttons.** For a gate whose preconditions hold (`intent_accepted`
on a draft; `spec_accepted` once `spec.md` exists; `plan_approved` once
`plan.md` exists; `live_checked` once the current review says `owed`), a
button records it after a confirm dialog naming the gate and intent. It
writes a **bare date** (the owner did it, not an agent), on the branch's
`metadata.yml` when the branch exists, else on `main`, and commits it with
the owner's git identity and a subject naming the gate. It never records a
gate any other way.

**B9 — Ship.** "Ship" on an intent first shows `npm run ship -- <id>
--dry-run`. If nothing is in the way, a confirm dialog (with an optional
"live check words" field, passed as `--live-checked`) runs `npm run ship --
<id>` and shows its report. The script's preconditions and refusals are the
only ones that apply.

**B10 — The coordinator.** The rules stay where they are. A session the
orchestrator launches in the main checkout (reviewer, auto) **is** the
coordinator for that run, so `/review`'s and `/auto`'s "only the
coordinator" rules hold unchanged. `CLAUDE.md` → "Parallel sessions" gets a
paragraph saying so and naming `npm run orchestrator`. The skills are not
changed or removed in §52.

**B11 — Launched sessions show in `npm run sessions`.** A headless
session runs with the project's hooks, so its events are filed under its
working directory as today's do. The orchestrator also keeps its own list of
the processes it started, and shows both.

**B12 — No second source of state.** The orchestrator stores nothing about
intents or sessions on disk. `metadata.yml`, git and
`.git/heraklios-sessions.jsonl` stay the owners of their data; its own
process list lives in memory.

## Interpretations

- **"Using it needs no coordinator session"** (intent Outcome 2): no
  terminal coordinator needs to be open. A coordinator-role session still
  runs `/review` and `/auto`, launched from the page (B10, owner's answer).
- **"Written the same way as today (`<date>`, not `by-agent`)"**: a bare
  date and a normal commit by the owner's git identity. The click is the
  owner writing the gate directly (`intents/README.md`, "You write it
  directly").
- **"Staged"** (owner's answer): §52 is everything in B1-B12. Anything the
  intent names beyond it waits for a later intent: retiring the terminal
  coordinator, UI-driven `/auto` logic, remote use.

## Acceptance criteria

- **AC1 — pure logic** (`tools/orchestrator/*-lib.test.mjs`, in `npm test`):
  - the next-step function for each status and gate combination (B3);
  - the gate-button preconditions (B8);
  - the Host and Origin checks (B2), reusing or mirroring the save API's
    tests;
  - the role prompts and working directories (B5);
  - the gate write (B8): a bare date replaces only that line, on the right
    `metadata.yml`.
- **AC2 — `npm run sessions -- --json`** (`scripts/session-lib.test.mjs`):
  the same rows as the table, as data (B3).
- **AC3 — the server** (`tools/orchestrator/*.test.mjs`, with an injected
  process runner and file system): a request with a foreign Host or Origin
  gets 403 and runs nothing (B2); "Ship" runs the dry-run first (B9).
- **AC4 — live check** (owed by rule 3: processes and a browser page only
  show in a real run):
  - `npm run orchestrator`, open the page: the dashboard matches
    `npm run queue` and `npm run sessions`;
  - spawn a throwaway intent; launch an implementer session; answer one
    permission prompt in the page; stop it;
  - record a gate with the button (bare date, commit by you);
  - dry-run a ship. Do not ship a real intent in the check.
- **AC5** — `npm run verify` green with lint ≤ 21 (the orchestrator's files
  under the same rules), `npm run check:intent` PASS, nothing in the game
  bundle (`npm run build` output unchanged in size apart from noise).

## Non-functional

- **Engine/presentation split:** untouched; no `src/` change.
- **Save format, undo, AI/harness:** untouched.
- **Dependencies:** the Agent SDK is a new dev dependency, with its "why"
  line in the plan (`REVIEW-POLICY.md` pass 8). No pty library (B7).
- **Tier:** `CLAUDE.md` changes and the server spawns processes that edit
  the repo; the spec argues for `review_tier: reviewed`.
- **Security:** local-only (B2), nothing allowed by default (B6), confirm on
  every gate and ship (B8, B9), no secret stored.

## Out of scope

- Retiring the terminal coordinator or the skills; moving `/auto` into code.
- The interactive terminal in the page (B7), split out by the owner to a
  later intent.
- Remote or multi-user access, authentication beyond B2.
- Editing intents, specs or plans in the page (it links to the files).
- Persisting transcripts across server restarts.

## Assumptions I made

- **Port 5299** as the default. It is the top of the per-intent range; §99
  would collide, and `--port` overrides.
- **The SDK loads project settings** (CLAUDE.md, skills, hooks) when asked,
  and offers a permission callback that covers questions too. The plan
  verifies the exact API against the installed version.
- **Hooks fire in headless sessions** so B11 holds; if they don't, the
  orchestrator's own process list is the source for its sessions, and the
  plan says so.
- **`review_tier: reviewed`** is proposed here; it is set in `metadata.yml`
  only if you accept this spec.
- **Polling every few seconds** is enough for B3; no websocket for the
  dashboard (the session streams may use one).
