<!-- generated-by: heraklios/intent@0.1.1 -->
# §28 plan — Live checks for untested behaviour, and the agent-merge rule

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Make the documents agree on when an agent may merge (spec B1–B2), and turn
"a live run nobody owes" into a recorded, owner-held gate that `/review`
raises and `check:intent` enforces (B3–B11). One small code change
(`check:intent`), the rest is policy, skill and agent text.

## Risks

- **Text drift across eight documents.** The merge rule and the live-check
  rule are restated in several places; one stale copy is what this intent
  exists to fix. Mitigation: B1 is written once in `REVIEW-POLICY.md` and
  the other files say it in the same words or point to it; `/review` pass 7
  greps for the old wording (AC1).
- **Reading a history round's header.** `review.md` keeps earlier rounds
  below `# Round N (history)`, with their header fields turned into list
  items (`- live-check: owed`). A parser that matches anywhere in the file
  would read them. Mitigation: read only lines above the first `# Round`
  heading, and only lines that start with the field name (AC5).
- **Tests that pass whatever the code does.** The failure §26/§27 review
  rounds kept finding. Each new branch in the check gets a test that fails if
  it is mutated (see Tests).
- **Lint cap.** `checkChange` is near the complexity guardrail; adding
  branches inline could add a warning and break `--max-warnings 21`. The new
  logic goes in its own function.
- **This branch changes the rule that governs its own merge.** Once merged,
  §28's own `review.md` must satisfy B7, so its review must say what a live
  check means for it (AC8).

## Verified against the codebase

Re-read on `main` at `6a86c84`:

- `CLAUDE.md:61` — "Merges into `main` are local and done by the owner, never by an agent."
- `CLAUDE.md:91` — "The owner merges, one branch at a time, …"
- `CLAUDE.md:95` — a spawned session "never merges" (stays: it is a spawned session's rule, consistent with B1).
- `sdlc.md:64-68` — the "Merging is: …" paragraph and "You can ask Claude to do the merge".
- `AGENTS.md` — no merge rule today (only a line about worktrees at :22); B1 is added.
- `.claude/agents/heraklios-implementer.md:29` — "Do NOT push, do NOT merge, do NOT touch `main`".
- `.codex/agents/heraklios-implementer.toml:15` — "Do not push, merge, or switch main unless explicitly instructed."
- `.claude/agents/heraklios-reviewer.md:29`, `:111-112` — read-only; "nothing was pushed".
- `.claude/skills/review/SKILL.md` — sections 0–5; "Not checked" rules at :72; "Tell the user" at :86; version 0.1.1.
- `REVIEW-POLICY.md` — Tiers table :25-28, Prerequisites :35, report format block after "## The report".
- `intents/README.md:65-70` — Gates table.
- `intents/_templates/metadata.yml` — gate fields; `live_checked:` goes after `plan_approved:`.
- `scripts/intent-check-lib.mjs:115` — `checkChange({ branch, metadata, intentDir, intentFiles, diff })`; gates checked with `GATE_DATE_RE` at :147-156.
- `scripts/check-intent.mjs:52-67` — reads `intentFiles` and `metadata.yml` through `source.read`, which works for a named branch (`git show`) and for the working tree; `review.md` is read the same way.
- `scripts/intent-check-lib.test.mjs` — `describe('checkChange')` and `describe('gates must hold a date')` are where the new tests go.
- `scripts/sdlc-scan.mjs:55` — reads `verdict/tier/round/sampled` with a first-match `field()`; not changed (spec: out of scope).
- Highest § used: §28.

## Subtasks

1. **`check:intent` reads the live-check field** (tests first).
   - `intent-check-lib.mjs`: export `parseReviewHeader(text)` — the
     `key: value` lines above the first `# Round` heading, keys as written
     (`verdict`, `live-check`, …).
   - New `checkLiveCheck({ review, metadata, intentDir }, errors)` called
     from `checkChange`, which gains an optional `review` (the parsed
     header, or `null`). Rules: `live_checked` set but not a date → FAIL;
     `live-check` present with a value other than `owed` / `not-needed` →
     FAIL; `owed` with no valid `live_checked` → FAIL naming
     `${intentDir}/review.md → ## Live check`.
   - `check-intent.mjs`: when `intentFiles` includes `review.md`, read and
     parse it and pass it in.
2. **`REVIEW-POLICY.md`**: the merge rule (B1, B2) in a short "Merging"
   subsection; a "Live checks" subsection (B3–B8); the report format gains
   `live-check:` and `## Live check`; Prerequisites says the live check
   stands in for missing tests on scenes/ui/map editor.
3. **Skill and agents**: `/review` skill — decide `live-check` after the
   passes, write the section with concrete steps, add the line to "Tell the
   user"; bump to 0.1.2 and its stamp. `heraklios-reviewer` (Claude `.md`
   and Codex `.toml`) — same rule, and "a browser run is evidence, never
   the gate" (B6). Implementer agents (both) — B1 wording.
