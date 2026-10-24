<!-- generated-by: heraklios/review@0.1.5 -->
# §52 review — Orchestrator UI to manage intents and their Claude sessions

verdict: escalate
tier: reviewed
reviewed-commit: 98ecb4b
round: 4
sampled: no
run: manual
live-check: owed

**Tier:** Reviewed, from `metadata.yml`'s `review_tier: reviewed`; the path
table agrees (round 1's `eslint.config.js` `no-console` exemption is still in
the branch's diff against `main`). This round touches only
`tools/orchestrator/*.test.mjs`, `CLAUDE.md`, `intents/README.md` and
`intents/52-orchestrator-ui/**`.

**Verdict:** `escalate`. F16 and F17 are fixed and the round-3 LOW on M15 is
resolved (the mutant is now killed). Nothing needs rework; one new LOW (M15b)
and one carried LOW are "worth a look". The tier is Reviewed, so you read the
diff, then run the live check.

This round is `run: manual`: the `/auto` run stopped out of rounds after
round 3, and the owner asked the coordinator to run the rework and this
review by hand. It covers `ac88e16` (the F16 test), `a241be2` (the F17 docs),
`aa5a5a8` (the M15 test) and `98ecb4b` (Progress); `4ea7863` is the round-3
report and `e337485` only sets `auto_stopped`. No production file changed in
`4063e84..98ecb4b`, so the code is the code round 3 reviewed. Passes run by
the `heraklios-reviewer` agent; the coordinator re-ran verify, check:intent
and all three mutants.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The rework does only F16, F17 and the M15 LOW; its Progress entry is appended under `## Progress` (`plan.md:275`, entry at `:436-441`), nothing above the marker changed; `auto_stopped` is the auto skill's own write (`e337485`) |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule. The stop strings were checked against `.claude/skills/auto/SKILL.md` |
| 4 | Tests prove the rule, not only pass | findings (1): LOW M15b. M23 and M15 are now killed |
| 5 | Boundary and conventions | pass: no `src/` file, no GameState, save or undo change |
| 6 | Numbers in prose | pass. Progress says 61 files, 1109 tests (1108 + 1 sdk-sessions), lint 21 of 21, M23 and M15 killed; all reproduce |
| 7 | Documentation | pass (F17 fixed); one wrapping nit |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21, cap still `--max-warnings 21` (`package.json:12`); `package.json` and `eslint.config.js` untouched; no new dependency; no production change, so the security surface is round 3's |
| 9 | Repository-specific footguns | pass: no drift, AI or map change |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 52, feature)
  error: A live check is owed and not recorded. Do the steps in intents/52-orchestrator-ui/review.md → ## Live check, then set live_checked: <date> in intents/52-orchestrator-ui/metadata.yml.
  note:  24 file(s), 4305 line(s) changed outside intents/.
