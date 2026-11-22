<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §80 plan — The attack line shows the attackers' total before a target is chosen

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (accepted 2026-11-22)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

While a land attack has attackers and no target, its log line carries what
the group could bring each way, marked as an estimate:
`Attack: Infantry, Infantry-archers (melee ~4, ranged ~2), choose a target.`
(French `mêlée ~4, distance ~2`). The totals come from a new pure engine
function, `estimateAttackTotals`, beside `attackForceAgainst` in
`src/engine/combat.ts`. A part that is 0 is left out (B5). Ships and the
line with a target stay as they are (B4, B6). The scene changes one
argument at `BoardScene.ts:2010` and grows by no line (AC4).

## Risks

- **Tests that pass whatever the code does.** Two filters in the new
  function, `meleeCapable` and `rangedAttack > 0`, are equivalent mutants
  with today's roster. No non-melee type has `attack > 0` (only `archers`,
  `attack: 0`), and a unit with `rangedAttack: 0` adds 0 anyway. The spec
  keeps them on purpose ("the filter states the meaning"). The Tests table
  says so, and no test claims to kill them. Every other line has a test
  that fails if it is mutated.
- **The size budget.** `src/engine/combat.ts` sits at its ceiling (1111 at
  `bf7e2a1`), and the spec puts the function there. It grows by exactly 24
  lines (the text in subtask 1), so the plan carries a `budget:` line and
  subtask 1 rewrites the baseline (`npm run size:baseline -- --write`).
  `checkBudget` rule 5 fails a ceiling that sits above the file. If the
  implementer writes a shorter function, the baseline still has to equal
  the file. The `budget:` line then overstates the growth, which the
  checker accepts (`l.n >= growth`), but the Progress entry must say so.
  A longer function needs a plan amendment.
- **`BoardScene.ts` at 3172.** The edit is net zero. `:2010` keeps one line,
  and the stale doc comment at `:2005-2006` is reworded into the same 3
  lines (subtask 2). A reworded comment that wraps to a 4th line breaks
  AC4. `npm run check:intent` catches that.
- **The lint cap** (19 on `main`, 18 once §79 merges). The change adds no
  warning. `combat.ts` already carries its one `max-lines` warning, and the
  new functions are short and flat. The cap is not touched. If §79 merges
  first, rebase onto the lowered cap, and do not raise it.
- **Signature change across the type-checked tree.** `formatAttackLine`'s
  first parameter changes from names to units. `tsconfig.json` includes
  `e2e`, so the scene, `format.test.ts` and `e2e/attack-log.spec.ts` all
  break `tsc -b` until they are updated. All three go in one commit
  (subtask 2), or `verify` goes red.
- **Language of the names.** The scene's `nameOf` (`BoardScene.ts:3158`)
  uses the current language. `formatAttackLine` will use `unitNameIn(m, …)`,
  and `m` defaults to `messages()`, so the scene gets the same text. Tests
  pass `en`/`fr` explicitly.
- **Stale line citations.** Every citation below was re-read at `bf7e2a1`.
  §73 and §79 are open. If either merges first, re-check `BoardScene.ts`
  `:2003-2011`, and re-check `combat.ts:266-272` before inserting.
- **§73 (BoardScene on the session)** will rewrite how BoardScene settles
  combats. It does not touch `logAttackLine` or `formatAttackLine`: its plan
  names `combat.ts:93`, `:798`, `:923` (comments) and `:116-120`, and
  lowers ceilings without a `budget:` line. Whichever merges second rebases
  a one-line scene change. If §73 changes `combat.ts`'s line count, the
  rebased branch rewrites the baseline again, and the growth over the new
  merge base is still 24. This is not a `blocked_by`.
- **Drift-machine fall-through:** not applicable. No drift, retreat or
  resolution code is touched.
- **The e2e second attacker.** AC3's optional step adds the
  `fantassins-archers` to the archers with no target. In "Combat test mode"
  `session.combatMode` is `'multi-defender'` (`session.ts:84`), and
  `attackerCanJoin` returns `true` for an empty defender group
  (`combat.ts:492`). It therefore joins, so the plan includes the step.

## Verified against the codebase

Re-read on `main` at `bf7e2a1`.

- `src/engine/combat.ts:7-16` — imports `type Unit`, `unitType`,
  `unitCategory`, `currentAttack`, `currentRangedAttack`, `currentDefense`
  from `./state`. The new function needs no new import.
