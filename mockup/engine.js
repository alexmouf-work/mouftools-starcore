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

/* The sheets arrive at native resolution (lossless WebP, every texture once) and are rebuilt here as the GPU wants them: each
   texture upscaled by its whole-number factor, nearest neighbour, with extruded gutters. Sampled with hard texel edges up close
   (nearest magnification) and trilinear + anisotropic minification far away. Planets drop their x2 on phones (canvas limits). */
function texFrom(cv) {
  const t = new THREE.CanvasTexture(cv);
  // once the GPU has it, the canvas is dead weight (64 MB at 4096 square): shrink it to nothing so the page holds one copy
  t.onUpdate = () => { cv.width = cv.height = 1; t.onUpdate = null; };
  t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = MAXANI; t.generateMipmaps = true;
  return t;
}
// Phones get x2 blocks (a 4096 x 1024 sheet) and x1 planets: x8 blocks is a 4096-square canvas plus its GPU copy and mips, more than
// a phone browser gives a page comfortably, and on a phone's small, dense screen it is not a difference anyone can see.
const PHONE = Math.min(screen.width, screen.height) < 760 || innerWidth < 720;
const BDIV = PHONE ? 4 : 1, BSC = Math.max(1, 8 / BDIV);
const XB = expand(ASSETS.texImg, ASSETS.J.tex, BDIV), XP = expand(ASSETS.planetsImg, ASSETS.J.planets, PHONE ? 2 : 1);
performance.mark("expanded");
const BT = texFrom(XB.canvas), PT = texFrom(XP.canvas);
const BR = XB.rects, PR = XP.rects, BW = XB.W, BH = XB.H, PW = XP.W, PH = XP.H;
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
    U.setXY(i, (r[0] + px * BSC) / BW, 1 - (r[1] + py * BSC) / BH);
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

/* ---- baked block models: the mod's own blockstates and models, baked offline and packed as quads ----
   axis-aligned quads in 26 bytes (corner, two edge axes, size, texture, tint, uv), the rest in 42 (four corners). Coplanar faces of
   one texture were merged at bake time, so a merged quad's uv runs past one texture and the shader tiles it with fract() (a plating
   wall by its 3x3 period). Shading is Minecraft's own: top 1.0, north/south 0.8, east/west 0.6, bottom 0.5, times the scene's tint. */
