#!/usr/bin/env python3
"""Bake placed blocks into triangles the way the game's model baker does, for the website mock-ups.

blockstate (variants | multipart) -> model(s) with x/y rotation -> parent chain, #texture variables -> elements -> faces
(from/to box, default or given UV, face rotation, element rotation with rescale, cullface, tintindex). Faces whose cullface
neighbour is a full opaque cube are dropped. Every texture used is cut to its first animation frame, upscaled x8 nearest,
and packed into one sheet with extruded gutters. Tinted faces carry their tint as a vertex colour.

Usage: bake.py job.json out_prefix
  job: {"tints": {"grass": "#rrggbb", "foliage": ..., "birch": ..., "spruce": ..., "water": ...},
        "groups": {"name": [[x, y, z, "ns:block[props]"], ...], ...}}
Writes out_prefix.png (the sheet) and out_prefix.json: {"sheet": [W, H], "groups": {name: {"opaque": {...}, "blend": {...}}}}
where each mesh is {"pos": [...], "uv": [...], "col": [...], "nrm": [...], "idx": [...]} (positions in blocks).
"""
import json, math, sys, zipfile, io
from collections import Counter
from functools import lru_cache
from PIL import Image

import os
MOD = os.environ.get("STARCORE_ASSETS", "../starcore/src/main/resources/assets/").rstrip("/") + "/"
JAR = zipfile.ZipFile(os.environ.get("MC_CLIENT_JAR", os.path.expanduser("~/.gradle/caches/fabric-loom/26.3/minecraft-client.jar")))
SCALE, GUTTER = 8, 16

def read(ns, path):
    if ns == "minecraft":
        try: return JAR.read(f"assets/minecraft/{path}")
        except KeyError: pass
    try: return open(MOD + f"{ns}/{path}", "rb").read()
    except FileNotFoundError: return None

def split_id(i, default="minecraft"):
    return i.split(":", 1) if ":" in i else (default, i)

@lru_cache(None)
def model(mid):
    ns, path = split_id(mid)
    raw = read(ns, f"models/{path}.json")
    if raw is None: return {"textures": {}, "elements": None}
    m = json.loads(raw)
    tex, els = {}, m.get("elements")
    if "parent" in m and not m["parent"].startswith("builtin/"):
        p = model(m["parent"] if ":" in m["parent"] else f"{ns}:{m['parent']}" if not m["parent"].startswith("minecraft:") else m["parent"])
        tex.update(p["textures"]); els = els if els is not None else p["elements"]
    tex.update(m.get("textures", {}))
    return {"textures": tex, "elements": els, "ns": ns}

def resolve(tex, ref, ns):
    seen = 0
    while ref.startswith("#") and seen < 20:
        ref = tex.get(ref[1:], "minecraft:missingno"); seen += 1
    if isinstance(ref, dict): ref = ref.get("sprite", "minecraft:missingno")
    return ref if ":" in ref else f"minecraft:{ref}"

def parse_state(s):
    if "[" not in s: return s, {}
    name, rest = s.split("[", 1)
    return name, dict(kv.split("=") for kv in rest.rstrip("]").split(",") if kv)

def matches(when, props):
    if "OR" in when: return any(matches(w, props) for w in when["OR"])
    if "AND" in when: return all(matches(w, props) for w in when["AND"])
    return all(props.get(k) in str(v).split("|") for k, v in when.items())

@lru_cache(None)
def models_for(state):
    name, props = parse_state(state)
    ns, path = split_id(name)
    raw = read(ns, f"blockstates/{path}.json")
    if raw is None: return ()
    bs = json.loads(raw); out = []
    if "variants" in bs:
        for key, v in bs["variants"].items():
            want = dict(kv.split("=") for kv in key.split(",") if kv)
            if all(props.get(k) == val for k, val in want.items()):
                out.append(v[0] if isinstance(v, list) else v); break
    for part in bs.get("multipart", []):
        if "when" not in part or matches(part["when"], props):
            a = part["apply"]; out.append(a[0] if isinstance(a, list) else a)
    return tuple(json.dumps(o, sort_keys=True) for o in out)

