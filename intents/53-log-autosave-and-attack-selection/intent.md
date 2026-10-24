<!-- generated-by: heraklios/intent@0.1.5 -->
# §53 — The log says when the game autosaves, and shows the attack being built

**Type:** feature
**Originator:** the owner, while playing (2026-10-24)
**Source:** none

## Problem

The owner's words: "put a message in the log window when you save or auto
save. Put also a message during the attack phase about the selected units and
targeted units."

- **Saving.** A manual save already writes "Saved to slot N." in the log,
  through the Save/Load panel's `onStatus` (`src/ui/saveLoadPanel.ts:305-307`,
  `:335`; wired at `src/scenes/BoardScene.ts:1014`). The autosave, which runs
  at the start of the board and at each phase end
  (`BoardScene.ts:866`, `:1128`, `autosave()` at `:989-994`), says nothing
  when it succeeds; it logs only a failure (`saves.autosaveFailed`). A player
  can't tell whether the game was saved.
- **Attacking.** Picking attackers and targets in the combat phase writes
  nothing in the log (`toggleAttacker` at `BoardScene.ts:1884`,
  `toggleDefender` after it): the selection shows only as board highlights.
  The log speaks only on a refusal ("can't reach the current target(s)") and
  after the roll, when the combat report lists the attackers and defenders
  with their forces. Before the roll the player sees no names and no totals.

## Outcome

- After each successful autosave, the log shows a short line ("Autosaved."),
  in English and French. A failed autosave keeps its existing message. The
  manual-save line is unchanged.
- In the combat phase, after each click that changes the attack being built
  (adding or removing an attacker or a target, including a unit the prune
  removes), the log shows the current attack: the attackers with their total
  attack force and the targets with their total defence, for example
  "Attack: Archers, Hoplites (12) → Peltasts (6)". With no target yet it
  shows the attackers alone.
- The totals are the ones the roll will use (terrain and river modifiers
  included), computed by a pure, tested engine function, not in the scene.

## Constraints

- **Engine/presentation split:** the totals come from `src/engine/combat.ts`
  (today `describeLandAttack`, `:353`, computes them only together with a die
  roll; a pre-roll summary is a pure function with tests). The scene only
  formats and logs.
- **Text in `src/ui/i18n/`:** new messages in `en.ts` and `fr.ts`
  (`noLiterals.test.ts`).
- **Undo:** logging changes no state and adds no history entry.
- **Naval:** ramming and boarding resolve as soon as a target is picked
  (`log.navalImmediate`), so the attack line covers land attacks; what a
  naval selection logs is for the spec.
- **AI seat:** whether the computer's own attacks are announced the same way
  is for the spec (the AI does not click).
- **Log volume:** one line per change, not a running list; the log already
  scrolls (§49, `src/ui/logPanel.ts`).
- Rulebook: none; digital-only.
- A live check is owed (`src/scenes/`, `src/ui/`).

## Type-specific questions

### Feature
- **Users:** hotseat players; the AI seat only if the spec says so.
- **Rulebook basis:** digital-only — no print rule. The totals follow the
  combat rules already implemented (`docs/research/02-rules-transcription.md`
  through `engine/combat.ts`).
- **Known simplification it removes:** none.
- **Open design questions:**
  - Totals for a combined attack against several targets, where an
    attacker's force depends on the defenders (`attackForceAgainst`,
    `combat.ts:266`), and in single-defender mode.
  - Whether the line also shows the ratio, or only the totals (the owner
    chose totals; the ratio would be an addition).
  - What a naval selection (ram, board) logs before it resolves.
  - Whether the AI's attacks log the same line.
  - Whether autosave's line is muted at the board's first autosave (game
    start or load), which already logs "Game loaded".

## Assumptions I made

- **Type is feature, not adjustment:** it needs a new tested engine function
  and touches the scene, both i18n tables and probably an e2e, beyond an
  adjustment's ≤5 files and ≤60 lines.
- **Owner's answers (2026-10-24):** autosave logs a short line each time;
  the attack line shows names and totals (not the odds).
- The manual-save message stays as it is.
- An e2e scenario can check both lines through the dev hook; the spec decides.
