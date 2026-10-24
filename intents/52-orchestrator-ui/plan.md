<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §52 plan — Orchestrator UI to manage intents and their Claude sessions

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

`npm run orchestrator` serves a local-only page (spec B1, B2). The page
shows every intent and worktree with its next step (B3). From it you spawn
and remove worktrees (B4), launch, follow, answer and stop headless Claude
Code sessions through the Agent SDK in three roles (B5, B6), record a gate
with a bare date (B8), and ship through the dry-run and `npm run ship` (B9).
The rules stay in the scripts and skills (B10, B12). The interactive terminal
(B7) is split out. Pure logic lives in a tested `*-lib.mjs`; the server's
routes are tested with an injected process runner and file system.

## Risks

- **A local server that runs processes is a target.** Every route goes
  through the Host and Origin checks first (B2), and the server listens only
  on `127.0.0.1`. Commands run with `execFile`/`spawn` on an argument array,
  never through a shell: the live-check words and ids never reach a command
  line as text. Ids must match `^[0-9]+$` and roles come from a fixed list.
- **Session output is untrusted text** (it can hold anything a repo file or
  tool output holds). The page writes it with `textContent` only, never
  `innerHTML` (`REVIEW-POLICY.md` pass 8).
- **Nothing allowed by default** (B6). `canUseTool` waits for the owner's
  click and has no timeout that allows. "Stop" or a closed server denies
  everything pending.
- **Tests must never run real git, spawn or ship.** The handler takes its
  runner, file system and SDK `query` as parameters; the tests pass fakes.
  The usual bug class here is a test that passes whatever the code does, so
  each route test asserts the exact command array it would run, or that
  none ran.
- **The lint cap (21).** The new files fall under the same guardrails (file
  ≤ 500 lines, function ≤ 80, complexity ≤ 20). `no-console` is lifted only
  for the CLI entry file, as for `scripts/**`. Never raise the cap.
- **The SDK is new, large and native.** `@anthropic-ai/claude-agent-sdk`
  0.3.309 (published 2026-10-22) pulls a platform binary through
  `optionalDependencies`. Pin the exact version; `npm ci` in a worktree must
  still work. A different, older version may change the option names
  verified below.
- **Credentials:** the SDK runs Claude Code with the user's existing login.
  The orchestrator stores no key or token (spec, Security).
- **Windows:** `npm` is `npm.cmd`, so `execFile('npm', …)` fails without a
  shell. Run the scripts as `node scripts/<x>.mjs …` with `process.execPath`
  instead, in the main checkout.
- **Two writers:** a gate click and a running session could both commit in
  the same worktree. The server holds one in-flight write per intent, and
  refuses a gate write or ship while it has a session running on that
  intent.
- **Stale line citations:** re-check the lines below before launch.

## Verified against the codebase

Re-read on `main` at `89354f0`.

- `package.json:6-21` — scripts (`queue`, `sessions`, `spawn`, `ship`,
  `verify` = build + lint + test); `:12` `--max-warnings 21`; `:22-24` only
  `phaser` as a dependency.
- `vitest.config.ts` — `include` is `src/**`, `server/**`, `e2e/**/*.test.ts`
  and `scripts/**/*.test.mjs`. **`tools/**` is not included yet.**
- `eslint.config.js:17-27` — ignores `tools/map-extract/` only;
  `:32` node and browser globals; `:59-64` `no-console` off for `scripts/**`.
- `scripts/queue.mjs:95-96` — `--json` prints `queueData(collectEntries())`.
- `scripts/sessions.mjs:43-55` — `rowFor(wt, latest)` builds each row (id,
  branch, path, metadata columns, ahead/behind, dirty, port, session);
  `:58-73` table or `--log`; **no `--json`**.
- `scripts/session-lib.mjs:16` `portFor` (5200 + id mod 100); `:47`
  `parseWorktreeList`; `:66` `parseEvents`; `:97` `latestEventByWorktree`;
  `:128` `sessionState`; `:176` `gateSummary`; `:187` `autoSummary`; `:197`
  `metadataColumns`; `:209` `sortRows`; `:221` `formatStatusTable`.
