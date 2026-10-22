---
name: review
description: Run heraklios's review policy against a branch and write the review report (intents/<id>-<slug>/review.md) with passes, findings, a Not-checked section and an attest/escalate/rework verdict. Use before merging any heraklios branch into main, or to re-review after rework. Invoke as /review [branch].
metadata:
  owner: evarnild
  version: 0.1.4
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /review — the agentic review before you merge

`REVIEW-POLICY.md` is the policy; this skill is how to run it. Read the
policy first, every time — it changes, and the version you remember may not
be current.

Stamp: `<!-- generated-by: heraklios/review@0.1.4 -->` as the first line of
`review.md`.

## 0. Orient

- Branch: the argument, else the current branch. `git rev-parse HEAD`,
  `git branch --show-current`, `git worktree list`.
- If the branch is checked out in another worktree, review it there (or
  `git checkout --detach <branch>` in a scratch worktree). **Read-only:** no
  commits, resets, stashes, merges, or edits to code. The only file you write
  is `review.md`.
- Find the intent: `intents/<id>-*/` from the branch id. Read `intent.md`,
  `spec.md` (if any), `plan.md` including `## Progress`, `metadata.yml`, and
  any previous `review.md` (this run is round n+1: put the new report at the
  top and move earlier rounds below `# Round N (history)`, per the policy).

For a substantial branch, delegate the passes to the `heraklios-reviewer`
agent with this skill's instructions and the policy, then assemble its
output into the report. Do not trust an implementer's self-report — and do
not trust a sub-agent's either: re-run the commands whose results you quote.

## 1. Mechanical checks first

```bash
npm run verify          # build + lint + test; must be green
npm run check:intent    # PASS / ROUTE / FAIL — paste the output
npm run e2e             # only when the diff touches src/scenes, src/ui, src/main.ts or e2e/

```

If `node_modules` is missing in a worktree, `npm install` there (see
`docs/runbook.md` §4 — never junction into a worktree you'll delete, never trust bare
`npx tsc`). A red `verify` or a FAIL type check is an immediate `rework`
verdict; still run the remaining passes you can, so one round catches as
much as possible. **One exception:** a FAIL whose only error is "A live
check is owed and not recorded" (an earlier round set `live-check: owed`)
is the owner's to clear, not rework. Note it and carry on.

## 2. Decide the tier

Apply the three inputs from the policy in order: path table → `review_tier`
and type in metadata → this run's findings. Write down which input set it.
Never lower a tier.

## 3. Run the passes

Run all nine from `REVIEW-POLICY.md`, in order. For each, record
`pass`, `findings (n)`, or `not run — <why>`. Pass 4 (mutations) is the
expensive one and the one that has mattered most here: one mutation per
changed behavioural line, full suite each time, back up and restore files
yourself (never `git checkout --`), end with `git status --short` clean.

## 4. Write `review.md`

Exactly the format in `REVIEW-POLICY.md` → "The report". Rules:

- **Findings** carry severity, `file:line`, what is wrong, and either
  "needs rework: <minimal fix>" or "worth a look".
- **Not checked** is honest and specific — untested paths, a rule passage
  you couldn't resolve, manual browser behaviour you couldn't see, mutants
  you didn't run and why. An empty Not-checked section is almost always wrong.
- **Verified myself vs. taken on trust** lists the commands you actually ran
  with their results.
- **Verdict:** `rework` if any finding needs rework; else `escalate` if the
  tier is Reviewed; else `attest`.
- **`live-check:`** — decide it after the passes, by the three rules in
  `REVIEW-POLICY.md` → "Live checks" (paths; `.claude/settings.json`; a
  runtime-only Not-checked item). When `owed`, the `## Live check` section
  gives steps the owner can follow without asking: the exact command and
  port, the `src/ui/testMode.ts` shortcut or seed, the clicks, and what they
  should see. When `not-needed`, one line saying why. If you drove the
  browser yourself, list what you saw under "Verified myself"; it never
  replaces the owner's check, and you never write `live_checked:` unless the owner asks you to, after running the check themselves.
  **The smoke suite** is the one exception the policy allows: if the check
  is owed by the path rule alone, a named `e2e/` scenario already covers
  the changed behaviour, the change is neither new nor visual, and your own
  `npm run e2e` passed, set `not-needed` and name the scenario and the run.
  A failing scenario is a finding.
- `sampled:` — count attested reviews in `intents/*/review.md`; if this is
  the 5th, 10th, … attested change, set `sampled: yes` and tell the user a
  post-merge full read is due.

Write nothing but `review.md`. The implementer sets `status: in-review`; if
it is still something else, say so in the report rather than fixing it.

## 5. Tell the user

One short block: verdict, tier and why, counts of findings by severity, the
top finding if any, the Not-checked headline, "live check owed: <one-line
summary>" when it is, and what they do next — "read the report and merge",
"read the diff too (Reviewed)", or "rework, then /review again". A live
check owed comes before the merge: "do the live check, record
`live_checked:`, then merge". If they ask you to merge, apply
`REVIEW-POLICY.md` → "Merging" (its preconditions, then `verify` on `main`
and the bookkeeping).
