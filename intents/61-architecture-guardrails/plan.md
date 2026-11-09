<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §61 plan: the SDLC keeps the architecture good with written principles, import rules, a size budget, a review pass and a KonMari tidy-up step

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

Deliver the spec's five outcomes on one branch (`feat/61-architecture-guardrails`), in phases, with KonMari last:

1. `docs/architecture.md`, holding the principles (B1, B2);
2. ESLint import rules, with a test that proves each rule fires (B3 to B6);
3. a size budget enforced by `check:intent` (B7 to B9);
4. the plan section "Where this goes" and review pass 10 (B10, B11);
5. the KonMari step: an Opus agent, a `/konmari` skill, its place in `/auto`, a metadata key and a ship dry-run line (B12 to B20).

No game code changes.

## Risks

- **Tests that pass whatever the code does.**
  - The ESLint rule test must lint through the repository's real config. A fixture that builds its own config proves nothing.
  - The size-budget tests must cover each of B8's five failures with a case that passes without the rule and fails with it.
  - A green suite alone isn't proof: mutate each rule's line (Tests, below).
- **The lint cap.** New rules are errors. If one fires on today's code, AC3 fails. The measurement says no file breaks B3 or B4 today (spec, "Facts measured"), but the implementer re-runs `npm run lint` after phase 2, before going on. The cap stays 21 and is never raised.
- **ESLint `no-restricted-imports` patterns match import strings, not resolved paths.** `'../ui/x'` from `src/engine/` has to match a pattern such as `**/ui/**`, and relative depth varies.
  - Use gitignore-style `group` patterns, plus `regex` where a group can't express the case.
  - The rule test includes a `../../ui/...` form as well as a `../ui/...` form.
  - `src/map-editor` imports `../ui/hexRender`, which must stay allowed.
- **Stale line citations.** Every `path:line` below was read at `e8bac8f`, and §64 is still open. Re-check the line numbers before editing.
- **Chicken and egg in the size budget.** The branch creates `scripts/size-baseline.json`, so the merge base has none.
  - B8 rules 3 and 4 must treat "no baseline at the merge base" as first creation: no growth check and no `budget:` line needed.
  - Rules 1, 2 and 5 apply as usual.
  - A test pins this.
- **Physical-line counts and CRLF.** The worktrees check files out with CRLF, as the `file` command shows for §64's sources. Count `\n` only, so CRLF and LF give the same count, and make the count byte-for-byte identical to `wc -l` on an LF file. A test covers both endings.
- **`/auto` runs already under way.** §64 is mid-run and re-reads `.claude/skills/auto/SKILL.md` at each `/auto 64`. If §61 merges while §64 is open, §64's next round would meet the KonMari step halfway.
  - The new `/auto` text says the step applies only to runs whose `auto_authorized` date is on or after §61's merge date, or simpler, only to intents whose `plan_approved` is after the merge.
  - The implementer writes the plan_approved form into the skill: it's checkable from metadata alone.
- **Pass numbering.** Existing `review.md` files cite passes 1 to 9. Pass 10 is appended, and nothing is renumbered.
- **Prompt-text changes can't be unit-tested.** Skill and agent text (`/auto`, `/review`, `/build-plan`, `/konmari`, the agents) is checked by review reading and by greps (AC6, AC7). Their versions are bumped so the grid sees the change.

## Verified against the codebase

Re-read on `main` at `e8bac8f`.

- **Lint config and scripts:**
  - `eslint.config.js:15-79`: one flat config, opened by `tseslint.config(` at `:15`. Ignores from `:17`. Guardrail rules from `:36`. Overrides for tests (`:52`), `scripts/**` (`:60`), the orchestrator CLI (`:67`) and `src/data/map.ts` (`:74`). ESLint is 9.39.5 (`node_modules/eslint/package.json`).
  - `package.json:12`: `"lint": "eslint . --max-warnings 21"`. `package.json:13`: `"check:intent": "node scripts/check-intent.mjs"`.
  - `vitest.config.ts:11`: the include already has `'scripts/**/*.test.mjs'`, so the new script tests run in `npm test`.
