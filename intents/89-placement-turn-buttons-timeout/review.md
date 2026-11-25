<!-- generated-by: heraklios/review@0.2.0 -->
# §89 review — The placement Turn buttons scenario times out in full e2e runs under load

verdict: attest
tier: attested
reviewed-commit: e8b1b51
round: 2
sampled: yes
run: auto
live-check: not-needed

Round 1's findings are settled:

- **F1 (the quiet target):** decided by the owner ("/auto 89 accept the
  margin") and recorded as a plan amendment (`b4c7ed4`, `plan.md:127-131`).
  Round 1's measurements meet the amended target: quiet up to 10.8 s
  ("about 11"), loaded up to 14.5 s (under 15), and 14.5 × 2 = 29 < 30.
- **F3 (the stale header):** fixed in a comment-only commit (`2662748`). Since
  round 1, the only change outside `intents/` is that comment, `+3/−2`.

Everything re-ran green and mutant 1 is still killed. Nothing needs rework.
`sampled: yes` stands from round 1 (the 18th attested auto change), so a full
read of the diff is due after merge.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. F1 is settled by the owner's decision and the amendment; F3 is fixed as written. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass, carried. The §40 facing assertions (`:81`, `:83`) are unchanged. |
| 4 | Tests prove the rule, not only pass | pass. Mutant 1 re-run and killed; 1b and 3 carried as killed. |
| 5 | Boundary and conventions | pass. e2e and intent files only. |
| 6 | Numbers in prose | pass. The amendment's numbers match round 1; fresh runs fall in the same band. |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass (one LOW comment-width note, F4) |
| 9 | Repository footguns | pass (not applicable) |
| 10 | Architecture | pass |

## Type check
```
type-check: PASS (intent 89, fix)
  note:  1 file(s), 56 line(s) changed outside intents/.
exit: 0
```

## Findings
- **LOW (F2, carried)** `plan.md:152`: "Both facing assertions must fail" can't
  be met in one Playwright test. Each assertion is independently live:
  mutant 1 fails `:81`, mutant 1b fails `:83`. Worth a look only. The line is
  above the Progress marker, so any edit is the owner's.
- **LOW (F4, new, cosmetic)** `e2e/placement.spec.ts:8`: the rework's sentence
  was joined without re-wrapping. The line is 110 characters, where the
  header wraps at about 78. Lint passes and the content is correct. Worth a
  look; no rework.

## Not checked
- **A genuinely idle machine.** Other worktrees were active throughout.
- **A loaded `--repeat-each=5` this round.** Round 1's loaded figures carry
  forward.
- **The intent's literal five-run outcome.** The implementer's five loaded full
  runs are taken on trust; the reviewer and the coordinator each ran one full
  e2e.
- **Mutants 1b, 3 and 4** were not re-run. The code they target is unchanged
  since round 1.

## Live check
Not needed. The diff touches only `e2e/placement.spec.ts` (a comment, this
round) and intent files. No path rule applies, and no Not-checked item is
runtime game behaviour.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `e8b1b51`:**
- `git show --stat 2662748`: `e2e/placement.spec.ts | 5 +++--`, `plan.md | 9 +`.
  The spec change is only comment lines 6-8; the plan change is Progress, after
  the marker.
- `npm run verify`: exit 0, `✖ 18 problems (0 errors, 18 warnings)`, `Test
  Files 103 passed (103)`, `Tests 1751 passed | 2 skipped (1753)`.
- `npm run check:intent`: the PASS above.
- `npx playwright test e2e/placement.spec.ts --repeat-each=5`: `5 passed
  (33.4s)`, at 10.6, 10.9, 10.3, 10.8 and 4.4 s. A JSON-reporter run gave
  another 5 passes, at 8.8–12.6 s, with the land step at 3.8–5.1 s. The
  "exactly 400" assertion passed in all 10.
- **Mutant 1** (`clickButton(page, 'Turn', 1 - turn)` at `:34`): KILLED, `left
  Turn … Expected: 1 / Received: 5` at `:81`. Restored by copy.
- Full `npm run e2e`: exit 0, `46 passed (2.6m)`, placement in 11.6 s.
- Nothing pushed. `git status --short` clean.

**Coordinator, re-run, at `e8b1b51` (2026-11-25 11:06–11:13):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 18 problems (0 errors,
  18 warnings)`, `Test Files 103 passed (103)`, `Tests 1751 passed | 2 skipped
  (1753)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  89, fix)`, `note: 1 file(s), 56 line(s) changed outside intents/.`
  Matches.
- **Coordinator, re-run:** `npx playwright test e2e/placement.spec.ts
  --repeat-each=5`. `5 passed (28.1s)`. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `46 passed (1.9m)`. Matches.
- No surviving mutant, and no rework this round meant to kill one.

**Taken on trust:**
- the owner's words as quoted in `b4c7ed4`;
- the implementer's five loaded full runs and its "before" numbers;
- round 1's fill arithmetic and mutants 1b, 3 and 4.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 803162c
- round: 1
- sampled: yes
- run: auto
- live-check: not-needed

The fix works. Seat 0 buys a small, ship-heavy army through seven `»` fills
(8 land, 15 ships, 400 points, checked against the real engine), and the
scenario places 8 land units instead of 43. Under load it passes 5 of 5 at
8.6–14.5 s against the 30 s cap; with the old army under the same load it
times out 4 of 5. Both facing assertions are proven live, each by its own
mutant.

The verdict is `rework` because of one **"Needs decision:"** finding. The
plan's quiet target ("under 10 s") was missed, and the plan says a miss stops
for the owner; the implementer carried on. Amending that target, or taking the
plan's fallback, is the owner's call. There is also one mechanical comment fix.

`sampled: yes` (`sdlc:scan --sample-due auto --exclude 89`: "nth attested auto
change = 18, every 3, sampled: yes"), so a full read of the diff is due after
merge.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): the plan's own stop condition wasn't honoured (F1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. No rule changed; the §40 facing assertions are byte-identical. |
| 4 | Tests prove the rule, not only pass | pass. Every behavioural mutant is killed; F2 is about the plan's wording. |
| 5 | Boundary and conventions | pass. e2e only: no GameState, save, undo or dev-hook change. |
| 6 | Numbers in prose | findings (1): a stale route comment (F3). The diff's numbers reproduce. |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository footguns | pass (not applicable) |
| 10 | Architecture | pass. A test-only change in `e2e/`, as the plan's "Where this goes" says. |

### Type check
```
type-check: PASS (intent 89, fix)
  note:  1 file(s), 51 line(s) changed outside intents/.
