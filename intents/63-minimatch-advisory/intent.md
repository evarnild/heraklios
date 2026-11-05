<!-- generated-by: heraklios/intent@0.1.5 -->
# §63 — `npm audit` clears the minimatch advisory in the lint toolchain

**Type:** fix
**Originator:** the owner (2026-11-05), choosing (a) for §56's round-2
finding: "yes, draft the minimatch fix intent"
**Source:** `intents/56-vite-vitest-upgrade/review.md` round 2 finding
(MEDIUM, `npm audit`) and §56's `plan.md` Progress entry of 2026-11-05

## Problem

`npm audit` reports 7 moderate vulnerabilities, all one advisory,
GHSA-g3hv-75wg-m249 (minimatch `>=7.0.0 <11.0.1`, denial of service through
globparts amplification, published 2026-10-30). The vulnerable copy is
`minimatch@10.2.6`, pulled in by `typescript-eslint@8.71.1` →
`@typescript-eslint/typescript-estree`; the other six entries are the
typescript-eslint packages that depend on it. §56 left it listed with a
reason because it is outside the vite/vitest upgrade, and no typescript-eslint
release fixes it yet: the newest, 8.72.1 (2026-10-26), still declares
`minimatch ^10.2.2`. `npm audit fix --force` proposes a breaking
typescript-eslint change instead.

It is dev-only: eslint runs over the repo's own files at `npm run lint`,
nothing from it reaches the game bundle.

## Outcome

- `npm audit` reports none of GHSA-g3hv-75wg-m249's entries, with
  `typescript-eslint` on a release that depends on `minimatch >=11.0.1`, or an
  npm `overrides` entry that forces it, recorded with its reason in the plan.
- Lint unchanged: `npm run lint` gives the same 21 warnings at the same
  locations (cap 21, never raised), and `npm run verify` stays green with the
  same test count.
- §56's Progress entry ("to be tracked separately") is answered by this
  intent's merge.

## Constraints

- **Prefer an upstream release** over an override: the plan first checks
  `npm view @typescript-eslint/typescript-estree dependencies.minimatch` on
  the newest typescript-eslint at least 14 days old (the pin rule §56 used).
  An override forcing minimatch 11 under a package that declares `^10` is a
  major bump past its range; it needs proof that lint's output did not change.
- `eslint`'s own `minimatch@3.1.5` is outside the advisory's range and stays.
- No `src/`, `server/` or test change; `package.json` and the lockfile only,
  plus `eslint.config.*` only if a renamed option forces it.
- A clean `npm ci` must still work in a fresh worktree.

## Type-specific questions

### Fix
- **What broke:** `npm audit` reports 7 moderate entries; §56's outcome
  wants it at 0, with exceptions only when listed.
- **Since when:** 2026-10-30, the advisory's publication; no heraklios commit
  introduced it (`typescript-eslint ^8.71.1` predates it).
- **Impact:** a denial of service in glob matching during lint, on the
  owner's machine only; no game, save or bundle is affected.
- **Reproduction:** `npm audit` on `main` (or any branch), or
  `npm ls minimatch` showing `minimatch@10.2.6` under typescript-estree.
- **The test that will fail first:** none in the suite; the check is
  `npm audit --json` reporting GHSA-g3hv-75wg-m249, before and after,
  recorded in Progress. A test asserting the audit would depend on the
  network and future advisories, so none is planned.

## Assumptions I made

- Type fix, not refactor: the defect is a known vulnerable dependency, and
  behaviour (lint output) is held constant.
- No `follows_up`: no heraklios change caused it.
- Whether to wait for upstream or override now is the plan's to propose and
  the owner's to approve; this intent allows either.
- Tier: Attested by the path table (`package.json`, the lockfile).
- If §56 is not merged first, this branch starts from `main` and still sees
  the same 7 entries (plus §56's original 6); it should be planned after §56
  merges, so that its audit numbers stand alone.
