// node shot7.js <outdir> <desk|phone> <prefix> <view> id:frac[,id:frac...]
const { chromium, devices } = require('playwright');
(async () => {
  const [out, mode, prefix, view, list] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = mode === 'phone' ? await b.newContext({ ...devices['iPhone 13'] }) : await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await pg.goto((process.env.BASE || 'http://127.0.0.1:8765') + '/star-core-journey.html#' + view); await pg.waitForTimeout(view === 'updates' ? 15000 : 7000);
  for (const item of list.split(',')) {
    const [id, frac] = item.split(':');
    const y = await pg.evaluate(([s, f]) => { const e = document.getElementById(s); return e.getBoundingClientRect().top + scrollY + (+f) * (e.offsetHeight - innerHeight); }, [id, frac]);
    await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(4500);
    await pg.screenshot({ path: `${out}/${prefix}_${id}_${frac}.png`, timeout: 120000 });
  }
  console.log(prefix, JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
