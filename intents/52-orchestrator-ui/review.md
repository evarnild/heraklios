<!-- generated-by: heraklios/review@0.1.5 -->
# §52 review — Orchestrator UI to manage intents and their Claude sessions

verdict: rework
tier: reviewed
reviewed-commit: 4063e84
round: 3
sampled: no
run: auto
live-check: owed

**Tier:** Reviewed, from `metadata.yml`'s `review_tier: reviewed`; the path
table agrees (round 1's `eslint.config.js` `no-console` exemption is still in
the branch's diff against `main`). The rework touches only
`tools/orchestrator/**`, `intents/**`, `README.md`, `CLAUDE.md` and
`intents/README.md`.

**Verdict:** `rework`. F13, F14 and F15 are resolved as the owner decided.
Of 26 mutants on the rework's lines 24 are killed; M23 is a reachable guard
with no test (F16, needs rework) and M15 is equivalent in production (LOW).
One doc list is short (F17, needs rework). Both are mechanical, but this is
round 3 of 3: by the auto skill the run stops at `out of rounds` and the
intent continues by hand.

Round 3 covers `d1b649a` (F13), `566fe4c` (F14), `2c5186f` (F15 and nits)
and `1a68914` (Progress). `81649d1` only sets `auto_round: 3`, and `4063e84`
only changes the comment on `auto_authorized` (`git diff 81649d1 4063e84`),
so the code reviewed is the code at `81649d1`. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent, both
survivors and two kills (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): F17. F13 is the owner's option (a); the implementer's extra assumptions are judged under Findings and accepted |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule. The "rulebook" here is `.claude/skills/auto/SKILL.md`, checked string by string below |
| 4 | Tests prove the rule, not only pass | findings (1): F16. 24 of 26 killed; M23 survives, M15 equivalent |
| 5 | Boundary and conventions | pass: no `src/` file, no GameState, save or undo change; the decision is in the tested `orchestrator-lib.mjs`, the page only reads it |
| 6 | Numbers in prose | pass. 61 files, 1108 tests, lint 21 of 21 reproduce: 1094 + 7 autoLaunch + 3 F13 server + 2 sdk-sessions + 1 concurrency + 1 remove = 1108. The implementer's six mutants reproduce as killed by the tests it names |
| 7 | Documentation | findings (1): F17 |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21, cap unchanged; `package.json` and `eslint.config.js` untouched; no new dependency; no `innerHTML`, `insertAdjacentHTML` or `eval` in `public/app.js`; the refusal reason reaches only `button.title` and the JSON error |
| 9 | Repository-specific footguns | pass: no drift, AI or map change |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 52, feature)
  error: A live check is owed and not recorded. Do the steps in intents/52-orchestrator-ui/review.md → ## Live check, then set live_checked: <date> in intents/52-orchestrator-ui/metadata.yml.
  note:  24 file(s), 4292 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## autoLaunch against the skill
`.claude/skills/auto/SKILL.md:89-100` (the resume table) and the stop strings
at `:112`, `:114`, `:128`, `:133`, `:161`, `:180`, `:221`, `:223`, `:226`,
`:236-241`, `:256-257`.