- **`check:intent`:**
  - `scripts/check-intent.mjs:25`: the `git` helper.
  - `:39-49`: `source`, which reads from the branch or the working tree.
  - `:73`: `mergeBase`.
  - `:93`: `checkChange(...)`.
  - `:103-105`: output and exit codes (FAIL 1, ROUTE 2).
- **`scripts/intent-check-lib.mjs`:**
  - `:45`: `parseMetadata`.
  - `:89`: `GATE_FIELDS`.
  - `:115`: `AUTO_FIELDS`.
  - `:125-136`: `parseAuto`.
  - `:151`: `isSource`.
  - `:167-258`: `checkChange`.
  - `:265`: `parseReviewHeader`.
  - The file is 344 lines, under 500, with room for a `konmari` check but not for the budget logic. That is why the budget gets its own module (B8).
- **Ship:**
  - `scripts/ship-lib.mjs:7-15`: `STEPS`, the seven steps.
  - `:25`: `planSteps`.
  - `scripts/ship.mjs:335-345`: `dryRun()` prints each step through `say(...)`. A `konmari:` note line goes here, with the pure state-to-line function in `ship-lib.mjs`.
- **Plan template:** `intents/_templates/plan.md:18`, `## Verified against the codebase`, then `:23`, `## Subtasks`. The new section goes between them.
- **`REVIEW-POLICY.md`:**
  - `:148`: `## Passes`.
  - `:152-154`: pass 1, with "Refactoring mixed into a feature is a finding".
  - `:168-172`: pass 5.
  - `:178-180`: pass 8.
  - `:181-185`: pass 9, the last.
  - `:187`: "Finding vs nit".
  - `:199-214`: the report format.
- **Review skill and reviewer agents:**
  - `.claude/skills/review/SKILL.md:64`: "Run all nine from `REVIEW-POLICY.md`".
  - `.claude/agents/heraklios-reviewer.md:10`: "its nine passes".
  - `.codex/agents/heraklios-reviewer.toml:10`: "nine passes".
- **Agent models:**
  - `.claude/agents/heraklios-implementer.md:5`: `model: sonnet`.
  - `.claude/agents/heraklios-reviewer.md:5`: `model: opus`. Its frontmatter, `name`/`description`/`tools`/`model`, is the format the new agent copies.
- **`/auto` skill:**
  - `.claude/skills/auto/SKILL.md:151`: step 5, the review loop. The verdict actions follow `:171`.
  - `:192`: step 6, the re-check.
  - `:243`: step 8, the ship stop.
  - `:284`: step 10, the safety rules.
  - The file is 304 lines.
- **Other docs:**
  - `sdlc.md:15`: `## The steps`. `sdlc.md:98`: `## Running the steps on their own: /auto`.
  - `intents/README.md:87`: `## Who edits what`. `:154`: the implementer bullet. `:160`: the reviewer bullet.
  - `CLAUDE.md:193`: `## Architecture`, the module map, which gets one pointer line.
- **The size baseline:**
  - Non-test files over 500 lines, measured with `wc -l` at `e8bac8f`: `src/scenes/BoardScene.ts` 3176, `src/engine/fuzzHarness.ts` 1350, `src/engine/combat.ts` 1111, `src/engine/heuristicAgent.ts` 1065, `src/engine/drift.ts` 667, `src/scenes/PlacementScene.ts` 564.
  - `src/data/map.ts` (1401) is excluded (B7).
  - No file under `server/`, `scripts/` or `tools/` is a non-test file over 500 lines. The longest, `scripts/ship.mjs`, has 444.

## Where this goes

This plan writes the section it introduces, as the first plan to do so.

