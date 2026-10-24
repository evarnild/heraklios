<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §57 plan — Every "continue" in an elephant drift shows something

Intent: [intent.md](intent.md)

## Goal

`resolveElephantDrift` stops awaiting `hooks.onStep` after events that show
nothing: the input requests `directionRollNeeded`, `combatRollNeeded`,
`retreatResolutionNeeded`, and the refused-direction event `directionForbidden`.
Every remaining pause follows a narrated line, a redraw, the direction arrow
or a combat report. Dice order, event order, results and the no-`onStep` path
are unchanged.

## Risks

- Drift-machine fall-through: the `continue`/skip must only skip the `onStep`
  await, never the `needsInput` handling after the event loop.
- A test that passes whatever the code does: the new invariant test must
  fail on the unfixed driver (confirm failing-first before the fix).
- Stale expected traces: the old `EXPECTED_*` arrays must change by exactly
  the silent `onStep` entries, nothing else.
- Lint cap: `drift.ts` is already over 500 lines; add no new warning (the
  loop body is already inside the function; keep the change to a few lines).

## Verified against the codebase

Re-read on `main` at `4d11836`.

- `src/engine/drift.ts:95-114` — event union incl. `directionRollNeeded`, `directionForbidden`, `combatRollNeeded`, `retreatResolutionNeeded`.
- `src/engine/drift.ts:241-243` — `directionForbidden` is pushed, then a new `directionRollNeeded`.
- `src/engine/drift.ts:566-617` — switch has no case for those four kinds (no hook fires).
- `src/engine/drift.ts:619-623` — `if (hooks.onStep) await hooks.onStep();` after every event.
- `src/engine/drift.ts:625-660` — `needsInput` handling after the loop, untouched.
- `src/engine/drift.test.ts:21-60` — `EXPECTED_MOVE_AND_STOP`, `EXPECTED_DESTROYED`, `EXPECTED_REPELLED` contain the doubled `onStep`.
- `src/ui/i18n/format.ts:21-44` — `formatDriftEvent` returns null for these kinds (so narrating `directionForbidden` would need new en/fr text; not done).

## Subtasks

1. Failing-first test in `drift.test.ts`: over the move-and-stop, destroyed and repelled scenarios (and any other scenario in the file that records a hook trace), assert each `onStep` is preceded, since the previous `onStep`, by at least one of `onNarrate`, `onRender`, `onDirectionRolled`, `onCombat`. Run it, see it fail at the second `onStep`.
2. In `resolveElephantDrift`, after the switch, skip the `onStep` await for the silent kinds (a small `const SILENT_PAUSE_KINDS` set or inline check). `directionForbidden` is chosen to be silent (no pause), not narrated: avoids new i18n text and keeps the engine/presentation split; the pause for the following events is unaffected. Update the nearby comments (`onStep` doc comment at `:158-172` if it claims "after every event", and the comment at `:631-636`).
3. Update the `EXPECTED_*` traces to one `onStep` per visible beat.

## Tests

- New invariant test (subtask 1): fails if any silent event pauses; mutant "remove the skip" is killed by it and by the updated traces.
- Updated `EXPECTED_*` traces pin exact order: mutant "skip `onStep` for `moved` too" is killed by them.
- Existing "identical event trace and stats" test (no hook vs hook) must stay green: dice and event order unchanged.
- Existing fuzz/self-play tests unchanged (no `onStep`).

## Validation

- `npm run verify` green
- `npm run check:intent` PASS
- `npm run e2e` if the suite has a drift scenario (no `src/scenes`/`src/ui` change is planned, so not required by path).
- Live check: engine only, no scene change planned; the review decides whether one is owed. If it is: combat test mode, force an elephant drift, click "continue" at each pause and confirm each click adds a log line, arrow or combat report.

## Assumptions I made

- `directionForbidden` becomes a no-pause event rather than a narrated one (the intent allows either).
- No `BoardScene` change is needed: its `onStep` button just receives fewer calls.
- No `follows_up` id (the cause predates `intents/`).

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### Phase 1 (2026-10-24)

- Commits: see `git log` on `fix/57-drift-silent-continue` (test+fix, then bookkeeping).
- Shipped: failing-first invariant test (failed at pause #3 of move-and-stop before the fix), `SILENT_PAUSE_KINDS` skip in `resolveElephantDrift` (`directionRollNeeded`, `combatRollNeeded`, `retreatResolutionNeeded`, `directionForbidden`), `onStep` doc and README updated, `EXPECTED_*` traces lose exactly the doubled `onStep`.
- Tests: 61 files, 1110 tests green (`npm run verify`).
- Divergences: none. `npm run e2e` not run (no scene/ui change).
