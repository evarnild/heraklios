<!-- generated-by: heraklios/review@0.1.5 -->
# §52 review — Orchestrator UI to manage intents and their Claude sessions

verdict: rework
tier: reviewed
reviewed-commit: 076cd29
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed, from `metadata.yml`'s `review_tier: reviewed`; the path
table agrees through round 1's `eslint.config.js` `no-console` exemption,
still in the branch's diff against `main`. The rework itself touches only
`tools/**`, `intents/**`, `README.md`, `CLAUDE.md` and `intents/README.md`.

**Verdict:** `rework`. Every round-1 rework item is resolved and all 21
mutants on the rework's lines are killed, but two new findings are open: F13
needs the owner's decision (what an Auto click can resume, and what it means
after an escalate stop), F14 is mechanical (a stale `needs you` after the SDK
aborts a parked request). With a "Needs decision:" finding open, the auto
run stops for the owner.

Round 2 covers `823dbce`, `b0d7a58`, `e722f6e`, `85f754d`, `d34cb06` and
`743f947`; `076cd29` only sets `auto_round: 2`. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent and
nine of the ten listed mutants (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): F13. F1, F2, F3, F5, F6 and F8 checked against the owner's decisions (Resolutions) |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: digital-only SDLC tooling, no game rule |
| 4 | Tests prove the rule, not only pass | findings (1): F14. 21 of 21 mutants on the rework's lines killed |
| 5 | Boundary and conventions | pass: no `src/` file; no GameState, save or undo change |
| 6 | Numbers in prose | pass. 61 files and 1094 tests reproduce; the 994 base reproduces by arithmetic (1087 − (39+35+18+1)); 57 test files on `main` from `git ls-tree` |
| 7 | Documentation | findings (1): F13 (README, CLAUDE.md, intents/README). The F4 and F12 wording is now accurate |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21; `package.json` and `eslint.config.js` untouched by the rework; no new dependency; no HTML sink |
| 9 | Repository-specific footguns | pass: no drift, AI or map change |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 52, feature)
  error: A live check is owed and not recorded. Do the steps in intents/52-orchestrator-ui/review.md → ## Live check, then set live_checked: <date> in intents/52-orchestrator-ui/metadata.yml.
  note:  24 file(s), 4087 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Security re-check (the rework against round 1's reading)
No regression.
- **No new route;** `guard()` still runs first on every request
  (`server.mjs:85`).
- **The new `agent` value is a constant,** `IMPLEMENTER_AGENT`
  (`orchestrator-lib.mjs:13`), set only for the implementer (`:174`); no
  request field reaches it.
- **Gate writes unchanged:** `writeGate` (`actions.mjs:76-96`) writes a bare
  date and commits with a `-- <rel>` pathspec, restoring and unstaging on a
  git failure; it is now reached only through the in-lock `running()`
  re-check (`actions.mjs:73`).
- **The dry-run still comes first:** a real ship needs the token
  (`actions.mjs:55`) and re-checks `running()` inside the `[id,'main']` lock
  (`:57`) before consuming it.
- **Deny-by-default parking unchanged** (`sdk-sessions.mjs:78-101`).

## Pass 4: mutations (21 mutants, one at a time, full `vitest run` each)
Back up by copy outside the repo, apply by exact substring (CRLF-aware: a
first attempt at K1, K3, K4, K5 matched no needle, applied nothing and was
re-run), `git diff --quiet -- <file>` returning 1, full suite in the
foreground, restore by copy, `git status --short` empty after each.

| # | Mutant (target at HEAD) | Result / failing test |
| --- | --- | --- |
| K1 | in-lock `running()` re-check removed from launch (`session-routes.mjs:54`) | killed: concurrency "two concurrent launches … one 200, one 409 and one query()" |
| K2 | in-lock re-check removed from the gate (`actions.mjs:73`) | killed: "a gate is refused when a session appears after the early check" |
| K3 | in-lock re-check removed from the dry-run (`actions.mjs:44`) | killed: "a dry-run and a real ship are refused …" |
| K4 | in-lock re-check removed from the real ship (`actions.mjs:57`) | killed: same test |
| K5 | early gate `running()` removed (`actions.mjs:65`) | killed: concurrency gate test + server "refuses while a session runs on the intent" |
| M51 | real-ship lock `[id,'main']` → `[id]` (`actions.mjs:56`) | killed: both main-lock tests |
| M51b | dry-run lock `[id,'main']` → `[id]` (`actions.mjs:43`) | killed: "refuses a ship and a dry-run of another intent while a real ship runs" |
| M52 | gate-on-main lock → `[id]` (`actions.mjs:72`) | killed: "refuses a gate on a main-located intent while a ship runs" |
| F2a | overlay removed (`state.mjs:82`) | killed: server "shows an intent as needs you when the session manager holds a pending request…" |
| F2b | precedence flipped, the hook log wins (`state.mjs:82`) | killed: same |
| F2c | overlay ignores the intent id (`state.mjs:31`) | killed: same |
| F2d | overlay ignores the state (`state.mjs:31`) | killed: same |
| F2e | `worktree.session` from the hook log only (`state.mjs:83`) | killed: same |
| F5a | implementer `agent` removed (`orchestrator-lib.mjs:174`) | killed: lib roleLaunch implementer + server "launches an implementer in the worktree" |
| F5b | reviewer also gets the agent (`orchestrator-lib.mjs:162`) | killed: lib reviewer/auto + server reviewer launch |
| F5c | agent name changed (`orchestrator-lib.mjs:13`) | killed: 2 tests |
| F5d | route drops `agent` (`session-routes.mjs:55`) | killed: server implementer launch |
| F5e | route always passes an `agent` key (`session-routes.mjs:55`) | killed: server reviewer launch |
| F5f | manager drops `agent` from `query()` options (`sdk-sessions.mjs:166`) | killed: sdk-sessions "passes the agent to query() as options.agent…" |
| F5g | manager always passes an `agent` key (`sdk-sessions.mjs:166`) | killed: sdk-sessions exact-keys test + agent test |
| M9 | SID `/^s[0-9]+$/` → `/^s/` (`session-routes.mjs:9`) | killed: server "stops a session and 404s an unknown one" (`sx` → 400) |

Not mutated: `public/app.js` (`autoConfirm`, `:98-100`, `:109`), untested by
design and read; M23 stays equivalent, as round 1 judged.

**On the tests:** for the rework's behaviours they prove the rule. The race
and lock tests are deterministic (the second launch's state load is delayed;
a "flipping" manager reports a session that appears between the early check
and the lock), each in-lock check and each `main` lock key has a test that
fails without it, and the overlay test checks the exact next step and its
order. Not covered: the overlay going stale after an SDK abort (F14), and
that the real SDK applies `options.agent` (Not checked).

## Findings
- **F13. MEDIUM** `README.md:704-708`, `CLAUDE.md:147-152`,
  `intents/README.md:110-114`, `tools/orchestrator/public/app.js:98-100`:
  the docs and the Auto confirm say an Auto click resumes any stopped
  `/auto` ("record the gate with its button, or answer the question, then
  click Auto again"). Two kinds of stop don't fit what the skill does on a
  resume (`.claude/skills/auto/SKILL.md:91-99`):
  - `decision needed`, `spec or plan amendment needed`, `critical finding`
    and `spec questions` resume with "the owner's answer(s)" passed to the
    implementer or the spec. An Auto click sends only `/auto <id>`
    (`orchestrator-lib.mjs:163`), and a stopped headless session has ended,
    so the page has no channel for the answer. "Answer the question" works
    only for an `AskUserQuestion` that parks mid-run, which is not a stop.
  - After an `escalate` stop, "the owner's `/auto <id>` means 'diff read'"
    (`:95`). The confirm doesn't say so, so the click asserts a diff read the
    owner wasn't told they were making. §52 is Reviewed, so its own next stop
    is an escalate.

  Needs decision: (a) the confirm and docs say which stops an Auto click can
  resume (spec drafted and live check, after the gate button; escalate, with
  the confirm saying the click also means "I read the diff"; ready for
  /ship) and that a decision, question, amendment or critical stop is
  answered in a coordinator terminal with `/auto <id>` and the answer; or (b)
  a text field on the Auto launch carries the owner's answer into the prompt
  (new scope). Either way the confirm text depends on the intent's
  `auto_stopped`.
- **F14. MEDIUM** `tools/orchestrator/sdk-sessions.mjs:93-99`, surfaced by
  `tools/orchestrator/state.mjs:82`: after the SDK aborts a parked request
  the session stays `needs you` with nothing pending, and F2's overlay puts
  that on the intent row. The abort listener deletes the request and
  resolves deny but never resets the state, which `answer()` does (`:179`).
  Reproduced with a scratch script (real `createSessionManager` and
  `createHandler`, fake `query`, blocking runner): parked, the intent is
  `needs you` / "Answer the waiting session" with 1 pending; after
  `ac.abort()`, still `needs you` with 0 pending; only Stop clears it. The
  intent sorts first in "Waiting on you" with nothing to answer, against B6.
  The cause predates the rework; F2 makes it visible.
  Needs rework: in the abort listener, after deleting the request, `if
  (!s.pending.size && s.state === 'needs you') setState(s, 'running');`, with
  an sdk-sessions test asserting `state === 'running'` after an abort (and
  optionally a server test that the intent is no longer `needs you`).
  Expected kill: removing that line.
- **F15. LOW** `intents/README.md:110-114`, `CLAUDE.md:147-149`: the docs give
  the Auto click authority but, unlike the gate buttons, don't add "an agent
  never presses it". With F7 (Host and Origin don't authenticate local
  processes), a launched session could POST `/api/sessions {role:'auto', id}`
  with the page's Origin and start an `/auto` that, by the new wording,
  counts as the owner's message. By F7's own argument that adds no power an
  agent lacked. Worth a look: "an agent never presses it or POSTs to
  `/api/sessions`" beside the Auto sentence.

Nits (not findings):
- The six rework commits lack the `Co-Authored-By` / `Claude-Session`
  trailers.
- `plan.md:124` and `:227`, above the Progress marker, still say
  `roleLaunch` returns `{ cwd, prompt }`; Progress records the `agent`
  addition. The plan's Risks wording on permissions (F4) is also left; both
  are amendments, the owner's.
- The CLAUDE.md Architecture entry (`:252-255`) names `node-io.mjs` and
  `orchestrator.mjs` as untested glue; `public/app.js` is untested too.
- `/api/remove/<id>` takes the `[id]` lock but doesn't check `running(id)`
  (predates the rework).

## Not checked
- **`options.agent` against the real SDK and CLI:** the typings say the
  agent "must be defined either in the `agents` option or in settings"
  (`sdk.d.ts:1578-1596`, `:9361-9364`). Nothing proves that
  `.claude/agents/heraklios-implementer.md` in the worktree is found with
  `settingSources` unset (all sources, `sdk.d.ts:2306-2315`), that its
  `model: sonnet` and tools apply, or that the prompt still arrives as the
  first user turn. Every test uses a fake `query`.
- **Unchanged from round 1:** hooks in headless sessions (B11), the real
  `canUseTool` flow under `defaultMode: auto`, the real AskUserQuestion
  answer shape, `interrupt()` plus abort ending the CLI child.
- **How often the real SDK aborts a `canUseTool` signal** (F14's frequency);
  only the code path is shown.
- **What a headless `/auto` does on a `decision needed` resume with no
  answer** (F13): the skill text was read, nothing run.
- **The page in a browser:** the Auto confirm, the `needs you` row and its
  order, dialogs, SSE panels, the CSP.
- **Real routes against real git and scripts** (spawn, remove, gate commit,
  dry-run, real ship, session launch). No HTTP probe this round; round 1's
  read-only probe covered routes the rework didn't change.
- **The 994 base on `main`:** by arithmetic, not by running vitest there.
- **No e2e:** no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.

## Live check
- **Owed** by rule 3: `options.agent` in a real session, hooks in headless
  sessions, the real permission flow, the page in a browser, and real spawn,
  gate and dry-run are runtime-only. Not owed by path rule 1, so e2e can't
  stand in.
- **Where (F8, the owner's decision):** a disposable clone whose `main` is
  this branch, touching neither the main checkout nor the branch. Run it on
  the commit that resolves F13 and F14.
- **Steps:**
  1. In Git Bash: `git clone C:/Users/eric/src/heraklios C:/tmp/h52 && cd
     C:/tmp/h52`, `git checkout -B main origin/feat/52-orchestrator-ui`,
     `git remote set-url --push origin DISABLED` (nothing in the clone can
     push to your repo), `npm ci`, `npm run orchestrator` (add `-- --port
     5288` if 5299 is busy), open `http://127.0.0.1:5299/`. The intent and
     worktree tables match `npm run queue` and `npm run sessions` run in
     `C:/tmp/h52`, with "Waiting on you" first.
  2. In the clone, commit `intents/99-throwaway/` on `main` (`type:
     adjustment`, `status: accepted`, `intent_accepted: <today>`, an
     `intent.md` asking for one line in `docs/throwaway.md`). Click Spawn and
     confirm: the output shows under "Last action" and
     `C:/tmp/heraklios-wt/99-throwaway` appears in Worktrees.
  3. **Implementer as the agent (F5).** To force a prompt, set
     `"defaultMode": "default"` in `~/.claude/settings.json` for the run (put
     it back after). Click Implementer on §99 and confirm: messages stream in
     a panel. In `~/.claude/projects/`, the newest `.jsonl` under the folder
     named after `C:/tmp/heraklios-wt/99-throwaway` has assistant entries
     with a `claude-sonnet…` `"model"` (the agent's, not your default). It
     commits on its branch, appends to `## Progress` only, and doesn't push.
  4. **`needs you` (F2, F14).** When a permission request appears: the §99
     row shows `needs you`, sits first in "Waiting on you", next step "Answer
     the waiting session". Click Deny: the transcript shows it denied and the
     row leaves `needs you`. Click Stop: `stopped`, no `needs you`. Any `<b>`
     in the output shows as literal text.
  5. **The Auto confirm (F6, F13 as decided).** Click Auto on §99 and read
     the confirm: it says the click is your `/auto 99` and authorises
     `plan_approved` (and `auto_authorized`) for §99 only, plus what F13's
     decision adds. Click Cancel: no session panel, `git log -1` unchanged.
  6. **Gate button.** On `intents/98-draft/` (`status: draft`), click
     "Record intent_accepted" and confirm: `intent_accepted: <today>` (bare
     date), and `git log -1 --stat` shows `§98: intent_accepted recorded
     (orchestrator)` under your name, that file only.
  7. **Ship dry-run only.** "Ship…" on an in-review intent in the clone shows
     only the dry-run report. Click Close, never "Ship for real".
  8. **Host and Origin.** `curl -s -o /dev/null -w "%{http_code}\n" -H "Host:
     evil.example" http://127.0.0.1:5299/api/state` gives `403`, and so does
     `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin:
     http://evil.example" http://127.0.0.1:5299/api/ship/1`.
  9. Ctrl+C the server, restore `defaultMode`, delete `C:/tmp/h52` and
     `C:/tmp/heraklios-wt` (real `node_modules`, no junctions).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `076cd29`):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`,
  61 files, 1094 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 24 files, 4087
  lines (matches, pasted above).
- Mutants one at a time with the full suite, backed up and restored by copy,
  each checked as applied: K1, K2, K3, K4, M51, M52, F2a, F5a, F5f all
  **killed, by the same tests the reviewer names** (matches). Tree clean
  after each.
- **M9 not re-run by the coordinator:** Claude Code stopped the background
  run for low system memory while M9's suite was running. The mutated
  `session-routes.mjs` was restored from its backup copy, and `git status
  --short` was empty afterwards. M9's kill rests on the reviewer and the
  implementer.
- F13 and F14 citations re-read at `076cd29` (`app.js:98-100`,
  `sdk-sessions.mjs:93-99`).

**Reviewer agent** (same worktree and HEAD; tree empty at the start, after
every mutant and at the end):
- `git diff 7702eca..076cd29` in full, and every changed file at HEAD plus
  the unchanged code the fixes depend on.
- `npm run verify` and `check:intent` as above; pass 4 as tabled.
- F14 probe (scratch script, real modules, fake `query`, runner allowing only
  `queue`/`sessions --json`, fs refusing writes, no server or port).
- SDK 0.3.309 `sdk.d.ts`: `agent` (`:1578-1596`, "the agent's system prompt,
  tool restrictions, and model will be applied to the main conversation …
  equivalent to the `--agent` CLI flag"), the settings `agent`
  (`:9361-9364`), `settingSources` (`:2306-2315`, "When omitted, all sources
  are loaded").
- `.claude/agents/heraklios-implementer.md`: `tools: Read, Write, Edit,
  Bash, Grep, Glob`, `model: sonnet`. The implementer's cwd is still the
  worktree and its prompt still matches `/spawn` step 5
  (`.claude/skills/spawn/SKILL.md:39-44`).
- `.claude/skills/auto/SKILL.md:20-34`, `:52-99` read for F6 and F13.
- Counts: 39/35/18 tests in round 1's three new test files and +1 in
  `session-lib.test.mjs`; 57 test files on `main` (`418ca72`), 61 at HEAD;
  `concurrency.test.mjs` has 5 tests, 5 + 1 + 1 = the 7 new (1087 → 1094).
- `npm run sdlc:scan -- --sample-due auto --exclude 52`: nth attested auto
  change = 2, every 3, `sampled: no`.
- Nothing touched `main` or was pushed: `main` at `418ca72`, an ancestor of
  HEAD; no remote §52 branch.

**Taken on trust:** the implementer's statement that its first forms of the
launch and gate race tests survived (only the current forms were run); the
994 base, by arithmetic.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut2/`
(reviewer) and `…/scratchpad/coord52/` (coordinator).

Mutant a rework is expected to kill: removing the new state reset in
`park`'s abort listener (F14).

# Round 1 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 7702eca
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `77eb301`.

Resolutions (round 2, checked at `076cd29`):
- **F1, race: fixed.** `running(id)` is re-checked inside the locks: launch
  (`session-routes.mjs:54`), gate (`actions.mjs:73`), dry-run (`:44`), real
  ship (`:57`). `concurrency.test.mjs` has a deterministic concurrent-launch
  test and gate, dry-run and ship tests with a manager that flips to running.
  K1-K5 killed.
- **F2, needs you: fixed, with a residual (F14).** `loadState` overlays the
  manager's `needs you` on `session` and `worktree.session`
  (`state.mjs:29-32`, `:82-83`), over the hook log, only for its own intent.
  F2a-F2e killed.
- **F3, main lock untested: fixed.** M51, M51b and M52 killed.
- **F4, owner: terminal parity kept.** README (`:700-704`) and CLAUDE.md
  (`:145-147`) now say what your settings allow, or auto mode approves, runs
  without a prompt. The plan's Risks wording is left (an amendment).
- **F5, owner: fixed.** The implementer runs with `agent:
  'heraklios-implementer'` (`orchestrator-lib.mjs:13`, `:174`), through the
  route (`session-routes.mjs:55`) to `query()` (`sdk-sessions.mjs:166`);
  reviewer and auto have none. F5a-F5g killed. The real SDK's handling is in
  the live check.
- **F6, owner: partly resolved.** The confirm (`app.js:98-100`) and docs
  say the click is your `/auto <id>`, for that intent only; no agent
  permission widened. The resume wording is open as F13, the missing "an
  agent never presses it" as F15.
- **F7, owner: left.** See F15.
- **F8, owner: the live check runs in a disposable clone.** No code change.
- **F9: fixed.** `plan.md:286` says 57 / 994.
- **F10, owner: left.**
- **F11: fixed for M9** (`server.test.mjs:458`, `sx` → 400). M23 stays
  equivalent.
- **F12: fixed.** `tools/orchestrator/` in CLAUDE.md "Architecture"; the
  README notes the 2000-item transcript cap (`MAX_ITEMS`,
  `sdk-sessions.mjs:16`).
