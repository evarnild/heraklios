<!-- generated-by: heraklios/intent@0.1.2 -->
# §37 — Close §35's open review findings (untested i18n paths, one French term)

**Type:** fix
**Originator:** me (Eric), from §35's review: "create a new intent with
the low findings"
**Source:** `intents/35-game-languages/review.md`, round 2 → Findings (all
LOW) and round 1's items left open

## Problem

§35 (merged `9d3cf43`) shipped with LOW findings its review left open as
"worth a look". Five are paths its tests don't prove: the mutation pass
changed the code and every test still passed. One is a French wording
slip.

| # | Where (on `main` at `9d3cf43`) | What is wrong | Proof |
| --- | --- | --- | --- |
| 1 | `src/ui/i18n/names.test.ts:96`, `names.ts` `phaseName` | The French case asks for `'combat'`, spelled the same in both languages, so `phaseName` returning the raw phase id passes | mutant N6 survives |
| 2 | `src/ui/i18n/fr.ts:277` | "perd ${loss} d'équipage" drops the rulebook's "points": "perd 2 d'équipage" (`docs/research/05-rules-french-original.md:426-432` says "points d'équipage") | read |
| 3 | `src/ui/i18n/index.ts:53-56` `language()` | The page's `lang` is set on the first resolve, but no test checks it (it's checked only after `setLanguage`) | mutant I8 survives |
| 4 | `src/ui/i18n/en.ts:242` (and `fr.ts`'s twin) | An exchange with nothing sacrificed should say "none" / its French; the `|| 'none'` fallback is untested | mutant E6 survives |
| 5 | `src/ui/i18n/en.ts:330`, `fr.ts:315` `joinNames` | A draw between three or four players is untested in both languages | mutant E7 survives |
| 6 | `src/ui/i18n/noLiterals.test.ts:13` `CALLS`, `:133` | The scan doesn't read helper calls such as `this.button(x, y, 'label', …)` (`saveLoadPanel.ts`) or `buildRow(`, which is where several labels lived before §35, and it reads only the top level of `src/scenes/` and `src/ui/` | mutant NL4 survives |

## Outcome

- Each of mutants N6, I8, E6, E7 and NL4 (as written in §35's review,
  harness in its "Verified myself") fails at least one test.
- The French boarding report says "perd N points d'équipage", pinned in
  `reports.test.ts` (or `format.test.ts`).
- The literal scan reads helper calls that draw text (at least `button(`
  and `buildRow(`, by argument index) and recurses into subfolders of
  `src/scenes/` and `src/ui/`; it still passes on today's code with an
  empty pending list.

## Constraints

- Tests and one French string only: no game behaviour changes, no
  `src/engine/` or `src/data/` change.
- `fr.ts` is in `src/ui/**`, so a live check is owed by path (one glance
  at a French boarding report), unless `/review` finds the smoke-suite
  exception applies (it won't: no scenario runs in French).
- `noLiterals.test.ts` must keep its stale-entry check (an allow-list
  entry that no longer matches fails).
- Lint cap stays 21.

## Type-specific questions

### Fix
- **What broke:** §35's proof, not its behaviour: five paths its tests
  don't hold, and one French term that doesn't match the rulebook.
- **Since when:** §35, `9d3cf43`.
- **Impact:** none on games or saves today. A later change could break
  the page language on first load, the exchange or draw wording, or slip
  an untranslated button label past the scan, with every test green.
- **Reproduction:** apply mutants N6, I8, E6, E7, NL4 from §35's review
  (`review.md` round 1 → mutation table) and run `npx vitest run`: all
  pass.
- **The test that will fail first:** each new test fails against its
  mutant; for item 2, a `reports.test.ts` assertion of "points
  d'équipage" fails against today's `fr.ts`.

## Assumptions I made

- **Fix, `follows_up: 35`.** These are gaps §35 shipped with, so the scan
  should count them against §35's tier (Reviewed).
- **The e2e flake is not in here.** It is LOW in §35's review but not
  §35's change (seen in §33 too); the 2026-10-20 grid proposes it as its
  own fix intent, with a failing reproduction first.
- **Equivalent mutants stay out:** D12, N3, F5, E5, SE2 (unreachable or
  no behaviour change). So do mutants on the scenes, which no unit test
  reaches.
