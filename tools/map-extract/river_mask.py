from PIL import Image
import numpy as np

im = Image.open('map_only.png').convert('RGB')
arr = np.array(im).astype(int)
H, W, _ = arr.shape
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# River is a pale/light blue ribbon. Sea is saturated blue (low R). Coast is
# pale grey-blue. The river's characteristic: light, bluish (b>r), but not the
# deep sea. Try: b > r+4, b > 150, r in [120,225], and NOT deep sea (r>40).
river = (b > r + 4) & (b > 150) & (r > 90) & (r < 232) & (g > r - 10)
mask = np.zeros((H, W, 3), dtype=np.uint8)
mask[river] = [0, 90, 255]
# overlay faintly on a greyscale of the original for context
grey = (arr.sum(axis=2) / 3).astype(np.uint8)
out = np.stack([grey, grey, grey], axis=2)
out[river] = [0, 90, 255]
Image.fromarray(out).save('river_mask_full.png')
sm = Image.fromarray(out); from PIL import Image as I
im2 = Image.fromarray(out); im2.thumbnail((1900,1900)); im2.save('river_mask_small.png')

# sample some river pixel colors along the top-left where the river is bold
print("sample colors near top-left river:")
for (x,y) in [(470,250),(500,320),(520,400),(1050,1600),(1150,1650),(900,1550)]:
    print(f"  ({x},{y}) ->", arr[y,x].tolist(), "river?", bool(river[y,x]))
print("river pixel count:", int(river.sum()))
