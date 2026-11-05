<!-- generated-by: heraklios/review@0.1.5 -->
# §58 review — The orchestrator's intent row shows a running session, and accepting an intent sets its status

verdict: attest
tier: attested
reviewed-commit: c4e4463
round: 3
sampled: yes
run: manual
live-check: owed

**Tier:** Attested, by the path table (`tools/**`, like `scripts/**`);
`review_tier` empty; type fix; no HIGH or CRITICAL finding. **Run:** manual,
on the owner's "58: rebase and review": the coordinator rebased the branch
onto `main` at `0ffef22` (clean, 10 commits), so round 2's reviewed commit
`d8dc5cf` is no longer an ancestor and a new round was due. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent, a
merge test against the newest `main`, the surviving mutant and one killed
one.

**Verdict:** `attest`. The rebase changed none of §58's commits, nothing it
depends on moved on `main`, and the tests still prove the change under vitest
5: 14 of 15 mutants killed, the 15th equivalent. **`sampled: yes`:** this is
the 15th attested manual change, so a post-merge full read of the diff is due.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: `git range-diff` gives all 10 commits `=`; the code diff is still `state.mjs`'s `liveSession` and `gateWrite`'s status write, their tests and three doc sentences |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: `tools/orchestrator/` only |
| 4 | Tests prove the rule | pass: 14 of 15 mutants killed (full suite each); M12 survives, equivalent |
| 5 | Boundary and conventions | pass: no `src/` change; the overlay reads the in-memory manager only (spec B12); the gate write is still one `setKeys` call |
| 6 | Numbers in prose | pass: Progress's "61 files, 1156 tests" are dated and were right then; on the new base the suite is 64 files, 1186 tests (main added tests) |
| 7 | Documentation | pass: §58's `CLAUDE.md` (Parallel sessions, orchestrator paragraph), `README.md` ("## Orchestrator") and `intents/README.md` sentences sit cleanly beside §55's and §60's text; nothing duplicated or contradicted |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged; no new dependency; no `innerHTML` or `eval` |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
type-check: FAIL (intent 58, fix)
  error: A live check is owed and not recorded. Do the steps in intents/58-orchestrator-row-state/review.md → ## Live check, then set live_checked: <date> in intents/58-orchestrator-row-state/metadata.yml.
  note:  6 file(s), 70 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Findings
- None needing rework.
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:92` (carried from round 2,
  unchanged): the `\r?` before `$` in
  `/^status:[ \t]*draft[ \t]*(#.*)?\r?$/m` is redundant, since a multiline
  `$` already matches before `\r` here (the CRLF test passes without it), so
  mutant M12 survives for good. Worth a look: drop it, or comment that it is
  kept for readers.

## Not checked
- **The page in a real browser** (rule 3): the row reading `running` or
  `needs you` while a real SDK session runs, waits and stops; a real gate
  click on a real CRLF checkout. No orchestrator or SDK session was started.
- **The real `sdk-sessions.mjs` manager feeding `liveSession`:** the tests use
  a fake `list()`. By reading: `launch` stores `intent: id` (`:152`),
  `summary` passes it through (`:125`), `LIVE_STATES` is `running` and `needs
  you` (`:17`), and `liveSession` compares with `String()` on both sides.
- **The worktrees table** (`public/app.js`) still shows the hook log's state,
  not the overlay: judged intended in round 1; no test pins it.
- **A quoted status** (`status: "draft"`) does not match; no file uses quotes.
- **e2e:** not run; no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.
- **The implementer's failing-first runs** in Progress: not re-derived (the
  M1 and M7 kills stand in for them).

## Live check
- **Owed** by rule 3 (the row state from a live SDK session; a gate click on
  a real CRLF checkout), unchanged by the rebase. Run it at `c4e4463` or a
  later commit that changes only this report or `metadata.yml`.
