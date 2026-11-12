// node shot9.js <outdir> <desk|phone> <prefix> t1,t2,... (seconds into the Journey): press Start, pause, click the bar at each time
const { chromium, devices } = require('playwright');
(async () => {
  const [out, mode, prefix, list] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'phone' ? await b.newContext({ ...devices['iPhone 13'] }) : await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto((process.env.BASE || 'http://127.0.0.1:8766') + '/' + (process.env.PAGE || 'star-core-journey.html')); await pg.waitForTimeout(6000);
  await pg.screenshot({ path: `${out}/${prefix}_hero.png`, timeout: 120000 });
  await pg.click('#play'); await pg.waitForTimeout(500); await pg.click('#pp');
  const TOTAL = 58;
  for (const s of list.split(',')) {
    const box = await pg.locator('#track').boundingBox();
    await pg.mouse.click(box.x + box.width * (+s / TOTAL), box.y + box.height / 2); await pg.waitForTimeout(5000);
    await pg.screenshot({ path: `${out}/${prefix}_${s}.png`, timeout: 120000 });
  }
  console.log(prefix, JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
