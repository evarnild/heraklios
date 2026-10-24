<!-- generated-by: heraklios/review@0.1.5 -->
# §53 review — The log says when the game autosaves, and shows the attack being built

verdict: attest
tier: attested
reviewed-commit: 6c12266
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table: `src/engine/combat.ts` (not a Reviewed
rule table), `src/scenes/**`, `src/ui/**`, `e2e/**`, README wording and the
intent folder. `review_tier` is empty, the feature adds no rulebook rule, and
no finding is CRITICAL or HIGH. Since round 1 (`875ca84..6c12266`) only
tests, the e2e scenario, README wording and intent files changed; no
production code.

**Verdict:** `attest`. Every round-1 item that needed rework is fixed, each
confirmed by its mutant; the three LOW items left are coverage gaps marked
"worth a look", already listed in round 1. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent, e2e
and seven mutants (below). The live check is owed before the merge.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework touches only what round 1 asked (e2e untarget and naval steps, a two-target format case, a from-below engine case, the Progress entry, the README example); `plan.md` changed only below the Progress marker; no production code |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass: no rule behaviour changed; the new engine case pins the "any attacker below" reading at `src/engine/combat.ts:308-310` |
| 4 | Tests prove the rule, not only pass | findings (3, LOW, carried: S2, S12, S13) |
| 5 | Engine/presentation boundary and conventions | pass: no code change since round 1 |
| 6 | Numbers in prose | pass: the corrected Progress counts reproduce |
| 7 | Documentation | pass: the README example is exactly a line the game writes |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, cap unchanged; `package.json` and `eslint.config.js` untouched |
| 9 | Repository-specific footguns | pass |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 53, feature)
  error: A live check is owed and not recorded. Do the steps in intents/53-log-autosave-and-attack-selection/review.md → ## Live check, then set live_checked: <date> in intents/53-log-autosave-and-attack-selection/metadata.yml.
  note:  10 file(s), 423 line(s) changed outside intents/.
```
The only error is the owed live check, which you clear; not rework.

## Findings
- **LOW** `src/scenes/BoardScene.ts:992` (the autosave result): a mutant that
  always logs `Autosaved.` (S2) survives; only a failing save API shows the
  failure line (live check step 8). Worth a look: an e2e step that blocks
  `**/api/saves/autosave*` with `page.route` would kill it.
- **LOW** `src/scenes/BoardScene.ts:1917` (`toggleAttacker` refusals): adding
  `logAttackLine()` after `cantReachTargets` (S12) survives; the implementer
  skipped this optional item and said so in Progress. Worth a look: click an
  own unit that can't join the current targets and assert no new attack line.
- **LOW** `src/scenes/BoardScene.ts:2566` (`formatCombatOutcome` →
  `dieModifierParts`): `[]` instead (S13) survives `attack-log.spec.ts`;
  round 1 showed by script that the refactor is byte-identical, so a coverage
  gap, not a defect. Worth a look.

Nits: `README.md:625-626` has a ragged wrap ("choose a" / "target"); the new
engine case (`src/engine/combat.test.ts:1416-1425`) puts the "level"
attacker on the defender's own hex, copying the case above it (fine for
`previewLandAttack`, not a legal position).

## Not checked
- **The autosave failure line** (S2): only when the save API fails; live check
  step 8.
- **Refusals in `toggleAttacker`** (already attacked, can't reach, no common
  target, already rammed): no test checks that they log no attack line (S12).
- **The die-modifier forms in the scene:** the e2e target is on plain ground,
  so the terrain and river parts are proved by the format and engine tests and
  by the live check. The README example comes from the engine and formatter on
  hand-built units at the live-check positions, not from a browser run.
- **Undo/redo not re-logging the attack line** (B4) and **the prune path:** by
  reading only; unchanged since round 1.
- **French in the browser:** no e2e runs the lines in French (step 9).
- **Heavy chariots reaching (20, 3) in one move:** only that a wide river
  (cost 3, open to chariots, `src/data/terrain.ts:60-65`) can be entered was
  checked; the move is live check step 3.
- **Equivalent mutants** F2, F6, F7, S11: not re-run (no code change).
- **The `message-log.spec.ts` panel-count flake** (round 1): unchanged; it
  passed.
- **A load flake in `server/fileSaveFs.test.ts`:** one coordinator run of the
  full suite (with mutant F4 applied, while other worktrees ran tests) also
  failed a `fileSaveFs` concurrency test; it passed twice alone and in the
  repeat F4 run. Not caused by §53 (no `server/` change).
- **`main` has moved:** 58 commits past the merge-base `dd714ca`, now at
  `f9f77b9`; `git merge-tree --write-tree main HEAD` reports no conflicts. No
  merge was tried.

## Live check
- **Owed** by rule 1 (`src/scenes/BoardScene.ts`, `src/ui/i18n/*`); the change
  is new and visual. Rule 3 too: the autosave failure line is runtime-only.
  The e2e now covers the naval-select line, but step 6's naval item stays as a
  visual check.
- **Steps** (unchanged from round 1; the rework changed no behaviour):
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
       crossing)` (the README's example; the worst terrain is kept, and a river
       hexside runs between (19, 4) and (19, 3))
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
     blocking; enable it, add `*/api/saves/autosave*`, end phases until the
     next movement phase starts, then remove the block. You should see
     `Autosave failed: the game server isn't answering.` and no `Autosaved.`
     for that autosave.
  9. Reload, switch the Menu to **Français**, and repeat steps 2-6:
     `Sauvegarde automatique effectuée.`; `Attaque : Chars Lourds, choisissez
     une cible.`; `Attaque : Chars Lourds (8) → Chars Lourds (5), dé +2 (2
     Rivière large en (20, 3))`; `Attaque : Chars Lourds (8) → Chars Lourds,
     Chars Légers (8), dé +3 (2 Rivière large en (20, 3) + 1 traversée de
     rivière)`; `Attaque : Chars Lourds, Chars Légers (12) → Chars Lourds,
     Chars Légers (8), dé +3 (2 Rivière large en (20, 3) + 1 traversée de
     rivière)`; `Attaque : Chars Lourds, Chars Légers (12) → Chars Légers (3),
     dé +1 (1 traversée de rivière)`; deselecting every attacker gives
     `Attaque annulée.`; a blocked autosave gives `Échec de la sauvegarde auto
     : le serveur du jeu ne répond pas.`
