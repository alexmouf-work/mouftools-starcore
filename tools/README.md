# Asset tools

The website draws the mod's own art and its real generated worlds. These turn that into what the page loads. Run them against a
checkout of `alexmouf-work/starcore` (default `../starcore`, or set `STARCORE_ASSETS` to its `src/main/resources/assets/`) after one
`./gradlew build` there, which also puts the Minecraft client jar in the Gradle cache (`MC_CLIENT_JAR` to point elsewhere).

- `atlas.py spec.json out` — bakes textures into power-of-two sheets: whole-number nearest upscale (blocks x8, planet nets x2) with
  extruded gutters, so they stay sharp close up and clean far away.
- `bake.py job.json out` — the mod's blockstates and models baked to triangles: variants and multipart, x/y rotation, element rotation,
  cull faces, tint index as vertex colour, fluids at 14/16, and connected plating as `ConnectedFace` chooses it (a line-for-line port).
  A group can set `merge` (coplanar full faces of one texture merged into tiled rectangles; a plating wall merges by its 3x3 tile
  period), `hide` (cells no camera sees into, so faces into them are culled), `drop` (facings to leave out) and `fast_leaves`; a block
  may carry its own `[tint0, tint1]` (a block carried from its own planet). Also writes `out.quads.json` for `pack_quads.py`.
- `pack_quads.py out.quads.json pack` — packs a bake into `pack.bin` + `pack.json`: axis-aligned quads in 24 bytes, the rest in 40.
  The page expands them and tiles merged faces with `fract()`.
- `clean.py job_all.json` — drops loose blocks before the bake: clumps a crop window cut off (trees, floating shapes) and strays.
- `slim.py outdir` — what ships: textures at native size, de-duplicated, lossless WebP (the page upscales them); every baked model as
  deflated quads (26/42-byte records, merged faces tiled); the galaxy's systems in the same blob. ~3 MB in place of 15.5.
- `dump_encounters.sh -f <spec>` — builds encounters headless (two mini planets, a mini cluster, an asteroid field, Lab and Frontier
  stations; `SYS=` picks the system) and `/wgdump`s each, plus an Overworld patch.
- `updates_job.py job.json` — the Updates tab's bake job from those dumps (`WGDUMP_DIR`), keeping only what a camera outside can see,
  plus the sky planets built by `PlanetFeature`'s own rule.
- `crop.py dump.json out.json [size] [focus|-] [float]` — cuts a diorama out of a `/wgdump`: the window with the most character, or the
  one centred on a block (`CROP_WINDOW=x,z` forces one).
- `isolate.py`, `halve.py` — a Stellate planet out of a dump, and its visible back half for the cut-away.
- `probes/*.java` — read the game's own answers (planet traits, block tints, skies, cube nets, the galaxy, golden trees, Trippy kinds,
  coagulus piles, auroras, the home system, the arm beyond the galaxy's radius). Compile against `./gradlew classes printCP` with the build's JDK; call `Galaxy.shape(seed)` first, or traits
  come from the wrong galaxy. The seed is `scripts/checks/world_seed.py run/world`.
- `favicon.py outdir` — the favicon: one black hole as the mod's Detailed Black Holes pass draws it (the same maths as the site's
  lens), on a transparent background (black keyed out, a soft deep-space disc behind it so it holds on light tabs), rendered
  at 1024 and filtered down to 512, 192, 180, 32, 16 and a multi-size .ico.