- **Modules touched:**
  - `eslint.config.js`: import rules, one config block per layer;
  - `scripts/check-intent.mjs`: calls the budget step;
  - `scripts/intent-check-lib.mjs`: the `konmari` key;
  - `scripts/ship-lib.mjs` and `scripts/ship.mjs`: the dry-run line;
  - `package.json`: one new script, `size:baseline`; the lint script is untouched;
  - SDLC docs and skills.
- **New modules:**
  - `scripts/size-budget-lib.mjs`: pure budget rules over a measured map, two baselines and the plan text.
  - `scripts/size-budget.mjs`: the `npm run size:baseline` CLI that measures and writes.
  - `scripts/size-baseline.json`: the ceilings.
  - `scripts/architecture-rules.test.mjs`: proof that each import rule fires.
  - `docs/architecture.md`: the principles.
  - `.claude/agents/heraklios-konmari.md` and `.codex/agents/heraklios-konmari.toml`: the tidy-up agent.
  - `.claude/skills/konmari/SKILL.md`: the step's procedure, shared by `/auto` and by hand.
- **Why there:**
  - Logic sits in `*-lib.mjs` with tests, and the CLIs stay thin, as with `ship`, `queue` and `sessions` (principle 15).
  - The budget gets its own module because `intent-check-lib.mjs` is 344 lines and its job is the type check (principle 12).
- **Budget lines:** none. No budgeted file grows past its ceiling, and the baseline is created here (Risks).

## Subtasks

Each one is committed with `npm run verify` green.

1. **Principles (B1, B2).** Write `docs/architecture.md`:
   - the 17 principles from `intent.md` at their wording, each with *Enforced* (naming the rule or check) or *Judged* (pass 10);
   - the five exceptions with reasons: post-combat bookkeeping, the map-editor layer, server tests, the `Math.random` default, the generated `map.ts`;
   - a note that the size ceiling counts physical lines and the lint rule doesn't.

   Add one pointer line under `CLAUDE.md` → "Architecture". *(AC1)*
2. **Import rules (B3 to B5).** Add `no-restricted-imports` blocks to `eslint.config.js`, as errors:
   - one block per source layer, using `files` globs;
   - the server's non-test files only (`server/**/*.ts`, with `ignores: ['server/**/*.test.ts']`);
   - `src/**`, refusing `scripts/` and `tools/`.

   Run `npm run lint`: it must still show 0 errors and 21 warnings. If a rule fires on today's code, stop and report it. That's a finding for the owner, not something to fix silently. *(AC3)*
3. **The rule test (B6).** Write `scripts/architecture-rules.test.mjs`.
   - It uses `new ESLint({ cwd: <repo root> })` and `lintText(code, { filePath })`, with virtual file paths inside each layer.
   - Each rule gets one forbidden case and one allowed case, with both `../` and `../../` relative depths.
   - It asserts the rule id `no-restricted-imports` and severity 2.
   - The allowed cases include `src/map-editor` → `../ui/hexRender`, `server/saveApi.ts` → `../src/engine/saveGame`, and `server/x.test.ts` → `../src/engine/state`. *(AC2)*
4. **Budget logic (B7 to B9).** Write `scripts/size-budget-lib.mjs` and its test.
   - `countLines(text)` counts `\n` only, as `wc -l` does.
   - `isBudgeted(path)` applies B7's globs and exclusions.
   - `budgetLines(planText)` reads `budget: <path> +<n>: <reason>` lines from `## Where this goes` only.
   - `checkBudget({ measured, baseline, baseBaseline, planText })` returns errors for B8 rules 1 to 5. A null `baseBaseline` counts as first creation (Risks).
   - The test covers each rule failing, each passing case, first creation, CRLF, and `budget:` lines outside the section being ignored. *(AC4)*