4. **Owner-facing docs**: `CLAUDE.md` "How work flows" (B1, replacing :61;
   :91 says the owner, or an agent on the owner's explicit request, merges);
   `AGENTS.md` (B1); `sdlc.md` steps 5–6 (live check, B1, B2);
   `intents/README.md` Gates table (`live_checked`); metadata template.
5. **Verify and hand over**: `npm run verify`, `npm run check:intent`, set
   `status: in-review`, append `## Progress`.

## Tests

In `scripts/intent-check-lib.test.mjs`, each behavioural line paired with
the test that fails if it is mutated:

- `parseReviewHeader` reads `verdict` and `live-check` from the top block.
- …and ignores a `- live-check: owed` list item and any `live-check:` line
  below `# Round 2 (history)` (kills: removing the stop-at-`# Round` check;
  matching anywhere on the line).
- `owed` + empty `live_checked` → error mentioning `## Live check` (AC2).
- `owed` + `live_checked: 2026-10-09` → no error (AC3).
- `live_checked: yes` → error, whatever the review says (AC3).
- `not-needed` → no error; no review at all → no error (AC4).
- `live-check: owned` (typo) → error (kills: dropping the value check).
- `owed` with source code untouched still FAILs — the live check is about
  the merge, not about code before a gate (kills: reusing the
  `touchesSource` downgrade from the gate loop).

Mutation pass in `/review` covers these lines plus the `check-intent.mjs`
read (delete the `review.md` read → AC2 test via the CLI must fail; if no
CLI test exists for it, add one in the same style as `spawn-intent.test.mjs`,
in a temp repo).

## Validation

- `npm run verify` green; lint warnings not above the cap of 21.
- `npm run check:intent` PASS on `feat/28-live-checks-and-merge-rule`.
- `grep -rn -i "never by an agent" --include=*.md --include=*.toml .`
  (excluding `intents/26-*`, `intents/27-*`, `intents/28-*`) finds nothing (AC1).
- Manual check (AC8, owner): on a scratch branch touching one line in
  `src/ui/`, run `/review` and confirm `live-check: owed` with concrete
  steps; then confirm `check:intent` FAILs until `live_checked:` is set.
  Delete the scratch branch afterwards.

## Assumptions I made

- The new CLI-level test is added only if the mutation pass shows the
  `check-intent.mjs` read is otherwise unprotected.
- `sdlc-scan.mjs` keeps its own first-match parser; sharing
  `parseReviewHeader` with it is left to §29, which changes the scan anyway.
- Branch: `feat/28-live-checks-and-merge-rule`, from `main` in the main
  checkout (no spawn needed for one intent).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-08 — subtasks 1–5 (Claude, coordinator session acting as implementer)

- Commits: `aee3d7a` (check:intent, tests first: 12 red → green),
  `4305434` (REVIEW-POLICY Live checks + Merging), `71a383c` (/review 0.1.2,
  reviewer and implementer agents, Claude + Codex), then the docs commit
  (CLAUDE.md, AGENTS.md, sdlc.md, intents/README.md, metadata template).
- `npm run verify`: 34 files, 600 tests (585 → 600), lint 0 errors /
  21 warnings (cap unchanged). `check:intent`: PASS. AC1 grep: clean.
- Spot mutation: removing the `# Round` stop in `parseReviewHeader` fails
  "stops at # Round even in a report with no ## sections".
- CLI probe: a temporary `review.md` with `live-check: owed` made
  `check:intent` FAIL with the `## Live check` message; `not-needed` passed.
  File removed afterwards.

Diverged from the plan — for the owner to accept or reject in review:

1. **Worktree, not the main checkout.** Built in a spawned worktree
   (`npm run spawn -- 28`), not on a branch in the main checkout as the
   plan's Assumptions said: switching branches there is what the §27 work
   taught us not to do.
2. **`parseReviewHeader` stops at the first `## ` section** as well as at
   `# Round`. The plan said "above the first `# Round` heading"; that would
   also read `key: value` lines in the report body (a pasted
   `type-check: PASS`, a bare `live-check:` under `## Live check`).
3. **`/review` exempts one FAIL from automatic rework.** Once a round says
   `live-check: owed`, re-running `check:intent` FAILs until the owner
   records the date, and the skill turned any FAIL into `rework`. Added to
   the skill and both reviewer agents: a FAIL whose only error is the owed
   live check is the owner's to clear. Not in the plan; follows from B7+B8.
4. **Empty `live_checked:` parses as `[]`** (parseMetadata's empty-list
   form), so it is read as "not recorded", not "invalid"; a test pins it.

### 2026-10-16 — round-1 rework (Claude; owner said "fix and run round 2")

- Finding 1 (MEDIUM): `REVIEW-POLICY.md` → "Merging" precondition 1 now
  allows commits after `reviewed-commit` that touch only the intent's
  `review.md` / `metadata.yml`, and says both are committed before the merge
  check. `sdlc.md` step 5–6 says the same. This changes spec B2.1, with the
  owner's go-ahead. Backstop added: `check:intent <branch>` run in that
  branch's own checkout FAILs while either file has uncommitted changes
  (`git status`, so CRLF conversion can't false-alarm).
- Finding 2 (MEDIUM): new `scripts/check-intent.test.mjs`, the CLI end to
  end in a temp repo (5 tests): branch mode from another checkout, working
  tree mode, the uncommitted-date backstop, committed date passes, and a
  stray file in another checkout is ignored.
- Finding 3 (LOW): a bare `live-check:` line is pinned as an error.
- Finding 4 (LOW): round 1's reading was off — dropping the early `return`
  never added an "owed" error (an invalid date already counts as
  recorded); it only hid a bad `live-check:` value. Removed the `return`
  so both problems are reported, pinned by a test, and the invalid-date
  loop asserts exactly one error.
- Finding 5 (LOW) + nit: `CLAUDE.md` and `sdlc.md` say "always owes" and
  list `index.html`, `map-editor.html`, `vite.config.ts`; the long
  `CLAUDE.md` line is rewrapped.
- Mutants re-run (scratchpad script, full `scripts/` suite each, file
  restored after each, `git status` clean): M14, M15, M5 killed; new
  backstop mutants M16 (error dropped) and M17 (HEAD check dropped) killed.
- `npm run verify`: 35 files, 607 tests, lint 0 errors / 21 warnings.
  `check:intent`: FAIL on the owed live check only — expected, the owner's
  to clear.

### 2026-10-16 — round-2 rework

- Finding 1 (MEDIUM): new CLI test, an uncommitted `review.md` in the
  branch's own checkout fails the branch-mode check. Mutant M21 (drop
  `review.md` from the backstop's pathspec) now killed (1 failed).
- Finding 4 (LOW): `REVIEW-POLICY.md` → "Merging" precondition 1 reads the
  verdict from the branch's committed `review.md` (`git show`), requires
  `reviewed-commit` to be an ancestor of the branch (a rebase means a new
  round), and keeps the `git diff --name-only` end-state check. The
  backstop stays narrow (named branch checked out); the policy is the rule.
- Finding 3 (LOW), correcting the round-1 entry above: `git status` can
  false-alarm after all. With `core.autocrlf true`, rewriting a file with
  only its line endings changed shows ` M` until git refreshes the index
  (any `git status`/`commit` does). Rare; the fix is to commit or re-run.
- Finding 2 (LOW): `spec.md` B2.1 still states the old precondition. Left
  as is: the spec is the owner's file.
