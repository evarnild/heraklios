<!-- generated-by: heraklios/review@0.1.5 -->
# §58 review — The orchestrator's intent row shows a running session, and accepting an intent sets its status

verdict: attest
tier: attested
reviewed-commit: d8dc5cf
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table (`tools/**` like `scripts/**`).
`review_tier` is empty, the type is fix, and nothing raises it.

**Verdict:** `attest`. Round 2 adds one `gateWrite` test (`b492a6e`) and a
Progress entry (`69692e0`), no source change. The new test kills M11 and M13.
M12 (dropping `\r?`) still survives, and no test could kill it: with the `m`
flag a JavaScript `$` already matches before `\r` (CR is a line terminator),
so `\r?` before `$` is redundant and round 1's MEDIUM premise ("without `\r?`,
`status: draft\r` fails to match") was wrong. The CRLF case still earns its
place as a regression guard: it fails if the regex ever demands `\n` straight
after the value. Passes run by a `heraklios-reviewer` agent (a fresh one: the
round-1 reviewer stalled twice); the coordinator re-ran verify, check:intent
and the three regex mutants (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: since `780c7c4`, one test, a Progress entry, `auto_round: 2` and round 1's `review.md`; no source change |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: no game rule (`tools/orchestrator/` only) |
| 4 | Tests prove the rule, not only pass | pass: M11, M13 killed; M12 equivalent (below); spot checks M1, M7 still killed |
| 5 | Boundary and conventions | pass: unchanged since round 1 |
| 6 | Numbers in prose | pass: Progress's 61 files, 1156 tests, lint 21 reproduce; its M12 claim reproduces |
| 7 | Documentation | pass: unchanged since round 1 |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no new dependency |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 58, fix)
  error: A live check is owed and not recorded. Do the steps in intents/58-orchestrator-row-state/review.md → ## Live check, then set live_checked: <date> in intents/58-orchestrator-row-state/metadata.yml.
  note:  6 file(s), 70 line(s) changed outside intents/.
```
The only error is the owed live check (round 1 set `live-check: owed`); yours
to clear, not rework.

## Findings
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:92`: the `\r?` before `$` in
  `/^status:[ \t]*draft[ \t]*(#.*)?\r?$/m` is redundant: a multiline `$`
  already matches before `\r`, and `.` in `(#.*)` stops before `\r`. Both
  forms give the same result on `'status: draft\r\nx'`, `'status: draft  #
  y\r\nx'`, `'status: draft\rx'`, `'status: draft\r'`, `'status:
  draft\r\r\n'` (true) and `'status: drafty\r\n'` (false). Keeping it leaves a
  permanent survivor and suggests CRLF needs special handling. Worth a look:
  drop it, or a short comment that it's redundant and kept for readers.

## Not checked
- **The page in a real browser:** the row showing `running` / `needs you` /
  the hook-log state as a real SDK session starts, waits and stops, and a real
  gate click on a real (CRLF) checkout. Rule 3. The orchestrator and SDK
  sessions were not started.
- **The real `sdk-sessions.mjs` manager feeding `liveSession`:** the tests use
  a fake `list()`; round 1 read the code.
- **The page's worktrees table** (`public/app.js:154`) still shows the hook
  log's `w.session.state`, not the overlay; judged intended in round 1, pinned
  by no test.
- **A quoted status** (`status: "draft"`) doesn't match; no file uses quotes.
- **Mutants ran against `npx vitest run tools/orchestrator scripts`** (385
  tests) in the reviewer's runs, the full suite in the coordinator's; round 1's
  M2-M6, M8-M10 not re-run (no source change).

## Live check
- **Owed** by rule 3: the row state from a live SDK session, and a gate click
  on a real CRLF checkout. Run it at `d8dc5cf` or a later commit that changes
  only `review.md` / `metadata.yml`.
- **Steps:**
  1. A disposable clone whose `main` is this branch:
     ```
     git clone C:/Users/eric/src/heraklios C:/Users/eric/scratch/h58
     cd C:/Users/eric/scratch/h58
     git remote set-url --push origin DISABLED
     git fetch origin fix/58-orchestrator-row-state
     git checkout -B main FETCH_HEAD
     npm ci
     ```
     Never ship, push or merge from it. (If `fetch origin` can't see the local
     branch, clone with `--branch fix/58-orchestrator-row-state` from the local
     repo.)
  2. In the clone, commit on its `main`: a draft intent `intents/990-throwaway/`
     (`status: draft`, empty `intent_accepted:`), its `metadata.yml` in CRLF as
     a normal checkout writes it; and an accepted intent with its plan
     approved, then `npm run spawn -- <id>` for it.
  3. `npm run orchestrator` in the clone; open the printed 127.0.0.1 URL.
  4. Click "Record intent_accepted" on §990 and confirm.
  5. Click Implementer (or Auto) on the spawned intent, watch its row, then
     Stop it from its session panel.
- **You should see:** after step 4, `git show --stat HEAD` lists one file,
  `intents/990-throwaway/metadata.yml`, message `§990: intent_accepted recorded
  (orchestrator)`, with `intent_accepted: <today>` (bare date) and `status:
  accepted`, CRLF kept, and the row reads accepted; during step 5, the row's
  session column reads `running` while the panel says running (not `not
  started`), `needs you` and first in the list on a permission request, and the
  hook-log state after Stop, not `running`.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `d8dc5cf`, clean before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 61 files,
  1156 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 6 files, 70 lines
  (matches).
- Mutants, one at a time, backed up and restored by copy, each checked as
  applied, with the full `vitest run`: M11 (`/status:.*draft/m`) **killed**, 1
  failed, "gateWrite (spec B8) > sets status on a CRLF draft and on a draft
  with a comment, …"; M12 (no `\r?`) **survived**, 1156 passed (equivalent);
  M13 (no comment group) **killed**, the same test (matches).
- The M12 premise: `node -e "console.log(/^a$/m.test('a\r\nb'))"` → `true`,
  and the regex without `\r?` matches `'id: 1\r\nstatus: draft\r\ntitle:
  x\r\n'` → `true`.

**Reviewer agent** (same worktree and HEAD; nothing checked out):
- `git diff 780c7c4..HEAD`: `metadata.yml` (`auto_round` 1→2), `plan.md`
  (Progress), `review.md` (round 1) and the new test at
  `orchestrator-lib.test.mjs:210-217`.
- `npm run verify` (61 files, 1156 tests, lint 21), `check:intent` as above;
  `npm run sdlc:scan -- --sample-due auto --exclude 58`: nth attested auto
  change = 4, every 3, `sampled: no`.
- M12 equivalent by the six-input comparison above; `/^status:[
  \t]*draft[ \t]*(#.*)?\n/m.test('status: draft\r\nx')` is false, so the CRLF
  test would catch a stricter regex.
- Mutants with needles built from `String.fromCharCode(92)`, `npx vitest run
  tools/orchestrator scripts`, restored by copy, tree clean after each: M11
  killed (1 failed, 384 passed), M12 survived (385 passed), M13 killed; spot
  checks M1 (`liveSession`'s `running` return → null: 2 server tests fail) and
  M7 (the status write dropped: 3 tests fail) killed.

**Taken on trust:** round 1's passes 5 and 7 and its kills of M2-M6, M8-M10
(no source change since); the implementer's failing-first runs in Progress;
that the real manager's `list()` gives `intent` as the id string.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut58b/`
(reviewer) and `…/scratchpad/coord58/` (coordinator).

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
