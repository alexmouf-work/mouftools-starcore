/* =================================== THE UPDATES TAB =================================== */
/* Its geometry is fetched the first time the tab opens: real dumps (an Overworld patch, a mini cluster, an asteroid field, a Lab
   station) and the sky planets PlanetFeature builds, baked and packed like the Journey's (see quadGeo), on the same texture sheet. */
let UPD = null, CREP = null, CRE = null;
// the creatures, shared by both tabs: fetched once, by whichever wants them first (CRE is set when they land)
function creLoad() {
  if (!CREP) CREP = Promise.all([getOk("creatures.json").then(r => r.json()), loadImg("creatures.webp")]).then(([data, img]) => (CRE = { data, img }));
  return CREP;
}
function updLoad() {
  if (!UPD) UPD = Promise.all([getOk("updates.json").then(r => r.json()), inflate("updates.txt"), creLoad()])
    .then(([meta, bin, cre]) => Object.assign(quadPack(meta, bin), { creatures: cre }));
  return UPD;
}
function updMesh(D, gname, mats) { return quadMesh(D, gname, mats); }
function updMats(D, fog, near, far, bright = 1) { return quadMats({ fog, near, far, tint: [bright, bright, bright] }); }

/* a player in ordinary clothes: no suit, no helmet (the Core Update is the Overworld) */
function plainPlayer(shirt, trousers) {
  const root = new THREE.Group(), px = v => v / 16;
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const skin = M(0xc9926c), hair = M(0x4a3426), sh = M(shirt), tr = M(trousers), shoe = M(0x3b3b44);
  const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(px(w), px(h), px(d)), mat); m.position.set(px(x), px(y), px(z)); parent.add(m); return m; };
  const limb = (x, y, legs) => {
    const g = new THREE.Group(); g.position.set(px(x), px(y), 0); root.add(g);
    if (legs) { box(4, 9, 4, tr, 0, -4.5, 0, g); box(4, 3, 4, shoe, 0, -10.5, 0, g); }
    else { box(4, 5, 4, sh, 0, -2.5, 0, g); box(4, 7, 4, skin, 0, -8.5, 0, g); }
    return g;
  };
  const legL = limb(-2, 12, true), legR = limb(2, 12, true), armL = limb(-6, 24, false), armR = limb(6, 24, false);
  box(8, 12, 4, sh, 0, 18, 0, root);
  const head = new THREE.Group(); head.position.set(0, px(24), 0); root.add(head);
  const h = new THREE.Mesh(new THREE.BoxGeometry(px(8), px(8), px(8)), [skin, skin, hair, skin, new THREE.MeshLambertMaterial({ map: FACE }), hair]); h.position.y = px(4); head.add(h);
  root.userData = { armL, armR, legL, legR, head, tool: armR };
  return root;
}

