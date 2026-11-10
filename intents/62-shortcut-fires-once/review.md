<!-- generated-by: heraklios/review@0.2.0 -->
# §62 review — One Ctrl+Z or Ctrl+Y press undoes or redoes one step, even on a slow frame

verdict: attest
tier: attested
reviewed-commit: 0292a8c
round: 2
sampled: yes
run: auto
live-check: owed

**Tier:** Attested, set by the path table (`src/scenes/**`, `src/ui/**`, `e2e/**`). No `review_tier` is set, and no finding raises the tier.

**Verdict:** `attest`.
- Round 1's MEDIUM (surviving mutant M8) is resolved by `af0ccd6`.
- Round 1's LOW (no test covers Space or Enter) stays open and acceptable.
- There are no new findings.

`check:intent` fails only on the owed live check. That is the owner's to clear, not rework.

**Sampled:** this is the 6th attested auto-run change, so a full read of the diff is due after the merge (`REVIEW-POLICY.md`, "Against rubber-stamping").

**What changed since round 1** (`git diff 5100c7d..0292a8c`):
- `e2e/undo-shortcuts.spec.ts` gains 6 lines and loses none: a bare-Y burst after the first Ctrl+Z, while the redo stack is not empty.
  - On the Board, `count('Redone:')` must stay 0.
  - In Placement, `placed()` must stay `base + 1`.
- The intent files: the Progress entry below the marker, `auto_round`, and round 1's report.

No `src/` file changed, and no existing assertion was weakened.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The rework does exactly what round 1 asked; Progress was appended below the marker only |
| 2 | Type check | pass for type and scope. The only error is the owed live check |
| 3 | Rulebook fidelity | not run: no game rule changed (input handling only) |
| 4 | Tests prove it | pass. M8 is now killed in both scenarios. M10 and M15 still survive, which is round 1's LOW, allowed by the plan |
| 5 | Boundary and conventions | pass (no `src/` change since round 1) |
| 6 | Numbers in prose | pass. The rework entry's numbers and its M8 result reproduce |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass: lint 21, cap 21, no new dependency |
| 9 | Repository-specific footguns | pass (none apply) |
| 10 | Architecture | pass (unchanged since round 1) |

