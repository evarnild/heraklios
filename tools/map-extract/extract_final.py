"""Final Heraklios map extractor: fine two-page lattice, 6 terrain types,
marsh/plateau overrides, cleanup, gap-fill, and river-HEXSIDE detection."""
from PIL import Image
import numpy as np
import json, math
from collections import deque, Counter

im = Image.open('map_only.png').convert('RGB')
arr = np.array(im).astype(int)
H, W, _ = arr.shape

with open('cells_v2.json') as f:
    raw = json.load(f)
cells = {tuple(map(int, k.split(','))): v for k, v in raw.items()}

CANON = dict(ox=21, oy=120, col_dx=108, row_dy=122)
def canon_center(col, row):
    cx = CANON['ox'] + col * CANON['col_dx']
    cy = CANON['oy'] + row * CANON['row_dy'] + (col & 1) * (CANON['row_dy'] / 2)
    return cx, cy

# ---- odd-q offset neighbor helpers (flat-top, odd columns shifted down) ----
AX_DIRS = [(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)]
def off_to_axial(col, row):
    q = col
    r = row - (col - (col & 1)) // 2
    return q, r
def axial_to_off(q, r):
    col = q
    row = r + (q - (q & 1)) // 2
    return col, row
def neighbors_off(col, row):
    q, r = off_to_axial(col, row)
    out = []
    for dq, dr in AX_DIRS:
        out.append(axial_to_off(q + dq, r + dr))
    return out

# ---- terrain overrides: marsh & plateau (canonical offset coords) ----
PLATEAU = {(24,9),(25,9),(24,10),(25,10),(24,11),(25,11)}
MARSH = {(10,13),(11,13),(9,14),(10,14),(11,14),(8,15),(9,15),(10,15),(7,16),(8,16),(9,16)}

terrain = {}
for key, c in cells.items():
    terrain[key] = c['terrain']
for k in PLATEAU:
    if k in terrain: terrain[k] = 'plateau'
for k in MARSH:
    if k in terrain: terrain[k] = 'marsh'

# ---- cleanup 1: reclassify stray coast/sea not connected to the main sea ----
sea_like = {k for k, t in terrain.items() if t in ('sea', 'coast')}
# find the largest connected component of sea_like
def components(nodes):
    seen = set(); comps = []
    for n in nodes:
        if n in seen: continue
        comp = []; dq = deque([n]); seen.add(n)
        while dq:
            cur = dq.popleft(); comp.append(cur)
            for nb in neighbors_off(*cur):
                if nb in nodes and nb not in seen:
                    seen.add(nb); dq.append(nb)
        comps.append(comp)
    return comps
comps = sorted(components(sea_like), key=len, reverse=True)
main_sea = set(comps[0]) if comps else set()
for k in list(terrain):
    if terrain[k] in ('sea', 'coast') and k not in main_sea:
        terrain[k] = 'plain'   # stray inland blue -> plain

# ---- cleanup 2: gap-fill offmap holes surrounded by land ----
# An 'offmap' cell with >=4 non-offmap neighbors becomes the majority terrain.
for _ in range(3):
    for k in list(terrain):
        if terrain[k] != 'offmap':
            continue
        nbt = [terrain[n] for n in neighbors_off(*k) if n in terrain and terrain[n] != 'offmap']
        if len(nbt) >= 4:
            terrain[k] = Counter(nbt).most_common(1)[0][0]

# drop remaining offmap cells (true border) from the map
terrain = {k: t for k, t in terrain.items() if t != 'offmap'}

# ---- river HEXSIDE detection ----
# Build a river-ink mask (pale blue ribbon), then for each LAND-LAND edge,
# disk-sample the mask at the edge midpoint (robust to fold misalignment).
rr, gg, bb = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
river_ink = (bb > rr + 4) & (bb > 150) & (rr > 90) & (rr < 232) & (gg > rr - 10)
LAND = {'plain', 'steep-flank', 'plateau', 'marsh'}

def edge_has_river(a, b, radius=19):
    ax_, ay_ = canon_center(*a)
    bx_, by_ = canon_center(*b)
    mx, my = int((ax_ + bx_) / 2), int((ay_ + by_) / 2)
    y0, y1 = max(0, my - radius), min(H, my + radius)
    x0, x1 = max(0, mx - radius), min(W, mx + radius)
    sub = river_ink[y0:y1, x0:x1]
    if sub.size == 0:
        return False
    return sub.mean() > 0.15

river_edges = set()
onmap = set(terrain)
for k in onmap:
    if terrain[k] not in LAND:
        continue
    for nb in neighbors_off(*k):
        if nb in onmap and terrain[nb] in LAND:
            qa = off_to_axial(*k); qb = off_to_axial(*nb)
            edge = tuple(sorted([qa, qb]))
            if edge in river_edges:
                continue
            if edge_has_river(k, nb):
                river_edges.add(edge)

# prune isolated river edges (false positives): keep an edge only if it shares
# a hex with at least one other river edge.
hex_edge_count = Counter()
for (a, b) in river_edges:
    hex_edge_count[a] += 1
    hex_edge_count[b] += 1
river_edges = {(a, b) for (a, b) in river_edges
               if hex_edge_count[a] > 1 or hex_edge_count[b] > 1}

print("terrain counts:", Counter(terrain.values()))
print("river hexsides:", len(river_edges))

# ---- write outputs (axial coords) ----
out_terrain = {}
for (col, row), t in terrain.items():
    q, r = off_to_axial(col, row)
    out_terrain[f"{q},{r}"] = t
out_rivers = [[list(a), list(b)] for a, b in sorted(river_edges)]
with open('final_terrain.json', 'w') as f:
    json.dump({'terrain': out_terrain, 'rivers': out_rivers}, f)
print("wrote final_terrain.json  (hexes:", len(out_terrain), ")")
