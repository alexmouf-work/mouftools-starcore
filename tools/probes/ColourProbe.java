import com.starcore.survival.HazardLevels;
import com.starcore.worldgen.*;
import java.nio.file.*;
import java.util.*;

/** What the game tints each planet block on a world, tint index 0 and 1, plus the world's sky. Scratch probe. */
public class ColourProbe {
	public static void main(String[] args) throws Exception {
		com.starcore.galaxy.Galaxy.shape(Long.parseLong(args[1]));
		String json = Files.readString(Path.of(args[0]));
		// tiny parser for {"id": ["a","b"], ...}
		StringBuilder out = new StringBuilder("{");
		for (String part : json.substring(1, json.length() - 1).split("\\],")) {
			String planet = part.substring(part.indexOf('"') + 1, part.indexOf('"', part.indexOf('"') + 1));
			String list = part.substring(part.indexOf('[') + 1).replace("]", "");
			PlanetTraits t = HazardLevels.traits(planet);
			int p = PlanetColours.primary(planet), s = PlanetColours.secondary(planet), w = t.weirdness();
			boolean grassy = t.air() != PlanetTraits.Air.NONE;
			out.append(String.format("\"%s\":{\"sky\":\"%06x\",\"kind\":\"%s\",\"fog\":%d,\"air\":\"%s\",\"blocks\":{", planet,
					PlanetSky.atmosphere(planet) & 0xFFFFFF, PlanetSky.kindOf(t), PlanetSky.fogLevel(t), t.air()));
			boolean first = true;
			for (String q : list.split(",")) {
				String id = q.trim().replace("\"", ""); if (id.isEmpty()) continue;
				int t0 = PlanetGroundColour.shade(planet, t, id, p, s, w);
				int t1 = PlanetBlockLibrary.isMycelium(id) ? PlanetShade.mycelium(p, s, w, grassy)
						: PlanetBlockLibrary.isMyceteBulb(id) ? PlanetShade.myceteBulbCore(s) : PlanetShade.grass(p, s, w);
				if (t1 >= 0 && PlanetShade.isGrassBlock(id)) t1 = PlanetShade.grassBlock(t1);
				out.append(first ? "" : ",").append(String.format("\"%s\":[\"%06x\",\"%06x\"]", id, t0 & 0xFFFFFF, t1 & 0xFFFFFF));
				first = false;
			}
			out.append("}},");
		}
		out.setLength(out.length() - 1); out.append("}");
		System.out.println(out);
	}
}
