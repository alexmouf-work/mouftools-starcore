#!/usr/bin/env python3
"""Bake textures into sheets: integer nearest-neighbour upscale, extruded gutters, shelf packing.

WHY. A 16 px block texture shown at 400 px is magnified 25x by the GPU, and a 128 px planet face seen
small is minified through mipmaps built from 16 px of data: both read as blur. Upscaling by an exact
integer with nearest neighbour first means every mip level near 1:1 still has hard texel edges, so the
picture stays crisp from close up to far away. The gutter around each cell repeats its edge pixels, so
the mips of one cell never bleed into the next.

Usage: atlas.py spec.json out_prefix
  spec: {"sheet": [W, H], "gutter": px, "items": [{"key", "path", "scale", "crop": [x,y,w,h]?, "tint": "#rrggbb"?,
          "overlay": path?, "overlay_tint": "#rrggbb"?, "jpeg": bool?}]}
Writes out_prefix.png and out_prefix.json ({key: [x, y, w, h]} in sheet pixels, cell interior only).
"""
import json, sys
from PIL import Image

def tinted(im, hexcol):
    r, g, b = (int(hexcol[i:i + 2], 16) for i in (1, 3, 5))
    px = im.load()
    out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            pr, pg, pb, pa = px[x, y]
            po[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out

def load(it):
    im = Image.open(it["path"]).convert("RGBA")
    if "crop" in it:
        x, y, w, h = it["crop"]; im = im.crop((x, y, x + w, y + h))
    elif im.height > im.width and im.height % im.width == 0 and it.get("first_frame", True):
        im = im.crop((0, 0, im.width, im.width))           # animation strip: first frame
    if "tint" in it:
        im = tinted(im, it["tint"])
    if "overlay" in it:
        ov = Image.open(it["overlay"]).convert("RGBA").crop((0, 0, im.width, im.height))
        if "overlay_tint" in it: ov = tinted(ov, it["overlay_tint"])
        im = Image.alpha_composite(im, ov)
    s = it.get("scale", 1)
    return im.resize((im.width * s, im.height * s), Image.NEAREST)

def main(spec_path, prefix):
    spec = json.load(open(spec_path))
    W, H = spec["sheet"]; G = spec.get("gutter", 8)
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rects, x, y, row = {}, 0, 0, 0
    for it in spec["items"]:
        im = load(it)
        cw, ch = im.width + 2 * G, im.height + 2 * G
        if x + cw > W: x, y, row = 0, y + row, 0
        if y + ch > H: sys.exit(f"sheet full at {it['key']}")
        cell = Image.new("RGBA", (cw, ch))
        cell.paste(im, (G, G))
        # extrude edges into the gutter
        cell.paste(im.crop((0, 0, im.width, 1)).resize((im.width, G)), (G, 0))
        cell.paste(im.crop((0, im.height - 1, im.width, im.height)).resize((im.width, G)), (G, G + im.height))
        col = cell.crop((G, 0, G + 1, ch)).resize((G, ch)); cell.paste(col, (0, 0))
        col = cell.crop((G + im.width - 1, 0, G + im.width, ch)).resize((G, ch)); cell.paste(col, (G + im.width, 0))
        sheet.paste(cell, (x, y))
        rects[it["key"]] = [x + G, y + G, im.width, im.height]
        x += cw; row = max(row, ch)
    used = y + row
    H2 = 1
    while H2 < used: H2 *= 2
    sheet = sheet.crop((0, 0, W, H2))  # keep it a power of two for mipmaps, drop the empty rows
    sheet.save(prefix + ".png", optimize=True)
    json.dump({"size": [W, H2], "used": used, "rects": rects}, open(prefix + ".json", "w"))
    print(prefix, f"{len(rects)} cells, rows used {used}/{H}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
