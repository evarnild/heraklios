<!-- generated-by: heraklios/intent@0.1.2 -->
# §42 plan — `check:intent` counts `e2e/` spec files as tests

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Teach `check:intent` that `e2e/**/*.spec.ts` is a test, so a fix whose
failing-first test is an e2e scenario no longer ROUTEs as "no test changed", and
a refactor that deletes lines from an e2e scenario is flagged like one that
deletes unit-test lines. The "rule code changed with no test" rule keeps
requiring a *unit* test: that is the design question the intent left open, and
this plan settles it as the intent proposed (e2e counts for the fix and refactor
rules, not for the rule-code rule).

## Risks

- **Loosening the evidence.** `check:intent` is how a declared type is checked,
  so the change must only add `e2e/**/*.spec.ts`, never all of `e2e/`
  (`helpers.ts` and `global-setup.ts` are support code). A negative test pins
  that, and another pins that a `.spec.ts` outside `e2e/` does not count.
- **A touched spec is not a proven test.** Like a unit test today, an e2e spec
  counts when its file changed, whatever the change (a whitespace edit passes).
  The check has never read test content; the review's mutation pass is what
  proves a test. Say so in the README sentence, not by adding content checks.
- **Rule-code rule drifting.** The shortest edit swaps `isTest` for the wider
  predicate everywhere and silently lets an e2e-only change satisfy "rule code
  changed with no test change" (`:249`). A test pins that it still routes.
- **Windows paths.** Diff paths come from `git diff --numstat` with forward
  slashes; the predicate assumes them, as the existing ones do.

## Verified against the codebase

Re-read on `main` at `b856517` (no change to `scripts/`, `e2e/` or `intents/README.md` since `d64d489`):

- `scripts/intent-check-lib.mjs:114-116` — `isTest = /\.test\.(ts|mjs|js)$/`;
  `isRuleCode` and `isSource` use `!isTest(p)` but only match `src/…` paths, so a
  wider predicate cannot change them.
- `scripts/intent-check-lib.mjs:228-229` — `testsTouched = code.some(isTest)`,
  used by the fix rule (`:240-242`, "no test changed") and the rule-code rule
  (`:249-251`, "Rule code … no test change", for `feature` or `fix`).
- `scripts/intent-check-lib.mjs:243-247` — the refactor rule lists changed test
  paths with `deleted > 0` ("existing tests lost lines").
- `scripts/intent-check-lib.test.mjs:22-32` — `base()` builds a fix diff of
  `src/engine/drift.ts` + `drift.test.ts`; cases at `:105-109` (fix with no
  test), `:140-152` (refactor loses test lines), `:154-165` (feature, rule code,
  no test), `:227-250` (shape boundaries).
- `e2e/` holds `attacks`, `land-move`, `language`, `naval`, `placement`,
  `save-load` as `*.spec.ts`, plus `helpers.ts` and `global-setup.ts`
  (`ls e2e/`); Playwright's `testDir: 'e2e'` runs `*.spec.ts`.
- `vitest.config.ts:6` — `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`,
  so `npm test` and `npm run verify` run the new cases.
- `intents/README.md:46-48` — "a 'fix' with no test, a 'refactor' that deleted
  test lines" is the sentence that defines what the check looks for.
- Line numbers rot: re-check them before editing.

## Subtasks

Each is its own commit.

1. **Failing-first tests.** In `scripts/intent-check-lib.test.mjs` add, in the
   `describe('checkChange', …)` block or a new `describe('e2e specs count as
   tests', …)`:
   - *(fails today)* a fix whose diff mirrors §40's real one — `BoardScene.ts`,
     `PlacementScene.ts`, `devHook.ts`, `README.md`, `e2e/naval.spec.ts`,
     `e2e/placement.spec.ts` — has no `no test changed` route.
   - *(fails today)* a refactor with `{ path: 'e2e/naval.spec.ts', deleted: 3 }`
     routes `existing tests lost lines (e2e/naval.spec.ts)`.
   - *(passes today, pins the boundary)* a fix whose only test-looking change is
     `e2e/helpers.ts` or `e2e/global-setup.ts` still routes `no test changed`;
     so does a `docs/example.spec.ts` outside `e2e/`.
   - *(passes today, pins the design decision)* a `feature` or `fix` that changes
     `src/engine/combat.ts` plus only `e2e/naval.spec.ts` still routes
     `Rule code … no test change`.
   - *(passes today)* a nested spec, `e2e/sub/dir/x.spec.ts`, counts for the fix
     rule.
   Run `npx vitest run scripts/intent-check-lib.test.mjs` and confirm exactly the
   first two fail, with the "no test changed" and missing-route messages, before
   touching the library. Record the failure output in the Progress entry.
