"""The bake job at 64-block windows (principal 2026-11-07: "make all of the scenes larger by a factor of 2 in all directions except
height"): the ship as before; Eden, Rapture, the Karst hostile world and the geometric world from their wider dumps, every planet block
tinted with the colour the dump recorded for it (the game's own PlanetGroundColour / PlanetShade answer); the Updates groups from
updates_job.py. Then clean.py, bake.py, slim.py."""
import json, os, sys
W = os.environ.get("WGDUMP_DIR", "../starcore/run/wgdump") + "/"
old = json.load(open("job.json"))["groups"]
def tints_of(dump):
    out = {}
    for v in json.load(open(W + dump + ".json"))["key"].values():
        if "color" in v:
            n = v["block"].split("[")[0].split(" @")[0].split(":")[1]
            out.setdefault(n, [v["color"][1:].lower(), v.get("color2", v["color"])[1:].lower()])
    return out
def crop(n): return json.load(open(f"probe/crop64_{n}.json"))["blocks"]
G = {"ship": old["ship"] if isinstance(old["ship"], dict) else {"blocks": old["ship"]}}
G["eden"] = {"blocks": crop("eden"), "tints": old["eden"]["tints"], "block_tints": tints_of("eden3"), "merge": True}
G["rapture"] = {"blocks": crop("rapture"), "block_tints": tints_of("rapture2"), "merge": True}
G["hazard"] = {"blocks": crop("hazard"), "block_tints": tints_of("karst"), "merge": True}
G["geometry"] = {"blocks": json.load(open("probe/crop64_geometry.json"))["blocks"], "tints": old["geometry"]["tints"], "block_tints": tints_of("geometry2"), "merge": True}
G.update(json.load(open(sys.argv[1]))["groups"])     # the Updates groups
json.dump({"groups": G}, open("job_all.json", "w"))
print({k: len(v["blocks"]) for k, v in G.items()})
