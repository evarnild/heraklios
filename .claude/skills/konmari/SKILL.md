---
name: konmari
description: Run the KonMari tidy-up step on one heraklios intent in its worktree — an Opus agent simplifies the intent's own change without changing behaviour, the coordinator re-checks it, and a failed check discards the tidy-up. Use after a review round reaches attest or escalate, from /auto or by hand. Coordinator only. Invoke as /konmari <id>.
metadata:
  owner: evarnild
  version: 0.1.0
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /konmari — tidy one intent's change before the live check

Run only in the coordinator session (the main checkout), like `/review`. This
is `/auto` step 5's KonMari step, run on its own. `/auto` calls these same
steps; the spec is `intents/61-architecture-guardrails/spec.md` (B12 to B19).

The step tidies this intent's change, not the codebase. A larger cleanup the
agent notices becomes a proposed `refactor` intent in the record. It is not a
review round: `auto_round` doesn't change and a failed KonMari is never a stop.

## 1. Preconditions

Read `intents/<id>-<slug>/metadata.yml` in the worktree. Stop and say why if:

- the type is not `feature`, `fix` or `refactor` (an adjustment or experiment
  never runs it);
- `konmari: skip` is set (the owner's choice; never set it yourself);
- there is no `review.md` with `verdict: attest` or `escalate` for the current
  head, or the worktree is held by another session;
- `konmari.md` exists and nothing was committed after its commits. A later run
  (after a rework round) covers only the commits since the last KonMari.

Record the head as `base`.

## 2. Launch the agent

Launch `heraklios-konmari` (model opus) in the worktree, in the foreground or
with `run_in_background: true` and wait. The brief carries:

- the intent id, slug, branch and `base`;
- the diff to tidy (`git diff main...HEAD`, or `base...HEAD` for a later run);
- `docs/architecture.md` and the record format (the agent's own text has it);
- the commit trailers of the session;
- `/auto` step 10's safety rules, which the agent's text repeats.

## 3. The KonMari check (B16), yourself

In the worktree, one heavy command at a time:

1. `npm run verify` and `npm run check:intent`;
2. `npm run e2e` when the changed paths call for it (`src/scenes/**`,
   `src/ui/**`, `src/main.ts`, `e2e/**`);
3. every mutant the latest `review.md` records as **killed** whose target file
   the tidy-up changed: re-apply it to the moved line by its recorded
   description (restore by copy, never `git checkout --`); each must still be
   killed;
4. a tidy-up that shrank a baselined file lowered that file's ceiling in
   `scripts/size-baseline.json` in the same commit (the agent's reach covers
   it; `check:intent` rule 5 would fail otherwise). A ceiling that went up is
   a failure;
5. compare the test-case and lint-warning counts with the review's: the test
   count must not fall, the warning count must not rise.

## 4. The reviewer's read

Delegate to `heraklios-reviewer` a read of **only the KonMari commits**
(`git log base..HEAD`, `git diff base..HEAD`): do they stay within the reach
(the diff's lines and what they duplicate), change no test assertion or case,
add no dependency or `eslint-disable`, and respect principles 5 to 12 of
`docs/architecture.md`?

## 5. Append `## KonMari check` to `review.md`

Append (never rewrite) a section to the round's `review.md` holding each B16
result marked **Coordinator, re-run**, and the reviewer's read. Commit it as
`§<id>: konmari check`. The review that clears the branch has then seen the
tidy-up, and pass 1 doesn't count the commits in `konmari.md` as refactoring
mixed in.

`reviewed-commit` does not move. `npm run ship` and `REVIEW-POLICY.md` →
"Merging" rule 1 accept, after it, the commits `konmari.md` lists under
`## Tidied` and `## Reverted`, `konmari.md` itself and the usual `review.md`
and `metadata.yml` commits, and nothing else. So `konmari.md` is committed in
its own commit (`§<id>: konmari record`, only that file), separate from the
`§<id> konmari:` tidy-up commits: a discard `git revert`s the tidy-up commits
and must never delete the record.

## 6. A failed check discards, never blocks (B18)

If any item in step 3 fails, or the reviewer's read finds a behaviour change
or a reach beyond the diff and its duplicates:

- `git revert` the KonMari tidy-up commits (new commits; no rewritten history;
  never the record's own commit);
- in `konmari.md` set `outcome: discarded` alone on its line, add a separate
  `reason: <why>` line (never text after the outcome: the ship dry-run reads
  the outcome with an anchored pattern and would report `not run`), list the
  revert commits under a `## Reverted` heading in the same bullet form as
  `## Tidied` (`- <hash> — revert of <hash>`), commit that as
  `§<id>: konmari discarded`, and re-run `npm run verify`;
- go on as if no tidy-up had been made.

`outcome: nothing to tidy` (no commit) and `outcome: kept` need no revert.
Nothing here sends the run back to rework or stops it.

## Safety

Never run `npm run ship`; never merge, push, rebase or delete a branch or
worktree; never record a gate; never write `konmari: skip` (only the owner, or
an agent on the owner's words in a comment); never touch a real `saves/`
folder; never raise the lint warning cap; restore mutants by copy; finish with
`git status --short` clean.