2. **The change.** In `scripts/intent-check-lib.mjs`: keep `isTest` as the unit-test
   predicate (still used by `isRuleCode`/`isSource`), add
   `const isE2eSpec = (p) => /^e2e\/.+\.spec\.ts$/.test(p)` and
   `const countsAsTest = (p) => isTest(p) || isE2eSpec(p)`. In `checkShape`:
   `testsTouched` (fix rule, `:228`) and the refactor deletion list (`:244`) use
   `countsAsTest`; the rule-code rule (`:249`) uses a separate `unitTestsTouched =
   code.some(isTest)`. Re-run the file: all new cases pass, the existing ones
   stay green untouched.
3. **Say what counts.** One sentence in `intents/README.md` (after the "a 'fix'
   with no test…" sentence, `:46-48`): a test is a `*.test.*` unit test or an
   `e2e/**/*.spec.ts` scenario, counted when the file changed, and engine/data
   rule code still needs a unit test. No other doc changes; `REVIEW-POLICY.md` is
   a Reviewed-tier file and stays untouched.
4. **Close out.** `npm run verify`, `npm run check:intent` (this fix's own tests
   are `*.test.mjs`, so it must PASS, not ROUTE), Progress entry, `status:
   in-review`.

Out of scope: reading test content, counting `src/**/*.spec.ts` or any other
suffix, the e2e suite's shared port (that is §41's), changing which paths are
`isRuleCode`, and anything in `REVIEW-POLICY.md`.

## Tests

- **Failing-first:** the §40-shaped fix case and the e2e-refactor case (subtask
  1), both failing against today's `isTest`.
- **Mutation contract** (each changed behavioural line, which test fails if it is
  reverted or altered):
  - `isE2eSpec` loses its `^e2e\/` anchor → the `docs/example.spec.ts` case fails.
  - `isE2eSpec` matches any file under `e2e/` (suffix dropped) → the
    `e2e/helpers.ts` / `global-setup.ts` case fails.
  - `isE2eSpec` matches only top-level `e2e/x.spec.ts` (`.+` → `[^/]+`) → the
    nested-spec case fails.
  - `testsTouched` goes back to `isTest` → the §40-shaped fix case fails.
  - the refactor deletion list goes back to `isTest` → the e2e-refactor case fails.
  - the rule-code rule uses `countsAsTest` instead of `unitTestsTouched` → the
    "engine code + only an e2e change still routes" case fails.
- Existing cases (`:105-165`, `:227-250`) must pass unchanged; none is edited.

## Validation

- `npm run verify` green (the lint cap does not rise).
- `npm run check:intent` PASS on this branch.
- Manual check: none — a script and its unit tests only; not a live-check path
  (`REVIEW-POLICY.md` → "Live checks": `scripts/**` is not listed).
- Replay: `checkChange` on the §40-shaped fixture returns PASS, where the same
  diff routed in §40's review (`intents/40-naval-turn-buttons/review.md`).

## Assumptions I made

- **The design split is the intent's default:** e2e counts for the fix and
  refactor rules, not the rule-code rule. Change it in this plan, not in code,
  if you want engine/data changes satisfiable by an e2e scenario alone.
- **Predicate is `^e2e/.+\.spec\.ts$`.** Playwright's default match is
  `*.spec.ts`; the suite's `testDir` is `e2e`.
- **No new dependency, no content inspection**, per the risks above.
- **Review tier is Attested** (`scripts/**`), no live check.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-22 - all four subtasks

Commits: intent accepted / plan approved; failing-first tests; the change in `scripts/intent-check-lib.mjs`; `intents/README.md` sentence (see `git log`).

Shipped: `isE2eSpec = /^e2e\/.+\.spec\.ts$/` and `countsAsTest`; the fix rule and the refactor deletion list use `countsAsTest`, the rule-code rule uses a separate `unitTestsTouched` (design split as planned). One sentence in `intents/README.md`. `REVIEW-POLICY.md` untouched.

Failing-first (`npx vitest run scripts/intent-check-lib.test.mjs`, before the library change): 3 failed | 66 passed (69).
- `does not route a fix whose failing-first test is an e2e spec`: expected 'Declared fix, but no test changed. A ...' not to match /no test changed/
- `routes a refactor that removed lines from an e2e spec`: expected '' to match /existing tests lost ... naval\.spec\.ts\)/
- `counts a nested spec`: same "no test changed" failure

Divergence: the plan predicted exactly two failures and listed the nested-spec case as passing today. It cannot pass today (nothing under `e2e/` counts yet), so three fail; no effect on the design.

Tests: after the change 69 passed in the file; `npm run verify` green, 698 tests in 44 files; `npm run check:intent` PASS (intent 42, fix).
