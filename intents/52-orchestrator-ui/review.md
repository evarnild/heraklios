<!-- generated-by: heraklios/review@0.1.5 -->
# §52 review — Orchestrator UI to manage intents and their Claude sessions

verdict: rework
tier: reviewed
reviewed-commit: 7702eca
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed, set by two inputs that agree. `metadata.yml` says
`review_tier: reviewed` (the accepted spec proposed it). The path table lands
there too: `eslint.config.js` turns `no-console` off for
`tools/orchestrator/orchestrator.mjs`, and an `eslint.config.js` change that
loosens a rule is Reviewed. The other paths are lower (`scripts/**` Attested,
`intents/**` Automated).

**Verdict:** `rework`. Three findings need mechanical rework (F1, F2, F3) and
five need the owner's decision (F4, F5, F6, F8; F9 is mechanical). Because a
"Needs decision:" finding is open, this auto run stops for the owner instead
of resuming the implementer.

Passes run by the `heraklios-reviewer` agent; the coordinator re-ran verify,
check:intent and the four surviving mutants (below). Several of the
reviewer's line numbers pointed past the end of their files; the coordinator
corrected them in this report from the files at `7702eca`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (5): F1, F2, F5, F6, F8 |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: digital-only SDLC tooling, no rule (spec "Sources that apply") |
| 4 | Tests prove the rule, not only pass | findings (2): F3, and the LOW survivors in F11 |
| 5 | Boundary and conventions | pass: no `src/` file in the diff; no GameState, save or undo change |
| 6 | Numbers in prose | findings (1): F9 |
| 7 | Documentation | findings (2): F4 (README wording), F12 |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21, cap unchanged. The SDK is pinned exactly (0.3.309) with a why-line in plan subtask 4 and Progress. No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` or `document.write` in `public/`; the page is served with a CSP and `nosniff`. |
| 9 | Repository-specific footguns | pass: no drift, AI or map change |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 52, feature)
  note:  23 file(s), 3886 line(s) changed outside intents/.
```

## Security and gate-safety reading (passes 1 and 8)

All of these hold, by reading the code and, where marked, by probing.

- **The guard runs first on every route.** `guard()` (`server.mjs:45-50`)
  is called before routing, static files and SSE (`server.mjs:85`). Host must
  be `localhost`, `127.0.0.1` or `[::1]` with the server's own port (stricter
  than the save API); a POST must carry an Origin (`:48`); a foreign Origin is
  refused on any method (`:49`); other methods than GET, HEAD and POST get 405
  (`:50`).
- **Listens on 127.0.0.1 only** (`node-io.mjs:92`); the probe confirmed
  `{"address":"127.0.0.1"}`.
- **No shell.** `execFile(file, args[])` with no shell option
  (`node-io.mjs:15`); scripts run as `process.execPath` plus
  `scripts/<x>.mjs` (`state.mjs:15`); git gets an argument array. The
  live-check words reach `ship.mjs` as one argv element (the test passes
  `"...; rm -rf / && echo $HOME --trailer x"` as one element).
- **Input validation.** Ids `^[0-9]+$` (`orchestrator-lib.mjs:14`), checked
  before anything runs; roles from `ROLES` (`orchestrator-lib.mjs:11`);
  session ids `^s[0-9]+$` (`session-routes.mjs:9`); answers whitelisted by
  `validAnswer` (`session-routes.mjs:13-21`), and a page-supplied
  `updatedInput` is ignored for an ordinary tool.
- **Static files** come from a fixed map of three names (`server.mjs:19`),
  so there is no path to traverse. `/../../package.json`,
  `/%2e%2e/%2e%2e/package.json`, `/..%2f..%2fpackage.json` and
  `/app.js/../../server.mjs` all gave 404 over HTTP.
- **Bodies:** a 64 KB cap in `node-io` and the handler (`server.mjs:55`; a
  70 KB POST got 413); malformed or non-object JSON gets 400 and runs nothing.
- **Gate writes.** The page offers only `intent.next.gate`, after `confirm()`.
  The server re-reads the file and re-checks `gateAllowed` inside the
  per-intent lock (`actions.mjs:73-84`), writes one line as a bare date, runs
  `git add -- <rel>` then `git commit -m … -- <rel>` (`:87-88`), restores the
  file and unstages it if git fails (`:90-91`), and refuses a branch without
  a worktree (`:66`).