exit: 0
```

### Findings
- **MEDIUM (F1)** `intents/89-placement-turn-buttons-timeout/plan.md:126` and
  `:164`: the quiet target was missed, and the plan wasn't stopped.
  - Subtask 3's target is "quiet under 10 s". The plan's Assumptions say a
    miss is "the decision to revisit; the plan then stops for the owner".
  - The implementer measured 4.7–11.4 s quiet and went on. The reviewer
    measured 3.8–10.8 s quiet, 2 of 5 over 10 s, on a machine that was never
    idle.
  - The intent's own outcome is met: "well under the 30 s budget … (e.g.
    under 10 s)". The worst loaded run was 14.5 s against the 30 s cap.
  - **Needs decision:** either the owner accepts the measured margin and the
    plan's target is amended (for example "quiet about 11 s on this machine,
    loaded under 15 s, at least 2× under the cap"), or the plan's fallback is
    taken: a test-mode shortcut, which adds `src/ui/testMode.ts` code and owes
    a live check. The reviewer and the coordinator recommend accepting.
- **LOW (F2)** `plan.md:147`: "Both facing assertions must fail" can't be met in
  one Playwright test, which stops at the first failed `expect`. Each
  assertion is independently live (mutants 1 and 1b below). If plan.md is
  amended for F1, the line can say "each assertion fails under its own
  mutant". Otherwise worth a look only.
- **LOW (F3)** `e2e/placement.spec.ts:6`: the header still says `Route: Menu "2"
  -> default army + "Confirm army" for each seat -> player 0's Placement`.
  **Needs rework:** say that seat 0 buys a small, ship-heavy army through the
  `»` fills (see "build armies") and seat 1 takes the default army. Comment
  only.
