# How to make a change in heraklios

The short version of the AI-native SDLC as it runs here. The detail lives in
[`intents/README.md`](intents/README.md) (types, gates, who edits what),
[`REVIEW-POLICY.md`](REVIEW-POLICY.md) (tiers, review passes) and
[`CLAUDE.md`](CLAUDE.md) → "Parallel sessions". If this file and those
disagree, they win.

Every change follows the same path; its **type** decides how much of it you
do. Work from a Claude Code session started in the main checkout
(`C:\Users\eric\src\heraklios`) — that is the **coordinator**, and it is
where `CLAUDE.md`, the skills and the hooks load. The id is the next `§`
number after the highest one in `plan.md` / `plan-history.md`.

## The steps

**1. Intent: what you want and why**

- Run `/intent` and describe the problem in your own words.
- It creates `intents/<id>-<slug>/` with `intent.md` and `metadata.yml`, and
  proposes a type. When in doubt, the type is feature.
- Read it. If it's right, `intent_accepted: <date>` is gate 1: your decision; you or the agent you ask records it.

**2. Spec — features only**

- Run `/spec <id>`; `spec.md` says what will be built.
- You record `spec_accepted`.

**3. Plan: how it will be built**

- Run `/build-plan <id>`; `plan.md` lists the files, the tests and the steps.
- `plan_approved` is your decision; you or the agent you ask records it. No code before this gate: `check:intent` fails
  a change whose code came first.

**4. Build** — either way:

- **Directly:** the coordinator creates the branch
  `feat|fix|refactor|adjust|exp/<id>-<slug>` and the implementer agent works
  through the plan, tests first.
- **In parallel:** `npm run spawn -- <id>` creates a worktree at
  `../heraklios-wt/<id>-<slug>` with dev port 5200+(id mod 100) and a
  `CLAUDE.local.md` brief. When the gate the type needs is recorded
  (`plan_approved`, or `intent_accepted` for an adjustment or experiment),
  `/spawn` also launches the implementer in the background there, and
  reports back with an offer of `/review`. Otherwise open `claude` in the
  worktree; that session implements. Keep it to about three at once.

It ends with `npm run verify` green and `status: in-review`.

**5. Review**

Run `/review` from the coordinator. It runs `npm run verify`,
`npm run check:intent` and the passes in `REVIEW-POLICY.md`, then writes
`review.md` with a verdict:

- **rework** — fix, then `/review` again;
- **attest** or **escalate** — go to step 6.

The report also says `live-check: owed` or `not-needed`. It's owed for
changes to scenes, UI, the map editor, `src/main.ts`, `index.html`,
`map-editor.html`, `vite.config.ts` or `.claude/settings.json`, and for
anything else only a live run can show. The one exception: when the
check is owed only because of the paths it touches, the browser smoke
suite (`npm run e2e`) already covers the changed behaviour,
the change is neither new nor visual, and `/review` ran the suite and it
passed, the report may say `not-needed` and name the scenario. You can
always set it back to `owed`. When owed, its `## Live check`
section gives the steps: run them yourself (`npm run dev` on the
worktree's port, a test-mode shortcut), then record
`live_checked: <date>` in `metadata.yml`. If you find a defect, leave the
date empty and send it back to rework. `check:intent` blocks the merge
until the date is there.

Commit `review.md` and the `live_checked:` date to the branch before the
merge: the merge check reads the branch from git and can't see
uncommitted files.

**6. Approve and merge — your gate**

- **Automated tier** (only intents or docs touched): merge.
- **Attested tier** (most of `src/`, scripts, tests): read the report, then merge.
- **Reviewed tier** (save format, undo, rule tables, map, research docs, lint
  guardrails, agents, skills, `.claude/settings.json`): read the report
  **and** the diff, then merge.

Merging is: `git merge --no-ff` on `main` → `npm run verify` on `main` → set
`merged:` and `status: done` in `metadata.yml` → the coordinator moves the
`plan.md` row to Shipped → push → `npm run spawn -- <id> --remove` if you
used a worktree. You can ask Claude to do the merge, the push or the
removal — each only when you ask for it, for that change, in the current
conversation. `/ship <id>` does all of it in order and stops at the first
step that fails (`/ship <id> --dry-run`, or "can §N ship?", only reports);
say in the same message that you ran the live check if you did. It first checks that nothing but the review and the
metadata changed after the reviewed commit, that `check:intent` passes,
and that any owed live check is recorded, and refuses if not
(`REVIEW-POLICY.md` → "Merging").

## What each type requires

| Type | Use for | You record |
| --- | --- | --- |
| feature | new rules, new UI flows, anything with a design question | intent, spec, plan |
| fix | a live defect; needs a test that fails first, and `follows_up: <id>` if an earlier § caused it | intent, plan |
| refactor | structure changes, behaviour held constant | intent, plan |
| adjustment | wording, README, config, constants — at most 5 files, 60 lines, no rule code | intent only |
| experiment | throwaway probes; never merged into rule code as-is | intent only |

So a small README tweak is intent → branch → `verify` → merge. A new combat
rule goes through every gate and ends at the Reviewed tier.

## Along the way

- `npm run sessions` shows every worktree: status, gates, ahead/behind
  `main`, uncommitted files, and whether its session is working, idle or
  needs you.
- `/grid` refreshes `docs/sdlc-grid.md`; run it every few weeks.
- A bug you hit while playing becomes a new **fix** intent — triaging it is
  one of your gates too.
- Every fifth attested change gets a full diff read after merge
  (`sampled: yes` in its `review.md`).

To start: `/intent` plus what you want changed.
