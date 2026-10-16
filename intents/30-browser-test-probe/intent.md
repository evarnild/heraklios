<!-- generated-by: heraklios/intent@0.1.1 -->
# §30 — Probe: can a browser test drive the game's scenes?

**Type:** experiment
**Originator:** me (Eric) — split out of §28's scope
**Source:** [§28 spec → Out of scope](../28-live-checks-and-merge-rule/spec.md#out-of-scope), second bullet

## Problem

`src/scenes/**`, `src/ui/**` and `src/map-editor/**` have no automated tests.
`BoardScene.ts` alone is about 3,000 lines of click handling, prompts and
naval UI. §28 covers the gap with a manual live check before every merge
that touches them, which is the right stopgap but costs me a browser session
each time and only checks what I think to try. I don't know whether a
browser-test harness could take some of that over: Phaser draws to a canvas,
so ordinary "find the button and click it" tests may not work, and the
effort may not pay off for a hobby project.

## Outcome

A written answer, in this intent's folder, to:

- Can a headless browser (Playwright, or Vitest browser mode) start the game
  through a `src/ui/testMode.ts` shortcut and reach a populated board,
  reliably, on Windows?
- Can it perform one real interaction (select a unit, move it one hex) and
  assert the result, either through the DOM/canvas or through a test-only
  hook that exposes `GameState`?
- What would it cost: new dependencies, run time added to `npm run verify`
  (or a separate script), flakiness seen over 20 runs?
- A recommendation: build it (a follow-up feature intent with the design),
  build a narrower version, or drop it and keep §28's live check.

## Constraints

- **Containment:** a branch `exp/30-browser-test-probe` that is never merged
  as-is. Any new dependency stays on that branch. No change to rule code in
  `src/engine/` or `src/data/`.
- A test-only hook into the running game (for example `window.__heraklios`)
  is allowed on the branch, to learn whether one is needed; whether it ships
  is the follow-up's decision.
- Time-box: one session of work. If the first approach fails, record why and
  try at most one other.
- Must run on this Windows machine; Linux/macOS not required for the probe.

## Type-specific questions

### Experiment
- **Question:** can a browser test drive a scene to a checkable result,
  reliably and cheaply enough to replace part of the manual live check?
- **Containment:** `exp/30-browser-test-probe`, never merged into rule code;
  dependencies stay on the branch.
- **What happens to the result:** `intents/30-browser-test-probe/findings.md`
  with the answers above and the recommendation, merged alone (an
  `intents/**`-only change, Automated tier). A "build it" recommendation
  becomes a new feature intent; the probe code is thrown away or used as
  that intent's starting point.

## Assumptions I made

- Experiment, not feature: the open question is feasibility, and a feature
  spec written before knowing whether the canvas can be driven would be
  guesswork.
- Playwright first, because it is the common choice for canvas apps and
  drives a real Chromium; Vitest browser mode second, because it would reuse
  the existing runner.
- §28 does not depend on this; it can run in parallel (`npm run spawn -- 30`).
