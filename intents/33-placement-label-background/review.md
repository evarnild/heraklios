<!-- generated-by: heraklios/review@0.1.4 -->
# §33 review — Give the placement prompt label a background

verdict: attest
tier: attested
reviewed-commit: ae1946a
round: 2
sampled: no
live-check: owed

Tier set by input 1 (paths): `src/scenes/PlacementScene.ts` is Attested;
nothing raises it. `sampled: no`: the 2nd attested review (§30 is the
1st). The live check is owed and already recorded, `2026-10-20 by-agent`,
after the rework (`ae1946a`), so `check:intent` passes.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — background on all three messages; the ship-facing prompt now clears "Done placing" (the intent's constraint) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — presentation only, no rule |
| 4 | Tests prove the rule, not only pass | not run — style and wording only; no test reaches `PlacementScene` (e2e starts from test-mode shortcuts that skip placement). The live check is the evidence. |
| 5 | Engine/presentation boundary and conventions | pass — gates marked `by-agent` per §31 |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass — nothing documented changes |
| 8 | Guardrails and hygiene | pass — lint 21/21 |
| 9 | Repository-specific footguns | pass |

## Type check
```
type-check: PASS (intent 33, adjustment)
  note:  1 file(s), 9 line(s) changed outside intents/.
```

## Findings
- **LOW** (not this change, carried from round 1) `e2e/save-load.spec.ts` —
  one failure in four runs during round 1, when the machine was slow; it
  didn't recur this round (4 passed, 13.4 s). Worth a look: open a fix
  intent if it comes back, with the error text.

## Not checked
- **The rendered screen.** I measured the new message widths in Chromium
  (below) but didn't render the placement screen. Your live check after
  the rework (`ae1946a`, "checked and ok") is the evidence that it reads
  right.
- **Colour** (`#1a1a1a`): taste, accepted at your live check.
- **Mutation pass:** not run. See pass 4.

## Live check
- owed: rule 1 (`src/scenes/**`); no smoke scenario reaches placement, and
  the change is visual.
- recorded: `live_checked: 2026-10-20 by-agent` in `ae1946a`, after the
  rework and your re-check ("checked and ok"). The steps were round 1's
  (below): a normal game with a ship, the facing prompt clear of "Done
  placing".

## Verified myself vs. taken on trust
- Read `git diff main...adjust/33-placement-label-background`.
  - `PlacementScene.ts`: `backgroundColor: '#1a1a1a'` and
    `padding: { x: 8, y: 4 }` on `infoText`. The ship prompt is now
    `` `Placing ${t.name}: turn it with "Turn", then "Confirm facing" (or "Cancel").` ``,
    the wording round 1 proposed.
  - `metadata.yml`: `intent_accepted: 2026-10-20 by-agent`,
    `live_checked: 2026-10-20 by-agent`, `status: in-review`.
  - The branch is rebased: `main` (`d254164`) is an ancestor of `ae1946a`.
- Text widths (`15px Courier` in Chromium, throwaway script, deleted): ship
  prompts 666 px (Galères, Birèmes), 675 px (Trirèmes), 702 px
  (Quintirèmes). With padding the box ends at x ≈ 738 at most, against
  "Done placing" at x = 960. The other messages are unchanged: 459 px and
  567 px.
- `npm run verify` (`ae1946a`): lint 0 errors / 21 warnings (cap 21);
  Vitest 37 files, **633 passed** (§31's tests now included via the
  rebase).
- `npm run check:intent`: PASS (above).
- `npm run e2e`: **4 passed (13.4 s)**.
- `npm run sdlc:scan` (worktree): "Metadata problems: none";
  `intent_accepted: 1 owner · 6 agent`, `live_checked: 1 owner · 2 agent`.
  §33's two gates are counted as agent-recorded.
- `git status --short` afterwards: only this `review.md`, untracked.
- Taken on trust: your live check, as recorded in `ae1946a`.

# Round 1 (history)

- verdict: rework
- tier: attested
- reviewed-commit: 9127dc6
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2):
- MEDIUM overlap with "Done placing": **fixed** in `fc2e84a` (prompt
  shortened to the proposed wording).
- LOW gate markers: **fixed**. Rebased onto `main` and both gates marked
  `by-agent` in `a9f6209` / `ae1946a`; `live_checked` was cleared and
  re-recorded after the re-check.
- LOW save-load flake: **open, worth a look**.

