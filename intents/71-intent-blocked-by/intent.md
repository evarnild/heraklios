<!-- generated-by: heraklios/intent@0.1.5 -->
# §71 — Record which intents must merge before another can be built (blocked_by)

**Type:** feature
**Originator:** the owner (2026-11-21), porting a piece of the SDLC kit back
from a sibling project.
**Source:** product-advice-agent §18 (commits `cc764da..3041c48`, in
`../product-advice-agent`), shipped in ai-sdlc-kit 0.4.0
(github.com/evarnild/ai-sdlc-kit, `template/`).

## Problem

A hard dependency between intents is recorded only in prose, and nothing
acts on it.

- **The evidence:**
  - `intents/64-vector-view/intent.md:52` says "**Depends on §65** … merged";
  - `intents/66-board-animations/intent.md:36` says "**Depends on §65 and
    §64**, merged first";
  - their `metadata.yml` `links:` lists those intents the same way it lists
    merely related work.
- **What doesn't read it:**
  - `npm run queue` doesn't show the dependency;
  - `npm run spawn` and `/auto` start a blocked intent;
  - `npm run check:intent` passes a branch built on an unmerged
    prerequisite.
- **The only guards today:** the owner remembering, or a `--base` stacked
  branch that nobody asked for.

heraklios is upstream for the rest of the kit, but it lacks this piece: the
kit has shipped it since 0.4.0.

## Outcome

- **The record.** `metadata.yml` gets a `blocked_by:` list, one hard
  prerequisite per line, as `<id>    <reason>`.
  - It is not a gate. Any agent drafting an intent, spec or plan may write it
    without the owner's yes.
  - Related work stays in `links:`.
- **Cleared only by a merge on `main`.** A blocker counts as cleared only
  when `main`'s `metadata.yml` for it has a non-empty `merged:`. What its own
  branch says doesn't count.
- **It holds back building, not drafting.**
  - `npm run spawn` refuses a blocked intent before creating anything. There
    is no override flag: editing `blocked_by` is the override.
  - `/auto` drafts the spec and plan, then stops before spawning with
    `auto_stopped: blocked by <n>`. It resumes once the blocker clears.
  - `npm run check:intent` FAILs a branch with an open direct blocker.
- **A broken record fails too:** an id found on no branch, a non-numeric id,
  or the intent's own id.
- **The queue shows it.**
  - `npm run queue` shows "blocked by §14 (§13)": the direct open blockers,
    then in brackets those reached through them.
  - It lists cycles and broken records under "Problems".
  - `queue --json` carries `blocked_by` and `blocked_by_open`.
- **Documented in:**
  - the skills: `/intent`, `/spec`, `/build-plan`, `/spawn` and `/auto`;
  - `intents/README.md` ("Who edits what");
  - the metadata template, `CLAUDE.md` and `sdlc.md`.
- **The orchestrator:**
  - a row shows its open blockers, read from `queue --json`;
  - its spawn and Auto buttons relay the scripts' refusal;
  - it refuses only through the scripts, with no rule of its own.

## Constraints

- **Port, don't redesign.** The sources are product-advice-agent commits
  `cc764da..3041c48`:
  - `scripts/blockers-lib.mjs` and its tests;
  - the changes to `queue-lib`, `queue`, `check-intent`, `intent-check-lib`,
    `session-io` and `spawn-intent`;
  - the skills.

  The same code is in ai-sdlc-kit's `template/`. Differences from the
  source are only those heraklios's own layout forces, each one named in the
  plan.
- **Where the logic lives.** The blocker logic stays pure in
  `scripts/blockers-lib.mjs`. Reading `main` stays in the CLI scripts.
- **Tests.**
  - heraklios's script tests run on Vitest, while the sources use
    `node:test` with `scripts/expect.mjs` and `each()`;
  - convert them to Vitest (`it.each`), and don't add `expect.mjs`.
- **No backfill.** Every intent named as a prerequisite today (§64, §65) is
  merged:
  - §65 at `209600f`, `intents/65-board-view-seam/metadata.yml:12`;
  - §64 at `bb782e3`, `intents/64-vector-view/metadata.yml:12`.

  The plan says so rather than adding records that would be cleared at once.
  The source's `blockers-backfill.test.mjs` has nothing to test here.
- **Out of scope:**
  - the load check counting finished experiments (store-sales-forecast §12);
  - §69's round cap;
  - the five-session limit.
- **Tier: Reviewed.** By the path table, `.claude/skills/**` is Reviewed;
  `scripts/**`, the docs and `tools/orchestrator/` come along.
- **Live check owed** for the orchestrator part: it is browser behaviour
  that only a live run shows (`REVIEW-POLICY.md` → "Live checks", rule 3).
  The scripts are covered by their tests.

## Type-specific questions

### Feature
- **Users:**
  - the owner, reading the queue and the orchestrator;
  - the coordinator, running `/spawn` and `/auto`;
  - the drafting skills, which write `blocked_by`.
- **Rulebook basis:** none. This is SDLC tooling, not a game rule.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - **Where the orchestrator display goes.** The orchestrator could show
    blockers in this intent or in a follow-up. Proposed: keep it here, since
    `queue --json` already carries the data and the refusals come free from
    the scripts.
  - **Interaction with the running intents.** §66 is mid-`/auto`, and §70 is
    an experiment branch. Neither declares a blocker, so the port must leave
    both unaffected. The spec confirms how `check:intent` treats a branch
    whose `metadata.yml` has no `blocked_by:` key.
  - **`/auto`'s resume table.** It gains a `blocked by <n>` row. The spec
    fixes where in `/auto`'s steps the check runs (after the plan, before
    spawn), and that the orchestrator's Auto button may resume it, since the
    stop needs no answer from the owner.

## Assumptions I made

- **Type: feature, not refactor.** It adds behaviour: refusals, a FAIL, and
  queue output.
- **The orchestrator display is kept in this intent,** as the owner
  proposed. The owner can split it out at acceptance.
- **`review_tier` is left empty.** The path table already gives Reviewed for
  `.claude/skills/**`, so there is nothing to raise.
- **The id is 71,** from `npm run queue -- --next-id`.
- **The ai-sdlc-kit checkout is not on this machine.** Only
  `../product-advice-agent` is. The port works from those commits, and the
  kit's `template/` is the cross-check.
