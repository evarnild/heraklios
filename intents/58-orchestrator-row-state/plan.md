<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §58 plan — The orchestrator's intent row shows a running session, and accepting an intent sets its status

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Two fixes in `tools/orchestrator/` (intent Outcome): the intent row shows a
live orchestrator session (`running`, with `needs you` still winning) over the
hook log; and recording `intent_accepted` from the page on a `draft` intent
also writes `status: accepted`, in the same one-file commit.

## Risks

- **The failing-first tests.** Write the two tests first and see them fail on
  the current code, then fix. Record both failures in Progress.
- **An existing test pins the bug.** `tools/orchestrator/server.test.mjs:261-262`
  expects the committed file to keep `status: 'draft'` after
  `/api/gate/29/intent_accepted`. It changes to `status: 'accepted'`; say so in
  Progress (it asserted the old behaviour, not a rule).
- **Which states count.** Only the manager's live states
  (`LIVE_STATES = running, needs you`, `sdk-sessions.mjs:17`) override the hook
  log; `stopped`, `done` and `error` never do, and several sessions on one
  intent resolve as `needs you` > `running`. Tests for each.
- **Status only for that gate, only from draft.** `intent_accepted` on a
  `draft` → `accepted`; any other status (already `accepted`, `in-review`, …)
  is left alone, and no other gate touches `status`. Tests for both sides.
- **Gate safety unchanged** (intent Constraints): still a bare date, one file,
  the pathspec commit, `gateAllowed` inside the lock, the restore on a git
  failure (§52's tests and mutants must stay green).
- **Lint cap 21**; tools files are linted too.
- **Stale line citations:** re-check before relying on them.

## Verified against the codebase

Re-read on `main` at `9b7c4d1`.

- `tools/orchestrator/state.mjs:28-32` — `waitingSession(sessions, id)`:
  returns `'needs you'` only; `:82` — `const session = waitingSession(...) ??
  wt?.session?.state ?? null`, also used for `worktree.session` (`:83`).
- `tools/orchestrator/sdk-sessions.mjs:17` — `LIVE_STATES`; `:203` —
  `list: () => [...sessions.values()].map(summary)` (each with `intent` and
  `state`); state names `running`, `needs you`, `done`, `error`, `stopped`.
- `tools/orchestrator/orchestrator-lib.mjs:87-91` — `gateWrite(text, gate,
  date)` → `setKeys(text, { [gate]: date })`.
- `tools/orchestrator/actions.mjs:73-96` — `writeGate`: reads, checks
  `gateAllowed`, writes `gateWrite(...)` at `:89`, `git add` / `git commit --
  <rel>`, restores on failure.
- `tools/orchestrator/server.test.mjs:220` — the §52 F2 overlay test
  (`needs you`); `:261-262` — the gate write expecting `status: 'draft'`.
- `scripts/session-lib.mjs:81-82` — the hook log's `spawned` → `not started`.

## Subtasks

1. **The row state** (Outcome 1). Failing-first test in `server.test.mjs`: a
   fake manager reporting a `running` session for an intent whose hook state
   is `not started` → `/api/state` gives `session: "running"` (and
   `worktree.session`). Then generalise `waitingSession` into e.g.
   `liveSession(sessions, id)`: `needs you` if any live session of that intent
   waits, else `running` if one runs, else null. Tests: `stopped`/`done`/`error`
   don't override; `needs you` beats `running`; another intent's session
   doesn't leak; the §52 `needs you` test unchanged. Commit.
2. **The status on accept** (Outcome 2). Failing-first: the gate route test
   for `intent_accepted` on a `draft` expects the written file to contain
   `status: accepted`. Then: `gateWrite` (or `writeGate`) also sets `status:
   accepted` when the gate is `intent_accepted` and the current status is
   `draft`. Unit tests on `gateWrite` (draft → accepted; accepted stays;
   another gate leaves status). Update `:261-262` as in Risks. The commit
   message the route writes stays `§<id>: intent_accepted recorded
   (orchestrator)`. Commit.
3. **Docs.** If `CLAUDE.md`'s orchestrator paragraph or `intents/README.md`
   says what a gate click writes, add "and, for `intent_accepted` on a draft,
   `status: accepted`". Commit, then the Progress entry and `status:
   in-review`.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| `running` not overlaid | subtask 1's failing-first test |
| a dead state (`stopped`, `done`, `error`) overlaid | the dead-state tests |
| `running` beating `needs you` | the precedence test |
| intent id ignored | the other-intent test |
| status not written on accept | subtask 2's failing-first test |
| status written from a non-draft, or for another gate | the gateWrite unit tests |

## Validation

- `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS.
- No e2e: no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.
- **Live check (likely owed by rule 3: the page in a browser):** in a
  disposable clone whose `main` is this branch (as §52's), `npm run
  orchestrator`; launch Auto or Implementer on a spawned throwaway intent and
  watch its row show `running`, then `stopped` after Stop; click "Record
  intent_accepted" on a throwaway draft and read its `metadata.yml`: the date
  and `status: accepted`, one file in the commit.

## Assumptions I made

- The function name `liveSession`; the overlay stays in `state.mjs`.
- Status is written by the same `setKeys` call as the gate, so it lands in
  the same file write and commit.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-25 — subtasks 1-3 (implementer)

Commits: `95f8d60` (row overlay + status on accept, with tests), `a426b78`
(docs: README.md, intents/README.md, CLAUDE.md). Divergence: subtasks 1 and 2
went in one code commit, not two (their tests share two files); verify ran
green on the combined tree before it.

Failing-first, run on the unchanged code:
- `server.test.mjs` "shows a running manager session over the hook log, and
  only live states count": `expected [ 'not started', 'not started' ] to
  deeply equal [ 'running', 'running' ]`.
- `server.test.mjs` "writes on main ... for an intent without a branch"
  (now expecting `status: accepted`): the written file still had `status: draft`.
- `orchestrator-lib.test.mjs` "sets status: accepted with intent_accepted on
  a draft, and only then": `expected false to be true`.

Shipped: `state.mjs` `liveSession` (replaces `waitingSession`): `needs you`
if a live session of that intent waits, else `running`, else the hook log;
`stopped`/`done`/`error` and other intents' sessions never count.
`gateWrite` also sets `status: accepted` for `intent_accepted` when the
status line is `draft`; same `setKeys` call, so one file, one commit.

Tests changed: `server.test.mjs` gate route (was `status: 'draft'`, asserted
the old behaviour) now `'accepted'`; the §52 overlay test expected intent 52
`working` while the manager listed it `running`, now `running` (new rule);
its `needs you` assertions unchanged. Added: dead-state, precedence and
other-intent cases, and four `gateWrite` cases (draft, other gate, in-review,
already accepted).

Counts: `npm run verify` green: 61 files, 1155 tests; lint 21 warnings (cap
21, unchanged). No e2e (no src/ or e2e/ change). Live check still owed per
the plan; §57's own `status: draft` not touched.
