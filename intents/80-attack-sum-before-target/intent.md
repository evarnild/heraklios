<!-- generated-by: heraklios/intent@0.1.5 -->
# §80 — The attack line shows the attackers' total before a target is chosen

**Type:** feature
**Originator:** the owner (2026-11-22): "when I select units for attacks, I
want to display in the log the current sum of attack points. It is only shown
when I have selected a target."
**Source:** §53 (`intents/53-log-autosave-and-attack-selection/spec.md`, B3
and B5).

## Problem

In the combat phase, picking attackers writes the attack being built to the
log (§53). Until a target is picked, the line has no number:
`Attack: Archers, Hoplites, choose a target.`
(`src/ui/i18n/format.ts:113`, `en.ts:314`, `fr.ts:297`).

The total only appears once a target is chosen:
`Attack: … (12) → … (6)`.

§53 left the number out on purpose. Its B3 says "no number: an attacker's
force depends on its targets". `attackForceAgainst`
(`src/engine/combat.ts:266-272`) picks melee or ranged attack depending on
how far each target is.

While gathering attackers, the player therefore can't see how strong the
group is. They need that to judge whether it is worth picking a target, or
whether to add another unit first.

## Outcome

- **A number before the target.** The "choose a target" line carries the
  group's total attack while no target is picked yet, for example
  `Attack: Archers, Hoplites (5), choose a target.`
- **It updates with the group.** It changes with every attacker added or
  removed, on the same clicks §53's B4 already logs.
- **The line with a target is unchanged.** Once a target is picked, the line
  is today's, with the exact force against that target.
- **Two lines can differ.** The number before a target may then differ from
  the one after, for example when an archer turns out to fight in melee. That
  is accepted and documented, as long as the number is defined clearly (see
  the open questions).
- **Ships.** The naval line (§53 B6) gets the same treatment for a ram or
  boarding, or explicitly none (spec).
- **No rule changes.** The combat roll is unchanged.

## Constraints

- **Rules.** No rule is involved: this is a pre-roll display. The number must
  come from the engine (a pure function in `src/engine/combat.ts` beside
  `attackForceAgainst`), with tests, never from the scene.
- **Display text.** It goes through `src/ui/i18n/format.ts` and the en and fr
  tables. Both tables change their `attackChooseTarget` signature.
- **Size.** `BoardScene.ts` is at its ceiling (3172). The change should stay
  in `format.ts` and the engine. If the scene must pass something new, it
  needs a budget line or must be net-neutral.
- **Overlap with §73.** §73 rewrites how BoardScene settles combats, but not
  attack building or this log line. No blocker.
- **Live check.** The change is to text in the log. If it touches only
  `src/engine` and `src/ui/i18n`, the e2e `attack-log.spec.ts` may stand in,
  which `/review` decides. Otherwise a live check is owed.

## Type-specific questions

### Feature
- **Users:** hotseat players building a land attack. It also applies to ram
  and boarding if the spec says so.
- **Rulebook basis:** digital-only, a log aid. No print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. **Which number before a target?**
     - (a) **Melee attack.** The sum of each attacker's printed attack
       (`currentAttack`). Archers count 0, since they can't fight in melee
       (`src/data/units.ts`: `archers` has `attack: 0`, `meleeCapable:
       false`).
     - (b) **Best per unit.** Each attacker counts the larger of its melee and
       ranged values. That is an upper bound.
     - (c) **Both.** Show both totals, for example `(melee 4, ranged 4)`.
     - The draft assumes (b), "up to N", because a group of archers would
       otherwise show 0.
  2. **Ships.** Should ships show a number for a ram or boarding too, or stay
     as today?
  3. **Wording.** Should the line say it is an estimate, for example
     `(up to 5)`, so it isn't mistaken for the exact force?

## The owner's answers (2026-11-22: "80 1c 2 stay as today 3 as estimate")

1. **(c) Both totals.** Before a target is picked, the line shows both the
   melee total and the ranged total. For example: `Attack: Archers, Hoplites
   (melee ~4, ranged ~4), choose a target.` The exact form is for the spec.
2. **Ships stay as today.** The ram/boarding line is unchanged (§53 B6).
3. **Marked as an estimate.** The wording makes clear these totals are not
   the exact force, for example `~` or "up to". The spec fixes the wording in
   English and French.

The outcome's single number reads as these two totals, and the "best per
unit" assumption in open question 1 no longer applies.

## Assumptions I made

- **Type: feature.** It reverses a recorded spec decision (§53 B3), so it
  needs a spec, not an adjustment.
- **Tier.** The path table decides (`src/engine/**` and `src/ui/**`), so
  `review_tier` is left empty.
- **Id:** 80, from `npm run queue -- --next-id`.
- **No blocker.** No open intent touches `format.ts`'s attack line or
  `attackForceAgainst`.
