<!-- generated-by: heraklios/intent@0.1.2 -->
# §37 plan — Close §35's open review findings (untested i18n paths, one French term)

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Each of §35's surviving mutants N6, I8, E6, E7 and NL4 fails a test; the
French boarding report says "points d'équipage"; the literal scan reads
the text helpers and every subfolder (intent items 1–6).

## Risks

- **A test that passes whatever the code does** — the very defect being
  fixed. Each new assertion is checked against its mutant before the
  commit (Tests below), and the result goes in Progress.
- **The scan going red on today's code** once it reads `button(` and
  `buildRow(`. Today every call passes `messages()…` (verified below), so
  it should stay green; if not, the hit is a real untranslated label and
  goes into `en.ts`/`fr.ts`, not onto the allow list.
- **Recursing into `src/ui/i18n/`** would scan the tables themselves. The
  scan must still skip `i18n/` and `*.test.ts`.
- **Global stubs leaking between tests** (`document`, `localStorage` via
  `vi.stubGlobal`) when testing the first resolve: the module keeps
  `current` in memory, so the test starts from
  `resetLanguageForTests()` (as `index.test.ts`'s store tests already do in
  `afterEach`) or it reads another test's language.

## Verified against the codebase

Re-read on `main` at `39fc578`:

- `src/ui/i18n/names.ts:30-32` `phaseName`; `fr.ts:44` `phases: { movement:
  'mouvement', combat: 'combat' }`; `names.test.ts:91-98` asks French
  `phaseName('combat')`.
- `src/ui/i18n/fr.ts:277` "perd ${r.loss} d’équipage"; pinned as
  "le défenseur perd 3 d’équipage" at `reports.test.ts:136`.
- `src/ui/i18n/index.ts:50-57` `language()` calls `applyToPage` on the
  first resolve; `index.test.ts:82-88` checks the page lang only after
  `setLanguage`.
- `src/ui/i18n/en.ts:241-242` and `fr.ts:225` `exchangeSacrificed`
  (`|| 'none'` / `|| 'aucun'`); `messages.test.ts:57` calls it only with a
  non-empty list.
- `src/ui/i18n/en.ts:133`, `:330` and `fr.ts:119`, `:315-318` `joinNames`
  ("A, B and C" / "A, B et C"); no test with three or four names.
- `src/ui/i18n/noLiterals.test.ts:13-21` `CALLS`; `:133-139`
  `sourceFiles()` reads only the top level of `scenes/` and `ui/` (the
  only subfolder today is `ui/i18n/`). `src/ui/saveLoadPanel.ts:74`
  `button(x, y, label, …)` (label = arg 2), `:153` `buildRow(slot, name,
  …)` (name = arg 1); every call at `:133-182` passes `messages()…`.

## Subtasks

One commit each, `npm run verify` green after each.

1. **French term (item 2).** `reports.test.ts:136` and `:139` expect
   "perd 3 points d’équipage" (fails first), then `fr.ts:277`. Only the
   loss line changes; the "3/4 -> 1/4 d’équipage" lines are a count of
   crew, not a loss, and stay.
2. **Tests (items 1, 3, 4, 5).**
   - `names.test.ts`: French `phaseName('movement')` is `'mouvement'`.
   - `index.test.ts`: with a stubbed `document` and storage holding `fr`,
     a fresh `language()` returns `'fr'` and sets
     `documentElement.lang` to `'fr'` without `setLanguage`.
   - `messages.test.ts` (or `reports.test.ts`): `exchangeSacrificed([])`
     ends "sacrificed none." / "sacrifié(s) : aucun.".
   - `gameOver.draw` with three names in both languages: "Draw between
     A, B and C!" / "Égalité entre A, B et C !".
3. **Scan (item 6).** Add `{ pattern: /\bbutton\(/g, argIndex: 2 }` and
   `{ pattern: /\bbuildRow\(/g, argIndex: 1 }` to `CALLS`; make
   `sourceFiles()` recurse, still skipping `ui/i18n/` and tests. A test
   of the scanner itself, on a small inline source, proves both (so it
   doesn't depend on a scene happening to contain a label).
4. **Hand-over.** Mutants N6, I8, E6, E7, NL4 from §35's review run with
   its harness against the new tests, results in Progress; `verify`,
   `check:intent`; `status: in-review`.

## Tests

| Item | New assertion | Mutant it must kill |
| --- | --- | --- |
| 1 | French `phaseName('movement') === 'mouvement'` | N6: `phaseName` returns `phase` |
| 2 | "perd 3 points d’équipage" | — (fails against today's `fr.ts`) |
| 3 | first `language()` sets `documentElement.lang` | I8: `applyToPage` removed from `language()` |
| 4 | empty exchange list → "none" / "aucun" | E6: `|| 'none'` removed |
| 5 | three-name draw, both languages | E7: `joinNames` for 3+ names |
| 6 | scanner finds `this.button(0, 0, 'Export to file', …)` in an inline source, and a literal in a nested folder | NL4: a literal label in `saveLoadPanel.ts`'s `button(` |

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- Live check (owed by path for `fr.ts`): `npm run dev -- --port 5237
  --strictPort` in the worktree → Menu → **Français** → Combat test mode →
  board a ship → the report says "perd N points d’équipage". If no
  boarding comes up, the `reports.test.ts` pin is the evidence and the
  review says so.

## Assumptions I made

- `fr.ts`'s other "d’équipage" uses (crew counts, "3/4 -> 1/4
  d’équipage") stay: they read as "of crew", which is right.
- The e2e flake stays out (intent → Assumptions).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-21 — build

One commit. `fr.ts` loss line now "perd N points d’équipage" (pinned in
`reports.test.ts`). New tests: `names.test.ts` (French `movement`),
`index.test.ts` (first `language()` sets the page lang), `messages.test.ts`
(empty exchange; 3- and 4-name draws). `noLiterals.test.ts`: `button(`
(arg 2) and `buildRow(` (arg 1) added, `sourceFiles` recurses (skips
`ui/i18n` and tests), `scanSource` split out and tested on inline source and
a temp tree. The scan stays green on today's code with an empty pending list.

Mutants, each run against `src/ui/i18n` and reverted: N6 (`phaseName`
returns the id), I8 (`applyToPage` removed), E6 (`|| 'none'` and `|| 'aucun'`
removed, each), E7 (`joinNames` drops the last name, en and fr), NL4 (literal
"Save" in `saveLoadPanel.ts`'s `button(`) — each fails one test. 692 tests,
`verify` green. Diverged: none. Live check still owed (French boarding report).
