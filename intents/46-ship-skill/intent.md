<!-- generated-by: heraklios/intent@0.1.4 -->
# §46 — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

**Type:** feature
**Originator:** me (Eric)
**Source:** none

## Problem

"Create a new skill that merges, push and delete the worktree and the
branch." After every review the same sequence is done by hand, in chat,
from memory: record the live check when the owner says they ran it,
check the merge preconditions, merge, verify, do the bookkeeping, push,
remove the worktree, delete the branch. It was done twelve times, for §33 to §44
(2026-10-20 to 2026-10-22). Each time it is re-assembled in
the conversation, which has produced slips the procedure exists to
prevent: `merged:` written as a date instead of a hash (§32, caught by
§31), `git merge -F -` failing silently and leaving `main` unmerged
(§35), a worktree folder left behind because a session was still open in
it (§33, §35, §36). No skill holds the procedure, so the grid scores the
merge half of Deploy as "checked by the agent on request", not codified.

The rules it must follow already exist, in `REVIEW-POLICY.md` → "Merging":

> An agent merges into `main`, pushes, deletes a branch or removes a
> worktree **only when the owner explicitly asks for that action in the
> current conversation**, never on its own initiative.

> 1. the verdict in the branch's **committed** `review.md` … is `attest` or
> `escalate`; its `reviewed-commit` is an ancestor of the branch …; and
> nothing but that intent's `review.md` or `metadata.yml` differs between
> the two …
> 2. `npm run check:intent <branch>` reports PASS, or ROUTE with the reason
> already stated in `review.md`;
> 3. no live check is owed without `live_checked:` recorded …
>
> Then it merges with `--no-ff`, runs `npm run verify` on `main`, and does
> the bookkeeping: `merged:` and `status: done` in `metadata.yml`, the
> `plan.md` row to Shipped.

## Outcome

- A **`/ship <id>`** skill (owner's choice of name) that, when the owner
  invokes it, runs the whole sequence for intent §id in a fixed order, and
  stops at the first step that fails, naming it:
  1. **record `live_checked:`** on the branch, only when the owner's
     message says they ran the live check (owner's choice: included);
  2. **check the three merge preconditions** of `REVIEW-POLICY.md` →
     "Merging";
  3. **merge `--no-ff`** into `main` and run `npm run verify` on `main`;
  4. **bookkeeping**: `merged: <hash>` and `status: done` in
     `metadata.yml`, the `plan.md` row to Shipped (owner's choice:
     included);
  5. **push** `main`;
  6. **remove the worktree** (`npm run spawn -- <id> --remove`) and
     **delete the branch**.
- Invoking `/ship <id>` is the owner's explicit request for those actions,
  for that intent, in the current conversation; the skill never runs on
  its own, and never for an intent the owner didn't name.
- Its report says what each step did (commits, hashes, the push range), or
  where it stopped and why.

## Constraints

- **Reviewed tier:** `.claude/skills/**` (`REVIEW-POLICY.md` path table);
  the owner reads the diff.
- The merge rules don't change; the skill applies `REVIEW-POLICY.md` →
  "Merging" as written, and that section stays the source (the skill
  points to it rather than restating it, like the drafting skills and
  `intents/README.md`).
- `live_checked:` is recorded only on the owner's word that they ran the
  check (`intents/README.md` → "Who edits what"; an agent's own browser
  run never counts).
- No `--force`, no rewriting history, no skipping hooks; if `main` has
  uncommitted changes from another session, the skill doesn't commit them
  as its own.
- Updating `heraklios-stable` stays a separate request (owner's choice:
  not included).

## Type-specific questions

### Feature
- **Users:** the owner (one command per merge), the coordinator session
  that runs it.
- **Rulebook basis:** digital-only (process).
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - Invocation for the live check: `/ship <id>` with the owner's word in
    the same message ("live checked, ship 44"), or a flag
    (`/ship <id> --live-checked`)?
  - What it does when the worktree folder can't be deleted because a
    session is still open in it: report and leave it (today's practice),
    or offer to stop processes it can identify?
  - Partial runs: can the owner ask for only some steps (e.g. merge
    without push)? Or is `/ship` all-or-stop, with the other cases left
    to plain requests?
  - The merge commit message and how it's passed (a file, not stdin: the
    §35 slip).
  - Whether a script (`npm run ship -- <id>`) does the mechanical steps,
    with the skill around it, so the order and the checks are tested
    code rather than instructions.

## Assumptions I made

- **Feature:** a new skill with design questions; Reviewed by path.
- "Merges, push and delete the worktree and the branch" also covers the
  steps the policy requires around them (preconditions, verify,
  bookkeeping); the owner chose to add the live-check record and the
  bookkeeping explicitly.
- The skill works from the main checkout (the coordinator), where
  `plan.md` is edited.
