<!-- generated-by: heraklios/review@0.1.5 -->
# §56 review — Move to current vite and vitest majors and clear npm audit

verdict: attest
tier: attested
reviewed-commit: 4cbcdea
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table (build config and `package.json`; the
`lint` script and its `--max-warnings 21` did not move, so this is not a
guardrail change). `review_tier` is empty.

**Verdict:** `attest`. The upgrade did what the intent asked, changing only
what it forced: exact pins vite 8.3.4 and vitest 5.0.3 (the newest at least
14 days old), `npm audit` 0, one vite, no esbuild, and the same 1153 tests,
lint 21 and 16 e2e scenarios. Four LOW items are worth a look; none needs
rework. Passes run by the `heraklios-reviewer` agent; the coordinator re-ran
verify, check:intent, audit, `npm ls` and mutant M1 (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the diff is `package.json` (2 lines), `package-lock.json`, `vitest.config.ts` (+5) and the intent's files; `vite.config.ts`, `src/`, `server/` and every `*.test.*` unchanged |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: no rule behaviour in the diff |
| 4 | Tests prove the rule | pass: M1 killed; the pins are proven by `npm ci` / `npm ls`; probe M2 shows `rollupOptions.input` is honoured |
| 5 | Boundary and conventions | pass: no source change; `GameState` and the save format untouched |
| 6 | Numbers in prose | findings (2, LOW) |
| 7 | Documentation | pass: no doc names a vite, vitest, esbuild or rollup version |
| 8 | Guardrails and hygiene | findings (1, LOW): lint 21 of 21; no new direct dependency; the new transitive packages (rolldown, lightningcss, oxc types, …) come with vite 8, as the plan allows |
| 9 | Repository-specific footguns | pass: the seeded self-play suites are byte-for-byte unchanged and green |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 56, refactor)
  note:  3 file(s), 6583 line(s) changed outside intents/.
