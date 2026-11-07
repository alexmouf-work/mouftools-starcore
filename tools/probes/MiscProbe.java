import com.starcore.rapture.*;
import com.starcore.worldgen.*;
import com.starcore.galaxy.*;
import java.util.*;
/** A few real coagulus piles, an Eden's aurora, and the planets of its system. Scratch probe. */
public class MiscProbe {
	public static void main(String[] a) {
		com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0]));
		StringBuilder o = new StringBuilder("{\"piles\":[");
		int[] seeds = {12345, 777, 4242, 9001};
		for (int s = 0; s < seeds.length; s++) {
			o.append(s == 0 ? "[" : ",[");
			List<WetPiece> ps = PileBody.of(seeds[s], 4);
			for (int i = 0; i < ps.size(); i++) {
				WetPiece p = ps.get(i);
				o.append(i == 0 ? "" : ",").append(String.format(Locale.ROOT, "[%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,[%s],%.3f,%d,%d,%d,%b]", p.cx(), p.cy(), p.cz(), p.sx(), p.sy(), p.sz(),
						Arrays.toString(p.m()).replaceAll("[\\[\\] ]", ""), p.phase(), p.ox(), p.oy(), p.layer(), p.jut()));
			}
			o.append("]");
		}
		PlanetTraits t = com.starcore.survival.HazardLevels.traits(a[1]);
		PlanetAurora.Aurora au = PlanetAurora.of(t);
		o.append("],\"aurora\":").append(au == null ? "null" : String.format(Locale.ROOT, "{\"strength\":%.3f,\"low\":\"%06x\",\"high\":\"%06x\",\"curtains\":%d}", au.strength(), au.low() & 0xFFFFFF, au.high() & 0xFFFFFF, au.curtains()));
		int[] c = SystemId.cellOf(a[1]);
		int n = SystemTraits.planetCount(SystemId.of(c[0], c[1]), com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0])).depth(c[0], c[1]));
		o.append(",\"system\":").append(n).append("}");
		System.out.println(o);
	}
}
