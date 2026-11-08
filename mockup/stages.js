/* ---------------- shared input ---------------- */
const st = { px: 0, py: 0, active: false, narrow: innerWidth < 720, cx: innerWidth / 2, cy: innerHeight / 2 };
addEventListener("pointermove", e => {
  ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  st.active = e.pointerType !== "touch" || e.buttons > 0; st.cx = e.clientX; st.cy = e.clientY;
}, { passive: true });
document.addEventListener("pointerleave", () => { st.active = false; });
const $ = id => document.getElementById(id);
function nearFar(cam, look) { const d = cam.position.distanceTo(look); cam.near = clamp(d * .015, .0015, 2); cam.far = cam.near * 60000; cam.updateProjectionMatrix(); }

function starShader(radius) {
  const m = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x), f.y), mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x), f.y), f.z); }
      void main(){ vec3 p = vP * ${(1.6 * 6 / radius).toFixed(3)}; float t = time * .12;
        float g = n(p*2. + t) * .5 + n(p*5. - t*1.7) * .3 + n(p*11. + t*2.3) * .2; float limb = pow(max(dot(vN, vV), 0.), .45);
        vec3 col = mix(vec3(.95,.38,.08), vec3(1.,.86,.5), g) * (.55 + .7 * limb) + vec3(1.,.95,.8) * pow(g, 6.) * .8; gl_FragColor = vec4(col, 1.); }` });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), m);
}
/* A black hole has no geometry here, exactly as in the game with Detailed Black Holes ON: the lens pass paints it (see LENS in
   engine.js, a port of the mod's black_hole.fsh). This is the marker the pass looks for: its centre and its horizon radius. */
function blackHole(rad) {
  const g = new THREE.Group();
  g.userData = { isHole: true, r: rad, pick: [], body: new THREE.Group(), data: {} };
  return g;
}

/* =================================== THE SYSTEM =================================== */
function buildSystem() {
  const sec = $("system"), secA = $("earth");
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 4000), camA = new THREE.PerspectiveCamera(40, 1, .1, 4000);
  // the page's system sky, drawn here so Hawking's Terminus bends it: radial-gradient(ellipse 70% 60% at 72% 38%, #12215f, transparent 70%), #05060f
  scene.background = radialSky("#05060f", .72, .38, .7, .6, [[0, "#12215f"], [.7, "rgba(18,33,95,0)"]]);
  scene.add(new THREE.AmbientLight(0x6f86c9, .42));
  const sunLight = new THREE.PointLight(0xfff1dc, 1.35, 0); scene.add(sunLight);
  const sky = stars(3000, 600, 1200, "#cfe0ff"); scene.add(sky);
  const sun = starShader(5); scene.add(sun);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xffa860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 }));
  corona.scale.setScalar(26); scene.add(corona);

  const B = {
    overworld: { key: "overworld", pos: [-26, 0, 20], s: 1.2, name: "Earth" },
    luneus: { key: "luneus", pos: [0, 0, 0], s: .34, name: "Luneus" },
    nether: { key: "nether", pos: [34, 0, 16], s: 1.1, name: "The Nether" },
    end: { key: "end", pos: [-8, 0, -38], s: .9, name: "The End" },
    stellate: { key: "stellate", pos: [46, 0, -30], s: 1.4, name: "The Stellate Cluster" },
    hesperos: { key: "hesperos", pos: [-60, 0, 34], s: 2.4, name: "Hesperos" },
    terminus: { key: null, pos: [14, 0, 62], s: 2.2, name: "Hawking's Terminus" }
  };
  Object.values(B).forEach(b => {
    b.g = b.key ? planet(b.key) : blackHole(b.s);
    if (b.key) b.g.scale.multiplyScalar(b.s);
    b.g.position.set(...b.pos); scene.add(b.g);
    if (b !== B.luneus) {
      const r = Math.hypot(b.pos[0], b.pos[2]), pts = [];
      for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x7fb2ff, dashSize: 1.2, gapSize: .9, transparent: true, opacity: .28 }));
      ln.computeLineDistances(); scene.add(ln); b.orbit = ln;
    }
    b.el = document.createElement("div"); b.el.className = "plabel";
    b.el.innerHTML = `<b>${b.name.toUpperCase()}</b>`; labelsEl.appendChild(b.el);
  });
  const OW = B.overworld.g.position, ST = B.stellate.g.position;
  const TOP = new THREE.Box3().setFromObject(B.overworld.g.userData.body).max.y - OW.y;   // Earth's top face, above its centre
  // the ship on its way out: a glowing marker and its trail, from Earth to the Stellate Cluster
  const shipDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xa8d4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const shipCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(shipDot, shipCore);
  const TN = 120, trailPos = new Float32Array(TN * 3), trailCol = new Float32Array(TN * 3);
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; scene.add(trail);
  const C1 = new V3((OW.x + ST.x) / 2 - 6, 16, (OW.z + ST.z) / 2 + 22);
  const path = (u, out) => { const v = 1 - u; return out.set(v * v * OW.x + 2 * v * u * C1.x + u * u * ST.x, v * v * (OW.y + TOP) + 2 * v * u * C1.y + u * u * (ST.y + 2), v * v * OW.z + 2 * v * u * C1.z + u * u * ST.z); };

  // the Stellate world, cut open: the real spawn planet of a generated Stellate Cluster, back half only, never shown whole
  const GS = .055, gp = new THREE.Group(); gp.position.set(ST.x + .4, ST.y + .3, ST.z + 3.4); gp.scale.setScalar(GS); scene.add(gp);
  const KIND = {
    six_sided_grass_block: all6("grass_top"), dirt: all6("dirt"), aerostone: all6("aerostone"), astrium: all6("astrium"), deepslate: all6("deepslate"),
    stellate_crystal_ore: all6("stellate_ore"),
    oak_log_y: ["oak_log", "oak_log", "oak_log_top", "oak_log_top", "oak_log", "oak_log"], birch_log_y: ["birch_log", "birch_log", "birch_log_top", "birch_log_top", "birch_log", "birch_log"],
    oak_log_x: ["oak_log_top", "oak_log_top", "oak_log", "oak_log", "oak_log", "oak_log"], birch_log_x: ["birch_log_top", "birch_log_top", "birch_log", "birch_log", "birch_log", "birch_log"],
    oak_log_z: ["oak_log", "oak_log", "oak_log", "oak_log", "oak_log_top", "oak_log_top"], birch_log_z: ["birch_log", "birch_log", "birch_log", "birch_log", "birch_log_top", "birch_log_top"],
    oak_leaves: all6("oak_leaves"), birch_leaves: all6("birch_leaves")
  };
  const solid = new Set(), m4 = new THREE.Matrix4();
  Object.entries(GPLANET).forEach(([k, list]) => {
    if (!/leaves|stargrass/.test(k)) list.forEach(([x, y, z]) => solid.add(x + "," + y + "," + z));
    if (k === "star_core") return;
    if (k.startsWith("stargrass")) {
      // a cross of two blades on the face it grows from, turned to that face: down is always the planet
      const f = k.split("_")[1], q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0),
        { up: new V3(0, 1, 0), down: new V3(0, -1, 0), north: new V3(0, 0, -1), south: new V3(0, 0, 1), east: new V3(1, 0, 0), west: new V3(-1, 0, 0) }[f]);
      const blade = blockGeo(["stargrass", "stargrass", "stargrass", "stargrass", "stargrass", "stargrass"], [.9, .9, 0]);
      [0, Math.PI / 2].forEach(rot => {
        const im = new THREE.InstancedMesh(blade, BMAT_CUT, list.length);
        const qr = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rot + Math.PI / 4), qq = q.clone().multiply(qr), off = new V3(0, -.05, 0).applyQuaternion(q);
        list.forEach(([x, y, z], i) => { m4.compose(new V3(x, y, z).add(off), qq, new V3(1, 1, 1)); im.setMatrixAt(i, m4); });
        gp.add(im);
      });
      return;
    }
    const im = new THREE.InstancedMesh(blockGeo(KIND[k]), /leaves/.test(k) ? BMAT_CUT : BMAT, list.length);
    list.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4); });
    gp.add(im);
  });
  const core = new THREE.Mesh(blockGeo(all6("star_core")), BMAT_GLOW); gp.add(core);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xffc04a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .85 }));
  coreGlow.scale.setScalar(7); coreGlow.position.z = .7; gp.add(coreGlow);
  const coreLight = new THREE.PointLight(0xffc75a, 1.2, 14 * GS * 20); gp.add(coreLight);
  const isSolid = (x, y, z) => solid.has(x + "," + y + "," + z);
  // surface in the cut plane (z = 0) along an angle: march out from the centre to the last solid block
  const surfaceAt = a => { const dx = Math.cos(a), dy = Math.sin(a); let last = 0; for (let r = 0; r < 26; r += .25) { if (isSolid(Math.round(dx * r), Math.round(dy * r), 0)) last = r; } return last; };
  const leafy = new Set(); Object.entries(GPLANET).forEach(([k, l]) => { if (/leaves|log/.test(k)) l.forEach(([x, y, z]) => leafy.add(x + "," + y)); });
  const clearAt = a => { const r = surfaceAt(a); for (let d = 0; d <= 3.5; d += .5) { const x = Math.round(Math.cos(a) * (r + d)), y = Math.round(Math.sin(a) * (r + d)); for (let ox = -1; ox <= 1; ox++) if (leafy.has((x + ox) + "," + y)) return false; } return true; };
  const findClear = (a0, span) => { for (let k = 0; k <= 40; k++) for (const s of [1, -1]) { const a = a0 + s * k * span / 40; if (clearAt(a)) return a; } return a0; };
  // the planet's real surface is not round: walk the cut-plane outline to place people on it
  function spot(a, lift = 0) { const r = surfaceAt(a) + .5 + lift; return { a, r, pos: new V3(Math.cos(a) * r, Math.sin(a) * r, 0) }; }
  function orient(obj, up, fwd) {
    const y = up.clone().normalize(), z = fwd.clone().sub(y.clone().multiplyScalar(fwd.dot(y))).normalize(), x = new V3().crossVectors(y, z);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  const aTop = findClear(Math.PI / 2, 1.2), aBot = findClear(-Math.PI / 2, 1.2), aJump = findClear(Math.PI * .85, 1.0);
  const miners = [{ grade: "frontier", a: aTop, dir: -1 }, { grade: "astral", a: aBot, dir: 1 }].map(m => {
    const p = suitedPlayer(m.grade), s = spot(m.a); p.position.copy(s.pos);
    const up = s.pos.clone().normalize(), tang = new V3(-up.y, up.x, 0).multiplyScalar(m.dir);
    orient(p, up, tang); gp.add(p);
    // the block in front of them, at their feet: one step along the surface
    const a2 = m.a + m.dir * 1.4 / s.r, tr = surfaceAt(a2), tx = Math.round(Math.cos(a2) * tr), ty = Math.round(Math.sin(a2) * tr);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x0a0a0e, transparent: true, opacity: 0, depthWrite: false }));
    crack.position.set(tx, ty, 0); gp.add(crack);
    return { ...m, p, up, target: new V3(tx, ty, 0), crack };
  });
  const jumper = suitedPlayer("industrial"); gp.add(jumper);
  // gravity arrows: rings at every angle, all pointing at the centre, flowing inward
  const R0 = surfaceAt(0);
  const arrowGeo = (() => { const s = new THREE.Shape(); s.moveTo(-.1, 0); s.lineTo(-.1, -1.1); s.lineTo(-.34, -1.1); s.lineTo(0, -1.7); s.lineTo(.34, -1.1); s.lineTo(.1, -1.1); s.lineTo(.1, 0); s.closePath(); return new THREE.ShapeGeometry(s); })();
  const arrows = [];
  [[R0 + 4, 24, 0x9fc4ff], [R0 + 8.5, 32, 0x7fb2ff], [R0 + 13, 40, 0x6f8fd8], [R0 * .62, 16, 0xffffff], [R0 * .3, 8, 0xffffff]].forEach(([r, n, col], ring) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + ring * .13, m = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, depthTest: false, depthWrite: false }));
      m.rotation.z = a - Math.PI / 2; m.userData = { a, r, ph: (i * .37 + ring * .21) % 1 }; m.renderOrder = 5; gp.add(m); arrows.push(m);
    }
  });

  // stardust around the Overworld, falling toward the cursor the way dust falls into a well
  const N = innerWidth < 720 ? 1400 : 3200;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), warm = new Float32Array(N);
  const rad = new Float32Array(N), ang = new Float32Array(N), spd = new Float32Array(N), basis = new Float32Array(N * 6), off = new Float32Array(N * 3);
  const ta = new V3(), tb = new V3();
  for (let i = 0; i < N; i++) {
    rad[i] = (1.7 + Math.pow(Math.random(), 1.6) * 3.4) * 1.2; ang[i] = Math.random() * 6.283;
    spd[i] = (.35 + Math.random() * .25) / Math.pow(rad[i] / 1.2, 1.5) * (Math.random() < .5 ? 1 : -1) * 2.2;
    ta.set(Math.random() - .5, (Math.random() - .5) * .35, Math.random() - .5).normalize(); tb.set(0, 1, 0).cross(ta).normalize();
    if (Math.random() < .3) tb.applyAxisAngle(ta, (Math.random() - .5) * 1.2);
    basis.set([ta.x, ta.y, ta.z, tb.x, tb.y, tb.z], i * 6);
    size[i] = Math.random() < .05 ? 4.5 : lerp(1.2, 3, Math.random()); phase[i] = Math.random() * 6.283; warm[i] = Math.random() < .07 ? 1 : 0;
  }
  const dg = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
  dg.setAttribute("position", pa); dg.setAttribute("size", new THREE.BufferAttribute(size, 1)); dg.setAttribute("phase", new THREE.BufferAttribute(phase, 1)); dg.setAttribute("warm", new THREE.BufferAttribute(warm, 1));
  const dm = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, pr: { value: R.getPixelRatio() }, fade: { value: 1 }, cA: { value: new THREE.Color("#7fb2ff") }, cB: { value: new THREE.Color("#ffb870") } },
    vertexShader: `attribute float size; attribute float phase; attribute float warm; uniform float time; uniform float pr; varying float vTw; varying float vWarm;
      void main(){ vWarm = warm; vTw = .45 + .55 * pow(.5 + .5 * sin(time * 2.6 + phase), 3.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * pr * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cA; uniform vec3 cB; uniform float fade; varying float vTw; varying float vWarm;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a *= a; gl_FragColor = vec4(mix(cA, cB, vWarm) * (1. + vTw * .6), a * vTw * fade); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dg, dm); dust.frustumCulled = false; scene.add(dust);

  const cap = $("sys-cap");
  const items = [
    { name: "The solar system", text: "The starter planets and countless deep-space encounters." },
    { name: "Real gravity", text: "Every planet pulls you to its centre." },
    { name: "Dig to the core", text: "Every planet has a star core at its heart." },
    { name: "No wrong way up", text: "Stand on any side. Gravity follows you." },
    { name: "Jump anywhere", text: "You always land on your feet." }
  ];
  let P = {}, R_, RA;
  const W = v => gp.localToWorld(v.clone());
  function layout() {
    const n = st.narrow;
    P.c = ["s-c0", "s-c1", "s-c2", "s-c3"].map(id => anchorP(sec, $(id))); P.out = anchorP(sec, $("s-out"));
    gp.updateMatrixWorld(true);
    const G = gp.position;
    const close = (local, up, side, k = 1) => { const w = W(local), u = up.clone().normalize(); return { pos: [w.x + side * .07 * k + u.x * .06 * k, w.y + u.y * .06 * k, w.z + (n ? .66 : .44) * k], look: [w.x + (n ? 0 : side * .13 * k), w.y - (n ? u.y * .05 * k : 0), w.z] }; };
    const top = miners[0], bot = miners[1], js = spot(aJump, 1), coreW = W(new V3(0, 0, 0));
    const far = n ? 1.6 : 1;
    R_ = rail([
      { p: 0, pos: [-44 * far, 26 * far, 64 * far], look: [-18, 0, 10] },
      { p: P.c[0] * .5, pos: [0, 105 * far, 150 * far], look: [n ? 10 : 0, 0, n ? 0 : 6] },
      { p: P.c[0] * .82, pos: [ST.x + 7, ST.y + 6, ST.z + 18 * far], look: [ST.x, ST.y, ST.z] },
      { p: P.c[0], pos: [G.x - (n ? 0 : .9), G.y + (n ? .5 : .1), G.z + (n ? 4.4 : 3.2)], look: [G.x - (n ? 0 : 1.15), G.y - (n ? .9 : 0), G.z] },
      { p: P.c[1], ...close(top.p.position, top.up, -1) },
      { p: P.c[1] + (P.c[2] - P.c[1]) * .3, ...close(top.p.position, top.up, -1) },
      { p: (P.c[1] + P.c[2]) * .5 + P.c[2] * .0, pos: [coreW.x - (n ? 0 : .25), coreW.y, coreW.z + (n ? 1.5 : 1.0)], look: [coreW.x - (n ? 0 : .3), coreW.y - (n ? .25 : 0), coreW.z] },
      { p: P.c[2], ...close(bot.p.position, bot.up, -1) },
      { p: P.c[2] + (P.c[3] - P.c[2]) * .4, ...close(bot.p.position, bot.up, -1) },
      { p: P.c[3], ...close(js.pos, js.pos, -1, 1.45) },
      { p: P.c[3] + (P.out - P.c[3]) * .55, ...close(js.pos, js.pos, -1, 1.45) },
      { p: P.out, pos: [ST.x + 10, ST.y + 9, ST.z + 30 * far], look: [ST.x, ST.y, ST.z] },
      { p: P.out + (1 - P.out) * .45, pos: [0, 240, 400], look: [0, 0, 0] },
      { p: 1, pos: [0, 2600, 4400], look: [0, 0, 0], ease: t => t * t }
    ]);
    // the dive: from the hero shot down onto Earth's top face, which is where the pad is
    RA = rail([
      { p: 0, ...(n ? { pos: [OW.x, OW.y + .3, OW.z + 9.5], look: [OW.x, OW.y + 1.2, OW.z] } : { pos: [OW.x - .6, OW.y + .4, OW.z + 6.2], look: [OW.x - 1.35, OW.y, OW.z] }) },
      { p: .3, pos: [OW.x - .3, OW.y + TOP * 3.4, OW.z + 3.6 * far], look: [OW.x, OW.y + TOP * .4, OW.z] },
      { p: .78, pos: [OW.x, OW.y + TOP + 1.1, OW.z + .35], look: [OW.x, OW.y + TOP - .4, OW.z - .02] },
      { p: 1, pos: [OW.x, OW.y + TOP + .05, OW.z + .02], look: [OW.x, OW.y, OW.z - .01], ease: t => t * t }
    ]);
  }
  const look = new V3(), wv = new V3(), tmp = new V3(), dir = new V3(), Wc = new V3(), sp = new V3();
  let swing = 0, stage = 0, hop = 0;
  // what both shots share: the system turning, the dust, the cut-away's life
  function tick(dt, t, c, p, dust, arrowsOn) {
    const a = RM ? 0 : dt;
    sky.userData.mat.uniforms.time.value = t; sun.material.uniforms.time.value = RM ? 0 : t; dm.uniforms.time.value = t;
    Object.values(B).forEach(b => { if (b.key) spinPlanet(b.g, a, .08); });
    B.luneus.g.position.set(OW.x + Math.cos(t * .25) * 3.2, OW.y + .4, OW.z + Math.sin(t * .25) * 3.2);
    let pull = 0;
    if (st.active && dust > .5) { tmp.set(ndc.x, ndc.y, .5).unproject(c); dir.copy(tmp).sub(c.position).normalize(); Wc.copy(c.position).addScaledVector(dir, (OW.z - c.position.z) / dir.z); pull = 1; }
    dm.uniforms.fade.value = dust;
    if (dust > 0) {
      const kk = RM ? 1 : 1 - Math.exp(-dt * 3.2);
      for (let i = 0; i < N; i++) {
        ang[i] += spd[i] * a;
        const r = rad[i], ca = Math.cos(ang[i]) * r, sa = Math.sin(ang[i]) * r, b = i * 6, j = i * 3;
        const ox = OW.x + basis[b] * ca + basis[b + 3] * sa, oy = OW.y + basis[b + 1] * ca + basis[b + 4] * sa, oz = OW.z + basis[b + 2] * ca + basis[b + 5] * sa;
        let tx = 0, ty = 0, tz = 0;
        if (pull) { const dx = Wc.x - ox, dy = Wc.y - oy, dz = Wc.z - oz, f = Math.min(.92, 2 / (dx * dx + dy * dy + dz * dz + .6)); tx = dx * f; ty = dy * f; tz = dz * f; }
        off[j] += (tx - off[j]) * kk; off[j + 1] += (ty - off[j + 1]) * kk; off[j + 2] += (tz - off[j + 2]) * kk;
        pos[j] = ox + off[j]; pos[j + 1] = oy + off[j + 1]; pos[j + 2] = oz + off[j + 2];
      }
      pa.needsUpdate = true;
    }
    swing += a * 9; stage = (stage + a * .9) % 1;
    miners.forEach((m, i) => { m.p.userData.tool.rotation.x = -.95 + Math.sin(swing + i) * .3; m.p.userData.armR.rotation.x = -.2 + Math.sin(swing * .5) * .05; m.crack.material.opacity = stage * .55; });
    hop += a * 1.25;
    const span = .28, phase = (hop % 2) / 2, along = (phase < .5 ? phase * 2 : 2 - phase * 2), h = Math.abs(Math.sin(hop * Math.PI * 2)) * 1.3;
    const ja = aJump + (along - .5) * span, js = spot(ja, h), up = js.pos.clone().normalize(), fw = new V3(-up.y, up.x, 0).multiplyScalar(phase < .5 ? 1 : -1);
    jumper.position.copy(js.pos); orient(jumper, up, fw);
    const air = h > .15 ? 1 : 0, ud = jumper.userData;
    ud.legL.rotation.x = air * .6; ud.legR.rotation.x = -air * .4; ud.armL.rotation.x = -air * 2.6; ud.armR.rotation.x = -air * 2.4; ud.drill.visible = false;
    arrows.forEach(m => {
      const u = m.userData, ph = RM ? .5 : (u.ph + t * .35) % 1, r = u.r - ph * 2.2;
      m.position.set(Math.cos(u.a) * r, Math.sin(u.a) * r, .62); m.material.opacity = Math.sin(ph * Math.PI) * .9 * arrowsOn;
    });
    coreLight.intensity = 1.2 + Math.sin(t * 3) * .2; coreGlow.material.opacity = .7 + Math.sin(t * 3) * .15;
  }
  function labels(c, on, stellateOn) {
    Object.values(B).forEach(b => {
      b.g.getWorldPosition(wv); const q = project(wv, c, tmp);
      const o = b === B.stellate ? stellateOn : on;
      b.el.style.opacity = q.behind ? 0 : o.toFixed(3);
      b.el.style.transform = `translate(${q.x + 12}px, ${q.y - (b === B.luneus ? 40 : 22)}px)`;
    });
  }
  function frameA(dt, t, p) {
    RA(p, camA.position, look);
    const k = 1 - smooth(0, .25, p);
    camA.position.x += st.px * .3 * k; camA.position.y += st.py * .22 * k;
    camA.lookAt(look); nearFar(camA, look);
    shipDot.visible = shipCore.visible = trail.visible = false; sky.userData.mat.uniforms.alpha.value = 1;
    corona.scale.setScalar(26);
    tick(dt, t, camA, p, 1 - smooth(.08, .3, p), 0);
    labels(camA, 0, 0);
  }
  function frame(dt, t, p) {
    R_(p, cam.position, look);
    const k = 1 - smooth(0, P.c[0] * .3, p) * .7;
    cam.position.x += st.px * .3 * k; cam.position.y += st.py * .22 * k;
    cam.lookAt(look); nearFar(cam, look);
    // the ship crosses the system
    const u = smooth(.01, P.c[0] * .8, p), on = p < P.c[0] * .9;
    shipDot.visible = shipCore.visible = trail.visible = on;
    if (on) {
      path(u, sp); shipDot.position.copy(sp); shipCore.position.copy(sp);
      const d = cam.position.distanceTo(sp); shipDot.scale.setScalar(d * .05); shipCore.scale.setScalar(d * .014);
      for (let i = 0; i < TN; i++) { const f = i / (TN - 1), uu = Math.max(0, u - (1 - f) * .3); path(uu, tmp); trailPos.set([tmp.x, tmp.y, tmp.z], i * 3); const c = Math.pow(f, 1.6) * (uu > 0 ? 1 : 0); trailCol.set([.55 * c, .8 * c, 1 * c], i * 3); }
      trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
    }
    // out at the end, until the whole system is one star
    const out = smooth(P.out, 1, p), D = cam.position.length();
    corona.scale.setScalar(Math.max(26, D * .032));
    sky.userData.mat.uniforms.alpha.value = 1 - smooth(P.out + (1 - P.out) * .3, 1, p);
    tick(dt, t, cam, p, 0, smooth(P.c[0] * .85, P.c[0], p));
    const la = smooth(0, P.c[0] * .25, p) * (1 - smooth(P.c[0] * .6, P.c[0] * .8, p)) * (1 - out);
    labels(cam, la, smooth(0, P.c[0] * .25, p) * (1 - smooth(P.c[0] * .9, P.c[0], p)));
    capSwap(cap, stepIndex(p, [0, ...P.c]), items);
    cap.style.visibility = p < P.out + .02 ? "visible" : "hidden";
  }
  function hide() { labelsEl.querySelectorAll(".plabel").forEach(e => e.style.opacity = 0); }
  function show(v) { if (!v) hide(); }
  return {
    earth: { sec: secA, scene, cam: camA, layout, frame: frameA, show, sky: "" },
    system: { sec, scene, cam, layout, frame, show, sky: "" }
  };
}

