# §26 — AI-native SDLC kit

**Type:** refactor
**Originator:** Eric — "implement my AI SDLC strategy … on my heraklios project"
**Source:** *AI-Native SDLC — strategy (v2)*, *implementation (v2)* and *AI
Coding & Agent Usage Guidelines (May 2026)* (outside the repo)

## Problem

Heraklios already works the way the strategy wants in spirit — plans before
code, an implementer agent, an adversarial reviewer — but nothing of it is
in a shape the next stage, a skill or a measurement can read. Work items
live as prose sections in a 550-line `plan.md`; there is no one command an
agent can call to validate a change (`tsc` + `vitest` are run separately and
`npx tsc` has false-greened); there is no linter; the review standard lives
only inside the reviewer agent's prompt; nothing says which changes need a
full diff read and which don't; and there is no way to tell, from the repo,
what level each stage is at or whether it is paying off.

## Outcome

- The repo meets the strategy's org-wide rules for one repository: agent-ready
  (context file + `npm run verify`), automated review against a written,
  repository-specific policy with three tiers, reusable skills declared.
- New work follows the intent → (spec) → plan → change → review chain in
  `intents/<id>-<slug>/`, with types that keep small changes cheap, and a
  check that the declared type matches what arrived.
- A first, honest grid with the two stages to move this quarter, and a
  baseline computed from git history.

## Constraints

- Local merges stay; no PR or GitHub Actions dependency.
- `plan.md` stays the coordinator view; `plan-history.md` is not touched.
- No game behaviour changes. Lint fixes in `src/` must be behaviour-neutral.
- Existing guardrail violations (e.g. `BoardScene.ts` ~1900 lines) are not
  fixed here — they are capped so they can only go down.

## Type-specific questions

### Refactor
- **What is restructured:** the development process and its tooling, not
  the game: `package.json` scripts, `eslint.config.js`, `scripts/`,
  `intents/`, `REVIEW-POLICY.md`, `.claude/skills/`, agent definitions,
  `CLAUDE.md`/`AGENTS.md`/`plan.md` guidance, `docs/sdlc-grid.md`.
- **How behaviour is held constant:** the full existing vitest suite stays
  green; the only `src/` edits are lint fixes (unused imports/variables,
  `let`→`const`, two `a && (b += 1)` expressions rewritten as `if`).
- **Why now:** the strategy's September items, and the queue is empty — no
  in-flight work to disrupt.

## Assumptions I made

- The id is §26: §25 is the highest number in `plan.md` / `plan-history.md`.
- "Refactor" over "feature": nothing a player sees changes. The type check
  will ROUTE this because three test files lost a line each (removed unused
  variables) — expected, explained in `review.md`.
- `/spec` and `/plan` skills are left for later; the existing plan format
  plus the new template cover the plan step until the pilots show what a
  skill should do.
- Guardrail thresholds: function length 80 rather than the guideline's ~50
  (50 would flag most Phaser `create()` methods and test helpers, burying the
  signal); `no-magic-numbers` not enabled, because the rule tables are
  numbers by nature.