- `scripts/session-io.mjs:11` `git`; `:21` `mainCheckout`; `:41`
  `findIntentDir`; `:53` `readIntentMetadataFromBranch`; `:80`
  `readIntentMetadata`.
- `scripts/intent-check-lib.mjs:33` `parseBranch`; `:45` `parseMetadata`;
  `:89` `GATE_FIELDS`; `:101` `parseGate`; `:265` `parseReviewHeader`.
- `scripts/ship-lib.mjs:126` `setKeys(text, values)`, the line-preserving
  metadata write; `:148` `markLiveChecked`.
- `scripts/ship.mjs` — runs only from the main checkout on `main`; takes
  `--dry-run`, `--live-checked "<words>"`, `--trailer`.
- `scripts/spawn-intent.mjs` — `npm run spawn -- <id> [--remove]`.
- `server/saveApi.ts:66-90` — `LOCAL_HOST` and the non-exported
  `foreignHost`/`foreignOrigin`. They are TypeScript in a module that imports
  the engine, so the orchestrator mirrors the two checks in `.mjs` with its
  own tests rather than importing them.
- `.claude/settings.json` — the session hooks, loaded by any session that
  loads project settings.
- **Agent SDK 0.3.309** (`sdk.d.ts`, read from the published package):
  - `query({ prompt, options })` returns a `Query` (an async iterable of
    messages) with `interrupt()` (`:2928`, `:3321`);
  - `Options.cwd` (`:1634`), `canUseTool` (`:1625`), `abortController`
    (`:1562`), `permissionMode` (`:2031`);
  - `settingSources` (`:2315`): "When omitted, all sources are loaded
    (matches CLI defaults) … Must include `'project'` to load CLAUDE.md
    files";
  - `CanUseTool(toolName, input, { signal, suggestions, … })` returns
    `PermissionResult`, `{ behavior: 'allow', updatedInput? }` or
    `{ behavior: 'deny', message }` (`:228`, `:2570`);
  - `AskUserQuestion` is a built-in tool (`:216`), so a question arrives
    through `canUseTool` and is answered by `updatedInput` carrying the
    answers;
  - `engines.node >= 18`; this machine runs Node 24.11.0.
- `CLAUDE.md` "Commands" and "Parallel sessions": where B10's paragraph and
  the `npm run orchestrator` line go.

## Subtasks

1. **`npm run sessions -- --json`** (B3, AC2). In `scripts/session-lib.mjs`,
   add `sessionsData(rows, now)`: the rows `formatStatusTable` prints, as
   plain data (ages as numbers). Make `sessions.mjs` print it under
   `--json`. Add tests in `session-lib.test.mjs`. Commit.
