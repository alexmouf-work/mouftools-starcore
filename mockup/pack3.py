"""Everything round 4 adds to the page's data: baked meshes, the hyperdrive corridor, the worlds, the coagulus, the aurora, Eden's sisters."""
import json, base64
from array import array
b64 = lambda a: base64.b64encode(a.tobytes()).decode()
B = json.load(open("baked.json"))
groups = {}
for g, meshes in B["groups"].items():
    out = {"steps": meshes["steps"]}
    for kind in ("opaque", "blend"):
        m = meshes[kind]
        if not m["pos"]: continue
        out[kind] = {"n": len(m["pos"]) // 3, "pos": b64(array("h", [round(v * 64) for v in m["pos"]])),
                     "uv": b64(array("H", [min(65535, max(0, round(v * 65535))) for v in m["uv"]])),
                     "col": b64(array("B", m["col"])), "nrm": b64(array("b", m["nrm"]))}
    groups[g] = out
BAKED = {"uri": "data:image/png;base64," + base64.b64encode(open("baked.png", "rb").read()).decode(), "groups": groups,
         "jets": json.load(open("probe/ship_meta.json"))["jets"]}
H = json.load(open("probe/hyper.json"))
def repack(p):
    xyz = array("f"); xyz.frombytes(base64.b64decode(p["xyz"]))
    return {"xyz": b64(array("h", [max(-32767, min(32767, round(v * 6))) for v in xyz])), "col": p["col"], "cls": p["cls"]}
HYPER = {"total": H["total"], "radius": H["radius"], "start": H["start"], "tube": repack(H["tube"]), "far": repack(H["far"])}
col = json.load(open("probe/colours.json"))
WORLDS = {}
for k, stem, dim in (("eden", "real_0_0_1", "starcore:frontier/0_0/1"), ("rapture", "real_m1_m1_5", "starcore:frontier/-1_-1/5"),
                     ("hazard", "real_1_2_2", "starcore:frontier/1_2/2"), ("geometry", "real_9_4_3", "starcore:frontier/9_4/3")):
    m = json.load(open(f"probe/nets/{stem}.json"))
    WORLDS[k] = {"stem": stem, "dim": dim, "air": m["air"], "sky": col[dim]["sky"], "kind": col[dim]["kind"]}
misc = json.load(open("probe/misc.json"))
COAG = {"pile": misc["piles"][0], "pos": json.load(open("probe/coag_pos.json"))["pos"]}
SISTERS = [f"s_{i}" for i in (0, 2, 3, 4, 5, 6, 7)]
open("data2.js", "w").write("const BAKED=" + json.dumps(BAKED, separators=(",", ":")) + ";\nconst HYPER=" + json.dumps(HYPER, separators=(",", ":")) +
    ";\nconst WORLDS=" + json.dumps(WORLDS, separators=(",", ":")) + ";\nconst COAG=" + json.dumps(COAG, separators=(",", ":")) +
    ";\nconst AURORA=" + json.dumps(misc["aurora"]) + ";\nconst SISTERS=" + json.dumps(SISTERS) + ";\n")
# PLANETS: the real worlds and Eden's sisters
s = open("data.js").read(); i = s.index("const PLANETS="); j = s.index(";\n", i)
PL = json.loads(s[i + len("const PLANETS="):j])
for k, stem, glow in (("r_eden", "real_0_0_1", "#c1f7f7"), ("r_rapture", "real_m1_m1_5", "#e5b3b3"), ("r_hazard", "real_1_2_2", "#c4a0fb"),
                      ("r_geometry", "real_9_4_3", None)) + tuple((f"s_{n}", f"real_0_0_{n}", None) for n in (0, 2, 3, 4, 5, 6, 7)):
    m = json.load(open(f"probe/nets/{stem}.json")); d = {"stem": stem, "glow": glow}
    if "ring" in m and k.startswith("r_"): d["ring"] = {"inner": m["ring"]["inner"], "outer": m["ring"]["outer"]}
    PL[k] = d
s = s[:i] + "const PLANETS=" + json.dumps(PL, separators=(",", ":")) + s[j:]
open("data.js", "w").write(s)
import os; print("data2.js", os.path.getsize("data2.js") // 1024, "KB; data.js", os.path.getsize("data.js") // 1024, "KB")