/* ---- 1.0 The Core Update: planets in the Overworld sky, with real gravity, and nobody needs a suit ---- */
function buildCore(D) {
  const sec = $("u-10"), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .1, 1000);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x5a6a4a, .85)); const sun = new THREE.DirectionalLight(0xfff3dc, .5); sun.position.set(20, 40, 10); scene.add(sun);
  const mats = updMats(D, 0xbcd6f5, 80, 220);
  const ground = updMesh(D, "ow", mats); scene.add(ground);
  const SP = new V3(-5, 30, 3), HP = new V3(17, 41, -16);
  const solid = updMesh(D, "sky_solid", mats); solid.position.copy(SP); scene.add(solid);
  const hollow = updMesh(D, "sky_hollow", mats); hollow.position.copy(HP); scene.add(hollow);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROUNDGLOW, color: 0xffc04a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  // two players mining the same planet: one on top, one hanging under it the right way up for them
  const r = 11.5;
  const top = plainPlayer(0xe0883a, 0x4b4b55); top.position.set(SP.x, SP.y + r, SP.z); top.rotation.y = .9; scene.add(top);
  const under = plainPlayer(0xd65a4a, 0x3a3a4a); under.position.set(SP.x, SP.y - r, SP.z); under.rotation.set(0, -.6, Math.PI); scene.add(under);
  const walker = plainPlayer(0x8a5cc8, 0x6b4f2e); walker.position.set(6, 1.02, 9); walker.rotation.y = -2.4; scene.add(walker);
  const crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x0a0a0e, transparent: true, opacity: 0, depthWrite: false }));
  crack.position.set(SP.x + Math.round(Math.sin(.9) * 1.2), SP.y + 10, SP.z + Math.round(Math.cos(.9) * 1.2)); scene.add(crack);
  scene.add(glow);
  let R_; const look = new V3();
  function layout() {
    const f = st.narrow ? 1.5 : 1;
    R_ = rail([
      { p: 0, pos: [44 * f, 34, 58 * f], look: [0, 24, 0] },
      { p: .42, pos: [SP.x + 30 * f, SP.y + 8, SP.z + 24 * f], look: [SP.x, SP.y, SP.z] },
      { p: .72, pos: [SP.x + 3.5 * f, SP.y + r + 2.2, SP.z + 6 * f], look: [SP.x + (st.narrow ? 0 : -1.2), SP.y + r + .6, SP.z] },
      { p: .82, pos: [SP.x + 3.5 * f, SP.y + r + 2.2, SP.z + 6 * f], look: [SP.x + (st.narrow ? 0 : -1.2), SP.y + r + .6, SP.z] },
      { p: 1, pos: [SP.x + 3.5 * f, SP.y - r - 2.4, SP.z + 6 * f], look: [SP.x + (st.narrow ? 0 : -1.2), SP.y - r - .6, SP.z] }
    ]);
  }
  let swing = 0, stage = 0;
  function frame(dt, t, p) {
    R_(p, cam.position, look); cam.position.x += st.px * 1.2; cam.position.y += st.py;
    cam.lookAt(look); nearFar(cam, look);
    const a = RM ? 0 : dt; swing += a * 9; stage = (stage + a * .8) % 1;
    top.userData.armR.rotation.x = -1.3 + Math.sin(swing) * .5; under.userData.armR.rotation.x = -1.3 + Math.sin(swing + 1.3) * .5;
    crack.material.opacity = stage * .5;
    const w = (RM ? 0 : t) * 1.6; walker.userData.legL.rotation.x = Math.sin(w * 3) * .5; walker.userData.legR.rotation.x = -Math.sin(w * 3) * .5;
    walker.userData.armL.rotation.x = -Math.sin(w * 3) * .4; walker.userData.armR.rotation.x = Math.sin(w * 3) * .4;
  }
  function show(v) { $("sky").style.setProperty("--sky-top", v ? "#6aa6e8" : ""); $("sky").style.setProperty("--sky-bottom", v ? "#d6e8ff" : ""); }
  return { sec, scene, cam, layout, frame, show, sky: "site" };
}

