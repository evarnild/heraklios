<!-- generated-by: heraklios/review@0.1.5 -->
# §61 review — The SDLC keeps the architecture good with written principles, import rules, a size budget, a review pass and a KonMari tidy-up step

verdict: rework
tier: reviewed
reviewed-commit: b4dfa91
round: 1
sampled: no
run: auto
live-check: not-needed

**Tier:** Reviewed, set by the path table: `REVIEW-POLICY.md`, `.claude/skills/**` and `.claude/agents/**`.

**Verdict:** `rework`, with 1 HIGH, 3 MEDIUM and 6 LOW. Three findings are "Needs decision:" (F1, F4 and F6), so the auto run stops for the owner.

How this round ran:
- The `heraklios-reviewer` agent ran the passes under the nine-pass policy on `main`, which is the policy in force for this merge. It also applied the branch's new pass 10 informally.
- The coordinator re-ran verify, check:intent and every surviving mutant, and all results match.
- The memory-pressure reaper killed the reviewer's mutation run after 37 of 87 mutants. The 50 it didn't run are listed under Not checked, and are owed next round.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): F1, the KonMari design blocks the merge rule. Everything else maps to a B. The extra `noServer` patterns on `ui`, `scenes`, `map-editor` and `src/*.ts` go beyond B3 but follow principle 3 |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: SDLC tooling, no rulebook behaviour |
| 4 | Tests prove it | findings (2): 6 surviving mutants (F2), and the check-intent budget wiring is untested (F3). 50 mutants were not run |
| 5 | Boundary and conventions | pass: no `src/` or `GameState` change |
| 6 | Numbers in prose | pass. `npm run size:baseline` is byte-identical to `scripts/size-baseline.json`, and the `wc -l` counts reproduce |
| 7 | Documentation | findings (3): F4, F8, F10 |
| 8 | Guardrails and hygiene | pass. 0 errors and 21 warnings, cap still 21. The new rules are errors. No new dependency |
| 9 | Repository-specific footguns | pass, not applicable |
| 10 | Architecture (branch, informal) | findings (2): F3 (principle 15, untested glue) and F5. The pass's text is otherwise coherent |

## Type check
```
type-check: PASS (intent 61, feature)
  note:  25 file(s), 1143 line(s) changed outside intents/.
```

## Findings
- **HIGH F1.** Any intent that runs the KonMari step can't be shipped.
  - **Where:** `.claude/skills/konmari/SKILL.md` §5-6, `.claude/skills/auto/SKILL.md` §5a, `scripts/ship-lib.mjs:98-102`, and `REVIEW-POLICY.md` → "Merging" rule 1.
  - **Why:** merge rule 1 and `checkPreconditions` allow only `review.md` and `metadata.yml` to differ after `reviewed-commit`. KonMari's commits, `konmari.md` and any revert commits all land after that commit. `/konmari` §5 appends to `review.md` and "never rewrite", so `reviewed-commit` never moves.
  - **Effect:** `konmari.md` alone trips `unreviewed-changes`. The outcomes `kept`, `discarded` and `nothing to tidy` all leave `/auto` stopped at "ship dry-run blocked".
  - **Needs decision:** pick one:
    - (a) the KonMari check updates `reviewed-commit` to the post-KonMari head. This contradicts "append, never rewrite".
    - (b) merge rule 1 and `checkPreconditions` also accept `konmari.md` and the commits it lists. This is a `REVIEW-POLICY.md` change, with a `ship-lib` test.
- **MEDIUM F2.** B6/AC2 is only partly proved: 6 mutants survive.
  - **Where:** `scripts/architecture-rules.test.mjs`.
  - **What's missing:**
    - no forbidden case for `src/data` importing the server, which is a B3 rule;
    - none for the extra `noServer` on `ui`, `scenes`, `map-editor` and `src/*.ts` (`eslint.config.js:96`, `:100`, `:106`, `:110`);
    - none for `'phaser/**'` (`:42`).
  - **Needs rework:** add forbidden cases where:
    - `src/data/x.ts`, `src/ui/x.ts`, `src/scenes/x.ts` and `src/map-editor/x.ts` each import `../../server/saveApi`;
    - `src/main.ts` imports `../server/saveApi`;
    - `src/engine/x.ts` imports `phaser/src/x`.
