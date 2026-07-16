# Map extraction

One-off scripts used to derive `src/data/map.ts` from the scanned Heraklios
board (Jeux & Stratégie #6, 1980, via an Internet Archive copy of the
magazine). The scanned image itself is **not** included here (copyrighted
magazine content) — only the derived terrain/river data is shipped.

The board is a two-page magazine spread with a fold/gutter, so the hex grid
does not sit on one clean global lattice. The pipeline calibrates the grid
**per page** and quantizes both pages into a single canonical hex lattice.

Pipeline (run manually, in order, with the source scan's map-only crop saved
as `map_only.png` in this directory):

1. `autoalign.py <left|right>` — auto-calibrates the hex lattice for one page
   by grid-searching lattice parameters (origin, pitch) to best overlay the
   printed grid ink. The true hex pitch is ~105×122 px (hex size ~70), which
   the earlier version got wrong (used ~139×159, undercounting hexes ~1.7×).
2. `sample_and_classify.py` — generates hex centers for both pages, quantizes
   them into one canonical lattice, samples the median color at each center,
   and classifies into plain / steep-flank (red slopes & mountains) / sea /
   coast (nearest-color); writes `cells_v2.json`.
3. `river_mask.py` — builds/visualizes the pale-blue river-ink mask, used to
   calibrate river detection and confirm the river's path.
4. `extract_final.py` — the main extractor. Loads `cells_v2.json`, then:
   - overrides the hand-identified **marsh** and **plateau** hex sets (both
     are olive and not color-separable from plain/each other, so they're
     designated by coordinate);
   - reclassifies stray inland blue as plain and gap-fills fold-crease holes;
   - detects **river HEXSIDES** (not hex-filling) by disk-sampling the river
     mask at each land–land edge midpoint, then prunes isolated segments;
   - writes `final_terrain.json` in axial coords.
5. `generate_map_ts.py` — converts to `src/data/map.ts`: a per-hex
   `MAP_TERRAIN` map plus a `RIVER_HEXSIDES` set of undirected hex-edge keys.

Rivers are hexside features on the real board — the blue ribbon winds along
hex *edges*, never filling a hex — so the game models them as edges that add
a movement/combat penalty and block ZOC, not as a terrain type.

Re-running from scratch requires recalibrating against whatever source image
is provided (the per-page `autoalign` search assumes roughly the same scan
resolution and fold position).
