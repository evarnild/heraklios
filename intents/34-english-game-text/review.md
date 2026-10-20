<!-- generated-by: heraklios/review@0.1.4 -->
# §34 review — English for all game text except unit and country names

verdict: attest
tier: attested
reviewed-commit: 3d034d87c5cf7059c8a8dc2d3b2929c4107b03d7
round: 1
sampled: no
live-check: owed

Tier set by the path table: `src/ui/**`, `src/scenes/**`, `src/map-editor/**`
and tests/e2e are Attested; nothing touches a Reviewed path. The intent sets
no `review_tier`, and the feature adds no rulebook rule (digital-only text).
No finding is CRITICAL/HIGH and no Not-checked item bears on rule
correctness, so nothing raised it.

`reviewed-commit` is the branch head. It differs from the last code commit
(`de86c5d`) only by `3d034d8`, which edits `metadata.yml` (the recorded
`live_checked:`).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass |
| 4 | Tests prove the rule | findings (2) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository-specific footguns | pass |

Notes per pass:

1. The diff is the plan's five subtasks and nothing else: three Menu
   labels, five `RESULT_LABELS`, seven `TERRAIN_LABELS`, the new
   `PALETTE_LABELS` + `main.ts` switch, three README lines, the comments that
   quote a Menu label, `e2e/helpers.ts`. No `src/engine/` or `src/data/`
   change, no refactoring mixed in. The unrequested commit `3d034d8` only
   records the live check.
3. Re-read `docs/research/02-rules-transcription.md` myself. Terrain table
   l. 108-113: "Plaine (plain)", "Rivière large (wide river)", "Flancs abrupts
   (steep flanks)", "Plateaux (plateau)", "Marais (marsh)". Naval section
   l. 216-217: "coastal fringe (light blue), mid-sea (medium blue, the
   deployment zones), and high seas (dark blue)". Combat results l. 153-157:
   AE Attaquant Éliminé / AR Attaquant Recule / DE Défense Éliminée /
   DR Défense Recule / EX Échange. The seven game labels and five result
   words match, and the code letters are kept first as the spec says. The
   French strings in `PALETTE_LABELS` equal the old `TERRAIN_LABELS` text from
   `main` (diffed, not retyped).
4. Mutations below. Two gaps, both LOW.
6. Spec's "35 vs 36, 46 vs 46, 11 vs 18" character counts: "Test mode (2
   players, armies ready)" is 35, "Mode test (2 joueurs, armées prêtes)" 36;
   "Combat test mode (units face to face, 2 hexes)" 46, the French 46;
   "Load a game" 11, "Charger une partie" 18. Counted, they hold. Plan's
   "637 tests" and "lint cap 21" reproduced.
7. `README.md` l. 114, 125, 189 quote the new labels; `:584-585` (editor
   palette) correctly stays French. No "Known simplification" involved.
   `CLAUDE.md` is unaffected.
8. `npm run lint`: 21 warnings, cap 21 on both `main` and the branch, no
   `eslint-disable` added, no new dependency.
9. No drift, AI-tier or generated-map change. The editor's `main.ts` was
   edited by hand, not regenerated, and is not a generated file.

### Mutation table (pass 4)

Each mutation applied with `sed`, checked that the file actually changed,
`npx vitest run src/ui src/map-editor` run, file restored from a backup copy.

| # | Mutation | Result |
| --- | --- | --- |
| M1 | `plain: 'Plain'` → `'Plaine'` | killed (3 failures) |
| M2 | `plateau: 'Plateau'` → `'Plateaux'` | killed (2 failures) |
| M3 | `sea: 'High seas'` → `'Sea'` | **survived** |
| M4 | `coast: 'Coastal fringe'` → `'Coast'` | **survived** |
| M5 | `marsh: 'Marsh'` → `'Swamp'` | **survived** |
| M6 | `'steep-flank'` → `'Cliffs'` | **survived** |
| M7 | `'river-wide'` → `'Rivr'` | **survived** |
| M8 | `PALETTE_LABELS.marsh` → `'Marsh'` | killed (2 failures) |
| M9 | `main.ts` reads an empty table instead of `PALETTE_LABELS` | **survived** (no test reaches `main.ts`; DOM wiring) |
| M10 | `RESULT_LABELS.AE` → "attacker destroyed" | **survived** (no test reaches it; plan accepts this) |
| M11 | Menu `'Load a game'` → `'Load game'` | **survived** (no e2e scenario clicks that button) |