/* ---- 1.2 The Frontier Update: real worlds of one galaxy, turning past ---- */
function buildFrontierShow() {
  const sec = $("u-12"), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 400);
  scene.add(new THREE.AmbientLight(0x9b8ccc, .55)); scene.add(new THREE.HemisphereLight(0x2be0c8, 0x4a1f63, .35));
  const sun = new THREE.DirectionalLight(0xffd9c4, 1.2); sun.position.set(4, 3, 5); scene.add(sun);
  scene.add(stars(1200, 60, 140, "#f6eeff", { alpha: .8 }));
  const list = [["r_eden", "Eden"], ["r_rapture", "Rapture world"], ["r_hazard", "Hostile world"], ["f_ocean", "Ocean world"], ["r_geometry", "Geometric world"], ["f_gasring", "Gas giant"], ["f_gas", "Gas giant"]];
  const RAD = 5.6, ring = new THREE.Group(); scene.add(ring);
  const worlds = list.map(([k, name], i) => {
    const g = planet(k), a = i / list.length * Math.PI * 2; g.position.set(Math.sin(a) * RAD, 0, Math.cos(a) * RAD); g.scale.multiplyScalar(k.startsWith("f_gas") ? 1.05 : .85);
    if (g.userData.data.ring) g.rotation.set(.35 + i * .07, i * .5, -.2);
    ring.add(g);
    const el = document.createElement("div"); el.className = "dlabel ulabel"; el.innerHTML = `<b>${name}</b>`; labelsEl.appendChild(el); g.userData.el = el;
    return g;
  });
  let R_; const look = new V3(), wp = new V3(), tmp = new V3();
  function layout() { const f = st.narrow ? 1.6 : 1; R_ = rail([{ p: 0, pos: [0, 2.2, 19 * f], look: [st.narrow ? 0 : -2.2, st.narrow ? -1.4 : 0, RAD - 3] }, { p: 1, pos: [0, 1.8, 18 * f], look: [st.narrow ? 0 : -2.2, st.narrow ? -1.4 : 0, RAD - 3] }]); }
  function frame(dt, t, p) {
    R_(p, cam.position, look); cam.position.x += st.px * .6; cam.position.y += st.py * .4; cam.lookAt(look);
    ring.rotation.y = -p * Math.PI * 2 * (list.length - 1) / list.length;
    worlds.forEach(g => {
      spinPlanet(g, RM ? 0 : dt, .2); g.getWorldPosition(wp);
      const front = smooth(RAD * .55, RAD * .95, wp.z), q = project(wp, cam, tmp);
      g.userData.el.style.opacity = front.toFixed(3); g.userData.el.classList.toggle("on", front > .05);
      g.userData.el.style.transform = `translate(${q.x}px, ${q.y + (st.narrow ? 46 : 64)}px) translateX(-50%)`;
    });
  }
  function show(v) { labelsEl.querySelectorAll(".ulabel").forEach(e => e.style.display = v ? "" : "none"); }
  return { sec, scene, cam, layout, frame, show, sky: "front" };
}

/* ---- 1.3 The Encounters Update: deep space between the planets ---- */
function buildEncounters(D) {
  const sec = $("u-13"), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .5, 6000);
  const sky = stars(2600, 1500, 3000, "#e6ecff"); scene.add(sky); scene.background = new THREE.Color(0);
  const mats = updMats(D, 0x000000, 1e5, 2e5, .95);
  const CL = new V3(-170, 0, 0), STN = new V3(180, 10, -40), AST = new V3(10, 30, -300), BH = new V3(80, 90, -700);
  const cluster = updMesh(D, "cluster", mats); cluster.position.copy(CL); scene.add(cluster);
  const station = updMesh(D, "station", mats); station.position.copy(STN); scene.add(station);
  const rocks = updMesh(D, "asteroids", mats); rocks.position.copy(AST); scene.add(rocks);
  const hole = blackHole(34); hole.position.copy(BH); scene.add(hole);
  let R_; const look = new V3();
  function layout() {
    const f = st.narrow ? 1.5 : 1;
    R_ = rail([
      { p: 0, pos: [0, 110 * f, 290 * f], look: [0, 0, -120] },
      { p: .28, pos: [CL.x + 45, 50, CL.z + 140 * f], look: [CL.x, CL.y, CL.z] },
      { p: .52, pos: [STN.x + 55, STN.y + 50, STN.z + 110 * f], look: [STN.x, STN.y, STN.z] },
      { p: .76, pos: [AST.x + 65, AST.y + 30, AST.z + 125 * f], look: [AST.x, AST.y, AST.z] },
      { p: 1, pos: [BH.x + 40, BH.y + 30, BH.z + 260 * f], look: [BH.x, BH.y, BH.z] }
    ]);
  }
  function frame(dt, t, p) {
    R_(p, cam.position, look); cam.position.x += st.px * 8; cam.position.y += st.py * 6; cam.lookAt(look);
    nearFar(cam, look);     // near plane pushed out with distance: the depth buffer's precision is what keeps overlays off their bases
    sky.userData.mat.uniforms.time.value = t;
    rocks.rotation.y = (RM ? 0 : t) * .01;
  }
  return { sec, scene, cam, layout, frame, sky: "hyper" };
}

