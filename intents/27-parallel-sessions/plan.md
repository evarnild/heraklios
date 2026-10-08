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
- `npm run check:intent` → PASS (against `main`, since the rebase onto §26's merge).
- Manual: spawn a throwaway intent, check the worktree, port and brief, start
  a session there and check its events appear in `npm run sessions`, then
  `--remove`.

## Progress

- 2026-10-07 — subtasks 1–7 done on `refactor/27-parallel-sessions`
  (branched from §26, which is not merged yet). The lib tests caught a real
  bug: the first port scheme (5100 + id mod 100) gave §73 Vite's default
  5173, so the range moved to 5200–5299. Manual check passed: realistic hook
  payloads (including a cwd in a subdirectory) reach the log, `npm run
  sessions` shows "needs you" first with its message, a spawn of a
  throwaway §99 (`npm ci` 7 s, intent folder moved, brief written) then
  `--remove` refused while unmerged, refused while dirty, and succeeded once
  clean, with the main tree's `node_modules` intact. Test events were deleted
  from the log afterwards.
- Incident, which is also the case for this intent: I created this branch with
  `git checkout -b` in the main checkout while another session was reviewing
  §26 there. Its edits to `scripts/*check*` landed on a checkout that now
  pointed at §27. Nothing was committed to the wrong branch: §27 was
  committed by explicit paths, the checkout went back to §26 with those
  edits untouched, and this branch was verified in
  `../heraklios-wt/27-parallel-sessions`.
- Not checked: the hooks firing from a real Claude Code session. They only
  run in a session started on a branch that contains `.claude/settings.json`,
  i.e. this worktree, or `main` after merge.
- 2026-10-08 — round-1 review returned `rework` (4 MEDIUM, 7 LOW). Fixed:
  events filed under `CLAUDE_PROJECT_DIR` (a coordinator `cd`'d into a
  worktree no longer impersonates it); prompts logged by length only (owner's
  decision); notification type recorded and the idle reminder mapped to
  `idle`, with a text fallback for versions that send no type — so
  `.claude/settings.json` needed no change; recording logic moved into the
  pure `eventRecordFrom`; gates use check-intent's date rule; spawn detects an
  existing worktree first, finds a carried intent on its branch, and lists the
  brief in `info/exclude`; root `plan.md` edit dropped (coordinator's job).
  Tests: 13 surviving `session-lib` mutants targeted, plus
  `spawn-intent.test.mjs` — end to end in a temp repo: carry, brief ignored,
  re-spawn, unmerged / junction / dirty refusals, remove, re-spawn from
  branch, merged remove, and the hook's project-dir and no-prompt-text rules.
  Writing it caught a real gap: re-spawning right after a spawn still said
  "Draft it with /intent".
- 2026-10-08 — round-2 review: all 11 round-1 findings verified resolved;
  `rework` for 4 MEDIUM + 2 LOW. Fixed: the e2e test strips inherited `GIT_*`
  variables (it could commit into the parent repo from a git hook) and pins
  `core.autocrlf`; a second intent proves `--remove` spares other worktrees;
  both `carryIntentFolder` guards and the two-branch ambiguity (now an error
  naming both) are tested; an idle reminder no longer hides a pending
  prompt — chosen over a settings.json matcher, whose `notification_type`
  matching is unobserved; 5 minor lib survivors targeted.