/* =================================== THE LAUNCH SITE =================================== */
function buildSite(o = {}) {
  const sec = $(o.sec || "site"), IND = !!o.industry;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 1, .1, 3000);
  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a5a3a, .6));
  const sun = new THREE.DirectionalLight(0xfff3dc, 1.0); sun.position.set(30, 50, -22); scene.add(sun);
  const space = stars(2200, 500, 900, "#e6ecff"); scene.add(space);
  const m4 = new THREE.Matrix4();
  const inst = (geo, mat, cells) => { const im = new THREE.InstancedMesh(geo, mat, cells.length); cells.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); im.setMatrixAt(i, m4); }); scene.add(im); return im; };
  const grass = [], dirt = [];
  const hgt = (x, z) => (Math.sin(x * .21) + Math.cos(z * .17) > 1.25 && Math.hypot(x, z) > 11) ? 1 : 0;
  for (let x = -64; x <= 64; x++) for (let z = -40; z <= 68; z++) { const h = hgt(x, z); grass.push([x, h, z]); dirt.push([x, h - 1, z]); }
  inst(blockGeo(["grass_side", "grass_side", "grass_top", "dirt", "grass_side", "grass_side"]), BMAT, grass);
  inst(blockGeo(all6("dirt")), BMAT, dirt);
  [[-22, 18], [21, 24], [26, -6], [-44, 40], [46, 52], [-52, -22], [55, -30], [8, 58], [-30, 60], [40, 10]].forEach(([x, z]) => {
    const h = hgt(x, z) + 1, logs = [], leaves = [];
    for (let y = 0; y < 5; y++) logs.push([x, h + y, z]);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 6; dy++) { const r = Math.abs(dx) + Math.abs(dz) + (dy > 4 ? 2 : 0); if (r <= 3 && !(dx === 0 && dz === 0 && dy < 5)) leaves.push([x + dx, h + dy, z + dz]); }
    inst(blockGeo(["oak_log", "oak_log", "oak_log_top", "oak_log_top", "oak_log", "oak_log"]), BMAT, logs); inst(blockGeo(all6("oak_leaves")), BMAT_CUT, leaves);
  });
  // the Lab Starship launchpad deck, 13 x 13, its terminal in the north-east corner facing out
  const pad = []; for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) if (!(x === 6 && z === -6)) pad.push([x, 1, z]);
  inst(blockGeo(["pad_side", "pad_side", "pad_top", "pad_side", "pad_side", "pad_side"]), BMAT, pad);
  inst(blockGeo(["pad_side", "pad_side", "term_top", "pad_side", "pad_side", "term_front"]), BMAT, [[6, 1, -6]]);
  // the ship: the principal's own structure, baked from the mod's models, assembling block by block
  const ship = new THREE.Group(); ship.position.y = 2; scene.add(ship);
  const hull = bakedMesh("ship"); ship.add(hull);
  // a plume in the cell beneath each Lab booster jet: the mod's flame, 8 frames at frametime 2 (10 fps)
  const plumes = [], r0 = BR.plume;
  JETS.forEach(([x, y, z]) => [0, Math.PI / 2].forEach(rot => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.6), new THREE.MeshBasicMaterial({ map: BT, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(x, y - 1.8, z); m.rotation.y = rot; m.visible = false; ship.add(m); plumes.push(m);
  }));
  const plumeY = plumes.map(m => m.position.y);
  function plumeFrame(f) {
    const fs = r0[2], fy = r0[1] + f * fs;     // square frames down the strip, at whatever scale this device's sheet uses
    plumes.forEach(m => { const U = m.geometry.attributes.uv; const u0 = r0[0] / BW, u1 = (r0[0] + fs) / BW, v1 = 1 - fy / BH, v0 = 1 - (fy + fs) / BH;
      U.setXY(0, u0, v1); U.setXY(1, u0, v0); U.setXY(2, u1, v1); U.setXY(3, u1, v0); U.needsUpdate = true; });
  }
  // (the hand-built solar panels and fuel tanks that stood here are gone, principal 2026-11-07: "it looks broken and weird")
  const machines = [];
  const builder = suitedPlayer("frontier"); builder.position.set(-4.6, 1.5, -5.4); builder.rotation.y = .55; scene.add(builder); builder.userData.drill.visible = false;

  const cap = IND ? null : $("site-cap");
  const items = [
    { name: "Build your starship", text: "Starcore brings fully custom starship building to modern Minecraft." },
    { name: "Lift-off", text: "Take off and visit the stars." }
  ];
  let P = {}, R_;
  function layout() {
    const n = st.narrow;
    // framed from the ship's real size and the screen's shape: the hull (9 wide, ~11 tall from the pad) fills ~80% of a desktop's
    // height, or the width of a phone (principal 2026-11-08: "the starship is super small")
    const T = [n ? 0 : 2.2, 7, 0], D = fitDist(cam, 6, 6.5, n ? .95 : .8);
    const at = (dx, dy, dz, k = 1) => { const L = Math.hypot(dx, dy, dz); return [T[0] + dx / L * D * k, T[1] + dy / L * D * k, T[2] + dz / L * D * k]; };
    if (IND) {
      // the ship builds itself, then away: P.l = [start, ship done, ignition, lift]
      P.l = [.02, .5, .6, .68];
      R_ = rail([
        { p: 0, pos: at(-20, 9, -20, 1.15), look: T },
        { p: .24, pos: at(18, 6, -22), look: T },
        { p: .52, pos: at(12, 3, -24), look: T },
        { p: .68, pos: at(14, 1, -24), look: [T[0], T[1] + 1, 0] },
        { p: 1, pos: at(14, 1, -24), look: [T[0], T[1] + 1, 0] }
      ]);
      return;
    }
    P.l = ["l-0", "l-1", "l-3", "l-4"].map(id => anchorP(sec, $(id)));
    // straight down out of Earth's top face onto the pad, then round to the north side (the cockpit faces north) for most of the build
    const top = fitDist(cam, 7.5, 7.5, .6);
    R_ = rail([
      { p: 0, pos: [.4, top, -1.2], look: [0, 0, 0] },
      { p: P.l[1] * .22, pos: at(5, 16, -10, 1.25), look: [T[0] * .5, 3, 0] },
      { p: P.l[1] * .45, pos: at(11, 4, -24), look: T },
      { p: P.l[1], pos: at(13, 3, -22), look: T },
      { p: P.l[2], pos: at(14, 2, -22), look: T },
      { p: P.l[3], pos: at(14, 1, -24), look: [T[0], T[1] + 1, 0] },
      { p: 1, pos: at(14, 1, -24), look: [T[0], T[1] + 1, 0] }
    ]);
  }
  const look = new V3(), skyEl = $("sky");
  let lastFrame = -1;
  function mix(a, b, t) { return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
  function frame(dt, t, p) {
    R_(p, cam.position, look);
    if (IND) machines.forEach((m, i) => m(smooth(i / machines.length * P.l[0], (i + 1) / machines.length * P.l[0], p)));
    const built = (IND ? smooth(P.l[0], P.l[1], p) : smooth(P.l[1] * .12, P.l[1] * .92, p)) * hull.userData.blocks;
    hull.userData.reveal(RM ? hull.userData.blocks : Math.ceil(built));
    builder.userData.armR.rotation.x = built < hull.userData.blocks && built > 0 ? -1.4 + Math.sin(t * 9) * .35 : -.1;
    const lit = p > P.l[2] - .01, lift = smooth(P.l[3], 1, p), climb = Math.pow(lift, 2.1) * 260;
    ship.position.y = 2 + climb;
    if (lit && !RM) { ship.position.x = Math.sin(t * 43) * .03 * (1 - lift); ship.position.z = Math.cos(t * 37) * .03 * (1 - lift); }
    plumes.forEach((m, i) => { m.visible = lit; m.scale.y = 1 + lift * 1.6; m.position.y = plumeY[i] - lift * 1.4; });
    const f = Math.floor(t * 10) % 8; if (f !== lastFrame) { plumeFrame(f); lastFrame = f; }
    cam.position.y += climb; look.y += climb;     // the camera climbs with the ship, so it stays the size it was on the pad
    cam.position.x += st.px * .5; cam.position.y += st.py * .35;
    cam.lookAt(look); nearFar(cam, look);
    const alt = smooth(.05, .65, lift);
    skyEl.style.setProperty("--sky-top", mix("#5d9be0", "#05060f", alt)); skyEl.style.setProperty("--sky-bottom", mix("#cfe4ff", "#0d1430", alt));
    space.userData.mat.uniforms.time.value = t; space.userData.mat.uniforms.alpha.value = smooth(.35, .8, lift);
    if (cap) capSwap(cap, stepIndex(p, [0, P.l[2]]), items);
  }
  return { sec, scene, cam, layout, frame, sky: "site" };
}

