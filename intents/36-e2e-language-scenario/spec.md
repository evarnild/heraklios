<!-- generated-by: heraklios/intent@0.1.2 -->
# §36 spec — A smoke scenario for the language switch

Accepted intent: [intent.md](intent.md)

Written against `main` at `5c0e6cd`, after §35's merge (`9d3cf43`).

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/35-game-languages/spec.md` B3, B4, B10, B11 | The behaviour under test: Menu switch, `heraklios.language` in `localStorage`, browser-locale default (`fr*` → French), page `lang`, e2e pins English |
| `intents/32-e2e-smoke-suite/spec.md` | The suite's rules: real canvas clicks, the dev-only hook, port 5232, one fresh browser context per test, every page or console error fails |
| `REVIEW-POLICY.md` → "When the smoke suite stands in" | What a named scenario lets a later review skip |

## Behaviour

**B1 — A new file, `e2e/language.spec.ts`, with two tests.**

**B2 — Switch and remember** (`the Menu switch changes the language and a
reload keeps it`), by real clicks:
1. Open `/` with the store pinned to `en` (as the other scenarios do).
   The Menu shows English: `buttonCount(en.menu.testMode) === 1` and the
   switch offers **Français** (`buttonCount('Français') === 1`; the
   current language's button isn't clickable, so it isn't counted).
2. Click **Français**. The Menu redraws in French:
   `buttonCount(fr.menu.testMode) === 1`, `buttonCount(en.menu.testMode)
   === 0`, `document.documentElement.lang === 'fr'`, and the store holds
   `fr`.
3. Reload. Still French, by the same three checks. **The English pin
   must not run again on the reload**: it is set with a one-shot
   `localStorage` write before the first `goto`, not with
   `page.addInitScript`, which would re-pin English on every load.
4. Click `fr.menu.testMode`. The Board is up and idle, and draws French:
   `buttonCount(fr.board.endPhase) === 1`.
5. Back on the Menu (reload), click **English**: the Menu reads English
   again and `lang === 'en'`.
6. No page or console error throughout.

**B3 — First visit by browser locale** (`a first visit follows the
browser's language`): two cases with an empty store and no pin,
- `test.use({ locale: 'fr-FR' })`: the Menu opens in French, `lang ===
  'fr'`;
- `locale: 'en-US'`: English, `lang === 'en'`.

**B4 — Labels come from the tables.** The test imports `en` and `fr` from
`src/ui/i18n/` (both are plain data; `fr.ts` imports only a type) and
asserts by their values, so rewording a label doesn't break the
scenario. It also asserts `fr.menu.testMode !== en.menu.testMode` once,
so the French check can't pass on an English table.

**B5 — No hook change.** Everything above uses the existing hook
(`buttonCount`, `buttonToCanvas`, `scenes`, `idle`) and
`page.evaluate` for `lang` and the store.

**B6 — The other scenarios are unchanged** and keep pinning English
through `startFromMenu`.

**B7 — Docs.** `README.md:36` says "four test-mode scenarios"; it
becomes "four test-mode scenarios and the language switch".
`CLAUDE.md`'s `npm run e2e` lines need no change.

## Interpretations

None of the rulebook. One choice:

- **"Covers" for the smoke-suite exception.** After this merges, a change
  whose live check is owed by the path rule alone and whose changed
  behaviour is the switch, the store, the locale default or the page
  `lang` can name `e2e/language.spec.ts` under `REVIEW-POLICY.md`'s
  exception. A change to how French text *looks* (wording, fit) is
  visual and still owes a person's check.

## Acceptance criteria

- **AC1** — `npm run e2e` runs five scenario files and passes; the new
  file holds the two tests of B2 and B3 (B3's two locales may be one
  parameterised test).
- **AC2** — mutation, run by `/review` against the new scenario:
  - `setLanguage` stops writing the store → B2 step 3 fails;
  - `resolveLanguage` ignores `navigator.language` → B3 French case fails;
  - `applyToPage` removed → the `lang` checks fail;
  - the Menu's switch handler stops calling `scene.restart()` → B2 step 2
    fails.
- **AC3** — `npm run e2e --repeat-each=5` on the new file passes 10/10
  (it mustn't add a flake to a suite that already has one).
- **AC4** — `npm run verify` green, lint ≤ 21 (the e2e folder is linted).

## Non-functional

- **Engine/presentation split, save format, undo, AI:** untouched.
- **Live check:** none owed by path (`e2e/**` only). `/review` runs the
  suite itself.
- **Time:** the new file should add a few seconds, not tens.

## Out of scope

- Changing `REVIEW-POLICY.md` so an agent-written scenario can stand in
  for new or visual behaviour (the grid's separate proposal).
- The save-load flake (its own fix intent, per the grid).
- Checking French wording or fit.

## Assumptions I made

- One file, two tests (the intent's open question): switch-and-reload
  shares a page; the locale default needs its own fresh context.
- The pin for B2 is written by `page.evaluate` after a first `goto` to a
  blank page on the same origin, then `goto('/')`; any equivalent
  one-shot write is fine.
- The flake isn't fixed first: this scenario saves nothing and loads
  nothing, so it doesn't touch the path that flakes. If it flakes itself,
  AC3 catches it.
