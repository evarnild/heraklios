<!-- generated-by: heraklios/intent@0.1.1 -->
# §29 — Count live checks in the SDLC scan and grid

**Type:** feature
**Originator:** me (Eric) — split out of §28's scope
**Source:** [§28 spec → Out of scope](../28-live-checks-and-merge-rule/spec.md#out-of-scope), first bullet

## Problem

§28 makes a live check an owner-held condition before merge, but nothing
measures whether it earns its keep. `npm run sdlc:scan` and `/grid` count
verdicts, tiers and follow-up fixes, not live checks. Without numbers I
can't tell whether live checks catch defects the review missed, or whether
they're a chore I do and forget. The same question the grid asks about the
Attested boundary ("do attested changes need more follow-ups?") applies here.

## Outcome

- `npm run sdlc:scan` reports, for merged intents in its window: how many
  reviews said `live-check: owed`, how many of those have `live_checked:`
  recorded, and how many live checks found a defect.
- `/grid` shows those counts under the Test or Deploy stage, and the
  "against rubber-stamping" reading: live checks that never find anything
  over, say, 10 changes are a reason to narrow when they're owed.
- An owed live check on a merged intent with no `live_checked:` date is
  listed by name, because it means a merge happened without one.

## Constraints

- Depends on §28 being merged (the `live-check:` and `live_checked:` fields).
- Flat-text parsing, no YAML dependency, like the rest of `scripts/`.
- The scan reads only the current round's header; reuse §28's
  `parseReviewHeader` rather than a second parser (§28 plan, Assumptions).
- §26 and §27 have no `live-check:` field: they count as "not recorded", not
  as "not needed".

## Type-specific questions

### Feature
- **Users:** the owner, reading `docs/sdlc-grid.md` every few weeks.
- **Rulebook basis:** digital-only — process, no print rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  - How is "the live check found a defect" recorded? A `live_check_result:`
    field, a line in `review.md`'s `## Live check` section, or a
    `follows_up:`-style link from the rework round?
  - Does a check that sent a change back to rework count once or per round?
  - Should `sdlc-scan.mjs` move fully to `parseReviewHeader` (also for
    `verdict`, `tier`, `round`, `sampled`)?

## Assumptions I made

- Type is feature, not adjustment: it needs a recording decision and the
  scan change plus tests will pass 60 lines.
- Volume will be low for months; the grid should show raw counts, not rates.
