"""Ship the site's art as light as it can go, and let the browser do the heavy lifting.

Textures: every block and planet texture once, at its NATIVE resolution, de-duplicated, packed tight and saved as lossless
WebP. The page upscales each by its whole-number factor (nearest neighbour) and extrudes the gutters itself, so the GPU gets
exactly the sheet it got before while the wire carries 1/64th of the pixels for a block texture.
Geometry: every baked model (the Journey's worlds and ship, the Updates' scenes) as quads (24 bytes axis-aligned, 40 otherwise,
axis records 26 bytes, the rest 42), with the hyperdrive map's systems, deflated and base64'd into .txt (the only byte-exact type served that a
browser can fetch and DecompressionStream can inflate).

Usage: slim.py <outdir>      (run in the mock-up folder after job2.py, clean.py and `bake.py job_all.json all`)
"""
import json, sys, io, base64, zlib, hashlib, struct, os
from PIL import Image
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)

def b64img(uri): return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGBA")
def const(src, name):
    s = open(src).read(); i = s.index(f"const {name}=") + len(name) + 7; j = s.find(";\nconst ", i)
    return json.loads(s[i:(j if j >= 0 else s.rindex(";"))])

ATLAS = const("data.js", "ATLAS")
SPEC = {f: {it["key"]: it.get("scale", 1) for it in json.load(open(f"{f}_spec.json"))["items"]} for f in ("blocks", "planets")}
GUT = {f: json.load(open(f"{f}_spec.json"))["gutter"] for f in ("blocks", "planets")}

