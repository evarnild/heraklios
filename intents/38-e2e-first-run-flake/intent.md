<!-- generated-by: heraklios/intent@0.1.2 -->
# §38 — The first e2e run after a cold start fails one scenario

**Type:** fix
**Originator:** `/review`, four times (§33 round 1, §35 rounds 1 and 2,
§37 round 2); owner: "create a follow-up intent for the low finding"
**Source:** `intents/37-i18n-review-lows/review.md` round 2 → Findings
(LOW); the 2026-10-20 grid's first proposed move

## Problem

`npm run e2e` fails one scenario now and then, and passes on a rerun.
`/review` runs the suite on every UI change, so a red run either sends a
review chasing a defect that isn't there or teaches it to rerun until
green. The second is worse: a real failure would get the same treatment.

What the reviews recorded:

| Review | First run | Reruns |
| --- | --- | --- |
| §33 round 1 | 1 failed (`save-load`, error not captured) | passed |
| §35 round 1 | 1 failed: `e2e/save-load.spec.ts:60` "the loaded game equals the one saved" | 1/1, 6/6, 12/12 |
| §35 round 2 | 1 failed, run took 51 s (normal ~15–18 s); scenario not captured | 4/4, 20/20 |
| §37 round 2 | 1 failed (14.7 s); scenario not captured | 4/4 ×3 |

Every failure came on the **first** `npm run e2e` in a worktree, right
after `npm run verify`; no rerun has ever failed (60+ runs). The named one
is `save-load`'s state comparison, which `withoutClock` already strips
of the ticking `elapsedMs` (`e2e/save-load.spec.ts:13-16`).

## Outcome

- The cause is found and written down, with a reproduction that fails on
  demand (not "1 in N").
- After the fix, the first `npm run e2e` in a fresh worktree passes:
  checked by `/review` from a fresh spawn, and by a reproduction that
  forces the cold state (e.g. `node_modules/.vite` removed) passing 5
  times in a row.
- A failing scenario always reports which scenario and assertion failed
  (Playwright's line reporter output kept by the review), so the next
  flake, if any, is captured the first time.

## Constraints

- No change to game behaviour. `e2e/`, `playwright.config.ts` and, if the
  cause needs it, `vite.config.ts` (which owes a live check by path —
  `REVIEW-POLICY.md` → "Live checks", rule 1).
- The suite must still never reuse a server already on 5232 (§32).
- No retries to hide it: `retries` in `playwright.config.ts` would turn a
  flake green without a cause, which is what this intent exists to stop.
  Allowed only if the cause is outside the game and is named.

## Type-specific questions

### Fix
- **What broke:** the first suite run after a cold start sometimes fails
  one scenario; reruns pass.
- **Since when:** first seen in §33's review (2026-10-20), after §32 added
  the suite. Not known whether §32's own runs hit it.
- **Impact:** no game or save is affected. Reviews lose trust in a red
  run; a real regression could be waved through as "the flake".
- **Reproduction:** to find. Leading hypothesis (from §37's review, not
  proven): on a cold start, Vite's dependency pre-bundling finds new
  dependencies on the first page load and reloads the page mid-test
  ("optimized dependencies changed. reloading"), dropping state a
  scenario relied on. The slow 51 s run fits it. First step: delete
  `node_modules/.vite`, run `npm run e2e`, and read the dev server's
  output.
- **The test that will fail first:** the reproduction above, made
  deterministic (cold cache) and run as the suite's first run; the fix
  makes it pass 5/5.

## Assumptions I made

- **Fix, no `follows_up`.** The cause is unknown, so no intent is named as
  its source; set `follows_up: 32` if the cause turns out to be in §32's
  suite setup.
- If the hypothesis holds, the likely fix is warming or pinning Vite's
  dependency optimisation for the e2e server (`optimizeDeps.include`, or a
  warm-up request in the global setup). That is the plan's call.
