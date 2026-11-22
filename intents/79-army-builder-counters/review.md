<!-- generated-by: heraklios/review@0.2.0 -->
# §79 review — The army builder shows each unit's original counter

verdict: attest
tier: attested
reviewed-commit: 6084354c04eb4319eae8258da98a23b6ce589514
round: 1
sampled: no
run: auto
live-check: owed

- **Tier.** The path table sets it from `src/scenes/**`, `src/ui/**`,
  `e2e/**`, `README.md` and `package.json`. The lint script only lowers
  `--max-warnings` (19 → 18), so it doesn't trigger Reviewed. The change is
  digital-only, and no finding is CRITICAL or HIGH.
- **Sampled.** `npm run sdlc:scan -- --sample-due auto --exclude 79`, run in
  the main checkout, printed `nth attested auto change = 13, every 3,
  sampled: no`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1, LOW): an unplanned `addAbandonButton` extraction, recorded in Progress |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass: no rule involved |
| 4 | Tests prove the rule | findings (3): helper mutants 10/10 killed; scene mutants 2/7 killed (S1, S2 and S5 are left to the live check by the plan); the new e2e doesn't detect column-major order on its own |
| 5 | Boundary and conventions | pass: the layout is a pure `src/ui` helper with a unit test; no GameState, save, undo or i18n change |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass: README sentence added in "2. **Army Builder**" |
| 8 | Guardrails and hygiene | pass: lint 0 errors and 18 warnings, cap 19 → 18 |
| 9 | Repo footguns | not applicable |
| 10 | Architecture | pass: principles 2, 5, 6, 12 and 15 |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 79, feature)
  note:  6 file(s), 361 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/scenes/ArmyBuilderScene.ts:151`: S1
  (`counterTextureKey(0, unit.id)`) survives. With it, every seat gets yellow
  counters.
  - The helper's key is proven (H6 is killed), but nothing automated proves
    which index the scene passes.
  - The spec accepts this (Out of scope: "A dev-hook reader for the counter
    images"). The live check's "player 2's counters are red" step is the only
    proof, so it must not be skipped.
  - Worth a look: a dev-hook image reader as a follow-up, now that §75 has
    merged.
- **LOW** `e2e/army-builder.spec.ts:73-112`: the new test doesn't detect
  column-major order on its own. S3 passed both new tests and was killed only
  by the §51 test's `'»', 3`.
  - Worth a look: click `'+', 1` and assert `fantassins` is 1.
- **LOW** `src/scenes/ArmyBuilderScene.ts:83,161,186`: other scene mutants
  survive.
  - S4 (bottom controls at main's y): benign.
  - S5 (`setOrigin(0, 0.5)` dropped): for the live check.
  - S7 (the `+` clamp, moved verbatim from main): a gap already there on
    main.
  - S2 (`setDisplaySize` removed): for the live check by plan.
  - Worth a look.
- **LOW** `src/scenes/ArmyBuilderScene.ts:120-143`: `addAbandonButton` is an
  extraction the plan didn't list. It is a verbatim move that brings
  `create()` under 80 lines so the cap could drop, and it is recorded under
  Progress → Divergence. No action needed.

## Not checked
- **Anything visual:**
  - the drawn counters and their size;
  - whether the numbers are legible;
  - how text fits in the default font;
  - vertical centring;
  - whether the error line overlaps Confirm.

  All of this is AC6, the live check.
- **Seat colour wiring.** S1 survives, so this is live check only.
- **Real rendered text widths.** These assume a 0.6 em monospace.
- **A stack of several error lines.** The plan argues the UI can't reach one.
- **Load-dependent interaction.** The earlier `placement.spec.ts` "Turn
  buttons" failure couldn't be reproduced: 4/4 on the branch and 2/2 on main.
  It is judged a pre-existing load flake, but that isn't proven.

## Live check
- **Owed** under rule 1 (`ArmyBuilderScene.ts`, `armyBuilderLayout.ts`). The
  change is new and visual, and it also covers the S1, S2 and S5 survivors.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/79-army-builder-counters`, run
     `npm run dev -- --port 5279 --strictPort --host 127.0.0.1`.
  2. Open http://127.0.0.1:5279/ at 100 % browser zoom. With the Menu in
     English, click `2`.
  3. In player 1's builder:
     - Each of the 14 rows shows its counter, in two columns of seven.
     - The four ships fill the bottom two rows: Galleys and Biremes, then
       Triremes and Quinqueremes.
     - The attack, defence and movement numbers are readable.
     - No name touches its cost.
     - The left `»` doesn't touch the right column's counter.
     - Name, cost, count and buttons are centred on the counter.
  4. Click `+` on Archers once. The error line appears and doesn't overlap
     "Confirm army".
  5. Click "Use default army", then "Confirm army". In player 2's builder,
     the counters are **red**.
  6. Abandon, switch to French, click `2`, and repeat step 3. Look closely at
     "Fantassins-Archers" and "10 pts  (max 10)", and check that "Valider
     l'armée" is right-aligned and on screen.
