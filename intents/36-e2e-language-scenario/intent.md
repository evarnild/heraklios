<!-- generated-by: heraklios/intent@0.1.2 -->
# §36 — A smoke scenario for the language switch

**Type:** feature
**Originator:** me (Eric), from §35's review
**Source:** `intents/35-game-languages/review.md` round 1 → "Live check" →
"Could be an e2e scenario"; owner, 2026-10-20: "e2e language scenario
should be a follow-up intent"

## Problem

§35 makes the game playable in English or French, chosen on the Menu and
remembered in the browser. Nothing automated checks that choice. The four
smoke scenarios pin English before the page loads (§35 B11), so they never
see French, the switch, the stored choice or the browser-locale default.
Today only a live check by the owner shows them, and every later change to
the Menu, `src/ui/i18n/` or a scene owes that check again for behaviour a
script could prove.

## Outcome

- `npm run e2e` has a `language` scenario that, by real clicks:
  - clicks **Français** on the Menu and sees a French Menu label and
    `document.documentElement.lang === 'fr'`;
  - reloads and is still in French;
  - starts Test mode and finds a French line in the Board's log;
  - switches back to English the same way.
- A first visit with an empty store and a French browser locale
  (Playwright `locale: 'fr-FR'`) opens in French; with `en-US`, English.
- The scenario is named in `REVIEW-POLICY.md`'s sense: a later change whose
  only live-check reason is the path rule, and whose changed behaviour this
  scenario covers, can use the smoke-suite exception for the switch itself.
  Fit and the quality of the French stay a person's check.

## Constraints

- **After §35 merges.** It tests §35's behaviour and labels.
- Builds on §32's suite: real canvas clicks, the dev-only
  `window.__heraklios` hook, port 5232, `startFromMenu`. The other four
  scenarios keep pinning English (§35 B11); this one must not leave French
  stored for them (each Playwright test has its own context, so it
  shouldn't, but the spec checks).
- The hook may need to expose the current language or the Menu switch's
  position; any hook change stays dev-only (§32's global setup checks the
  production build has none).
- Tests and `e2e/` only, plus at most a small dev-hook addition: no change
  to game behaviour.
- No new dependency.

## Type-specific questions

### Feature
- **Users:** the owner and `/review`: fewer owed live checks for language
  behaviour.
- **Rulebook basis:** digital-only.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  - Which French text to assert: a fixed label from `fr.ts`, read from the
    table (robust to rewording), or typed in the test (catches a table
    edit)?
  - How to find the switch buttons: by label through the hook, like the
    other Menu buttons, or a dedicated hook field?
  - One scenario or two (switch-and-reload; first visit by locale)?
  - Does the save-load flake (§33, §35 reviews) need fixing first, so a
    new scenario isn't added to a suite that fails intermittently?

## Assumptions I made

- **Feature, not adjustment:** a new scenario plus helpers is likely over
  60 lines, and it has design questions.
- Changing `REVIEW-POLICY.md` so an agent-written scenario can stand in for
  new or visual behaviour is out of scope: that is the separate policy
  intent the 2026-10-20 grid proposes.