2. **The pure logic** (B2, B3, B5, B8; AC1). In
   `tools/orchestrator/orchestrator-lib.mjs`:
   - `nextStep({ metadata, reviewHeader, worktree })` returns `{ step,
     owner: 'owner' | 'agent', gate? }` for each status and gate state;
   - `gateAllowed(gate, { metadata, specExists, planExists, reviewHeader })`
     (B8's preconditions);
   - `foreignHost` and `foreignOrigin`, mirroring `saveApi.ts`;
   - `roleLaunch(role, { id, slug, worktreePath, mainPath, brief })`
     returns `{ cwd, prompt }` for implementer, reviewer and auto; it
     rejects any other role and an id that is not digits;
   - `gateWrite(text, gate, date)` returns the new `metadata.yml` text
     through `setKeys`, a bare date, only that line;
   - `waitingOnOwner(entries)` gives B3's ordering.

   Add `orchestrator-lib.test.mjs` and the vitest include for
   `tools/**/*.test.mjs`. Commit.
3. **The server** (B1, B2, B4, B8, B9, B12; AC3). Write
   `tools/orchestrator/server.mjs`, `createHandler({ runner, fs, sessions,
   root })`:
   - `GET /` and the static page;
   - `GET /api/state`: queue and sessions JSON, from the scripts through the
     runner;
   - `POST /api/spawn/:id`, `POST /api/remove/:id`;
   - `POST /api/gate/:id/:gate`: it checks `gateAllowed`, writes with
     `gateWrite` in the branch's worktree (or on `main` before a branch
     exists), commits with the owner's git identity and the subject `§<id>:
     <gate> recorded (orchestrator)`, and refuses a branch without a
     worktree;
   - `POST /api/ship/:id?dry=1` and `POST /api/ship/:id` (with `live`
     words), as `node scripts/ship.mjs <id> [--dry-run] [--live-checked
     <words>]`.

   Every route checks Host first and Origin on each POST. Commands run
   with `process.execPath` and an argument array, never a shell. One write
   at a time per intent. Add `server.test.mjs` with a fake runner and file
   system:
   - a foreign Host or Origin gives 403 with no command run;
   - a non-digit id gives 400;
   - spawn, remove, gate and ship run exactly the expected argument arrays;
   - ship refuses without a prior dry-run in that request flow;
   - a gate whose precondition fails is refused with nothing written.

   Commit.
4. **Headless sessions** (B5, B6, B11). In
   `tools/orchestrator/sdk-sessions.mjs`, write `createSessionManager({
   query })`:
   - `launch(role, …)` calls `query` with `cwd`, `prompt` and `canUseTool`,
     leaving `settingSources` omitted so all settings load, as in a
     terminal;
   - it streams messages into a per-session in-memory transcript with
     subscribers;
   - `canUseTool` parks a pending request (tool, input, id) and resolves
     only on `answer(sessionId, requestId, result)`;
   - `stop` calls `interrupt()`, aborts, and denies everything pending;
   - `list()` gives id, role, intent, state (`running`, `needs you`,
     `done`, `stopped`, `error`) and the pending requests.

   Routes:
   - `POST /api/sessions` with `{ role, id }`;
   - `GET /api/sessions/:sid/events` as server-sent events;
   - `POST /api/sessions/:sid/answer`;
   - `POST /api/sessions/:sid/stop`.

   Add tests with a fake `query` (an async generator plus a recorded
   `canUseTool`):
   - a pending permission stays pending until answered;
   - "deny" and "stop" resolve it as deny;
   - an `AskUserQuestion` answer comes back in `updatedInput`;
   - nothing resolves as allow on its own.

   Add `@anthropic-ai/claude-agent-sdk` `0.3.309` (exact) to
   `devDependencies`. The why line: headless sessions for B5/B6 with a
   permission callback; the CLI has no programmatic answer path. Commit.
5. **The page** (B3, B5, B6, B8, B9). Write `tools/orchestrator/public/`
   (`index.html`, `app.js`, `style.css`), with no framework and no build:
   - the intent table (with next step and owner) and the worktree table,
     polled every 3 s;
   - "waiting on you" first;
   - spawn, remove and gate buttons, each with a confirm dialog naming the
     intent and gate;
   - "Ship": the dry-run report, then a confirm dialog with a "live check
     words" field;
   - a session panel per launched session: messages as they stream, pending
     requests with Allow/Deny, or the question's options, and Stop.

   All text goes in through `textContent`. Commit.
6. **The CLI, wiring and docs** (B1, B10). Write
   `tools/orchestrator/orchestrator.mjs`: it parses `--port` (default
   5299), refuses outside the main checkout on `main`, listens on
   `127.0.0.1` and prints the URL. Then:
   - add `"orchestrator": "node tools/orchestrator/orchestrator.mjs"` to
     `package.json`;
   - turn `no-console` off for that file in `eslint.config.js`;
   - in `CLAUDE.md`, add the command line under "Commands" and B10's
     paragraph under "Parallel sessions": a session the orchestrator
     launches in the main checkout is the coordinator for that run, and the
     owner's click on a gate button is the owner writing the gate directly;
   - in `intents/README.md` → "Who edits what", add the same gate-click
     sentence.

   Then the Progress entry and `status: in-review`. Commit.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| `foreignHost`/`foreignOrigin` (accept a foreign name, drop the port check) | lib tests per case, plus server 403 tests with no command run |
| Origin check skipped on POST | server test: POST with a foreign Origin, 403, runner never called |
| `nextStep` for each state (draft, accepted without spec, spec without gate, plan without gate, in-progress, in-review with each verdict, live check owed, ready to ship, done) | one exact-value case per state |
| `gateAllowed` (each gate's precondition, an already-recorded gate) | true and false case per gate |
| `gateWrite` writes `by-agent`, or touches other lines | exact text equality on a fixture `metadata.yml` |
| `roleLaunch` (cwd per role, unknown role, non-digit id) | exact `{ cwd, prompt }` per role; throws for the rest |
| ship without `--dry-run` first; `--live-checked` passed as one argument | server test on the recorded argument arrays |
| `canUseTool` allows without an answer; stop leaves a request pending | session manager tests with the fake `query` |
| AskUserQuestion answer not carried in `updatedInput` | session manager test |
| `sessionsData` drops or renames a field | `session-lib.test.mjs` exact rows |
| the page escapes nothing (`innerHTML`) | not unit-tested: pass 8 reads `app.js` for `innerHTML`, and the live check feeds a session output with `<b>` in it |

`/review` runs the mutations one at a time, foreground, restored by copy.

## Validation

- `npm run verify` green; lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run build`: the game bundle has no orchestrator file (`dist/` lists
  nothing from `tools/`).
