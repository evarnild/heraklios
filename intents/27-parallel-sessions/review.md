<!-- generated-by: heraklios/review@0.1.1 -->
# §27 review — Parallel sessions: spawn worktrees, session event log, coordinator view

verdict: rework
tier: reviewed
reviewed-commit: 35d67fb
round: 2
sampled: no

Tier: **path table** → Reviewed (`.claude/skills/spawn/**`, `.claude/skills/sessions/**`, and from this round `.claude/settings.json`); `metadata.yml` agrees.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — nothing under `src/` |
| 4 | Tests prove the rule, not only pass | findings (2) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | findings (1) |
| 9 | Repository-specific footguns | findings (1) |

## Type check
```
type-check: PASS (intent 27, refactor)
  note:  15 file(s), 1202 line(s) changed outside intents/.
```

## Round 1 findings — status
All 11 **resolved** and re-probed: events go to `CLAUDE_PROJECT_DIR`'s log (foreign repo untouched); 13 old `session-lib` survivors killed; spawn/remove tested end to end; permission vs idle notifications map correctly; immediate re-spawn says "already has a worktree", re-spawn after `--remove --unmerged` reads the intent from its branch; a secret in a prompt logs as `"promptChars":26` only; `.claude/settings.json` in the Reviewed row; no root `plan.md` change; README "spawned session" bullet; Validation line fixed; brief ignored via `info/exclude` on an old base, not duplicated.

## Findings
- **MEDIUM** `scripts/spawn-intent.test.mjs` — `GIT_ENV` inherits `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE` / `GIT_COMMON_DIR`; run from a git hook or `rebase -x`, the "sandbox" commits into the inherited repo (reproduced against a scratch clone). Needs rework: strip `GIT_*`.
- **MEDIUM** `scripts/spawn-intent.mjs` `worktreeFor` — the id and not-main-checkout filters survive mutation; nothing proves `--remove 98` spares another intent's worktree. Needs rework: a second spawned intent in the test.
- **MEDIUM** `scripts/spawn-intent.mjs` `carryIntentFolder` — the "already tracked" and "untracked here and on the branch" guards survive. Worth a look: a test each.
- **MEDIUM** `scripts/session-lib.mjs` — latest event wins, so an idle notification after an unanswered permission prompt would hide it. Worth a look: matcher in settings.json, or don't let idle replace needs-you without an intervening prompt/stop.
- **LOW** `session-lib.mjs` — 5 minor survivors (`!e.kind &&` guard, `/i`, `typeof prompt`, `typeof cwd`, `typeof v` likely equivalent). Worth a look.
- **LOW** `session-io.mjs` `readIntentMetadataFromBranch` — takes the first branch carrying the id; ambiguous with two. Worth a look: fail naming both.

## Not checked
- Hooks firing from a real interactive session (`notification_type` values and ordering, incl. idle after a pending permission prompt).
- Sessions started from `C:/Users/eric/src`: whether nested hooks load; with `CLAUDE_PROJECT_DIR` preferred, such events would be dropped silently.
- Hook commands under a non-bash Windows shell.
- A real `npm ci` in a spawned worktree.
- The test file on Linux/macOS (`'dir'` symlink branch).
- Running the suite inside a real git hook (simulated with `GIT_DIR`).

## Verified myself vs. taken on trust
- `npm run verify` exit 0 — lint 0/21, 34 files / 579 tests (spawn e2e 9 tests in 3.2 s).
- `check:intent` PASS; `npm run sessions` lists §27 `in-review`, `+4/-0`, "Ready for /review: §27".
- `git diff 737bf4e 35d67fb` read in full; real repo's event log still absent, `info/exclude` unchanged.
- Hook, spawn and remove probes in a throwaway clone as listed under Round 1 status.
- Mutants: `session-lib.mjs` 62 (57 killed, 5 survived); `spawn-intent.mjs` 24 (14 killed, 10 survived, 2 equivalent). Files restored and checked with `cmp`.
- Cleanup: clone, worktrees, scratch repos and backups deleted; worktree clean; stash untouched.
- Taken on trust: Claude Code's `notification_type` values and `CLAUDE_PROJECT_DIR` for hooks.

---

# Round 1 (history)


- verdict: rework
- tier: reviewed
- reviewed-commit: 737bf4e
- round: 1
- sampled: no

Tier: **path table** → Reviewed (`.claude/skills/spawn/**`, `.claude/skills/sessions/**`); `metadata.yml` `review_tier: reviewed` agrees. Note `.claude/settings.json` is not in the path table at all (LOW below).

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule behaviour, nothing under `src/` |
| 4 | Tests prove the rule, not only pass | findings (2) |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | findings (1) |
| 7 | Documentation | findings (2) |
| 8 | Guardrails and hygiene | findings (1) |
| 9 | Repository-specific footguns | findings (2) |

### Type check
```
type-check: PASS (intent 27, refactor)
  note:  14 file(s), 866 line(s) changed outside intents/.
```

