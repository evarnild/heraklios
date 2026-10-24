<!-- generated-by: heraklios/spec@0.1.0 -->
# §53 spec — The log says when the game autosaves, and shows the attack being built

Accepted intent: [intent.md](intent.md)

Written against `main` at `00611f1`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| rulebook | nothing new: the totals are the forces the combat rules already use (`docs/research/02-rules-transcription.md` through `src/engine/combat.ts`) |
| `src/engine/combat.ts:266-272` (`attackForceAgainst`), `:274-327` (`computeLandAttackDetail`) | an attacker's force depends on the defenders (melee at contact, ranged at its exact range); `attackForce` is the sum over attackers, `defenseForce` the sum of `currentDefense` over defenders. **Terrain and the river are a die-roll modifier (`modifiedDieRoll = rawDieRoll + modifier`), not part of either force** |
| `src/scenes/BoardScene.ts:989-994` (`autosave`), called at `:866` (the board opens), `:2876` (a player's movement phase begins) and `:1128` (the end-game request) | where an autosave happens; today only a failure is logged (`saves.autosaveFailed`) |
| `src/ui/saveLoadPanel.ts:305-307`, `:335`; `BoardScene.ts:1014` | a manual save already logs "Saved to slot N." (or the overwrite line) through `onStatus` |
| `BoardScene.ts:1884-1928` (`toggleAttacker`), `toggleDefender` (`:1956`), `pruneIllegalCombatSelections` (`:1942-1954`) | the clicks that build an attack, and the prune that drops stranded units |
| `BoardScene.ts:3046-3048` (`applyAiAction` → `executeLandAttack`) | the AI never builds an attack by clicks; its attack goes straight to the roll, whose combat report already lists attackers and defenders with forces |
| owner's answers, 2026-10-24 | autosave: a short line each time; attack: names and totals, not the odds |

## Behaviour

**B1 — Autosave line.** After an autosave the server confirms, the log shows
`Autosaved.` (French: `Sauvegarde automatique effectuée.`). It appears at every
autosave: when the board opens (a new or a loaded game), at the start of each
player's movement phase, and after the end-game request. A failed autosave
keeps its existing message and shows no `Autosaved.` line. An autosave that is
skipped (a retreat, drift or decision pending, `BoardScene.ts:990`) logs
nothing, as today.

**B2 — Manual save unchanged.** The manual-save and overwrite lines stay as
they are.

**B3 — The attack line.** In the combat phase, after each human click that
changes the land attack being built, the log shows one line describing the
whole current attack:
- with at least one target: `Attack: <attackers> (<attack force>) → <targets>
  (<defence force>)`, e.g. `Attack: Archers, Hoplites (12) → Peltasts (6)`;
- with attackers but no target yet: `Attack: <attackers>, choose a target.`
  (no number: an attacker's force depends on its targets, B5);
- when a click empties the attacker group: `Attack cleared.`

Names are the units' display names (`nameOf`), in the order they were picked,
joined by `, `.

**B4 — Which clicks.** A line is logged after: adding an attacker, removing an
attacker, adding a target, removing a target, and a prune that drops stranded
units (after its "Removed from the combat…" line, so the attack line shows
what is left). A refused click (already attacked, can't reach, no common
target, single-target mode) logs only its existing refusal, no attack line.
Undo and redo log only their existing "Undone/Redone" line. Resolving the
attack logs the combat report as today, with no attack line before it.

**B5 — The totals.** The attack force is the sum of each attacker's
`attackForceAgainst(attacker, targets)` and the defence force the sum of
`currentDefense` over the targets: exactly `attackForce` and `defenseForce`
that the roll's `describeLandAttack` reports for the same attackers and
targets. They come from a new pure function in `src/engine/combat.ts` that
`computeLandAttackDetail` also uses, so the two cannot drift apart. The
terrain and river modifier is not shown (it changes the die roll, not the
forces; see Interpretations).

**B6 — Naval.** Selecting a ship for a ram or a boarding logs `Attack:
<ship>, choose a target.`; deselecting it logs `Attack cleared.` Picking the
target resolves at once and logs the existing report, as today. No totals
for naval.

**B7 — The AI.** The computer's attacks log nothing new: they never go
through the clicks, and their combat report already names every unit and
force.

**B8 — Both languages.** Every new line has an English and a French text in
`src/ui/i18n/`; switching language changes them like the other log lines.

## Interpretations

- **"Totals (terrain and river modifiers included)"** (intent Outcome): the
  combat code applies terrain and the river to the **die roll**
  (`combat.ts:308-309`), not to either force, so "the totals the roll will
  use" are the two forces alone (B5). Showing the modifier would add a third
  number the owner didn't ask for; it is out of scope here.
- **"A message about the selected units and targeted units"**: one line per
  change, describing the whole attack, rather than one line per clicked unit,
  so the last line in the log is always the current attack (B3).
- **"When you save or auto save"**: the manual save already does this (B2);
  §53 adds the autosave line only.

## Acceptance criteria

- **AC1 — the totals** (`src/engine/combat.test.ts`): the new function gives
  the same `attackForce` and `defenseForce` as `describeLandAttack` for: one
  melee attacker on one defender; a ranged attacker at its range; a mixed
  group against two defenders in multi-defender mode; an attacker on a
  defender across a river and on a hill (forces unchanged by the terrain).
  Exact numbers, not "positive".
- **AC2 — the line text** (a pure formatter with tests, e.g. in
  `src/ui/i18n/format.ts` and its test): the three forms of B3 and the naval
  form of B6, in English and French.
- **AC3 — e2e** (`e2e/attacks.spec.ts` or a new scenario, read through the dev
  hook's `logEntries()`): in a test-mode board, the log gains `Autosaved.`
  when the board opens; selecting an attacker logs `Attack: <name>, choose a
  target.`; adding a target logs the line with both totals; deselecting the
  attacker logs `Attack cleared.`; a refused click adds no attack line.
- **AC4 — live check** (owed: `src/scenes/`, `src/ui/`, new behaviour): play a
  hotseat combat phase in English and French, build a two-attacker,
  two-target attack, remove one target, and confirm each line matches the
  board; end a movement phase and see `Autosaved.`; stop the dev server's save
  API (or run without it) and see the failure line instead.
- **AC5** — `npm run verify` green, lint ≤ 21, `npm run check:intent` PASS
  apart from the owed live check.

## Non-functional

- **Engine/presentation split:** the totals in `src/engine/combat.ts`; the
  text in `src/ui/i18n/`; the scene only calls them and logs.
- **Save format:** unchanged; no `GameState` change.
- **Undo boundaries:** none new; logging records no history entry.
- **AI / harness:** `legalActions`, `applyAction` and the fuzz harness are
  untouched.

## Out of scope

- Showing the die-roll modifier, the odds ratio or the expected result
  before the roll.
- Changing the manual-save message.
- Announcing the computer's attacks before its roll.
- A setting to turn these lines off.

## Assumptions I made

- The French wording (`Sauvegarde automatique effectuée.`, `Attaque : … →
  …`, `choisissez une cible`, `Attaque annulée.`); the implementer may adjust
  it to match `fr.ts`'s style.
- No number with attackers but no target (B3), because the force depends on
  the targets.
- Undo and redo don't re-log the attack line (B4); the "Undone" line names
  the click that was undone.
- The autosave line also appears when a loaded game opens, near "Game
  loaded" (the owner asked for a line each time).
- The e2e reads the log through the existing `logEntries()` hook; no new dev
  hook.
