# §26 plan — AI-native SDLC kit

Intent: [intent.md](intent.md)

## Goal

Give heraklios the repository-level pieces of the AI-native SDLC strategy so
the next work item can go through the intent → plan → change → review chain,
and so the grid can be read from the repo.

## Risks

- A lint fix that silently changes behaviour (e.g. removing an unused
  variable whose initialiser had a side effect).
- A type check that blocks legitimate work, so it gets ignored.
- Process weight on small changes — the types exist to prevent that.
- Agent instructions drifting apart (Claude vs Codex definitions).

## Verified against the codebase

- `package.json` had no lint or verify script; `CLAUDE.md` said "There is no
  separate lint script".
- `vitest.config.ts` included only `src/**/*.test.ts`.
- `.claude/agents/heraklios-implementer.md` rule 4 told the implementer to use
  `npx tsc --noEmit`, which `AGENTS.md` and `plan.md` §4 call a false-green
  hazard.
- `plan.md` Current Queue: In flight and Queued both empty.
- Highest § used: §25.

## Subtasks

1. ESLint 9 + typescript-eslint flat config; correctness rules as errors,
   guardrails as warnings capped at the current count (21).
2. Fix the 11 lint errors, behaviour-neutral.
3. `npm run verify` = build + lint + test.
4. `scripts/intent-check-lib.mjs` + tests, `scripts/check-intent.mjs`
   (`npm run check:intent`).
5. `scripts/sdlc-scan.mjs` (`npm run sdlc:scan`).
6. `intents/README.md` + `_templates/`.
7. `REVIEW-POLICY.md`.
8. Skills: `/intent`, `/review`, `/grid` in `.claude/skills/`.
9. `docs/sdlc-grid.md` first fill.
10. Update `CLAUDE.md`, `AGENTS.md`, both Claude agents, both Codex agents,
    `plan.md` management rules and queue format.
11. This intent folder, then `/review` it.

## Tests

- `intent-check-lib.test.mjs`: branch parsing, metadata parsing (CRLF,
  comments, quotes, lists), every error, every route, gate-before-code.
- Full existing suite stays green after the lint fixes.

## Validation

- `npm run verify` green
- `npm run check:intent` → ROUTE (refactor touching tests), reason in review.md
- Manual check: none for game behaviour

## Assumptions I made

See intent.md.

## Progress

- 2026-10-07 — subtasks 1–10 done on `refactor/26-ai-sdlc-kit`. Writing the
  check-lib tests caught a real bug in the first version: an empty `gate:`
  line parsed as `[]`, which is truthy, so an unrecorded gate passed.