/* ---- 1.3 The Creatures Update: eight animals the mod's own generator built (com.starcore.entity.creature.gen, through the repo's
   creature_view harness), eight different species picked at random on every visit from two individuals of each, each from a
   real world of this galaxy and named for it as the game names it (SpeciesEpithet: "Qijafonian Grazer"). ----
   Drawn exactly as vanilla draws a ModelPart tree: per part translate(pivot) then Rz·Ry·Rx, boxes unwrapped by the box-UV table
   (mobmodel.face_rects, the same one the game's Cube uses, mirror included), the whole model through scale(-1, -1, 1) / 16 with
   y = 24 on the ground. Animated by CreatureModel.setupAnim's own formulas, role by role (creaturePose). */
const AX = { X: 0, Y: 1, Z: 2 };
function faceRects(size, uv, mirror) {
  const [w, h, d] = size, [u, v] = uv;
  const F = { up: [[u + d, v, w, d], [0, 1], [2, -1], [1, -1]], down: [[u + d + w, v, w, d], [0, 1], [2, 1], [1, 1]],
    west: [[u, v + d, d, h], [2, -1], [1, 1], [0, -1]], north: [[u + d, v + d, w, h], [0, 1], [1, 1], [2, -1]],
    east: [[u + d + w, v + d, d, h], [2, 1], [1, 1], [0, 1]], south: [[u + 2 * d + w, v + d, w, h], [0, -1], [1, 1], [2, 1]] };
  if (mirror) {
    const we = F.west, ea = F.east; F.west = [ea[0], we[1], we[2], we[3]]; F.east = [we[0], ea[1], ea[2], ea[3]];
    ["up", "down", "north", "south"].forEach(n => { const f = F[n]; F[n] = [f[0], [f[1][0], -f[1][1]], f[2], f[3]]; });
  }
  return F;
}
function creatureModel(c, tex, sheet) {
  const [cx, cy, cw, ch] = c.cell, [TW, TH] = c.texture, [SW, SH] = sheet;
  const UV = (u, v) => [(cx + u / TW * cw) / SW, 1 - (cy + v / TH * ch) / SH];
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: .5 });
  const root = new THREE.Group(), parts = {}, byName = {};
  c.parts.forEach(p => byName[p.name] = p);
  c.parts.forEach(p => {
    const g = new THREE.Group(); g.position.set(...p.pivot);
    g.rotation.set(...p.rot.map(a => a * Math.PI / 180), "ZYX");
    // what CreatureModel's constructor works out per part: its side, whether it is a wing's tip or a spider's planted shin, its length
    const par = p.parent && byName[p.parent], b0 = (p.boxes || [])[0];
    g.userData = { p, rest: g.rotation.clone(), restPos: g.position.clone(), side: p.pivot[0] >= 0 ? 1 : -1,
      tip: !!par && par.role === "wing", planted: !!par && par.role === "limb", len: b0 ? Math.max(1, b0.size[1] / 12) : 1 };
    const pos = [], uv = [], idx = [];
    (p.boxes || []).forEach(b => {
      const lo = b.origin, hi = [0, 1, 2].map(i => b.origin[i] + b.size[i]);
      Object.values(faceRects(b.size, b.uv, !!p.mirror)).forEach(([rect, ua, va, n]) => {
        const corner = lo.slice(); corner[n[0]] = n[1] > 0 ? hi[n[0]] : lo[n[0]];
        if (ua[1] < 0) corner[ua[0]] = hi[ua[0]]; if (va[1] < 0) corner[va[0]] = hi[va[0]];
        const du = [0, 0, 0], dv = [0, 0, 0]; du[ua[0]] = ua[1] * b.size[ua[0]]; dv[va[0]] = va[1] * b.size[va[0]];
        const q = [corner, corner.map((x, i) => x + du[i]), corner.map((x, i) => x + du[i] + dv[i]), corner.map((x, i) => x + dv[i])];
        const [u0, v0, rw, rh] = rect, t = [UV(u0, v0), UV(u0 + rw, v0), UV(u0 + rw, v0 + rh), UV(u0, v0 + rh)];
        const base = pos.length / 3; q.forEach(pt => pos.push(...pt)); t.forEach(tt => uv.push(...tt));
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      });
    });
    if (pos.length) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mat));
    }
    parts[p.name] = g;
  });
  c.parts.forEach(p => (p.parent && parts[p.parent] ? parts[p.parent] : root).add(parts[p.name]));
  const model = new THREE.Group(); root.scale.set(-1 / 16, -1 / 16, 1 / 16); root.position.y = 24 / 16; model.add(root);
  // the swimmer's (or slitherer's) chain, body first, in the order the tail hangs: each unit's turn is the game's absolute one,
  // so a parented unit gets the difference from the one before it
  const chain = [];
  for (let at = parts.body && c.parts.some(p => p.role === "segment" && p.parent === "body") ? "body" : null; at; ) {
    chain.push(parts[at]); const nx = c.parts.find(p => p.role === "segment" && p.parent === at); at = nx ? nx.name : null;
  }
  model.userData = { parts: Object.values(parts), byName: parts, c, chain };
  return model;
}
/* A held item, as the game draws one: item/generated's extruded sprite (front and back faces a pixel apart, an edge face on every
   opaque pixel that meets a clear one), placed by ItemInHandLayer (translateToHand, then Rx -90, Ry 180, (1, 2, -10)/16) and
   item/handheld's thirdperson_righthand display (translate (0, 4, 0.5)/16, rotate XYZ (0, -90, 55), scale 0.85, then -8/16 to centre),
   all in the arm's own frame. CreatureModel.translateToHand's fix first moves this arm's hand to where vanilla's would be. */