- **You should see:** each line matches the board in both languages, and the
  final report's forces and modifier match the last attack line.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `6c12266`; clean before, and after each
mutant):
- `npm run verify`: exit 0, built, `21 problems (0 errors, 21 warnings)`, 57
  files, 1009 tests (matches).
- `npm run check:intent`: FAIL only on the owed live check, 10 files, 423
  lines (matches).
- `npm run e2e`: 14 passed, port 5232 free before (matches).
- Mutants, one at a time, backed up and restored by copy, each checked as
  applied; engine and format with the full `vitest run`, scene with `npx
  playwright test e2e/attack-log.spec.ts`:
  - E4 (`some` → `every`, `combat.ts:313`): **killed**, 1 failed, "one attacker
    below is enough for the conditional bonus when another is level"
    (matches).
  - F4 (`join(', ')` → `' & '`, `format.ts:117`): **killed**, 1 failed, "joins
    several targets in order, with the summed defence" (matches; see the
    `fileSaveFs` load flake under Not checked for an earlier run that also
    failed an unrelated test).
  - S4 (naval-select `logAttackLine()` deleted): **killed** (matches).
  - S6 (untarget `logAttackLine()` deleted): **killed** (matches).
  - S2, S12, S13: **survived**, as the reviewer reported.
- Note: one coordinator mutant run overlapped a still-running earlier run of
  the same harness; the tree was restored from the backups, confirmed clean
  (`git status --short` empty, so every file equals HEAD), and F4 was re-run
  alone. The results above are from the clean runs.

**Reviewer agent** (same worktree and HEAD; nothing checked out):
- `git diff 875ca84..HEAD` read in full: `README.md`, `e2e/attack-log.spec.ts`,
  `src/engine/combat.test.ts`, `src/ui/i18n/format.test.ts`, and the intent's
  `plan.md` (appended Progress), `metadata.yml`, `review.md`; no production
  file.
- `npm run verify`, `check:intent`, `npm run e2e` as above; the same seven
  mutants with the same results (S6 killed at `attack-log.spec.ts:77`, S4 at
  `:88`).
- **README example:** a vite-node script outside the repo ran
  `previewLandAttack` and `formatAttackLine` for Heavy chariots (19, 4)
  against Heavy chariots (20, 3) and Light chariots (19, 3): exactly the
  README's line (attack 8, defence 8, modifier 3, terrain-only 2,
  `river-wide` at (20, 3), river crossing), and the French line in step 9.
  The unit order matches `src/ui/testMode.ts:143-148`.
- **Progress numbers:** `vitest list` gives 1009 tests, 15 in the §53 blocks
  (8 engine, 7 format): base 994, +13, +2 this round.
- `npm run sdlc:scan -- --sample-due auto --exclude 53`: nth attested auto
  change = 2, every 3, `sampled: no`.
- `status: in-review`; the branch has no remote; `main` untouched.

**Taken on trust:** that the first player (row r=3) moves first in "Combat
test mode", and that Heavy chariots reach (20, 3) in one move (no browser
driven); round 1's byte-identity script and its equivalence calls for F2,
F6, F7, S11.

Scratch files, outside the repo:
`C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/mut53b/`
(reviewer) and `…/scratchpad/coord53/` (coordinator).

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 875ca84
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `1bc6ab3`.

Resolutions (round 2, in `26d5387`):
- **MEDIUM, the untarget e2e step couldn't fail (S6): fixed.** It waits for
  the count of attackers-alone lines to rise; S6 killed.
- **MEDIUM, the target-name join untested (F4): fixed.** A two-target case in
  English and French; F4 killed.
- **LOW, from-below `some` → `every` untested (E4): fixed.** A two-attacker
  case, in both orders; E4 killed.
- **LOW, the Progress test count: fixed** (base 994, +13, +2 this round).
- **LOW, the README example: fixed.** The line is exactly what the game writes
  for the live-check position.
- **LOW, S4 / S2: S4 fixed** (a galley select and deselect in
  `attack-log.spec.ts`); **S2 open**, worth a look (live check step 8).
- **LOW, S13: open**, worth a look (byte-identical by script).
- **S12 (a `toggleAttacker` refusal): open**, now a LOW finding.
- **Nit, the doubled blank line: fixed.**
