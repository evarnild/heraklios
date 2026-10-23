<!-- generated-by: heraklios/review@0.1.4 -->
# §50 review — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

verdict: rework
tier: reviewed
reviewed-commit: 6dcd2c1
round: 2
sampled: no
run: manual
live-check: owed

**Tier:** set by input 1, the paths (`REVIEW-POLICY.md`, `.claude/skills/**`,
`.claude/agents/**`), so the best verdict is `escalate`.

**Verdict:** `rework`, for two MEDIUM findings, both mechanical, in the
`/auto` skill's resume rules and ship stop. There is no "Needs decision:"
finding.
- **Fixed:** all six round-1 findings and the plan-exists LOW.
- **Gate safety holds:** nothing is authorised beyond "/auto <id> records
  that intent's `plan_approved`", and "Merging" is unchanged.
- **Pass 4 ran only in part:** the reviewer's mutant batch was stopped by
  Claude Code for low system memory after 2 of 19 mutants. See Not checked.

Round 2 covers `810ad37` (the owner-decided spec amendments: B5, B12, B13)
and `6dcd2c1` (the rework). Passes run by the `heraklios-reviewer` agent;
the coordinator re-read the lines behind each finding.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2 MEDIUM, 3 LOW): R2-1, R2-2, R2-3, R2-4, R2-6 |
| 2 | Type check | FAIL on the owed live check only: the owner's gate, not rework |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule |
| 4 | Tests prove the rule, not only pass | partly run: 2 of 19 mutants, both killed; the rest checked by reading the tests (Not checked), 1 LOW |
| 5 | Boundary and conventions | pass. The F4 logic is in `scan-lib.mjs` and `session-lib.mjs`; the CLIs keep one-line calls. |
| 6 | Numbers in prose | pass. 57 files, 988 tests, lint 21, `--sample-due manual --exclude 50` n = 13 reproduce. |
| 7 | Documentation | findings (1 LOW): R2-5 |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21, none in `scripts/`; no new dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: FAIL (intent 50, feature)
  error: A live check is owed and not recorded. Do the steps in intents/50-sdlc-auto-mode/review.md → ## Live check, then set live_checked: <date> in intents/50-sdlc-auto-mode/metadata.yml.
  note:  17 file(s), 905 line(s) changed outside intents/.