/* =================================== A LANDING: a real world's surface =================================== */
function buildWorld(key, opts) {
  const sec = $("w-" + key), W = WORLDS[key];
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .1, 1200);
  const sky = new THREE.Color("#" + opts.sky[0]);
  scene.add(new THREE.HemisphereLight(opts.hemi[0], opts.hemi[1], opts.hemi[2]));
  const sun = new THREE.DirectionalLight(opts.sun[0], opts.sun[1]); sun.position.set(18, 30, 10); scene.add(sun);
  if (opts.fog) scene.fog = new THREE.Fog(opts.fog, 85, 250);
  if (opts.stars) { const s = stars(2400, 300, 600, opts.stars); scene.add(s); scene.userData.sky = s; }
  const land = bakedMesh(key, quadMats({ fog: opts.fog || 0, near: opts.fog ? 85 : 1e5, far: opts.fog ? 250 : 2e5, tint: opts.tint })); scene.add(land);
  if (opts.extra) opts.extra(scene);
  // what drifts in the air: pollen and petals, spores, or acid drizzle
  const N = st.narrow ? 1400 : 2400, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 80; pos[i * 3 + 1] = Math.random() * 60; pos[i * 3 + 2] = (Math.random() - .5) * 80; vel.set(opts.drift(), i * 3); }
  const pg = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage); pg.setAttribute("position", pa);
  const motes = opts.rain
    ? new THREE.LineSegments((() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3)); return g; })(), new THREE.LineBasicMaterial({ color: opts.mote, transparent: true, opacity: .55 }))
    : new THREE.Points(pg, new THREE.PointsMaterial({ color: opts.mote, size: opts.moteSize, transparent: true, opacity: .85, depthWrite: false }));
  // Only rain. Pollen and spores were square points, and a square drifting in the air reads as a loose block (principal 2026-11-07).
  motes.frustumCulled = false; if (opts.rain) scene.add(motes);
  const card = $(key + "-card");
  if (card) card.innerHTML = `<span class="cap-name">${opts.title}</span><p class="cap-text">${opts.text}</p>`;
  const look = new V3();
  function layout() {}
  function frame(dt, t, p) {
    const K = .78, a = opts.angle + p * 1.6 + (RM ? 0 : t * .02), d = ((st.narrow ? 112 : 80) - p * 10) * K * (opts.dist || 1);
    const fc = opts.focus ? opts.focus() : [0, opts.lookY == null ? 6 : opts.lookY, 0];
    cam.position.set(fc[0] + Math.cos(a) * d, fc[1] + ((opts.camY || 16) - fc[1]) * K + p * 4, fc[2] + Math.sin(a) * d);
    look.set(fc[0], fc[1], fc[2]); cam.position.x += st.px * 1.5; cam.position.y += st.py;
    cam.lookAt(look); nearFar(cam, look);
    const k = RM ? 0 : dt;
    if (opts.rain) {
      const L = motes.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= 18 * k; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 60; L.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[i * 3] + .1, pos[i * 3 + 1] + .9, pos[i * 3 + 2]], i * 6); }
      motes.geometry.attributes.position.needsUpdate = true;
    } else {
      for (let i = 0; i < N; i++) { for (let c = 0; c < 3; c++) pos[i * 3 + c] += vel[i * 3 + c] * k; if (pos[i * 3 + 1] > 30) pos[i * 3 + 1] = 0; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 30; }
      pa.needsUpdate = true;
    }
    if (scene.userData.sky) scene.userData.sky.userData.mat.uniforms.time.value = t;
    scene.userData.cam = cam;
    if (scene.userData.tick) scene.userData.tick(t, dt);
  }
  function show(v) { if (v) $("sky").style.background = opts.css; else $("sky").style.background = ""; }
  return { sec, scene, cam, layout, frame, show, sky: "world" };
}