- `src/engine/combat.ts:266-272` — `attackForceAgainst`:
  `if (t.meleeCapable && atDistance(1)) return currentAttack(attacker);`
  `if (t.rangedAttack > 0 && atDistance(t.range)) return currentRangedAttack(attacker);`
  `return currentAttack(attacker);`. `:272` is its closing `}`, and `:273`
  is blank, followed by the `LandAttackPreview` doc comment (`:274`).
- `src/engine/combat.ts:283-299` — `LandAttackPreview` and
  `previewLandAttack`. `attackForce` is the sum of `attackForceAgainst`.
  Untouched.
- `src/engine/combat.ts:485-498` — `attackerCanJoin`:
  `if (defenderGroup.length === 0) return true;` (`:492`).
- `src/engine/state.ts:56-63` — `unitCategory`. `:93-105` — `currentAttack`:
  `if (unit.charged && unitCategory(unit.typeId) === 'cavalry') return t.attack * 2;`
  (`:103`). `:131-138` — `currentRangedAttack`, for land
  `return t.rangedAttack;`. `:17-42` — the `Unit` interface (`charged: boolean`).
- `src/engine/turnManager.ts:153`, `:158` — `resetMovementForActivePlayer`
  sets `u.charged = false`.
- `src/data/units.ts` — `archers` has `attack: 0`, `rangedAttack: 2`,
  `range: 2`, `meleeCapable: false` (`:27-32`). `fantassins` has
  `attack: 2`, `rangedAttack: 0`. `fantassins-archers` has `attack: 2`,
  `rangedAttack: 2`, `range: 2`, `meleeCapable: true` (`:53-58`).
  `fantassins-lourds` has `attack: 4`, `cavalerie-legere` `attack: 3`, and
  `galeres` is `domain: 'naval'`, `attack: 10`.
- `src/ui/i18n/format.ts:4-9` — imports. `driftExitKind` is already a
  runtime engine import (`:5`), and `LandAttackPreview` is a type import
  from `../../engine/combat` (`:6`).
- `src/ui/i18n/format.ts:81-83` — `function unitNameIn(m: Messages, typeId: string)`.
- `src/ui/i18n/format.ts:102-122` — `formatAttackLine(attackerNames, targetNames, preview, m = messages())`.
  Its doc comment says "the totals appear only with a target". `:113` is
  `if (!preview || targetNames.length === 0) return m.log.attackChooseTarget(attackers);`.
- `src/ui/i18n/en.ts:13-15` — `archers: 'Archers'`, `fantassins: 'Infantry'`,
  `'fantassins-archers': 'Infantry-archers'`. `:16` is `'Heavy infantry'`,
  `:23` `galeres: 'Galleys'` and `:25` `triremes: 'Triremes'`.
- `src/ui/i18n/fr.ts:8-10`, `:11` — `Archers`, `Fantassins`,
  `Fantassins-Archers`, `Fantassins Lourds`. `:20` is `triremes: 'Trirèmes'`.
- `src/ui/i18n/en.ts:57-58` — `attack: 'attack', ranged: 'ranged'`. The
  §74 tooltip is untouched.
- `src/ui/i18n/fr.ts:49-50` — `attack: 'attaque', ranged: 'tir'`. Untouched,
  because the tooltip keeps "tir".
- `src/ui/i18n/en.ts:314` — `` attackChooseTarget: (attackers: string) => `Attack: ${attackers}, choose a target.`, ``
  and `:315` `attackCleared: 'Attack cleared.'`.
- `src/ui/i18n/fr.ts:297` — `` attackChooseTarget: (attackers) => `Attaque : ${attackers}, choisissez une cible.`, ``
  and `:298` `attackCleared: 'Attaque annulée.'`.
- `src/ui/i18n/index.ts:19` — `export type Messages = Widen<typeof en>;`,
  so `fr.ts` is typed against `en.ts`.
- `src/scenes/BoardScene.ts:7` — `import { dieModifierParts, formatAttackLine, formatDriftEvent } from '../ui/i18n/format';`.
- `src/scenes/BoardScene.ts:2001-2011` — the `logAttackLine` doc comment and
  body. `:2005-2006` read "the same code the roll uses; a naval selection
  or no target yet shows the / attackers alone." `:2010` is
  `this.log(formatAttackLine(this.attackGroup.map(nameOf), this.defenderGroup.map(nameOf), preview));`.
