# Asset tools

The website draws the mod's own art and its real generated worlds. These turn that into what the page loads. Run them against a
checkout of `alexmouf-work/starcore` (default `../starcore`, or set `STARCORE_ASSETS` to its `src/main/resources/assets/`) after one
`./gradlew build` there, which also puts the Minecraft client jar in the Gradle cache (`MC_CLIENT_JAR` to point elsewhere).

- `atlas.py spec.json out` — bakes textures into power-of-two sheets: whole-number nearest upscale (blocks x8, planet nets x2) with
  extruded gutters, so they stay sharp close up and clean far away.
- `bake.py job.json out` — the mod's blockstates and models baked to triangles: variants and multipart, x/y rotation, element rotation,
  cull faces, tint index as vertex colour, fluids at 14/16, and connected plating as `ConnectedFace` chooses it (a line-for-line port).
- `crop.py dump.json out.json [size] [focus|-] [float]` — cuts a diorama out of a `/wgdump`: the window with the most character, or the
  one centred on a block (`CROP_WINDOW=x,z` forces one).
- `isolate.py`, `halve.py` — a Stellate planet out of a dump, and its visible back half for the cut-away.
- `probes/*.java` — read the game's own answers (planet traits, block tints, skies, cube nets, the galaxy, golden trees, Trippy kinds,
  coagulus piles, auroras). Compile against `./gradlew classes printCP` with the build's JDK; call `Galaxy.shape(seed)` first, or traits
  come from the wrong galaxy. The seed is `scripts/checks/world_seed.py run/world`.
