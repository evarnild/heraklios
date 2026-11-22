<!-- generated-by: heraklios/intent@0.1.5 -->
# §84 — The Tables panel stays available while a combat is being resolved

**Type:** feature
**Originator:** the owner (2026-11-22): "I want to be able to see the tables
when I am solving a combat".
**Source:** §55 (`intents/55-rule-tables-panel/`), README → "The Tables
panel".

## Problem

The Tables panel is hidden while a combat result is being resolved. From the
README's Tables panel section, which §55 decided:

> While a retreat, push, advance or exchange choice (or an elephant's drift)
> is pending the panel hides, and the Tables button and Escape do nothing; it
> comes back as it was, on the same tab, once the choice is made.

`BoardScene.update` suppresses it through `RulesPanel.setSuppressed` whenever
`decisionPending` is set (CLAUDE.md, "The board's Tables panel").

So the player loses sight of the tables at the moment they most need them.
They can't check:
- the combat results table for the result they just got;
- the terrain table for where a retreating unit may go;
- the drift rules during an elephant's drift.

## Outcome

- **Available during resolution.** While a retreat, push, advance, exchange
  sacrifice or drift is pending, the player can open the Tables panel, keep
  it open, and switch its tabs.
- **No conflict with the prompt.** The panel never covers or blocks the
  decision prompt:
  - the retreat, push or advance highlights stay clickable;
  - the exchange panel and the drift Continue button stay usable.
  It is placed around them, as `rulesPanelLayout.ts` already does for the
  ram and boarding prompts.
- **The highlight stays.** The Land combat tab's highlight of the attack
  just rolled remains visible, ideally marking the result that was rolled.
- **Opening is harmless.** Opening, closing or switching tabs never changes
  the game, never answers a question, and never counts as the click that
  cuts an animation short in a way that skips a decision.
- **Otherwise unchanged.** Outside a pending decision, the panel behaves as
  today.

## Constraints

- **Rule basis.** No rule is involved: this is display only.
- **Reverses §55.** It undoes one of §55's choices, its suppression. Its
  reason was likely space and click conflicts with the prompts. The spec
  states how those are now avoided, using `rulesPanelLayout.ts` and
  `boardPrompts.ts`.
- **Blocked by §73.** §73 (plan approved, about to build) rewrites how
  `BoardScene` settles combats, including `decisionPending`, the prompts and
  the drift Continue that the suppression keys on. Building this first would
  have to be redone.
- **Size.** `BoardScene.ts` is at its ceiling. The change should mostly
  remove the suppression and place the panel in `src/ui`.
- **Live check owed.** It is visual and changes interaction.

## Type-specific questions

### Feature
- **Users:** hotseat players resolving a combat. During a computer's turn
  the panel may stay open too; the spec decides.
- **Rulebook basis:** digital-only.
- **Known simplification it removes:** none. It reverses §55's
  suppression.
- **Open design questions:**
  1. **Auto-open.** Should the panel open on its own when a combat result
     comes in, or only when the player asks? The draft assumes only when
     asked.
  2. **Rolled result.** Should the Land combat tab mark the rolled result,
     for example the die face and its cell, or keep today's ratio-column
     highlight?
  3. **Which prompts.** The panel stays available for all of them (retreat,
     push, advance, exchange, drift), or only some? The draft assumes all.
  4. **Escape.** While a decision is pending, does Escape close the panel
     only, never cancelling anything? The draft assumes yes.

## The owner's answers (2026-11-22)

1. **Auto-open:** no. The panel opens only when the player asks.
2. **Rolled result:** yes. The Land combat tab marks the result that was
   rolled.
3. **Which prompts:** the panel is available for all of them: retreat, push,
   advance, exchange and drift.
4. **Escape:** while a decision is pending, it closes the panel only and never
   cancels anything.

## Assumptions I made

- **Type:** feature. It reverses a spec decision (§55).
- **Tier:** set by the path table, so `review_tier` is left empty.
- **Id:** 84.
- **Blocked by §73:** for the reason under Constraints.