# texture handling --------------------------------------------------------------------------------------------
TEX = {}      # id -> PIL image (first frame, unscaled)
def texture(tid):
    if tid in TEX: return TEX[tid]
    if tid.startswith("C3:"):
        # a plating wall's nine p-tiles as one 3x3 picture: tile (pu, pv) at column pu, row pv, so fract(world / 3) lands on the right one
        base = tid[3:]; im = Image.new("RGBA", (48, 48))
        for pu in range(3):
            for pv in range(3): im.paste(texture(f"starcore:block/{base}wall_p{pu}{pv}"), (pu * 16, pv * 16))
        TEX[tid] = im; return im
    ns, path = split_id(tid)
    raw = read(ns, f"textures/{path}.png")
    im = Image.open(io.BytesIO(raw)).convert("RGBA") if raw else Image.new("RGBA", (16, 16), (255, 0, 255, 255))
    if im.height > im.width and im.height % im.width == 0: im = im.crop((0, 0, im.width, im.width))
    TEX[tid] = im; return im
def alpha_kind(tid):
    a = texture(tid).getchannel("A").getextrema()
    if a[0] == 255: return "solid"
    hist = texture(tid).getchannel("A").histogram()
    partial = sum(hist[1:255])
    return "blend" if partial > 0 else "cut"

def full_opaque(state):
    for mj in models_for(state):
        m = model(json.loads(mj)["model"])
        for e in m["elements"] or []:
            if e["from"] == [0, 0, 0] and e["to"] == [16, 16, 16] and len(e["faces"]) == 6:
                if all(alpha_kind(resolve(m["textures"], f["texture"], m.get("ns", "minecraft"))) == "solid" for f in e["faces"].values()):
                    return True
    return False

TINT_KIND = {"grass": ("grass_block", "short_grass", "tall_grass", "fern", "large_fern", "sugar_cane", "six_sided_grass", "stargrass", "vine", "pink_petals"),
             "birch": ("birch_leaves",), "spruce": ("spruce_leaves",), "water": ("water",),
             "foliage": ("leaves",)}
def tint_for(state, tints, block_tints=None, idx=0):
    name = parse_state(state)[0].split(":")[1]
    if block_tints and name in block_tints: return "#" + block_tints[name][min(idx, 1)]
    for kind, keys in TINT_KIND.items():
        if any(k in name for k in keys) and kind in tints: return tints[kind]
    return "#ffffff"

# ---- connected plating: a line-for-line port of com.starcore.client.plating.ConnectedFace (owner 2026-10-15, reading B) ----
PLATING = {"lab_plating": "lab_extended_plating_", "industrial_plating": "industrial_extended_plating_", "astral_plating": "astral_extended_plating_",
           "frontier_plating": "frontier_extended_plating_", "photonic_plating": "photonic_extended_plating_"}
FACES = {  # n, u, v as in ConnectedFace.Face: u left to right and v top to bottom, seen from outside
    "north": ((0, 0, -1), (-1, 0, 0), (0, -1, 0)), "south": ((0, 0, 1), (1, 0, 0), (0, -1, 0)),
    "east": ((1, 0, 0), (0, 0, -1), (0, -1, 0)), "west": ((-1, 0, 0), (0, 0, 1), (0, -1, 0)),
    "up": ((0, 1, 0), (1, 0, 0), (0, 0, 1)), "down": ((0, -1, 0), (1, 0, 0), (0, 0, -1))}
