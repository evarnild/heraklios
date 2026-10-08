<!-- generated-by: heraklios/review@0.1.1 -->
# §26 review — AI-native SDLC kit — verify, lint, intents, review policy, skills, grid

verdict: rework
tier: reviewed
reviewed-commit: b3861a0
round: 2
sampled: no

Tier: **path table** → Reviewed (`REVIEW-POLICY.md`, `.claude/skills/**`, `.claude/agents/**`, `.codex/agents/**`, `eslint.config.js` touched again); `metadata.yml` `review_tier: reviewed` agrees. All 20 round-1 findings verified resolved in code. `rework` only for one new contradiction the rework introduced; fixed, round 3 would be `escalate`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — `fdbdf43..b3861a0` touches only scripts, docs, skills, agents, config; nothing in `src/` |
| 2 | Type check | pass (stated reason) — same three 1-line test edits as round 1 |
| 3 | Rulebook fidelity | not run — no rule behaviour changed |
| 4 | Tests prove the rule, not only pass | findings (1) — 26 lib mutants: 22 killed, 4 survived (2 equivalent; 2 real, `GATE_DATE_RE` anchors) |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | pass — window recorded; "12 new tests" (529→541) and "7 MEDIUM, 13 LOW" reproduce |
| 7 | Documentation | findings (2) |
| 8 | Guardrails and hygiene | pass — 0 errors, 21/21 warnings, cap unchanged; devDeps justified |
| 9 | Repository-specific footguns | pass — no `src/` change since round 1 |

## Type check
```
type-check: ROUTE (intent 26, refactor)
  route: Declared refactor, but existing tests lost lines (src/engine/combat.test.ts, src/engine/heuristicAgent.test.ts, src/engine/randomAgent.test.ts). Behaviour may have changed — check, or route to feature.
  note:  29 file(s), 2971 line(s) changed outside intents/.
```
Exit 2; accepted as in round 1.

## Round 1 findings — status
All 20 **resolved**, each re-probed (CLI `main` → FAIL; bare `--base` → clean error; `--base=X` honoured; named-branch mode read intent 27 from git; untracked probe file counted; `#` in quotes kept; non-date gates rejected). Round 1's claim that `#10-sequenced-queue` was a dead anchor was wrong — `plan.md` defines it.

## Findings
- **MEDIUM** `intents/_templates/metadata.yml` vs `scripts/sdlc-scan.mjs` and `/intent` — the per-tier follow-up count treated every `intents/<id>-…` link in a fix as "caused by", while the template calls it "related intent"; a fix linking a merely related intent would be charged to that intent's tier. Needs rework: dedicated key.
- **LOW** `intent-check-lib.mjs` `GATE_DATE_RE` — dropping `^` or `$` survives. Worth a look.
- **LOW** `check-intent.mjs` — with `--no-renames`, a pure test rename routes "tests lost lines". Worth a look: document it.
- **LOW** `check-intent.mjs` — a nonexistent branch crashes with a stack trace. Worth a look.
- **LOW** `sdlc-scan.mjs` — per-tier `changes` counts unmerged intents in `rework` and ignores the window. Worth a look.
- **LOW** `sdlc-scan.mjs` — reads the first `verdict:` in `review.md`; correct only if the current round's header is at the top. Worth a look.
- **LOW** `intent-check-lib.mjs` `stripComment` — an apostrophe in an unquoted value opens a quote, keeping a trailing comment. Worth a look.

## Not checked
- Mutants of the CLI's `source` / `ls-tree` / untracked-file paths and of the per-tier scan code (no tests; probed end to end instead).
- Per-tier follow-up and revert counts with real data (no fix intents or reverts exist yet).
- `refactor/27-parallel-sessions` (out of scope). Until §26 merges, checking §27 needs `--base refactor/26-ai-sdlc-kit`.
- `until` (UTC date) behaviour around local midnight.
- As round 1: no browser run, no byte-identity comparison against `main`.

## Verified myself vs. taken on trust
- `npm run verify` exit 0 — lint 0/21, vitest 32 files / 541 tests.
- `check:intent` ROUTE exit 2; `sdlc:scan` window 2026-07-16 → 2026-10-08, 74 changes, 6.15/wk.
- `git diff fdbdf43 b3861a0`: 19 files, +354/−55, read in full.
- 26 lib mutants (22 killed, 4 survived); lib backed up and restored with `cmp`, no `git checkout`, `git status --short` clean, §27 worktree untouched.
- Taken on trust: the external strategy documents and gate dates.

