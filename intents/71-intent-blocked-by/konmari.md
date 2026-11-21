<!-- generated-by: heraklios/konmari@0.1.0 -->
# §71 KonMari record

outcome: nothing to tidy
base: 8c4b53b

## Tidied
- none

## Looked at and left
- `scripts/blockers-lib.mjs`, `check-intent.mjs`, `queue.mjs`, `session-io.mjs`, `queue-lib.mjs`, `intent-check-lib.mjs`: they match product-advice-agent `3041c48` line for line, ignoring line endings (only `blockers-lib.mjs`'s header comment and `queueData`'s indentation differ). Port fidelity is worth more than any small saving here.
- `check-intent.mjs`'s `mainMetaOf` and `session-io.mjs`'s `readBlockers` → `mainMetaOf` both read main's metadata for an id from `ls-tree main:intents`. They are near duplicates, but both are port-fidelity files, and `check-intent.mjs` keeps its own `git` (it does no `session-io` import), as in the source. Left.
- `check-intent.mjs`'s `onSomeBranch` and `session-io.mjs`'s `exists`: different inputs (branch names only, or the checkout plus branch metadata). Not a duplicate.
- `queue-lib.mjs` `blockerReport`: the `known.has` guards (review mutants Q05, Q09, equivalent) are a double guard, but they match the source. Left.
- `spawn-intent.mjs` `refuseIfBlocked`: the port already folded the source's two filter-sort-first lines into `lowest`. Nothing more to fold.
- `tools/orchestrator/orchestrator-lib.mjs` `blockedRow`: it reuses `queue-lib`'s `blockedText` and does not copy it. The `Number(...)` maps (O06, equivalent) are defensive against a string id. They cost little, so I left them.
- `autoLaunch`'s `BLOCKER_STOPS` reuses the existing `startsWithAny`; `state.mjs`, `app.js`, `index.html` and `style.css` follow the names and patterns of the code around them.
- Skills and docs: each adds one paragraph where the feature is used, with no duplicate text worth folding.

## Proposed refactor intents
- none
