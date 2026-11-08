# Journey mock-up (v11)

The site as a single page: the Journey (Earth → the pad → the solar system and the Stellate cut-away → the hyperdrive map from the
home system → the Frontier → three surfaces → the end) and the Updates tab (1.0–1.3), with phone layouts of their own.

- `page.html` — shell, styles, copy. `boot.js` — fetches the files in parallel and rebuilds the texture sheets for the GPU.
  `engine.js` — renderer, baked sheets, shared builders. `stages.js` — the Journey's scenes and
  the conductor (two hash-routed views, scroll-driven rails, fades). `upd.js` — the Updates tab: fetches `updates.json`/`.txt` on first open.
- `build.sh` — writes `site/`: the page (shell and code only, ~115 KB; three.js r128 from cdnjs) and its files.

## What ships (about 3 MB in all; 2.1 MB to start, the Updates tab's 0.8 MB on first open)

| file | what | why this format |
|---|---|---|
| `tex.webp` (51 KB) | every block texture once, native size | lossless WebP, de-duplicated; the page upscales x8 and adds gutters |
| `planets.webp` (1 MB) | every planet net once, native size | lossless WebP; x2 on desktop, x1 on phones |
| `journey.txt` (0.87 MB) | the ship and four worlds as quads, the galaxy's systems | deflate + base64: the host serves no raw binary, and the browser inflates it |
| `journey.json` (96 KB) | scene data, pack index | plain JSON |
| `updates.txt`, `.json` (0.79 MB) | the Updates scenes as quads | as above, fetched only when the tab opens |

Before this pass the page was 10.9 MB with everything inline as base64 PNGs pre-upscaled x8/x2 and per-vertex geometry, plus 4.6 MB for Updates.

- Data is generated, not committed (it embeds the game's art): `specs.py`/`data.py` → sheets, `job.py` + `../tools/updates_job.py` →
  `job_all.json`, `../tools/bake.py job_all.json all`, then `../tools/slim.py site-data`. See `../tools/README.md`.
- `shot7.js outdir desk|phone prefix journey|updates id:frac,...` — Playwright screenshots through a local `python3 -m http.server 8765`.

## Phones (v8)
- Phones expand block textures x2 (a 4096 x 1024 sheet) and planets x1; desktop keeps x8 and x2. A 4096-square canvas plus its GPU
  copy and mips is more than a phone browser comfortably gives a page; that was the "takes ages, if it loads at all".
- Each sheet's canvas is shrunk to 1 px once the GPU has it, so only one copy is held.
- Scenes are built on first need (`lazy()` in `stages.js`), one more a frame ahead of the reader; `journey.txt` loads behind the hero.
- Inflate uses the browser's `DecompressionStream`, or fflate from jsdelivr where that is missing.
- `loadprobe.js <url>` times the boot under iPhone emulation with a 4x CPU throttle (1.6 s to the hero, 13 MB heap).

## Scenes at 64 (v10)
- Every world scene is a 64-block window (was 32), the geometric world a 192-block box (was 96), the Overworld patch 96 (was 48),
  the launch site's ground 129 x 109; heights unchanged. Windows keep their old centres, so the coagulus and the golden grove stay put.
- The hostile world is the Karst world `starcore:frontier/1_2/4` (toxic air, acid rain, radiation; dusty orange fog).
- Dumps (128-block columns; the geometric world as a 192 x 164 x 192 box under the 8.4M cap): `bomb`, `karst`, `eden3`, `rapture2`,
  `ow2`, `geometry2`. `job2.py` builds the job with every planet block tinted by the colour its dump recorded.

## Deploying (Vercel, starcore.mouftools.com)
`build.sh`, then `deploy.sh`, then commit `public/`. `vercel.json` at the repo root tells Vercel there is no build and to serve
`public/` as it stands; a push to main redeploys. Data files are cached for an hour (stale-while-revalidate a day), the page never.

## v11
- The Journey plays itself after "Start the journey": the page scrolls itself chapter by chapter (`PLAYER.D` in `stages.js`, ~2 min
  in all, wall-clock), with play/pause, a scrubbable bar with chapter marks, arrow keys and space; manual scrolling is off there.
- Quad positions are packed at 1/128 block (were 1/16, which rounded every overlay's lift to zero: the connected plating's edges
  fought their base and the ship looked broken). Overlays lift 2/128.
- The visibility flood passes leaves and plants, so ground under a canopy is no longer "sealed" and culled (the mini planets' caps).
- The launch site's hand-built solar panels and tank set are gone; the 1.1 scene is the ship building and lifting off.
- Grass and leaves take what the game gives them there (`ClientLevelTintMixin`): a generated world's `PlanetShade.grass` and leaf shade
  (`probes/GrassProbe.java`: Rapture #543b3b, Karst #9d497e, geometric #78a0c2), Eden its biome's own (#59c93c / #30bb0b, the grassy
  cloud included), the Overworld patch vanilla forest (the server's /locate). The mini planets' vanilla grass is left out: the game
  does not tint it for its planet. Cherry and pale oak leaves are untinted, as in vanilla.
- `crop.py` / `crop_box.py` keep a block when a neighbour lets light through (air, or any block whose model is not a full opaque
  cube, by the baker's own test). Counting only air dropped all ground under grass and flowers: Eden kept 252 of its ~4,000 grassy
  cloud blocks.
- Rapture is now a bare stretch of the same world (`rs4`, window 40,8: no vegetation, ~8% blood), found by `bare.py`, which scores
  every 64-block window by bare ground; the Coagulus stands on flat silt beside the blood.
