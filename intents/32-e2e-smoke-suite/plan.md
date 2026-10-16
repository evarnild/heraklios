<!-- generated-by: heraklios/intent@0.1.1 -->
# §32 plan — Browser smoke suite for the game's scenes (`npm run e2e`)

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

A four-scenario Playwright suite behind `npm run e2e` (spec B1–B9), driven
through a dev-only hook in `src/ui/devHook.ts`, plus the policy rules that
say when it can stand in for a live check (B10–B12).

## Spec changes this plan needs — approve with the plan

Reading the code turned up two places where the accepted spec can't be built
as written. Approving this plan approves these; I'll amend `spec.md` to
match in the first commit.

1. **B4 `buttonToCanvas(label)` must take an index.** Labels repeat: the two
   naval rotate buttons are both `'Turn'` (`BoardScene.ts:630`, `:644`), and
   the save/load panel draws one `'Save'` and one `'Load'` per slot
   (`saveLoadPanel.ts:178`, `:181`). Proposed: `buttonToCanvas(label,
   index?)` — without `index` it still throws on zero or several matches;
   with it, it picks the n-th match in reading order (top-to-bottom, then
   left-to-right) and throws if out of range. Plus `buttonCount(label)` so a
   scenario can assert how many it expects before picking one.
2. **B7's "combat log gained an entry" can't be read from `GameState`.**
   The log is scene text (`BoardScene.ts:397` `logText`, `:1413` `log()`),
   not state. Proposed: assert on state instead — the attacked unit's
   `defendedThisPhase` is `true` after the attack (`state.ts:29`), which no
   die result can skip. No hook access to the scene's log.

## Risks

- **Tests that pass whatever the code does** — the failure every §26–§28
  review round found. Each scenario gets a stub-the-behaviour mutation
  (AC2–AC4) run in Progress before `/review`, not left to the review.
- **Testing another checkout's code.** The probe's `reuseExistingServer:
  true` would do it silently; B1 forbids it. The config sets it `false`.
- **The hook leaking into a production build.** Guarded by
  `import.meta.env.DEV` and checked by AC5 on the real `dist/`.
- **Timing flakes:** Phaser tweens and the AI driver are async. Every
  assertion waits for `idle()` first; no fixed sleeps. AC1's 20-run loop is
  the evidence.
- **Lint cap (21).** `devHook.ts` and the specs must add no warning;
  `e2e/**` gets the same overrides as test files if needed (max-lines,
  max-lines-per-function), stated in `eslint.config.js` — loosening a rule
  is Reviewed-tier, which this change already is.
- **`tsc -b` and `e2e/`.** `tsconfig.json` includes `src`, `tools` and the
  two configs only, so `e2e/*.spec.ts` and `playwright.config.ts` aren't
  type-checked by `npm run build`. Playwright compiles them itself; the plan
  adds `e2e` and `playwright.config.ts` to `include` so `verify` catches type
  errors (and `@playwright/test` types don't clash with `vitest/globals` —
  checked in subtask 1).
- **Windows-only measurements.** AC1 and the timings are from this machine.

## Verified against the codebase

Re-read on `main` at `029cda7`:

- `src/scenes/MenuScene.ts:184`, `:194` — "Mode test (2 joueurs, armées prêtes)" → `startTestGame()`.
- `src/scenes/MenuScene.ts:201`, `:211` — "Mode test combat (unités face à face, 2 cases)" → `startCloseCombatTestGame()`.
- `src/ui/testMode.ts:36`, `:106` — the two shortcuts; both set `session.testMode = true`. Land rows at `r=3` / `r=5` from `q=10`.
- `src/ui/session.ts:61`, `:75`, `:94` — `testMode` field, default, reset; B5's `testScenario` goes beside it.
- `src/scenes/BoardScene.ts:443` — `diceRng` → `Math.random()` (B3 needs no source change).
- `src/scenes/BoardScene.ts:472` `aiRunning`; `:256`/`:306` `decisionPending`; retreat/drift choice fields in the guards near `:1452` — what `idle()` reads.
- `src/scenes/BoardScene.ts:610` `'Resolve attack'`, visible only in combat (`:1348`); `:608` end-phase button; `:630`/`:644` `'Turn'` ×2; `:703` `'💾 Save / Load'`.
- `src/scenes/BoardScene.ts:1430` `onHexClick`; movement branch builds `{ kind: 'landMove' }` at about `:1482`; combat branch starts after `:1492`. The exact attack click sequence is read from there in subtask 3.
- `src/ui/saveLoadPanel.ts:48` — canvas panel; per-slot `'Save'` / `'Load'` buttons at `:178`/`:181`.
- `src/engine/state.ts:21` `position`, `:25` `facing`, `:29` `defendedThisPhase`.
- `vitest.config.ts:6` — include is `src/**/*.test.ts`, `scripts/**/*.test.mjs`; `e2e/*.spec.ts` stays out.
- `tsconfig.json` — `include: ["src", "tools", "vite.config.ts", "vitest.config.ts"]`, `types: ["vitest/globals"]`.
- `.gitignore` — has no `test-results/` or `playwright-report/`.
- `REVIEW-POLICY.md:65` "Live checks" — rule 1's path list, where B12 adds `src/main.ts`.
- Branch `exp/30-browser-test-probe` — `src/main.ts` hook (`hexToCanvas` inverts the camera from three `getWorldPoint` samples), `e2e/move-unit.spec.ts`, `playwright.config.ts`, `@playwright/test ^1.64.0`.
- Highest § used: §32.