## Round 2 resolution
| Finding | Resolution |
| --- | --- |
| M · follow-ups read from `links:` | new `follows_up: <id>` key (template, `/intent`, `intents/README.md`, `REVIEW-POLICY.md`); scan reads only that key |
| L · `GATE_DATE_RE` anchors | `x2026-10-07`, `2026-10-07x`, `approved 2026-10-07` added to the rejected-gate cases |
| L · test rename routes | documented in `intents/README.md` as expected noise to explain in `review.md` |
| L · nonexistent branch | `git rev-parse --verify` first; one-line error, exit 1 |
| L · per-tier counts unmerged | only intents with a `merged:` hash whose commit date is inside the window count |
| L · first `verdict:` read | this file now keeps the current round's header at the top; earlier rounds below as history with their fields as list items |
| L · apostrophe opens a quote | a quote opens only at the start of a value; test added |

---

# Round 1 (history)


- verdict: rework
- tier: reviewed
- reviewed-commit: fdbdf4301b4f72af2c47e744e4013d831d3f8f4d
- round: 1
- sampled: no

Tier: **path table** → Reviewed (diff touches `REVIEW-POLICY.md`, `.claude/agents/**`, `.codex/agents/**`, `.claude/skills/**`, adds `eslint.config.js`); `metadata.yml` `review_tier: reviewed` agrees. Findings do not raise it further (already top). Verdict `rework` because findings need rework.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — diff matches plan subtasks 1–11; `src/` edits are exactly the 11 lint fixes the intent lists |
| 2 | Type check | pass (with stated reason) — ROUTE is legitimate: three 1-for-1 edits removing an unused binding/parameter; no assertion removed |
| 3 | Rulebook fidelity | not run — no rule behaviour changed |
| 4 | Tests prove the rule, not only pass | findings (2) — 7/22 lib mutants survived; CLI and scan scripts untested |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (1) — numbers reproduce; per-week figure depends on `Date.now()` |
| 7 | Documentation | findings (4) |
| 8 | Guardrails and hygiene | findings (2) — lint 0 errors / 21 warnings; new devDeps unjustified; warning cap not governed by policy |
| 9 | Repository-specific footguns | pass — `drift.ts` edited arms still `break`; fuzz determinism/soak green |

### Type check
```
type-check: ROUTE (intent 26, refactor)
  route: Declared refactor, but existing tests lost lines (src/engine/combat.test.ts, src/engine/heuristicAgent.test.ts, src/engine/randomAgent.test.ts). Behaviour may have changed — check, or route to feature.
  note:  28 file(s), 2771 line(s) changed outside intents/.
```
Exit 2. Route accepted: the "lost" lines are an unused import (`riverEdgeKey`; module still loaded via `RIVER_HEXSIDES`), an unused destructured name (`plateau`; call kept), and an unused `reduce` parameter — each 1 added / 1 deleted, no `expect` touched.

### Findings
- **MEDIUM** `scripts/check-intent.mjs` — positional `<branch>` ignored when `--base` absent (`baseIdx + 1 === 0` filters `args[0]`); `--base=X` ignored; bare `--base` crashes. Needs rework.
- **MEDIUM** `scripts/check-intent.mjs` — with a branch argument, diff comes from that branch but `intents/` metadata from the working tree. Needs rework.
- **MEDIUM** `REVIEW-POLICY.md` Reviewed row — the warning cap lives in `package.json`, not `eslint.config.js`, so raising it is only Attested. Needs rework.
- **MEDIUM** `.claude/skills/review/SKILL.md` vs `intents/README.md` — "only file you write is review.md" vs "set status: in-review". Needs rework.
- **MEDIUM** `plan.md` How To Manage — new bullet says metadata.yml is the status source of truth; old bullet says the Current Queue is. Needs rework.
- **MEDIUM** `REVIEW-POLICY.md` — claims `/grid` reports reverts/follow-ups per tier; nothing computes that. Needs rework.
- **MEDIUM** `.codex/agents/heraklios-reviewer.toml` — "Lead with PASS or FAIL" contradicts the policy's verdict vocabulary. Needs rework.
- **MEDIUM** `scripts/intent-check-lib.test.mjs` — 7/22 mutants survive (L59 `'[]'`, L129 `'null'`/`'~'`, L151 `>`→`>=` ×2, L158 `code.length > 0`, L162 `deleted > 0`→`> 1`); CLI and scan untested. Needs rework.
- **LOW** `intent-check-lib.mjs` — renamed paths (`{a => b}`) misclassified. Worth a look.
- **LOW** `intent-check-lib.mjs` — any non-empty string counts as a recorded gate (`TBD`, `no`). Worth a look.
- **LOW** `intent-check-lib.mjs` — `#` inside a quoted value is stripped as a comment. Worth a look.
- **LOW** `check-intent.mjs` — untracked files are not in the diff. Worth a look.
- **LOW** `intents/_templates/metadata.yml` — default `review_tier: attested` means Automated can never fire. Worth a look.
- **LOW** `.claude/skills/grid/SKILL.md` — `review-tier: automated` contradicts the policy's Reviewed for skills. Worth a look.
- **LOW** `docs/sdlc-grid.md` — measures window has no end date; scan doesn't print it. Worth a look.
- **LOW** `package.json` — four new devDependencies have no "why" line. Worth a look.
- **LOW** `CLAUDE.md` — still recommends `npx tsc --noEmit`; `BoardScene.ts` "~1600 lines" is stale (3059). Worth a look.
- **LOW** `CLAUDE.md` / `eslint.config.js` — guardrail list omits `max-depth`/`no-console`; cap counts warnings, not locations. Worth a look.
- **LOW** `README.md` — doesn't mention `npm run verify` / `npm run lint`. Worth a look.
- **LOW** `AGENTS.md`, Codex implementer — "plan.md section 10" is stale; the queue is "## Current Queue". Worth a look.

