<!-- generated-by: heraklios/review@0.2.0 -->
# §71 review — Record which intents must merge before another can be built (blocked_by)

verdict: rework
tier: reviewed
reviewed-commit: ba0099b5b4e20aafd81ebd54d8443bfc88c4e19f
round: 1
sampled: no
run: auto
live-check: owed

Tier is Reviewed by the path table (`.claude/skills/**`); `review_tier` is empty
and no finding raises it. `sampled: no`: the verdict is not `attest`.

The verdict is `rework` because four mutants survived. The spec decides each
fix, so all four are "Needs rework:". There is no "Needs decision:" finding.
The reviewer's mutation pass was stopped by Claude Code for low memory after 35
of 82 mutants; the 47 not run are listed under Not checked, and round 2 runs
them.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match (with fidelity to product-advice-agent `cc764da..3041c48`) | findings (2, LOW) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — no rule involved (SDLC tooling) |
| 4 | Tests prove behaviour | findings (4 survivors); partial: 47 of 82 mutants not run |
| 5 | Boundary and conventions | pass — no `src/` change; blocker logic pure in `scripts/blockers-lib.mjs`; git reads stay in the CLIs |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass — README, `intents/README.md`, the template, `CLAUDE.md`, `sdlc.md` |
| 8 | Guardrails and hygiene | pass — lint 21 warnings, cap 21, unchanged; no new dependency; the page writes through `textContent`/`setAttribute` (`app.js:9-22`) |
| 9 | Repository footguns | pass — none apply |
| 10 | Architecture | pass — principle 6 (`blockedRow` reuses `blockedText`), principle 15 (pure, tested); the `tools/` → `scripts/` import has precedent |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 71, feature)
  note:  28 file(s), 819 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `scripts/blockers-lib.mjs:24` — mutant B06 survives: the self
  check reduced to `id === String(selfId)` passes the suite. Spec B3: "ids are
  compared as numbers (`07` is `7`)". Needs rework: a `blockers-lib.test.mjs`
  case where `parseBlockers` of `- 018    me` with self id `18` gives the
  problem "an intent cannot block itself." and no items.
- **MEDIUM** `scripts/blockers-lib.mjs:86` — mutant B22 survives: a lexical
  smallest-id compare in `findCycles` passes, because the only tested cycle
  (§15/§17) sorts the same either way. Spec B11: a cycle starts "at its
  smallest id". Needs rework: `findCycles({ 9: ['13'], 13: ['9'] })` →
  `[['9', '13']]` (or the same through `blockerReport`).
- **MEDIUM** `scripts/check-intent.mjs:145` — mutant K02 survives:
  `d.startsWith(blockerId)` without the `-` passes, so blocker §9 could read
  `main`'s `96-…` folder. Spec B4: state comes from "`main`'s `metadata.yml`
  for it". Needs rework: an end-to-end `check-intent.test.mjs` case with §9
  open and §96 merged on `main`, expecting FAIL "is blocked by §9"; the same
  shape for `session-io.mjs:98` (`readBlockers`, mutant S06) through a spawn
  case.
- **MEDIUM** `scripts/blockers-lib.mjs:20` — mutant B03 survives: deleting
  `if (!m) continue;` passes, though without it a blank item would throw in
  queue, check:intent and spawn. Needs rework: a `blockers-lib.test.mjs` case
  `parseBlockers({ blocked_by: ['', '13    r'] }, '15')` → one item, no
  problems, no throw.
- **LOW** `intents/71-intent-blocked-by/plan.md:294,304` (Progress) — "1436
  before this work" does not reproduce (the diff adds 50 tests: 1470 − 50 =
  1420), and `spawn-intent.test.mjs` has 8 cases, not 7. Needs rework: correct
  the Progress entry (below the marker).
- **LOW** `scripts/spawn-intent.test.mjs:281` — a test name still starts
  `B3:`, though Progress says the source's prefixes were dropped and B3 means
  the parser here. Worth a look: drop the prefix.
- **LOW** `scripts/intent-check-lib.mjs:164` — an extra `@param …
  input.blockers` JSDoc line, a difference from the source that Progress does
  not list. Worth a look: one line in Progress.
