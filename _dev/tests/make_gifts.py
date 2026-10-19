# v2.7 gift photos: _dev/gifts_input/*.png (1–2 MB) -> assets/v27/gifts/<name>.webp (alpha, q90, the app's first choice)
#   + <name>.png fallback (256-colour palette PNG); long edge <= 900, transparent, each <= 350 KB
# Run from the repo root: python3 _dev/tests/make_gifts.py
import os
from PIL import Image
SRC = {'hair_tie': 'hince Hair Tie.png', 'mirror': 'hince Heart Mirror.png', 'nu_blur_mini': 'hince Nu Blur Tint Mini.png', 'nu_blur_full': 'hince Nu Blur Tint.png'}
for out, name in SRC.items():
    im = Image.open(os.path.join('_dev/gifts_input', name)).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())  # trim the empty margin
    edge = 900
    while True:
        k = min(1.0, edge / max(im.size))
        sm = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        q = sm.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)  # palette PNG keeps the alpha
        path = 'assets/v27/gifts/%s.png' % out
        q.save(path, optimize=True)
        if os.path.getsize(path) <= 350 * 1024 or edge <= 500: break
        edge -= 50
    wp = 'assets/v27/gifts/%s.webp' % out
    sm.save(wp, 'WEBP', quality=90, method=6)
    print(path, sm.size, os.path.getsize(path) // 1024, 'KB ·', wp, os.path.getsize(wp) // 1024, 'KB')