### Not checked
- Headless / AI-vs-AI byte-identity against `main` (couldn't build `main` without a checkout). `drift.ts` edits semantically identical by inspection.
- UI in a browser for `MapView.ts`, `MenuScene.ts`, `hexRender.ts` — behaviour-neutral by inspection only (`CameraManager.main` is a plain property; `ScaleManager.height` a pure getter; removed `LandCombatOutcome` was type-only).
- Mutants of `check-intent.mjs` and `sdlc-scan.mjs` (no tests; numbers checked by hand).
- ESLint ratchet on a real new warning (shown indirectly: `--max-warnings 20` exits 1).
- Whether skill frontmatter `metadata.*` keys are honoured by any tool.
- Whether the external strategy documents support the grid levels.

### Verified myself vs. taken on trust
- `npm run verify` exit 0 — lint 0/21, vitest 32 files / 529 tests.
- `check:intent` ROUTE exit 2; `sdlc:scan` 74 changes, 6.17/wk, 20%, 0 reverts — reproduced by hand from `git log --first-parent main`.
- `git diff --stat main...HEAD` 36 files +3053/−123; full `src/` diff read.
- CLI and lib probes as listed in findings; 22 lib mutants (15 killed, 7 survived), file backed up and restored, `git status --short` clean at end.
- Taken on trust: the external strategy documents and the "approved in conversation" gate dates.

### Round 1 resolution

All 20 findings addressed in the rework commit; round 2 re-checks them.

| Finding | Resolution |
| --- | --- |
| M · CLI positional/`--base` parsing | `parseArgs` in the lib, unit-tested; unknown flags, extra args and a valueless `--base` now fail with a message |
| M · branch arg read working-tree metadata | named branch's `intents/` read via `git ls-tree` / `git show` |
| M · warning cap not Reviewed | Reviewed row names `package.json` `--max-warnings` changes and new `eslint-disable` comments |
| M · `/review` vs README on `status` | `/review` writes only `review.md`; implementer sets `status`, review reports a mismatch |
| M · `plan.md` two sources of truth | old bullet reworded: queue mirrors `metadata.yml`, which wins |
| M · per-tier quality not computed | `sdlc:scan` counts changes / follow-up fixes (via `links:`) / reverts (via `§` in subject) per tier; `/intent` links fixes to their cause |
| M · Codex reviewer "PASS or FAIL" | now points at the policy's verdicts |
| M · 7 surviving mutants | boundary (5/6 files, 60/61 lines), `deleted: 1`, gate `~`/`null`/`TBD`/`no`/partial date/`[]`, artefact-only fix, `[]` value tests added |
| L · renames | `--no-renames` |
| L · non-date gates | gates must match `YYYY-MM-DD` |
| L · `#` in quoted values | quote-aware comment stripping |
| L · untracked files | counted in working-tree mode |
| L · template `review_tier: attested` | empty by default |
| L · grid skill tier | `reviewed` |
| L · grid window | end date recorded; scan prints its window |
| L · devDeps unjustified | "Dependencies" section in this intent's `plan.md`; policy says the intent's plan |
| L · `CLAUDE.md` `npx tsc`, ~1600 | `./node_modules/.bin/tsc`, ~3000 |
| L · guardrail list / cap semantics | `max-depth`, `no-console` listed; "counts warnings, not locations" in `CLAUDE.md` and `eslint.config.js` |
| L · README commands | `lint` and `verify` added |
| L · "plan.md section 10" | now "Current Queue". Note: the `#10-sequenced-queue` anchor is not dead — `plan.md` defines it with `<a id>` above the heading |