- `src/scenes/BoardScene.ts:2014-2020` — `syncRulesPanel`. `preview` is null
  for a naval group or no target. Untouched.
- `src/scenes/BoardScene.ts:1967`, `:1975` — a naval group is the first
  unit's domain and always one ship.
- `src/scenes/BoardScene.ts:3158-3160` — `function nameOf(unit: Unit): string { return unitName(unit.typeId); }`.
- `src/ui/i18n/names.ts:7-9` — `unitName` is
  `(messages().units as Record<string, string>)[typeId] ?? typeId`, the
  same lookup as `unitNameIn`.
- `src/engine/combat.test.ts:48-59` — the `makeUnit(overrides)` helper.
  `:1348` is `describe('previewLandAttack — the pre-roll summary the roll itself uses (§53)'`.
- `src/ui/i18n/format.test.ts:6` — `import type { Player, PlayerId, Unit }`.
  `:37-50` — the `elephant(): Unit` literal. `:188-249` —
  `describe('formatAttackLine (§53)'` with `A = ['Archers', 'Hoplites']`,
  `T = ['Peltasts']` and the cases at `:207-238`.
- `e2e/attack-log.spec.ts:10` — imports `formatAttackLine`. `:44` is
  `archerName`, `:52` the literal `` `Attack: ${archerName}, choose a target.` ``,
  `:65` `formatAttackLine([archerName], [targetName], preview, en)`, `:73`
  the literal `chooseLine`, and `:88` the galley literal.
- `e2e/helpers.ts:17` — `MENU_CLOSE_COMBAT`. `:108-114` — `activeUnitOfType`.
- `src/ui/testMode.ts:113`, `:147-151` — `startCloseCombatTestGame` puts one
  of every land type per side at `{ q: 10 + i, r: 3 }` and `r: 5`, two hexes apart.
- `src/ui/session.ts:84` — `combatMode: 'multi-defender'`.
- `tsconfig.json:16` — `"include"` holds `"e2e"`.
- `scripts/size-baseline.json` — `"src/engine/combat.ts": 1111` and
  `"src/scenes/BoardScene.ts": 3172`. Both equal `wc -l` at `bf7e2a1`.
- `scripts/size-budget-lib.mjs:52` — `BUDGET_RE`. `:110-118`: a ceiling rise
  needs a `budget:` line in "Where this goes" with `n >= growth`, and at most +50.
- `package.json:12` — `"lint": "eslint . --max-warnings 19"`.
- `README.md:766-775` — the attack-line paragraph. `:772-773` read "With
  attackers but no target it says "choose a / target"".

## Where this goes

- **Modules touched:**
  - `src/engine/combat.ts`, for the new `estimateAttackTotals`.
  - `src/engine/combat.test.ts`.
  - `src/ui/i18n/format.ts`, for `formatAttackLine`'s new first parameter
    and a private `estimateParts`.
  - `src/ui/i18n/en.ts` and `fr.ts`, for `attackChooseTarget(attackers, totals)`,
    `meleeEstimate` and `rangedEstimate`.
  - `src/ui/i18n/format.test.ts`.
  - `src/scenes/BoardScene.ts`, one argument at `:2010` and a same-length
    comment at `:2005-2006`.
  - `e2e/attack-log.spec.ts`.
  - `README.md`.
  - `scripts/size-baseline.json`, combat.ts rewritten to 1135.
- **New modules:** none.
- **Why there:**
  - The totals are rule-adjacent arithmetic over unit stats, so they go in
    the engine, beside `attackForceAgainst`, which they complement (spec
    B2, principle 15).
  - Choosing words and dropping a zero part is formatting, so it goes in
    `format.ts` and the en/fr tables (the engine returns data, never text).
  - `format.ts` already calls the engine at runtime (`driftExitKind`).
  - Routing through `formatAttackLine` keeps the scene to wiring, with no
    new import or line.
- **Budget lines:**
- budget: src/engine/combat.ts +24: §80's estimateAttackTotals belongs beside attackForceAgainst (spec B2); the doc comment carries the spec's four function-site interpretations

`BoardScene.ts` gets no budget line, because the change is net zero (AC4).

## Subtasks

