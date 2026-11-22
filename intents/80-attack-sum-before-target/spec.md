<!-- generated-by: heraklios/spec@0.1.0 -->
# §80 spec — The attack line shows the attackers' total before a target is chosen

Accepted intent: [intent.md](intent.md)

Written against `main` at `c683b3f`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| rulebook | nothing: a pre-roll log aid, digital only (intent, "Rulebook basis"). The roll is unchanged |
| intent, "The owner's answers (2026-11-22)" | "(c) Both totals", "Ships stay as today", "Marked as an estimate … The spec fixes the wording in English and French" |
| `intents/53-log-autosave-and-attack-selection/spec.md` B3 | "with attackers but no target yet: `Attack: <attackers>, choose a target.` (no number: an attacker's force depends on its targets, B5)". §80 reverses the "no number" part only |
| §53 spec B4 | the clicks that log a line: "adding an attacker, removing an attacker, adding a target, removing a target, and a prune that drops stranded units". Refusals, undo/redo and resolution log no attack line |
| §53 spec B6 | "Selecting a ship for a ram or a boarding logs `Attack: <ship>, choose a target.` … No totals for naval." |
| `src/engine/combat.ts:266-272` (`attackForceAgainst`) | the exact force: `if (t.meleeCapable && atDistance(1)) return currentAttack(attacker); if (t.rangedAttack > 0 && atDistance(t.range)) return currentRangedAttack(attacker); return currentAttack(attacker);` |
| `src/engine/combat.ts:283-299` (`LandAttackPreview`, `previewLandAttack`) | the line with a target uses `attackForce`, the sum of `attackForceAgainst` over the attackers |
| `src/engine/state.ts:93-105` (`currentAttack`) | "Charging cavalry doubles its printed attack value (light 3->6, heavy 6->12 …)": `if (unit.charged && unitCategory(unit.typeId) === 'cavalry') return t.attack * 2;` |
| `src/engine/state.ts:131-138` (`currentRangedAttack`) | land units: `return t.rangedAttack;` (no modifier) |
| `src/engine/turnManager.ts:152-159` (`resetMovementForActivePlayer`) | `u.charged = false` only at the owner's next movement phase, so a charge made this turn is still set in this turn's combat phase |
| `src/data/units.ts` | land attack/ranged: `archers` 0/2, `meleeCapable: false` (`:27-32`); `fantassins-archers` 2/2, `meleeCapable: true` (`:53-58`); every other land type has `rangedAttack: 0` and `meleeCapable: true` (`:35-149`) |
| `src/ui/i18n/format.ts:105-122` (`formatAttackLine`) | `if (!preview \|\| targetNames.length === 0) return m.log.attackChooseTarget(attackers);` (`:113`) |
| `src/ui/i18n/en.ts:314`, `fr.ts:297` | today's strings: `` `Attack: ${attackers}, choose a target.` ``, `` `Attaque : ${attackers}, choisissez une cible.` `` |
| `src/ui/i18n/en.ts:57-58`, `fr.ts:49-50` (the §74 tooltip) | the existing words: `attack: 'attack', ranged: 'ranged'`; `attack: 'attaque', ranged: 'tir'`. No table has a word for "melee" yet |
| `src/scenes/BoardScene.ts:2008-2011` (`logAttackLine`), `:2014-2020` (`syncRulesPanel`) | the one call: `this.log(formatAttackLine(this.attackGroup.map(nameOf), this.defenderGroup.map(nameOf), preview));`; `preview` is null for a naval group or no target |
| `scripts/size-baseline.json:6` | `"src/scenes/BoardScene.ts": 3172`, its line count today |
| `README.md:766-775` | documents the attack line; "With attackers but no target it says "choose a target"" changes |

## Behaviour

**B1 — The line before a target.** In the combat phase, while the land
attack being built has at least one attacker and no target, its log line
carries the attackers' estimated totals:

- English: `Attack: <attackers> (<parts>), choose a target.`
- French: `Attaque : <attackers> (<parts>), choisissez une cible.`

`<parts>` is the melee part, then the ranged part, joined by `, `:

