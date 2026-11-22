<!-- generated-by: heraklios/review@0.2.0 -->
# §76 review — Placement shows the armies other players have already placed

verdict: attest
tier: attested
reviewed-commit: 9c2c3a820653fb035e7464814667e5ab1fcc5e86
round: 1
sampled: yes
run: auto
live-check: owed

- **Tier: Attested.** The path table sets it: `src/ui/**`, `src/scenes/**`,
  `e2e/**`, `scripts/size-baseline.json` and README wording. The change adds
  no rulebook rule, and `src/engine` and `src/data` are untouched.
- **Sampled: yes.** `npm run sdlc:scan -- --sample-due auto --exclude 76`,
  run in the main checkout at `b7fe950`, printed `nth attested auto change =
  12, every 3, sampled: yes`. Run in the worktree, which predates §75, it
  prints 11. Main's count is the one that holds at merge, so a full read of
  the diff after the merge is due.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: subtasks 1–6 and nothing more. The one divergence (the e2e switches to Drawn before its first-frame count) is recorded in Progress and judged below |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass: `05-rules-french-original.md:91-96` quoted word for word; `02-rules-transcription.md:44-46` agrees; nothing hides deployment |
| 4 | Tests prove the rule | findings (2): the dim-application mutants survive (MEDIUM, accepted by the spec); M13c (LOW) |
| 5 | Boundary and conventions | pass: the dimming logic is a pure tested `src/ui` helper; no `GameState` change; I1–I3 commented; B10 holds |
| 6 | Numbers in prose | pass: 548 → 526, and every count in Progress was reproduced |
| 7 | Documentation | pass |
| 8 | Guardrails and hygiene | pass: lint 19 warnings (cap 19) |
| 9 | Repo footguns | pass |
| 10 | Architecture | findings (1, Worth a look): §77 merge coordination |

**The e2e divergence doesn't weaken B1 where it matters.**
- The view toggle replays `MapView`'s last recorded `setUnits` list. So the
  Drawn count after the toggle proves that Placement handed seat 0's drawings
  to the view before any click.
- M12 (no `redrawPlacedUnits()` in `create`) is killed by exactly that
  assertion.
- What is lost is only the Standard view's own first frame. Its markers are
  unnamed, so no reader can see them. That part belongs to the live check.

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 76, feature)
  note:  14 file(s), 421 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** Six surviving mutants sit on the lines that actually apply the
  dim:
  - `src/ui/drawnUnits.ts:163`, `:201`;
  - `src/ui/standardBoardView.ts:168`, `:250`;
  - `src/ui/hexDraw.ts:40-41`.

  These are M2, M3, M4, M5, M6 and M20, and each survives the full vitest
  and e2e suites. No automated test proves that anything is drawn dimmed;
  only the pure parts are pinned. The spec accepted this gap (no alpha reader
  on the dev hook), the plan lists it in Risks, and the live check is the
  stated proof.
  - Worth a look, not rework, because closing it would reverse an accepted
    spec decision. Now that §75 has merged, a follow-up intent could add a
    `unitAlpha(id)` reader to the dev hook and assert it in
    `placement-earlier-armies.spec.ts`.