1. **The engine function** (B2, B6, AC1).
   - Insert exactly this block after `combat.ts:272` (the `}` closing
     `attackForceAgainst`), before the blank line at `:273`. It is 24 lines,
     the first one blank:

     ```ts

     /**
      * The attackers' totals BEFORE a target is picked (§80), for the log line.
      * Without a target the engine can't know which value each attacker will use
      * (`attackForceAgainst` decides by distance), so these are what the group
      * could bring each way, not two halves of one force: `melee` sums
      * `currentAttack` over the melee-capable (a charging cavalry doubled, its
      * flag set until its owner's next movement phase), `ranged` sums
      * `currentRangedAttack` over those with a ranged value, and a unit with both
      * counts in both. The `meleeCapable` filter states the meaning, though a
      * non-melee unit's attack is 0 today. Positions play no part. A group holding
      * a ship gets none (§53 B6: one ship, no totals), nor does an empty group.
      */
     export function estimateAttackTotals(attackers: readonly Unit[]): { melee: number; ranged: number } | null {
       if (attackers.length === 0 || attackers.some((u) => unitType(u).domain === 'naval')) return null;
       let melee = 0;
       let ranged = 0;
       for (const u of attackers) {
         const t = unitType(u);
         if (t.meleeCapable) melee += currentAttack(u);
         if (t.rangedAttack > 0) ranged += currentRangedAttack(u);
       }
       return { melee, ranged };
     }
     ```

   - Add the `describe('estimateAttackTotals (§80)')` block in
     `combat.test.ts`, after the `previewLandAttack` describe (Tests, AC1).
   - Run `npm run size:baseline -- --write`, which sets
     `"src/engine/combat.ts": 1135`.
   - Commit with `npm run verify` green.
2. **The line** (B1, B3, B4, B5, B6, B8, AC2, AC3). This is one commit,
   because the signature change breaks `tsc -b` in all three callers.
   - `en.ts:314` becomes
     `` attackChooseTarget: (attackers: string, totals: string) => `Attack: ${attackers}${totals ? ` (${totals})` : ''}, choose a target.`, ``.
     Add `` meleeEstimate: (n: number) => `melee ~${n}`, `` and
     `` rangedEstimate: (n: number) => `ranged ~${n}`, ``. Above them, a
     one-line comment: "§80: `~` marks an estimate; the line with a target
     (no `~`) is the exact force."
   - `fr.ts:297` gets the same shape:
     `` `Attaque : ${attackers}${totals ? ` (${totals})` : ''}, choisissez une cible.` ``,
     with `` meleeEstimate: (n) => `mêlée ~${n}` `` and
     `` rangedEstimate: (n) => `distance ~${n}` ``. Add a one-line comment:
     "§80: "distance" here is the owner's word (2026-11-22); the §74
     tooltip keeps "tir"; "mêlée" is new."
   - In `format.ts`, `formatAttackLine` takes `attackerUnits: readonly Unit[]`
     instead of `attackerNames`.
     - It derives the names with `unitNameIn(m, u.typeId)`, joined by `, `.
     - With no target, it returns
       `m.log.attackChooseTarget(attackers, estimateParts(attackerUnits, m))`.
     - The with-target branch is unchanged.
     - Add a private `estimateParts(attackers, m)`. It calls
       `estimateAttackTotals`, returns `''` for null, and otherwise returns
       `[melee > 0 ? m.log.meleeEstimate(melee) : null, ranged > 0 ? m.log.rangedEstimate(ranged) : null]`
       with the nulls filtered out, joined by `, ` (B5).
     - Imports: `estimateAttackTotals` joins the `../../engine/combat`
       import, and `import type { Unit } from '../../engine/state'` is new.
     - Reword the doc comment so it no longer says the totals appear only
       with a target.
   - `BoardScene.ts:2010` becomes
     `this.log(formatAttackLine(this.attackGroup, this.defenderGroup.map(nameOf), preview));`.
     `:2005-2006` are reworded into the same three lines, for example
     "the same code the roll uses; with no target yet a land group shows its /
     estimated totals (§80) and a naval selection the ship alone."
     `wc -l` stays 3172.
   - Update `format.test.ts` and `e2e/attack-log.spec.ts` as in Tests, AC2
     and AC3.
   - Commit with `npm run verify` green.
3. **The README** (AC5).
   - Rewrite `README.md:772-773` so that, with attackers but no target, the
     line gives the group's estimated totals marked `~`, for example
     "Attack: Infantry, Infantry-archers (melee ~4, ranged ~2), choose a target.".
   - It says what they count: every melee value (a charging cavalry
     doubled) and every ranged value, with a unit that has both counting in
     both.
   - It says a zero part is left out, that the exact force appears once a
     target is picked and may differ, and that a ship selected for a ram or
     boarding shows no totals.
   - Commit, then set `status: in-review`.

