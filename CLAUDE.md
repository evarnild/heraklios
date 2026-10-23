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
npm run ship -- <id>  # merge a reviewed intent, bookkeep, push, remove worktree and branch (the /ship skill)
npm run queue      # the intent queue, generated from metadata.yml (--next-id, --json); nobody edits it
npm run sessions   # what every worktree/session is doing
npm run e2e        # browser smoke suite (Playwright, port 5232) — not part of verify;
                   # once per machine: npx playwright install chromium
```

`npm run e2e` drives the real game in Chromium through a dev-only hook
(`src/ui/devHook.ts`, `window.__heraklios`, never in a production build —
its global setup checks). Scenarios live in `e2e/`, start from a
`src/ui/testMode.ts` shortcut and act by canvas clicks. It never reuses a
server already on 5232, so stop a dev server there first.

Run a single test file: `npx vitest run src/engine/combat.test.ts`.
Run tests matching a name: `npx vitest run -t "pattern"`.
Type-check without emitting: `./node_modules/.bin/tsc --noEmit` — never bare
`npx tsc`, which false-greens without a local install (`docs/runbook.md` §4). The build uses `tsc -b`,
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

`sdlc.md` is the step-by-step version for the owner (intent → spec → plan
→ build → review → merge, and what each type requires); the rules below
and in `intents/README.md` / `REVIEW-POLICY.md` win if they disagree.

- The queue is generated, never hand-kept: `npm run queue` lists every intent
  with its status (from its branch while unmerged, else `main`). `OVERVIEW.md` is
  the short, owner-edited snapshot and history map.
  Each work item's detail lives in `intents/<id>-<slug>/` — intent, spec
  (features), plan, review report, metadata. Read `intents/README.md` for
  the types, gates and branch naming (`feat/27-…`, `fix/27-…`).
- No code before the plan's gate is recorded in `metadata.yml`.
- `/intent` drafts an intent, `/spec` a feature's spec, `/build-plan` a
  plan, `/review` runs `REVIEW-POLICY.md` and writes
  `review.md`, `/grid` refreshes `docs/sdlc-grid.md`, `/spawn` and
  `/sessions` run parallel work (below), and `/ship <id>` merges a reviewed
  intent when the owner asks (`REVIEW-POLICY.md` → "Merging").
- `/auto <id>` (coordinator only) carries one accepted intent through the
  steps above: spec (a feature stops once, for the owner's `spec_accepted`),
  plan, spawn, implement, review, and rework, for at most three review
  rounds. The owner's `/auto <id>` is a request to record that intent's
  `plan_approved` and nothing else (`intents/README.md` → "Who edits what").
  It stops for the owner's questions, a "Needs decision:" finding, an
  `escalate` verdict (the owner reads the diff; the next `/auto <id>` goes
  on), a spec or plan amendment, running out of rounds, the live check, a
  CRITICAL finding, any red it cannot trace, a re-check mismatch, a plan that exists unapproved, a ship dry-run that
  is blocked, a worktree held by another session, a fourth open session or an
  agent error, and ends at "ready:
  `/ship <id>`"; it never ships, and never records `spec_accepted` or
  `live_checked` without the owner's yes; the `/auto` authorisation covers neither. A stop shows in `npm run sessions` as `auto · r<n> · <reason>`.
- An agent records a gate (`metadata.yml`) only on the owner's request in
  the current conversation, with `by-agent` after the date; a subagent never
  does (`intents/README.md` → "Who edits what").
- Merges into `main` are local. An agent merges, pushes, deletes a branch
  or removes a worktree only when the owner explicitly asks for that action
  in the current conversation, never on its own initiative, and only after
  the preconditions in `REVIEW-POLICY.md` → "Merging".
- A change to `src/scenes/`, `src/ui/`, `src/map-editor/`, `src/main.ts`,
  `index.html`, `map-editor.html`, `vite.config.ts` or
  `.claude/settings.json` owes a **live check**, and so does any other
  change whose "Not checked" list holds behaviour only a live run can show.
  The owner runs the live check; `live_checked: <date>` is recorded, by the
  owner or by an agent on their request, before the merge (`REVIEW-POLICY.md` → "Live checks"). An agent's own browser
  run is evidence, never that gate. The only exception, when all of these
  hold (`REVIEW-POLICY.md` → "When the smoke suite stands in"): the check
  is owed by the path rule alone; a named `npm run e2e` scenario already
  covers the changed behaviour; the change is neither new nor visual; and
  `/review` ran `npm run e2e` itself and it passed. Then `/review` says
  `live-check: not-needed` and names the scenario.

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
- **Only the coordinator** runs `/spawn`, `/sessions`, `/review` and
  `/auto`, and sends "main moved, rebase" notices. The owner merges (or
  asks the coordinator to, per "Merging"), one branch at a time, running
  `npm run verify` on `main` after each merge.
- **A spawned session** works only on its branch and its intent. Its
  `CLAUDE.local.md` (gitignored, written by spawn) says which intent, branch
  and port it has. It never edits the queue (it is generated, `npm run queue`), never merges, and sets
  `status: in-review` when done.
- **`/spawn` launches the implementer itself** when `metadata.yml` already
  records the gate the type needs (`plan_approved` for feature/fix/refactor,
  `intent_accepted` for adjustment/experiment): a background
  `heraklios-implementer` agent working in the worktree. With a gate missing
  it hands over as before. On completion the coordinator reports and offers
  `/review`; outside an `/auto <id>` run (`.claude/skills/auto/SKILL.md`) it
  never runs it unprompted, and it never records a gate or merges.
- **A launched implementer is not a session in `npm run sessions`.** Hooks
  run per session and file events under `CLAUDE_PROJECT_DIR`, so the
  implementer files none under the worktree (its row shows `no events`) and
  the coordinator's row reflects only the coordinator's own session.
  Progress shows in the worktree's `status`, `dirty`
  and `ahead` columns (the implementer commits early), and `in-review` means
  it finished.
- Keep it to about three intent sessions (or launched implementers) at
  once. Merges and reviews are serial, so more sessions mostly add rebases.
- Spawned worktrees live outside the repo on purpose, so vite, vitest and
  eslint never pick up a nested checkout. They get a real `node_modules`
  from `npm ci`, never a junction (`docs/runbook.md` §4).

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
  Stage 4). Stage 2 (`plan-history.md` §6.3) adds `rng.ts` (a seeded LCG for
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
  (client of the local save API + file import/export + the read-only import
  of old `localStorage` saves; the browser-side half of
  `engine/saveGame.ts`), `saveLoadPanel.ts`, `testMode.ts` (Menu shortcuts
  that skip straight to a populated board for manual testing).
- `server/` — the local save API (§45): saves are one JSON file per slot in
  `saves/` (or `HERAKLIOS_SAVES_DIR`). `saveApi.ts` is the pure handler
  (Host allow-list checked first against DNS rebinding, then Origin check, slot
  allow-list, 2 MB cap, `parseSavedGame` before write;
  tested with an in-memory file system), `fileSaveFs.ts` the real files,
  `saveApiPlugin.ts` a Vite plugin mounting it on the dev AND preview
  servers (registered in `vite.config.ts`). Boundary: no game rule in it,
  only storage; it imports `engine/saveGame.ts` for validation and nothing
  else. e2e points it at a temporary folder (`e2e/savesDir.ts`).
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
- **Player-facing text lives in `src/ui/i18n/`** (English and French tables;
  `messages()` for a fixed text or a sentence function, `unitName`/`terrainName`
  etc. in `names.ts`, formatters for the engine's structured results in
  `format.ts`). The engine returns data (army errors, drift events, save
  errors), never display text. `noLiterals.test.ts` fails on a literal passed
  to `.text(`/`setText(`/`log(`… in `src/scenes` and `src/ui`; a new message
  goes into `en.ts` and `fr.ts` (typed, so a missing one is a build error).
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
