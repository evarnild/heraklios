<!-- generated-by: heraklios/review@0.2.0 -->
# §75 review — The dev hook is built from small groups, so a new reader is one plain line

verdict: attest
tier: attested
reviewed-commit: 922964a8c003d31c221b178c1bfa3edc5d1984cd
round: 1
sampled: no
run: auto
live-check: not-needed

`sampled: no`: `npm run sdlc:scan -- --sample-due auto --exclude 75` printed
"nth attested auto change = 11, every 3, sampled: no".

`installDevHook` is now four builders, spread into one object. The split
keeps the hook's behaviour:
- every member was compared against `main`;
- the five mutation points the brief named were mutated;
- verify, check:intent and e2e were run by both the reviewer and the
  coordinator.

Nothing needs rework. One LOW note concerns how the plan's size threshold was
applied.

The tests prove the refactor, they don't merely pass. Every mutant was killed.
The two type-clean mutants (M3, M4) were killed by e2e alone. The new
characterisation spec catches a dropped or renamed member even with tsc out of
the loop.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Subtasks 1–3 done in order: the characterisation spec at 0dacf43 touched only `e2e/` (no `src` diff from main), the split at 06dd196, Progress at ceabb6e. No unplanned scope |
| 2 | Type check | pass (PASS, refactor) |
| 3 | Rulebook fidelity | not run: no rule behaviour; a dev-only test hook |
| 4 | Tests prove the rule | pass: 5 of 5 mutants killed (below) |
| 5 | Boundary and conventions | pass: `src/ui` only; no `GameState`, history or save change |
| 6 | Numbers in prose | findings (1, LOW). Every number in Progress reproduced |
| 7 | Documentation | pass: README not affected; CLAUDE.md's description of `devHook.ts` still accurate |
| 8 | Guardrails and hygiene | pass: lint 0 errors and 19 warnings (cap 19, unchanged); no new dependency, `eslint-disable` or `innerHTML` |
| 9 | Repo footguns | pass: no drift or AI code; the hook is never in a production build (e2e global setup checks it) |
| 10 | Architecture | pass: principle 12 (builders grouped by theme), principle 13 met by structure (`installDevHook` 80 → 9 lines), no new layer |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 75, refactor)
  note:  2 file(s), 209 line(s) changed outside intents/.
```

## Findings
- **LOW** `intents/75-devhook-split/plan.md` ("Where this goes", and Progress).
  - **What the plan says.** It calls for a sibling module
    `src/ui/devHookReaders.ts` "only if `devHook.ts` would pass about 450
    lines".
  - **What happened.** `devHook.ts` is now 454 lines (392 on main). Progress
    reads the Risks bullet ("if it nears 500") instead, and doesn't record this
    as a divergence.
  - **Why no rework.** 454 is arguably "about 450", and the file is well under
    the 500 limit.
  - **Worth a look.** The next reader added here crosses 450 more clearly,
    and that is when the move to `devHookReaders.ts` is due.

## Mutants
Each mutant was applied to `src/ui/devHook.ts`, then tsc and the full e2e
suite were run, then the file was restored by copy.

| # | Mutant | tsc | e2e | Result |
| --- | --- | --- | --- | --- |
| M1 | drop `...viewReaders(),` (`:197`) | TS2739 | 4 failed: `dev-hook-members.spec.ts:41`, `board-animations.spec.ts:38`, `:61`, `board-view.spec.ts:41` | killed |
| M2 | rename `tooltipText` → `tooltipTxt` (`:328`) | TS2561 | 5 failed: `dev-hook-members.spec.ts:41`, `unit-tooltip.spec.ts:35`, `:61`, `:82`, `:113` | killed |
| M3 | `idle: () => true` (`:278`) | clean | 4 failed: `attacks.spec.ts:29`, `board-animations.spec.ts:38`, `:101`, `rules-panel.spec.ts:64` | killed (e2e only) |
| M4 | `mapScene` matches `Board` only (`:209`) | clean | 4 failed: `board-view.spec.ts:103`, `placement.spec.ts:39`, `undo-shortcuts.spec.ts:87`, `unit-tooltip.spec.ts:82` | killed (e2e only) |
| M5 | drop `tooltipBox` (`:329`) | TS2741 | 2 failed: `dev-hook-members.spec.ts:41`, `unit-tooltip.spec.ts:113` | killed |

No mutant survived. The other changed lines rewrite `mapScene()`, `board()`
and `buttons()` mechanically, so that they take `game`. Each was compared with
`main` by eye and found identical.

## Not checked
- **Members that no e2e scenario reads.** They are proved only by tsc and the
  member-name spec. Each body was compared with `main` by eye instead.
- **`idle`'s late binding.** `idle` used to call `hook.busy()`, and it now
  calls a local `busy`. The two differ only if something reassigns
  `window.__heraklios.busy`. A grep of `e2e/` and `src/` finds nothing that
  does. Scripts outside those folders were not checked.
- **Whether a production build contains the hook.** This rests on
  `e2e/global-setup.ts`, which ran in both e2e runs.
- **The branch base.** The branch is based on `a12a632`. The commits on `main`
  since then touch only `intents/76`, `intents/77` and `intents/79`
  (`git diff a12a632 main -- src/ui/devHook.ts e2e` is empty). Nothing was run
  against a rebased tree; `/ship` does that.

## Live check
- **not-needed.** It is owed by rule 1 alone (`src/ui/devHook.ts`).
- **Why the smoke suite stands in.** The change is neither new behaviour nor
  visual: it is a dev-only test hook that is never in a production build.
- **The named scenarios that cover it:**
  - `e2e/dev-hook-members.spec.ts`: the member set;
  - every scenario's `waitIdle`, for example `attacks.spec.ts`,
    `board-animations.spec.ts` and `rules-panel.spec.ts`: `idle`/`busy`;
  - `placement.spec.ts`, `board-view.spec.ts:103`, `undo-shortcuts.spec.ts:87`
    and `unit-tooltip.spec.ts:82`: `mapScene`'s Placement readers;
  - `unit-tooltip.spec.ts`: `tooltipText`/`tooltipBox`.
- **The runs.** The reviewer's own `npm run e2e` at 922964a gave 32 passed
  (1.2m). The coordinator's run gave 32 passed (1.6m).

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 922964a. Exit 0. Lint 0 errors
  and 19 warnings (cap 19). 96 test files; 1670 tests passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. `type-check: PASS (intent
  75, refactor)`. Matches.
- **Coordinator, re-run:** `npm run e2e`. 32 passed (1.6m), after waiting for
  another worktree's run to free port 5232. Matches.
- **Coordinator:** no surviving mutant to re-run. `git status --short` was
  clean after.
- **Reviewer:**
  - verify, check:intent and e2e with the same counts as above;
  - M1–M5 as in the table;
  - function lengths by eslint's rule: `installDevHook` 9, `sceneReaders` 17,
    `boardReaders` 49, `mapReaders` 40, `viewReaders` 6; 80 on main;
  - `devHook.ts` is 454 lines (392 on main);
  - 31 interface members, all pinned;
  - the old and new bodies compared member by member;
  - both packing comments are gone;
  - the characterisation commit 0dacf43 has no `src` diff from main;
  - `sdlc:scan` sampling.
- **Taken on trust:**
  - Progress's statement that the characterisation spec passed on the
    unsplit hook. Its `src` is identical to main's, so this is low risk.
  - The historical line and member counts quoted from older commits.
