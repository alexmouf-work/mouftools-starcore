"""The favicon: one black hole as the mod's Detailed Black Holes pass draws it (shaders/post/black_hole.fsh, the same port the site runs),
over a lensed starfield. Rendered at 1024 and filtered down, so every size is a reduction of a sharp picture, never an upscale.
Usage: favicon.py outdir"""
import sys, os, numpy as np
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
S = 1024
rng = np.random.default_rng(7)
# the sky behind it: the site's deep blue-black with stars, drawn bigger than the frame so the bend has something to pull in
B = S * 2
sky = np.zeros((B, B, 3), np.float32); sky[:] = np.array([5, 6, 15]) / 255
yy, xx = np.mgrid[0:B, 0:B]
neb = np.exp(-(((xx - B * .62) / (B * .35)) ** 2 + ((yy - B * .4) / (B * .3)) ** 2)) * .10
sky += neb[..., None] * np.array([.30, .38, .95])
for _ in range(2600):
    x, y = rng.integers(0, B, 2); r = rng.choice([1, 1, 1, 2, 2, 3]); b = rng.uniform(.35, 1)
    c = np.array([1, .95, .9]) if rng.random() < .3 else np.array([.85, .9, 1])
    sky[max(0, y - r):y + r, max(0, x - r):x + r] = np.maximum(sky[max(0, y - r):y + r, max(0, x - r):x + r], c * b)
# the hole, in screen-height units as the shader works: shadow radius, Einstein radius (tan 1.22a / tan 2a -> ~1.64 x shadow)
shadow = .135; thetaE = shadow * 1.64
v, u = np.mgrid[0:S, 0:S].astype(np.float32) / S
ox, oy = u - .5, (1 - v) - .5
r = np.hypot(ox, oy) + 1e-7
dirx, diry = ox / r, oy / r
bend = thetaE ** 2 / np.maximum(r, 1e-4)
sx, sy = .5 + dirx * (r - bend), .5 + diry * (r - bend)
px = np.clip(((sx - .5) * .5 + .5) * B, 0, B - 1).astype(int); py = np.clip((1 - ((sy - .5) * .5 + .5)) * B, 0, B - 1).astype(int)
bent = sky[py, px]
pxw = 1 / S
mask = 1 - np.clip((r - (shadow - pxw)) / (2 * pxw), 0, 1); mask = mask * mask * (3 - 2 * mask)
color = bent * (1 - mask)[..., None]
# the disc, term for term as the shader (veil 1, no haze)
U = r / shadow
ang = np.arctan2(oy, ox)
glow = np.exp(-(np.maximum(U, 1e-6) / 3.499) ** 2.697)
dip = 1 - .050 * np.exp(-(np.maximum(U, 1e-6) / 1.037) ** 2.6)
arc = np.exp(-((U - 1.484) / .398) ** 2)
photon = np.exp(-((U - 1.060) / .075) ** 2)
across, along = np.abs(oy) / shadow, np.abs(ox) / shadow
barW = .175 + .103 * along
bar = np.exp(-(across / barW) ** 1.5) * np.exp(-(along / 7.31) ** 1.35)
def hsh(x, y): return np.modf(np.sin(x * 127.1 + y * 311.7) * 43758.5453123)[0] % 1
def noise(x, y, period):
    i, j = np.floor(x), np.floor(y); f, g = x - i, y - j; f = f * f * (3 - 2 * f); g = g * g * (3 - 2 * g)
    x0, x1 = np.mod(i, period), np.mod(i + 1, period)
    a = hsh(x0, j) * (1 - f) + hsh(x1, j) * f; b = hsh(x0, j + 1) * (1 - f) + hsh(x1, j + 1) * f
    return a * (1 - g) + b * g
def fbm(x, y, period):
    val, amp = 0, .5
    for _ in range(4): val = val + amp * noise(x, y, period); x, y, period, amp = x * 2, y * 2.07, period * 2, amp * .5
    return val
turn = ang * .15915494
streak = fbm(turn * 19 + 11, U * 5 + 11, 19.); clump = fbm(turn * 6 + 37, U * 1.4 + 37, 6.)
sm = np.clip((U - 1.6) / 1.4, 0, 1); sm = sm * sm * (3 - 2 * sm)
grain = 1 + ((.66 + .68 * streak) * (.86 + .28 * clump) - 1) * sm
inten = np.clip(glow * dip * .795 + arc * .265 * grain + photon * .16 + bar * .323 * grain, 0, 1)
k = np.clip(inten / .9, 0, 1)[..., None]
disc = np.array([.74, .55, .53]) * (1 - k) + np.array([.95, .93, .98]) * k
color = color + disc * (inten / .9)[..., None]
img = Image.fromarray((np.clip(color, 0, 1) * 255 + .5).astype(np.uint8), "RGB")
img.save(f"{OUT}/icon-1024.png")
for n, s in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32), ("favicon-16.png", 16)):
    img.resize((s, s), Image.LANCZOS).save(f"{OUT}/{n}", optimize=True)
img.resize((256, 256), Image.LANCZOS).save(f"{OUT}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print({f: os.path.getsize(f"{OUT}/{f}") for f in sorted(os.listdir(OUT))})