- `npm run e2e`: not required, since no `src/scenes`, `src/ui` or `e2e/`
  path changes.
- **Live check (owed by rule 3, AC4)**, from the main checkout:
  1. Run `npm run orchestrator` and open `http://127.0.0.1:5299/`. The
     intent and worktree tables match `npm run queue` and `npm run
     sessions`, and "waiting on you" is first.
  2. Draft a throwaway intent, or use any accepted one without a worktree.
     Click Spawn: the output appears, and `npm run sessions` shows the
     worktree.
  3. Launch an implementer session on it with a prompt that needs a
     permission (the brief already does). The messages stream, a permission
     request shows Allow/Deny, Deny is honoured, then Stop ends it.
  4. Click a gate button on the throwaway intent: a confirm dialog, then a
     bare date in its `metadata.yml`, committed under your name.
  5. Click Ship on any intent: only the dry-run report shows. Cancel. Do
     not ship a real intent.
  6. From another tab, `curl -H "Host: evil.example"
     http://127.0.0.1:5299/api/state` gives 403.
  7. Remove the throwaway worktree with Remove, or by hand.

## Assumptions I made

- **Plain `.mjs` and a static page**, like `scripts/`: no TypeScript, no
  framework and no bundler for the orchestrator, so it adds one dependency,
  the SDK.
- **Server-sent events** for session streams; polling for the dashboard.
- **`settingSources` omitted** (all sources, "matches CLI defaults"), so a
  launched session behaves as a terminal one does, hooks included.
- **The implementer role's prompt** is `sessionBrief`'s brief plus "start
  the plan's subtasks", the same brief `/spawn` step 5 gives.
- **Commits from gate clicks** carry no Claude trailer: they are the owner's.
- **Port 5299**, overridable with `--port` (spec Assumptions).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-24 — all six subtasks

Commits: `e19a350` (1, `sessions --json`), `10a9bc5` (2, pure logic),
`1ef6125` (3, server), `5e01015` (4, session manager + SDK dependency),
`a2cbb1e` (5, page), `e8a2f3f` (6, CLI, npm script, eslint exemption, docs).
`npm run verify` green after each: 60 test files, 1087 tests (was 57 / 994 [corrected in the
round-1 rework, F9; this line said 995]
before the change; +3 files in `tools/orchestrator/`, +1 case group in
`session-lib.test.mjs`); lint 21 warnings, unchanged cap, no warning added or
removed; the build output has nothing from `tools/`. `npm ci --dry-run` is
clean with the SDK in the lockfile.

Shipped: `npm run sessions -- --json` (`sessionsData`); `tools/orchestrator/`
with `orchestrator-lib.mjs` (nextStep, gateAllowed, gateWrite, foreignHost,
foreignOrigin, roleLaunch, waitingOnOwner, parseCliArgs), `state.mjs`,
`server.mjs` + `actions.mjs` + `session-routes.mjs`, `sdk-sessions.mjs`,
`node-io.mjs`, `orchestrator.mjs`, `public/{index.html,app.js,style.css}`;
`npm run orchestrator`; `tools/**/*.test.mjs` in vitest's include;
`no-console` off for `orchestrator.mjs` only; CLAUDE.md, `intents/README.md`
and README.md as the subtask says.