5. **Budget wiring.**
   - Write `scripts/size-budget.mjs`. It lists budgeted files with `git ls-files`, measures them, and prints or `--write`s the baseline.
   - Add `"size:baseline": "node scripts/size-budget.mjs"` to `package.json`.
   - Generate `scripts/size-baseline.json` with it.
   - Call `checkBudget` from `scripts/check-intent.mjs`. It reads the merge base's baseline with `git show <mergeBase>:scripts/size-baseline.json`, which is missing at first creation, and `plan.md` through the existing `source`. In branch mode it measures from `git show <branch>:<path>`, in working-tree mode from disk.
   - Its errors join `result.errors`. An adjustment or experiment that raises a ceiling routes, as B8 says.

   `npm run check:intent` on this branch passes. *(AC5)*
6. **Plan section and pass 10 (B10, B11).**
   - Add `## Where this goes` to `intents/_templates/plan.md`, between `:18` and `:23`.
   - `/build-plan`: its step 4 lists the section. Bump it to `0.2.0`.
   - `REVIEW-POLICY.md`:
     - append pass 10, "Architecture", which judges the *Judged* principles, points to `docs/architecture.md`, uses the finding kinds of B11 and checks `konmari.md` when present;
     - pass 5's boundary sentence points to pass 10;
     - pass 8 keeps principle 14;
     - pass 1 exempts commits listed in `konmari.md`.
   - `/review`: "nine" becomes "ten", and it bumps to `0.2.0` with a matching stamp. Make the same "nine" to "ten" change in both reviewer agents.
   - If `check:intent` or `/grid` parse pass rows, they accept ten. Grep `scripts/` for a pass count first. *(AC6)*
7. **The KonMari agent and skill (B13 to B18).**
   - Write `.claude/agents/heraklios-konmari.md`: `model: opus`; tools Read, Write, Edit, Bash, Grep and Glob; and rules covering B14 reach, B15 holds, the `§<id> konmari:` commit prefix, the `konmari.md` format of B17 (stamp `heraklios/konmari@0.1.0`, `outcome:`), and `/auto` step 10's safety rules.
   - Add the Codex counterpart `.codex/agents/heraklios-konmari.toml`, in the reviewer toml's format.
   - Write `.claude/skills/konmari/SKILL.md`, the coordinator's procedure:
     1. preconditions: type feature, fix or refactor, and no `konmari: skip`;
     2. launch the agent with the brief;
     3. run the B16 check;
     4. have `heraklios-reviewer` read the KonMari commits only;
     5. append `## KonMari check` to `review.md`;
     6. on a failure, `git revert` the commits and mark the outcome `discarded` (B18).

   *(AC7)*
8. **`/auto`, metadata and ship (B12, B19, B20).**
   - `/auto` SKILL.md:
     - step 5's `attest` and `escalate` actions first run `/konmari`'s steps (B12), once per run, and again only over commits since the last KonMari after a later round;
     - step 10 lists the new agent's brief;
     - the "applies to runs whose `plan_approved` is after §61's merge" rule (Risks);
     - bump its version.
   - `intent-check-lib.mjs`: accept `konmari:` empty or `skip` (with a comment), and give any other value an error. Add to `intent-check-lib.test.mjs`. *(AC8)*
   - Add `konmari:` to `intents/_templates/metadata.yml`.
   - `ship-lib.mjs`: add `konmariLine({ type, metadata, konmariText })`, which returns `kept | discarded | nothing to tidy | skipped | not run`, or nothing for an adjustment or experiment. `ship.mjs` `dryRun()` prints it as a `note`, never a stop. Add to `ship-lib.test.mjs`. *(AC9)*
   - Docs: `sdlc.md` gets the step in "The steps" and in the `/auto` section. `intents/README.md` → "Who edits what" gets the KonMari agent's limits and the `konmari:` key.
9. **Close.** Write the README if anything player-facing changed; nothing is expected to. Then run `npm run verify` and `npm run check:intent`, and set `status: in-review`.
   - AC10 can't be met here. It goes in Progress as owed to the first `/auto` run after the merge.

## Tests

