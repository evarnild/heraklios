<!-- generated-by: heraklios/build-plan@0.1.0 -->
# §53 plan — The log says when the game autosaves, and shows the attack being built

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

An `Autosaved.` line after each confirmed autosave (spec B1). In the combat
phase, one log line after every click that changes the attack being built:
attackers and targets with both forces and, when not zero, the terrain and
river die modifier (B3-B6, B5a). The forces and the modifier come from a new
pure engine function that the roll's own breakdown also uses (B5). The text
lives in `src/ui/i18n/` (B8).

## Risks

- **Two computations drifting apart.** The preview must be the *same code*
  the roll uses, not a copy. `computeLandAttackDetail` calls the new function
  and adds only the die; AC1 compares them field by field.
- **Tests that pass whatever the code does.** The engine tests pin exact
  forces and modifiers (hill only when attacking from below, river added,
  worst terrain across two defenders), and the e2e asserts the exact line
  text, not "a line appeared".
- **Logging at the wrong moment.** The attack line goes at the end of each
  change site in `toggleAttacker`/`toggleDefender`, after the prune's own
  line, never on a refused click, an undo/redo, or a resolution (B4). A single
  helper `logAttackLine()` called from those sites, not from
  `refreshCombatHighlights` (which also runs in other paths).
- **The modifier wording duplicated.** `formatCombatOutcome` builds the parts
  inline today (`BoardScene.ts:2547-2556`); move that into one formatter both
  callers use, so the attack line and the report can't word it differently.
  The combat report's text must stay byte-identical (existing tests).
- **The lint cap (21).** `BoardScene.ts` already warns for file length and
  four long functions; adding a helper adds no warning, but keep each new
  function under 80 lines and don't grow `create` or `chooseExchangeSacrifice`.
  Never raise the cap; lower it in the same commit if a warning goes.
- **The async autosave.** `writeSave(...).then(ok => …)` resolves later, so
  `Autosaved.` may land after other lines (e.g. after "Game loaded"). That is
  accepted (spec Assumptions); the e2e waits for the line rather than
  expecting a position.
- **`noLiterals.test.ts`:** every new text goes through `messages()`.
- **Stale line citations:** re-check the lines below before launch.

## Verified against the codebase

Re-read on `main` at `d2d2ead`.

- `src/engine/combat.ts:143-…` — `LandAttackDetail` (attackForce,
  attackerForces, defenseForce, ratioLabel, crtColumnIndex, terrainModifier,
  terrainOnlyModifier, terrainModifierSource, terrainModifierSourceHex,
  riverCrossingApplied, rawDieRoll, modifiedDieRoll, result).
- `src/engine/combat.ts:266-272` — `attackForceAgainst(attacker, defenders)`.
- `src/engine/combat.ts:274-327` — `computeLandAttackDetail`: forces
  (`:279-283`), terrain loop with the "attacking from below" condition and the
  river flag (`:285-306`), `modifier` (`:307`), `modifiedDieRoll` (`:309`).
- `src/engine/combat.ts:353-359` — `describeLandAttack`.
- `src/engine/combat.test.ts:47`, `:60` — `makeUnit`, `makeState`;
  `:406-…` — the `describeLandAttack — audit fields` block (hills, marsh,
  river cases to mirror).
- `src/data/terrain.ts:105` — `RIVER_CROSSING`.
- `src/scenes/BoardScene.ts:989-994` — `autosave()`; called at `:866`,
  `:1128`, `:2876`.
- `src/scenes/BoardScene.ts:1429` — `log()`; `:1169` — `recordAction()`.
- `src/scenes/BoardScene.ts:1884-1928` — `toggleAttacker` (deselect branch
  `:1889-1895`, naval select `:1897-1910`, land add `:1925-1927`).
- `src/scenes/BoardScene.ts:1942-1954` — `pruneIllegalCombatSelections`.
- `src/scenes/BoardScene.ts:1956-2003` — `toggleDefender` (untarget
  `:1962-1969`, naval resolve `:1971-1980`, add `:2000-2002`).
- `src/scenes/BoardScene.ts:2027-2030` — `clearCombatSelection` (after a
  resolution; no line there, B4).
- `src/scenes/BoardScene.ts:2536-2587` — `formatCombatOutcome`, the modifier
  parts at `:2547-2556`.
- `src/ui/i18n/en.ts:193-196` — `actions.select/deselect/target/untarget`;
  `:258-260` — `log.terrainModifier`, `log.riverModifier`; `:261-…` —
  `log.combatReport`; `:320` — `saves.autosaveFailed`.
- `src/ui/i18n/format.ts` — the formatters (`formatArmyError`, …), each
  taking `m: Messages = messages()`; `format.test.ts` beside it.
- `src/ui/devHook.ts` — `logEntries()` (`LOG_MEMBERS`).
- `e2e/helpers.ts:17` — `MENU_CLOSE_COMBAT`; `:38` — `startFromMenu`;
  `e2e/attacks.spec.ts` — the combat route (select attacker, target, resolve).

## Subtasks

