"""The Updates tab's scenes, from real dumps: an Overworld patch (Core), a mini cluster, an asteroid field and a Lab station (Encounters).
Keeps only the blocks a camera outside can see, and tells the baker which neighbouring cells are sealed so it culls faces into them."""
import json, sys, random
import numpy as np
import os
D = os.environ.get("WGDUMP_DIR", "../starcore/run/wgdump/").rstrip("/") + "/"
def load(name):
    d = json.load(open(D + name + ".json")); CW = d.get("chars", 1); sx, sy, sz = d["size"]
    keys = list(d["key"].keys()); idx = {k: i for i, k in enumerate(keys)}
    arr = np.zeros((sy, sz, sx), np.int32)
    for y, layer in enumerate(d["layers"]):
        for z, row in enumerate(layer):
            arr[y, z] = [idx[row[i * CW:(i + 1) * CW]] for i in range(sx)]
    info = [d["key"][k] for k in keys]
    return arr, info, d["origin"]
def is_air(info): return np.array([v["block"].split("[")[0] in ("minecraft:air", "minecraft:cave_air", "minecraft:void_air") for v in info])
# ⚠️ LEAVES AND PLANTS ARE SEE-THROUGH, so the flood passes them. Counting them as walls sealed the ground under every dense canopy,
# its faces were culled into "sealed" cells, and the mini planets' tree-covered caps came out as holes into their hollow insides
# (principal 2026-11-08: "the top ~1/3 of the planets ... missing their textures"). Glass stays a wall: a station's rooms stay unbaked.
SEE = ("leaves", "short_grass", "tall_grass", "fern", "bush", "flower", "vine", "sapling", "lichen", "litter", "petals", "moss_carpet", "sweet_berry")
def passable(info): return np.array([v["block"].split("[")[0] in ("minecraft:air", "minecraft:cave_air", "minecraft:void_air") or any(k in v["block"] for k in SEE) for v in info])
def visible(arr, info, open_sides=True):
    """outside: air (and see-through plants) reached by flood from the box's top (and sides if open_sides); kept: anything not air
    touching that, or the box edge"""
    see = passable(info)[arr]; air_only = is_air(info)[arr]
    air = see
    out = np.zeros_like(air)
    out[-1] |= air[-1]
    if open_sides: out[:, 0] |= air[:, 0]; out[:, -1] |= air[:, -1]; out[:, :, 0] |= air[:, :, 0]; out[:, :, -1] |= air[:, :, -1]; out[0] |= air[0]
    while True:
        g = out.copy()
        g[1:] |= out[:-1]; g[:-1] |= out[1:]; g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]; g[:, :, 1:] |= out[:, :, :-1]; g[:, :, :-1] |= out[:, :, 1:]
        g &= air
        if (g == out).all(): break
        out = g
    pad = np.pad(out, 1, constant_values=True)
    near = pad[2:, 1:-1, 1:-1] | pad[:-2, 1:-1, 1:-1] | pad[1:-1, 2:, 1:-1] | pad[1:-1, :-2, 1:-1] | pad[1:-1, 1:-1, 2:] | pad[1:-1, 1:-1, :-2]
    keep = near & ~air_only
    return keep, out, air_only
def group(name, arr, info, keep, out, air, centre, tints=None, merge=True, skip=()):
    blocks, hide = [], set()
    ys, zs, xs = np.nonzero(keep)
    kept = set(zip(xs.tolist(), ys.tolist(), zs.tolist()))
    sy, sz, sx = arr.shape
    for x, y, z in kept:
        v = info[arr[y, z, x]]; st = v["block"]
        if any(s in st for s in skip): continue
        b = [x - centre[0], y - centre[1], z - centre[2], st]
        if "color" in v: b.append([v["color"][1:].lower(), v.get("color2", v["color"])[1:].lower()])
        blocks.append(b)
        for dx, dy, dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
            a, bb, c = x + dx, y + dy, z + dz
            if 0 <= a < sx and 0 <= bb < sy and 0 <= c < sz and (a, bb, c) not in kept and not out[bb, c, a]:
                hide.add((a - centre[0], bb - centre[1], c - centre[2]))
    g = {"blocks": blocks, "hide": sorted(hide), "merge": merge}
    if tints: g["tints"] = tints
    print(name, len(blocks), "blocks", len(hide), "hidden cells")
    return g