| Behavioural line | Mutation | Test that must fail |
| --- | --- | --- |
| each `no-restricted-imports` block in `eslint.config.js` | delete the block, or a pattern | its forbidden case in `architecture-rules.test.mjs` |
| the server block's `ignores` for tests | remove the `ignores` | the allowed `server/x.test.ts` case |
| the map-editor allowance (no `ui` pattern on `src/map-editor/**`) | add `**/ui/**` | the allowed `../ui/hexRender` case, and `npm run lint` |
| `countLines` counting `\n` | count `\r\n` as two, or split on `/\r?\n/` and take the length | the CRLF case, and the off-by-one trailing-newline case |
| `isBudgeted` exclusions | drop the `*.test.*`, `map.ts` or `tools/map-extract` exclusion | an exclusion case for each |
| B8 rule 1, over the ceiling | `>` becomes `>=`, or the check is removed | "file at ceiling+1 fails", and "at ceiling passes" |
| B8 rule 2, new file over 500 | remove it | "unlisted 501-line file fails" |
| B8 rule 3, over 50 lines | 50 becomes 51, or the check is removed | "+51 fails", and "+50 with a budget line passes" |
| B8 rule 4, no `budget:` line | remove it | "+10 without a line fails" |
| B8 rule 5, the ratchet | remove it | "file shorter than its ceiling, baseline not lowered, fails" |
| first creation (null `baseBaseline`) | treat null as `{}` | "first creation needs no budget lines" |
| `budgetLines` reading only "Where this goes" | read the whole plan | "a `budget:` line under Subtasks is ignored" |
| the `konmari:` value check | accept anything | "konmari: maybe errors" |
| `konmariLine` states | swap two branches | one case per state, plus "adjustment gets no line" |
| `dryRun` printing the line | delete the `say` | none in unit tests (`ship.mjs` is untested glue). Covered by AC9's lib test and the coordinator's dry-run in this intent's review |

Skill and agent text has no unit test. Review pass 7 reads it, and greps check `model: opus`, "ten" in the review skill and agents, and the `konmari` stamp.

## Validation

- `npm run verify` green: lint 0 errors and 21 warnings, cap unchanged.
- `npm run check:intent` PASS on the branch, size-budget step included.
- `npm run e2e`: not needed by path, since nothing under `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` changes. The review decides.
- **Live check:** none owed by path. `.claude/settings.json` is untouched, and no runtime behaviour changes.
- **The coordinator, at review:**
  - run `npm run size:baseline` and compare it with the committed JSON;
  - run `npm run ship -- 61 --dry-run` to see the `konmari:` line, which should read `not run`;
  - lint a scratch file that breaks each layer rule, then delete it.

## Assumptions I made

- **The "after §61's merge" cut-off goes by `plan_approved` date** (Risks). The spec said only that open runs finish under the old rules, and the date makes that checkable. §64 (`plan_approved: 2026-11-05`) is then exempt.
- **ESLint `group` patterns, falling back to `regex`.** Both are built into ESLint 9's `no-restricted-imports`, so no plugin is needed. The implementer confirms the ESLint major version from `package-lock.json` before writing them.
- **New skill versions:**
  - `/build-plan` and `/review` go to `0.2.0` (a new section, a new pass);
  - `/auto` gets a minor bump from whatever its frontmatter says;
  - `/konmari` starts at `0.1.0`.
- **No orchestrator change.** The orchestrator page doesn't need a KonMari button now. `/konmari` runs from a coordinator terminal, and an orchestrator control is a later intent.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-11-06 — all nine subtasks (implementer)

Commits on `feat/61-architecture-guardrails`:

