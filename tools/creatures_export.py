"""The Creatures Update's animals: built by the mod's own generator (com.starcore.entity.creature.gen, through the repo's
scripts/creatures/creature_view.py harness), named by its own SpeciesEpithet. Two individuals of each species, each from a
different real world of this galaxy, so the page can show eight different species at random on every visit.
Usage: export.py <starcore root> <worlds.tsv> <epithets.tsv> <outdir>"""
import json, os, random, sys
ROOT, WORLDS, EPI, OUT = sys.argv[1:5]
sys.path.insert(0, os.path.join(ROOT, "scripts", "creatures")); sys.path.insert(0, os.path.join(ROOT, "scripts", "art"))
sys.path.insert(0, os.path.join(ROOT, ".claude", "skills", "minecraft-mob-model", "scripts"))
import creature_view as CV
from PIL import Image
lang = json.load(open(os.path.join(ROOT, "src/main/resources/assets/starcore/lang/en_us.json")))
epi = dict(l.rstrip("\n").split("\t") for l in open(EPI) if "\t" in l)
worlds = [l.split("\t") for l in open(WORLDS) if l.startswith("starcore:frontier/")]
rap = {w[0] for w in worlds if w[1] == "RAPTURE"}
rnd = random.Random(20261112)
species = [s for s in CV.SPECIES if s != "stiltcrane"]
planets = [p for p in sorted(epi) if epi[p] not in ("null", "")]
out, skins = [], []
for sp in species:
    for k in range(2):
        planet = rnd.choice(planets); seed = rnd.randrange(1, 1 << 30); look = 1 if planet in rap else 0
        plan, tex = CV.gen().build(sp, planet, seed, look)
        skins.append(tex)
        out.append({"species": sp, "name": lang.get(f"entity.starcore.{sp}", sp.title()), "epithet": epi[planet], "planet": planet,
                    "seed": seed, "texture": plan["texture"], "res": plan["res"], "hitbox": plan["hitbox"], "winged": plan["winged"],
                    "swimmer": plan["swimmer"], "traits": plan["traits"],
                    "parts": [{k2: p[k2] for k2 in ("name", "role", "parent", "pivot", "rot", "mirror", "phase", "boxes") if k2 in p} for p in plan["parts"]]})
        print(sp, epi[planet], planet, len(plan["parts"]), "parts", tex.size, ", ".join(plan["traits"][:4]))
# all skins on one sheet: shelf-packed, each cell's rect recorded (the page maps a box's uv into it)
W = 1024; x = y = row = 0
for c, im in zip(out, skins):
    if x + im.width > W: x, y, row = 0, y + row, 0
    c["cell"] = [x, y, im.width, im.height]; x += im.width + 2; row = max(row, im.height + 2)
H = y + row; sheet = Image.new("RGBA", (W, H))
for c, im in zip(out, skins): sheet.paste(im, tuple(c["cell"][:2]))
os.makedirs(OUT, exist_ok=True)
sheet.save(os.path.join(OUT, "creatures.webp"), "WEBP", lossless=True, quality=100, method=6, exact=True)
json.dump({"sheet": [W, H], "creatures": out}, open(os.path.join(OUT, "creatures.json"), "w"), separators=(",", ":"))
print("sheet", W, H, os.path.getsize(os.path.join(OUT, "creatures.webp")) // 1024, "KB;", os.path.getsize(os.path.join(OUT, "creatures.json")) // 1024, "KB json")
