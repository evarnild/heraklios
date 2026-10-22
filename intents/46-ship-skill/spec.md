<!-- generated-by: heraklios/spec@0.1.0 -->
# §46 spec — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

Accepted intent: [intent.md](intent.md)

Written against `main` at `7b17fcc`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `REVIEW-POLICY.md` → "Merging" | "An agent merges into `main`, pushes, deletes a branch or removes a worktree **only when the owner explicitly asks for that action in the current conversation**"; the three preconditions; "Then it merges with `--no-ff`, runs `npm run verify` on `main`, and does the bookkeeping: `merged:` and `status: done` in `metadata.yml`, the `plan.md` row to Shipped." |
| `REVIEW-POLICY.md` → "Merging", second paragraph | "Before the merge check, `review.md` and any `live_checked:` date are **committed to the branch**" |
| `intents/README.md` → "Who edits what" | an agent records a gate "only on the owner's request in the current conversation, with `by-agent`" |
| `scripts/spawn-intent.mjs:121-137` `remove()` | refuses an unmerged branch or a junctioned `node_modules`; `git worktree remove`; logs `removed`; prints "Branch … is kept; delete it with: git branch -d …" |
| `scripts/intent-check-lib.mjs:45` `parseMetadata`, `:89` `GATE_FIELDS`, `:101` `parseGate`, `:219-226` `parseReviewHeader` | reading `metadata.yml` and the current round's `review.md` header |
| `scripts/session-lib.mjs:21` `branchFor`, `:28` `worktreePathFor`, `:47` `parseWorktreeList`; `scripts/session-io.mjs` `appendEvent`, `mainCheckout` | finding the branch and worktree; the session event log |
| `plan.md` → `### Shipped` table (`\| Item \| Merge \|`), `### In flight`, `### Queued` (`\| Item \| Type · status \|`) | where the row moves from and to |
| `package.json` scripts (`check:intent`, `spawn`, `verify`) | the commands the steps run |

## Behaviour

**B1 — A script does the work; the skill drives it.** The steps are code:
`scripts/ship.mjs` (`npm run ship -- <id> [options]`), with its decisions
in a pure, tested `scripts/ship-lib.mjs`. The skill
`.claude/skills/ship/SKILL.md` (version 0.1.0) is the owner's interface: it
runs the script, passes the options B3 allows, and relays the result. The
order and the checks are then tested code, not instructions.

**B2 — Invocation is the request.** `/ship <id>` is the owner's explicit
request, for intent §id only, in the current conversation, to: record the
live check (only per B3), merge, push, and remove the worktree and branch
(`REVIEW-POLICY.md` → "Merging"). The skill never runs without being
invoked, never for an id the owner didn't name, and the script refuses to
run without an id.

**B3 — The live check, on the owner's word only.** The script takes
`--live-checked "<the owner's words>"`. The skill passes it only when the
owner's message invoking `/ship` says they ran the live check (e.g. "live
checked, /ship 44"), quoting their words; never from the skill's own
reading of the state. With the flag, step 1 (B5) records it; without it, a
live check that is owed and not recorded stops the run at precondition 3.

**B4 — Where it runs.** From the main checkout (`mainCheckout`), on branch
`main`. It stops before doing anything if:
- the current branch isn't `main`;
- `plan.md` or the intent's `metadata.yml` on `main` has uncommitted
  changes (another session's work: the owner decides, the script never
  commits it as its own); other dirty files are left alone and never
  staged;
- the intent's branch (`branchFor`) doesn't exist.

**B5 — The steps, in order, stopping at the first failure and naming it.**
1. **Record the live check** (only with `--live-checked`): in the intent's
   worktree, set `live_checked: <today> by-agent    # owner: "<words>"` in
   `metadata.yml` and commit it on the branch. Skipped if already
   recorded; stops if the branch has no worktree to commit in.
2. **Preconditions** (`REVIEW-POLICY.md` → "Merging", 1–3), read from git,
   never from files on disk: the committed `review.md`'s verdict is
   `attest` or `escalate`; its `reviewed-commit` is an ancestor of the
   branch; only that intent's `review.md` and `metadata.yml` differ
   between them; `npm run check:intent <branch>` reports PASS, or ROUTE
   with the reason stated in `review.md`.
3. **Merge**: `git merge --no-ff <branch> -F <message-file>` (the message
   is written to a temporary file, never piped: the §35 slip). Message:
   `Merge §<id>: <title>` then the trailer lines B9 gives.
4. **Verify**: `npm run verify` on `main`. If it fails, the run stops
   **after** the merge, says so, and changes nothing more: no reset, no
   revert (a revert is a new decision for the owner).
5. **Bookkeeping**, one commit on `main`: in `metadata.yml`, `merged:
   <merge hash>    # <date>, merged by Claude on the owner's explicit
   request in chat` and `status: done`; in `plan.md`, the intent's row
   removed from In flight or Queued and a row appended to the end of the
   Shipped table: `| [§<id>](intents/<id>-<slug>/) <title> (<type>,
   <Tier>, <n> review round(s); see [review.md](…)) | \`<merge hash>\` |`.
   Only those two files are staged.
6. **Push**: `git push origin main`. A rejected push stops the run; never
   `--force`.
