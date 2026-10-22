<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §46 plan — /ship merges a reviewed intent, does the bookkeeping, pushes and removes its worktree and branch

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

`npm run ship -- <id>` runs the merge sequence of `REVIEW-POLICY.md` →
"Merging" as tested code: live-check record on the owner's word, the three
preconditions, merge `--no-ff` with the message from a file, `verify`,
bookkeeping, push, worktree and branch removal; stopping at the first
failure, resuming on re-run, with a dry run and a cleanup mode (spec
B1, B3–B9). The `/ship` skill is the owner's interface to it (B1–B3, B7,
B9).

## Risks

- **A test that passes whatever the code does.** The preconditions are the
  safety of the whole feature: each gets a unit test and a mutant (AC1),
  and the end-to-end test checks the bare `origin` really moved (AC2).
- **Acting on the wrong state.** Preconditions must be read from git
  (`git show <branch>:…`), never from files on disk (policy: "never a copy
  on disk"); a mistake here would merge an unreviewed commit.
- **Doing harm the owner didn't ask for.** No `--force`, `reset`, `-D`,
  `git add -A`, or process killing anywhere in the script; the review
  greps for them (AC3-adjacent check in subtask 6).
- **Line endings and encoding.** `metadata.yml` and `plan.md` are CRLF in
  the working copy and LF in the index; the text edits must keep each
  file's endings and stay UTF-8 (§44's slip). Tests cover both endings;
  `iconv` at hand-over.
- **Stale line citations** in this plan once code moves: re-read before
  each subtask.
- **The test harness needs a repo without `package.json` scripts.** The
  script must not depend on `npm run …` for the steps the end-to-end test
  exercises (see Subtasks 2 and 3).
- **Lint cap 21:** `scripts/**` may use `console`; keep every function
  under 80 lines and complexity 20 (a step runner invites a long function).

## Verified against the codebase

Re-read on `main` at `1bf02b3`:

- `scripts/session-io.mjs:11-13` `git(cwd, ...args)` (`execFileSync`,
  trimmed stdout); `:21-24` `mainCheckout` (first entry of `git worktree
  list --porcelain`); `:35-38` `appendEvent(cwd, fields)`; `:41-45`
  `findIntentDir(root, id)`.
- `scripts/session-lib.mjs:21-25` `branchFor({ type, id, slug })`;
  `:28-32` `worktreePathFor(repoRoot, id, slug)`; `:47` `parseWorktreeList`.
- `scripts/intent-check-lib.mjs:45` `parseMetadata` (comments stripped);
  `:89` `GATE_FIELDS`; `:101` `parseGate`; `:219-226` `parseReviewHeader`
  (stops at the first `## ` or `# Round`).
- `scripts/check-intent.mjs:7` exit codes "0 PASS, 2 ROUTE …, 1 FAIL";
  `:27-43` reads the branch through `git` (`ls-tree`, `show`), so it runs
  in any repo with an `intents/` tree.
- `scripts/spawn-intent.mjs:81-85` `worktreeFor`; `:121-137` `remove()`
  (refuses unmerged or junctioned; `git worktree remove`; logs `removed`;
  prints "Branch … is kept").
- `scripts/spawn-intent.test.mjs:25-40` the harness pattern: a sandbox
  repo, `heraklios-wt/` beside it, `run(script, args)` = `spawnSync(node,
  [script, ...])` with `cwd: repo` and a fixed `GIT_ENV`.
- `package.json:13-16` scripts `check:intent`, `sdlc:scan`, `spawn`,
  `sessions`; `:18` `verify`.
- `vitest.config.ts:6` includes `scripts/**/*.test.mjs`;
  `eslint.config.js:58-64` turns `no-console` off for `scripts/**`.
- `plan.md` `### Shipped` (table `| Item | Merge |`), `### In flight` and
  `### Queued` (tables `| Item | Type · status |`).

## Subtasks

1. **`scripts/ship-lib.mjs` + `ship-lib.test.mjs` (AC1).** Pure functions:
   `checkPreconditions({ reviewHeader, isAncestor, changedFiles,
   intentDir, checkIntent })` → `{ ok, failed? }`; `markMerged(text, hash,
   date)` (metadata edit, keeps endings and other lines);
   `moveRowToShipped(text, id, row)`; `shippedRow({ id, slug, title, type,
   tier, rounds, hash })`; `planSteps(state)` → the seven steps with
   done/to-do (B6); `mergeMessage(id, title, trailers)`. Run AC1's four
   mutants. One commit.
