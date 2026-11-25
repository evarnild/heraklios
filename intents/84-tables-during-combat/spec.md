<!-- generated-by: heraklios/spec@0.1.0 -->
# §84 spec — The Tables panel stays available while a combat is being resolved

Accepted intent: [intent.md](intent.md)

Written against `main` at `97f5edd` (after §73, §89, §90 and §91 merged).

No game rule is involved; this is display only. The owner answered the
intent's four design questions on 2026-11-22 (intent.md, "The owner's
answers"):

- **no auto-open;**
- **the Land combat tab marks the rolled result;**
- **available for every prompt** (retreat, push, advance, exchange, drift);
- **Escape closes only the panel.**

## Sources that apply

| Source | What it settles |
| --- | --- |
| `README.md` → "The Tables panel" (§55) | Today: "While a retreat, push, advance or exchange choice (or an elephant's drift) is pending the panel hides, and the Tables button and Escape do nothing; it comes back as it was, on the same tab, once the choice is made." This spec removes that. |
| `src/scenes/BoardScene.ts:1288-1289` | `// The Tables panel is hidden while a decision is pending (§55).` and `this.rulesPanel?.setSuppressed(this.decisionPending);` in `update`. |
| `src/ui/rulesPanelState.ts` | The panel's open/tab wish is kept apart from the suppression; suppressed, it is hidden and ignores open/toggle/close/tab. |
| `src/ui/rulesPanelLayout.ts:11-31` | `SIDE_PANEL_WIDTH = 300`, `RULES_PANEL_W = 776`, `RULES_PANEL_H = 266`, `MARGIN = 12`, `TOP = 8`. `rulesPanelRect(canvasWidth)` is the top right of the game area, `{ left: canvasWidth - 776 - 12, top: 8, width: 776, height: 266 }`. `visiblePromptRects` lists only the ram and boarding prompts, because "the decision choosers … set `decisionPending`; the panel is hidden while it is set … so they are not modelled here". |
| `src/ui/boardPrompts.ts` | `RAM_PROMPT` 280×130 and `BOARD_PROMPT` 260×120, drawn by `centredPromptRect` at the canvas centre (550, 375 at 1100×750). |
| `BoardScene.chooseAdvance` (`:2015-2024`) | A 320-wide panel, height `76 + 26·n` for n candidates, centred at `height / 2`. |
| `BoardScene.chooseExchangeSacrifice` (`:2328-2337`) | A 340-wide panel, height `110 + 24·n` for n attackers, centred at `height / 2`. |
| `BoardScene` drift Continue (`:682-699`) | A button at `(16, height − 232)`, inside the left side panel. **Space** and **Enter** continue (`:698-699`), and a bare map click continues (`:1347`). **Escape** is bound only to `rulesPanel.close()` (`:697`). |
| `BoardScene.syncRulesPanel` (`:1854-1861`) | The land tab's highlight comes from `previewLandAttack(attackGroup, defenderGroup)` through `rulesPanel.setAttack`. |
| `src/engine/ruleTables.ts:119-146` | `LandCombatHighlight`: `attackForce`, `defenseForce`, `modifier`, `column` and per die face `{ face, row }`. |
| `BoardScene.showAttackOutcome` (`:2515`) | `const { dieRoll, result, attackForce, defenseForce, columnIndex } = …`: the rolled die is known when a result comes in. |
| `MapView.pointerBlocked` (`BoardScene.ts:730`) | A pointer over the open Tables panel never reaches the map. |

## Behaviour

- **B1 — No suppression.** The Tables panel is no longer hidden while a
  decision is pending. Its open/closed state and tab follow the player's own
  Tables-button clicks, tab clicks and Escape at all times, as outside a
  decision today.
- **B2 — No auto-open (owner).** A combat result, and any decision it starts,
  never opens, closes or changes the tab of the panel. An open panel stays
  open, on the same tab, through the whole resolution.
- **B3 — Every decision (owner).** B1 holds for the retreat choice, the push
  choice, the advance offer, the exchange-sacrifice chooser, every drift
  Continue pause, and anything else that sets `decisionPending` (§83's
  End-phase warning, once merged).
- **B4 — The choosers never sit under the panel.** While the advance offer or
  the exchange chooser is shown, its box is drawn with its top at
  `rulesPanelRect.top + RULES_PANEL_H + MARGIN` (286 at 1100×750), whether or
  not the panel is open, so opening the panel never moves a chooser. The box
  stays horizontally centred.
  - If a chooser is too tall to fit below that line inside the canvas, it is
    drawn as high as it must, never above the canvas top, and the panel
    covers its top part. At 750 px tall, 464 px are available: 14 exchange
    rows, or 15 advance rows, more than any army can put in one attack.
  - The ram and boarding prompts keep their centred place; `rulesPanelLayout`
    already keeps the panel clear of them.
- **B5 — Highlights stay reachable.** A retreat or push highlight that lies
  under the open panel is not clickable there, as any hex under the panel is
  today. The player reaches it by dragging the map outside the panel, or by
  closing the panel. Nothing auto-pans.
- **B6 — The panel never answers a decision.** Clicking the Tables button, a
  tab, or anywhere on the open panel never:
  - picks a retreat or push hex;
  - accepts or declines an advance;
  - selects an exchange unit;
  - continues a drift;
  - counts as the click that cuts an animation short.

  Escape with the panel open closes the panel and does nothing else (owner).
  Escape with the panel closed does what it does today. Space and Enter keep
  continuing a drift whether or not the panel is open.
