<!-- generated-by: heraklios/konmari@0.1.0 -->
# §80 KonMari record

outcome: kept
base: 3222c28

## Tidied
- c64476b — `src/ui/i18n/format.ts` — `estimateParts` built a nullable array and filtered it with a type guard; it now pushes each non-zero part, the pattern `dieModifierParts` uses two functions above in the same file. Same output; format.ts is not budgeted.

## Looked at and left
- `estimateAttackTotals` (`src/engine/combat.ts`): not a duplicate of `attackForceAgainst` (that one picks one value by distance; this sums both ways with no position) nor of `combat.ts:1072`'s `max(currentAttack, currentRangedAttack)` per unit. Left as is, also because its length must stay equal to the +24 budget line.
- `BoardScene.ts:2010`: one argument changed; `nameOf` is still used elsewhere in the scene, so nothing dead. The scene is at its 3172 ceiling and was not touched.
- `en.ts` / `fr.ts`: the three new messages sit beside their neighbours in the same shape; nothing to fold.
- `formatAttackLine`'s parameters `attackerUnits` (units) beside `targetNames` (names): the asymmetry is deliberate (only attackers need totals), so not renamed.
- `e2e/attack-log.spec.ts`: the helper `chooseCount` now counts `aloneLine`; its name is old but test files are edited only where a move forces it.
- `combat.test.ts`, `format.test.ts`, README: nothing dead or duplicated.

## Proposed refactor intents
- none
