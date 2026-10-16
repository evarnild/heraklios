<!-- generated-by: heraklios/intent@0.1.1 -->
# §32 spec — Browser smoke suite for the game's scenes (`npm run e2e`)

Accepted intent: [intent.md](intent.md)

The spec decides **what** gets built. No rulebook side: its sources are §30's
probe and the process documents it amends.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/30-browser-test-probe/findings.md` | Playwright works (40/40), the hook is needed, coordinates are fragile, the Menu-mode assertion is missing, cost figures |
| branch `exp/30-browser-test-probe` — `src/main.ts`, `e2e/move-unit.spec.ts`, `playwright.config.ts` | the probe code this starts from |
| `src/ui/testMode.ts` — `startTestGame`, `startCloseCombatTestGame` | the two shortcuts the scenarios start from |
| `src/scenes/MenuScene.ts:184`, `:201` | the two Menu buttons ("Mode test (2 joueurs, armées prêtes)", "Mode test combat (unités face à face, 2 cases)") |
| `src/scenes/BoardScene.ts:443` `diceRng` | every board die roll goes through `Math.random()` |
| `src/scenes/BoardScene.ts:472` `aiRunning`, `decisionPending` and the retreat/drift guards | what "idle" has to mean |
| `src/ui/saveLoadPanel.ts` | the save/load panel is Phaser text objects on the canvas, not DOM |
| `REVIEW-POLICY.md` → "Live checks" | the rule this amends (B9) |

## Behaviour

### The command

- **B1 — `npm run e2e`** runs every scenario in `e2e/` with Playwright
  (Chromium headless shell) against its own Vite dev server on port **5232**
  (`--strictPort`, `127.0.0.1`). It never reuses a server already on that
  port: that server could be another checkout's, serving other code. If the
  port is taken, the run fails and says so. It is not part of
  `npm run verify`, and Vitest never picks up `e2e/*.spec.ts`.
- **B2 — Setup is one documented command per machine:** `npx playwright
  install chromium`. `README.md` "Running it" and `CLAUDE.md` "Commands" list
  both. `test-results/` and `playwright-report/` are in `.gitignore`.
- **B3 — Reproducible dice.** Each scenario seeds `Math.random` in the page
  before the app loads (Playwright `addInitScript`), with a fixed seed per
  scenario, so a failure replays the same rolls. No source change for this.
  Assertions never depend on what was rolled (B6).

### The hook

- **B4 — `window.__heraklios`** lives in `src/ui/devHook.ts` and is installed
  from `src/main.ts` only under `import.meta.env.DEV`. `npm run build` output
  contains no `__heraklios` string. Its surface, typed and documented:
  - `scenes()` — keys of the active scenes;
  - `state()` — a `structuredClone` of `session.gameState` (read-only by
    construction: mutating it changes nothing), plus `testMode` and the
    session's mode marker (B5);
  - `reachable(unitId)` — the engine's `reachableHexes` keys;
  - `hexToCanvas(hex)` — canvas pixel of a hex centre, centring the camera
    first if it is off-viewport, `null` only if it still isn't visible;
  - `buttonToCanvas(label)` — canvas pixel of the one interactive Phaser text
    object in the active scenes whose text equals `label`; throws if there
    are zero or several;
  - `idle()` — true when no AI turn, pending decision, retreat or drift
    choice, and no tween is running on the board. It reads `BoardScene`'s
    existing fields by name and **throws** if any of them is missing, so a
    rename breaks the suite loudly instead of making `idle()` always true.
- **B5 — Mode marker.** `startTestGame` and `startCloseCombatTestGame` record
  which shortcut ran (e.g. `session.testScenario = 'test' | 'close-combat'`),
  so a scenario can assert it started where it meant to. This is the only
  change outside the hook, and it is inert in normal play.

### The scenarios

Each starts at the Menu, clicks its shortcut through `buttonToCanvas`,
waits for `Board` and `idle()`, asserts the mode marker, acts by canvas
clicks, and waits for `idle()` before asserting. Every scenario also fails on
any `pageerror` or `console.error`.

- **B6 — Land move:** "Mode test" → select the active player's first land
  unit, click an adjacent reachable hex → its `position` is that hex, and
  the screen region at both hexes changed (§30's small-region check).
- **B7 — Attacks:** "Mode test combat" → one ranged attack and one melee
  attack, through the board's own combat UI → for each, an attack resolved:
  the combat log gained an entry and the attacked unit's state or position is
  consistent with *some* result (no roll-specific outcome asserted).
- **B8 — Naval:** "Mode test combat" → rotate a ship once and move it one hex
  → its facing and position changed as clicked.
- **B9 — Save → load:** "Mode test" → make one move, save to a slot through
  the save/load panel, make a second move, load the slot → `GameState`
  equals the state after the first move (compared through `state()`).
  `localStorage` slots only; file export/import is out of scope.

### Policy

- **B10 — When the suite may stand in for a live check.** `REVIEW-POLICY.md`
  → "Live checks" gains one rule: when a live check is owed **only** by rule 1
  (paths), the changed behaviour is already covered by a named scenario, and
  the change is neither new behaviour nor visual, `/review` may set
  `live-check: not-needed` citing the scenario and a passing `npm run e2e` it
  ran itself. Anything else stays owed. The owner can always overrule by
  setting it back to `owed`; at the Attested tier that is part of reading
  the report.
- **B11 — `/review` runs it.** When the diff touches `src/scenes/**`,
  `src/ui/**`, `src/main.ts` or `e2e/**`, `/review` runs `npm run e2e` and
  reports it under "Verified myself". A failing scenario is a finding.
- **B12 — Rule 1 gains `src/main.ts`.** It boots the game and installs the
  hook, and no unit test covers it. (`src/ui/devHook.ts` is already under
  `src/ui/**`.)

## Interpretations

- **"Idle" reads private fields** rather than adding a public method to
  `BoardScene`: it keeps the 3,000-line scene untouched, and B4's
  throw-if-missing makes the coupling fail loudly. If a later change needs a
  real `isIdle()` on the scene, that change moves it.
- **Roll-independent assertions** (B3, B7): the suite checks that the UI
  drove the engine, not the combat table, which `src/data`'s own tests own.
- **Starting from the probe:** a new branch `feat/32-e2e-smoke-suite` from
  `main`; the probe's files are reference, ported into the B4 shape (hook in
  its own file, label lookup instead of coordinates). The `exp/` branch is
  never merged.

## Acceptance criteria

- **AC1** — `npm run e2e` passes all four scenarios (B6–B9) on this machine,
  20 runs in a row with no failure. (manual, recorded in Progress)
- **AC2** — Each scenario fails when its target behaviour is broken: stub the
  move in `BoardScene`'s `landMove` branch (B6), the attack resolution (B7),
  the rotation (B8), and `applySavedGame` (B9), one at a time. (mutation, in
  `/review` pass 4)
- **AC3** — Clicking the other Menu shortcut fails the mode assertion (B5).
  (mutation)
- **AC4** — Renaming `aiRunning` makes `idle()` throw. (mutation)
- **AC5** — `npm run build` output has no `__heraklios`.
  (`grep -r __heraklios dist` empty — a Vitest test or a check in the e2e
  config, decided in the plan)
- **AC6** — `npm run verify` green, lint cap unchanged at 21 or lower, and
  Vitest's test count unchanged by `e2e/`.
- **AC7** — `REVIEW-POLICY.md`, the `/review` skill and both reviewer agents
  state B10–B12 consistently. (`/review` pass 7)
- **AC8** — Live check (owner): watch `npm run e2e` run once headed
  (`--headed`), and play one normal game turn by hand to confirm the hook
  changes nothing outside dev tooling.

## Non-functional

- **Engine/presentation split:** no change to `src/engine/` or `src/data/`.
  The hook reads engine state and calls `reachableHexes`.
- **Save format:** unchanged. B5's marker lives on the session, not in
  `GameState`, so saves don't carry it.
- **Undo boundaries:** unchanged.
- **AI / harness:** unchanged; AI seats are not exercised.
- **Dependencies:** one dev dependency, `@playwright/test`. Browser binaries
  stay outside the repo.
- **Time:** about 3 s per scenario after the server is up; the plan states the
  measured total.

## Out of scope

- AI turns, elephant drift, retreat/push/advance prompts, boarding, game over.
- The map editor (`map-editor.html`).
- File export/import of saves.
- Running on Linux/macOS or in CI.
- Whole-board screenshot comparison.
- Counting e2e runs or their findings in `sdlc:scan` / `/grid`.

## Assumptions I made

- B5's marker is the smallest way to tell the two shortcuts apart; checking
  unit counts instead (§30's suggestion) would break whenever a shortcut's
  armies change.
- B10 uses `not-needed` with a citation rather than a third `live-check:`
  value, so `check:intent` and its tests from §28 stay as they are.
- Port 5232 follows the `spawn` rule (5200 + id mod 100) even though the
  suite runs from any checkout. Two checkouts can't run `npm run e2e` at the
  same time; the second fails on the port (B1). Acceptable for a manual tool,
  and safer than the probe's `reuseExistingServer: true`.
