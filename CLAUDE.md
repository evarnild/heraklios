# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Héraklios is a browser-based, hotseat (2-4 player, shared screen) digital
implementation of a 1980 print hex wargame, built with TypeScript + Phaser 3.
The rules and map are transcribed from a scanned magazine insert (see
`docs/research/`). Read `README.md` for the full rules writeup — game phases,
combining attacks, naval movement/ramming/boarding, save/load, undo/redo — and
its "Known simplifications" section, which documents every place the digital
edition intentionally diverges from the print rules.

## Commands

```
npm install
npm run dev        # Vite dev server (main game at /, map editor at /map-editor.html)
npm run build      # tsc -b && vite build
npm run preview    # preview the production build
npm test           # vitest run — the full engine/data/map-editor test suite
npm run test:watch # vitest in watch mode
```

Run a single test file: `npx vitest run src/engine/combat.test.ts`.
Run tests matching a name: `npx vitest run -t "pattern"`.
Type-check without emitting: `npx tsc --noEmit` (the build uses `tsc -b`,
which is incremental — delete `tsconfig.tsbuildinfo` if a stale build info
file ever seems to mask an error).

There is no separate lint script; `tsc` (via `npm run build` or `--noEmit`)
and `npm test` are the two checks to run before considering a change done.

## Architecture

The codebase is split along one hard boundary: **engine/data are pure and
fully unit-tested; scenes/ui are Phaser/DOM presentation and are not.** When
adding a rule or behavior, put the logic in `src/engine/` or `src/data/` with
tests, and keep `src/scenes/` and `src/ui/` to wiring it up to click handlers
and rendering.

- `src/data/` — the rules *as data*: unit stats (`units.ts`), terrain effects
  (`terrain.ts`), the land combat-results table (`combatTable.ts`), naval
  ramming/boarding tables (`navalRamming.ts`, `navalBoarding.ts`), and the
  board itself (`map.ts`, a large generated file — see below).
- `src/engine/` — pure game logic, no Phaser import anywhere: hex math
  (`hex.ts`), army-purchase validation (`army.ts`), movement/ZOC
  (`movement.ts`, `navalMovement.ts`), combat resolution (`combat.ts`), turn
  sequencing (`turnManager.ts`), the state shape (`state.ts`), the undo/redo
  primitive (`history.ts`), and save-file serialization/validation
  (`saveGame.ts`).
- `src/scenes/` — the Phaser scenes, run in sequence: `MenuScene` →
  `ArmyBuilderScene` → `PlacementScene` → `BoardScene` → `GameOverScene`.
  `BoardScene.ts` is by far the largest file in the repo (~1600 lines) and
  owns movement clicks, combat-group building, retreat/drift prompts, and
  naval rotation/ramming/boarding UI.
- `src/ui/` — shared, Phaser-adjacent helpers used across scenes:
  `MapView.ts`/`hexRender.ts` (camera + hex grid rendering), `session.ts`
  (the in-memory `SessionState` — player setup, army selections, combat mode,
  test mode — that scenes read/write as they hand off to each other),
  `mapBounds.ts` (deployment-zone geometry), `saveStorage.ts`
  (`localStorage` + file import/export; the browser-side half of
  `engine/saveGame.ts`), `saveLoadPanel.ts`, `testMode.ts` (Menu shortcuts
  that skip straight to a populated board for manual testing).
- `src/map-editor/` + `map-editor.html` — a standalone second app (plain
  Canvas 2D, no Phaser) for hand-authoring `src/data/map.ts`: `editorState.ts`
  (pure grid/river model, unit-tested), `camera.ts` (pan/zoom + hexside
  hit-testing), `render.ts`, `input.ts`, `serialize.ts` (generates the
  `map.ts` source + JSON save/load), `main.ts` (DOM wiring). Built as a
  second Vite entry point (see `vite.config.ts`).
- `tools/map-extract/` — one-off Python scripts that derived the shipped
  `src/data/map.ts` from the scanned board image (grid calibration, color
  classification, river-hexside detection). Not run at build time; not
  Node/TS. See `tools/map-extract/README.md`.
- `docs/research/` — the transcribed rulebook and background research this
  whole project is built from; start at `docs/research/README.md` when a
  rule's exact wording matters.

### Conventions worth knowing before editing

- **`GameState` is mutated in place**, not treated as immutable — the
  undo/redo system (`engine/history.ts`) works by snapshotting whole-state
  copies before an action rather than by inverse operations. Any new mutation
  site in a scene needs a `history.push(...)` before it if it should be
  undoable.
- **A die roll is an undo/redo boundary.** Rolling for land combat, ramming,
  boarding, or an elephant's drift direction clears the history stack outside
  test mode (`session.testMode`), so results can't be re-rolled by undoing.
  Phase changes are also a boundary.
- **Ambiguous or inconsistent rulebook passages get a code comment recording
  the interpretation** at the point they're implemented — see
  `src/data/navalRamming.ts` for the convention (and `README.md`'s "Naval
  movement and combat" section for a worked example). Don't silently pick an
  interpretation without leaving a trace.
- **Save format**: `engine/saveGame.ts` owns serialization/validation and has
  a `SAVE_VERSION`; changing `GameState`'s shape generally means updating
  both that file and `ui/saveStorage.ts`, and keeping `saveGame.test.ts`
  green.
- When a "Known simplification" from the README gets implemented, move its
  bullet out of that section and document the new behavior in place, per the
  README's existing style for finished features.
