"""Put the Frontier rack's melee weapons (AmblerArms.weapon: Netherite Sword, Netherite Axe; the Crossbow is left out because a
held crossbow is only drawn aimed) into creatures.json as 16x16 PNG data URIs, straight from the game's own item textures.
Usage: weapons.py <minecraft-client.jar> <creatures.json>"""
import sys, json, zipfile, base64, io
from PIL import Image
jar, path = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(jar); d = json.load(open(path)); W = {}
for n in ("netherite_sword", "netherite_axe"):
    im = Image.open(io.BytesIO(z.read(f"assets/minecraft/textures/item/{n}.png"))).convert("RGBA"); b = io.BytesIO(); im.save(b, "PNG", optimize=True)
    W[n] = "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
d["weapons"] = W; json.dump(d, open(path, "w"), separators=(",", ":"))
print("weapons", {k: len(v) for k, v in W.items()})
