---
name: grid
description: Draft or update heraklios's AI-native SDLC grid (docs/sdlc-grid.md) — the L0–L4 level per stage (Intent, Design, Build, Test, Deploy, Maintain), the evidence behind each, the outcome measures, and the two stages to move next. Use at the start of a quarter, after a pilot change, or when asked "where does heraklios stand".
metadata:
  owner: evarnild
  version: 0.1.0
  scope: repository
  status: experimental
  review-tier: automated
---

# /grid — where heraklios stands

The kit proposes, the owner disposes: you pre-fill the grid from evidence;
the user confirms. The scan cannot see deliberate choices ("Maintain is out
of scope", "Design and Build are one step for features") — keep any the user
already recorded.

Stamp: keep or add `<!-- generated-by: heraklios/grid@0.1.0 -->` as the first
line of `docs/sdlc-grid.md`.

## 1. Collect evidence — don't ask for it

```bash
npm run -s sdlc:scan            # readiness, intents, stamps, verdicts, outcome
git log --first-parent main --since=<last grid date> --oneline
```

Also read: the existing `docs/sdlc-grid.md` (previous levels and the user's
declared choices), `intents/*/metadata.yml` and `review.md` files, and
`.claude/skills/`, `.claude/agents/` for what is codified.

## 2. Score each stage against what the level leaves behind

Use the cheat sheet in `docs/sdlc-grid.md` → "What each level means here".
A level counts only when its trace exists:

- **L1** — the artefact exists and is linked: merged changes reference an
  intent id; `intents/<id>/` holds what the type requires; context file
  present; `npm run verify` ran.
- **L2** — a versioned skill produced it: the artefact carries a
  `generated-by:` stamp. Required from the start — no self-assessment.
- **L3/L4** — a trigger fired, not a person: show the hook / schedule
  config and its run log. Without that, it is not L3.

Levels can differ by intent type (e.g. Fix at L2, Feature at L1) — note the
type beside the level. Score honestly; a grid that looks better than the
software is worse than none. A stage whose underlying infrastructure is
missing (no meaningful tests for a module, no way to observe it) is scored
at its real level, and building that infrastructure is a legitimate move.

## 3. Outcome beside progress

Copy the scan's outcome block into the grid's measures table with the date.
Rules from the strategy: never report throughput without the revert rate
beside it, and if levels climbed for two quarters with no outcome movement,
say so — the model is wrong for this area.

## 4. Propose the two moves

Pick the two stages where the bottleneck actually is — climb (a level up)
or widen (more changes following their type's path). One sentence each on
why, and the concrete first step. Record them in "The two we move".

## 5. Write and report

Update `docs/sdlc-grid.md` in place: the grid table, evidence column, a new
dated row in the measures table, the two moves, and a dated changelog line.
Tell the user what moved since last time, what you could not verify, and
which levels you scored lower than they might expect, and why.