function heldItem(arm, uri) {
  // until the sprite lands, an unseen 16 x 16 card stands in for it, so the framing already counts the blade
  const img = new Image(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).translate(8, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  mesh.matrixAutoUpdate = false;
  const b = arm.userData.p.boxes[0], fix = [b.origin[0] + b.size[0] / 2 + 1, b.origin[1] + b.size[1] - 10, b.origin[2] + b.size[2] / 2];
  const d = Math.PI / 180, M = new THREE.Matrix4(), T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  M.multiply(T(...fix)).multiply(new THREE.Matrix4().makeRotationX(-90 * d)).multiply(new THREE.Matrix4().makeRotationY(180 * d))
    .multiply(T(1, 2, -10)).multiply(T(0, 4, .5)).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -90 * d, 55 * d, "XYZ")))
    .multiply(new THREE.Matrix4().makeScale(.85, .85, .85)).multiply(T(-8, -8, -8));
  mesh.matrix.copy(M); arm.add(mesh);
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16; const x2 = cv.getContext("2d"); x2.drawImage(img, 0, 0, 16, 16);
    const A = x2.getImageData(0, 0, 16, 16).data, op = (u, v) => u >= 0 && v >= 0 && u < 16 && v < 16 && A[(v * 16 + u) * 4 + 3] > 127;
    const pos = [], uv = [], quad = (pts, uvs) => { pts.forEach(p => pos.push(...p)); uvs.forEach(t => uv.push(...t)); };
    quad([[0, 0, 8.5], [16, 0, 8.5], [16, 16, 8.5], [0, 16, 8.5]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    quad([[16, 0, 7.5], [0, 0, 7.5], [0, 16, 7.5], [16, 16, 7.5]], [[1, 0], [0, 0], [0, 1], [1, 1]]);
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
      if (!op(u, v)) continue;
      const x = u, y = 15 - v, c = [(u + .5) / 16, 1 - (v + .5) / 16], C4 = [c, c, c, c];
      if (!op(u - 1, v)) quad([[x, y, 7.5], [x, y, 8.5], [x, y + 1, 8.5], [x, y + 1, 7.5]], C4);
      if (!op(u + 1, v)) quad([[x + 1, y, 8.5], [x + 1, y, 7.5], [x + 1, y + 1, 7.5], [x + 1, y + 1, 8.5]], C4);
      if (!op(u, v - 1)) quad([[x, y + 1, 8.5], [x + 1, y + 1, 8.5], [x + 1, y + 1, 7.5], [x, y + 1, 7.5]], C4);
      if (!op(u, v + 1)) quad([[x, y, 7.5], [x + 1, y, 7.5], [x + 1, y, 8.5], [x, y, 8.5]], C4);
    }
    const idx = []; for (let q = 0; q < pos.length / 12; q++) idx.push(4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3);
    const g = mesh.geometry = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const t = new THREE.Texture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.encoding = THREE.sRGBEncoding; t.needsUpdate = true;
    mesh.material = new THREE.MeshLambertMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide });
  };
  img.src = uri;
  return mesh;
}
/* One frame of CreatureModel.setupAnim, its constants and formulas as the game has them (ages in ticks, angles in radians):
   s = { age, walk (walkAnimationPos), speed (walkAnimationSpeed), swing (0..1 attack), fly, hop, slither, vertical, holding } */
