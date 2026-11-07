import com.starcore.galaxy.*; import com.starcore.worldgen.GalaxyShape; import com.starcore.space.HyperSpace; import java.util.*;
public class RimProbe { public static void main(String[] a) throws Exception {
  GalaxyShape g = Galaxy.shape(Long.parseLong(a[0])); int R = (int)Math.ceil(g.radius());
  StringBuilder sb = new StringBuilder("["); int n = 0;
  for (int cx = 3700; cx <= 4600; cx++) for (int cy = 700; cy <= 1300; cy++) {
    if (Math.abs(cx) <= R && Math.abs(cy) <= R) continue;
    if (!g.hasSystem(cx, cy)) continue; HyperSpace.Star s = HyperSpace.star(g, cx, cy); if (s == null) continue;
    int col = com.starcore.PullSpectrum.argb(s.star().heat()) & 0xFFFFFF;
    sb.append(n++ == 0 ? "" : ",").append(String.format(Locale.ROOT, "[%.2f,%.2f,%.2f,%d,%d]", s.x()/HyperSpace.CELL, HyperSpace.heightCells(s.y()), s.z()/HyperSpace.CELL, col, s.star().ordinal()));
  }
  java.nio.file.Files.writeString(java.nio.file.Path.of(a[1]), sb.append("]").toString()); System.out.println("rim " + n);
}}
