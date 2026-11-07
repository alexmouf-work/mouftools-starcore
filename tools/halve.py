"""The planet as the page draws it: the back half (z <= 0) only, blocks that touch air or the cut, grouped by kind."""
import json, sys
b = json.load(open(sys.argv[1]))["blocks"]
solid = {}
for x, y, z, s in b: solid[(x, y, z)] = s
SEE_THROUGH = ("leaves", "stargrass")
def opaque(p):
    s = solid.get(p)
    return s is not None and p[2] <= 0 and not any(t in s for t in SEE_THROUGH)
out = {}
for (x, y, z), s in solid.items():
    if z > 0: continue
    nb = [(x+1,y,z),(x-1,y,z),(x,y+1,z),(x,y-1,z),(x,y,z+1),(x,y,z-1)]
    if all(opaque(n) for n in nb) and not any(t in s for t in SEE_THROUGH): continue
    name = s.split("[")[0].split(":")[1]
    props = dict(kv.split("=") for kv in s[s.index("[")+1:-1].split(",")) if "[" in s else {}
    if "log" in name: name += "_" + props.get("axis", "y")
    if name == "stargrass": name += "_" + props.get("facing", "up")
    out.setdefault(name, []).append([x, y, z])
json.dump(out, open(sys.argv[2], "w"), separators=(",", ":"))
print({k: len(v) for k, v in out.items()}, sum(len(v) for v in out.values()))
