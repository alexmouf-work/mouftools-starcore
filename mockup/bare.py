"""Score 64-block windows of a dump by bare ground: the share of columns whose top block is ground (not fungus, tree or plant),
with a little blood wanted for the shore."""
import json, sys
import numpy as np
d = json.load(open(sys.argv[1])); CW = d.get("chars", 1); sx, sy, sz = d["size"]; AIR = "." * CW
key = {c: v["block"].split("[")[0] for c, v in d["key"].items()}
top = np.full((sz, sx), "", dtype=object); topy = np.zeros((sz, sx), int)
for y in range(sy - 1, -1, -1):
    for z, row in enumerate(d["layers"][y]):
        for x in range(sx):
            c = row[x * CW:(x + 1) * CW]
            if c != AIR and top[z, x] == "": top[z, x] = key[c]; topy[z, x] = y
VEG = ("mycete", "mycel", "leaves", "log", "stalk", "fung", "vine", "short_grass", "tall_grass", "fern", "bush", "flower", "root", "wart")
veg = np.vectorize(lambda b: any(k in b for k in VEG))(top); blood = np.vectorize(lambda b: "blood" in b)(top)
best = []
N = 64
for z0 in range(0, sz - N + 1, 8):
    for x0 in range(0, sx - N + 1, 8):
        v = veg[z0:z0 + N, x0:x0 + N].mean(); b = blood[z0:z0 + N, x0:x0 + N].mean(); h = topy[z0:z0 + N, x0:x0 + N]
        rough = np.percentile(h, 95) - np.percentile(h, 5)
        score = (1 - v) - abs(b - .15) * .8 - max(0, rough - 18) * .01
        best.append((score, x0, z0, round(v, 3), round(b, 3), int(rough)))
best.sort(reverse=True)
for s in best[:5]: print(sys.argv[1].split("/")[-1], "score %.3f window %d,%d vegetation %.3f blood %.3f relief %d" % s)
