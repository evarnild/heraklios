<!-- generated-by: heraklios/review@0.1.5 -->
# §59 review — Computer players use unit swaps

verdict: attest
tier: attested
reviewed-commit: f51314e
round: 2
sampled: no
run: auto
live-check: owed

**Tier:** Attested, by the path table (`src/engine/**` plus a comment in
`src/scenes/**`); `review_tier` empty; no CRITICAL or HIGH finding.

**Verdict:** `attest`. Round 1's three MEDIUM findings are resolved by
targeted tests in `5aca20c` (tests, two soak comments and Progress only; no
non-test `src/` change). Mutants S1, S2, S13, S14 and A6 are each killed by a
new test that fails for the mutated behaviour itself. Seven further mutants
in the same functions are killed too. Passes run by the `heraklios-reviewer`
agent; the coordinator re-ran verify, check:intent and the five mutants.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass: the rework adds tests only, each in a position consistent with B4, B5 and B9; `plan.md` changed below the Progress marker only |
| 2 | Type check | pass apart from the owed live check (the owner's gate) |
| 3 | Rulebook fidelity | pass, nothing to check: digital-only, no source change since round 1 |
| 4 | Tests prove the rule | pass: S1, S2, S13, S14 and A6 killed; 7 of 7 sampled mutants killed |
| 5 | Boundary and conventions | pass: no non-test `src/` change since `1966abd` |
| 6 | Numbers in prose | pass: the new tests' figures (3.00, 4.33, 0.33, 0.17, 0.67) reproduce; round 1's two Progress LOWs fixed |
| 7 | Documentation | pass, unchanged since round 1 |
| 8 | Guardrails and hygiene | pass: lint 21 of 21; no dependency change |
| 9 | Repository-specific footguns | pass: the soak diff is comments only, no `expect(` change |

## Type check
```
type-check: FAIL (intent 59, feature)
  error: A live check is owed and not recorded. Do the steps in intents/59-ai-unit-swaps/review.md → ## Live check, then set live_checked: <date> in intents/59-ai-unit-swaps/metadata.yml.
  note:  7 file(s), 877 line(s) changed outside intents/.
```
The only error is the owed live check, which the owner clears; not rework.

## Findings
- None needing rework.
- **LOW** `src/engine/heuristicAgent.test.ts:976-980`: the positive A6 twin
  runs at Greedy and EV only, without saying why Cautious is left out
  (presumably its reply check outweighs the 0.33 contact). The negative test
  covers all three tiers, so the kill holds. Worth a look: a one-line
  comment.
- **LOW** `src/engine/heuristicAgent.test.ts:1003-1014` (the S2 test):
  normalised, the threat is 0 on both boards, so "no swap" would also hold if
  shelter broke some other way. It isn't vacuous: S2 flips it, and the
  positive shelter tests pin the term. Worth a look, as a note only.
- **LOW**, carried from round 1, the owner's: `README.md:352-354` and B8's "never
  swaps a pair straight back" can in theory be broken by the cap (a reverse
  swap ranked out of the shelter probes). 400 games showed none. Closing it
  changes B9's wording.

## Not checked
- **AC10 / B12 in a real browser** (the computer's swap logged, drawn,
  undone): the live check.
- AC5's exposure figures in Progress (2.33, 1.67): not measured directly.
- Exposure-probe cost in dense real-game positions beyond the soak.
- B8 under the cap: searched, not proven.
- e2e: not re-run this round, since no `src/scenes`, `src/ui`, `src/main.ts`
  or `e2e/` change since round 1, whose e2e passed 17 (coordinator and
  reviewer).
- The French `computerSwaps` text.

## Live check
- **Owed** by rule 1 (`src/scenes/BoardScene.ts`) and rule 3 (AC10/B12, new
  behaviour, no e2e scenario forces a computer swap). Run it on `f51314e`.
  The game is the same as at `1966abd`, because the rework is tests only.