function quadPack(meta, bin) {
  const rects = meta.tids.map(t => { const r = BR[t]; return [r[0] / BW, 1 - (r[1] + r[3]) / BH, r[2] / BW, r[3] / BH]; });
  return { meta, bin, rects };
}
function quadMats(o = {}) {
  const mk = blend => new THREE.ShaderMaterial({
    uniforms: { map: { value: BT }, fogC: { value: new THREE.Color(o.fog || 0) }, fogR: { value: new THREE.Vector2(o.near || 1e5, o.far || 2e5) }, tint: { value: new THREE.Color(...(o.tint || [1, 1, 1])) } },
    vertexShader: `attribute vec4 rect; attribute vec2 luv; attribute vec3 color; varying vec4 vR; varying vec2 vL; varying vec3 vC; varying float vS; varying float vD;
      void main(){ vR = rect; vL = luv; vC = color; vec3 n = normalize(mat3(modelMatrix) * normal);
        vS = abs(n.y) > .5 ? (n.y > 0. ? 1. : .5) : (abs(n.z) > abs(n.x) ? .8 : .6);
        vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 fogC; uniform vec2 fogR; uniform vec3 tint; varying vec4 vR; varying vec2 vL; varying vec3 vC; varying float vS; varying float vD;
      void main(){ vec2 full = vR.xy + vL * vR.zw, uv = vR.xy + fract(vL) * vR.zw;
        #if __VERSION__ >= 300
        vec4 t = textureGrad(map, uv, dFdx(full), dFdy(full));
        #else
        vec4 t = texture2D(map, uv);
        #endif
        if (t.a < ${blend ? ".02" : ".5"}) discard;
        vec3 c = t.rgb * vC * vS * tint; gl_FragColor = vec4(mix(c, fogC, smoothstep(fogR.x, fogR.y, vD)), ${blend ? "t.a * .85" : "1."}); }`,
    transparent: blend, depthWrite: !blend, side: THREE.DoubleSide, extensions: { derivatives: true }
  });
  return { o: mk(false), b: mk(true) };
}
const AXV = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function quadGeo(P, gname, kind, list) {
  const g = P.meta.groups[gname][kind]; if (!g) return null;
  const [off, n] = g[list]; if (!n) return null;
  const dv = new DataView(P.bin), rects = P.rects;
  const Pp = new Float32Array(n * 12), N = new Float32Array(n * 12), C = new Float32Array(n * 12), RE = new Float32Array(n * 16), L = new Float32Array(n * 8);
  const put = (q, cs, nx, ny, nz, tid, r, gg, b, u0, v0, u1, v1, k) => {
    const rc = rects[tid], uv = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
    for (let c = 0; c < 4; c++) {
      const o = q * 4 + c;
      Pp[o * 3] = cs[c][0]; Pp[o * 3 + 1] = cs[c][1]; Pp[o * 3 + 2] = cs[c][2];
      N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz; C[o * 3] = r; C[o * 3 + 1] = gg; C[o * 3 + 2] = b;
      RE.set(rc, o * 4); const [u, v] = uv[(c + k) % 4]; L[o * 2] = u / 16; L[o * 2 + 1] = 1 - v / 16;
    }
  };
  if (list === "axis") for (let q = 0; q < n; q++) {
    const o = off + q * 26, x = dv.getInt16(o, true) / 16, y = dv.getInt16(o + 2, true) / 16, z = dv.getInt16(o + 4, true) / 16, code = dv.getUint16(o + 6, true);
    const w = dv.getUint16(o + 8, true) / 16, h = dv.getUint16(o + 10, true) / 16;
    const U = AXV[code & 7], V = AXV[code >> 3 & 7], Nn = AXV[code >> 6 & 7];
    const c1 = [x + V[0] * h, y + V[1] * h, z + V[2] * h];
    put(q, [[x, y, z], c1, [c1[0] + U[0] * w, c1[1] + U[1] * w, c1[2] + U[2] * w], [x + U[0] * w, y + U[1] * w, z + U[2] * w]], Nn[0], Nn[1], Nn[2], dv.getUint16(o + 12, true),
      dv.getUint8(o + 14) / 255, dv.getUint8(o + 15) / 255, dv.getUint8(o + 16) / 255,
      dv.getInt16(o + 18, true) / 3, dv.getInt16(o + 20, true) / 3, dv.getInt16(o + 22, true) / 3, dv.getInt16(o + 24, true) / 3, code >> 9 & 3);
  } else for (let q = 0; q < n; q++) {
    const o = off + q * 42, cs = [];
    for (let c = 0; c < 4; c++) cs.push([dv.getInt16(o + c * 6, true) / 64, dv.getInt16(o + c * 6 + 2, true) / 64, dv.getInt16(o + c * 6 + 4, true) / 64]);
    put(q, cs, dv.getInt8(o + 38) / 127, dv.getInt8(o + 39) / 127, dv.getInt8(o + 40) / 127, dv.getUint16(o + 24, true),
      dv.getUint8(o + 26) / 255, dv.getUint8(o + 27) / 255, dv.getUint8(o + 28) / 255,
      dv.getInt16(o + 29, true) / 3, dv.getInt16(o + 31, true) / 3, dv.getInt16(o + 33, true) / 3, dv.getInt16(o + 35, true) / 3, dv.getUint8(o + 37));
  }
  const idx = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(Pp, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(C, 3)); geo.setAttribute("rect", new THREE.BufferAttribute(RE, 4)); geo.setAttribute("luv", new THREE.BufferAttribute(L, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return geo;
}
/* a group's meshes; reveal(k) shows its first k blocks (the bake records where each block's quads end, per list) */
function quadMesh(P, gname, mats) {
  const g = new THREE.Group(), parts = [];
  [["opaque", mats.o], ["blend", mats.b]].forEach(([kind, m]) => ["axis", "free"].forEach(list => {
    const geo = quadGeo(P, gname, kind, list); if (!geo) return;
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; if (kind === "blend") mesh.renderOrder = 2;
    g.add(mesh); parts.push({ mesh, steps: (P.meta.groups[gname][kind].steps || {})[list] });
  }));
  const any = parts.find(p => p.steps);
  g.userData.blocks = any ? any.steps.length : 0;
  g.userData.reveal = k => parts.forEach(({ mesh, steps }) => { if (!steps) return; const n = k <= 0 ? 0 : steps[Math.min(k, steps.length) - 1]; mesh.geometry.setDrawRange(0, n * 6); });
  return g;
}
// journey.txt arrives after the page is up; the scenes that draw baked models wait for it (lazy() in the conductor)
let JPACK = null, JBIN = null;
ASSETS.jbinP.then(b => { JBIN = b; JPACK = quadPack(ASSETS.J.pack, b); }).catch(err => { console.error(err); document.getElementById("boot").hidden = false; document.getElementById("boot").textContent = "Some scenes could not load."; });
const DAYMATS = quadMats();
function bakedMesh(name, mats) { return quadMesh(JPACK, name, mats || DAYMATS); }

/* ---- LENS: Detailed Black Holes, ported from the mod's own post pass (shaders/post/black_hole.fsh) ----
   A scene holding black holes renders into a buffer with depth, then one full-screen pass per hole (far first, so the nearest is
   painted last): thin-lens point-mass bend (source radius r - thetaE^2 / r), the shadow as an antialiased mask, and the disc fitted
   to the owner's reference (glow, dip, arc, photon ring, the near-side bar, wrapped-lattice grain in disc-local polar coordinates).
   Radii are the game's: shadow = tan(1.22 * horizon angle), thetaE = tan(2 * horizon angle), in screen-height units; the effect
   stops at 10 thetaE. Occlusion is the same feathered depth band around the horizon's front face. The hole has no mesh of its
   own, as in the game with the option on: everything you see of it is this pass. */
const LENS = (() => {
  const mk = () => { const t = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }); t.texture.encoding = THREE.sRGBEncoding; return t; };
  const A = mk(), B = mk(), C = mk();
  A.depthTexture = new THREE.DepthTexture(1, 1); A.depthTexture.type = THREE.UnsignedIntType;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { InSampler: { value: null }, InDepthSampler: { value: null }, OutSize: { value: new THREE.Vector2(1, 1) }, Hole: { value: new THREE.Vector4() }, Hole2: { value: new THREE.Vector4() } },
    vertexShader: `varying vec2 texCoord; void main(){ texCoord = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D InSampler; uniform sampler2D InDepthSampler; uniform vec2 OutSize; uniform vec4 Hole; uniform vec4 Hole2; varying vec2 texCoord;
      float bhHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float bhNoiseWrapped(vec2 p, float period){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3. - 2. * f);
        float x0 = mod(i.x, period), x1 = mod(i.x + 1., period);
        return mix(mix(bhHash(vec2(x0, i.y)), bhHash(vec2(x1, i.y)), f.x), mix(bhHash(vec2(x0, i.y + 1.)), bhHash(vec2(x1, i.y + 1.)), f.x), f.y); }
      float bhFbmWrapped(vec2 p, float period){ float v = 0., a = .5;
        for (int i = 0; i < 4; i++) { v += a * bhNoiseWrapped(p, period); p = vec2(p.x * 2., p.y * 2.07); period *= 2.; a *= .5; } return v; }
      float occlusion(float scene, float nearEdge, float farEdge){ float span = max(abs(farEdge - nearEdge), 1e-12);
        float t = clamp((scene - nearEdge) / span, 0., 1.); return t * t * (3. - 2. * t); }
      void main(){
        vec4 b4 = texture2D(InSampler, texCoord); vec3 base = b4.rgb;
        float thetaE = Hole.z;
        float occ = occlusion(texture2D(InDepthSampler, texCoord).r, Hole2.x, Hole2.y);
        if (thetaE <= .0001 || occ <= 0.) { gl_FragColor = vec4(base, 1.); return; }
        float aspect = OutSize.x / OutSize.y;
        vec2 center = vec2(Hole.x * aspect, Hole.y), here = vec2(texCoord.x * aspect, texCoord.y), offset = here - center;
        float r = length(offset), shadow = Hole.w, veil = 1.;
        if (r > thetaE * 10.) { gl_FragColor = vec4(base, 1.); return; }
        float px = 1. / max(OutSize.y, 1.);
        float shadowMask = 1. - smoothstep(shadow - px, shadow + px, r);
        vec2 dir = offset / max(r, 1e-5);
        float bend = (thetaE * thetaE) / max(r, 1e-4);
        vec3 color = vec3(0.);
        if (shadowMask < .999) {
          vec2 sq = center + dir * (r - bend); vec2 uv = clamp(vec2(sq.x / aspect, sq.y), vec2(.001), vec2(.999));
          color = mix(texture2D(InSampler, uv).rgb, vec3(0.), shadowMask);
        }
        float u = r / max(shadow, 1e-5);
        float ang = atan(offset.y, abs(offset.y) + abs(offset.x) < 1e-7 ? 1e-7 : offset.x);
        float haze = 1. - veil;
        float glow = exp(-pow(max(u, 1e-6) / (3.499 * (1. + .55 * haze)), 2.697));
        float dip = 1. - .050 * exp(-pow(max(u, 1e-6) / 1.037, 2.6));
        float arc = exp(-pow((u - 1.484) / (.398 * (1. + 1.3 * haze)), 2.));
        float photon = exp(-pow((u - 1.060) / (.075 * (1. + 4.5 * haze)), 2.));
        float across = abs(offset.y) / max(shadow, 1e-5), along = abs(offset.x) / max(shadow, 1e-5);
        float barW = (.175 + .103 * along) * (1. + 1.1 * haze);
        float bar = exp(-pow(across / barW, 1.5)) * exp(-pow(along / 7.31, 1.35));
        float turn = ang * .15915494;
        float streak = bhFbmWrapped(vec2(turn * 19., u * 5.) + 11., 19.);
        float clump = bhFbmWrapped(vec2(turn * 6., u * 1.4) + 37., 6.);
        float grain = 1. + ((.66 + .68 * streak) * (.86 + .28 * clump) - 1.) * smoothstep(1.6, 3., u) * veil;
        float inten = clamp(glow * dip * .795 + arc * .265 * grain + photon * .16 + bar * .323 * grain, 0., 1.);
        vec3 discColor = mix(vec3(.74, .55, .53), vec3(.95, .93, .98), clamp(inten / .9, 0., 1.));
        color += discColor * (inten / .9) * veil;
        gl_FragColor = vec4(mix(base, color, occ), 1.);
      }`,
    depthTest: false, depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const size = new THREE.Vector2(), v = new V3(), q = new V3(), f = new V3();
  function holesOf(s) {
    if (!s.userData.holes) { s.userData.holes = []; s.traverse(o => o.userData && o.userData.isHole && s.userData.holes.push(o)); }
    return s.userData.holes;
  }
  // depth of a point `d` along the view axis, as the (conventional) buffer stores it
  function depthAt(c, d) { q.set(0, 0, -Math.max(d, c.near * 1.001)).applyMatrix4(c.projectionMatrix); return q.z * .5 + .5; }
  function render(s, c) {
    const holes = holesOf(s);
    if (!holes.length) { R.setRenderTarget(null); R.render(s, c); return; }
    R.getDrawingBufferSize(size);
    c.updateMatrixWorld(); c.matrixWorldInverse.copy(c.matrixWorld).invert();
    const tanHalfY = Math.tan(c.fov * Math.PI / 360), list = [];
    holes.forEach(h => {
      h.getWorldPosition(v); const dist = v.distanceTo(c.position);
      v.applyMatrix4(c.matrixWorldInverse); if (v.z > -h.userData.r) return;          // behind or around the eye
      const ah = Math.atan2(h.userData.r, dist), thetaE = Math.tan(Math.min(1.5, ah * 2)) / (2 * tanHalfY);
      f.copy(v).applyMatrix4(c.projectionMatrix); const sx = f.x * .5 + .5, sy = f.y * .5 + .5;
      const ax = (sx - .5) * size.x / size.y, ay = sy - .5, halfW = .5 * size.x / size.y;      // off screen by more than its reach: nothing to bend
      if (Math.abs(ax) - halfW > thetaE * 10 || Math.abs(ay) - .5 > thetaE * 10) return;
      const front = -v.z - h.userData.r, feather = h.userData.r * .35;
      list.push({ dist, hole: [sx, sy, thetaE, Math.tan(Math.min(1.5, ah * 1.22)) / (2 * tanHalfY)], band: [depthAt(c, front - feather), depthAt(c, front + feather)] });
    });
    // no hole within reach of the frame: draw straight to the canvas and keep its antialiasing
    if (!list.length) { R.setRenderTarget(null); R.render(s, c); return; }
    list.sort((a, b) => b.dist - a.dist);
    [A, B, C].forEach(t => { if (t.width !== size.x || t.height !== size.y) t.setSize(size.x, size.y); });
    R.setRenderTarget(A); R.render(s, c);
    const U = mat.uniforms; U.OutSize.value.copy(size); U.InDepthSampler.value = A.depthTexture;
    let src = A;
    list.forEach((it, i) => {
      const dst = i === list.length - 1 ? null : (src === B ? C : B);
      U.InSampler.value = src.texture; U.Hole.value.set(...it.hole); U.Hole2.value.set(it.band[0], it.band[1], 0, 1);
      R.setRenderTarget(dst); R.render(scene, cam); src = dst;
    });
  }
  return { render };
})();
/* a scene's own sky, drawn in WebGL so the lens bends it too (the page's CSS sky sits behind the canvas, out of the pass's reach) */
function skyTex(draw) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 512; draw(cv.getContext("2d"), 512);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}
function radialSky(base, cx, cy, rx, ry, stops) {
  return skyTex((g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S); g.save(); g.translate(cx * S, cy * S); g.scale(rx * S, ry * S);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(-3, -3, 6, 6); g.restore();
  });
}
