# Architecture principles

This file is the only place a principle's wording lives (§61). Review pass 10
(`REVIEW-POLICY.md`) and the KonMari brief point here and don't restate it.
A new layer, boundary or exception is added here, with its reason, in the
change that needs it (principle 17).

Each principle says how it is checked:

- **Enforced**: a lint rule or a check fails `npm run verify` or
  `npm run check:intent`.
- **Judged**: review pass 10 reads the plan's "Where this goes" section and
  the diff against it.

## Layers and dependencies

1. **Engine and data stay pure.** `src/engine/` and `src/data/` never import
   Phaser, `scenes` or `ui`, and use no browser APIs. *Enforced for imports*
   (`no-restricted-imports` in `eslint.config.js`, proved by
   `scripts/architecture-rules.test.mjs`); *Judged* for the rest.
2. **Dependencies point one way.** `scenes` → `ui` → `engine` → `data`, never
   back up. Skipping a layer downwards is allowed (`scenes` may import
   `engine` and `data` directly). `src/map-editor/` is a top layer beside
   `scenes`: it may import `ui`, `engine` and `data`, and neither it nor
   `scenes` imports the other. *Enforced* (same rule).
3. **The server only stores.** `server/` holds no game rule and imports only
   `src/engine/saveGame.ts` from the game. *Enforced* for non-test files.
4. **Tooling stays out of the game.** `tools/` and `scripts/` are never
   imported by the game, and the build contains nothing from them. *Enforced
   for imports*; the build half follows, since Vite bundles only what `src/`
   imports.

## Where logic lives

5. **Rules live in the engine or data.** Scenes and UI only wire up clicks and
   draw. *Judged.*
6. **One source of truth.** A rule or number has one home, and anything
   showing it reads from there. *Judged.*
7. **State changes go through the engine.** A scene changes game state through
   `applyAction` or engine functions, not inline. The post-combat bookkeeping
   is the known exception; new exceptions aren't allowed. *Judged.*
8. **The engine returns data, not text.** Player-facing text lives only in
   `src/ui/i18n/`, in English and French. *Enforced in part* by
   `noLiterals.test.ts`; *Judged* for the engine.

## State and determinism

9. **Game behaviour stays deterministic.** Randomness comes from the injected
   die or seeded generator, so a seeded game replays identically. An
   injectable default (`rng = Math.random`, `options.rng ?? Math.random`) is
   allowed; a direct `Math.random()` call that a caller can't replace is not.
   *Judged*, backed by the self-play tests. No lint rule.
10. **Humans and computer players use the same rules.** Anything a player can
    do has an action `legalActions` and `applyAction` know about, or the plan
    says why not. *Judged.*
11. **Save and undo stay safe.** A change to game state's shape deals with
    save compatibility, and each undoable change records history first.
    *Judged.*

## Size and structure

12. **Modules have one clear job.** A new module's purpose fits in a sentence,
    and new work doesn't pile into a large file when it has a natural home
    elsewhere. *Judged.*
13. **Size limits and the budget.** The existing limits stay (file 500 lines,
    function 80, complexity 20, 7 parameters, nesting 4, lint cap never
    raised). A file over 500 lines can't grow beyond its ceiling in
    `scripts/size-baseline.json`, and a ceiling can't rise by more than 50
    lines per intent, or at all without a `budget:` line in the plan's "Where
    this goes". *Enforced* by `npm run check:intent`. The ceiling counts
    physical lines (`wc -l` style); the lint rule skips blank and comment
    lines. The two measure different things.
14. **Few dependencies.** A new dependency needs a reason, is pinned and goes
    in the plan. *Judged* (review pass 8).

## Tests and traceability

15. **Logic is testable without a browser.** New logic goes in pure functions
    with tests; only wiring and drawing rely on e2e and the live check.
    *Judged.*
16. **Interpretations leave a trace.** A rulebook reading or deliberate
    departure gets a code comment where it's implemented, and the README
    records departures. *Judged.*
17. **Structural decisions are written down.** A new layer, a new boundary or
    an exception goes in this file with its reason. *Judged.*

## Recorded exceptions

| Exception | Principle | Reason |
| --- | --- | --- |
| Post-combat advance/elimination bookkeeping mutates `GameState` inline in `BoardScene` | 7 | Not yet extracted to the engine; no new exceptions are allowed |
| `src/map-editor/` is a second app and a top layer beside `scenes` | 2 | It is a standalone tool; it reuses `ui/hexRender`, `ui/i18n`, `data/*` and `engine/hex` |
| `server/**/*.test.ts` import more of `src/` than `engine/saveGame` | 3 | Tests build fixtures from `engine/army`, `state` and `turnManager` |
| `Math.random` as an injectable default (`dice.ts`, `actions.ts`, `randomAgent.ts`, `heuristicAgent.ts`) | 9 | Production play needs a default; a caller can always inject a seeded generator |
| `src/data/map.ts` is excluded from the size budget and the file-length lint | 13 | It is generated by the map editor and `tools/map-extract`, not hand-written |
