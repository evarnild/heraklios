<!-- generated-by: heraklios/review@0.1.5 -->
# §53 review — The log says when the game autosaves, and shows the attack being built

verdict: rework
tier: attested
reviewed-commit: 875ca84
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table: `src/engine/combat.ts` (not a Reviewed
rule table), `src/scenes/**`, `src/ui/**`, `e2e/**`, README wording and the
intent folder. `review_tier` is empty, the feature implements no new rulebook
rule, and no finding is CRITICAL or HIGH.

**Verdict:** `rework`. Two MEDIUM test gaps (an e2e step that can't fail, an
untested target-name join) and three LOW items need a mechanical fix; none
needs a decision or touches `spec.md` or `plan.md` above the Progress
marker. Passes run by the `heraklios-reviewer` agent; the coordinator re-ran
verify, check:intent, e2e and every surviving mutant (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass: terrain and river are a die modifier, not part of a force (`docs/research/05-rules-french-original.md:177-183`, `02-rules-transcription.md:170`); combat results are unchanged |
| 4 | Tests prove the rule, not only pass | findings (4) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | findings (1) |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged; no new dependency |
| 9 | Repository-specific footguns | pass |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 53, feature)
  note:  10 file(s), 395 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `e2e/attack-log.spec.ts:72-76`: the "Remove the target" step
  can't fail. It waits for at least one `Attack: Archers, choose a target.`
  entry, but the first select already logged one (`:51-53`), so the wait
  passes at once. Deleting `this.logAttackLine()` in `toggleDefender`'s
  untarget branch (`src/scenes/BoardScene.ts:1985`, mutant S6) survives,
  although the plan's Tests table says the e2e catches a missing call site.
  Needs rework: capture the count of that text (or of the attack lines)
  before the click and wait for count + 1, or assert the last attack line
  after a `waitIdle`. Expected kill: S6.
- **MEDIUM** `src/ui/i18n/format.test.ts:204-243`: every case has one target
  (`T = ['Peltasts']`), as does the e2e, so the target-name join is untested:
  `targetNames.join(', ')` → `join(' & ')` (`src/ui/i18n/format.ts:117`,
  F4) survives. Spec B3 says names are joined by `, `. Needs rework: a
  two-target case (e.g. `['Peltasts', 'Archers']` → `… → Peltasts, Archers
  (6)`), in at least one language. Expected kill: F4.
- **LOW** `src/engine/combat.test.ts:1405-1413` (AC1, "only when attacking from
  below"): single attackers only, so `attackers.some(...)` → `every(...)` in the
  from-below condition (`src/engine/combat.ts:313`, E4) survives. The line
  moved rather than changed, but it now sits behind a new public function and
  its comment records the "any attacker" reading. Needs rework: a
  two-attacker case, one level with the plateau defender and one below,
  expecting `terrainOnlyModifier` 2. Expected kill: E4.
- **LOW** `plan.md` Progress: "57 files / 1007 tests (was 1001: +6 across
  engine and format)" is wrong; `vitest list` shows 13 tests in the two new
  §53 blocks (7 engine, 6 format) and the diff deletes none, so the base was
  994 and the increase +13. Needs rework: correct the Progress entry (below
  the marker).
- **LOW** `README.md:620-628`: the example uses unit names the game doesn't
  have ("Hoplites", "Peltasts") and a wording the code never writes ("2 hills
  at (4, 7)"; the real text names the terrain from `en.terrain`, e.g. "2
  Plateau at (4, 7)"). Needs rework: use a line the game really writes, e.g.
  `Attack: Heavy chariots (8) → Heavy chariots, Light chariots (8), die +3 (2
  Wide river at (20, 3) + 1 river crossing)` (reproduced from the engine and
  formatter; see the live check).
- **LOW** `src/scenes/BoardScene.ts:1911` (naval select) and `:992` (the
  autosave failure branch): S4 (naval-select `logAttackLine()` deleted) and
  S2 (autosave always logs `Autosaved.`) survive every test, as the plan
  expected; only the live check covers them (steps 6 and 8). Worth a look: an
  e2e step in `naval.spec.ts` selecting a ship in the combat phase would cover
  S4.
- **LOW** `src/scenes/BoardScene.ts:2566` (`formatCombatOutcome` calling
  `dieModifierParts`): replacing it with `[]` (S13) passes vitest and the e2e;
  `reports.test.ts` exercises `combatReport` with parts passed in, not the
  scene's wiring. A script confirmed the refactor is byte-identical (below),
  so this is a coverage gap, not a defect. Worth a look.

Nit: `e2e/attack-log.spec.ts:79-80` has a doubled blank line.

## Not checked
- **The autosave failure line** (S2): only shows when the save API fails; left
  to the live check (step 8).
- **The naval-select line** (B6): the formatter's naval form is unit-tested,
  the scene call site is not (S4); live check step 6.
- **The die-modifier forms in the scene:** the e2e target is on plain, so the
  terrain and river parts are proved only by the format and engine tests.
  "Combat test mode" reaches a wide-river modifier and a river crossing within
  one turn; a follow-up e2e could cover it.
- **Refusals in `toggleAttacker`** (already attacked, can't reach, no common
  target, already rammed): no attack line is logged on them, but no test
  checks it; adding one after `cantReachTargets` (S12) survives. Only a
  `toggleDefender` refusal is exercised (S8 killed).
- **Undo/redo not re-logging the attack line** (B4) and **the prune path**:
  by reading only (`logAttackLine` has five call sites, all in the click
  handlers).
- **French in the browser:** formatter tests check French strings; no e2e runs
  the lines in French (live check step 9).
- **Equivalent mutants, not gaps:** F2 (dropping `targetNames.length === 0`;
  the scene never passes a preview without targets), F6, F7 (the
  `terrainOnlyModifier !== 0 && source` guard; the source is set only when
  the modifier is above 0), S11 (dropping `!naval &&`; a naval selection
  always has no targets).
- **A possible flake in `e2e/message-log.spec.ts`:** `p2.total === p0.total +
  1` reads the panel's own line count, which the new `Autosaved.` filter
  doesn't cover; it would fail only if the opening autosave resolved after 30
  Undo clicks. It passed in every run.
- **`main` has moved** past this branch's merge-base (`dd714ca`; §52 merged,
  touching `README.md` among others). No rebase or merge was tried.