const SWING_RATE = .6662, TAU = Math.PI * 2;
function creaturePose(m, s) {
  const U = m.userData;
  U.parts.forEach(g => { g.rotation.copy(g.userData.rest); g.position.copy(g.userData.restPos); });
  // the wave: a swimmer always, a slitherer at the idle figure (in game its units follow the spine's path; on a plinth there is none)
  if (U.chain.length > 1 && (U.c.swimmer || s.slither)) {
    const n = U.chain.length, wave = s.age * .22 + s.walk * .5, sw = U.c.swimmer ? .14 + .28 * Math.min(1, s.speed) : .14;
    let prev = 0;
    U.chain.forEach((g, i) => {
      const turn = Math.sin(wave - i * 1.25) * sw * (i + 1) / (n + 1);
      if (s.vertical) g.rotation.x += turn - prev; else g.rotation.y += turn - prev; prev = turn;
    });
    U.fluke = Math.sin(wave - n * 1.25) * sw * 1.3;
  }
  U.parts.forEach(g => {
    const u = g.userData, P = u.p, ph = (P.phase || 0) * TAU;
    switch (P.role) {
      case "hip": {
        const sweep = -Math.cos(s.walk * SWING_RATE * 2 + ph) * .4 * s.speed, lift = Math.abs(Math.sin(s.walk * SWING_RATE + ph) * .4) * s.speed;
        g.rotation.y -= u.side * sweep; g.rotation.z -= u.side * lift; break;
      }
      case "arm": g.rotation.x += Math.cos(s.walk * SWING_RATE + ph) * 1.0 * s.speed; break;
      case "leg": if (!u.planted) g.rotation.x += Math.cos(s.walk * SWING_RATE + ph) * 1.4 * s.speed / u.len; break;
      case "head": g.rotation.y += Math.sin(s.age * .035 + ph) * .3; break;
      case "tail": g.rotation.y += Math.cos(s.age * .2) * .15; break;
      case "wing": {
        const droop = s.fly ? 0 : 1, beat = Math.sin(s.age * .55 - (u.tip ? 1.2 : 0)) * (u.tip ? .4 : .55) * (1 - droop);
        g.rotation.z += -u.side * beat + u.side * (u.tip ? .55 : 1.15) * droop; break;
      }
      case "fin": g.rotation.z += -u.side * Math.sin(s.age * .13) * .12; break;
      case "fluke": if (s.vertical) g.rotation.x += U.fluke || 0; else g.rotation.y += U.fluke || 0; break;
    }
  });
  // the hand with the weapon is held out a little (vanilla's ITEM pose), and a swing brings it down through the stroke
  const ar = U.byName.arm_r;
  if (ar && s.holding) { ar.rotation.x = ar.rotation.x * .5 - Math.PI / 10; ar.rotation.x -= Math.sin(s.swing * Math.PI) * 1.2; }
  if (s.hop) { const lift = 2 * Math.abs(Math.sin(s.walk)) * s.speed; U.parts.forEach(g => { if (!g.parent || g.parent.parent === m) g.position.y -= lift; }); }
}
/* Which creatures each tab shows, chosen once a visit (principal 2026-11-12: the Overview shows "another 8 random creatures ...
   different to the ones shown in the update page"). Updates: the saved Ambler with its weapon, one flier, six more species. Overview:
   a second flier and the species Updates left out, then, since there are fifteen species for sixteen places, the other individual of
   one Updates species. No individual appears twice. */
