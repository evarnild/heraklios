# Héraklios research notes

This folder collects the original research used to build this project,
gathered from the open web while investigating the 1980 board game
*Héraklios*. It's kept separate from `src/data/` (the machine-readable
rules the game engine actually runs on) as a human-readable record of
where that data came from and what else was learned along the way.

- [`01-history-and-background.md`](01-history-and-background.md) — what
  the game is, who made it, and its place in French wargaming history.
- [`02-rules-transcription.md`](02-rules-transcription.md) — a full
  transcription of the rulebook (setup, movement, combat, naval combat,
  elephants, victory conditions), read directly from the scanned insert.
- [`03-tables-reference.md`](03-tables-reference.md) — the unit roster and
  all combat tables in plain reference form (cross-check copy of what's
  encoded in `src/data/`).
- [`04-sources.md`](04-sources.md) — every source consulted, with URLs.
- [`05-rules-french-original.md`](05-rules-french-original.md) — full
  verbatim French transcription of the rules pages. An explicit exception
  to the policy below, kept by request to cross-check
  `02-rules-transcription.md` against the original wording.

## Note on the source scans

The rulebook and counter-sheet scans themselves (`encart.jpg`, `regles1.jpg`,
`regles2.jpg`) are **not** included here or anywhere in this repo — they're
scanned pages from a copyrighted 1980 magazine (*Jeux & Stratégie* #6),
sourced from an Internet Archive copy of the issue (see sources doc). Only
the factual game data transcribed from them — rules, stats, tables — is
kept, which is the same standard the rest of the project follows (see
`tools/map-extract/README.md` for the same policy applied to the map).
`05-rules-french-original.md` is a deliberate, requested exception to
this policy — full verbatim prose, not just factual data.