```
The only error is the owed live check, which you clear; not rework.

## Resolutions checked
- **F16: fixed (`ac88e16`).** `tools/orchestrator/sdk-sessions.test.mjs:230-240`
  launches, calls `stop()`, sends a late `canUseTool` with an AbortSignal,
  checks it parks (1 pending), aborts it, and expects `stopped` with
  `runningFor('52')` false. It runs the real abort listener
  (`sdk-sessions.mjs:93-101`); M23 is killed by this test alone.
- **F17: fixed (`a241be2`).** `CLAUDE.md:154-159` and
  `intents/README.md:116-121` list `plan found the spec incomplete` among the
  stops answered in a coordinator terminal and say `out of rounds` is refused
  too, as `README.md:713-717`, `orchestrator-lib.mjs:191`, `:194` and
  `SKILL.md:92`, `:97`, `:133`, `:161` have it.
- **LOW M15: resolved by test (`aa5a5a8`).** `orchestrator-lib.test.mjs:283`
  asserts the `It starts a run` tail for `null`, `undefined`, `''` and
  `'  '`; removing `.trim()` is now killed. Correction to round 3: M15 was
  not fully equivalent in production (M15b).
- **The optional SKILL.md extraction test, skipped by the implementer:** its
  reason (the stop strings wrap across lines) is overstated; collapsing
  newlines and indentation extracts the 12 backticked strings cleanly, but
  would still miss the stops written in prose (`critical finding`, `red
  verify`, `agent error`, around `SKILL.md:236-241`). Feasible but partial;
  the skip is acceptable for an optional item and stays a LOW.

## Pass 4: mutations
One at a time in the foreground, full `vitest run` each; backed up by copy
into `scratchpad/mut4/`, patched by an exact, CRLF-aware substring that must
occur once; `git diff --quiet -- <file>` returned 1 and the diff was printed;
restored by copy; `git status --short` empty after each. The M23 needle
includes the `(review F14).` comment line, so it can only hit `:100`.

| # | Mutant (target at HEAD) | Result / failing test |
| --- | --- | --- |
| M23 | `&& s.state === 'needs you'` removed from the abort listener (`sdk-sessions.mjs:100`) | **killed**, 1 failed: "stop (spec B5) > a late request after stop() stays stopped when its signal aborts (F16)" |
| M15 | `.trim()` removed (`orchestrator-lib.mjs:210`) | **killed**, 1 failed: "autoLaunch … > starts, or resumes a closed session, with no stop recorded" |
| **M15b** | `.trim()` → `.trimEnd()` (`orchestrator-lib.mjs:210`) | **survived**, 1109 passed (LOW below) |

No other behavioural line changed; round 3's other mutants target code
unchanged since `4063e84` and were not re-run.

## Findings
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:210` (M15b survives):
  nothing tests trimming leading whitespace, and it can reach `autoLaunch`:
  `unquote` (`scripts/intent-check-lib.mjs:139-140`) trims outside the quotes
  only. A probe with the real `parseMetadata`, `parseAuto` and `autoLaunch`:
  `auto_stopped: " decision needed"` parses to `' decision needed'` (and
  `' out of rounds'` in single quotes likewise); today both are refused, with
  `trimEnd` both would be allowed. The skill writes these values unquoted,
  so only a hand-typed quoted value reaches it, and the click still shows a
  confirm naming the stop. Worth a look: add `' decision needed'` (leading
  space) to the refused-stops test (`orchestrator-lib.test.mjs:~310-320`).
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:185-196` (carried from
  round 3): nothing ties NEEDS_ANSWER to the skill's strings, and matching is
  case-sensitive. Worth a look.

Nit (not a finding): `CLAUDE.md:155` wasn't re-wrapped (about 110 columns in
a paragraph wrapped at about 78).

## Not checked
- **What a headless `/auto` does on each allowed resume:** whether a `live
  check owed` resume with `live_checked` recorded goes on to step 8; whether a
  `spec drafted` click without the gate stops cleanly again; what a headless
  run does with a hand-quoted `" decision needed"` (M15b's case). The skill
  text was read; nothing was run.
- **How often the real SDK aborts a `canUseTool` signal,** including after a
  Stop (F14, F16): only the code path, with a fake `query`.
- **`options.agent` against the real SDK and CLI** (unchanged since round 2).
- **Unchanged from rounds 1-2:** hooks in headless sessions (B11), the real
  `canUseTool` flow under `defaultMode: auto`, the real AskUserQuestion answer
  shape, `interrupt()` plus abort ending the CLI child.
- **The page in a browser:** Auto disabled with its hover text, the confirm
  texts, the `needs you` row clearing after Deny, dialogs, SSE, the CSP.
- **Real routes against real git and scripts** (spawn, remove, gate commit,
  dry-run, real ship, session launch); no HTTP probe this round.
- **`public/app.js`** is not mutation-tested.
- **Round 3's mutants on unchanged code** were not re-run.
- **No e2e:** no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.
- **`main` has moved** past the merge-base `418ca72`, with intent folders only
  (§53, §54) and, since, nothing under `tools/` or the docs this branch
  touches. No merge was tried.

## Live check
- **Owed** by rule 3: `options.agent` in a real session, hooks in headless
  sessions, the real permission flow, the page in a browser (the Auto
  disabled state and the confirms), and real spawn, gate and dry-run are
  runtime-only. Not owed by path rule 1, so e2e can't stand in.
- **Where (F8, your decision):** a disposable clone whose `main` is this
  branch, touching neither the main checkout nor the branch. Run it on
  `98ecb4b` or later; this round changed no behaviour, so the steps are
  round 3's.
- **Steps:**
  1. **Set up the clone.** In Git Bash: `git clone
     C:/Users/eric/src/heraklios C:/tmp/h52 && cd C:/tmp/h52`, `git checkout
     -B main origin/feat/52-orchestrator-ui`, `git remote set-url --push
     origin DISABLED` (nothing in the clone can push to your repo), `npm ci`,
     `npm run orchestrator` (add `-- --port 5288` if 5299 is busy), open
     `http://127.0.0.1:5299/`. The intent and worktree tables match `npm run
     queue` and `npm run sessions` run in `C:/tmp/h52`, "Waiting on you"
     first.
  2. **Spawn.** In the clone, commit `intents/99-throwaway/` on `main`
     (`type: adjustment`, `status: accepted`, `intent_accepted: <today>`, an
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
  4. **`needs you` (F2, F14, F16).** When a permission request appears, the
     §99 row shows `needs you`, first in "Waiting on you", next step "Answer
     the waiting session". Click **Deny**: the transcript shows it denied,
     and on the next refresh the row is no longer `needs you`. Click Stop:
     `stopped`, no `needs you`, and it stays `stopped` across refreshes. Any
     `<b>` in the output shows as literal text.
  5. **The Auto button and its confirms (F6, F13).**
     - **Plain launch:** with §99's `auto_stopped` empty, click Auto. The
       confirm says the click is your `/auto 99`, authorises `plan_approved`
       (and `auto_authorized`) for §99 only, and "starts a run, or resumes
       one a closed session left". Click Cancel: no session panel, `git log
       -1` unchanged.
     - **A decision-type stop:** in the §99 worktree set `auto_stopped:
       decision needed` in `metadata.yml` and commit it there. After a
       refresh §99's **Auto button is disabled**, its hover text saying the
       stop needs your answer, given in a coordinator terminal with `/auto
       99` plus the answer. `curl -s -X POST -H "Origin:
       http://127.0.0.1:5299" -H "Content-Type: application/json" -d
       '{"role":"auto","id":"99"}' http://127.0.0.1:5299/api/sessions`
       returns 409 with the same reason. Review and Implementer stay enabled.
     - **An escalate stop:** set `auto_stopped: escalate, owner reads the
       diff` and commit it. Auto is enabled and its confirm adds "It ALSO
       means 'I have read the diff'". Click Cancel.
     - **Out of rounds:** set `auto_stopped: out of rounds, open findings
       below`. Auto is disabled and its hover text says the intent continues
       by hand.
  6. **Remove waits for Stop.** With an implementer running on §99, Remove
     gives "A session is running on §99: stop it first" and the worktree
     stays.
  7. **Gate button.** On `intents/98-draft/` (`status: draft`), click
     "Record intent_accepted" and confirm: `intent_accepted: <today>` (bare
     date), and `git log -1 --stat` shows `§98: intent_accepted recorded
     (orchestrator)` under your name, that file only.
  8. **Ship dry-run only.** "Ship…" on an in-review intent in the clone shows
     only the dry-run report. Click Close, never "Ship for real".
  9. **Host and Origin.** Both return `403`: `curl -s -o /dev/null -w
     "%{http_code}\n" -H "Host: evil.example"
     http://127.0.0.1:5299/api/state` and `curl -s -o /dev/null -w
     "%{http_code}\n" -X POST -H "Origin: http://evil.example"
     http://127.0.0.1:5299/api/ship/1`.
  10. Ctrl+C the server, restore `defaultMode`, delete `C:/tmp/h52` and
      `C:/tmp/heraklios-wt` (real `node_modules`, no junctions).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `98ecb4b`, clean before and after):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 61
  files, 1109 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 24 files, 4305
  lines (matches, pasted above).
