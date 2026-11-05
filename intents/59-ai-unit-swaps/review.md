<!-- generated-by: heraklios/review@0.1.5 -->
# §59 review — Computer players use unit swaps

verdict: rework
tier: attested
reviewed-commit: 1966abd
round: 1
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table: `src/engine/**` plus a comment in
`src/scenes/**`. `review_tier` is empty, the feature is digital-only, and
there is no CRITICAL or HIGH finding.

**Verdict:** `rework`, on three findings, each fixed by a test the spec
determines. The feature works and every number reproduces:
- the swaps-off fingerprints were recorded from unchanged code;
- every soak figure checks out;
- no assertion was loosened;
- lint stays at 21.

But 4 of 33 mutants survive on lines this diff changed. Each one breaks
behaviour the spec states. There is no "Needs decision:" finding. Passes were
run by the `heraklios-reviewer` agent. The coordinator re-ran verify,
check:intent, e2e and the four survivors.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: B1-B15 and AC1-AC11 are met (AC10 by the live check); the four divergences are acceptable (below) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass, nothing to check: digital-only; `swapStep`, `legalActions` and `applyAction` untouched |
| 4 | Tests prove the rule | findings (3): 33 mutants, 29 killed, 4 survive (S2, S13, S14, A6) |
| 5 | Boundary and conventions | pass: logic in `src/engine/`; the scene change is a comment; no `GameState`, save or undo change; interpretation comment at `swapScoring.ts:111-113` |
| 6 | Numbers in prose | findings (1, LOW): every soak figure reproduces; one Progress justification is inaccurate |
| 7 | Documentation | pass: README bullet and table rows updated in style |
| 8 | Guardrails and hygiene | pass: lint 21 of 21, no new warning in `heuristicAgent.ts`, `swapScoring.ts` or `BoardScene.ts`; no new dependency |
| 9 | Repository-specific footguns | pass: swaps-off play byte-identical by construction and by fingerprint |

## Type check
```
type-check: PASS (intent 59, feature)
  note:  7 file(s), 787 line(s) changed outside intents/.
```

## Findings
- **MEDIUM** `src/engine/heuristicAgent.ts:495`, mutant **A6** survives.
  - **What's wrong:** contact can be priced as a charge (`…unit.position,
    false)` → `true`) and all 1205 tests still pass. Spec B4 says contact is
    priced "with `charged = false` (a swap is never a charge)". The contact
    test uses heavy cavalry, so doubling its gain only makes the swap more
    attractive, and the zero-weight twin can't see it.
  - **Needs rework:** add a test whose outcome flips when contact is priced
    as a charge. Either a cavalry swap whose uncharged gain loses to a
    competing move or to the `minMoveScore` gate, but whose charged gain
    would win, or an assertion of the swap's exact score. That kills A6.
- **MEDIUM** `src/engine/swapScoring.ts:185-186`, mutants **S14** and **S13**
  survive.
  - **What's wrong:** the cap's selection is untested.
    - S14: reversing the sort to ascending passes everything. B9 says the cap
      takes "the best by contact score first".
    - S13: removing the front-line filter before the cap also passes.
    - The only cap test (`swapScoring.test.ts:129-160`) uses `attackFrom: ()
      => 0`, so every contact ties and only the count is pinned.
  - **Needs rework:** add a `scoreSwaps` test with more than
    `SWAP_PROBE_LIMIT` front-line pairs of distinct contact, plus one
    non-front-line pair with the highest contact. Assert which swapped
    boards get an exposure probe: the top 4 front-line pairs by contact,
    ties by `legal` order, and not the non-front-line pair. That kills S14
    and S13.
- **MEDIUM** `src/engine/swapScoring.ts:56-57`, mutant **S2** survives, and
  S1 is killed only by a fragile check.
  - **What's wrong (S2):** dropping `u.charged = false` from `probeClone`
    passes everything. Progress says no test can see it because
    `bestAttackValueFrom` forces `charged = false`. That misses the exposure
    side:
    - an enemy cavalry that charged on its own turn keeps `charged = true`
      through our movement phase (`turnManager.ts:152-159` clears it only at
      the owner's next movement phase);
    - so `enemyThreatAgainstUnit` on an unnormalised board would price it at
      double attack;
    - B5 requires "the same opponent model Cautious already uses", which
      normalises (`normalizedThreatProbeClone`).
  - **What's wrong (S1):** dropping `defendedThisPhase = false` is killed
    only by the soak's Cautious presence check (`heuristicSoak.test.ts:374`),
    which rests on one swap in 24 games.
  - **Needs rework:** add targeted shelter tests: one with an enemy cavalry
    that has `charged: true`, and one with a unit that has
    `defendedThisPhase: true`, each where the stale flag would change the
    decision. That kills S2, and S1 by a targeted test.
- **MEDIUM** `src/engine/heuristicSoak.test.ts:397-405` (the seed-24 Greedy
  test) and `:374` (Cautious presence): a fragile proof.
  - **Measured:** each assertion hangs on one swap in a whole game. Greedy
    swaps in 1 of 60 games as seat 0 against EV, and in none of 60 Greedy
    mirror games.
  - **Why it matters:** an unrelated change can turn it red without a bug.
    It meets AC8 as written; the targeted tests carry the behaviour.
  - **Worth a look:** comment that these are presence checks, and how to
    re-find a seed when one breaks.
- **LOW** `README.md:352-354`, B8 "never swaps a pair straight back": the cap
  can break it in theory.
  - **How:** a forward swap carried by shelter despite negative contact has
    a reverse with positive contact. If 4 other front-line pairs outrank
    that reverse on contact, it gets no shelter probe and could be taken.
  - **Measured:** 400 self-play games gave 92 swaps and 0 swap-backs.
  - **Worth a look:** the fix would change B9's own wording, so it is the
    owner's.
- **LOW** `intents/59-ai-unit-swaps/plan.md:381`: Progress justifies the twin
  divergence with "shelter alone can carry the swap", but on the shipped
  contact position `{swapContact: 0}` alone already gives `endPhase` at
  every tier. The tests are still sound. Worth a look.
- **LOW** `intents/59-ai-unit-swaps/plan.md:322`: mojibake, "Â§59" should
  read "§59". Worth a look.

**Divergences (pass 1), all acceptable:**
- subtasks 3 and 4 in one commit;
- the cap counts front-line pairs only, which fits B9 (its test is the S13
  finding);
- the twins are `{swapShelter: 0}` and both-zero, each term still isolated;
- the pinned Greedy seed, which meets AC8 but is fragile (above).

## Not checked
- **AC10 / B12 in a real browser:** the computer's swap logged, drawn and
  undone. No e2e scenario forces a computer swap; this is the live check.
- **AC5's exposure figures** in Progress (2.33, 1.67): not measured
  directly. The arithmetic and the passing tests are consistent with them.
- **Exposure-probe cost** in dense real-game positions beyond the soak.
- **B8 under the cap:** searched in 400 games, not proven.
- `fuzzHarness.test.ts` and `seatControl.test.ts` were not read in full
  (unchanged, green).
- The French `computerSwaps` text (unchanged from §54) was not re-read.

## Live check
- **Owed** by rule 1 (`src/scenes/BoardScene.ts`) and rule 3 (AC10/B12: the
  computer's swap logged, drawn and undone, new behaviour, no e2e scenario).
  Run it on the commit that resolves this round's findings. Those are tests
  only, so the game is the same as at `1966abd`.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/59-ai-unit-swaps`, with
     `HERAKLIOS_SAVES_DIR` set to a fresh temp folder, run `npm run dev --
     --port 5259 --strictPort --host 127.0.0.1` and open
     `http://127.0.0.1:5259/`.
  2. On the Menu, leave "Unit swaps" on and set player 2 (the east seat) to
     Computer, Expected value.
  3. "Combat test mode (units face to face, 2 hexes)": its rows are dense,
     so contact comes fast. Move two or three of your units adjacent to the
     computer's row, and end your phases.
  4. Watch the computer's movement phase over 2 or 3 turns.
  5. Press Undo after the computer's turn, and compare what it restores with
     what a computer move restores. Test mode keeps history across rolls.
  6. Set the seat to Random briefly: swaps should appear among its moves
     often.
  7. Optionally, play a normal game against Cautious until the armies meet.
