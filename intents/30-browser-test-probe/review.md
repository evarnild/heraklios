<!-- generated-by: heraklios/review@0.1.1 -->
# §30 review — Probe: can a browser test drive the game's scenes?

verdict: attest
tier: attested
reviewed-commit: 4401582
round: 2
sampled: no

Round 2 covers commit `4401582`, an 11-line prose change to `findings.md`
that applies round 1's findings. Claude wrote the change, and the owner
(Eric) read the diff and accepted it, so this round is not an independent
agent review. No code changed since round 1 (`6de3853`). The round-1
`verify`, `check:intent`, Playwright and mutant results still apply, and
were not re-run.

`sampled: no` — this is the first attested review in `intents/*/review.md`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass (round 1; intents-only change since) |
| 3 | Rulebook fidelity | not run — no rule behaviour changed |
| 4 | Tests prove the rule, not only pass | pass — the survived mutant is now documented as a limit of the probe, not claimed as coverage |
| 5 | Engine/presentation boundary and conventions | pass (round 1) |
| 6 | Numbers in prose | pass — browser size corrected to the measured on-disk sizes |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass — `test-results/` gitignore need recorded for the follow-up |
| 9 | Repository-specific footguns | pass (round 1) |

## Type check
Not re-run. Round 1 gave `type-check: PASS (intent 30, experiment)`, and
`4401582` touches only `intents/30-browser-test-probe/findings.md`.

## Round 1 findings — status
1. **M** Menu-click coverage overstated — **resolved**: `findings.md` Q1 now
   says the click reaches *a* test board, not the right one. It records the
   survived mutant (550, 612) and says a suite needs an assertion that tells
   the modes apart.
2. **M** browser cost ~118 MB — **resolved**: Q3 gives the on-disk sizes
   (278 MB headless shell, 437 MB full Chromium, 3.9 MB ffmpeg, ~720 MB in
   all) and notes that 118 MB was probably the download size.
3. **L** `test-results/` left untracked — **resolved for the probe**: Q3
   "Maintenance" says the follow-up needs `test-results/` and
   `playwright-report/` in `.gitignore`. The branch itself is not merged,
   so it gets no `.gitignore` change.
4. **L** merge mechanics — **open, owner action**: merge only
   `intents/30-browser-test-probe` onto `main` (`git checkout
   exp/30-browser-test-probe -- intents/30-browser-test-probe`), not the
   branch.

## Findings
None needing rework.

## Not checked
- Round 2 is not an independent review: the reviewer wrote the fixes, and
  the owner's diff read is the check.
- Everything in round 1's Not-checked list still stands (20-run timings,
  41-run flake count, `hexToCanvas` off-centre, Linux/macOS, AI/tween/dice
  flows).
- Round 1's merge-mechanics LOW is about `main`, not this branch. No line
  was added to `intents/README.md` saying how an experiment's findings merge.

## Verified myself vs. taken on trust
- `git diff 6de3853 4401582 --stat`: `findings.md` only, +8/−3.
- Taken on trust: the owner's read of that diff.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 6de3853
- round: 1
- sampled: no

Tier set by input 1 (paths). The branch as it stands touches `src/main.ts`,
`package.json`/`package-lock.json` and `playwright.config.ts` (Attested).
`review_tier:` is empty, and no finding is CRITICAL/HIGH. Under the intent's
containment rule only `intents/30-browser-test-probe/**` merges, and that
merge on its own would be Automated tier.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule behaviour changed (`src/engine/`, `src/data/` untouched) |
| 4 | Tests prove the rule, not only pass | findings (1) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (1) |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | findings (1) |
| 9 | Repository-specific footguns | pass |

Pass notes:
- **1:** the diff answers all four questions in the intent's Outcome. It used
  Playwright only and stated why the second approach wasn't tried. No change
  to `src/engine/` or `src/data/`. The new dependency stays on the branch, as
  the Constraints allow.
- **5:** the hook is inside `if (import.meta.env.DEV)` and uses dynamic
  imports. After `npm run verify`'s build, `grep __heraklios dist/assets/*.js`
  finds nothing. No `GameState` mutation and no history push are involved.
- **8:** lint shows 0 errors and 21 warnings, and the cap stays at 21 (the
  same as `main`). There is no `innerHTML`/`eval`. A new dev dependency is
  allowed on the exp branch per the intent.
- **9:** the drift state machine, the AI tiers and the map editor are not
  touched.

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 30, experiment)
  note:  5 file(s), 207 line(s) changed outside intents/.
