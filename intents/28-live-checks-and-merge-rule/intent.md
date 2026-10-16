<!-- generated-by: heraklios/intent@0.1.1 -->
# §28 — Live checks for untested behaviour, and the agent-merge rule

**Type:** feature
**Originator:** me (Eric), after running the process on §26 and §27
**Source:** chat review of the SDLC on 2026-10-08, points 3, 4 and 5

## Problem

Three gaps showed up the first two times the process ran.

1. **The merge rule says one thing; practice does another.** `CLAUDE.md:61`
   says merges into `main` are "done by the owner, never by an agent", and
   `CLAUDE.md:91` says "The owner merges". For both §26 and §27 I asked Claude
   to merge, and it did. Agents read rules literally, so the rule either
   blocks something I want or teaches agents that written rules can be bent.
   `sdlc.md:67` already says Claude merges when asked, so two documents
   disagree.
2. **The Attested tier for `src/scenes/**`, `src/ui/**` and
   `src/map-editor/**` rests on reasoning, not evidence.** `REVIEW-POLICY.md`
   → "Prerequisites" allows the Attested tier only where a meaningful test
   suite exists, but scenes and UI have no tests (`CLAUDE.md` →
   Architecture: "scenes/ui are Phaser/DOM presentation and are not"
   unit-tested). A `/review` of a `BoardScene` change can read the code, but
   nobody has seen it run.
3. **The checks that mattered most sat outside the process.** §27's real
   risk was whether hooks fire in a live session, and the only check that
   could answer it was manual, done by me, outside any step. In
   `review.md` it was a line under "Not checked", and nothing required anyone
   to act on it before the merge. For a game, "does it play right" is the same
   kind of check, and the process has nowhere to put it.

## Outcome

- Every document that states the merge rule (`CLAUDE.md`, `sdlc.md`, the
  reviewer/implementer agent definitions if they state it) says the same
  thing: an agent merges or pushes only when the owner explicitly asks in
  that conversation, and never on its own initiative.
- A change touching `src/scenes/**`, `src/ui/**` or `src/map-editor/**`
  cannot reach merge at the Attested tier without a recorded live check (a
  run in the browser covering the changed behaviour), or it goes to the
  Reviewed tier instead.
- When a review's "Not checked" list contains runtime behaviour that only a
  live run can show (hooks, browser behaviour, real installs), the process
  names a live check as a step before merge, with a place where its result is
  recorded, and `/review` tells the owner it is owed.
- `sdlc.md` shows the live check as part of steps 5–6.

## Constraints

- `REVIEW-POLICY.md`, `.claude/skills/**`, `.claude/agents/**` and
  `.codex/agents/**` are Reviewed-tier paths, so this whole change is
  Reviewed.
- No game code changes: nothing in `src/` moves.
- Keep the recording flat-text so `scripts/intent-check-lib.mjs` and
  `scripts/sdlc-scan.mjs` can parse it without a YAML dependency, if the spec
  decides they should read it.
- Don't make small changes heavier: a README tweak or an engine change fully
  covered by tests must not need a live check.
- The owner remains the one who approves; a live check done by an agent (for
  example through the browser) counts only if the spec says so explicitly.

## Type-specific questions

### Feature
- **Users:** the owner (Eric) and the agents that read `CLAUDE.md`,
  `REVIEW-POLICY.md` and the skills.
- **Rulebook basis:** digital-only — process, no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - Where is a live check recorded: a `## Live check` section in
    `review.md`, a dated `live_checked:` field in `metadata.yml`, or both?
  - Who may do it: only the owner, or also an agent driving the browser in
    test mode, and does that count the same?
  - Does a missing live check block merge, change the verdict (for example
    `attest` → "attest once live-checked"), or only warn?
  - Should `check:intent` or `sdlc:scan` read it, or is it documentation
    only for now?
  - For a scene/UI change, is the alternative simply the Reviewed tier, or
    should those paths move to Reviewed outright?
  - Does the merge rule also cover `git push` and `npm run spawn --remove`
    (both outward-facing or destructive)?

## Assumptions I made

- **Type is feature, not adjustment.** It touches more than 5 files
  (`CLAUDE.md`, `REVIEW-POLICY.md`, `sdlc.md`, the review skill, the reviewer
  agent and its Codex mirror, possibly `AGENTS.md`) and has open design
  questions, which is the feature lane. If you'd rather, point 1 alone could
  be split out as an adjustment.
- The three points belong in one intent because they edit the same documents
  and all come down to "what must happen before a merge".
- The live check targets the existing test-mode shortcuts (`src/ui/testMode.ts`)
  and `npm run dev`, not a new browser-test harness. A Playwright-style
  harness would be a separate, larger intent.