## Subtasks

Branch `feat/32-e2e-smoke-suite` from `main`, via `npm run spawn -- 32`
(worktree on port 5232, the same port the suite uses — so the spawned
session's own `npm run dev` must use another port or be stopped while
`npm run e2e` runs; the brief says so).

1. **Scaffold.** Amend `spec.md` per "Spec changes" above. Add
   `@playwright/test` (dev), `"e2e": "playwright test"`,
   `playwright.config.ts` (port 5232, `strictPort`, `127.0.0.1`,
   `reuseExistingServer: false`, viewport 1100×750, Chromium), `.gitignore`
   entries, `tsconfig.json` include. One trivial spec that opens the Menu.
   `npm run verify` green, lint ≤ 21.
2. **Hook** `src/ui/devHook.ts` + install from `src/main.ts` under
   `import.meta.env.DEV`: `scenes`, `state`, `reachable`, `hexToCanvas`
   (ported from the probe, centring first), `buttonToCanvas` /
   `buttonCount` (display-list walk over interactive `Phaser.GameObjects.Text`
   in active scenes, camera-transformed), `idle` (throws if a field is
   missing). B5's `session.testScenario`, set in both shortcuts, reset with
   `testMode`. Shared e2e helpers in `e2e/helpers.ts`: seeded `Math.random`
   init script (the engine's LCG constants from `src/engine/rng.ts`),
   `startFromMenu(label)`, `waitIdle()`, `clickHex()`, `clickButton()`,
   console-error trap. `e2e/global-setup.ts`: the AC5 build check.
3. **Scenarios** B6 (land move), B7 (ranged + melee), B8 (naval rotate +
   move), B9 (save → move → load), one file each under `e2e/`.
4. **Prove them.** AC2–AC4 mutations by hand, AC5 build grep, AC1 20-run
   loop; record each result in Progress.
5. **Policy and docs.** `REVIEW-POLICY.md` "Live checks" (B10, B12);
   `/review` skill → 0.1.3 and both reviewer agents (B11); `README.md`
   "Running it" and `CLAUDE.md` "Commands" (B2); `sdlc.md` one line on
   `npm run e2e`.
6. **Hand over.** `npm run verify`, `npm run check:intent`, `status:
   in-review`, Progress.

## Tests

The scenarios are the tests. For each behavioural line, what fails it:

| Behaviour | Proven by |
| --- | --- |
| B6 move lands | stub the `landMove` `applyAction` call in `onHexClick` → position assertion fails (AC2) |
| B6 screen changed | same stub → region diff assertion fails |
| B7 ranged / melee resolved | stub the attack resolution → `defendedThisPhase` stays `false` (AC2) |
| B8 rotation and move | stub the rotate handler → `facing` assertion fails (AC2) |
| B9 load restores | stub `applySavedGame` to a no-op → state comparison fails (AC2) |
| B5 mode marker | click the other Menu button in one scenario → mode assertion fails (AC3) |
| B4 `idle()` coupling | rename `aiRunning` in a scratch copy → `idle()` throws (AC4) |
| B4 `buttonToCanvas` | zero / several / out-of-range index throw — a Vitest unit test on the pure match-and-order function, factored out of the display-list walk |
| B4 hook absent in build | `npm run e2e`'s global setup runs `vite build` into a temp dir and fails if any output file contains `__heraklios` (AC5). Proven by removing the `import.meta.env.DEV` guard: the run must fail before any scenario |
| B1 no server reuse | start a server on 5232, run `npm run e2e` → it fails on the port |

## Validation

- `npm run verify` green; lint warnings ≤ 21; Vitest test count up only by
  the `buttonToCanvas` unit tests.
- `npm run e2e` — 4 scenarios pass, 20 runs in a row (AC1).
- `npm run check:intent` PASS.
- AC5 runs inside `npm run e2e` (global setup, ~10 s); no separate step.
- Live check (AC8, owner): `npx playwright test --headed` once, watched;
  then one normal (non-test-mode) turn played by hand in `npm run dev`.

## Assumptions I made

- `npm run spawn -- 32` for the branch, as for §28 — the main checkout stays
  on `main`.
- The seeded `Math.random` reuses `src/engine/rng.ts`'s LCG constants rather
  than a new generator, so "seed N" means the same thing in the fuzz harness
  and the browser.
- The B4 build check is automated in `npm run e2e`'s global setup (owner's
  choice, 2026-10-16): a `vite build` to a temp `outDir`, never `dist/`, so
  it can't clobber a build someone is previewing. Adds ~10 s per run.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
