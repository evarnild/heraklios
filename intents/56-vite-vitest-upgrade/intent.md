<!-- generated-by: heraklios/intent@0.1.5 -->
# §56 — Move to current vite and vitest majors and clear `npm audit`

**Type:** refactor
**Originator:** the owner (2026-10-24), after running `npm audit fix`
(`da5326a`): "create intent to make the proper audit with move to new
version of vite"
**Source:** `npm audit` on `main` at `da5326a`

## Problem

`npm audit` still reports 6 vulnerabilities in the dev toolchain (2
critical, 1 high, 3 moderate): `vitest`, `tinypool` (critical), `vite`
(high, the copy vitest pulls in), `@vitest/mocker`, `vite-node` and
`esbuild` (moderate). They all come from `vitest@2.1.9`, which brings its
own `vite@5.4.21` and `esbuild@0.21.5` beside the project's `vite@6.4.5`
(`npm ls vite vitest esbuild`). The esbuild advisory (GHSA-67mh-4wv8-2f99)
lets any website send requests to a running dev server and read the
responses. `npm audit fix` can't clear them without a major upgrade
(`fixAvailable: vitest@5.0.5, isSemVerMajor: true`), and the owner wants vite
itself on its current major too (`npm view`: vite 8.3.5, vitest 5.0.5 on
2026-10-24).

Everything is dev-only: nothing from these packages ships in the game bundle
except what vite builds.

## Outcome

- `vite` and `vitest` on their current majors (pinned at the versions the
  plan verifies), with `npm audit` reporting **0** vulnerabilities, or every
  one left listed with a reason in the plan's Progress.
- Behaviour held constant: `npm run verify` green with the same test count
  and lint ≤ 21; `npm run build` produces the same two entry points
  (`index.html`, `map-editor.html`) and a bundle of about the same size;
  `npm run dev` and `npm run preview` still mount the save API
  (`server/saveApiPlugin.ts`) and serve the map editor; `npm run e2e` green.
- Any config or test change the upgrade forces is mechanical (renamed
  options, changed defaults), recorded in the plan.

## Constraints

- **No game behaviour change:** no `src/engine`, `src/data` rule change; any
  `src/` edit is only what a renamed API forces.
- **The save API plugin** (`server/saveApiPlugin.ts`, registered in
  `vite.config.ts`) must keep its Host and Origin checks working under the
  new dev/preview server; its tests (`server/*.test.ts`, which use
  `vi.mock`/`vi.hoisted`) must stay meaningful, not just green.
- **Node version:** the new majors' minimum Node must match this machine's
  (`node -v`) and any `engines` field; the plan checks.
- **Lint cap 21**, never raised.
- **Lockfile:** a clean `npm ci` must work in a fresh worktree (`/spawn`
  runs it), including platform optional dependencies.
- `vite.config.ts` changes, so a live check is owed by path rule 1 (dev
  server, map editor, a save and load).

## Type-specific questions

### Refactor
- **What is restructured:** `package.json` devDependencies (`vite`,
  `vitest`, and whatever must move with them, e.g. `@vitest/*`), the
  lockfile, `vite.config.ts` and `vitest.config.ts` if their options
  changed, and any test file a removed vitest API forces.
- **How behaviour is held constant:** the full suite (61 files, 1109 tests at
  `da5326a`) passes unchanged in count, lint stays ≤ 21, `npm run e2e` stays
  green, the build output keeps both entries; before/after `npm audit` and
  `dist/` listings go in the plan's Progress.
- **Why now:** two critical and one high advisory in the dev toolchain, one
  of them against the dev server the owner runs while playing.

## Assumptions I made

- Type refactor: a dependency upgrade with behaviour held constant; it is not
  a fix of a game defect.
- "New version of vite" means vite's current major (8.x) together with the
  vitest major that supports it (5.x), not only the minimum that clears the
  audit; the plan confirms the two are compatible.
- `@playwright/test`, `typescript` and eslint stay as they are unless the
  upgrade forces them.
- Tier: Attested by the path table (build config, `package.json`); no
  `--max-warnings` change.
