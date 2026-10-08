<!-- generated-by: heraklios/grid@0.1.0 -->
# Heraklios — AI-native SDLC grid

One area: the whole repository (game, engine, map editor). Owner: Eric.
Refresh with `/grid` at the start of each quarter or after a pilot change;
the numbers come from `npm run sdlc:scan`, not from memory.

Model and levels: *AI-Native SDLC — strategy (v2)* and *implementation (v2)*,
September 2026. Six stages, each ending in an artefact the next one reads;
humans at the gates.

## The grid — 2026-10-07 (first fill)

| Stage | Level | Evidence | Gap to next level |
| --- | --- | --- | --- |
| **Intent** | L1 (partial) | Work items were written by hand as `plan.md` §-sections with an assistant and accepted by the owner, but with no declared type and not in a reusable shape. 20% of main's changes reference a `§`. `intents/` + templates + types exist as of §26 | L2: `/intent` drafts and validates the next items; stamped intents in `intents/` |
| **Design** | L1 | Design briefs in `plan.md` cite `docs/research/`; ambiguous rules get interpretation comments (CLAUDE.md convention). No `spec.md` produced yet | L2: a `/spec` pass that loads the rulebook + conventions as a versioned skill |
| **Build** | L1 → L2 for implement | `CLAUDE.md` context file; plans approved before code; versioned `heraklios-implementer` agent (Claude + Codex) works in isolated worktrees | L2: codified *plan* step (`/plan`), hooks that block unsafe actions (push, `git checkout --`, worktree deletion) |
| **Test** | L1 | `npm run verify` (build + lint + test) from §26; fresh-context adversarial reviewer re-runs it; failing-test-first for fixes; mutation testing per changed line. **No security check** | L1 complete: a dependency/security check in `verify`. L2: test files protected during fix tasks |
| **Deploy** | L1 | Written `REVIEW-POLICY.md` with tiers (§26); agentic review on every change has been the practice since Feature A; review report now lands in `intents/<id>/review.md` | L2: `/review` applies tiers from the policy automatically and writes stamped reports on every merge |
| **Maintain** | L1 (findings only) | Defects found by playing or by the fuzz harness become numbered "live defect" items (§15, §18, §20, §23, §25). No production monitoring: a static, offline browser game — monitoring is out of scope by choice | L2: a scheduled fuzz/soak run whose failures draft fix intents |

**Production release stays human by design**: pushing `origin/main` and
`scripts/update-stable.sh` remain manual gates at every level.

**Declared choices** (the scan can't see these — keep them on refresh):
- Maintain has no monitoring dimension: there is no server.
- Merges are local; the review report is a committed `review.md`, not a PR comment.

## The two we move — Q4 2026

1. **Intent → L2 (climb).** Run `/intent` on the next two work items —
   one fix (e.g. §19.5's stale `movementLeft` follow-up) and one feature —
   and accept them through the gates. That produces the first real intents
   to copy from.
2. **Deploy → L2 (climb).** Every merge from here goes through `/review`,
   producing a stamped `review.md` with a tier and verdict. Sample every
   fifth attested change.

**Infrastructure owed underneath** (counts as progress, not a detour):
the manual browser pass over seven shipped UI items listed in `plan.md`'s
Backlog Map. Until UI changes can be verified by more than `tsc` and code
review, `src/scenes/**` attestation is weaker than the policy makes it look —
the reviewer must list it under Not checked.

## Measures

Progress and outcome, never one without the other. Throughput is never read
without the revert rate beside it.

| Date | Window | Changes on main | Per week | Reference an intent/§ | Reverts | Intents (stamped) | Attested / reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-07 | 2026-07-16 (repo start) → 2026-10-07 | 74 | 6.2 | 20% | 0 (0.0%) | 0 (0) | — |

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