def native(big, rect, s):
    x, y, w, h = rect
    return big.crop((x, y, x + w, y + h)).resize((w // s, h // s), Image.NEAREST)

def pack(items, W):
    """items: [(name, image, scale)] -> sheet, {name: [x, y, w, h, scale]}; identical images stored once"""
    seen, uniq, names = {}, [], {}
    for n, im, s in items:
        k = hashlib.sha1(im.tobytes() + bytes([s]) + bytes(str(im.size), "ascii")).hexdigest()
        if k not in seen: seen[k] = len(uniq); uniq.append((im, s))
        names[n] = seen[k]
    order = sorted(range(len(uniq)), key=lambda i: -uniq[i][0].height)
    x = y = row = 0; pos = {}
    for i in order:
        im = uniq[i][0]
        if x + im.width > W: x, y, row = 0, y + row, 0
        pos[i] = (x, y); x += im.width; row = max(row, im.height)
    sheet = Image.new("RGBA", (W, y + row))
    for i, (x, y) in pos.items(): sheet.paste(uniq[i][0], (x, y))
    # the runtime packs cells in this order, so it can keep the original sheets' layout logic (big first)
    cells = [[*pos[i], uniq[i][0].width, uniq[i][0].height, uniq[i][1]] for i in range(len(uniq))]
    return sheet, cells, names, len(items), len(uniq)

def save(sheet, name):
    p = f"{OUT}/{name}.webp"; sheet.save(p, "WEBP", lossless=True, quality=100, method=6, exact=True)
    sheet.save(f"{OUT}/{name}.png", optimize=True)
    return os.path.getsize(p), os.path.getsize(f"{OUT}/{name}.png")

# ---- blocks: the hand-picked atlas plus every texture the baker used, one sheet
bigB = b64img(ATLAS["blocks"]["uri"])
items = [(k, native(bigB, r, SPEC["blocks"][k]), SPEC["blocks"][k]) for k, r in ATLAS["blocks"]["rects"].items()]
Q = json.load(open("all.quads.json")); bigK = Image.open("all.png").convert("RGBA")
items += [(t, native(bigK, r, 8), 8) for t, r in Q["rects"].items()]
sheet, cells, names, n, u = pack(items, 256)
print("blocks", n, "names ->", u, "unique", sheet.size, "webp/png bytes", save(sheet, "tex"))
TEX = {"gutter": GUT["blocks"], "cells": cells, "names": names}
# ---- planets
bigP = b64img(ATLAS["planets"]["uri"])
items = [(k, native(bigP, r, SPEC["planets"][k]), SPEC["planets"][k]) for k, r in sorted(ATLAS["planets"]["rects"].items(), key=lambda kv: (kv[1][1], kv[1][0]))]
# worlds added since the planet sheet was baked, straight from their nets (native, shown x2 like the other landings)
EXTRA = ["real_1_2_4"]
items += [(k, Image.open(f"probe/nets/{k}_surface.png").convert("RGBA"), 2) for k in EXTRA if k not in ATLAS["planets"]["rects"]]
sheet, cells, names, n, u = pack(items, 2048)
print("planets", n, "->", u, sheet.size, "webp/png bytes", save(sheet, "planets"))
PLA = {"gutter": GUT["planets"], "cells": cells, "names": names}

# ---- geometry
AX = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
def ax(v):
    r = tuple(round(x, 4) for x in v); L = max(abs(x) for x in r)
    if L == 0 or sorted(map(abs, r))[:2] != [0, 0]: return None
    return (AX.index(tuple(int(x / L) for x in r)), L)
tids = sorted(Q["rects"]); T = {t: i for i, t in enumerate(tids)}
B = json.load(open("all.json"))   # for the reveal steps
def pack_group(blob, gname):
    meshes = Q["groups"][gname]; gm = {}
    steps = B["groups"][gname]["steps"]
    for kind, quads in meshes.items():
        a, f = bytearray(), bytearray(); na = nf = 0; sa, sf = [], []
        bounds = steps[kind] if gname == "ship" else []
        bi = 0
        for qi, (tid, quad, uvs, n, c) in enumerate(quads):
            while bounds and bi < len(bounds) and qi >= bounds[bi]: sa.append(na); sf.append(nf); bi += 1
            p0, p1, p2, p3 = quad; base = None
            for k in range(4):
                b = uvs[-k:] + uvs[:-k] if k else uvs
                if b[0][0] == b[1][0] and b[2][0] == b[3][0] and b[0][1] == b[3][1] and b[1][1] == b[2][1]: base = (k, b); break
            k, b = base or (0, uvs); uvq = [round(b[0][0] * 3), round(b[0][1] * 3), round(b[2][0] * 3), round(b[2][1] * 3)]
            rgb = bytes(int(c[i:i + 2], 16) for i in (1, 3, 5))
            A = ax([p3[i] - p0[i] for i in range(3)]); Bv = ax([p1[i] - p0[i] for i in range(3)])
            if A and Bv and all(abs(p2[i] - (p1[i] + p3[i] - p0[i])) < 1e-3 for i in range(3)) and ax(n):
                code = A[0] | Bv[0] << 3 | ax(n)[0] << 6 | k << 9
                a += struct.pack("<3hH2HH3sx4h", *[round(x * 16) for x in p0], code, round(A[1] * 16), round(Bv[1] * 16), T[tid], rgb, *uvq); na += 1
            else:
                f += struct.pack("<12hH3s4hB3bx", *[round(x * 64) for p in quad for x in p], T[tid], rgb, *uvq, k, *[round(x * 127) for x in n]); nf += 1
        while bounds and bi < len(bounds): sa.append(na); sf.append(nf); bi += 1
        ao = len(blob); blob += a; fo = len(blob); blob += f
        while len(blob) % 4: blob += b"\0"
        gm[kind] = {"axis": [ao, na], "free": [fo, nf]}
        if bounds: gm[kind]["steps"] = {"axis": sa, "free": sf}
    return gm
def ship(name, groups, extra=None):
    blob = bytearray(); meta = {"tids": tids, "groups": {g: pack_group(blob, g) for g in groups}}
    if extra:
        for k, arr in extra.items():
            o = len(blob); blob += arr
            while len(blob) % 4: blob += b"\0"
            meta[k] = [o, len(arr)]
    z = zlib.compress(bytes(blob), 9)
    open(f"{OUT}/{name}.txt", "w").write(base64.b64encode(z).decode())
    print(name, len(blob) // 1024, "KB raw ->", len(z) // 1024, "KB deflated ->", os.path.getsize(f"{OUT}/{name}.txt") // 1024, "KB on the wire")
    return meta
# the hyperdrive map's systems, as typed arrays in the same blob
H = json.load(open("probe/hyper.json"))
from array import array
def sys_arrays(p):
    xyz = array("f"); xyz.frombytes(base64.b64decode(p["xyz"]))
    return array("h", [max(-32767, min(32767, round(v * 6))) for v in xyz]).tobytes(), base64.b64decode(p["col"]), base64.b64decode(p["cls"])
tx, tc, tl = sys_arrays(H["tube"]); fx, fc, fl = sys_arrays(H["far"])
JM = ship("journey", ["ship", "eden", "rapture", "hazard", "geometry"], {"tube_xyz": tx, "tube_col": tc, "tube_cls": tl, "far_xyz": fx, "far_col": fc, "far_cls": fl})
UM = ship("updates", ["ow", "sky_solid", "sky_hollow", "cluster", "asteroids", "station"])
# the small things, as plain JSON
D2 = {k: const("data2.js", k) for k in ("WORLDS", "COAG", "AURORA", "SISTERS")}
# the hostile world is the Karst world 1_2/4 now (principal 2026-11-07: "pick another hostile world")
D2["WORLDS"]["hazard"] = {"stem": "real_1_2_4", "dim": "starcore:frontier/1_2/4", "air": "TOXIC", "sky": "e6b49a", "kind": "FOG"}
PLN = const("data.js", "PLANETS"); PLN["r_hazard"] = {"stem": "real_1_2_4", "glow": "#e6b49a"}
J = {"tex": TEX, "planets": PLA, "PLANETS": PLN, "GPLANET": const("data.js", "GPLANET"),
     "jets": const("data2.js", "BAKED")["jets"], "hyper": {"total": H["total"], "radius": H["radius"], "start": H["start"]},
     "pack": JM, **D2}
json.dump(J, open(f"{OUT}/journey.json", "w"), separators=(",", ":"))
json.dump(UM, open(f"{OUT}/updates.json", "w"), separators=(",", ":"))
for f in sorted(os.listdir(OUT)): print(f"  {f:16s} {os.path.getsize(f'{OUT}/{f}') // 1024:6d} KB")
