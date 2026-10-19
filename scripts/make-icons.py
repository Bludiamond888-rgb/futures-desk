"""Generate PWA / iOS icons into public/icons (run: python3 scripts/make-icons.py)."""
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
BG = (11, 15, 20, 255); GREEN = (16, 185, 129, 255); GREEN2 = (52, 211, 153, 255)

def F(draw, ox, oy, s):
    # "F" glyph from the favicon path (64-unit grid): M20 46V18h24v7H28v6h13v7H28v8z
    pts = [(20,46),(20,18),(44,18),(44,25),(28,25),(28,31),(41,31),(41,38),(28,38),(28,46)]
    draw.polygon([(ox + x * s, oy + y * s) for x, y in pts], fill=BG)

def icon(size, mode):
    S = size * 4
    im = Image.new('RGBA', (S, S), BG)
    d = ImageDraw.Draw(im)
    if mode == 'any':        # green rounded tile, transparent-free dark corners
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=GREEN)
        F(d, 0, 0, S / 64)
    elif mode == 'maskable':  # full-bleed green, glyph inside 80% safe zone
        d.rectangle([0, 0, S, S], fill=GREEN)
        inner = S * 0.62; off = (S - inner) / 2
        F(d, off, off, inner / 64)
    elif mode == 'apple':     # opaque full-bleed (iOS rounds corners itself)
        d.rectangle([0, 0, S, S], fill=GREEN)
        inner = S * 0.78; off = (S - inner) / 2
        F(d, off, off, inner / 64)
        # subtle up-trend tick mark
        w = S * 0.02
        d.line([(S*0.60, S*0.70), (S*0.68, S*0.62), (S*0.74, S*0.66), (S*0.84, S*0.54)], fill=BG, width=int(w), joint='curve')
    return im.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
icon(192, 'any').save(f'{OUT}/icon-192.png')
icon(512, 'any').save(f'{OUT}/icon-512.png')
icon(512, 'maskable').save(f'{OUT}/icon-maskable-512.png')
icon(180, 'apple').convert('RGB').save(f'{OUT}/apple-touch-icon.png')
icon(32, 'any').save(f'{OUT}/favicon-32.png')
print('ok')
