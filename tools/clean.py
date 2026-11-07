"""Drop loose blocks from the world dioramas: clumps a crop window cut off, and strays.

A crop is a window through a world, so it slices through trees, floating shapes and islands at its edges and leaves fragments
hanging in the air that the world itself never had. Clumps are found with 26-connectivity over the cropped blocks (a crop keeps
only exposed blocks, and an exposed shell is still connected). Rules, by what the scene is:
  ground worlds (a diorama with ground): keep the largest clump and any whole clump (not touching the window's sides) of 12+ blocks
  geometric world (no ground, everything floats): keep only whole shapes, of 8+ blocks
  encounters: drop only strays under 6 blocks (an asteroid field is loose by design)
Usage: clean.py job_all.json   (rewrites it in place, printing what went)"""
import json, sys
from collections import Counter
J = json.load(open(sys.argv[1]))
RULE = {"eden": "ground", "rapture": "ground", "hazard": "ground", "ow": "ground", "geometry": "floating", "cluster": "strays"}
N26 = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1) if (a, b, c) != (0, 0, 0)]
for g, rule in RULE.items():
    bl = J["groups"][g]["blocks"]; pos = {(b[0], b[1], b[2]): i for i, b in enumerate(bl)}
    xs = [b[0] for b in bl]; zs = [b[2] for b in bl]; X0, X1, Z0, Z1 = min(xs), max(xs), min(zs), max(zs)
    seen, comps = set(), []
    for p in pos:
        if p in seen: continue
        stack, comp = [p], []; seen.add(p)
        while stack:
            q = stack.pop(); comp.append(q)
            for d in N26:
                r = (q[0] + d[0], q[1] + d[1], q[2] + d[2])
                if r in pos and r not in seen: seen.add(r); stack.append(r)
        edge = any(q[0] in (X0, X1) or q[2] in (Z0, Z1) for q in comp)
        comps.append((comp, edge))
    big = max(len(c) for c, _ in comps)
    keep = set()
    for comp, edge in comps:
        n = len(comp)
        ok = (n == big or (not edge and n >= 12)) if rule == "ground" else (not edge and n >= 8) if rule == "floating" else n >= 6
        if ok: keep.update(comp)
    dropped = Counter(len(c) for c, e in comps if not (c[0] in keep))
    J["groups"][g]["blocks"] = [b for b in bl if (b[0], b[1], b[2]) in keep]
    if "hide" in J["groups"][g]: J["groups"][g]["hide"] = J["groups"][g]["hide"]      # sealed cells stay sealed
    print(f"{g:9s} {len(comps):4d} clumps, kept {len(keep)}/{len(bl)} blocks; dropped clump sizes {sorted(dropped.elements())[:40]}")
json.dump(J, open(sys.argv[1], "w"))