## Tests

**AC1** is `src/engine/combat.test.ts`,
`describe('estimateAttackTotals (§80)')`, using `makeUnit`. It asserts
exact objects:

| Case | Expect | Fails if mutated |
| --- | --- | --- |
| `archers` | `{ melee: 0, ranged: 2 }` | ranged sum dropped or `currentAttack` used for ranged |
| `fantassins-lourds` | `{ melee: 4, ranged: 0 }` | melee sum dropped or `currentRangedAttack` used for melee |
| `fantassins` + `fantassins-archers` | `{ melee: 4, ranged: 2 }` | the sum becomes "last unit wins" (`=` for `+=`) |
| `archers` + `fantassins-archers` | `{ melee: 2, ranged: 4 }` | a unit with both counted in one part only (`else if`) |
| `cavalerie-legere`, `charged: true` / `false` | melee `6` / `3` | `currentAttack(u)` replaced by `unitType(u).attack` |
| `galeres` alone | `null` | naval guard removed (would give melee 10) |
| `[]` | `null` | empty guard removed (would give `{0, 0}`) |
| `fantassins-archers` at `{0,0}`, then the same unit at `{9,9}` | equal results | a position dependency (e.g. reusing `attackForceAgainst`) |

Equivalent mutants, recorded rather than claimed as tested: dropping
`t.meleeCapable` (archers add `attack: 0`) and dropping `t.rangedAttack > 0`
(a unit with no ranged value adds 0). With today's roster no test can tell
them apart (Risks).

**AC2** is `src/ui/i18n/format.test.ts`, `describe('formatAttackLine (§53, §80)')`.
A local `unitOf(typeId): Unit` literal replaces the name fixtures, shaped
like `elephant()` at `:37`.