| part | English | French |
| --- | --- | --- |
| melee | `melee ~<M>` | `mêlée ~<M>` |
| ranged | `ranged ~<R>` | `distance ~<R>` |

Examples (unit names as in `en.ts:14-15`, `fr.ts:9-10`):

- `Attack: Infantry, Infantry-archers (melee ~4, ranged ~2), choose a target.`
- `Attaque : Fantassins, Fantassins-Archers (mêlée ~4, distance ~2), choisissez une cible.`
- `Attack: Archers (ranged ~2), choose a target.` (melee 0, omitted: B5)
- `Attack: Heavy infantry (melee ~4), choose a target.` (ranged 0, omitted: B5)

Names stay the units' display names in pick order, joined by `, `, as in
§53 B3.

**B2 — The two totals.**

- **Melee `M`** is the sum of `currentAttack(u)` over the attackers whose
  type is `meleeCapable`. An attacker that is not melee-capable (today only
  `archers`) contributes 0 to it.
- **Ranged `R`** is the sum of `currentRangedAttack(u)` over the attackers
  whose type has `rangedAttack > 0` (today `archers` and
  `fantassins-archers` on land). Any other attacker contributes 0 to it.
- A unit counts in both when it has both (`fantassins-archers`, 2 and 2).
- A charging cavalry counts doubled in `M`, because `currentAttack` already
  doubles it (`state.ts:103`), as the §74 tooltip shows it. No other
  modifier exists: terrain and the river act on the die, not on a force
  (§53 B5a), and are not part of either total.

They come from a new pure function in `src/engine/combat.ts`, beside
`attackForceAgainst`. It takes the attackers only, never the targets.

**B3 — When it updates.** The line is logged on exactly the clicks §53 B4
names, and no others: adding an attacker, removing an attacker (when
attackers remain), removing the last target (the line falls back to B1),
and a prune that leaves attackers and no target (after its "Removed from
the combat…" line). A refused click, an undo, a redo and a resolution log
no attack line, as today. An empty group still logs `Attack cleared.`
(`Attaque annulée.`).

**B4 — The line with a target is unchanged.** Once a target is picked the
line is §53's, with the exact force from `previewLandAttack`:
`Attack: <attackers> (<attack force>) → <targets> (<defence force>)[, die
+<n> (<parts>)]`. No estimate appears on it. The two lines may disagree
(see Interpretations); that is accepted.

**B5 — The zero-part rule.** A part whose total is 0 is left out. If both
are 0, the parentheses are left out too and the line is today's
`Attack: <attackers>, choose a target.` No land group reaches that case with
today's roster (every land type has `attack > 0` except `archers`, which
have `rangedAttack: 2`), so it is a guard, not a visible case.

**B6 — Ships unchanged.** A naval selection (a ship picked for a ram or a
boarding) logs `Attack: <ship>, choose a target.` /
`Attaque : <ship>, choisissez une cible.` exactly as today (§53 B6), with
no totals. The engine function gives no estimate for a group that holds a
naval unit.

**B7 — The AI.** The computer's attacks log nothing new (§53 B7 holds).

**B8 — Both languages.** The new strings are in `en.ts` and `fr.ts`;
switching language changes them like the other log lines.

## Interpretations

Each becomes a code comment at its implementation site.

- **"Melee total" and "ranged total" without targets** (owner, answer 1).
  Without a target the engine cannot know which value each attacker will
  use (`attackForceAgainst` decides by distance), so the line shows what
  the group could bring each way: every melee value, and every ranged
  value. They are not two halves of one force: a unit with both
  (`fantassins-archers`) counts in both, and the exact force against a
  target uses one value per attacker. At the function.
- **"Mark it as an estimate"** (owner, answer 3). `~` before each number,
  as in the owner's example `(melee ~4, ranged ~4)`. It reads as "about",
  and the line with a target (B4), which has no `~`, is the exact force.
  At the en/fr strings.
- **The melee filter.** `M` filters on `meleeCapable` even though a
  non-melee-capable unit's `currentAttack` is 0 today (`archers`:
  `attack: 0`). The filter states the meaning, so a future roster edit
  cannot leak a non-melee value into it. At the function.
