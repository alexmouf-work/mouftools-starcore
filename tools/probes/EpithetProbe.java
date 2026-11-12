import com.starcore.entity.creature.SpeciesEpithet;
/** The epithet the mod gives an animal born on each world (SpeciesEpithet.of), for the site's labels. Scratch probe. */
public class EpithetProbe { public static void main(String[] a) {
  com.starcore.galaxy.Galaxy.shape(Long.parseLong(a[0]));
  for (int i = 1; i < a.length; i++) System.out.println(a[i] + "\t" + SpeciesEpithet.of(a[i]));
} }