function crePicks(C) {
  if (C.picks) return C.picks;
  const shuf = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const all = C.data.creatures, bySp = {}; all.forEach(c => (bySp[c.species] = bySp[c.species] || []).push(c));
  const ambler = all.find(c => c.held), fliers = shuf(all.filter(c => c.winged));
  const upd = [ambler, fliers[0]].filter(Boolean), used = new Set(upd), spU = new Set(upd.map(c => c.species));
  for (const sp of shuf(Object.keys(bySp))) { if (upd.length >= 8) break; if (spU.has(sp)) continue; const c = shuf(bySp[sp])[0]; upd.push(c); used.add(c); spU.add(sp); }
  const ov = [], spO = new Set(), take = c => { ov.push(c); used.add(c); spO.add(c.species); };
  const f2 = fliers.find(c => !used.has(c)); if (f2) take(f2);
  for (const sp of shuf(Object.keys(bySp))) { if (ov.length >= 8) break; if (spU.has(sp) || spO.has(sp)) continue; take(shuf(bySp[sp])[0]); }
  for (const c of shuf(all)) { if (ov.length >= 8) break; if (!used.has(c) && !spO.has(c.species)) take(c); }
  return (C.picks = { updates: shuf(upd), overview: shuf(ov) });
}
/* Eight creatures on a turning ring, the Frontier update's planet carousel with creatures on it (principal 2026-11-12: "make the
   creatures update a carousel rather than individual ones one at a time, just like the planets"). Each stands on its plinth, scaled to
   fit its place on the ring from its real extent over a whole cycle of its motion, animated by the game's own setupAnim (creaturePose),
   turning a little on the spot; the ring pauses on each in turn and the one in front carries its name. */
