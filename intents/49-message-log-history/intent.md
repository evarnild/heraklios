<!-- generated-by: heraklios/intent@0.1.4 -->
# §49 — The Board keeps every message in a scrollable log, clear of the bottom-left buttons

**Type:** feature
**Originator:** the owner, while playing
**Source:** none

## Problem

After an action — a combat above all — the Board shows its message in the
left panel, and the next message replaces it: there is no way to look back at
what happened earlier (the previous combat's forces and die roll, a drift's
steps, who retreated where). A long message also runs down the panel and
under the bottom-left buttons (Pause, End game, Abandon, Save / Load, Undo,
Redo), so its end is hidden behind them. The code says as much: the log text
sits one depth below the buttons "without having to cap or scroll the log
itself" (`src/scenes/BoardScene.ts:830-835`).

## Outcome

- Every message the Board logs during a game stays available in a log panel
  in the left panel; the newest is visible without scrolling, and the player
  can scroll back (scrollbar and mouse wheel) through all earlier ones.
- The log panel never overlaps the bottom-left buttons, whatever the length
  of a message or of the history.
- What the Board says today is unchanged in content: the same messages
  (combat detail, drift narration, save messages…) in English and French.

## Constraints

- Digital-only; no rule changes. The engine/presentation split holds: any
  pure logic (the history list, its bound, how entries are grouped) goes in
  a tested module, and `BoardScene` only wires and draws it.
- Player-facing text stays in `src/ui/i18n/` (`noLiterals.test.ts`).
- Undo/redo and the die-roll boundary are untouched by the log itself.
- The game's own size is 1100×750 and the left panel 300 px wide
  (`BoardScene.ts:85`); the buttons sit at `height − 200` … `height − 40`.
- `src/scenes/**` / `src/ui/**` changes owe a live check; the e2e scenarios
  that click buttons in that panel (save-load, save-import, attacks…) must
  stay green.

## Type-specific questions

### Feature
- **Users:** hotseat players (and anyone watching an AI seat's turn).
- **Rulebook basis:** digital-only — no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - Does the history survive a save and load (a new field in the save
    format, `SAVE_VERSION` bump), or start empty on load?
  - What undo does to the history: keep it (it is a record of what was
    shown), or roll it back with the state?
  - A bound on the history (all of a long game, or the last N entries)?
  - Separators or headings per turn/phase/player, and whether entries carry
    the turn number.
  - The drift narration, which today appends lines to one message
    (`appendLine`): one entry or one per step?
  - Language switch mid-game: entries stay in the language they were shown
    in, or are re-rendered?
  - Layout: where the panel's top and bottom are, so the status and phase
    texts above it and the buttons below keep their places; whether the
    newest entry is highlighted.

## Assumptions I made

- **Bottom left**, not bottom right: the owner corrected the first wording;
  those are the six buttons stacked at the bottom of the left panel.
- **"Messages" means the Board's log** (`BoardScene.log` / `appendLine`, the
  text at `BoardScene.ts:823`), not the status line, prompts or the save/load
  panel's own messages.
- **Feature, not adjustment:** a new scrolling panel and a history model is
  more than five files' worth of wording, and it may touch the save format.
- **The history belongs to the Board scene** of one game; a new game starts
  with an empty log.
