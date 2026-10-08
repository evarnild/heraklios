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
npm run lint       # eslint, capped at the current guardrail-warning count
npm run verify     # build + lint + test — THE check before a change is done
npm run check:intent  # does this branch's change match its intent? (intents/README.md)
npm run sdlc:scan  # the evidence behind docs/sdlc-grid.md
npm run spawn -- <id>  # parallel session for an intent (see "Parallel sessions")
npm run sessions   # what every worktree/session is doing
```

Run a single test file: `npx vitest run src/engine/combat.test.ts`.
Run tests matching a name: `npx vitest run -t "pattern"`.
Type-check without emitting: `./node_modules/.bin/tsc --noEmit` — never bare
`npx tsc`, which false-greens without a local install (plan.md §4). The build uses `tsc -b`,
which is incremental — delete `tsconfig.tsbuildinfo` if a stale build info
file ever seems to mask an error).

`npm run verify` is the one command to run before considering a change done.
Lint correctness rules are errors; the guardrails from the agent guidelines
(file ≤500 lines, function ≤80 lines, complexity ≤20, ≤7 params, nesting
≤4, no `console` outside `scripts/`) are warnings, capped by `--max-warnings`
in `package.json` at today's count so new violations fail `verify`. The cap
counts warnings, not locations: if you remove warnings, lower the cap in the
same commit, or a later change can spend the slack. Never raise it.

## How work flows

- `plan.md` is the coordinator view (snapshot, queue, backlog, history map).
  Each work item's detail lives in `intents/<id>-<slug>/` — intent, spec
  (features), plan, review report, metadata. Read `intents/README.md` for
  the types, gates and branch naming (`feat/27-…`, `fix/27-…`).
- No code before the plan's gate is recorded in `metadata.yml`.
- `/intent` drafts an intent, `/review` runs `REVIEW-POLICY.md` and writes
  `review.md`, `/grid` refreshes `docs/sdlc-grid.md`, `/spawn` and
  `/sessions` run parallel work (below).
- Merges into `main` are local and done by the owner, never by an agent.

## Parallel sessions

Several intents can run at once, each in its own worktree with its own
Claude Code session. One session, in the main checkout, is the
**coordinator**.

```
npm run spawn -- <id>           # worktree ../heraklios-wt/<id>-<slug> on the intent's branch,
                                # npm ci, dev port 5200+(id mod 100), CLAUDE.local.md brief
npm run spawn -- <id> --remove  # after merge; refuses if unmerged, dirty or junctioned
npm run sessions                # every worktree: status, gates, ±main, dirty, session state
npm run sessions -- --log 30    # the raw event tail
```

- **State lives in three places, each with one owner.** Intent status and
  gates are in `metadata.yml` on the intent's branch; `npm run sessions`
  reads it from each worktree. Git facts (ahead/behind, uncommitted files)
  come from git. What each session is doing is in
  `.git/heraklios-sessions.jsonl`, written by the hooks in
  `.claude/settings.json` on start, prompt, turn end, notification and end.
  That file is never committed, and no agent writes to it by hand. It holds
  **no prompt text** — a prompt is logged by its length only. Events are
  filed under the session's project directory, so a session that `cd`s into
  another worktree still shows as itself. A permission prompt or question
  shows as `needs you`; Claude Code's idle "waiting for your input"
  reminder shows as `idle`, but never hides a prompt still waiting on you —
  only your next prompt, the turn ending or the session ending clears it.
- **Only the coordinator** edits `plan.md`, runs `/spawn`, `/sessions` and
  `/review`, and sends "main moved, rebase" notices. The owner merges, one
  branch at a time, running `npm run verify` on `main` after each merge.
- **A spawned session** works only on its branch and its intent. Its
  `CLAUDE.local.md` (gitignored, written by spawn) says which intent, branch
  and port it has. It never edits `plan.md`, never merges, and sets
  `status: in-review` when done.
- Keep it to about three intent sessions at once. Merges and reviews are
  serial, so more sessions mostly add rebases.
- Spawned worktrees live outside the repo on purpose, so vite, vitest and
  eslint never pick up a nested checkout. They get a real `node_modules`
  from `npm ci`, never a junction (`plan.md` §4).

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
  primitive (`history.ts`), save-file serialization/validation
  (`saveGame.ts`), an injectable die roll (`dice.ts`), and the headless
  action layer `actions.ts`'s `legalActions`/`applyAction` enumerate and
  apply every move/attack/end-phase the active player (human or,
  eventually, a bot) can take. `agent.ts` defines two separate interfaces:
  `PlayerAgent` (the mid-resolution decisions a retreat/push/advance/exchange
  can force) and `ActionObserver` (an after-the-fact "what action just got
  committed" hook — NOT a top-level action chooser; see its doc comment for
  why unifying hotseat and AI action *selection* is still open, deferred to
  Stage 4). Stage 2 (plan.md §6.3) adds `rng.ts` (a seeded LCG for
  deterministic replay), `randomAgent.ts`'s `RandomAgent` (a trivial
  uniform-random `PlayerAgent`, driven by that seed), and `fuzzHarness.ts`
  (`playRandomGame(seed)`, a fully headless self-play driver — no Phaser,
  no scenes — with its own continuously-checked invariants). The elephant
  drift/trample cascade is `drift.ts`'s explicit, resumable state machine
  (Stage 2b), and Stage 2c put elephants into the harness's armies, so
  ordinary seeded self-play now resolves drifts and drift combats; the
  `buildPushScenarioGameState`/`buildElephantScenarioGameState` builders in
  `fuzzHarness.ts` are purpose-built positions that make the push and drift
  paths reachable deterministically rather than by luck.
- `src/scenes/` — the Phaser scenes, run in sequence: `MenuScene` →
  `ArmyBuilderScene` → `PlacementScene` → `BoardScene` → `GameOverScene`.
  `BoardScene.ts` is by far the largest file in the repo (~3000 lines) and
  owns movement clicks, combat-group building, retreat/drift prompts, and
  naval rotation/ramming/boarding UI; it implements `PlayerAgent` and
  `ActionObserver` via those same prompts, and delegates its movement,
  attack, ram, boarding and end-phase mutations to `engine/actions.ts`'s
  `applyAction`. The elephant drift/trample cascade is no longer the
  scene's — it pumps `engine/drift.ts` — but the post-combat
  advance/elimination bookkeeping is still not extracted and mutates
  `GameState` inline.
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
