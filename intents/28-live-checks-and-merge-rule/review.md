<!-- generated-by: heraklios/review@0.1.1 -->
# §28 review — Live checks for untested behaviour, and the agent-merge rule

verdict: rework
tier: reviewed
reviewed-commit: ac94c0a
round: 1
sampled: no
live-check: owed

Tier: **path table** → Reviewed (`REVIEW-POLICY.md`, `.claude/skills/**`,
`.claude/agents/**`, `.codex/agents/**`), and `metadata.yml` says
`review_tier: reviewed` too. Two findings need rework, so the verdict is
`rework`. Without them it would be `escalate`.

Run with the `/review` skill at 0.1.1 (main's copy), against this branch's
`REVIEW-POLICY.md`. This branch changes the rules for its own merge, so the
report already uses the new `live-check:` field and `## Live check`
section (plan → Risks, AC8).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — see finding 1; the 4 divergences in Progress are declared, and each one holds up |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — process change, no rulebook behaviour (spec: "digital-only") |
| 4 | Tests prove the rule, not only pass | findings (3) — 12/16 mutants killed |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | pass — 600 tests and 21 warnings reproduced; 585 → 600 matches the 15 tests added; "12 red" taken on trust |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass — lint 0 errors / 21 warnings, cap 21 unchanged, no new dependency |
| 9 | Repository-specific footguns | not run — no drift, AI-tier or map-editor code touched |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 28, feature)
  note:  12 file(s), 302 line(s) changed outside intents/.
```
(Run before this `review.md` existed. Now that the report says
`live-check: owed`, the same command FAILs until `live_checked:` is
recorded. That FAIL is expected, it is the owner's to clear, and it is
the probe below.)

## Findings

1. **MEDIUM** `REVIEW-POLICY.md:109` (also `:93`, spec B2.1/B7) — the merge
   preconditions don't fit how a review gets recorded. The review is
   committed on top of the commit it reviewed: §27 has `reviewed-commit:
   02829c8`, and its review was committed as `f077fd3` on top of it. The
   owner's `live_checked:` date is another commit on top. Either way, "its
   `reviewed-commit` is the branch's HEAD (no unreviewed commits on top)"
   is false at merge time. An agent following it literally refuses every
   merge, and one that bends it is the "written rules can be bent" problem
   this intent sets out to fix. The opposite case is worse: if `review.md` is
   *not* committed, `npm run check:intent <branch>` reads the branch through
   `git show` and never sees `live-check: owed`, so the enforcement
   (precondition 2, the one B7 relies on) passes. The probe below shows
   exactly this. **Needs rework:** precondition 1 should allow commits
   after `reviewed-commit` that touch only `intents/<id>-*/review.md` and
   `metadata.yml`, and the policy (plus `sdlc.md` step 5) should say that
   `review.md` and `live_checked:` are committed to the branch before the
   merge check. A cheap backstop would be for `check:intent` in branch mode
   to warn when the working tree has a `review.md` that the branch lacks.
   That backstop is optional.
2. **MEDIUM** `scripts/check-intent.mjs:67`, `:93` — the CLI wiring that
   makes B7 real is untested. Mutants M14 (delete the `review.md` read) and
   M15 (stop passing `review` to `checkChange`) both **survive** the full
   suite. The plan's Tests section said that if they survive, a CLI test
   gets added "in the same style as `spawn-intent.test.mjs`, in a temp
   repo". The Progress entry records a manual probe instead. **Needs
   rework:** add that test (temp repo with a `review.md` saying `owed` →
   exit 1 with the `## Live check` message; add `live_checked: <date>` →
   exit 0). If it runs the CLI in branch mode too, it also pins finding 1's
   behaviour.
3. **LOW** `scripts/intent-check-lib.mjs:180` — mutant M5 (`state ===
   undefined` → `!state`) survives. A bare `live-check:` header line (empty
   value) FAILs today as "not a value", but no test pins that, so a
   "simplification" to `!state` would quietly read a half-written report as
   "nothing owed". **Needs rework:** one assertion,
   `checkChange(feature({ review: { 'live-check': '' } }))` has an error.
   It folds into finding 2's commit.
4. **LOW** `scripts/intent-check-lib.mjs:177` — mutant M4b (drop the
   `return` after an invalid `live_checked`) survives. The only effect is an
   extra "owed" error next to the date error. Worth a look:
   `expect(r.errors).toHaveLength(1)` in the invalid-date loop would pin it.
