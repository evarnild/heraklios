<!-- generated-by: heraklios/review@0.1.5 -->
# §58 review — The orchestrator's intent row shows a running session, and accepting an intent sets its status

verdict: rework
tier: attested
reviewed-commit: 780c7c4
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table: `tools/**` like `scripts/**`;
`CLAUDE.md` is not in the table, and the `README.md` / `intents/README.md`
wording changes no rule. `review_tier` is empty; the type is fix.

**Verdict:** `rework`. Both outcomes work and gate safety is unchanged, but
three parts of the new draft-status regex are untested. One matters on this
machine: `metadata.yml` files are CRLF on disk here (`core.autocrlf=true`),
and dropping the regex's `\r?` brings back the exact bug §58 fixes, with every
test green. All mechanical. Passes run by the `heraklios-reviewer` agent; the
coordinator re-ran verify, check:intent and the three survivors (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the plan's two code commits landed as one, recorded in Progress; no unplanned scope |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: no game rule (`tools/orchestrator/` only) |
| 4 | Tests prove the rule, not only pass | findings (2): three survivors, all in the `gateWrite` draft regex |
| 5 | Boundary and conventions | pass: the overlay reads only the in-memory manager (§52 B12); `writeGate` unchanged (bare date, one file, pathspec `git add/commit -- <rel>`, `gateAllowed` inside `exclusive`, restore and `git reset` on failure) |
| 6 | Numbers in prose | pass: 61 files, 1155 tests, lint 21 reproduce; the intent's and plan's line citations match the merge-base |
| 7 | Documentation | pass: `README.md`, `intents/README.md`, `CLAUDE.md` describe both behaviours; no agent permission widened (the status write is part of the owner's click; "an agent never presses it" unchanged) |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no new dependency; no `innerHTML` change |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 58, fix)
  note:  6 file(s), 62 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `tools/orchestrator/orchestrator-lib.mjs:92`: the regex's `\r?` is
  untested (M12 survives). With `core.autocrlf=true`, `metadata.yml` files in
  the main checkout are CRLF on disk (e.g.
  `intents/29-grid-live-check-counts/metadata.yml`), so CRLF is the real path a
  gate click takes there. Without `\r?`, `status: draft\r` fails to match and
  the status stays `draft`, the bug this fix exists for; every §58 test uses
  LF text. Needs rework: in the §58 `gateWrite` test
  (`orchestrator-lib.test.mjs:201`), a CRLF draft case expecting `status:
  accepted\r\n`, copying the "keeps CRLF endings" test's
  `text.replace(/\n/g, '\r\n')`. Must kill M12.
- **LOW** `tools/orchestrator/orchestrator-lib.mjs:92`: two more parts of the
  regex are unproven: replacing the anchored pattern with a loose
  `/status:.*draft/m` (M11) and dropping the `(#.*)?` comment group (M13) both
  survive, so no test covers a draft line with a comment or a non-draft status
  whose line mentions "draft". Needs rework: `status: draft    # x` with
  `intent_accepted` → `status: accepted` (kills M13); `status: in-review    #
  was draft` with `intent_accepted` keeps its line (kills M11).

## Not checked
- **The page in a real browser:** the row showing `running` / `needs you` /
  the hook-log state as a real SDK session starts, waits and stops, and a real
  gate click committing on a real (CRLF) checkout. Rule 3. The orchestrator
  and SDK sessions were not started.
- **The real `sdk-sessions.mjs` manager feeding `liveSession`:** the tests use
  a fake `list()`; `sdk-sessions.mjs:17` and `:203` were read to confirm the
  state names and the `intent` field.
- **The page's worktrees table** (`public/app.js:154`) still shows the hook
  log's `w.session.state`, not the overlay: read as intended (the outcome is
  about the intent row), but no test pins either way.
- **A quoted status** (`status: "draft"`) doesn't match the regex; no current
  file uses quotes; not tested.
- **Mutants ran against `npx vitest run tools/orchestrator scripts`** (384
  tests) in the reviewer's runs; the full suite in the coordinator's.

## Live check
- **Owed** by rule 3 (the page in a browser: the row state from a live SDK
  session; a gate click on a real checkout). Run it on the commit that
  resolves the findings.
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
     repo instead.)
  2. In the clone, commit on its `main`: a draft intent `intents/990-throwaway/`
     (`status: draft`, empty `intent_accepted:`), its `metadata.yml` in CRLF as
     a normal checkout writes it; and an accepted intent with a plan approved,
     then `npm run spawn -- <id>` for it.
  3. `npm run orchestrator` in the clone; open the printed 127.0.0.1 URL.
  4. Click "Record intent_accepted" on §990 and confirm.
  5. Click Implementer (or Auto) on the spawned intent, watch its row, then
     Stop it in its session panel.
- **You should see:**
  - after step 4: `git show --stat HEAD` lists one file,
    `intents/990-throwaway/metadata.yml`, message `§990: intent_accepted
    recorded (orchestrator)`; the file has `intent_accepted: <today>` (bare
    date) and `status: accepted`, CRLF kept; the row reads accepted;
  - during step 5: the row's session column reads `running` while the panel
    says running (not `not started`); on a permission request it reads `needs
    you` and moves to the top; after Stop it falls back to the hook-log state,
    not `running`.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `780c7c4`, clean before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 61 files,
  1155 tests (matches).
- `npm run check:intent`: PASS, 6 files, 62 lines (matches).
- The three survivors, one at a time, backed up and restored by copy, each
  checked as applied, with the full `vitest run`: M11 (loose
  `/status:.*draft/m`), M12 (no `\r?`), M13 (no comment group): **survived**,
  1155 passed each (matches).

**Reviewer agent** (same worktree and HEAD, foreground):
- Orientation: HEAD `780c7c4`, merge-base `19cf402`, nothing merged or pushed.
- `npm run verify` and `check:intent` as above;
  `npm run sdlc:scan -- --sample-due auto --exclude 58`: nth attested auto
  change = 4, every 3, `sampled: no` (rework in any case).
- The full diff read, plus `writeGate` (`actions.mjs:73-96`, unchanged),
  `setKeys` (`scripts/ship-lib.mjs:126`), `nextStep`'s use of `session`, and
  the page's readers of `intent.session`.
- **Mutants** (`npx vitest run tools/orchestrator scripts`, restored by copy,
  tree clean after each): killed M1 (`running` overlay dropped), M2
  (precedence flipped), M3 (`needs you` line removed), M4 (any state counts),
  M4b (the session's own state echoed), M5 (intent id ignored), M6 (hook log
  first), M7 (status write dropped), M8 (draft condition dropped), M9 (gate
  condition dropped), M10 (fires for `spec_accepted`); survived M11, M12, M13.
  Three early attempts matched no needle (shell escaping) and were re-run.
- The two changed expectations are legitimate: the gate-route test's `status:
  'draft'` asserted the old behaviour (Outcome 2); the §52 overlay test's
  `working` came from the hook log while the fake manager listed `running`
  (Outcome 1); its `needs you` assertions are intact.

**Taken on trust:** the implementer's failing-first runs in Progress (M1 and
M7 stand in for the same check); that the real manager's `list()` gives
`intent` as the id string (read, not run).

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut58/`
(reviewer) and `…/scratchpad/coord58/` (coordinator).

Mutants a rework is expected to kill: M12, M11, M13 (M1-M10 stay killed).