| # | Commit | What shipped |
| --- | --- | --- |
| 1 | `7274846` | `docs/architecture.md`: the 17 principles with Enforced/Judged, the five recorded exceptions, the physical-lines note; one pointer line in `CLAUDE.md` |
| 2 | `b998bb3` | `no-restricted-imports` as errors in `eslint.config.js`: disjoint blocks for `src/engine`, `src/data`, `src/ui`, `src/scenes`, `src/map-editor`, `src/*.ts`, and the server's non-test files (regex allowing only `src/engine/saveGame`) |
| 3 | `2bba34c` | `scripts/architecture-rules.test.mjs`: 47 cases through `new ESLint({ cwd })`, `../` and `../../` depths, the allowed map-editor, server and server-test imports |
| 4 | `abc8cee` | `scripts/size-budget-lib.mjs` and its test: `countLines`, `isBudgeted`, `baselineFrom`, `budgetLines`, `checkBudget` (B8 rules 1 to 5, null base = first creation) |
| 5 | `3e94898` | `scripts/size-budget.mjs` and `npm run size:baseline`; `scripts/size-baseline.json` (the six files of the plan, same numbers); `check:intent` calls the budget (branch mode reads `git cat-file --batch`); `budgetVerdict` routes rules 3/4 for an adjustment or experiment; `parseCatFileBatch` |
| 6 | `442a00b` | `## Where this goes` in the plan template; `/build-plan` 0.2.0; `REVIEW-POLICY.md` pass 10 (pass 1 exempts `konmari.md` commits, pass 5 points to it); `/review` 0.2.0 and both reviewer agents say "ten" |
| 7 | `e1ac30c` | `heraklios-konmari` (`model: opus`) and its Codex toml; `/konmari` 0.1.0 |
| 8 | `acbb91b` | `/auto` 0.2.0 (step 5a, the step-10 brief, the `plan_approved`-after-merge cut-off); `konmari:` checked by `intent-check-lib` and in the metadata template; `konmariLine` in `ship-lib` and a `note` in `ship.mjs` `dryRun()`; `sdlc.md` and `intents/README.md` |

9 (close): no player-facing change, so no `README.md` edit; `status: in-review`.