```
With this report's `live-check: owed` committed, `check:intent` fails until
`live_checked:` is recorded; that is yours to clear, not rework.

## Findings
- **LOW** `vitest.config.ts:6-10`: the global `testTimeout: 60_000` rather
  than per-test timeouts. It works and hides nothing today: removing it (M1)
  times out only soak and tier tests in the two files the comment names, and
  the only tests outside `scripts/` over 5 s are in `fuzzHarness.test.ts` and
  `heuristicSoak.test.ts` (5.2 to 18.3 s under load). The reason holds: vitest
  5 fails a test after it resolves if its deadline passed
  (`node_modules/vitest/dist/chunks/run.BTlFXlnv.js:3281-3287`), so 60 s is
  stricter than vitest 2's effective "no limit" for these synchronous soaks.
  The cost: async tests outside `scripts/` (`server/`, `tools/orchestrator/`,
  `e2e/*.test.ts`) take 60 s rather than 5 s to fail if they hang, and the repo
  elsewhere uses per-describe `{ timeout }` (`scripts/ship.test.mjs:125`,
  `queue.test.mjs:62`, `spawn-intent.test.mjs:78`). The choice kept the
  `*.test.*` diff empty, this refactor's proof that no test was weakened.
  Worth a look: a follow-up could move the timeout onto the two soak
  `describe`s and drop the global.
- **LOW** `plan.md` Progress, the dist row: "same entries" reads as if the HTML
  were unchanged; `dist/index.html` went 706 → 578 B and `map-editor.html`
  3676 → 2750 B, because vite 8 minifies and rewrites inline `<style>` (e.g.
  `rgba(255, 255, 255, 0.3)` → `#ffffff4d`). It should be equivalent, but no
  test covers it; the live check does. Worth a look.
- **LOW** `plan.md` Progress note (2): no build, dev-server or e2e log shows a
  `rollupOptions` → `rolldownOptions` warning; the only mention is a hint
  inside the chunk-size warning. vite 8 aliases the option silently
  (`node_modules/vite/dist/node/chunks/node.js:2770`), and M2 confirms it's
  honoured. Worth a look.
- **LOW** (pass 6) the commit message and Progress say the soak takes "10-16 s";
  it measured 18.3 s under load, inside the code comment's "10-20 s".
  Load-dependent, not a finding against the code.

## Not checked
- **The production bundle in a browser:** vite 8 builds with rolldown and oxc
  instead of rollup and esbuild, and `main` shrank 18% (1,644,631 → 1,351,968
  B). `npm run e2e` runs against the dev server only; preview was only probed
  (200, the bundle served). Runtime-only, hence rule 3.
- **The map editor in a browser**, dev or built, including its now-minified
  inline CSS: only a 200 was checked; no e2e covers the editor.
- **Save / Load on the preview server through the UI:** the save e2e
  scenarios run on the dev server; on preview only `GET /api/saves` 200 and a
  foreign-Origin PUT 403 were probed.
- **The plugin's own Host check at runtime:** vite 8's built-in allowed-hosts
  check answers a foreign `Host` with 403 before the request reaches
  `saveApiPlugin` (as vite 6 did); the plugin's logic is proven by
  `server/*.test.ts`.
- **Baseline numbers on `main`:** not re-measured (no scratch clone or
  worktree allowed); no test file changed, so the count can't have moved
  through the diff.
- **`npm ci` with install scripts:** the reviewer's run used
  `--ignore-scripts`; the implementer's ran without it.
- **Platforms other than win32-x64:** the other optional bindings are in the
  lockfile, not exercised.
- **vite's future `configLoader: 'native'` default:** left alone as not forced;
  a later vite major will need extensions on the imports reachable from
  `vite.config.ts`, including the `src/engine` chain through `saveGame.ts`.

## Live check
- **Owed** by rule 3 (the production bundle, the map editor in a browser, and
  Save / Load on preview are runtime-only). Not by rule 1: `vite.config.ts` is
  not in the diff, so the intent's rule-1 assumption no longer holds.
- **Steps:**
  1. **Dev server**, in `C:/Users/eric/src/heraklios-wt/56-vite-vitest-upgrade`,
     with saves in a temp folder: `HERAKLIOS_SAVES_DIR=<temp folder> npm run
     dev -- --port 5256 --strictPort --host 127.0.0.1`. Open
     `http://127.0.0.1:5256/`, start a Menu test-mode game, move one unit,
     Save to a slot, reload the page, Load that slot. Open
     `http://127.0.0.1:5256/map-editor.html` and paint one hex. Stop the
     server.
  2. **Built game:** `npm run build`, then `HERAKLIOS_SAVES_DIR=<temp folder>
     npm run preview -- --port 5257 --strictPort --host 127.0.0.1`. Open
     `http://127.0.0.1:5257/`: a test-mode game, a move, an attack, Save,
     reload, Load. Open `http://127.0.0.1:5257/map-editor.html`: the sidebar
     looks as on `main` (dark sidebar, swatch buttons with a thin light
     border); paint a hex.
- **You should see:** both servers load the menu, the board centred on a dark
  background; the move and attack resolve; the save shows in its slot and Load
  restores the moved unit; the editor sidebar styled as on `main`, and
  painting changes the hex; no errors in the browser console in the built
  version.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `4cbcdea`, clean before and after):
- `npm run verify`: exit 0, built (`dist/index.html` 0.57 kB,
  `dist/map-editor.html` 2.75 kB), `21 problems (0 errors, 21 warnings)`, 61
  files, 1153 tests (matches).
- `npm run check:intent`: PASS, 3 files, 6583 lines (matches).
- `npm audit`: 0 vulnerabilities (matches). `npm ls vite vitest esbuild
  rolldown`: one `vite@8.3.4` (`rolldown@1.2.15`), `vitest@5.0.3` with vite
  deduped, no esbuild (matches).
- `npm run e2e`: not re-run (no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/`
  change; the reviewer's and implementer's runs gave 16 of 16).
- **M1** (`testTimeout: 60_000` removed, full `vitest run`): **killed**, 1
  failed, "plays 100 seeded games headlessly end to end with no invariant
  violations" (11.0 s against the 5 s default). The reviewer's run timed out 4
  tests (that fuzz soak, the push soak and two heuristic tier tests). Which
  tests cross 5 s depends on machine load, so the outcome (killed) and the
  decisive test match; the count is timing, not code. `git status --short`
  empty after.

**Reviewer agent** (same worktree and HEAD, foreground):
- `git diff --name-only 9dacdfb..HEAD`: the intent files, `package.json`,
  `package-lock.json`, `vitest.config.ts`; empty diff for `*.test.*`,
  `e2e/**`, `src/**`, `server/**`, `vite.config.ts`.
- **Lockfile** compared package by package: 37 added (rolldown and bindings,
  lightningcss and bindings, `@oxc-project/types`, `@vitest/mocker` 5, …), 121
  removed (every esbuild and rollup copy, `vite-node`, `tinypool`, vitest 2's
  nested vite 5.4.21); major bumps only in the vite and vitest tree (chai 6,
  es-module-lexer 2, magic-string 1, std-env 4, tinybench 6, tinyexec 1,
  why-is-node-running 3, `@vitest/spy`); two minor bumps
  (`@jridgewell/sourcemap-codec` 1.6.0, picomatch 4.0.7); root devDeps differ
  only in vite and vitest.
- `npm run verify` (61 files, 1153 tests, lint 21), per-test durations with
  the JSON reporter, `check:intent` PASS, `npm run e2e` 16 passed (1.1 min,
  including `save-load`, `save-import`, `land-move`, `attacks`, `naval`,
  `swap`).
- A fresh `npm ci --ignore-scripts` in a scratch folder: exit 0, 277 packages,
  0 vulnerabilities, vite 8.3.4, vitest 5.0.3, the win32 rolldown binding, no
  esbuild or rollup; folder deleted.
- Server probes (its own script, scratch saves folder, its own child process
  stopped, ports free after): dev on 5256 and preview on 5257 each gave `/`
  200, `/map-editor.html` 200, `GET /api/saves` 200 `{}`, foreign Host 403
  (vite's check), foreign-Origin PUT 403 `{"error":"Foreign origin"}`; preview
  served the built bundle.
- vitest 5 and vite 8 source read for the timeout and the `rolldownOptions`
  alias (cited above).
- M1 (4 timeouts) and probe M2 (`mapEditor` input removed: only `index.html`
  built, so `rollupOptions.input` is honoured; an unchanged line, and `npm run
  verify` alone would not catch it).
- `npm run sdlc:scan -- --sample-due auto --exclude 56`: nth attested auto
  change = 4, every 3, `sampled: no`.
- No remote branch; `main` is ahead by `intents/58-60` files only, no package
  conflict.

**Taken on trust:** the pre-upgrade baseline in Progress (1153 tests, lint
21, e2e 16, audit 6, dist sizes and HTML 706 / 3676 B); the implementer's one
`heuristicSoak.test.ts` timeout; the intent's advisory list.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut56/`
(reviewer) and `…/scratchpad/coord56/` (coordinator).