7. **Remove the worktree** (`npm run spawn -- <id> --remove`) and **delete
   the branch** (`git branch -d`, never `-D`). If the worktree folder can't
   be deleted because something still has it open (the §33/§35/§36 case),
   the run reports it as the one thing left — "exit the session in
   `<path>`, then run `npm run ship -- <id> --cleanup`" — and never stops a
   process.

**B6 — Re-running continues.** Each step first checks whether it is
already done (live check recorded; branch already merged into `main`;
bookkeeping already there; `origin/main` already at `main`; worktree and
branch already gone) and skips it, so after fixing what stopped a run,
`/ship <id>` again picks up where it stopped. `--cleanup` runs step 7 only.

**B7 — `--dry-run`.** Runs steps 2's checks and prints the plan of what it
would do (every step, done or to do), changing nothing. The skill uses it
when the owner asks "can §N ship?".

**B8 — The report.** One line per step: done (with commit hashes, the push
range, removed paths), skipped (already done), or the failure and what to
do. It ends with the one thing left for the owner, if any. Each run appends
a `shipped` (or `ship-stopped`) event to the session log (`appendEvent`).

**B9 — Commit attribution.** The script takes `--trailer "<line>"`
(repeatable) and appends those lines to the commits it makes (live check,
merge, bookkeeping). The skill passes the attribution lines the session
was given; the script adds none of its own.

## Interpretations

None of the rulebook. Two readings of the policy:
- "Explicitly asks for that action": invoking `/ship <id>` names all of
  the actions at once (B2); the owner learns what they are from the skill's
  description and the intent. A request to ship one id doesn't carry over
  to another.
- "Merging … refuses naming the one that failed": B5 stops at the first
  failing step and names it; a red `verify` after the merge (step 4) is
  reported, not undone, since undoing would rewrite or add history the
  owner didn't ask for.

## Acceptance criteria

- **AC1** — `scripts/ship-lib.test.mjs` (pure): precondition evaluation
  from given inputs (each of the three failing on its own; ROUTE with and
  without a reason in `review.md`); the `metadata.yml` edit (sets `merged:`
  and `status: done`, keeps every other line and comment, CRLF and LF);
  the `plan.md` edit (row removed from In flight or Queued, appended to the
  Shipped table's end, nothing else touched); the step plan for each
  "already done" state (B6); the merge message with trailers (B9).
  Mutants: accept a `rework` verdict; skip the ancestor check; allow a
  third file after the reviewed commit; append the row outside Shipped.
- **AC2** — `scripts/ship.test.mjs`, an end-to-end test in a temporary git
  repository with a bare `origin`: a minimal intent on a branch with a
  committed `review.md` (escalate) and a worktree. `npm run ship -- <id>
  --live-checked "ok"` records the check, merges, runs a stubbed verify,
  commits the bookkeeping, pushes, removes the worktree and deletes the
  branch; the bare repo's `main` matches. Variants: a `rework` verdict
  stops at step 2 with nothing changed; a dirty `plan.md` stops at B4; a
  re-run after a stop resumes (B6); `--dry-run` changes nothing.
- **AC3** — the skill (`.claude/skills/ship/SKILL.md`): the review reads it
  against B2, B3, B7, B9: invocation as the request, `--live-checked` only
  on the owner's words, the dry run, the attribution lines.
- **AC4** — live check (rule 3: a skill's behaviour shows only when it
  runs): in a session in the branch's worktree, `/ship <id>` on an intent
  that isn't ready (e.g. one still in review) stops at the right step and
  changes nothing; `/ship <id> --dry-run` (or "can §N ship?") prints the
  plan. The first real `/ship` after the merge is watched by the owner and
  noted in its intent's Progress.
- **AC5** — `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS.

## Non-functional

- **Engine/presentation split, save format, undo, AI:** untouched.
- **Tier:** Reviewed (`.claude/skills/**`); the script lives in `scripts/`
  (Attested by path), but the change as a whole is Reviewed.
- **Safety:** no `--force`, no `reset`, no `-D`, no killing processes, no
  staging files the step didn't write; every git call checked.
- **Lint cap 21:** `scripts/**` may use `console` (eslint override); keep
  functions within the guardrails.

## Out of scope

- Updating `heraklios-stable` (owner's choice).
- Shipping several intents in one run.
- Rebasing a branch that has fallen behind `main` (a rebase after review
  means a new review round, per policy precondition 1).
- Undoing a merge whose `verify` went red.

## Assumptions I made

- **A script plus a thin skill** (B1), over a skill of instructions only:
  the order and the checks become tested code, and the slips the intent
  lists were all procedural.
- **The live check by flag, filled from the owner's words** (B3): the
  script can't read the chat; the skill can, and quotes the words into the
  `live_checked:` comment as done by hand today.
- **Busy worktree folder: report, don't kill** (B5.7), with `--cleanup`
  for the rest once the owner has closed the session.
- **No partial runs** beyond `--dry-run` and `--cleanup`: anything else
  ("merge but don't push") is a plain request, as today.
- **Refuse on a dirty `plan.md`** (B4) rather than commit another
  session's edit, which happened by hand twice on 2026-10-21/22.
- **Shipped row from metadata and review header** (B5.5): title, type,
  tier and rounds; any extra summary is the owner's to add by hand.
