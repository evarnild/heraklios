<!-- generated-by: heraklios/review@0.1.4 -->
# §38 review — The first e2e run after a cold start fails one scenario

verdict: attest
tier: attested
reviewed-commit: c4f4b75
round: 1
sampled: no
live-check: not-needed

Tier set by input 1 (paths): `playwright.config.ts` is build config
(Attested); `review_tier` empty; no rule. `sampled: no`: the 6th attested
review (§36 was the 5th and sampled).

**A partial close, on the owner's call** ("close on capture alone",
Progress). Delivered: intent outcome 3 (a failure names its scenario and
assertion and keeps a trace), proven below by a forced failure. Not
delivered: outcome 1 (cause found) and 2 (first run fixed). Nothing
reproduced in the implementer's runs. This review then caught a red run
with the new capture, and its trace gives the follow-up a starting point
(Findings, first item).

`check:intent` says ROUTE: "Declared fix, but no test changed." Reason:
nothing was reproduced, so there is no defect for a test to pin; the
change is the capture setting only, and the forced failure below is its
test.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — subtask 1 shipped; 2–5 stopped per the plan's Risks rule and closed on the owner's call; outcomes 1–2 open (L1) |
| 2 | Type check | ROUTE, reason above |
| 3 | Rulebook fidelity | not run — no rule |
| 4 | Tests prove the rule, not only pass | pass — forced failure: the scenario, file:line and assertion printed, `error-context.md` and `trace.zip` kept |
| 5 | Engine/presentation boundary and conventions | pass — config only |
| 6 | Numbers in prose | pass — Progress's throttling counts are the implementer's runs (taken on trust, below) |
| 7 | Documentation | findings (1) — a corrupted character in the new comment (L3) |
| 8 | Guardrails and hygiene | pass — lint 21/21; `test-results/` is gitignored (`.gitignore:22`), so traces are never committed |
| 9 | Repository-specific footguns | pass — no `retries` (intent → Constraints) |

## Type check
```
type-check: ROUTE (intent 38, fix)
  route: Declared fix, but no test changed. A fix carries a test so the defect cannot come back.
  note:  1 file(s), 4 line(s) changed outside intents/.
```

## Findings
- **LOW** (the open cause; worth a look: a follow-up intent) — this
  review's first `npm run e2e` in the §38 worktree, started seconds after
  the §40 session freed port 5232, failed **6 of 7** scenarios, all on
  the 30 s timeout in `startFromMenu`'s wait for the dev hook (55 s run).
  The new capture kept the traces. In
  `test-results/land-move-…/trace.zip`, the page got `/` (200) and
  `/@vite/client` (200), but `/src/main.ts` and
  `/node_modules/vite/dist/client/env.mjs` failed with
  **`net::ERR_NETWORK_IO_SUSPENDED`**, so the game never loaded. The next
  three runs passed 7/7. So a red first run can fail *before* any
  scenario logic, at the dev server. That fits "only first runs fail" and
  the 51 s run in §35's review better than the save-load race the plan
  tested. Two leads for the follow-up: (a) Chromium suspending network IO
  (a Windows power/efficiency-mode or sleep signal) while Vite answers
  its first, slowest requests; (b) **port 5232 is shared by every
  worktree's suite** (`playwright.config.ts`, `PORT = 5232`): during this
  review the §40 session's runs held it three times, and an overlapping
  start or teardown is one more way a first request can fail.
- **LOW** `playwright.config.ts:16` — `reporter: [['list'], ['line']]` runs
  two terminal reporters: the summary prints twice ("7 passed" ×2), and
  `list` alone already names a failing test with its file and line. Worth
  a look: `[['list']]` (or `line` alone).
- **LOW** `playwright.config.ts:15` — the comment's "§38" is saved as a
  lone Latin-1 byte `0xA7`, not UTF-8 (`C2 A7`), so it reads "(�38)" in
  an editor and in diffs. Worth a look.

## Not checked
- **The cause.** Not found by the implementer or by this review; the
  trace above is evidence, not a diagnosis. I didn't test lead (a) (power
  settings) or (b) (two suites on one port) on purpose.
- **A real fresh `/spawn` first run** (fresh `npm ci`, cold caches): not
  run by the implementer; this review's first run in the worktree is the
  nearest thing, and it failed (above).
- The implementer's CPU-throttling runs: taken on trust (not repeated).

## Live check
not needed — `playwright.config.ts` and intent files only; no path rule
applies, and the capture is proven by the forced failure, not by a person
looking at the game.

## Verified myself vs. taken on trust
- `git log main..fix/38-e2e-first-run-flake`: `c67d776`, `f92246c`,
  `c4f4b75`. `status: in-review`. `git diff main...HEAD`: 4 lines in
  `playwright.config.ts` plus intent files. Merges cleanly onto `main`
  (`git merge-tree`).
- `npm run verify` (worktree, `c4f4b75`): lint 0 errors / 21 warnings (cap
  21); Vitest 44 files, **692 passed**.
- `npm run check:intent`: ROUTE (above).
- `npm run e2e`: run 1 and 2 refused ("http://127.0.0.1:5232 is already
  used"; the holder was `heraklios-wt/40-naval-turn-buttons`'s Vite);
  run 3 — **6 failed, 1 passed (54.9 s)**; run 4 refused again; run 5 —
  **7 passed (15.4 s)**.
- Trace of run 3 (`land-move`), unzipped: network entries `/` 200,
  `/@vite/client` 200, `/src/main.ts` failed, `env.mjs` failed; console
  "Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED" ×2.
- Forced failure: `e2e/land-move.spec.ts:28` changed to expect
  `["x"]` (file backed up, `git diff` confirmed), `npx playwright test
  e2e/land-move.spec.ts` → exit 1, output "✘ … a land unit moves one hex",
  "Error: FORCED-FAIL", "> 28 | …", and
  `test-results/land-move-…/error-context.md` + `trace.zip`; file restored
  (`cmp` identical), `git status --short` clean.
- `playwright.config.ts` comment bytes read with `od -c`: `( 247 3 8 )`.
- Taken on trust: the implementer's throttling and fresh-state runs
  (Progress).
