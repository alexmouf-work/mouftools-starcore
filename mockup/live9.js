// node live9.js <outdir> <desk|phone> <prefix> t1,t2,...  — the LIVE site, through its own player
const { chromium, devices } = require('playwright');
(async () => {
  const [out, mode, prefix, list] = process.argv.slice(2);
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const base = mode === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } };
  const ctx = await b.newContext({ ...base, ignoreHTTPSErrors: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(process.env.URL || 'https://starcore.mouftools.com/', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(9000);
  await pg.click('#play'); await pg.waitForTimeout(500); await pg.click('#pp');
  for (const s of list.split(',')) {
    const box = await pg.locator('#track').boundingBox();
    await pg.mouse.click(box.x + box.width * (+s / 137), box.y + box.height / 2); await pg.waitForTimeout(6000);
    await pg.screenshot({ path: `${out}/${prefix}_${s}.png`, timeout: 120000 });
  }
  console.log(prefix, 'errors', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
