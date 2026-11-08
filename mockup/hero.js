/* ---------------- the opening shot, on its own and first (principal 2026-11-08: "load the starting part of the site's elements
   separately from the rest, and much faster") ----------------
   Everything that shows before Start is pressed: Earth, Luneus, the stars, the sun's glow, the stardust. Its art is one 47 KB image
   (hero.webp: the two planets' nets, native size) and HERO, inlined in the page. It draws on its own canvas the moment that image
   lands, while the rest of the site (about 4 MB) is still to be fetched; boot.js starts that fetch only after this has drawn, so the
   two never compete. When the full site has drawn its first frame, heroDone() crossfades this canvas away. The camera, positions,
   spin and orbit are the system scene's own (stages.js buildSystem), and the hand-over passes Earth's spin and the clock across,
   so nothing jumps. */
const HEROSTATE = { t: 0, earthRot: 0, done: false };
function startHero(img) {
  const cv = document.createElement("canvas"); cv.id = "hero-gl"; cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;z-index:1;transition:opacity .7s cubic-bezier(.4,0,.2,1)";
  document.getElementById("gl").after(cv);
  const narrow = () => innerWidth < 720;
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
  R.outputEncoding = THREE.sRGBEncoding; R.setClearColor(0, 0);
  // the two nets at x2, nearest, gutters extruded: the same picture the full sheet gives these two planets
  const G = 8, S = 2, W = 1024 + 2 * G, H = 1024 + 4 * G, c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const x = c2.getContext("2d"); x.imageSmoothingEnabled = false; const rect = {};
  Object.entries(HERO.rects).forEach(([n, [sx, sy, sw, sh]], i) => {
    const px = G, py = G + i * (sh * S + 2 * G), w = sw * S, h = sh * S;
    x.drawImage(img, sx, sy, sw, sh, px, py, w, h);
    x.drawImage(img, sx, sy, sw, 1, px, py - G, w, G); x.drawImage(img, sx, sy + sh - 1, sw, 1, px, py + h, w, G);
    x.drawImage(c2, px, py - G, 1, h + 2 * G, 0, py - G, G, h + 2 * G); x.drawImage(c2, px + w - 1, py - G, 1, h + 2 * G, px + w, py - G, G, h + 2 * G);
    rect[n] = { u0: px / W, u1: (px + w) / W, v0: 1 - (py + h) / H, v1: 1 - py / H };
  });
  const tex = new THREE.CanvasTexture(c2); tex.encoding = THREE.sRGBEncoding; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = R.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  function net(stem) {
    const r = rect[stem], g = new THREE.BoxGeometry(2, 2, 2), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const e = .5, s = v => e + (v + 1) / 2 * (128 - 2 * e), L = (a, b, t) => a + (b - a) * t;
    for (let i = 0; i < P.count; i++) {
      const X = P.getX(i), Y = P.getY(i), Z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i); let px, py;
      if (nz > .5) { px = 128 + s(X); py = 128 + s(-Y); } else if (nx > .5) { px = 256 + s(-Z); py = 128 + s(-Y); }
      else if (nz < -.5) { px = 384 + s(-X); py = 128 + s(-Y); } else if (nx < -.5) { px = s(Z); py = 128 + s(-Y); }
      else if (ny > .5) { px = 128 + s(X); py = s(Z); } else { px = 256 + s(X); py = s(-Z); }
      U.setXY(i, L(r.u0, r.u1, px / 512), L(r.v1, r.v0, py / 256));
    }
    return new THREE.Mesh(g, mat);
  }
  const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const q = c.getContext("2d");
    q.shadowColor = "#fff"; q.shadowBlur = 46; q.fillStyle = "#fff"; const r = 20, a = 70, b = 186;
    q.beginPath(); q.moveTo(a + r, a); q.lineTo(b - r, a); q.quadraticCurveTo(b, a, b, a + r); q.lineTo(b, b - r); q.quadraticCurveTo(b, b, b - r, b);
    q.lineTo(a + r, b); q.quadraticCurveTo(a, b, a, b - r); q.lineTo(a, a + r); q.quadraticCurveTo(a, a, a + r, a); q.fill(); q.fill();
    return new THREE.CanvasTexture(c); })();
  const round = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const q = c.getContext("2d");
    const g = q.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.3, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    q.fillStyle = g; q.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .05, 5000);
  scene.add(new THREE.AmbientLight(0x6f86c9, .42)); scene.add(new THREE.PointLight(0xfff1dc, 1.35, 0));
  // stars, as stages.js does them
  const n = 3000, sp = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u), r = 600 + Math.random() * 600;
    sp.set([s * Math.cos(th) * r, u * r, s * Math.sin(th) * r], i * 3); sz[i] = Math.random() < .06 ? 3 + Math.random() * 1.5 : 1 + Math.random() * 1.4; ph[i] = Math.random() * 6.283; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("size", new THREE.BufferAttribute(sz, 1)); sg.setAttribute("phase", new THREE.BufferAttribute(ph, 1));
  const sm = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, color: { value: new THREE.Color("#cfe0ff") }, pr: { value: 1 } },
    vertexShader: `attribute float size; attribute float phase; uniform float time; uniform float pr; varying float vTw; void main(){ vTw = .55 + .45 * sin(time * 1.3 + phase); gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 color; varying float vTw; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(color, a * a * vTw); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const stars = new THREE.Points(sg, sm); stars.frustumCulled = false; scene.add(stars);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: round, color: 0xffa860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 }));
  corona.scale.setScalar(26); scene.add(corona);
  // the planets' dashed orbits, as buildSystem draws them (the planets themselves are out of this shot)
  [[-26, 20], [34, 16], [-8, -38], [46, -30], [-60, 34], [14, 62]].forEach(([px, pz]) => {
    const r = Math.hypot(px, pz), pts = [];
    for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x7fb2ff, dashSize: 1.2, gapSize: .9, transparent: true, opacity: .28 }));
    ln.computeLineDistances(); scene.add(ln);
  });
  // Earth and Luneus where buildSystem puts them
  const OW = new THREE.Vector3(-26, 0, 20);
  const earth = new THREE.Group(), body = new THREE.Group(); earth.add(body); body.add(net(HERO.planets.overworld.stem));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(HERO.planets.overworld.glow), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .62 }));
  glow.scale.setScalar(3.5); earth.add(glow); earth.scale.multiplyScalar(1.2); earth.position.copy(OW); scene.add(earth);
  const moon = new THREE.Group(), mbody = new THREE.Group(); moon.add(mbody); mbody.add(net(HERO.planets.luneus.stem)); moon.scale.multiplyScalar(.34); scene.add(moon);
  // the stardust, falling toward the cursor
  const N = innerWidth < 720 ? 1400 : 3200;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), warm = new Float32Array(N);
  const rad = new Float32Array(N), ang = new Float32Array(N), spd = new Float32Array(N), basis = new Float32Array(N * 6), off = new Float32Array(N * 3);
  const ta = new THREE.Vector3(), tb = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    rad[i] = (1.7 + Math.pow(Math.random(), 1.6) * 3.4) * 1.2; ang[i] = Math.random() * 6.283;
    spd[i] = (.35 + Math.random() * .25) / Math.pow(rad[i] / 1.2, 1.5) * (Math.random() < .5 ? 1 : -1) * 2.2;
    ta.set(Math.random() - .5, (Math.random() - .5) * .35, Math.random() - .5).normalize(); tb.set(0, 1, 0).cross(ta).normalize();
    if (Math.random() < .3) tb.applyAxisAngle(ta, (Math.random() - .5) * 1.2);
    basis.set([ta.x, ta.y, ta.z, tb.x, tb.y, tb.z], i * 6);
    size[i] = Math.random() < .05 ? 4.5 : 1.2 + Math.random() * 1.8; phase[i] = Math.random() * 6.283; warm[i] = Math.random() < .07 ? 1 : 0;
  }
  const dg = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
  dg.setAttribute("position", pa); dg.setAttribute("size", new THREE.BufferAttribute(size, 1)); dg.setAttribute("phase", new THREE.BufferAttribute(phase, 1)); dg.setAttribute("warm", new THREE.BufferAttribute(warm, 1));
  const dm = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, pr: { value: 1 }, cA: { value: new THREE.Color("#7fb2ff") }, cB: { value: new THREE.Color("#ffb870") } },
    vertexShader: `attribute float size; attribute float phase; attribute float warm; uniform float time; uniform float pr; varying float vTw; varying float vWarm;
      void main(){ vWarm = warm; vTw = .45 + .55 * pow(.5 + .5 * sin(time * 2.6 + phase), 3.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * pr * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cA; uniform vec3 cB; varying float vTw; varying float vWarm;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a *= a; gl_FragColor = vec4(mix(cA, cB, vWarm) * (1. + vTw * .6), a * vTw); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dg, dm); dust.frustumCulled = false; scene.add(dust);
  const ndc = { x: 0, y: 0 }; let active = false, px = 0, py = 0;
  addEventListener("pointermove", e => { if (HEROSTATE.done) return; ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; active = e.pointerType !== "touch" || e.buttons > 0; }, { passive: true });
  function size_() {
    const pr = Math.min(devicePixelRatio || 1, narrow() ? 1.5 : 2); R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); sm.uniforms.pr.value = pr; dm.uniforms.pr.value = pr;
  }
  addEventListener("resize", size_); size_();
  const look = new THREE.Vector3(), tmp = new THREE.Vector3(), dir = new THREE.Vector3(), Wc = new THREE.Vector3();
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now();
  function frame() {
    if (HEROSTATE.done) return;
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; if (document.hidden) return;
    const t = (HEROSTATE.t += dt), a = RM ? 0 : dt;
    // the hero pose of the system scene's opening rail (stages.js, RA at p = 0)
    if (narrow()) { cam.position.set(OW.x, OW.y + .3, OW.z + 9.5); look.set(OW.x, OW.y + 1.2, OW.z); }
    else { cam.position.set(OW.x - .6, OW.y + .4, OW.z + 6.2); look.set(OW.x - 1.35, OW.y, OW.z); }
    const k = RM ? 0 : 1 - Math.exp(-dt * 3); px += ((active ? ndc.x : 0) - px) * k; py += ((active ? ndc.y : 0) - py) * k;
    cam.position.x += px * .3; cam.position.y += py * .22; cam.lookAt(look);
    sm.uniforms.time.value = t; dm.uniforms.time.value = t;
    body.rotation.y += .08 * a; HEROSTATE.earthRot = body.rotation.y; mbody.rotation.y += .08 * a;
    moon.position.set(OW.x + Math.cos(t * .25) * 3.2, OW.y + .4, OW.z + Math.sin(t * .25) * 3.2);
    let pull = 0;
    if (active) { tmp.set(ndc.x, ndc.y, .5).unproject(cam); dir.copy(tmp).sub(cam.position).normalize(); Wc.copy(cam.position).addScaledVector(dir, (OW.z - cam.position.z) / dir.z); pull = 1; }
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
    R.render(scene, cam);
  }
  frame();
  // the full site has drawn: fade this out under it, then let its GPU memory go
  window.heroDone = () => {
    if (HEROSTATE.done) return; HEROSTATE.done = true;
    cv.style.opacity = "0";
    setTimeout(() => { R.dispose(); tex.dispose(); R.forceContextLoss(); cv.remove(); }, 900);
  };
}
