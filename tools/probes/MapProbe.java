import com.starcore.galaxy.*;
import com.starcore.space.HyperSpace;
import com.starcore.worldgen.GalaxyShape;
import com.starcore.worldgen.PlanetTraits;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;

/** The galaxy as the hyperspace map draws it (every system's position, height and colour) and real planet icons. Scratch probe. */
public class MapProbe {
	public static void main(String[] args) throws Exception {
		long seed = Long.parseLong(args[0]); Path out = Path.of(args[1]); int nIcons = Integer.parseInt(args[2]);
		GalaxyShape g = Galaxy.shape(seed);
		int R = (int) Math.ceil(g.radius());
		StringBuilder sys = new StringBuilder("[");
		int count = 0;
		for (int cx = -R; cx <= R; cx++) for (int cy = -R; cy <= R; cy++) {
			if (!g.hasSystem(cx, cy)) continue;
			HyperSpace.Star s = HyperSpace.star(g, cx, cy); if (s == null) continue;
			int col = com.starcore.PullSpectrum.argb(s.star().heat()) & 0xFFFFFF;
			sys.append(count++ == 0 ? "" : ",").append(String.format(Locale.ROOT, "[%.2f,%.2f,%.2f,%d,%d]",
					s.x() / HyperSpace.CELL, HyperSpace.heightCells(s.y()), s.z() / HyperSpace.CELL, col, s.star().ordinal()));
		}
		sys.append("]");
		Files.writeString(out.resolve("galaxy.json"), "{\"radius\":" + g.radius() + ",\"systems\":" + sys + "}");
		System.out.println("systems " + count + " radius " + g.radius());
		// icons: real worlds nearest the core
		Path lib = Paths.get("src/main/resources/assets/starcore/textures/planet_layers");
		Map<String, CubePlanetArt.Layer> cache = new HashMap<>();
		CubePlanetArt.Library library = new CubePlanetArt.Library() {
			public CubePlanetArt.Layer layer(String name) { return cache.computeIfAbsent(name, n -> read(lib.resolve(n + ".png"), false)); }
			public CubePlanetArt.Layer ring(int i) { return cache.computeIfAbsent("ring_" + i, n -> read(lib.resolve(n + ".png"), true)); }
		};
		List<int[]> cells = new ArrayList<>();
		for (int cx = -12; cx <= 12; cx++) for (int cy = -12; cy <= 12; cy++) if (g.hasSystem(cx, cy)) cells.add(new int[]{cx, cy});
		cells.sort(Comparator.comparingInt(c -> c[0] * c[0] + c[1] * c[1]));
		int C = CubePlanetArt.ICON_CANVAS, cols = 12, rows = (nIcons + cols - 1) / cols;
		BufferedImage sheet = new BufferedImage(cols * C, rows * C, BufferedImage.TYPE_INT_ARGB);
		StringBuilder meta = new StringBuilder("[");
		int k = 0;
		Set<String> seenKinds = new HashMap<String, Integer>().keySet();
		Map<String, Integer> perKind = new HashMap<>();
		outer:
		for (int[] c : cells) {
			int n = SystemTraits.planetCount(SystemId.of(c[0], c[1]), g.depth(c[0], c[1]));
			for (int i = 0; i < n; i++) {
				String id = SystemId.planet(c[0], c[1], i);
				PlanetTraits t = com.starcore.survival.HazardLevels.traits(id);
				String kind = t.world() + "/" + t.exceptional();
				if (perKind.merge(kind, 1, Integer::sum) > 4) continue;   // spread the sheet across kinds
				CubePlanetFacts.Facts f = CubePlanetFacts.of(id); if (f == null) continue;
				int[] icon = f.build(library).icon();
				sheet.setRGB((k % cols) * C, (k / cols) * C, C, C, icon, 0, C);
				meta.append(k == 0 ? "" : ",").append(String.format("[\"%s\",\"%s\",\"%s\"]", id, t.world(), t.exceptional()));
				if (++k >= nIcons) break outer;
			}
		}
		meta.append("]");
		javax.imageio.ImageIO.write(sheet, "png", out.resolve("icons.png").toFile());
		Files.writeString(out.resolve("icons.json"), "{\"canvas\":" + C + ",\"cols\":" + cols + ",\"icons\":" + meta + "}");
		System.out.println("icons " + k);
	}
	static CubePlanetArt.Layer read(Path p, boolean ring) {
		try { return CubePlanetArt.decodeLayer(Files.readAllBytes(p), ring); } catch (java.io.IOException e) { throw new java.io.UncheckedIOException(e); }
	}
}
