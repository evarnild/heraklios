<!-- generated-by: heraklios/konmari@0.1.0 -->
# §91 KonMari record

outcome: nothing to tidy
base: 09a2c7e

Reason: outside `intents/` the change is only the generated `package-lock.json` (hono 4.13.13 → 4.13.18, @hono/node-server 2.1.5 → 2.1.7, plus owner-accepted `"peer": true` flag churn); no code or test changed, and a lockfile is never hand-edited.

## Tidied
- none

## Looked at and left
- `package-lock.json`: the two version pins and the `"peer": true` flags are npm's generated output; hand-editing them would break the lockfile's integrity with `npm ci`.
- `intents/91-hono-advisories/` (intent, plan, review, metadata): records, outside the tidy-up's reach.

## Proposed refactor intents
- none
