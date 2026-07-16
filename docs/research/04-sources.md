# Sources

All sources consulted while researching *Héraklios*, in the order they
were useful.

## Background / history

- [Heraklios (1980) - Jeu de société - Tric Trac](https://trictrac.net/jeu-de-societe/heraklios)
- [Heraklios | Board Game | BoardGameGeek](https://boardgamegeek.com/boardgame/14724/heraklios)
- [le monde enchanté de felixlechatbotté: Le Wargame qui a tout changé](http://felixlechatbotte.blogspot.com/2011/05/le-wargame-qui-tout-change.html) — personal recollection of the game, including combining two magazine copies to build an expanded board with fortified cities (a homebrew variant, not part of the base rules).
- [Championnat de France de Wargame XVI](https://estafette.forums-actifs.net/t7402-championnat-de-france-de-wargame-xvi) — mentions Héraklios as the board for the 1st French wargame championship (1980).
- [Jours de gloire — Frédéric Bey](http://www.fredbey.com/cdf.html) — French wargame championship history/results.
- [Jeux et Stratégie, les ressources du web](https://laurent36.typepad.com/blog/2007/12/jeux-et-strat%C3%A9gie-les-ressources-du-web.html)
- [Les encarts de Jeux et Stratégie n° 1 à 10](https://laurent36.typepad.com/blog/2007/12/les-encarts-de-jeux-et-strat%C3%A9gie-n-1-%C3%A0-10.html)
- [W.A.O.C. F.A.Q.](http://waoc.free.fr/waoc_faq.html)

## Primary source: the scanned rulebook and board

- **[Jeux & stratégie 06 — Internet Archive](https://archive.org/details/jeux-et-strategie-06)** — the actual scan the rules, unit stats, and map terrain were transcribed from. Item includes the full magazine PDF plus separate high-resolution JPEGs of the Héraklios insert:
  - `Jeux & stratégie 06 - Heraklios - Encart.jpg` — the map + counter sheet
  - `Jeux & stratégie 06 - Heraklios - Règles 1.jpg` — rules page 1 (setup, movement, land combat, CRT, terrain table)
  - `Jeux & stratégie 06 - Heraklios - Règles 2.jpg` — rules page 2 (naval combat, elephants, ramming/boarding tables, victory conditions)
- [Jeux & Stratégie 006 - Heraklios - Encart (Scribd)](https://www.scribd.com/document/897578613/Jeux-Strategie-006-Heraklios-Encart) — same insert, alternate host (page preview only, not the source actually used for transcription).

These scans are copyrighted magazine content and are **not** included in
this repository — only the game data/rules text transcribed from them
(facts, not the scanned artwork) is kept, in this docs folder and in
`src/data/`.

## Notes on transcription method

The rules and tables were read directly from the JPEG scans (image
analysis, not OCR) at native and cropped/zoomed resolution to resolve
small print, cross-checking ambiguous readings against internal
consistency (e.g. the land Combat Results Table was read from two
independent crops and found consistent; the naval ship tiers were
disambiguated by matching each stat block's unit *count* on the counter
sheet against the purchase table's known quantity per type, which gives a
unique, verifiable match).

The map's hex terrain was extracted via a semi-automated pipeline
(hex-grid calibration + per-hex color classification + manual gap-patching)
rather than read hex-by-hex by eye — see `tools/map-extract/README.md` for
that process in detail.
