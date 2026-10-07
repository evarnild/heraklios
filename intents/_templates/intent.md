# §<id> — <title>

**Type:** <feature | fix | refactor | adjustment | experiment>
**Originator:** <who noticed / asked — "me, while playing", a GitHub issue, a review finding>
**Source:** <link: plan-history.md §, issue, review.md finding, or "none">

## Problem

<The problem in the originator's own words. What is wrong or missing, for
whom, and how you know. No solution here.>

## Outcome

<What is true when this is done, stated so a reviewer can check it. One to
three bullets.>

## Constraints

<Rulebook passages that bind this (`docs/research/…` with the quote), the
engine/presentation boundary, save format, undo boundaries, performance,
anything out of scope.>

## Type-specific questions

<!-- Keep only the block for this intent's type. -->

### Fix
- **What broke:** <observed vs expected behaviour>
- **Since when:** <commit / § that introduced it, if known>
- **Impact:** <who hits it, how often, does it corrupt a game or a save>
- **Reproduction:** <steps or a seed for `playRandomGame`>
- **The test that will fail first:** <file and what it asserts>

### Feature
- **Users:** <hotseat players, AI seat, map-editor author>
- **Rulebook basis:** <passage, or "digital-only — no print rule">
- **Known simplification it removes:** <README bullet, or none>
- **Open design questions:** <for spec.md to settle>

### Refactor
- **What is restructured:** <files/modules>
- **How behaviour is held constant:** <existing tests that must stay green untouched; any characterisation tests to add first>
- **Why now:** <what this unblocks — parallel work, a lint guardrail, a feature>

### Adjustment
- **Exactly what changes:** <the wording/constant/config>
- **Blast radius:** <files; must stay ≤5 files, ≤60 lines, no rule code>

### Experiment
- **Question:** <what we want to learn>
- **Containment:** <where it runs — test mode, a scratch script, a branch never merged into rule code>
- **What happens to the result:** <becomes a new intent, a plan-history note, or is thrown away>

## Assumptions I made

<Anything filled in without being told. A skill must list these; a human
should read them before accepting.>
