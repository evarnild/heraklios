<!-- generated-by: heraklios/review@0.1.5 -->
# §51 review — The army builder fills a unit type up to what the budget allows, or clears it, in one click

verdict: rework
tier: attested
reviewed-commit: 469702b
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** set by input 1, the paths (`src/scenes/**`, `src/ui/**`,
`src/engine/army.ts`, `e2e/**` and README wording are all Attested). Input 2
doesn't raise it: `review_tier:` is empty, and this is a digital-only
feature. Input 3 doesn't either: there is no CRITICAL or HIGH finding.

**Verdict:** `rework`, for one MEDIUM finding marked "Needs rework:": the
smoke scenario never proves that `«` and `»` change only their own row.
There is no "Needs decision:" finding. Passes run by the
`heraklios-reviewer` agent; the coordinator re-ran verify, check:intent,
e2e and both surviving mutants (below).

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. The diff is subtasks 1-5. The one divergence (the hook reader as a module-level `armyBuilderSnapshot`, for the lint cap) is recorded in Progress. |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass. Digital-only; the 400-point rule (`docs/research/02-rules-transcription.md:32`, `:40-41`) is unchanged, and Confirm still goes through `validateArmy`. |
| 4 | Tests prove the rule, not only pass | findings (1). 17 mutants: 15 killed, 2 survived (S9, S10). |
| 5 | Boundary and conventions | pass. The arithmetic is `filledCount` (`src/engine/army.ts:91-96`) with its interpretation comment (`:82-90`); the scene assigns 0, calls `filledCount` and sets alpha. |
| 6 | Numbers in prose | pass. 57 files, 994 tests, lint 21 and e2e 13 passed reproduce; the test comments' sums (390, 475) are right. `create` is now 122 lines, still one warning. |
| 7 | Documentation | pass. `README.md:87-89` names `»`, `«` and the dimming; the e2e line at `:36` has no count. |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21, `package.json` untouched, no new dependency. |
| 9 | Repository-specific footguns | pass, none apply (AI seats still skip the screen) |

## Type check
```
type-check: PASS (intent 51, feature)
  note:  6 file(s), 189 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `e2e/army-builder.spec.ts:33-53` (proving
  `src/scenes/ArmyBuilderScene.ts:109`, `:113`): two mutants survive.
  - **S9:** `«` wired to the first type
    (`selection[UNIT_TYPES[0]!.id] = 0`).
  - **S10:** `»` wired to the first type
    (`selection[UNIT_TYPES[0]!.id] = filledCount(selection, UNIT_TYPES[0]!.id)`).

  The scenario only clears or fills row 0 (archers); its other click (`»`
  on row 3) comes with the budget spent, so it can't show which type is
  written. Spec B2 and B3's "No other type's count changes" is unproven,
  though the plan's Tests table claims AC2 catches "the wrong type".
  Needs rework: drive a second row while another type holds a count, and
  assert the whole `counts` object. For example, `»` row 0 then `»` row 3
  gives archers 10, fantassins-lourds 8, total 130; then `«` row 3 gives
  archers 10, fantassins-lourds 0, total 50.
- **LOW** `src/scenes/ArmyBuilderScene.ts:104-105`: the buttons sit edge to
  edge (`«` spans x 370-401 and `-` 400-431; `+` 460-491 and `»` 490-521),
  so each pair reads as one bar, and a dimmed `«` looks like the dark half
  of `-`. This matches the spec's positions, so it is not a defect. Worth a
  look in the live check; a gap would change the spec (a decision for you).
- Nit: `spec.md`'s source table cites `02-rules-transcription.md:33` and
  `:41`; the passages are at `:32` and `:40-41`.

## Not checked
- **On-screen text:** the hook's `total` and `counts` come from
  `session.armySelections` and `validateArmy`, not from the rendered
  `totalText` or `countTexts`. The on-screen total, its colour, the error
  lines and Confirm's alpha after `«`/`»` are for the live check (S7 and S8,
  a missing `refresh()`, are killed through the alpha `refresh()` sets).
- **French:** the e2e runs in English only (the reviewer's probe ran French,
  with no scenario).
- **The second hotseat seat:** `clearBtns` and `fillBtns` are rebuilt per
  `create`; not exercised by e2e.
- **The dev hook:** no mutants run on it; its guard by name and read-only
  copy were checked by reading.
- **Production build:** the hook's absence is taken from `src/main.ts:27`
  (`import.meta.env.DEV`) and the e2e global setup's check.
- **Visual judgement:** whether the edge-to-edge buttons and 0.4 dimming read
  clearly (LOW above).

## Live check
- **Owed** by rule 1 (`src/scenes/ArmyBuilderScene.ts`, `src/ui/devHook.ts`).
  The smoke-suite exception doesn't apply: the behaviour is new and visual.
- **Steps** (after the rework):
  1. In `C:/Users/eric/src/heraklios-wt/51-army-builder-max-clear`, run
     `npm run dev -- --port 5251 --strictPort --host 127.0.0.1` and open
     `http://127.0.0.1:5251/`.
  2. In the Menu, pick **2** players; you land in player 1's army builder.
  3. On the empty army, every `«` is dimmed and every `»` bright.
  4. `»` on Archers: 10, total 50/400 in red with an "under budget" line;
     Archers' `»` dims and `«` brightens.
  5. `»` on Heavy infantry: 8, total 130.
  6. `«` on Archers: Archers 0 and their `«` dims; Heavy infantry stays 8,
     total 80.
  7. `»` on Quinqueremes (1, total 130), then on Triremes (3, total 220).
  8. `+`/`-` on a row: its `«`/`»` dimming follows.
  9. "Use default army": total 400/400 in yellow, no error line, "Confirm
     army" bright; every `»` dimmed, and clicking one changes nothing. `«`
     on a row drops it to 0 and brightens the `»` of rows whose cost now
     fits.
  10. Confirm, and check player 2's builder the same way.
  11. Abandon to the Menu, switch to French, and repeat 2-9. The cost column
      ("10 pts  (max 8)") must not touch `«`.