- **Steps:**
  1. A disposable clone whose `main` is this branch (never ship, push or
     merge from it):
     ```
     git clone C:/Users/eric/src/heraklios C:/Users/eric/scratch/h58
     cd C:/Users/eric/scratch/h58
     git remote set-url --push origin DISABLED
     git fetch origin fix/58-orchestrator-row-state
     git checkout -B main FETCH_HEAD
     npm ci
     ```
  2. In the clone, commit two throwaway intents on `main`: a draft
     `intents/990-throwaway/` (`status: draft`, empty `intent_accepted:`, its
     `metadata.yml` in CRLF), and an accepted one with its plan approved; run
     `npm run spawn -- <id>` for the second.
  3. `npm run orchestrator` in the clone (port 5299, or `-- --port 5399` if
     busy) and open the printed 127.0.0.1 URL.
  4. Click "Record intent_accepted" on §990 and confirm.
  5. Click Implementer (or Auto) on the spawned intent and watch its row;
     then Stop in its session panel.
- **You should see:** after step 4, `git show --stat HEAD` lists only
  `intents/990-throwaway/metadata.yml`, message `§990: intent_accepted
  recorded (orchestrator)`, with `intent_accepted: <today>` (a bare date) and
  `status: accepted`, CRLF kept, and the row reads accepted. During step 5,
  while the panel says running, the row's session column reads `running`
  (not `not started`); on a permission request it reads `needs you` and moves
  first in the list; after Stop it shows the hook-log state again.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `c4e4463`, `git status --short` clean
before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 64 files,
  1186 tests (matches the reviewer).
- `npm run check:intent`: FAIL only on the owed live check, 6 files, 70
  lines (matches).
- `git merge-tree --write-tree main HEAD` against `main` at `a057c9b` (after
  §60's merge, which also edits `CLAUDE.md`): merges cleanly.
- **M12** (drop `\r?`, `orchestrator-lib.mjs:92`; backed up and restored by
  copy): **survived**, 1186 passed (matches).
- **M7** (status write dropped, `:92`): **killed**, 3 failed: "sets status:
  accepted with intent_accepted on a draft, and only then (§58)", "sets status
  on a CRLF draft and on a draft with a comment, …", and server.test "writes
  on main, in the main checkout, for an intent without a branch" (matches).
- `npm run sdlc:scan -- --sample-due manual --exclude 58`: nth attested
  manual change = 15, every 5, `sampled: yes`.

**Reviewer agent** (same worktree and HEAD, foreground):
- `git range-diff 19cf402..25bc148 main..HEAD`: 10 of 10 `=` (`d8dc5cf`, round
  2's reviewed commit, is now `45153fa`); `git diff --name-only 19cf402 main
  -- tools/ scripts/`: empty; §58's tests use no `vi.*`, mocks, fake timers or
  timeouts, so vitest 5's API changes don't reach them.
- `npm run verify` (64 files, 1186 tests, lint 21), `check:intent` (as above).
- 15 mutants, each with a full `npx vitest run`, restored by copy, `git status
  --short` empty after each: M1, M2, M3, M4, M4b, M5, M6 (`state.mjs:34-36`,
  `:87`) and M7, M8, M9, M10, M11, M13 (`orchestrator-lib.mjs:92`) killed, by
  the tests named in its report; M12 survived (equivalent).
- No remote branch contains `c4e4463`.

**Taken on trust:** round 1's reading of passes 5 and 7 (re-checked against
the diff only); the implementer's failing-first runs; that a real SDK
session's `list()` behaves as the fake beyond what `sdk-sessions.mjs` shows.

# Round 2 (history)
- verdict: attest
- tier: attested
- reviewed-commit: d8dc5cf (rebased since as `45153fa`)
- round: 2
- sampled: no
- run: auto
- live-check: owed

The full round-2 report is in git at `235fdbf` (before the rebase, `5a8435e`).

Resolutions (round 3, checked at `c4e4463`): no round-2 finding needed
rework; the LOW on `orchestrator-lib.mjs:92` (`\r?`) is unchanged.

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 780c7c4
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `5fe2ca2`.

Resolutions (round 2, checked at `d8dc5cf`):
- **MEDIUM, M12 (the regex's `\r?` untested): withdrawn, the premise was
  wrong.** A JavaScript multiline `$` matches before `\r`, so the regex without
  `\r?` still matches `status: draft\r\n…`; the mutant is equivalent. The CRLF
  case (`b492a6e`) stays as a regression guard; the redundancy is round 2's
  LOW.
- **LOW, M11 and M13: fixed** in `b492a6e`: `status: draft    # x` →
  `status: accepted` kills M13; `status: in-review    # was draft` unchanged
  kills M11.