- **MEDIUM F3.** AC4 diverges, and the `check:intent` budget wiring is untested.
  - **Where:** `scripts/check-intent.mjs:94-140`.
  - **What's missing:** AC4 asks for tests "with an injected file reader and git runner". The lib tests take pure maps instead. The sandbox repo in `check-intent.test.mjs` has no `size-baseline.json`, so the budget always skips there.
  - **What that leaves untested:** `measureBudgeted` in both modes, the `cat-file --batch` path, the skip when neither side has a baseline, the joins into `errors` and `routes`, and the read of `plan.md`.
  - **Needs rework:** add end-to-end cases to `check-intent.test.mjs`, with a baseline committed on the sandbox's `main`:
    - a branch growing a budgeted file past its ceiling fails, in branch mode and in working-tree mode;
    - the same branch with a `budget:` line under "Where this goes" passes;
    - an over-budget adjustment routes.
- **MEDIUM F4.** A discarded outcome can be reported as `not run`.
  - **Where:** `scripts/ship-lib.mjs:183`, against `.claude/skills/konmari/SKILL.md` §6 and B18.
  - **Why:** B18 says `outcome: discarded` "with the reason". `konmariLine` only matches `^outcome:\s*(kept|discarded|nothing to tidy)\s*$`, so `outcome: discarded — verify failed` prints `konmari: not run`.
  - **Needs decision:** either the reason goes on its own `reason:` line, stated in the skill and the agent's record format, or the regex accepts trailing text.
- **LOW F5.** Pass 10 leaves out principle 1's judged half (no browser APIs in the engine). `docs/architecture.md` marks it *Judged*, but pass 10 calls principles 1-4 Enforced.
  - **Needs rework:** add it to pass 10's list. B11 says "the Judged principles".
- **LOW F6.** The tooling rule covers only six globs (`eslint.config.js:86-111`). B5 says "no file under `src/`". Because the blocks are disjoint, a future `src/<newdir>/` gets no rule.
  - **Needs decision:** either record in `docs/architecture.md` that a new `src/` folder needs its own block, or add a catch-all block.
- **LOW F7.** `scripts/size-budget-lib.mjs:35` is dead code: line 32 already excludes `e2e/`. Worth a look.
- **LOW F8.** The `CLAUDE.md` Commands list lacks `npm run size:baseline`. Rule 5's ratchet makes every shrinking change run it with `--write`.
  - **Needs rework:** add the line.
- **LOW F9.** It isn't clear who commits `konmari.md`. If the agent commits it inside a `§<id> konmari:` commit, the discard `git revert` deletes the record that the step then marks `discarded`.
  - Worth a look: commit the record separately.
- **LOW F10.** In `sdlc.md`, step 5 still says "attest or escalate — go to step 6", and 5a appears after the live-check paragraph. Worth a look.

## Spec mapping
**Behaviours:**
- **Delivered:** B1-B5, B7, B9, B10, B13-B16 and B19.
- **With a finding:** B5 (F6), B6 (partial, F2), B8 (F3), B11 (F5), B12 (blocked by F1), B17 (F9), B18 (F4), B20 (F10).

**Acceptance criteria:**
- **Delivered:** AC1, AC3, AC5, AC6 and AC7.
- **With a gap:**
  - AC2 is partial (F2) and AC4 diverges (F3).
  - AC8 and AC9 are in the code, but their mutants haven't been run.
  - AC10 is owed after the merge.

**Implementer assumptions, judged:**
- **The KonMari cut-off,** `plan_approved` after the date of §61's merge commit: coherent and checkable. §64 is exempt. An intent approved on the merge day is skipped.
- **The budget skips when neither side has a baseline:** acceptable. An unrebased old branch bypasses it until it rebases.
- **Routing rules 3 and 4 for planless types:** consistent.
- **Disjoint lint blocks:** correct, though they cost F6.
- **The server regex:** sound. It refuses `../src/engine/state`, allows `saveGame` and `saveGame.ts`, refuses `saveGameExtra`, and exempts tests.
- **Codex `workspace-write`:** reasonable. Commit rights inside a worktree are not checked.