2. **`scripts/ship.mjs`** (`npm run ship -- <id> [--live-checked "<words>"]
   [--dry-run] [--cleanup] [--trailer "<line>"]...`): B4's start checks,
   then B5's steps through `ship-lib`. It calls its sibling scripts by path
   with `process.execPath` (`check-intent.mjs`, `spawn-intent.mjs`), not
   `npm run`; `verify` runs `npm run verify`, overridable by
   `HERAKLIOS_SHIP_VERIFY` (a command line, for the test only, documented
   in the file's header). Message via a temp file (`-F`). One commit.
3. **`scripts/ship.test.mjs` (AC2)** in the spawn-test harness style: a
   sandbox repo with a bare `origin`, an intent on a branch with a
   committed `review.md` (escalate) and a worktree under `heraklios-wt/`;
   `HERAKLIOS_SHIP_VERIFY` set to a no-op. Cases: full ship (live check
   recorded, merge, bookkeeping, push, worktree and branch gone, `origin`
   matches); `rework` verdict stops at step 2 with nothing changed; dirty
   `plan.md` stops at B4; re-run after a stop resumes (B6); `--dry-run`
   changes nothing; a busy-folder stand-in (a worktree that `git worktree
   remove` refuses) reports `--cleanup`. One commit.
4. **`package.json`** script `"ship": "node scripts/ship.mjs"`. With 2 or
   on its own; no other script changes.
5. **`.claude/skills/ship/SKILL.md`** (version 0.1.0): invocation as the
   request (B2); `--live-checked` only on the owner's words, quoted (B3);
   `--dry-run` for "can §N ship?" (B7); pass the session's attribution
   lines as `--trailer` (B9); relay the report (B8); point to
   `REVIEW-POLICY.md` → "Merging" for the rules rather than restating
   them. One commit.
6. **Docs + hand-over.** `CLAUDE.md` (Commands: `npm run ship`; the
   skills line: `/ship`), `sdlc.md` step 6 (merging is `/ship <id>`),
   `intents/README.md` if it lists the skills. Then `verify`,
   `check:intent`, a grep of `scripts/ship*.mjs` for `--force`, `reset`,
   `-D`, `add -A`, `kill` (expect none), `iconv` over the changed files;
   Progress; `status: in-review`.

## Tests

| Behaviour | Test | Mutant it must kill |
| --- | --- | --- |
| B5.2 verdict | `checkPreconditions` with `rework` → fails "verdict" | accept `rework` |
| B5.2 ancestor | `isAncestor: false` → fails "rebased since review" | skip the ancestor check |
| B5.2 only review/metadata after | a third changed file → fails | allow any file |
| B5.2 ROUTE | ROUTE without a reason in `review.md` → fails; with → ok | treat ROUTE as PASS |
| B5.5 metadata | `markMerged` sets `merged:` and `status: done`, keeps comments, CRLF and LF | drop the line-ending handling |
| B5.5 plan.md | `moveRowToShipped` removes from In flight / Queued, appends to Shipped's end | append outside Shipped |
| B6 resume | `planSteps` for each already-done state | ignore "already merged" |
| B9 trailers | `mergeMessage` puts trailers after a blank line | — |
| AC2 end to end | `ship.test.mjs` cases above | — |

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS (FAIL only on an owed live check once the
  review sets it).
- No `npm run e2e` (no game path changes).
- **Live check (AC4, rule 3):** in a session in the branch's worktree
  (`cd ../heraklios-wt/46-ship-skill && claude`): `/ship <id>` for an
  intent that isn't ready (one still in review, or a draft) → it stops at
  the right step and `git status`, `git log -1` and `origin/main` are
  unchanged; then ask "can §<id> ship?" → it runs `--dry-run` and prints
  the plan. After the merge, the first real `/ship` is watched by the owner
  and noted in that intent's Progress.

## Assumptions I made

- The test-only verify override (`HERAKLIOS_SHIP_VERIFY`) is the smallest
  seam that lets AC2 run without a full repo; it is not documented as a
  user option.
- `check-intent.mjs` and `spawn-intent.mjs` are called by path so the
  script works in the sandbox and needs no change to either.
- `/ship`'s `SKILL.md` follows the drafting skills' pattern of pointing to
  the policy instead of restating it.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