Dependency why line: `@anthropic-ai/claude-agent-sdk` 0.3.309 (exact),
devDependency: headless sessions with a `canUseTool` permission callback for
B5/B6, which the `claude` CLI cannot give (no programmatic answer path). The
API read from the installed `sdk.d.ts` matches the plan (query, interrupt,
canUseTool, abortController, settingSources omitted, AskUserQuestion answered
through `updatedInput.answers`, question text -> answer).

Checked by starting a server (read-only, then stopped): a scratch script (not
in the repo) mounted the real handler and `node-io` on port 5298 with this
worktree as root and no session manager; `GET /` 200, `GET /api/state` 200
with the intents and worktrees, a foreign `Host` 403, a POST with a foreign
`Origin` 403. `orchestrator.mjs` itself refuses a bad `--port` and a run from
a worktree. No spawn, gate, ship or SDK session was started.

Divergences from the plan:
- `nextStep` also takes `files: { spec, plan }` (it must know whether
  spec.md/plan.md exist), and returns `owner: 'none'` for finished intents.
- `gateAllowed` returns `{ ok, reason }`, not a boolean.
- A POST without any `Origin` is refused (403), stricter than
  `server/saveApi.ts`; spec B2 says a request that changes something carries
  one. `foreignHost` also checks the server's own port when given.
- The server was split into `server.mjs`, `actions.mjs` and
  `session-routes.mjs` (and `state.mjs`) to stay under the function-length
  guardrail; session routes live in the same commit as the server (subtask 3)
  and are tested there with a fake manager.
- Locks are per intent (plus `main` for ship and a gate on `main`), and "ship
  refuses without a prior dry-run" is a per-process memory of a successful
  dry-run for that id, consumed by the real ship.
- The implementer role's prompt adds the worktree's
  `CLAUDE.local.md` brief when it exists.
- Not done, as the spec says: no interactive terminal (B7). The live check
  (AC4) is the owner's.

### 2026-10-24 — review round 1 rework (F1-F6, F9, F11, F12)

Commits: `823dbce` and `b0d7a58` (F1, F3), `e722f6e` (F2), `85f754d` (F5),
`d34cb06` (F4, F6, F12 docs), plus the commit with this entry (F11 test, F9,
Progress). `npm run verify` green after each: 61 test files, 1094 tests
(1087 at the reviewed commit); lint 21 warnings, cap unchanged at 21.

- **F1 (race), fixed.** `running(id)` is re-checked inside the `exclusive`
  callbacks of session launch, the gate write and both ship paths; the early
  checks stay. `tools/orchestrator/concurrency.test.mjs`: two concurrent
  launches (the second's state load delayed so it reaches the lock after the
  first launch finished) give one 200, one 409 and one `query()`; a manager
  that starts reporting a running session after the early check makes a gate,
  a dry-run and a real ship return 409 and run nothing.
- **F2, fixed.** `loadState` overlays `needs you` from the session manager
  (`deps.sessions.list()`) on the intent's `session` and `worktree.session`;
  it wins over the hook log, so `nextStep` and "waiting on you" see it. Server
  test with a fake manager (an intent with no worktree, and one with a
  worktree whose hook state is `working`).
- **F3, fixed.** Tests in `concurrency.test.mjs`: while a real ship of 52 is
  held open, a ship and a dry-run of 53 get 409 and a gate on §29 (main)
  gets 409.
- **F4, owner's decision: terminal parity kept** (no `permissionMode`). README
  Orchestrator section corrected: tools your settings allow, or auto mode
  approves, run without a prompt; only what would prompt reaches the page.
  Nothing in CLAUDE.md or `intents/README.md` claimed "nothing runs without a
  click". The plan's Risks wording is above the marker and left as is.
- **F5, owner's decision: resolved.** `roleLaunch('implementer')` returns
  `agent: 'heraklios-implementer'`, which the session manager passes as the
  SDK's `options.agent` (sdk.d.ts 0.3.309, "equivalent to the `--agent` CLI
  flag": system prompt, tools and model of the agent definition apply to the
  main thread); the brief stays the prompt. Reviewer and auto launch without
  the option. Tests: lib, server route and sdk-sessions (the option reaches
  `query()`, absent for the others).
