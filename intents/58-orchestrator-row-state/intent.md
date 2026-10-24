<!-- generated-by: heraklios/intent@0.1.5 -->
# §58 — The orchestrator's intent row shows a running session, and accepting an intent sets its status

**Type:** fix
**Originator:** the owner, using the orchestrator (2026-10-24): "in the list
of intents, 57 is listed as not started but there is a headless session
running for it above"; and, found by the coordinator the same day, intents
accepted from the page keep `status: draft`.
**Source:** none

## Problem

Two places where the orchestrator's dashboard (§52) disagrees with what is
happening.

1. **A running session shows as "not started".** The intent row's session
   column comes from the hook log (`npm run sessions -- --json`) for the
   intent's worktree, and the session manager only overrides it with
   `needs you` (`tools/orchestrator/state.mjs:28-32`, `:82`; added for §52's
   round-1 F2). An `/auto` or reviewer session runs in the **main** checkout,
   so its hook events never land on the intent's row, and an implementer it
   launches is a subagent with no events in the worktree (`CLAUDE.md`, "A
   launched implementer is not a session in `npm run sessions`"). So while
   the page's own Sessions panel shows §57's headless `auto` session
   `running`, the §57 row reads the worktree's `spawned` event, `not started`
   (`scripts/session-lib.mjs:81-82`). Spec B11 says the orchestrator "keeps
   its own list of the processes it started, and shows both".
2. **Accepting from the page leaves `status: draft`.** The gate button writes
   only the gate line (`gateWrite`, `tools/orchestrator/orchestrator-lib.mjs:87-91`,
   `setKeys(text, { [gate]: date })`). §55 (`85561c0`) and §57 (`16cb056`)
   were accepted from the page and kept `status: draft`, so `npm run queue`
   and the page list them as drafts; §55's status was set by hand in
   `88ea9af`, §57's is still `draft` with its plan approved.

## Outcome

- While the session manager holds a live session (`running` or `needs you`)
  for an intent, its row shows that state, whatever the hook log says;
  `needs you` still wins over `running`. Stopped and finished sessions don't
  count, and the hook log is used as today otherwise.
- Recording `intent_accepted` from the page on a `draft` intent also sets
  `status: accepted` in the same one-file commit. No other gate changes the
  status.
- §57's `status: draft` is corrected by its own branch work or by hand; this
  fix doesn't rewrite other intents.

## Constraints

- **No second source of state** (§52 spec B12): the overlay reads the
  in-memory manager, nothing is stored.
- **Gate safety unchanged:** still a bare date under the owner's identity,
  one file, the pathspec commit, `gateAllowed` checked inside the lock.
- Tier: Attested (`tools/**`, as `scripts/**`); tests with the injected
  runner and fake manager, as §52's.
- A live check is likely owed by rule 3 (the page in a browser).

## Type-specific questions

### Fix
- **What broke:** (1) the row says `not started` while the page's own
  session panel says `running`; (2) an intent accepted from the page stays
  `draft`. Expected: the row says `running`; the status says `accepted`.
- **Since when:** §52 (merged `f4820ee`): the overlay covered only
  `needs you` (round-1 F2 asked for that state alone), and the gate write
  never touched the status.
- **Impact:** misleading dashboard and queue; no gate, merge or save is
  wrong.
- **Reproduction:** (1) launch Auto on a spawned intent and watch its row
  while the session runs; (2) click "Record intent_accepted" on a draft and
  read its `metadata.yml`.
- **The test that will fail first:** `tools/orchestrator/server.test.mjs`:
  with a fake manager reporting a `running` session for an intent whose hook
  state is `not started`, `/api/state` gives that intent `session:
  "running"`; and the gate-route test for `intent_accepted` on a draft
  expects the committed file to contain `status: accepted`.

## Assumptions I made

- One fix for both, since both are dashboard state from §52 and touch the
  same two files' neighbours.
- `follows_up: 52`: both come from §52's change.
- Writing `status: accepted` with `intent_accepted` matches what the
  coordinator does on a "yes" (`intents/README.md`, "Who edits what").
