import com.starcore.galaxy.*; import com.starcore.worldgen.GalaxyShape; import com.starcore.space.HyperSpace;
public class HomeProbe { public static void main(String[] a) {
  GalaxyShape g = Galaxy.shape(Long.parseLong(a[0])); int[] h = g.homeSystem();
  HyperSpace.Star s = HyperSpace.star(g, h[0], h[1]);
  System.out.println("home " + h[0] + " " + h[1] + " xyz " + s.x()/HyperSpace.CELL + " " + HyperSpace.heightCells(s.y()) + " " + s.z()/HyperSpace.CELL + " radius " + g.radius());
}}