- **LOW** `plan.md` Validation, live-check steps 1-2 — cannot be followed as
  written: `tools/orchestrator/orchestrator.mjs:41-44` refuses to start outside
  the main checkout or off `main`, and `scripts/queue.mjs` lists only intents
  committed on `main`. Worth a look; the plan is above its marker, so it is not
  edited. The Live check below gives steps that work.

## Not checked
- 47 of 82 mutants (the reviewer's run was stopped for low memory): K06
  (`check-intent.mjs`), S01-S08 (`session-io.mjs` `readBlockers`), P01-P07
  (`spawn-intent.mjs` `refuseIfBlocked`), Q01-Q19 (`queue-lib.mjs`), U01-U03
  (`queue.mjs`), T01-T03 (`state.mjs`), O01-O06 (`orchestrator-lib.mjs`). By
  reading, likely survivors: S05 (`readBlockers` catch returns `true`), S06
  (prefix match), P07 (`'no reason given'`), U01 (`mainMerged`). Round 2 runs
  them all.
- The orchestrator page (`app.js` row text and hover, the `#problems` section,
  Spawn's refusal, Auto's confirm): no test renders it — the live check.
- The suite on `main`, to confirm the "before" test count (memory).
- The `/auto` blocker stop in a real coordinator run (skill text, read only).
- e2e: not run and not needed — no `src/`, `e2e/` or `src/main.ts` change
  (`git diff --stat main...HEAD`).

## Live check
- owed: rule 3 — the orchestrator page renders the blocked text, the problems
  line, Spawn's refusal and Auto's confirm, and no test renders them.
- steps: the orchestrator runs only from a main checkout on `main`, and the
  queue lists only intents committed on `main`, so use a throwaway clone:
  1. `git clone C:/Users/eric/src/heraklios %TEMP%\h71`, then in it
     `git checkout -B main origin/feat/71-intent-blocked-by` and `npm ci`.
  2. In the clone, commit on `main` three scratch intents:
     `intents/97-scratch-blocked/metadata.yml` (`id: 97`, `slug:
     scratch-blocked`, `type: fix`, `status: accepted`, `auto_stopped:
     blocked by 66`, `blocked_by:` / `  - 66    scratch reason`);
     `intents/98-scratch-a/metadata.yml` (`blocked_by:` / `  - 99    a`);
     `intents/99-scratch-b/metadata.yml` (`blocked_by:` / `  - 98    b`).
  3. `npm run orchestrator -- --port 5298`, open http://127.0.0.1:5298/.
- you should see:
  1. a red line above the lists: `blocked_by cycle: §98 -> §99 -> §98.`;
  2. §97's row shows `blocked by §66` under its title; hovering shows
     `§66: scratch reason`;
  3. Spawn on §97, confirmed, shows `§97 is blocked by §66 (scratch reason),
     not merged into main. Ship §66 first.`, and no `fix/97-…` branch or
     worktree folder exists afterwards;
  4. Auto on §97 shows a confirm saying the run spawns only if every blocker
     is merged into main or the record is fixed, and otherwise stops again —
     cancel it;
  5. a real intent (e.g. §70) shows no blocked text.
  Afterwards stop the orchestrator and delete the clone.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` in the worktree at `ba0099b`:
  exit 0; lint 0 errors, 21 warnings (cap 21); 83 test files, 1470 tests
  passed. Matches the reviewer and the implementer.
- **Coordinator, re-run:** `npm run check:intent`: PASS (pasted above).
  Matches.
- **Coordinator, re-run:** the four surviving mutants, each backed up by copy,
  applied once, full `vitest run --bail 1`, restored by copy: B03 SURVIVED,
  B06 SURVIVED, B22 SURVIVED, K02 SURVIVED. A control (B05, self check off)
  was KILLED by `queue-lib.test.mjs` "broken records are problems naming the
  intent", so the harness runs the suite. `git status --short` clean after.
  All match the reviewer.
- Reviewer: orientation (merge-base `main` = `ef9b1aa`; only the 8 §71
  commits; nothing pushed); AC6 (`queue` output identical on the branch and on
  `main`, `problems: []`; check:intent on §66's and §70's branches PASS with
  either code); fidelity compared line by line against `git diff cc764da^
  3041c48` (pass 1 above); 35 mutants run, 31 killed (B01, B02, B04, B05,
  B07-B21, B23, C01-C07, K01, K03-K05), 4 survived (above).
- Taken on trust: the "before" test count; how the page renders (the live
  check); verify green at every intermediate commit.
