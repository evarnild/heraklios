# §<id> spec — <title>

Accepted intent: [intent.md](intent.md)

The spec decides **what** gets built. It does not repeat the rulebook or
README — it points at them and records the decisions that have no other home.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `docs/research/02-rules-transcription.md` §… | <rule text, quoted> |
| `docs/research/05-rules-french-original.md` §… | <only if the transcription is ambiguous or OCR-damaged> |
| `README.md` "Known simplifications" | <bullet this removes, if any> |
| `plan-history.md` §… | <prior decision this builds on> |

## Behaviour

<What the game does, as observable rules. Number them so plan.md and tests
can cite them: B1, B2, …>

## Interpretations

<Every place the rulebook is ambiguous, the reading chosen and why. Each one
becomes a code comment at its implementation site (CLAUDE.md convention).>

## Acceptance criteria

<Checkable statements, each mapped to a test or a manual check. "AC1 — a
unit in marsh cannot … (test: movement.test.ts)".>

## Non-functional

- **Engine/presentation split:** <which logic goes in src/engine or src/data>
- **Save format:** <does GameState change shape? SAVE_VERSION bump?>
- **Undo boundaries:** <new die rolls or phase changes?>
- **AI / harness:** <does legalActions/applyAction or the fuzz harness need to know?>

## Out of scope

<What this deliberately does not do.>

## Assumptions I made

<…>
