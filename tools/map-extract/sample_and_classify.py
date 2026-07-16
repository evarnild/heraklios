"""Comprehensive Heraklios map extractor (v2): finer two-page lattice,
quantized to a single canonical hex grid, 6 terrain types, plus river
hexside detection."""
from PIL import Image
import numpy as np
import json, math

im = Image.open('map_only.png').convert('RGB')
arr = np.array(im).astype(int)
H, W, _ = arr.shape

# --- Per-page calibrated lattices (from autoalign) ---
PAGES = [
    dict(x_lo=0,    x_hi=1655, ox=128, oy=120, col_dx=107, row_dy=123),
    dict(x_lo=1690, x_hi=W,    ox=56,  oy=128, col_dx=109, row_dy=121),
]

# --- Canonical lattice all hexes quantize into ---
CANON = dict(ox=21, oy=120, col_dx=108, row_dy=122)

def quantize(cx, cy):
    col = round((cx - CANON['ox']) / CANON['col_dx'])
    row = round((cy - CANON['oy'] - (col & 1) * (CANON['row_dy'] / 2)) / CANON['row_dy'])
    return col, row

def canon_center(col, row):
    cx = CANON['ox'] + col * CANON['col_dx']
    cy = CANON['oy'] + row * CANON['row_dy'] + (col & 1) * (CANON['row_dy'] / 2)
    return cx, cy

def sample_median(cx, cy, r=28):
    y0, y1 = int(cy - r), int(cy + r)
    x0, x1 = int(cx - r), int(cx + r)
    if x0 < 0 or y0 < 0 or x1 > W or y1 > H:
        # clip
        y0, y1 = max(0, y0), min(H, y1)
        x0, x1 = max(0, x0), min(W, x1)
        if x1 <= x0 or y1 <= y0:
            return None
    patch = arr[y0:y1, x0:x1].reshape(-1, 3)
    bright = patch.sum(axis=1)
    keep = patch[bright > 150]
    if len(keep) < 8:
        return None
    return np.median(keep, axis=0)

# --- Generate physical hex centers per page, quantize, sample ---
cells = {}  # (col,row) -> dict(cx,cy,rgb)
for p in PAGES:
    ox, oy, dx, dy = p['ox'], p['oy'], p['col_dx'], p['row_dy']
    c0 = math.floor((p['x_lo'] - ox) / dx) - 1
    c1 = math.ceil((p['x_hi'] - ox) / dx) + 1
    for c in range(c0, c1):
        cx = ox + c * dx
        if cx < p['x_lo'] - 5 or cx > p['x_hi'] + 5:
            continue
        r0 = math.floor((0 - oy) / dy) - 1
        r1 = math.ceil((H - oy) / dy) + 1
        for rr in range(r0, r1):
            cy = oy + rr * dy + (c & 1) * (dy / 2)
            if cy < 25 or cy > H - 25:
                continue
            col, row = quantize(cx, cy)
            rgb = sample_median(cx, cy)
            if rgb is None:
                continue
            key = (col, row)
            # prefer the sample physically closest to the canonical center
            ccx, ccy = canon_center(col, row)
            d = (cx - ccx) ** 2 + (cy - ccy) ** 2
            if key not in cells or d < cells[key]['d']:
                cells[key] = dict(cx=cx, cy=cy, rgb=rgb.tolist(), d=d)

print("total quantized cells:", len(cells))

# --- Terrain classification ---
REFS = {
    'plain':        np.array([235, 204, 145]),
    'steep-flank':  np.array([135, 45,  27]),   # red mountains / slopes
    'sea':          np.array([3,   156, 208]),
    'coast':        np.array([200, 212, 216]),  # pale grey-blue coastal fringe
    'offmap':       np.array([245, 244, 240]),  # white paper
}

def classify(rgb):
    v = np.array(rgb)
    best, bd = None, 1e18
    for name, ref in REFS.items():
        dd = np.linalg.norm(v - ref)
        if dd < bd:
            bd, best = dd, name
    return best

for key, c in cells.items():
    c['terrain'] = classify(c['rgb'])

from collections import Counter
print(Counter(c['terrain'] for c in cells.values()))

with open('cells_v2.json', 'w') as f:
    json.dump({f"{k[0]},{k[1]}": v for k, v in cells.items()}, f)
print("wrote cells_v2.json")