| Stop string the skill writes | autoLaunch | Skill's resume | Judgement |
| --- | --- | --- | --- |
| (empty) | allowed, "starts a run, or resumes one a closed session left" | first step not done | correct |
| `spec questions` | refused, answer in a terminal | the owner's answers | correct (owner's list) |
| `spec drafted, waiting for spec_accepted` | allowed, record `spec_accepted` first | the owner's yes, then step 3 | correct; a click without the gate only stops again |
| `plan exists unapproved, owner decides` | refused | settled by the owner | correct (owner's list) |
| `plan found the spec incomplete` | refused | step 3 only "after the owner has settled it" | the implementer's addition; accepted (settling it is a spec decision or amendment, and refusing is the deny-by-default side) |
| `decision needed`, `spec or plan amendment needed`, `critical finding` | refused | the owner's answer, then a new round | correct (owner's list) |
| `escalate, owner reads the diff` | allowed; the confirm says the click "ALSO means 'I have read the diff'" and that the run goes to the live-check or ship stop with no further review | `/auto` means "diff read", no new round | correct, wording matches `:95` |
| `live check owed` | allowed, record `live_checked` with its button first, after the check passed | step 7 | correct (`live_checked` is a gate button, `intent-check-lib.mjs:89`) |
| `out of rounds, open findings below` | refused, "continues by hand" | report again; by hand | the implementer's addition; accepted (a click would only re-report) |
| `ready for /ship` | allowed, "re-runs the ship dry-run … never ships" | dry-run again | correct |
| `re-check mismatch`, `ship dry-run blocked`, `red verify`, `red check:intent`, `agent error`, `worktree held by another session`, `too many sessions` | allowed by the default branch; the confirm names the stop | clear the cause, redo the step | correct |

No prefix collision: the refused prefixes are checked first and no allowed
string starts with a refused one. Matching is case-sensitive; the skill
writes lowercase, and a hand-typed `Decision needed` is allowed with a
confirm that names it (LOW, below).

The confirms widen no agent permission: the base sentence authorises only
`plan_approved` and `auto_authorized`, for one intent and one run; none
implies the click records `spec_accepted` or `live_checked`, both of which it
tells the owner to record first with their buttons. `CLAUDE.md:158-159` and
`intents/README.md:120-121` say an agent never presses Auto or POSTs to
`/api/sessions`.

## Security re-check
No regression.
- **No new route;** `guard()` still runs first on every request
  (`server.mjs:85`).
- **The Auto refusal is enforced on the server:** `session-routes.mjs:39-43`
  runs `autoLaunch(intent.autoStopped, id)` for role `auto` before any launch
  and returns 409 with the reason. `autoStopped` comes from
  `parseAuto(read.metadata)` (`state.mjs:88`), never from the request. Other
  roles are unaffected (server test).
- **Remove waits for Stop:** `actions.mjs:39`, `flag && running(id) ?
  stopFirst(id)`, inside the `[id]` lock; spawn is not blocked (test).
- **Gate writes, the dry-run token and deny-by-default parking unchanged,**
  apart from the F14 reset, which only moves `needs you` → `running` when
  nothing is pending.
- **No shell, no new input field:** the launch body is still `{role, id}`,
  validated by `ROLES` and `validId`.

## Pass 4: mutations (26 mutants, one at a time, full `vitest run` each, foreground)
Backed up by copy into `scratchpad/mut3/`, applied by exact substring with
CRLF-aware needles, `git diff --quiet -- <file>` returning 1, full suite,
restored by copy, `git status --short` empty after each. First attempts at
M1-M5 (no CRLF match) and M21-M23 (the needle also matched `answer()` at
`:181`) applied nothing and were re-run. M5's first run was cut off when a
session ended and was re-run.