## Live check
- **Owed** by rule 1 (`src/scenes/BoardScene.ts`, `src/ui/i18n/*`); the change
  is new and visual. Rule 3 too: the autosave failure line and the naval
  select line are runtime-only. Run it on the commit that resolves the
  findings above.
- **Steps:**
  1. Keep autosaves out of any real `saves/` folder. In PowerShell, in
     `C:\Users\eric\src\heraklios-wt\53-log-autosave-and-attack-selection`:
     `$env:HERAKLIOS_SAVES_DIR = "$env:TEMP\heraklios-53-saves"; npm run dev --
     --port 5253 --strictPort --host 127.0.0.1` (Git Bash:
     `HERAKLIOS_SAVES_DIR="$TEMP/heraklios-53-saves" npm run dev -- --port 5253
     --strictPort --host 127.0.0.1`). Open `http://127.0.0.1:5253/`. Leave the
     combat mode at multi-defender.
  2. In English, click **"Combat test mode (units face to face, 2 hexes)"**.
     The first player's row is at r=3, the second's at r=5; the east end of
     each is **Heavy chariots** (q=19) with **Light chariots** (q=18) beside
     it; (20, 3) is a **Wide river** hex. You should see `Autosaved.` soon
     after the board opens.
  3. First player, movement: Heavy chariots (19, 3) → (20, 3); Light chariots
     (18, 3) → (19, 3).
  4. End the movement phase, then the combat phase without attacking. A
     second `Autosaved.` appears when the second player's movement starts.
  5. Second player, movement: Heavy chariots (19, 5) → (19, 4); Light chariots
     (18, 5) → (18, 4). End the movement phase.
  6. Second player, combat. Click in this order; each log line should read:
     - your Heavy chariots (19, 4): `Attack: Heavy chariots, choose a target.`
     - the enemy Heavy chariots (20, 3): `Attack: Heavy chariots (8) → Heavy
       chariots (5), die +2 (2 Wide river at (20, 3))`
     - the enemy Light chariots (19, 3): `Attack: Heavy chariots (8) → Heavy
       chariots, Light chariots (8), die +3 (2 Wide river at (20, 3) + 1 river
       crossing)` (the worst terrain is kept; a river hexside runs between
       (19, 4) and (19, 3))
     - your Light chariots (18, 4): `Attack: Heavy chariots, Light chariots
       (12) → Heavy chariots, Light chariots (8), die +3 (2 Wide river at (20,
       3) + 1 river crossing)`
     - the enemy Heavy chariots (20, 3) again, removing it: `Attack: Heavy
       chariots, Light chariots (12) → Light chariots (3), die +1 (1 river
       crossing)`
     - an enemy far to the west: only the existing "can't be reached" line,
       no `Attack…` line
     - **Resolve attack:** the report shows attack 12, defence 3, modifier +1
       (1 river crossing), matching the last attack line.
     - **Naval (B6):** in a later combat phase, click one of your ships (rows
       r=7 and r=9, from q=25 east): `Attack: <ship>, choose a target.`; click
       it again: `Attack cleared.`
  7. Undo once after a click in step 6 (before resolving): only the "Undone …"
     line, no new attack line.
  8. **Failure line:** Chrome DevTools → ⋮ → More tools → Network request
     blocking; enable it, add `*/api/saves/autosave*`, and end phases until
     the next movement phase starts; then remove the block. You should see
     `Autosave failed: the game server isn't answering.` and no `Autosaved.`
     for that autosave.
  9. Reload, switch the Menu to **Français**, and repeat steps 2-6:
     `Sauvegarde automatique effectuée.`, `Attaque : Chars Lourds, choisissez
     une cible.`, `Attaque : Chars Lourds (8) → Chars Lourds (5), dé +2 (2
     Rivière large en (20, 3))`, `Attaque : Chars Lourds (8) → Chars Lourds,
     Chars Légers (8), dé +3 (2 Rivière large en (20, 3) + 1 traversée de
     rivière)`, `Attaque : Chars Lourds, Chars Légers (12) → Chars Lourds,
     Chars Légers (8), dé +3 (2 Rivière large en (20, 3) + 1 traversée de
     rivière)`, `Attaque : Chars Lourds, Chars Légers (12) → Chars Légers (3),
     dé +1 (1 traversée de rivière)`; deselecting every attacker gives
     `Attaque annulée.`; a blocked autosave gives `Échec de la sauvegarde auto
     : le serveur du jeu ne répond pas.`
