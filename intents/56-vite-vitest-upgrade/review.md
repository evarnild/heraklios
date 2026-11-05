<!-- generated-by: heraklios/review@0.1.5 -->
# §56 review — Move to current vite and vitest majors and clear npm audit

verdict: rework
tier: attested
reviewed-commit: 7b47eb6
round: 2
sampled: no
run: manual
live-check: owed

**Tier:** Attested, by the path table (`package.json`, the lockfile,
`vitest.config.ts`; the `lint` script and its `--max-warnings 21` unchanged);
`review_tier` empty; no CRITICAL or HIGH finding. **Run:** manual, on the
owner's `/review 56` after the coordinator rebased the branch onto `main`
(`27e7066`, §55 merged) on the owner's "rebase 56". Round 1 reviewed
`4cbcdea`, which the rebase replaced, so this round re-reviews the rebased
branch. The coordinator ran every pass itself, no reviewer agent.

**Verdict:** `rework`, on one finding that needs the owner's decision: a
minimatch advisory published on 2026-10-30, after round 1, puts `npm audit`
at 7 moderate on the branch, so the intent's outcome ("0 vulnerabilities, or
every one left listed with a reason in the plan's Progress") no longer holds
as written. The branch did not cause it (`main` has the same 7 plus round 1's
original 6, 13 in all), and everything else holds on the rebased branch: the
branch's own commits are unchanged by the rebase, and §55's new code and
tests pass under vite 8 and vitest 5.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1): the audit outcome (below); the diff against `main` is still `package.json`, the lockfile, `vitest.config.ts` and the intent's files |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: no rule behaviour in the diff |
| 4 | Tests prove the rule | pass: M1 killed again by the same test, now against 1183 tests |
| 5 | Boundary and conventions | pass: no source change |
| 6 | Numbers in prose | pass: Progress's numbers are round 1's base; the counts on the new base are below (1183 tests, e2e 17), as expected from §55 |
| 7 | Documentation | pass: no doc names a vite, vitest, esbuild or rollup version |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no new direct dependency |
| 9 | Repository-specific footguns | pass: the seeded self-play suites green |

## Type check
```
type-check: FAIL (intent 56, refactor)
  error: A live check is owed and not recorded. Do the steps in intents/56-vite-vitest-upgrade/review.md → ## Live check, then set live_checked: <date> in intents/56-vite-vitest-upgrade/metadata.yml.
  note:  3 file(s), 6583 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.
Same 3 files and 6583 lines as round 1.

## Findings
- **MEDIUM** `plan.md` Progress (the audit row, "0") and the intent's
  Outcome: `npm audit` on the branch now reports **7 moderate**, all one
  advisory, GHSA-g3hv-75wg-m249 (minimatch `>=7.0.0 <11.0.1`, denial of
  service through globparts amplification, published 2026-10-30). The only
  vulnerable copy is `minimatch@10.2.6` under
  `typescript-eslint@8.71.1` → `@typescript-eslint/typescript-estree`; the
  other six entries are the typescript-eslint packages that depend on it.
  It is dev-only (the lint toolchain), outside the vite and vitest tree, and
  the same on `main`. No release fixes it yet: the newest,
  `typescript-eslint@8.72.1` (2026-10-26), still declares `minimatch
  ^10.2.2`, and `npm audit fix --force` proposes a breaking typescript-eslint
  change. The intent left eslint and typescript-eslint alone "unless the
  upgrade forces them", which it does not. Needs decision, one of:
  (a) accept the 7 as left, recorded in Progress with this reason (the
  outcome's second branch), and track the fix separately;
  (b) widen §56 to clear them, e.g. an npm `overrides` entry forcing
  `minimatch@11.0.4` under `@typescript-eslint/typescript-estree` (a major
  bump past what that package declares, so lint must be proven unchanged);
  (c) wait for a typescript-eslint release on minimatch 11.
- Carried from round 1, unchanged, all **LOW** and Worth a look: the global
  `testTimeout: 60_000` rather than per-soak timeouts; Progress's "same
  entries" for the shrunken HTML; no logged `rollupOptions` warning; the soak
  time quoted as "10-16 s".

## Not checked
- **The production bundle, the map editor and Save / Load on preview in a
  browser:** as in round 1, runtime-only, hence the live check (rule 3).
  The rebase added §55's Tables panel to the bundle; it ran in the e2e suite
  on the dev server only.
- **§55's panel under the vite 8 build:** covered on the dev server by
  `e2e/rules-panel.spec.ts`; not in the built game.
- **Whether option (b) above keeps lint behaviour identical:** not tried; it
  is the owner's choice first.
- Carried from round 1: the plugin's own Host check at runtime (vite's
  allowed-hosts check answers first); `npm ci` with install scripts in a
  fresh folder (this round ran `npm ci` in the worktree only); platforms other
  than win32-x64; vite's future `configLoader: 'native'` default.
- No browser run beyond the e2e suite.

## Live check
- **Owed** by rule 3 (the production bundle, the map editor in a browser, and
  Save / Load on preview are runtime-only), unchanged from round 1. Run it on
  the commit that settles the finding, or on `7b47eb6` if the choice is (a),
  which changes only `plan.md`.
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
     `http://127.0.0.1:5257/`: a test-mode game, a move, an attack, open
     **📖 Tables** and switch tabs, Save, reload, Load. Open
     `http://127.0.0.1:5257/map-editor.html`: the sidebar looks as on `main`
     (dark sidebar, swatch buttons with a thin light border); paint a hex.