- Mutants one at a time with the full suite, backed up and restored by copy,
  each checked as applied:
  - M23: **killed**, 1 failed, "a late request after stop() stays stopped
    when its signal aborts (F16)" (matches).
  - M15: **killed**, 1 failed, "starts, or resumes a closed session, with no
    stop recorded" (matches).
  - M15b: **survived**, 1109 passed (matches).
  - `git status --short` empty after each.

**Reviewer agent** (same worktree and HEAD; nothing checked out; tree empty
at the start, after every mutant and at the end):
- `git diff 4063e84..HEAD` read in full (7 files, no production change),
  plus the unchanged code the fixes rely on: `sdk-sessions.mjs` park, answer,
  stop, runningFor (`:86-101`, `:173-208`); `orchestrator-lib.mjs:180-227`;
  `state.mjs:84-89`; `session-routes.mjs:36-43`; `intent-check-lib.mjs`
  `parseAuto` (`:125-136`) and `unquote` (`:138-142`).
- `npm run verify` and `check:intent` as above; the three mutants as tabled.
- Probe `scratchpad/mut4/probe.mjs` (real `parseMetadata`, `parseAuto`,
  `autoLaunch`; no server, no repo writes): quoted values with a leading
  space keep it (M15b's path); unquoted and tab-led values arrive trimmed.
- SKILL.md extraction probe (read-only): 12 backticked stop strings.
- `npm run sdlc:scan -- --sample-due manual --exclude 52`: nth attested
  manual change = 13, every 5, `sampled: no` (the verdict is escalate, so
  sampling doesn't apply anyway).
- Nothing touched `main` or was pushed; `git ls-remote --heads origin
  feat/52-orchestrator-ui` is empty. The four round-4 commits carry the
  attribution trailers; `status: in-review`.

**Taken on trust:** round 3's mutant results on unchanged code; the 994 base
from rounds 1-2.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut4/`
(reviewer) and `…/scratchpad/coord52/` (coordinator).

# Round 3 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 4063e84
- round: 3
- sampled: no
- run: auto
- live-check: owed

The full round-3 report is in git at `4ea7863`.

Resolutions (round 4, checked at `98ecb4b`):
- **F16: fixed (`ac88e16`).** `sdk-sessions.test.mjs:230-240` covers a late
  request after Stop: aborted, the session stays `stopped`, `runningFor`
  false. M23 killed.
- **F17: fixed (`a241be2`).** `CLAUDE.md:154-159` and
  `intents/README.md:116-121` list `plan found the spec incomplete` and say
  `out of rounds` is refused too, as `README.md:713-717` does.
- **LOW M15: resolved (`aa5a5a8`).** The blank-stop test asserts the `It
  starts a run` tail for `'  '`; M15 killed; the trim kept. The "equivalent in
  production" judgement corrected: a quoted value keeps a leading space (the
  new LOW M15b).
- **LOW, SKILL.md tie and case-sensitive matching: open,** worth a look.

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
