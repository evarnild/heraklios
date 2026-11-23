<!-- generated-by: heraklios/review@0.2.0 -->
# §80 review — The attack line shows the attackers' total before a target is chosen

verdict: attest
tier: attested
reviewed-commit: bfd28399e5a9ba44cfeb54188a305d6adb0a6fca
round: 1
sampled: no
run: auto
live-check: owed

- **Tier: Attested.** The path table set it from `src/engine/combat.ts`
  (not a Reviewed engine path), `src/ui/**`, `src/scenes/**`, `e2e/**`,
  `scripts/size-baseline.json` and the README. This is a digital-only log aid,
  not a new rulebook rule, and no finding is CRITICAL or HIGH.
- **Sampled: no.** `npm run sdlc:scan -- --sample-due auto --exclude 80`, run
  in the main checkout, printed `nth attested auto change = 13, every 3,
  sampled: no`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: plan subtasks 1–3 and nothing more. The one divergence (subtasks 1 and 2 in one commit) is recorded in Progress |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass: no rule involved. It reuses `currentAttack`/`currentRangedAttack` (`state.ts:93-138`); interpretations at `combat.ts:274-284`, `en.ts:314`, `fr.ts:297` |
| 4 | Tests prove the rule | pass: 26/29 vitest mutants killed, plus 1 e2e mutant. The 3 survivors are shown equivalent below |
| 5 | Boundary and conventions | pass: totals in the engine with tests; the formatter only chooses words; the scene change is one argument; no `GameState` or history change |
| 6 | Numbers in prose | pass: `combat.ts` 1111 → 1135 (+24, equal to the budget line); `BoardScene.ts` 3172; the README example matches `units.ts` |
| 7 | Documentation | pass: README `:772-779` |
| 8 | Guardrails and hygiene | pass: lint 0 errors and 19 warnings (cap 19) |
| 9 | Repo footguns | not applicable |
| 10 | Architecture | pass: principles 5, 6, 8 and 15. It deliberately does not reuse the position-dependent `attackForceAgainst` |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 80, feature)
  note:  10 file(s), 180 line(s) changed outside intents/.
```

## Findings
- **LOW** `e2e/save-load.spec.ts:86` (not part of this change): the reviewer's
  first full `npm run e2e` failed 1/32. The test "the loaded game equals the
  one saved" saw `test-u1` at `q:2, movementLeft:2` instead of `q:1,
  movementLeft:3`. It passed alone, and a second full run gave 32/32.
  - This diff touches neither save/load nor movement. It is the known
    save-load flake, also seen during §81's build.
  - Worth a look: the load wait (it waits on `scenes().includes('Board')`,
    which is already true) is a likely race and worth its own fix intent.

No finding needs rework.

## Not checked
- **The live check is owed.** Only a live run shows the line in the in-game
  log: its wrapping, the `~` glyph, and the French accents in the log font.
- **The French line** is covered by unit tests only; `attack-log.spec.ts`
  runs in English.
- **The two-attacker e2e line** is built with `formatAttackLine` and checked
  with `/~.*~/`, as the plan specifies. The exact numbers are pinned in
  `combat.test.ts` and the wording in `format.test.ts`.
- **No direct scene mutant.** `BoardScene.ts:2010` changed shape (names →
  units), so a revert does not type-check. `attack-log.spec.ts` covers the
  wiring.
- **M1, M2 and M10 are equivalent by construction, not by test.**
  - A future roster edit could make M1 or M2 observable: a non-melee unit
    with attack > 0, or a land unit whose `currentRangedAttack` is non-zero
    while `rangedAttack` is 0.
  - A test comment records this (`combat.test.ts:1454`).

## Live check
- **Owed** under rule 1: the change touches `src/scenes/BoardScene.ts` and
  `src/ui/i18n/{format,en,fr}.ts`, and it is new behaviour.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/80-attack-sum-before-target`, run
     `npm run dev -- --port 5280 --strictPort --host 127.0.0.1` and open
     http://127.0.0.1:5280/.
  2. In English, choose "Combat test mode (units face to face, 2 hexes)",
     then click "End phase" to reach the combat phase.
  3. Click your Archers (west row, r=3). The log shows `Attack: Archers
     (ranged ~2), choose a target.`
  4. Click your Infantry-archers. The log shows `Attack: Archers,
     Infantry-archers (melee ~2, ranged ~4), choose a target.`
  5. Click the Infantry-archers again. The log shows `Attack: Archers (ranged
     ~2), choose a target.`
  6. Click an enemy two hexes from the archers. The line shows the exact
     force with no `~`, for example `Attack: Archers (2) → <target>
     (<defence>)…`.
  7. Click that enemy again. The `(ranged ~2), choose a target.` line comes
     back.
  8. Click the Archers. The log shows `Attack cleared.`
  9. Click your Galleys. The log shows `Attack: Galleys, choose a target.`
     with no totals. Click again to get `Attack cleared.`
  10. Optional: a cavalry unit that charged this turn shows its doubled
      melee.
  11. Back on the Menu, switch to Français, start "Combat test mode", end the
      movement phase, and click the Archers. The log shows `Attaque : Archers
      (distance ~2), choisissez une cible.`
  12. Add the Fantassins-Archers. The log shows `Attaque : Archers,
      Fantassins-Archers (mêlée ~2, distance ~4), choisissez une cible.`
- **You should see:**
  - `~`-marked totals only before a target, with zero parts left out;
  - no `~` once a target is picked;
  - no totals for a ship;
  - correct French accents;
  - the line fits the log.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** the surviving mutants on `src/engine/combat.ts`.
  Each was backed up and restored by copy and run against the full vitest
  suite.
  - M1 (`meleeCapable` filter dropped): 1679 passed, so it survived.
  - M2 (`rangedAttack > 0` filter dropped): 1679 passed, so it survived.
  - M10 (naval guard `some` → `every`): 1679 passed, so it survived.
  - `git status --short` was clean afterwards. All three match the reviewer.
- **Coordinator, re-run:** `npm run verify` at bfd2839. Exit 0, lint 0 errors
  and 19 warnings (cap 19), 96 files, 1679 passed and 2 skipped. Matches.
- **Coordinator, re-run:** `npm run check:intent`. PASS. Matches.
- **Coordinator, re-run:** `npm run e2e`. 32 passed (1.0m). Matches the
  reviewer's second run.
- **Reviewer:**
  - verify, check:intent, and e2e twice (31/1, then 32/32).
  - 29 vitest mutants (M1–M11, F1–F9, E1–E8): 26 killed, with M1, M2 and M10
    surviving as equivalent.
  - M5 also run under e2e: killed by `attack-log.spec.ts:103`.
  - Equivalence evidence from `units.ts`, `state.ts:131-138` and
    `BoardScene.ts:1966-1979`.
  - `git merge-tree` against main is clean, with both `combat.ts: 1135` and
    `PlacementScene.ts: 526` in the merged baseline.
  - Sampling.
- **Taken on trust:**
  - the implementer's account of its own interim e2e failure;
  - the owner's "distance" wording as recorded;
  - everything visual.
