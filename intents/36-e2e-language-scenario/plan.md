<!-- generated-by: heraklios/intent@0.1.2 -->
# §36 plan — A smoke scenario for the language switch

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

`e2e/language.spec.ts` proves §35's switch, its memory across a reload,
the French Board, the page `lang` and the browser-locale default by real
clicks (spec B1–B4), with no change to the game or the dev hook (B5).

## Risks

- **The reload check passing for the wrong reason.** `startFromMenu`
  pins English with `page.addInitScript`, which re-runs on every load; a
  copy of it would reset the store on reload and hide a broken memory.
  The pin here is one write before the first real load (spec B2.3), and
  AC2's "store not written" mutant must fail the reload step.
- **Clicking the switch before the Menu has drawn.** Wait on
  `buttonCount('Français') === 1` before clicking, the way
  `startFromMenu` waits on its label.
- **The restart racing the checks.** After clicking, wait for
  `buttonCount(fr.menu.testMode) === 1` with `waitForFunction`, not a
  fixed sleep.
- **A new flake** in a suite that has one. AC3 runs the file 5×.
- **Importing `src/ui/i18n/` into Playwright's Node side.** `en.ts`
  imports only types from `reports.ts`, `fr.ts` only a type from
  `index.ts`; if the transform still pulls in browser code, fall back to
  importing the two tables only and note it in Progress.

## Verified against the codebase

Re-read on `main` at `5e3b2f8`:

- `src/scenes/MenuScene.ts:248-271` `addLanguageSwitch`: one text per
  language at top right; the current one is not interactive; clicking the
  other calls `setLanguage(lang)` then `this.scene.restart()`.
- `src/ui/devHook.ts:39-40`, `:92-93` `buttonCount` / `buttonToCanvas`
  match visible, interactive texts by label (`:115`), so the current
  language's button counts 0.
- `e2e/helpers.ts:41` the `addInitScript` English pin; `:127-130`
  `clickButton`; `waitIdle`.
- `src/ui/i18n/en.ts:1`, `fr.ts:1` imports (types only); `en.ts:10`,
  `fr.ts:5` `languageNames`; `en.ts:100` / `fr.ts:86` `menu.testMode`;
  `en.ts:152` / `fr.ts:138` `board.endPhase` ("End phase" / "Fin de
  phase").
- `src/ui/i18n/index.ts` store key `heraklios.language`, `LANGUAGES`.
- `playwright.config.ts`: `testDir: 'e2e'`, port 5232, viewport
  1100×750; a fresh context per test.
- `tsconfig.json:16` includes `e2e`; `eslint.config.js` lints it (not
  ignored), so `npm run verify` type-checks and lints the new file.
- `README.md:36` "four test-mode scenarios in Chromium".

## Subtasks

1. **`e2e/language.spec.ts`**, test 1 (spec B2): steps 1–6, errors
   collected as `startFromMenu` does (same favicon exception; copy the
   two listeners into a small exported helper in `helpers.ts` rather than
   duplicate them, and have `startFromMenu` use it too).
2. **Test 2** (spec B3): `fr-FR` and `en-US` via `test.describe` +
   `test.use({ locale })`, empty store, no pin.
3. **README.md:36** wording (spec B7).
4. **Hand-over.** `npm run e2e` (5 files), `--repeat-each=5` on the new
   file (AC3), AC2's four mutants run against it (file backed up and
   restored, never `git checkout --`), results in Progress; `verify`,
   `check:intent`; `status: in-review`.

## Tests

The scenario is the test. AC2's mutants, and which step must catch each:

| Mutant | Step that fails |
| --- | --- |
| `setLanguage` doesn't write the store | B2.3 (reload is English) |
| `resolveLanguage` ignores `navigator.language` | B3 `fr-FR` (opens English) |
| `applyToPage` removed | B2.2 and B3 `lang` checks |
| switch handler without `scene.restart()` | B2.2 (Menu stays English) |

## Validation

- `npm run verify` green (the new file type-checks and lints), lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e`: 5 files pass; the new file 10/10 under
  `--repeat-each=5`.
- No live check owed by path (`e2e/**`, `README.md`). The helper refactor
  in `e2e/helpers.ts` is covered by the four existing scenarios.

## Assumptions I made

- Moving the two error listeners into a helper is in scope: it's the
  one change to an existing scenario path, and the existing scenarios
  prove it.
- The Board's French is checked by one button label; the log isn't
  reachable through the hook and the spec doesn't need it.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
