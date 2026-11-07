"use strict";
/* ---------------- engine: renderer, baked sheets, shared builders ---------------- */
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HTML = document.documentElement;
const canvas = document.getElementById("gl");
const labelsEl = document.getElementById("labels");
const V3 = THREE.Vector3;
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
R.outputEncoding = THREE.sRGBEncoding;
R.setClearColor(0x000000, 0);
const MAXANI = R.capabilities.getMaxAnisotropy();

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const OWN = new WeakSet();

/* The baked sheets: every texture pre-upscaled by an integer, nearest neighbour, with extruded gutters. Sampled with hard
   texel edges up close (nearest magnification) and trilinear + anisotropic minification far away. */
function sheet(uri) {
  const t = new THREE.TextureLoader().load(uri);
  t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = MAXANI; t.generateMipmaps = true;
  return t;
}
const BT = sheet(ATLAS.blocks.uri), PT = sheet(ATLAS.planets.uri);
const BR = ATLAS.blocks.rects, PR = ATLAS.planets.rects;
const BW = ATLAS.blocks.size[0], BH = ATLAS.blocks.size[1], PW = ATLAS.planets.size[0], PH = ATLAS.planets.size[1];
/* a rect (or a sub-rect in source-texture fractions) as normalised UVs, flipY-aware */
function uvr(rects, W, H, key, sub) {
  const r = rects[key]; if (!r) throw new Error("no texture " + key);
  let [x, y, w, h] = r;
  if (sub) { x += sub[0] * w; y += sub[1] * h; w *= sub[2]; h *= sub[3]; }
  return { u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H };
}
const buv = (k, sub) => uvr(BR, BW, BH, k, sub);
const BMAT = new THREE.MeshLambertMaterial({ map: BT });
const BMAT_CUT = new THREE.MeshLambertMaterial({ map: BT, alphaTest: .5, side: THREE.DoubleSide });
const BMAT_GLOW = new THREE.MeshBasicMaterial({ map: BT });
const PMAT = new THREE.MeshLambertMaterial({ map: PT });

/* a box whose six faces read six atlas cells: faces = [px, nx, py, ny, pz, nz] as keys or {k, sub} */
const geoCache = new Map();
function blockGeo(faces, size = [1, 1, 1]) {
  const id = JSON.stringify([faces, size]);
  if (geoCache.has(id)) return geoCache.get(id);
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const U = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const fc = faces[f], r = typeof fc === "string" ? buv(fc) : buv(fc.k, fc.sub);
    for (let i = 0; i < 4; i++) { const j = f * 4 + i; U.setXY(j, lerp(r.u0, r.u1, U.getX(j)), lerp(r.v0, r.v1, U.getY(j))); }
  }
  geoCache.set(id, g);
  return g;
}
const all6 = k => [k, k, k, k, k, k];

/* The mod's cube planet: a 512x256 net (128 px faces; top (128,0), bottom (256,0), sides west/front/east/back at y=128),
   read from its cell of the planet sheet. */
