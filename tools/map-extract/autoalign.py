from PIL import Image
import numpy as np
import math, json

im = Image.open('map_only.png').convert('RGB')
arr = np.array(im).astype(int)
h, w, _ = arr.shape
brightness = arr.sum(axis=2)  # 0..765

# Grid ink is dark AND low-saturation (near-black), unlike brown terrain
# hatching. Build an "ink" mask.
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
sat = mx - mn
ink = ((brightness < 330) & (sat < 70)).astype(np.float32)

def edge_score(ox, oy, col_dx, row_dy, size, x_lo, x_hi):
    """Sum ink coverage sampled along hex edges over the page region."""
    col_dy = row_dy / 2
    total = 0.0
    n = 0
    ncols = int((x_hi - x_lo) / col_dx) + 2
    nrows = int(h / row_dy) + 2
    for ci in range(ncols):
        cx = x_lo + ci * col_dx + (ox % col_dx)
        if cx < x_lo or cx > x_hi:
            continue
        for ri in range(nrows):
            cy = oy + ri * row_dy + (int(round((cx - ox) / col_dx)) % 2) * col_dy
            if cy < 30 or cy > h - 30:
                continue
            # sample midpoints of the 6 edges (between consecutive vertices)
            for k in range(6):
                a0 = math.radians(60 * k)
                a1 = math.radians(60 * (k + 1))
                mx_ = cx + size * (math.cos(a0) + math.cos(a1)) / 2
                my_ = cy + size * (math.sin(a0) + math.sin(a1)) / 2
                ix, iy = int(mx_), int(my_)
                if 0 <= ix < w and 0 <= iy < h:
                    total += ink[iy, ix]
                    n += 1
    return total / max(n, 1)

def calibrate(x_lo, x_hi, oy_range, ox_range, dx_range, dy_range, size):
    best = None
    for col_dx in dx_range:
        for row_dy in dy_range:
            for ox in ox_range:
                for oy in oy_range:
                    s = edge_score(ox, oy, col_dx, row_dy, size, x_lo, x_hi)
                    if best is None or s > best[0]:
                        best = (s, ox, oy, col_dx, row_dy, size)
    return best

# Coarse search per page. Gutter around x=1670.
if __name__ == '__main__':
    import sys
    page = sys.argv[1]
    if page == 'left':
        x_lo, x_hi = 0, 1620
    else:
        x_lo, x_hi = 1720, 4206
    best = calibrate(
        x_lo, x_hi,
        oy_range=range(40, 40 + 121, 8),
        ox_range=range(40, 40 + 105, 8),
        dx_range=[101, 103, 105, 107, 109],
        dy_range=[117, 119, 121, 123, 125],
        size=70,
    )
    print(f"page={page} best score={best[0]:.4f} ox={best[1]} oy={best[2]} col_dx={best[3]} row_dy={best[4]} size={best[5]}")