- **You should see:** counts and the total follow spec B2-B4, the dimming
  B5. Also judge the edge-to-edge buttons (LOW).

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at `469702b`, tree clean):
- `npm run verify`: exit 0, 57 files, 994 tests, lint 21 of 21 (matches the
  reviewer and the implementer).
- `npm run check:intent`: PASS, 6 files, 189 lines (matches).
- `npm run e2e`: 13 passed, including `e2e/army-builder.spec.ts:13`
  (matches).
- S9 (`ArmyBuilderScene.ts`, `«` wired to the first type): file changed,
  `npx playwright test e2e/army-builder.spec.ts`: 1 passed, **survived**
  (matches).
- S10 (`»` wired to the first type): 1 passed, **survived** (matches).
  Both restored by copy; `git status --short` empty, `git diff --quiet`
  passes.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`, `check:intent` and `npm run e2e` (13 passed in 27.2 s)
  as above.
- Engine mutants on `src/engine/army.ts`, full vitest each, restored by
  copy: E1 (drop the `min` with `maxCount`), E2 (floor to ceil), E3
  (`remaining` to `ARMY_BUDGET`), E4 (drop the `max(count, …)`), E5 (write
  into the input), E6 (count read as 0): all killed by the AC1 tests.
- Scene mutants on `ArmyBuilderScene.ts`, with the army-builder spec each:
  S1 (`«` doesn't set 0), S2a (`»` acts like `+`), S2b (`»` ignores the
  budget), S3/S4 (`«` dimming inverted/removed), S5/S6 (`»` dimming
  inverted/removed), S7/S8 (no `refresh()`): all killed; S9 and S10
  survived.
- A browser probe on its own `vite` at 5251 (saves dir in the scratchpad),
  English and French: button centres 385.5, 415.5, 475.5, 505.5; `»` row 3
  gave 8, `»` row 12 gave 3 (total 170); `«` row 3 left triremes 3 (total
  90); no console errors. Server stopped, port 5251 free. Evidence only, not
  the live check.
- `npm run sdlc:scan -- --sample-due auto --exclude 51`: nth attested auto
  change = 1, every 3, `sampled: no`.
- Nothing pushed; no commit or file written by the reviewer.

**Taken on trust:** nothing from the implementer's summary.
