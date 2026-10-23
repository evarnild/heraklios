<!-- generated-by: heraklios/spec@0.1.0 -->
# §51 spec — The army builder fills a unit type up to what the budget allows, or clears it, in one click

Accepted intent: [intent.md](intent.md)

Written against `main` at `0fac7d8`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/02-rules-transcription.md:33`, `:41` | "Each player has **400 purchase points**"; an army is placed once it "totals exactly 400 purchase points". Unchanged: the buttons are a shortcut under this rule. |
| `src/data/units.ts` | each type's `cost` and `maxCount` (for example archers 5 pt, max 10; quintiremes 50 pt, max 1) |
| `src/engine/army.ts:23-51` | `validateArmy`: `totalCost`, `remaining = ARMY_BUDGET - totalCost`, the error kinds |
| `src/scenes/ArmyBuilderScene.ts:94-121` | the row: `-` at x 400, the count at 430, `+` at 460; `+` caps at `maxCount` and ignores the budget; `refresh()` redraws counts, total, errors and the Confirm button's alpha |
| `src/ui/i18n/noLiterals.test.ts:1-4` | only literals with a word of two or more letters are flagged, so `«` and `»` need no table entry |
| `e2e/placement.spec.ts:44-49` | the menu route into the army builder: "2", then "Use default army" and "Confirm army" per seat |
| owner's answers, 2026-10-23 | labels `«` / `»`; a button that would change nothing is dimmed; add an army-builder e2e scenario |

## Behaviour

**B1 — Two more buttons per row.** Each unit type's row gets `«` just left of
`-` and `»` just right of `+`, in the same style as `-` and `+`. The row
reads `«  -  <count>  +  »`. Nothing else in the row moves.

**B2 — `»` fills the type.** It sets that type's count to
`min(maxCount, count + floor(remaining / cost))`, where `remaining` is 400
minus the cost of the whole current selection. It never lowers a count: with
`remaining` at or below 0, or the count already at `maxCount`, nothing
changes. No other type's count changes.

**B3 — `«` clears the type.** It sets that type's count to 0. No other
type's count changes.

**B4 — Same follow-up as `-` and `+`.** After `«` or `»`, the counts, the
total, the error lines and "Confirm army" update exactly as after `-` or `+`
(`refresh()`).

**B5 — Dimmed when it would change nothing.**
- `«` is dimmed while that type's count is 0.
- `»` is dimmed while B2 would add nothing: the count is at `maxCount`, or
  `remaining` is below that type's cost.
- A dimmed button's click changes nothing.
- The dimming is redrawn on every `refresh()`, so `-`, `+`, `«`, `»` and
  "Use default army" all update it. Dimmed uses the alpha "Confirm army"
  already uses (0.4).

**B6 — The fill arithmetic is in the engine.** A pure function in
`src/engine/army.ts` returns the count B2 sets. The scene calls it for `»`
and for `»`'s dimming. `«` is a plain assignment to 0 in the scene.

**B7 — The README** Army Builder paragraph (`README.md:79-87`) says, in one
clause, that `»` adds as many of a type as the budget and its maximum allow
and `«` removes them all.

**B8 — A smoke scenario.** `e2e/army-builder.spec.ts` drives the screen by
canvas clicks through the menu route of `placement.spec.ts`. The dev hook
(`src/ui/devHook.ts`) gains what it needs to read the counts, the total and
the buttons' dimming, without a new public method on the scene beyond
what the hook reads.

## Interpretations

- **"The maximum number of units available with the budget"** is the most
  that fits in what is left of the 400 points, bounded by the type's
  maximum. It does not swap out other types to make room, and it never
  removes units (B2). Code comment at the engine function.
- **"Remove all units of a type"** is that one type only (B3).

## Acceptance criteria

- **AC1 — the fill arithmetic** (`src/engine/army.test.ts`):
  - from an empty selection, archers fill to 10 (the cap, 50 pt);
  - with 390 points spent, archers (5 pt) gain 2 and quintiremes (50 pt)
    gain 0;
  - with exactly 400 spent, or over 400, the count is unchanged;
  - at `maxCount`, the count is unchanged;
  - the selection passed in is not mutated, and the result never lowers the
    count (B2, B6).
- **AC2 — the screen** (`e2e/army-builder.spec.ts`, in `npm run e2e`):
  - on an empty selection, `«` is dimmed and `»` is not on a row;
  - `»` on archers gives 10 archers and a total of 50;
  - `«` on archers gives 0 and a total of 0, and `«` is dimmed again;
  - after "Use default army" (400 spent), every row's `»` is dimmed, and a
    click on one changes no count;
  - no console errors (B1-B5).
- **AC3 — the README** names both buttons (B7); checked by `/review` pass 7.
- **AC4 — live check** (owed by rule 1, `src/scenes/**`): the owner opens
  the army builder, uses `«` and `»` on a few types and "Use default army",
  and sees the counts, the total, the errors and the dimming behave as B2-B5,
  in English and French.
- **AC5** — `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS;
  `noLiterals.test.ts` green without a new allow-list entry.

## Non-functional

- **Engine/presentation split:** the fill arithmetic in `src/engine/army.ts`
  with tests (B6); the scene only wires the buttons.
- **Save format:** untouched. The selection lives in `session`, not in
  `GameState`.
- **Undo boundaries:** none. The army builder has no history.
- **AI / harness:** untouched. AI seats skip the screen
  (`skipAiArmySeats`), and the fuzz harness builds armies itself.

## Out of scope

- A button that fills the whole army, or rebalances types to spend exactly
  400.
- Keyboard shortcuts, tooltips, and long-press repeat on `-` and `+`.
- Changing `+` to respect the budget.

## Assumptions I made

- **Where the buttons sit:** outside `-` and `+` (`«` at about x 370, `»` at
  about x 490). The canvas is 1100 px wide, so there is room.
- **No confirmation dialog** for either button: each one is undone by the
  others.
- **The README** gets the one clause (the intent's open question; I read it
  as yes).
- **The dev hook** grows a reader for the army builder (B8). It is dev-only
  and absent from the production build, like the rest of the hook.