| # | Mutant (target at HEAD) | Result / failing test |
| --- | --- | --- |
| M1 | `'spec questions'` removed from NEEDS_ANSWER (`orchestrator-lib.mjs:186`) | killed: autoLaunch "a stop that needs the owner answer is refused…" |
| M2 | `'decision needed'` removed (`:187`) | killed: same, plus 2 server F13 tests |
| M3 | `'spec or plan amendment needed'` removed (`:188`) | killed: autoLaunch refused test |
| M4 | `'critical finding'` removed (`:189`) | killed: same |
| M5 | `'plan exists unapproved'` removed (`:190`) | killed: same (re-run) |
| M6 | `'plan found the spec incomplete'` removed (`:191`) | killed: same |
| M7 | `BY_HAND = []` (`:194`) | killed: "out of rounds is refused" |
| M8 | prefix match → exact match (`:196`) | killed: refused test and out-of-rounds test |
| M9 | escalate confirm without "I have read the diff" (`:222`) | killed: "an escalate stop…" |
| M10 | spec-drafted tail without "Record spec_accepted…" (`:220`) | killed: "spec drafted and live check owed…" |
| M11 | live-check tail without "Record live_checked…" (`:221`) | killed: same |
| M12 | ready-for-ship tail without "dry-run" (`:223`) | killed: "ready for /ship re-runs the dry-run…" |
| M13 | default tail drops the stop's name (`:224`) | killed: "a cleared cause … naming the cause" |
| M14 | base confirm drops "plan_approved (and auto_authorized)" (`:198-199`) | killed: "starts, or resumes a closed session…" |
| **M15** | `.trim()` removed (`:210`) | **survived**: equivalent in production (LOW) |
| M16 | `IN_TERMINAL.replace('<id>', id)` → `IN_TERMINAL` (`:213`) | killed: refused test (`/auto 52`) |
| M17 | route refusal line removed (`session-routes.mjs:42`) | killed: server "refuses an Auto launch on a stop that needs the owner answer…" |
| M18 | `role === 'auto'` → `false` (`session-routes.mjs:40`) | killed: same |
| M19 | `autoStopped = null` (`state.mjs:88`) | killed: 2 server F13 tests |
| M20 | `autoStopped` and `autoLaunch` dropped from the intent (`state.mjs:89`) | killed: 2 server F13 tests |
| M26 | state's `autoLaunch(null, …)` (`state.mjs:89`) | killed: server "exposes auto_stopped and the Auto decision…" |
| M21 | F14 reset line removed (`sdk-sessions.mjs:100`) | killed: sdk-sessions "goes back to running…" + concurrency "the intent is needs you while a request is parked and not after the abort" |
| M22 | F14 `!s.pending.size &&` removed (`:100`) | killed: "stays needs you after an abort while another request is pending" |
| **M23** | F14 `&& s.state === 'needs you'` removed (`:100`) | **survived** (F16) |
| M24 | remove guard → `false` (`actions.mjs:39`) | killed: server "remove is refused while a session runs on the intent, spawn is not" |
| M25 | remove guard `flag &&` dropped, so spawn is refused too (`actions.mjs:39`) | killed: same |

Not mutated: `public/app.js:106-116` (Auto disabled with the reason as its
title; confirm from `confirmText`), untested by design, read, and left to the
live check.

**On the tests:** F13's classification, the route refusal, the state
exposure, F14's reset and its pending-size guard, and the remove guard are
proved: every refused prefix, the by-hand list, the prefix matching and each
confirm tail has a test that fails without it. The gap is F16.

## Findings
- **F16. MEDIUM** `tools/orchestrator/sdk-sessions.mjs:100`: M23 survives.
  The `s.state === 'needs you'` half of the F14 reset has no test, and it is
  reachable. Probe (scratch script, real `createSessionManager`, fake
  `query`, no server): launch, `stop()` (state `stopped`), then a late
  `canUseTool` with a signal parks in the stopped session (1 pending, still
  `stopped`); after `abort()` the state stays `stopped` and
  `runningFor('52')` is false. Without the guard that abort would set the
  stopped session to `running`, and `runningFor` would block gate, ship,
  remove and a new launch on the intent until a restart.
  Needs rework: an sdk-sessions test (launch, stop, park a late request with
  a signal, abort; expect `stopped` and `runningFor(id)` false). Expected
  kill: M23.
