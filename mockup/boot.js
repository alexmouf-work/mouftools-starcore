/* ---------------- boot: fetch the Journey's files in parallel, then start ----------------
   tex.webp      every block texture once, native size, lossless          journey.json   scenes' small data + pack index
   planets.webp  every planet net once, native size, lossless             journey.txt    deflated quads + the galaxy's systems
   The Updates tab's updates.json / updates.txt are fetched the first time it opens. */
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
}
function getOk(url) { return fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r; }); }
// base64 text of a zlib stream (the only byte-exact type the host serves that fetch can read), inflated by the browser itself
async function inflate(url) {
  const t = (await (await getOk(url)).text()).trim(), s = atob(t), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
}
/* a native sheet rebuilt for the GPU: each cell upscaled by its factor (divided by div, never below 1), extruded gutters, shelf-packed
   into a power-of-two canvas. Returns the canvas and every texture's rect in it, by name. */
function expand(img, spec, div) {
  const G = spec.gutter, W = 4096, place = [];
  let x = 0, y = 0, row = 0;
  spec.cells.forEach(([, , sw, sh, s]) => {
    const k = Math.max(1, s / div), cw = sw * k + 2 * G, ch = sh * k + 2 * G;
    if (x + cw > W) { x = 0; y += row; row = 0; }
    place.push([x, y, k]); x += cw; row = Math.max(row, ch);
  });
  let H = 1; while (H < y + row) H *= 2;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
  spec.cells.forEach(([sx, sy, sw, sh], i) => {
    const [px, py, k] = place[i], w = sw * k, h = sh * k, ix = px + G, iy = py + G;
    c.drawImage(img, sx, sy, sw, sh, ix, iy, w, h);
    c.drawImage(img, sx, sy, sw, 1, ix, py, w, G); c.drawImage(img, sx, sy + sh - 1, sw, 1, ix, iy + h, w, G);
    c.drawImage(cv, ix, py, 1, h + 2 * G, px, py, G, h + 2 * G); c.drawImage(cv, ix + w - 1, py, 1, h + 2 * G, ix + w, py, G, h + 2 * G);
  });
  const rects = {};
  Object.entries(spec.names).forEach(([n, i]) => { const [px, py, k] = place[i], cell = spec.cells[i]; rects[n] = [px + G, py + G, cell[2] * k, cell[3] * k]; });
  return { canvas: cv, rects, W, H };
}
const bootEl = document.getElementById("boot");
Promise.all([loadImg("tex.webp"), loadImg("planets.webp"), getOk("journey.json").then(r => r.json()), inflate("journey.txt")])
  .then(([texImg, planetsImg, J, jbin]) => { start({ texImg, planetsImg, J, jbin }); bootEl.hidden = true; })
  .catch(err => { bootEl.textContent = "This page could not load its scenes."; console.error(err); });
