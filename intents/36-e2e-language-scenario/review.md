<!-- generated-by: heraklios/review@0.1.4 -->
# §36 review — A smoke scenario for the language switch

verdict: attest
tier: attested
reviewed-commit: b4054bb
round: 1
sampled: yes
live-check: not-needed

Tier set by input 1 (paths): `e2e/**` and `README.md` wording are at
most Attested (tests-only); `review_tier` is empty; no rule. No finding
raises it. **`sampled: yes`**: counting the attested reviews in
`intents/*/review.md` (§30, §33, §34, §37's round 1, this one), §36 is the
5th, so a full post-merge read of the diff is due (95 lines).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — B1–B7 as specified; the `collectErrors` move is the planned one; step 5 reloads to reach the Menu (the Board has no route back), declared in Progress |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule |
| 4 | Tests prove the rule, not only pass | pass — AC2's four mutants plus one more, each killed by the new scenario alone |
| 5 | Engine/presentation boundary and conventions | pass — no game or hook change |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass — `README.md:36` names the new scenario |
| 8 | Guardrails and hygiene | pass — lint 0 errors / 21 warnings (cap 21), the new file linted and type-checked by `verify` |
| 9 | Repository-specific footguns | pass — the English pin is a one-shot write, not an init script, so the reload step proves the store |

## Type check
```
type-check: PASS (intent 36, feature)
  note:  3 file(s), 95 line(s) changed outside intents/.
```

## Findings
None.

## Not checked
- **Chromium only**, like the rest of the suite (`playwright.config.ts`).
- **The French Board** is proven by one button label ("Fin de phase");
  the log and prompts aren't reachable through the hook. §35's unit
  tests cover the tables; the scenario proves the Board reads them.
- **Fit and wording of French** — visual, out of scope (spec).
- The existing scenarios after the `collectErrors` move: proven only by
  their passing (7/7), not by a mutant on the helper.

## Live check
not needed — `e2e/**` and `README.md` only; no path rule applies and
nothing in Not checked is runtime behaviour a person must see. From here,
a change whose live check is owed by path alone and whose changed
behaviour is the switch, its memory, the locale default or the page
`lang` can name `e2e/language.spec.ts` (spec → Interpretations).

## Verified myself vs. taken on trust
- `git log main..feat/36-e2e-language-scenario`: `b4054bb`. `status:
  in-review`. Read `git diff main...HEAD -- e2e README.md` in full.
- `npm run verify` (worktree, `b4054bb`): lint 0 errors / 21 warnings
  (cap 21); Vitest 44 files, 687 passed.
- `npm run check:intent`: PASS (above).
- `npm run e2e`: **7 passed** (17.5 s), 5 files.
- `npx playwright test e2e/language.spec.ts --repeat-each=5`: **15
  passed** (AC3).
- Mutants, each run with `npx playwright test e2e/language.spec.ts` only
  (file backed up and restored byte for byte, `git diff` checked):
  | Mutant | Result |
  | --- | --- |
  | `setLanguage` doesn't write the store | killed — switch test (reload) |
  | `resolveLanguage` ignores `navigator.language` | killed — `fr-FR` test |
  | `applyToPage` sets nothing | killed — switch and `fr-FR` tests |
  | Menu switch without `scene.restart()` | killed — switch test |
  | stored choice ignored (extra) | killed — switch test (reload) |
  `git status --short` clean afterwards.
- Taken on trust: nothing beyond the implementer's Progress narrative.