/* =================================== THE HYPERDRIVE MAP, FLOWN =================================== */
/* The galaxy exactly as the hyperdrive menu draws it (GalaxyRaster): every system a cube in its PullSpectrum colour, flat-shaded —
   top at full light lifted 28% toward white, x faces at 78%, z faces at 56% — heights x4 (HEIGHT_X), a black hole a black cube
   with white edges, and anything too small to be a cube an additive pixel of its colour. Here the camera rides behind the ship. */
function buildHyper() {
  const sec = $("hyper");
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1, .05, 20000);
  const SIZE = [0.60, 2.20, 1.00, 0.40, 1.90, 1.25, 0.34, 0.28, 1.00];       // StarClass sizes, in ordinal order
  const half = c => (0.65 + 0.8 * Math.sqrt(SIZE[c])) * 0.11 * (c === 8 ? 1.5 : 1);
  const M = ASSETS.J.pack, B = JBIN;
  function decode(k) {
    const [xo, xn] = M[k + "_xyz"], [co, cn] = M[k + "_col"], [lo, ln] = M[k + "_cls"];
    return { xyz: new Int16Array(B, xo, xn / 2), col: new Uint8Array(B, co, cn), cls: new Uint8Array(B, lo, ln), n: ln };
  }
  const T = decode("tube"), F = decode("far");
  // shaded cube: per-vertex light and lift by face (BoxGeometry order: +x, -x, +y, -y, +z, -z)
  const box = new THREE.BoxGeometry(2, 2, 2), lightA = [], liftA = [];
  [[.78, 0], [.78, 0], [1, .28], [.45, 0], [.56, 0], [.56, 0]].forEach(([l, f]) => { for (let i = 0; i < 4; i++) { lightA.push(l); liftA.push(f); } });
  box.setAttribute("lightK", new THREE.Float32BufferAttribute(lightA, 1)); box.setAttribute("liftK", new THREE.Float32BufferAttribute(liftA, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: `attribute float lightK; attribute float liftK; varying vec3 vCol;
      void main(){ vec3 c = min(instanceColor * lightK, vec3(1.)); vCol = c + (1. - c) * liftK; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.); }` });
  const holeMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float e = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)); gl_FragColor = vec4(vec3(e < .07 ? 1. : 0.), 1.); }` });
  let nStars = 0, nHoles = 0; for (let i = 0; i < T.n; i++) T.cls[i] === 8 ? nHoles++ : nStars++;
  const stars = new THREE.InstancedMesh(box, starMat, nStars), holes = new THREE.InstancedMesh(box, holeMat, nHoles);
  const m4 = new THREE.Matrix4(), c3 = new THREE.Color(); let si = 0, hi = 0;
  const colors = new Float32Array(nStars * 3);
  for (let i = 0; i < T.n; i++) {
    const x = T.xyz[i * 3] / 6, y = T.xyz[i * 3 + 1] / 6, z = T.xyz[i * 3 + 2] / 6, e = half(T.cls[i]);
    m4.makeScale(e, e, e).setPosition(x, y, z);
    if (T.cls[i] === 8) holes.setMatrixAt(hi++, m4);
    else { stars.setMatrixAt(si, m4); colors.set([T.col[i * 3] / 255, T.col[i * 3 + 1] / 255, T.col[i * 3 + 2] / 255], si * 3); si++; }
  }
  stars.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  stars.frustumCulled = holes.frustumCulled = false; scene.add(stars, holes);
  // the rest of the galaxy: one additive pixel each
  const fp = new Float32Array(F.n * 3), fc = new Float32Array(F.n * 3);
  for (let i = 0; i < F.n; i++) { fp.set([F.xyz[i * 3] / 6, F.xyz[i * 3 + 1] / 6, F.xyz[i * 3 + 2] / 6], i * 3); fc.set([F.col[i * 3] / 255, F.col[i * 3 + 1] / 255, F.col[i * 3 + 2] / 255], i * 3); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3)); fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
  const farPts = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  farPts.frustumCulled = false; scene.add(farPts);
  // the ship, riding ahead of the camera
  const rig = new THREE.Group(); scene.add(rig);
  const shipM = bakedMesh("ship"); shipM.userData.reveal(1e9); shipM.scale.setScalar(.06); shipM.rotation.x = -Math.PI / 2; shipM.position.set(0, -.25, -1.6); rig.add(shipM);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x202030, .9));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0x9fd0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8 }));
  glow.scale.setScalar(.5); glow.position.set(0, -.25, -1.05); rig.add(glow);
  const [x0, z0] = HYPER.start, R = HYPER.radius;     // the home system: GalaxyShape.homeSystem() of this galaxy, out on an arm's trailing edge
  const dir = new V3(-x0, 0, -z0).normalize(), side = new V3(-dir.z, 0, dir.x);
  // the system we just left, still lit: a glow on its cube that fades as the galaxy opens out
  const homeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  homeGlow.position.set(x0, 0, z0); scene.add(homeGlow);
  const cap = $("hyper-cap");
  const items = [
    { name: "The galaxy", text: "Millions of stars. Every one a system you can visit." },
    { name: "Hyperdrive", text: "Plot a course and jump across the galaxy." }
  ];
  let P = {}, R_;
  function layout() {
    const n = st.narrow, f = n ? 1.5 : 1;
    P.h = ["h-0", "h-1"].map(id => anchorP(sec, $(id)));
    R_ = rail([
      { p: 0, pos: [x0 + side.x * .6 - dir.x * 1.1, 1.3, z0 + side.z * .6 - dir.z * 1.1], look: [x0, 0, z0] },
      { p: P.h[1] * .25, pos: [x0 - dir.x * 40 * f, 70 * f, z0 - dir.z * 40 * f], look: [x0 + dir.x * 30, 0, z0 + dir.z * 30], ease: t => t * t * t },
      { p: P.h[1] * .75, pos: [R * .05, R * 1.3 * f, R * .25 + R * .7 * f], look: [0, 0, 0] },
      { p: P.h[1], pos: [x0 - dir.x * 30, 18, z0 - dir.z * 30], look: [x0 + dir.x * 60, 0, z0 + dir.z * 60], ease: t => t * t * (3 - 2 * t) },
      { p: 1, pos: [dir.x * -40, 6, dir.z * -40], look: [dir.x * 200, 0, dir.z * 200], ease: t => t }
    ]);
  }
  const look = new V3();
  function frame(dt, t, p) {
    R_(p, cam.position, look);
    cam.position.x += st.px * 2 * smooth(0, .1, p); cam.position.y += st.py * 1.5 * smooth(0, .1, p);
    cam.lookAt(look);
    cam.near = .02; cam.far = 20000; cam.updateProjectionMatrix();
    rig.position.copy(cam.position); rig.quaternion.copy(cam.quaternion);
    shipM.rotation.z = Math.sin(t * .8) * .05;
    rig.visible = p > P.h[1] * .97;
    const d = cam.position.distanceTo(homeGlow.position);
    homeGlow.scale.setScalar(Math.max(.5, d * .03)); homeGlow.material.opacity = .75 * (1 - smooth(.06, P.h[1] * .3, p));
    capSwap(cap, stepIndex(p, [0, P.h[1]]), items);
  }
  return { sec, scene, cam, layout, frame, sky: "hyper" };
}

/* =================================== THE FRONTIER (Option D, unchanged) =================================== */
function buildFrontier(secId, part) {
  const sec = $(secId);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1, .1, 400);
  scene.add(new THREE.AmbientLight(0x9b8ccc, .5)); scene.add(new THREE.HemisphereLight(0x2be0c8, 0x4a1f63, .35));
  const sun = new THREE.DirectionalLight(0xffd9c4, 1.2); sun.position.set(4, 3, 5); scene.add(sun);
  const Wd = [   // the order the landings come in: a hostile world, a Rapture world, Eden; the geometric world last
    ["r_hazard", [-2.8, .7, -7], 1.25, "Hostile world", "Toxic air · Acid rain · Radiation"], ["r_rapture", [5.6, -.9, -19], 1.05, "Rapture world", "Seas of blood · Ringed"],
    ["r_eden", [-3.4, 1.1, -28], 1.3, "Eden", "Breathable · Golden groves"], ["f_ocean", [3, .3, -39], 1.25, "Ocean world", "Breathable · Ringed"],
    ["f_gasring", [-2.4, -1.3, -50], 1.6, "Gas giant", "Toxic · Ringed"], ["f_gas", [3.6, 1.1, -61], 2.1, "Gas giant", "No air"],
    ["r_geometry", [0, 0, -76], 1.1, "Geometric world", "Toxic"]
  ];
  const worlds = Wd.map(([k, p, s, id, desc], i) => {
    const g = planet(k); g.position.set(...p); g.scale.multiplyScalar(s);
    if (g.userData.data.ring) g.rotation.set(.35 + i * .07, i * .5, -.2 + (i % 2) * .4);
    scene.add(g);
    const el = document.createElement("div"); el.className = "dlabel"; el.innerHTML = `<b>${id}</b><span>${desc}</span>`; labelsEl.appendChild(el);
    g.userData.el = el; return g;
  });
  const N = innerWidth < 720 ? 600 : 1100;
  const S = new Float32Array(N * 3), lp = new Float32Array(N * 6), lc = new Float32Array(N * 6);
  const cols = [new THREE.Color("#2be0c8"), new THREE.Color("#ff9ac8"), new THREE.Color("#ffc9a3")];
  const seed = (i, z0) => { const a = Math.random() * 6.283, r = 2.5 + Math.random() * 30; S[i * 3] = Math.cos(a) * r; S[i * 3 + 1] = Math.sin(a) * r * .7; S[i * 3 + 2] = z0 - Math.random() * 120; };
  for (let i = 0; i < N; i++) { seed(i, 10); const c = cols[i % 3]; lc.set([c.r, c.g, c.b, c.r * .05, c.g * .05, c.b * .05], i * 6); }
  const lg = new THREE.BufferGeometry(), la = new THREE.BufferAttribute(lp, 3); la.setUsage(THREE.DynamicDrawUsage);
  lg.setAttribute("position", la); lg.setAttribute("color", new THREE.BufferAttribute(lc, 3));
  const streaks = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  streaks.frustumCulled = false; scene.add(streaks);
  const sky = stars(1400, 90, 170, "#f6eeff", { alpha: .7 }); scene.add(sky);
  let R_, P = {};
  function layout() {
    const n = st.narrow;
    P.p1 = anchorP(sec, $("f-p1")); P.p2 = anchorP(sec, $("f-p2"));
    R_ = rail([
      { p: 0, pos: [0, 0, n ? 12 : 9], look: [n ? 0 : -1.6, n ? -1.2 : 0, -10] }, { p: P.p1, pos: [.6, .2, -16], look: [n ? 0 : 1.8, 0, -40] },
      { p: P.p2, pos: [-.6, -.2, -40], look: [0, 0, -70] }, { p: 1, pos: [0, 0, -66], look: [0, 0, -76] }
    ]);
  }
  const look = new V3(), wp = new V3(), tmp = new V3(); let lastZ = null, vz = 0;
  function frame(dt, t, p) {
    R_(p, cam.position, look);
    const z = cam.position.z, v = lastZ === null || dt <= 0 ? 0 : (z - lastZ) / dt; lastZ = z; vz += (v - vz) * (1 - Math.exp(-dt * 8));
    cam.position.x += st.px * .7; cam.position.y += st.py * .45; look.x += st.px * 1.2; look.y += st.py * .8; cam.lookAt(look);
    sky.userData.mat.uniforms.time.value = t; worlds.forEach(g => spinPlanet(g, RM ? 0 : dt, .14));
    const drift = RM ? 0 : -2.2 * dt, len = clamp(.06 + Math.abs(vz) * .09, .06, 14) * Math.sign(vz || -1);
    for (let i = 0; i < N; i++) {
      S[i * 3 + 2] += drift;
      if (S[i * 3 + 2] > z + 3) seed(i, z - 20); else if (S[i * 3 + 2] < z - 140) { seed(i, z + 2); S[i * 3 + 2] = z - Math.random() * 20; }
      const x = S[i * 3], y = S[i * 3 + 1], sz = S[i * 3 + 2];
      lp[i * 6] = x; lp[i * 6 + 1] = y; lp[i * 6 + 2] = sz; lp[i * 6 + 3] = x; lp[i * 6 + 4] = y; lp[i * 6 + 5] = sz + len;
    }
    la.needsUpdate = true; $("d-speed").textContent = (Math.abs(vz) * .37).toFixed(1);
    const hit = st.active ? pickHit(cam, worlds) : null;
    worlds.forEach(g => { const on = hit === g; g.userData.el.classList.toggle("on", on);
      if (on) { g.getWorldPosition(wp); const q = project(wp, cam, tmp); g.userData.el.style.transform = `translate(${q.x + 24}px, ${q.y}px) translateY(-50%)`; } });
  }
  function show(v) { labelsEl.querySelectorAll(".dlabel").forEach(e => e.style.display = v ? "" : "none"); }
  return { sec, scene, cam, layout, frame, show, sky: "front" };
}

/* =================================== the conductor =================================== */

/* Eden's aurora as AuroraSky draws one: several curtains, each a sheet standing between a hem and a crown along a wavy bowed line,
   coloured hem to crown, fading to nothing at top, bottom and ends, drawn additively with the aurora_rays texture, folds rolling. */
function auroraCurtains(scene, A) {
  const g = new THREE.Group(), r = BR.aurora, mats = [];
  for (let c = 0; c < A.curtains; c++) {
    const bear = -1.2 + c * 0.618 * 3.2 % 3.4, dist = 120 + ((c * 0.382) % 1) * 140, hem = 40 + c * 6, crown = hem + 70 + (c % 3) * 20, span = .9 + (c % 2) * .5;
    const COLS = 64, ROWS = 8, pos = [], uv = [], tt = [], ss = [], idx = [];
    for (let i = 0; i <= COLS; i++) for (let j = 0; j <= ROWS; j++) {
      const s0 = i / COLS, h = j / ROWS, ang = bear + (s0 - .5) * span;
      pos.push(Math.cos(ang) * dist, lerp(hem, crown, h), Math.sin(ang) * dist);
      uv.push((r[0] + s0 * r[2]) / BW, 1 - (r[1] + (1 - h) * r[3]) / BH); tt.push(h); ss.push(s0);
    }
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) { const a = i * (ROWS + 1) + j, b = a + ROWS + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("tt", new THREE.Float32BufferAttribute(tt, 1)); geo.setAttribute("ss", new THREE.Float32BufferAttribute(ss, 1)); geo.setIndex(idx);
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: BT }, time: { value: 0 }, lo: { value: new THREE.Color("#" + A.low) }, hi: { value: new THREE.Color("#" + A.high) }, ph: { value: c * 1.7 }, k: { value: A.strength } },
      vertexShader: `attribute float tt; attribute float ss; uniform float time; uniform float ph; varying float vT; varying float vS; varying vec2 vUv;
        void main(){ vT = tt; vS = ss; vUv = uv; vec3 p = position; float w = sin(ss * 9. + time * .35 + ph) * 6. + sin(ss * 23. - time * .8 + ph * 2.) * 2.;
          p.xz += normalize(p.xz) * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform sampler2D map; uniform float time; uniform vec3 lo; uniform vec3 hi; uniform float k; varying float vT; varying float vS; varying vec2 vUv;
        float sm(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t * t * t * (t * (t * 6. - 15.) + 10.); }
        void main(){ float a = sm(0., .33, vT) * (1. - sm(.33, 1., vT)) * sm(0., .2, vS) * (1. - sm(.8, 1., vS));
          float rays = texture2D(map, vUv).r; vec3 col = mix(lo, hi, pow(vT, .8));
          gl_FragColor = vec4(col, clamp(a * (.45 + .9 * rays) * k * .95, 0., 1.)); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    mats.push(m); g.add(new THREE.Mesh(geo, m));
  }
  scene.add(g);
  return t => mats.forEach(m => m.uniforms.time.value = t);
}
/* the other worlds of Eden's system, hanging in its sky as the game draws planets: cubes */
function sisterWorlds(scene) {
  const out = [];
  SISTERS.forEach((k, i) => {
    const g = planet(k), a = -1.6 + i * .7, el = .35 + (i % 3) * .22, d = 260 + (i % 2) * 120;
    g.position.set(Math.cos(a) * d * Math.cos(el), Math.sin(el) * d, Math.sin(a) * d * Math.cos(el)); g.scale.setScalar(6 + (i % 3) * 4);
    scene.add(g); out.push(g);
  });
  return dt => out.forEach(g => spinPlanet(g, RM ? 0 : dt, .03));
}
/* a Coagulus as the game rolls it (PileBody.of(seed, 4)): an opaque dried core a unit inside a translucent wet shell, every piece
   pulsing out of step with the others (+-7%) */
