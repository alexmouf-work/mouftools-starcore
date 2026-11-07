import com.starcore.worldgen.PlanetEden;
/** Where the golden apple trees of an Eden stand, nearest the origin first. Scratch probe. */
public class GoldenProbe {
	public static void main(String[] a) {
		com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0]));
		String id = a[1]; int R = Integer.parseInt(a[2]), found = 0;
		for (int r = 0; r <= R && found < 12; r++)
			for (int x = -r; x <= r; x++) for (int z = -r; z <= r; z++) {
				if (Math.max(Math.abs(x), Math.abs(z)) != r) continue;
				if (PlanetEden.goldenTrunk(id, x, z)) { System.out.println(x + " " + z); if (++found >= 12) return; }
			}
	}
}