function buildCreatureCarousel(C, list, secId, cls) {
  const sec = $(secId), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 400);
  scene.add(new THREE.HemisphereLight(0xf2ecff, 0x40305a, .95)); const sun = new THREE.DirectionalLight(0xfff4e6, .7); sun.position.set(3, 6, 4); scene.add(sun);
  scene.add(stars(1400, 60, 140, "#f6eeff", { alpha: .8 }));
  const tex = new THREE.Texture(C.img); tex.needsUpdate = true; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter; tex.encoding = THREE.sRGBEncoding;
  const W = C.data.weapons || {}, HOP = new Set(["hopper", "roundling", "gulpmaw"]), n = list.length, RAD = 6.2;
  // a place on the ring: half-width and height a creature (with its plinth) is scaled into, so neighbours never touch
  const SLOT_R = RAD * Math.sin(Math.PI / n) * .78, SLOT_H = 2.5;
  const plinth = new THREE.MeshLambertMaterial({ color: 0x2a1f44 }), rim = new THREE.MeshBasicMaterial({ color: 0x2be0c8 });
  const ring = new THREE.Group(); scene.add(ring);
  const box = new THREE.Box3(), b1 = new THREE.Box3();
  const items = list.map((c, i) => {
    const m = creatureModel(c, tex, C.data.sheet), h = c.hitbox[1];
    const holder = new THREE.Group(), spot = new THREE.Group(); holder.add(spot); ring.add(holder);
    const a = i / n * Math.PI * 2; holder.position.set(Math.sin(a) * RAD, 0, Math.cos(a) * RAD); holder.rotation.y = a;
    const r = Math.max(.7, Math.max(.8, c.hitbox[0]) * .62);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, .18, 40), plinth); base.position.y = -.09; spot.add(base);
    const rr = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, .015, 6, 64), rim); rr.rotation.x = Math.PI / 2; spot.add(rr);
    const air = c.winged ? .7 + h * .3 : c.swimmer ? .35 + h * .25 : 0; m.position.y = air; m.userData.air = air; spot.add(m);
    const holding = c.held && W[c.held] && m.userData.byName.arm_r;
    if (holding) heldItem(m.userData.byName.arm_r, W[c.held]);
    const anim = { fly: !!c.winged, hop: HOP.has(c.species), slither: c.species === "coilback", holding: !!holding,
      vertical: c.traits.some(t => /up and down/.test(t)), speed: c.winged ? 0 : .6 };
    // its extent over a whole cycle of motion, as a cylinder round the plinth's axis (it turns), then scaled into the place
    box.makeEmpty();
    for (let k = 0; k < 12; k++) { creaturePose(m, { ...anim, age: k * 1.9, walk: k * .79, swing: k / 11 }); spot.updateMatrixWorld(true); b1.setFromObject(spot); box.union(b1); }
    spot.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(spot.matrixWorld).invert(); box.applyMatrix4(inv);
    const rh = Math.max(r * 1.05, Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z))));
    const k = Math.min(SLOT_R / rh, SLOT_H / Math.max(.5, box.max.y + .1), 1.6); spot.scale.setScalar(k);
    const el = document.createElement("div"); el.className = `dlabel ${cls}`; el.innerHTML = `<b>${c.epithet} ${c.name}</b>`; labelsEl.appendChild(el);
    return { c, m, spot, el, anim, phase: Math.random() * 6.28, walk: 0, swing: 0, next: 2 + Math.random() * 2 };
  });
  let R_; const look = new V3(), wp = new V3(), tmp = new V3();
  function layout() {
    // the one in front, framed: on a desktop right of the caption (look shifted left), on a phone above the caption sheet
    // the front one about 40% of the height, its place a third of the width on a desktop (on a phone a little wider than the screen, neighbours cut)
    const nw = st.narrow, t = Math.tan(cam.fov * Math.PI / 360), a = cam.aspect, d = Math.max((SLOT_H + .3) / (2 * t * (nw ? .3 : .42)), 2 * SLOT_R / (2 * t * a * (nw ? 1.15 : .36)));
    R_ = rail([{ p: 0, pos: [0, 1.9, RAD + d], look: [nw ? 0 : -d * t * a * .42, nw ? 1.25 - d * t * .3 : 1.25, RAD - 1] },
      { p: 1, pos: [0, 1.7, RAD + d * .97], look: [nw ? 0 : -d * t * a * .42, nw ? 1.25 - d * t * .3 : 1.25, RAD - 1] }]);
  }
  function frame(dt, t, p) {
    R_(p, cam.position, look); cam.position.x += st.px * .6; cam.position.y += st.py * .4; cam.lookAt(look);
    // a pause on each, then a smooth turn to the next
    const x = p * (n - .6), i0 = Math.floor(x), f = x - i0, e = i0 + smooth(.4, 1, f);
    ring.rotation.y = -Math.min(e, n - 1) / n * Math.PI * 2;
    items.forEach(r => {
      r.m.rotation.y = Math.PI + Math.sin(t * .35 + r.phase) * .45;          // facing out of the ring, turning a little
      if (r.m.userData.air) r.m.position.y = r.m.userData.air + Math.sin(t * 1.6 + r.phase) * (r.anim.fly ? .1 : .06);
      const A = r.anim; r.walk += A.speed * 20 * dt;
      if (A.holding) { r.next -= dt; if (r.next < 0) { r.swing = 1e-6; r.next = 2.5 + Math.random() * 2; } if (r.swing > 0) r.swing = r.swing + dt / .3 > 1 ? 0 : r.swing + dt / .3; }
      creaturePose(r.m, { ...A, age: (t + r.phase) * 20, walk: r.walk, swing: r.swing });
      r.spot.getWorldPosition(wp);
      const front = smooth(RAD * .7, RAD * .97, wp.z), q = project(wp, cam, tmp);
      r.el.style.opacity = front.toFixed(3); r.el.classList.toggle("on", front > .05);
      r.el.style.transform = `translate(${q.x}px, ${q.y + 18}px) translateX(-50%)`;
    });
  }
  function show(v) { labelsEl.querySelectorAll("." + cls).forEach(e => e.style.display = v ? "" : "none"); }
  return { sec, scene, cam, layout, frame, show, sky: "front" };
}
