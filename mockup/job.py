import json, sys
J = sys.argv[1]; P = J + "/probe/"
col = json.load(open(P + "colours.json"))
def crop(name): return json.load(open(P + f"crop_{name}.json"))["blocks"]
ship = json.load(open(P + "ship_blocks.json"))
xs = [b[0] for b in ship]; zs = [b[2] for b in ship]; cx = (min(xs) + max(xs)) / 2; cz = (min(zs) + max(zs)) / 2
ship = [[b[0] - round(cx), b[1], b[2] - round(cz), b[3]] for b in ship]
groups = {
  "ship": {"blocks": ship},
  "eden": {"blocks": crop("eden"), "tints": {"grass": "#59c93c", "foliage": "#30bb0b", "birch": "#80a755", "spruce": "#619961", "water": "#3f76e4"}},
  "rapture": {"blocks": crop("rapture"), "block_tints": col["starcore:frontier/-1_-1/5"]["blocks"]},
}
import os
if os.path.exists(P + "crop_hazard.json") and len(sys.argv) > 2:
    groups["hazard"] = {"blocks": crop("hazard"), "block_tints": col[sys.argv[2]]["blocks"]}
json.dump({"groups": groups}, open(J + "/job.json", "w"))
print({k: len(v["blocks"]) for k, v in groups.items()})