- **You should see:**
  - yellow counters for player 1 and red for player 2;
  - everything on the 1100×750 canvas with no overlaps, in both languages;
  - readable numbers.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 6084354. Exit 0, lint 0
  errors and 18 warnings (cap 18), 97 files, 1677 passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. PASS. Matches.
- **Coordinator, re-run:** `npm run e2e`. 33 passed (51.8s). Matches.
- **Coordinator, re-run:** the surviving scene mutants.
  - Method: each file was backed up and restored by copy; each mutant ran the
    full vitest suite plus `e2e/army-builder.spec.ts`.
  - S1, S2, S5 and S7: vitest 1677 passed and e2e 3 passed, so all survived.
  - S4: also survived (e2e 3 passed). My first form of S4 replaced
    `armyBottomY`'s object with a number and broke all three tests. That was
    a malformed mutant, so I re-ran it in the reviewer's form, `{ total: 538,
    error: 574, confirm: 538 }`.
  - `git status --short` was clean after. All five match the reviewer.
- **Reviewer:**
  - verify, check:intent and e2e with the same counts;
  - on main, the lint count was 19, with one warning on
    `ArmyBuilderScene.ts:29`, which the branch removes;
  - `git merge-tree` against main is clean, and the merged `package.json`
    keeps `--max-warnings 18`;
  - helper mutants H1–H10 all killed by `armyBuilderLayout.test.ts`;
  - scene mutants: S3 and S6 killed; S1, S2, S4, S5 and S7 survived;
  - the flake judgement;
  - the numbers in prose;
  - sampling.
- **Taken on trust:**
  - the implementer's earlier failing `placement.spec.ts` runs;
  - that §81 and §83 add no lint warnings;
  - everything visual.

## KonMari check
- **Outcome.** The record is 68e730c, against base 4a1979a. The outcome is
  `kept`. It tidied two commits:
  - 239833a: `drawRow` now takes `UnitType`, the import is on one line, and
    the comment no longer repeats `counterTextureKey`'s doc.
  - 5be86a9: the README sentence is re-wrapped.
- **Coordinator, re-run.** The killed scene mutants on the changed file,
  `ArmyBuilderScene.ts`, were run against `e2e/army-builder.spec.ts`. Both
  are still killed:
  - S3 (column-major index): 1 failed, the §51 test, as in the review.
  - S6 (reversed index): 3 failed.

  `git status --short` was clean afterwards.
- **Coordinator, re-run.** `npm run verify`: lint 0 errors and 18 warnings;
  97 files, with 1677 passed and 2 skipped. Matches.
- **Coordinator, re-run.** `npm run check:intent`: its only error is the
  owed live check.
- **Coordinator, re-run.** `npm run e2e`: 33 passed (52.7s).
- **Unchanged.** The H1–H10 mutants are untouched, since the layout helper
  didn't change. No ceiling or lint cap changed.
- **Reviewer's read** of the KonMari commits found nothing:
  - within reach: the import, signature and comment are §79's own lines;
  - behaviour is unchanged: `UnitType` is the element type of `UNIT_TYPES`;
  - no test changed;
  - no dependency or eslint-disable was added;
  - principles 5–12 hold;
  - konmari.md lists exactly the two tidy-ups.