function netGeo(key) {
  if (geoCache.has("net:" + key)) return geoCache.get("net:" + key);
  const r = uvr(PR, PW, PH, key), g = new THREE.BoxGeometry(2, 2, 2);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  const e = .5, s = v => e + (v + 1) / 2 * (128 - 2 * e);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    let px, py;
    if (nz > .5) { px = 128 + s(x); py = 128 + s(-y); } else if (nx > .5) { px = 256 + s(-z); py = 128 + s(-y); }
    else if (nz < -.5) { px = 384 + s(-x); py = 128 + s(-y); } else if (nx < -.5) { px = s(z); py = 128 + s(-y); }
    else if (ny > .5) { px = 128 + s(x); py = s(z); } else { px = 256 + s(x); py = s(-z); }
    U.setXY(i, lerp(r.u0, r.u1, px / 512), lerp(r.v1, r.v0, py / 256));
  }
  geoCache.set("net:" + key, g);
  return g;
}
const GLOW = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  x.shadowColor = "#fff"; x.shadowBlur = 46; x.fillStyle = "#fff";
  const r = 20, a = 70, b = 186;
  x.beginPath(); x.moveTo(a + r, a); x.lineTo(b - r, a); x.quadraticCurveTo(b, a, b, a + r); x.lineTo(b, b - r);
  x.quadraticCurveTo(b, b, b - r, b); x.lineTo(a + r, b); x.quadraticCurveTo(a, b, a, b - r); x.lineTo(a, a + r); x.quadraticCurveTo(a, a, a + r, a);
  x.fill(); x.fill();
  return new THREE.CanvasTexture(c);
})();
const ROUNDGLOW = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.3, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
})();
function ringMesh(key, inner, outer) {
  const r = uvr(PR, PW, PH, key), pos = [], uv = [], idx = [], C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const a = C[k], b = C[(k + 1) % 4], base = pos.length / 3;
    pos.push(a[0] * outer, 0, a[1] * outer, b[0] * outer, 0, b[1] * outer, b[0] * inner, 0, b[1] * inner, a[0] * inner, 0, a[1] * inner);
    uv.push(r.u0, r.v1, r.u1, r.v1, r.u1, r.v0, r.u0, r.v0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: PT, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xd8dce6 }));
}
function planet(key) {
  const d = PLANETS[key], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const pick = [];
  if (d.members) {
    d.members.forEach((m, i) => {
      const mesh = new THREE.Mesh(netGeo(`${d.stem}_m${i}`), PMAT);
      mesh.scale.setScalar(m.half); mesh.position.set(...m.pos);
      const r = m.rot; mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(r[0][0], r[0][1], r[0][2], 0, r[1][0], r[1][1], r[1][2], 0, r[2][0], r[2][1], r[2][2], 0, 0, 0, 0, 1));
      mesh.userData.spin = (Math.random() - .5) * .5; body.add(mesh); pick.push(mesh);
    });
    body.scale.setScalar(2.3);
  } else { const mesh = new THREE.Mesh(netGeo(d.stem), PMAT); body.add(mesh); pick.push(mesh); }
  if (d.glow) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color(d.glow), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .62 }));
    sp.scale.setScalar(3.5); g.add(sp);
  }
  if (d.ring) { g.add(ringMesh(d.stem + "_ring", d.ring.inner, d.ring.outer)); g.rotation.set(.42, 0, -.22); }
  g.userData = { key, body, pick, data: d };
  return g;
}
function spinPlanet(g, dt, rate = .12) {
  const b = g.userData.body;
  if (g.userData.data.members) b.children.forEach(m => { m.rotation.y += m.userData.spin * dt; m.rotation.x += m.userData.spin * .4 * dt; });
  b.rotation.y += rate * dt;
}
function stars(n, r0, r1, color, o = {}) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = lerp(r0, r1, Math.random());
    pos[i * 3] = s * Math.cos(th) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = s * Math.sin(th) * r;
    size[i] = Math.random() < .06 ? lerp(3, 4.5, Math.random()) : lerp(1, 2.4, Math.random()); phase[i] = Math.random() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("size", new THREE.BufferAttribute(size, 1)); g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) }, pr: { value: R.getPixelRatio() }, alpha: { value: o.alpha || 1 } },
    vertexShader: `attribute float size; attribute float phase; uniform float time; uniform float pr; varying float vTw;
      void main(){ vTw = .55 + .45 * sin(time * 1.3 + phase); gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 color; uniform float alpha; varying float vTw;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(color, a * a * vTw * alpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const p = new THREE.Points(g, m); p.userData.mat = m; p.frustumCulled = false;
  return p;
}
/* scroll anchors: a pose is reached when its anchor element reaches the top of the viewport */
function anchorP(sec, el) {
  const top = sec.getBoundingClientRect().top + scrollY, h = sec.offsetHeight - innerHeight;
  return el ? clamp((el.getBoundingClientRect().top + scrollY - top) / Math.max(1, h)) : 0;
}
function rail(stops) {
  stops = stops.slice().sort((a, b) => a.p - b.p);
  return (p, pos, look) => {
    let i = 0; while (i < stops.length - 2 && p > stops[i + 1].p) i++;
    const a = stops[i], b = stops[i + 1] || a, t = (b.ease || ease)(b.p === a.p ? 1 : clamp((p - a.p) / (b.p - a.p)));
    pos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    look.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    return t;
  };
}
function stepIndex(p, ps) { let k = 0; ps.forEach((v, i) => { if (p >= v - .002) k = i; }); return k; }
function capSwap(cap, k, items) {
  if (cap.dataset.k === String(k)) return;
  cap.dataset.k = k; const it = items[k];
  const count = cap.querySelector(".cap-count"); if (count) count.textContent = `${k + 1} of ${items.length}`;
  cap.querySelector(".cap-name").textContent = it.name; cap.querySelector(".cap-text").textContent = it.text;
  cap.classList.remove("swap"); void cap.offsetWidth; cap.classList.add("swap");
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(0, 0);
function pickHit(cam, groups) {
  ray.setFromCamera(ndc, cam); const objs = []; groups.forEach(g => objs.push(...g.userData.pick));
  const h = ray.intersectObjects(objs, false)[0];
  return h ? groups.find(g => g.userData.pick.includes(h.object)) || null : null;
}
function project(v, cam, out) { out.copy(v).project(cam); return { x: (out.x + 1) / 2 * innerWidth, y: (1 - out.y) / 2 * innerHeight, behind: out.z > 1 || out.z < -1 }; }

/* A player in the mod's suit: the armour sheet and leggings on Minecraft box UV (64x32, baked x8), and the helmet as the
   mod draws it: a 16-unit item model (glass cube + a rim of the grade's metal) on the head at 0.625. */
function boxUV(w, h, d, u, v, key, grow = 0) {
  const g = new THREE.BoxGeometry((w + grow) / 16, (h + grow) / 16, (d + grow) / 16);
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, r = BR[key];
  const hx = (w + grow) / 32, hy = (h + grow) / 32, hz = (d + grow) / 32, f = (a, n) => (a + 1) / 2 * n;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) / hx, y = P.getY(i) / hy, z = P.getZ(i) / hz, nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    let px, py;
    if (nz > .5) { px = u + d + f(x, w); py = v + d + f(-y, h); } else if (nx > .5) { px = u + d + w + f(-z, d); py = v + d + f(-y, h); }
    else if (nz < -.5) { px = u + 2 * d + w + f(-x, w); py = v + d + f(-y, h); } else if (nx < -.5) { px = u + f(z, d); py = v + d + f(-y, h); }
    else if (ny > .5) { px = u + d + f(x, w); py = v + f(z, d); } else { px = u + d + w + f(x, w); py = v + f(-z, d); }
    U.setXY(i, (r[0] + px * 8) / BW, 1 - (r[1] + py * 8) / BH);
  }
  return g;
}
const FACE = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  const p = (col, X, Y, W, H) => { x.fillStyle = col; x.fillRect(X * 8, Y * 8, W * 8, H * 8); };
  p("#c9926c", 0, 0, 8, 8); p("#4a3426", 0, 0, 8, 2); p("#4a3426", 0, 2, 1, 2); p("#4a3426", 7, 2, 1, 2);
  p("#f2efe8", 1, 4, 2, 1); p("#f2efe8", 5, 4, 2, 1); p("#26324a", 2, 4, 1, 1); p("#26324a", 5, 4, 1, 1); p("#a8735a", 3, 6, 2, 1);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding; return t;
})();
const VISOR = { frontier: [160, 123, 53, 96], astral: [56, 58, 65, 170], industrial: [56, 58, 65, 170] };
const RIM = { frontier: "rim_frontier", astral: "rim_astral", industrial: null };
function suitedPlayer(grade) {
  const root = new THREE.Group(), px = v => v / 16;
  const under = new THREE.MeshLambertMaterial({ color: 0x2a2d35 });
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(px(x), px(y), px(z)); return m; };
  const limb = (sx, sy, legs) => {
    const g = new THREE.Group(); g.position.set(px(sx), px(sy), 0);
    g.add(part(new THREE.BoxGeometry(px(4), px(12), px(4)), under, 0, legs ? -6 : -4, 0));
    if (legs) g.add(part(boxUV(4, 12, 4, 0, 16, "legs_" + grade, .5), BMAT_CUT, 0, -6, 0));
    g.add(part(boxUV(4, 12, 4, legs ? 0 : 40, 16, "suit_" + grade, 1), BMAT_CUT, 0, legs ? -6 : -4, 0));
    return g;
  };
  const legL = limb(-2, 12, true), legR = limb(2, 12, true), armL = limb(-6, 22, false), armR = limb(6, 22, false);
  const torso = new THREE.Group();
  torso.add(part(new THREE.BoxGeometry(px(8), px(12), px(4)), under, 0, 18, 0));
  torso.add(part(boxUV(8, 12, 4, 16, 16, "legs_" + grade, .5), BMAT_CUT, 0, 18, 0));
  torso.add(part(boxUV(8, 12, 4, 16, 16, "suit_" + grade, 1), BMAT_CUT, 0, 18, 0));
  const head = new THREE.Group(); head.position.set(0, px(24), 0);
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9926c }), hair = new THREE.MeshLambertMaterial({ color: 0x4a3426 });
  head.add(part(new THREE.BoxGeometry(px(8), px(8), px(8)), [skin, skin, hair, skin, new THREE.MeshLambertMaterial({ map: FACE }), hair], 0, 4, 0));
  const vz = VISOR[grade];
  const glass = new THREE.Mesh(new THREE.BoxGeometry(px(10), px(10), px(10)), new THREE.MeshLambertMaterial({ color: new THREE.Color(vz[0] / 255, vz[1] / 255, vz[2] / 255), transparent: true, opacity: vz[3] / 255, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.set(0, px(4), 0); head.add(glass);
  const rimMat = RIM[grade] ? BMAT : new THREE.MeshLambertMaterial({ color: 0xe06100 });
  const rimGeo = RIM[grade] ? blockGeo(all6(RIM[grade]), [px(18 * .625), px(3 * .625), px(18 * .625)]) : new THREE.BoxGeometry(px(18 * .625), px(3 * .625), px(18 * .625));
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.set(0, px(-1 + 1.5 * .625), 0); head.add(rim);
  const drill = new THREE.Mesh(blockGeo(all6("drill"), [0, px(10), px(10)]), BMAT_CUT);
  drill.position.set(0, px(-14), px(2)); armL.add(drill);
  root.add(legL, legR, torso, armL, armR, head);
  root.userData = { armL, armR, legL, legR, head, tool: armL, drill };
  return root;
}

/* ---- baked block models: the mod's own blockstates and models, baked offline to triangles on their own sheet ---- */
const KT = sheet(BAKED.uri);
const KMAT = new THREE.MeshLambertMaterial({ map: KT, vertexColors: true, alphaTest: .5, side: THREE.DoubleSide });
const KMAT_BLEND = new THREE.MeshLambertMaterial({ map: KT, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
function unb64(s, T) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); }
function bakedGeo(name, kind) {
  const m = BAKED.groups[name][kind]; if (!m) return null;
  const P = unb64(m.pos, Int16Array), U = unb64(m.uv, Uint16Array), C = unb64(m.col, Uint8Array), N = unb64(m.nrm, Int8Array);
  const pos = new Float32Array(P.length), uv = new Float32Array(U.length), col = new Float32Array(C.length), nrm = new Float32Array(N.length);
  for (let i = 0; i < P.length; i++) pos[i] = P[i] / 64;
  for (let i = 0; i < U.length; i++) uv[i] = U[i] / 65535;
  for (let i = 0; i < C.length; i++) col[i] = C[i] / 255;
  for (let i = 0; i < N.length; i++) nrm[i] = N[i];
  const q = m.n / 4, idx = new Uint32Array(q * 6);
  for (let i = 0; i < q; i++) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  return g;
}
/* a group's meshes; reveal(k) shows its first k blocks (the bake records where each block's faces end) */
function bakedMesh(name) {
  const g = new THREE.Group(), steps = BAKED.groups[name].steps, parts = {};
  [["opaque", KMAT], ["blend", KMAT_BLEND]].forEach(([k, mat]) => { const geo = bakedGeo(name, k); if (geo) { parts[k] = new THREE.Mesh(geo, mat); parts[k].frustumCulled = false; g.add(parts[k]); } });
  g.userData.reveal = k => {
    Object.entries(parts).forEach(([kind, m]) => { const n = k <= 0 ? 0 : steps[kind][Math.min(k, steps[kind].length) - 1]; m.geometry.setDrawRange(0, n * 6); });
  };
  g.userData.blocks = steps.opaque.length;
  return g;
}
