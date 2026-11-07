/* =================================== THE UPDATES TAB =================================== */
/* Its geometry is fetched the first time the tab opens: real dumps (an Overworld patch, a mini cluster, an asteroid field, a Lab
   station) and the sky planets PlanetFeature builds, baked and packed like the Journey's (see quadGeo), on the same texture sheet. */
let UPD = null;
function updLoad() {
  if (!UPD) UPD = Promise.all([getOk("updates.json").then(r => r.json()), inflate("updates.txt")]).then(([meta, bin]) => quadPack(meta, bin));
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
  const mats = updMats(D, 0xbcd6f5, 40, 120);
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
      { p: 0, pos: [42 * f, 16, 58 * f], look: [2, 22, 0] },
      { p: .42, pos: [44 * f, 34, 30 * f], look: [SP.x + 2, SP.y, SP.z] },
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
      { p: 0, pos: [0, 160 * f, 420 * f], look: [0, 0, -120] },
      { p: .28, pos: [CL.x + 60, 70, CL.z + 190 * f], look: [CL.x, CL.y, CL.z] },
      { p: .52, pos: [STN.x + 70, STN.y + 70, STN.z + 150 * f], look: [STN.x, STN.y, STN.z] },
      { p: .76, pos: [AST.x + 90, AST.y + 40, AST.z + 170 * f], look: [AST.x, AST.y, AST.z] },
      { p: 1, pos: [BH.x + 40, BH.y + 30, BH.z + 260 * f], look: [BH.x, BH.y, BH.z] }
    ]);
  }
  function frame(dt, t, p) {
    R_(p, cam.position, look); cam.position.x += st.px * 8; cam.position.y += st.py * 6; cam.lookAt(look);
    sky.userData.mat.uniforms.time.value = t;
    rocks.rotation.y = (RM ? 0 : t) * .01;
  }
  return { sec, scene, cam, layout, frame, sky: "hyper" };
}
