<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §56 plan — Move to current vite and vitest majors and clear `npm audit`

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

`vite` 6 → 8 and `vitest` 2 → 5 with exact pins, a clean `npm audit`, and the
game, the map editor, the save API, the test suite, lint and e2e all working
as before (intent Outcome). A refactor: behaviour held constant.

## Risks

- **Fresh releases.** On 2026-10-25 the newest are vite 8.3.5 (released
  2026-10-21) and vitest 5.0.5 (2026-10-15). Pin the newest of each that is at
  least 14 days old: **vite 8.3.4** (2026-10-08) and **vitest 5.0.3**
  (2026-09-30). If `npm audit` still flags either, move to the newest patch
  that clears it and record the reason and date in Progress.
- **Compatibility.** vitest 5.0.x declares `peerDependencies.vite: ^6.4.0 ||
  ^7.0.0 || ^8.0.0` and `engines.node: ^22.12.0 || ^24.0.0 || >=26.0.0`; vite
  8.x declares `engines.node: ^20.19.0 || >=22.12.0` and `@types/node` `^20.19.0
  || >=22.12.0`. This machine runs Node 24.11.0 and the project has
  `@types/node ^24.19.2`: both fit. Re-check them for the pinned versions.
- **Two vites.** Today vitest brings its own `vite@5.4.21` and `esbuild@0.21.5`
  (`npm ls vite vitest esbuild`). After the upgrade there must be **one** vite
  (deduped to the pinned 8.x) and no esbuild below the fixed version; check
  with `npm ls` and record it.
- **Config and API changes.** vite 8 and vitest 5 may rename or drop options
  this repo uses: `vite.config.ts` (`root`, `plugins`, `server.port`,
  `build.rollupOptions.input`, which may become `build.rolldownOptions` if
  vite 8 builds with Rolldown), `vitest.config.ts` (`test.environment`,
  `test.include`), the plugin hooks `configureServer` / `configurePreviewServer`
  (`server/saveApiPlugin.ts:86`, `:89`) and the `Connect` type it imports
  (`:6`), `vi.mock` / `vi.hoisted` in `server/*.test.ts`. Read each package's
  migration guide for the majors skipped (vite 7 and 8; vitest 3, 4 and 5)
  and change only what they force.