## Type check
```
type-check: FAIL (intent 62, fix)
  error: A live check is owed and not recorded. Do the steps in intents/62-shortcut-fires-once/review.md → ## Live check, then set live_checked: <date> in intents/62-shortcut-fires-once/metadata.yml.
  note:  7 file(s), 245 line(s) changed outside intents/.
```
The only error is the owed live check. It clears when the owner records `live_checked` (review skill, step 1's exception).

## Findings
None new.

### Round-1 findings, round-2 status
| Finding | Status |
| --- | --- |
| MEDIUM `src/ui/shortcutKeys.ts:22`, M8 survives | Resolved by `af0ccd6`. M8 is now killed in both scenarios, by "a bare Y redoes nothing" |
| LOW `src/scenes/BoardScene.ts:826-827`, `src/ui/shortcutKeys.ts:29`: no test covers Space or Enter | Open and acceptable. M10 and M15 still survive. The plan permits it; the `onceEach` guard is unit-tested; `onKeyOnce`'s registration is covered through Escape (M11); and the live check has an optional Space step |

## KonMari check
Not run. The step runs only when `plan_approved` falls after §61's merge date (`8190d41`, 2026-11-10; `/auto` step 5a). §62's `plan_approved` is 2026-11-10, which is on that date, not after.

## Not checked
- **Space and Enter on a real drift pause:** no scenario reaches one (M10 and M15 survive).
- **Real hardware keys and auto-repeat:** the e2e burst is synthetic. That real key events arrive as distinct objects comes from the DOM spec and Phaser's source.
- **Cmd (metaKey) forms:** no test presses Cmd+Z or Cmd+Y.
- **How native DOM events interleave in a real browser:** not observed.

## Live check
- **owed:** rule 1, because the diff touches `src/scenes/**` and `src/ui/**`. The smoke suite cannot stand in: this is a behaviour fix, and no scenario covers Space or Enter.
- **steps:**
  1. In `C:/Users/eric/src/heraklios-wt/62-shortcut-fires-once`, run `npm run dev -- --port 5262 --strictPort --host 127.0.0.1` and open http://127.0.0.1:5262/.
  2. **Board:** Menu → "Combat test mode (units face to face, 2 hexes)" → End phase to reach combat.
     - Select a unit, then click an enemy target.
     - Press Ctrl+Z once, then Ctrl+Shift+Z once, then Ctrl+Z, then Ctrl+Y.
     - With an undo available, press Z alone. After a Ctrl+Z, with a redo available, press Y alone.
     - Open the Tables panel and press Escape.
  3. **Placement:** Menu → 2 players → "Use default army" and "Confirm army" for both seats → Placement.
     - Place two units.
     - Press Ctrl+Z once, then Y alone, then Ctrl+Shift+Z, then Ctrl+Z, then Ctrl+Y.
  4. **Optional:** if an elephant drift pause comes up, press Space once.
- **you should see:**
  - **Board:**
    - each Ctrl+Z adds exactly one "Undone: …" line, and the selection steps back once;
    - each Ctrl+Shift+Z or Ctrl+Y adds exactly one "Redone: …";
    - no "Nothing to undo/redo." appears;
    - a bare Z or a bare Y changes nothing;
    - Escape closes the Tables panel.
  - **Placement:**
    - each Ctrl+Z takes exactly one unit off, and each redo puts exactly one back;
    - a bare Y puts nothing back.
  - **Optional drift step:** one Space press continues the drift exactly one step.

## Verified myself vs. taken on trust
- **Coordinator, re-run (worktree at `0292a8c`):**
  - `npm run verify`: exit 0; 80 test files, 1412 tests passed; 0 errors, 21 warnings, cap 21.
  - `npm run check:intent`: exit 1. The only error is the owed live check (output above).
  - `npm run e2e`: exit 0, 22 passed. Port 5232 was free beforehand.
  - **M8**, against `e2e/undo-shortcuts.spec.ts`: KILLED, 2 failed.
    - On the Board: "a bare Y redoes nothing", expected 0, received 1.
    - In Placement: "a bare Y redoes nothing", expected 1, received 2.
    - This matches the reviewer and the implementer.
  - **M10**, against `undo-shortcuts` and `rules-panel`: SURVIVED (3 passed). It matches.
  - **M15**, against the full e2e suite: SURVIVED (22 passed). It matches.
  - Each mutant was backed up by copy, its change asserted, and the file restored by copy. `git status --short` was clean after each.
  - `npm run sdlc:scan -- --sample-due auto --exclude 62`: "nth attested auto change = 6, every 3, sampled: yes".
- **Reviewer:**
  - the rework diff, which is additions only;
  - verify, check:intent and e2e, with the same numbers;
  - M8 killed, with the same messages.
- **Taken on trust from round 1:** these lines are unchanged since `5100c7d`.
  - the 13 other killed mutants;
  - the failing-first run against `main`'s scene code;
  - the Phaser source reading;
  - the size baseline.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 5100c7d
- round: 1
- sampled: no
- run: auto
- live-check: owed

**Tier:** Attested, set by the path table (`src/scenes/**`, `src/ui/**`, `e2e/**`). No `review_tier` is set, and no finding raises the tier.

**Verdict:** `rework`, with 1 MEDIUM ("Needs rework:") and 1 LOW ("Worth a look").
- The fix is right: a guard by event identity, checked against Phaser 3.90.0's source.
- The new scenario fails on `main`'s scene code and passes on the branch.
- One mutant survives: a bare Y would redo, and no test notices.

**How this round ran:**
- The `heraklios-reviewer` agent ran the ten passes and 16 mutants (M1–M15, plus M3b and M4b).
- The coordinator re-ran verify, check:intent, the full e2e suite and the three survivors. Every result matches.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The diff is plan subtasks 1–4 and nothing more. The Z/Y logic moved verbatim, and Escape, Space and Enter call the same functions as before, now wrapped in `onceEach` |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: no game rule changed (input handling only); undo and redo semantics are unchanged |
| 4 | Tests prove it | findings (1): M8 survives |
| 5 | Boundary and conventions | pass. `onceEach` is pure and tested. Undo boundaries are untouched |
| 6 | Numbers in prose | pass. Progress numbers reproduce: 80/1412, lint 21, baseline 3179→3173 and 581→575, e2e 22/22, and the failing-first counts |
| 7 | Documentation | pass. `README.md:206-208` already documents the shortcuts; the fix restores that documented behaviour |
| 8 | Guardrails and hygiene | pass: lint 21, cap 21, no new dependency |
| 9 | Repository-specific footguns | pass (none apply) |
| 10 | Architecture | pass. `onceEach` is pure, tested and does one job. `shortcutKeys` removes the duplicated Z/Y wiring and imports Phaser by type only. Both budgeted scenes shrink |

**The cause, re-derived in Phaser 3.90.0:**
- `KeyboardManager.js:194/214` pushes each DOM event onto `queue` and emits `MANAGER_PROCESS` (`:196/:216`).
- `KeyboardPlugin.js:220` subscribes `update` to it. `update` (`:731`) walks the whole queue from the start and emits `queue[i]`, the same object each time.
- The bailout at `:776` compares only with the event processed just before. `postUpdate` clears the queue once per step (`:262-264`).

A genuine second press, or an auto-repeat, is a new DOM event object, so it passes the guard. These shortcuts register no `Key` object, so the `!repeat` gate at `:793` does not apply, and auto-repeat behaviour is unchanged.

## Type check
```
type-check: PASS (intent 62, fix)
  note:  7 file(s), 239 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/ui/shortcutKeys.ts:22`: surviving mutant M8.
  - **The mutant:** `if (event.ctrlKey || event.metaKey) actions.redo();` becomes `actions.redo();`. It passes `e2e/undo-shortcuts.spec.ts` (2/2) and every other test.
  - **Why it matters:** the plan's "a bare Z changes nothing" case has no Y counterpart, and only Ctrl+Y or Cmd+Y may redo.
  - **Needs rework:** in `e2e/undo-shortcuts.spec.ts`, add a bare-Y burst right after a Ctrl+Z, while the redo stack is not empty, in both scenarios. On the Board, the `Redone:` count must stay the same; in Placement, `placed()` must stay the same. Re-run M8 to confirm it is killed.
- **LOW** `src/scenes/BoardScene.ts:826-827`, `src/ui/shortcutKeys.ts:29`: no test covers Space or Enter.
  - **Mutants:** M10 (`onKeyOnce` without `onceEach`) and M15 (the `keydown-SPACE` registration deleted) both survive. M15 survives the full e2e suite (22/22).
  - **Why it's allowed:** the plan permits the M10 survivor and records it under Not checked.
  - **Possible later test:** `startFromMenu(..., seed)` seeds the dice, and the close-combat shortcut fields elephants, so a seeded drift pause may be reachable for a later scenario. Worth a look.

## Not checked
- **Space and Enter on a real drift pause:** no scenario reaches one (M10 and M15 survive).
- **Real hardware keys:** the e2e burst is synthetic (`dispatchEvent` in one task, with `keyCode` defined by hand). That real key events and auto-repeat arrive as distinct objects comes from the DOM spec and Phaser's source, not from a run.
- **Cmd (metaKey) forms:** no test presses Cmd+Z or Cmd+Y.
- **The interleaving between native DOM events in a real browser:** not observed.

## Live check
- **owed:** rule 1, because the diff touches `src/scenes/**` and `src/ui/**`. The smoke suite cannot stand in: this is a behaviour fix, and no scenario covers Space or Enter.
- **steps:**
  1. In the worktree, run `npm run dev -- --port 5262 --strictPort --host 127.0.0.1` and open http://127.0.0.1:5262/.
  2. **Board:** Menu → "Combat test mode (units face to face, 2 hexes)" → End phase to reach combat.
     - Select a unit, then click an enemy target.
     - Press Ctrl+Z once, then Ctrl+Shift+Z once, then Ctrl+Z, then Ctrl+Y.
     - Press Z alone and Y alone, with something available to undo and redo.
     - Open the Tables panel and press Escape.
  3. **Placement:** Menu → 2 players → "Use default army" and "Confirm army" for both seats → Placement.
     - Place two units.
     - Press Ctrl+Z once, then Ctrl+Shift+Z, then Ctrl+Z, then Ctrl+Y.
  4. **Optional:** if an elephant drift pause comes up, press Space once.
- **you should see:**
  - **Board:**
    - each Ctrl+Z adds exactly one "Undone: …" log line, and the selection steps back once;
    - each Ctrl+Shift+Z or Ctrl+Y adds exactly one "Redone: …";
    - no "Nothing to undo/redo." appears;
    - a bare Z or a bare Y does nothing;
    - Escape closes the Tables panel.
  - **Placement:** each Ctrl+Z takes exactly one unit off, and each redo puts exactly one back.
  - **Optional drift step:** one Space press continues the drift exactly one step.

## Verified myself vs. taken on trust
- **Coordinator, re-run (worktree at `5100c7d`):**
  - `npm run verify`: exit 0; 80 test files, 1412 tests passed; 0 errors, 21 warnings, cap 21.
  - `npm run check:intent`: exit 0, PASS (output above).
  - `npm run e2e`: exit 0, 22 passed.
  - **M8**, against `e2e/undo-shortcuts.spec.ts`: SURVIVED (2 passed). It matches the reviewer.
  - **M10**, against `undo-shortcuts` and `rules-panel`: SURVIVED (3 passed). It matches.
  - **M15**, against the full e2e suite: SURVIVED (22 passed). It matches.
  - Each mutant was backed up by copy, the change was asserted with `git diff`, and the file was restored by copy. `git status --short` was clean after each.
- **Reviewer:**
  - **Failing-first:** with `main`'s two scene files copied into the worktree, `undo-shortcuts.spec.ts` fails 2/2. On the Board it expected 1 "Undone:" and got 2; in Placement it expected 1 unit placed and got 0.
  - The Phaser source read cited above.
  - **Mutants killed:**
    - M1 and M2 (`onceEach` dropped around Z and around Y);
    - M3, M3b, M4 and M4b (`onceEach` itself);
    - M5, M6 and M7 (the Z handler's logic);
    - M9 (Y runs undo);
    - M11 (`onKeyOnce` registers nothing; killed by the `rules-panel` Escape scenario);
    - M12, M13 and M14 (the scene wiring).
  - The baseline is byte-identical to `node scripts/size-budget.mjs`.
  - Sampling, from `sdlc:scan`: this would be the 6th attested auto change, so it is due once a round attests. It is recorded `no` while the verdict is `rework`.
- **Taken on trust:**
  - that the dispatched burst reproduces what real slow-frame hardware input does (§55's diagnosis);
  - the implementer's one-off `save-load.spec.ts` failure, which did not recur in four full runs.
