<!-- generated-by: heraklios/intent@0.1.5 -->
# §90 — A retreating unit never pushes its way into a hex in enemy zone of control

**Type:** fix
**Originator:** the owner, while playing (2026-11-24)
**Source:** none. The owner's report, and the open question recorded in `src/engine/combat.ts`'s `pushCandidates` comment.

## Problem

The owner's words: "the yellow player had units in 34,-12; 35,-12; 35,-11;
34,-10 that attacked a green unit at 34,-11. there was also a green unit at
33,-10. The attack resulted in DR and the defending unit should have been
eliminated because all retreat hex were in an enemy control zone. But the
game proposed to move the friendly unit at 33,-10 to allow a retreat of the
attacked unit".

Traced on `main`. The hexes are all plain, with no river hexside between
them. The defender at 34,-11 has six neighbours:

- four hold the yellow attackers (35,-11; 35,-12; 34,-12; 34,-10);
- 33,-11 is empty but in the ZOC of the attacker at 34,-12, so
  `legalRetreatHexes` rightly refuses it;
- 33,-10 holds the green friend, and it is in the ZOC of the attacker at
  34,-10.

So there is no legal retreat, and `pushCandidates` offers the friend at
33,-10. Pushing it makes the defender take 33,-10, a hex in enemy ZOC that
it could never have retreated into directly. The rulebook forbids retreating
into an enemy ZOC: "il est interdit de faire retraite dans une zone de
contrôle ennemie".

The code does this on purpose, and says the question is open.
`pushCandidates`'s comment (`src/engine/combat.ts`, "NOT checked here,
unlike `legalRetreatHexes`: whether the inherited hex sits under enemy ZOC")
ends: "a unit could in principle be pushed into a hex under enemy ZOC that
it could never have retreated into directly. Left as-is rather than silently
'fixed' one way or the other — a real design decision for whoever picks this
up next". The owner has now made that decision (below).

## Outcome

- **Your position eliminates the defender.** In the reported position (any
  land unit types on that plain ground), a DR eliminates the defender at
  34,-11: no push is offered, and the friend at 33,-10 does not move.
- **The rule.** A unit with no legal retreat may push a friendly neighbour
  only if the hex it would take is not under enemy ZOC. The same holds at
  every link of a push cascade: each unit that takes a vacated hex must be
  able to take it without entering enemy ZOC. ZOC is computed as today:
  rivers block it, and naval units project none (`hexesUnderZoc`).
- **What stays.** The mixed-neighbour reading stays (owner's choice). A push
  is still possible when some neighbours are enemies or ZOC-blocked and a
  friend can make room, provided the friend's hex is free of enemy ZOC.
  Elephant drift and naval rules are untouched.

## Constraints

- **Rulebook**:
  - `docs/research/05-rules-french-original.md:136`: "il est interdit de
    faire retraite dans une zone de contrôle ennemie".
  - `:239-243`: "Une unité qui se trouve dans l'impossibilité de reculer,
    soit parce qu'elle est en bordure de mer, soit parce qu'elle est entourée
    de zones de contrôle ennemies, est tout simplement retirée du jeu. Le
    seul cas fait exception à la règle, lorsque cette unité est entourée
    d'unités amies. Dans ce cas, elle pousse une de ses pièces et prend sa
    place."
  - The transcription, `02-rules-transcription.md:98`: "A retreating unit
    may never be forced to retreat into an enemy ZOC hex."
- **The owner's ruling, 2026-11-24.** Of three readings offered, the owner
  chose "Mixed, never into ZOC". The two rejected:
  - push only when no neighbour is an enemy unit or enemy-ZOC-blocked;
  - push only when all six neighbours are friends.

  The `pushCandidates` interpretation comment must record this ruling and
  replace its "left as-is" paragraph, per the ambiguous-passage convention
  (`CLAUDE.md`).
- **Engine only.** The rule lives in `src/engine/combat.ts`
  (`pushCandidates` and its fixpoint), tested in `src/engine/combat.test.ts`.
  Scenes only show what the engine offers. Every consumer goes through
  `pushCandidates`: the Board, the computer seats, the fuzz harness, and
  §73's session.
- **Seeded games change where a push did.** The fuzz harness's pinned
  traces and push counters (`fuzzHarness.test.ts` `pushesResolved`,
  `buildPushScenarioGameState`, `harnessPinned.test.ts`) may change. Any
  re-pinned trace is justified line by line in the plan, never
  bulk-accepted.
- **No save-format change.** A save never holds push candidates.
- **README** (`README.md:110-118`, the retreat paragraph) says a friendly
  unit "that can make room" is offered. It must say the taken hex can't be
  in enemy ZOC.

## Type-specific questions

### Fix
- **What broke:** the defender is offered a push into its friend's hex,
  33,-10, which is in the enemy ZOC of the attacker at 34,-10. It should be
  eliminated.
- **Since when:** since the push exception was widened and made to cascade
  (`4ee07c3` and `cd7b8fc`, 2026-08-07, plan-history §12.3). The
  single-level version before that never checked ZOC either, per the
  comment.
- **Impact:** a rules error in land combat. A unit survives a DR it should
  lose, in hotseat and computer games alike. No save is corrupted. Games
  already played or saved are not changed retroactively.
- **Reproduction:** set up the units as reported (green at 34,-11 and
  33,-10, yellow at 34,-12, 35,-12, 35,-11 and 34,-10), then attack 34,-11
  until a DR comes up. In the engine: build that state and call
  `pushCandidates(state, defender)`. Today it returns `[unit at 33,-10]`.
- **The test that will fail first:** a new case in
  `src/engine/combat.test.ts` `describe('pushCandidates')`, using exactly
  the reported position. It expects `legalRetreatHexes(state, defender)`
  to be empty and `pushCandidates(state, defender)` to be empty. A second
  case uses the same position with the attacker at 34,-10 removed, so 33,-10
  is ZOC-free, and expects the push still offered. That proves the mixed
  reading stays.

## Assumptions I made

- **"Never into ZOC" applies at every cascade link,** not only the first.
  A deeper link taking a hex in enemy ZOC is the same act the owner ruled
  out. The plan can split it out if it proves contentious.
- **Review tier: `reviewed`.** `src/engine/combat.ts` is Attested by the path
  table, but this fix replaces a recorded rule interpretation on the owner's
  ruling, so I raised it: the owner should read the diff of a rule change.
- **`follows_up:` left empty.** The cause predates the intents system
  (2026-08-07, plan-history §12.3), so no intent id names it.
- **The coordinates are the game's axial `q,r`,** as `hexKey` uses and the
  map editor and tooltip show. The trace above matches the report exactly,
  which supports it.
- **No `blocked_by`.** §73 (BoardScene on the engine session) moves retreat
  plumbing but leaves `pushCandidates` in `combat.ts`. Whichever merges second
  rebases; it is linked, not blocking.
