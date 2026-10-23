<!-- generated-by: heraklios/review@0.1.5 -->
# §50 review — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

verdict: rework
tier: reviewed
reviewed-commit: f623ccb
round: 3
sampled: no
run: manual
live-check: owed

**Tier:** set by input 1, the paths (`REVIEW-POLICY.md`, `.claude/skills/**`,
`.claude/agents/**`), so the best verdict is `escalate`.

**Verdict:** `rework`, for one LOW finding needing mechanical rework (R3-1),
found through the live check. There is no "Needs decision:" finding.
- **Fixed:** all six round-2 findings (R2-1 to R2-6) and the
  `--exclude --json` LOW.
- **Gate safety holds:** the authorisation records only that intent's
  `plan_approved`; nothing merges, pushes or runs `npm run ship` beyond
  `--dry-run`; "Merging" is unchanged.
- **If you read R3-1 as "worth a look"** instead, nothing else needs rework
  and the verdict would be `escalate`.

Round 3 covers `8116e9d` (the rework) and `f623ccb` (Progress). `73cf348`,
committed during the review, only records `live_checked` in `metadata.yml`.
Passes run by the `heraklios-reviewer` agent; the coordinator re-ran verify
and the new mutant and re-read the lines behind R3-1.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1 LOW needing rework, R3-1; 1 LOW worth a look, R3-3). The rework touches only what round 2 asked for; `plan.md` changed only below `## Progress`. |
| 2 | Type check | pass (PASS at `73cf348`, with `live_checked` recorded) |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule |
| 4 | Tests prove the rule, not only pass | pass. The new usage case kills mutant #10; #11 is equivalent; #17 and #18 are untested CLI glue, known since round 2. |
| 5 | Boundary and conventions | pass. No `src/` change; the logic stays in the `*-lib.mjs` files. |
| 6 | Numbers in prose | pass. 57 files, 988 tests, lint 21, the three survivors, #10 killed and n = 13 reproduce. |
| 7 | Documentation | findings (1 LOW worth a look, R3-2) |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21 (`package.json:12`); no new dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 50, feature)
  note:  17 file(s), 921 line(s) changed outside intents/.
