<!-- generated-by: heraklios/intent@0.1.5 -->
# §60 — Up to five intents in parallel, not three

**Type:** adjustment
**Originator:** the owner (2026-10-25): "allow 5 parallel intents"
**Source:** none

## Problem

The SDLC caps parallel work at about three intent sessions or runs, and
`/auto` refuses a fourth: with §55, §56 and §58 running, §59 (accepted)
waits. The owner wants to run up to five at once. The limit is written as
prose and as a skill rule in four files:

- `CLAUDE.md:184-185` — "Keep it to about three intent sessions (or launched
  implementers) at once."; and `:85` — `/auto` stops on "a fourth open session".
- `.claude/skills/auto/SKILL.md:46-47` — "`npm run sessions` shows fewer than
  three other open intent sessions or runs (`CLAUDE.md`, "about three"). If a
  fourth would open, stop (B11)."; and `:240-241` — "a fourth open intent
  session or run (`too many sessions`)".
- `.claude/skills/spawn/SKILL.md:26-28` — "If three or more intent sessions
  are already open … say so and ask before adding a fourth."
- `sdlc.md:46` — "Keep it to about three at once."; and `:121` — "fourth open
  session".

## Outcome

- Each of those lines says five instead of three (and a sixth instead of a
  fourth): `/auto` starts a run while fewer than five other intent sessions or
  runs are open and stops (`too many sessions`) when a sixth would open;
  `/spawn` asks before adding a sixth; `CLAUDE.md` and `sdlc.md` say "about
  five".
- Nothing else changes: no script enforces a number (`npm run sessions` only
  reports), and the orchestrator has no limit of its own.

## Constraints

- **Memory on this machine:** with three runs open, test suites have been
  stopped twice for low memory, and an e2e scenario timed out under load
  (§54's reviews, 2026-10-24/25). Five runs make that likelier. The brief
  each implementer and reviewer gets already says to run suites one at a time
  in the foreground; this change adds, next to the new limit in `CLAUDE.md`,
  that the coordinator staggers heavy steps (e2e, mutation passes) rather than
  running them in parallel worktrees.
- **Tier:** `.claude/skills/**` is Reviewed by the path table, so the owner
  reads the diff.
- The historical spec (`intents/50-sdlc-auto-mode/spec.md`, B11) is not
  rewritten; the skill notes the new number.

## Type-specific questions

### Adjustment
- **Exactly what changes:** "three" → "five" and "fourth" → "sixth" in the
  lines above, plus one sentence on staggering heavy steps in `CLAUDE.md`.
- **Blast radius:** 4 files (`CLAUDE.md`, `sdlc.md`,
  `.claude/skills/auto/SKILL.md`, `.claude/skills/spawn/SKILL.md`), about 10
  lines, no rule code.

## Assumptions I made

- "5 parallel intents" counts the same thing the current "three" does: open
  intent sessions plus launched runs (implementers, `/auto` runs), not the
  coordinator itself.
- It stays guidance with a stop, as today, not a hard limit in a script.
