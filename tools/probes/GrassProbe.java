import com.starcore.survival.HazardLevels;
import com.starcore.worldgen.*;
/** What ClientLevelTintMixin answers for vanilla grass and leaves on a generated world (not Eden): PlanetShade.grass and the leaf shade. */
public class GrassProbe { public static void main(String[] a) {
  com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0]));
  for (int i = 1; i < a.length; i++) { String d = a[i];
    int p = PlanetColours.primary(d), s = PlanetColours.secondary(d), w = HazardLevels.traits(d).weirdness();
    System.out.printf("%s grass=%06x foliage=%06x eden=%s generated=%s%n", d, PlanetShade.grass(p, s, w) & 0xFFFFFF, PlanetShade.shade("planet_oak_leaves", p, s, w) & 0xFFFFFF,
      PlanetEden.is(d), HazardLevels.generated(d)); } } }
