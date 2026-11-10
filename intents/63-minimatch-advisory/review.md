<!-- generated-by: heraklios/review@0.2.0 -->
# §63 review — npm audit clears the minimatch advisory in the lint toolchain

verdict: attest
tier: attested
reviewed-commit: 44f5f5d
round: 1
sampled: no
run: auto
live-check: not-needed

**Tier:** Attested, set by the path table: `package.json` and `package-lock.json` (build config). No `review_tier` is set in metadata, and no finding raises the tier.

**Verdict:** `attest`. There are 2 LOW findings, both "Worth a look"; none needs rework.

**How this round ran:**
- The `heraklios-reviewer` agent ran the ten passes.
- The coordinator re-ran verify, check:intent, the audit, the minimatch tree and the lint location comparison. Every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass (ROUTE, reason below) |
| 3 | Rulebook fidelity | not run: no rule behaviour; only toolchain dependencies changed |
| 4 | Tests prove it | pass. The planned mutation (remove `overrides`, `npm install`) brings back the 7 GHSA-g3hv-75wg-m249 entries and `minimatch@10.2.6`: killed. There is no unit test, by the intent's constraint |
| 5 | Boundary and conventions | pass: no `src/`, `server/` or test file touched |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass. Progress records why the override exists and when to remove it |
| 8 | Guardrails and hygiene | pass: lint is at 21 warnings with the cap at 21; the one new transitive dependency is named in the plan with its reason |
| 9 | Repository-specific footguns | pass: none apply |
| 10 | Architecture | pass: "Where this goes" names only `package.json` and the lockfile, with no layer or module change |

## Type check
```
type-check: ROUTE (intent 63, fix)
  route: Declared fix, but no test changed. A fix carries a test so the defect cannot come back.
  note:  2 file(s), 22 line(s) changed outside intents/.
```
**The ROUTE reason holds:**
- The intent forbids any test change ("No `src/`, `server/` or test change; `package.json` and the lockfile only").
- The defect is a vulnerable dependency, not code behaviour. A test asserting `npm audit` would depend on the network and on future advisories (intent, "The test that will fail first"; plan, "Tests").
- The before/after audit, the identical lint location hash and the killed mutation stand in for a failing-first test.

The type stays `fix`.

## Findings
- **LOW** `package-lock.json` (`node_modules/@isaacs/nonrecursive-glob-match`): the new transitive dependency resolved to 1.1.0, published 2026-11-05, so it is 5 days old.
  - §56's 14-day pin rule was applied to minimatch but not to this dependency. That rule covers direct pins, so this is not a breach as written.
  - If the owner wants the cooldown to cover transitive dependencies too, a nested override pinning 1.0.1 (2026-10-27) would apply it. That would be a plan change. Worth a look.
- **LOW** `intents/63-minimatch-advisory/plan.md`, "Verified against the codebase", "The pin": the plan calls `brace-expansion ^5.0.12` a new transitive dependency.
  - `brace-expansion@5.0.12` was already locked under typescript-estree on `main`; only the declared range changed.
  - Progress already corrects it. Worth a look.

## KonMari check
Not run. The step runs only when `plan_approved` falls after the date of §61's merge commit (`8190d41`, 2026-11-10; `/auto` step 5a). §63's `plan_approved` is 2026-11-10, which is on that date, not after it, so the run counts as started under the old rules. AC10 of §61 stays owed to a later run.

## Not checked
- **`npm ci`:** the reviewer ran it in the existing worktree (a wipe and reinstall), not in a freshly created one. Both read the same committed lockfile.
- **`npm run verify` on `main`:** not run. Its counts are inferred from the identical source tree (the merge base is `main`'s `2422251`); `main`'s lint locations were run and match.
- **`npm run e2e`:** not run. No `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` path changed.
- **Lint with a type-aware config:** not checked. The only code that calls minimatch, typescript-estree's `allowDefaultProject` path, never runs under this repo's non-type-checked config. A future switch to a type-aware config would exercise minimatch 11 for the first time.

## Live check
Not needed. The change touches only `package.json`, `package-lock.json` and intent files, so no path rule applies. The one runtime-only item, a real `npm ci` from the committed lockfile, was run.

## Verified myself vs. taken on trust
- **Coordinator, re-run (worktree at `44f5f5d`):**
  - `npm run verify`: exit 0; 79 test files, 1408 tests passed; 0 errors, 21 warnings, cap 21.
  - `npm run check:intent`: ROUTE, exit 2 (above).
  - `npm audit --json` totals: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`.
  - `npm ls minimatch`: 3.1.5 under eslint (three lines, as on `main`), and `minimatch@11.0.1 overridden` under typescript-estree.
  - The sorted eslint `file:line:col ruleId` list: on `main`, 21 entries, sha256 `ca567db026009da9179ba200a5f7187b78354751b613a769d8a10f0150e024ac`; on the branch, 21 entries and the same sha256.
  - `npm run sdlc:scan -- --sample-due auto --exclude 63`: sampled: no.
- **Reviewer:**
  - `npm audit` on `main`: 7 moderate entries, all GHSA-g3hv-75wg-m249.
  - The lockfile diff is exactly three hunks:
    1. the new `@isaacs/nonrecursive-glob-match@1.1.0` node;
    2. the nested minimatch going from 10.2.6 to 11.0.1;
    3. a dropped `"peer": true` on `picomatch`. That is npm normalising the lockfile: it happens with the override removed too.
  - typescript-estree's only minimatch call sits on the `allowDefaultProject` path (`dist/useProgramFromProjectService.js:41,244`), and `eslint.config.js` sets no project service.
  - Registry facts on 2026-11-10: estree 8.72.1 and 8.72.2 both declare `^10.2.2`; 11.0.1 is the newest minimatch 11.x at least 14 days old.
  - The pass-4 mutation, with both files restored by copy and `npm ci` run after.
  - `git status --short` was clean in both checkouts afterwards.
- **Taken on trust:**
  - the implementer's verify on `main` (79/1408);
  - the implementer's verify after its own `npm ci`. The reviewer re-checked only eslint and `tsc` after its `npm ci`; the coordinator's verify above ran after it.
