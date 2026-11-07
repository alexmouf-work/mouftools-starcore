import com.starcore.galaxy.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;

/** The real cube nets of named worlds, through CubePlanetFacts -> CubePlanetArt, in planet_cube_layers.py's file shapes. Scratch probe. */
public class NetProbe {
	public static void main(String[] args) throws Exception {
		Galaxy.shape(Long.parseLong(args[0])); Path out = Path.of(args[1]);
		Path lib = Paths.get("src/main/resources/assets/starcore/textures/planet_layers");
		Map<String, CubePlanetArt.Layer> cache = new HashMap<>();
		CubePlanetArt.Library library = new CubePlanetArt.Library() {
			public CubePlanetArt.Layer layer(String n) { return cache.computeIfAbsent(n, k -> MapProbe.read(lib.resolve(k + ".png"), false)); }
			public CubePlanetArt.Layer ring(int i) { return cache.computeIfAbsent("ring_" + i, k -> MapProbe.read(lib.resolve(k + ".png"), true)); }
		};
		for (int a = 2; a < args.length; a++) {
			String id = args[a], stem = "real_" + id.replace("starcore:frontier/", "").replace("/", "_").replace("-", "m");
			CubePlanetArt.Planet p = CubePlanetFacts.of(id).build(library);
			StringBuilder meta = new StringBuilder("{\"dim\":\"" + id + "\",\"family\":\"" + p.family() + "\",\"variant\":\"" + p.variant() + "\",\"air\":\"" + p.air() + "\",\"members\":[");
			for (int b = 0; b < p.bodies().size(); b++) {
				CubePlanetArt.Body body = p.bodies().get(b);
				BufferedImage im = new BufferedImage(CubePlanetArt.NET_W, CubePlanetArt.NET_H, BufferedImage.TYPE_INT_ARGB);
				im.setRGB(0, 0, CubePlanetArt.NET_W, CubePlanetArt.NET_H, body.argb(), 0, CubePlanetArt.NET_W);
				String f = stem + (p.bodies().size() == 1 ? "_surface.png" : "_m" + b + "_surface.png");
				javax.imageio.ImageIO.write(im, "png", out.resolve(f).toFile());
				double[] r = body.rot();
				meta.append(b == 0 ? "" : ",").append(String.format(Locale.ROOT, "{\"file\":\"%s\",\"pos\":[%.4f,%.4f,%.4f],\"half\":%.4f,\"rot\":[[%.5f,%.5f,%.5f],[%.5f,%.5f,%.5f],[%.5f,%.5f,%.5f]]}",
						f, body.pos()[0], body.pos()[1], body.pos()[2], body.half(), r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]));
			}
			meta.append("]");
			if (p.ring() != null) { StringBuilder rg = new StringBuilder(); for (double v : p.ring().rgba()) rg.append(rg.length() == 0 ? "" : ",").append(String.format(Locale.ROOT, "%.4f", v));
				meta.append(String.format(Locale.ROOT, ",\"ring\":{\"outer\":%.4f,\"inner\":%.4f,\"rgba\":[%s]}", p.ring().outer(), p.ring().inner(), rg)); }
			meta.append(String.format(",\"atm\":\"%06x\"}", p.atm() & 0xFFFFFF));
			Files.writeString(out.resolve(stem + ".json"), meta.toString());
			System.out.println(stem + " " + p.family() + "/" + p.variant() + " bodies " + p.bodies().size() + (p.ring() != null ? " ring" : "") + " atm " + Integer.toHexString(p.atm()));
		}
	}
}