- **The charge.** `M` uses `currentAttack`, which doubles a charging
  cavalry (`state.ts:99-103`), and `charged` stays set through the owner's
  combat phase (`turnManager.ts:158` clears it at their next movement).
  So `M` shows the doubled value the roll would use in melee, as the §74
  tooltip does (`unitTooltip.ts:32`). At the function.
- **French "mêlée" and "distance" (owner, 2026-11-22: in French "distance" instead of "tir").** `fr.ts` has `tir` for ranged (`fr.ts:50`, the §74 tooltip), but this line says "distance", the owner's choice; the tooltip keeps "tir". `fr.ts` has no
  word for melee. "Mêlée" is the usual French word for hand-to-hand combat
  and is short enough for the log line. At the fr string.
- **Naval.** A group holding a ship gets no estimate (owner, answer 2;
  §53 B6). The scene treats a group as naval when its first unit is naval
  (`BoardScene.ts:1967`, `:2015`); a naval group is always one ship
  (`:1975`), so "any naval attacker" and "first attacker naval" agree. At
  the function.

## Acceptance criteria

- **AC1 — the totals** (`src/engine/combat.test.ts`, a `describe` beside
  `previewLandAttack`'s at `:1348`): exact numbers for
  - one `archers`: M 0, R 2;
  - one `fantassins-lourds`: M 4, R 0;
  - `fantassins` + `fantassins-archers`: M 4, R 2;
  - `archers` + `fantassins-archers`: M 2, R 4;
  - a `cavalerie-legere` with `charged: true`: M 6; the same with
    `charged: false`: M 3;
  - a group holding a naval unit (e.g. `galeres`): no estimate;
  - an empty group: no estimate (or both 0; the plan picks, and B5 then
    shows today's line).
  The function takes no targets, and the units' positions do not change
  its result (one case moves a unit and gets the same totals).
- **AC2 — the line text** (`src/ui/i18n/format.test.ts`, the
  `formatAttackLine (§53)` block at `:188`), in English and French:
  - both parts: `Attack: Infantry, Infantry-archers (melee ~4, ranged ~2),
    choose a target.` and `Attaque : Fantassins, Fantassins-Archers (mêlée
    ~4, distance ~2), choisissez une cible.`;
  - melee only and ranged only (B5), in both languages;
  - both 0 or no estimate: today's line, in both languages;
  - a naval selection: `Attaque : Trirèmes, choisissez une cible.` or
    the English equivalent, unchanged;
  - the existing with-target and `Attack cleared.` cases pass unchanged in
    their expected text (B4).
- **AC3 — e2e** (`e2e/attack-log.spec.ts`, the existing test, through the
  existing readers `logEntries()`, `state`, `activeUnitOfType`, `clickHex`;
  no `devHook.ts` change):
  - selecting the archers logs `Attack: Archers (ranged ~2), choose a
    target.`, the expected text built from the new engine function and
    `formatAttackLine` with `messagesFor('en')`, not copied;
  - removing the target logs that line again (the existing
    "new attackers-alone line" step, with the new text);
  - the with-target line is still exactly `formatAttackLine` over
    `previewLandAttack` (B4);
  - the galley still logs `Attack: Galleys, choose a target.` (B6), as a
    literal, so a regression that adds totals to ships fails.
  - If "Combat test mode" lets a `fantassins-archers` join the archers
    with no target (both stand two hexes from the enemy row,
    `testMode.ts:147-151`), the test also adds it and expects
    `(melee ~2, ranged ~4)`. If the combat mode refuses it, the plan says
    so and AC2 alone covers the two-part line.
- **AC4 — size** (`npm run size:baseline`, `npm run check:intent`):
  `BoardScene.ts` stays at or under 3172 lines and
  `scripts/size-baseline.json` is not raised.
- **AC5 — README**: `README.md:772-773` describes the estimate before a
  target, its `~` and the zero-part rule, and says ships show none.
- **AC6** — `npm run verify` green (lint cap not raised),
  `npm run check:intent` PASS apart from an owed live check.
- **AC7 — live check** (see "Live check" below), if `/review` says it is
  owed: in `npm run dev`, "Combat test mode", end the movement phase; in
  English click the archers (`Attack: Archers (ranged ~2), choose a
  target.`), add the infantry-archers if they can join, pick a target
  (the line has the exact force, no `~`), remove it (the estimate line
  returns), clear; click a galley (`Attack: Galleys, choose a target.`);
  switch to French and repeat the archers click
  (`Attaque : Archers (distance ~2), choisissez une cible.`).

## Non-functional

- **Engine/presentation split:** the totals are a pure function in
  `src/engine/combat.ts` with its tests; it decides "no estimate for a
  naval group". `src/ui/i18n/format.ts` only formats (omitting zero parts,
  B5) and the en/fr tables hold the words. `format.ts` already calls the
  engine at runtime (`driftExitKind`, `format.ts:5`, `:35`), so calling the
  new function there is in keeping, if the plan routes it that way.
- **No scene growth:** `BoardScene.ts` gains no line (AC4). The scene's
  only call is `BoardScene.ts:2010`. A route that needs no new import and
  no new line: `formatAttackLine` takes the attacker **units** instead of
  their names, derives the names with `unitNameIn(m, typeId)`
  (`format.ts:81`, the same text as the scene's `nameOf`, `:3158-3160`,
  but in the formatter's language `m`) and the estimate from the engine
  function; `:2010` changes `this.attackGroup.map(nameOf)` to
  `this.attackGroup`. The plan may choose another route that keeps the
  scene at 3172 or under.
- **Save format:** unchanged. No `GameState` change, no `SAVE_VERSION`
  bump.
- **Undo boundaries:** none new. A log line records no history entry.
- **AI / harness:** `legalActions`, `applyAction`, the fuzz harness and
  `HeuristicAgent` are untouched.

## Live check

The change is **not** confined to `src/engine` and `src/ui/i18n` plus
e2e: under the no-growth route above it also edits one line of
`src/scenes/BoardScene.ts` (`:2010`), and `src/ui/i18n/` is itself under
`src/ui/`, which the path rule names (CLAUDE.md; `REVIEW-POLICY.md` →
"Live checks"). So a live check is owed by the path rule, and only by it.
`e2e/attack-log.spec.ts` covers the changed lines (AC3). But
`REVIEW-POLICY.md:86-93` lets the suite stand in only when "the change is
neither new behaviour nor visual", and this is new behaviour (a number
where there was none). This spec therefore expects `live-check: owed`,
with AC7's short steps; `/review` decides.

## Out of scope

- An estimate on the naval line (owner, answer 2).
- Any change to the line once a target is picked (§53 B3, B5, B5a).
- The odds, the CRT column or an expected result before the roll.
- Per-target previews (the force against each reachable enemy) before a
  target is picked.
- The Tables panel's highlight: it still needs a target
  (`BoardScene.ts:2017`).
- Announcing the computer's attacks.
- Fixing the `toggleDefender` slip `attackForceAgainst`'s comment
  describes (`combat.ts:250-258`).

## Assumptions I made

- **The exact wording.** Order melee then ranged; `, ` between the parts;
  `~` glued to the number; the parts in parentheses after the names,
  before `, choose a target.`, following the owner's example
  `(melee ~4, ranged ~4)`.
- **French "mêlée" and "distance".** "Distance" is the owner's word (not `fr.ts:50`'s "tir"); "mêlée" is new
  (no melee word exists in `fr.ts`).
- **English "ranged".** Reuses the §74 tooltip's word (`en.ts:58`).
- **Zero parts are omitted** (the coordinator's preference), and "both
  zero" falls back to today's line rather than `(melee ~0)`.
- **The function ignores targets and positions.** It is an estimate of
  the group, not of an attack; the exact force stays `previewLandAttack`'s.
- **The e2e extends the existing test** in `attack-log.spec.ts`, rather
  than a new file, since that test already walks every step B3 names.
- **No blocker.** §73 (BoardScene on the session) is open and also edits
  `BoardScene.ts`, but not `logAttackLine`; whichever merges second
  rebases a one-line change. Recorded as related, not `blocked_by`.