REACH = 3
_SUF = {}
for i, nm in enumerate(["2x2_nw", "2x2_ne", "2x2_sw", "2x2_se"]): _SUF[i] = nm
for i, nm in enumerate(["3x3_nw", "3x3_n", "3x3_ne", "3x3_w", "3x3_c", "3x3_e", "3x3_sw", "3x3_s", "3x3_se"]): _SUF[4 + i] = nm
for i in range(9): _SUF[13 + i] = "wall_p%d%d" % (i // 3, i % 3)
for i, sd in enumerate("nesw"): _SUF[22 + i] = "wall_edge_" + sd
_ST = [("nw", "n", "w"), ("ne", "n", "e"), ("se", "s", "e"), ("sw", "s", "w")]
for c, (cn, a, b) in enumerate(_ST):
    _SUF[26 + c * 4] = f"wall_corner_{cn}_both"; _SUF[27 + c * 4] = f"wall_corner_{cn}_{a}"
    _SUF[28 + c * 4] = f"wall_corner_{cn}_{b}"; _SUF[29 + c * 4] = f"wall_corner_{cn}_inner"
def plating_select(j, pu, pv):
    n, s_, w, e = j(0, -1), j(0, 1), j(-1, 0), j(1, 0)
    def run(du, dv):
        k = 0
        while k < REACH and j(du * (k + 1), dv * (k + 1)): k += 1
        return k
    left, right, up, down = run(-1, 0), run(1, 0), run(0, -1), run(0, 1)
    width, height = left + right + 1, up + down + 1
    if width == height and width in (2, 3):
        iso = all(j(du, dv) == (-left <= du <= right and -up <= dv <= down)
                  for dv in range(-up - 1, down + 2) for du in range(-left - 1, right + 2))
        if iso: return [(0 if width == 2 else 4) + up * width + left]
    out = [13 + pu * 3 + pv]
    if not n: out.append(22)
    if not e: out.append(23)
    if not s_: out.append(24)
    if not w: out.append(25)
    for idx, (oa, ob, du, dv) in enumerate([(not n, not w, -1, -1), (not n, not e, 1, -1), (not s_, not e, 1, 1), (not s_, not w, -1, 1)]):
        if oa and ob: out.append(26 + idx * 4)
        elif oa: out.append(27 + idx * 4)
        elif ob: out.append(28 + idx * 4)
        elif not j(du, dv): out.append(29 + idx * 4)
    return out
def face_coord(face, u, v, lift):
    n, uu, vv = FACES[face]; out = []
    for a in range(3):
        if n[a]: out.append(1 + lift if n[a] > 0 else -lift)
        elif uu[a]: out.append(u if uu[a] > 0 else 1 - u)
        else: out.append(v if vv[a] > 0 else 1 - v)
    return out

DIRS = {"down": (0, -1, 0), "up": (0, 1, 0), "north": (0, 0, -1), "south": (0, 0, 1), "west": (-1, 0, 0), "east": (1, 0, 0)}
def corners(d, f, t):
    x0, y0, z0 = f; x1, y1, z1 = t
    return {"down": [(x0, y0, z1), (x0, y0, z0), (x1, y0, z0), (x1, y0, z1)],
            "up": [(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)],
            "north": [(x1, y1, z0), (x1, y0, z0), (x0, y0, z0), (x0, y1, z0)],
            "south": [(x0, y1, z1), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1)],
            "west": [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
            "east": [(x1, y1, z1), (x1, y0, z1), (x1, y0, z0), (x1, y1, z0)]}[d]
def default_uv(d, f, t):
    x0, y0, z0 = f; x1, y1, z1 = t
    return {"down": [x0, 16 - z1, x1, 16 - z0], "up": [x0, z0, x1, z1], "north": [16 - x1, 16 - y1, 16 - x0, 16 - y0],
            "south": [x0, 16 - y1, x1, 16 - y0], "west": [z0, 16 - y1, z1, 16 - y0], "east": [16 - z1, 16 - y1, 16 - z0, 16 - y0]}[d]

def rot(p, axis, deg, origin):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    x, y, z = (p[0] - origin[0], p[1] - origin[1], p[2] - origin[2])
    if axis == "x": y, z = y * c - z * s, y * s + z * c
    elif axis == "y": x, z = x * c + z * s, -x * s + z * c
    else: x, y = x * c - y * s, x * s + y * c
    return (x + origin[0], y + origin[1], z + origin[2])

def merge(quads):
    """Greedy-merge coplanar full unit faces of one texture, colour and facing into rectangles. A merged quad's uv runs past 16
    (w*16 by h*16): the page tiles it with fract(), so a 90-block wall is one quad instead of 8,100."""
    keep, cells = [], {}
    for q in quads:
        tid, quad, uvs, n, c = q
        if uvs != [(0, 0), (0, 16), (16, 16), (16, 0)]: keep.append(q); continue
        p0, p1, p3 = quad[0], quad[1], quad[3]
        ua = tuple(round(p3[i] - p0[i], 4) for i in range(3)); va = tuple(round(p1[i] - p0[i], 4) for i in range(3))
        if sorted(map(abs, ua + va)) != [0, 0, 0, 0, 1, 1]: keep.append(q); continue
        plane = round(sum(p0[i] * n[i] for i in range(3)), 4)
        iu = math.floor(sum(p0[i] * ua[i] for i in range(3)) + .5 + 1e-6); iv = math.floor(sum(p0[i] * va[i] for i in range(3)) + .5 + 1e-6)
        cells.setdefault((tid, tuple(n), c, plane, ua, va), {})[(iu, iv)] = p0
    for (tid, n, c, plane, ua, va), cs in cells.items():
        done = set()
        for (iu, iv) in sorted(cs, key=lambda k: (k[1], k[0])):
            if (iu, iv) in done: continue
            w = 1
            while (iu + w, iv) in cs and (iu + w, iv) not in done: w += 1
            h = 1
            while all((iu + k, iv + h) in cs and (iu + k, iv + h) not in done for k in range(w)): h += 1
            for a in range(w):
                for b in range(h): done.add((iu + a, iv + b))
            p0 = cs[(iu, iv)]
            P = lambda a, b: tuple(p0[i] + ua[i] * a + va[i] * b for i in range(3))
            if tid.startswith("C3:"):   # luv in units of the 3x3 picture, anchored to the world so the pattern runs on across merges
                a0, b0, a1, b1 = 16 * iu / 3, 16 * iv / 3, 16 * (iu + w) / 3, 16 * (iv + h) / 3
                keep.append((tid, [P(0, 0), P(0, h), P(w, h), P(w, 0)], [(a0, b0), (a0, b1), (a1, b1), (a1, b0)], n, c))
            else:
                keep.append((tid, [P(0, 0), P(0, h), P(w, h), P(w, 0)], [(0, 0), (0, 16 * h), (16 * w, 16 * h), (16 * w, 0)], n, c))
    return keep

def bake(job, prefix):
    used = {}
    out = {}
    FLUIDS = {"water": "minecraft:block/water_still", "blood": "starcore:block/blood_still", "acid": "starcore:block/acid_still", "lava": "minecraft:block/lava_still"}
    for gname, grp in job["groups"].items():
        blocks = grp["blocks"] if isinstance(grp, dict) else grp
        tints = grp.get("tints", {}) if isinstance(grp, dict) else job.get("tints", {})
        btints = grp.get("block_tints", {}) if isinstance(grp, dict) else {}
        where = {(b[0], b[1], b[2]): b[3] for b in blocks}
        ctint = {(b[0], b[1], b[2]): b[4] for b in blocks if len(b) > 4}      # per-block [tint0, tint1] (a block carried from its own planet)
        hide = set(map(tuple, grp.get("hide", []))) if isinstance(grp, dict) else set()   # cells no camera can see into: solid left out, or sealed air
        def hidden(p): return p in hide
        fast = isinstance(grp, dict) and grp.get("fast_leaves")
        meshes = {"opaque": [], "blend": []}
        steps = {"opaque": [], "blend": []}
        fullcache = {}
        def full(p):
            s = where.get(p)
            if s is None: return False
            if s not in fullcache: fullcache[s] = full_opaque(s)
            return fullcache[s]
        for (bx, by, bz), state in where.items():
            fname = parse_state(state)[0].split(":")[1]
            if fname in FLUIDS:
                # fluids have no block model: the game draws a surface at 14/16 and sides where the fluid meets air
                tid = FLUIDS[fname]; used[tid] = True
                c = tints.get("water", "#3f76e4") if fname == "water" else "#ffffff"
                above = where.get((bx, by + 1, bz), "")
                top = 1.0 if parse_state(above)[0].split(":")[-1] == fname else 14 / 16
                faces = []
                if top < 1: faces.append(("up", [(0, top, 0), (0, top, 1), (1, top, 1), (1, top, 0)], (0, 1, 0)))
                for d, (dx, dz) in {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}.items():
                    nb = where.get((bx + dx, by, bz + dz))
                    if nb is None:
                        q = {"north": [(1, top, 0), (1, 0, 0), (0, 0, 0), (0, top, 0)], "south": [(0, top, 1), (0, 0, 1), (1, 0, 1), (1, top, 1)],
                             "west": [(0, top, 0), (0, 0, 0), (0, 0, 1), (0, top, 1)], "east": [(1, top, 1), (1, 0, 1), (1, 0, 0), (1, top, 0)]}[d]
                        faces.append((d, q, (dx, 0, dz)))
                for d, q, n in faces:
                    meshes["blend"].append((tid, [(bx + p[0] - .5, by + p[1] - .5, bz + p[2] - .5) for p in q], [(0, 0), (0, 16), (16, 16), (16, 0)], n, c))
                continue
            if fname in PLATING:
                # the face reads its neighbours: same block, in the face's plane, its own face exposed
                def same(p, nm=fname): return parse_state(where.get(p, "")).__getitem__(0).split(":")[-1] == nm
                def covered(p, face):
                    n = FACES[face][0]; q = (p[0] + n[0], p[1] + n[1], p[2] + n[2]); return full(q) or hidden(q)
                for face, (n, uu, vv) in FACES.items():
                    if covered((bx, by, bz), face): continue
                    def j(du, dv, face=face, uu=uu, vv=vv):
                        if du == 0 and dv == 0: return True
                        c = (bx + du * uu[0] + dv * vv[0], by + du * uu[1] + dv * vv[1], bz + du * uu[2] + dv * vv[2])
                        return same(c) and not covered(c, face)
                    pu = (uu[0] * bx + uu[1] * by + uu[2] * bz) % 3; pv = (vv[0] * bx + vv[1] * by + vv[2] * bz) % 3
                    tiles = plating_select(j, pu, pv)
                    if grp.get("merge") and len(tiles) == 1 and 13 <= tiles[0] < 22:
                        tid = "C3:" + PLATING[fname]; used[tid] = True
                        quad = [face_coord(face, u, v, 0) for u, v in ((0, 0), (0, 1), (1, 1), (1, 0))]
                        meshes["opaque"].append((tid, [(bx + q[0] - .5, by + q[1] - .5, bz + q[2] - .5) for q in quad],
                                                 [(0, 0), (0, 16), (16, 16), (16, 0)], n, "#ffffff"))
                        continue
                    for k, tile in enumerate(tiles):
                        tid = "starcore:block/" + PLATING[fname] + _SUF[tile]; used[tid] = True
                        lift = 0 if k == 0 else .004 * k   # each overlay a hair proud of the last, or they fight for the same depth
                        quad = [face_coord(face, u, v, lift) for u, v in ((0, 0), (0, 1), (1, 1), (1, 0))]
                        meshes["opaque"].append((tid, [(bx + q[0] - .5, by + q[1] - .5, bz + q[2] - .5) for q in quad],
                                                 [(0, 0), (0, 16), (16, 16), (16, 0)], n, "#ffffff"))
                steps["opaque"].append(len(meshes["opaque"])); steps["blend"].append(len(meshes["blend"]))
                continue
            planes = Counter()   # faces of this block already drawn in a plane: an overlay (grass side, tinted layers) sits on top of them
            for mj in models_for(state) or ():
                ap = json.loads(mj); m = model(ap["model"]); rx, ry = ap.get("x", 0), ap.get("y", 0)
                for e in m["elements"] or []:
                    f, t = e["from"], e["to"]; er = e.get("rotation")
                    for d, face in e["faces"].items():
                        cf = face.get("cullface")
                        if cf:
                            # cullface turns with the variant rotation
                            v = DIRS[cf]; v = rot(v, "x", -rx, (0, 0, 0)); v = rot(v, "y", -ry, (0, 0, 0))
                            nb = (bx + round(v[0]), by + round(v[1]), bz + round(v[2]))
                            if full(nb) or hidden(nb): continue
                            if any(k in fname for k in ("glass", "airlock", "slime", "ice")) and parse_state(where.get(nb, ""))[0].split(":")[-1] == fname: continue   # like glass: no face between two of the same
                            if fast and "leaves" in fname and "leaves" in where.get(nb, ""): continue   # fast leaves: no faces between leaves
                        tid = resolve(m["textures"], face["texture"], m.get("ns", "minecraft"))
                        used[tid] = True
                        uv = face.get("uv") or default_uv(d, f, t)
                        quad = corners(d, f, t)
                        if er:
                            ang = er.get("angle", 0); ax = er["axis"]; o = er.get("origin", [8, 8, 8])
                            quad = [rot(p, ax, ang, o) for p in quad]
                            if er.get("rescale"):
                                k = 1 / math.cos(math.radians(ang))
                                quad = [tuple(o[i] + (p[i] - o[i]) * (k if "xyz"[i] != ax else 1) for i in range(3)) for p in quad]
                        quad = [rot(p, "x", -rx, (8, 8, 8)) for p in quad]
                        quad = [rot(p, "y", -ry, (8, 8, 8)) for p in quad]
                        u0, v0, u1, v1 = uv
                        uvs = [(u0, v0), (u0, v1), (u1, v1), (u1, v0)]
                        k = (face.get("rotation", 0) // 90) % 4
                        uvs = uvs[k:] + uvs[:k]
                        n = DIRS[d]; n = rot(n, "x", -rx, (0, 0, 0)); n = rot(n, "y", -ry, (0, 0, 0))
                        kind = "blend" if alpha_kind(tid) == "blend" else "opaque"
                        c = ("#" + ctint[(bx, by, bz)][min(face["tintindex"], 1)] if (bx, by, bz) in ctint else tint_for(state, tints, btints, face["tintindex"])) if "tintindex" in face else "#ffffff"
                        # ⚠️ AN OVERLAY ON THE SAME PLANE AS ITS BASE FIGHTS IT. The game draws them in order at one depth; here the
                        # base and the overlay are merged into different rectangles, so their triangles interpolate depth differently
                        # and flicker. Lift each further face in a plane a hair along its normal, as the plating overlays are.
                        pk = (tuple(round(x) for x in n), round(sum(quad[0][i] * n[i] for i in range(3)) / 16, 3))
                        lift = .004 * planes[pk]; planes[pk] += 1
                        meshes[kind].append((tid, [(bx + p[0] / 16 - .5 + n[0] * lift, by + p[1] / 16 - .5 + n[1] * lift, bz + p[2] / 16 - .5 + n[2] * lift) for p in quad], uvs, n, c))
            steps["opaque"].append(len(meshes["opaque"])); steps["blend"].append(len(meshes["blend"]))
        out[gname] = (meshes, steps)
    # pack the sheet
    ids = sorted(used, key=lambda i: -texture(i).width)
    W = 4096; x = y = row = 0; rects = {}; cells = []
    for tid in ids:
        im = texture(tid).resize((texture(tid).width * SCALE, texture(tid).height * SCALE), Image.NEAREST)
        cw, ch = im.width + 2 * GUTTER, im.height + 2 * GUTTER
        if x + cw > W: x, y, row = 0, y + row, 0
        cell = Image.new("RGBA", (cw, ch)); cell.paste(im, (GUTTER, GUTTER))
        cell.paste(im.crop((0, 0, im.width, 1)).resize((im.width, GUTTER)), (GUTTER, 0))
        cell.paste(im.crop((0, im.height - 1, im.width, im.height)).resize((im.width, GUTTER)), (GUTTER, GUTTER + im.height))
        cell.paste(cell.crop((GUTTER, 0, GUTTER + 1, ch)).resize((GUTTER, ch)), (0, 0))
        cell.paste(cell.crop((GUTTER + im.width - 1, 0, GUTTER + im.width, ch)).resize((GUTTER, ch)), (GUTTER + im.width, 0))
        cells.append((cell, x, y)); rects[tid] = (x + GUTTER, y + GUTTER, im.width, im.height)
        x += cw; row = max(row, ch)
    H = 1
    while H < y + row: H *= 2
    sheet = Image.new("RGBA", (W, H))
    for cell, cx, cy in cells: sheet.paste(cell, (cx, cy))
    sheet.save(prefix + ".png", optimize=True)
    res = {"sheet": [W, H], "groups": {}}
    raw = {"sheet": [W, H], "rects": rects, "groups": {}}
    for gname, (meshes, steps) in out.items():
        if isinstance(job["groups"][gname], dict) and job["groups"][gname].get("merge"):
            meshes = {k: merge(v) for k, v in meshes.items()}
        drop = [tuple(d) for d in (job["groups"][gname].get("drop", []) if isinstance(job["groups"][gname], dict) else [])]
        if drop: meshes = {k: [q for q in v if tuple(round(x) for x in q[3]) not in drop] for k, v in meshes.items()}
        raw["groups"][gname] = meshes
        res["groups"][gname] = {"steps": steps}
        for kind, quads in meshes.items():
            pos, uv, colr, nrm, idx, rect, luv = [], [], [], [], [], [], []
            for tid, quad, uvs, n, c in quads:
                rx, ry, rw, rh = rects[tid]; base = len(pos) // 3
                cc = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
                for p, (u, v) in zip(quad, uvs):
                    pos += [round(p[0], 4), round(p[1], 4), round(p[2], 4)]
                    uv += [round((rx + min(u, 16) / 16 * rw) / W, 6), round(1 - (ry + min(v, 16) / 16 * rh) / H, 6)]
                    rect += [rx / W, 1 - (ry + rh) / H, rw / W, rh / H]; luv += [u / 16, 1 - v / 16]
                    colr += list(cc); nrm += [round(n[0]), round(n[1]), round(n[2])]
                idx += [base, base + 1, base + 2, base, base + 2, base + 3]
            res["groups"][gname][kind] = {"pos": pos, "uv": uv, "col": colr, "nrm": nrm, "idx": idx, "rect": rect, "luv": luv}
        print(gname, {k: len(v) for k, v in meshes.items()}, "quads")
    json.dump(res, open(prefix + ".json", "w"), separators=(",", ":"))
    json.dump(raw, open(prefix + ".quads.json", "w"), separators=(",", ":"))
    print(prefix, f"sheet {W}x{H}, {len(rects)} textures")

if __name__ == "__main__":
    bake(json.load(open(sys.argv[1])), sys.argv[2])