```

## Findings
- **MEDIUM (R2-1)** `.claude/skills/auto/SKILL.md:60`, `:69-73`: the resume
  rules leave gaps when the coordinator session closes, the case B13
  exists for. The empty-`auto_stopped` rule covers only "no `review.md` for
  round `auto_round`". It leaves out:
  - **(a) a close before round 1** (during the plan or build), when
    `auto_round` is empty, or **during a rework**, when round n's
    `review.md` exists and the implementer was mid-fix;
  - **(b) a close right after a resume:** step 1.3 clears `auto_stopped`
    and commits before the resumed step runs, so the reason is lost (for
    example after an escalate stop and `/auto`, before the live-check
    stop);
  - **(c) a re-check mismatch in a new session:** the mismatch row says
    "redo the re-check", but step 6 forbids writing `review.md` over a
    mismatch, so the reviewer's report is gone.

  Needs rework:
  - add a fallback for an empty `auto_stopped`: the first step whose work
    isn't done. A new round only if the implementer has committed since
    round `auto_round`'s `review.md`; otherwise redo that round's review as
    the same round;
  - in the mismatch row: if the reviewer's report isn't in this
    conversation, redo the review as the same round;
  - optionally, clear `auto_stopped` only once the resumed step has moved
    on.

  All of this stays within amended B13.
- **MEDIUM (R2-2)** `.claude/skills/auto/SKILL.md:222`: step 8 requires "the
  verdict is `attest`". The escalate row (`:81`), step 5 and step 7's pass
  path all send an escalated run there, so step 8 contradicts amended B5.
  `ship-lib.mjs` accepts `escalate`, so the dry-run itself would pass.
  - Needs rework: "the verdict is `attest`, or `escalate` after the owner's
    diff read".
  - Spec B10 has the same `attest` wording. The B5 amendment overrides it in
    effect, but tidying B10 is the owner's call.
- **LOW (R2-3)** `.claude/skills/auto/SKILL.md:145-147` with `:242`: at the
  cap, `n` is 4. Step 9 then writes `auto_round: <n>`, which `check:intent`
  rejects (`AUTO_MAX_ROUND = 3`, `intent-check-lib.mjs:118`, `:232`).
  Needs rework: at the out-of-rounds stop, `auto_round` stays at 3.
- **LOW (R2-4)** `CLAUDE.md:85-86`: "never records `spec_accepted` or
  `live_checked`" contradicts the skill, which records both `by-agent` on
  the owner's yes, as the normal rules allow. Needs rework: "never records
  `spec_accepted` or `live_checked` without the owner's yes; the `/auto`
  authorisation covers neither".
- **LOW (R2-5)** `CLAUDE.md:80-85`, `sdlc.md:115-120`: the stop lists still
  miss some reasons:
  - "plan exists unapproved" (new this round) and "ship dry-run blocked",
    in both;
  - a fourth open session, in `CLAUDE.md`.

  Worth a look.
- **LOW (R2-6)** `.claude/skills/auto/SKILL.md:85`: a CRITICAL finding
  shares the reds' row ("redo the step that stopped"), so it would
  re-review an unchanged branch. That is the F2 pattern, though it costs no
  round. Worth a look: send it to the implementer, like the decision row,
  then a new round.
- **LOW** `scripts/scan-lib.mjs:177`: the `excludeId.startsWith('--')` branch
  has no test (`--exclude --json`); it most likely survives. Worth a look:
  add that case to the usage test.
- **LOW (carried, left for the owner)**: historical sampling. §36 (the 4th
  attested) is marked `sampled: yes`; §37 (the 5th) and §43 (the 10th) say
  `no`.

## Not checked
- **17 of 19 planned mutants were not run.** Claude Code stopped the
  background batch for low memory while mutant 2 was applied. The reviewer
  restored `scripts/scan-lib.mjs` by copy. The coordinator confirmed the
  worktree is clean, with no diff against `6dcd2c1`. Read from the tests:
  - **likely killed** by exact assertions: MS3, MS2, the usage-check
    removals, the dropped review fields and the null-without-flag case;
  - **likely to survive:** the `startsWith('--')` branch (LOW above), an
    equivalent `filter`, and the two one-line CLI call sites.

  Round 3 should finish this batch; the harness is in
  `…/scratchpad/mut50/`.
- **The implementer's 21 mutants** were not replayed one for one.
- **The skill in a real run** (AC5): only the live check shows that.
- **Push notifications, the real `origin`, the real sessions log.**
- **e2e:** not required; no `src/`, `e2e/` or `main.ts` change.

## Live check
- **Owed** by rule 3 (AC5). Run it after this rework, once the sandbox's
  `main` is moved to the new §50 commit, with the §91 intent commit on top
  and pushed to the local bare origin (the implementer does this).
- **Sandbox:** `C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/auto-sandbox`;
  origin `…/scratchpad/auto-origin.git`. The scratchpad is session-specific,
  so don't leave the check for a much later session.
- **Steps and what you should see** (the setup is done):
  1. `cd ".../auto-sandbox" && git remote -v`: only `auto-origin.git`.
  2. Run `claude`, then type `/auto 91`.
  3. `auto_authorized: <today> by-agent    # owner: "/auto 91"` is committed
     on `main`. §91 is a fix, so there is no spec stop.
  4. The plan is drafted, then `plan_approved: <today> by-agent    # auto:
     owner "/auto 91" (auto_authorized <today>)`. Nothing else is recorded.
  5. With no prompt, `npm run spawn -- 91` creates
     `…/scratchpad/heraklios-wt/91-clip-nonpositive-max` (port 5291), and
     `C:/Users/eric/src/heraklios-wt` gains nothing. The implementer runs in
     the background.
  6. Round 1: `auto_round: 1` is committed before the review, the review
     runs unprompted, and its `review.md` has `run: auto` and a
     "Coordinator, re-run" block.
  7. At the first stop, `npm run sessions` and `npm run queue` in the
     sandbox show `auto · r1 · <reason>`, plus a push notification if the
     tool exists.
  8. **Resume:** close the session at that stop, open a new one, and type
     `/auto 91`. It must not re-plan or re-spawn.
     - After a live-check stop, it goes to the live-check step.
     - After "ready for /ship", it re-runs only the dry-run.
     - If you can, provoke an escalate (`review_tier: reviewed` in §91's
       metadata on the branch): `/auto 91` then goes on with no new round.
     - Also close the session once mid-round (R2-1).
  9. If it owes a live check, say you ran its steps; `live_checked` is
     recorded on your words.
  10. It ends at "ready: `/ship 91`" after a `--dry-run` report, then an
      "auto stopped: ready for /ship" commit. **Don't ship.**
  11. Clean up: `git worktree remove` the §91 worktree from inside the
      sandbox (check its `node_modules` isn't a junction), then delete
      `auto-sandbox` and `auto-origin.git`.

  Then record `live_checked` on the real §50 branch.

## Verified myself vs. taken on trust
**Coordinator, re-read** (worktree at `6dcd2c1`):
- `git status --short` is empty and `git diff --quiet` passes after the
  reviewer's interrupted mutant run.
- `.claude/skills/auto/SKILL.md`:
  - `:58-88`: the resume table, and the empty-`auto_stopped` rule covering
    only "no `review.md` for round `auto_round`" (R2-1);
  - `:142-150`: the cap at `n` = 4 (R2-3);
  - `:218-226`: step 8, "the verdict is `attest`" (R2-2);
  - `:238-246`: step 9 writes `auto_round: <n>` (R2-3).
- `CLAUDE.md:84-87`: "never records `spec_accepted` or `live_checked`"
  (R2-4).
- `scripts/intent-check-lib.mjs:118`, `:232`: `AUTO_MAX_ROUND = 3`, and
  `check:intent` rejects a larger round (R2-3).
- No mutants re-run by the coordinator this round: the machine had just run
  out of memory.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, 57 files, 988 tests, lint 21 of 21, with
  `eslint scripts` clean.
- `npm run check:intent`: FAIL, only on the owed live check.
- `git diff 69ee2ca 6dcd2c1` read in full against B1–B14 and the
  amendments. `810ad37` touches only `spec.md`. The policy files, the review
  skill and the reviewer agent did not change in the rework.
- **Mutants, full suite each:**
  - MS1 (`run` read dropped): killed, 2 failed;
  - the strict rule loosened: killed, 1 failed.
  - The batch was then stopped for low memory, as recorded above.
- **The `sdlc-scan` CLI:**
  - usage errors exit 2;
  - `--sample-due manual --exclude 50` gives n = 13, not due;
  - `auto` gives n = 1;
  - §50's real `review.md` reads as `run manual`.
- **The sandbox:**
  - only `auto-origin.git` as a remote;
  - `main` is `0de8185`, i.e. `6dcd2c1` plus §91's intent;
  - origin `main` matches;
  - `npm run ship -- 91 --dry-run` stops at "the branch for §91 does not
    exist…": expected before a run, and the origin blocker is gone.
- The real `main` is unchanged; nothing was pushed.

**Taken on trust:** the implementer's 21 mutants (only MS1 and the strict
rule were re-run), and the skill's behaviour in a real session.

**For the owner's diff read, in order:**
1. `.claude/skills/auto/SKILL.md`: `:69-88` (resume), `:106-127` (the plan
   gate), `:136-167` (loop, cap, escalate), `:220-237` (ship stop), `:20-34`
   (what it authorises);
2. `spec.md`: the B5, B12 and B13 amendments, and B10's `attest`;
3. `intents/README.md:106-135` (unchanged since round 1);
4. `CLAUDE.md:75-86`, `:144-148`, and `spawn/SKILL.md:49-52`;
5. `REVIEW-POLICY.md:52-63`, `:209-251`, with "Merging" unchanged;
6. `sdlc.md:98-128`;
7. `scan-lib.mjs:143-182`, `session-lib.mjs:196-199`, and their new tests.

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