function coagulus(scene, pile, pos) {
  // pos is the top of the ground block it stands on; the pile's lowest layer rests there
  const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); scene.add(g);
  const CORE = BMAT, SHELL = new THREE.MeshLambertMaterial({ map: BT, transparent: true, opacity: .55, depthWrite: false });
  const parts = pile.map(pc => {
    const [cx, cy, cz, sx, sy, sz, m, phase] = pc;
    const holder = new THREE.Group(); holder.position.set(cx / 16, cy / 16, cz / 16);
    holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1));
    const core = new THREE.Mesh(blockGeo(all6("coag_core"), [Math.max(.06, (sx - 2) / 16), Math.max(.06, (sy - 2) / 16), Math.max(.06, (sz - 2) / 16)]), CORE);
    const shell = new THREE.Mesh(blockGeo(["coag_shell", "coag_shell", "coag_top", "coag_shell", "coag_shell", "coag_shell"], [sx / 16, sy / 16, sz / 16]), SHELL);
    holder.add(core, shell); g.add(holder);
    return { holder, phase };
  });
  return t => parts.forEach(({ holder, phase }) => holder.scale.setScalar(1 + (RM ? 0 : .07 * Math.sin(t * .9 + phase))));
}

const WORLD_LOOK = {
  eden: { tint: [.66, .74, .95], sky: ["0a1022"], css: "radial-gradient(ellipse 120% 80% at 50% 110%, #12305a 0%, #070c1c 55%, #03050c 100%)", hemi: [0x9fb8ff, 0x1a2a2a, .62], sun: [0xc8d8ff, .55], fog: null, stars: "#eef3ff", mote: 0xfff2c0, moteSize: .14,
    extra: scene => { const a = auroraCurtains(scene, AURORA), sw = sisterWorlds(scene); scene.userData.tick = (t, dt) => { a(t); sw(dt); }; }, camY: 20, lookY: 14,
    drift: () => [(Math.random() - .5) * .6, .15 + Math.random() * .3, (Math.random() - .5) * .6], angle: .6, title: "Eden",
    text: "The rarest worlds in the galaxy. Endless forests, golden apples, and the aurora.",
    air: "Breathable", skyText: "Night, with aurora", hazards: [] },
  rapture: { tint: [1, .86, .82], sky: ["2a0a0b"], css: "radial-gradient(ellipse at 50% 120%, #4a1012 0%, #120405 55%, #050102 100%)", hemi: [0xffb0a8, 0x3a1010, .55], sun: [0xffd0c0, .9], stars: "#ffd6d0",
    fog: null, mote: 0xff5a4a, moteSize: .14, drift: () => [(Math.random() - .5) * .3, .3 + Math.random() * .5, (Math.random() - .5) * .3], angle: 2.95, title: "Rapture worlds",
    extra: scene => { scene.userData.tick = coagulus(scene, COAG.pile, COAG.pos); }, focus: () => [COAG.pos[0], COAG.pos[1] + .9, COAG.pos[2]], dist: .2, camY: COAG.pos[1] + 7.5,
    text: "Seas of blood, giant fungi, and the Coaguli that crawl out of them.",
    air: "Breathable, and it is blood", skyText: "Starfield", hazards: ["Rapture III", "Corrosive IV", "Heat I"] },
  hazard: { tint: [1, .94, .86], sky: ["e6b49a"], css: "linear-gradient(#5b3426, #e6b49a 85%)", hemi: [0xffe6d4, 0x4a3226, .65], sun: [0xfff0e0, .9], fog: 0xd8a68c, mote: 0xb8e01a, moteSize: .1, rain: true, camY: 72, lookY: 22,
    drift: () => [0, -18, 0], angle: 4.0, title: "Hostile worlds",
    text: "Toxic air, acid rain, radiation. Come prepared.",
    air: "Toxic", skyText: "Fog", hazards: ["Toxic III", "Heat II", "Corrosive II", "Radiation II"] },
  geometry: { sky: ["000000"], css: "radial-gradient(ellipse at 50% 40%, #1d0f2e 0%, #05030a 70%)", hemi: [0xf0e4ff, 0x302040, .8], sun: [0xfff0f8, .9], stars: "#f6eeff", fog: null,
    mote: 0xe1a4fc, moteSize: .2, drift: () => [(Math.random() - .5) * .4, (Math.random() - .5) * .4, (Math.random() - .5) * .4], angle: 5.0, dist: 2.6, camY: 60, lookY: 0, noCard: true,
    motes: false, extra: scene => { scene.background = radialSky("#05030a", .5, .4, .71, .85, [[0, "#1d0f2e"], [.7, "#05030a"]]); [[[-52, 36, 28], 10], [[60, -44, -36], 6.5]].forEach(([p, r]) => { const h = blackHole(r); h.position.set(...p); scene.add(h); }); },
    kicker: "Landing 4 of 4", title: "A geometric world",
    text: "No ground at all: cubes, tetrahedra, octahedra, spheres and tori hanging in an empty sky, of adamant and chert, iron, lapis and collapsium, with a patch of grass on one of them.",
    air: "Toxic", skyText: "Starfield", hazards: ["Heat IV", "Static III", "Radiation III", "Toxic III"] }
};
/* the Journey: Earth → the pad → the system → the hyperdrive map → the Frontier → three surfaces → the end.
   Every scene is built when it is first needed (or a moment before, in a spare frame), never all at boot: a phone pays only for the
   opening shot before the page can be scrolled. Scenes that draw baked models also wait for journey.txt, which loads behind the hero. */