- **F6, owner's decision: yes.** The Auto button's confirm says this click is
  your `/auto <id>` and authorises `plan_approved` (and `auto_authorized`)
  for that one intent. `intents/README.md` and CLAUDE.md say the Auto click
  counts as the owner's `/auto <id>` message and how a stopped `/auto` is
  resumed from the page (record the gate with its button or answer, then click
  Auto again, a new `/auto <id>`). No other agent permission widened.
- **F8:** no code change; the owner chose the disposable-clone live check.
- **F9, fixed.** The base was 57 files / 994 tests (main's count per the §51
  review), not 995; corrected in the entry above.
- **F11:** a `/api/sessions/sx/stop` -> 400 test kills M9. M23 is equivalent
  and left. **F12:** `tools/orchestrator/` is listed in CLAUDE.md
  "Architecture"; README says a transcript keeps its last 2000 items. F7 and
  F10 left, as decided.

Mutants, one at a time, full `vitest run`, backed up and restored by copy,
`git status --short` clean after each (M51, M52 and the F2 run were the
reviewer's expected kills): M51 (real-ship lock `[id]`) killed; M52 (gate-on-main
lock `[id] : [id]`) killed; in-lock launch check removed killed (after the
test was made deterministic: its first form survived, because the lock alone
serialised the two requests); in-lock gate check removed killed (the first
form survived, as the fixture lacked spec.md and a different 409 hid it);
in-lock dry-run check removed killed; in-lock real-ship check removed killed;
F2 overlay removed killed; M9 (`/^s/`) killed.

### 2026-10-24 - review round 2 rework

Commits: d1b649a (F13), 566fe4c (F14), 2c5186f (F15 and nits). `npm run
verify` green on each: 61 test files, 1108 tests at the last (1104 after F13,
1107 after F14, 1108 after the remove test; round 1 left 1094), lint 21 of 21
(cap unchanged).

- **F13, owner's decision (a).** `autoLaunch(auto_stopped, id)` in
  `orchestrator-lib.mjs` decides from the skill's exact stop strings (prefix
  match): allowed with a tailored confirm for no stop / a closed session,
  `spec drafted` and `live check owed` (record the gate with its button
  first), `escalate` (the confirm says the click also means "I have read the
  diff"), `ready for /ship` (re-runs the dry-run), and any other recorded
  cause (a cleared red verify and the like; the confirm names it). Refused
  with the coordinator-terminal instruction: `spec questions`, `decision
  needed`, `spec or plan amendment needed`, `critical finding`, `plan exists
  unapproved`, plus `plan found the spec incomplete` (the skill's resume
  needs the owner's settlement) and `out of rounds` (continues by hand): the
  last two are my reading of the skill table, beyond the owner's list.
  `/api/state` now carries `autoStopped` and `autoLaunch` per intent; the page
  disables Auto with the reason as its title and uses `confirmText`; the
  launch route refuses role `auto` with 409 when not allowed, so a POST cannot
  bypass it. README, CLAUDE.md and intents/README.md say which stops an Auto
  click resumes and which are answered in a terminal.
- **F14, fixed.** The abort listener sets the session back to `running` when
  nothing else is pending. Tests: sdk-sessions (running after the abort, still
  `needs you` with another request pending) and a handler test that the intent
  is `needs you` while parked and not after the abort.
- **F15, fixed.** The Auto sentence in CLAUDE.md and intents/README.md adds
  that an agent never presses the Auto button or POSTs to `/api/sessions`.
- **Nits.** CLAUDE.md Architecture names `public/app.js` as untested;
  `/api/remove/<id>` refuses (409) while a session runs on the intent, with a
  test. No change to plan.md or spec.md above this section.

Mutants, one at a time, full `vitest run`, backed up and restored by copy,
`git status --short` clean after each, all killed: F14 line removed (2 tests:
sdk-sessions and the handler overlay test); F14 `!s.pending.size &&` removed
(the pending-stays test); route refusal for role auto removed (server test);
`critical finding` dropped from the refused list (autoLaunch test); escalate
confirm without "I have read the diff" (autoLaunch test); remove guard
`flag && running(id)` replaced by `false` (server test, run twice). The page's
disabled button is untested (not a pure function), left to the live check.
