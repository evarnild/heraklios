# §<id> plan — <title>

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (feature only)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

<One paragraph: what the change achieves, in terms of the intent's outcome.>

## Risks

<What could go wrong — the classes of bug this project has hit before
(fall-through instead of return in drift.ts, tests that pass without proving
the rule, stale line citations), plus anything specific here.>

## Verified against the codebase

<Every file, symbol and line this plan relies on, re-read on current main.
`path:line — what is there`. Line numbers rot; re-check before launch.>

## Subtasks

1. <Small, ordered, each independently committable.>

## Tests

<Test contract: edge cases, negative paths, error handling, async (drift,
agents), integration boundaries. For a fix: the failing-first test. For each
behavioural line, which test would fail if it were mutated.>

## Validation

- `npm run verify` green
- `npm run check:intent` PASS (or ROUTE with a reason recorded in review.md)
- Manual browser check: <what to look at, or "none — engine only">

## Assumptions I made

<…>

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