5. **LOW** `CLAUDE.md:66`, `sdlc.md:57` — CLAUDE.md says a scenes/UI/
   map-editor/settings change "**usually** owes" a live check, but by
   `REVIEW-POLICY.md` → "Live checks" rules 1–2 it always does. Neither file
   lists `index.html`, `map-editor.html` or `vite.config.ts`. An agent reading
   only CLAUDE.md would treat a `vite.config.ts` change as exempt. Worth a
   look: drop "usually" and add the three paths (or "… and the HTML entry
   points / `vite.config.ts`").

Nit: `CLAUDE.md:99` is now a 120-character line inside a paragraph wrapped
at about 75 characters.

Pass 1 notes. These are not findings, just the owner's to accept, as
Progress asks:
- *Worktree, not the main checkout.* Fine. It matches §27's lesson.
- *`parseReviewHeader` stops at the first `## ` as well.* An improvement
  on the plan. Mutants M9/M10/M10b confirm both stops are tested.
- *The `/review` exemption for an owed-live-check-only FAIL.* This is new
  scope, but it follows from B7 + B8. Without it, every round after the
  first would turn into `rework`. Accept.
- *Empty `live_checked:` read as `[]` = not recorded.* Correct for
  `parseMetadata`, and pinned by a test (M2 killed).

## Not checked
- **Whether `/review` 0.1.2 actually behaves as written in a live session.**
  This run used 0.1.1. AC8 (run the new skill on a scratch branch touching
  `src/ui/`, see `live-check: owed` with concrete steps) is the owner's
  check and hasn't been done. → this is why a live check is owed.
- Whether the merge-rule wording changes agent behaviour, i.e. whether a
  future session refuses a merge it wasn't asked for, or one that fails a
  precondition. Only observable over real sessions.
- The Codex agents (`.codex/agents/*.toml`): I checked the text matches the
  Claude ones, but no Codex session was run to see them load. The TOML still
  parses as far as `"""` balance goes; I didn't run a TOML parser on it.
- "Tests first: 12 red → green" (Progress) is not reproduced. Checking it
  would mean checking out `aee3d7a`'s tests against the pre-change lib.
- `sdlc-scan.mjs` / `/grid` with a report that has `live-check:`. The spec
  leaves this out of scope. I confirmed by reading that `field()` takes the
  first match and doesn't depend on field order, but didn't run the scan.

## Live check
- owed: rule 3. The Not-checked item "whether `/review` 0.1.2 actually
  behaves as written in a live session" (AC8). No rule 1 or 2 path is
  touched.
- steps: in the main checkout (`C:\Users\eric\src\heraklios`), make a
  scratch branch from this one:
  `git switch -c feat/99-live-check-probe feat/28-live-checks-and-merge-rule`.
  Copy `intents/_templates/` to `intents/99-live-check-probe/`, fill in
  `id: 99`, `type: feature` and today's date in the three gates, add an
  empty `intent.md`, `spec.md` and `plan.md`, and change one comment line in
  `src/ui/session.ts`. Commit, then run `/review feat/99-live-check-probe` in
  a fresh Claude Code session (so it loads skill 0.1.2). Afterwards:
  `git switch main`, `git branch -D feat/99-live-check-probe`.
- you should see: the probe's `review.md` stamped `review@0.1.2`, with
  `live-check: owed` citing rule 1 (`src/ui/**`), and a `## Live check`
  section giving a command and port, a test-mode shortcut, the clicks and
  what to see. The closing message should contain "live check owed: …".
  Then `npm run check:intent` on that branch FAILs naming `## Live check`,
  and passes once you add `live_checked: <today>` to its `metadata.yml`.
  Then record `live_checked: <date>` in **this** intent's `metadata.yml`.

## Verified myself vs. taken on trust
- `npm run verify` in the worktree at `ac94c0a`: build OK, lint OK, **34
  files / 600 tests passed**.
- `npx eslint .`: **0 errors, 21 warnings** (cap 21, `package.json` and
  `eslint.config.js` unchanged on this branch).
- `npm run check:intent` (worktree, before writing this report): **PASS**,
  output above.
- `git diff --stat main...HEAD -- src index.html map-editor.html
  vite.config.ts .claude/settings.json eslint.config.js package.json`:
  empty.
- AC1 `grep -rn -i "never by an agent" --include=*.md --include=*.toml .`
  excluding `intents/2[678]-*` and `node_modules`: **no matches**.
- Merge-wording sweep over `CLAUDE.md`, `AGENTS.md`, `sdlc.md`,
  `.claude/agents`, `.codex/agents`, `.claude/skills`: everything that states
  the rule agrees with B1 (finding 5 is about the live-check wording, not
  the merge rule).
- Mutation pass: scratchpad script, one mutant at a time, **full `npx vitest
  run`** each time. Before each run it checks the file really changed, and
  it restores the file from memory afterwards. `git status --short` was
  clean at the end.
  - killed: M1 drop the `checkLiveCheck` call (9 failed) · M2 `[]` counts as
    recorded · M3 drop `typeof v !== 'string'` · M4 drop the invalid-date
    check (5) · M6 drop the value check · M7 owed never fails (3) · M9 no
    stop at `## ` (2) · M10 no stop at `# Round` · M10b `break` → `continue`
    (3) · M11 unanchored key regex · M12 no trailing-space trim · M13 LF-only
    split
  - survived: **M4b** drop the early `return` (finding 4) · **M5**
    `=== undefined` → `!state` (finding 3) · **M14** drop the CLI
    `review.md` read · **M15** CLI not passing `review` (finding 2)
  - not run: `state !== 'not-needed'` in place of `state === 'owed'` is
    equivalent behind the value check.
- CLI probe of finding 1, run with this branch's own `scripts/check-intent.mjs`
  after writing this report (uncommitted, `live-check: owed`, no
  `live_checked:`):
  - working-tree mode, `node scripts/check-intent.mjs` in the worktree:
    **FAIL, exit 1**, "A live check is owed and not recorded. Do the steps
    in intents/28-live-checks-and-merge-rule/review.md → ## Live check …".
    So B7 works when the report is on disk.
  - branch mode, `node scripts/check-intent.mjs
    feat/28-live-checks-and-merge-rule` in the same worktree: **PASS, exit
    0**. The uncommitted report is invisible, so the owed check isn't
    enforced. This is finding 1.
  - (Running branch mode from the main checkout also PASSes, but that tells
    you nothing: main's script predates this branch.)
- Taken on trust: "12 red → green" (tests first), and the implementer's
  own CLI probe in Progress (re-done myself below).
