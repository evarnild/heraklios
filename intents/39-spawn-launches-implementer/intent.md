<!-- generated-by: heraklios/intent@0.1.2 -->
# §39 — /spawn launches the implementer itself

**Type:** adjustment
**Originator:** me, while running the SDLC — juggling the coordinator session and a second `claude` session in the worktree
**Source:** none (conversation with the coordinator, 2026-10-21)

## Problem

`/spawn` builds the worktree and then stops: step 6 says "Don't start the
session yourself" and tells me to `cd` there and start `claude`. Every
implementation therefore costs a manual hop between two sessions, and I have to
carry the intent, branch and port across by hand. The `heraklios-implementer`
agent already exists and does exactly the work the second session does.

## Outcome

- `/spawn <id>`, when `metadata.yml` already records the gates the intent's
  type needs (for a feature, fix or refactor that includes `plan_approved`),
  ends by launching `heraklios-implementer` in the background through the
  `Agent` tool, working in the spawned worktree
  (`../heraklios-wt/<id>-<slug>`, not `isolation: "worktree"`). The brief
  carries the worktree path, branch, dev port and intent folder.
- When a gate is missing, `/spawn` keeps today's hand-over (report path, branch,
  port, gates; owner starts the session) and says why it did not launch.
- When the implementer finishes, the coordinator reports its result and offers
  `/review`; it does not run it unprompted, record a gate, or merge.
- `CLAUDE.md` → "Parallel sessions" and `sdlc.md` describe the new path, and
  say how a launched implementer shows up (or doesn't) in `npm run sessions`.

## Constraints

- Gates stay the owner's: a subagent never records one and never edits
  `plan.md` (`intents/README.md` → "Who edits what"; implementer agent rule 6).
  Live checks and merges stay with the owner (`CLAUDE.md` → "How work flows").
- The ≈3-concurrent-sessions guideline in `/spawn` step 3 counts launched
  implementers too.
- `--remove` and `npm run spawn` itself are unchanged.
- Hooks (`.claude/settings.json`) run per session, so a subagent has no
  session row of its own in `npm run sessions`. Find out what the coordinator's
  row and the worktree's `status`/dirty/ahead columns show while it runs, and
  document that. Changing the hooks or `scripts/` is out of scope; if the
  visibility is poor, record a follow-up intent instead.

## Type-specific questions

### Adjustment
- **Exactly what changes:** a launch step and a completion step in
  `.claude/skills/spawn/SKILL.md`; the matching sentences in `CLAUDE.md`
  ("Parallel sessions") and `sdlc.md`.
- **Blast radius:** 3 files, expected under 60 lines, no rule code. If the hook
  or `sessions` display needs a change to be usable, that is a separate intent.

## Assumptions I made

- Next id is 39: the highest real intent is §38; `§99` in `plan.md` is the
  probe from §28, not a work item.
- "Plan gate recorded" is the launch condition for feature/fix/refactor; an
  adjustment or experiment needs only `intent_accepted`.
- The implementer is launched with `run_in_background`, and the coordinator
  does not poll — it is notified on completion.
- Type is adjustment because no rule code or script changes; if checking the
  hooks shows `scripts/` must change, re-declare it as a feature.
