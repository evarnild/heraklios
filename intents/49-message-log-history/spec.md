<!-- generated-by: heraklios/spec@0.1.0 -->
# §49 spec — The Board keeps every message in a scrollable log, clear of the bottom-left buttons

Accepted intent: [intent.md](intent.md)

Written against `main` at `749d72d`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| rulebook | nothing: digital-only, no print rule |
| `README.md` "Combat log detail" | what a combat entry holds (unchanged by this) |
| `src/scenes/BoardScene.ts:823-835` | the log is one `Text` at (16, 178), 268 px wrap, depth 29 "without having to cap or scroll the log itself" |
| `src/scenes/BoardScene.ts:1430-1445` | `log(message)` replaces the text; `appendLine` joins a drift's lines into one message |
| `src/scenes/BoardScene.ts:258-259` | a drift seeds its narration with the current log text |
| `src/scenes/BoardScene.ts:686-777` | bottom-left stack: Redo `h−40`, Undo `h−72`, Save / Load `h−104`, Abandon `h−136`, End game `h−168`, Pause `h−200`, drift Continue `h−232` (shown only during a drift pause) |
| `src/scenes/BoardScene.ts:1228-1251` | Undo already logs `log.undone(label)` |
| `src/ui/MapView.ts:252-263` | the scene-wide `wheel` handler zooms the map wherever the pointer is |
| `src/engine/state.ts:160-161` | `turnNumber`, `activePlayerIndex` (into `seatOrder`), `currentPlayer(state)` |
| `src/ui/i18n/en.ts:208` | the `log` message group |
| owner's answers, 2026-10-23 | history starts empty on load; undo keeps the history; a heading per turn and player; the whole game is kept |

## Behaviour

**B1 — Every message is kept.** Each call that today shows a message in the
log (`log`, `appendLine`) adds an **entry** to the Board's history instead of
replacing the text. Nothing is ever removed during the game (owner: whole
game).

**B2 — Turn and player headings.** Before the first entry of a new
`(turnNumber, active player)` pair, a heading line is added: "Turn N —
<player name>" (French: "Tour N — <nom>"). It is styled apart from the
entries (brighter, not wrapped into the entry above).

**B3 — A drift is one entry that grows.** While a drift narration is in
progress, each `appendLine` updates the **last** entry in place, so the
direction, each hex and each trample read as one block, as today. The drift
entry no longer starts with a copy of the message before it (`:258`): that
message is still visible as its own entry right above.