- **Steps:**
  1. In `C:/Users/eric/src/heraklios-wt/59-ai-unit-swaps`, set
     `HERAKLIOS_SAVES_DIR` to a fresh temp folder, run `npm run dev --
     --port 5259 --strictPort --host 127.0.0.1`, and open
     `http://127.0.0.1:5259/`.
  2. On the Menu, leave "Unit swaps" on, and set player 2 (the east seat) to
     Computer, Expected value.
  3. Pick "Combat test mode (units face to face, 2 hexes)". Its rows are
     dense, so contact comes fast. Move two or three of your units next to
     the computer's row, and end your phases.
  4. Watch the computer's movement phase over 2 or 3 turns.
  5. After the computer's turn, press Undo. Compare what it restores with
     what a computer move restores. Test mode keeps history across rolls.
  6. Set the seat to Random briefly: swaps should appear among its moves
     often.
  7. Optionally, play a normal game against Cautious until the armies meet.
- **You should see:**
  - a log line "<seat>: A and B swap places." (in French, the existing
    `computerSwaps` text), and the two units trading hexes;
  - Undo restoring both units, as it does for a computer move;
  - no swap with "Unit swaps: off".

  Swaps are rare at the planning tiers. If none appears at Expected value
  after a few turns, step 6 (Random) still shows a swap logged and drawn.

## Verified myself vs. taken on trust

**Coordinator, re-run** (worktree at `f51314e`, `git status --short` clean
before and after):
- `npm run verify`: exit 0, `21 problems (0 errors, 21 warnings)`, 65 files,
  1210 tests (matches the implementer and the reviewer).
- `npm run check:intent`: FAIL only on the owed live check, 7 files, 877
  lines (matches).
- Each mutant was backed up and restored by copy, with the full `npx vitest
  run`. All match the reviewer and the implementer:

  | Mutant | Result | Failing test(s) |
  | --- | --- | --- |
  | **S1** | killed (2) | "prices our own unit as attackable even if it defended earlier: a stale defendedThisPhase does not hide the threat", and the soak "the lookahead tier is not measurably worse than the ev tier, seat for seat" |
  | **S2** | killed (1) | "prices the enemy as it would stand in its own combat phase: a stale charge flag does not raise the threat" |
  | **S13** | killed (1) | "probes the best SWAP_PROBE_LIMIT front-line pairs by contact (ties by legal order), never an off-line pair" |
  | **S14** | killed (1) | the same test as S13 |
  | **A6** | killed (1) | "a swap whose uncharged contact is under the gate is not taken" |

**Reviewer agent** (same worktree and HEAD, foreground):
- `git diff 1966abd 5aca20c`: tests, soak comments, `plan.md` Progress and
  `review.md` only; the `expect(` lines are additions only.
- verify and check:intent as above.
- The five mutants as above, each failing for the right reason (assertion
  messages in its report).
- Seven more mutants in the same functions, all killed:

  | Mutant | Change |
  | --- | --- |
  | R1 | cap tie-break reversed |
  | R2 | cap one smaller |
  | R3 | `shelterGain` sign flipped |
  | R4 | `contactGain` sign flipped |
  | R5 | no shelter at Cautious |
  | R6 | reply check on `unitId` only |
  | R7 | shelter dropped from the score |

- The new tests' figures measured through a scratch script against the real
  modules.
- `npm run sdlc:scan -- --sample-due auto --exclude 59`: nth attested auto
  change = 4, every 3, `sampled: no`.

**Taken on trust:** round 1's fingerprint and soak reproductions. No source
changed since, so they still apply.

# Round 1 (history)
- verdict: rework
- tier: attested
- reviewed-commit: 1966abd
- round: 1
- sampled: no
- run: auto
- live-check: owed

The full round-1 report is in git at `19024e4`.

Resolutions (round 2, checked at `f51314e`):
- **MEDIUM A6** (contact priced as a charge): **fixed** in `5aca20c`, test
  "contact is never priced as a charge (B4)"; A6 killed.
- **MEDIUM S13/S14** (the cap's selection): **fixed**, a `scoreSwaps` test of
  which pairs are probed; both killed.
- **MEDIUM S2, S1 on a fragile check**: **fixed**, two targeted shelter tests;
  both killed by them.
- **MEDIUM soak presence checks** (Worth a look): comments added on how to
  re-find a seed; the checks themselves unchanged, by design.
- **LOW B8 under the cap:** open, the owner's.
- **LOW Progress justification and mojibake:** fixed.