- **Info:** in the reviewer's full run, `save-load.spec.ts:57` failed once and
  passed alone. That is §86's flake, not this branch.

### Not checked
- **A genuinely idle machine.** Every "quiet" figure was taken with other
  worktrees active, so the plan's "under 10 s" can't be settled here (F1).
- **The intent's literal five-run outcome** (5 consecutive full runs green
  while another worktree runs `verify`). The reviewer ran one full e2e; the
  implementer's five runs are taken on trust.

### Live check
Not needed. The diff touches only `e2e/placement.spec.ts` and intent files, so
no path rule applies, and no Not-checked item is runtime game behaviour.

### Verified myself vs. taken on trust

**Ran by the reviewer, at `803162c`:**
- **The fill arithmetic**, with the real engine (`filledCount` in click order,
  then `validateArmy`): quintiremes 1, triremes 3, biremes 5, galeres 6,
  phalanges 5, elephants 2, archers 1, giving `{ land: 8, naval: 15, total:
  400 }` and `valid: true`.
- `npm run verify`: exit 0, `Test Files 103 passed (103)`, `Tests 1751 passed
  | 2 skipped (1753)`.
- `npm run check:intent`: the PASS above.
- **Quiet** `--repeat-each=5`: `5 passed`. Totals were 10.8, 10.4, 8.1, 8.8
  and 3.8 s; the "place land units" step took 1.1–4.7 s.
- **Loaded**, with `npx vitest run` alongside: `5 passed`. Totals were 13.7,
  14.5, 13.0, 12.5 and 8.6 s; the land step took 3.5–5.4 s.
- **Mutants**, each restored by copy:
  - **1** (`clickButton(page, 'Turn', 1 - turn)`): KILLED (`left Turn …
    Expected: 1 / Received: 5`).
  - **1b** (`placeShip(page, 0)` for `right`): KILLED (`right Turn …
    Expected: 5 / Received: 1`).
  - **3** (drop the `archers` fill): KILLED (`the small army costs exactly 400
    / Expected: 400 / Received: 395`).
  - **4** (seat 0 back to "Use default army", loaded): 4 of 5 `timedOut` at
    37.4–46.5 s, with the land step at 27.6–28.3 s. 1 passed at 18.8 s.
- One full `npm run e2e`: `45 passed, 1 failed` (`save-load.spec.ts:57`, which
  passed alone). Placement passed in 12.5 s.
- `git status --short` was clean at the end.

**Coordinator, re-run, at `803162c` (2026-11-25 10:46–10:53):**
- **Coordinator, re-run:** `npm run verify`. Exit 0, `✖ 18 problems (0 errors,
  18 warnings)`, `Test Files 103 passed (103)`, `Tests 1751 passed | 2 skipped
  (1753)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  89, fix)`, the same note. Matches.
- **Coordinator, re-run:** `npx playwright test e2e/placement.spec.ts
  --repeat-each=5`. `5 passed (29.5s)`. Matches.
- **Coordinator, re-run:** full `npm run e2e`. `46 passed (1.8m)`, with no
  failures. Matches; the reviewer's one save-load failure didn't recur.
- No mutant to re-run: none survived, and no rework this round is meant to
  kill one.

**Taken on trust:**
- the implementer's five loaded full runs;
- its "before" numbers (the reviewer's mutant 4 is an independent
  equivalent).
