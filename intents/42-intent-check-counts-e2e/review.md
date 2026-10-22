<!-- generated-by: heraklios/review@0.1.4 -->
# §42 review — check:intent counts e2e spec files as tests

verdict: attest
tier: attested
reviewed-commit: 7fec98c0b0af03318b9b2a387a8538f1e5829f29
round: 1
sampled: no
live-check: not-needed

Tier set by the path table: `scripts/**` is Attested, and `intents/README.md`
wording that changes no documented rule would be Automated; the highest wins.
The intent is a fix and nothing in it raises the tier.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — the diff is the plan's four subtasks and nothing more |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no game rule involved; the "rules" here are the checker's own, in `intents/README.md` |
| 4 | Tests prove the rule | pass — 8 mutants, all killed; the failing-first run reproduced |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | pass — 698 tests, 69 in the file, `3 failed \| 66 passed` all reproduced |
| 7 | Documentation | pass — one README sentence; `REVIEW-POLICY.md` untouched |
| 8 | Guardrails and hygiene | pass — 21 lint warnings = the cap, 0 errors; no dependency; all 6 changed files strict-decode as UTF-8 |
| 9 | Repository-specific footguns | not run — drift, AI tiers and map editor not touched |

## Type check
```
type-check: PASS (intent 42, fix)
  note:  2 file(s), 75 line(s) changed outside intents/.
```
This is the fix the checker could not pass for §40: its own tests are
`*.test.mjs`, so it passes on the old rule too.

## Findings
None.

## Not checked
- **A replay on §40's real git range.** The §40-shaped case in the new tests uses
  its real file list (`BoardScene.ts`, `PlacementScene.ts`, `devHook.ts`,
  `README.md`, two `e2e/*.spec.ts`), but as a fixture, not a `git diff
  --numstat`. §40's branch is deleted, so the end-to-end replay was not run.
  `check-intent.test.mjs` still drives the real CLI and passes inside `verify`.
- **Other suffixes.** `.spec.tsx`, `.spec.js` and `e2e/*.test.ts` do not count;
  the suite has none, and the plan keeps the predicate narrow on purpose. A
  future e2e file with another suffix would ROUTE again.
- **Windows path separators.** The predicate assumes forward slashes, as the
  existing ones do; `git diff --numstat` emits them. Not exercised with a
  backslash path.
- **`sdlc:scan`.** I did not check whether the scan counts tests anywhere with
  its own predicate; a grep of `scripts/` found `isTest` only in
  `intent-check-lib.mjs`.

## Live check
not needed — `scripts/**` is not on the live-check path list, and no
"Not checked" item is runtime behaviour in a browser or a hook. The check ran
for real on this branch (`check:intent` above).

## Verified myself vs. taken on trust
- At `7fec98c`, in the worktree: `npm run verify` → exit 0, 44 files, 698 tests,
  21 lint warnings (= the cap), 0 errors. `npm run check:intent` → PASS (above).
- Failing-first reproduced: I put `b4dc56e`'s library (before the change) back
  in place and ran `npx vitest run scripts/intent-check-lib.test.mjs` → `3 failed
  | 66 passed`, the three new cases named in the Progress entry; restored
  afterwards, tree clean. This confirms the Progress entry's note that the
  nested-spec case also fails (plan said two).
- Mutations, one per changed behavioural line, file backed up and restored
  byte-for-byte, harness asserts the file changed, `git status --short` clean at
  the end:
  - M1 drop the `^e2e/` prefix from `isE2eSpec`: killed (`docs/example.spec.ts` case).
  - M2 drop the `.spec.ts` suffix: killed (`e2e/helpers.ts`, `global-setup.ts` case).
  - M3 top-level only (`.+` → `[^/]+`): killed (nested-spec case).
  - M4 fix rule back to `isTest`: killed (2 cases).
  - M5 refactor deletion list back to `isTest`: killed (1 case).
  - M6 rule-code rule uses `testsTouched` instead of `unitTestsTouched`: killed.
  - M7 `countsAsTest` `||` → `&&`: killed (6 cases).
  - M8 `unitTestsTouched` forced `true`: killed (2 cases).
- Read the full diff: the library change is five lines; existing test cases are
  untouched (no removed line in `intent-check-lib.test.mjs`); the README sentence
  matches the plan and states that the check never reads test content.
- Taken on trust: nothing beyond the Not-checked list.
