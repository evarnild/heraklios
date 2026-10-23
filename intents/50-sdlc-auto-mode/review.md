<!-- generated-by: heraklios/review@0.1.5 -->
# §50 review — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

verdict: rework
tier: reviewed
reviewed-commit: e3d02a1
round: 4
sampled: no
run: manual
live-check: owed

**Tier:** set by input 1, the paths (`REVIEW-POLICY.md`, `.claude/skills/**`,
`.claude/agents/**`), so the best verdict is `escalate`.

**Verdict:** `rework`, for one LOW finding needing mechanical rework (R4-1):
the new mid-rework resume rule misses the case of a close before the
implementer's first commit. There is no "Needs decision:" finding.
- **Fixed:** R3-1, R3-2 and R3-3 (the owner decided R3-3's behaviour).
- **Gate safety holds:** the rework is text in one paragraph and one list
  item; nothing about gates, merging or shipping changed.
- **If you read R4-1 as "worth a look"** instead, the verdict would be
  `escalate`.

Round 4 covers `e88adc0` (the rework) and `e3d02a1` (Progress). The diff is
one skill paragraph, one list item and a Progress entry, so the coordinator
ran this round itself, with no reviewer agent.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1 LOW needing rework, R4-1). The rework touches only what round 3 asked for; `plan.md` changed only below `## Progress`. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule |
| 4 | Tests prove the rule, not only pass | not run: no code changed this round (`git diff --stat e7333ba..e3d02a1`: `SKILL.md` and `plan.md` only), so there is no behavioural line to mutate |
| 5 | Boundary and conventions | pass, no `src/` or script change |
| 6 | Numbers in prose | pass. Progress's "text-only" and the live-check decision match the diff and the owner's words. |
| 7 | Documentation | pass. R3-1's stamp points at the review skill instead of a version, so it can't go stale. |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21; no dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 50, feature)
  note:  17 file(s), 932 line(s) changed outside intents/.
```

## Findings
- **LOW (R4-1)** `.claude/skills/auto/SKILL.md:77-86`: the mid-rework rule
  covers two cases: implementer commits but no Progress entry (relaunch),
  and no commits with no rework owed (redo the review). It misses **a
  rework owed and no implementer commit yet**: round n's verdict is
  `rework`, and the session closes before the implementer's first commit. A
  mechanical rework never stops (step 5, `:183-187`), so `auto_stopped` is
  empty and the run comes to this paragraph, which gives it no rule. Needs
  rework: base the rule on the Progress entry alone. While round
  `auto_round`'s `review.md` says `rework` and the implementer's Progress
  entry for it is missing, with or without commits, relaunch the implementer
  with the findings and wait. This follows from the owner's R3-3 decision,
  so it is mechanical.
- **Carried, yours:** spec B10 still says `attest` only (the B5 amendment
  overrides it in effect). Historical sampling: §36 (the 4th attested) is
  marked `sampled: yes`, §37 (the 5th) and §43 (the 10th) say `no`.

## Not checked
- **"The Progress entry for that rework"** is told by reading `plan.md`, as
  an entry added after round n's `review.md` commit. No script checks it,
  and no real resume has exercised it.
- **Resume in a real session**, as in round 3: the sandbox run went straight
  through to "ready for /ship". The sandbox was not updated to this rework.
- **R3-1 in a real run:** the new `review.md` instructions have not been
  run. The next `/auto` on a real intent will show them.
- **Push notifications:** not visible in any file.
- **Mutants:** none this round (pass 4); #2-#9 and #12-#16 remain the
  implementer's report, as in round 3.
- **e2e:** not required; no `src/`, `e2e/` or `main.ts` change.

## Live check
- **Owed** by rule 3 (AC5), and **recorded**: `live_checked: 2026-10-23
  by-agent` at `73cf348`, for `/auto 91` in the sandbox against `f623ccb`.
- **It still counts** after the text-only rework: the owner's decision,
  noted in Progress (`e3d02a1`).

## Verified myself vs. taken on trust
**Coordinator, run** (worktree at `e3d02a1`, tree clean):
- `npm run verify`: exit 0, 57 files, 988 tests, lint 21 of 21.
- `npm run check:intent`: PASS, 17 files, 932 lines.
- `git diff e7333ba..e3d02a1` read in full: `.claude/skills/auto/SKILL.md`
  (`:73-86` resume paragraph, `:170-177` step 5 item 4) and `plan.md`
  below `## Progress`. `REVIEW-POLICY.md` and `.claude/skills/review/` are
  unchanged.
- Re-read `SKILL.md:180-189` (step 5's `rework` branch resumes the implementer
  with no stop, the basis of R4-1) and `.claude/skills/review/SKILL.md:18`
  (`review@0.1.5`).

**Taken on trust:** the earlier rounds' mutant results, as listed in round 3.

**For your diff read, in order:**
1. `.claude/skills/auto/SKILL.md`: `:55-100` (resume), `:110-140` (the
   plan gate), `:155-190` (loop, cap, review, verdicts), `:235-255` (ship
   stop), `:20-34` (what it authorises);
2. `spec.md`: the B5, B12 and B13 amendments, and B10's `attest`;
3. `intents/README.md:106-135`;
4. `CLAUDE.md:75-90`, `:144-148`, and `spawn/SKILL.md:49-52`;
5. `REVIEW-POLICY.md:52-63`, `:209-251`, with "Merging" unchanged;
6. `sdlc.md:98-128`;
7. `scan-lib.mjs:143-182`, `session-lib.mjs:196-199`, and their tests.

# Round 3 (history)
- verdict: rework
- tier: reviewed
- reviewed-commit: f623ccb
- round: 3
- sampled: no
- run: manual
- live-check: owed

Resolutions (round 4, in `e88adc0`; the owner said "rework all"):
- **LOW R3-1, `/auto` did not say how to write `review.md`: fixed.** Step 5
  item 4 reads the review skill and copies its stamp, with `## Type check`
  and the full "Verified myself vs. taken on trust" heading.
- **LOW R3-2, "(or right after a resume)": fixed**, dropped.
- **LOW R3-3, a close mid-rework spent a round: decided by the owner and
  fixed.** The implementer is relaunched until its Progress entry exists.
  The case with no commit yet is round 4's R4-1.
- **Not checked, whether the live check carries over: decided.** The owner
  said it still counts.
- **LOW, historical sampling, and spec B10's `attest`: open, left for the
  owner.**

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