let SYS = null;
const sysOf = () => SYS || (SYS = buildSystem());
function lazy(id, sky, make, needsPack) {
  const w = { sec: $(id), sky, s: null };
  w.ready = () => {
    if (w.s) return true;
    if (needsPack && !JPACK) return false;
    w.s = make(); w.s.cam.aspect = innerWidth / innerHeight; w.s.cam.updateProjectionMatrix(); w.s.layout();
    return true;
  };
  w.show = v => w.s && w.s.show && w.s.show(v);
  return w;
}
const VIEWS = {
  journey: {
    stages: [lazy("earth", "", () => sysOf().earth), lazy("site", "site", () => buildSite(), true), lazy("system", "", () => sysOf().system),
      lazy("hyper", "hyper", () => buildHyper(), true), lazy("frontier", "front", () => buildFrontier("frontier", "a")),
      lazy("w-hazard", "world", () => buildWorld("hazard", WORLD_LOOK.hazard), true), lazy("w-rapture", "world", () => buildWorld("rapture", WORLD_LOOK.rapture), true),
      lazy("w-eden", "world", () => buildWorld("eden", WORLD_LOOK.eden), true), lazy("w-geometry", "world", () => buildWorld("geometry", WORLD_LOOK.geometry), true)],
    names: ["sys", "site", "sys", "hyper", "front", "world", "world", "world", "world"],
    // the colour each hand-over passes through: into Earth's face is into its sky; space to space is black; a jump is a flash
    fade: [null, "#dbeaff", "#000", "#000", "#e9f3ff", "#e9f3ff", "#e9f3ff", "#e9f3ff", "#e9f3ff"],
    y: 0
  },
  updates: { stages: [], names: [], fade: [], y: 0, ready: false }
};
let view = "journey", cur = -1;
const sp = new Map();
const fadeEl = $("fade"), skyEl = $("sky"), loadEl = $("u-load");
function resize() {
  st.narrow = innerWidth < 720;
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, st.narrow ? 1.5 : 2)); R.setSize(innerWidth, innerHeight, false);
  VIEWS[view].stages.forEach(w => { if (!w.s) return; w.s.cam.aspect = innerWidth / innerHeight; w.s.cam.updateProjectionMatrix(); w.s.layout(); });
}
addEventListener("resize", resize);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
addEventListener("load", resize);
document.querySelectorAll('a.btn[href="#download"]').forEach(a => a.addEventListener("click", e => e.preventDefault()));
// touch: a tap points, the way hovering does with a mouse
addEventListener("pointerdown", e => { if (e.pointerType === "touch") { ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; st.active = true; clearTimeout(st.tap); st.tap = setTimeout(() => st.active = false, 2400); } }, { passive: true });