- **F17. LOW** `CLAUDE.md:154-156`, `intents/README.md:116-118`: the list of
  stops "answered in a coordinator terminal" leaves out `plan found the spec
  incomplete` and `out of rounds`, which `autoLaunch` refuses
  (`orchestrator-lib.mjs:191`, `:194`) and `README.md:713-717` lists. Both
  files also say the click resumes "a cause you have cleared", so a reader
  would expect those two to be clickable when the page disables them.
  Needs rework: add `plan found the spec incomplete` to both lists and the
  sentence that `out of rounds` is refused too (the intent continues by
  hand), as README.md has it.
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:210` (M15): `.trim()` is
  equivalent in production: `parseMetadata`'s `unquote` already trims and
  `parseAuto` maps `''` to null (probe: `"   decision needed  "` and
  `"\"decision needed\""` both parse to `decision needed`). Worth a look:
  drop the trim, or assert the empty-stop tail for `'  '`.
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:185-196`: nothing ties
  NEEDS_ANSWER to the skill's strings, so a future `/auto` stop that needs an
  answer would be allowed by the default branch; matching is also
  case-sensitive (`Decision needed` is allowed). Worth a look: a test that
  extracts every `auto_stopped: <reason>` from `.claude/skills/auto/SKILL.md`
  and asserts each is classified, and/or lowercase matching.

The implementer's assumptions: refusing `plan found the spec incomplete` and
`out of rounds` is accepted (table above); allowing an unknown reason with a
confirm naming it matches the owner's "a cause you have cleared" (accepted,
with the LOW above); the server-side `autoLaunch` with a 409 on the launch
route and `/api/remove` refusing while a session runs are correct and tested.

