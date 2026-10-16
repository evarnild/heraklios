# §30 findings — can a browser test drive the game's scenes?

Intent: [intent.md](intent.md) · Branch: `exp/30-browser-test-probe` (not merged)
Probe run: 2026-10-08, Windows 11, Playwright 1.64.0, Chromium headless shell.

**Short answer: yes.** Playwright reached a populated board from the Menu,
moved a unit one hex with real canvas clicks, and checked the result 40 times
out of 40 with no flakes. It needs a small dev-only hook, because the canvas
has no DOM to query. Recommendation: **build a narrower version** (see the end).

## What was built on the branch

| File | What |
| --- | --- |
| `src/main.ts` (+46 lines) | `window.__heraklios`, only under `import.meta.env.DEV`: `session`, `activeScenes()`, `reachable(unitId)` (calls the engine's `reachableHexes`), `centerOn(hex)`, `hexToCanvas(hex)` (hex → canvas pixel through the main camera, `null` if off-viewport) |
| `playwright.config.ts` | Starts its own `vite --port 5230 --strictPort` (the port `spawn` gave §30, so it never meets another session's 5173); viewport 1100×750, the game's own size |
| `e2e/move-unit.spec.ts` | The one test, below |

No change to `src/engine/`, `src/data/` or any scene.

## Q1 — reach a populated board through a `testMode.ts` shortcut?

Yes, reliably. The test does **not** call `startTestGame()` directly. It
clicks the Menu's "Mode test (2 joueurs, armées prêtes)" button at its drawn
position (550, 570) on the canvas, then waits until `activeScenes()` includes
`Board`. That proves a Menu click reaches *a* test board. It does not prove
it reached the right one. The test never checks which shortcut ran, and
"Mode test combat" (550, 612) also gives a `Board` in `movement` with an
adjacent reachable hex. The §30 review swapped the click to that button, and
the test still passed. A real suite needs an assertion that tells the modes
apart, for example the unit count or a known starting position.

Phaser-only text buttons have no DOM element, so "find the button by text"
does not work. Each button is clicked by coordinates, taken from the scene
source. That is fine for fixed HUD buttons. It is fragile if the layout moves,
which is a cost (see Q3).

## Q2 — one real interaction, and check it

Yes, both ways:

1. **Through the hook (`GameState`).** The test picks the active player's
   first land unit and an adjacent hex the engine says is reachable. It
   centres the camera on each hex, converts it to a canvas pixel, and clicks
   the unit, then the hex. It then polls `session.gameState` until the unit's
   `position` equals the destination.
2. **Through the canvas alone.** It takes a 24×24 screenshot around the source
   and destination hexes before and after the move. Both must change: the
   marker leaves one and appears on the other. A control screenshot taken
   twice with no action is byte-identical, so the comparison is fair.

It also fails on any `pageerror` or `console.error`.

**Is the test real?** I disabled the move by stubbing the `applyAction` call
in `BoardScene.onHexClick`'s `landMove` branch. The test then failed on the
position check. With the code restored, it passed again.

**What the hook was needed for:** turning a hex into a pixel, because the
camera pans and zooms (`MapView.toScreen` plus the camera transform), and
choosing a legal destination. Without the hook, a test could only click fixed
pixels and diff screenshots. That would break whenever the camera's start
position or the map changed. **Conclusion: a hook is needed.** It stays in
dev builds only (`import.meta.env.DEV`), so `vite build` leaves it out.

## Q3 — cost

| | |
| --- | --- |
| npm dependencies | 1 dev dependency, `@playwright/test`, which pulls in `playwright` and `playwright-core` (+47 lockfile lines) |
| Browser | ~720 MB on disk in `%LOCALAPPDATA%\ms-playwright`, not in the repo. A one-off `npx playwright install chromium` per machine fetches both the headless shell (`chromium_headless_shell-1248`, 278 MB, which the tests use) and full Chromium (`chromium-1248`, 437 MB), plus `ffmpeg` (3.9 MB). The ~118 MB first written here was probably the download size |
| Time, one test cold | ~8 s wall time, including Vite start-up (test alone ~5–6 s) |
| Time, 20 runs | 50.8 s serial (~2.5 s per test once the server is up); 14.2 s with Playwright's default parallel workers |
| Flakiness | 0 failures in 41 runs (1 + 20 parallel + 20 serial) |
| `npm run verify` | Unchanged and still green (build, lint 0 errors / 21 warnings at the cap, 585 Vitest tests). Vitest's `include` (`src/**/*.test.ts`) does not pick up `e2e/*.spec.ts`. Two small fixes were needed: `/// <reference types="vite/client" />` in `main.ts` for `import.meta.env`, and real types instead of `any` in the spec, for lint |
| Maintenance | Every HUD button the tests press is a coordinate pair copied from scene code, and moves when the layout moves. A future version should get button positions from the hook (for example, look up a Phaser text object by its label), not hard-code them. Each run leaves an untracked `test-results/` directory, so the follow-up needs `test-results/` and `playwright-report/` in `.gitignore` |

Not measured, so unknown: AI turns (`aiRunning`), tweens/animations, dice
prompts and the drift-continue/retreat modals. Each needs either a wait
condition from the hook or a seeded `diceRng`. The probe did not go that far.

## Second approach

Not tried. The intent says to try Vitest browser mode only if the first
approach fails, and Playwright succeeded. Vitest browser mode would reuse the
existing runner, but it also uses Playwright underneath, so the Chromium cost
is the same.

## Recommendation — build a narrower version

Write a follow-up **feature** intent for a smoke suite with these limits:

- `npm run e2e`, **separate from `npm run verify`**. It needs a browser
  install and a dev server, and ~3 s per scenario adds up. `verify` stays fast
  and needs no browser.
- The hook ships in dev builds only, with a small, typed surface: scene keys,
  `GameState` (read-only), hex → pixel, label → pixel for HUD buttons, and
  "idle" (no AI, prompt or tween pending).
- Start with the scenarios §28's live check repeats most often: Mode test →
  move a land unit; Mode test combat → one ranged attack and one melee
  attack; a naval move with rotation; save → load round-trip.
- §28's manual live check stays for anything visual or new. The suite only
  covers flows that have already been checked live once.

Do not adopt full-canvas screenshot comparison. Small-region "did it change"
checks worked. Whole-board golden images would break on every visual tweak.

The probe code (`e2e/`, `playwright.config.ts`, the hook) can be that intent's
starting point. Per the containment rule, only this file is merged.
