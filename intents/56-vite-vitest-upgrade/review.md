<!-- generated-by: heraklios/review@0.1.5 -->
# §56 review — Move to current vite and vitest majors and clear npm audit

verdict: attest
tier: attested
reviewed-commit: 2df7ee6
round: 3
sampled: no
run: manual
live-check: owed

**Tier:** Attested, by the path table (`package.json`, the lockfile,
`vitest.config.ts`; the lint cap unchanged); `review_tier` empty; no CRITICAL
or HIGH finding. **Run:** manual. **Disclosure:** the coordinator both wrote
this round's change (the Progress entry, on the owner's "a" to round 2's
finding) and reviewed it; the change is 15 added lines in `plan.md`, below
the Progress marker, and nothing else.

**Verdict:** `attest`. Round 2's finding is resolved by the outcome's second
branch: the 7 moderate `npm audit` entries are listed in Progress with a
reason, and each part of that reason checks out. Nothing outside `plan.md`
changed since round 2, and `main` has not moved (`27e7066`).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the outcome now holds (audit entries listed with a reason); the diff since round 2 is `plan.md` Progress only |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | not run: no rule behaviour in the diff |
| 4 | Tests prove the rule | pass: no code or config change since round 2, whose M1 stands (killed) |
| 5 | Boundary and conventions | pass: nothing above the Progress marker edited |
| 6 | Numbers in prose | pass: the entry's 64 files, 1183 tests, lint 21, e2e 17 and the 7 entries match this round's and round 2's runs |
| 7 | Documentation | pass: no doc names a vite, vitest or audit count |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; `plan.md` valid UTF-8, CRLF kept |
| 9 | Repository-specific footguns | pass: no code change |

## Type check
```
type-check: FAIL (intent 56, refactor)
  error: A live check is owed and not recorded. Do the steps in intents/56-vite-vitest-upgrade/review.md → ## Live check, then set live_checked: <date> in intents/56-vite-vitest-upgrade/metadata.yml.
  note:  3 file(s), 6583 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Findings
- None needing rework.
- Worth a look: the Progress entry says the minimatch fix is "to be tracked
  separately", and no intent tracks it yet; one would make that true (the
  owner was offered a `/intent --fix`).
- Carried from round 1, unchanged, all LOW and Worth a look: the global
  `testTimeout: 60_000`; Progress's "same entries" for the shrunken HTML; no
  logged `rollupOptions` warning; the soak time quoted as "10-16 s".

## Not checked
- **The production bundle, the map editor and Save / Load on preview in a
  browser**, including §55's Tables panel in the built game: runtime-only,
  hence the live check (rule 3).
- **e2e and mutants:** not re-run this round; no code, config, package or
  test file changed since round 2, which ran e2e (17 passed) and M1 (killed).
- **When typescript-eslint moves to minimatch 11:** not knowable now; the
  7 entries stay until it does or an override is chosen.
- Carried from round 1: the plugin's own Host check at runtime; `npm ci`
  with install scripts in a fresh folder; platforms other than win32-x64;
  vite's future `configLoader: 'native'` default.
- No browser run beyond round 2's e2e suite.

## Live check
- **Owed** by rule 3 (the production bundle, the map editor in a browser, and
  Save / Load on preview are runtime-only). Run it on `2df7ee6` (the code is
  the same as at `7b47eb6`).
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

**Coordinator** (worktree at `2df7ee6`, `git status --short` clean before and
after):
- `git diff --name-only c4067a2 HEAD`: `plan.md` only; 15 lines added, none
  removed; valid UTF-8. `main` is `27e7066` and an ancestor of the branch.
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 64 files,
  1183 tests.
- `npm run check:intent`: FAIL only on the owed live check, 3 files, 6583
  lines.
- `npm audit --json`: 7 moderate, packages `minimatch`,
  `@typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}`,
  `typescript-eslint`; one advisory, GHSA-g3hv-75wg-m249. Matches the Progress
  table.
- `npm view typescript-eslint dist-tags.latest`: 8.72.1, as the entry says
  (its `minimatch ^10.2.2` dependency checked in round 2).
- `npm run sdlc:scan -- --sample-due manual --exclude 56`: nth attested
  manual change = 14, every 5, `sampled: no`.

**Taken on trust:** round 2's e2e, M1 and package checks (nothing they cover
changed); round 1's lockfile comparison and server probes.

# Round 2 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 7b47eb6
- round: 2
- sampled: no
- run: manual
- live-check: owed

The full round-2 report is in git at `c4067a2`.

Resolutions (round 3, checked at `2df7ee6`):
- **MEDIUM, `npm audit` at 7 moderate (GHSA-g3hv-75wg-m249): resolved** by
  the owner's choice (a), in `2df7ee6`: the entries are listed in Progress
  with the reason they are left; tracking the fix separately is still to do.
- The four LOW items carried from round 1: unchanged.

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