Nits (not findings): the round-3 commits carry the attribution trailers
(round 2's nit resolved); `app.js:108` reads `intent.autoLaunch.confirmText`
unguarded, though `/api/state` always sets it.

## Not checked
- **What a headless `/auto` does on each allowed resume:** whether a `live
  check owed` resume with `live_checked` recorded (but no "it passed" in that
  conversation) goes on to step 8, and whether a `spec drafted` click without
  the gate stops cleanly again. The skill text was read; nothing was run.
- **`options.agent` against the real SDK and CLI** (round 2, unchanged).
- **Unchanged from rounds 1-2:** hooks in headless sessions (B11), the real
  `canUseTool` flow under `defaultMode: auto`, the real AskUserQuestion answer
  shape, `interrupt()` plus abort ending the CLI child.
- **How often the real SDK aborts a `canUseTool` signal,** including after a
  Stop (F14, F16): only the code path is shown.
- **The page in a browser:** Auto disabled with its title, the confirm texts,
  the `needs you` row clearing after Deny, dialogs, SSE, the CSP.
- **Real routes against real git and scripts** (spawn, remove, gate commit,
  dry-run, real ship, session launch). No HTTP probe this round.
- **`public/app.js`** is not mutation-tested.
- **No e2e:** no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.

## Live check
- **Owed** by rule 3: `options.agent` in a real session, hooks in headless
  sessions, the real permission flow, the page in a browser (the Auto
  disabled state and confirms), and real spawn, gate and dry-run are
  runtime-only. Not owed by path rule 1, so e2e can't stand in.
- **Where (F8, the owner's decision):** a disposable clone whose `main` is
  this branch, touching neither the main checkout nor the branch. Run it on
  the commit that resolves F16 and F17.
- **Steps:**
  1. **Set up the clone.** In Git Bash: `git clone C:/Users/eric/src/heraklios
     C:/tmp/h52 && cd C:/tmp/h52`, `git checkout -B main
     origin/feat/52-orchestrator-ui`, `git remote set-url --push origin
     DISABLED` (nothing in the clone can push to your repo), `npm ci`, `npm run
     orchestrator` (add `-- --port 5288` if 5299 is busy), open
     `http://127.0.0.1:5299/`. The intent and worktree tables match `npm run
     queue` and `npm run sessions` run in `C:/tmp/h52`, "Waiting on you"
     first.
  2. **Spawn.** In the clone, commit `intents/99-throwaway/` on `main` (`type:
     adjustment`, `status: accepted`, `intent_accepted: <today>`, an
     `intent.md` asking for one line in `docs/throwaway.md`). Click Spawn and
     confirm: the output shows under "Last action" and
     `C:/tmp/heraklios-wt/99-throwaway` appears in Worktrees.
  3. **Implementer as the agent (F5).** To force a prompt, set
     `"defaultMode": "default"` in `~/.claude/settings.json` for the run (put it
     back after). Click Implementer on §99 and confirm: messages stream in a
     panel. In `~/.claude/projects/`, the newest `.jsonl` under the folder named
     after `C:/tmp/heraklios-wt/99-throwaway` has assistant entries with a
     `claude-sonnet…` `"model"` (the agent's, not your default). It commits on
     its branch, appends to `## Progress` only, and doesn't push.
  4. **`needs you` (F2, F14).** When a permission request appears, the §99 row
     shows `needs you`, first in "Waiting on you", next step "Answer the waiting
     session". Click **Deny**: the transcript shows it denied, and on the next
     refresh the row is no longer `needs you`. Click Stop: `stopped`, no `needs
     you`. Any `<b>` in the output shows as literal text.
  5. **The Auto button and its confirms (F6, F13).**
     - **Plain launch:** with §99's `auto_stopped` empty, click Auto. The
       confirm says the click is your `/auto 99`, authorises `plan_approved`
       (and `auto_authorized`) for §99 only, and "starts a run, or resumes one
       a closed session left". Click Cancel: no session panel, `git log -1`
       unchanged.
     - **A decision-type stop:** in the §99 worktree set `auto_stopped:
       decision needed` in `metadata.yml` and commit it there. After a refresh
       §99's **Auto button is disabled**, and its hover text says the stop
       needs your answer, given in a coordinator terminal with `/auto 99` plus
       the answer. `curl -s -X POST -H "Origin: http://127.0.0.1:5299" -H
       "Content-Type: application/json" -d '{"role":"auto","id":"99"}'
       http://127.0.0.1:5299/api/sessions` returns 409 with the same reason.
       Review and Implementer stay enabled.
     - **An escalate stop:** set `auto_stopped: escalate, owner reads the
       diff` and commit it. Auto is enabled and its confirm adds "It ALSO
       means 'I have read the diff'". Click Cancel.
     - **Out of rounds:** set `auto_stopped: out of rounds, open findings
       below`. Auto is disabled and its hover text says the intent continues
       by hand.
  6. **Remove waits for Stop.** With an implementer running on §99, Remove
     gives "A session is running on §99: stop it first" and the worktree stays.
  7. **Gate button.** On `intents/98-draft/` (`status: draft`), click "Record
     intent_accepted" and confirm: `intent_accepted: <today>` (bare date), and
     `git log -1 --stat` shows `§98: intent_accepted recorded (orchestrator)`
     under your name, that file only.
  8. **Ship dry-run only.** "Ship…" on an in-review intent in the clone shows
     only the dry-run report. Click Close, never "Ship for real".
  9. **Host and Origin.** Both return `403`: `curl -s -o /dev/null -w
     "%{http_code}\n" -H "Host: evil.example" http://127.0.0.1:5299/api/state`
     and `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin:
     http://evil.example" http://127.0.0.1:5299/api/ship/1`.
  10. Ctrl+C the server, restore `defaultMode`, delete `C:/tmp/h52` and
      `C:/tmp/heraklios-wt` (real `node_modules`, no junctions).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `4063e84`, clean before and after):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 61
  files, 1108 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 24 files, 4292
  lines (matches, pasted above).
- Mutants one at a time with the full suite, backed up and restored by copy,
  each checked as applied (the `sdk-sessions.mjs:100` needle includes the
  `(review F14).` comment line above it, so it can't hit `:181`):
  - M23 (`&& s.state === 'needs you'` removed): **survived**, 1108 passed
    (matches).
  - M15 (`.trim()` removed): **survived**, 1108 passed (matches).
  - M21 (F14 reset line removed): **killed**, 2 failed: sdk-sessions "goes
    back to running when the abort leaves nothing pending (F14)" and
    concurrency "the intent is needs you while a request is parked and not
    after the abort" (matches).
  - M17 (route refusal removed): **killed**, 1 failed: server "refuses an
    Auto launch on a stop that needs the owner answer, but not a reviewer
    launch (F13)" (matches).
  - `git status --short` empty after each.

**Reviewer agent** (same worktree, HEAD `81649d1` then `4063e84`; tree empty
at the start, after every mutant and at the end; nothing checked out):
- `git diff 076cd29..81649d1`: every code, test and doc file read in full,
  plus the unchanged code it depends on (`actions.mjs`; `sdk-sessions.mjs`
  park, setState, answer, stop, runningFor; the `session-routes.mjs` launch;
  `state.mjs`; `intent-check-lib.mjs` `parseMetadata`, `parseAuto`,
  `GATE_FIELDS`; `server.mjs:85`, `:98`).
- `git diff 81649d1 4063e84`: only the `auto_authorized` comment.
- `.claude/skills/auto/SKILL.md:52-262`: every stop string and the resume
  table, row by row.
- `npm run verify` and `check:intent` as above; pass 4 as tabled.
- Probe `scratchpad/mut3/probe.mjs` (real `sdk-sessions.mjs`,
  `intent-check-lib.mjs`, `orchestrator-lib.mjs`, fake `query`, no server, no
  port, no repo writes): a late park after Stop stays `stopped` after its
  abort (F16); metadata values are trimmed and unquoted before `autoLaunch`
  (M15); `Decision needed` is allowed.
- `npm run sdlc:scan -- --sample-due auto --exclude 52`: nth attested auto
  change = 2, every 3, `sampled: no`.
- Nothing touched `main` or was pushed: `main` at `418ca72`, an ancestor of
  HEAD; `git ls-remote --heads origin feat/52-orchestrator-ui` empty.
- Every file:line here checked against HEAD.

**Taken on trust:** nothing new beyond rounds 1-2 (the 994 base, by
arithmetic). The implementer's mutant claims were re-run, not trusted.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut3/`
(reviewer) and `…/scratchpad/coord52/` (coordinator).

Mutant a rework is expected to kill: M23 (F16).

# Round 2 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 076cd29
- round: 2
- sampled: no
- run: auto
- live-check: owed

The full round-2 report is in git at `911526f`.

Resolutions (round 3, checked at `81649d1`, code unchanged at `4063e84`):
- **F13, owner's option (a): fixed.** `autoLaunch`
  (`orchestrator-lib.mjs:185-227`) classifies `auto_stopped` by the skill's
  prefixes: the owner's list is refused, plus `plan found the spec
  incomplete` and `out of rounds` (accepted); `escalate`'s confirm says the
  click also means "I have read the diff"; `spec drafted` and `live check
  owed` say to record the gate first; `ready for /ship` says it never ships.
  `/api/state` carries `autoStopped` and `autoLaunch` (`state.mjs:88-89`), the
  page disables Auto with the reason (`app.js:106-116`), and the launch route
  returns 409 (`session-routes.mjs:39-43`). Docs in `README.md:703-717`,
  `CLAUDE.md:150-160` and `intents/README.md:112-121`; the two shorter lists
  are F17. M1-M14, M16-M20 and M26 killed.
- **F14: fixed.** The abort listener resets `needs you` → `running` when
  nothing is pending (`sdk-sessions.mjs:100`), with sdk-sessions and
  overlay tests. M21 and M22 killed; the guard's state half survives (F16).
- **F15: fixed.** `CLAUDE.md:158-159` and `intents/README.md:120-121`.
- **Nits:** trailers present on the round-3 commits; `public/app.js` named as
  untested glue in CLAUDE.md Architecture; `/api/remove` refuses while a
  session runs (`actions.mjs:39`, M24 and M25 killed); `plan.md`'s
  `roleLaunch` and Risks wording left, as an amendment (the owner's).

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