- **Ship.** The real ship needs a successful dry-run of the same id in this
  server process (`actions.mjs:53`), consumed by the real ship (`:55`); it
  runs `scripts/ship.mjs` only.
- **Sessions.** `canUseTool` parks a request with no timeout (the SDK:
  "permission prompts have no park deadline", `sdk.d.ts:226`); stop, stream
  end and SDK abort all resolve to deny. Nothing in the orchestrator records a
  gate or ships by itself.
- **Docs.** The `CLAUDE.md` and `intents/README.md` wording ("an agent never
  presses it") is accurate and widens no agent permission, with the caveats in
  F7 and F10.

## Pass 4: mutations (55 mutants, one at a time, full `vitest run` each)

Back up by copy, apply by exact substring, confirm with `git diff --quiet`
returning 1, full suite in the foreground, restore by copy, `git status
--short` clean after each. Two harness slips were caught and re-run: M12's
first form was a syntax error (a false kill), re-run as `if (true)`; M30's
first needle did not match.

**51 killed, 4 survived.**

| # | Mutant (target) | Result / failing test |
| --- | --- | --- |
| M1 | foreignHost accepts any host (`orchestrator-lib.mjs:36`) | killed: lib foreignHost + server "403 … foreign Host on every route" |
| M2 | foreignHost drops the port check (`:37`) | killed: same two |
| M3 | foreignOrigin accepts any origin (`:47`) | killed: lib foreignOrigin + server "403 for a foreign Origin" |
| M4 | foreignOrigin accepts garbage/"null" (`:49`) | killed: lib foreignOrigin |
| M5 | POST without Origin allowed (`server.mjs:48`) | killed: "403 for a POST without any Origin" |
| M6 | Origin skipped on POST (`server.mjs:49`) | killed: "403 for a foreign Origin…" |
| M7 | guard on POST only (`server.mjs:85`) | killed: 3 Host/Origin tests |
| M8 | id regex loosened to `/^[0-9]+/` (`orchestrator-lib.mjs:14`) | killed: validId, roleLaunch, server "400 for a non-digit id" |
| **M9** | SID regex loosened to `/^s/` (`session-routes.mjs:9`) | **survived** (F11) |
| M10 | real ship without the dry-run check (`actions.mjs:53`) | killed: 3 ship tests |
| M11 | dry-run token not consumed (`actions.mjs:55`) | killed: "…and only once" |
| M12 | failed dry-run unlocks the ship (`actions.mjs:44-45`) | killed: "a dry-run that fails does not unlock" |
| M13 | gateWrite writes `by-agent` (`orchestrator-lib.mjs:88`) | killed: 3 gateWrite tests + server gate tests |
| M14 | writeGate ignores gateAllowed (`actions.mjs:84`) | killed: 3 server gate tests |
| M15 | an already-recorded gate overwritten (`orchestrator-lib.mjs:64`) | killed |
| M16 | live_checked without `owed` (`:68`) | killed (lib + server) |
| M17 | intent_accepted on a non-draft (`:72`) | killed |
| M18 | intent_accepted-first check dropped (`:74`) | killed |
| M19 | spec_accepted without spec.md (`:75`) | killed |
| M20 | plan_approved without spec_accepted (`:76`) | killed (lib + server) |
| M21 | plan_approved without plan.md (`:77`) | killed |
| M22 | a gate on a terminal intent (`:63`) | killed |
| **M23** | gateAllowed's non-gate check dropped (`orchestrator-lib.mjs:61`) | **survived**: equivalent, later checks still refuse and gateRoute pre-checks `GATE_FIELDS` (`actions.mjs:61`) (F11) |
| M24 | denyAll resolves allow (`sdk-sessions.mjs:80`) | killed: stream-end and stop tests |
| M25 | park auto-allows after a timeout (`:90`) | killed: "parks a request until answered…" |
| M26 | SDK abort resolves allow (`:97`) | killed |
| M27 | a deny answer becomes allow (`:53`) | killed |
| M28 | stop does not deny pending (`:189`) | killed |
| M29 | stop does not abort (`:191`) | killed |
| M30 | stop does not interrupt (`:190`) | killed |
| M31 | runningFor ignores `needs you` (`:17`) | killed |
| M32 | an ordinary tool takes the page's updatedInput (`:56`) | killed |
| M33 | sessionsData drops `dirty` (`scripts/session-lib.mjs`) | killed: sessionsData exact rows |
| M34 | sessionsData age in minutes | killed |
| M35 | sessionsData unsorted | killed |
| M36 | a gate allowed while a session runs (`actions.mjs:62`) | killed |
| M37 | a ship allowed while a session runs (`actions.mjs:39`) | killed |
| M38 | commit without the `-- <rel>` pathspec (`actions.mjs:88`) | killed |
| M39 | file not restored on a failed commit (`actions.mjs:90`) | killed |
| M40 | branch-without-worktree refusal dropped (`actions.mjs:66`) | killed |
| M41 | live-words length unchecked (`actions.mjs:52`) | killed |
| M42 | `bodyTooLarge` ignored (`server.mjs:55`) | killed |
| M43 | `'node'` instead of `process.execPath` (`state.mjs:15`) | killed: 5 tests |
| M44 | a branch intent written on main (`state.mjs:31`) | killed |
| M45 | role check dropped in the route (`session-routes.mjs:34`) | killed |
| M46 | reviewer runs in the worktree (`orchestrator-lib.mjs:158`) | killed |
| M47 | roleLaunch accepts an unknown role (`:156`) | killed |
| M48 | validAnswer allows extra keys (`session-routes.mjs:15`) | killed |
| M49 | nextStep ignores `needs you` (`orchestrator-lib.mjs:127`) | killed |
| M50 | waitingOnOwner drops the owner rank (`:142`) | killed |
| **M51** | real-ship lock `[id,'main']` → `[id]` (`actions.mjs:54`) | **survived** (F3) |
| **M52** | gate-on-main lock `[id,'main']` → `[id]` (`actions.mjs:69`) | **survived** (F3) |
| M53 | escalate shown as ship (`orchestrator-lib.mjs:100`) | killed |
| M54 | an owed live check ignored in nextStep (`:101`) | killed |
| M55 | method guard dropped (`server.mjs:50`) | killed |

Not mutated: `node-io.mjs` and `orchestrator.mjs`, which the plan leaves
untested by design; read, and the probe confirmed the 127.0.0.1 listen.

**On the tests:** for the security and gate rules they prove the rule, not
only pass: every Host/Origin, id, dry-run, gateAllowed, gateWrite,
deny-by-default and stop mutant is killed by a test asserting exact command
arrays or that nothing ran. They do not prove the `main` locks (M51, M52),
the concurrency claim in plan Risks (F1), or B6's "intent shows needs you"
(F2).

## Findings

- **F1. MEDIUM** `tools/orchestrator/session-routes.mjs:36` and `:52`
  (also `actions.mjs:39`, `:62`, `:70`): the one-session-per-intent rule can
  be beaten by a race. `running(id)` is checked before an `await
  loadState(...)` and not again inside `exclusive([id], …)`. Reproduced with
  a script outside the repo (real handler, real `createSessionManager`, fake
  `query`): two concurrent `POST /api/sessions {role:'implementer',
  id:'52'}` both returned 200, `query()` ran twice, 2 live sessions on §52.
  The same window exists between gateRoute's and shipRoute's `running()`
  check and their lock, so a gate commit or a ship can run beside a session
  launched in between. This contradicts plan Risks ("refuses a gate write or
  ship while it has a session running on that intent"); the route test
  "refuses … a second session" covers only the sequential case.
  Needs rework: re-check `running(id)` inside the `exclusive` callbacks of
  launch, writeGate and both ship paths, and add a test that fires two
  launches concurrently and expects one 200 and one 409.
- **F2. MEDIUM** `tools/orchestrator/state.mjs:75`: spec B6 says "While one
  waits, the intent shows 'needs you'", but the intent row reads only the
  hook log. `loadState` takes `session` from `sessions --json` and never asks
  the in-memory session manager. Reproduced: with the manager's session in
  `needs you`, `/api/state` gave §52 `session: "working"`. Reviewer and auto
  sessions run in the main checkout, so their hook events never land on the
  intent's row; the only "needs you" is the status in the Sessions panel, and
  "Waiting on you" and `nextStep` miss it.
  Needs rework: in `loadState`, overlay the manager's per-intent state
  (`needs you` wins) when `deps.sessions` is present, with a server test using
  a fake manager that reports a pending request.
- **F3. MEDIUM** `tools/orchestrator/actions.mjs:54`, `:69`: the `main` lock
  is untested. Progress lists it ("Locks are per intent (plus `main` for ship
  and a gate on `main`)") but M51 and M52 survive: with them, two ships of
  different ids, or a ship and a gate commit on `main`, can run at once in the
  main checkout.
  Needs rework: tests that, while a real ship of 52 is in flight, a ship or
  dry-run of 53 gets 409, and a gate on a main-located intent (§29 in the
  fixture) gets 409. Expected kills: M51, M52.
- **F4. MEDIUM** `tools/orchestrator/sdk-sessions.mjs:166`, `README.md`
  (Orchestrator section, "nothing is allowed by itself"): on this machine
  most tool calls will not wait for a click. `settingSources` is unset, so
  user settings load, and `~/.claude/settings.json` has
  `permissions.defaultMode: "auto"` plus an allow list. The SDK documents
  auto mode as "A model classifier approves or denies each call, prompting
  through `canUseTool` when it cannot decide" (`sdk.d.ts`, `permissionMode`).
  The README sentence and the plan's B6 Risk overstate it, and AC4's "answer
  one permission prompt" may never see a prompt.
  Needs decision: pass `permissionMode: 'default'` for orchestrator sessions
  (diverges from B5's "as in a terminal" and the plan Assumption), or keep
  terminal parity and correct the README and plan wording ("tools your
  settings already allow, or auto mode approves, run without a prompt; only
  what would prompt reaches the page").
- **F5. MEDIUM** `tools/orchestrator/orchestrator-lib.mjs:155-171`: the
  implementer role does not run as the `heraklios-implementer` agent. B5 asks
  for "the `heraklios-implementer` brief `/spawn` step 5 gives today";
  `/spawn` launches that agent, with its system prompt (rules 1-8), tools and
  `model: sonnet`. The orchestrator starts a plain top-level session with a
  hand-written prompt that omits: don't edit `OVERVIEW.md` or
  `plan-history.md`; append only to `## Progress`; stop if the plan is wrong;
  don't raise the lint cap. It also runs on the user's default model. SDK
  0.3.309 has `options.agent` ("equivalent to the `--agent` CLI flag",
  `sdk.d.ts:1579-1596`); the plan's Assumption covered only the prompt.
  Needs decision: launch with `agent: 'heraklios-implementer'`, or keep the
  custom prompt, record the divergence and add the missing rules.
- **F6. MEDIUM** `tools/orchestrator/public/app.js:105`, `intents/README.md`
  "/auto <id>" bullet, `CLAUDE.md` orchestrator paragraph: the Auto button's
  authority is not stated. By `intents/README.md`, "Your `/auto <id>` message
  in the coordinator conversation" authorises `plan_approved` and
  `auto_authorized`; the Auto click's confirm says only "Launch a auto session
  … may use your quota", and no doc says the click is that message. A headless
  `/auto` is a single-prompt session, so at its stops (spec acceptance,
  questions) the owner cannot answer "yes" in that conversation: they must use
  a gate button and relaunch, which is a second `/auto`.
  Needs decision: should the confirm and the docs say "this click is your
  `/auto <id>`: it authorises `plan_approved` for §id", and should the docs
  say how an `/auto` stop is resumed from the page?
- **F7. LOW** `tools/orchestrator/server.mjs:45-50`: Host and Origin don't
  authenticate local processes. Any local process (including a launched
  session with Bash, possibly classifier-approved under auto mode, F4) can
  send `Origin: http://127.0.0.1:5299` and record a bare-date gate, or
  dry-run then ship. That adds no new power (an agent could already write a
  bare date or run `scripts/ship.mjs`), and "an agent never presses it"
  stays a convention. Worth a look: a per-run token in the printed URL's
  fragment, required on POSTs. Spec "Out of scope" excludes authentication
  beyond B2, so not rework.
- **F8. MEDIUM** `tools/orchestrator/orchestrator.mjs:42-44`, plan Validation
  and AC4 ("from the main checkout"): the live check can't be run as planned
  before the merge. The CLI refuses to run outside the main checkout or off
  `main`, and before the merge the code exists only on the branch. Mounting
  the handler from a scratch script with `root` = the worktree is unsafe: a
  gate click on a main-located intent would commit onto
  `feat/52-orchestrator-ui` after the reviewed commit, and `ship.mjs` and
  spawn refuse from a worktree.
  Needs decision: how AC4 is run. The Live check section proposes a
  disposable clone whose `main` is this branch: no code change, but the
  owner's call.
- **F9. LOW** `intents/52-orchestrator-ui/plan.md:286-287`: "(was 57 / 995
  before the change)" doesn't add up. HEAD has 60 files and 1087 tests,
  `main` 57 files; the new tests are 39 + 35 + 18 (three new files) + 1
  (`sessionsData`) = 93, so the base would be 994 (which §51's review also
  measured on its branch). Needs rework: re-measure on `main` and correct.
- **F10. LOW** `tools/orchestrator/actions.mjs:42-56`: the dry-run token
  never expires, so a dry-run from hours ago unlocks a ship. `ship.mjs`
  re-checks every precondition, which limits the harm. Worth a look (consume
  it on any state change, or expire it after minutes).
- **F11. LOW** surviving mutants M9 (`session-routes.mjs:9`) and M23
  (`orchestrator-lib.mjs:61`). M9 is harmless (the sid is only a Map key);
  M23 is equivalent in outcome. Worth a look: a `/api/sessions/sx/stop` → 400
  test kills M9.
- **F12. LOW** docs: `CLAUDE.md` "Architecture" lists `tools/map-extract/`
  but not `tools/orchestrator/` (only the Parallel-sessions paragraph names
  it); `sdk-sessions.mjs:16` caps a transcript at 2000 items, while B5 says
  it "is kept until the server stops". Worth a look.

Nits (not findings): the JSON responses of `session-routes.mjs` lack the
`nosniff` and CSP headers the other routes carry; a multiSelect answer in
`questionForm` appends duplicates on repeated clicks; an EventSource
reconnect replays the transcript into the panel twice.

## Not checked
- **Hooks in headless sessions (B11):** whether `.claude/settings.json`
  hooks fire in an SDK session and file events under its cwd. Only a live run
  shows it; it underlies F2's "hooks only" path.
- **Real SDK behaviour:** that `canUseTool` is called under this machine's
  `defaultMode: auto`; the real AskUserQuestion `updatedInput.answers` shape;
  that `interrupt()` plus abort ends the CLI child process. Every test uses a
  fake `query`.
- **The page in a browser:** that `textContent` shows `<b>` in session
  output literally; that the CSP blocks nothing the page needs; confirm
  dialogs, polling, SSE panels and reconnects. No browser was driven.
- **Real routes never run:** spawn, remove, gate commit, dry-run and real
  ship, session launch, against real git or scripts. Only the read-only
  `GET /` and `/api/state` ran for real, with a runner that blocked
  everything else.
- **The implementer's own checks:** a fresh `npm ci` with the SDK's platform
  optional dependencies (Progress says `npm ci --dry-run` passed) and its
  port-5298 probe. Taken on trust.
- **CLI startup:** `orchestrator.mjs` refusing a bad `--port` or a worktree:
  read, not executed.
- **The base test count on `main`** (F9): not run there.

## Live check
- **Owed** by rule 3: the Not-checked items above (hooks in headless
  sessions, the real SDK permission flow, browser rendering, real spawn, gate
  and dry-run) are runtime-only. Not owed by path rule 1 (no `src/`,
  `index.html` or `vite.config.ts` change), so e2e can't stand in.
- **Settle F8 first.** These steps assume the disposable-clone answer, which
  touches neither the main checkout nor the branch. They will be restated
  after the rework round.
- **Steps:**
  1. In Git Bash: `git clone C:/Users/eric/src/heraklios C:/tmp/h52`, `cd
     C:/tmp/h52`, `git checkout -B main origin/feat/52-orchestrator-ui`,
     `npm ci`, then `npm run orchestrator` (add `-- --port 5288` if 5299 is
     busy) and open `http://127.0.0.1:5299/`. The intent and worktree tables
     match `npm run queue` and `npm run sessions` run in `C:/tmp/h52`, and
     "Waiting on you" comes first.
  2. In the clone, commit a throwaway accepted intent on its `main`
     (`intents/99-throwaway/`, `status: accepted`, gates recorded), or use an
     accepted intent without a worktree. Click Spawn and confirm: the spawn
     output shows in "Last action" and the worktree under
     `C:/tmp/heraklios-wt/` in the Worktrees table.
  3. Click Implementer on it: messages stream in a session panel. Your user
     settings use `defaultMode: auto` (F4), so a prompt may not come; to force
     one, set `"defaultMode": "default"` in `~/.claude/settings.json` for the
     run and put it back after. When a request appears, click Deny: the
     transcript shows it denied. Watch whether the intent row shows `needs
     you` (F2). Click Stop: the state goes to `stopped`. Any `<b>` in the
     output shows as literal text.
  4. On a throwaway draft intent, click "Record intent_accepted" and
     confirm: `intent_accepted: <today>` (bare date) in its `metadata.yml`,
     and `git log -1` in the clone shows `§99: intent_accepted recorded
     (orchestrator)` under your name, touching only that file.
  5. Click "Ship…" on an in-review intent in the clone: only the dry-run
     report. Click Close, not "Ship for real": the clone's `origin` is your
     real repo, so never ship from it.
  6. `curl -s -o /dev/null -w "%{http_code}\n" -H "Host: evil.example"
     http://127.0.0.1:5299/api/state` gives `403`, and so does `-X POST -H
     "Origin: http://evil.example" .../api/ship/1`.
  7. Ctrl+C the server; `npm run spawn -- 99 --remove` in the clone (or by
     hand), then delete `C:/tmp/h52` and `C:/tmp/heraklios-wt` (real
     `node_modules`, no junctions).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `7702eca`, clean before and after):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`,
  60 test files, 1087 tests passed (matches).
- `npm run check:intent`: PASS, 23 files, 3886 lines (matches).
- `npm run e2e`: not run, no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/`
  change.
- The four survivors, one at a time with the full suite, backed up and
  restored by copy, each checked as applied with `git diff --quiet`:
  M9 (`session-routes.mjs:9`, `/^s/`), M23 (`orchestrator-lib.mjs:61`
  removed), M51 (`actions.mjs:54`, `[id]`), M52 (`actions.mjs:69`,
  `[id] : [id]`): **1087 passed each, survived** (matches). `git status
  --short` empty after each.
- Line citations: several of the reviewer's (session-routes 105 and 132-148,
  server 238-279, node-io 287 and 364, state 197, 213 and 257, orchestrator
  407-410, sdk-sessions 68) pointed past their files' ends; corrected above
  from the files at `7702eca`. The claims at those lines were confirmed by
  reading.

**Reviewer agent** (same worktree and HEAD):
- `git rev-parse HEAD`, branch and `git worktree list`; tree clean at the
  start and after every step.
- `npm run verify`, `check:intent` as above; `dist/` holds no
  "orchestrator" or "claude-agent-sdk" string.
- Test counts: the tools tests plus `session-lib`, 4 files, 126 tests;
  `main` 57 test files, HEAD 60.
- Pass 4: 55 mutants as tabled.
- Race probe (scratch script outside the repo, real handler and session
  manager, fake `query`): two concurrent launches gave 200/200 and two
  sessions (F1).
- Needs-you probe, same setup: manager `needs you`, intent `working` (F2).
- Read-only HTTP probe on 127.0.0.1:5287 (runner allowing only `queue` and
  `sessions --json`, fs refusing writes, no session manager, self-exit after
  60 s, port free afterwards): `GET /` and `/api/state` 200 (27 intents, 3
  worktrees); foreign Host, wrong and missing port 403; foreign Origin on GET
  403; traversal variants 404; POST with no, foreign or `null` Origin 403;
  malformed or array JSON 400; 70 KB body 413; real ship without a dry-run
  409; bad id 400; `/api/sessions` with no manager 404; DELETE 405; CSP,
  `nosniff` and `no-store` present.
- SDK citations in the plan (`sdk.d.ts` lines 216, 228, 1562, 1625, 1634,
  2031, 2315, 2570, 2928, 3321) hold in the installed 0.3.309; read the
  `agent`, `permissionMode` and `permissionPrompts` docs. The lockfile pins
  0.3.309.
- `~/.claude/settings.json` permission keys read (not changed):
  `defaultMode: auto` plus an allow list.
- `npm run sdlc:scan -- --sample-due auto --exclude 52`: nth attested auto
  change = 2, every 3, `sampled: no`.
- Nothing touched `main` or was pushed: no remote §52 branch, `main` at
  `418ca72` and an ancestor of the branch.

**Taken on trust:** the implementer's port-5298 probe; `npm ci --dry-run`
clean; the SDK's publish date; the CLI's runtime refusals (read, not run);
the "57 / 995" base count (contradicted, F9).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut/`
(reviewer) and `…/scratchpad/coord52/` (coordinator).

Mutants a rework is expected to kill: M51, M52, the removal of the new
in-lock `running()` re-check (F1), and M9 if F11 is taken up.
