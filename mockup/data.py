import base64, json, sys
J = sys.argv[1]; import os; SC = os.environ.get("STARCORE", "../starcore"); P = SC + "/scripts/visual/out/cube_planets/"
def uri(path, kind="png"): return f"data:image/{kind};base64," + base64.b64encode(open(path, "rb").read()).decode()
A = {}
for k in ("blocks", "planets"):
    meta = json.load(open(f"{J}/{k}_atlas.json")); A[k] = {"uri": uri(f"{J}/{k}_atlas.png"), "size": meta["size"], "rects": meta["rects"]}
M = {"overworld": ("minecraft_overworld", "#9cc6ff"), "nether": ("minecraft_the_nether", "#ff9a86"), "luneus": ("starcore_luneus", None),
     "hesperos": ("starcore_hesperos", None), "stellate": ("starcore_stellate_cluster", None), "end": ("minecraft_the_end", None),
     "f_ocean": ("starcore_frontier_42_9_2", "#9ff0b8"), "f_rust": ("starcore_frontier_137_-37_1", None), "f_gasring": ("starcore_frontier_7_3_1", None),
     "f_eden": ("starcore_frontier_88_-12_3", "#d4f5a0"), "f_icy": ("starcore_frontier_-31_54_2", None), "f_gas": ("starcore_frontier_19_-77_1", None),
     "f_rapture": ("starcore_frontier_63_40_4", "#c9f2d0")}
PL = {}
for k, (stem, glow) in M.items():
    m = json.load(open(P + stem + ".json")); d = {"stem": stem, "glow": glow}
    if len(m["members"]) > 1: d["members"] = [{"pos": x["pos"], "half": x["half"], "rot": x["rot"]} for x in m["members"]]
    if "ring" in m: d["ring"] = {"inner": m["ring"]["inner"], "outer": m["ring"]["outer"]}
    PL[k] = d
G = json.load(open(f"{J}/grassplanet_half.json"))
open(f"{J}/data.js", "w").write("const ATLAS=" + json.dumps(A, separators=(",", ":")) + ";\nconst PLANETS=" + json.dumps(PL, separators=(",", ":")) + ";\nconst GPLANET=" + json.dumps(G, separators=(",", ":")) + ";\n")
