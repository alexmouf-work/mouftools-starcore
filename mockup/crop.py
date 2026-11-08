"""Cut a diorama out of a /wgdump: the 32x32 window with the most character, from just under its surface to the treetops."""
import json, sys
from collections import Counter
d = json.load(open(sys.argv[1])); N = int(sys.argv[3]) if len(sys.argv) > 3 else 32
FOCUS = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else None   # a block the window must centre on
FLOAT = len(sys.argv) > 5 and sys.argv[5] == "float"                         # reward blocks hanging over air
CW = d.get("chars", 1); sx, sy, sz = d["size"]; oy = d["origin"][1]
AIR = "." * CW
L = [[[row[i * CW:(i + 1) * CW] for i in range(sx)] for row in layer] for layer in d["layers"]]
key = {c: v["block"] for c, v in d["key"].items()}
def state(c): return key[c].replace(" @", "@").split("@")[0].strip()
import bake
_see = {}
def see(c):
    """light gets past this cell: air, or a block whose model is not a full opaque cube"""
    if c == AIR: return True
    if c not in _see: _see[c] = not bake.full_opaque(state(c))
    return _see[c]
GROUND_HINT = ("hard_", "soft_", "dust_", "eden_cloud", "basalt", "stone", "bedrock", "dirt")
def feature(s):
    return not any(h in s for h in GROUND_HINT) or "ore" in s or "grassy" in s
# heightmap: topmost non-air per column
top = [[None] * sx for _ in range(sz)]
for y in range(sy - 1, -1, -1):
    for z in range(sz):
        row = L[y][z]
        for x in range(sx):
            if top[z][x] is None and row[x] != AIR: top[z][x] = y
best = None
for z0 in range(0, sz - N + 1, 4):
    for x0 in range(0, sx - N + 1, 4):
        tops = [top[z][x] for z in range(z0, z0 + N) for x in range(x0, x0 + N) if top[z][x] is not None]
        if len(tops) < N * N * .9: continue
        tops.sort(); lo, hi = tops[len(tops) // 20], tops[-1]
        if FLOAT: hi = min(sy - 1, hi + 2)
        kinds = Counter()
        for y in range(max(0, lo - 2), min(sy, hi + 1)):
            for z in range(z0, z0 + N):
                row = L[y][z]
                for x in range(x0, x0 + N):
                    c = row[x]
                    if c != AIR and feature(state(c)): kinds[state(c).split("[")[0]] += 1
        wet = sum(1 for z in range(z0, z0 + N) for x in range(x0, x0 + N)
                  if top[z][x] is not None and any(w in state(L[top[z][x]][z][x]) for w in ("acid", "blood", "water", "_ice")))
        frac = wet / (N * N)
        focus = sum(n for k, n in kinds.items() if FOCUS and FOCUS in k)
        floating = 0
        if FLOAT:
            for z in range(z0, z0 + N, 2):
                for x in range(x0, x0 + N, 2):
                    gap = False
                    for y in range(min(sy - 1, hi + 40), lo - 1, -1):
                        if L[y][z][x] == AIR: gap = True
                        elif gap and y < lo + 1: break
                        elif gap and y > lo + 3: floating += 1
        # a shore says more than open sea or bare land: some liquid, mostly ground
        score = focus * 6 + floating * 2 + len(kinds) * 10 + min(sum(kinds.values()), 2000) / 40 - (0 if FLOAT else max(0, (hi - lo) - 24)) - 300 * max(0, frac - .45) + (40 if 0 < frac < .45 else 0)
        if best is None or score > best[0]: best = (score, x0, z0, lo, hi, kinds)
import os
if os.environ.get("CROP_WINDOW"):
    wx, wz = map(int, os.environ["CROP_WINDOW"].split(","))
    for cand in [b for b in [best] if b]:
        pass
    tops = sorted(top[z][x] for z in range(wz, wz + N) for x in range(wx, wx + N) if top[z][x] is not None)
    best = (0, wx, wz, tops[len(tops) // 20], tops[-1], Counter())
score, x0, z0, lo, hi, kinds = best
ylo = lo - 4
blocks = []
for y in range(ylo, hi + 1):
    for z in range(z0, z0 + N):
        row = L[y][z]
        for x in range(x0, x0 + N):
            c = row[x]
            if c == AIR: continue
            # keep a block if it can be seen: a neighbour that is not a full opaque cube, or on the window's edge.
            # ⚠️ NOT "an air neighbour": grass tufts, flowers and leaves are not air, so the ground under a meadow had no air
            # neighbour and was dropped — Eden lost 95% of its grassy cloud (principal 2026-11-08: "the grassy cloud blocks on
            # the eden planet seem to be missing"). The baker's own full_opaque test of the block's model decides.
            edge = x in (x0, x0 + N - 1) or z in (z0, z0 + N - 1) or y == ylo
            nb = [(x + 1, y, z), (x - 1, y, z), (x, y + 1, z), (x, y - 1, z), (x, y, z + 1), (x, y, z - 1)]
            open_ = any(0 <= a < sx and 0 <= b < sy and 0 <= cc < sz and see(L[b][cc][a]) for a, b, cc in nb)
            if open_ or edge: blocks.append([x - x0 - N // 2, y - lo, z - z0 - N // 2, state(c)])
json.dump({"window": [x0, z0, lo + oy, hi + oy], "blocks": blocks}, open(sys.argv[2], "w"))
print(sys.argv[1].split("/")[-1], "window", x0, z0, "y", lo + oy, hi + oy, "blocks", len(blocks), "score", round(score, 1))
print("  features:", kinds.most_common(14))
