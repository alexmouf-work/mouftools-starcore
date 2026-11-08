// node heroprobe.js <url> <outprefix> : iPhone emulation, 4x CPU, 4G network. When the opening shot appears vs when the rest is up.
const { chromium, devices } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY && /^https/.test(url) ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true }); const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 85, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  const t0 = Date.now(); await pg.goto(url, { waitUntil: 'domcontentloaded' });
  let hero = null, full = null;
  for (let i = 0; i < 400 && full === null; i++) {
    const s = await pg.evaluate(() => ({ h: !!document.getElementById('hero-gl') || performance.getEntriesByName('hero').length > 0, f: performance.getEntriesByName('started').length > 0 }));
    const el = (Date.now() - t0) / 1000;
    if (s.h && hero === null) { hero = el; await pg.screenshot({ path: out + '_hero.png' }); }
    if (s.f && full === null) full = el;
    await pg.waitForTimeout(250);
  }
  const marks = await pg.evaluate(() => performance.getEntriesByType('mark').map(m => [m.name, Math.round(m.startTime)]));
  console.log(JSON.stringify({ opening_shot_s: hero, everything_s: full, marks, errs: errs.slice(0, 3) }));
  await pg.waitForTimeout(3000); await pg.screenshot({ path: out + '_full.png' });
  await b.close();
})();