function ensureUpdates() {
  const U = VIEWS.updates;
  if (U.ready || U.loading) return;
  U.loading = true; loadEl.hidden = false; loadEl.textContent = "Loading…";
  updLoad().then(D => {
    U.stages = [lazy("u-10", "site", () => buildCore(D)), lazy("u-11", "site", () => buildSite({ sec: "u-11", industry: true })),
      lazy("u-12", "front", () => buildFrontierShow()), lazy("u-13", "hyper", () => buildEncounters(D))];
    U.names = ["site", "site", "front", "hyper"]; U.fade = [null, "#000", "#000", "#000"];
    U.ready = true; loadEl.hidden = true;
    if (view === "updates") { cur = -1; resize(); }
  }).catch(err => { loadEl.textContent = "Could not load this tab's scenes."; console.error(err); U.loading = false; });
}
function setView(v, fromHash) {
  if (v === view) return;
  VIEWS[view].y = scrollY;
  VIEWS[view].stages.forEach(s => s.show && s.show(false));
  labelsEl.querySelectorAll(".plabel, .dlabel").forEach(e => e.style.opacity = 0);
  view = v; cur = -1;
  $("journey").hidden = v !== "journey"; $("updates").hidden = v !== "updates";
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (v === "updates") ensureUpdates();
  resize();
  if (!fromHash) history.replaceState(null, "", "#" + v);
  scrollTo(0, VIEWS[v].y);
}
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
function route() {
  const h = location.hash;
  if (h === "#updates" || /^#u-/.test(h)) { setView("updates", true); if (/^#u-/.test(h)) { const el = document.querySelector(h); el && el.scrollIntoView(); } }
  else if (h === "#journey" || h === "") setView("journey", true);
}
addEventListener("hashchange", route);

/* ---- the player: the Journey scrolls itself, chapter by chapter, at a set pace; nobody has to scroll ----
   It drives the page's own scroll position, so every scene, caption and hand-over runs exactly as it was built. Each chapter runs
   from its section's top to the next section's top (the hand-over included). Manual scrolling is off on the Journey. */
const PLAYER = { on: false, started: false, t: 0,
  D: [7, 22, 36, 18, 13, 10, 10, 10, 11],          // seconds a chapter: Earth, the starship, the system, the galaxy, the Frontier, three worlds, the end
  names: ["Earth", "Your starship", "The solar system", "The galaxy", "The Frontier", "Hostile worlds", "Rapture worlds", "Eden", "What will you discover?"] };
const ppEl = $("pp"), trackEl = $("track"), fillEl = $("fill"), playerEl = $("player");
const TOTAL = PLAYER.D.reduce((a, b) => a + b, 0);
function chapterStart(i) { return PLAYER.D.slice(0, i).reduce((a, b) => a + b, 0); }
$("ticks").innerHTML = PLAYER.names.map((n, i) => `<i style="left:${(chapterStart(i) / TOTAL * 100).toFixed(2)}%" title="${n}"></i>`).join("");
function yAt(t) {
  const S = VIEWS.journey.stages, end = document.documentElement.scrollHeight - innerHeight;
  let a = 0;
  for (let i = 0; i < S.length; i++) {
    const y0 = S[i].sec.offsetTop, y1 = i < S.length - 1 ? S[i + 1].sec.offsetTop : end, d = PLAYER.D[i];
    if (t <= a + d || i === S.length - 1) return Math.min(end, y0 + (y1 - y0) * clamp((t - a) / d));
    a += d;
  }
  return end;
}
function setPlaying(on) {
  PLAYER.on = on; ppEl.classList.toggle("paused", !on); ppEl.setAttribute("aria-label", on ? "Pause" : "Play");
}
function startJourney(from = 0) {
  PLAYER.started = true; PLAYER.t = from; playerEl.hidden = false; setPlaying(true);
}
function seek(t) { PLAYER.t = clamp(t, 0, TOTAL); scrollTo(0, yAt(PLAYER.t)); }
$("play").addEventListener("click", () => startJourney(0));
$("replay").addEventListener("click", () => startJourney(0));
ppEl.addEventListener("click", () => { if (PLAYER.t >= TOTAL) startJourney(0); else setPlaying(!PLAYER.on); });
function trackAt(e) { const r = trackEl.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * TOTAL; }
trackEl.addEventListener("pointerdown", e => { trackEl.setPointerCapture(e.pointerId); seek(trackAt(e)); trackEl.dataset.drag = "1"; });
trackEl.addEventListener("pointermove", e => { if (trackEl.dataset.drag) seek(trackAt(e)); });
trackEl.addEventListener("pointerup", () => { delete trackEl.dataset.drag; });
const chapterOf = t => { let i = 0; while (i < PLAYER.D.length - 1 && t >= chapterStart(i + 1)) i++; return i; };
addEventListener("keydown", e => {
  if (view !== "journey" || !PLAYER.started || /input|textarea/i.test(e.target.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); ppEl.click(); }
  else if (e.code === "ArrowRight") { e.preventDefault(); seek(chapterStart(Math.min(PLAYER.D.length - 1, chapterOf(PLAYER.t) + 1))); }
  else if (e.code === "ArrowLeft") { e.preventDefault(); const i = chapterOf(PLAYER.t); seek(chapterStart(PLAYER.t - chapterStart(i) > 2 ? i : Math.max(0, i - 1))); }
});
// no manual scrolling on the Journey: wheel, touch and scroll keys do nothing there (the Updates tab still scrolls)
const noScroll = e => { if (view === "journey") e.preventDefault(); };
addEventListener("wheel", noScroll, { passive: false });
addEventListener("touchmove", e => { if (view === "journey" && !e.target.closest("#track")) e.preventDefault(); }, { passive: false });
addEventListener("keydown", e => { if (view === "journey" && ["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.code)) e.preventDefault(); });
function playerTick(dt) {
  HTML.classList.toggle("lock", view === "journey");
  if (view !== "journey") { if (PLAYER.on) setPlaying(false); return; }
  if (PLAYER.on) { PLAYER.t += dt; if (PLAYER.t >= TOTAL) { PLAYER.t = TOTAL; setPlaying(false); } scrollTo(0, yAt(PLAYER.t)); }
  else if (!PLAYER.started && scrollY !== 0) scrollTo(0, 0);
  const f = PLAYER.t / TOTAL; fillEl.style.width = (f * 100).toFixed(2) + "%"; trackEl.setAttribute("aria-valuenow", Math.round(f * 100));
  const name = PLAYER.names[chapterOf(PLAYER.t)]; if ($("chap").textContent !== name) { $("chap").textContent = name; trackEl.setAttribute("aria-valuetext", name); }
}
resize(); route();

const clock = new THREE.Clock(); let T = 0;
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 1 / 20); T += dt;
  // the player keeps wall-clock time (a slow device drops frames, it does not stretch the film); capped so a background tab cannot jump
  const now = performance.now(), rdt = Math.min(.25, (now - (loop.last || now)) / 1000); loop.last = now; playerTick(rdt);
  const V = VIEWS[view], stages = V.stages;
  if (!stages.length) { R.setRenderTarget(null); R.clear(); return; }
  const mid = scrollY + innerHeight * .5;
  let k = 0; stages.forEach((w, i) => { if (w.sec.offsetTop <= mid) k = i; });
  stages.forEach(w => {
    const raw = clamp((scrollY - w.sec.offsetTop) / Math.max(1, w.sec.offsetHeight - innerHeight));
    const v = sp.has(w) ? sp.get(w) : raw;
    sp.set(w, v + (raw - v) * (RM ? 1 : 1 - Math.exp(-rdt * 5)));     // real time, like the player: a slow device lags no further behind it
  });
  const w = stages[k], ok = w.ready();
  if (k !== cur || (ok && w.shown !== true)) {
    stages.forEach((o, i) => i !== k && o.show(false) && 0);
    stages.forEach((o, i) => { if (i !== k) o.shown = false; });
    cur = k; HTML.dataset.stage = V.names[k];
    skyEl.className = w.sky === "world" ? "" : w.sky || "";
    if (ok) { w.show(true); w.shown = true; }
  }
  const vh = innerHeight; let fade = 0, col = "#000";
  for (let i = 1; i < stages.length; i++) {
    const c = V.fade[i]; if (!c) continue;
    const f = 1 - Math.min(Math.abs(mid - stages[i].sec.offsetTop) / (vh * .4), 1);
    if (f > fade) { fade = f; col = c; }
  }
  fadeEl.style.background = col;
  fadeEl.style.opacity = (col === "#000" ? fade : fade * .92).toFixed(3);
  const tx = st.active ? ndc.x : 0, ty = st.active ? ndc.y : 0;
  st.px += (tx - st.px) * (RM ? 0 : 1 - Math.exp(-dt * 3)); st.py += (ty - st.py) * (RM ? 0 : 1 - Math.exp(-dt * 3));
  if (ok) { w.s.frame(dt, T, sp.get(w)); LENS.render(w.s.scene, w.s.cam); }
  else { R.setRenderTarget(null); R.clear(); }
  // one scene a frame, ahead of the reader: the next two are built before they are scrolled to
  if (ok) for (const j of [k + 1, k + 2, k - 1]) { const n = stages[j]; if (n && !n.s && n.ready()) break; }
}
loop();
