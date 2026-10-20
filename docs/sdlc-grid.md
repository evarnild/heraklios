<!-- generated-by: heraklios/grid@0.1.1 -->
# Heraklios — AI-native SDLC grid

One area: the whole repository (game, engine, map editor). Owner: Eric.
Refresh with `/grid` at the start of each quarter or after a pilot change;
the numbers come from `npm run sdlc:scan`, not from memory.

Model and levels: *AI-Native SDLC — strategy (v2)* and *implementation (v2)*,
September 2026. Six stages, each ending in an artefact the next one reads;
humans at the gates.

## The grid — 2026-10-20

| Stage | Level | Evidence | Gap to next level |
| --- | --- | --- | --- |
| **Intent** | **L2** for feature, refactor, adjustment, experiment · **fix: not yet exercised** | 10 intents (§26–§35), all stamped by `/intent` (`heraklios/intent@0.1.x`); every merged change since §26 names its `§`. Types used: 6 feature, 2 refactor, 1 adjustment, 1 experiment, **0 fix** | Fix at L1/L2: run the fix path once (failing test first, `follows_up:`). L3: a fuzz/e2e failure drafts the intent itself |
| **Design** | L1 | Every accepted feature has a `spec.md` (§28, §31, §32, §34, §35), written in session against `docs/research/` and accepted at a gate. Their stamp reads `heraklios/intent@…`, but `/intent` covers only the intent: **no versioned skill produced them**, so the stamp overstates L2 | L2: a `/spec` step (in `/intent` or its own skill) that loads rulebook + conventions and stamps truthfully |
| **Build** | L1, L2 for implement and parallel sessions | Plans approved before code, enforced: `check:intent` fails code that precedes `plan_approved`. `heraklios-implementer` agent; `/spawn` + `/sessions` run worktrees with their own port and brief (§27); session hooks log state. **No hook blocks an unsafe action**: the merge/push/delete rule (§28) is written policy, followed but not enforced | L2: hooks that refuse push, `git checkout --`, worktree removal without the owner's request |
| **Test** | L1 (partial) | `npm run verify` (build + lint + 637 tests on `main`) and `check:intent` on every review, re-run by the reviewer; mutation pass per changed line; **browser smoke suite `npm run e2e`** (§32, 4 scenarios) run by `/review` on UI changes. **Still no dependency/security check.** One e2e scenario (`save-load`) failed intermittently in two reviews (§33, §35), cause unknown | L1 complete: a security check in `verify`; the save-load flake fixed. L2: e2e scenarios proposed for each owed live check (owner request, 2026-10-20) |
| **Deploy** | **L2** (gates enforced by script, not hook) | `/review` ran on all 8 merges since the kit, each a stamped `review.md` (`heraklios/review@0.1.x`) with tier from the policy's path table, verdict and round history: 5 reviewed (escalate), 3 attested. Live checks owed and recorded before merge, enforced by `check:intent` (§28). Merge preconditions checked by the agent on request | L3: a change reaching `in-review` fires `/review` without you asking |
| **Maintain** | L1 (findings only) | Unchanged: no fix intent since the kit; the e2e flake seen twice was noted in reviews but not turned into an intent. No monitoring by choice (no server) | L1 in practice: findings become fix intents. L2: a scheduled fuzz/soak run |

**Production release stays human by design**: pushing `origin/main` and
`scripts/update-stable.sh` remain manual gates at every level.

**Declared choices** (the scan can't see these — keep them on refresh):
- Maintain has no monitoring dimension: there is no server.
- Merges are local; the review report is a committed `review.md`, not a PR comment.
- Gates may be recorded by an agent on the owner's "yes" (§31), marked
  `by-agent`. Of 25 gates recorded so far, 21 were (scan below): the gate is
  your decision, the typing is the agent's.

### Last quarter's two moves — outcome

1. **Intent → L2:** reached for features (and refactor, adjustment,
   experiment). The fix half did not happen: no fix intent yet.
2. **Deploy → L2:** reached. Every merge since §26 went through `/review`
   with a stamped report. Sampling has not fired: 3 attested changes, the
   first sample is due at the 5th.

## The two we move — from 2026-10-20

1. **Maintain/Intent → fix path, widen.** The fix type has never run.
   First step: `/intent --fix` for the `save-load` e2e flake (failed once
   in §33's review, once in §35's: "the loaded game equals the one saved"),
   with the failing reproduction first.
2. **Test → e2e in place of live checks, climb.** Live checks are the
   step that costs you most per UI change (4 recorded since §28).
   First step: an intent changing `REVIEW-POLICY.md` and `/review` so an
   owed live check comes with a proposed e2e scenario, and a merged
   scenario can stand in for the non-visual part of later checks. Add
   `npm audit` (or equivalent) to `verify` in the same pass to close
   Test L1.

**Infrastructure owed underneath:** a scene-level test seam is still
missing (`src/scenes/**` has no unit tests); the smoke suite is the only
automated check there, which is why its flake matters.

## Measures

Progress and outcome, never one without the other. Throughput is never read
without the revert rate beside it.

| Date | Window | Changes on main | Per week | Reference an intent/§ | Reverts | Intents (stamped) | Attested / reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-07 | 2026-07-16 (repo start) → 2026-10-07 | 74 | 6.2 | 20% | 0 (0.0%) | 0 (0) | — |
| 2026-10-20 | 2026-07-16 → 2026-10-20 | 104 | 7.5 | 42% | 0 (0.0%) | 10 (10) | 3 / 5 (0 follow-up fixes either tier) |

The baseline is history before the kit existed. Expect throughput to dip
while the kit is adopted; that is the investment, not a failure. Reverts
under-count the failure class that matters most here — wrong rules that
surface weeks later as a follow-up fix — so also read the number of
follow-up fix intents linked to an earlier intent.

## What each level means here

| Stage | L1 · by hand | L2 · codified | L3 · triggered | L4 · closed loop |
| --- | --- | --- | --- | --- |
| Intent | `intents/<id>/intent.md` written with an assistant, type declared, accepted in metadata | `/intent` drafted and validated it (stamp) | a fuzz failure or issue drafts the intent itself | intents drafted, deduplicated and ranked unattended |
| Design | `spec.md` written by hand for features | a `/spec` skill loads rulebook + conventions | accepting an intent fires the spec pass | specs produced unattended; only flagged concerns reach you |
| Build | context file; plan approved before code | shared skills/agents for plan, implement, verify; hooks block unsafe actions | an accepted spec fires plan generation | approved plans implemented unattended where the checks carry it |
| Test | `npm run verify` with a fresh context; failing test first for fixes; security check | test files protected during fixes; a verification skill | a new change fires verification automatically | verification repairs its own failures within limits |
| Deploy | written review policy; agentic review on every change | tiers applied automatically from the policy; gates enforced as hooks | a verified change fires review; you act on the report | everything up to the release gate unattended (ceiling) |
| Maintain | findings written as fix intents | a scheduled soak/fuzz run, deterministic checks | a failure fires diagnosis; you triage | findings written back as intents unattended |

Don't skip L1, and don't automate a stage past the point where its output
can be checked.

## Changelog

- 2026-10-07 — first fill, alongside §26 (the SDLC kit).
- 2026-10-20 — refresh after §26–§34 merged: Intent and Deploy reached L2; Design's spec stamps found to overstate; moves are the first fix intent and e2e in place of live checks.