## Mutants (pass 4)
**Killed (36 valid):** the matching forbidden or allowed case in `scripts/architecture-rules.test.mjs` caught each of these:
- every `noPhaser`, `noUi`, `noScenes`, `noMapEditor`, `noEngine` and `noTooling` pattern on the engine, data, ui, scenes, map-editor and `src` root blocks;
- the server block's phaser, ignores, regex-no-lookahead and loose-lookahead mutants;
- `E-mapeditor-add-noUi`;
- `E-noTooling-drop-tools` and `E-noTooling-drop-scripts`;
- `E-noScenes-one-level`.

The probe that deleted the engine block failed 8 engine cases, which shows the test lints through the repository's real config.

**Invalid:** `E-server-drop-regex`. A `$'` in the replacement string broke the config, so it needs re-running with a literal replace.

**Survived (6):**

| Mutant | Target |
| --- | --- |
| E-data-drop-noServer | `src/data` block |
| E-ui-drop-noServer | `src/ui` block |
| E-scenes-drop-noServer | `src/scenes` block |
| E-mapeditor-drop-noServer | `src/map-editor` block |
| E-srcroot-drop-noServer | `src/*.ts` block |
| E-noPhaser-drop-subpath | `'phaser/**'` |

F2's rework should kill all six.

**Not run (50), killed by the memory reaper:**
- `E-noUi-one-level`, `E-noEngine-one-level` and `E-severity-warn`;
- a valid `E-server-drop-regex`;
- 27 `S-*` mutants on `size-budget-lib.mjs`: `countLines`, the `isBudgeted` exclusions, rules 1-5, first creation, `budgetLines`, `budgetVerdict` and `parseCatFileBatch`;
- 6 `C-*` mutants on the `check-intent.mjs` wiring, which F3 makes killable;
- 5 `K-*` mutants on `checkKonmari`;
- 6 `L-*` mutants on `konmariLine`.

The definitions are in the coordinator's scratchpad, `scratchpad/mut/mutants.json`.

## Not checked
- **The 50 unrun mutants above.** The size budget, the `konmari:` key and `konmariLine` are unproven by mutation, though their tests read as targeted.
- **AC10:** KonMari end to end on a real intent, owed to the first `/auto` run after the merge.
- **Codex's `workspace-write` sandbox:** whether it allows commits in a worktree.
- **A session closing mid-KonMari:** `/auto` has no resume-table row for it.
- **`## KonMari check` sections:** how they sit once later rounds move under "# Round N (history)".
- **`npm run e2e`:** not run. No `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` path changed.

## Live check
Not needed. No rule-1 path changed, `.claude/settings.json` is untouched, and no Not-checked item needs a browser, a hook or the dev server. AC10 is an agent-flow check owed after the merge.

## Verified myself vs. taken on trust
- **Coordinator, re-run,** in `C:/Users/eric/src/heraklios-wt/61-architecture-guardrails` at `b4dfa91`:
  - `npm run verify`: exit 0, 0 errors and 21 warnings, 69 test files, 1325 tests passed. This matches the reviewer and the implementer.
  - `npm run check:intent`: PASS, 25 files, 1143 lines. This matches.
- **Coordinator, re-run, the 6 surviving mutants:** each was backed up by copy, applied as an exact single-match replace with the diff checked non-empty, run against the full vitest suite, then restored by copy with the diff checked empty. All 6 survived, 0 of 1325 failed, which matches the reviewer. `git status --short` was clean at the end.
- **The reviewer's own runs:**
  - verify and check:intent, as above;
  - 37 mutant runs;
  - per-file test counts: size-budget 41, architecture-rules 47, intent-check-lib 94 and ship-lib 34. 1223 + 47 + 41 + 14 = 1325;
  - `size:baseline` byte-identical to the committed JSON;
  - `wc -l` counts;
  - every changed blob is valid UTF-8, LF-only and free of mojibake;
  - the `eslint.config.js` restore lost nothing: the diff against `main` is purely additive;
  - `.claude/settings.json`, `settings.local.json` and the hooks are untouched;
  - the branch dry-run prints `note konmari not run`;
  - `npm run sdlc:scan -- --sample-due auto --exclude 61` gives "sampled: no".
- **Taken on trust:**
  - the 67-file, 1223-test count at subtask 1;
  - the spec's measurements at `e776128`;
  - the implementer's hand-run mutants.