G = {}
# ---- Core: an Overworld patch (96 x 96 out of the 128 x 128 column), cut 7 below its lowest surface
arr, info, o = load("ow2")
air = is_air(info)[arr]
top = np.where(air.any(0), arr.shape[0] - 1 - np.argmax((~air)[::-1], axis=0), 0)
x0 = z0 = 16; N = 96
win = top[z0:z0 + N, x0:x0 + N]; lo = int(np.percentile(win, 5)) - 7; hi = int(win.max()) + 1
sub = arr[lo:hi + 1, z0:z0 + N, x0:x0 + N]
keep, out, a = visible(sub, info)
G["ow"] = group("ow", sub, info, keep, out, a, (N // 2, int(np.median(win)) - lo, N // 2), tints={"grass": "#91bd59", "foliage": "#77ab2f", "water": "#3f76e4"})
print("ow surface y", int(np.median(win)) + o[1])
# ---- Core: planets in the sky, built by PlanetFeature's own rule (solid: moss r-1.5, dirt r-4, stone with 2% glowstone; hollow: shell of 4,
# glowstone 6% coal 10% iron 8% cobble 36% stone 40%; a star core at the centre)
rnd = random.Random(7)
def sky_planet(r, hollow):
    bl = []
    for x in range(-r, r + 1):
        for y in range(-r, r + 1):
            for z in range(-r, r + 1):
                d = (x * x + y * y + z * z) ** .5
                if d > r: continue
                if hollow:
                    if d < r - 4: continue
                    q = rnd.random(); s = "minecraft:glowstone" if q < .06 else "minecraft:coal_ore" if q < .16 else "minecraft:iron_ore" if q < .24 else "minecraft:cobblestone" if q < .6 else "minecraft:stone"
                else:
                    s = "minecraft:moss_block" if d >= r - 1.5 else "minecraft:dirt" if d >= r - 4 else ("minecraft:glowstone" if rnd.random() < .02 else "minecraft:stone")
                bl.append([x, y, z, s])
    bl = [b for b in bl if not (b[0] == b[1] == b[2] == 0)] + [[0, 0, 0, "starcore:star_core"]]
    where = {(b[0], b[1], b[2]) for b in bl}
    vis = [b for b in bl if any((b[0] + dx, b[1] + dy, b[2] + dz) not in where for dx, dy, dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)))]
    hide = set()
    vs = {(b[0], b[1], b[2]) for b in vis}
    for b in vis:
        for dx, dy, dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
            p = (b[0] + dx, b[1] + dy, b[2] + dz)
            if p in where and p not in vs: hide.add(p)
            if hollow and p not in where and (p[0] ** 2 + p[1] ** 2 + p[2] ** 2) ** .5 < r - 4: hide.add(p)   # the sealed chamber
    return {"blocks": vis, "hide": sorted(hide), "merge": True}
G["sky_solid"] = sky_planet(11, False); G["sky_hollow"] = sky_planet(8, True)
print("sky", len(G["sky_solid"]["blocks"]), len(G["sky_hollow"]["blocks"]))
# ---- Encounters
for nm, dump, kw in (("cluster", "enc14", {}), ("asteroids", "enc11", {}), ("station", "enc16", {"merge": True})):
    arr, info, o = load(dump)
    keep, out, a = visible(arr, info)
    ys, zs, xs = np.nonzero(~a)
    c = (int((xs.min() + xs.max()) / 2), int((ys.min() + ys.max()) / 2), int((zs.min() + zs.max()) / 2))
    G[nm] = group(nm, arr, info, keep, out, a, c, tints={"grass": "#91bd59", "foliage": "#77ab2f", "water": "#3f76e4"}, **kw)
G["ow"]["drop"] = [[0, -1, 0]]; G["station"]["drop"] = [[0, -1, 0]]; G["cluster"]["fast_leaves"] = True
json.dump({"groups": G}, open(sys.argv[1], "w"))