The suite for M1-M9 was scoped to the two directories that hold the changed
tests, not the full 637; M10 and M11 sit in `src/scenes/`, which no unit test
imports, so a full run could not kill them either.

## Type check
```
type-check: PASS (intent 34, feature)
  note:  15 file(s), 129 line(s) changed outside intents/.
```

## Findings
- **LOW** `src/map-editor/paletteLabels.test.ts:36` — the "translates the
  seven non-zone game labels" test only asserts game label ≠ palette label,
  so five of the seven English words (sea, coast, marsh, steep-flank,
  river-wide; M3-M7) can be changed to anything non-French without a test
  failing. Only plain and plateau are pinned (AC1, as the spec wrote it).
  Worth a look: pin the five strings in `hexTooltip.test.ts` or here if the
  wording should not drift. Not rework: the spec's AC1 asked for exactly two.
- **LOW** `src/map-editor/main.ts:82` — the editor's switch to
  `PALETTE_LABELS` (M9) has no automated check; the plan names AC3's test as
  the guard, but that pins the table, not the reader. If the line were reverted
  the editor would show English and nothing but the live check would notice.
  Worth a look: the live check is recorded, so it is covered today.

## Not checked
- **AC5, the combat log's "Result:" text** (`BoardScene.ts:2509-2513`). No
  test and no e2e scenario reaches `logCombatOutcome`'s string; I did not
  open the game and read it. Covered by the owner's live check, not by me.
- **AC7 and the Menu buttons' layout.** I did not look at the Menu, so I did
  not see that the shorter/equal-length labels keep their positions, or the
  "Load a game" button (no e2e scenario clicks it; M11).
- **The editor's palette on screen.** I did not open `/map-editor.html`.
- **A French string the accented sweep can't see.** The sweep (below) finds
  accented literals only. I added a word-level grep for common unaccented
  French (plaine, mer, partie, joueurs, tour, mode, charger, quitter, …)
  over the same files; every hit was an English "case"/"mode" in a comment or
  log text. Strings built from `src/data/` (unit names) are exempt by intent,
  and I did not re-audit `src/data/` for other player-visible French.
- **Saves.** `SAVE_VERSION` and `GameState` are untouched, so I did not
  round-trip a save. Player names are saved and unchanged.

## Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`, `src/map-editor/**` touched), and
  rule 3 for AC5 (runtime-only item above). The smoke suite does not stand in:
  no scenario covers the combat result text, and the change is visual.
- status: `metadata.yml` already holds `live_checked: 2026-10-20 by-agent`
  recorded on the owner's "live check done", so `check:intent` passes. This
  report adds nothing the owner has to redo.
- if repeating: `npm run dev` (port 5200+(34 mod 100) = 5234 in the
  worktree, else 5173) → Menu → read the three button labels; "Combat test
  mode" → hover a plain hex ("Plain"), a sea hex ("High seas" or "Coastal
  fringe") and a zone hex (its French place name); make one attack →
  combat log reads "Result: XX — <English words>"; open `/map-editor.html`
  → palette still French.
- you should see: English Menu buttons, English tooltip names, French zone
  names, English result words after the code, and a French editor palette.

## Verified myself vs. taken on trust
- `npm run verify` (worktree, `3d034d8`): build + lint + test green, 38 files,
  637 tests passed, lint 21 warnings (cap 21).
- `npm run check:intent`: PASS (output above).
- `npm run e2e`: 4/4 passed (land-move, attacks, naval, save-load).
- `git diff main...HEAD`: read in full for `src/`, `e2e/`, `README.md`.
- Accented-literal sweep over `src/scenes`, `src/ui`, `index.html`
  (comments and test files excluded): only `HÉRAKLIOS`, "Jeux & Stratégie #6
  (1980)", `Cap Zénon`, `Athènes`/`Macédoine` (default names), and
  `<title>Héraklios</title`. All are B6 exceptions.
- `grep "Mode test|Charger une partie"` outside `intents/`, `plan-history.md`,
  `docs/research/`, `node_modules`: nothing.
- Mutation table above: run by me, `git status --short` clean afterwards.
- Taken on trust: the implementer's Progress note that the live check found
  nothing, and the owner's "live check done" (I did not drive the browser).
