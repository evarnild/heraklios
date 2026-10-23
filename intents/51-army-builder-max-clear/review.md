<!-- generated-by: heraklios/review@0.1.5 -->
# §51 review — The army builder fills a unit type up to what the budget allows, or clears it, in one click

verdict: attest
tier: attested
reviewed-commit: e404793
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** set by input 1, the paths, as in round 1. Inputs 2 and 3 don't
raise it: `review_tier:` is empty, and there is no CRITICAL or HIGH finding.

**Verdict:** `attest`. The round-1 MEDIUM is resolved (S9, S10 and a new S12
are killed), and no finding needs rework. The reviewer agent proposed
`escalate`; the coordinator restated it as `attest`, because the policy
gives `escalate` only at the Reviewed tier. Before the merge, the live check
is owed (rule 1), and the carried LOW is yours to judge in it.

Round 2 covers `a2f1626` (the e2e rework) and `e3e765f` (Progress);
`e404793` only sets `auto_round: 2`. Passes run by the `heraklios-reviewer`
agent; the coordinator re-ran verify, check:intent, e2e, S9, S10 and S12.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. `a2f1626` is one 13-line block (`e2e/army-builder.spec.ts:39-50`), as round 1 asked; `plan.md` changed only below `## Progress`; no change to `src/`, `spec.md`, README or the button positions. |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass, unchanged from round 1 |
| 4 | Tests prove the rule, not only pass | pass. S9, S10 and S12 killed; round 1's other 15 mutants are on code unchanged since `469702b`. |
| 5 | Boundary and conventions | pass, unchanged (the rework is e2e only) |
| 6 | Numbers in prose | pass. Progress's counts reproduce; "fantassins-lourds, 10 pt, max 8" matches `src/data/units.ts:61-65`; 10×5 + 8×10 = 130. |
| 7 | Documentation | pass, unchanged |
| 8 | Guardrails and hygiene | pass. Lint 21 of 21; `package.json` untouched. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: FAIL (intent 51, feature)
  error: A live check is owed and not recorded. Do the steps in intents/51-army-builder-max-clear/review.md → ## Live check, then set live_checked: <date> in intents/51-army-builder-max-clear/metadata.yml.
  note:  6 file(s), 202 line(s) changed outside intents/.
```
The only error is the owed live check, which you clear; not rework.

## Findings
- **LOW (carried, yours)** `src/scenes/ArmyBuilderScene.ts:104-105`: the
  buttons sit edge to edge (`«` x 370-401 against `-` 400-431; `+` 460-491
  against `»` 490-521), so each pair reads as one bar. These are the spec's
  positions, so it is not a defect. Worth a look in the live check; a gap
  would change spec B1 (a decision for you).
- **Nit (carried):** `spec.md`'s source table cites
  `02-rules-transcription.md:33` and `:41`; the passages are at `:32-33`
  and `:40-41`.

## Not checked
- **On-screen text:** the rendered total and its colour, the error lines and
  Confirm's alpha after `«`/`»`. The hook reads the session, not the
  rendered text.
- **French:** the e2e runs in English only.
- **The second hotseat seat:** not exercised by e2e.
- **The dev hook:** no mutants on it.
- **Production build:** the hook's absence is taken from `src/main.ts:27`
  and the e2e global setup.
- **Visual judgement:** the 0.4 dimming and the edge-to-edge buttons.
- **Merge state:** the branch is 4 commits behind `main` (§52's intent and
  spec files only, no overlap). No merge tried.

## Live check
- **Owed** by rule 1 (`src/scenes/ArmyBuilderScene.ts`, `src/ui/devHook.ts`).
  The smoke-suite exception doesn't apply: the behaviour is new and visual.
- **Steps:**
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
**Coordinator, re-run** (worktree at `e404793`):
- `npm run verify`: exit 0, 57 files, 994 tests, lint 21 of 21 (matches).
- `npm run check:intent`: FAIL only on the owed live check, 6 files, 202
  lines (matches).
- `npm run e2e`: 13 passed, including `e2e/army-builder.spec.ts:13`
  (matches). Port 5232 free before.
- S9 (`«` wired to the first type), S10 (`»` wired to the first type), S12
  (`«` clears every type), one at a time on `ArmyBuilderScene.ts`, each
  checked as applied, with `npx playwright test e2e/army-builder.spec.ts`:
  **1 failed each, killed** (matches). Restored by copy; `git diff --quiet`
  passes, `git status --short` empty.
- Note: the coordinator's first verify and e2e run overlapped with the
  mutant runs; both were re-run alone on the clean tree, with the results
  above.

**Reviewer agent** (same worktree and HEAD):
- `git diff ff024e8..e404793` read in full: e2e +13, `plan.md` Progress +10,
  `metadata.yml` `auto_round`.
- `npm run verify`, `check:intent`, `npm run e2e` (13 passed in 28.0 s),
  S9, S10, S12 as above.
- `npm run sdlc:scan -- --sample-due auto --exclude 51`: nth attested auto
  change = 1, every 3, `sampled: no`.
- `main` is untouched by the branch; nothing pushed.

**Taken on trust:** round 1's other 15 mutants were not re-run (their code
is unchanged).

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 469702b
- round: 1
- sampled: no
- run: auto
- live-check: owed

Resolutions (round 2, in `a2f1626`):
- **MEDIUM, S9 and S10 survived (the e2e never proved "no other type's
  count changes"): fixed.** The scenario fills and clears row 3 while
  archers hold 10 and asserts the whole `counts` object; S9, S10 and the
  new S12 are killed.
- **LOW, edge-to-edge buttons: carried, yours** (live check).
- **Nit, spec citation lines: carried, yours.**