- **B7 — The rolled result is marked (owner).** From the moment a land attack
  is rolled until the player starts building another attack (a new attacker
  or target click), or the phase ends, the Land combat tab shows that
  attack's column and marks the one cell the roll landed on: die face
  `dieRoll`, at its row after the modifier, in column `columnIndex`. The mark
  is distinct from the per-face cells (outline and fill, in the design's
  accent). Before a roll, the tab shows today's highlight of the attack being
  built, unchanged. The mark is read-only data passed to the panel; no
  engine change.
- **B8 — Outside a decision, nothing changes.** Placement, tabs, Escape, the
  ram/boarding layout, `pointerBlocked` and the save/load behaviour are as
  today.
- **B9 — Computer seats.** During a computer's turn the panel is available as
  in B1. A computer's decisions settle as they do now. The panel shows the
  computer's rolled attack under B7 as it happens, if open.

## Interpretations

- **I1 — "Placed around them" (intent Outcome).** The intent asks that the
  panel never cover or block a prompt, "as `rulesPanelLayout.ts` already does
  for the ram and boarding prompts". The panel keeps its one place, top right,
  and the choosers move below it (B4). The other reading, moving or shrinking
  the panel around each chooser, would make the tables jump about while the
  player reads them.
- **I2 — "Stay clickable" for map highlights (intent Outcome).** It is read as
  "never made unreachable": a hex under the panel is reached by panning or
  closing (B5), because a panel that let clicks through, or a camera that
  pans by itself, would break §55's "clicks that stay on the panel" rule and
  surprise the player.
- **I3 — How long the rolled mark lasts (B7).** "Marks the result that was
  rolled" doesn't say until when. It lasts until the player starts building
  the next attack, which is when today's highlight would change anyway.

## Acceptance criteria

- **AC1 — B1/B3** (test: `src/ui/rulesPanelState.test.ts`, plus e2e). The
  Board no longer suppresses the panel. An e2e scenario opens the Tables
  panel, starts a combat that ends in a retreat choice (a §73 combat fixture,
  e.g. `RETREAT`), and asserts `rulesPanel().open === true` while
  `pendingChoice()` is the retreat. It switches to another tab and back, and
  the choice is still pending and unanswered.
- **AC2 — B2** (e2e). With the panel closed, the same combat leaves it closed
  through the decision. With it open on the terrain tab, it stays on the
  terrain tab.
- **AC3 — B4** (unit test: `src/ui/rulesPanelLayout.test.ts`, new cases). For
  advance n = 1..6 and exchange n = 1..8 at 1100×750, the chooser rect sits
  below the panel rect and doesn't intersect it. For a 1600-wide canvas
  (§88), the same holds. A chooser taller than the room below is clamped
  inside the canvas.
- **AC4 — B6** (e2e). With a retreat choice pending and the panel open:
  - clicking a tab, the panel body and the Tables button leaves the choice
    pending;
  - Escape closes the panel and the choice is still pending;
  - with a drift Continue pending, opening, closing and Escape don't advance
    the drift, and Space does.
- **AC5 — B7** (unit test: `src/engine/ruleTables.test.ts` or the panel's
  pure helper, plus e2e).
  - Given a highlight and a rolled face, the marked cell is `{ column,
    row: clamp(face + modifier) }`.
  - In the e2e, after a seeded roll, the panel's snapshot reports the marked
    cell, and building a new attack clears it.
- **AC6 — B8** (e2e, the existing `rules-panel.spec.ts` unchanged). It still
  passes.
- **AC7 — The look and the flow** (live check, the owner).
  - In the Standard and Drawn views, with the panel open, resolve each kind:
    a DR retreat, a push, an advance, an EX exchange, and an elephant drift.
  - Each prompt stays usable, and the choosers sit below the panel.
  - The rolled cell is marked on the Land combat tab.
  - Escape closes the panel without answering anything.
  - The look and spacing are acceptable.

## Non-functional

- **Engine/presentation split:** no engine change beyond, at most, a pure
  helper for the rolled cell in `src/engine/ruleTables.ts` (with tests).
  Placement goes in `src/ui/rulesPanelLayout.ts` / `boardPrompts.ts` (pure,
  tested). `BoardScene` only wires it.
- **Save format:** unchanged.
- **Undo boundaries:** unchanged. A die roll still clears history; the panel
  never mutates `GameState`.
- **AI / harness:** none.
- **Size:** `BoardScene.ts` is at its ceiling (2824). The plan states any
  `budget:` line; the chooser placement moves out of the scene into the pure
  layout helper.
- **i18n:** no new player-facing text is expected. Any that appears goes
  into `en.ts` and `fr.ts`.

## Out of scope

- Auto-opening the panel on a result (owner: no).
- Auto-panning the map to a highlight under the panel.
- Moving or resizing the panel itself.
- Naval ram and boarding outcomes in the panel (unchanged from §55).
- §83's End-phase warning layout. It sits in the left panel, clear of the
  Tables panel. Its interaction with B3 and B6 (Escape) is covered by B6's
  "Escape with the panel open closes only the panel".

## Assumptions I made

- **The choosers move down for good, not only while the panel is open**
  (B4). That keeps the chooser from jumping when the player opens the panel
  mid-decision. The cost is that the advance and exchange boxes sit lower
  than today's centre even when the panel is closed.
- **The mark lasts until the next attack is built** (I3).
- **No auto-pan for highlights under the panel** (B5, I2).
- **The rolled mark's look** (outline and fill in the accent colour) is the
  plan's to pick and the live check's to judge.
- **No `blocked_by` remains:** §73 is merged.
