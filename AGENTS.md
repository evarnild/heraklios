# Codex Instructions

This repository has existing Claude Code guidance. Use it as shared project
context, but keep Claude-specific files and Codex-specific files separate.

## Shared Project Context

- Read `CLAUDE.md` for the project overview, architecture, and coding
  conventions.
- Treat `plan.md` section 10 as the current queue/status source.
- Do not edit `plan.md` unless the user explicitly asks for a plan/status
  update.

## Ownership Boundaries

- Do not modify `.claude/` or remove `.claude/worktrees/`; those are Claude
  Code-owned.
- Do not assume Claude's local worktrees or unpushed branches are visible from
  this checkout.
- Before starting implementation work, check `git status`, `git branch`, and
  `git worktree list`.
- Use a Codex-created branch/worktree for Codex work when work may overlap with
  Claude Code.

## Verification

- Prefer `npm run build` and `npm test` for final verification.
- Do not use bare `npx tsc --noEmit` as final proof; `plan.md` documents a
  false-green failure mode when `node_modules` is missing.
- If a worktree lacks dependencies, prefer installing dependencies in that
  worktree instead of junctioning `node_modules`.

## Implementation Conventions

- Rule logic belongs in `src/engine/` or `src/data/` with focused tests.
- Phaser/DOM presentation belongs in `src/scenes/` or `src/ui/`.
- `GameState` is mutated in place; push to `engine/history.ts` before any new
  undoable mutation.
- A die roll or phase change is an undo/redo boundary.
- If `GameState` shape changes, update save/load code and tests, including
  `SAVE_VERSION` when needed.
- Ambiguous rulebook interpretations should be recorded in a code comment at
  the implementation site.
