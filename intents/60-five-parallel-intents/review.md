<!-- generated-by: heraklios/review@0.1.5 -->
# §60 review — Up to five intents in parallel, not three

verdict: escalate
tier: reviewed
reviewed-commit: f9d3b8c
round: 1
sampled: no
run: auto
live-check: not-needed

**Tier:** Reviewed, by the path table alone: the diff touches
`.claude/skills/auto/SKILL.md` and `.claude/skills/spawn/SKILL.md`
(`.claude/skills/**`). `review_tier` is empty; no HIGH or CRITICAL finding.

**Verdict:** `escalate`. Nothing needs rework; the Reviewed tier means the
owner reads the diff (14 insertions, 12 deletions in 5 files). Passes run by
the `heraklios-reviewer` agent; the coordinator re-ran verify, check:intent,
the UTF-8 check and the sampling scan, and read the diff.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: every limit the intent lists now says five / sixth; the staggering sentence sits next to the new limit in `CLAUDE.md`; nothing else changed |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: no game rule touched |
| 4 | Tests prove the rule | not run: no behavioural code, no mutants to enumerate |
| 5 | Boundary and conventions | pass: nothing in `src/` |
| 6 | Numbers in prose | pass: 4 files, 20 lines, 64 files / 1183 tests match the re-runs |
| 7 | Documentation | pass: README untouched and needs nothing (process, not game) |
| 8 | Guardrails and hygiene | findings (1, LOW); lint 21 of 21, `package.json` untouched; all changed files valid UTF-8, CRLF kept, no whole-file churn |
| 9 | Repository-specific footguns | not run: no drift, AI or map code |

## Type check
```
type-check: PASS (intent 60, adjustment)
  note:  4 file(s), 20 line(s) changed outside intents/.
```
Inside the adjustment's limits (≤5 files, ≤60 lines; the intent's "about 10
lines" counts replaced lines, 20 counts additions plus deletions).

## Findings
- **LOW** `.claude/skills/auto/SKILL.md:47`: the edited bullet line is 96
  characters where its neighbours wrap near 78, and it says "(B11)" twice in
  one sentence ("…"about five"; B11 said three, now five). If a sixth would
  open, stop (B11)."). It reads correctly. Worth a look: re-wrap while
  reading the diff, if wanted.

## Not checked
- Whether five concurrent runs fit in this machine's memory: the intent's
  known risk, which the new `CLAUDE.md` sentence (stagger heavy steps)
  mitigates; not something this change can prove.
- How `/auto` and `/spawn` behave under the new wording: prose instructions,
  no script enforces the number (searched: none does; the orchestrator has
  no session limit).
- Dev ports for five sessions: 5200 + id mod 100, so distinct ids don't
  collide; not exercised.

## Live check
not needed — no path-rule-1 path and no `.claude/settings.json` change; no
Not-checked item is runtime behaviour a live run would show. e2e not run (no
`src/scenes`, `src/ui`, `src/main.ts` or `e2e` change).

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `f9d3b8c`, `git status --short` clean
before and after):
- `git diff main...HEAD`: read whole; 5 files, 14 insertions, 12 deletions
  (`CLAUDE.md:85`, `:184-187`; `sdlc.md:46`, `:121`; `auto/SKILL.md:46-47`,
  `:240`; `spawn/SKILL.md:26-28`; `metadata.yml`). The `/auto` arithmetic is
  consistent: "fewer than five other" open means the new run is at most the
  fifth, and a sixth stops; `/spawn` asks at five or more open.
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 64 files,
  1183 tests (matches the implementer and the reviewer).
- `npm run check:intent`: PASS, 4 files, 20 lines (matches).
- `iconv -f UTF-8 -t UTF-8` on the four changed docs: all pass.
- `npm run sdlc:scan -- --sample-due auto --exclude 60`: nth attested auto
  change = 4, every 3, `sampled: no`.

**Reviewer agent** (same worktree and HEAD, foreground): the same verify and
check:intent results; a repo-wide search (CLAUDE.md, sdlc.md, AGENTS.md,
REVIEW-POLICY.md, OVERVIEW.md, README.md, intents/README.md, docs/, .claude/,
.codex/, tools/orchestrator/, scripts/) for "three", "four(th)", "fewer
than", "about N", session-limit constants and "too many sessions": every
remaining hit is about something else (three review rounds and
`AUTO_MAX_ROUND = 3`, "three places", "three inputs", the AI's fourth
difficulty tier, test fixture names, B11 of other specs); per-file CR counts
against `main` (no end-of-line churn); `intents/50-sdlc-auto-mode/spec.md:117`
confirms "B11 said three".

**Taken on trust:** nothing beyond the searches above.