1. **The preview** (B5, B5a). In `src/engine/combat.ts` add
   `previewLandAttack(attackers, defenders): LandAttackPreview` returning
   `attackForce`, `attackerForces`, `defenseForce`, `terrainModifier`,
   `terrainOnlyModifier`, `terrainModifierSource`, `terrainModifierSourceHex`,
   `riverCrossingApplied`. Move the force and terrain code of
   `computeLandAttackDetail` into it; `computeLandAttackDetail` calls it and
   adds the ratio, die and result. Its doc comment says the preview is what
   the roll uses and why the modifier is a die modifier (spec
   Interpretations). AC1 tests in `combat.test.ts`. Commit.
2. **The text** (B1, B3, B5a, B6, B8). In `en.ts` and `fr.ts` add
   `saves.autosaved`, `log.attackWithTargets(attackers, atk, targets, def,
   modifier, parts)`, `log.attackChooseTarget(attackers)` and
   `log.attackCleared`. In `format.ts` add `dieModifierParts(preview, m)` (the
   code now at `BoardScene.ts:2547-2556`) and `formatAttackLine(attackerNames,
   targetNames, preview | null, m)`; make `formatCombatOutcome` use
   `dieModifierParts`, with the report text unchanged. AC2 tests in
   `format.test.ts` (each form, with and without the modifier: terrain only,
   river only, both; English and French). Commit.
3. **The scene** (B1, B4, B6). In `BoardScene.ts`:
   - `autosave()`: on `ok`, `this.log(messages().saves.autosaved)`;
   - a private `logAttackLine()` that logs `formatAttackLine(...)` for the
     current `attackGroup`/`defenderGroup` (land: the preview when there is a
     target; naval or no target: the attackers alone; empty: cleared);
   - call it at the end of: the deselect branch, the naval select, the land
     add (`toggleAttacker`), the untarget branch and the land add
     (`toggleDefender`); not on refusals, the naval resolve, undo/redo or
     `clearCombatSelection`.
   Check the lint count. Commit.
4. **The smoke scenario** (AC3). Extend `e2e/attacks.spec.ts` (or add
   `e2e/attack-log.spec.ts`, header naming §53): from `MENU_CLOSE_COMBAT`,
   wait for an `Autosaved.` entry; in the combat phase select the archers →
   `Attack: <name>, choose a target.`; target the enemy → the line with both
   forces (assert the numbers from the engine via the hook's state, or the
   known test-mode values); a refused click adds no attack line; deselect the
   attacker → `Attack cleared.`; no console errors. Run `npm run e2e`, all
   green. Commit.
5. **README.** One sentence in the log/combat section: the log shows the
   attack being built with its forces and die modifier, and each autosave.
   Commit, then the Progress entry and `status: in-review`.

## Tests

| Behavioural line | Test that fails if it is mutated |
| --- | --- |
| a force summed differently in the preview than the roll | AC1 field-by-field comparison with `describeLandAttack` |
| the "from below" condition dropped | AC1 hill case (bonus only from below) |
| the river flag dropped or always on | AC1 river case and open-ground case (modifier 0) |
| worst terrain → first defender's terrain | AC1 two-defender case (order swapped, as `:443-448` does) |
| `computeLandAttackDetail` not using the preview | AC1 equality plus the existing `describeLandAttack` tests |
| a formatter form or part wrong | AC2 exact strings |
| the report's modifier text changed | existing combat-report tests (`reports.test.ts` / `format.test.ts`) |
| `Autosaved.` missing or on failure | AC3 (`Autosaved.` entry); failure path by the live check |
| `logAttackLine` not called at a site, or called on a refusal | AC3 select, target, refused click, deselect |

The scene lines are proved by the e2e only; `/review` runs `npm run e2e`.

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS (apart from the owed live check after review).
- `npm run e2e` green, with the new assertions.
- **Live check (owed: `src/scenes/`, `src/ui/`, new behaviour):**
  1. In the worktree, `npm run dev -- --port 5253 --strictPort --host
     127.0.0.1`, open `http://127.0.0.1:5253/`.
  2. Start a 2-player hotseat game (or "Combat test mode"): `Autosaved.`
     appears; end a movement phase: it appears again at the next player's
     movement phase.
  3. In a combat phase, select two attackers, then two targets (one on a
     hill or across a river), remove one target, then an attacker: each line
     matches the board, with the die modifier when the hill or river applies.
     Resolve: the combat report's forces and modifier match the last line.
  4. Switch to French and repeat 3.
  5. Stop the dev server's save API (or run `npm run preview` without it) and
     see the failure line instead of `Autosaved.`

## Assumptions I made

- Function and message names (`previewLandAttack`, `formatAttackLine`,
  `dieModifierParts`, `saves.autosaved`, `log.attackWithTargets`,
  `log.attackChooseTarget`, `log.attackCleared`).
- The worktree's dev port is 5253 (5200 + 53).
- The attack line follows the prune's "Removed from the combat…" line
  because `logAttackLine` runs at the end of the branch that called the prune.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
