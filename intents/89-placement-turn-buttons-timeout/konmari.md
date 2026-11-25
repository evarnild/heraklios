<!-- generated-by: heraklios/konmari@0.1.0 -->
# §89 KonMari record

outcome: kept
base: 941a80d

## Tidied
- 1d1ed18 — e2e/placement.spec.ts — the header comment's lines 8-11 re-flowed to the header's ~78-column width (the 110-character line, round 2 review F4); comment only, no code change

## Looked at and left
- The seven-`»` fill loop addressed by `UNIT_TYPES.findIndex`: no existing e2e helper fills army-builder rows (`e2e/helpers.ts` has only the generic `clickButton(page, label, index)`, which the loop already uses), and `army-builder.spec.ts` clicks `»` at literal indices for its own single-row checks, so nothing computes the same thing to fold into. Extracting a helper for one caller would add code, not remove it.
- The `test.step` wrapping (build armies, place land units, place ships): it labels the phase that runs out of time in a trace, the intent's purpose; kept as is.
- The `armyBuilder().total === 400` assertion and the "Seat 1 keeps the default army" comment: an assertion (held), and the comment explains why seat 1 takes no small army.
- The `// §89:` block in the "build armies" step: it records the measured timing and the fill order the test depends on; it earns its place.
- `unitCount`, `freeLegalHex`, `placeShip` in the same file: unchanged by the intent, outside the reach.

## Proposed refactor intents
- none
