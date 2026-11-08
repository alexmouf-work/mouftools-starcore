"""The geometric world: the whole box, everything floats. Keeps a block when a neighbour lets light through (air, or any block whose
model is not a full opaque cube, as crop.py), centred on the box. Usage: crop_box.py dump.json out.json"""
import json, sys, bake
d = json.load(open(sys.argv[1])); CW = d.get("chars", 1); sx, sy, sz = d["size"]; AIR = "." * CW
L = [[[row[i * CW:(i + 1) * CW] for i in range(sx)] for row in layer] for layer in d["layers"]]
key = {c: v["block"].replace(" @", "@").split("@")[0].strip() for c, v in d["key"].items()}
see_c = {c: c == AIR or not bake.full_opaque(key[c]) for c in key}
solid = [(x, y, z) for y in range(sy) for z in range(sz) for x in range(sx) if L[y][z][x] != AIR]
ys = [p[1] for p in solid]; cx, cy, cz = sx // 2, (min(ys) + max(ys)) // 2, sz // 2
blocks = []
for x, y, z in solid:
    nb = [(x + 1, y, z), (x - 1, y, z), (x, y + 1, z), (x, y - 1, z), (x, y, z + 1), (x, y, z - 1)]
    if any(not (0 <= a < sx and 0 <= b < sy and 0 <= c < sz) or see_c[L[b][c][a]] for a, b, c in nb):
        blocks.append([x - cx, y - cy, z - cz, key[L[y][z][x]]])
json.dump({"blocks": blocks}, open(sys.argv[2], "w")); print("geometry", len(blocks))
