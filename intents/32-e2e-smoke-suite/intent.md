<!-- generated-by: heraklios/intent@0.1.1 -->
# §32 — Browser smoke suite for the game's scenes (`npm run e2e`)

**Type:** feature
**Originator:** me (Eric), following §30's recommendation
**Source:** [§30 findings → Recommendation](../30-browser-test-probe/findings.md#recommendation--build-a-narrower-version); probe code on branch `exp/30-browser-test-probe`

## Problem

`src/scenes/**`, `src/ui/**` and `src/map-editor/**` have no automated
tests. Since §28, every change there owes a manual live check before it can
merge: I start the dev server, pick a test-mode shortcut and click through
by hand. That's the right gate for anything new or visual, but most of those
checks repeat the same flows (move a unit, attack, a naval move, save and
load) and only catch a regression if I happen to try that flow. §30 showed a
browser test can drive these flows reliably (40 of 40 runs, no flakes), but
it's a throwaway probe on a branch that must never be merged as-is.

## Outcome

- `npm run e2e` runs a small Playwright suite against the dev server, separate
  from `npm run verify`, so `verify` stays fast and needs no browser.
- The suite covers the flows a live check repeats most often, each started
  from a `src/ui/testMode.ts` shortcut and checked through `GameState`:
  - Mode test → move a land unit one hex;
  - Mode test combat → one ranged attack and one melee attack;
  - a naval move with rotation;
  - save → load round-trip.
- Each scenario asserts which test mode it is in, so clicking the wrong Menu
  button fails (§30 review: swapping to "Mode test combat" still passed).
- A dev-only hook (`window.__heraklios`, under `import.meta.env.DEV`, absent
  from `vite build`) with a small typed surface: scene keys, read-only
  `GameState`, hex → pixel, HUD button label → pixel, and an "idle" signal
  (no AI turn, prompt or tween pending).
- `REVIEW-POLICY.md` → "Live checks" says when a passing `npm run e2e` can
  stand in for a live check, and when it can't (anything visual or new).

## Constraints

- No change to `src/engine/` or `src/data/`; the hook only reads engine state
  and calls existing engine functions (`reachableHexes`), as in the probe.
- The hook must not ship: `vite build` output contains no `__heraklios`.
- HUD buttons are found by label through the hook, not by coordinates copied
  from scene code (§30 findings, Q3 → Maintenance).
- Dice: combat and naval scenarios use a seeded `diceRng` so outcomes are
  reproducible; no scenario depends on a lucky roll.
- No whole-board golden screenshots (§30: they would break on every visual
  tweak). Small-region "did it change" checks are allowed.
- Port 5200+(id mod 100) = 5232 for its dev server, so it never collides with
  another session's.
- `test-results/` and `playwright-report/` go in `.gitignore`.
- Runs on this Windows machine; the one-off browser install (~720 MB in
  `%LOCALAPPDATA%\ms-playwright`) stays outside the repo.

## Type-specific questions

### Feature
- **Users:** the owner (fewer manual live checks) and every agent that
  changes scenes or UI (a check they can run before `/review`).
- **Rulebook basis:** digital-only — test infrastructure, no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - When may `npm run e2e` replace §28's live check? Only for a change whose
    owed check is fully covered by an existing scenario, and never for new
    or visual behaviour? Who decides — `/review`, or the owner each time?
  - Should `/review` run `npm run e2e` when the diff touches scenes or UI,
    and report it under "Verified myself"?
  - The "idle" signal: what does the scene expose for "no tween, prompt or
    AI turn pending", and does adding it touch `BoardScene.ts`?
  - Label → pixel for Phaser text objects: walk the scene's display list, or
    register buttons explicitly?
  - Which save/load path: `localStorage` only, or file export/import too?
  - Start from the probe branch (rebase `exp/30-browser-test-probe`'s code
    onto a new `feat/32-…` branch) or rewrite from scratch using it as
    reference?

## Assumptions I made

- Feature, not refactor or adjustment: it adds a dependency, a dev hook, a
  script and a policy change, with real design questions.
- The policy change makes this Reviewed tier (`REVIEW-POLICY.md` is on the
  Reviewed path list); left `review_tier` empty so the path table decides.
- A live check is owed on its own merge (it touches how the game starts in
  dev, `src/main.ts`, and runs the browser): the suite passing is evidence,
  but the owner should watch it run once.
- AI turns, drift prompts and retreat modals are out of the first version;
  §30 didn't measure them and each needs its own wait condition.
