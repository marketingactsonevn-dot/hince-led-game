# v2.7: bg_rose_paper.jpg from the v2.6 toffee paper (keeps its grain), mapped onto rose #C99196 + soft 2-corner diagonal vignette.
# Run from the repo root: python3 _dev/tests/make_rose_bg.py
from PIL import Image
import numpy as np
src = Image.open('assets/v26/bg/bg_toffee_paper.jpg').convert('RGB')
a = np.asarray(src).astype(np.float32) / 255.0
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
# grain only: remove the large-scale shading of the old paper, keep +-4 % texture
from PIL import ImageFilter
blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))).astype(np.float32) / 255.0
grain = lum / np.maximum(blur, 1e-3) - 1.0
grain = np.clip(grain / (np.std(grain) * 2.5 + 1e-6), -1, 1) * 0.04      # +-4 %
grain -= grain.mean()
H, W = lum.shape
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = x / (W - 1), y / (H - 1)
base = np.array([0xC9, 0x91, 0x96], np.float32) / 255.0
# diagonal: top-left -> #B78387, bottom-right -> #B27F83, the other two corners slightly lighter (#CB9297)
d1 = np.clip(1 - np.hypot(u, v) / 0.7, 0, 1) ** 1.4          # near top-left
d2 = np.clip(1 - np.hypot(1 - u, 1 - v) / 0.7, 0, 1) ** 1.4  # near bottom-right
d3 = np.clip(1 - np.hypot(1 - u, v) / 0.9, 0, 1) ** 2         # top-right
d4 = np.clip(1 - np.hypot(u, 1 - v) / 0.9, 0, 1) ** 2         # bottom-left
tl = np.array([0xB7, 0x83, 0x87], np.float32) / 255.0
br = np.array([0xB2, 0x7F, 0x83], np.float32) / 255.0
lt = np.array([0xCB, 0x92, 0x97], np.float32) / 255.0
col = base[None, None, :] * np.ones((H, W, 1), np.float32)
for d, c in ((d1, tl), (d2, br), (d3, lt), (d4, lt)):
    col = col + d[..., None] * (c - base)
out = np.clip(col * (1 + grain[..., None]), 0, 1)
Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save('assets/v27/bg/bg_rose_paper.jpg', quality=84, optimize=True, progressive=True)
im = np.asarray(Image.open('assets/v27/bg/bg_rose_paper.jpg')).astype(int)
for name, (yy, xx) in {'centre': (960, 540), 'top-left': (40, 40), 'bottom-right': (1880, 1040), 'top-right': (40, 1040), 'bottom-left': (1880, 40)}.items():
    print(name, '#%02X%02X%02X' % tuple(im[yy - 20:yy + 20, xx - 20:xx + 20].reshape(-1, 3).mean(0).round().astype(int)))