- **You should see:**
  - a log line "<seat>: A and B swap places." (French: the existing
    `computerSwaps` text), and the two units trading hexes;
  - Undo restoring both units as it does for a computer move;
  - no swap with "Unit swaps: off";
  - swaps are rare at the planning tiers. If none appears at Expected value
    after a few turns, the Random step still shows "logged and drawn".

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `1966abd`, `git status --short` clean
before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 65 files,
  1205 tests (matches the reviewer and the implementer).
- `npm run check:intent`: PASS, 7 files, 787 lines (matches).
- `npm run e2e`: 17 passed (36.2 s), port 5232 free before (matches: the
  reviewer got 17 in 37.7 s).
- The four survivors, each with the full `npx vitest run`, backed up and
  restored by copy: **S2** (`probeClone` keeps `charged`) **survived**, 1205
  passed; **S13** (front-line filter removed) **survived**; **S14** (cap sorts
  ascending) **survived**; **A6** (contact priced as a charge) **survived**.
  All match the reviewer.

**Reviewer agent** (same worktree and HEAD, foreground):
- verify, check:intent, e2e: as above.
- 33 mutants with the full suite: 29 killed (S1, S3-S12, S15-S19, A1-A5,
  A7-A14, by the tests named in its report), 4 survived. It re-ran the
  implementer's M1-M11: all killed as reported.
- The fingerprints were re-derived from `30b30ef:src` (the merge base, via
  `git archive`) and from HEAD: seed 7 with swaps off gives random 118, greedy
  92, ev 72, lookahead 58, with the recorded sha256 values.
- `cdc5db1` touches only `plan.md` and `heuristicSoak.test.ts`.
- Every soak series re-run on base and HEAD: every Progress figure and every
  "Measured at" comment reproduces. The `expect(` diff shows additions only.
- The longest soak test takes 8.8 s, against the 60 s `testTimeout`.
- A 400-game swap-back search found 92 swaps and 0 swap-backs.
- The literal AC3/AC4 twins also hold.
- `npm run sdlc:scan -- --sample-due auto --exclude 59`: nth attested auto
  change = 4, every 3, `sampled: no`.

**Taken on trust:** the AC5 exposure values; the scene's `landSwap` case at
runtime (the live check); the per-commit verify history (only HEAD
verified).
