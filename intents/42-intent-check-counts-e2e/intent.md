<!-- generated-by: heraklios/intent@0.1.2 -->
# §42 — `check:intent` does not count `e2e/` files as tests, so every fix with an e2e test ROUTEs

**Type:** fix
**Originator:** `/review` of §40 (rounds 1 and 2), LOW finding "`scripts/`"
**Source:** `intents/40-naval-turn-buttons/review.md` → Type check and Findings

## Problem

`npm run check:intent` decides whether a change "carries a test" with
`isTest = /\.test\.(ts|mjs|js)$/` (`scripts/intent-check-lib.mjs:114`). The
browser smoke suite (§32) lives in `e2e/*.spec.ts`, which that pattern never
matches. So a fix whose failing-first test is an e2e scenario gets:

```
type-check: ROUTE (intent 40, fix)
  route: Declared fix, but no test changed. A fix carries a test so the defect cannot come back.
```

even when it changed `e2e/naval.spec.ts` and added `e2e/placement.spec.ts`, both
recorded failing before the scene change (§40's Progress entry). Every such fix
has to explain a false ROUTE in its `review.md` and a reader has to trust the
explanation. Two other rules use the same predicate and are wrong for the same
reason: a refactor that deletes lines from an e2e scenario is not flagged
("existing tests lost lines", `:244`), and a change to `src/engine` or `src/data`
accompanied only by an e2e change still reads as untested (`:249`), which may or
may not be what we want (see the design question).

## Outcome

- A change that touches a file under `e2e/` ending in `.spec.ts` counts as
  having changed a test: a `fix` with only e2e test changes is `PASS`, not `ROUTE`.
- The refactor rule treats deleted lines in an `e2e/*.spec.ts` like deleted lines
  in a unit test.
- `scripts/intent-check-lib.test.mjs` pins the new behaviour, and the failing-first
  test is one of those cases.
- `REVIEW-POLICY.md` / `intents/README.md` say what counts as a test, if they
  currently imply `*.test.*` only.

## Constraints

- `scripts/**` is Attested (`REVIEW-POLICY.md` path table); `check:intent` is the
  evidence for the type a change declares, so the change must not loosen it: only
  `e2e/**/*.spec.ts` is added, not every file under `e2e/` (`helpers.ts`,
  `global-setup.ts` and any fixture are support code, not tests).
- The library stays free of git/fs calls (`intent-check-lib.mjs` header) so it
  remains unit-testable.
- No change to the game, to `e2e/`, or to what `npm run e2e` runs.

## Type-specific questions

### Fix
- **What broke:** `isTest` misses `e2e/*.spec.ts`, so a fix with an e2e
  failing-first test routes as "no test changed".
- **Since when:** §32 (`d4e5bd5`, "dev hook and the four smoke scenarios")
  introduced `e2e/` without teaching `check:intent`, so `follows_up: 32`.
- **Impact:** a spurious ROUTE on every e2e-tested fix; no game or save
  affected. Seen on §40; §38 and §41 are the next fixes likely to hit it.
- **Reproduction:** run `checkChange` (as `intent-check-lib.test.mjs` does) with
  `type: 'fix'` and a diff whose only changed path is `e2e/x.spec.ts`; it returns
  the ROUTE above. Or on any fix branch that changes only an `e2e/*.spec.ts`
  plus source.
- **The test that will fail first:** a new case in
  `scripts/intent-check-lib.test.mjs`: a `fix` diff of `src/scenes/BoardScene.ts`
  plus `e2e/naval.spec.ts` yields no `no test changed` route.

## Open design question

- Should an e2e change also satisfy the rule "Rule code in src/engine or
  src/data changed with no test change" (`:249`)? An e2e scenario drives the
  real game, so it plausibly proves a rule, but it is far coarser than a unit
  test and §32's own text calls the suite a smoke check. Default in this draft:
  **yes for the fix rule (`:240`) and the refactor-deletion rule (`:244`), no for
  the rule-code rule (`:249`)**, which keeps unit tests mandatory for engine and
  data changes. The plan should confirm that split.

## Assumptions I made

- **The second follow-up you meant is §41's.** The other open LOW from §40's
  review is the e2e suite's single fixed port (5232) colliding between sessions,
  which I hit twice during round 2. §41 (`intents/41-e2e-dev-server-first-load`)
  already lists it ("two worktrees can run `npm run e2e` at the same time without
  one breaking the other, or the second refuses cleanly"), so I did not draft it
  again. If you meant the README-scope LOW instead, it is benign and needs no
  intent.
- **Type is fix**, not adjustment: it changes `scripts/` logic, so it carries a
  test (≈2 files plus tests, but it is behaviour, and adjustments carry no rule
  code or tests by definition).
- `e2e/**/*.spec.ts` is the right predicate (Playwright's own default test
  match); `e2e/helpers.ts` and `e2e/global-setup.ts` stay non-tests.
