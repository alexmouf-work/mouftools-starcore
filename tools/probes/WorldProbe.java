import com.starcore.galaxy.SystemId;
import com.starcore.galaxy.SystemTraits;
import com.starcore.survival.Hazard;
import com.starcore.worldgen.GalaxyShape;
import com.starcore.worldgen.PlanetTraits;
import java.util.*;

/** Real worlds of a galaxy, nearest the core first: id, type, exceptional, hazards. Scratch probe, not part of the repo. */
public class WorldProbe {
	public static void main(String[] args) {
		long seed = Long.parseLong(args[0]);
		int span = Integer.parseInt(args[1]);
		GalaxyShape g = com.starcore.galaxy.Galaxy.shape(seed);
		List<int[]> cells = new ArrayList<>();
		for (int cx = -span; cx <= span; cx++) for (int cy = -span; cy <= span; cy++) if (g.hasSystem(cx, cy)) cells.add(new int[]{cx, cy});
		cells.sort(Comparator.comparingInt(c -> c[0] * c[0] + c[1] * c[1]));
		for (int[] c : cells) {
			int n = SystemTraits.planetCount(SystemId.of(c[0], c[1]), g.depth(c[0], c[1]));
			for (int i = 0; i < n; i++) {
				String id = SystemId.planet(c[0], c[1], i);
				PlanetTraits t = com.starcore.survival.HazardLevels.traits(id);
				StringBuilder hz = new StringBuilder();
				for (Hazard h : Hazard.values()) { int v = t.hazard(h); if (v > 0) hz.append(h.name().toLowerCase(Locale.ROOT)).append(v).append(' '); }
				System.out.println(id + "\t" + t.world() + "\t" + t.exceptional() + "\t" + hz.toString().trim());
			}
		}
	}
}
