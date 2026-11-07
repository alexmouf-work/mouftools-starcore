"""Pack the Updates bake into one binary: axis-aligned quads as 24-byte records, the rest (crossed plants, tilted parts) as 40-byte ones.
axis record: p0 int16x3 (1/16 block) | code uint16 (ua 0-5, va 0-5, n 0-5, uv rotation 0-3) | w,h uint16 (1/16) | tid u8 | rgb u8x3 | uv int16x4 (x3: u0 v0 u1 v1)
free record: 4 corners int16x3 (1/64 block) | tid u8 | rgb u8x3 | uv int16x4 (x3) | rot u8 | n int8x3"""
import json, struct, sys
R = json.load(open(sys.argv[1])); W, H = R["sheet"]
tids = sorted({q[0] for g in R["groups"].values() for m in g.values() for q in m}); T = {t: i for i, t in enumerate(tids)}
AX = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
def ax(v):
    r = tuple(round(x, 4) for x in v); L = max(abs(x) for x in r)
    if L == 0 or sorted(map(abs, r))[:2] != [0, 0]: return None
    u = tuple(int(x / L) for x in r); return (AX.index(u), L)
blob = bytearray(); meta = {"sheet": [W, H], "rects": [[R["rects"][t][0] / W, 1 - (R["rects"][t][1] + R["rects"][t][3]) / H, R["rects"][t][2] / W, R["rects"][t][3] / H] for t in tids],
                            "cut": [], "groups": {}}
from bake import alpha_kind
meta["cut"] = [1 if t.startswith("C3:") is False and alpha_kind(t) != "solid" else 0 for t in tids]
for gname, meshes in R["groups"].items():
    gm = {}
    for kind, quads in meshes.items():
        a, f = bytearray(), bytearray(); na = nf = 0
        for tid, quad, uvs, n, c in quads:
            p0, p1, p2, p3 = quad
            # undo the face's uv rotation: find k such that uvs == base rotated by k
            u0, v0 = uvs[0]; base = None
            for k in range(4):
                b = uvs[-k:] + uvs[:-k] if k else uvs
                if b[0][0] == b[1][0] and b[2][0] == b[3][0] and b[0][1] == b[3][1] and b[1][1] == b[2][1]: base = (k, b); break
            if base is None: base = (0, uvs)
            k, b = base; uvq = [round(b[0][0] * 3), round(b[0][1] * 3), round(b[2][0] * 3), round(b[2][1] * 3)]
            rgb = bytes(int(c[i:i + 2], 16) for i in (1, 3, 5))
            A = ax([p3[i] - p0[i] for i in range(3)]); B = ax([p1[i] - p0[i] for i in range(3)])
            flat = A and B and all(abs(p2[i] - (p1[i] + p3[i] - p0[i])) < 1e-3 for i in range(3)) and ax(n)
            if flat:
                code = A[0] | B[0] << 3 | ax(n)[0] << 6 | k << 9
                a += struct.pack("<3hH2HB3s4h", *[round(x * 16) for x in p0], code, round(A[1] * 16), round(B[1] * 16), T[tid], rgb, *uvq); na += 1
            else:
                f += struct.pack("<12hB3s4hB3b", *[round(x * 64) for p in quad for x in p], T[tid], rgb, *uvq, k, *[round(x * 127) for x in n]); nf += 1
        ao = len(blob); blob += a; fo = len(blob); blob += f
        while len(blob) % 4: blob += b"\0"
        gm[kind] = {"axis": [ao, na], "free": [fo, nf]}
    meta["groups"][gname] = gm
    print(gname, {k: (v["axis"][1], v["free"][1]) for k, v in gm.items()})
open(sys.argv[2] + ".bin", "wb").write(blob); json.dump(meta, open(sys.argv[2] + ".json", "w"), separators=(",", ":"))
print(len(blob) // 1024, "KB")
