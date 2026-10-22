<!-- generated-by: heraklios/review@0.1.4 -->
# §43 review — Centre the view on the new player's land units when their turn starts

verdict: attest
tier: attested
reviewed-commit: ac24859
round: 1
sampled: no
live-check: owed

Tier set by input 1 (paths): `src/scenes/**`, `src/ui/**`, `e2e/**` and
README wording are Attested; `review_tier` empty; digital-only, no rule.
`sampled: no` (the 8th attested review; §36 was the 5th). The branch was
rebased onto `main` (`ccd9076`) by the coordinator on the owner's request
before this review, so it runs §41's `workers: 2`.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — B1–B8 as specified; exactly three call sites, each before `maybeStartAiTurn()`; the clamp-aware e2e check is a declared, stricter reading of B8 |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — digital-only |
| 4 | Tests prove the rule, not only pass | findings (1) — 4/4 helper mutants killed; 3 of 4 wiring mutants killed by the new scenario; the in-place-load call survives (L1) |
| 5 | Engine/presentation boundary and conventions | pass — the point is computed in the pure `src/ui/viewCentre.ts` (no Phaser), tested; no `GameState`, save or undo change |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass — README "The view at the start of a turn" matches B1–B5 |
| 8 | Guardrails and hygiene | pass — lint 21/21; the hook addition is read-only and dev-only like the rest |
| 9 | Repository-specific footguns | pass — the centring sits in `endPhase`'s movement branch, after the `gameOver` return |

## Type check
```
type-check: PASS (intent 43, feature)
  note:  7 file(s), 200 line(s) changed outside intents/.
```

## Findings
- **LOW** `src/scenes/BoardScene.ts:971` — the in-place load's
  `centreOnActivePlayer()` is untested: removing it leaves the new
  scenario green (no scenario loads a save in place). Worth a look: the
  live check's load step covers it; a `save-load`-style assertion could
  later.

## Not checked
- **How it looks and feels**: the jump on a turn change, AI seats moving
  the view, an army near the board's edge. That's the live check (new and
  visual, so the smoke suite can't stand in).
- AI seats: not in the scenario (plan: live check).
- A load from the Menu's slot list (the `create` path with `staged`):
  covered by mutant E1's kill only for a fresh game, not for a staged
  load.

## Live check
- owed: rule 1 (`src/scenes/**`, `src/ui/**`), and the behaviour is new
  and visual; kept by the owner (intent → Constraints).
- steps: in `C:/Users/eric/src/heraklios-wt/43-center-view-on-turn`, `npm
  run dev -- --port 5243 --strictPort --host 127.0.0.1` →
  `http://127.0.0.1:5243/` → **Test mode** → the view opens on player 1's
  army → **End phase** twice → it jumps to player 2's army → drag or zoom,
  then **End phase** once (into combat): the view doesn't move → **Undo**
  / **Redo**: it doesn't move → **💾 Save / Load**, save, move, load the
  slot: the view centres on the active player → back to the Menu, a new
  2-player game with one AI seat: through one round the view follows each
  seat's army at the start of its turn.
- you should see: the jumps above, at the zoom you left, stopping at the
  board's edge; nothing else moving the view.
- Could be an e2e scenario: the human-seat part already is
  (`e2e/view-centre.spec.ts`); the AI round and the in-place load could be
  added later; the look stays a person's check.

## Verified myself vs. taken on trust
- `git log main..feat/43-center-view-on-turn`: 5 commits ending `ac24859`;
  `main` (`ccd9076`) is its ancestor. `status: in-review`, `live_checked`
  empty. Read `git diff main...HEAD -- src e2e README.md` in full; checked
  `MapView.toScreen` (`:299-302`) adds the same origin as `centerOnPoint`;
  undo/redo (`restoreSnapshot`) don't call it.
- `npm run verify` (worktree, `ac24859`): lint 0 errors / 21 warnings (cap
  21); **716 passed**.
- `npm run check:intent`: PASS (above).
- `npm run e2e` (port free): **9 passed (46.7 s)**;
  `e2e/view-centre.spec.ts --repeat-each=5`: **5 passed**.
- Mutants (file backed up, `git diff` checked, restored byte for byte):
  helper (full `npx vitest run`) — no domain filter, no `destroyed`
  filter, no owner filter, no divide: **all killed**; wiring (`npx
  playwright test e2e/view-centre.spec.ts`) — no centring at `create`:
  **killed**; at turn start: **killed**; `centerOnPoint` without the
  origin: **killed**; at in-place load: **survived** (L1). `git status
  --short` clean afterwards.
- Taken on trust: the implementer's two red runs before wiring (488 px,
  260 px).
