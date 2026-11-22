<!-- generated-by: heraklios/intent@0.1.5 -->
# §81 — The Board shows every player's current score at all times

**Type:** feature
**Originator:** the owner (2026-11-22): "display the current score of each
player all the time".
**Source:** none (a request while playing).

## Problem

The game is scored on surviving army value. The winner at the end is the
player whose units still on the board are worth the most purchase points
(`docs/research/05-rules-french-original.md:480-482`):

> au terme du temps de jeu, chaque joueur possédant encore des unités sur
> le terrain additionne les valeurs d'achats qu'elles représentent. Celui
> qui a le plus de points est déclaré vainqueur

The engine already computes this figure (`armyValue`, `src/engine/state.ts`).
Today it is shown only once the game is over (`GameOverScene.ts:35`). During
play, nobody can see who is ahead without counting units by hand, though the
score decides the game whenever a clock or round limit is set (README
"Ending the game").

## Outcome

- **Always visible.** On the Board, every player's current score (their
  `armyValue`) is shown at all times: in both phases, on every seat's turn
  (the computer's included), and in both board views.
- **Always current.** It updates as soon as a unit is destroyed or loses
  equipment. Whether a damaged ship counts at its full purchase value or
  less is settled by the spec, following `armyValue`.
- **Easy to read.** Each player is identified by name and colour, and the
  active player stands out.
- **Same figure as Game Over.** The Game Over screen shows the same numbers,
  because both come from one engine function.
- **No change to rules, saves or undo.** Undo and redo update the shown
  score with the state.

## Constraints

- **Rule basis.** The score is the rulebook's end-of-game count, quoted
  above.
  - **The naval bonus.** The final count adds 30 points for the player
    whose ships are left alone at sea (`05-rules-french-original.md:487-489`):
    "Le joueur dont les vaisseaux restent seuls en mer obtient, lors du compte
    final, une bonification de 30 points."
  - The spec checks whether `armyValue` applies that bonus today. If it
    doesn't, the spec decides whether the live score shows it. The intent
    does not change the scoring rule.
- **Engine and presentation.** The number comes from the engine. The HUD
  only draws it.
- **Size.** `BoardScene.ts` is at its 3172-line ceiling, so the HUD element
  goes in a small `src/ui` module, with at most a net-neutral scene hook.
- **Text.** Any label goes into `en.ts` and `fr.ts`.
- **Live check owed** (rule 1: `src/scenes/**`, `src/ui/**`; visual and new).

## Type-specific questions

### Feature
- **Users:** hotseat players, and anyone watching a computer seat.
- **Rulebook basis:** `05-rules-french-original.md:480-489`, quoted above.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. **Where.** A compact always-on strip in a screen corner, or added to
     the existing status/HUD line? The draft assumes a small panel that
     can't be dismissed, clear of the bottom-left buttons, the message log
     and the Tables panel.
  2. **What each entry shows.** The score only, or the score plus a
     secondary figure such as units left, or the difference from the
     starting 400?
  3. **Eliminated players.** Are they shown at 0, greyed out, or removed?
  4. **The naval bonus.** Is it included live, and only when it applies?
     It depends on the answer about `armyValue` above.

## The owner's answers (2026-11-22)

1. **Where:** a small fixed panel that is always shown.
2. **What each entry shows:** the score and the number of units left.
3. **Eliminated players:** still listed, at 0.
4. **The +30 naval bonus:** shown live, whenever it applies.

## Assumptions I made

- **Type:** feature, because it is a new HUD element.
- **Tier:** set by the path table, so `review_tier` is left empty.
- **Id:** 81, from `npm run queue -- --next-id`.
- **"Score"** means the rulebook's surviving purchase value, the same figure
  Game Over shows. It does not mean kills or points lost.
- **No blocker.** No open intent changes the HUD.