| Case | en / fr expected | Fails if mutated |
| --- | --- | --- |
| `fantassins` + `fantassins-archers`, no target | `Attack: Infantry, Infantry-archers (melee ~4, ranged ~2), choose a target.` / `Attaque : Fantassins, Fantassins-Archers (mêlée ~4, distance ~2), choisissez une cible.` | part order swapped, separator, `~`, or French words |
| `fantassins-lourds` | `Attack: Heavy infantry (melee ~4), choose a target.` / `Attaque : Fantassins Lourds (mêlée ~4), choisissez une cible.` | `ranged > 0` turned into `>= 0` |
| `archers` | `Attack: Archers (ranged ~2), choose a target.` / `Attaque : Archers (distance ~2), choisissez une cible.` | `melee > 0` turned into `>= 0` |
| `triremes` | `Attack: Triremes, choose a target.` / `Attaque : Trirèmes, choisissez une cible.` | estimate shown for ships, or `''` not mapped to no parentheses |
| `en.log.attackChooseTarget('Archers', '')` / fr | today's two lines exactly | B5's both-zero guard in the strings (unreachable through units with today's roster) |
| with target, modifiers, several targets | today's expected strings, with the attacker fixture `[unitOf('archers'), unitOf('fantassins')]`, so the names read `Archers, Infantry` / `Archers, Fantassins` where they read `Archers, Hoplites` | B4: any estimate or `~` leaking into the with-target line |
| `[]` | `Attack cleared.` / `Attaque annulée.` | unchanged |

**AC3** is `e2e/attack-log.spec.ts`, extending the existing test. It uses
only the existing readers and makes no `devHook.ts` change.

- **`:52`.** The expected line becomes
  `const aloneLine = formatAttackLine([archers], [], null, en)`, with
  `expect(aloneLine).toMatch(/~/)` so it can't be today's line, and
  `lines.at(-1)` must be that line.
- **The second attacker.** After the refusal check, the test reads
  `const infArchers = await activeUnitOfType(page, 'fantassins-archers')`
  and clicks it. It waits for
  `formatAttackLine([archers, infArchers], [], null, en)` (asserting
  `toMatch(/~.*~/)`, both parts), then clicks it again. It then waits for a
  new `aloneLine` (the deselect logs B1 again), and the rest of the test
  goes on with the archers alone.
- **`:65`.** The with-target line becomes
  `formatAttackLine([archers], [targetName], preview, en)`. The assertion
  is unchanged (B4).
- **`:73`.** `chooseLine` becomes `aloneLine`. Removing the target logs it
  again (B3).
- **`:88`.** The galley stays the literal
  `` `Attack: ${shipName}, choose a target.` `` (B6), so a regression that
  adds totals to ships fails.
- **The header comment** (`:1-6`) mentions the estimate line.

**AC4** is the size budget. `npm run check:intent` checks it:
`BoardScene.ts` stays at 3172, and `combat.ts` sits at 1135 under the
`budget:` line.

**AC5** is the README diff, read at review.

**AC6** is that `npm run verify` is green with the lint cap unchanged.

## Validation

Run these one at a time, never in parallel, because memory on this machine
is tight.

1. `npm run verify` is green, with the lint cap at 19 (18 after §79),
   unchanged.
2. `npm run check:intent` passes apart from the owed live check, with
   `combat.ts` +24 under its `budget:` line and `BoardScene.ts` at 3172.
3. `npm run e2e` runs, with `attack-log.spec.ts` at least, after stopping
   any server on 5232.
4. **The live check is owed** by path rule 1 (`src/scenes/BoardScene.ts`
   and `src/ui/i18n/`). This is new behaviour, so the smoke suite can't
   stand in (spec, "Live check"). These are AC7's steps:
   1. In `npm run dev` (the worktree's port), choose "Combat test mode
      (units face to face, 2 hexes)", then end the movement phase.
   2. In English, click the archers. You should see
      `Attack: Archers (ranged ~2), choose a target.`
   3. Click the infantry-archers. You should see
      `Attack: Archers, Infantry-archers (melee ~2, ranged ~4), choose a target.`
   4. Click them again, then pick a target two hexes away. The line shows
      the exact force, with no `~`.
   5. Click the target again. The estimate line returns.
   6. Click the archers. You should see `Attack cleared.`
   7. Click a galley. You should see
      `Attack: Galleys, choose a target.`, with no totals.
   8. Switch to French and click the archers. You should see
      `Attaque : Archers (distance ~2), choisissez une cible.`

## Assumptions I made

- **Empty group gives `null`** rather than `{ melee: 0, ranged: 0 }`. The
  spec lets the plan pick. Either way the line is `Attack cleared.` before
  the estimate is ever read, and `null` keeps one meaning, "no estimate",
  for both the empty and the naval case.
- **The naval test is `unitType(u).domain === 'naval'` over any attacker.**
  This matches the scene's own test (`:1967`, `:2015`) rather than
  `unitCategory`. The spec says "any naval attacker" and "first attacker
  naval" agree.
- **The return type is inline** (`{ melee: number; ranged: number } | null`),
  with no exported interface, to keep `combat.ts`'s growth at 24. Nothing
  else names the type.
- **The message shape:** `attackChooseTarget(attackers, totals)` receives
  the joined parts (`''` for none) and adds the parentheses itself, plus
  two small part messages, `meleeEstimate` and `rangedEstimate`. The spec
  says each language writes its own words. The `, ` between the parts is
  joined in `format.ts`, like the names, so both languages share it as the
  spec fixes it.
- **AC2's "unchanged expected text" for the with-target cases** is read as
  "unchanged format and numbers". The fixtures must become real units now,
  so the made-up names `Hoplites` and `Peltasts` give way to roster names
  for the attackers. The target names stay strings, because the target
  parameter is unchanged.
- **The e2e step with the infantry-archers is included.** In "Combat test
  mode" (`multi-defender`, `session.ts:84`) `attackerCanJoin` admits any
  unit while no target is chosen (`combat.ts:492`). Both units stand two
  hexes from the enemy row (`testMode.ts:150-151`). The test deselects them
  again so the existing steps run unchanged.
- **No `blocked_by`.** §73 and §79 are related only. Neither touches
  `formatAttackLine`, `logAttackLine` or `attackForceAgainst`.

### Still unsure

- **AC2's "unchanged expected text".** This plan renames the made-up
  attacker `Hoplites` to the roster's `Infantry` / `Fantassins` in the
  with-target fixtures (Assumptions). If the owner meant the strings to stay
  byte-identical, that would need a fake `typeId` that `unitType` can't
  resolve, which this plan avoids.
- **The order in the two-attacker e2e line.** It follows click order. The
  scene pushes each attacker onto the group as it is clicked
  (`BoardScene.ts:1996`), and the test clicks the archers first.
- **Whether `/review` agrees the live check is owed.** It decides, but the
  spec and this plan both expect `owed`.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