Counts: `npm run verify` green, 69 test files, 1325 tests (was 67 and 1223 at
subtask 1; +47 rule cases, +41 size-budget, +14 in intent-check/ship lib);
lint 0 errors, 21 warnings, cap unchanged at 21 (checked after subtask 2:
no import rule fired on today's code). `npm run check:intent`: PASS.

Mutants checked by hand (restored by copy): removing the server `ignores`
fails the two server-test cases; adding `noUi` to the map-editor block fails
the `../ui/hexRender` case; `>=` in rule 1, `ALLOWANCE = 51` and dropping the
section filter in `budgetLines` each fail tests. A baseline edited to 3100
makes `check:intent` FAIL on `BoardScene.ts`.

Divergences and notes:
- No `budget:` lines were needed (first creation, as planned).
- `merged:` in `metadata.yml` holds a commit hash, not a date, so `/auto`'s
  cut-off compares `plan_approved` with the date of the merge commit named
  there (`git log -1 --format=%cs`); no `merged:` yet means the step doesn't run.
- The size budget skips itself when neither the branch nor the merge base has
  `scripts/size-baseline.json` (a branch that predates §61).
- `REVIEW-POLICY.md` had no "nine" to change; the "nine" text was in the
  review skill and the two reviewer agents.
- `check:intent`'s `review.md` parsing doesn't count passes; nothing to change.
- `npm run ship -- 61 --dry-run` could not be run from the worktree (it
  refuses); the `konmari:` line is covered by `konmariLine`'s unit tests only,
  and the coordinator's dry-run at review shows it.
- **AC10 is not met here.** It is owed to the first `/auto` run after this
  merge (the KonMari step end to end on one real intent), to be recorded as a
  Not-checked item in this intent's review.

### Round 1 rework (2026-11-06)

Commits: `88a8eea`, `c970e37`, `d520189`, `be104cc` (plus this entry's commit). Owner's decisions: "/auto 61 1b 2a 3b".

| Finding | Resolution |
| --- | --- |
| F1 (HIGH, option b) | `REVIEW-POLICY.md` Merging rule 1 and `checkPreconditions` now take `commits: [{hash, files, merge?}]` (was `changedFiles`) and `konmariText`. A post-review commit passes when it touches only that intent's `review.md`, `metadata.yml` or `konmari.md`, or its hash is listed in `konmari.md` (bullets under `## Tidied` and `## Reverted`, `konmariCommits()`) and it touches nothing else inside the intent's folder. A merge commit never passes. `ship.mjs` reads the commits (`commitsAfter`) and `konmari.md` from the branch tip. Pinned: a listed commit that also edits `plan.md` or `spec.md` fails. `/konmari` 5-6, `/auto` 5a and `sdlc.md` updated. |
| F2 | Forbidden cases for data/ui/scenes/map-editor/`src/main.ts` importing the server, and `phaser/src/x` from the engine. The `E-noPhaser-drop-subpath` mutant was equivalent: the gitignore-style matcher makes `'phaser'` cover `phaser/src/x`, so the redundant `'phaser/**'` entry is removed (comment in `eslint.config.js`). |
| F3 | `check-intent.test.mjs`: 7 end-to-end cases on a sandbox repo with a baseline on `main`: growth past the ceiling fails in branch and working-tree mode; the same growth with a raised ceiling and a `budget:` line passes; a raised ceiling without a line (and a line outside "Where this goes") fails; an over-budget adjustment routes (exit 2); no baseline on either side skips; a baseline created by the branch is still checked (rule 1); an untracked over-limit file fails in working-tree mode. |
| F4 (a) | `konmari.md` has `outcome:` alone on its line and a separate `reason:` line when discarded, plus a `## Reverted` section; stated in the agent, its Codex toml and `/konmari` 6. `konmariLine` is unchanged; a test shows a `reason:` line (even one containing "outcome: kept") doesn't confuse it. |
| F5 | Pass 10 now lists the judged half of principle 1 (no browser APIs in `src/engine`/`src/data`). |
| F6 (b) | A catch-all block `src/**/*.ts` (noServer, noTooling) placed before the layer blocks, which replace it for their files and carry the same patterns; the `src/*.ts` block is gone. Cases: `src/newdir/x.ts` importing scripts, tools or server fails, importing engine passes. `docs/architecture.md` principle 4 says so. |
| F7 | The dead `e2e/` exclusion in `size-budget-lib.mjs` is removed. |
| F8 | `CLAUDE.md` Commands lists `npm run size:baseline`. |
| F9 | The agent, its toml, `/konmari` 5 and `/auto` 5a say `konmari.md` is committed alone (`§<id>: konmari record`), apart from the tidy commits. |
| F10 | `sdlc.md` step 5 sends attest/escalate to 5a, and 5a sits before the live-check paragraph. |

Counts: `npm run verify` green, 69 test files, 1352 tests (was 1325; +10 architecture-rules, +9 ship-lib, +1 ship, +7 check-intent); lint 0 errors, 21 warnings, cap unchanged at 21. `npm run check:intent`: PASS. No `budget:` lines needed.

Mutants (backup by copy, literal replace, diff non-empty, run the test file named, restore by copy, diff empty each time; the file-level run, not the full suite, since each target has one test file):
- Killed by architecture-rules.test.mjs, the case named after it: E-data-drop-noServer ("src/data/x.ts importing ../../server/saveApi"), E-ui-drop-noServer, E-scenes-drop-noServer, E-mapeditor-drop-noServer (the same case per layer), E-srcroot-catchall-drop-noServer ("src/main.ts importing ../server/saveApi" and "src/newdir/x.ts ... server"), E-noPhaser-drop-pattern (35 cases), E-catchall-glob-rootonly ("src/newdir/x.ts ... scripts"), E-catchall-drop-noTooling (src/main.ts and src/newdir cases).
- Killed by ship-lib.test.mjs: R-merge-accepted ("a merge commit is never accepted, even listed"), R-konmari-md-in-listed and R-listed-may-touch-intent ("a listed commit may not touch the intent folder besides konmari.md"), R-listed-any-hash ("an unlisted extra commit still fails" and 3 more), R-drop-reverted-section ("discarded: ... reverts ... pass"), R-own-files-drop-konmari ("kept: ..." and 2 more), L-konmariLine-unanchored ("a reason line below the outcome does not confuse it").
- Killed by ship.test.mjs ("accepts the listed tidy commit and its own konmari.md commit, and refuses an unlisted one"): R-wiring-konmariText, R-wiring-merge-flag (survived the first run; the integration test now builds a listed side branch and a merge commit).
- Killed by check-intent.test.mjs: C-planText ("passes the same growth when the ceiling is raised with a budget: line"), C-routes-dropped ("routes an over-budget adjustment"), C-errors-dropped (4 cases), C-skip-or ("checks a baseline the branch creates", added after it survived), C-untracked ("measures a budgeted file that is only untracked"), C-batch-branch-path (the branch-mode growth cases).
- The 50 mutants the reviewer's run lost to the memory reaper (27 `S-*` on `size-budget-lib.mjs`, `K-*`, and the rest) were not re-run here; they are not part of this rework's findings.

### Round 2 rework (2026-11-09)

Commits: `eb4b439` (all fixes), plus this entry's commit. Owner's decision G4 (a) ("/auto 61 G4 a, rebase ok"): KonMari's reach includes lowering a shrunk file's ceiling in scripts/size-baseline.json; spec.md B14 not amended (owner's). The branch was rebased onto `main` (`9093d21`) by the coordinator.

| Finding | Resolution |
| --- | --- |
| G1 (HIGH) | `npm run size:baseline -- --write` on the rebased tree. New ceilings: combat 1111, drift 667, fuzzHarness 1350, heuristicAgent 1065, `src/scenes/BoardScene.ts` 3179 (was 3176), `src/scenes/PlacementScene.ts` 581 (was 564). Still first creation, so no `budget:` line. Stale above this section and left alone: the measurement list at plan.md "The size baseline" (line 98, "at `e8bac8f`": BoardScene 3176, PlacementScene 564), and the Progress phase-5 row ("the six files of the plan, same numbers"). |
| G2 (MEDIUM) | `budgetVerdict` fixture gains `{ rule: 3 }`; the planless test expects both rules 3 and 4 routed (2 routes) for adjustment and experiment, and 3 errors for a feature. |
| G3 (LOW) | `budgetLines` case with `src\scenes\BoardScene.ts` expecting `src/scenes/BoardScene.ts`. |
| G4 (LOW, option a) | `heraklios-konmari.md`, its Codex toml and `/konmari` (step 3, item 4: a ceiling that went up is a failure) say that a tidy-up that shrinks a baselined file runs `npm run size:baseline -- --write` in the same `§<id> konmari:` commit, and that a ceiling may only go down. No code change needed: `commitAccepted` already accepts a listed commit touching files outside the intent folder, and check:intent passes a lowered ceiling (rule 5 satisfied; growth <= 0 skips rules 3/4). |
| G5 (LOW) | `docs/architecture.md` principle 9 exception table gains `src/engine/turnManager.ts` `shuffleSeatOrder(…, rng = Math.random)`. |

Counts: `npm run verify` green, 79 test files, 1408 tests (main grew since round 1; size-budget-lib.test.mjs 41 tests, no new `it`, assertions added); lint 0 errors, 21 warnings, cap 21. `npm run check:intent`: PASS (intent 61, feature).

Mutants (backup by copy, one-line sed, changed asserted, run `scripts/size-budget-lib.test.mjs`, restore by copy):
- `(f.rule === 3 || f.rule === 4)` to `f.rule === 4` (was S-verdict-route-rule4-only): killed by "routes rules 3 and 4 (both) for an adjustment or experiment...".
- `path: norm(m[1])` to `path: m[1]` (was S-budgetLines-no-norm): killed by "needs a reason, and copes with no plan" (the backslash case) and the routing test.