**B4 — The log panel.** The history is drawn in a fixed panel in the left
column, from y = 178 (where the log starts today) down to `height − 240`, 8 px
above the drift Continue button's top. It therefore never overlaps the six
bottom-left buttons nor the Continue button, whatever the length of an entry
or of the history (the intent's outcome 2). Entries wrap at the panel width,
less the scrollbar.

**B5 — Scrolling.** When the history is taller than the panel:
- a vertical scrollbar at the panel's right edge shows the visible part's
  position and size; dragging its thumb scrolls;
- the mouse wheel over the panel scrolls the log and does **not** zoom the
  map; over the map, the wheel zooms as before;
- content outside the panel is clipped, never drawn over the buttons.

**B6 — Following the newest.** While the view is at the bottom, a new entry
(or a growing drift entry) keeps the newest line in view. When the player has
scrolled up, a new entry doesn't move the view; scrolling back to the bottom
resumes following.

**B7 — The newest entry stands out.** The latest entry is drawn in the
brighter log colour; older entries in a dimmer one.

**B8 — Lifetime.** The history belongs to one Board scene. A new game and a
loaded game start with an empty history; a load's "Game loaded." is the
first entry. The history is not saved (owner: start empty). Undo and redo
add their own entries (B1, `log.undone`) and remove none (owner: keep it).

**B9 — Text unchanged.** Every message's wording, in English and French, is
what the Board shows today; only headings (B2) are new text.

## Interpretations

None of the rulebook. Two readings of the intent:
- "all messages are kept" covers the Board's log only; prompts, the status
  line and the Save / Load panel's own messages are not entries.
- A drift's seed copy (`:258`) is dropped (B3) because, with a history, the
  copy would show the same combat twice. Recorded as a comment at the seed
  site.

## Acceptance criteria

- **AC1 — the history model** (`src/ui/logHistory.test.ts`, pure, no Phaser):
  - adds entries in order and never drops one (B1);
  - adds a heading exactly when the turn or the active player changes, and
    not before a repeat of the same pair (B2);
  - updates the last entry in place during a drift and starts a new one
    after it (B3);
  - the scroll arithmetic: clamped offset, thumb size and position, "at
    bottom" following, no move when scrolled up (B5, B6).

  Mutants to kill: the heading on every entry; the heading never; append
  instead of update during a drift; following when scrolled up.
- **AC2 — the layout rule** (same test file, or a `BoardScene` layout
  helper's test): the panel's bottom is above `height − 232` and its top is
  178 at the 1100×750 game size; a history taller than the panel is clipped
  to it (B4).
- **AC3 — e2e** (new scenario `e2e/message-log.spec.ts`, through
  `devHook`):
  - from Test mode, make two moves and one attack; the hook's
    `logEntries()` holds the attack's entry and the earlier ones, with a
    heading (B1, B2);
  - the panel's bottom edge (from the hook) lies above the Pause button's
    top (B4);
  - the existing scenarios that click the bottom-left buttons (save-load,
    save-import, attacks, naval…) stay green.
- **AC4 — i18n:** the heading is in `en.ts` and `fr.ts`, and
  `noLiterals.test.ts` stays green (B9).
- **AC5 — live check** (owed: `src/scenes/**`, new and visual), from Test
  mode:
  - play until the log overflows, then scroll with the wheel over the panel
    (the map doesn't zoom) and drag the scrollbar;
  - scroll up and let a new message arrive: the view stays put;
  - a combat entry and an elephant drift read in full;
  - in French, the headings;
  - nothing overlaps the buttons, including during a drift pause.
- **AC6** — `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS.

## Non-functional

- **Engine/presentation split:** the history list, headings, drift update
  and scroll arithmetic go in a pure, tested `src/ui/logHistory.ts` (no
  Phaser import). `BoardScene` only draws it (Phaser text in a masked
  container, a `Graphics` scrollbar) and routes `log`/`appendLine` to it.
  `BoardScene.ts` is already over the 500-line guardrail; new drawing code
  should go in a small `src/ui/logPanel.ts`, not grow the scene. The lint
  count must not rise.
- **Save format:** unchanged; no `SAVE_VERSION` bump (B8).
- **Undo boundaries:** unchanged. The log is not part of `GameState`, so
  undo snapshots don't carry it.
- **AI / harness:** untouched. `legalActions` and `applyAction` don't log.
- **MapView:** the wheel handler skips zooming when the pointer is over the
  log panel (a hit-test hook from the scene); no other camera change.

## Out of scope

- Saving the history, filtering or searching it, copying it out, or showing
  it after the game ends (`GameOverScene`).
- Re-rendering old entries in another language. The Board has no in-game
  language switch (it is on the Menu), so entries stay as shown.
- Moving or restyling the six buttons.

## Assumptions I made

- **Panel bounds** 178 … `height − 240` (B4): 178 is where the log starts
  today, under the status texts at 118 and 140; the bottom clears the drift
  Continue button (`h − 232`), the highest thing in the stack.
- **Follow-the-newest only when at the bottom** (B6), so reading old
  entries during an AI turn isn't interrupted.
- **Heading wording** "Turn N — <player name>", using the player's name as
  the Board shows it.
- **Whole game kept** (owner), with no cap. A few hundred entries are cheap
  to keep, and the drawing code must not re-lay-out every entry on each new
  one if that shows as slow in the live check.
- **The e2e scenario** (AC3) needs `devHook` to expose `logEntries()` and
  the panel's bounds; dev-only, never in a production build (its global
  setup checks this).