Tier set by input 1 (paths): `src/scenes/PlacementScene.ts` is Attested;
`metadata.yml` doesn't raise it (`review_tier:` empty, type adjustment).
`sampled: no`: this would be the 2nd attested review (§30 is the 1st).

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — the intent's own overlap constraint is not met |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — presentation only, no rule |
| 4 | Tests prove the rule, not only pass | not run — a style constant; no test reaches `PlacementScene` (unit tests don't load scenes, and every e2e scenario starts from a test-mode shortcut that skips placement). The live check is the only evidence. |
| 5 | Engine/presentation boundary and conventions | findings (1) — gate markers predate §31's rule on `main` |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass — nothing documented changes |
| 8 | Guardrails and hygiene | pass — lint 21/21 |
| 9 | Repository-specific footguns | pass |

### Type check
```
type-check: PASS (intent 33, adjustment)
  note:  1 file(s), 7 line(s) changed outside intents/.
```
(Run in the worktree, whose `scripts/` still predate §31; see the second
finding.)

### Findings
- **MEDIUM** `src/scenes/PlacementScene.ts:136-143` — the intent's
  constraint "the label must not grow over the scene's other
  bottom-of-screen controls … the ship-facing prompt is the one to check"
  is not met.
  - **The overlap:** the label starts at x = 20, y = height − 40. "Done
    placing" (`:147-157`) sits at x = 960 on the same row and is never
    hidden. Measured in Chromium with the label's font (`15px Courier`,
    Phaser's default family; no `fontFamily` is set), the ship-facing
    prompt (`:350-351`) is 963 px wide (Galères, Birèmes), 972 px
    (Trirèmes) and 999 px (Quintirèmes). With the new 8 px padding, the
    dark box reaches x ≈ 999–1035, 39–75 px under "Done placing", and the
    end of the prompt ("…pick a different hex.") is hidden.
  - **Why the button wins:** it is created after the label at the same
    depth (30), so it draws on top.
  - **What changed:** the hidden text tail predates this change. The
    background makes the collision visible, and the intent flagged it as
    the case to check.
  - **Needs rework:** shorten the ship-facing message so it fits before
    x = 960 with padding. Under about 100 characters, the longest name
    fits; for example `` `Placing ${t.name}: turn it with "Turn", then "Confirm facing" (or "Cancel").` ``
    is about 80 characters, 720 px. That stays one line in one file.
    Wrapping is the worse fix: a second line grows into "↷ Redo"
    (x = 20, y = height − 72) unless the label is re-anchored, and that
    widens the change.
- **LOW** `intents/33-placement-label-background/metadata.yml:8`, `:11` —
  both gates were typed by an agent, and §31, merged on `main` as
  `597a07d` while this branch was open, requires `by-agent` after the
  date. As bare dates they would land on `main` reading as owner-recorded,
  which skews `sdlc:scan`'s gate shares, the figure §31 added.
  `intent_accepted` predates §31 and wasn't in its re-marking table, so
  nothing on `main` fixes it either. **Needs rework:** rebase onto `main`
  (only then does the branch's `check:intent` accept `by-agent`), and
  write both values as `2026-10-20 by-agent`.
- **LOW** (not this change) `e2e/save-load.spec.ts` — in this review the
  scenario failed once in four runs: 1 failed / 3 passed at 27.0 s, then
  4 passed at 19.9 s, 13.0 s and 13.1 s. §32's AC1 was 20/20 at about
  13 s, so this is a load-dependent flake. The error wasn't captured: the
  rerun overwrote `test-results/`. Worth a look: if it recurs, open a fix
  intent with the error text. It doesn't bear on §33, since no scenario
  reaches placement.

### Not checked
- **The overlap, seen.** I measured text widths in a headless Chromium
  canvas with the label's font string. I didn't render the placement
  screen, because reaching it means clicking through the army builder.
  The live check below is where it gets seen.
- **Whether the owner's live check covered a ship's facing prompt.**
  `live_checked:` was recorded before this review existed (`9127dc6`,
  "owner reported it done and successful"). If it only placed land units,
  it never showed the overlapping message. Either way, the rework changes
  the code, so the check is owed again (below).
- **Colour choice** (`#1a1a1a`): taste. Left to the live check, as the
  intent says.
- **Mutation pass:** not run. See pass 4.

### Live check
- owed: rule 1 (`src/scenes/**`). The smoke suite can't stand in: no
  scenario reaches placement, and the change is visual. The date recorded
  in `9127dc6` covers the pre-rework code. Clear it in the rework, and
  record a new one after re-checking.
- steps: in `C:\Users\eric\src\heraklios-wt\33-placement-label-background`
  → `npm run dev -- --port 5233 --strictPort --host 127.0.0.1` → open
  `http://127.0.0.1:5233/` → start a normal 2-player game (not a test-mode
  shortcut) and buy at least one **ship** (ideally Quintirèmes, the
  longest name) and some land units → on the placement screen:
  1. Click a land hex: the bottom-left label reads "Placing: <unit> (<n>
     left) — click a highlighted hex" on a dark padded box.
  2. Click a sea hex for a ship: the label switches to the facing prompt.
     Its box and text must end clear of the green "Done placing" button
     at the bottom right, with the whole message readable.
  3. Place everything: "All units placed. Click "Done placing" to
     continue." on the same box.
  4. Pan the map so the label sits over light and dark terrain.
- you should see: every message fully readable on its dark box, nothing
  under "Done placing", and no overlap with "↶ Undo" / "↷ Redo" above it.

### Verified myself vs. taken on trust
- Read `git diff main...adjust/33-placement-label-background`: 7 lines in
  `PlacementScene.ts` (adds `backgroundColor: '#1a1a1a'`, `padding:
  { x: 8, y: 4 }`), plus `metadata.yml` (`status: in-review`,
  `live_checked:`).
- `npm run verify` (worktree, `9127dc6`): lint 0 errors / 21 warnings (cap
  21); Vitest 36 files, **615 passed**.
- `npm run check:intent`: PASS (above).
- `npm run e2e` (B11, diff touches `src/scenes`): run 1 **1 failed (save-load) /
  3 passed (27.0 s)**; runs 2–4 **4 passed** (19.9 s, 13.0 s, 13.1 s).
- Layout: `PlacementScene.ts:138` label at (20, h−40); `:148` "Done
  placing" at (w−140, h−40), never hidden (`skipBtn` is only created,
  wired and listed at `:270`); `:173`/`:185` Undo/Redo at (20, h−104) and
  (20, h−72); `src/main.ts` size 1100×750.
- Text widths: a throwaway Playwright script (scratch, deleted) measured
  `15px Courier` in Chromium: ship prompts 963–999 px, "All units placed…"
  459 px, "Placing: Fantassins-Archers (12 left)…" 567 px, "Done placing"
  108 px. `git status --short` clean afterwards.
- Taken on trust: the owner's live check as recorded in `9127dc6`.
