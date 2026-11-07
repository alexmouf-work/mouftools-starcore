"""Cut the grassy planet out of a /wgdump: flood-fill from its grass, keep that body only."""
import json, sys
from collections import deque
d = json.load(open(sys.argv[1]))
key = {c: v for c, v in d["key"].items()}
L = d["layers"]  # layers[y][z][x]? find out by shape
sx, sy, sz = d["size"]
print("layers", len(L), len(L[0]), len(L[0][0]))
def at(x, y, z): return L[y][z][x]
grass = [c for c, v in key.items() if "six_sided_grass" in v["block"]]
seed = None
for y in range(sy):
    for z in range(sz):
        row = L[y][z]
        for x in range(sx):
            if row[x] in grass: seed = (x, y, z); break
        if seed: break
    if seed: break
print("seed", seed)
seen = {seed}; q = deque([seed])
while q:
    x, y, z = q.popleft()
    for dx, dy, dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
        n = (x+dx, y+dy, z+dz)
        if 0 <= n[0] < sx and 0 <= n[1] < sy and 0 <= n[2] < sz and n not in seen and at(*n) != ".":
            seen.add(n); q.append(n)
cx = sum(p[0] for p in seen) / len(seen); cy = sum(p[1] for p in seen) / len(seen); cz = sum(p[2] for p in seen) / len(seen)
from collections import Counter
cnt = Counter(key[at(*p)]["block"].split("[")[0] for p in seen)
print("body", len(seen), "centre", round(cx,1), round(cy,1), round(cz,1), d["origin"])
print(cnt.most_common())
import math
rs = [math.dist(p, (cx, cy, cz)) for p in seen if "grass" in key[at(*p)]["block"]]
print("grass radius", round(min(rs),1), round(sum(rs)/len(rs),1), round(max(rs),1))
out = {"centre": [round(cx), round(cy), round(cz)], "blocks": [[p[0]-round(cx), p[1]-round(cy), p[2]-round(cz), key[at(*p)]["block"]] for p in seen]}
json.dump(out, open(sys.argv[2], "w"))