- **You should see:** both servers load the menu, the board centred on a dark
  background; the move and attack resolve; the Tables panel draws its four
  tabs; the save shows in its slot and Load restores the moved unit; the
  editor sidebar styled as on `main`, and painting changes the hex; no errors
  in the browser console in the built version.

## Verified myself vs. taken on trust

**Coordinator** (worktree at `7b47eb6`, `git status --short` clean before and
after):
- `git rebase main` (on the owner's "rebase 56"): clean, six commits;
  `git range-diff b6182e8~6..b6182e8 main..HEAD`: all six `=`; the diffs of
  `package.json`, `package-lock.json` and `vitest.config.ts` against their
  base are byte-identical before and after (sha1 of each `git diff`).
- `git diff --name-only 9dacdfb main`: what `main` gained is §55 (src/ui,
  `BoardScene.ts`, `ruleTables.ts`, five test files, `e2e/rules-panel.spec.ts`,
  README, CLAUDE.md) and intent folders; no package or config file.
- `npm ci`: exit 0. `npm run verify`: exit 0, `21 problems (0 errors, 21
  warnings)`, 64 files, 1183 tests (main's count; round 1's 61 / 1153 plus
  §55's).
- `npm run e2e`: exit 0, 17 passed (40.3 s), including `rules-panel`.
- `npm run check:intent`: FAIL only on the owed live check, 3 files, 6583
  lines.
- `npm ls vite vitest esbuild rolldown`: one `vite@8.3.4` (`rolldown@1.2.15`),
  `vitest@5.0.3` with vite deduped, no esbuild.
- `npm audit`: 7 moderate, GHSA-g3hv-75wg-m249 only (above). On `main`: 13
  (2 critical, 1 high, 10 moderate). `npm ls typescript-eslint minimatch`:
  the vulnerable copy is `minimatch@10.2.6` under typescript-estree; eslint's
  own is 3.1.5, outside the range. `npm view`: typescript-estree 8.72.1 still
  depends on `minimatch ^10.2.2`. The advisory API gives published
  2026-10-30, patched in 11.0.1.
- `dist/` after the build: `index.html` 578 B, `map-editor.html` 2750 B (as
  round 1), `main-*.js` 1,362,287 B (round 1 1,351,968 B; §55 adds the panel).
- **M1** (`testTimeout: 60_000` removed, full `vitest run`, backed up and
  restored by copy): **killed**, 1 failed, "plays 100 seeded games headlessly
  end to end with no invariant violations" (5 s timeout), the same decisive
  test as round 1; none of §55's tests timed out.
- `npm run sdlc:scan -- --sample-due manual --exclude 56`: nth attested
  manual change = 14, every 5, `sampled: no`.

**Taken on trust:** round 1's lockfile comparison, fresh-folder `npm ci` and
server probes (the package files are byte-identical since); the pre-upgrade
baseline in Progress.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/5fa25da4d97f8e6d/039c398c-c92e-4752-8e0d-48aac6d7afde/scratchpad/coord56r2/`.

# Round 1 (history)
- verdict: attest
- tier: attested
- reviewed-commit: 4cbcdea (rebased since as `1be6390`)
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `de7a23c` (before the rebase, `ab3025f`).

Resolutions (round 2, checked at `7b47eb6`):
- No round-1 finding needed rework. The four LOW "Worth a look" items are
  unchanged.
- The audit, 0 at round 1, is 7 at round 2 because of a later advisory
  (round 2's finding).

