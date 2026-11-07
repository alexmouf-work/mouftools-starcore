# Journey mock-up (v5)

The site as a single page: the Journey (Earth → the pad → the solar system and the Stellate cut-away → the hyperdrive map from the
home system → the Frontier → three surfaces → the end) and the Updates tab (1.0–1.3), with phone layouts of their own.

- `page.html` — shell, styles, copy. `engine.js` — renderer, baked sheets, shared builders. `stages.js` — the Journey's scenes and
  the conductor (two hash-routed views, scroll-driven rails, fades). `upd.js` — the Updates tab: fetches `updpack.txt`/`.json` and
  `upd.png` on first open, expands the packed quads, tiles merged faces with `fract()`.
- `build.sh` — assembles `star-core-journey.html` (three.js r128 from cdnjs, the Journey data inline) and copies the Updates data beside it.
- Data is generated, not committed (it embeds the game's art): `specs.py`/`data.py` → `data.js`, `job.py` + `../tools/bake.py` +
  `pack3.py` → `data2.js`; `../tools/updates_job.py` + `bake.py` + `pack_quads.py` → the Updates pack. See `../tools/README.md`.
- `shot7.js outdir desk|phone prefix journey|updates id:frac,...` — Playwright screenshots through a local `python3 -m http.server 8765`.