### Findings
- **MEDIUM** `scripts/session-event.mjs:32` — events are keyed by `input.cwd || process.cwd()`, the session's *current* directory, not its project. Reproduced: a payload with `cwd` in an unrelated repo wrote into that repo's `.git`. A coordinator that `cd`s into `../heraklios-wt/28-…` would log under §28 and mask its real state. Needs rework: prefer `process.env.CLAUDE_PROJECT_DIR`.
- **MEDIUM** `scripts/session-lib.test.mjs` — 13 of 59 `session-lib.mjs` mutants survive: L72 `e.event && e.worktree` filter (an event without `worktree` would crash `pathKey`); L106 `Math.max(0,…)`; L107/L108 60 s / 3600 s boundaries; L123 `'null'`; L132 unknown-state rank; L134 id tie-break; L145 `(detached)`; L157 "needs you only" filter; L176 `.trim()`; L177 clip `>`→`>=`; L191/L194/L204 brief content (including `status: in-review`, which "Ready for /review" keys on). L69 equivalent. Needs rework.
- **MEDIUM** `scripts/spawn-intent.mjs`, `session-event.mjs`, `session-io.mjs`, `sessions.mjs` — no automated tests, including `carryIntentFolder` (moves uncommitted files) and the `--remove` refusals. Worked in a throwaway clone, but the riskiest code can regress silently. Worth a look: a temp-git-repo vitest test for spawn `--no-install` / `--remove`.
- **MEDIUM** `.claude/settings.json` + `scripts/session-lib.mjs:86` — every `Notification` maps to `needs you`, but Claude Code also fires it for the 60-second idle prompt and auth notices, so idle sessions would show as `needs you` within a minute of every `Stop`. Inferred from hook semantics, not observed live. Worth a look: log `notification_type`; map `idle_prompt` to `idle` or add a Notification matcher.
- **LOW** `scripts/spawn-intent.mjs:68-74` — after spawn moves an uncommitted intent folder, re-spawning says "Draft it with /intent first" (invites a duplicate intent); the path-exists check runs after that lookup. Worth a look.
- **LOW** `scripts/session-event.mjs:23` — the first 80 characters of every prompt are logged (a pasted fake key was stored in full) and `npm run sessions -- --log` prints them. Local to `.git`, but undocumented. Worth a look: document it or log only the length.
- **LOW** `REVIEW-POLICY.md` path table — `.claude/settings.json` (hooks that run on every session) is not listed. Worth a look: add it to the Reviewed row.
- **LOW** root `plan.md:207` — this branch edits the queue row, which the new "only the coordinator edits plan.md" rule forbids. Worth a look: drop it; the coordinator updates the row at merge.
- **LOW** `intents/README.md` "Who edits what" vs the spawn brief and `/spawn` step 2 — README says the implementer may only append Progress and set status; the brief lets a spawned session draft a missing spec/plan. Worth a look.
- **LOW** `intents/27-parallel-sessions/plan.md` Validation — the `--base refactor/26-ai-sdlc-kit` instruction is stale since the rebase. Worth a look.
- **LOW** `scripts/spawn-intent.mjs:77` — a worktree based on a ref older than §27 lacks the `CLAUDE.local.md` ignore, so the brief shows untracked and blocks `--remove`. Worth a look: also write it to `info/exclude`.

### Not checked
- Hooks fired from a real interactive Claude Code session (synthetic payloads only): whether Windows runs the hook commands so that `"$CLAUDE_PROJECT_DIR/…"` expands; real Notification payloads; whether `SessionEnd` fires on terminal close or crash (a killed session shows `working` forever).
- Sessions started from the parent directory (`C:\Users\eric\src`): whether the repo's hooks load there and resolve.
- `node` missing from PATH (reasoned: exit 127, non-blocking; no path returns exit 2).
- A real `npm ci` in a spawned worktree (only `--no-install`).
- Log growth (no rotation; ~250 bytes/event).
- Concurrent appends beyond 40 local appends on NTFS.
- Paths with spaces or non-ASCII; unvalidated `metadata.slug` in the worktree path.
- `--remove` with nested junctions below the worktree root.
- Mutants of the scripts other than `session-lib.mjs`.

### Verified myself vs. taken on trust
- `npm run verify` exit 0 — lint 0/21, vitest 33 files / 560 tests.
- `check:intent` PASS exit 0; `npm run sessions` (read-only) lists main, stable, §27 (`in-review`, port 5227), "Ready for /review: §27"; the real event log does not exist and was never written.
- `git diff --stat main...HEAD`: 17 files, +1056/−2.
- Hook handler in a throwaway clone: realistic payloads logged correctly; garbage, empty, `null`, array, bad cwd and a 20 MB prompt all exit 0 (prompt clipped to 80 chars); ~165–215 ms per event; 40 parallel appends, 0 corrupt; worktree subdirectory with `.git` as a file resolves to the common git dir; a foreign-repo cwd writes into that repo (MEDIUM 1).
- Spawn in the clone: uncommitted §98 moved intact, branch/port/brief/event correct; existing target dir refused untouched; bad `--base` fails cleanly; re-spawn gives the misleading message.
- `--remove` in the clone: dirty refused; junctioned `node_modules` refused with the junction target's sentinel intact; unmerged refused.
- 59 `session-lib.mjs` mutants: 46 killed, 13 survived, 1 equivalent; restored and checked with `cmp`.
- Cleanup: clone and scratch dirs deleted; worktree `git status --short` empty; main worktree list and stash untouched.
- Taken on trust: the Progress note's manual run (`npm ci` 7 s, main `node_modules` intact) and Claude Code hook semantics (cwd field, idle Notification, exit codes).
