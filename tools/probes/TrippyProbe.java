import java.nio.file.*;
/** Which kind each Trippy world is. Scratch probe. */
public class TrippyProbe {
	public static void main(String[] a) throws Exception {
		com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0]));
		for (String id : Files.readAllLines(Path.of(a[1]))) {
			var t = com.starcore.survival.HazardLevels.traits(id.trim());
			System.out.println(id.trim() + "\t" + com.starcore.worldgen.trippy.Trippy.kindOf(t));
		}
	}
}