```

## Findings
- **LOW (R3-1)** `.claude/skills/auto/SKILL.md:162-166`: step 5, items 3 and
  4, delegate `/review` and say "write it with `run: auto`", but never tell
  the coordinator to write `review.md` the way `/review` step 4 does. The
  stamp lives in `.claude/skills/review/SKILL.md:18` (`review@0.1.5`). The
  live check shows the gap: the sandbox's §91 `review.md` breaks the report
  format in three ways:
  1. line 1 is `heraklios/review@0.1`, a guessed version;
  2. there is no `## Type check` section with the `check:intent` output;
  3. the heading is `## Verified myself`, not `## Verified myself vs. taken
     on trust`.

  `sdlc-scan` still parses the header, so the impact is low, but every
  auto-run report would drift from the policy's format. Needs rework: in
  step 5, items 3 and 4, say "read `.claude/skills/review/SKILL.md` and write
  `review.md` as its step 4 does (its stamp, `REVIEW-POLICY.md` → 'The
  report'), with `run: auto`".
- **LOW (R3-2)** `.claude/skills/auto/SKILL.md:75-76`: "an empty
  `auto_stopped` means the session closed mid-run (or right after a
  resume)". Since `:60-65` keeps `auto_stopped` until the resumed step's
  first commit, the parenthesis is a leftover. Worth a look: drop it.
- **LOW (R3-3)** `.claude/skills/auto/SKILL.md:77-79`: after a close
  mid-rework, any implementer commit since round n's `review.md` starts round
  n+1. The implementer commits early, so a half-done rework spends a round.
  Not unsafe. Worth a look; changing it changes the resume behaviour, so it
  is yours to decide (for example, relaunch the implementer while its
  Progress entry for that rework is missing).
- **Observation from the sandbox run, not a skill defect:** `auto_authorized`,
  `plan.md` and `plan_approved` landed in one commit (`cb15308`), where steps
  1.4 and 3.3 ask for separate commits. The gate comment still names the
  authorisation. The run's implementer was a Sonnet model.
- **Carried, yours:** spec B10 still says `attest` only (the B5 amendment
  overrides it in effect). Historical sampling: §36 (the 4th attested) is
  marked `sampled: yes`, §37 (the 5th) and §43 (the 10th) say `no`.

## Not checked
- **Mutants #2-#9 and #12-#16** were not re-run this round; the
  implementer's Progress reports them killed. #0 and #1 were re-run in
  round 2.
- **Resume in a real session:** the sandbox history has no `auto run
  resumed` commit and no stop before "ready for /ship". Only the
  straight-through path is shown by the files. Whether you tried a resume is
  not visible.
- **Push notifications** during the sandbox run: not visible in the files.
- **Whether the recorded live check carries over** if R3-1 is reworked: it
  was run against `f623ccb`. The policy doesn't say; that's yours.
- **e2e:** not required; no `src/`, `e2e/` or `main.ts` change.

## Live check
- **Owed** by rule 3 (AC5: the skill's behaviour only shows in a real run).
- **Recorded:** `live_checked: 2026-10-23 by-agent` at `73cf348`, on your
  words, for `/auto 91` in the sandbox against `f623ccb`.
- **Sandbox evidence** (read by the coordinator and the reviewer): commits
  `cb15308` run started, `54403d0` fix, `ac07d04` `auto_round: 1`,
  `f34f18b` review (`attest`, `run: auto`, three "Coordinator, re-run"
  lines), `6eddd41` `auto_stopped: ready for /ship`; `npm run sessions` shows
  `auto · r1 · ready for /ship`; `npm run ship -- 91 --dry-run` reports the
  preconditions hold.
- After an R3-1 rework, a sandbox run would show `review@0.1.5`, a
  `## Type check` section and the full "Verified myself vs. taken on trust"
  heading.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at `73cf348`, which differs from
`f623ccb` only in `metadata.yml`):
- `npm run verify`: exit 0, 57 files, 988 tests, lint 21 of 21.
- `npm run check:intent`: PASS (intent 50, feature), 17 files, 921 lines.
- Mutant #10 (`scripts/scan-lib.mjs:178`, the `startsWith('--')` check
  dropped): file changed, full suite: **killed**, 1 failed of 988
  ("sampleDueCommand > exits 2 with a usage line when the value is missing
  or unknown"). Restored by copy; `git status --short` empty, `git diff
  --quiet` passes.
- Re-read `.claude/skills/auto/SKILL.md:55-95` (resume), `:150-170` (round
  start, cap, review delegation: R3-1), `:228-240` (ship stop: R2-2 fixed),
  and `.claude/skills/review/SKILL.md:18` (`review@0.1.5`).
- The sandbox: §91's branch `metadata.yml` and `review.md` header,
  `git log`, `npm run sessions`, and `npm run ship -- 91 --dry-run`.

**Reviewer agent** (same worktree):
- `npm run verify` and `check:intent` with the same results.
- `git diff 3c3d80a..f623ccb` read in full against B1-B14 as amended,
  `intents/README.md` "Who edits what", "Merging" and `CLAUDE.md`.
- Each round-2 resolution checked at its lines (below).
- Mutants one at a time, restored by copy, tree clean after each: #10
  killed; #11 survived, equivalent (`sampleDue` counts only `verdict ===
  'attest'`, `scan-lib.mjs:136-137`); #17 (`sdlc-scan.mjs:57`) and #18
  (`sessions.mjs`) survived, CLI glue.
- `npm run sdlc:scan -- --sample-due manual --exclude 50`: n = 13, every 5,
  `sampled: no`.
- `main` at `c3d255b`; nothing pushed or merged.

**Taken on trust:** the implementer's kills of #2-#9 and #12-#16.

**For your diff read, in order:**
1. `.claude/skills/auto/SKILL.md`: `:55-95` (resume), `:106-134` (the plan
   gate), `:150-185` (loop, cap, escalate), `:228-250` (ship stop), `:20-34`
   (what it authorises);
2. `spec.md`: the B5, B12 and B13 amendments, and B10's `attest`;
3. `intents/README.md:106-135`;
4. `CLAUDE.md:75-90`, `:144-148`, and `spawn/SKILL.md:49-52`;
5. `REVIEW-POLICY.md:52-63`, `:209-251`, with "Merging" unchanged;
6. `sdlc.md:98-128`;
7. `scan-lib.mjs:143-182`, `session-lib.mjs:196-199`, and their tests.

# Round 2 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 6dcd2c1
- round: 2
- sampled: no
- run: manual
- live-check: owed

Resolutions (round 3, in `8116e9d`):
- **MEDIUM R2-1, resume gaps when the session closes: fixed.** An empty
  `auto_stopped` falls back to the first step not done; a new round only if
  the implementer committed since that round's `review.md`; an empty
  `auto_round` is round 0. `auto_stopped` is kept until the resumed step's
  first commit. The mismatch row redoes the review as the same round in a
  new session. Leftovers: R3-2, R3-3.
- **MEDIUM R2-2, step 8 said `attest` only: fixed** ("or `escalate` after
  the owner's diff read"). Spec B10's wording is carried, yours.
- **LOW R2-3, the cap wrote `auto_round: 4`: fixed.** It stays at 3.
- **LOW R2-4, `CLAUDE.md` "never records": fixed** ("without the owner's
  yes; the `/auto` authorisation covers neither").
- **LOW R2-5, stop lists: fixed** in `CLAUDE.md` and `sdlc.md`.
- **LOW R2-6, CRITICAL shared the reds' row: fixed.** Its own row sends it
  to the implementer, then a new round.
- **LOW, `--exclude --json` untested: fixed.** A usage case kills mutant
  #10.
- **Not checked, 17 of 19 mutants unrun: done** by the implementer one at a
  time: 14 killed, #11 equivalent, #17 and #18 CLI glue surviving.
- **LOW, historical sampling: open, left for the owner.**

# Round 1 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: 69ee2ca
- round: 1
- sampled: no
- run: manual
- live-check: owed

Resolutions (round 2, in `810ad37` and `6dcd2c1`):
- **MEDIUM F1, `CLAUDE.md` and `/spawn` said "never runs `/review`
  unprompted": fixed.** Both say "outside an `/auto <id>` run"; "never
  records a gate or merges" is kept.
- **MEDIUM F2, resume by "first step not done": fixed**, with gaps left when
  a session closes (round 2's R2-1). The table is keyed on `auto_stopped`,
  per amended B13.
- **MEDIUM F3, nothing after an `escalate` stop: decided and fixed.** The
  owner chose "diff read, go on to the live-check or ship stop" (B5
  amended). Step 8's `attest` wording is round 2's R2-2.
- **MEDIUM F4, untested glue in `sdlc-scan.mjs` and `sessions.mjs`: fixed.**
  `parseReviewFields`, `sampleDueCommand` and `metadataColumns` are in the
  libs, with tests; MS1 is killed.
- **MEDIUM F5, the sandbox had no `origin`: fixed.** It now has a local bare
  origin, and the dry-run gets past the origin check.
- **LOW F6, incomplete stop lists: fixed as asked.** The remaining gaps are
  round 2's R2-5.
- **LOW, `run:` template line and `--sample-due` without a value: fixed.**
  The read is strict; usage errors exit 2.
- **LOW, an existing unapproved plan: fixed.** Step 3.0 stops.
- **LOW, `auto_round` at round start: accepted by the owner** (B12 amended).
- **LOW, historical sampling: open, left for the owner.**
