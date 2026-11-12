"""The site's Ambler, chosen once (principal 2026-11-12: "pick the amblers once and save them, so we serve the same ones every time
to every user"): keep only the named Ambler individual in creatures.json, give it the named weapon ("held"), and embed that weapon's
16x16 item texture, straight from the game's jar, as a PNG data URI. The weapon must be on the Frontier rack (AmblerArms.weapon);
melee only, because the game draws a held crossbow only while aiming.
Usage: weapons.py <minecraft-client.jar> <creatures.json> <ambler epithet> <weapon item id>"""
import sys, json, zipfile, base64, io
from PIL import Image
jar, path, epithet, weapon = sys.argv[1:5]
assert weapon in ("netherite_sword", "netherite_axe"), weapon
d = json.load(open(path))
keep = [c for c in d["creatures"] if c["species"] == "ambler" and c["epithet"] == epithet]
assert len(keep) == 1, f"no single Ambler named {epithet}"
d["creatures"] = [c for c in d["creatures"] if c["species"] != "ambler"] + keep
keep[0]["held"] = weapon
im = Image.open(io.BytesIO(zipfile.ZipFile(jar).read(f"assets/minecraft/textures/item/{weapon}.png"))).convert("RGBA"); b = io.BytesIO(); im.save(b, "PNG", optimize=True)
d["weapons"] = {weapon: "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()}
json.dump(d, open(path, "w"), separators=(",", ":"))
print("ambler", epithet, keep[0]["planet"], "holding", weapon)