```

### Findings
- **MEDIUM** `intents/30-browser-test-probe/findings.md:24-26` says that
  clicking the Menu button at (550, 570) "means the Menu click handler is
  tested too". A mutant disproves this. I changed the click to (550, 612),
  the "Mode test combat" button, and the test **still passed**. The test
  never checks which test mode it reached: it only waits for `Board`, a
  `movement` phase and an adjacent reachable hex, and both shortcuts give
  all three. The follow-up intent will be designed from this document, so
  it should not credit the probe with coverage it lacks. Needs rework:
  either reword the sentence ("the click reaches *a* test board; which
  shortcut ran is not checked"), or add an assertion that tells the two
  modes apart, then note the result in findings.md.
- **MEDIUM** `intents/30-browser-test-probe/findings.md:65` gives the browser
  cost as "Chromium headless shell, ~118 MB". That is not what is on disk.
  `npx playwright install chromium` (all four directories dated 2026-10-08
  17:14–17:15) installed `chromium_headless_shell-1248` at **278 MB** and
  `chromium-1248` at **437 MB**, plus `ffmpeg-1013` at 3.9 MB. That is about
  720 MB in `%LOCALAPPDATA%\ms-playwright`. The 118 MB is probably the
  download size. Cost is one of the intent's four questions, so the number
  matters. Needs rework: state the installed size (and the download size if
  you want), and say that `install chromium` fetches both builds.
- **LOW** `.gitignore` — running `npx playwright test` leaves an untracked
  `test-results/` directory in the worktree. I removed the one my runs
  created. The follow-up suite needs `test-results/` (and `playwright-report/`)
  in `.gitignore`. Worth a look: one line in findings.md's Q3
  "Maintenance" row.
- **LOW** (merge mechanics, not the code) — commit `6de3853` contains both
  the probe code and the findings. So a plain `git merge
  exp/30-browser-test-probe` would bring `@playwright/test`, the hook and
  `e2e/` into `main`, which breaks the containment rule. Neither `sdlc.md`
  nor `intents/README.md` says how an experiment's findings-only merge is
  done. Worth a look: on `main`, run `git checkout
  exp/30-browser-test-probe -- intents/30-browser-test-probe` and commit
  that, instead of merging the branch. A line in `intents/README.md` would
  make this the standard way.

### Not checked
- **The 20-run timings and the 41-run flakiness count.** I re-ran 1 + 5
  (`--repeat-each 5`, parallel). All 6 passed, in 5.6 s and 7.0 s wall time.
  I did not reproduce the 50.8 s serial / 14.2 s parallel figures for 20 runs.
- **The "~8 s cold" figure.** My cold run was 5.6 s including Vite start-up.
  That is close enough not to flag, but it is not reproduced.
- **`hexToCanvas` near the viewport edges, and at non-default zoom.** The
  test always calls `centerOn` first, so the inverse-affine maths and the
  `null`-when-off-screen branch only ever run at the viewport centre. No
  mutant was run against the hook's maths.
- **Mutants on `src/main.ts` against `npm run verify`.** Vitest does not
  reach the hook (by design: `e2e/` is outside Vitest's `include`), so every
  such mutant would survive `verify`. Only the Playwright test exercises it.
- **Linux/macOS and headed Chromium.** Out of scope per the intent. Not run.
- **Whether `reuseExistingServer: true` could attach to a stale server on
  5230.** Nothing was on 5230 when I ran. If an old dev server from this
  worktree were still up, the test would run against it.
- **AI turns, tweens, dice and the drift/retreat modals.** findings.md
  already lists these as unmeasured. I agree they are unknown.

### Verified myself vs. taken on trust
Verified (run in `../heraklios-wt/30-browser-test-probe` at `6de3853`):
- `npm run verify`: green. Build OK; lint 0 errors / 21 warnings with
  `--max-warnings 21` (same as `main`); 34 files / 585 tests passed.
- `npm run check:intent`: PASS (output above).
- `grep -l __heraklios dist/assets/*.js` after the build: no match, so the
  hook is not in the production build.
- `npx playwright --version`: 1.64.0. `npx playwright test`: 1 passed (5.6 s).
  `--repeat-each 5`: 5 passed (7.0 s).
- Mutant M1: `BoardScene.ts:1483` `applyAction(state, action)` replaced by
  `({ charged: false })`. The test **failed** on the position `toEqual`
  (killed). File restored from a scratch backup.
- Mutant M2: the Menu click (550, 570) → (550, 612). The test **passed**
  (survived; first finding). Spec restored from a scratch backup.
- After both: the test passed again. `git status --short` was clean once I
  removed `test-results/`.
- `MenuScene.ts:184` draws the button at `(width/2, 570)` and `main.ts` sets
  width 1100. `BoardScene.onHexClick` (line 1430) holds the `landMove`
  `applyAction` call at line 1483. Both match findings.md.
- `du -sh` on `%LOCALAPPDATA%\ms-playwright\*`: 278 MB / 437 MB / 3.9 MB /
  260 KB.
- `git diff --stat main...HEAD`: `package-lock.json` +47 and `src/main.ts`
  +46, as findings.md says.

Taken on trust: the 20-run timings, the 41-run zero-flake count, the
implementer's own stub-the-move check (I ran an equivalent, M1), and the
"~8 s cold" wall time.
