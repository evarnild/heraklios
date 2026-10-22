<!-- generated-by: heraklios/review@0.1.4 -->
# §44 review — /spec and /build-plan skills write the spec and the plan, stamped

verdict: escalate
tier: reviewed
reviewed-commit: 4846a17
round: 2
sampled: no
live-check: owed

Tier set by input 1 (`.claude/skills/**`, Reviewed). Passes run by the
`heraklios-reviewer` agent; the results the coordinator re-ran are marked.
All six round-1 findings are resolved. The rework's scope is those six plus
the `/intent` thinning the owner asked for (2026-10-22, "resume 44
implementer with all findings"), which goes beyond the spec's B2 limit for
`/intent` and is recorded in Progress. Nothing needs rework: **escalate** —
the owner reads the diff, then the dry run (live check).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (2, LOW) — N1, N3 |
| 2 | Type check | FAIL on the owed live check only (the owner's to clear) |
| 3 | Rulebook fidelity | not run — no game rule |
| 4 | Tests prove the rule, not only pass | pass — 4/4 mutants killed (the `startsWith` one now too); the scan's print/JSON wiring is checked by hand |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass — corrected counts and citation reproduce |
| 7 | Documentation | findings (1, LOW) — N2 |
| 8 | Guardrails and hygiene | pass — lint 21/21; every changed file valid UTF-8 |
| 9 | Repository-specific footguns | not applicable |

## Type check
```
type-check: FAIL (intent 44, feature)
  error: A live check is owed and not recorded. Do the steps in intents/44-intent-spec-plan-steps/review.md → ## Live check, then set live_checked: <date> in intents/44-intent-spec-plan-steps/metadata.yml.
  note:  9 file(s), 256 line(s) changed outside intents/.
```
The only error is the owed live check.

## Findings
- **LOW** (N1) `.claude/skills/intent/SKILL.md:92-94` — thinning the
  closing dropped the gate's name: `intent_accepted` no longer appears in
  `/intent` (main had it at `:96`), while `/spec` and `/build-plan` close
  with "accept by setting `spec_accepted` …" / "approve by setting
  `plan_approved` …". Worth a look: "accept by setting `intent_accepted:
  <date>` in metadata.yml, or say yes" before the Next-skill line.
- **LOW** (N2) `.claude/skills/intent/SKILL.md:19-20` — the stamp line now
  asks for `<!-- generated-by: heraklios/intent@0.1.4 -->` on line 1 of
  `metadata.yml`, but all 17 existing `metadata.yml` files use the YAML
  comment `# generated-by: …` (`parseMetadata` ignores the HTML form, so
  nothing breaks). Worth a look: name the `#` form for `metadata.yml`.
- **LOW** (N3) `intents/44-…/spec.md` B2, B6, Assumptions — still say
  `/intent` goes to `0.1.3` with only a pointer and a last line; Progress
  records the owner-requested divergence to `0.1.4`. Worth a look: amend
  the spec at the merge if the owner wants the accepted text to match.

## Not checked
- **What the skills do when run** (preconditions, stamps, sections, no
  gate recorded on their own): the live check below.
- Claude Code's built-in command list for `/spec` / `/build-plan`
  collisions.
- `docs/sdlc-grid.md` not regenerated.
- The scan's print/JSON wiring has no unit test (checked by hand).

## Live check
- owed: rule 3 (a skill's behaviour shows only when it runs; spec AC4).
- steps:
  1. `cd C:/Users/eric/src/heraklios-wt/44-intent-spec-plan-steps &&
     claude`.
  2. `/intent --feature throwaway: a dummy feature for the dry run`; note
     the id. `intent.md` starts with `<!-- generated-by:
     heraklios/intent@0.1.4 -->` (`metadata.yml` with the same stamp; the
     `#` form is fine, N2); every gate empty; the closing names `/spec
     <id>`. Say yes.
  3. `/build-plan <id>`: stops, names `spec_accepted` as missing, writes
     nothing.
  4. `/spec <id>`: line 1 `<!-- generated-by: heraklios/spec@0.1.0 -->`;
     "Written against `main` at <hash>"; the template's sections, B1…,
     AC1… each naming its proof; closing "accept by setting
     `spec_accepted` … or say yes"; `spec_accepted:` still empty. Say yes.
  5. `/build-plan <id>`: line 1 `<!-- generated-by:
     heraklios/build-plan@0.1.0 -->`; "Re-read on `main` at <hash>" with
     `path:line` entries; Goal, Risks, Subtasks, Tests, Validation,
     Assumptions, empty Progress; no questions; `plan_approved:` empty.
  6. `npm run sdlc:scan`: `spec.md: 1 by /spec · 8 hand (old stamp) · 0
     unstamped`, `plan.md: 1 by /build-plan · 13 hand (old stamp) · 2
     unstamped`.
  7. Clean up: delete `intents/<id>-throwaway*`, `git restore plan.md`,
     `git status --short` empty; commit nothing.
- you should see: the stamps, sections and commit lines above, the
  refusal before `spec_accepted`, no gate recorded by a skill, and the
  scan counting the two files.

## Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `4846a17`, worktree clean; `npm run
  check:intent` — FAIL on the live check only (above); `iconv -f UTF-8`
  over all files in `git diff --name-only main...HEAD` — none bad; `npm
  run sdlc:scan` spec/plan lines as in the live-check step 6 (with 0
  rather than 1), 0 × U+FFFD in `od -c`; the `startsWith(skill)` mutant —
  killed (1 failed, 720 passed), file restored, status clean.
- Reviewer agent: `npm run verify` — lint 0 errors / 21 warnings (cap
  21), 46 files, 721 passed; `git diff 25ef936 HEAD` read in full (7
  files); mutants M1–M3 killed; each sentence removed from `/intent`
  mapped to the README rule that covers it, and every `/intent`-specific
  item (type rules, gather list, question sets, id/metadata/`follows_up`/
  queue-row/GitHub-offer steps, checklist, next-skill line) still present;
  README rule 4 limited to spec and plan, consistent with `/spec:47` and
  `/build-plan:49`; `/grid` 0.1.2 in frontmatter and stamp; corrected
  counts at `6c2d960` and the citation at `4ba8209` reproduce; `/intent`
  index EOL `i/lf` as on `main`.
- Taken on trust: the owner's 2026-10-22 request quoted in Progress.

# Round 1 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: 2778624
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2, all in `4846a17`):
- MEDIUM `sdlc-scan.mjs:166` Latin-1 bytes: **fixed**; every changed file
  valid UTF-8; real scan output quoted in Progress.
- LOW `startsWith` mutant: **fixed** (new test kills it).
- LOW README rule 8: **fixed** ("Never record a gate on your own").
- LOW `/intent` restatements and rule 4: **fixed** — `/intent` 0.1.4
  thinned (owner's request, beyond B2); rule 4 applies to spec and plan.
- LOW `/grid` version: **fixed** (0.1.2).
- LOW counts and citation: **fixed**.

Tier set by input 1 (paths: `.claude/skills/**` is Reviewed). Passes run by
the `heraklios-reviewer` agent; the results quoted below that the
coordinator re-ran are marked. The skills match the spec line by line: every
B1–B9 is covered, nothing is missing, and no shared rule is restated in
`/spec` or `/build-plan`. One MEDIUM needs a one-line rework: the scan's new
output line was saved with broken bytes, so the evidence `/grid` will read
prints `�` instead of `·`.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (3, LOW) — L2, L3, L4 |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no game rule |
| 4 | Tests prove the rule, not only pass | findings (1) — 6 of 7 `artefactOrigins` mutants killed (L1); the print/JSON wiring in `sdlc-scan.mjs` has no tests (checked by hand, AC2) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (1) — L5 |
| 7 | Documentation | pass — B9 present and accurate |
| 8 | Guardrails and hygiene | findings (1) — M1; lint 21/21, cap unchanged, no dependency |
| 9 | Repository-specific footguns | not applicable |

### Type check
```
type-check: PASS (intent 44, feature)
  note:  9 file(s), 220 line(s) changed outside intents/.
```

### Findings
- **MEDIUM** `scripts/sdlc-scan.mjs:166` — the new print line's two `·`
  separators were saved as single Latin-1 bytes `0xB7`, not UTF-8 `C2 B7`.
  The file is valid UTF-8 on `main` and not on the branch (`iconv -f
  UTF-8` fails), and `npm run sdlc:scan` prints `spec.md: 0 by /spec �
  8 hand (old stamp) � 0 unstamped`: the evidence B8 has `/grid` read. The
  Progress paraphrases the output instead of quoting it, which is how it
  slipped through. Needs rework: write the two `·` as UTF-8, confirm
  `iconv -f UTF-8 -t UTF-8 scripts/sdlc-scan.mjs` exits 0, and quote the
  real scan output in Progress.
- **LOW** `scripts/scan-lib.test.mjs` — `stamp.split('@')[0] === skill` →
  `stamp.startsWith(skill)` passes all 720 tests (re-run by the
  coordinator), so a later `heraklios/spec-<x>@…` stamp would count as
  made by `/spec`. Worth a look: one case with `heraklios/spec-x@0.1.0`
  on a spec → hand.
- **LOW** `intents/README.md:145-147` (rule 8) vs.
  `.claude/skills/intent/SKILL.md:16-17`, `:98` — "Never record a gate"
  next to `/intent`'s "you record a gate only on the user's request …
  `by-agent`". Both mean "not on your own initiative", but one agent reads
  both. Worth a look: "Never record a gate on your own".
- **LOW** `.claude/skills/intent/SKILL.md` — `/intent` still restates
  shared rules (gather before asking, one batched round, validate and
  report), as the spec allowed, and the pointer now asks it to record the
  `main` commit (README rule 4) with no place for it in the intent
  template. Worth a look later: thin `/intent` down to its own rules and
  say whether rule 4 applies to `intent.md`.
- **LOW** `.claude/skills/grid/SKILL.md:6`, `:19` — `/grid`'s scoring rule
  changed (B8), its version and stamp stayed 0.1.1, so a grid stamped
  0.1.1 may have been scored either way. Worth a look: 0.1.2.
- **LOW** `intents/44-…/plan.md:66-68`, `intent.md` (Problem) — "23 files,
  19 stamped, 4 unstamped" includes the two unstamped `_templates` files;
  without them, at `6c2d960`: 21 files, 19 stamped, 2 unstamped (§26 and
  §27 plans). (The coordinator's "about 27" in chat double-counted the
  same templates and §43's files.) Worth a look; and `plan.md:52` cites
  `intents/README.md:114-117` for a bullet at `:115-118`.

### Not checked
- **What the skills do when run** (preconditions honoured, stamps,
  sections, no gate recorded on their own): only a live run shows it —
  AC4, the live check below.
- Claude Code's built-in command list for `/spec` and `/build-plan`
  collisions (only the repo's and the user's skill folders were searched;
  no collision there).
- `STAMP_RE` matches the first `generated-by:` anywhere in a file, not
  only line 1 (pre-existing); no file is misread today.
- The `docs/sdlc-grid.md` Design-row claims weren't re-read.

### Live check
- owed: rule 3 (a skill's behaviour shows only when it runs; spec AC4).
- steps:
  1. `cd C:/Users/eric/src/heraklios-wt/44-intent-spec-plan-steps &&
     claude` (the session loads this worktree's skills).
  2. `/intent --feature throwaway: a dummy feature for the dry run`; note
     the id. `intent.md`/`metadata.yml` start with
     `heraklios/intent@0.1.3`; the closing names `/spec <id>`. Say yes.
  3. `/build-plan <id>`: it stops, names `spec_accepted` as missing,
     writes nothing.
  4. `/spec <id>`: `spec.md` line 1 is `<!-- generated-by:
     heraklios/spec@0.1.0 -->`; a "Written against `main` at" line;
     B1…, AC1… each naming its proof; the template's sections; the
     closing "accept by setting `spec_accepted` … or say yes";
     `metadata.yml`'s `spec_accepted:` still empty. Say yes.
  5. `/build-plan <id>`: `plan.md` line 1 is `heraklios/build-plan@0.1.0`;
     "Re-read on `main` at" with `path:line` entries; Goal, Risks,
     Subtasks, Tests, Validation, Assumptions; empty Progress; no
     questions asked; `plan_approved:` empty.
  6. `npm run sdlc:scan`: `spec.md: 1 by /spec · …`, `plan.md: 1 by
     /build-plan · …` (with real `·` after the fix).
  7. Clean up: delete `intents/<id>-throwaway*`, `git restore plan.md`,
     `git status --short` empty; commit nothing.
- you should see: the stamps, sections and commit lines above, the
  refusal before `spec_accepted`, no gate recorded by a skill, and the
  scan counting the two files.

### Verified myself vs. taken on trust
- Coordinator, re-run: HEAD `2778624`, worktree clean; `iconv -f UTF-8 -t
  UTF-8 scripts/sdlc-scan.mjs` fails on the branch and passes on `main`;
  line 166 has two `0xB7` bytes; `npm run sdlc:scan`'s spec/plan lines
  contain 4 × U+FFFD; `npm run check:intent` PASS; mutant `startsWith`
  survives (720 passed), file restored, status clean.
- Reviewer agent (not re-run by the coordinator): `npm run verify` — lint
  0 errors / 21 warnings (cap 21), 46 files, 720 passed; `git diff
  main...HEAD` read in full; the line-by-line map of both skills, the
  `/intent` diff (exactly 7 lines: version, stamp, pointer, last line;
  valid UTF-8, LF as on `main`) and the README section against B1–B9;
  the three near-restatements judged acceptable (stamp literal is the
  skill's own data per rule 5; `/spec` §5's quote check is B4.4's
  validation item; closing lines are B4.5/B5.5's wording); mutants M1–M5,
  M7 killed, M8–M9 (scan print/JSON) survive (untested wiring); stamp
  tallies on disk and at `6c2d960`/`4ba8209`; no skill-name collision in
  `.claude/skills` or `~/.claude/skills`; `main` moved by two commits
  (§45 files and `plan.md`) that touch nothing in this diff.
- Taken on trust: the owner decisions quoted in the spec and metadata.
