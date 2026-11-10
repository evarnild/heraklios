<!-- generated-by: heraklios/spec@0.1.0 -->
# §61 spec: the SDLC keeps the architecture good with written principles, import rules, a size budget, a review pass and a KonMari tidy-up step

Accepted intent: [intent.md](intent.md)

Written against `main` at `e776128`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intent.md` | the 17 principles, the five outcomes and the open questions |
| The owner's answers, 2026-11-06 | **When:** "Before live check". **Who:** "Should be an agent with opus and not sonnet. I think implementers are sonnet". **Reach:** "Diff plus duplicates" |
| `.claude/agents/heraklios-implementer.md:5` | `model: sonnet`, which confirms the owner's reading. The reviewer is `model: opus` (`heraklios-reviewer.md:5`) |
| `eslint.config.js` | today's rules: the guardrails are warnings, there's no import rule, and `.claude/`, `.codex/` and `tools/map-extract/` are ignored |
| `package.json:12` | `"lint": "eslint . --max-warnings 21"`, the cap that stays put |
| `REVIEW-POLICY.md` → "Passes" | pass 1: "Refactoring mixed into a feature is a finding"; pass 5 (boundary); pass 8 (dependencies); "Finding vs nit" |
| `.claude/skills/auto/SKILL.md` steps 5 to 10 | the verdict actions, the re-check, the stops and the safety rules the KonMari step joins |
| `scripts/intent-check-lib.mjs:115` | `AUTO_FIELDS`, the precedent for a non-gate metadata key |
| Not a source | rulebook: none, this is SDLC tooling |

### Facts measured at `e776128`

- **No upward import exists.** No `src/engine`, `src/data` or `server/` source file imports `ui` or `scenes`.
- **`src/map-editor/` imports:**
  - `../data/map` (6) and `../data/terrain` (5);
  - `../engine/hex` (3);
  - `../ui/hexRender` (6) and `../ui/i18n` (1).
- **Server imports:**
  - The server's non-test files import only `../src/engine/saveGame` from the game.
  - Its tests import more: `saveApi.test.ts`, `saveApiPlugin.test.ts` and `saveApiPlugin.concurrency.test.ts` also import `engine/army`, `state` and `turnManager`.
- **`Math.random` in `src/engine` appears only as an injectable default:** `dice.ts:11`, `actions.ts:289`, `randomAgent.ts:23` and `heuristicAgent.ts:213` (`options.rng ?? Math.random`).
- **Non-test source files over 500 physical lines:**

  | File | Lines |
  | --- | --- |
  | `src/scenes/BoardScene.ts` | 3176 |
  | `src/data/map.ts` | 1401 (generated) |
  | `src/engine/fuzzHarness.ts` | 1350 |
  | `src/engine/combat.ts` | 1111 |
  | `src/engine/heuristicAgent.ts` | 1065 |
  | `src/engine/drift.ts` | 667 |
  | `src/scenes/PlacementScene.ts` | 564 |

  These are the ones the baseline would list today, except `map.ts` (B7). The plan re-measures them.

## Behaviour

### Principles (outcome 1)

- **B1.** `docs/architecture.md` states the 17 principles of the intent. Each one says how it is checked: *Enforced* (by which rule or check) or *Judged* (by review pass 10).
  - It records the exceptions with a reason each:
    - the post-combat bookkeeping in `BoardScene` (principle 7);
    - the map editor's layer (B3);
    - the server tests' imports (B4);
    - the `Math.random` default (B5);
    - the generated `map.ts` (B7).
  - `CLAUDE.md` keeps its module map, and adds one line pointing to the file.
  - `REVIEW-POLICY.md` pass 10 and the KonMari brief point to `docs/architecture.md` and don't restate it.
- **B2.** `docs/architecture.md` is the only place a principle's wording lives. A new exception or layer is added there, with its reason, in the change that needs it (principle 17).

### Import rules (outcome 2)

- **B3. Layers.** ESLint's built-in `no-restricted-imports` (`patterns`), as **errors**, refuses:
  - **engine and data:** imports of `phaser`, `**/ui/**`, `**/scenes/**`, `**/map-editor/**`, `server/**`, `scripts/**` or `tools/**` from `src/engine/**` and `src/data/**`;
  - **data:** imports of `**/engine/**` from `src/data/**`;
  - **ui:** imports of `**/scenes/**` and `**/map-editor/**` from `src/ui/**`;
  - **map editor:** imports of `**/scenes/**` and `phaser` from `src/map-editor/**`;
  - **scenes:** imports of `**/map-editor/**` from `src/scenes/**`.

  The map editor is a top layer beside `scenes`. It may import `ui`, `engine` and `data`, as it does today. Skipping a layer downwards is allowed, as the intent assumed.
- **B4. Server.** The server's non-test files (`server/**/*.ts`, except `*.test.ts`) may import from `src/` only `src/engine/saveGame`. Any other path under `src/` is refused, and `phaser` is refused. Test files under `server/` are exempt, because they build fixtures.
- **B5. Tooling and randomness.**
  - **Tooling:** no file under `src/` imports from `scripts/` or `tools/`. That rule enforces principle 4's import half; the build half ("the build contains nothing from them") follows from it, since Vite bundles only what `src/` imports.
  - **Randomness (principle 9):**
    - it stays *Judged*, worded to allow an injectable `rng = Math.random` default parameter or `?? Math.random` fallback;
    - it forbids a direct `Math.random()` call that a caller can't replace;
    - no lint rule is added for it.
- **B6. Proof the rules fire.**
  - `scripts/architecture-rules.test.mjs` lints a forbidden import for each rule in B3 and B4, through ESLint's Node API with the repository's own config and `lintText(code, { filePath })` on fixture strings, and expects that rule's error.
  - It also lints one allowed import per rule and expects no error.
  - It runs in `npm test`. No new dependency is added, since `eslint` is already a devDependency.

### Size budget (outcome 3)

- **B7. The baseline.**
  - `scripts/size-baseline.json` maps each budgeted file over 500 lines to its ceiling, in physical lines.
  - A budgeted file is a non-test source file (`*.ts`, `*.mjs`, `*.js`) under `src/`, `server/`, `scripts/` or `tools/`.
  - These are excluded:
    - `*.test.*` and `e2e/**`, where the lint length rules are off too;
    - `src/data/map.ts`, which is generated;
    - `tools/map-extract/**`.
  - `npm run size:baseline` prints the current measurement. With `--write`, it writes the file from it, used once at first creation.
- **B8. The check.** `npm run check:intent` gains a size-budget step, in its own module `scripts/size-budget-lib.mjs` with its tests, called from `check-intent.mjs`. It **fails** when:
  1. a budgeted file is longer than its ceiling;
  2. a budgeted file not in the baseline is over 500 lines;
  3. the branch raises a ceiling, against the merge base's `size-baseline.json`, by more than **50 lines**, or adds a file to the baseline;
  4. the branch raises a ceiling, or adds a file, without a matching `budget:` line in the plan's "Where this goes" section (B10): `budget: <path> +<n>: <reason>`;
  5. a budgeted file is shorter than its ceiling and the branch didn't lower that ceiling to the file's length, the same ratchet as the lint cap.

  An adjustment or experiment has no plan, so it can't raise a ceiling: rule 4 fails it. It reports `ROUTE` with "re-declare as a fix or feature", in the existing style.
- **B9. Ceilings are per intent.** The 50-line allowance is measured against the merge base, so it is one allowance per intent, not per commit. Rule 2 means a new file over 500 lines can't enter the baseline by itself. Under rule 3 it is "adds a file", which needs a plan line, and is still capped at 50 lines over 500.

### Plan and review (outcome 4)

- **B10. "Where this goes".**
  - `intents/_templates/plan.md` gains a `## Where this goes` section between "Verified against the codebase" and "Subtasks". It names:
    - the modules touched;
    - the new modules, each with its one-sentence job;
    - why there, against the principles;
    - any `budget:` lines (B8).
  - `/build-plan` writes the section, and its version is bumped.
  - An open plan without the section stays valid (intent constraint). `check:intent` reads `budget:` lines only from that section.
- **B11. Pass 10, "Architecture".**
  - `REVIEW-POLICY.md` gains pass 10. It checks the *Judged* principles against "Where this goes" and the diff, and checks the KonMari record (B17).
  - Its finding kinds:
    - a wrong layer, a misplaced module or a duplication of existing code is "Needs rework:";
    - a real trade-off, a new exception or a new layer is "Needs decision:".
  - Pass 5 keeps the engine and presentation conventions it has. Its boundary sentence points to pass 10. Principle 14 (dependencies) stays in pass 8, and pass 10 refers to it.
  - The passes table in `/review`'s report format grows to ten rows. `/review`'s version is bumped, and so are the reviewer agents in `.claude/agents` and `.codex/agents`.
  - `check:intent`'s `review.md` parsing, if it counts passes, accepts ten.

### The KonMari step (outcome 5)

- **B12. When.**
  - The step runs once a review round's verdict is `attest` or `escalate`, and before the run stops for the owner's diff read, the live check or the ship. So both the owner's diff read and the live check cover the tidied code.
  - It runs for feature, fix and refactor intents, and never for adjustment or experiment.
  - It is not a review round: `auto_round` doesn't change, and it doesn't use one of the three.
  - It runs again only after a later round (after a live-check defect) reaches `attest` or `escalate` once more. It then covers only the commits since the last KonMari.
- **B13. Who.**
  - A new agent, `heraklios-konmari`, with `model: opus` and tools Read, Write, Edit, Bash, Grep and Glob, in `.claude/agents/heraklios-konmari.md` and a Codex counterpart in `.codex/agents/`.
  - The coordinator launches it in the intent's worktree with a brief built from:
    - the diff (`main...HEAD`);
    - `docs/architecture.md`;
    - the record format (B17);
    - `/auto` step 10's safety rules.
  - It never touches gates or `auto_*` fields.
- **B14. Reach.** The agent may change:
  - the lines the intent added or changed;
  - existing code that those lines duplicate. For example, it may reuse an existing helper instead of a new copy, or fold the new and old helpers into one, updating their callers.
  - the ceiling of a budgeted file the tidy-up shrinks, lowered in `scripts/size-baseline.json` in the same `§<id> konmari:` commit (never raised).

  It doesn't restructure code the intent didn't touch. A larger cleanup it notices goes into the record as a proposed `refactor` intent, and is not done.
- **B15. Behaviour is held.**
  - The agent:
    - doesn't change test assertions or delete a test case;
    - edits a test file only where a moved or renamed symbol forces it (an import path or a name);
    - doesn't add dependencies or `eslint-disable` comments.
  - It commits each tidy-up separately, with the subject prefix `§<id> konmari:`. It runs `npm run verify` before each commit.
- **B16. The KonMari check.** The coordinator then runs, itself:
  - `npm run verify` and `npm run check:intent`;
  - `npm run e2e` when the paths call for it;
  - every mutant that the latest `review.md` records as **killed** whose target file the tidy-up changed. Each is re-applied to the moved line by its recorded description, and must still be killed.

  It also compares the test-case and lint-warning counts with the review's: the test count must not fall, and the warning count must not rise.

  It then delegates a read of **only the KonMari commits** to `heraklios-reviewer`, checking B14 and B15 and principles 5 to 12.
- **B17. The record.**
  - The agent writes `intents/<id>-<slug>/konmari.md`, stamped `heraklios/konmari@0.1.0`. It lists:
    - each tidy-up, with its commit, files and what it removed or unified;
    - what was looked at and left, and why;
    - any proposed `refactor` intent.
  - The coordinator appends a `## KonMari check` section to the round's `review.md`. It holds the B16 results, each marked **Coordinator, re-run**, and the reviewer's read. The review that clears the branch has then seen the tidy-up.
  - Pass 1 doesn't count the commits listed in `konmari.md` as "refactoring mixed in".
- **B18. A failed check discards, never blocks.**
  - If any B16 item fails, or the reviewer's read finds a behaviour change or a reach beyond B14, the coordinator reverts the KonMari commits with `git revert` (new commits, no rewritten history).
  - It marks `konmari.md` `outcome: discarded` with the reason, and re-runs `npm run verify`. The run then goes on to its stop as if no tidy-up had been made.
  - A tidy-up that finds nothing worth changing writes `outcome: nothing to tidy`. A kept one writes `outcome: kept`.
  - The step can't send the run back to rework, and a failed KonMari is never a stop.
- **B19. By hand, and skipping.**
  - `/konmari <id>`, a new coordinator skill, runs B13 to B18 on request outside `/auto`. `/auto` calls the same steps.
  - The owner can skip it for one intent with `konmari: skip` in `metadata.yml` and their words in a comment. This is not a gate, and only the owner writes it or asks for it.
  - `check:intent` accepts the key, with `skip` or empty as values.
  - `npm run ship -- <id> --dry-run` reports a line, `konmari: kept | discarded | nothing to tidy | skipped | not run`. The line informs and doesn't block.
- **B20. The docs.**
  - `sdlc.md`'s steps and its `/auto` section name the step.
  - `intents/README.md`'s "Who edits what" gains the KonMari agent's limits and the `konmari:` key.
  - `/auto`'s SKILL.md places the step after step 5's `attest`/`escalate` and lists it in step 10's briefs. Its version is bumped.

## Interpretations

- **"Duplication" (B14):** two pieces of code that compute the same thing from the same inputs, not code that merely looks alike. Folding code that looks alike but has different reasons to change is out of reach. The KonMari brief says so, and pass 10 judges it.
- **"Physical lines" (B7):** `wc -l` style, not the lint rule's skip-blank, skip-comment count. It is simpler to measure and to reproduce in prose (pass 6). The ceiling and the lint limit then measure different things; `docs/architecture.md` says so.
- **"Escalate" (B12):** the tidy-up runs before the escalate stop, so that the owner's diff read is a read of the code that merges.

## Acceptance criteria

- **AC1:** `docs/architecture.md` has the 17 principles, each with its check, and the five exceptions. `CLAUDE.md` points to it. *Proof:* review pass 7 reading, and a grep for each principle number.
- **AC2:** each B3 and B4 rule fires on a forbidden import, and stays quiet on the allowed one. *Proof:* `scripts/architecture-rules.test.mjs`.
- **AC3:** `npm run lint` on `main`'s code still reports 21 warnings and 0 errors under the new rules. *Proof:* `npm run verify` on the branch.
- **AC4:** each of B8's five failures, and the passing cases (a growth of 50 or less with a `budget:` line, a lowered ceiling), behave as stated. *Proof:* `scripts/size-budget-lib.test.mjs`, with an injected file reader and git runner, as the other `*-lib` tests do.
- **AC5:** `check:intent` on this branch passes, with this plan's own `budget:` lines if it needs any. *Proof:* `npm run check:intent`.
- **AC6:** the plan template, `/build-plan`, `REVIEW-POLICY.md` pass 10 and `/review` match B10 and B11, with their versions bumped. *Proof:* review pass 7 reading; `check:intent` tests accept a ten-pass report if they parse it.
- **AC7:** the `heraklios-konmari` agent exists with `model: opus` in `.claude/agents/`, with its Codex counterpart. `/konmari` and `/auto` describe B12 to B19. *Proof:* review reading, and a grep for `model: opus`.
- **AC8:** `check:intent` accepts `konmari: skip` and an empty `konmari:`, and rejects any other value. *Proof:* `scripts/intent-check-lib.test.mjs`.
- **AC9:** the ship dry-run prints the `konmari:` line for each of the five states, and is never blocked by it. *Proof:* `scripts/ship-lib.test.mjs`.
- **AC10:** the KonMari step works end to end on one real intent, the first `/auto` run after this merges. *Proof:* manual, recorded as a Not-checked item in this intent's review. This intent can't run its own step before it exists.

## Non-functional

- **Engine and presentation split:** no game code changes (intent constraint). New logic goes in `scripts/*-lib.mjs` with tests, and the CLI glue stays thin.
- **Save format, undo, AI and harness:** untouched.
- **Lint cap:** stays 21. The import rules are errors, so they don't spend warnings.
- **Tier and live check:** the path table makes this change Reviewed (`REVIEW-POLICY.md`, `.claude/skills/**` and `.claude/agents/**`). It touches no `.claude/settings.json` and no runtime path, so no live check is expected; the review decides.
- **Cost:** the KonMari step adds one Opus agent, one coordinator re-check and one reviewer read per run. The mutant re-run is limited to the files the tidy-up changed.

## Out of scope

- The periodic `/architecture` review (proposal 4) and paying down `BoardScene` (proposal 5) are later intents.
- **No lint rule for randomness (B5),** and no import-boundary rule for e2e files.
- **No KonMari on runs already open.** Intents mid-run when this merges, such as §64, finish under the rules they started with. Skills read at the next step will pick up the new text, so the plan has to say how a run in progress is treated: `/auto` reads its SKILL.md at each invocation.
- **The ship dry-run doesn't block** on a missing KonMari.

## Assumptions I made

- **A new Opus agent,** rather than giving the implementer `model: opus`. The owner asked for "an agent with opus and not sonnet", and changing the implementer's model would change every build's cost. A separate agent also brings the fresh eyes the post asks for.
- **Discard rather than rework on a failed tidy-up (B18).** The tidy-up is optional value. Rework would spend rounds and could block a ship over a cleanup.
- **The 50-line allowance, per intent, measured from the merge base (B9).** This is the coordinator's earlier suggestion, which the intent recorded, and the intent left the choice open.
- **The budget covers `scripts/` and `tools/` too (B7).** They are hand-written and long (`scripts/ship.test.mjs` is 666 lines, but it is a test and excluded). No non-test file there is over 500 lines today.
- **The baseline lives in `scripts/`, not `docs/`,** because a script reads and writes it.
- **Pass 10 is new,** not a rewrite of pass 5, so existing reports' pass numbers stay true.
- **One branch, delivered in phases** (the intent's phasing question): principles, then import rules, then the size budget, then the plan and review pass, then KonMari last, since it relies on the rest. Splitting again would undo the owner's merge.
- **The intent's parallel-work constraint is stale.** It names §55, §56, §58 and §60 as open, and they have shipped. The open intent now is §64, which edits no SDLC file. The baseline is measured at plan time and re-measured when this merges.
- **AC10 can't be met inside this intent.** It is the first post-merge run's check, and it is listed so it isn't forgotten.