- **Behaviour held constant:** the test count stays 1022 (`main` at
  `c5fe442`'s count; re-measure on `main` first and use that number), lint
  stays ≤ 21, `npm run e2e` stays green, `dist/` keeps `index.html` and
  `map-editor.html`. A test that now fails is a migration to fix, never a test
  to delete; a test whose meaning changes (e.g. a mock API) must still assert
  the same thing.
- **The save API** must still run on both dev and preview servers with its
  Host and Origin checks (`server/saveApiPlugin.ts`); its tests must stay
  meaningful.
- **The lint cap** (21): never raised. `eslint.config.js` likely needs no
  change.
- **Clean install:** a fresh `npm ci` must work in a new worktree (`/spawn`
  runs it), platform optional dependencies included.
- **Other branches:** every open branch shares `package.json` and the lockfile.
  None is open at plan time except §55 (`feat/55-rule-tables-panel`), which
  doesn't touch them; whichever ships second merges the lockfile.
- **Memory is short on this machine:** run every suite in the foreground, one
  at a time.

## Verified against the codebase

Re-read on `main` at `a467d2e`.

- `package.json:7` — `"dev": "vite"`; `:11` — `"test:watch": "vitest"`; `:35`
  — `"vite": "^6.0.5"`; `:36` — `"vitest": "^2.1.8"`; `:12` — lint with
  `--max-warnings 21`; `:24` — `phaser ^3.90.0`; `:29` — `@playwright/test
  ^1.64.0`; `:30` — `@types/node ^24.19.2`.
- `npm ls vite vitest esbuild` — `vite@6.4.5` (with `esbuild@0.25.12`),
  `vitest@2.1.9` with its own `vite@5.4.21` and `esbuild@0.21.5`.
- `npm audit` — 6 (2 critical, 1 high, 3 moderate): `vitest`, `tinypool`,
  `vite`, `@vitest/mocker`, `vite-node`, `esbuild`, all fixed by `vitest@5`
  (`isSemVerMajor: true`).
- `vite.config.ts` — `defineConfig` with `root`, `plugins: [saveApiPlugin()]`,
  `server.port 5173`, `build.rollupOptions.input` (`main`, `mapEditor`).
- `vitest.config.ts` — `environment: 'node'`, `include` of `src`, `server`,
  `e2e` (`*.test.ts`), `scripts` and `tools` (`*.test.mjs`).
- `server/saveApiPlugin.ts:6` — `import type { Connect, Plugin } from 'vite'`;
  `:73` — `saveApiPlugin()`; `:86`, `:89` — `configureServer`,
  `configurePreviewServer`.
- `server/fileSaveFs.test.ts:10-11`, `server/saveApiPlugin.concurrency.test.ts:16`
  — `vi.hoisted` / `vi.mock('node:fs/promises', …)`.
- `playwright.config.ts:34-35` — `webServer.command: npx vite --port … --strictPort
  --host …`.
- `node -v` — v24.11.0.

## Subtasks

1. **Baseline.** On the branch before any change: `npm run verify` (record
   files, tests, lint), `npm run e2e`, `npm ls vite vitest esbuild`, `npm
   audit`, `npm run build` and `ls dist/` (record the two HTML entries and the
   asset sizes). Put the numbers in the Progress entry. No commit needed if
   nothing changes.
2. **The upgrade** (intent Outcome 1). `npm install -D --save-exact
   vite@8.3.4 vitest@5.0.3` (or the patches Risks allows); check `npm ls`
   shows one vite and the fixed esbuild; `npm audit` shows 0. Commit
   `package.json` and the lockfile only.
3. **The migration** (Outcome 2-3). Make `npm run build`, `npm run lint`,
   `npm test` pass with the smallest changes the migration guides require, in
   `vite.config.ts`, `vitest.config.ts`, `server/saveApiPlugin.ts` and the tests;
   each changed line gets a short comment if the reason isn't obvious. Same
   test count, lint ≤ 21. Commit (one commit per area if they're separate).
4. **Behaviour checks.** `npm run verify`; `npm run e2e` (all green, compare
   with the baseline); `npm run build` and `ls dist/` (both entries, sizes
   about the same: record before/after); `npm run dev` started on a free port
   with `HERAKLIOS_SAVES_DIR` set to a temp folder, then `curl` the game page,
   the map editor page and `GET /api/saves` (200), and one request with a
   foreign `Host` (403); stop the server you started. In a scratch clone or
   worktree folder, `npm ci` from the new lockfile succeeds. Record all of it.
5. **README / docs.** Update any version mentioned in `README.md`,
   `CLAUDE.md` or `docs/runbook.md` (search for "vite 6", "vitest 2", "2.1"),
   only where they name a version. Commit, then the Progress entry and
   `status: in-review`.

## Tests

| What must hold | Proof |
| --- | --- |
| no test lost or weakened | the same test count as the baseline; the diff of `*.test.*` reviewed line by line |
| the save API still guarded | `server/*.test.ts` green, and the dev-server `curl` with a foreign Host → 403 |
| the build still has both entries | `ls dist/` before and after |
| the game still runs | `npm run e2e` green |
| one vite, fixed esbuild, no advisories | `npm ls`, `npm audit` before and after |
| a clean install works | `npm ci` in a fresh folder |

Mutation testing applies to changed behavioural lines: there should be few
(config). `/review` mutates any config line whose change matters (e.g. the
build inputs), with the build or e2e as the test.

## Validation

- `npm run verify` green, lint ≤ 21, test count as the baseline.
- `npm run check:intent` PASS (apart from an owed live check).
- `npm run e2e` green.
- **Live check (owed: `vite.config.ts`, rule 1):**
  1. In the worktree, `HERAKLIOS_SAVES_DIR=<temp folder> npm run dev -- --port
     5256 --strictPort --host 127.0.0.1`, open `http://127.0.0.1:5256/`: the
     menu loads; start a test-mode game; play a move; Save to a slot; reload;
     Load it.
  2. Open `http://127.0.0.1:5256/map-editor.html`: the editor loads and a
     hex can be edited.
  3. `npm run build && npm run preview -- --port 5257 --strictPort`: the game
     loads from the built files and Save / Load works there too.

## Assumptions I made

- Pins vite 8.3.4 and vitest 5.0.3, the newest at least 14 days old on
  2026-10-25 (Risks); exact versions, no caret, as §52 pinned the SDK.
- `@playwright/test`, `typescript`, eslint and `@types/node` stay as they are
  unless the upgrade forces them (intent).
- The worktree's dev port is 5256 (5200 + 56).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
