# §27 plan — Parallel sessions

Intent: [intent.md](intent.md)

## Goal

Run several intents at once: each in its own worktree and Claude Code
session, all visible from one coordinator session in the main checkout.

## Shape

```
main checkout (coordinator)            ../heraklios-wt/<id>-<slug> (one per intent)
  /intent → intents/<id>-…/              CLAUDE.local.md  ← brief: id, branch, port, rules
  npm run spawn -- <id>  ───────────►    own node_modules (npm ci), own dev port
  npm run sessions  ◄──── reads ────     intents/<id>-…/metadata.yml (status, gates)
        ▲                                       │
        └── .git/heraklios-sessions.jsonl ◄─────┘ hooks: SessionStart, UserPromptSubmit,
            (shared git dir, never committed)        Stop, Notification, SessionEnd
```

State is split by who owns it:
- **Intent status and gates:** `metadata.yml` on the intent's branch, read
  live from that worktree.
- **Git facts:** ahead/behind `main` and uncommitted files, read from git.
- **What the session is doing:** the event log, written by hooks.

## Risks

- A hook that errors, prints or hangs would degrade every session. The
  handler prints nothing, swallows every error and has a 10 s timeout.
- `git worktree remove` on a worktree holding a `node_modules` junction
  wipes the main install (`plan.md` §4). Spawn never junctions; remove
  refuses when it finds a link.
- An untracked intent folder left in the main checkout blocks the merge
  back. Spawn moves it into the worktree.
- Windows path forms (`C:\…` from hooks, `C:/…` from git) are normalised
  before matching.

## Verified against the codebase

- `vitest.config.ts` already includes `scripts/**/*.test.mjs`.
- `eslint.config.js` allows console output in `scripts/**`.
- `intent-check-lib.mjs` exports `parseBranch`, `parseMetadata` and
  `PREFIX_TO_TYPE`, so they are reused rather than duplicated.
- `.claude/settings.json` does not exist yet; `settings.local.json` holds
  only permissions.
- Highest § used: §26.

## Subtasks

1. `scripts/session-lib.mjs` (pure), with tests: port and path scheme,
   `git worktree list --porcelain` parsing, event-log parsing, a
   session-state summary per worktree, the status table, the
   `CLAUDE.local.md` brief.
2. `scripts/session-event.mjs`: the hook handler. Appends one JSON line per
   event to the shared log.
3. `scripts/spawn-intent.mjs` (`npm run spawn -- <id> [--base ref]
   [--no-install]`, `--remove`).
4. `scripts/sessions.mjs` (`npm run sessions [-- --log N]`).
5. `.claude/settings.json` with the five hooks.
6. Skills `/spawn` and `/sessions`.
7. `CLAUDE.md` "Parallel sessions" section; one line in `AGENTS.md`;
   `CLAUDE.local.md` in `.gitignore`; `plan.md` queue row.

## Tests

- `session-lib.test.mjs`: port and path scheme, porcelain parsing (detached,
  bare, prunable), event parsing that skips bad lines, state per event kind,
  path normalisation across `\` and `/` and drive-letter case, brief content.

## Validation

- `npm run verify` green, warning cap unchanged.
- `npm run check:intent -- --base refactor/26-ai-sdlc-kit` → PASS.
- Manual: spawn a throwaway intent, check the worktree, port and brief, start
  a session there and check its events appear in `npm run sessions`, then
  `--remove`.

## Progress
