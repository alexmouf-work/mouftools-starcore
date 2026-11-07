import json, sys
import os; SC = os.environ.get("STARCORE", "../starcore"); T = SC + "/src/main/resources/assets/starcore/textures/"
V = sys.argv[1] + "/vanilla/"
P = SC + "/scripts/visual/out/cube_planets/"
GRASS, FOLIAGE = "#79c05a", "#59ae30"
b = lambda k, path, **kw: dict(key=k, path=path, scale=8, **kw)
blocks = [
  # grassy planet (planet_grass biome tints) and the launch site's ground
  b("grass_top", V + "grass_block_top.png", tint=GRASS), b("dirt", V + "dirt.png"),
  b("grass_side", V + "grass_block_side.png", overlay=V + "grass_block_side_overlay.png", overlay_tint=GRASS),
  b("oak_log", V + "oak_log.png"), b("oak_log_top", V + "oak_log_top.png"), b("oak_leaves", V + "oak_leaves.png", tint=FOLIAGE),
  b("short_grass", V + "short_grass.png", tint=GRASS), b("stargrass", T + "block/stargrass.png", tint=GRASS, overlay=T + "block/stargrass_tips.png"),
  b("birch_log", V + "birch_log.png"), b("birch_log_top", V + "birch_log_top.png"), b("birch_leaves", V + "birch_leaves.png", tint="#80a755"),
  b("star_core", T + "block/star_core.png"),
  b("aerostone", T + "block/aerostone.png"), b("astrium", T + "block/astrium.png"), b("stellate_ore", T + "block/stellate_crystal_ore.png"),
  b("smooth_stone", V + "smooth_stone.png"), b("stone", V + "stone.png"), b("glass", V + "glass.png"), b("deepslate", V + "deepslate.png"),
  # the Lab Starship and its pad
  b("pad_top", T + "block/lab_starship_launchpad_top.png"), b("pad_side", T + "block/lab_starship_launchpad_side.png"),
  b("term_front", T + "block/lab_starship_terminal_front_ready.png"), b("term_top", T + "block/lab_starship_terminal_top.png"),
  b("plating", T + "block/lab_plating.png"), b("plating_orange", T + "block/lab_plating_orange.png"),
  b("jet", T + "block/lab_booster_jet.png"), b("jet_front", T + "block/lab_booster_jet_front.png"), b("jet_back", T + "block/lab_booster_jet_back.png"),
  b("jet_pos", T + "block/lab_booster_jet_positive.png"), b("jet_neg", T + "block/lab_booster_jet_negative.png"),
  b("cushion", T + "block/lab_starship_cockpit_cushion.png"), b("cushion_side", T + "block/lab_starship_cockpit_cushion_side.png"),
  b("cockpit_pos", T + "block/lab_starship_cockpit_positive.png"), b("cockpit_neg", T + "block/lab_starship_cockpit_negative.png"),
  b("tank", T + "block/lab_fluid_tank.png"), b("tank_top", T + "block/lab_fluid_tank_top.png"), b("tank_bottom", T + "block/lab_fluid_tank_bottom.png"),
  b("tank_conn", T + "block/lab_fluid_tank_connected.png"), b("tank_inner", T + "block/lab_fluid_tank_inner.png"),
  b("window_orange", T + "block/lab_orange_fluid_tank_window.png"),
  b("solar_cells", T + "block/lab_solar_panel_cells.png"), b("solar_back", T + "block/lab_solar_panel_back.png"),
  b("solar_pos", T + "block/lab_solar_panel_positive.png"), b("solar_neg", T + "block/lab_solar_panel_negative.png"),
  b("pipe", T + "block/lab_pipe.png"),
  b("plume", T + "block/plume_flame.png", first_frame=False),
  # suits: armour sheets, leggings, helmet rims and the drill
  b("suit_frontier", T + "entity/equipment/humanoid/frontier_suit.png"), b("legs_frontier", T + "entity/equipment/humanoid_leggings/frontier_suit.png"),
  b("suit_astral", T + "entity/equipment/humanoid/astral_suit.png"), b("legs_astral", T + "entity/equipment/humanoid_leggings/astral_suit.png"),
  b("suit_industrial", T + "entity/equipment/humanoid/industrial_suit.png"), b("legs_industrial", T + "entity/equipment/humanoid_leggings/industrial_suit.png"),
  b("rim_frontier", T + "block/collapsium_block.png"), b("rim_astral", T + "block/aerosteel_block.png"),
  b("drill", T + "item/lunar_drill.png"),
]
json.dump({"sheet": [4096, 4096], "gutter": 16, "items": blocks}, open("blocks_spec.json", "w"))
singles = ["minecraft_overworld", "minecraft_the_nether", "starcore_luneus", "starcore_hesperos",
           "starcore_frontier_42_9_2", "starcore_frontier_19_-77_1", "starcore_frontier_137_-37_1", "starcore_frontier_88_-12_3",
           "starcore_frontier_-31_54_2", "starcore_frontier_7_3_1", "starcore_frontier_63_40_4"]
planets = [dict(key=s, path=P + s + "_surface.png", scale=2) for s in singles]
for c in ["starcore_stellate_cluster", "minecraft_the_end"]:
    meta = json.load(open(P + c + ".json"))
    planets += [dict(key=f"{c}_m{i}", path=P + m["file"], scale=1) for i, m in enumerate(meta["members"])]
for s in ["starcore_frontier_42_9_2", "starcore_frontier_137_-37_1", "starcore_frontier_7_3_1", "starcore_frontier_-31_54_2"]:
    planets.append(dict(key=s + "_ring", path=P + s + "_ring.png", scale=2))
json.dump({"sheet": [4096, 4096], "gutter": 8, "items": planets}, open("planets_spec.json", "w"))