- **You should see:** each line matches the board in both languages, and the
  final report's forces and modifier match the last attack line. The expected
  lines were computed with `previewLandAttack` and `formatAttackLine` for
  this position; if a force differs, compare it with the report after the
  roll, which must agree.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `875ca84`, clean before and after):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 57
  files, 1007 tests (matches).
- `npm run check:intent`: PASS, 10 files, 395 lines (matches).
- `npm run e2e`: 14 passed (port 5232 free before) (matches).
- Every survivor, one at a time, backed up and restored by copy, each checked
  as applied; engine and format mutants with the full `vitest run`, scene
  mutants with `npx playwright test e2e/attack-log.spec.ts`:
  - E4 (`some` → `every`, `combat.ts:313`): **survived**, 1007 passed.
  - F4 (`join(', ')` → `join(' & ')`, `format.ts:117`): **survived**, 1007
    passed.
  - S2 (autosave always `autosaved`, `BoardScene.ts:992`): **survived**.
  - S4 (naval-select `logAttackLine()` deleted, `:1911`): **survived**.
  - S6 (untarget `logAttackLine()` deleted, `:1985`): **survived**.
  - S12 (`logAttackLine()` added after `cantReachTargets`): **survived**.
  - S13 (`dieModifierParts` → `[]`, `:2566`): **survived** the attack-log
    scenario (the reviewer ran the full e2e for it).
  - All match the reviewer; `git status --short` empty after each.

**Reviewer agent** (same worktree and HEAD; nothing checked out):
- `npm run verify`, `check:intent`, `npm run e2e` as above; `vitest list`:
  1007 tests, 13 in the §53 blocks.
- `npm run sdlc:scan -- --sample-due auto --exclude 53`: nth attested auto
  change = 2, every 3, `sampled: no` (rework in any case).
- **Pass 3:** `git diff -w main...HEAD -- src/engine/combat.ts` shows the old
  body of `computeLandAttackDetail` (forces, terrain loop, river flag,
  modifier) moved unchanged into `previewLandAttack`, apart from `modifier` →
  `terrainModifier`; `computeLandAttackDetail` calls it and keeps the die,
  the CRT lookup and the result. The engine suite, soak and odds tests
  included, passes unchanged.
- **The combat report is byte-identical:** a vite-node script outside the repo
  compared the old inline modifier-part code with `dieModifierParts` over 288
  cases (every terrain and null, modifier 0/1/2, river on and off, hex or
  null, English and French): 0 differences.
- **Boundary:** forces and modifier in `src/engine/combat.ts`, text in
  `src/ui/i18n/{en,fr,format}.ts`, the scene only calls and logs
  (`logAttackLine`, five call sites, none on a refusal, undo/redo, resolution
  or the AI path). No `GameState` change, history push or die-roll boundary;
  save format untouched; `noLiterals` passes; en/fr parity by `fr.ts`'s
  `Messages` type.
- **`message-log.spec.ts`:** the filter drops only entries exactly `Autosaved.`;
  every other assertion sees the same entries (the panel-count flake above is
  the one exposure).
- **Mutations:** 37 run, one at a time, CRLF-aware, `git diff --quiet`
  checked, restored by copy, tree clean after each. Killed (26): E1-E3,
  E5-E13; F1, F3, F5, F8-F13; S1, S3, S5, S7-S10. Survived (11): E4, F4, S2,
  S4, S6, S12, S13 (gaps) and F2, F6, F7, S11 (equivalent).
- Nothing pushed; `main` untouched.

**Taken on trust:** that the first player (row r=3) moves first in "Combat
test mode" (from `randomizedTurnOrder: false` in the session defaults; no
browser driven); the live-check forces (Heavy chariots 8/5, Light chariots
4/3), computed from the engine on hand-built units.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut53/`
(reviewer) and `…/scratchpad/coord53/` (coordinator).

Mutants a rework is expected to kill: S6, F4, E4 (and S4 or S12 if the
optional tests are added).
