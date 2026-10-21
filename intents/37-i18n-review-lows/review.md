<!-- generated-by: heraklios/review@0.1.4 -->
# §37 review — Close §35's open review findings (untested i18n paths, one French term)

verdict: rework
tier: attested
reviewed-commit: 08ca311
round: 1
sampled: no
live-check: owed

Tier set by input 1 (paths): `src/ui/i18n/**` and tests are Attested;
nothing touches a Reviewed path, `review_tier` is empty, and the fix
implements no rule. `sampled: no`: the 4th attested review (§30, §33, §34
before it). The five untested paths are closed and proven. The French
term fix introduces a grammar error for the most common boarding result,
which needs a one-line rework.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — items 1 and 3–6 done as planned; item 2's wording is wrong when the loss is 1 (M1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — "points d'équipage" is the rulebook's term (`05-rules-french-original.md:426-432`); no rule changed |
| 4 | Tests prove the rule, not only pass | findings (1) — §35's survivors N6, I8, E6, E7, NL4 all killed; the new French loss line is pinned only for a loss of 3 (M1) |
| 5 | Engine/presentation boundary and conventions | pass — tests and one table string |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass — nothing documented changes |
| 8 | Guardrails and hygiene | pass — lint 0 errors / 21 warnings (cap 21); no new dependency |
| 9 | Repository-specific footguns | pass — none apply |

## Type check
```
type-check: PASS (intent 37, fix)
  note:  6 file(s), 95 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/ui/i18n/fr.ts:277` — the loss line is now `perd
  ${r.loss} points d’équipage`, so a loss of 1 reads "perd 1 points
  d’équipage". A loss of 1 is the boarding table's most common decisive
  result (`src/data/navalBoarding.ts`, 18 of the table's 36 decisive
  cells). The test pins only a loss of 3 (`reports.test.ts:136`). Needs
  rework: `point${r.loss > 1 ? 's' : ''}` (or "1 point" / "N points") and
  a `reports.test.ts` case with `loss: 1` expecting "perd 1 point
  d’équipage".
- **LOW** `src/ui/i18n/noLiterals.test.ts:183-191` — the subfolder test
  removes its temp tree before the `expect`, but not if `sourceFiles`
  throws, leaving a `scan-*` folder in the temp dir. Worth a look:
  `try { … } finally { rmSync(…) }`.

## Not checked
- **The French boarding report on screen.** Your live check is recorded
  (`08ca311`, "record live check"); the plan's steps needed a boarding
  in Combat test mode, and I don't know whether one came up. The
  `reports.test.ts` pins are the evidence for the text.
- **Other French plurals** with a number in them: not swept this round;
  §35's rounds read them, and `restant(s)` was fixed there. The one here
  was found by reading the boarding table.
- e2e runs English only, so it says nothing about `fr.ts`.

## Live check
- owed: rule 1 (`src/ui/**`: `fr.ts`). Recorded `live_checked:
  2026-10-21 by-agent` in `08ca311`. The rework changes `fr.ts` again, so
  the implementer clears it; the re-check is one glance at a French
  boarding report: `npm run dev -- --port 5237 --strictPort --host
  127.0.0.1` in the worktree → Menu → **Français** → **Mode test de
  combat** → board an enemy ship → the log says "perd 1 point
  d’équipage" or "perd N points d’équipage". If no boarding comes up, say
  so and the new test is the evidence.
- **Could be an e2e scenario?** No: this is wording, which is visual and
  stays a person's check even under §36's scenario.

## Verified myself vs. taken on trust
- `git log main..fix/37-i18n-review-lows`: `748f397` (fix), `08ca311`
  (live check). `status: in-review`.
- Read `git diff main...HEAD -- src/` in full (6 files).
- `src/data/navalBoarding.ts` `BOARDING_TABLE`: losses of 1 in 18 cells,
  2 in 13, 3 in 4, 4 in 1 (36 decisive cells of 42; counted by script).
- `npm run verify` (worktree, `08ca311`): lint 0 errors / 21 warnings
  (cap 21); Vitest 44 files, **692 passed**.
- `npm run check:intent`: PASS (above).
- `npm run e2e`: **4 passed** (18.6 s).
- Mutants with §35's harness (file backed up and restored byte for
  byte, `git diff` checked per mutant), same definitions as §35's review:
  N6, I8, E6, E7, NL4 — **all killed**, each by the new test named for
  it. `git status --short` clean afterwards.
- Taken on trust: your live check; the implementer's report that the
  French `|| 'aucun'` mutant is also killed (I ran the English one).
