<!-- generated-by: heraklios/review@0.1.4 -->
# §35 review — Play the game in several languages, French and English first

verdict: rework
tier: reviewed
reviewed-commit: 633d10a
round: 1
sampled: no
live-check: owed

Tier set by input 1 (paths) and input 2 (metadata), which agree:
`src/engine/saveGame.ts` and `src/ui/saveStorage.ts` are Reviewed paths,
and `review_tier: reviewed` was set at the spec gate. One MEDIUM needs
rework: a risk the plan named (drift narration order) is held only by
reading, not by a test. Everything else is LOW. The rules, the save
format and the drift order are unchanged.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — B1–B12 built; the divergences in Progress (save errors as data, three more engine label functions moved, the Army Builder's error line, structured reports, fit changes) are declared and in the spec's direction. See L9 for one understated sentence |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — no rule changed. Two French rule terms differ from the French original (L6, L7) |
| 4 | Tests prove the rule, not only pass | findings (2) — 73 mutants, 46 killed, 27 survived (5 of them equivalent or unreachable). Survivors: 8 drift-narration mutants (the MEDIUM), 5 on the name helpers and colour table, and smaller gaps (LOWs) |
| 5 | Engine/presentation boundary and conventions | pass — the engine now returns data (`ArmyError`, `SaveError`, reason codes, `onNarrate(event)`); text lives in `src/ui/i18n/`. `GameState` shape and `SAVE_VERSION` unchanged |
| 6 | Numbers in prose | findings (1) — L9 |
| 7 | Documentation | findings (2) — README "Language" paragraph (L8); a stale comment (L10). CLAUDE.md already describes `src/ui/i18n/` |
| 8 | Guardrails and hygiene | pass — lint 21 warnings, cap 21, and the same 21 as `main` (same files, rules, functions); no new dependency; no save or player text reaches `innerHTML` |
| 9 | Repository-specific footguns | pass — the drift switch returns as before; `onNarrate` sits exactly where `onLine` did (compared with `main`). Fuzz and soak suites untouched |

## Type check
```
type-check: PASS (intent 35, feature)
  note:  42 file(s), 2704 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/engine/drift.ts:569-616` — the plan's own risk ("`onNarrate`
  is called at exactly the points `onLine` is today … so the log and the
  pacing don't move") is true by inspection, but only the marsh elimination
  is tested (`drift.test.ts:131-146`). Removing `onNarrate` from
  `driftStarted`, `directionRolled`, `moved`, `stopped`,
  `driftElephantDestroyed` or `repelled`, or moving it after
  `onDirectionRolled`/`onDriftMoved`, leaves all 681 tests green. Needs
  rework: a `drift.test.ts` case that records every hook call in order
  (`onDriftStart`, `onNarrate(kind)`, `onDirectionRolled`, `onDriftMoved`,
  `onRender`) for a scripted drift with a move and a stop, and one with a
  drift combat (repelled or destroyed), asserting the sequence.
- **LOW** `src/ui/i18n/names.ts:23-41`, `en.ts:50` — `edgeName`,
  `colorName`, `phaseName`, `seatControlName` are untested, and nothing ties
  `en.colors`' order to `PLAYER_COLOR_NAMES`: swapping yellow and red in the
  table passes, and the status line would name the wrong colour. Worth a
  look: one test per helper in French, plus colours vs `PLAYER_COLOR_NAMES`.
- **LOW** `src/ui/i18n/format.test.ts:101-106` — the sea-exit sentence isn't
  pinned in either language (replacing it with the off-map sentence
  passes). Worth a look.
- **LOW** `src/ui/i18n/noLiterals.test.ts` — the scan doesn't look at helper
  calls (`this.button(x, y, 'Export to file', …)` in `saveLoadPanel.ts`,
  `buildRow(`), which is where several labels lived on `main`, and it reads
  only the top level of `src/scenes/` and `src/ui/`. AC1 didn't list these
  calls. Worth a look.
- **LOW** small untested paths: page `lang` set on the first resolve
  (`index.ts:55`), the `unreadable` save error (`saveStorage.ts:180`, DOM),
  test-mode default names (`testMode.ts:56`, `:129`), `|| 'none'` in the
  exchange line (`en.ts:242`), `joinNames` for three or more names
  (`en.ts:330-333`, `fr.ts:315-318`). Worth a look.
- **LOW** French agreement — `fr.ts:126-134` and the log sentences treat
  every unit as masculine singular: "Éléphants … il dérive … est éliminé",
  "Cavalerie Légère est repoussé". Unit names are plural or feminine. (The
  English "Elephants is destroyed" was already on `main`.) Worth a look:
  sentences that don't agree with the subject ("… est éliminé(e)(s)"), or
  a gender/number per unit in `names.ts`.
- **LOW** `src/ui/i18n/fr.ts:249`, `:275` — "TRC" is an invented acronym; the
  French original says "table des résultats"
  (`05-rules-french-original.md:149`, `:220`). Worth a look.
- **LOW** `src/ui/i18n/fr.ts:277`, `:281-282` — boarding losses read
  "d'équipement"; the rulebook's term is "points d'équipage"
  (`05-rules-french-original.md:426-432`; the transcription's "equipment"
  is a gloss). Worth a look.
- **LOW** `src/ui/i18n/fr.ts:74` "Retiré au sort à chaque tour" reads as
  "withdrawn by lot" — "Tiré au sort"; `:114` "(${left} restant)" doesn't
  take the plural; `:83-84` "Qui joue chaque place" is awkward. Worth a look.
- **LOW** `README.md:60` — "a game plays in the language it started in" is
  not true of a loaded game, which plays in the current language and keeps
  only its saved names. Worth a look: say so.
- **LOW** `intents/35-game-languages/plan.md:237` (Progress) — "One English
  text changed" understates it: every English unit, country and zone name
  changed too (spec B5/B6/B8, so expected). Worth a look: "beyond B5/B6/B8's
  names, one English text changed".
- **LOW** `src/scenes/BoardScene.ts:1338-1342` — the comment still says it
  indexes `PLAYER_COLOR_NAMES`; the code calls `colorName(activeId)`. Worth a
  look.
- **LOW** (not this change, seen before) `e2e/save-load.spec.ts:60` — failed
  once in the first full `npm run e2e` ("the loaded game equals the one
  saved"), then passed alone, 6× in parallel and 3× the whole suite (12/12).
  Same scenario as §33's round-1 flake; the assertion is now known. Worth a
  look: open a fix intent (the grid of 2026-10-20 proposes it).

## Not checked
- **Drawn layout and fit** in either language: I didn't render the game.
  The implementer's screenshots (Progress → Fit) and your live check are
  the evidence. The Progress lists what it could not measure: the board's
  report text for a real land or boarding result, and the advance,
  exchange and boarding prompts.
- **BoardScene wiring at run time** beyond what the four e2e scenarios
  drive (English only). No e2e scenario runs in French.
- **French reading as a whole.** The reviewer read the tables and flagged
  what is wrong or unidiomatic (L6–L9); a native reader in play is the
  real check.
- Mutants on `BoardScene.ts`, the other scenes and `saveLoadPanel.ts`: not
  run — no unit test reaches them; the scan test and e2e are their only
  automated cover.

## Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`). Recorded
  `live_checked: 2026-10-20 by-agent` in `633d10a` on your "live check
  done", against the steps in `plan.md` → Validation.
- The MEDIUM's fix is a test in `src/engine/` and changes no behaviour: if
  the rework touches only tests and docs, the recorded check stands. If it
  also changes `fr.ts` wording (L6–L9) or any scene, clear `live_checked:`
  and look again at the changed texts.
- **Could be an e2e scenario** (your request, 2026-10-20): a `language`
  scenario that clicks **Français** on the Menu, checks a French Menu label
  and `document.documentElement.lang === 'fr'`, reloads and finds French
  still chosen, starts Test mode and finds a French line in the log, then
  switches back. Plus a first-visit run with Playwright's `locale: 'fr-FR'`
  and empty storage that opens in French. That covers B3, B4 and B10
  without you. Fit and the quality of the French stay a person's check.

## Verified myself vs. taken on trust
- `git log main..feat/35-game-languages`: 7 commits, `87aca3d`…`633d10a`;
  merge base `02a7bab` (current `main` before the grid commit). `status:
  in-review`, `live_checked` recorded in `633d10a`.
- `npm run verify` (worktree, `633d10a`): lint 0 errors / 21 warnings (cap
  21); Vitest 44 files, **681 passed**.
- Lint warnings compared with `main` via `eslint -f json`: the same 21
  (file, rule, function), none new.
- `npm run check:intent`: PASS (above).
- `npm run e2e`: run 1 — 3 passed, 1 failed (`save-load.spec.ts:60`);
  `save-load` alone 1/1; `--repeat-each=6` 6/6; whole suite
  `--repeat-each=3` 12/12.
- Delegated to the `heraklios-reviewer` agent: the mutation pass (73
  mutants, file backed up and restored byte for byte each time, `git diff`
  confirming each mutant applied), the `tsc` checks on `fr.ts` (deleted key
  → TS2741, extra key → TS2353), the drift-order comparison with `main`,
  the engine diff (every changed line is text → data; removed tests were
  label tests), the English-text diff against `main`, the French read.
- Re-run myself from that: mutant D5 (drop `onNarrate` for `moved`) →
  681/681 pass, so the MEDIUM is real; the `drift.ts` switch shows
  `onNarrate` at the seven points; `fr.ts:74`, `:114`, `:126-134`, `:249`,
  `:275-282` and `README.md:56-65` read as quoted; `CLAUDE.md:210` has the
  i18n bullet.
- `git status --short` in the worktree afterwards: only this `review.md`,
  untracked.
- Taken on trust: the agent's other 72 mutant results; the implementer's
  fit screenshots; your live check.
