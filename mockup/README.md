# Journey mock-up (v7)

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
