---
name: spawn
description: Start a parallel heraklios session for an intent — a worktree on the intent's branch in ../heraklios-wt/, its own node_modules, a reserved dev port and a CLAUDE.local.md brief — or take one down after merge. Use from the main checkout when the owner wants to work on an intent alongside others. Invoke as /spawn <id> [--base <ref>], or /spawn <id> --remove.
metadata:
  owner: evarnild
  version: 0.1.1
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /spawn — one intent, one worktree, one session

You are the **coordinator** (the main checkout). This skill wraps
`npm run spawn`; the rules it serves are in `CLAUDE.md` → "Parallel sessions".

## Spawning

1. **Check you are the coordinator.** `git rev-parse --show-toplevel` must be
   the first entry of `git worktree list`. If not, stop and say so.
2. **Find the intent.** `intents/<id>-*/metadata.yml` must exist here. If the
   owner names work that has no intent yet, run `/intent` first and stop.
   Spawning doesn't require gates, because a session can draft the missing
   spec or plan. But say which gates are still empty, because the session
   may not write code before them.
3. **Check the load.** Run `npm run sessions`. If three or more intent
   sessions are already open (anything not `closed`), say so and ask
   before adding a fourth. Merges are serial and the owner reviews each
   one, so more sessions mostly add waiting.
4. **Spawn.** `npm run spawn -- <id>` (add `--base <ref>` only when the intent
   depends on an unmerged branch, and say so). If the intent folder was
   uncommitted here, the script moves it into the worktree. Tell the owner
   that.
5. **Update the queue.** In `plan.md` → Current Queue, move the intent's row
   to **In flight** if it isn't there.
6. **Hand over.** Report the worktree path, branch, port and gates, and how
   to start the session: `cd "<path>" && claude`, or open the folder in the
   Claude Code desktop app. Don't start the session yourself.

## Removing (`--remove`)

Only after the owner has merged the branch.

1. `npm run spawn -- <id> --remove`. The script refuses when the branch isn't
   merged into `main`, when the worktree has uncommitted files, or when its
   `node_modules` is a link (`plan.md` §4). Report the refusal as it is. Don't
   reach for `--unmerged` or `--force` unless the owner asks.
2. Mention the `git branch -d <branch>` the script prints. Deleting the
   branch is the owner's call.
3. Move the row in `plan.md` to Shipped with the merge commit, per §26's
   queue rules.