- **LOW** `src/scenes/PlacementScene.ts:114` (`this.history.clear()`, a line
  this diff doesn't change): M13c survives.
  - The e2e follows AC4 exactly: one Ctrl+Z, then one Ctrl+Y. It never
    undoes past seat 1's own placement.
  - Worth a look: a second Ctrl+Z in `e2e/placement-earlier-armies.spec.ts`,
    asserting that both of seat 0's units are unchanged, would kill M13c.
- **LOW** (coordination with §77): the two branches conflict.
  - `git merge-tree` reports content conflicts in `src/ui/drawnUnits.ts`,
    `src/ui/standardBoardView.ts` and `src/ui/boardView.test.ts`.
  - `boardView.ts` auto-merges with two `export function unitAlpha`. tsc
    catches that.
  - Whichever branch rebases second keeps §76's body and its wider parameter
    type, since `standardBoardView.ts` passes a `FacingShip`. Both plans say
    so.
- **Nit:** `getUnitType(u.typeId).domain === 'naval'` is repeated in both
  `placementDrawings.ts` helpers.

## Not checked
- Whether anything is actually drawn at alpha 0.6: Standard markers, Drawn
  containers, dimmed arrowheads and their outline. This is runtime only,
  so it rests on the live check.
- The Standard view's first frame (B1 in Standard). There is no reader for
  it.
- B8 in the browser (a computer seat 0, then a human seat 1). It is proved
  only by the unit test.
- The I2 boxed-in fallback.
- The merge with current main. `git merge-tree main HEAD` is clean; `/ship`
  runs verify after the merge.
- Mutants on comments and README text, `confirmPendingShip`'s derived arrows,
  and `shipArrowList`'s argument order.
- Two flakes unrelated to the diff, seen during the mutation runs:
  - `server/fileSaveFs.test.ts`'s transient-rename test;
  - one `view-centre.spec.ts` startup timeout.

## Live check
- **Owed** under rule 1 (`src/scenes/PlacementScene.ts`, `src/ui/**`) and
  rule 3. The change is visual, and the alpha and the Standard first frame
  need a live run.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/76-placement-shows-placed-armies`,
     run `npm run dev -- --port 5276 --strictPort --host 127.0.0.1` and open
     http://127.0.0.1:5276/.
  2. Click "2" on the Menu, then "Use default army" and "Confirm army" for
     both seats.
  3. In seat 0's Placement, place 3–4 land units and both ships. Turn one
     ship before confirming it. Then press **Done placing**.
  4. In seat 1's Placement, in the **Standard view and before clicking
     anything**:
     - seat 0's counters are there, dimmed, in seat 0's colour;
     - seat 0's ships have a dimmed arrowhead.

     Judge whether 0.6 reads well. Any value from 0.4 to 0.75 needs no spec
     amendment.
  5. Toggle to the **Drawn view** and back. Then place a land unit, stage a
     ship, Turn, Cancel, stage again, Confirm, Ctrl+Z, Ctrl+Y.
  6. Click a seat-0 unit, then hover it.
  7. Start a new game with the first seat set to an "AI — …" level and the
     second seat Human, and confirm the armies.
  8. Back in a game with only human seats, finish seat 1's placement and
     reach the Board.
- **You should see:**
  - **After step 5:** seat 0's units stay dimmed and in place through every
    toggle, undo and redo, and seat 1's own units stay opaque. The staged
    ghost ship (alpha 0.5) can be told apart from seat 0's dimmed galleys.
    In the Drawn view, seat 0's galleys point their facing.
  - **After step 6:** the click does nothing. The hover shows the hex line,
    then `<unit> — <seat-0 name> (<colour>)` and the values line, with no
    state line.
  - **After step 7:** the computer's army is shown, dimmed.
  - **After step 8:** on the Board, every unit is at full opacity in both
    views, and the ship arrows look as before.

## Verified myself vs. taken on trust
- **Coordinator, re-run:** `npm run verify` at 9c2c3a8. Exit 0, lint 0
  errors and 19 warnings (cap 19), 97 files, 1681 passed and 2 skipped.
  Matches.
- **Coordinator, re-run:** `npm run check:intent`. PASS. Matches.
- **Coordinator, re-run:** `npm run e2e`. 32 passed (1.0m). Matches.
- **Coordinator, re-run:** the seven surviving mutants. Each was backed up
  and restored by copy, and each ran the full vitest and full e2e suites.
  - Every one survived, with vitest at 1681 passed and e2e at 32 passed:
    - M2: `settle` back to `setAlpha(1)`;
    - M3: `make` without the alpha;
    - M4: `makeMarker` without `setAlpha`;
    - M5: the arrow drawn without `unitAlpha(ship)`;
    - M6: `fillStyle(color, 1)`;
    - M20: outline `0.9`;
    - M13c: `history.clear()` removed.
  - `git status --short` was clean afterwards. All seven match the reviewer.
- **Reviewer:**
  - verify, check:intent and e2e, with the same counts.
  - 22 mutants: 15 killed and 7 survived. Killed:
    - M1: `unitAlpha` returns 1;
    - M7–M11 and M14–M19: the `placementDrawings` and `reconcileUnits`
      logic;
    - M12: no draw on open;
    - M13a and M13b: undo restore.
  - The rulebook passages, B10's empty diff, and merge-tree against main
    (clean) and against §77 (conflicts as above).
- **Taken on trust:**
  - the visual result of the dim;
  - that the Menu offers an "AI — …" level for seat 0;
  - that §77's rebase will keep §76's `unitAlpha`, as its plan states.
